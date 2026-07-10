import fs from "node:fs"
import path from "node:path"
import { execSync } from "node:child_process"
import { checkFileForMalware, computeFileHash, SKIP_DIRS, QUICK_SCAN_PATHS, QUARANTINE_DIR, isExcluded } from "./database.mjs"

// ═══════════════════════════════════════════════════════════════
//  STELLAR ANTIVIRUS — Full Scanner Engine
// ═══════════════════════════════════════════════════════════════

const SCAN_EXTENSIONS = new Set([
  ".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx",
  ".py", ".rb", ".php", ".pl", ".sh", ".bash",
  ".bat", ".cmd", ".ps1", ".psm1", ".psd1",
  ".exe", ".dll", ".sys", ".com", ".scr", ".pif",
  ".vbs", ".vbe", ".jse", ".wsf", ".wsh",
  ".hta", ".cpl", ".msi", ".msp", ".mst",
  ".doc", ".docm", ".xls", ".xlsm", ".ppt", ".pptm",
  ".pdf", ".rtf",
  ".jar", ".class", ".war",
  ".reg", ".inf",
])

// Skip large files (over 10MB for speed)
const MAX_FILE_SIZE = 10 * 1024 * 1024

// Known safe directories to skip
const SAFE_DIRS = new Set([
  "Microsoft", "dotnet", "NuGet", "pip", "npm", "node-gyp",
  "VisualStudio", "VS", "Windows Kits", "Windows Defender",
  "Package Cache", "Installer", "apps", "packages",
  "Windows SDK", "WindowsAppCertificationKit", "WindowsDesktopExtensionSDK",
  "WindowsIoTExtensionSDK", "WindowsMobileExtensionSDK", "WindowsTeamExtensionSDK",
  "Universal CRT", "WinRT Intellisense", "Kits", "WPT",
])

// Skip files from known safe publishers
const SAFE_FILE_PATTERNS = [
  /^vs_/, /^Microsoft\.VisualStudio/, /^dump64/, /^msdia/, /^msvcp/,
  /^vcruntime/, /^KernelTrace/, /^feedback/, /^Dia2Lib/, /^envdte/,
  /^OSExtensions/, /^TraceRelogger/, /^msalruntime/, /^websocket-sharp/,
  /^System\./, /^Microsoft\.Diagnostics/, /^Microsoft\.Identity/,
  /^node-gyp/, /^Setup$/, /^setup\.exe$/, /^InstallCleanup/,
  /^VSInstallerElevationService/, /^vswhere/, /^vs_installer/,
  /^vs_installershell/, /^Microsoft\.VisualStudio\.Setup\./,
  /^D3DCompiler/, /^PresentationNative/, /^wpfgfx/,
  /^capCut/, /^ChromeSetup/, /^Claude/, /^Codex/, /^Docker/,
  /^BlueStacks/, /^VC_redist/,
]

// Safe path patterns (substring match)
const SAFE_PATH_PATTERNS = [
  "\\Microsoft\\", "\\dotnet\\", "\\NuGet\\", "\\pip\\", "\\npm\\",
  "\\node-gyp\\", "\\Visual Studio\\", "\\Windows Kits\\",
  "\\Package Cache\\", "\\Installer\\", "\\Windows SDK\\",
  "\\AppData\\Local\\Temp\\", "\\AppData\\Local\\Microsoft\\",
  "\\AppData\\Roaming\\npm\\", "\\AppData\\Roaming\\pip\\",
]

// ═══════════════════════════════════════════════════════════════
//  EXCLUSIONS
// ═══════════════════════════════════════════════════════════════

let exclusions = []

export function loadExclusions(filepath) {
  try {
    if (fs.existsSync(filepath)) {
      exclusions = fs.readFileSync(filepath, "utf8")
        .split("\n")
        .map(l => l.trim())
        .filter(l => l && !l.startsWith("#"))
    }
  } catch {}
}

export function addExclusion(pattern) {
  if (!exclusions.includes(pattern)) {
    exclusions.push(pattern)
  }
}

export function removeExclusion(pattern) {
  exclusions = exclusions.filter(e => e !== pattern)
}

export function getExclusions() {
  return [...exclusions]
}

function isExcludedPath(filepath) {
  const normalized = filepath.replace(/\\/g, "/").toLowerCase()
  for (const exc of exclusions) {
    const pattern = exc.replace(/\\/g, "/").toLowerCase()
    if (normalized.includes(pattern)) return true
  }
  return false
}

// ═══════════════════════════════════════════════════════════════
//  FILE SCANNER
// ═══════════════════════════════════════════════════════════════

export function scanFile(filepath, options = {}) {
  const { verbose = false, onFile = null } = options

  try {
    if (!fs.existsSync(filepath)) return { filepath, error: "Файл не найден" }

    const stat = fs.statSync(filepath)
    if (!stat.isFile()) return { filepath, error: "Не является файлом" }

    if (stat.size > MAX_FILE_SIZE) return { filepath, error: `Файл слишком большой (${(stat.size / 1024 / 1024).toFixed(1)} MB)` }

    if (isExcludedPath(filepath)) return { filepath, excluded: true }

    // Skip known safe files
    const basename = path.basename(filepath)
    if (SAFE_FILE_PATTERNS.some(p => p.test(basename))) return { filepath, excluded: true }

    // Skip safe path patterns
    if (SAFE_PATH_PATTERNS.some(p => filepath.includes(p))) return { filepath, excluded: true }

    if (onFile) onFile(filepath, stat.size)

    const content = fs.readFileSync(filepath)
    const result = checkFileForMalware(content, filepath)
    result.size = stat.size
    result.modified = stat.mtime
    result.hash = computeFileHash(content)

    return result
  } catch (e) {
    return { filepath, error: e.message }
  }
}

// ═══════════════════════════════════════════════════════════════
//  FULL SYSTEM SCAN
// ═══════════════════════════════════════════════════════════════

export function fullSystemScan(options = {}) {
  const { verbose = false, onFile = null, onProgress = null, maxDepth = 20 } = options
  const results = []
  let fileCount = 0

  function walk(currentPath, depth) {
    if (depth > maxDepth) return

    let entries
    try {
      entries = fs.readdirSync(currentPath, { withFileTypes: true })
    } catch { return }

    for (const entry of entries) {
      if (SKIP_DIRS.has(entry.name)) continue
      if (SAFE_DIRS.has(entry.name)) continue
      if (entry.name.startsWith(".") && entry.name !== ".env" && entry.name !== ".config") continue

      const fullPath = path.join(currentPath, entry.name)

      if (entry.isDirectory()) {
        walk(fullPath, depth + 1)
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase()
        if (SCAN_EXTENSIONS.has(ext) || !ext) {
          fileCount++
          if (onProgress) onProgress(fileCount, fullPath)

          const result = scanFile(fullPath, { verbose, onFile })
          results.push(result)
        }
      }
    }
  }

  // Scan all drives on Windows
  const drives = ["C:", "D:", "E:", "F:"]
  for (const drive of drives) {
    const drivePath = drive + "\\"
    if (fs.existsSync(drivePath)) {
      walk(drivePath, 0)
    }
  }

  return { results, totalFiles: fileCount, scanType: "full" }
}

// ═══════════════════════════════════════════════════════════════
//  QUICK SCAN
// ═══════════════════════════════════════════════════════════════

export function quickScan(options = {}) {
  const { verbose = false, onFile = null, onProgress = null, maxFiles = 2000 } = options
  const results = []
  let fileCount = 0

  const username = process.env.USERNAME || process.env.USER || "user"

  const scanPaths = QUICK_SCAN_PATHS.map(p =>
    p.replace(/%USERNAME%/g, username)
  )

  for (const scanPath of scanPaths) {
    if (!fs.existsSync(scanPath)) continue
    if (fileCount >= maxFiles) break

    function walk(currentPath, depth) {
      if (depth > 5 || fileCount >= maxFiles) return

      let entries
      try {
        entries = fs.readdirSync(currentPath, { withFileTypes: true })
      } catch { return }

      for (const entry of entries) {
        if (SKIP_DIRS.has(entry.name)) continue
        if (SAFE_DIRS.has(entry.name)) continue
        if (fileCount >= maxFiles) break

        const fullPath = path.join(currentPath, entry.name)

        if (entry.isDirectory()) {
          walk(fullPath, depth + 1)
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase()
          if (SCAN_EXTENSIONS.has(ext) || !ext) {
            fileCount++
            if (onProgress) onProgress(fileCount, fullPath)

            const result = scanFile(fullPath, { verbose, onFile })
            results.push(result)
          }
        }
      }
    }

    walk(scanPath, 0)
  }

  return { results, totalFiles: fileCount, scanType: "quick" }
}

// ═══════════════════════════════════════════════════════════════
//  CUSTOM PATH SCAN
// ═══════════════════════════════════════════════════════════════

export function scanPath(dirPath, options = {}) {
  const { verbose = false, onFile = null, onProgress = null, maxDepth = 10 } = options
  const results = []
  let fileCount = 0

  function walk(currentPath, depth) {
    if (depth > maxDepth) return

    let entries
    try {
      entries = fs.readdirSync(currentPath, { withFileTypes: true })
    } catch { return }

    for (const entry of entries) {
      if (SKIP_DIRS.has(entry.name)) continue
      if (entry.name.startsWith(".")) continue

      const fullPath = path.join(currentPath, entry.name)

      if (entry.isDirectory()) {
        walk(fullPath, depth + 1)
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase()
        if (SCAN_EXTENSIONS.has(ext) || !ext) {
          fileCount++
          if (onProgress) onProgress(fileCount, fullPath)

          const result = scanFile(fullPath, { verbose, onFile })
          results.push(result)
        }
      }
    }
  }

  if (fs.existsSync(dirPath)) {
    const stat = fs.statSync(dirPath)
    if (stat.isFile()) {
      results.push(scanFile(dirPath, { verbose, onFile }))
      fileCount = 1
    } else {
      walk(dirPath, 0)
    }
  }

  return { results, totalFiles: fileCount, scanType: "custom" }
}

// ═══════════════════════════════════════════════════════════════
//  BOOT SECTOR / MBR SCANNER
// ═══════════════════════════════════════════════════════════════

export function scanBootSector(drive = "C:") {
  try {
    const devicePath = `\\\\.\\${drive}`
    const fd = fs.openSync(devicePath, "r")
    const buf = Buffer.alloc(512)
    fs.readSync(fd, buf, 0, 512, 0)
    fs.closeSync(fd)

    const result = checkFileForMalware(buf, `${drive}\\MBR`)
    result.scanType = "boot-sector"
    return result
  } catch (e) {
    return { filepath: `${drive}\\MBR`, error: `Не удалось прочитать MBR: ${e.message}` }
  }
}

// ═══════════════════════════════════════════════════════════════
//  MEMORY PROCESS SCANNER
// ═══════════════════════════════════════════════════════════════

export function scanRunningProcesses() {
  const results = []

  // Known safe Windows processes
  const SAFE_PROCESSES = new Set([
    "WMIRegistrationService.exe", "WmiPrvSE.exe", "WmiApSrv.exe",
    "svchost.exe", "services.exe", "lsass.exe", "wininit.exe",
    "csrss.exe", "smss.exe", "winlogon.exe", "dwm.exe",
    "explorer.exe", "taskhostw.exe", "conhost.exe",
    "RuntimeBroker.exe", "ShellExperienceHost.exe", "StartMenuExperienceHost.exe",
    "SearchUI.exe", "SearchIndexer.exe", "SearchProtocolHost.exe",
    "SiHost.exe", "fontdrvhost.exe", "dllhost.exe",
    "spoolsv.exe", "SearchFilterHost.exe", "WUDFHost.exe",
    "msdtc.exe", "WerFault.exe", "WerMgr.exe",
    "audiodg.exe", "mmsysse.exe", "ctfmon.exe",
    "notepad.exe", "calc.exe", "mspaint.exe",
    "chrome.exe", "firefox.exe", "msedge.exe", "opera.exe",
    "Code.exe", "node.exe", "pnpm.exe", "npm.exe",
    "ollama.exe", "ollama_llama_server.exe",
    "powershell.exe", "pwsh.exe", "cmd.exe",
    "WindowsTerminal.exe", "wt.exe",
    "SecurityHealthService.exe", "SecurityHealthSystray.exe",
    "MpCmdRun.exe", "MsMpEng.exe",
    "NisSrv.exe", "WdNisSvc.exe",
    "ApplicationFrameHost.exe", "SystemSettings.exe",
    "TextInputHost.exe", "CompPkgSrv.exe",
    "backgroundTaskHost.exe", "hctool.exe",
    "KasperskyLab.exe", "avp.exe", "avpui.exe",
    "OneDrive.exe", "onedrive.exe",
    "Teams.exe", "Slack.exe", "Discord.exe",
    "Spotify.exe", "Steam.exe", "EpicGamesLauncher.exe",
    "vmwaretray.exe", "vmwareuser.exe", "vmtoolsd.exe",
    "vboxservice.exe", "vboxtray.exe",
    "Docker Desktop.exe", "com.docker.backend.exe",
    "zoom.exe", "Zoom.exe",
  ])

  try {
    const output = execSync("tasklist /FO CSV /NH", { encoding: "utf8", timeout: 10000 })
    const lines = output.split("\n").filter(l => l.trim())

    for (const line of lines) {
      const match = line.match(/"([^"]+)","(\d+)","([^"]+)"/)
      if (match) {
        const [, name, pid, session] = match
        const isSafe = SAFE_PROCESSES.has(name)
        const suspicious = !isSafe && /\b(mimikatz|meterpreter|cobaltstrike|inject|hook|keylog|rat|trojan|backdoor|rootkit|empire|covenant|sliver|brute ratel)\b/i.test(name)
        results.push({
          name,
          pid: parseInt(pid),
          memory: session,
          suspicious,
          severity: suspicious ? "critical" : "clean",
        })
      }
    }
  } catch {}
  return results
}

// ═══════════════════════════════════════════════════════════════
//  QUARANTINE SYSTEM
// ═══════════════════════════════════════════════════════════════

export function ensureQuarantine() {
  if (!fs.existsSync(QUARANTINE_DIR)) {
    fs.mkdirSync(QUARANTINE_DIR, { recursive: true })
  }
}

export function quarantineFile(filepath) {
  ensureQuarantine()
  const filename = path.basename(filepath)
  const hash = computeFileHash(fs.readFileSync(filepath))
  const quarantinePath = path.join(QUARANTINE_DIR, `${hash}_${filename}.quarantine`)
  const metaPath = quarantinePath + ".meta"

  const metadata = {
    originalPath: filepath,
    hash,
    timestamp: new Date().toISOString(),
    size: fs.statSync(filepath).size,
  }

  fs.copyFileSync(filepath, quarantinePath)
  fs.writeFileSync(metaPath, JSON.stringify(metadata, null, 2))
  fs.unlinkSync(filepath)

  return { quarantined: quarantinePath, metadata }
}

export function restoreFromQuarantine(quarantinePath) {
  const metaPath = quarantinePath + ".meta"
  if (!fs.existsSync(metaPath)) return { error: "Метаданные не найдены" }

  const metadata = JSON.parse(fs.readFileSync(metaPath, "utf8"))
  const restoreDir = path.dirname(metadata.originalPath)

  if (!fs.existsSync(restoreDir)) {
    fs.mkdirSync(restoreDir, { recursive: true })
  }

  fs.copyFileSync(quarantinePath, metadata.originalPath)
  fs.unlinkSync(quarantinePath)
  fs.unlinkSync(metaPath)

  return { restored: metadata.originalPath }
}

export function listQuarantine() {
  ensureQuarantine()
  const files = fs.readdirSync(QUARANTINE_DIR).filter(f => f.endsWith(".quarantine"))
  return files.map(f => {
    const metaPath = path.join(QUARANTINE_DIR, f + ".meta")
    try {
      const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"))
      return { file: f, ...meta }
    } catch {
      return { file: f, originalPath: "unknown" }
    }
  })
}

// ═══════════════════════════════════════════════════════════════
//  REAL-TIME FILE MONITOR
// ═══════════════════════════════════════════════════════════════

let monitorActive = false
let monitorInterval = null
let fileHashes = new Map()

export function startRealTimeMonitor(dirPath, options = {}) {
  const { interval = 5000, onThreat = null, onFileChange = null } = options

  if (monitorActive) return { error: "Мониторинг уже запущен" }

  monitorActive = true
  const initialHashes = new Map()

  // Build initial hash map
  function buildHashMap(currentPath, depth) {
    if (depth > 5) return
    try {
      const entries = fs.readdirSync(currentPath, { withFileTypes: true })
      for (const entry of entries) {
        if (SKIP_DIRS.has(entry.name)) continue
        const fullPath = path.join(currentPath, entry.name)
        if (entry.isDirectory()) {
          buildHashMap(fullPath, depth + 1)
        } else if (entry.isFile()) {
          try {
            const stat = fs.statSync(fullPath)
            initialHashes.set(fullPath, { size: stat.size, mtime: stat.mtimeMs })
          } catch {}
        }
      }
    } catch {}
  }

  buildHashMap(dirPath, 0)
  fileHashes = initialHashes

  // Monitor loop
  monitorInterval = setInterval(() => {
    if (!monitorActive) return

    const currentFiles = new Map()

    function scanDir(currentPath, depth) {
      if (depth > 5) return
      try {
        const entries = fs.readdirSync(currentPath, { withFileTypes: true })
        for (const entry of entries) {
          if (SKIP_DIRS.has(entry.name)) continue
          const fullPath = path.join(currentPath, entry.name)
          if (entry.isDirectory()) {
            scanDir(fullPath, depth + 1)
          } else if (entry.isFile()) {
            try {
              const stat = fs.statSync(fullPath)
              currentFiles.set(fullPath, { size: stat.size, mtime: stat.mtimeMs })
            } catch {}
          }
        }
      } catch {}
    }

    scanDir(dirPath, 0)

    // Check for new/modified files
    for (const [filepath, info] of currentFiles) {
      const prev = fileHashes.get(filepath)
      if (!prev || prev.mtime !== info.mtime || prev.size !== info.size) {
        if (onFileChange) onFileChange(filepath, prev ? "modified" : "new")

        // Scan the file
        const result = scanFile(filepath)
        if (!result.clean && onThreat) {
          onThreat(result)
        }
      }
    }

    // Check for deleted files
    for (const [filepath] of fileHashes) {
      if (!currentFiles.has(filepath)) {
        if (onFileChange) onFileChange(filepath, "deleted")
      }
    }

    fileHashes = currentFiles
  }, interval)

  return { status: "started", dirPath, interval }
}

export function stopRealTimeMonitor() {
  monitorActive = false
  if (monitorInterval) {
    clearInterval(monitorInterval)
    monitorInterval = null
  }
  fileHashes.clear()
  return { status: "stopped" }
}

export function getMonitorStatus() {
  return { active: monitorActive, trackedFiles: fileHashes.size }
}

// ═══════════════════════════════════════════════════════════════
//  SCAN REPORT
// ═══════════════════════════════════════════════════════════════

export function generateReport(results, scanType = "full") {
  const threats = results.filter(r => !r.clean && !r.error)
  const warnings = results.filter(r => r.clean && r.warnings && r.warnings.length > 0)
  const clean = results.filter(r => r.clean && (!r.warnings || r.warnings.length === 0))
  const errors = results.filter(r => r.error)

  const report = {
    scanType,
    timestamp: new Date().toISOString(),
    summary: {
      totalFiles: results.length,
      threats: threats.length,
      warnings: warnings.length,
      clean: clean.length,
      errors: errors.length,
    },
    threats: threats.map(r => ({
      filepath: r.filepath,
      score: r.score,
      detections: [...r.threats, ...r.warnings],
    })),
    warnings: warnings.map(r => ({
      filepath: r.filepath,
      detections: r.warnings,
    })),
  }

  return report
}

export function saveReport(report, filepath) {
  fs.writeFileSync(filepath, JSON.stringify(report, null, 2))
  return filepath
}

// ═══════════════════════════════════════════════════════════════
//  LEGACY COMPAT
// ═══════════════════════════════════════════════════════════════

export { scanPath as scanDirectory }
