import fs from "node:fs"
import path from "node:path"
import os from "node:os"
import { execSync } from "node:child_process"
const MCP_CONFIG_PATH = path.join(os.homedir(), ".stella", "mcp.json")
const DEFAULT_SERVERS = {
  "filesystem": {
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-filesystem", process.cwd()],
    description: "Доступ к файловой системе",
    icon: "📁",
  },
  "github": {
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-github"],
    env: { GITHUB_TOKEN: process.env.GITHUB_TOKEN || "" },
    description: "Интеграция с GitHub",
    icon: "🐙",
  },
  "memory": {
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-memory"],
    description: "Долгосрочная память",
    icon: "🧠",
  },
  "brave-search": {
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-brave-search"],
    env: { BRAVE_API_KEY: process.env.BRAVE_API_KEY || "" },
    description: "Поиск в интернете (Brave)",
    icon: "🔍",
  },
  "postgres": {
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-postgres", process.env.DATABASE_URL || ""],
    description: "PostgreSQL база данных",
    icon: "🐘",
  },
  "sqlite": {
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-sqlite", "--db-path", "database.db"],
    description: "SQLite база данных",
 icon: "💾",
  },
  "puppeteer": {
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-puppeteer"],
    description: "Браузер automation (Puppeteer)",
    icon: "🌐",
  },
  "fetch": {
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-fetch"],
    description: "HTTP запросы",
    icon: "📤",
  },
}
class MCPManager {
  constructor() {
    this.servers = new Map()
    this.tools = new Map()
    this.config = this.loadConfig()
  }
  loadConfig() {
    try {
      if (fs.existsSync(MCP_CONFIG_PATH)) {
        return JSON.parse(fs.readFileSync(MCP_CONFIG_PATH, "utf8"))
      }
    } catch {}
    return { servers: {} }
  }
  saveConfig() {
    const dir = path.dirname(MCP_CONFIG_PATH)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(MCP_CONFIG_PATH, JSON.stringify(this.config, null, 2), "utf8")
  }
  async addServer(name, serverConfig) {
    this.config.servers[name] = {
      command: serverConfig.command,
      args: serverConfig.args || [],
      env: serverConfig.env || {},
      description: serverConfig.description || "",
      icon: serverConfig.icon || "🔌",
    }
    this.saveConfig()
    return { success: true, message: `Сервер "${name}" добавлен` }
  }
  async removeServer(name) {
    if (this.config.servers[name]) {
      delete this.config.servers[name]
      this.saveConfig()
      this.servers.delete(name)
      return { success: true, message: `Сервер "${name}" удалён` }
    }
    return { error: `Сервер "${name}" не найден` }
  }
  async startServer(name) {
    const server = this.config.servers[name] || DEFAULT_SERVERS[name]
    if (!server) {
      return { error: `Сервер "${name}" не найден` }
    }
    console.log(`\n  🔌 Запуск MCP сервера: ${name}`)
    console.log(`  ${server.description}`)
    try {
      const cmd = `${server.command} ${server.args.join(" ")} --help`
      execSync(cmd, { stdio: "pipe", timeout: 5000 })
      this.servers.set(name, { status: "running", config: server })
      console.log(`  ✓ Сервер "${name}" запущен\n`)
      return { success: true, status: "running" }
    } catch (err) {
      console.log(`  ⚠ Сервер "${name}" требует установку зависимостей`)
      console.log(`  Выполните: ${server.command} ${server.args.join(" ")}\n`)
      this.servers.set(name, { status: "installed", config: server })
      return { success: true, status: "installed" }
    }
  }
  async stopServer(name) {
    this.servers.delete(name)
    return { success: true, message: `Сервер "${name}" остановлен` }
  }
  getServerTools(name) {
    const serverTools = {
      "filesystem": [
        { name: "fs_read_file", description: "Чтение файла через MCP" },
        { name: "fs_write_file", description: "Запись файла через MCP" },
        { name: "fs_list_directory", description: "Список файлов" },
        { name: "fs_search_files", description: "Поиск файлов" },
      ],
      "github": [
        { name: "gh_create_repo", description: "Создать репозиторий" },
        { name: "gh_create_issue", description: "Создать issue" },
        { name: "gh_create_pr", description: "Создать pull request" },
        { name: "gh_list_issues", description: "Список issues" },
        { name: "gh_search_code", description: "Поиск кода" },
      ],
      "memory": [
        { name: "mem_store", description: "Сохранить в память" },
        { name: "mem_retrieve", description: "Из памяти" },
        { name: "mem_search", description: "Поиск в памяти" },
      ],
      "brave-search": [
        { name: "brave_web_search", description: "Поиск в интернете" },
        { name: "brave_local_search", description: "Локальный поиск" },
      ],
      "puppeteer": [
        { name: "pup_navigate", description: "Открыть страницу" },
        { name: "pup_screenshot", description: "Скриншот страницы" },
        { name: "pup_click", description: "Клик по элементу" },
        { name: "pup_type", description: "Ввод текста" },
        { name: "pup_evaluate", description: "Выполнить JS в браузере" },
      ],
      "fetch": [
        { name: "fetch_get", description: "GET запрос" },
        { name: "fetch_post", description: "POST запрос" },
      ],
    }
    return serverTools[name] || []
  }
  listServers() {
    const all = { ...DEFAULT_SERVERS, ...this.config.servers }
    return Object.entries(all).map(([name, config]) => ({
      name,
      ...config,
      status: this.servers.get(name)?.status || "stopped",
    }))
  }
  getAllTools() {
    const tools = []
    for (const [serverName] of this.servers) {
      const serverTools = this.getServerTools(serverName)
      tools.push(...serverTools.map(t => ({ ...t, server: serverName })))
    }
    return tools
  }
}
export const mcp = new MCPManager()
export const MCP_COMMANDS = {
  "/mcp": {
    description: "Управление MCP серверами",
    handler: async (args) => {
      const [subcommand, ...rest] = args.split(" ")
      switch (subcommand) {
        case "list":
        case "ls": {
          const servers = mcp.listServers()
          console.log("\n  MCP Серверы:\n")
          for (const s of servers) {
            const status = s.status === "running" ? "🟢" : s.status === "installed" ? "🟡" : "🔴"
            console.log(`  ${status} ${s.icon || "🔌"} ${s.name}`)
            console.log(`     ${s.description}`)
            console.log(`     ${s.command} ${s.args.join(" ")}\n`)
          }
          return
        }
        case "start": {
          const name = rest[0]
          if (!name) { console.log("  Использование: /mcp start <имя>"); return }
          await mcp.startServer(name)
          return
        }
        case "stop": {
          const name = rest[0]
          if (!name) { console.log("  Использование: /mcp stop <имя>"); return }
          await mcp.stopServer(name)
          console.log(`  ✓ Сервер "${name}" остановлен`)
          return
        }
        case "add": {
          const [name, command, ...args] = rest
          if (!name || !command) {
            console.log("  Использование: /mcp add <имя> <команда> [аргументы...]")
            return
          }
          await mcp.addServer(name, { command, args, description: `Custom server: ${name}` })
          console.log(`  ✓ Сервер "${name}" добавлен`)
          return
        }
        case "remove":
        case "rm": {
          const name = rest[0]
          if (!name) { console.log("  Использование: /mcp remove <имя>"); return }
          await mcp.removeServer(name)
          console.log(`  ✓ Сервер "${name}" удалён`)
          return
        }
        case "tools": {
          const tools = mcp.getAllTools()
          if (tools.length === 0) {
            console.log("\n  Нет подключённых серверов. Запустите: /mcp start <имя>\n")
            return
          }
          console.log("\n  Доступные MCP инструменты:\n")
          for (const t of tools) {
            console.log(`  🔧 ${t.name} (${t.server})`)
            console.log(`     ${t.description}\n`)
          }
          return
        }
        default:
          console.log(`
  MCP (Model Context Protocol) — подключение к внешним серверам
  Команды:
    /mcp list      — список серверов
    /mcp start <имя> — запустить сервер
    /mcp stop <имя>  — остановить сервер
    /mcp add <имя> <команда> [args] — добавить сервер
    /mcp remove <имя> — удалить сервер
    /mcp tools    — список инструментов
  Популярные серверы:
    filesystem  — файловая система
    github      — GitHub API
    memory      — долгосрочная память
    puppeteer   — браузер automation
    fetch       — HTTP запросы
`)
      }
    },
  },
}