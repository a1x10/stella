import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import os from "node:os"
import { execSync } from "node:child_process"
import { fileURLToPath } from "node:url"
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const STELLA_HIDDEN = path.join(os.homedir(), ".stella", ".secure")
const KEY_FILE = path.join(STELLA_HIDDEN, "vault.dat")
const FINGERPRINT_FILE = path.join(STELLA_HIDDEN, ".fp")
const INTEGRITY_FILE = path.join(STELLA_HIDDEN, ".integrity")
const LOCKOUT_FILE = path.join(STELLA_HIDDEN, ".lockout")
const CLI_FILES = [
  "stella-cli/index.mjs",
  "stella-cli/tools.mjs",
  "stella-cli/banner.mjs",
  "stella-cli/theme.mjs",
  "stella-cli/markdown.mjs",
  "stella-cli/security.mjs",
]
function ensureDir() {
  fs.mkdirSync(STELLA_HIDDEN, { recursive: true })
  try {
    if (process.platform === "win32") {
      execSync(`attrib +h "${STELLA_HIDDEN}"`, { stdio: "ignore" })
    }
  } catch {}
}
const PBKDF2_ITERATIONS = 100000
const SALT = "stella-vault-v3-2026"
function deriveKey(password) {
  return crypto.pbkdf2Sync(password, SALT, PBKDF2_ITERATIONS, 32, "sha512")
}
function aesEncrypt(plaintext, password) {
  const key = deriveKey(password)
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const authTag = cipher.getAuthTag()
  const payload = Buffer.concat([iv, authTag, encrypted])
  return payload.toString("base64")
}
function aesDecrypt(encryptedBase64, password) {
  const key = deriveKey(password)
  const payload = Buffer.from(encryptedBase64, "base64")
  if (payload.length < 28) return null
  const iv = payload.subarray(0, 12)
  const authTag = payload.subarray(12, 28)
  const encrypted = payload.subarray(28)
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv)
  decipher.setAuthTag(authTag)
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()])
  return decrypted.toString("utf8")
}
function xorEncrypt(data, key) {
  return aesEncrypt(data, key)
}
function xorDecrypt(encrypted, key) {
  try { return aesDecrypt(encrypted, key) } catch { return null }
}
function getHardwareFingerprint() {
  const parts = []
  try {
    if (process.platform === "win32") {
      const cpuId = execSync(
        'wmic cpu get ProcessorId /value 2>nul | findstr ProcessorId',
        { encoding: "utf8", timeout: 5000 }
      ).trim()
      parts.push(cpuId)
      const mbSerial = execSync(
        'wmic baseboard get SerialNumber /value 2>nul | findstr SerialNumber',
        { encoding: "utf8", timeout: 5000 }
      ).trim()
      parts.push(mbSerial)
      const biosSerial = execSync(
        'wmic bios get SerialNumber /value 2>nul | findstr SerialNumber',
        { encoding: "utf8", timeout: 5000 }
      ).trim()
      parts.push(biosSerial)
      const diskSerial = execSync(
        'wmic diskdrive get SerialNumber /value 2>nul | findstr SerialNumber',
        { encoding: "utf8", timeout: 5000 }
      ).trim()
      parts.push(diskSerial)
    } else if (process.platform === "darwin") {
      const ioPlatformUuid = execSync(
        "ioreg -rd1 -c IOPlatformExpertDevice | awk '/IOPlatformUUID/ { print $3 }'",
        { encoding: "utf8", timeout: 5000 }
      ).trim()
      parts.push(ioPlatformUuid)
    } else {
      const mid = execSync("cat /var/lib/dbus/machine-id 2>/dev/null || cat /etc/machine-id 2>/dev/null", {
        encoding: "utf8",
        timeout: 5000,
      }).trim()
      parts.push(mid)
    }
    const nets = os.networkInterfaces()
    for (const name of Object.keys(nets)) {
      for (const net of nets[name]) {
        if (net.mac && net.mac !== "00:00:00:00:00:00") {
          parts.push(net.mac)
        }
      }
    }
  } catch {}
  if (parts.length === 0) {
    parts.push(os.hostname())
    parts.push(os.cpus()[0]?.model || "unknown")
    parts.push(os.totalmem().toString())
  }
  return crypto.createHash("sha512").update(parts.join(":::")).digest("hex")
}
function getEncryptionKey() {
  return crypto.createHash("sha256").update("stella-vault-portable-2026").digest("hex")
}
function computeCodeHash() {
  const projectRoot = path.resolve(__dirname, "..")
  let combined = ""
  for (const file of CLI_FILES) {
    const full = path.join(projectRoot, file)
    try {
      combined += fs.readFileSync(full, "utf8")
    } catch {}
  }
  return crypto.createHash("sha256").update(combined).digest("hex")
}
export function verifyCodeIntegrity() {
  ensureDir()
  const currentHash = computeCodeHash()
  if (fs.existsSync(INTEGRITY_FILE)) {
    const saved = fs.readFileSync(INTEGRITY_FILE, "utf8").trim()
    if (saved !== currentHash) {
      return { ok: true, warning: "Код был изменён (ожидается при разработке)" }
    }
  } else {
    fs.writeFileSync(INTEGRITY_FILE, currentHash, "utf8")
  }
  return { ok: true }
}
export function saveIntegrityHash() {
  ensureDir()
  fs.writeFileSync(INTEGRITY_FILE, computeCodeHash(), "utf8")
}
export function getApiKey() {
  ensureDir()
  if (!fs.existsSync(KEY_FILE)) return null
  try {
    const encrypted = fs.readFileSync(KEY_FILE, "utf8").trim()
    const encKey = getEncryptionKey()
    const apiKey = xorDecrypt(encrypted, encKey)
    if (!apiKey || apiKey.length < 10) return null
    return { apiKey }
  } catch {
    return null
  }
}
export function saveApiKey(apiKey) {
  ensureDir()
  if (!apiKey || typeof apiKey !== "string" || apiKey.length < 10) {
    return { ok: false, error: "Неверный формат API ключа" }
  }
  const encKey = getEncryptionKey()
  const encrypted = xorEncrypt(apiKey, encKey)
  fs.writeFileSync(KEY_FILE, encrypted, "utf8")
  saveIntegrityHash()
  try {
    if (process.platform === "win32") {
      execSync(`attrib +h +s "${KEY_FILE}"`, { stdio: "ignore" })
      execSync(`attrib +h +s "${INTEGRITY_FILE}"`, { stdio: "ignore" })
    }
  } catch {}
  return { ok: true }
}
export function deleteApiKey() {
  ensureDir()
  try {
    if (fs.existsSync(KEY_FILE)) fs.unlinkSync(KEY_FILE)
    if (fs.existsSync(FINGERPRINT_FILE)) fs.unlinkSync(FINGERPRINT_FILE)
    if (fs.existsSync(INTEGRITY_FILE)) fs.unlinkSync(INTEGRITY_FILE)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e.message }
  }
}
export function isKeyBoundToThisMachine() {
  const result = getApiKey()
  if (!result || result.error) return false
  return true
}
export function getHardwareInfo() {
  const fp = getHardwareFingerprint()
  return {
    fingerprint: fp.substring(0, 16) + "...",
    platform: process.platform,
    hostname: os.hostname(),
    cpu: os.cpus()[0]?.model || "unknown",
  }
}