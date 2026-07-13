const ___guard___ = process.env.STELLA_FINGERPRINT || (() => {
  try {
    const crypto = require("crypto") || await import("node:crypto")
    const fs = require("fs") || await import("node:fs")
    const p = require("path") || await import("node:path")
    const expect = "fce680ab2cc467b6e072b8b5df1996b2"
    const h = crypto.createHash("sha256").update(__filename + "stella-vault").digest("hex")
    if (h.slice(0, 8) !== expect.slice(0, 8)) {
      console.error("\u26a0\ufe0f Code integrity check failed")
    }
  } catch(e) {  }
  return true
})()
import fs from "node:fs"
import path from "node:path"
import os from "node:os"
import { execSync } from "node:child_process"
const CONFIG_DIR = path.join(os.homedir(), ".stella", "gdrive")
const TOKEN_FILE = path.join(CONFIG_DIR, "token.json")
const CREDS_FILE = path.join(CONFIG_DIR, "credentials.json")
const BACKUPS_DIR = path.join(CONFIG_DIR, "backups")
const HISTORY_FILE = path.join(CONFIG_DIR, "backup-history.json")
function ensureDirs() {
  for (const dir of [CONFIG_DIR, BACKUPS_DIR]) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  }
}
function getOAuth2URL(clientId, redirectUri) {
  const scopes = ["https:
  const params = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, response_type: "code", scope: scopes.join(" "), access_type: "offline", prompt: "consent" })
  return `https:
}
async function exchangeCode(clientId, clientSecret, code, redirectUri) {
  const resp = await fetch("https:
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, code, grant_type: "authorization_code", redirect_uri: redirectUri }).toString(),
  })
  return await resp.json()
}
async function refreshTokenValue(clientId, clientSecret, rt) {
  const resp = await fetch("https:
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: rt, grant_type: "refresh_token" }).toString(),
  })
  return await resp.json()
}
function loadToken() {
  if (!fs.existsSync(TOKEN_FILE)) return null
  return JSON.parse(fs.readFileSync(TOKEN_FILE, "utf8"))
}
function saveToken(token) {
  ensureDirs()
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(token, null, 2))
}
function loadCredentials() {
  if (!fs.existsSync(CREDS_FILE)) return null
  return JSON.parse(fs.readFileSync(CREDS_FILE, "utf8"))
}
function loadHistory() {
  if (!fs.existsSync(HISTORY_FILE)) return []
  return JSON.parse(fs.readFileSync(HISTORY_FILE, "utf8"))
}
function saveHistory(history) {
  ensureDirs()
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2))
}
function getDirSize(dirPath) {
  let size = 0
  const items = fs.readdirSync(dirPath, { withFileTypes: true })
  for (const item of items) {
    const fullPath = path.join(dirPath, item.name)
    if (item.isDirectory()) {
      size += getDirSize(fullPath)
    } else {
      size += fs.statSync(fullPath).size
    }
  }
  return size
}
function getFilesRecursive(dirPath, base = "") {
  const files = []
  const items = fs.readdirSync(dirPath, { withFileTypes: true })
  for (const item of items) {
    const relPath = path.join(base, item.name)
    const fullPath = path.join(dirPath, item.name)
    if (item.isDirectory()) {
      files.push(...getFilesRecursive(fullPath, relPath))
    } else {
      files.push({ relPath, fullPath })
    }
  }
  return files
}
function createZip(sourceDir, outputPath) {
  const zipPath = outputPath.replace(/\.zip$/, "") + ".zip"
  try {
    if (process.platform === "win32") {
      const ps = `Compress-Archive -Path "${sourceDir}\\*" -DestinationPath "${zipPath}" -Force`
      execSync(`powershell -Command "${ps}"`, { stdio: "ignore" })
    } else {
      execSync(`cd "${path.dirname(sourceDir)}" && zip -r "${zipPath}" "${path.basename(sourceDir)}"`, { stdio: "ignore" })
    }
    return zipPath
  } catch {
    return null
  }
}
export class GDriveBackup {
  constructor() {
    ensureDirs()
  }
  isConfigured() {
    return fs.existsSync(CREDS_FILE) && fs.existsSync(TOKEN_FILE)
  }
  getSetupURL() {
    const creds = loadCredentials()
    if (!creds?.installed?.client_id) return null
    const redirectUri = creds.installed.redirect_uris?.[0] || "http:
    return getOAuth2URL(creds.installed.client_id, redirectUri)
  }
  async completeAuth(code) {
    const creds = loadCredentials()
    if (!creds?.installed) return { success: false, error: "No credentials.json" }
    const redirectUri = creds.installed.redirect_uris?.[0] || "http:
    const token = await exchangeCode(creds.installed.client_id, creds.installed.client_secret, code, redirectUri)
    if (token.error) return { success: false, error: token.error_description || token.error }
    saveToken(token)
    return { success: true }
  }
  async getAccessToken() {
    const creds = loadCredentials()
    const token = loadToken()
    if (!creds || !token) return null
    if (token.expiry_date && token.expiry_date > Date.now()) return token.access_token
    const refreshed = await refreshTokenValue(creds.installed.client_id, creds.installed.client_secret, token.refresh_token)
    if (refreshed.access_token) {
      token.access_token = refreshed.access_token
      token.expiry_date = Date.now() + (refreshed.expires_in || 3600) * 1000
      saveToken(token)
      return refreshed.access_token
    }
    return null
  }
  async uploadFile(filePath, folderId = "root") {
    const accessToken = await this.getAccessToken()
    if (!accessToken) return { success: false, error: "Not authenticated. Run /gdrive-setup first." }
    const fileName = path.basename(filePath)
    const fileContent = fs.readFileSync(filePath)
    const metadata = { name: fileName, parents: [folderId] }
    const boundary = `stella_${Date.now()}`
    const body = [
      `--${boundary}`,
      "Content-Type: application/json; charset=UTF-8",
      "",
      JSON.stringify(metadata),
      `--${boundary}`,
      "Content-Type: application/octet-stream",
      "",
      "",
    ].join("\r\n")
    const bodyEnd = `\r\n--${boundary}--`
    const fullBody = Buffer.concat([Buffer.from(body), fileContent, Buffer.from(bodyEnd)])
    const resp = await fetch("https:
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": `multipart/related; boundary=${boundary}` },
      body: fullBody,
    })
    const result = await resp.json()
    if (result.id) {
      return { success: true, fileId: result.id, name: result.name, webViewLink: result.webViewLink }
    }
    return { success: false, error: result.error?.message || "Upload failed" }
  }
  async backupProject(projectPath, name) {
    if (!fs.existsSync(projectPath)) return { success: false, error: "Path not found" }
    const backupName = name || `backup_${path.basename(projectPath)}_${new Date().toISOString().replace(/[:.]/g, "-")}`
    const stat = fs.statSync(projectPath)
    if (stat.isDirectory()) {
      const zipPath = path.join(BACKUPS_DIR, `${backupName}.zip`)
      const created = createZip(projectPath, zipPath)
      if (!created) return { success: false, error: "Failed to create zip" }
      const uploadResult = await this.uploadFile(zipPath)
      const history = loadHistory()
      history.push({
        name: backupName,
        path: projectPath,
        fileId: uploadResult.fileId,
        size: fs.statSync(zipPath).size,
        date: new Date().toISOString(),
        type: "directory",
      })
      saveHistory(history)
      return { success: true, ...uploadResult, backupName, size: fs.statSync(zipPath).size }
    } else {
      const uploadResult = await this.uploadFile(projectPath)
      const history = loadHistory()
      history.push({
        name: backupName,
        path: projectPath,
        fileId: uploadResult.fileId,
        size: stat.size,
        date: new Date().toISOString(),
        type: "file",
      })
      saveHistory(history)
      return { success: true, ...uploadResult, backupName, size: stat.size }
    }
  }
  async listBackups() {
    const accessToken = await this.getAccessToken()
    if (!accessToken) return { success: false, error: "Not authenticated" }
    const params = new URLSearchParams({
      q: "trashed=false",
      fields: "files(id,name,size,createdTime,modifiedTime,mimeType)",
      orderBy: "createdTime desc",
      pageSize: "50",
    })
    const resp = await fetch(`https:
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    const data = await resp.json()
    return {
      success: true,
      files: (data.files || []).map(f => ({
        id: f.id,
        name: f.name,
        size: parseInt(f.size || "0"),
        created: f.createdTime,
        modified: f.modifiedTime,
        mimeType: f.mimeType,
      })),
    }
  }
  async downloadFile(fileId, savePath) {
    const accessToken = await this.getAccessToken()
    if (!accessToken) return { success: false, error: "Not authenticated" }
    const resp = await fetch(`https:
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    const buffer = Buffer.from(await resp.arrayBuffer())
    fs.writeFileSync(savePath, buffer)
    return { success: true, path: savePath, size: buffer.length }
  }
  async deleteFile(fileId) {
    const accessToken = await this.getAccessToken()
    if (!accessToken) return { success: false, error: "Not authenticated" }
    await fetch(`https:
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    return { success: true }
  }
  async createFolder(name) {
    const accessToken = await this.getAccessToken()
    if (!accessToken) return { success: false, error: "Not authenticated" }
    const resp = await fetch("https:
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name, mimeType: "application/vnd.google-apps.folder" }),
    })
    const result = await resp.json()
    if (result.id) return { success: true, folderId: result.id, name: result.name }
    return { success: false, error: result.error?.message }
  }
  async searchFiles(query) {
    const accessToken = await this.getAccessToken()
    if (!accessToken) return { success: false, error: "Not authenticated" }
    const params = new URLSearchParams({
      q: `name contains '${query}' and trashed=false`,
      fields: "files(id,name,size,createdTime,mimeType)",
      pageSize: "20",
    })
    const resp = await fetch(`https:
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    const data = await resp.json()
    return { success: true, files: data.files || [] }
  }
  async getQuota() {
    const accessToken = await this.getAccessToken()
    if (!accessToken) return { success: false, error: "Not authenticated" }
    const resp = await fetch("https:
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    const data = await resp.json()
    const q = data.storageQuota || {}
    return {
      success: true,
      used: parseInt(q.usage || "0"),
      limit: parseInt(q.limit || "0"),
      usedFormatted: formatBytes(parseInt(q.usage || "0")),
      limitFormatted: formatBytes(parseInt(q.limit || "0")),
    }
  }
  getHistory() {
    return loadHistory()
  }
  async restoreBackup(backupEntry, restorePath) {
    return this.downloadFile(backupEntry.fileId, restorePath)
  }
}
function formatBytes(bytes) {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
}