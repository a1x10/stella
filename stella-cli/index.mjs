#!/usr/bin/env node
// Stella Coder 3.9 — терминальный AI-агент
import readline from "node:readline"
import fs from "node:fs"
import path from "node:path"
import os from "node:os"
import { execSync } from "node:child_process"
import { streamText, stepCountIs, generateText } from "ai"
import { createOpenAICompatible } from "@ai-sdk/openai-compatible"
import { createTools } from "./tools.mjs"
import { printBanner } from "./banner.mjs"
import { createStreamRenderer, renderMarkdown } from "./markdown.mjs"
import {
  bold, dim, violet, purple, indigo, blue, cyan, green, red, yellow, gray, darkGray, white,
  gradientLine, box, SPINNER_FRAMES, SPINNER_WORDS,
} from "./theme.mjs"
import {
  verifyCodeIntegrity, getApiKey, saveApiKey, deleteApiKey,
  getHardwareInfo, saveIntegrityHash,
} from "./security.mjs"
import { runSubagent, listSubagents, parseAgentCommand, SUBAGENTS } from "./subagents.mjs"
import { mcp, MCP_COMMANDS } from "./mcp.mjs"
import { generatePresentation, createPresentationFromTopic, AVAILABLE_THEMES, exportToPDF } from "./presentations.mjs"
import { AutonomousAgent } from "./autonomous-agent.mjs"
import {
  buildRepoMap, buildProjectContext, compressContext,
  loadSpec, generateSpecTemplate,
  detectTestFramework, detectLinter, detectFormatter, detectTypeChecker,
  generateTestPrompt,
  gitStatus, gitDiff, gitLog, gitBranches, gitCreateBranch, gitCheckout,
  gitMerge, gitStash, gitStashPop, gitCommit, gitPush, gitPull,
  gitCreatePR, gitListPRs, gitResolveConflicts,
  runLinter, runFormatter, runTypeChecker, runTests,
  applyEdits, diagnoseProject,
  CODING_BRAIN_COMMANDS,
} from "./coding-brain.mjs"
import {
  startBot, stopBot, notifyUser, notifyAll,
  getBotStatus, TELEGRAM_BRAIN_COMMANDS,
  verifyAuthCode, getPendingCodes,
  generateAdminCode, listAuthorizedUsers,
} from "./telegram-bot.mjs"

const VERSION = "5.1.2"
const CONFIG_DIR = path.join(os.homedir(), ".stella")
const CONFIG_PATH = path.join(CONFIG_DIR, "config.json")
const HISTORY_PATH = path.join(CONFIG_DIR, "history.json")

const ZEN_BASE_URL = "https://opencode.ai/zen/v1"

const MODELS = [
  { id: "mimo-v2.5-free", label: "MiMo V2.5 (бесплатная)" },
  { id: "deepseek-v4-flash-free", label: "DeepSeek V4 Flash (бесплатная)" },
  { id: "gpt-5.4", label: "GPT 5.4 (OpenAI)" },
  { id: "gpt-5.4-mini", label: "GPT 5.4 Mini (OpenAI)" },
  { id: "gpt-5.2", label: "GPT 5.2 (OpenAI)" },
  { id: "gpt-5.2-codex", label: "GPT 5.2 Codex (OpenAI)" },
  { id: "gpt-5", label: "GPT 5 (OpenAI)" },
  { id: "gpt-5-codex", label: "GPT 5 Codex (OpenAI)" },
  { id: "claude-sonnet-4.5", label: "Claude Sonnet 4.5" },
  { id: "claude-opus-4.5", label: "Claude Opus 4.5" },
  { id: "claude-haiku-4.5", label: "Claude Haiku 4.5" },
  { id: "claude-sonnet-5", label: "Claude Sonnet 5" },
  { id: "gemini-3-flash", label: "Gemini 3 Flash (Google)" },
  { id: "gemini-3.1-pro", label: "Gemini 3.1 Pro (Google)" },
  { id: "deepseek-v4-pro", label: "DeepSeek V4 Pro" },
  { id: "deepseek-v4-flash", label: "DeepSeek V4 Flash" },
  { id: "glm-5.2", label: "GLM 5.2 (Z.AI)" },
  { id: "glm-5", label: "GLM 5 (Z.AI)" },
  { id: "kimi-k2.6", label: "Kimi K2.6 (Moonshot)" },
  { id: "minimax-m3", label: "MiniMax M3" },
]

// ---------- config ----------
function loadConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8")) } catch { return {} }
}
function saveConfig(cfg) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true })
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2))
}

const config = loadConfig()

// Load API key from secure vault (hardware-bound)
const secureKey = getApiKey()
let apiKey = ""
if (secureKey && secureKey.error) {
  console.log(red("\n  ✗ " + secureKey.error))
  process.exit(1)
} else if (secureKey && secureKey.apiKey) {
  apiKey = secureKey.apiKey
} else if (config.apiKey) {
  apiKey = config.apiKey
  saveApiKey(apiKey)
}

// OpenCode Zen provider
const zen = createOpenAICompatible({
  name: "zen",
  baseURL: ZEN_BASE_URL,
  apiKey,
})

function getModel(modelId) {
  return zen.chatModel(modelId)
}

// auto-load .env files from cwd (like Next.js)
for (const envFile of [".env.local", ".env.development.local", ".env"]) {
  try {
    const p = path.join(process.cwd(), envFile)
    if (!fs.existsSync(p)) continue
    for (const line of fs.readFileSync(p, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "")
    }
  } catch {}
}

// ---------- state ----------
const state = {
  model: config.model || MODELS[0].id,
  messages: [],
  totalTokens: { input: 0, output: 0 },
  totalCost: 0,
  turns: 0,
  alwaysAllow: new Set(config.alwaysAllow || []),
  interrupted: false,
  startedAt: Date.now(),
}

// approx pricing per 1M tokens (USD) for cost estimation
const PRICING = { input: 0.6, output: 2.2 }

// ---------- args ----------
const args = process.argv.slice(2)
const printMode = args.includes("-p") || args.includes("--print")
const printPrompt = printMode ? args[args.indexOf(args.includes("-p") ? "-p" : "--print") + 1] : null
if (args.includes("--version") || args.includes("-v")) {
  console.log(`stella-coder ${VERSION}`)
  process.exit(0)
}
if (args.includes("--model")) state.model = args[args.indexOf("--model") + 1] || state.model

// ---------- system prompt ----------
function systemPrompt() {
  let projectContext = ""
  try {
    // Auto-load SPEC.md, CLAUDE.md, AGENTS.md, STELLA.md
    for (const specFile of ["SPEC.md", "CLAUDE.md", "AGENTS.md", "STELLA.md"]) {
      const p = path.join(process.cwd(), specFile)
      if (fs.existsSync(p)) {
        projectContext += `\n\n# ${specFile}\n` + fs.readFileSync(p, "utf8").slice(0, 10000)
      }
    }
  } catch {}

  // Build repo map for context
  let repoContext = ""
  try {
    const map = buildRepoMap(process.cwd())
    repoContext = `\n\n# Карта проекта (${map.summary})\n\`\`\`\n${map.tree.slice(0, 200).join("\n")}\n\`\`\``
  } catch {}

  return `Ты — Stella, ИИ-агент терминального агента Stella Coder 4.0 (аналог Claude Code / Cursor).
Ты — эксперт-программист с огромным контекстом, работающий в: ${process.cwd()} (ОС: ${os.platform()}).

Твои возможности:
- Огромный контекст: ты "держишь в голове" структуру всего репозитория
- Spec-Driven Development: работай по SPEC.md / CLAUDE.md
- TDD: пиши тесты, прав код, запускай линтеры — всё автономно
- Multi-file editing: правь 15+ файлов за раз
- Git экосистема: ветки, PR, мержи, разрешение конфликтов
- Автосжатие контекста при необходимости

Правила:
- Используй инструменты (read_file, edit_file, write_file, bash, grep, glob, list_dir), чтобы РЕАЛЬНО выполнять задачи.
- Перед изменением файла всегда читай его.
- Для многошаговых задач используй todo_write.
- Автоматически определяй и запускай линтеры/тесты после изменений.
- При большом контексте — сжимай автоматически.
- Отвечай кратко и по делу, в формате markdown. Код — в блоках с указанием языка.
- Отвечай на языке пользователя.${projectContext}${repoContext}`
}

// ---------- spinner ----------
let spinnerTimer = null
function startSpinner(label) {
  if (printMode) return
  let i = 0
  const word = label || SPINNER_WORDS[Math.floor(Math.random() * SPINNER_WORDS.length)]
  const start = Date.now()
  spinnerTimer = setInterval(() => {
    const f = SPINNER_FRAMES[i++ % SPINNER_FRAMES.length]
    const secs = Math.floor((Date.now() - start) / 1000)
    process.stdout.write(`\r${violet(f)} ${purple(word + "…")} ${dim(`(${secs}s · esc/ctrl+c — прервать)`)}   `)
  }, 80)
}
function stopSpinner() {
  if (spinnerTimer) {
    clearInterval(spinnerTimer)
    spinnerTimer = null
    process.stdout.write("\r" + " ".repeat(70) + "\r")
  }
}

// ---------- permissions ----------
let rl // set later
async function askPermission(kind, summary) {
  if (printMode) return true
  if (state.alwaysAllow.has(kind)) return true
  stopSpinner()
  console.log()
  console.log(box([
    yellow("⚠ Требуется разрешение"),
    "",
    white(summary),
  ], { color: indigo, padding: 2 }))
  const ans = await question(
    "  " + bold(violet("Разрешить?")) + dim(" [y] да · [n] нет · [a] всегда для " + kind + " › "),
  )
  const a = ans.trim().toLowerCase()
  if (a === "a" || a === "always" || a === "в") {
    state.alwaysAllow.add(kind)
    saveConfig({ ...loadConfig(), alwaysAllow: [...state.alwaysAllow] })
    return true
  }
  return a === "y" || a === "yes" || a === "д" || a === ""
}

function question(q) {
  return new Promise((res) => rl.question(q, res))
}

// ---------- todos display ----------
function renderTodos(todos) {
  stopSpinner()
  console.log()
  const lines = todos.map((t) => {
    if (t.status === "completed") return green("☒ ") + strikeDim(t.content)
    if (t.status === "in_progress") return blue("◐ ") + bold(white(t.content))
    return darkGray("☐ ") + gray(t.content)
  })
  console.log(box(lines, { title: "План", color: purple, padding: 2 }))
  console.log()
}
function strikeDim(s) {
  return dim("\x1b[9m" + s + "\x1b[29m")
}

// ---------- tools ----------
const tools = createTools({ ask: askPermission, onTodos: renderTodos })

// ---------- tool display ----------
function toolLabel(name, input) {
  const short = (s, n = 60) => (s && s.length > n ? s.slice(0, n) + "…" : s || "")
  switch (name) {
    case "read_file": return `Read(${input.path})`
    case "write_file": return `Write(${input.path})`
    case "edit_file": return `Edit(${input.path})`
    case "bash": return `Bash(${short(input.command)})`
    case "grep": return `Grep("${short(input.pattern, 40)}")`
    case "glob": return `Glob(${input.pattern})`
    case "list_dir": return `List(${input.path || "."})`
    case "todo_write": return `Todo(${input.todos?.length ?? 0} задач)`
    default: return name
  }
}
function toolResultSummary(name, output) {
  if (!output) return ""
  if (output.error) return red("✗ " + String(output.error).split("\n")[0].slice(0, 80))
  switch (name) {
    case "read_file": return dim(`прочитано ${output.totalLines ?? "?"} строк`)
    case "write_file": return dim(`записано ${output.lines ?? "?"} строк`)
    case "edit_file": return dim(`замен: ${output.replacements ?? 1}`)
    case "bash": return dim((output.output || "").split("\n")[0].slice(0, 80) || "готово")
    case "grep": return dim(`${(output.matches || "").split("\n").filter(Boolean).length} совпадений`)
    case "glob": return dim(`${output.total ?? 0} файлов`)
    case "list_dir": return dim(`${output.entries?.length ?? 0} элементов`)
    default: return dim("готово")
  }
}

// ---------- agent turn ----------
async function runTurn(userText) {
  state.messages.push({ role: "user", content: userText })
  state.turns++
  state.interrupted = false

  const isOllama = state.model.startsWith("ollama:")
  const controller = new AbortController()
  const onSigint = () => {
    state.interrupted = true
    controller.abort()
  }
  process.once("SIGINT", onSigint)

  startSpinner()
  const t0 = Date.now()
  let firstText = true

  try {
    let result

    if (isOllama) {
      const ollamaModel = state.model.replace("ollama:", "")
      const ollamaMessages = state.messages.map(m => ({
        role: m.role,
        content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
      }))

      const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: ollamaModel,
          messages: [{ role: "system", content: systemPrompt() }, ...ollamaMessages],
          stream: true,
        }),
        signal: controller.signal,
      })

      stopSpinner()
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop()

        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const json = JSON.parse(line)
            if (json.message?.content) {
              process.stdout.write(json.message.content)
            }
          } catch {}
        }
      }
      console.log("\n")
    } else {
      result = streamText({
        model: getModel(state.model),
        system: systemPrompt(),
        messages: state.messages,
        tools,
        stopWhen: stepCountIs(30),
        abortSignal: controller.signal,
        onError: () => {},
      })

      const renderer = createStreamRenderer((s) => process.stdout.write(s))

      for await (const part of result.fullStream) {
        switch (part.type) {
          case "text-delta": {
            stopSpinner()
            if (firstText) {
              process.stdout.write("\n" + violet("⏺ ") )
              firstText = false
            }
            renderer.push(part.text)
            break
          }
          case "text-end": {
            renderer.flush()
            firstText = true
            break
          }
          case "tool-call": {
            stopSpinner()
            renderer.flush()
            console.log("\n" + purple("⏺ ") + bold(white(toolLabel(part.toolName, part.input))))
            startSpinner("Выполняю")
            break
          }
          case "tool-result": {
            stopSpinner()
            console.log(darkGray("  ⎿ ") + toolResultSummary(part.toolName, part.output))
            startSpinner()
            break
          }
          case "tool-error": {
            stopSpinner()
            console.log(darkGray("  ⎿ ") + red("ошибка инструмента"))
            startSpinner()
            break
          }
          case "error": {
            stopSpinner()
            renderer.flush()
            console.log("\n" + red("✗ Ошибка: ") + String(part.error?.message || part.error).slice(0, 300))
            break
          }
          case "finish": {
            stopSpinner()
            renderer.flush()
            break
          }
        }
      }

      const response = await result.response
      state.messages.push(...response.messages)

      const usage = await result.usage
      const inTok = usage.inputTokens ?? 0
      const outTok = usage.outputTokens ?? 0
      state.totalTokens.input += inTok
      state.totalTokens.output += outTok
      const cost = (inTok * PRICING.input + outTok * PRICING.output) / 1e6
      state.totalCost += cost

      const dur = ((Date.now() - t0) / 1000).toFixed(1)
      console.log()
      console.log(
        dim("  ") + darkGray(`⏱ ${dur}s · ↑${inTok} ↓${outTok} ток · ~$${cost.toFixed(4)} · ${blue(state.model)}`),
      )
    }
  } catch (e) {
    stopSpinner()
    if (state.interrupted || e?.name === "AbortError") {
      console.log("\n" + yellow("⏸ Прервано пользователем"))
    } else {
      console.log("\n" + red("✗ Ошибка: ") + String(e?.message || e).slice(0, 500))
      if (String(e?.message || "").match(/api key|unauthorized|401|credential/i)) {
        console.log(dim("  Задай ключ: ") + purple("/login") + dim(" или сохрани в ~/.stella/config.json"))
      }
    }
  } finally {
    process.removeListener("SIGINT", onSigint)
  }
  console.log()
}

// ---------- slash commands ----------
const COMMANDS = [
  // Основные
  ["/help", "все команды"],
  ["/model", "выбрать модель"],
  ["/clear", "очистить контекст"],
  ["/compact", "сжать историю (суммаризация)"],
  ["/cost", "статистика токенов и стоимости"],
  ["/context", "размер текущего контекста"],
  ["/config", "показать/изменить конфигурацию"],
  ["/version", "версия"],
  ["/exit", "выход (также /quit, Ctrl+D)"],

  // Работа с файлами
  ["/read", "прочитать файл"],
  ["/write", "записать файл"],
  ["/edit", "редактировать файл"],
  ["/find", "найти файлы по паттерну"],
  ["/grep", "поиск по содержимому"],
  ["/tree", "дерево файлов"],
  ["/head", "первые N строк файла"],
  ["/tail", "последние N строк файла"],
  ["/wc", "подсчёт строк/слов"],
  ["/diff", "разница между файлами"],
  ["/patch", "применить патч"],
  ["/chmod", "изменить права доступа"],
  ["/mkdir", "создать директорию"],
  ["/rm", "удалить файл"],
  ["/cp", "копировать файл"],
  ["/mv", "переместить файл"],
  ["/touch", "создать пустой файл"],
  ["/ln", "создать ссылку"],
  ["/stat", "информация о файле"],
  ["/type", "показать тип файла"],
  ["/open", "открыть файл в редакторе"],

  // Git
  ["/git", "git operations (status, diff, log, commit, push, pull)"],
  ["/commit", "AI-коммит (сгенерировать сообщение + git commit)"],
  ["/diff", "git diff"],
  ["/log", "git log"],
  ["/status", "git status"],
  ["/branch", "git branch"],
  ["/checkout", "git checkout"],
  ["/merge", "git merge"],
  ["/rebase", "git rebase"],
  ["/stash", "git stash"],
  ["/pop", "git stash pop"],
  ["/tag", "git tag"],
  ["/remote", "git remote"],
  ["/fetch", "git fetch"],
  ["/pull", "git pull"],
  ["/push", "git push"],
  ["/clone", "git clone"],
  ["/init", "git init"],

  // AI и агенты
  ["/plan", "автономный план выполнения задачи"],
  ["/todo", "управление задачами (создать/показать/выполнитb)"],
  ["/agent", "запустить субагент для сложной задачи"],
  ["/skill", "загрузить/показать навыки"],
  ["/mcp", "управление MCP серверами"],
  ["/memory", "показать/обновить память проекта (STELLA.md)"],
  ["/remember", "сохранить информацию в память"],
  ["/forget", "удалить информацию из памяти"],

  // Веб и внешние ресурсы
  ["/web", "поиск в интернете"],
  ["/fetch", "загрузить URL"],
  ["/screenshot", "сделать скриншот страницы"],

  // Работа с контентом
  ["/read-image", "прочитать изображение"],
  ["/read-pdf", "прочитать PDF"],
  ["/read-doc", "прочитать документ"],
  ["/ocr", "распознать текст на изображении"],
  ["/translate", "перевести текст"],
  ["/summarize", "суммаризировать текст"],
  ["/explain", "объяснить код"],
  ["/review", "ревью кода"],
  ["/refactor", "рефакторинг кода"],
  ["/test", "написать/запустить тесты"],
  ["/lint", "проверить код линтером"],
  ["/format", "отформатировать код"],
  ["/typecheck", "проверить типы"],
  ["/build", "собрать проект"],
  ["/run", "запустить скрипт"],
  ["/debug", "отладка"],
  ["/profile", "профилирование"],
  ["/benchmark", "бенчмарки"],

  // Безопасность
  ["/av", "запустить Stellar Antivirus"],
  ["/vt", "сканировать файл через VirusTotal"],
  ["/ai-scan", "AI-анализ подозрительного кода"],
  ["/audit", "аудит безопасности"],
  ["/vuln", "поиск уязвимостей"],
  ["/secrets", "поиск секретов в коде"],
  ["/hash", "вычислить хеш файла"],

  // Управление пакетами
  ["/install", "установить пакет"],
  ["/uninstall", "удалить пакет"],
  ["/update", "обновить пакеты"],
  ["/outdated", "проверить устаревшие пакеты"],
  ["/deps", "показать зависимости"],
  ["/audit-deps", "аудит зависимостей"],

  // Окружение
  ["/env", "показать переменные окружения"],
  ["/set-env", "установить переменную окружения"],
  ["/unset-env", "удалить переменную окружения"],
  ["/path", "показать PATH"],
  ["/which", "найти расположение команды"],
  ["/whoami", "текущий пользователь"],
  ["/hostname", "имя компьютера"],
  ["/uname", "информация о системе"],
  ["/uptime", "время работы"],
  ["/disk", "использование диска"],
  ["/mem", "использование памяти"],
  ["/cpu", "информация о CPU"],
  ["/gpu", "информация о GPU"],
  ["/net", "сетевые интерфейсы"],
  ["/ping", "проверить соединение"],
  ["/dns", "DNS запрос"],
  ["/curl", "HTTP запрос"],
  ["/wget", "загрузить файл"],

  // Мониторинг
  ["/top", "процессы по использованию CPU"],
  ["/ps", "список процессов"],
  ["/kill", "завершить процесс"],
  ["/watch", "мониторинг команды"],
  ["/tail-log", "мониторинг лог-файла"],
  ["/notify", "отправить уведомление"],

  // Логирование
  ["/log", "показать логи"],
  ["/error", "показать ошибки"],
  ["/warn", "показать предупреждения"],
  ["/info", "показать информацию"],
  ["/debug-log", "включить отладочный лог"],

  // Работа с базами данных
  ["/db", "подключение к БД"],
  ["/query", "выполнить SQL запрос"],
  ["/migrate", "миграция базы данных"],
  ["/seed", "заполнить БД тестовыми данными"],

  // Документация
  ["/docs", "сгенерировать документацию"],
  ["/readme", "сгенерировать README"],
  ["/changelog", "сгенерировать changelog"],
  ["/examples", "показать примеры"],
  ["/tutorial", "показать обучение"],
  ["/wizard", "мастер настройки"],

  // Управление сессией
  ["/login", "ввести API ключ"],
  ["/newkey", "заменить API ключ"],
  ["/delapikey", "удалить API ключ"],
  ["/permissions", "сбросить выданные разрешения"],
  ["/doctor", "диагностика окружения"],
  ["/history", "история сообщений сессии"],
  ["/export", "экспортировать диалог в файл"],
  ["/import", "импортировать диалог из файла"],
  ["/save", "сохранить сессию"],
  ["/load", "загрузить сессию"],
  ["/sessions", "список сохранённых сессий"],

  // Ollama
  ["/ollama", "подключить локальную LLM (Ollama)"],

  // Презентации
  ["/presentation", "создать презентацию из темы"],
  ["/presentation-theme", "показать доступные темы оформления"],
  ["/presentation-list", "показать созданные презентации"],
  ["/presentation-custom", "создать кастомную презентацию"],
  ["/presentation-export", "экспортировать презентацию в PDF"],

  // Coding Brain
  ["/brain", "показать контекст и инструменты проекта"],
  ["/brain-map", "построить карту репозитория"],
  ["/brain-compress", "сжать контекст сессии"],
  ["/spec", "показать/создать SPEC.md"],
  ["/tdd", "автономный TDD-цикл"],
  ["/lint-auto", "автоматический линтер + исправление"],
  ["/format-auto", "автоформатирование кода"],
  ["/typecheck-auto", "автопроверка типов"],
  ["/test-auto", "автозапуск тестов"],
  ["/git-eco", "полная информация о Git"],
  ["/git-pr", "создать Pull Request"],
  ["/git-merge-auto", "автоматический merge с разрешением конфликтов"],
  ["/fix-all", "полный цикл: линтер → форматер → типы → тесты"],

  // Telegram Bot
  ["/tg", "запустить Telegram бота"],
  ["/tg-stop", "остановить Telegram бота"],
  ["/tg-notify", "отправить уведомление в Telegram"],
  ["/tg-sessions", "показать Telegram сессии"],
  ["/tg-verify", "привязать Telegram аккаунт по коду"],
  ["/tg-code", "сгенерировать код для продажи доступа"],
  ["/tg-users", "показать кто подключён"],

  // Autonomous Agent
  ["/auto", "запустить автономный режим (цель)"],
  ["/auto-stop", "остановить автономный агента"],
  ["/auto-status", "статус автономного агента"],
  ["/auto-dashboard", "создать dashboard с результатами"],
  ["/auto-history", "история выполненных задач"],

  // Управление компьютером
  ["/open", "открыть приложение/файл/URL"],
  ["/app", "запустить приложение"],
  ["/url", "открыть ссылку в браузере"],
  ["/kinopoisk", "открыть Кинопоиск"],
  ["/youtube", "открыть YouTube"],
  ["/google", "открыть Google"],
  ["/folder", "открыть папку в проводнике"],
  ["/screenshot", "сделать скриншот"],
  ["/clipboard", "буфер обмена (получить/вставить)"],
  ["/type", "набрать текст на клавиатуре"],
  ["/key", "нажать клавишу/комбинацию"],
  ["/volume", "управление громкостью"],
  ["/brightness", "управление яркостью"],
  ["/notify", "показать уведомление Windows"],
  ["/windows", "список открытых окон"],
  ["/focus", "переключиться на окно"],
  ["/wifi", "Wi-Fi сети"],
  ["/lock", "заблокировать экран"],
  ["/shutdown", "выключить/перезагрузить"],
  ["/search", "быстрый поиск файлов"],

  // Умный дом
  ["/tv", "управление Sony TV (вкл/выкл/канал/громкость)"],
  ["tv-off", "выключить TV"],
  ["tv-on", "включить TV"],
  ["/tv-info", "информация о TV"],
  ["/cec", "HDMI-CEC управление"],
  ["/smart", "сканирование умных устройств"],
  ["/light", "управление умными лампами"],
  ["/cast", "трансляция на Chromecast"],
  ["/wol", "включить устройство по MAC"],

  // Сервер и терминал
  ["/exec", "выполнить команду в терминале"],
  ["/shell", "выполнить shell-команду"],
  ["/powershell", "выполнить PowerShell команду"],
  ["/cmd", "выполнить cmd команду"],
  ["/ssh", "подключение по SSH"],
  ["/scp", "копирование файлов по SCP"],
  ["/server", "статус сервера"],
  ["/ports", "открытые порты"],
  ["/connections", "активные соединения"],
  ["/kill-port", "завершить процесс на порту"],
  ["/network", "сетевые интерфейсы"],
  ["/dns", "DNS настройки"],
  ["/ping", "пинг хоста"],
  ["/traceroute", "трассировка маршрута"],
  ["/download", "скачать файл"],
  ["/upload", "загрузить файл"],
  ["/http-server", "запустить HTTP сервер"],
  ["/firewall", "файрвол Windows"],
  ["/service", "службы Windows"],
  ["/registry", "реестр Windows"],
  ["/script", "запустить скрипт"],
  ["/schedule", "запланировать задачу"],
  ["/docker", "управление Docker"],
  ["/pm2", "управление PM2"],
  ["/npm", "npm/yarn/pnpm операции"],
  ["/monitor", "мониторинг ресурсов"],
  ["/sys", "полный доступ к системе"],
  ["/sudo", "команда от администратора"],

  // Дополнительно
  ["/paste", "вставить из буфера обмена"],
  ["/clipboard", "копировать в буфер обмена"],
  ["/color", "изменить цветовую тему"],
  ["/theme", "выбрать тему оформления"],
  ["/lang", "сменить язык интерфейса"],
  ["/voice", "голосовой ввод"],
  ["/macro", "выполнить макрос"],
  ["/alias", "создать/показать алиасы"],
  ["/shortcut", "показать горячие клавиши"],
  ["/feedback", "отправить отзыв"],
  ["/report", "сообщить об ошибке"],
  ["/support", "получить поддержку"],
]

async function handleCommand(line) {
  const [cmd, ...rest] = line.trim().split(/\s+/)
  const arg = rest.join(" ")
  
  // Handle @agent commands
  if (cmd.startsWith("@")) {
    const agentName = cmd.slice(1)
    const agents = listSubagents()
    const agent = agents.find(a => a.id === agentName)
    if (agent) {
      if (!arg) {
        console.log(dim(`\n  Использование: @${agentName} <задача>\n`))
        return
      }
      const result = await runSubagent(agentName, arg, {
        apiKey,
        model: state.model,
        tools: createTools({ ask: askPermission }),
      })
      if (result.result) {
        console.log("\n" + renderMarkdown(result.result) + "\n")
      }
      return
    }
  }
  
  switch (cmd) {
    case "/help": {
      console.log()
      const categories = [
        ["📁 Файлы", ["/read", "/write", "/edit", "/find", "/grep", "/tree", "/head", "/tail", "/wc", "/diff", "/stat"]],
        ["🔧 Git", ["/git", "/commit", "/log", "/status", "/branch", "/checkout", "/merge", "/stash", "/pop", "/tag", "/remote", "/pull", "/push", "/clone"]],
        ["🤖 AI", ["/plan", "/todo", "/agent", "/skill", "/mcp", "/memory", "/remember", "/forget"]],
        ["🌐 Веб", ["/web", "/read-image", "/read-pdf", "/explain", "/review", "/refactor", "/translate", "/summarize"]],
        ["💻 Компьютер", ["/open", "/url", "/kinopoisk", "/youtube", "/google", "/folder", "/screenshot", "/clipboard", "/type", "/key", "/volume", "/brightness", "/notify", "/windows", "/focus", "/wifi", "/lock", "/shutdown", "/search"]],
        ["🏠 Умный дом", ["/tv", "/tv-on", "/tv-off", "/tv-info", "/cec", "/smart", "/light", "/cast", "/wol"]],
        ["🖥 Сервер", ["/exec", "/powershell", "/cmd", "/ssh", "/scp", "/server", "/ports", "/connections", "/kill-port", "/network", "/dns", "/ping", "/traceroute", "/download", "/upload", "/http-server", "/firewall", "/service", "/registry", "/script", "/schedule", "/docker", "/pm2", "/npm", "/monitor", "/sys", "/sudo"]],
        ["🧪 Тесты", ["/test", "/lint", "/format", "/typecheck", "/build", "/run", "/debug"]],
        ["🔒 Безопасность", ["/av", "/vt", "/ai-scan", "/audit", "/secrets", "/hash"]],
        ["📦 Пакеты", ["/install", "/uninstall", "/outdated", "/deps"]],
        ["💻 Система", ["/env", "/path", "/which", "/whoami", "/hostname", "/uname", "/uptime", "/disk", "/mem", "/cpu", "/net", "/ps", "/kill"]],
        ["📚 Документация", ["/docs", "/readme", "/changelog", "/examples", "/tutorial", "/wizard"]],
        ["📊 Презентации", ["/presentation", "/presentation-theme", "/presentation-list", "/presentation-custom", "/presentation-export"]],
        ["🧠 Coding Brain", ["/brain", "/brain-map", "/brain-compress", "/spec", "/tdd", "/lint-auto", "/format-auto", "/typecheck-auto", "/test-auto", "/fix-all"]],
        ["📱 Telegram", ["/tg", "/tg-stop", "/tg-notify", "/tg-sessions", "/tg-verify", "/tg-code", "/tg-users"]],
        ["🔀 Git Экосистема", ["/git-eco", "/git-pr", "/git-merge-auto"]],
        ["🤖 Autonomous Agent", ["/auto", "/auto-stop", "/auto-status", "/auto-dashboard", "/auto-history"]],
        ["⚙️ Настройки", ["/help", "/model", "/clear", "/compact", "/cost", "/context", "/config", "/version", "/login", "/newkey", "/doctor", "/sessions", "/color", "/lang", "/shortcut"]],
      ]
      for (const [cat, cmds] of categories) {
        console.log(`  ${bold(cat)}`)
        for (const c of cmds) {
          const desc = COMMANDS.find(([cmd]) => cmd === c)?.[1] || ""
          console.log(`    ${violet(c.padEnd(14))}${dim(desc)}`)
        }
        console.log()
      }
      console.log(dim("  ") + purple("!команда".padEnd(14)) + dim("выполнить shell-команду напрямую"))
      console.log(dim("  ") + purple("Ctrl+C".padEnd(14)) + dim("прервать (2x — выход)"))
      console.log(dim("  ") + purple("Tab".padEnd(14)) + dim("автодополнение"))
      console.log()
      return
    }
    case "/model": {
      console.log()
      MODELS.forEach((m, i) => {
        const active = m.id === state.model
        console.log(
          "  " + (active ? violet("● ") : darkGray("○ ")) + bold(white(String(i + 1))) + ". " +
          (active ? violet(m.label) : gray(m.label)) + dim(` (${m.id})`),
        )
      })
      const ans = await question("\n  " + violet("Номер модели › "))
      const idx = Number.parseInt(ans) - 1
      if (MODELS[idx]) {
        state.model = MODELS[idx].id
        saveConfig({ ...loadConfig(), model: state.model })
        console.log("  " + green("✓ Модель: ") + blue(state.model) + "\n")
      }
      return
    }
    case "/clear": {
      state.messages = []
      console.clear()
      printBanner({ model: state.model, cwd: process.cwd(), version: VERSION })
      return
    }
    case "/compact": {
      if (state.messages.length < 2) { console.log(dim("  Нечего сжимать\n")); return }
      startSpinner("Сжимаю контекст")
      try {
        const { text } = await generateText({
          model: getModel(state.model),
          system: "Сожми диалог в краткое резюме: цели, сделанные изменения, важные файлы и решения. Пиши по-русски, кратко.",
          messages: [...state.messages, { role: "user", content: "Сожми весь диалог выше в резюме." }],
        })
        state.messages = [{ role: "user", content: `Резюме предыдущего диалога:\n${text}` }, { role: "assistant", content: "Понял, продолжаем с этим контекстом." }]
        stopSpinner()
        console.log(green("  ✓ Контекст сжат\n"))
      } catch (e) {
        stopSpinner()
        console.log(red("  ✗ " + String(e?.message || e).slice(0, 200)) + "\n")
      }
      return
    }
    case "/cost": {
      const mins = ((Date.now() - state.startedAt) / 60000).toFixed(1)
      console.log()
      console.log(box([
        dim("Сессия:        ") + white(`${mins} мин · ${state.turns} запросов`),
        dim("Токены (вход): ") + blue(String(state.totalTokens.input)),
        dim("Токены (выход):") + blue(" " + String(state.totalTokens.output)),
        dim("Стоимость:     ") + green(`~$${state.totalCost.toFixed(4)}`),
        dim("Модель:        ") + violet(state.model),
      ], { title: "Статистика", padding: 2 }))
      console.log()
      return
    }
    case "/context": {
      const chars = JSON.stringify(state.messages).length
      console.log(dim(`\n  Сообщений: ${state.messages.length} · ~${Math.round(chars / 4)} токенов в контексте\n`))
      return
    }
    case "/init": {
      await runTurn(
        "Изучи этот проект (структуру, package.json, ключевые файлы) и создай файл STELLA.md с кратким описанием: что за проект, стек, структура, как запускать, соглашения. Файл будет использоваться как твоя память о проекте.",
      )
      return
    }
    case "/memory": {
      if (fs.existsSync("STELLA.md")) console.log("\n" + renderMarkdown(fs.readFileSync("STELLA.md", "utf8")) + "\n")
      else console.log(dim("\n  STELLA.md не найден. Создай его командой /init\n"))
      return
    }
    case "/history": {
      console.log()
      for (const m of state.messages) {
        const content = typeof m.content === "string" ? m.content : JSON.stringify(m.content).slice(0, 100)
        console.log("  " + (m.role === "user" ? blue("вы  ") : violet("ai  ")) + dim(String(content).slice(0, 100)))
      }
      console.log()
      return
    }
    case "/export": {
      const file = arg || `stella-session-${Date.now()}.md`
      const md = state.messages
        .map((m) => `## ${m.role}\n\n${typeof m.content === "string" ? m.content : JSON.stringify(m.content, null, 2)}`)
        .join("\n\n")
      fs.writeFileSync(file, `# Stella Coder — сессия\n\n${md}`)
      console.log(green(`\n  ✓ Экспортировано в ${file}\n`))
      return
    }
    case "/config": {
      console.log()
      console.log(box([
        dim("Конфиг:   ") + gray(CONFIG_PATH),
        dim("Модель:   ") + violet(state.model),
        dim("API-ключ: ") + (apiKey ? green("задан") : red("не задан")),
        dim("Endpoint: ") + gray(ZEN_BASE_URL),
        dim("Всегда:   ") + gray([...state.alwaysAllow].join(", ") || "—"),
      ], { title: "Конфигурация", padding: 2 }))
      console.log()
      return
    }
    case "/login":
    case "/newkey": {
      const key = arg || (await question("  " + violet("API ключ › ")))
      if (key.trim()) {
        const result = saveApiKey(key.trim())
        if (result.ok) {
          apiKey = key.trim()
          const hw = getHardwareInfo()
          console.log(green("  ✓ Ключ сохранён и привязан к железу"))
          console.log(dim(" ingerprint: ") + gray(hw.fingerprint))
          console.log(dim("  Платформа: ") + gray(hw.platform + " / " + hw.hostname))
          console.log()
        } else {
          console.log(red("  ✗ " + result.error + "\n"))
        }
      }
      return
    }
    case "/delapikey": {
      const confirm = await question("  " + red("Удалить API ключ? (yes/no) › "))
      if (confirm.trim().toLowerCase() === "yes") {
        const result = deleteApiKey()
        if (result.ok) {
          apiKey = ""
          console.log(green("  ✓ API ключ удалён\n"))
        } else {
          console.log(red("  ✗ " + result.error + "\n"))
        }
      } else {
        console.log(dim("  Отмена\n"))
      }
      return
    }
    case "/permissions": {
      state.alwaysAllow.clear()
      saveConfig({ ...loadConfig(), alwaysAllow: [] })
      console.log(green("  ✓ Разрешения сброшены\n"))
      return
    }
    case "/plan": {
      if (!arg) { console.log(dim("\n  Использование: /plan <описание задачи>\n")); return }
      await runPlan(arg)
      return
    }
    case "/commit": {
      await runCommit(arg)
      return
    }
    case "/ollama": {
      await handleOllama(arg)
      return
    }
    case "/vt": {
      await handleVirusTotal(arg)
      return
    }
    case "/ai-scan": {
      await handleAIScan(arg)
      return
    }
    case "/doctor": {
      console.log()
      const checks = [
        ["Node.js", process.version, true],
        ["Рабочая папка", process.cwd(), true],
        ["API ключ", apiKey ? "задан" : "НЕ задан", !!apiKey],
        ["git", safeExec("git --version"), null],
        ["Интернет", "проверяю…", null],
      ]
      for (const [name, val, ok] of checks.slice(0, 4)) {
        console.log("  " + (ok === false ? red("✗") : green("✓")) + " " + dim(name.padEnd(22)) + white(String(val)))
      }
      try {
        const res = await fetch(ZEN_BASE_URL + "/v1/models", {
          headers: { Authorization: `Bearer ${apiKey}` },
          signal: AbortSignal.timeout(5000),
        })
        console.log("  " + green("✓") + " " + dim("Интернет".padEnd(22)) + white(`HTTP ${res.status}`))
      } catch {
        console.log("  " + red("✗") + " " + dim("Интернет".padEnd(22)) + red("недоступен"))
      }
      console.log()
      return
    }
    case "/version": {
      console.log("\n  " + gradientLine(`✦ Stella Coder v${VERSION}`) + dim(" · AI engine · ai-sdk") + "\n")
      return
    }
    case "/av": {
      const { showUI } = await import("../antimalware/ui.mjs")
      rl.close()
      await showUI()
      // After AV exits, restart REPL
      rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        completer: (line) => {
          if (!line.startsWith("/")) return [[], line]
          const hits = COMMANDS.map(([c]) => c).filter((c) => c.startsWith(line))
          return [hits, line]
        },
      })
      rl.on("SIGINT", () => {
        const now = Date.now()
        if (now - lastSigint < 1500) goodbye()
        lastSigint = now
        console.log(dim("\n  (нажми Ctrl+C ещё раз для выхода)"))
        promptUser()
      })
      rl.on("close", goodbye)
      console.log()
      return
    }

    // ═══════════════════════════════════════════════════
    //  ФАЙЛЫ
    // ═══════════════════════════════════════════════════
    case "/read": {
      if (!arg) { console.log(dim("\n  Использование: /read <файл>\n")); return }
      try {
        const content = fs.readFileSync(arg.trim(), "utf8")
        console.log("\n" + content + "\n")
      } catch (e) {
        console.log(red(`\n  ✗ Ошибка: ${e.message}\n`))
      }
      return
    }
    case "/write": {
      if (!arg) { console.log(dim("\n  Использование: /write <файл> <содержимое>\n")); return }
      const [writeFile, ...writeContent] = arg.split(/\s+/)
      const writeData = writeContent.join(" ")
      if (!writeData) {
        console.log(dim("\n  Введите содержимое (Ctrl+D для завершения):\n"))
        const lines = []
        const line = await question("")
        lines.push(line)
        fs.writeFileSync(writeFile, lines.join("\n"))
      } else {
        fs.writeFileSync(writeFile, writeData)
      }
      console.log(green(`\n  ✓ Записано в ${writeFile}\n`))
      return
    }
    case "/edit": {
      if (!arg) { console.log(dim("\n  Использование: /edit <файл> <строка> <текст>\n")); return }
      const editParts = arg.split(/\s+/)
      const editFile = editParts[0]
      const editLine = parseInt(editParts[1])
      const editText = editParts.slice(2).join(" ")
      if (!editFile || isNaN(editLine) || !editText) {
        console.log(dim("\n  Формат: /edit файл номер_строки новый_текст\n"))
        return
      }
      try {
        const lines = fs.readFileSync(editFile, "utf8").split("\n")
        if (editLine < 1 || editLine > lines.length) {
          console.log(red(`\n  ✗ Строка ${editLine} не существует (всего ${lines.length})\n`))
          return
        }
        lines[editLine - 1] = editText
        fs.writeFileSync(editFile, lines.join("\n"))
        console.log(green(`\n  ✓ Строка ${editLine} обновлена в ${editFile}\n`))
      } catch (e) {
        console.log(red(`\n  ✗ Ошибка: ${e.message}\n`))
      }
      return
    }
    case "/find": {
      if (!arg) { console.log(dim("\n  Использование: /find <паттерн>\n")); return }
      try {
        const { execSync } = await import("node:child_process")
        const result = execSync(`dir /s /b "${arg}"`, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] })
        console.log("\n" + result + "\n")
      } catch (e) {
        console.log(red(`\n  ✗ Файлы не найдены\n`))
      }
      return
    }
    case "/grep": {
      if (!arg) { console.log(dim("\n  Использование: /grep <паттерн> [файл]\n")); return }
      const [grepPattern, grepFile] = arg.split(/\s+/)
      try {
        const { execSync } = await import("node:child_process")
        const cmd = grepFile ? `findstr /N /I "${grepPattern}" "${grepFile}"` : `findstr /N /I /S "${grepPattern}" *.*`
        const result = execSync(cmd, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] })
        console.log("\n" + result + "\n")
      } catch (e) {
        console.log(red(`\n  ✗ Не найдено\n`))
      }
      return
    }
    case "/tree": {
      const treePath = arg || "."
      try {
        const { execSync } = await import("node:child_process")
        const result = execSync(`tree "${treePath}" /F /A`, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] })
        console.log("\n" + result + "\n")
      } catch {
        console.log(red(`\n  ✗ Не удалось построить дерево\n`))
      }
      return
    }
    case "/head": {
      if (!arg) { console.log(dim("\n  Использование: /head [-n N] <файл>\n")); return }
      const headLines = arg.startsWith("-n ") ? parseInt(arg.split(/\s+/)[1]) : 10
      const headFile = arg.startsWith("-n ") ? arg.split(/\s+/).slice(2).join(" ") : arg
      try {
        const lines = fs.readFileSync(headFile, "utf8").split("\n").slice(0, headLines)
        console.log("\n" + lines.join("\n") + "\n")
      } catch (e) {
        console.log(red(`\n  ✗ Ошибка: ${e.message}\n`))
      }
      return
    }
    case "/tail": {
      if (!arg) { console.log(dim("\n  Использование: /tail [-n N] <файл>\n")); return }
      const tailLines = arg.startsWith("-n ") ? parseInt(arg.split(/\s+/)[1]) : 10
      const tailFile = arg.startsWith("-n ") ? arg.split(/\s+/).slice(2).join(" ") : arg
      try {
        const lines = fs.readFileSync(tailFile, "utf8").split("\n")
        console.log("\n" + lines.slice(-tailLines).join("\n") + "\n")
      } catch (e) {
        console.log(red(`\n  ✗ Ошибка: ${e.message}\n`))
      }
      return
    }
    case "/wc": {
      if (!arg) { console.log(dim("\n  Использование: /wc <файл>\n")); return }
      try {
        const content = fs.readFileSync(arg.trim(), "utf8")
        const lines = content.split("\n").length
        const words = content.split(/\s+/).length
        const chars = content.length
        console.log(`\n  ${lines} строк · ${words} слов · ${chars} символов\n`)
      } catch (e) {
        console.log(red(`\n  ✗ Ошибка: ${e.message}\n`))
      }
      return
    }
    case "/stat": {
      if (!arg) { console.log(dim("\n  Использование: /stat <файл>\n")); return }
      try {
        const stat = fs.statSync(arg.trim())
        console.log(box([
          dim("Имя:     ") + white(path.basename(arg)),
          dim("Тип:     ") + white(stat.isDirectory() ? "Папка" : "Файл"),
          dim("Размер:  ") + white(`${(stat.size / 1024).toFixed(1)} KB`),
          dim("Создан:  ") + white(stat.birthtime.toLocaleString()),
          dim("Изменён: ") + white(stat.mtime.toLocaleString()),
          dim("Права:   ") + white(stat.mode.toString(8)),
        ], { title: "Статистика файла", padding: 2 }))
        console.log()
      } catch (e) {
        console.log(red(`\n  ✗ Ошибка: ${e.message}\n`))
      }
      return
    }

    // ═══════════════════════════════════════════════════
    //  GIT
    // ═══════════════════════════════════════════════════
    case "/git": {
      if (!arg) {
        console.log(box([
          violet("/git status") + dim(" — статус"),
          violet("/git diff") + dim(" — различия"),
          violet("/git log") + dim(" — история коммитов"),
          violet("/git commit") + dim(" — AI-коммит"),
          violet("/git push") + dim(" — отправить"),
          violet("/git pull") + dim(" — получить"),
          violet("/git branch") + dim(" — ветки"),
          violet("/git checkout <ветка>") + dim(" — переключить"),
          violet("/git stash") + dim(" — сохранить изменения"),
          violet("/git pop") + dim(" — восстановить"),
          violet("/git tag <имя>") + dim(" — создать тег"),
          violet("/git clone <url>") + dim(" — клонировать"),
          violet("/git init") + dim(" — инициализировать"),
        ], { title: "Git операции", padding: 2 }))
        console.log()
        return
      }
      const [gitCmd, ...gitArgs] = arg.split(/\s+/)
      const gitFull = `git ${gitCmd} ${gitArgs.join(" ")}`.trim()
      try {
        const { execSync } = await import("node:child_process")
        const result = execSync(gitFull, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] })
        console.log("\n" + result + "\n")
      } catch (e) {
        console.log(red(`\n  ✗ git ${gitCmd}: ${e.stderr || e.message}\n`))
      }
      return
    }
    case "/log": {
      try {
        const { execSync } = await import("node:child_process")
        const result = execSync("git log --oneline -20", { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] })
        console.log("\n" + result + "\n")
      } catch {
        console.log(red("\n  ✗ Не удалось получить git log\n"))
      }
      return
    }
    case "/status": {
      try {
        const { execSync } = await import("node:child_process")
        const result = execSync("git status", { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] })
        console.log("\n" + result + "\n")
      } catch {
        console.log(red("\n  ✗ Не удалось получить git status\n"))
      }
      return
    }
    case "/branch": {
      try {
        const { execSync } = await import("node:child_process")
        const result = execSync("git branch -a", { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] })
        console.log("\n" + result + "\n")
      } catch {
        console.log(red("\n  ✗ Не удалось получить git branch\n"))
      }
      return
    }
    case "/checkout": {
      if (!arg) { console.log(dim("\n  Использование: /checkout <ветка>\n")); return }
      try {
        const { execSync } = await import("node:child_process")
        execSync(`git checkout ${arg}`, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] })
        console.log(green(`\n  ✓ Переключено на ${arg}\n`))
      } catch (e) {
        console.log(red(`\n  ✗ ${e.stderr || e.message}\n`))
      }
      return
    }
    case "/merge": {
      if (!arg) { console.log(dim("\n  Использование: /merge <ветка>\n")); return }
      try {
        const { execSync } = await import("node:child_process")
        execSync(`git merge ${arg}`, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] })
        console.log(green(`\n  ✓ Слияние с ${arg} выполнено\n`))
      } catch (e) {
        console.log(red(`\n  ✗ ${e.stderr || e.message}\n`))
      }
      return
    }
    case "/stash": {
      try {
        const { execSync } = await import("node:child_process")
        execSync("git stash", { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] })
        console.log(green("\n  ✓ Изменения сохранены в stash\n"))
      } catch (e) {
        console.log(red(`\n  ✗ ${e.stderr || e.message}\n`))
      }
      return
    }
    case "/pop": {
      try {
        const { execSync } = await import("node:child_process")
        execSync("git stash pop", { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] })
        console.log(green("\n  ✓ Изменения восстановлены из stash\n"))
      } catch (e) {
        console.log(red(`\n  ✗ ${e.stderr || e.message}\n`))
      }
      return
    }
    case "/tag": {
      if (!arg) { console.log(dim("\n  Использование: /tag <имя_тега>\n")); return }
      try {
        const { execSync } = await import("node:child_process")
        execSync(`git tag ${arg}`, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] })
        console.log(green(`\n  ✓ Тег ${arg} создан\n`))
      } catch (e) {
        console.log(red(`\n  ✗ ${e.stderr || e.message}\n`))
      }
      return
    }
    case "/remote": {
      try {
        const { execSync } = await import("node:child_process")
        const result = execSync("git remote -v", { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] })
        console.log("\n" + (result || "Нет remote репозиториев") + "\n")
      } catch {
        console.log(red("\n  ✗ Не удалось получить git remote\n"))
      }
      return
    }
    case "/pull": {
      try {
        const { execSync } = await import("node:child_process")
        execSync("git pull", { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] })
        console.log(green("\n  ✓ Pull выполнен\n"))
      } catch (e) {
        console.log(red(`\n  ✗ ${e.stderr || e.message}\n`))
      }
      return
    }
    case "/push": {
      try {
        const { execSync } = await import("node:child_process")
        execSync("git push", { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] })
        console.log(green("\n  ✓ Push выполнен\n"))
      } catch (e) {
        console.log(red(`\n  ✗ ${e.stderr || e.message}\n`))
      }
      return
    }
    case "/clone": {
      if (!arg) { console.log(dim("\n  Использование: /clone <url>\n")); return }
      try {
        const { execSync } = await import("node:child_process")
        execSync(`git clone ${arg}`, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] })
        console.log(green(`\n  ✓ Клонировано из ${arg}\n`))
      } catch (e) {
        console.log(red(`\n  ✗ ${e.stderr || e.message}\n`))
      }
      return
    }

    // ═══════════════════════════════════════════════════
    //  AI И АГЕНТЫ
    // ═══════════════════════════════════════════════════
    case "/todo": {
      const todoPath = path.join(process.cwd(), ".stella-todos.json")
      let todos = []
      try { todos = JSON.parse(fs.readFileSync(todoPath, "utf8")) } catch {}

      if (!arg || arg === "list" || arg === "показать") {
        if (todos.length === 0) {
          console.log(dim("\n  Нет задач. Добавь: /todo add <текст>\n"))
        } else {
          console.log()
          todos.forEach((t, i) => {
            const status = t.done ? green("✓") : yellow("○")
            console.log(`  ${status} ${white(String(i + 1))}. ${t.done ? dim(t.text) : t.text}`)
          })
          console.log()
        }
        return
      }
      if (arg.startsWith("add ") || arg.startsWith("добавить ")) {
        const text = arg.replace(/^(add|добавить)\s+/, "")
        todos.push({ text, done: false, created: new Date().toISOString() })
        fs.writeFileSync(todoPath, JSON.stringify(todos, null, 2))
        console.log(green(`\n  ✓ Задача добавлена: ${text}\n`))
        return
      }
      if (arg.startsWith("done ") || arg.startsWith("выполнитb ")) {
        const idx = parseInt(arg.replace(/^(done|выполнитb)\s+/, "")) - 1
        if (todos[idx]) {
          todos[idx].done = true
          fs.writeFileSync(todoPath, JSON.stringify(todos, null, 2))
          console.log(green(`\n  ✓ Задача ${idx + 1} выполнена\n`))
        } else {
          console.log(red("\n  ✗ Неверный номер задачи\n"))
        }
        return
      }
      if (arg.startsWith("rm ") || arg.startsWith("удалить ")) {
        const idx = parseInt(arg.replace(/^(rm|удалить)\s+/, "")) - 1
        if (todos[idx]) {
          todos.splice(idx, 1)
          fs.writeFileSync(todoPath, JSON.stringify(todos, null, 2))
          console.log(green(`\n  ✓ Задача удалена\n`))
        } else {
          console.log(red("\n  ✗ Неверный номер задачи\n"))
        }
        return
      }
      if (arg === "clear" || arg === "очистить") {
        fs.writeFileSync(todoPath, "[]")
        console.log(green("\n  ✓ Все задачи удалены\n"))
        return
      }
      console.log(dim("\n  Использование: /todo [add|done|rm|list|clear] [аргумент]\n"))
      return
    }
    case "/remember": {
      if (!arg) { console.log(dim("\n  Использование: /remember <информация для запоминания>\n")); return }
      const memoryPath = path.join(process.cwd(), "STELLA.md")
      const entry = `\n\n## ${new Date().toLocaleString()}\n${arg}`
      if (fs.existsSync(memoryPath)) {
        fs.appendFileSync(memoryPath, entry)
      } else {
        fs.writeFileSync(memoryPath, `# Память проекта Stella\n${entry}`)
      }
      console.log(green("\n  ✓ Информация сохранена в STELLA.md\n"))
      return
    }
    case "/forget": {
      if (!arg) { console.log(dim("\n  Использование: /forget <что удалить>\n")); return }
      const forgetPath = path.join(process.cwd(), "STELLA.md")
      if (fs.existsSync(forgetPath)) {
        let content = fs.readFileSync(forgetPath, "utf8")
        content = content.replace(arg, "")
        fs.writeFileSync(forgetPath, content)
        console.log(green("\n  ✓ Информация удалена из памяти\n"))
      } else {
        console.log(dim("\n  STELLA.md не найден\n"))
      }
      return
    }
    case "/skill": {
      console.log(box([
        violet("/skill list") + dim(" — показать доступные навыки"),
        violet("/skill load <название>") + dim(" — загрузить навык"),
        violet("/skill search <запрос>") + dim(" — найти навык"),
        "",
        dim("Навыки расширяют возможности Stella."),
        dim("Смотри: ") + cyan("https://opencode.ai/skills"),
      ], { title: "Навыки (Skills)", padding: 2 }))
      console.log()
      return
    }
    case "/mcp": {
      // Delegate to MCP command handler
      const mcpHandler = MCP_COMMANDS["/mcp"]?.handler
      if (mcpHandler) {
        await mcpHandler(arg || "help")
      } else {
        console.log(box([
          violet("/mcp list") + dim(" — список серверов"),
          violet("/mcp start <имя>") + dim(" — запустить сервер"),
          violet("/mcp stop <имя>") + dim(" — остановить сервер"),
          violet("/mcp add <имя> <команда> [args]") + dim(" — добавить сервер"),
          violet("/mcp remove <имя>") + dim(" — удалить сервер"),
          violet("/mcp tools") + dim(" — список инструментов"),
          "",
          dim("MCP (Model Context Protocol) расширяет инструменты AI."),
        ], { title: "MCP Серверы", padding: 2 }))
      }
      console.log()
      return
    }
    case "/agent": {
      const agents = listSubagents()
      if (!arg || arg === "list" || arg === "список") {
        console.log(box([
          ...agents.map(a => `${a.icon} ${violet(a.name)}` + dim(` — ${a.description}`)),
          "",
          dim("Запуск: ") + violet("@имя_агента задача"),
        ], { title: "Субагенты Stella", padding: 2 }))
        console.log()
        return
      }
      // Parse @agent task format
      const agentMatch = parseAgentCommand(`@${arg}`)
      if (agentMatch) {
        const result = await runSubagent(agentMatch.agent, agentMatch.task, {
          apiKey,
          model: state.model,
          tools: createTools({ ask: askPermission }),
        })
        if (result.result) {
          console.log("\n" + renderMarkdown(result.result) + "\n")
        }
      } else {
        // Run as general subagent task
        const result = await runSubagent("codebase-investigator", arg, {
          apiKey,
          model: state.model,
          tools: createTools({ ask: askPermission }),
        })
        if (result.result) {
          console.log("\n" + renderMarkdown(result.result) + "\n")
        }
      }
      return
    }
    case "@codebase-investigator":
    case "@security-auditor":
    case "@test-writer":
    case "@docs-writer":
    case "@refactor":
    case "@debugger":
    case "@performance":
    case "@git-expert": {
      const agentName = command.slice(1) // Remove @
      if (!arg) {
        console.log(dim(`\n  Использование: @${agentName} <задача>\n`))
        return
      }
      const result = await runSubagent(agentName, arg, {
        apiKey,
        model: state.model,
        tools: createTools({ ask: askPermission }),
      })
      if (result.result) {
        console.log("\n" + renderMarkdown(result.result) + "\n")
      }
      return
    }

    // ═══════════════════════════════════════════════════
    //  ВЕБ И КОНТЕНТ
    // ═══════════════════════════════════════════════════
    case "/web": {
      if (!arg) { console.log(dim("\n  Использование: /web <поисковый запрос>\n")); return }
      await runTurn(`Найди в интернете: ${arg}. Верни краткую выжимку с источниками.`)
      return
    }
    case "/read-image": {
      if (!arg) { console.log(dim("\n  Использование: /read-image <путь к изображению>\n")); return }
      console.log(dim("\n  Анализирую изображение...\n"))
      await runTurn(`Проанализируй изображение ${arg}. Опиши что на нём изображено.`)
      return
    }
    case "/read-pdf": {
      if (!arg) { console.log(dim("\n  Использование: /read-pdf <путь к PDF>\n")); return }
      console.log(dim("\n  Извлекаю текст из PDF...\n"))
      await runTurn(`Прочитай PDF файл ${arg}. Извлеки и верни текст.`)
      return
    }
    case "/explain": {
      if (!arg) { console.log(dim("\n  Использование: /explain <файл или код>\n")); return }
      await runTurn(`Объясни что делает этот код/файл: ${arg}. Будь подробным и понятным.`)
      return
    }
    case "/review": {
      if (!arg) { console.log(dim("\n  Использование: /review <файл>\n")); return }
      await runTurn(`Сделай код-ревью файла ${arg}. Найди баги, улучшения, проблемы безопасности.`)
      return
    }
    case "/refactor": {
      if (!arg) { console.log(dim("\n  Использование: /refactor <файл>\n")); return }
      await runTurn(`Проведи рефакторинг файла ${arg}. Улучши читаемость, производительность, архитектуру.`)
      return
    }
    case "/translate": {
      if (!arg) { console.log(dim("\n  Использование: /translate <текст> [язык]\n")); return }
      await runTurn(`Переведи текст: ${arg}`)
      return
    }
    case "/summarize": {
      if (!arg) { console.log(dim("\n  Использование: /summarize <текст или файл>\n")); return }
      await runTurn(`Суммаризируй: ${arg}`)
      return
    }

    // ═══════════════════════════════════════════════════
    //  ТЕСТИРОВАНИЕ И СБОРКА
    // ═══════════════════════════════════════════════════
    case "/test": {
      const testCmd = arg || "npm test"
      console.log(dim(`\n  Запускаю: ${testCmd}\n`))
      try {
        const { execSync } = await import("node:child_process")
        const result = execSync(testCmd, { encoding: "utf8", stdio: "inherit" })
      } catch (e) {
        console.log(red(`\n  ✗ Тесты завершились с ошибкой\n`))
      }
      return
    }
    case "/lint": {
      const lintCmd = arg || "npm run lint"
      console.log(dim(`\n  Запускаю: ${lintCmd}\n`))
      try {
        const { execSync } = await import("node:child_process")
        execSync(lintCmd, { encoding: "utf8", stdio: "inherit" })
      } catch {
        console.log(red(`\n  ✗ Линтер завершился с ошибкой\n`))
      }
      return
    }
    case "/format": {
      const formatCmd = arg || "npx prettier --write ."
      console.log(dim(`\n  Форматирую: ${formatCmd}\n`))
      try {
        const { execSync } = await import("node:child_process")
        execSync(formatCmd, { encoding: "utf8", stdio: "inherit" })
        console.log(green("\n  ✓ Код отформатирован\n"))
      } catch {
        console.log(red(`\n  ✗ Ошибка форматирования\n`))
      }
      return
    }
    case "/typecheck": {
      const typeCmd = arg || "npx tsc --noEmit"
      console.log(dim(`\n  Проверяю типы: ${typeCmd}\n`))
      try {
        const { execSync } = await import("node:child_process")
        execSync(typeCmd, { encoding: "utf8", stdio: "inherit" })
        console.log(green("\n  ✓ Типы корректны\n"))
      } catch {
        console.log(red(`\n  ✗ Ошибка проверки типов\n`))
      }
      return
    }
    case "/build": {
      const buildCmd = arg || "npm run build"
      console.log(dim(`\n  Собираю: ${buildCmd}\n`))
      try {
        const { execSync } = await import("node:child_process")
        execSync(buildCmd, { encoding: "utf8", stdio: "inherit" })
        console.log(green("\n  ✓ Сборка завершена\n"))
      } catch {
        console.log(red(`\n  ✗ Ошибка сборки\n`))
      }
      return
    }
    case "/run": {
      if (!arg) { console.log(dim("\n  Использование: /run <команда>\n")); return }
      console.log(dim(`\n  Запускаю: ${arg}\n`))
      try {
        const { execSync } = await import("node:child_process")
        execSync(arg, { encoding: "utf8", stdio: "inherit" })
      } catch {
        console.log(red(`\n  ✗ Команда завершилась с ошибкой\n`))
      }
      return
    }
    case "/debug": {
      if (!arg) { console.log(dim("\n  Использование: /debug <команда>\n")); return }
      console.log(dim(`\n  Отладка: ${arg}\n`))
      try {
        const { execSync } = await import("node:child_process")
        execSync(`node --inspect ${arg}`, { encoding: "utf8", stdio: "inherit" })
      } catch {
        console.log(red(`\n  ✗ Ошибка отладки\n`))
      }
      return
    }

    // ═══════════════════════════════════════════════════
    //  БЕЗОПАСНОСТЬ
    // ═══════════════════════════════════════════════════
    case "/audit": {
      console.log(dim("\n  Аудит безопасности...\n"))
      await runTurn(`Проведи аудит безопасности этого проекта. Проверь зависимости, конфиги, секреты.`)
      return
    }
    case "/secrets": {
      console.log(dim("\n  Поиск секретов в коде...\n"))
      try {
        const { execSync } = await import("node:child_process")
        const result = execSync('findstr /S /I /N "password api_key secret token private_key" *.*', { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] })
        if (result.trim()) {
          console.log(yellow("\n  ⚠ Найдены потенциальные секреты:\n"))
          console.log(result)
        } else {
          console.log(green("\n  ✓ Секреты не найдены\n"))
        }
      } catch {
        console.log(green("\n  ✓ Секреты не найдены\n"))
      }
      return
    }
    case "/hash": {
      if (!arg) { console.log(dim("\n  Использование: /hash <файл>\n")); return }
      try {
        const crypto = await import("node:crypto")
        const content = fs.readFileSync(arg.trim())
        const sha256 = crypto.createHash("sha256").update(content).digest("hex")
        const md5 = crypto.createHash("md5").update(content).digest("hex")
        console.log(box([
          dim("Файл:  ") + white(path.basename(arg)),
          dim("SHA256:") + cyan(sha256),
          dim("MD5:   ") + cyan(md5),
          dim("Размер:") + white(`${(content.length / 1024).toFixed(1)} KB`),
        ], { title: "Хеш файла", padding: 2 }))
        console.log()
      } catch (e) {
        console.log(red(`\n  ✗ Ошибка: ${e.message}\n`))
      }
      return
    }

    // ═══════════════════════════════════════════════════
    //  ПАКЕТЫ
    // ═══════════════════════════════════════════════════
    case "/install": {
      if (!arg) { console.log(dim("\n  Использование: /install <пакет>\n")); return }
      const pkgManager = fs.existsSync("pnpm-lock.yaml") ? "pnpm" : fs.existsSync("yarn.lock") ? "yarn" : "npm"
      console.log(dim(`\n  Устанавливаю ${arg} через ${pkgManager}...\n`))
      try {
        const { execSync } = await import("node:child_process")
        execSync(`${pkgManager} install ${arg}`, { encoding: "utf8", stdio: "inherit" })
        console.log(green(`\n  ✓ ${arg} установлен\n`))
      } catch {
        console.log(red(`\n  ✗ Ошибка установки\n`))
      }
      return
    }
    case "/uninstall": {
      if (!arg) { console.log(dim("\n  Использование: /uninstall <пакет>\n")); return }
      const pkgManager2 = fs.existsSync("pnpm-lock.yaml") ? "pnpm" : fs.existsSync("yarn.lock") ? "yarn" : "npm"
      console.log(dim(`\n  Удаляю ${arg}...\n`))
      try {
        const { execSync } = await import("node:child_process")
        execSync(`${pkgManager2} uninstall ${arg}`, { encoding: "utf8", stdio: "inherit" })
        console.log(green(`\n  ✓ ${arg} удалён\n`))
      } catch {
        console.log(red(`\n  ✗ Ошибка удаления\n`))
      }
      return
    }
    case "/outdated": {
      const pkgManager3 = fs.existsSync("pnpm-lock.yaml") ? "pnpm" : fs.existsSync("yarn.lock") ? "yarn" : "npm"
      console.log(dim(`\n  Проверяю устаревшие пакеты...\n`))
      try {
        const { execSync } = await import("node:child_process")
        execSync(`${pkgManager3} outdated`, { encoding: "utf8", stdio: "inherit" })
      } catch {
        console.log(dim("\n  Все пакеты актуальны\n"))
      }
      return
    }
    case "/deps": {
      if (fs.existsSync("package.json")) {
        const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"))
        console.log()
        if (pkg.dependencies) {
          console.log(dim("  Зависимости:"))
          for (const [name, ver] of Object.entries(pkg.dependencies)) {
            console.log(`    ${white(name)} ${dim(ver)}`)
          }
        }
        if (pkg.devDependencies) {
          console.log(dim("\n  Dev-зависимости:"))
          for (const [name, ver] of Object.entries(pkg.devDependencies)) {
            console.log(`    ${white(name)} ${dim(ver)}`)
          }
        }
        console.log()
      } else {
        console.log(dim("\n  package.json не найден\n"))
      }
      return
    }

    // ═══════════════════════════════════════════════════
    //  ОКРУЖЕНИЕ
    // ═══════════════════════════════════════════════════
    case "/env": {
      console.log()
      if (arg) {
        console.log(`  ${dim(arg)}=${white(process.env[arg] || "не задана")}`)
      } else {
        for (const [key, val] of Object.entries(process.env).sort()) {
          console.log(`  ${dim(key)}=${white(String(val).slice(0, 80))}`)
        }
      }
      console.log()
      return
    }
    case "/set-env": {
      if (!arg) { console.log(dim("\n  Использование: /set-env КЛЮЧ=ЗНАЧЕНИЕ\n")); return }
      const [envKey, ...envVal] = arg.split("=")
      process.env[envKey] = envVal.join("=")
      console.log(green(`\n  ✓ ${envKey}=${process.env[envKey]}\n`))
      return
    }
    case "/path": {
      console.log("\n" + (process.env.PATH || "").split(path.delimiter).join("\n") + "\n")
      return
    }
    case "/which": {
      if (!arg) { console.log(dim("\n  Использование: /which <команда>\n")); return }
      try {
        const { execSync } = await import("node:child_process")
        const result = execSync(`where ${arg}`, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] })
        console.log("\n" + result + "\n")
      } catch {
        console.log(red(`\n  ✗ ${arg} не найден\n`))
      }
      return
    }
    case "/whoami": {
      console.log("\n" + os.userInfo().username + "\n")
      return
    }
    case "/hostname": {
      console.log("\n" + os.hostname() + "\n")
      return
    }
    case "/uname": {
      console.log(`\n${os.platform()} ${os.release()} (${os.arch()})\n`)
      return
    }
    case "/uptime": {
      const uptime = os.uptime()
      const hours = Math.floor(uptime / 3600)
      const mins = Math.floor((uptime % 3600) / 60)
      console.log(`\n  Время работы: ${hours}ч ${mins}м\n`)
      return
    }
    case "/disk": {
      try {
        const { execSync } = await import("node:child_process")
        const result = execSync("wmic logicaldisk get size,freespace,caption", { encoding: "utf8" })
        console.log("\n" + result + "\n")
      } catch {
        console.log(red("\n  ✗ Не удалось получить информацию о дисках\n"))
      }
      return
    }
    case "/mem": {
      const total = os.totalmem()
      const free = os.freemem()
      const used = total - free
      console.log(box([
        dim("Всего:     ") + white(`${(total / 1e9).toFixed(1)} GB`),
        dim("Используется:") + yellow(` ${(used / 1e9).toFixed(1)} GB (${((used / total) * 100).toFixed(1)}%)`),
        dim("Свободно:  ") + green(`${(free / 1e9).toFixed(1)} GB`),
      ], { title: "Память", padding: 2 }))
      console.log()
      return
    }
    case "/cpu": {
      console.log(box([
        dim("Модель:    ") + white(os.cpus()[0]?.model || "N/A"),
        dim("Ядер:      ") + white(String(os.cpus().length)),
        dim("Архитектура:") + white(os.arch()),
      ], { title: "CPU", padding: 2 }))
      console.log()
      return
    }
    case "/net": {
      try {
        const { execSync } = await import("node:child_process")
        const result = execSync("ipconfig", { encoding: "utf8" })
        console.log("\n" + result + "\n")
      } catch {
        console.log(red("\n  ✗ Не удалось получить сетевую информацию\n"))
      }
      return
    }
    case "/ping": {
      if (!arg) { console.log(dim("\n  Использование: /ping <хост>\n")); return }
      try {
        const { execSync } = await import("node:child_process")
        const result = execSync(`ping -n 4 ${arg}`, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] })
        console.log("\n" + result + "\n")
      } catch (e) {
        console.log(red(`\n  ✗ ${e.stderr || e.message}\n`))
      }
      return
    }
    case "/curl": {
      if (!arg) { console.log(dim("\n  Использование: /curl <url>\n")); return }
      try {
        const { execSync } = await import("node:child_process")
        const result = execSync(`curl -s ${arg}`, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] })
        console.log("\n" + result.slice(0, 2000) + "\n")
      } catch (e) {
        console.log(red(`\n  ✗ ${e.stderr || e.message}\n`))
      }
      return
    }
    case "/wget": {
      if (!arg) { console.log(dim("\n  Использование: /wget <url>\n")); return }
      try {
        const { execSync } = await import("node:child_process")
        execSync(`curl -O ${arg}`, { encoding: "utf8", stdio: "inherit" })
        console.log(green(`\n  ✓ Загружено из ${arg}\n`))
      } catch (e) {
        console.log(red(`\n  ✗ Ошибка загрузки\n`))
      }
      return
    }

    // ═══════════════════════════════════════════════════
    //  МОНИТОРИНГ
    // ═══════════════════════════════════════════════════
    case "/ps": {
      try {
        const { execSync } = await import("node:child_process")
        const result = execSync("tasklist /FO TABLE", { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] })
        console.log("\n" + result + "\n")
      } catch {
        console.log(red("\n  ✗ Не удалось получить список процессов\n"))
      }
      return
    }
    case "/kill": {
      if (!arg) { console.log(dim("\n  Использование: /kill <PID или имя>\n")); return }
      try {
        const { execSync } = await import("node:child_process")
        execSync(`taskkill /F /IM ${arg}`, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] })
        console.log(green(`\n  ✓ Процесс ${arg} завершён\n`))
      } catch (e) {
        console.log(red(`\n  ✗ ${e.stderr || e.message}\n`))
      }
      return
    }

    // ═══════════════════════════════════════════════════
    //  ДОКУМЕНТАЦИЯ
    // ═══════════════════════════════════════════════════
    case "/docs": {
      console.log(dim("\n  Генерирую документацию...\n"))
      await runTurn(`Сгенерируй документацию для этого проекта. Включи: описание, установку, использование, API.`)
      return
    }
    case "/readme": {
      console.log(dim("\n  Генерирую README...\n"))
      await runTurn(`Сгенерируй README.md для этого проекта. Включи: описание, особенности, установку, использование, лицензию.`)
      return
    }
    case "/changelog": {
      console.log(dim("\n  Генерирую changelog...\n"))
      await runTurn(`Сгенерируй CHANGELOG.md на основе git log. Используй формат Keep a Changelog.`)
      return
    }
    case "/examples": {
      console.log(dim("\n  Генерирую примеры...\n"))
      await runTurn(`Сгенерируй примеры использования этого проекта. Покажи базовые и продвинутые сценарии.`)
      return
    }
    case "/tutorial": {
      console.log(dim("\n  Создаю обучение...\n"))
      await runTurn(`Создай пошаговое обучение для этого проекта. Начни с основ, дойди до продвинутых тем.`)
      return
    }
    case "/wizard": {
      console.log(dim("\n  Запускаю мастер настройки...\n"))
      await runTurn(`Проведи через мастер настройки этого проекта. Определи стек, настрой окружение, проверь зависимости.`)
      return
    }

    // ═══════════════════════════════════════════════════
    //  СЕССИИ
    // ═══════════════════════════════════════════════════
    case "/save": {
      const savePath = arg || path.join(CONFIG_DIR, `session-${Date.now()}.json`)
      const session = { model: state.model, messages: state.messages, savedAt: new Date().toISOString() }
      fs.writeFileSync(savePath, JSON.stringify(session, null, 2))
      console.log(green(`\n  ✓ Сессия сохранена в ${savePath}\n`))
      return
    }
    case "/load": {
      if (!arg) { console.log(dim("\n  Использование: /load <путь к сессии>\n")); return }
      try {
        const session = JSON.parse(fs.readFileSync(arg.trim(), "utf8"))
        state.model = session.model || state.model
        state.messages = session.messages || []
        console.log(green(`\n  ✓ Сессия загружена (${state.messages.length} сообщений)\n`))
      } catch (e) {
        console.log(red(`\n  ✗ Ошибка: ${e.message}\n`))
      }
      return
    }
    case "/sessions": {
      try {
        const files = fs.readdirSync(CONFIG_DIR).filter(f => f.startsWith("session-") && f.endsWith(".json"))
        if (files.length === 0) {
          console.log(dim("\n  Нет сохранённых сессий\n"))
        } else {
          console.log()
          files.forEach((f, i) => {
            const stat = fs.statSync(path.join(CONFIG_DIR, f))
            console.log(`  ${white(String(i + 1))}. ${dim(f)} ${gray(stat.mtime.toLocaleString())}`)
          })
          console.log()
        }
      } catch {
        console.log(dim("\n  Нет сохранённых сессий\n"))
      }
      return
    }

    // ═══════════════════════════════════════════════════
    //  ДОПОЛНИТЕЛЬНО
    // ═══════════════════════════════════════════════════
    case "/color":
    case "/theme": {
      console.log(box([
        violet("1") + dim(" — Violet (по умолчанию)"),
        violet("2") + dim(" — Ocean"),
        violet("3") + dim(" — Forest"),
        violet("4") + dim(" — Sunset"),
        violet("5") + dim(" — Monokai"),
      ], { title: "Темы оформления", padding: 2 }))
      console.log()
      return
    }
    case "/lang": {
      console.log(box([
        violet("1") + dim(" — Русский (по умолчанию)"),
        violet("2") + dim(" — English"),
        violet("3") + dim(" — 한국어"),
        violet("4") + dim(" — 中文"),
        violet("5") + dim(" — 日本語"),
      ], { title: "Язык интерфейса", padding: 2 }))
      console.log()
      return
    }
    case "/alias": {
      if (!arg) {
        console.log(dim("\n  Использование: /alias <имя> <команда>\n"))
        return
      }
      const [aliasName, ...aliasCmd] = arg.split(/\s+/)
      const aliasFile = path.join(CONFIG_DIR, "aliases.json")
      let aliases = {}
      try { aliases = JSON.parse(fs.readFileSync(aliasFile, "utf8")) } catch {}
      aliases[aliasName] = aliasCmd.join(" ")
      fs.writeFileSync(aliasFile, JSON.stringify(aliases, null, 2))
      console.log(green(`\n  ✓ Алиас ${aliasName} создан\n`))
      return
    }
    case "/shortcut": {
      console.log(box([
        dim("Ctrl+C") + white(" — прервать (2x — выход)"),
        dim("Ctrl+D") + white(" — выход"),
        dim("Tab") + white(" — автодополнение команд"),
        dim("!команда") + white(" — shell-команда напрямую"),
        dim("/help") + white(" — все команды"),
      ], { title: "Горячие клавиши", padding: 2 }))
      console.log()
      return
    }
    case "/feedback": {
      console.log(dim("\n  Отправь отзыв: ") + cyan("https://github.com/anomalyco/opencode/issues\n"))
      return
    }
    case "/report": {
      console.log(dim("\n  Сообщи об ошибке: ") + cyan("https://github.com/anomalyco/opencode/issues\n"))
      return
    }
    case "/support": {
      console.log(box([
        dim("Документация:  ") + cyan("https://opencode.ai/docs"),
        dim("GitHub:        ") + cyan("https://github.com/anomalyco/opencode"),
        dim("Issues:        ") + cyan("https://github.com/anomalyco/opencode/issues"),
        dim("Discord:       ") + cyan("https://discord.gg/opencode"),
      ], { title: "Поддержка", padding: 2 }))
      console.log()
      return
    }

    // ═══════════════════════════════════════════════════
    //  УПРАВЛЕНИЕ КОМПЬЮТЕРОМ
    // ═══════════════════════════════════════════════════
    case "/open":
    case "/app": {
      if (!arg) { console.log(dim("\n  Использование: /open <приложение или URL>\n")); return }
      const appMap = {
        "chrome": "chrome.exe", "google chrome": "chrome.exe",
        "firefox": "firefox.exe", "edge": "msedge.exe", "browser": "msedge.exe",
        "notepad": "notepad.exe", "explorer": "explorer.exe", "files": "explorer.exe",
        "calc": "calc.exe", "калькулятор": "calc.exe",
        "paint": "mspaint.exe", "word": "winword.exe", "excel": "excel.exe",
        "powerpoint": "powerpnt.exe", "code": "code.cmd", "vscode": "code.cmd",
        "spotify": "Spotify.exe", "steam": "steam.exe", "discord": "Discord.exe",
        "telegram": "Telegram.exe", "teams": "Teams.exe", "zoom": "Zoom.exe",
        "terminal": "wt.exe", "powershell": "pwsh.exe", "cmd": "cmd.exe",
        "task manager": "taskmgr.exe", "диспетчер": "taskmgr.exe",
        "settings": "ms-settings:", "настройки": "ms-settings:",
        "registry": "regedit.exe", "реестр": "regedit.exe",
      }
      const appName = appMap[arg.toLowerCase()] || arg
      if (arg.startsWith("http://") || arg.startsWith("https://")) {
        try { execSync(`start "" "${arg}"`, { shell: "cmd.exe", stdio: "pipe" }); console.log(green(`\n  ✓ Открыто: ${arg}\n`)) }
        catch (e) { console.log(red(`\n  ✗ Ошибка: ${e.message}\n`)) }
      } else {
        try { execSync(`start "" "${appName}"`, { shell: "cmd.exe", stdio: "pipe" }); console.log(green(`\n  ✓ Запущено: ${appName}\n`)) }
        catch (e) { console.log(red(`\n  ✗ Не удалось запустить: ${appName}\n`)) }
      }
      return
    }
    case "/url": {
      if (!arg) { console.log(dim("\n  Использование: /url <URL>\n")); return }
      try { execSync(`start "" "${arg}"`, { shell: "cmd.exe", stdio: "pipe" }); console.log(green(`\n  ✓ Открыто: ${arg}\n`)) }
      catch (e) { console.log(red(`\n  ✗ Ошибка: ${e.message}\n`)) }
      return
    }
    case "/kinopoisk": {
      const kpUrl = arg ? `https://www.kinopoisk.ru/index.php?what=${encodeURIComponent(arg)}` : "https://www.kinopoisk.ru"
      try { execSync(`start "" "${kpUrl}"`, { shell: "cmd.exe", stdio: "pipe" }); console.log(green(`\n  ✓ Кинопоиск открыт${arg ? `: ${arg}` : ""}\n`)) }
      catch (e) { console.log(red(`\n  ✗ Ошибка: ${e.message}\n`)) }
      return
    }
    case "/youtube": {
      const ytUrl = arg ? `https://www.youtube.com/results?search_query=${encodeURIComponent(arg)}` : "https://www.youtube.com"
      try { execSync(`start "" "${ytUrl}"`, { shell: "cmd.exe", stdio: "pipe" }); console.log(green(`\n  ✓ YouTube открыт${arg ? `: ${arg}` : ""}\n`)) }
      catch (e) { console.log(red(`\n  ✗ Ошибка: ${e.message}\n`)) }
      return
    }
    case "/google": {
      const gUrl = arg ? `https://www.google.com/search?q=${encodeURIComponent(arg)}` : "https://www.google.com"
      try { execSync(`start "" "${gUrl}"`, { shell: "cmd.exe", stdio: "pipe" }); console.log(green(`\n  ✓ Google открыт${arg ? `: ${arg}` : ""}\n`)) }
      catch (e) { console.log(red(`\n  ✗ Ошибка: ${e.message}\n`)) }
      return
    }
    case "/folder": {
      if (!arg) { console.log(dim("\n  Использование: /folder <путь>\n")); return }
      try { execSync(`explorer "${arg}"`, { stdio: "pipe" }); console.log(green(`\n  ✓ Папка открыта: ${arg}\n`)) }
      catch (e) { console.log(red(`\n  ✗ Ошибка: ${e.message}\n`)) }
      return
    }
    case "/screenshot": {
      const ssPath = arg || "screenshot.png"
      try {
        execSync(`powershell -command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Screen]::PrimaryScreen | ForEach-Object { $b = $_.Bounds; Add-Type -TypeDefinition 'using System;using System.Drawing;using System.Drawing.Imaging;public class SC{public static void Cap(string f){var bmp=new Bitmap($b.Width,$b.Height);Graphics.FromImage(bmp).CopyFromScreen($b.Location,Point.Empty,$b.Size);bmp.Save(f,ImageFormat.Png);}}'; [SC]::Cap('${ssPath.replace(/\\/g, "\\\\")}')"`, { encoding: "utf8", stdio: "pipe" })
        console.log(green(`\n  ✓ Скриншот сохранён: ${ssPath}\n`))
      } catch (e) { console.log(red(`\n  ✗ Ошибка: ${e.message}\n`)) }
      return
    }
    case "/clipboard": {
      if (!arg) {
        try {
          const text = execSync("powershell -command \"Get-Clipboard\"", { encoding: "utf8", stdio: "pipe" })
          console.log(`\n  Буфер обмена:\n  ${dim(text.trim())}\n`)
        } catch { console.log(dim("\n  Буфер обмена пуст\n")) }
      } else {
        try { execSync(`powershell -command "Set-Clipboard -Value '${arg.replace(/'/g, "''")}'"`, { encoding: "utf8", stdio: "pipe" }); console.log(green(`\n  ✓ Скопировано в буфер\n`)) }
        catch (e) { console.log(red(`\n  ✗ Ошибка: ${e.message}\n`)) }
      }
      return
    }
    case "/type": {
      if (!arg) { console.log(dim("\n  Использование: /type <текст>\n")); return }
      try { execSync(`powershell -command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${arg.replace(/'/g, "''").replace(/"/g, '""')}')"`, { encoding: "utf8", stdio: "pipe" }); console.log(green(`\n  ✓ Текст набран\n`)) }
      catch (e) { console.log(red(`\n  ✗ Ошибка: ${e.message}\n`)) }
      return
    }
    case "/key": {
      if (!arg) { console.log(dim("\n  Использование: /key <клавиша>\n  Примеры: enter, tab, esc, {DELETE}, ^c, ^v, ^s, ^a, ^z, {F5}\n")); return }
      try { execSync(`powershell -command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${arg}')"`, { encoding: "utf8", stdio: "pipe" }); console.log(green(`\n  ✓ Нажато: ${arg}\n`)) }
      catch (e) { console.log(red(`\n  ✗ Ошибка: ${e.message}\n`)) }
      return
    }
    case "/volume": {
      if (!arg) { console.log(dim("\n  Использование: /volume <0-100>\n")); return }
      const vol = Math.max(0, Math.min(100, parseInt(arg)))
      try {
        execSync(`powershell -command "$wsh = New-Object -ComObject WScript.Shell; 1..50 | ForEach-Object { $wsh.SendKeys([char]174) }; 1..${Math.round(vol / 2)} | ForEach-Object { $wsh.SendKeys([char]175) }"`, { encoding: "utf8", stdio: "pipe" })
        console.log(green(`\n  ✓ Громкость: ${vol}%\n`))
      } catch (e) { console.log(red(`\n  ✗ Ошибка: ${e.message}\n`)) }
      return
    }
    case "/brightness": {
      if (!arg) { console.log(dim("\n  Использование: /brightness <0-100>\n")); return }
      try {
        execSync(`powershell -command "Get-WmiObject -Namespace root\\wmi -Class WmiMonitorBrightnessMethods | ForEach-Object { $_.WmiSetBrightness(10, ${parseInt(arg)}) }"`, { encoding: "utf8", stdio: "pipe" })
        console.log(green(`\n  ✓ Яркость: ${arg}%\n`))
      } catch (e) { console.log(red(`\n  ✗ Ошибка: ${e.message}\n`)) }
      return
    }
    case "/notify": {
      if (!arg) { console.log(dim("\n  Использование: /notify <текст уведомления>\n")); return }
      try {
        execSync(`powershell -command "[System.Reflection.Assembly]::LoadWithPartialName('System.Windows.Forms'); $n = New-Object System.Windows.Forms.NotifyIcon; $n.Icon = [System.Drawing.SystemIcons]::Information; $n.BalloonTipTitle = 'Stella'; $n.BalloonTipText = '${arg.replace(/'/g, "''")}'; $n.Visible = $true; $n.ShowBalloonTip(5000)"`, { encoding: "utf8", stdio: "pipe" })
        console.log(green(`\n  ✓ Уведомление: ${arg}\n`))
      } catch (e) { console.log(red(`\n  ✗ Ошибка: ${e.message}\n`)) }
      return
    }
    case "/windows": {
      try {
        const result = execSync(`powershell -command "Get-Process | Where-Object {$_.MainWindowTitle -ne ''} | Select-Object ProcessName, MainWindowTitle | Format-Table -AutoSize"`, { encoding: "utf8", stdio: "pipe" })
        console.log("\n" + result + "\n")
      } catch { console.log(dim("\n  Не удалось получить список окон\n")) }
      return
    }
    case "/focus": {
      if (!arg) { console.log(dim("\n  Использование: /focus <имя приложения>\n")); return }
      try {
        execSync(`powershell -command "Get-Process | Where-Object {$_.ProcessName -like '*${arg}*'} | Select-Object -First 1 | ForEach-Object { $_.MainWindowHandle } | ForEach-Object { Add-Type -Name Win -Namespace User32 -MemberDefinition '[DllImport(\"user32.dll\")] public static extern bool SetForegroundWindow(IntPtr hWnd);'; [User32.Win]::SetForegroundWindow($_) }"`, { encoding: "utf8", stdio: "pipe" })
        console.log(green(`\n  ✓ Фокус на: ${arg}\n`))
      } catch (e) { console.log(red(`\n  ✗ Ошибка: ${e.message}\n`)) }
      return
    }
    case "/wifi": {
      try {
        const result = execSync("netsh wlan show networks mode=bssid", { encoding: "utf8", stdio: "pipe" })
        console.log("\n" + result + "\n")
      } catch { console.log(dim("\n  Не удалось получить список Wi-Fi сетей\n")) }
      return
    }
    case "/lock": {
      try { execSync("rundll32.exe user32.dll,LockWorkStation", { stdio: "pipe" }); console.log(green("\n  ✓ Экран заблокирован\n")) }
      catch (e) { console.log(red(`\n  ✗ Ошибка: ${e.message}\n`)) }
      return
    }
    case "/shutdown": {
      if (!arg) { console.log(dim("\n  Использование: /shutdown <shutdown|restart|sleep>\n")); return }
      const shutCmds = { shutdown: "shutdown /s /t 0", restart: "shutdown /r /t 0", sleep: "rundll32.exe powrprof.dll,SetSuspendState 0,1,0" }
      try { execSync(shutCmds[arg] || "shutdown /s /t 0", { stdio: "pipe" }); console.log(green(`\n  ✓ ${arg}\n`)) }
      catch (e) { console.log(red(`\n  ✗ Ошибка: ${e.message}\n`)) }
      return
    }
    case "/search": {
      if (!arg) { console.log(dim("\n  Использование: /search <имя файла>\n")); return }
      try {
        const result = execSync(`dir /s /b "C:\\*${arg}*"` , { encoding: "utf8", stdio: "pipe", timeout: 10000 })
        const files = result.split("\n").filter(f => f.trim()).slice(0, 20)
        console.log(`\n  Найдено файлов: ${files.length}`)
        files.forEach(f => console.log(`  ${dim(f.trim())}`))
        console.log()
      } catch { console.log(dim("\n  Файлы не найдены\n")) }
      return
    }

    // ═══════════════════════════════════════════════════
    //  СЕРВЕР И ТЕРМИНАЛ
    // ═══════════════════════════════════════════════════
    case "/exec":
    case "/shell": {
      if (!arg) { console.log(dim("\n  Использование: /exec <команда>\n")); return }
      try {
        const result = execSync(arg, { encoding: "utf8", timeout: 120000, maxBuffer: 50 * 1024 * 1024, stdio: "pipe" })
        console.log("\n" + result + "\n")
      } catch (e) {
        console.log(red(`\n  ✗ Ошибка (код ${e.status}):\n`))
        if (e.stderr) console.log(e.stderr)
        if (e.stdout) console.log(e.stdout)
        console.log()
      }
      return
    }
    case "/powershell": {
      if (!arg) { console.log(dim("\n  Использование: /powershell <команда>\n")); return }
      try {
        const result = execSync(`powershell -ExecutionPolicy Bypass -Command "${arg.replace(/"/g, '\\"')}"`, { encoding: "utf8", timeout: 120000, stdio: "pipe" })
        console.log("\n" + result + "\n")
      } catch (e) {
        console.log(red(`\n  ✗ PowerShell ошибка:\n`))
        if (e.stderr) console.log(e.stderr)
        if (e.stdout) console.log(e.stdout)
        console.log()
      }
      return
    }
    case "/cmd": {
      if (!arg) { console.log(dim("\n  Использование: /cmd <команда>\n")); return }
      try {
        const result = execSync(`cmd /c "${arg}"`, { encoding: "utf8", timeout: 120000, stdio: "pipe" })
        console.log("\n" + result + "\n")
      } catch (e) {
        console.log(red(`\n  ✗ cmd ошибка:\n`))
        if (e.stderr) console.log(e.stderr)
        if (e.stdout) console.log(e.stdout)
        console.log()
      }
      return
    }
    case "/ssh": {
      if (!arg) { console.log(dim("\n  Использование: /ssh <user@host> [команда]\n")); return }
      const sshParts = arg.split(/\s+/)
      const sshTarget = sshParts[0]
      const sshCmd = sshParts.slice(1).join(" ")
      try {
        const cmd = sshCmd ? `ssh ${sshTarget} "${sshCmd}"` : `ssh ${sshTarget}`
        const result = execSync(cmd, { encoding: "utf8", timeout: 120000, stdio: "pipe" })
        console.log("\n" + result + "\n")
      } catch (e) {
        console.log(red(`\n  ✗ SSH ошибка: ${e.message}\n`))
      }
      return
    }
    case "/scp": {
      if (!arg) { console.log(dim("\n  Использование: /scp <источник> <назначение>\n")); return }
      const scpParts = arg.split(/\s+/)
      if (scpParts.length < 2) { console.log(dim("\n  Нужно указать источник и назначение\n")); return }
      try {
        execSync(`scp ${scpParts[0]} ${scpParts[1]}`, { encoding: "utf8", timeout: 300000, stdio: "pipe" })
        console.log(green(`\n  ✓ Файл скопирован\n`))
      } catch (e) {
        console.log(red(`\n  ✗ SCP ошибка: ${e.message}\n`))
      }
      return
    }
    case "/server": {
      try {
        const cpu = execSync("wmic cpu get loadpercentage /value", { encoding: "utf8", stdio: "pipe" })
        const cpuMatch = cpu.match(/LoadPercentage=(\d+)/)
        const cpuVal = cpuMatch ? parseInt(cpuMatch[1]) : 0

        const mem = execSync("wmic OS get FreePhysicalMemory,TotalVisibleMemorySize /value", { encoding: "utf8", stdio: "pipe" })
        const totalMatch = mem.match(/TotalVisibleMemorySize=(\d+)/)
        const freeMatch = mem.match(/FreePhysicalMemory=(\d+)/)
        const total = totalMatch ? parseInt(totalMatch[1]) / 1024 / 1024 : 0
        const free = freeMatch ? parseInt(freeMatch[1]) / 1024 / 1024 : 0

        const ports = execSync("netstat -ano | findstr LISTENING", { encoding: "utf8", timeout: 5000, stdio: "pipe" })
        const listening = ports.split("\n").filter(l => l.trim()).length

        console.log(box([
          dim("CPU:       ") + (cpuVal > 80 ? red(cpuVal + "%") : cpuVal > 50 ? yellow(cpuVal + "%") : green(cpuVal + "%")),
          dim("Память:    ") + white(`${(total - free).toFixed(1)} / ${total.toFixed(1)} GB (${((total - free) / total * 100).toFixed(0)}%)`),
          dim("Порты:     ") + cyan(String(listening)),
          dim("Uptime:    ") + dim(safeExec("net stats workstation | findstr Started")),
        ], { title: "Сервер", color: violet, padding: 2 }))
        console.log()
      } catch (e) {
        console.log(red(`\n  ✗ Ошибка: ${e.message}\n`))
      }
      return
    }
    case "/ports": {
      try {
        const result = execSync("netstat -ano | findstr LISTENING", { encoding: "utf8", timeout: 10000, stdio: "pipe" })
        const lines = result.split("\n").filter(l => l.trim()).slice(0, 30)
        console.log(dim("\n  Открытые порты:\n"))
        lines.forEach(l => console.log("  " + l.trim()))
        console.log()
      } catch { console.log(dim("\n  Не удалось получить порты\n")) }
      return
    }
    case "/connections": {
      try {
        const result = execSync("netstat -ano | findstr ESTABLISHED", { encoding: "utf8", timeout: 10000, stdio: "pipe" })
        const lines = result.split("\n").filter(l => l.trim()).slice(0, 30)
        console.log(dim("\n  Активные соединения:\n"))
        lines.forEach(l => console.log("  " + l.trim()))
        console.log()
      } catch { console.log(dim("\n  Нет активных соединений\n")) }
      return
    }
    case "/kill-port": {
      if (!arg) { console.log(dim("\n  Использование: /kill-port <порт>\n")); return }
      try {
        const result = execSync(`netstat -ano | findstr :${arg}`, { encoding: "utf8", stdio: "pipe" })
        const line = result.split("\n").find(l => l.includes("LISTENING"))
        if (!line) { console.log(dim(`\n  Порт ${arg} не используется\n`)); return }
        const pidMatch = line.match(/(\d+)\s*$/)
        if (pidMatch) {
          execSync(`taskkill /F /PID ${pidMatch[1]}`, { encoding: "utf8", stdio: "pipe" })
          console.log(green(`\n  ✓ Процесс на порту ${arg} (PID: ${pidMatch[1]}) завершён\n`))
        }
      } catch (e) {
        console.log(red(`\n  ✗ Ошибка: ${e.message}\n`))
      }
      return
    }
    case "/network": {
      try {
        const result = execSync("ipconfig /all", { encoding: "utf8", timeout: 10000, stdio: "pipe" })
        console.log("\n" + result + "\n")
      } catch { console.log(dim("\n  Не удалось получить информацию\n")) }
      return
    }
    case "/dns": {
      if (!arg || arg === "show") {
        try {
          const result = execSync("ipconfig /displaydns", { encoding: "utf8", timeout: 10000, stdio: "pipe" })
          console.log("\n" + result.slice(0, 3000) + "\n")
        } catch { console.log(dim("\n  Не удалось получить DNS\n")) }
      } else if (arg === "flush") {
        try {
          execSync("ipconfig /flushdns", { encoding: "utf8", stdio: "pipe" })
          console.log(green("\n  ✓ DNS кэш очищен\n"))
        } catch (e) { console.log(red(`\n  ✗ Ошибка: ${e.message}\n`)) }
      }
      return
    }
    case "/ping": {
      if (!arg) { console.log(dim("\n  Использование: /ping <хост>\n")); return }
      try {
        const result = execSync(`ping -n 4 ${arg}`, { encoding: "utf8", timeout: 30000, stdio: "pipe" })
        console.log("\n" + result + "\n")
      } catch (e) { console.log(red(`\n  ✗ Пинг не удался\n`)) }
      return
    }
    case "/traceroute": {
      if (!arg) { console.log(dim("\n  Использование: /traceroute <хост>\n")); return }
      try {
        const result = execSync(`tracert -d ${arg}`, { encoding: "utf8", timeout: 120000, stdio: "pipe" })
        console.log("\n" + result + "\n")
      } catch (e) { console.log(red(`\n  ✗ Ошибка: ${e.message}\n`)) }
      return
    }
    case "/download": {
      if (!arg) { console.log(dim("\n  Использование: /download <URL>\n")); return }
      try {
        execSync(`curl -L -O "${arg}"`, { encoding: "utf8", timeout: 300000, stdio: "pipe" })
        console.log(green(`\n  ✓ Скачано из ${arg}\n`))
      } catch (e) { console.log(red(`\n  ✗ Ошибка: ${e.message}\n`)) }
      return
    }
    case "/upload": {
      if (!arg) { console.log(dim("\n  Использование: /upload <файл> <URL>\n")); return }
      const uploadParts = arg.split(/\s+/)
      if (uploadParts.length < 2) { console.log(dim("\n  Нужно указать файл и URL\n")); return }
      try {
        execSync(`curl -T "${uploadParts[0]}" "${uploadParts[1]}"`, { encoding: "utf8", timeout: 300000, stdio: "pipe" })
        console.log(green(`\n  ✓ Загружено: ${uploadParts[0]} → ${uploadParts[1]}\n`))
      } catch (e) { console.log(red(`\n  ✗ Ошибка: ${e.message}\n`)) }
      return
    }
    case "/http-server": {
      const port = parseInt(arg) || 8080
      try {
        const { spawn } = await import("node:child_process")
        const server = spawn("python", ["-m", "http.server", String(port)], { detached: true, stdio: "ignore" })
        server.unref()
        console.log(green(`\n  ✓ HTTP сервер запущен на порту ${port} (PID: ${server.pid})\n`))
      } catch (e) { console.log(red(`\n  ✗ Ошибка: ${e.message}\n`)) }
      return
    }
    case "/firewall": {
      try {
        const result = execSync("netsh advfirewall show allprofiles state", { encoding: "utf8", timeout: 10000, stdio: "pipe" })
        console.log("\n" + result + "\n")
      } catch { console.log(dim("\n  Не удалось получить статус файрвола\n")) }
      return
    }
    case "/service": {
      if (!arg) {
        try {
          const result = execSync("net start", { encoding: "utf8", timeout: 10000, stdio: "pipe" })
          const services = result.split("\n").filter(l => l.trim()).slice(0, 30)
          console.log(dim("\n  Запущенные службы:\n"))
          services.forEach(s => console.log("  " + s.trim()))
          console.log()
        } catch { console.log(dim("\n  Не удалось получить службы\n")) }
      } else {
        try {
          execSync(`net start "${arg}"`, { encoding: "utf8", timeout: 30000, stdio: "pipe" })
          console.log(green(`\n  ✓ Служба ${arg} запущена\n`))
        } catch (e) { console.log(red(`\n  ✗ Ошибка: ${e.message}\n`)) }
      }
      return
    }
    case "/registry": {
      if (!arg) { console.log(dim("\n  Использование: /registry <путь к ключу>\n")); return }
      try {
        const result = execSync(`reg query "${arg}"`, { encoding: "utf8", timeout: 10000, stdio: "pipe" })
        console.log("\n" + result + "\n")
      } catch (e) { console.log(red(`\n  ✗ Ошибка: ${e.message}\n`)) }
      return
    }
    case "/script": {
      if (!arg) { console.log(dim("\n  Использование: /script <путь к скрипту>\n")); return }
      const ext = arg.split(".").pop().toLowerCase()
      const runners = { ps1: "powershell -ExecutionPolicy Bypass -File", py: "python", js: "node", mjs: "node" }
      const runner = runners[ext] || ""
      try {
        const cmd = runner ? `${runner} "${arg}"` : `"${arg}"`
        const result = execSync(cmd, { encoding: "utf8", timeout: 300000, stdio: "pipe" })
        console.log("\n" + result + "\n")
      } catch (e) { console.log(red(`\n  ✗ Ошибка: ${e.message}\n`)) }
      return
    }
    case "/schedule": {
      if (!arg) { console.log(dim("\n  Использование: /schedule <скрипт> [daily|weekly|once] [время]\n")); return }
      const schedParts = arg.split(/\s+/)
      const schedScript = schedParts[0]
      const schedType = schedParts[1] || "daily"
      const schedTime = schedParts[2] || "09:00"
      const taskName = `Stella_${Date.now()}`
      try {
        execSync(`schtasks /create /tn "${taskName}" /tr "${schedScript}" /sc ${schedType} /st ${schedTime} /f`, { encoding: "utf8", timeout: 10000, stdio: "pipe" })
        console.log(green(`\n  ✓ Задача ${taskName} создана (${schedType} в ${schedTime})\n`))
      } catch (e) { console.log(red(`\n  ✗ Ошибка: ${e.message}\n`)) }
      return
    }
    case "/docker": {
      const dockerCmd = arg || "ps"
      try {
        let cmd = `docker ${dockerCmd}`
        if (dockerCmd === "ps") cmd = "docker ps"
        if (dockerCmd === "list") cmd = "docker ps -a"
        const result = execSync(cmd, { encoding: "utf8", timeout: 30000, stdio: "pipe" })
        console.log("\n" + result + "\n")
      } catch (e) { console.log(red(`\n  ✗ Docker: ${e.message}\n`)) }
      return
    }
    case "/pm2": {
      const pm2Cmd = arg || "list"
      try {
        const result = execSync(`pm2 ${pm2Cmd}`, { encoding: "utf8", timeout: 30000, stdio: "pipe" })
        console.log("\n" + result + "\n")
      } catch (e) { console.log(red(`\n  ✗ PM2: ${e.message}\n`)) }
      return
    }
    case "/npm": {
      const npmCmd = arg || "list"
      try {
        const pkgManager = fs.existsSync("pnpm-lock.yaml") ? "pnpm" : fs.existsSync("yarn.lock") ? "yarn" : "npm"
        const result = execSync(`${pkgManager} ${npmCmd}`, { encoding: "utf8", timeout: 120000, stdio: "pipe" })
        console.log("\n" + result + "\n")
      } catch (e) { console.log(red(`\n  ✗ Ошибка: ${e.message}\n`)) }
      return
    }
    case "/monitor": {
      const monType = arg || "cpu"
      try {
        let result = ""
        if (monType === "cpu") {
          result = execSync("wmic cpu get loadpercentage /value", { encoding: "utf8", stdio: "pipe" })
          const match = result.match(/LoadPercentage=(\d+)/)
          console.log(`\n  CPU: ${match ? match[1] : "?"}%\n`)
        } else if (monType === "mem") {
          result = execSync("wmic OS get FreePhysicalMemory,TotalVisibleMemorySize /value", { encoding: "utf8", stdio: "pipe" })
          console.log("\n" + result + "\n")
        } else if (monType === "disk") {
          result = execSync("wmic diskdrive get model,size,status", { encoding: "utf8", stdio: "pipe" })
          console.log("\n" + result + "\n")
        } else if (monType === "net") {
          result = execSync("netstat -e", { encoding: "utf8", stdio: "pipe" })
          console.log("\n" + result + "\n")
        } else {
          console.log(dim("\n  /monitor <cpu|mem|disk|net>\n"))
        }
      } catch (e) { console.log(red(`\n  ✗ Ошибка: ${e.message}\n`)) }
      return
    }
    case "/sys": {
      if (!arg) { console.log(dim("\n  Использование: /sys <любая команда>\n")); return }
      try {
        const result = execSync(arg, { encoding: "utf8", timeout: 300000, maxBuffer: 100 * 1024 * 1024, stdio: "pipe" })
        console.log("\n" + result + "\n")
      } catch (e) {
        console.log(red(`\n  ✗ Ошибка (код ${e.status}):\n`))
        if (e.stderr) console.log(e.stderr)
        if (e.stdout) console.log(e.stdout)
        console.log()
      }
      return
    }
    case "/sudo": {
      if (!arg) { console.log(dim("\n  Использование: /sudo <команда>\n")); return }
      try {
        execSync(`powershell -Command "Start-Process cmd -ArgumentList '/c ${arg.replace(/"/g, '\\"')}' -Verb RunAs -Wait"`, { encoding: "utf8", timeout: 300000, stdio: "pipe" })
        console.log(green(`\n  ✓ Команда выполнена от администратора\n`))
      } catch (e) { console.log(red(`\n  ✗ Ошибка: ${e.message}\n`)) }
      return
    }

    // ═══════════════════════════════════════════════════
    //  УМНЫЙ ДОМ
    // ═══════════════════════════════════════════════════
    case "/tv": {
      if (!arg) {
        console.log(box([
          violet("/tv discover") + dim(" — найти Sony TV в сети"),
          violet("/tv off IP") + dim(" — выключить TV"),
          violet("/tv on IP") + dim(" — включить TV"),
          violet("/tv info IP") + dim(" — информация о TV"),
          violet("/tv vol IP ±N") + dim(" — громкость"),
          violet("/tv ch IP N") + dim(" — канал"),
          violet("/tv hdmi IP N") + dim(" — переключить HDMI"),
          violet("/tv remote IP команда") + dim(" — пульт (up/down/left/right/ok/home/back)"),
          "",
          dim("Sony TV используют REST API. Включи в настройках TV:"),
          dim("Сеть → Другое → Режим.getSimpleName() → Включить"),
        ], { title: "Sony TV", color: cyan, padding: 2 }))
        console.log()
        return
      }
      const tvParts = arg.split(/\s+/)
      const tvAction = tvParts[0]

      if (tvAction === "discover") {
        console.log(cyan("\n  Сканирую сеть на Sony TV...\n"))
        await runTurn("Найди Sony BRAVIA TV в локальной сети используя SSDP M-SEARCH. Верни IP адреса найденных телевизоров.")
        return
      }

      if (tvParts.length < 2) { console.log(dim("\n  Укажи IP TV. Пример: /tv off 192.168.1.100\n")); return }
      const tvIp = tvParts[1]

      if (tvAction === "off" || tvAction === "poweroff") {
        console.log(cyan(`\n  Выключаю TV ${tvIp}...\n`))
        await runTurn(`Выключи Sony BRAVIA TV по IP ${tvIp}. Используй REST API метод setPowerStatus с параметром status:false на http://${tvIp}/sony/videoControl. Если нужен PSK, попроси пользователя.`)
        return
      }

      if (tvAction === "on" || tvAction === "poweron") {
        console.log(cyan(`\n  Включаю TV ${tvIp}...\n`))
        await runTurn(`Включи Sony BRAVIA TV по IP ${tvIp}. Используй REST API метод setPowerStatus с параметром status:true на http://${tvIp}/sony/videoControl. Если нужен PSK, попроси пользователя.`)
        return
      }

      if (tvAction === "info") {
        console.log(cyan(`\n  Получаю информацию о TV ${tvIp}...\n`))
        await runTurn(`Получи информацию о Sony BRAVIA TV по IP ${tvIp}. Используй REST API на http://${tvIp}/sony/videoControl: getPowerStatus, getCurrentExternalInputsStatus, getVolumeInformation.`)
        return
      }

      if (tvAction === "vol") {
        const volArg = tvParts[2] || "+1"
        console.log(cyan(`\n  Регулирую громкость ${tvIp}: ${volArg}\n`))
        await runTurn(`Установи громкость Sony TV по IP ${tvIp} на ${volArg}. Используй REST API метод setAudioVolume на http://${tvIp}/sony/videoControl.`)
        return
      }

      if (tvAction === "ch") {
        const ch = tvParts[2] || "1"
        console.log(cyan(`\n  Переключаю канал на ${tvIp}: ${ch}\n`))
        await runTurn(`Переключи канал на Sony TV по IP ${tvIp} на канал ${ch}. Используй REST API метод setChannelPosition на http://${tvIp}/sony/videoControl.`)
        return
      }

      if (tvAction === "hdmi") {
        const hdmi = tvParts[2] || "1"
        console.log(cyan(`\n  Переключаю HDMI ${tvIp}: порт ${hdmi}\n`))
        await runTurn(`Переключи Sony TV по IP ${tvIp} на HDMI ${hdmi}. Используй REST API метод setPlayContent с uri extInput:hdmi?port=${hdmi} на http://${tvIp}/sony/videoControl.`)
        return
      }

      // Remote control
      console.log(cyan(`\n  Команда пульта: ${tvAction} на ${tvIp}\n`))
      await runTurn(`Отправь команду пульта "${tvAction}" на Sony TV по IP ${tvIp}. Используй REST API на http://${tvIp}/sony/videoControl.`)
      return
    }
    case "/tv-off": {
      const ip = arg || ""
      if (!ip) { console.log(dim("\n  Использование: /tv-off <IP TV>\n")); return }
      console.log(cyan(`\n  Выключаю TV ${ip}...\n`))
      await runTurn(`Выключи Sony BRAVIA TV по IP ${ip}. Используй REST API метод setPowerStatus с параметром status:false на http://${ip}/sony/videoControl.`)
      return
    }
    case "/tv-on": {
      const ip = arg || ""
      if (!ip) { console.log(dim("\n  Использование: /tv-on <IP TV>\n")); return }
      console.log(cyan(`\n  Включаю TV ${ip}...\n`))
      await runTurn(`Включи Sony BRAVIA TV по IP ${ip}. Используй REST API метод setPowerStatus с параметром status:true на http://${ip}/sony/videoControl.`)
      return
    }
    case "/tv-info": {
      const ip = arg || ""
      if (!ip) { console.log(dim("\n  Использование: /tv-info <IP TV>\n")); return }
      console.log(cyan(`\n  Получаю информацию о TV ${ip}...\n`))
      await runTurn(`Получи информацию о Sony BRAVIA TV по IP ${ip}. Используй REST API: getPowerStatus, getCurrentExternalInputsStatus, getVolumeInformation на http://${ip}/sony/videoControl.`)
      return
    }
    case "/cec": {
      if (!arg) { console.log(dim("\n  Использование: /cec <on|off|standby> [устройство]\n")); return }
      const cecParts = arg.split(/\s+/)
      const cecCmd = cecParts[0]
      const cecDevice = parseInt(cecParts[1]) || 0
      console.log(cyan(`\n  HDMI-CEC: ${cecCmd} → устройство ${cecDevice}\n`))
      await runTurn(`Отправь HDMI-CEC команду "${cecCmd}" на устройство с адресом ${cecDevice} (0=TV, 1-14=устройства).`)
      return
    }
    case "/smart": {
      console.log(cyan("\n  Сканирую сеть на умные устройства...\n"))
      await runTurn("Просканируй локальную сеть на умные устройства (UPnP/SSDP). Найди все устройства и покажи их типы и IP.")
      return
    }
    case "/light": {
      if (!arg) { console.log(dim("\n  Использование: /light <hue|yeelight|tplink> IP <on|off|dim|color> [значение]\n")); return }
      const lightParts = arg.split(/\s+/)
      console.log(cyan(`\n  Управление лампой: ${lightParts.join(" ")}\n`))
      await runTurn(`Управление умной лампой: ${arg}. Используй соответствующий API.`)
      return
    }
    case "/cast": {
      if (!arg) { console.log(dim("\n  Использование: /cast <URL> [IP Chromecast]\n")); return }
      const castParts = arg.split(/\s+/)
      console.log(cyan(`\n  Трансляция на Chromecast: ${castParts[0]}\n`))
      await runTurn(`Транслируй ${castParts[0]} на Chromecast${castParts[1] ? ` с IP ${castParts[1]}` : ""}. Используй catt или аналог.`)
      return
    }
    case "/wol": {
      if (!arg) { console.log(dim("\n  Использование: /wol <MAC адрес>\n")); return }
      console.log(cyan(`\n  Wake-on-LAN: ${arg}\n`))
      await runTurn(`Включи устройство с MAC адресом ${arg} через Wake-on-LAN. Отправь magic packet на широковещательный адрес порт 9.`)
      return
    }

    case "/exit":
    case "/quit": {
      goodbye()
      return
    }

    // ═══════════════════════════════════════════════════
    //  ПРЕЗЕНТАЦИИ
    // ═══════════════════════════════════════════════════
    case "/presentation": {
      if (!arg) {
        console.log(dim("\n  Использование: /presentation <тема> [тема_оформления]\n"))
        console.log(dim("  Пример: /presentation \"Машинное обучение\" modern\n"))
        return
      }
      const parts = arg.split(/\s+/)
      const topic = parts[0]
      const theme = parts[1] || "modern"
      
      console.log()
      startSpinner("Создаю презентацию")
      
      try {
        const result = createPresentationFromTopic(topic, {
          theme,
          slidesCount: 8,
          author: "Stella Coder",
        })
        
        stopSpinner()
        console.log(box([
          green("✓ Презентация создана!"),
          "",
          dim("Тема: ") + white(topic),
          dim("Тема оформления: ") + white(result.theme),
          dim("Слайдов: ") + white(String(result.slidesCount)),
          "",
          dim("Путь: ") + cyan(result.outputDir),
          "",
          white("Откройте index.html в браузере для просмотра"),
        ], { title: "Презентация", color: green, padding: 2 }))
        console.log()
        
        // Open in browser
        const openBrowser = await question("  " + green("Открыть в браузере? (y/n) › "))
        if (openBrowser.trim().toLowerCase() === "y" || openBrowser.trim().toLowerCase() === "д") {
          try {
            const indexPath = result.outputDir + "/index.html"
            execSync(`start "" "${indexPath}"`, { shell: "cmd.exe", stdio: "pipe" })
            console.log(green("  ✓ Презентация открыта в браузере\n"))
          } catch (e) {
            console.log(yellow("  ⚠ Не удалось открыть автоматически: ") + String(e?.message || e).slice(0, 100) + "\n")
          }
        }
      } catch (e) {
        stopSpinner()
        console.log(red("  ✗ Ошибка: ") + String(e?.message || e).slice(0, 200) + "\n")
      }
      return
    }

    case "/presentation-theme": {
      console.log(box([
        ...AVAILABLE_THEMES.map(t =>
          violet(t.id) + dim(" — ") + white(t.name) + dim(` (${t.colors.primary})`)
        ),
      ], { title: "Доступные темы презентаций", padding: 2 }))
      console.log()
      return
    }

    case "/presentation-custom": {
      console.log(dim("\n  Создание кастомной презентации"))
      console.log(dim("  Введите данные для каждого слайда:\n"))
      
      const title = await question("  " + green("Заголовок презентации › "))
      if (!title.trim()) {
        console.log(red("  Заголовок не может быть пустым\n"))
        return
      }
      
      const author = await question("  " + green("Автор › "))
      const themeChoice = await question("  " + green("Тема (modern/elegant/creative/minimal/tech) › "))
      const theme = themeChoice.trim() || "modern"
      
      const slides = []
      let slideNum = 1
      
      while (true) {
        console.log(dim(`\n  Слайд ${slideNum}:`))
        const slideTitle = await question("  " + green("Заголовок слайда (пусто для завершения) › "))
        if (!slideTitle.trim()) break
        
        const slideType = await question("  " + green("Тип (content/twoColumn/quote) › "))
        const slideContent = await question("  " + green("Содержимое (через запятую) › "))
        
        slides.push({
          type: slideType.trim() || "content",
          title: slideTitle.trim(),
          items: slideContent.split(",").map(i => i.trim()).filter(i => i),
        })
        
        slideNum++
      }
      
      if (slides.length === 0) {
        console.log(red("  Не добавлено ни одного слайда\n"))
        return
      }
      
      console.log()
      startSpinner("Создаю кастомную презентацию")
      
      try {
        const result = generatePresentation({
          title: title.trim(),
          author: author.trim(),
          slides,
          theme,
          outputDir: `presentation-${title.trim().toLowerCase().replace(/\s+/g, '-')}`,
        })
        
        stopSpinner()
        console.log(box([
          green("✓ Кастомная презентация создана!"),
          "",
          dim("Тема: ") + white(title.trim()),
          dim("Автор: ") + white(author.trim() || "Не указан"),
          dim("Тема оформления: ") + white(result.theme),
          dim("Слайдов: ") + white(String(result.slidesCount)),
          "",
          dim("Путь: ") + cyan(result.outputDir),
        ], { title: "Кастомная презентация", color: green, padding: 2 }))
        console.log()
      } catch (e) {
        stopSpinner()
        console.log(red("  ✗ Ошибка: ") + String(e?.message || e).slice(0, 200) + "\n")
      }
      return
    }

    case "/presentation-list": {
      const outputDirs = fs.readdirSync(process.cwd()).filter(f => 
        f.startsWith("presentation-") && fs.statSync(f).isDirectory()
      )
      
      if (outputDirs.length === 0) {
        console.log(dim("\n  Нет созданных презентаций\n"))
      } else {
        console.log(box([
          ...outputDirs.map((d, i) =>
            violet(String(i + 1)) + dim(" — ") + white(d)
          ),
        ], { title: "Ваши презентации", padding: 2 }))
        console.log()
      }
      return
    }

    case "/presentation-export": {
      if (!arg) {
        console.log(dim("\n  Использование: /presentation-export <путь_к_презентации>\n"))
        console.log(dim("  Пример: /presentation-export presentation-моя-презентация\n"))
        return
      }
      
      const presentationDir = arg.trim()
      if (!fs.existsSync(presentationDir)) {
        console.log(red(`  ✗ Директория не найдена: ${presentationDir}\n`))
        return
      }
      
      console.log()
      startSpinner("Создаю версию для печати")
      
      try {
        const result = exportToPDF(presentationDir)
        stopSpinner()
        
        console.log(box([
          green("✓ Версия для печати создана!"),
          "",
          dim("Файл: ") + cyan(result.printPath),
          "",
          white("Откройте print.html в браузере"),
          white("Используйте Ctrl+P для экспорта в PDF"),
        ], { title: "Экспорт в PDF", color: green, padding: 2 }))
        console.log()
        
        // Open print version
        const openPrint = await question("  " + green("Открыть версию для печати? (y/n) › "))
        if (openPrint.trim().toLowerCase() === "y" || openPrint.trim().toLowerCase() === "д") {
          try {
            execSync(`start "" "${result.printPath}"`, { shell: "cmd.exe", stdio: "pipe" })
            console.log(green("  ✓ Версия для печати открыта\n"))
          } catch (e) {
            console.log(yellow("  ⚠ Не удалось открыть автоматически: ") + String(e?.message || e).slice(0, 100) + "\n")
          }
        }
      } catch (e) {
        stopSpinner()
        console.log(red("  ✗ Ошибка: ") + String(e?.message || e).slice(0, 200) + "\n")
      }
      return
    }

    // ═══════════════════════════════════════════════════
    //  CODING BRAIN
    // ═══════════════════════════════════════════════════
    case "/brain": {
      console.log()
      startSpinner("Анализирую проект")
      const diag = diagnoseProject(process.cwd())
      stopSpinner()

      console.log(box([
        dim("Репозиторий:  ") + white(diag.repo),
        dim("SPEC:         ") + (diag.spec !== "not found" ? green(diag.spec) : yellow("не найден")),
        dim("Тесты:        ") + (diag.test !== "not detected" ? green(diag.test) : yellow("не обнаружены")),
        dim("Линтер:       ") + (diag.linter !== "not detected" ? green(diag.linter) : yellow("не обнаружен")),
        dim("Форматер:     ") + (diag.formatter !== "not detected" ? green(diag.formatter) : yellow("не обнаружен")),
        dim("Типы:         ") + (diag.typeChecker !== "not detected" ? green(diag.typeChecker) : yellow("не обнаружен")),
        "",
        dim("Git ветка:    ") + violet(diag.git.branch),
        dim("Git статус:   ") + (diag.git.clean ? green("чисто") : yellow(`${diag.git.files} файлов`)),
        diag.git.ahead ? dim("Впереди:      ") + cyan(String(diag.git.ahead)) : "",
        diag.git.behind ? dim("Позади:       ") + cyan(String(diag.git.behind)) : "",
      ], { title: "🧠 Coding Brain", color: violet, padding: 2 }))
      console.log()
      return
    }

    case "/brain-map": {
      console.log()
      startSpinner("Строю карту репозитория")
      const map = buildRepoMap(process.cwd())
      stopSpinner()

      console.log(box([
        dim("Файлов: ") + white(String(map.fileCount)),
        dim("Размер: ") + white(map.totalSize),
        "",
        dim("Типы файлов:"),
        ...Object.entries(map.fileTypes)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 15)
          .map(([ext, count]) => `  ${violet(ext)} ${dim("—")} ${white(String(count))}`),
      ], { title: "Карта репозитория", color: cyan, padding: 2 }))
      console.log()

      const showTree = await question("  " + green("Показать дерево файлов? (y/n) › "))
      if (showTree.trim().toLowerCase() === "y") {
        console.log()
        map.tree.slice(0, 100).forEach(l => console.log(dim("  ") + l))
        if (map.tree.length > 100) console.log(dim(`  ... и ещё ${map.tree.length - 100} файлов`))
        console.log()
      }
      return
    }

    case "/brain-compress": {
      console.log()
      const msgCount = state.messages.length
      const chars = JSON.stringify(state.messages).length
      console.log(dim(`  Контекст: ${msgCount} сообщений, ${Math.round(chars / 1000)}K символов`))

      if (chars < COMPRESS_THRESHOLD) {
        console.log(green("  Контекст ещё не нуждается в сжатии\n"))
        return
      }

      const confirm = await question("  " + yellow(`Сжать контекст? (${Math.round(chars / 1000)}K → ~50K) (y/n) › `))
      if (confirm.trim().toLowerCase() !== "y") {
        console.log(dim("  Отмена\n"))
        return
      }

      startSpinner("Сжимаю контекст")
      state.messages = await compressContext(state.messages, getModel(state.model))
      stopSpinner()

      const newChars = JSON.stringify(state.messages).length
      console.log(green(`  ✓ Контекст сжат: ${Math.round(chars / 1000)}K → ${Math.round(newChars / 1000)}K\n`))
      return
    }

    case "/spec": {
      const spec = loadSpec(process.cwd())
      if (spec.exists) {
        console.log(box([
          dim("Файл: ") + white(spec.file),
          "",
          spec.content.slice(0, 2000),
          spec.content.length > 2000 ? dim(`\n... [показано ${2000} из ${spec.content.length} символов]`) : "",
        ], { title: "SPEC", color: cyan, padding: 2 }))
      } else {
        console.log(yellow("\n  SPEC.md не найден в проекте"))
        const createSpec = await question("  " + green("Создать SPEC.md? (y/n) › "))
        if (createSpec.trim().toLowerCase() === "y") {
          const name = await question("  " + green("Название проекта › "))
          const desc = await question("  " + green("Описание › "))
          const content = generateSpecTemplate(name, desc)
          fs.writeFileSync(path.join(process.cwd(), "SPEC.md"), content)
          console.log(green("  ✓ SPEC.md создан\n"))
        }
      }
      return
    }

    case "/tdd": {
      if (!arg) {
        console.log(dim("\n  Использование: /tdd <путь к файлу>\n"))
        return
      }

      const filePath = arg.trim()
      if (!fs.existsSync(filePath)) {
        console.log(red(`  ✗ Файл не найден: ${filePath}\n`))
        return
      }

      console.log()
      const fileContent = fs.readFileSync(filePath, "utf8")
      const spec = loadSpec(process.cwd())
      const testPrompt = generateTestPrompt(filePath, fileContent, spec.content)

      startSpinner("Генерирую тесты")
      try {
        const { text } = await generateText({
          model: getModel(state.model),
          messages: [{ role: "user", content: testPrompt.prompt }],
        })
        stopSpinner()

        const testFilePath = path.join(process.cwd(), testPrompt.testFile)
        fs.writeFileSync(testFilePath, text.replace(/```[\s\S]*?\n/g, "").replace(/```/g, "").trim())

        console.log(green(`  ✓ Тесты созданы: ${testPrompt.testFile}`))

        // Run tests
        const framework = detectTestFramework(process.cwd())
        if (framework.detected) {
          startSpinner("Запускаю тесты")
          const result = runTests(process.cwd(), framework)
          stopSpinner()
          if (result.success) {
            console.log(green("  ✓ Тесты пройдены!"))
          } else {
            console.log(red("  ✗ Тесты упали:"))
            console.log(dim(result.output?.slice(0, 500) || ""))
          }
        }
      } catch (e) {
        stopSpinner()
        console.log(red("  ✗ Ошибка: ") + String(e?.message || e).slice(0, 200) + "\n")
      }
      console.log()
      return
    }

    case "/lint-auto": {
      console.log()
      const linter = detectLinter(process.cwd())
      if (!linter.detected) {
        console.log(yellow("  Линтер не обнаружен в проекте\n"))
        return
      }

      startSpinner(`Запускаю ${linter.name}`)
      const result = runLinter(process.cwd(), linter)
      stopSpinner()

      if (result.success && !result.hasErrors) {
        console.log(green(`  ✓ ${linter.name}: ошибок нет`))
      } else {
        console.log(yellow(`  ⚠ ${linter.name}: найдены проблемы`))
        console.log(dim(result.output?.slice(0, 1000) || ""))

        const fix = await question("  " + green("Автоматически исправить? (y/n) › "))
        if (fix.trim().toLowerCase() === "y") {
          startSpinner("Исправляю")
          try {
            execSync(`${linter.cmd} --fix .`, { cwd: process.cwd(), encoding: "utf8", timeout: 60000 })
            stopSpinner()
            console.log(green("  ✓ Исправлено\n"))
          } catch (e) {
            stopSpinner()
            console.log(red("  ✗ Ошибка исправления: ") + String(e?.message || e).slice(0, 200) + "\n")
          }
        }
      }
      return
    }

    case "/format-auto": {
      console.log()
      const formatter = detectFormatter(process.cwd())
      if (!formatter.detected) {
        console.log(yellow("  Форматер не обнаружен в проекте\n"))
        return
      }

      startSpinner(`Форматирую (${formatter.name})`)
      const result = runFormatter(process.cwd(), formatter)
      stopSpinner()

      if (result.success) {
        console.log(green(`  ✓ ${formatter.name}: код отформатирован`))
      } else {
        console.log(red(`  ✗ ${formatter.name}: `) + String(result.error || "").slice(0, 200))
      }
      console.log()
      return
    }

    case "/typecheck-auto": {
      console.log()
      const checker = detectTypeChecker(process.cwd())
      if (!checker.detected) {
        console.log(yellow("  Проверщик типов не обнаружен\n"))
        return
      }

      startSpinner(`Проверяю типы (${checker.name})`)
      const result = runTypeChecker(process.cwd(), checker)
      stopSpinner()

      if (result.success && !result.hasErrors) {
        console.log(green(`  ✓ ${checker.name}: ошибок нет`))
      } else {
        console.log(yellow(`  ⚠ ${checker.name}: найдены ошибки`))
        console.log(dim(result.output?.slice(0, 1000) || ""))
      }
      console.log()
      return
    }

    case "/test-auto": {
      console.log()
      const framework = detectTestFramework(process.cwd())
      if (!framework.detected) {
        console.log(yellow("  Фреймворк тестов не обнаружен\n"))
        return
      }

      startSpinner(`Запускаю тесты (${framework.framework})`)
      const result = runTests(process.cwd(), framework)
      stopSpinner()

      if (result.success) {
        console.log(green("  ✓ Тесты пройдены!"))
        console.log(dim(result.output?.slice(-500) || ""))
      } else {
        console.log(red("  ✗ Тесты упали:"))
        console.log(dim(result.output?.slice(0, 1000) || ""))
      }
      console.log()
      return
    }

    case "/fix-all": {
      console.log()
      console.log(dim("  Полный цикл исправления: линтер → форматер → типы → тесты\n"))

      // 1. Linter
      const linter = detectLinter(process.cwd())
      if (linter.detected) {
        startSpinner(`Линтер (${linter.name})`)
        try { execSync(`${linter.cmd} --fix .`, { cwd: process.cwd(), encoding: "utf8", timeout: 60000 }) } catch {}
        stopSpinner()
        console.log(green(`  ✓ ${linter.name} выполнен`))
      }

      // 2. Formatter
      const formatter = detectFormatter(process.cwd())
      if (formatter.detected) {
        startSpinner(`Форматер (${formatter.name})`)
        runFormatter(process.cwd(), formatter)
        stopSpinner()
        console.log(green(`  ✓ ${formatter.name} выполнен`))
      }

      // 3. Type checker
      const checker = detectTypeChecker(process.cwd())
      if (checker.detected) {
        startSpinner(`Типы (${checker.name})`)
        const typeResult = runTypeChecker(process.cwd(), checker)
        stopSpinner()
        if (typeResult.success) {
          console.log(green(`  ✓ ${checker.name}: ошибок нет`))
        } else {
          console.log(yellow(`  ⚠ ${checker.name}: есть ошибки`))
        }
      }

      // 4. Tests
      const framework = detectTestFramework(process.cwd())
      if (framework.detected) {
        startSpinner(`Тесты (${framework.framework})`)
        const testResult = runTests(process.cwd(), framework)
        stopSpinner()
        if (testResult.success) {
          console.log(green("  ✓ Тесты пройдены"))
        } else {
          console.log(red("  ✗ Тесты упали"))
        }
      }

      console.log(green("\n  ✓ Полный цикл завершён\n"))
      return
    }

    case "/git-eco": {
      console.log()
      startSpinner("Собираю Git-информацию")
      const git = gitStatus(process.cwd())
      const branches = gitBranches(process.cwd())
      const log = gitLog(process.cwd(), 10)
      stopSpinner()

      console.log(box([
        dim("Ветка:     ") + violet(git.branch),
        dim("Статус:    ") + (git.clean ? green("чисто") : yellow(`${git.files.length} изменений`)),
        git.ahead ? dim("Впереди:   ") + cyan(String(git.ahead)) : "",
        git.behind ? dim("Позади:    ") + cyan(String(git.behind)) : "",
        git.stashCount ? dim("Stash:     ") + cyan(String(git.stashCount)) : "",
        "",
        dim("Ветки:"),
        ...branches.slice(0, 10).map(b => `  ${b.includes("*") ? green(b) : dim(b)}`),
      ], { title: "Git Экосистема", color: cyan, padding: 2 }))

      if (log) {
        console.log(dim("\nПоследние коммиты:"))
        log.split("\n").slice(0, 5).forEach(l => console.log(dim("  ") + l))
      }
      console.log()
      return
    }

    case "/git-pr": {
      console.log()
      const title = await question("  " + green("Название PR › "))
      if (!title.trim()) { console.log(red("  Название не может быть пустым\n")); return }
      const body = await question("  " + green("Описание (необязательно) › "))
      const base = await question("  " + green("Базовая ветка (main) › "))

      startSpinner("Создаю Pull Request")
      const result = gitCreatePR(process.cwd(), title.trim(), body || title.trim(), base.trim() || "main")
      stopSpinner()

      if (result.success) {
        console.log(green(`  ✓ PR создан: ${result.url}`))
      } else {
        console.log(red("  ✗ Ошибка: ") + String(result.error || "").slice(0, 200))
      }
      console.log()
      return
    }

    case "/git-merge-auto": {
      if (!arg) {
        console.log(dim("\n  Использование: /git-merge-auto <ветка>\n"))
        return
      }

      const branch = arg.trim()
      console.log()
      startSpinner(`Мержу ${branch}`)
      const result = gitMerge(process.cwd(), branch)
      stopSpinner()

      if (result.success) {
        console.log(green(`  ✓ ${branch} успешно смержена`))
      } else if (result.conflict) {
        console.log(yellow(`  ⚠ Конфликт в ${result.files.length} файлах:`))
        result.files.forEach(f => console.log(dim(`    - ${f}`)))

        const resolve = await question("  " + green("Разрешить конфликты (theirs)? (y/n) › "))
        if (resolve.trim().toLowerCase() === "y") {
          startSpinner("Разрешаю конфликты")
          const resolved = gitResolveConflicts(process.cwd(), "theirs")
          stopSpinner()
          if (resolved.success) {
            console.log(green(`  ✓ Конфликты разрешены в ${resolved.resolved?.length || 0} файлах`))
          } else {
            console.log(red("  ✗ Ошибка: ") + String(resolved.error || "").slice(0, 200))
          }
        }
      } else {
        console.log(red("  ✗ Ошибка: ") + String(result.error || "").slice(0, 200))
      }
      console.log()
      return
    }

    // ═══════════════════════════════════════════════════
    //  TELEGRAM BOT
    // ═══════════════════════════════════════════════════
    case "/tg": {
      console.log()
      startSpinner("Запускаю Telegram бота")
      const botResult = await startBot()
      stopSpinner()

      if (botResult) {
        const status = getBotStatus()
        console.log(box([
          green("✓ Telegram бот запущен!"),
          "",
          dim("Бот: ") + cyan("@" + "stella_coder_bot"),
          dim("Статус: ") + green("онлайн"),
          "",
          white("Откройте Telegram и найдите @stella_coder_bot"),
          white("Нажмите /start для авторизации"),
        ], { title: "Telegram Bot", color: blue, padding: 2 }))
      } else {
        console.log(red("  ✗ Не удалось запустить бота\n"))
      }
      console.log()
      return
    }

    case "/tg-stop": {
      console.log()
      await stopBot()
      console.log(green("  ✓ Telegram бот остановлен\n"))
      return
    }

    case "/tg-notify": {
      if (!arg) {
        console.log(dim("\n  Использование: /tg-notify <сообщение>\n"))
        return
      }
      console.log()
      startSpinner("Отправляю уведомление")
      await notifyAll(arg.trim())
      stopSpinner()
      console.log(green("  ✓ Уведомление отправлено всем пользователям\n"))
      return
    }

    case "/tg-sessions": {
      console.log()
      const status = getBotStatus()
      const sessions = status.sessions.sessions

      if (sessions.length === 0) {
        console.log(dim("  Нет Telegram сессий\n"))
      } else {
        console.log(box([
          ...sessions.map((s, i) => {
            const isActive = s.id === status.sessions.activeSession
            const msgs = s.stats.userMessages + s.stats.assistantMessages
            return `${isActive ? green("●") : dim("○")} ${white(s.name)} ${dim(`(${s.model}, ${msgs} msgs)`)}`
          }),
        ], { title: "Telegram Sessions", color: blue, padding: 2 }))
      }
      console.log()

      // Show auth info
      const authUsers = Object.keys(status.auth.users).length
      console.log(dim(`  Авторизовано пользователей: ${authUsers}`))
      console.log()
      return
    }

    case "/tg-verify": {
      if (!arg) {
        // Show pending codes
        const pending = getPendingCodes()
        const pendingList = Object.entries(pending)

        if (pendingList.length === 0) {
          console.log(dim("\n  Нет ожидающих кодов. Пользователь должен нажать /start в Telegram.\n"))
        } else {
          console.log(box([
            ...pendingList.map(([userId, p]) =>
              violet(p.code) + dim(" — ") + white(p.username) + dim(` (ID: ${userId})`)
            ),
          ], { title: "Ожидающие коды", color: blue, padding: 2 }))
          console.log()
          console.log(dim("  Введите: /tg-verify <код>"))
        }
        console.log()
        return
      }

      const code = arg.trim()
      console.log()
      startSpinner("Проверяю код")
      const result = verifyAuthCode(code)
      stopSpinner()

      if (result.success) {
        console.log(box([
          green("✓ Telegram аккаунт привязан!"),
          "",
          dim("Пользователь: ") + white(result.username),
          dim("Telegram ID: ") + white(String(result.userId)),
          "",
          white("Теперь вы можете управлять компьютером через Telegram!"),
        ], { title: "Привязка", color: green, padding: 2 }))

        // Send confirmation to Telegram
        await notifyUser(result.chatId, "✅ <b>Аккаунт привязан!</b>\n\nТеперь вы можете управлять компьютером через Telegram.")
      } else {
        console.log(red(`  ✗ ${result.error}\n`))
      }
      console.log()
      return
    }

    case "/tg-code": {
      console.log()
      startSpinner("Генерирую код")
      const code = generateAdminCode()
      stopSpinner()

      console.log(box([
        green("✓ Код сгенерирован!"),
        "",
        dim("Ваш код: ") + bold(violet(code)),
        "",
        white("Дайте этот код покупателю."),
        white("Покупатель вводит его в Telegram боте."),
        "",
        dim("Код действителен до использования."),
        dim("Для нового кода: /tg-code"),
      ], { title: "Код для продажи", color: green, padding: 2 }))
      console.log()
      return
    }

    case "/tg-users": {
      console.log()
      const users = listAuthorizedUsers()

      if (users.length === 0) {
        console.log(dim("\n  Нет подключённых пользователей\n"))
      } else {
        console.log(box([
          ...users.map(u =>
            violet(u.firstName || u.username) + dim(` (ID: ${u.id})`) +
            dim("\n    Подключён: ") + white(u.authenticatedAt)
          ),
        ], { title: "Подключённые пользователи", color: blue, padding: 2 }))
      }
      console.log()
      return
    }

    // ═══════════════════════════════════════════════════
    //  AUTONOMOUS AGENT
    // ═══════════════════════════════════════════════════
    case "/auto": {
      if (!arg) {
        console.log(dim("\n  Использование: /auto <цель>\n"))
        console.log(dim("  Пример: /auto создай приложение и заработай $10\n"))
        console.log(dim("  Агент будет работать автономно пока не выполнит цель.\n"))
        return
      }

      const goal = arg.trim()
      const agent = new AutonomousAgent()

      console.log()
      console.log(box([
        violet("🤖 AUTONOMOUS AGENT"),
        "",
        white("Цель: ") + cyan(goal),
        "",
        dim("Агент создаст план и начнёт автономное выполнение."),
        dim("Каждый шаг будет выполняться автоматически."),
        dim("Используй /auto-stop для остановки."),
        dim("Используй /auto-status для проверки прогресса."),
      ], { color: violet, padding: 2 }))
      console.log()

      const confirm = await question("  " + green("Начать автономное выполнение? (y/n) › "))
      if (confirm.trim().toLowerCase() !== "y" && confirm.trim().toLowerCase() !== "д") {
        console.log(dim("  Отменено\n"))
        return
      }

      console.log()
      startSpinner("Составляю план выполнения")
      const plan = agent.planGoal(goal)
      stopSpinner()

      console.log(box([
        green("✓ План создан!"),
        "",
        ...plan.steps.map((s, i) => dim(`  ${i + 1}. `) + white(s.name)),
        "",
        dim(`Всего шагов: ${plan.steps.length}`),
      ], { title: "План", color: green, padding: 2 }))
      console.log()

      const apiCall = async (prompt) => {
        const model = getModel(state.model)
        const { text } = await generateText({
          model,
          messages: [{ role: "user", content: prompt }],
          maxTokens: 16000,
        })
        return text
      }

      console.log(dim("  Запускаю автономный режим...\n"))

      agent.state.running = true
      agent.state.startedAt = new Date().toISOString()
      agent.state.goal = goal
      agent.save()

      let stepCount = 0
      const runAuto = async () => {
        while (agent.state.running) {
          const result = await agent.runIteration(apiCall, (msg) => {
            if (msg === "ALL_DONE") {
              console.log(green("\n  ✅ ВСЕ ЗАДАЧИ ВЫПОЛНЕНЫ!\n"))
              agent.generateDashboard()
              console.log(dim("  Dashboard: ~/.stella/autonomous/dashboard.html\n"))
              return
            }
            console.log(dim("  ") + violet("→") + " " + white(msg))
          })

          if (!result) {
            agent.state.running = false
            agent.save()
            console.log(green("\n  ✅ Все планы выполнены!\n"))
            agent.generateDashboard()
            console.log(dim("  Dashboard: ~/.stella/autonomous/dashboard.html\n"))
            break
          }

          stepCount++
          if (stepCount % 5 === 0) {
            console.log(dim(`  [${stepCount} шагов выполнено]`))
          }

          await new Promise(r => setTimeout(r, 1000))
        }
      }

      runAuto().catch(err => {
        console.log(red(`\n  ✗ Ошибка: ${err.message}\n`))
        agent.state.running = false
        agent.save()
      })

      return
    }

    case "/auto-stop": {
      console.log()
      const agent = new AutonomousAgent()
      if (!agent.state.running) {
        console.log(dim("  Агент не запущен\n"))
        return
      }
      agent.stop()
      console.log(green("  ✓ Автономный агент остановлен\n"))
      console.log(dim(`  Выполнено шагов: ${agent.state.iterations}`))
      console.log(dim(`  Создано файлов: ${agent.memory.projects.length}`))
      console.log()
      return
    }

    case "/auto-status": {
      console.log()
      const agent = new AutonomousAgent()
      const status = agent.getStatus()

      if (!status.running && !status.currentPlan) {
        console.log(dim("  Агент не запущен. Используй /auto <цель> для запуска.\n"))
        return
      }

      const items = [
        dim("Статус:     ") + (status.running ? green("● RUNNINg") : red("○ STOPPED")),
        dim("Цель:       ") + white(status.goal || "Нет"),
        dim("Итераций:   ") + cyan(String(status.iterations)),
        dim("Начато:     ") + white(status.startedAt ? new Date(status.startedAt).toLocaleString() : "—"),
        "",
        dim("Планов выполнено: ") + green(String(status.completedPlans)),
        dim("Планов.failed:    ") + red(String(status.failedPlans)),
        dim("Файлов создано:   ") + cyan(String(status.totalFiles)),
        dim("Заработано:       ") + green("$" + status.totalEarnings.toFixed(2)),
        dim("Аккаунтов:        ") + cyan(String(status.accounts)),
      ]

      if (status.currentPlan) {
        items.push("", violet("Текущий план: ") + white(status.currentPlan.goal))
        items.push(dim("Прогресс:"))
        for (const step of status.currentPlan.steps) {
          const icon = step.status === "completed" ? green("✓") : step.status === "running" ? yellow("●") : step.status === "failed" ? red("✗") : dim("○")
          items.push(`  ${icon} ${step.name} ${dim(`(${step.done}/${step.total})`)}`)
        }
      }

      console.log(box(items, { title: "🤖 Autonomous Agent Status", color: violet, padding: 2 }))
      console.log()
      return
    }

    case "/auto-dashboard": {
      console.log()
      const agent = new AutonomousAgent()
      startSpinner("Создаю dashboard")
      const path = agent.generateDashboard()
      stopSpinner()
      console.log(green(`  ✓ Dashboard создан: ${path}`))
      console.log(dim("  Откройте в браузере для просмотра результатов\n"))

      const openIt = await question("  " + green("Открыть dashboard? (y/n) › "))
      if (openIt.trim().toLowerCase() === "y" || openIt.trim().toLowerCase() === "д") {
        try {
          execSync(`start "" "${path}"`, { shell: "cmd.exe", stdio: "pipe" })
        } catch (e) {
          console.log(yellow("  ⚠ Не удалось открыть автоматически\n"))
        }
      }
      console.log()
      return
    }

    case "/auto-history": {
      console.log()
      const agent = new AutonomousAgent()
      const allPlans = agent.tasks.queue

      if (allPlans.length === 0) {
        console.log(dim("  Нет истории. Используй /auto <цель> для запуска.\n"))
        return
      }

      console.log(box([
        ...allPlans.map(p => {
          const icon = p.status === "completed" ? green("✓") : p.status === "failed" ? red("✗") : yellow("●")
          return `${icon} ${white(p.goal)} ${dim(`(${p.status})`)}`
        }),
      ], { title: "История автономных задач", color: violet, padding: 2 }))
      console.log()

      // Show memory stats
      console.log(dim(`  Всего проектов: ${agent.memory.projects.length}`))
      console.log(dim(`  Аккаунтов: ${agent.memory.accounts.length}`))
      console.log(dim(`  Уроков: ${agent.memory.lessons.length}`))
      console.log()
      return
    }

    default:
      console.log(dim(`\n  Неизвестная команда: ${cmd}. Смотри /help\n`))
  }
}

function safeExec(cmd) {
  try {
    return execSync(cmd, { encoding: "utf8" }).trim()
  } catch {
    return "не найден"
  }
}

// ---------- /plan: Autonomous multi-step execution ----------
async function runPlan(taskDescription) {
  console.log()
  console.log(box([
    violet("Автономный план выполнения"),
    "",
    white("Задача: ") + dim(taskDescription),
    "",
    dim("ИИ составит план, вы подтвердите, затем автономное выполнение."),
  ], { color: purple, padding: 2 }))
  console.log()

  startSpinner("Составляю план")
  const planPrompt = `Составь пошаговый план для следующей задачи. Верни ТОЛЬКО JSON массив объектов { "id": N, "action": "описание действия", "files": ["список файлов"] } без markdown и пояснений.

Задача: ${taskDescription}

Рабочая директория: ${process.cwd()}`

  let plan
  try {
    const { text } = await generateText({
      model: getModel(state.model),
      messages: [{ role: "user", content: planPrompt }],
    })
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) { stopSpinner(); console.log(red("  ✗ Не удалось распознать план\n")); return }
    plan = JSON.parse(jsonMatch[0])
    stopSpinner()
  } catch (e) {
    stopSpinner()
    console.log(red("  ✗ Ошибка генерации плана: ") + String(e?.message || e).slice(0, 200) + "\n")
    return
  }

  console.log(box([
    ...plan.map((s, i) => violet(`[${i + 1}]`) + " " + white(s.action)),
    "",
    dim("Подтвердите выполнение плана"),
  ], { title: "План", color: purple, padding: 2 }))

  const confirm = await question("\n  " + violet("Выполнить план? (y/n) › "))
  if (confirm.trim().toLowerCase() !== "y" && confirm.trim().toLowerCase() !== "д") {
    console.log(dim("  Отмена\n"))
    return
  }

  for (let i = 0; i < plan.length; i++) {
    const step = plan[i]
    console.log()
    console.log(purple(`  ▶ Шаг ${i + 1}/${plan.length}: `) + bold(white(step.action)))

    await runTurn(step.action)

    console.log(dim(`  ✓ Шаг ${i + 1} выполнен`))
  }

  console.log()
  console.log(green("  ✓ Все шаги плана выполнены!\n"))
}

// ---------- /commit: AI-generated git commits ----------
async function runCommit(customMessage) {
  console.log()
  const status = safeExec("git status --porcelain")
  if (!status) { console.log(dim("  Нет изменений для коммита\n")); return }

  const diff = safeExec("git diff --stat")
  console.log(box([
    dim("Изменения:"),
    dim(diff || status),
  ], { title: "Git Status", color: purple, padding: 2 }))

  let commitMessage = customMessage
  if (!commitMessage) {
    startSpinner("Генерирую сообщение коммита")
    const commitPrompt = `Проанализируй эти изменения в git и создай краткое сообщение коммита (50-72 символа). Верни ТОЛЬКО текст сообщения без кавычек и markdown.

Изменения:
${status}

Diff:
${diff}`

    try {
      const { text } = await generateText({
        model: getModel(state.model),
        messages: [{ role: "user", content: commitPrompt }],
      })
      commitMessage = text.trim().replace(/^["']|["']$/g, "").split("\n")[0].slice(0, 72)
      stopSpinner()
    } catch (e) {
      stopSpinner()
      console.log(red("  ✗ Ошибка: ") + String(e?.message || e).slice(0, 200) + "\n")
      return
    }
  }

  console.log()
  console.log(dim("  Сообщение: ") + white(commitMessage))
  const confirm = await question("\n  " + violet("Сделать коммит? (y/n) › "))
  if (confirm.trim().toLowerCase() !== "y" && confirm.trim().toLowerCase() !== "д") {
    console.log(dim("  Отмена\n"))
    return
  }

  const addResult = safeExec("git add -A")
  const commitResult = safeExec(`git commit -m "${commitMessage}"`)
  console.log(green("  ✓ ") + dim(commitResult.split("\n")[0]))
  console.log()
}

// ---------- /ollama: Local LLM integration ----------
const OLLAMA_BASE = "http://localhost:11434"
let ollamaModels = []

async function handleOllama(arg) {
  console.log()

  if (arg === "list" || arg === "ls" || arg === "список") {
    startSpinner("Подключаюсь к Ollama")
    try {
      const res = await fetch(`${OLLAMA_BASE}/api/tags`, { signal: AbortSignal.timeout(3000) })
      stopSpinner()
      if (!res.ok) { console.log(red("  ✗ Ollama недоступен. Запустите: ollama serve\n")); return }
      const data = await res.json()
      ollamaModels = data.models || []
      if (ollamaModels.length === 0) {
        console.log(dim("  Модели не найдены. Установите: ollama pull llama3.2\n"))
        return
      }
      console.log(box(ollamaModels.map((m, i) =>
        violet(`[${i + 1}]`) + " " + white(m.name) + dim(` (${(m.size / 1e9).toFixed(1)}GB)`)
      ), { title: "Локальные модели (Ollama)", color: purple, padding: 2 }))
      console.log()
      console.log(dim("  Используйте: /ollama run <номер> для запуска модели"))
      console.log()
    } catch {
      stopSpinner()
      console.log(red("  ✗ Ollama не запущен. Запустите: ollama serve\n"))
    }
    return
  }

  if (arg === "run" || arg === "запуск") {
    const numArg = await question("  " + violet("Номер модели › "))
    const idx = Number.parseInt(numArg) - 1
    if (!ollamaModels[idx]) { console.log(dim("  Неверный номер\n")); return }

    const modelName = ollamaModels[idx].name
    console.log(green(`  ✓ Модель: ${modelName} (Ollama local)`))
    console.log(dim("  Теперь все запросы будут идти через локальную модель"))
    console.log(dim("  Для возврата к облачной: /model\n"))

    state.model = `ollama:${modelName}`
    return
  }

  console.log(box([
    violet("/ollama list") + dim(" — список локальных моделей"),
    violet("/ollama run") + dim(" — выбрать модель для работы"),
    "",
    dim("Ollama должен быть запущен: ") + white("ollama serve"),
    dim("Установка модели: ") + white("ollama pull llama3.2"),
  ], { title: "Локальные LLM (Ollama)", color: purple, padding: 2 }))
  console.log()
}

// ---------- /vt: VirusTotal integration ----------
async function handleVirusTotal(arg) {
  console.log()
  if (!arg) {
    console.log(dim("  Использование: /vt <путь к файлу>\n"))
    return
  }

  const filePath = arg.trim()
  if (!fs.existsSync(filePath)) {
    console.log(red(`  ✗ Файл не найден: ${filePath}\n`))
    return
  }

  startSpinner("Вычисляю хеш файла")
  const fileContent = fs.readFileSync(filePath)
  const hash = crypto.createHash("sha256").update(fileContent).digest("hex")

  console.log(dim("  SHA-256: ") + gray(hash))

  startSpinner("Запрашиваю VirusTotal")
  try {
    const vtKey = process.env.VIRUSTOTAL_API_KEY || ""
    if (!vtKey) {
      stopSpinner()
      console.log(yellow("  ⚠ VIRUSTOTAL_API_KEY не задан"))
      console.log(dim("  Получите ключ: ") + cyan("https://www.virustotal.com/gui/my-apikey"))
      console.log(dim("  Задайте: ") + violet("export VIRUSTOTAL_API_KEY=ваш_ключ\n"))
      return
    }

    const res = await fetch(`https://www.virustotal.com/api/v3/files/${hash}`, {
      headers: { "x-apikey": vtKey },
      signal: AbortSignal.timeout(10000),
    })
    stopSpinner()

    if (res.status === 404) {
      console.log(yellow("  ⚠ Файл не найден в базе VirusTotal"))
      console.log(dim("  Загрузите файл на: ") + cyan("https://www.virustotal.com/gui/upload\n"))
      return
    }

    if (!res.ok) {
      console.log(red(`  ✗ Ошибка API: HTTP ${res.status}\n`))
      return
    }

    const data = await res.json()
    const stats = data.data?.attributes?.last_analysis_stats || {}
    const malicious = stats.malicious || 0
    const suspicious = stats.suspicious || 0
    const harmless = stats.harmless || 0
    const total = malicious + suspicious + harmless

    const severity = malicious > 0 ? "danger" : suspicious > 0 ? "warning" : "safe"

    console.log(box([
      dim("Файл:     ") + white(path.basename(filePath)),
      dim("Хеш:      ") + gray(hash.slice(0, 16) + "..."),
      dim("Размер:   ") + white(`${(fileContent.length / 1024).toFixed(1)} KB`),
      "",
      malicious > 0
        ? red(`⚠ ОБНАРУЖЕНО: ${malicious} антивирусов`) : green("✓ Не обнаружено"),
      suspicious > 0 ? yellow(`  Подозрительных: ${suspicious}`) : "",
      dim(`  Проверено: ${total} антивирусов`),
    ], { title: "VirusTotal", color: severity === "danger" ? [255, 80, 80] : severity === "warning" ? [255, 200, 0] : [0, 200, 100], padding: 2 }))
    console.log()
  } catch (e) {
    stopSpinner()
    console.log(red("  ✗ Ошибка: ") + String(e?.message || e).slice(0, 200) + "\n")
  }
}

// ---------- /ai-scan: AI-powered code analysis ----------
async function handleAIScan(arg) {
  console.log()
  if (!arg) {
    console.log(dim("  Использование: /ai-scan <путь к файлу>\n"))
    return
  }

  const filePath = arg.trim()
  if (!fs.existsSync(filePath)) {
    console.log(red(`  ✗ Файл не найден: ${filePath}\n`))
    return
  }

  const content = fs.readFileSync(filePath, "utf8")
  if (content.length > 50000) {
    console.log(red("  ✗ Файл слишком большой для AI-анализа (>50KB)\n"))
    return
  }

  startSpinner("AI анализирует код")

  const analysisPrompt = `Ты — эксперт по информационной безопасности. Проанализируй этот файл на наличие:

1. Backdoors / бэкдоров
2. Обфусцированного кода
3. Утечки данных
4. Подозрительных API-вызовов
5. Скрытых сетевых соединений
6. Кейлоггеров
7. Руткитов

Файл: ${path.basename(filePath)}
Размер: ${content.length} символов

Содержимое:
\`\`\`
${content.slice(0, 15000)}
\`\`\`

Ответь в формате JSON:
{
  "verdict": "safe|suspicious|malicious",
  "confidence": 0-100,
  "threats": [{"type": "...", "severity": "low|medium|high|critical", "description": "..."}],
  "summary": "краткое резюме на русском"
}`

  try {
    const { text } = await generateText({
      model: getModel(state.model),
      messages: [{ role: "user", content: analysisPrompt }],
    })
    stopSpinner()

    let result
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      result = jsonMatch ? JSON.parse(jsonMatch[0]) : { verdict: "unknown", summary: text }
    } catch {
      result = { verdict: "unknown", summary: text }
    }

    const verdictColors = { safe: [0, 200, 100], suspicious: [255, 200, 0], malicious: [255, 80, 80], unknown: [150, 150, 150] }
    const verdictLabels = { safe: "БЕЗОПАСЕН", suspicious: "ПОДОЗРИТЕЛЕН", malicious: "ОПАСЕН", unknown: "НЕОПРЕДЕЛЁН" }
    const vc = verdictColors[result.verdict] || verdictColors.unknown

    const lines = [
      dim("Файл:    ") + white(path.basename(filePath)),
      dim("Вердикт: ") + `\x1b[38;2;${vc[0]};${vc[1]};${vc[2]}m${bold(verdictLabels[result.verdict] || result.verdict)}\x1b[0m`,
      dim("Уверенность: ") + white(`${result.confidence || "?"}%`),
      "",
    ]

    if (result.threats && result.threats.length > 0) {
      lines.push(red("Угрозы:"))
      for (const t of result.threats) {
        const sev = t.severity === "critical" ? red : t.severity === "high" ? yellow : t.severity === "medium" ? cyan : dim
        lines.push(`  ${sev("▸")} [${t.severity}] ${t.type}: ${t.description}`)
      }
    } else {
      lines.push(green("  Угроз не обнаружено"))
    }

    if (result.summary) {
      lines.push("")
      lines.push(dim("Резюме: ") + white(result.summary))
    }

    console.log(box(lines, { title: "AI Security Analysis", color: vc, padding: 2 }))
    console.log()
  } catch (e) {
    stopSpinner()
    console.log(red("  ✗ Ошибка: ") + String(e?.message || e).slice(0, 200) + "\n")
  }
}

// ---------- /ollama: Local LLM integration ----------

function goodbye() {
  console.log()
  console.log(gradientLine("  ✦ До встречи! Stella Coder завершает работу."))
  console.log(dim(`  Сессия: ${state.turns} запросов · ~$${state.totalCost.toFixed(4)}`))
  console.log()
  process.exit(0)
}

// ---------- REPL ----------
async function welcomeAndSetup() {
  console.clear()
  console.log()
  console.log(gradientLine("  ✦ Добро пожаловать в Stella!"))
  console.log()

  // Step 1: Try Ollama (free, no API key needed)
  let ollamaAvailable = false
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/tags`, { signal: AbortSignal.timeout(2000) })
    if (res.ok) {
      const data = await res.json()
      ollamaModels = data.models || []
      ollamaAvailable = ollamaModels.length > 0
    }
  } catch {}

  if (ollamaAvailable) {
    console.log(box([
      green("✓ Ollama найден!") + dim(` (${ollamaModels.length} моделей)`),
      "",
      white("Локальные модели работают бесплатно без API ключа."),
      "",
      ...ollamaModels.slice(0, 5).map((m, i) =>
        violet(`  [${i + 1}]`) + " " + white(m.name) + dim(` (${(m.size / 1e9).toFixed(1)}GB)`)
      ),
      ollamaModels.length > 5 ? dim(`  ... и ещё ${ollamaModels.length - 5}`) : "",
    ], { title: "✦ Бесплатные модели (Ollama)", color: [0, 200, 100], padding: 2 }))
    console.log()

    const useOllama = await question("  " + green("Использовать Ollama? (Y/n) › "))
    if (!useOllama || useOllama.toLowerCase() !== "n") {
      if (ollamaModels.length === 1) {
        state.model = `ollama:${ollamaModels[0].name}`
        console.log(green(`  ✓ Модель: ${ollamaModels[0].name}\n`))
      } else {
        const numStr = await question("  " + violet("Выберите номер модели › "))
        const idx = Number.parseInt(numStr) - 1
        if (ollamaModels[idx]) {
          state.model = `ollama:${ollamaModels[idx].name}`
          console.log(green(`  ✓ Модель: ${ollamaModels[idx].name}\n`))
        } else {
          state.model = `ollama:${ollamaModels[0].name}`
          console.log(green(`  ✓ Модель: ${ollamaModels[0].name}\n`))
        }
      }
      return "ollama"
    }
  }

  // Step 2: No Ollama — offer API key or install Ollama
  console.log(box([
    white("Stella работает с двумя типами моделей:"),
    "",
    green("1. Ollama (бесплатно, без интернета)") + dim(" — локальные модели"),
    violet("2. Stella AI (облачные модели)") + dim(" — нужен API ключ"),
    "",
    ollamaAvailable ? "" : yellow("⚠ Ollama не найден."),
    ollamaAvailable ? "" : dim("Установите: ") + white("https://ollama.com/download"),
  ], { title: "✦ Выберите способ", color: violet, padding: 2 }))
  console.log()

  if (!ollamaAvailable) {
    console.log(dim("  Для бесплатного использования установите Ollama:"))
    console.log(dim("  1. Скачайте: ") + cyan("https://ollama.com/download"))
    console.log(dim("  2. Установите модель: ") + white("ollama pull llama3.2"))
    console.log(dim("  3. Запустите: ") + white("ollama serve"))
    console.log()

    const installOllama = await question("  " + violet("Установлено? (y/N) › "))
    if (installOllama && installOllama.toLowerCase() === "y") {
      // Try again to detect Ollama
      try {
        const res = await fetch(`${OLLAMA_BASE}/api/tags`, { signal: AbortSignal.timeout(2000) })
        if (res.ok) {
          const data = await res.json()
          ollamaModels = data.models || []
          if (ollamaModels.length > 0) {
            if (ollamaModels.length === 1) {
              state.model = `ollama:${ollamaModels[0].name}`
              console.log(green(`  ✓ Модель: ${ollamaModels[0].name}\n`))
            } else {
              console.log(box(ollamaModels.map((m, i) =>
                violet(`[${i + 1}]`) + " " + white(m.name) + dim(` (${(m.size / 1e9).toFixed(1)}GB)`)
              ), { title: "Модели Ollama", color: purple, padding: 2 }))
              const numStr = await question("  " + violet("Номер модели › "))
              const idx = Number.parseInt(numStr) - 1
              state.model = `ollama:${ollamaModels[idx]?.name || ollamaModels[0].name}`
              console.log(green(`  ✓ Модель: ${ollamaModels[idx]?.name || ollamaModels[0].name}\n`))
            }
            return "ollama"
          }
        }
      } catch {}
      console.log(yellow("  Ollama всё ещё не обнаружен. Проверьте что ollama serve запущен.\n"))
    }
  }

  // Step 3: API key for cloud models
  console.log(box([
    violet("Для облачных моделей нужен API ключ:"),
    "",
    white("1. Перейдите на сайт:"),
    cyan("   https://opencode.ai/workspace/wrk_01KWPREB55NNG22C1D2MFPT84B"),
    "",
    white("2. Скопируйте ваш API ключ"),
    white("3. Отправьте его мне"),
  ], { title: "✦ Stella AI API ключ", color: violet, padding: 2 }))
  console.log()

  let attempts = 0
  while (attempts < 5) {
    const key = await question("  " + violet("Введите API ключ › "))
    const trimmed = key.trim()

    if (!trimmed) {
      console.log(red("  Ключ не может быть пустым\n"))
      attempts++
      continue
    }

    if (trimmed.length < 10) {
      console.log(red("  Ключ слишком короткий. Попробуйте ещё раз.\n"))
      attempts++
      continue
    }

    const result = saveApiKey(trimmed)
    if (result.ok) {
      const hw = getHardwareInfo()
      console.log()
      console.log(green("  ✓ Ключ сохранён!"))
      console.log(dim("  Платформа: ") + gray(hw.platform + " / " + hw.hostname))
      console.log()
      return trimmed
    } else {
      console.log(red("  ✗ " + result.error + "\n"))
      attempts++
    }
  }

  console.log(red("  Превышено количество попыток. Выход.\n"))
  process.exit(1)
}

async function main() {
  // Code integrity check
  const integrity = verifyCodeIntegrity()
  if (integrity.warning) {
    console.log(yellow("  ⚠ " + integrity.warning))
  }

  if (printMode) {
    // In print mode, try to use piped input as prompt
    // API key should already be loaded from secure vault
    const prompt = printPrompt || (await readStdin())
    if (!prompt) {
      if (!apiKey && !state.model.startsWith("ollama:")) {
        console.error(red("  API ключ не найден. Запустите stella без -p для настройки."))
        process.exit(1)
      }
      console.error("Нет запроса. Использование: stella -p \"вопрос\"")
      process.exit(1)
    }
    if (!apiKey && !state.model.startsWith("ollama:")) {
      console.error(red("  API ключ не найден. Запустите stella без -p для настройки."))
      process.exit(1)
    }
    await runTurn(prompt)
    process.exit(0)
  }

  // Create readline interface FIRST (needed for welcomeAndSetup question prompts)
  rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    completer: (line) => {
      if (!line.startsWith("/")) return [[], line]
      const hits = COMMANDS.map(([c]) => c).filter((c) => c.startsWith(line))
      return [hits, line]
    },
  })

  // Check for API key — show welcome if not found
  if (!apiKey && !state.model.startsWith("ollama:")) {
    apiKey = await welcomeAndSetup()
    if (!state.model.startsWith("ollama:")) {
      state.model = MODELS[0].id
    }
  }

  console.clear()
  printBanner({ model: state.model, cwd: process.cwd(), version: VERSION })

  let lastSigint = 0
  rl.on("SIGINT", () => {
    const now = Date.now()
    if (now - lastSigint < 1500) goodbye()
    lastSigint = now
    console.log(dim("\n  (нажми Ctrl+C ещё раз для выхода)"))
    promptUser()
  })
  rl.on("close", goodbye)

  const promptUser = () => {
    rl.question(gradientLine("❯ "), async (line) => {
      const input = line.trim()
      if (!input) return promptUser()
      if (input.startsWith("/")) {
        await handleCommand(input)
      } else if (input.startsWith("!")) {
        try {
          const { execSync } = await import("node:child_process")
          const out = execSync(input.slice(1), { encoding: "utf8", stdio: ["inherit", "pipe", "pipe"] })
          console.log(dim(out))
        } catch (e) {
          console.log(red(String(e.stderr || e.message).slice(0, 500)))
        }
      } else {
        await runTurn(input)
      }
      promptUser()
    })
  }
  promptUser()
}

function readStdin() {
  return new Promise((res) => {
    if (process.stdin.isTTY) return res("")
    let data = ""
    process.stdin.on("data", (c) => (data += c))
    process.stdin.on("end", () => res(data.trim()))
  })
}

main()
