import readline from "node:readline"
import { fullSystemScan, quickScan, scanPath, scanFile, scanRunningProcesses, scanBootSector, startRealTimeMonitor, stopRealTimeMonitor, getMonitorStatus, quarantineFile, listQuarantine, restoreFromQuarantine, loadExclusions, addExclusion, removeExclusion, getExclusions, generateReport, saveReport } from "./scanner.mjs"
import { QUARANTINE_DIR } from "./database.mjs"
import fs from "node:fs"
import path from "node:path"

// ═══════════════════════════════════════════════════════════════
//  STELLAR ANTIVIRUS — Kaspersky-style UI
// ═══════════════════════════════════════════════════════════════

const COLORS = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  italic: "\x1b[3m",
  underline: "\x1b[4m",

  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  gray: "\x1b[90m",

  bgRed: "\x1b[41m",
  bgGreen: "\x1b[42m",
  bgYellow: "\x1b[43m",
  bgBlue: "\x1b[44m",
  bgMagenta: "\x1b[45m",
  bgCyan: "\x1b[46m",
}

function c(color, text) {
  return `${COLORS[color]}${text}${COLORS.reset}`
}

function bold(text) { return c("bold", text) }
function dim(text) { return c("dim", text) }
function red(text) { return c("red", text) }
function green(text) { return c("green", text) }
function yellow(text) { return c("yellow", text) }
function cyan(text) { return c("cyan", text) }
function magenta(text) { return c("magenta", text) }

function box(title, lines, color = [0, 200, 255]) {
  const [r, g, b] = color
  const ansiColor = `\x1b[38;2;${r};${g};${b}m`
  const reset = "\x1b[0m"
  const maxLen = Math.max(title.length + 4, ...lines.map(l => l.length))
  const width = maxLen + 4

  const top = `${ansiColor}╭${"─".repeat(width)}╮${reset}`
  const bottom = `${ansiColor}╰${"─".repeat(width)}╯${reset}`
  const titleLine = `${ansiColor}│${reset} ${ansiColor}${COLORS.bold}${title}${reset}${" ".repeat(width - title.length - 2)}${ansiColor}│${reset}`

  const contentLines = lines.map(l =>
    `${ansiColor}│${reset} ${l}${" ".repeat(Math.max(0, width - l.length - 2))}${ansiColor}│${reset}`
  )

  return [top, titleLine, `${ansiColor}│${reset}${" ".repeat(width)}${ansiColor}│${reset}`, ...contentLines, bottom].join("\n")
}

function progressLine(current, total, width = 40) {
  const pct = Math.floor((current / total) * 100)
  const filled = Math.floor((current / total) * width)
  const empty = width - filled
  const bar = "█".repeat(filled) + "░".repeat(empty)
  return `  ${cyan(bar)} ${pct}% (${current}/${total})`
}

function statusIcon(severity) {
  switch (severity) {
    case "critical": return red("●")
    case "high": return yellow("●")
    case "medium": return cyan("●")
    case "low": return dim("●")
    default: return green("●")
  }
}

function severityColor(severity) {
  switch (severity) {
    case "critical": return red
    case "high": return yellow
    case "medium": return cyan
    default: return dim
  }
}

// ═══════════════════════════════════════════════════════════════
//  BANNER
// ═══════════════════════════════════════════════════════════════

function printBanner() {
  const gradient = [
    [167, 139, 250], [165, 136, 250], [163, 133, 250], [161, 130, 249],
    [159, 127, 249], [157, 124, 249], [155, 121, 248], [153, 118, 248],
    [151, 115, 248], [149, 112, 248], [147, 109, 247], [145, 106, 247],
    [143, 103, 247], [141, 100, 247], [139, 97, 246], [137, 94, 246],
    [135, 97, 246], [133, 100, 246], [131, 103, 247], [129, 106, 247],
    [127, 109, 247], [125, 112, 247], [123, 115, 246], [121, 118, 246],
    [119, 121, 246], [117, 124, 245], [115, 127, 245], [113, 130, 245],
    [111, 133, 245], [109, 136, 244], [107, 139, 244], [105, 142, 243],
  ]

  const logo = [
    "  ███████╗████████╗██████╗ ███████╗██████╗ ███╗   ███╗",
    "  ██╔════╝╚══██╔══╝██╔══██╗██╔════╝██╔══██╗████╗ ████║",
    "  ███████╗   ██║   ██████╔╝█████╗  ██████╔╝██╔████╔██║",
    "  ╚════██║   ██║   ██╔══██╗██╔══╝  ██╔══██╗██║╚██╔╝██║",
    "  ███████║   ██║   ██║  ██║███████╗██║  ██║██║ ╚═╝ ██║",
    "  ╚══════╝   ╚═╝   ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═╝     ╚═╝",
  ]

  console.log()
  for (const line of logo) {
    let colored = ""
    for (let i = 0; i < line.length; i++) {
      const colorIdx = Math.floor((i / line.length) * gradient.length)
      const [r, g, b] = gradient[Math.min(colorIdx, gradient.length - 1)]
      colored += `\x1b[38;2;${r};${g};${b}m${line[i]}`
    }
    console.log(colored + "\x1b[0m")
  }

  console.log()
  console.log(`  ${magenta("✦")} ${bold("Stellar Antivirus")}${dim(" · powered by ")}${cyan("Stella")} ${dim("Security Engine")}`)
  console.log()
}

function printStatusBanner(status, detail = "") {
  const [r, g, b] = status === "safe" ? [0, 200, 100] : status === "warning" ? [255, 200, 0] : [255, 80, 80]
  const ansi = `\x1b[38;2;${r};${g};${b}m`
  const icon = status === "safe" ? "✓" : status === "warning" ? "⚠" : "✗"

  console.log()
  console.log(`${ansi}  ╔══════════════════════════════════════════════════════════╗${COLORS.reset}`)
  console.log(`${ansi}  ║  ${icon}  ${bold(detail || (status === "safe" ? "СИСТЕМА ЗАЩИЩЕНА" : "ОБНАРУЖЕНЫ УГРОЗЫ"))}${" ".repeat(Math.max(0, 52 - (detail || "").length))}║${COLORS.reset}`)
  console.log(`${ansi}  ╚══════════════════════════════════════════════════════════╝${COLORS.reset}`)
  console.log()
}

// ═══════════════════════════════════════════════════════════════
//  SCAN RESULTS DISPLAY
// ═══════════════════════════════════════════════════════════════

function displayScanResults(results, scanType = "full") {
  const filtered = results.filter(r => !r.excluded)
  const excludedCount = results.filter(r => r.excluded).length
  const threats = filtered.filter(r => !r.clean && !r.error)
  const warnings = filtered.filter(r => r.clean && r.warnings && r.warnings.length > 0)
  const clean = filtered.filter(r => r.clean && (!r.warnings || r.warnings.length === 0))
  const errors = filtered.filter(r => r.error)

  const scanTypeNames = {
    full: "ПОЛНОЕ СКАНИРОВАНИЕ",
    quick: "БЫСТРОЕ СКАНИРОВАНИЕ",
    custom: "СКАНИРОВАНИЕ КАТАЛОГА",
    "boot-sector": "СКАНИРОВАНИЕ MBR",
  }

  console.log()
  console.log(box(scanTypeNames[scanType] || "СКАНИРОВАНИЕ", [
    `Файлов:      ${results.length}`,
    `Угрозы:      ${threats.length > 0 ? red(String(threats.length)) : green(String(threats.length))}`,
    `Предупрежд.: ${warnings.length > 0 ? yellow(String(warnings.length)) : green(String(warnings.length))}`,
    `Чисто:       ${green(String(clean.length))}`,
    `Исключено:   ${dim(String(excludedCount))}`,
    `Ошибки:      ${errors.length > 0 ? red(String(errors.length)) : green(String(errors.length))}`,
  ], threats.length > 0 ? [255, 80, 80] : [0, 200, 100]))

  if (threats.length > 0) {
    console.log(`\n  ${red(bold("══════ УГРОЗЫ ══════"))}`)
    console.log()
    for (const t of threats) {
      console.log(`  ${red("●")} ${bold(path.basename(t.filepath))}`)
      console.log(`    ${dim(t.filepath)}`)
      if (t.threats && t.threats.length > 0) {
        for (const d of t.threats) {
          const color = severityColor(d.severity)
          console.log(`    ${color("▸")} ${d.message}`)
        }
      }
      console.log()
    }
  }

  if (warnings.length > 0) {
    console.log(`\n  ${yellow(bold("══════ ПРЕДУПРЕЖДЕНИЯ ══════"))}`)
    console.log()
    for (const w of warnings.slice(0, 20)) {
      console.log(`  ${yellow("●")} ${bold(path.basename(w.filepath))}`)
      for (const d of w.warnings) {
        const color = severityColor(d.severity)
        console.log(`    ${color("▸")} ${d.message}`)
      }
    }
    if (warnings.length > 20) {
      console.log(`  ${dim(`... и ещё ${warnings.length - 20} предупреждений`)}`)
    }
    console.log()
  }

  if (threats.length === 0 && warnings.length === 0) {
    printStatusBanner("safe")
  } else {
    printStatusBanner("danger")
  }
}

// ═══════════════════════════════════════════════════════════════
//  MAIN MENU
// ═══════════════════════════════════════════════════════════════

function printMenu() {
  console.log(box("✦ Stellar AV — Команды", [
    "",
    `  ${cyan("1")} │ ${bold("Полное сканирование")}     Сканировать весь компьютер (C:\\, D:\\, ...)`,
    `  ${cyan("2")} │ ${bold("Быстрое сканирование")}   Temp, Downloads, Desktop, Startup`,
    `  ${cyan("3")} │ ${bold("Сканировать файл")}       Проверить один файл`,
    `  ${cyan("4")} │ ${bold("Сканировать папку")}      Проверить директорию`,
    `  ${cyan("5")} │ ${bold("Сканировать MBR")}        Проверить загрузочный сектор`,
    `  ${cyan("6")} │ ${bold("Процессы")}               Проверить запущенные процессы`,
    `  ${cyan("7")} │ ${bold("Мониторинг 24/7")}        Реальное время — следить за файлами`,
    `  ${cyan("8")} │ ${bold("Карантин")}               Удалённые угрозы`,
    `  ${cyan("9")} │ ${bold("Исключения")}             Список исключений`,
    `  ${cyan("10")}│ ${bold("Отчёт")}                  Сохранить отчёт в JSON`,
    "",
    `  ${cyan("/exit")} │ ${dim("Выход")}`,
  ], [0, 200, 255]))
  console.log()
}

// ═══════════════════════════════════════════════════════════════
//  INTERACTIVE MODE
// ═══════════════════════════════════════════════════════════════

export function startInteractive() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  printBanner()
  printStatusBanner("safe", "Stellar Antivirus запущен — готов к сканированию")
  printMenu()

  const ask = () => {
    rl.question(`${magenta("❯")} `, async (input) => {
      const cmd = input.trim().toLowerCase()

      switch (cmd) {
        case "1":
        case "full":
        case "полное": {
          console.log()
          console.log(`  ${cyan("▶")} ${bold("Полное сканирование системы...")}`)
          console.log(`  ${dim("Сканирование всех дисков C:\\, D:\\, ...")}`)
          console.log()

          let lastUpdate = Date.now()
          const { results, totalFiles } = fullSystemScan({
            onProgress: (count, file) => {
              if (Date.now() - lastUpdate > 100) {
                process.stdout.write(`\r  ${progressLine(count, Math.max(count, 500))} ${dim(path.basename(file).substring(0, 30))}`)
                lastUpdate = Date.now()
              }
            },
          })

          process.stdout.write("\r" + " ".repeat(80) + "\r")
          displayScanResults(results, "full")
          break
        }

        case "2":
        case "quick":
        case "быстрое": {
          console.log()
          console.log(`  ${cyan("▶")} ${bold("Быстрое сканирование...")}`)
          console.log(`  ${dim("Temp, Downloads, Desktop, Startup, AppData")}`)
          console.log()

          let lastUpdate = Date.now()
          const { results } = quickScan({
            onProgress: (count, file) => {
              if (Date.now() - lastUpdate > 100) {
                process.stdout.write(`\r  ${progressLine(count, Math.max(count, 200))} ${dim(path.basename(file).substring(0, 30))}`)
                lastUpdate = Date.now()
              }
            },
          })

          process.stdout.write("\r" + " ".repeat(80) + "\r")
          displayScanResults(results, "quick")
          break
        }

        case "3":
        case "file":
        case "файл": {
          rl.question(`  Введите путь к файлу: `, (filepath) => {
            if (!filepath.trim()) { ask(); return }
            console.log()
            const result = scanFile(filepath.trim())
            if (result.error) {
              console.log(`  ${red("✗")} ${result.error}`)
            } else {
              displayScanResults([result], "custom")
            }
            ask()
          })
          return
        }

        case "4":
        case "folder":
        case "папка": {
          rl.question(`  Введите путь к папке: `, (dirpath) => {
            if (!dirpath.trim()) { ask(); return }
            console.log()
            console.log(`  ${cyan("▶")} ${bold("Сканирование:")} ${dirpath}`)
            console.log()

            let lastUpdate = Date.now()
            const { results } = scanPath(dirpath.trim(), {
              onProgress: (count, file) => {
                if (Date.now() - lastUpdate > 100) {
                  process.stdout.write(`\r  ${progressLine(count, Math.max(count, 100))} ${dim(path.basename(file).substring(0, 30))}`)
                  lastUpdate = Date.now()
                }
              },
            })

            process.stdout.write("\r" + " ".repeat(80) + "\r")
            displayScanResults(results, "custom")
            ask()
          })
          return
        }

        case "5":
        case "mbr":
        case "загрузчик": {
          console.log()
          console.log(`  ${cyan("▶")} ${bold("Сканирование MBR (Master Boot Record)...")}`)
          console.log()

          const drives = ["C:", "D:", "E:"]
          for (const drive of drives) {
            if (fs.existsSync(drive + "\\")) {
              console.log(`  Проверка ${drive}\\ ...`)
              const result = scanBootSector(drive)
              if (result.error) {
                console.log(`  ${yellow("⚠")} ${result.error}`)
              } else {
                if (!result.clean) {
                  console.log(`  ${red("✗")} ${drive} MBR: ОБНАРУЖЕНА УГРОЗА!`)
                  for (const t of result.threats) console.log(`    ${red("▸")} ${t.message}`)
                } else {
                  console.log(`  ${green("✓")} ${drive} MBR: чисто`)
                }
              }
            }
          }
          console.log()
          break
        }

        case "6":
        case "processes":
        case "процессы": {
          console.log()
          console.log(`  ${cyan("▶")} ${bold("Проверка запущенных процессов...")}`)
          console.log()

          const procs = scanRunningProcesses()
          if (procs.length === 0) {
            console.log(`  ${yellow("⚠")} Не удалось получить список процессов`)
          } else {
            const susp = procs.filter(p => p.suspicious)
            const normal = procs.filter(p => !p.suspicious)

            console.log(`  Всего процессов: ${procs.length}`)
            console.log(`  ${green("Чистых:")} ${normal.length}`)
            if (susp.length > 0) {
              console.log(`  ${red("Подозрительных:")} ${susp.length}`)
              console.log()
              console.log(`  ${red(bold("══════ ПОДОЗРИТЕЛЬНЫЕ ══════"))}`)
              for (const p of susp) {
                console.log(`  ${red("●")} ${bold(p.name)} (PID: ${p.pid}, Память: ${p.memory})`)
              }
            }
          }
          console.log()
          break
        }

        case "7":
        case "monitor":
        case "мониторинг": {
          const status = getMonitorStatus()
          if (status.active) {
            console.log()
            console.log(`  ${green("✓")} Мониторинг активен`)
            console.log(`  ${dim("Отслеживаемых файлов:")} ${status.trackedFiles}`)
            console.log()
            rl.question(`  Остановить мониторинг? (y/n): `, (ans) => {
              if (ans.toLowerCase() === "y" || ans.toLowerCase() === "да") {
                stopRealTimeMonitor()
                console.log(`  ${green("✓")} Мониторинг остановлен`)
              }
              ask()
            })
            return
          } else {
            rl.question(`  Путь для мониторинга (Enter = текущая папка): `, (dirpath) => {
              const dir = dirpath.trim() || "."
              console.log()
              console.log(`  ${cyan("▶")} ${bold("Запуск мониторинга:")} ${dir}`)
              console.log(`  ${dim("Проверка каждые 5 секунд...")}`)
              console.log(`  ${dim("Нажмите Ctrl+C для остановки")}`)
              console.log()

              startRealTimeMonitor(dir, {
                interval: 5000,
                onThreat: (result) => {
                  console.log()
                  console.log(`  ${red("⚠ ОБНАРУЖЕНА УГРОЗА!")}`)
                  console.log(`  ${bold(path.basename(result.filepath))}`)
                  for (const t of result.threats) {
                    console.log(`    ${red("▸")} ${t.message}`)
                  }
                  console.log()
                },
                onFileChange: (file, type) => {
                  const icon = type === "new" ? green("+") : type === "modified" ? yellow("~") : red("-")
                  process.stdout.write(`\r  ${icon} ${dim(path.basename(file).substring(0, 50))}`)
                },
              })
              console.log()
              ask()
            })
            return
          }
        }

        case "8":
        case "quarantine":
        case "карантин": {
          const items = listQuarantine()
          console.log()
          if (items.length === 0) {
            console.log(`  ${green("✓")} Карантин пуст`)
          } else {
            console.log(box("Карантин", [`Файлов: ${items.length}`], [255, 200, 0]))
            console.log()
            for (const item of items) {
              console.log(`  ${yellow("●")} ${bold(item.originalPath)}`)
              console.log(`    ${dim("Дата:")} ${item.timestamp}`)
              console.log()
            }
            rl.question(`  Восстановить файл? (y/n): `, (ans) => {
              if (ans.toLowerCase() === "y") {
                rl.question(`  Номер файла (1-${items.length}): `, (num) => {
                  const idx = parseInt(num) - 1
                  if (idx >= 0 && idx < items.length) {
                    const quarantinePath = path.join(QUARANTINE_DIR, items[idx].file)
                    const result = restoreFromQuarantine(quarantinePath)
                    if (result.error) {
                      console.log(`  ${red("✗")} ${result.error}`)
                    } else {
                      console.log(`  ${green("✓")} Восстановлено: ${result.restored}`)
                    }
                  }
                  ask()
                })
                return
              }
              ask()
            })
            return
          }
          break
        }

        case "9":
        case "exclusions":
        case "исключения": {
          const excs = getExclusions()
          console.log()
          console.log(box("Исключения", [`Правил: ${excs.length}`], [0, 200, 255]))
          console.log()
          for (const exc of excs) {
            console.log(`  ${cyan("●")} ${exc}`)
          }
          console.log()
          rl.question(`  Добавить исключение (Enter = пропустить): `, (pattern) => {
            if (pattern.trim()) {
              addExclusion(pattern.trim())
              console.log(`  ${green("✓")} Добавлено: ${pattern.trim()}`)
            }
            ask()
          })
          return
        }

        case "10":
        case "report":
        case "отчёт": {
          console.log()
          rl.question(`  Тип отчёта (full/quick): `, (type) => {
            console.log(`  ${cyan("▶")} ${bold("Создание отчёта...")}`)
            console.log()

            const scanFunc = type === "quick" ? quickScan : fullSystemScan
            const { results } = scanFunc()
            const report = generateReport(results, type || "full")

            const filename = `stellar-report-${new Date().toISOString().slice(0, 10)}.json`
            saveReport(report, filename)
            console.log(`  ${green("✓")} Отчёт сохранён: ${filename}`)
            console.log()
            ask()
          })
          return
        }

        case "/exit":
        case "exit":
        case "выход": {
          console.log()
          console.log(`  ${magenta("✦")} ${dim("Stellar Antivirus — до встречи!")}`)
          console.log()
          rl.close()
          return
        }

        case "/help":
        case "help":
        case "помощь": {
          printMenu()
          break
        }

        default: {
          console.log(`  ${yellow("⚠")} Неизвестная команда. Введите ${cyan("/help")} для справки.`)
          console.log()
        }
      }

      ask()
    })
  }

  ask()
}

// ═══════════════════════════════════════════════════════════════
//  EXPORTS
// ═══════════════════════════════════════════════════════════════

export { printBanner, displayScanResults, box, statusIcon, severityColor }

// Run if executed directly
if (process.argv[1] && process.argv[1].includes("ui.mjs")) {
  startInteractive()
}
