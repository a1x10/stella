import { tool } from "ai"
import { z } from "zod"
import fs from "node:fs"
import path from "node:path"
import { execSync } from "node:child_process"

const MAX_OUTPUT = 30000

function clamp(s) {
  if (s.length > MAX_OUTPUT) return s.slice(0, MAX_OUTPUT) + `\n... [обрезано, всего ${s.length} символов]`
  return s
}

function resolveSafe(p) {
  return path.resolve(process.cwd(), p)
}

// permissions: { ask: async (kind, summary) => boolean }
export function createTools(permissions) {
  return {
    read_file: tool({
      description: "Прочитать файл. Возвращает содержимое с номерами строк.",
      inputSchema: z.object({
        path: z.string().describe("Путь к файлу"),
        offset: z.number().optional().describe("Начальная строка (с 1)"),
        limit: z.number().optional().describe("Максимум строк"),
      }),
      execute: async ({ path: p, offset = 1, limit = 2000 }) => {
        const abs = resolveSafe(p)
        if (!fs.existsSync(abs)) return { error: `Файл не найден: ${p}` }
        const lines = fs.readFileSync(abs, "utf8").split("\n")
        const slice = lines.slice(offset - 1, offset - 1 + limit)
        const numbered = slice.map((l, i) => `${String(i + offset).padStart(5)}→${l}`).join("\n")
        return { content: clamp(numbered), totalLines: lines.length }
      },
    }),

    write_file: tool({
      description: "Создать или перезаписать файл целиком.",
      inputSchema: z.object({
        path: z.string(),
        content: z.string(),
      }),
      execute: async ({ path: p, content }) => {
        const ok = await permissions.ask("write", `Write(${p}) — ${content.split("\n").length} строк`)
        if (!ok) return { error: "Пользователь отклонил запись файла" }
        const abs = resolveSafe(p)
        fs.mkdirSync(path.dirname(abs), { recursive: true })
        fs.writeFileSync(abs, content, "utf8")
        return { success: true, path: p, lines: content.split("\n").length }
      },
    }),

    edit_file: tool({
      description:
        "Точечная замена в файле: заменяет old_string на new_string. old_string должен встречаться ровно один раз (или используй replace_all).",
      inputSchema: z.object({
        path: z.string(),
        old_string: z.string(),
        new_string: z.string(),
        replace_all: z.boolean().optional(),
      }),
      execute: async ({ path: p, old_string, new_string, replace_all }) => {
        const abs = resolveSafe(p)
        if (!fs.existsSync(abs)) return { error: `Файл не найден: ${p}` }
        const src = fs.readFileSync(abs, "utf8")
        const count = src.split(old_string).length - 1
        if (count === 0) return { error: "old_string не найден в файле" }
        if (count > 1 && !replace_all) return { error: `old_string встречается ${count} раз — уточни контекст или replace_all` }
        const ok = await permissions.ask("write", `Edit(${p})`)
        if (!ok) return { error: "Пользователь отклонил правку" }
        const out = replace_all ? src.split(old_string).join(new_string) : src.replace(old_string, new_string)
        fs.writeFileSync(abs, out, "utf8")
        return { success: true, replacements: replace_all ? count : 1 }
      },
    }),

    list_dir: tool({
      description: "Показать содержимое директории.",
      inputSchema: z.object({ path: z.string().optional() }),
      execute: async ({ path: p = "." }) => {
        const abs = resolveSafe(p)
        if (!fs.existsSync(abs)) return { error: `Не найдено: ${p}` }
        const entries = fs.readdirSync(abs, { withFileTypes: true })
        return {
          entries: entries
            .filter((e) => e.name !== "node_modules" && e.name !== ".git")
            .map((e) => (e.isDirectory() ? e.name + "/" : e.name))
            .sort(),
        }
      },
    }),

    glob: tool({
      description: "Найти файлы по glob-шаблону, например **/*.ts",
      inputSchema: z.object({ pattern: z.string(), path: z.string().optional() }),
      execute: async ({ pattern, path: p = "." }) => {
        try {
          const base = resolveSafe(p)
          const SKIP = new Set(["node_modules", ".git", ".next", ".vercel"])
          const rx = new RegExp(
            "^" +
              pattern
                .replace(/[.+^${}()|[\]\\]/g, "\\$&")
                .replace(/\*\*\//g, "(.*/)?")
                .replace(/\*\*/g, ".*")
                .replace(/\*/g, "[^/]*")
                .replace(/\?/g, ".") +
              "$",
          )
          function walk(dir) {
            const results = []
            for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
              if (SKIP.has(entry.name)) continue
              const full = path.join(dir, entry.name)
              if (entry.isDirectory()) {
                results.push(...walk(full))
              } else {
                results.push(full)
              }
              if (results.length >= 500) break
            }
            return results
          }
          const all = walk(base)
          const files = all
            .map((f) => path.relative(base, f).replace(/\\/g, "/"))
            .filter((f) => rx.test(f))
          return { files: files.slice(0, 200), total: files.length }
        } catch (e) {
          return { error: String(e.message || e) }
        }
      },
    }),

    grep: tool({
      description: "Поиск по содержимому файлов (регулярное выражение).",
      inputSchema: z.object({
        pattern: z.string(),
        path: z.string().optional(),
        glob: z.string().optional().describe("фильтр файлов, напр. *.ts"),
      }),
      execute: async ({ pattern, path: p = ".", glob: g }) => {
        try {
          const base = resolveSafe(p)
          const SKIP = new Set(["node_modules", ".git", ".next", ".vercel"])
          const rx = new RegExp(pattern)
          const globRx = g
            ? new RegExp(
                "^" +
                  g.replace(/[.+^${}()|[\]\\]/g, "\\$&")
                    .replace(/\*\*\//g, "(.*/)?")
                    .replace(/\*\*/g, ".*")
                    .replace(/\*/g, "[^/]*")
                    .replace(/\?/g, ".") +
                  "$",
              )
            : null
          const lines = []
          function walk(dir) {
            for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
              if (SKIP.has(entry.name)) continue
              const full = path.join(dir, entry.name)
              if (entry.isDirectory()) {
                walk(full)
              } else {
                if (globRx && !globRx.test(entry.name)) continue
                try {
                  const content = fs.readFileSync(full, "utf8")
                  const rel = path.relative(base, full).replace(/\\/g, "/")
                  for (let i = 0; i < content.split("\n").length; i++) {
                    const line = content.split("\n")[i]
                    if (rx.test(line)) {
                      lines.push(`${rel}:${i + 1}:${line}`)
                      if (lines.length >= 100) return
                    }
                  }
                } catch {}
              }
              if (lines.length >= 100) return
            }
          }
          walk(base)
          return { matches: clamp(lines.join("\n")) || "(нет совпадений)" }
        } catch {
          return { matches: "(нет совпадений)" }
        }
      },
    }),

    bash: tool({
      description: "Выполнить shell-команду в рабочей директории. Возвращает stdout/stderr.",
      inputSchema: z.object({
        command: z.string(),
        timeout_ms: z.number().optional(),
      }),
      execute: async ({ command, timeout_ms = 120000 }) => {
        const ok = await permissions.ask("bash", `Bash(${command})`)
        if (!ok) return { error: "Пользователь отклонил выполнение команды" }
        try {
          const out = execSync(command, {
            encoding: "utf8",
            timeout: timeout_ms,
            maxBuffer: 10 * 1024 * 1024,
            cwd: process.cwd(),
          })
          return { output: clamp(out) || "(пустой вывод)" }
        } catch (e) {
          return {
            error: clamp(String(e.stderr || e.message || e)),
            output: clamp(String(e.stdout || "")),
            exitCode: e.status ?? 1,
          }
        }
      },
    }),

    todo_write: tool({
      description: "Обновить список задач текущей сессии (план работы). Показывается пользователю.",
      inputSchema: z.object({
        todos: z.array(
          z.object({
            content: z.string(),
            status: z.enum(["pending", "in_progress", "completed"]),
          }),
        ),
      }),
      execute: async ({ todos }) => {
        permissions.onTodos?.(todos)
        return { success: true, count: todos.length }
      },
    }),

    // ═══════════════════════════════════════════════════
    //  ВЕБ И ИНТЕРНЕТ
    // ═══════════════════════════════════════════════════
    web_search: tool({
      description: "Поиск в интернете по запросу (бесплатно, без API ключа).",
      inputSchema: z.object({
        query: z.string().describe("Поисковый запрос"),
        num_results: z.number().optional().describe("Количество результатов (по умолчанию 5)"),
      }),
      execute: async ({ query, num_results = 5 }) => {
        try {
          // Используем DuckDuckGo Instant Answers API (бесплатно, без ключа)
          const res = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`, {
            signal: AbortSignal.timeout(10000),
            headers: { "User-Agent": "Stella/3.9" },
          })

          if (!res.ok) {
            // Fallback: поиск через HTML
            const htmlRes = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
              signal: AbortSignal.timeout(10000),
              headers: { "User-Agent": "Mozilla/5.0" },
            })
            const html = await htmlRes.text()
            const results = []
            const matches = html.matchAll(/class="result__a"[^>]*href="([^"]*)"[^>]*>([^<]*)</g)
            for (const match of matches) {
              if (results.length >= num_results) break
              results.push({ url: match[1], title: match[2].trim(), snippet: "" })
            }
            return { results, total: results.length }
          }

          const data = await res.json()
          const results = []

          if (data.AbstractText) {
            results.push({
              title: data.Heading || query,
              url: data.AbstractURL || "",
              snippet: data.AbstractText,
            })
          }

          if (data.RelatedTopics) {
            for (const topic of data.RelatedTopics) {
              if (results.length >= num_results) break
              if (topic.Text && topic.FirstURL) {
                results.push({
                  title: topic.Text.slice(0, 100),
                  url: topic.FirstURL,
                  snippet: topic.Text,
                })
              }
            }
          }

          return { results: results.slice(0, num_results), total: results.length }
        } catch (e) {
          return { error: `Ошибка поиска: ${e.message}` }
        }
      },
    }),

    web_fetch: tool({
      description: "Загрузить и прочитать содержимое URL. Возвращает текст страницы.",
      inputSchema: z.object({
        url: z.string().describe("URL для загрузки"),
        max_length: z.number().optional().describe("Максимальная длина (символов)"),
      }),
      execute: async ({ url, max_length = 10000 }) => {
        try {
          const res = await fetch(url, {
            signal: AbortSignal.timeout(15000),
            headers: { "User-Agent": "Stella/3.9" },
          })
          if (!res.ok) return { error: `HTTP ${res.status}` }
          const text = await res.text()
          const content = text.length > max_length ? text.slice(0, max_length) + "..." : text
          return { content, length: text.length }
        } catch (e) {
          return { error: String(e.message || e) }
        }
      },
    }),

    // ═══════════════════════════════════════════════════
    //  ФАЙЛЫ И ДАННЫЕ
    // ═══════════════════════════════════════════════════
    file_info: tool({
      description: "Получить информацию о файле: размер, тип, даты, права.",
      inputSchema: z.object({ path: z.string() }),
      execute: async ({ path: p }) => {
        const abs = resolveSafe(p)
        if (!fs.existsSync(abs)) return { error: `Файл не найден: ${p}` }
        const stat = fs.statSync(abs)
        return {
          name: path.basename(abs),
          type: stat.isDirectory() ? "directory" : "file",
          size: stat.size,
          sizeHuman: `${(stat.size / 1024).toFixed(1)} KB`,
          created: stat.birthtime.toISOString(),
          modified: stat.mtime.toISOString(),
          permissions: stat.mode.toString(8),
        }
      },
    }),

    file_hash: tool({
      description: "Вычислить хеш файла (SHA-256, MD5).",
      inputSchema: z.object({ path: z.string() }),
      execute: async ({ path: p }) => {
        const crypto = await import("node:crypto")
        const abs = resolveSafe(p)
        if (!fs.existsSync(abs)) return { error: `Файл не найден: ${p}` }
        const content = fs.readFileSync(abs)
        return {
          sha256: crypto.createHash("sha256").update(content).digest("hex"),
          md5: crypto.createHash("md5").update(content).digest("hex"),
          size: content.length,
        }
      },
    }),

    file_copy: tool({
      description: "Скопировать файл из источника в назначение.",
      inputSchema: z.object({
        source: z.string().describe("Исходный файл"),
        destination: z.string().describe("Назначение"),
      }),
      execute: async ({ source, destination }) => {
        const src = resolveSafe(source)
        const dst = resolveSafe(destination)
        if (!fs.existsSync(src)) return { error: `Файл не найден: ${source}` }
        fs.mkdirSync(path.dirname(dst), { recursive: true })
        fs.copyFileSync(src, dst)
        return { success: true, source, destination }
      },
    }),

    file_move: tool({
      description: "Переместить/переименовать файл.",
      inputSchema: z.object({
        source: z.string().describe("Исходный файл"),
        destination: z.string().describe("Назначение"),
      }),
      execute: async ({ source, destination }) => {
        const src = resolveSafe(source)
        const dst = resolveSafe(destination)
        if (!fs.existsSync(src)) return { error: `Файл не найден: ${source}` }
        fs.mkdirSync(path.dirname(dst), { recursive: true })
        fs.renameSync(src, dst)
        return { success: true, source, destination }
      },
    }),

    file_delete: tool({
      description: "Удалить файл.",
      inputSchema: z.object({ path: z.string() }),
      execute: async ({ path: p }) => {
        const abs = resolveSafe(p)
        if (!fs.existsSync(abs)) return { error: `Файл не найден: ${p}` }
        fs.unlinkSync(abs)
        return { success: true, deleted: p }
      },
    }),

    mkdir: tool({
      description: "Создать директорию (включая родительские).",
      inputSchema: z.object({ path: z.string() }),
      execute: async ({ path: p }) => {
        const abs = resolveSafe(p)
        fs.mkdirSync(abs, { recursive: true })
        return { success: true, created: p }
      },
    }),

    // ═══════════════════════════════════════════════════
    //  GIT
    // ═══════════════════════════════════════════════════
    git_status: tool({
      description: "Показать статус git репозитория.",
      inputSchema: z.object({}),
      execute: async () => {
        try {
          const out = execSync("git status", { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] })
          return { status: out }
        } catch (e) {
          return { error: "Git репозиторий не найден или ошибка" }
        }
      },
    }),

    git_diff: tool({
      description: "Показать различия git ( unstaged, staged, или конкретный коммит).",
      inputSchema: z.object({
        target: z.string().optional().describe("Цель diff (HEAD, staged, конкретный коммит)"),
      }),
      execute: async ({ target = "" }) => {
        try {
          const cmd = target ? `git diff ${target}` : "git diff"
          const out = execSync(cmd, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] })
          return { diff: out || "(нет изменений)" }
        } catch (e) {
          return { error: String(e.message) }
        }
      },
    }),

    git_log: tool({
      description: "Показать историю коммитов.",
      inputSchema: z.object({
        count: z.number().optional().describe("Количество коммитов (по умолчанию 10)"),
      }),
      execute: async ({ count = 10 }) => {
        try {
          const out = execSync(`git log --oneline -${count}`, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] })
          return { log: out }
        } catch (e) {
          return { error: "Git репозиторий не найден" }
        }
      },
    }),

    git_commit: tool({
      description: "Создать git коммит с сообщением.",
      inputSchema: z.object({
        message: z.string().describe("Сообщение коммита"),
        files: z.array(z.string()).optional().describe("Файлы для добавления (по умолчанию все изменённые)"),
      }),
      execute: async ({ message, files }) => {
        try {
          if (files && files.length > 0) {
            execSync(`git add ${files.join(" ")}`, { encoding: "utf8" })
          } else {
            execSync("git add -A", { encoding: "utf8" })
          }
          execSync(`git commit -m "${message.replace(/"/g, '\\"')}"`, { encoding: "utf8" })
          return { success: true, message }
        } catch (e) {
          return { error: String(e.stderr || e.message) }
        }
      },
    }),

    // ═══════════════════════════════════════════════════
    //  ПАМЯТЬ И КОНТЕКСТ
    // ═══════════════════════════════════════════════════
    memory_read: tool({
      description: "Прочитать память проекта (STELLA.md).",
      inputSchema: z.object({}),
      execute: async () => {
        const memoryPath = path.join(process.cwd(), "STELLA.md")
        if (!fs.existsSync(memoryPath)) return { content: "(память проекта не создана)" }
        return { content: fs.readFileSync(memoryPath, "utf8") }
      },
    }),

    memory_write: tool({
      description: "Записать информацию в память проекта (STELLA.md).",
      inputSchema: z.object({
        content: z.string().describe("Информация для сохранения"),
        append: z.boolean().optional().describe("Добавить в конец (по умолчанию заменить)"),
      }),
      execute: async ({ content, append = false }) => {
        const memoryPath = path.join(process.cwd(), "STELLA.md")
        if (append && fs.existsSync(memoryPath)) {
          const existing = fs.readFileSync(memoryPath, "utf8")
          fs.writeFileSync(memoryPath, existing + "\n\n" + content)
        } else {
          fs.writeFileSync(memoryPath, content)
        }
        return { success: true }
      },
    }),

    // ═══════════════════════════════════════════════════
    //  ЗАДАЧИ (TODO)
    // ═══════════════════════════════════════════════════
    todo_read: tool({
      description: "Прочитать текущий список задач.",
      inputSchema: z.object({}),
      execute: async () => {
        const todoPath = path.join(process.cwd(), ".stella-todos.json")
        try {
          const todos = JSON.parse(fs.readFileSync(todoPath, "utf8"))
          return { todos }
        } catch {
          return { todos: [] }
        }
      },
    }),

    // ═══════════════════════════════════════════════════
    //  ИНСТРУМЕНТЫ РАЗРАБОТЧИКА
    // ═══════════════════════════════════════════════════
    package_json: tool({
      description: "Прочитать информацию из package.json проекта.",
      inputSchema: z.object({}),
      execute: async () => {
        const pkgPath = path.join(process.cwd(), "package.json")
        if (!fs.existsSync(pkgPath)) return { error: "package.json не найден" }
        const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"))
        return {
          name: pkg.name,
          version: pkg.version,
          description: pkg.description,
          scripts: pkg.scripts || {},
          dependencies: Object.keys(pkg.dependencies || {}),
          devDependencies: Object.keys(pkg.devDependencies || {}),
        }
      },
    }),

    env_get: tool({
      description: "Получить значение переменной окружения.",
      inputSchema: z.object({
        name: z.string().describe("Имя переменной окружения"),
      }),
      execute: async ({ name }) => {
        return { name, value: process.env[name] || "(не задана)" }
      },
    }),

    env_set: tool({
      description: "Установить переменную окружения.",
      inputSchema: z.object({
        name: z.string().describe("Имя переменной"),
        value: z.string().describe("Значение переменной"),
      }),
      execute: async ({ name, value }) => {
        process.env[name] = value
        return { success: true, name, value }
      },
    }),

    process_list: tool({
      description: "Показать список запущенных процессов.",
      inputSchema: z.object({
        filter: z.string().optional().describe("Фильтр по имени процесса"),
      }),
      execute: async ({ filter }) => {
        try {
          let cmd = "tasklist /FO CSV /NH"
          if (filter) cmd = `tasklist /FO CSV /NH /FI "IMAGENAME eq ${filter}*"`
          const out = execSync(cmd, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] })
          return { processes: out }
        } catch (e) {
          return { error: "Не удалось получить список процессов" }
        }
      },
    }),

    process_kill: tool({
      description: "Завершить процесс по PID или имени.",
      inputSchema: z.object({
        pid: z.number().optional().describe("PID процесса"),
        name: z.string().optional().describe("Имя процесса"),
      }),
      execute: async ({ pid, name }) => {
        try {
          const target = pid ? `/PID ${pid}` : `/IM ${name}`
          execSync(`taskkill /F ${target}`, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] })
          return { success: true, killed: pid || name }
        } catch (e) {
          return { error: String(e.stderr || e.message) }
        }
      },
    }),

    // ═══════════════════════════════════════════════════════════════
    //  ПОЛНОЕ УПРАВЛЕНИЕ КОМПЬЮТЕРОМ
    // ═══════════════════════════════════════════════════════════════

    // ── ЗАПУСК ПРИЛОЖЕНИЙ ──
    open_app: tool({
      description: "Открыть приложение или файл. Поддерживает любые установленные приложения.",
      inputSchema: z.object({
        app: z.string().describe("Имя приложения (chrome, notepad, explorer,calc, word, excel, code, spotify, steam) или путь к файлу"),
        args: z.string().optional().describe("Аргументы запуска"),
      }),
      execute: async ({ app, args = "" }) => {
        try {
          const appMap = {
            "chrome": "chrome.exe",
            "google chrome": "chrome.exe",
            "firefox": "firefox.exe",
            "edge": "msedge.exe",
            "browser": "msedge.exe",
            "notepad": "notepad.exe",
            "explorer": "explorer.exe",
            "files": "explorer.exe",
            "calc": "calc.exe",
            "калькулятор": "calc.exe",
            "paint": "mspaint.exe",
            "word": "winword.exe",
            "excel": "excel.exe",
            "powerpoint": "powerpnt.exe",
            "code": "code.cmd",
            "vscode": "code.cmd",
            "visual studio code": "code.cmd",
            "spotify": "Spotify.exe",
            "steam": "steam.exe",
            "discord": "Discord.exe",
            "telegram": "Telegram.exe",
            "whatsapp": "WhatsApp.exe",
            "teams": "Teams.exe",
            "zoom": "Zoom.exe",
            "slack": "Slack.exe",
            "photoshop": "Photoshop.exe",
            "figma": "Figma.exe",
            "blender": "blender.exe",
            "terminal": "wt.exe",
            "powershell": "pwsh.exe",
            "cmd": "cmd.exe",
            "task manager": "taskmgr.exe",
            "диспетчер": "taskmgr.exe",
            "control panel": "control.exe",
            "панель управления": "control.exe",
            "settings": "ms-settings:",
            "настройки": "ms-settings:",
            "registry": "regedit.exe",
            "реестр": "regedit.exe",
            "cmd": "cmd.exe",
            "system info": "msinfo32.exe",
            "info": "msinfo32.exe",
          }
          const appName = appMap[app.toLowerCase()] || app
          const cmd = args ? `start "" "${appName}" ${args}` : `start "" "${appName}"`
          execSync(cmd, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], shell: "cmd.exe" })
          return { success: true, app: appName }
        } catch (e) {
          return { error: `Не удалось открыть ${app}: ${e.message}` }
        }
      },
    }),

    open_url: tool({
      description: "Открыть URL в браузере по умолчанию.",
      inputSchema: z.object({
        url: z.string().describe("URL для открытия"),
      }),
      execute: async ({ url }) => {
        try {
          execSync(`start "" "${url}"`, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], shell: "cmd.exe" })
          return { success: true, url }
        } catch (e) {
          return { error: `Не удалось открыть URL: ${e.message}` }
        }
      },
    }),

    open_kinopoisk: tool({
      description: "Открыть Кинопоиск в браузере.",
      inputSchema: z.object({
        query: z.string().optional().describe("Поисковый запрос (название фильма)"),
      }),
      execute: async ({ query }) => {
        try {
          const url = query
            ? `https://www.kinopoisk.ru/index.php?what=${encodeURIComponent(query)}`
            : "https://www.kinopoisk.ru"
          execSync(`start "" "${url}"`, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], shell: "cmd.exe" })
          return { success: true, url }
        } catch (e) {
          return { error: `Не удалось открыть Кинопоиск: ${e.message}` }
        }
      },
    }),

    open_youtube: tool({
      description: "Открыть YouTube в браузере.",
      inputSchema: z.object({
        query: z.string().optional().describe("Поисковый запрос"),
      }),
      execute: async ({ query }) => {
        try {
          const url = query
            ? `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`
            : "https://www.youtube.com"
          execSync(`start "" "${url}"`, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], shell: "cmd.exe" })
          return { success: true, url }
        } catch (e) {
          return { error: `Не удалось открыть YouTube: ${e.message}` }
        }
      },
    }),

    open_google: tool({
      description: "Открыть Google в браузере.",
      inputSchema: z.object({
        query: z.string().optional().describe("Поисковый запрос"),
      }),
      execute: async ({ query }) => {
        try {
          const url = query
            ? `https://www.google.com/search?q=${encodeURIComponent(query)}`
            : "https://www.google.com"
          execSync(`start "" "${url}"`, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], shell: "cmd.exe" })
          return { success: true, url }
        } catch (e) {
          return { error: `Не удалось открыть Google: ${e.message}` }
        }
      },
    }),

    // ── УПРАВЛЕНИЕ ФАЙЛАМИ ──
    file_open: tool({
      description: "Открыть файл关联ным приложением.",
      inputSchema: z.object({ path: z.string().describe("Путь к файлу") }),
      execute: async ({ path: p }) => {
        try {
          execSync(`start "" "${p}"`, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], shell: "cmd.exe" })
          return { success: true, opened: p }
        } catch (e) {
          return { error: `Не удалось открыть файл: ${e.message}` }
        }
      },
    }),

    file_explorer: tool({
      description: "Открыть папку в проводнике.",
      inputSchema: z.object({ path: z.string().describe("Путь к папке") }),
      execute: async ({ path: p }) => {
        try {
          execSync(`explorer "${p}"`, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] })
          return { success: true, folder: p }
        } catch (e) {
          return { error: `Не удалось открыть папку: ${e.message}` }
        }
      },
    }),

    file_create: tool({
      description: "Создать файл с содержимым.",
      inputSchema: z.object({
        path: z.string().describe("Путь к файлу"),
        content: z.string().describe("Содержимое файла"),
      }),
      execute: async ({ path: p, content }) => {
        try {
          const abs = resolveSafe(p)
          fs.mkdirSync(path.dirname(abs), { recursive: true })
          fs.writeFileSync(abs, content, "utf8")
          return { success: true, created: p }
        } catch (e) {
          return { error: `Не удалось создать файл: ${e.message}` }
        }
      },
    }),

    file_rename: tool({
      description: "Переименовать файл или папку.",
      inputSchema: z.object({
        old_path: z.string().describe("Старый путь"),
        new_path: z.string().describe("Новый путь"),
      }),
      execute: async ({ old_path, new_path }) => {
        try {
          fs.renameSync(resolveSafe(old_path), resolveSafe(new_path))
          return { success: true, from: old_path, to: new_path }
        } catch (e) {
          return { error: `Не удалось переименовать: ${e.message}` }
        }
      },
    }),

    // ── БУФЕР ОБМЕНА ──
    clipboard_get: tool({
      description: "Получить текст из буфера обмена.",
      inputSchema: z.object({}),
      execute: async () => {
        try {
          const text = execSync("powershell -command \"Get-Clipboard\"", { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] })
          return { clipboard: text.trim() }
        } catch (e) {
          return { error: `Не удалось прочитать буфер: ${e.message}` }
        }
      },
    }),

    clipboard_set: tool({
      description: "Скопировать текст в буфер обмена.",
      inputSchema: z.object({ text: z.string().describe("Текст для копирования") }),
      execute: async ({ text }) => {
        try {
          execSync(`powershell -command "Set-Clipboard -Value '${text.replace(/'/g, "''")}'"`, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] })
          return { success: true, copied: text.slice(0, 100) }
        } catch (e) {
          return { error: `Не удалось скопировать: ${e.message}` }
        }
      },
    }),

    // ── СКРИНШОТЫ ──
    screenshot: tool({
      description: "Сделать скриншот экрана и сохранить в файл.",
      inputSchema: z.object({
        path: z.string().optional().describe("Путь для сохранения (по умолчанию screenshot.png)"),
      }),
      execute: async ({ path: p }) => {
        try {
          const savePath = p || resolveSafe("screenshot.png")
          execSync(`powershell -command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Screen]::PrimaryScreen | ForEach-Object { $bounds = $_.Bounds; Add-Type -TypeDefinition 'using System; using System.Drawing; using System.Drawing.Imaging; public class ScreenCapture { public static void Capture(string f) { var bmp = new Bitmap($bounds.Width, $bounds.Height); Graphics.FromImage(bmp).CopyFromScreen($bounds.Location, Point.Empty, $bounds.Size); bmp.Save(f, ImageFormat.Png); } }'; [ScreenCapture]::Capture('${savePath.replace(/\\/g, "\\\\")}')"`, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] })
          return { success: true, saved: savePath }
        } catch (e) {
          return { error: `Не удалось сделать скриншот: ${e.message}` }
        }
      },
    }),

    // ── НАСТРОЙКИ СИСТЕМЫ ──
    volume_set: tool({
      description: "Установить громкость (0-100).",
      inputSchema: z.object({
        level: z.number().describe("Уровень громкости от 0 до 100"),
      }),
      execute: async ({ level }) => {
        try {
          const vol = Math.max(0, Math.min(100, level))
          execSync(`powershell -command "$wsh = New-Object -ComObject WScript.Shell; 1..50 | ForEach-Object { $wsh.SendKeys([char]174) }; 1..${Math.round(vol / 2)} | ForEach-Object { $wsh.SendKeys([char]175) }"`, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] })
          return { success: true, volume: vol }
        } catch (e) {
          return { error: `Не удалось установить громкость: ${e.message}` }
        }
      },
    }),

    volume_mute: tool({
      description: "Включить/выключить звук.",
      inputSchema: z.object({
        mute: z.boolean().describe("true = выключить, false = включить"),
      }),
      execute: async ({ mute }) => {
        try {
          execSync(`powershell -command "$wsh = New-Object -ComObject WScript.Shell; $wsh.SendKeys([char]173)"`, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] })
          return { success: true, muted: mute }
        } catch (e) {
          return { error: `Не удалось изменить звук: ${e.message}` }
        }
      },
    }),

    brightness_set: tool({
      description: "Установить яркость экрана (0-100).",
      inputSchema: z.object({
        level: z.number().describe("Уровень яркости от 0 до 100"),
      }),
      execute: async ({ level }) => {
        try {
          execSync(`powershell -command "Get-WmiObject -Namespace root\\wmi -Class WmiMonitorBrightnessMethods | ForEach-Object { $_.WmiSetBrightness(10, ${level}) }"`, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] })
          return { success: true, brightness: level }
        } catch (e) {
          return { error: `Не удалось установить яркость: ${e.message}` }
        }
      },
    }),

    // ── УПРАВЛЕНИЕ ПРОЦЕССАМИ ──
    process_start: tool({
      description: "Запустить процесс.",
      inputSchema: z.object({
        command: z.string().describe("Команда или путь к приложению"),
      }),
      execute: async ({ command }) => {
        try {
          execSync(`start "" "${command}"`, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], shell: "cmd.exe" })
          return { success: true, started: command }
        } catch (e) {
          return { error: `Не удалось запустить: ${e.message}` }
        }
      },
    }),

    // ── СЕТЬ ──
    wifi_scan: tool({
      description: "Показать доступные Wi-Fi сети.",
      inputSchema: z.object({}),
      execute: async () => {
        try {
          const out = execSync("netsh wlan show networks mode=bssid", { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] })
          return { networks: out }
        } catch (e) {
          return { error: "Не удалось получить список сетей" }
        }
      },
    }),

    wifi_connect: tool({
      description: "Подключиться к Wi-Fi сети.",
      inputSchema: z.object({
        ssid: z.string().describe("Имя сети (SSID)"),
        password: z.string().optional().describe("Пароль"),
      }),
      execute: async ({ ssid, password }) => {
        try {
          if (password) {
            execSync(`netsh wlan connect name="${ssid}"`, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] })
          } else {
            execSync(`netsh wlan connect name="${ssid}"`, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] })
          }
          return { success: true, connected: ssid }
        } catch (e) {
          return { error: `Не удалось подключиться: ${e.message}` }
        }
      },
    }),

    // ── ПРОВЕРКА СИСТЕМЫ ──
    system_info: tool({
      description: "Получить полную информацию о системе.",
      inputSchema: z.object({}),
      execute: async () => {
        try {
          const info = {
            platform: process.platform,
            arch: process.arch,
            nodeVersion: process.version,
            hostname: require("os").hostname(),
            username: require("os").userInfo().username,
            cpus: require("os").cpus().length,
            totalMemory: `${(require("os").totalmem() / 1e9).toFixed(1)} GB`,
            freeMemory: `${(require("os").freemem() / 1e9).toFixed(1)} GB`,
            uptime: `${Math.floor(require("os").uptime() / 3600)}h ${Math.floor((require("os").uptime() % 3600) / 60)}m`,
          }
          return info
        } catch (e) {
          return { error: `Не удалось получить информацию: ${e.message}` }
        }
      },
    }),

    // ── ПЕРЕКЛЮЧЕНИЕ ОКОН ──
    window_list: tool({
      description: "Показать список открытых окон.",
      inputSchema: z.object({}),
      execute: async () => {
        try {
          const out = execSync(`powershell -command "Get-Process | Where-Object {$_.MainWindowTitle -ne ''} | Select-Object ProcessName, MainWindowTitle | Format-Table -AutoSize"`, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] })
          return { windows: out }
        } catch (e) {
          return { error: "Не удалось получить список окон" }
        }
      },
    }),

    window_focus: tool({
      description: "Переключиться на окно приложения.",
      inputSchema: z.object({
        name: z.string().describe("Имя приложения или заголовок окна"),
      }),
      execute: async ({ name }) => {
        try {
          execSync(`powershell -command "Get-Process | Where-Object {$_.MainWindowTitle -like '*${name}*'} | ForEach-Object { $_.MainWindowHandle } | ForEach-Object { Add-Type 'user32.dll'; [User32]::SetForegroundWindow($_) }"`, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] })
          return { success: true, focused: name }
        } catch (e) {
          return { error: `Не удалось переключиться на окно: ${e.message}` }
        }
      },
    }),

    // ── ВВОД ТЕКСТА ──
    type_text: tool({
      description: "Набрать текст на клавиатуре (имитация ввода).",
      inputSchema: z.object({
        text: z.string().describe("Текст для набора"),
      }),
      execute: async ({ text }) => {
        try {
          execSync(`powershell -command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${text.replace(/'/g, "''").replace(/"/g, '""')}')"`, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] })
          return { success: true, typed: text.slice(0, 50) }
        } catch (e) {
          return { error: `Не удалось набрать текст: ${e.message}` }
        }
      },
    }),

    press_key: tool({
      description: "Нажать клавишу или комбинацию клавиш.",
      inputSchema: z.object({
        key: z.string().describe("Клавиша (enter, tab, esc, delete, F5, ^c, ^v, ^s, ^a, ^z)"),
      }),
      execute: async ({ key }) => {
        try {
          execSync(`powershell -command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${key}')"`, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] })
          return { success: true, pressed: key }
        } catch (e) {
          return { error: `Не удалось нажать клавишу: ${e.message}` }
        }
      },
    }),

    // ── УВЕДОМЛЕНИЯ ──
    notify: tool({
      description: "Показать уведомление Windows.",
      inputSchema: z.object({
        title: z.string().describe("Заголовок уведомления"),
        message: z.string().describe("Текст уведомления"),
      }),
      execute: async ({ title, message }) => {
        try {
          execSync(`powershell -command "[System.Reflection.Assembly]::LoadWithPartialName('System.Windows.Forms'); $notify = New-Object System.Windows.Forms.NotifyIcon; $notify.Icon = [System.Drawing.SystemIcons]::Information; $notify.BalloonTipTitle = '${title}'; $notify.BalloonTipText = '${message}'; $notify.Visible = $true; $notify.ShowBalloonTip(5000)"`, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] })
          return { success: true, title, message }
        } catch (e) {
          return { error: `Не удалось показать уведомление: ${e.message}` }
        }
      },
    }),

    // ── СЛУЖЕБНЫЕ ──
    lock_screen: tool({
      description: "Заблокировать экран.",
      inputSchema: z.object({}),
      execute: async () => {
        try {
          execSync("rundll32.exe user32.dll,LockWorkStation", { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] })
          return { success: true }
        } catch (e) {
          return { error: `Не удалось заблокировать экран: ${e.message}` }
        }
      },
    }),

    shutdown: tool({
      description: "Выключить/перезагрузить компьютер.",
      inputSchema: z.object({
        action: z.enum(["shutdown", "restart", "sleep", "hibernate"]).describe("Действие"),
        delay: z.number().optional().describe("Задержка в секундах (по умолчанию 0)"),
      }),
      execute: async ({ action, delay = 0 }) => {
        try {
          const cmds = {
            shutdown: `shutdown /s /t ${delay}`,
            restart: `shutdown /r /t ${delay}`,
            sleep: "rundll32.exe powrprof.dll,SetSuspendState 0,1,0",
            hibernate: "rundll32.exe powrprof.dll,SetSuspendState",
          }
          execSync(cmds[action], { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] })
          return { success: true, action }
        } catch (e) {
          return { error: `Не удалось выполнить: ${e.message}` }
        }
      },
    }),

    cancel_shutdown: tool({
      description: "Отменить запланированное выключение/перезагрузку.",
      inputSchema: z.object({}),
      execute: async () => {
        try {
          execSync("shutdown /a", { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] })
          return { success: true }
        } catch (e) {
          return { error: `Не удалось отменить: ${e.message}` }
        }
      },
    }),

    // ── ПОИСК ──
    search_files: tool({
      description: "Быстрый поиск файлов по имени.",
      inputSchema: z.object({
        query: z.string().describe("Имя файла или паттерн"),
        path: z.string().optional().describe("Директория поиска"),
      }),
      execute: async ({ query, path: p = "C:\\" }) => {
        try {
          const out = execSync(`dir /s /b "${p}\\*${query}*"` , { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], timeout: 10000 })
          const files = out.split("\n").filter(f => f.trim()).slice(0, 50)
          return { files, total: files.length }
        } catch (e) {
          return { error: "Поиск занял слишком много времени" }
        }
      },
    }),

    search_text: tool({
      description: "Поиск текста в файлах (grep).",
      inputSchema: z.object({
        query: z.string().describe("Текст для поиска"),
        path: z.string().optional().describe("Директория поиска"),
        glob: z.string().optional().describe("Фильтр файлов (*.js, *.ts)"),
      }),
      execute: async ({ query, path: p = ".", glob: g }) => {
        try {
          const filter = g ? `/S "${g}"` : "/S *.*"
          const out = execSync(`findstr /N /I /S "${query}" "${p}\\${g || '*.*'}"` , { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], timeout: 15000 })
          const lines = out.split("\n").filter(l => l.trim()).slice(0, 100)
          return { matches: lines, total: lines.length }
        } catch (e) {
          return { error: "Поиск не дал результатов" }
        }
      },
    }),

    // ═══════════════════════════════════════════════════════════════
    //  ПОЛНОЕ УПРАВЛЕНИЕ СЕРВЕРОМ / ТЕРМИНАЛ
    // ═══════════════════════════════════════════════════════════════

    // ── ТЕРМИНАЛ И КОМАНДЫ ──
    terminal_exec: tool({
      description: "Выполнить команду в терминале. Полный доступ к системе.",
      inputSchema: z.object({
        command: z.string().describe("Команда для выполнения"),
        cwd: z.string().optional().describe("Рабочая директория"),
        timeout: z.number().optional().describe("Таймаут в мс (по умолчанию 60000)"),
      }),
      execute: async ({ command, cwd, timeout = 60000 }) => {
        try {
          const out = execSync(command, {
            encoding: "utf8",
            timeout,
            maxBuffer: 50 * 1024 * 1024,
            cwd: cwd || process.cwd(),
            stdio: ["pipe", "pipe", "pipe"],
          })
          return { output: out || "(пустой вывод)", exitCode: 0 }
        } catch (e) {
          return {
            output: String(e.stdout || ""),
            error: String(e.stderr || e.message),
            exitCode: e.status ?? 1,
          }
        }
      },
    }),

    terminal_powershell: tool({
      description: "Выполнить PowerShell команду.",
      inputSchema: z.object({
        command: z.string().describe("PowerShell команда"),
        execution_policy: z.boolean().optional().describe("Bypass execution policy"),
      }),
      execute: async ({ command, execution_policy = true }) => {
        try {
          const policy = execution_policy ? "-ExecutionPolicy Bypass" : ""
          const out = execSync(`powershell ${policy} -Command "${command.replace(/"/g, '\\"')}"`, {
            encoding: "utf8",
            timeout: 60000,
            maxBuffer: 50 * 1024 * 1024,
            stdio: ["pipe", "pipe", "pipe"],
          })
          return { output: out || "(пустой вывод)", exitCode: 0 }
        } catch (e) {
          return {
            output: String(e.stdout || ""),
            error: String(e.stderr || e.message),
            exitCode: e.status ?? 1,
          }
        }
      },
    }),

    terminal_cmd: tool({
      description: "Выполнить cmd команду.",
      inputSchema: z.object({
        command: z.string().describe("cmd команда"),
      }),
      execute: async ({ command }) => {
        try {
          const out = execSync(`cmd /c "${command}"`, {
            encoding: "utf8",
            timeout: 60000,
            maxBuffer: 50 * 1024 * 1024,
            stdio: ["pipe", "pipe", "pipe"],
          })
          return { output: out || "(пустой вывод)", exitCode: 0 }
        } catch (e) {
          return {
            output: String(e.stdout || ""),
            error: String(e.stderr || e.message),
            exitCode: e.status ?? 1,
          }
        }
      },
    }),

    // ── УПРАВЛЕНИЕ СЕРВЕРОМ ──
    server_status: tool({
      description: "Показать статус сервера: порты, соединения, ресурсы.",
      inputSchema: z.object({}),
      execute: async () => {
        try {
          const netstat = execSync("netstat -ano", { encoding: "utf8", timeout: 10000, stdio: ["pipe", "pipe", "pipe"] })
          const connections = netstat.split("\n").filter(l => l.includes("ESTABLISHED")).length
          const listening = netstat.split("\n").filter(l => l.includes("LISTENING")).length

          const cpuUsage = execSync("wmic cpu get loadpercentage /value", { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] })
          const cpuMatch = cpuUsage.match(/LoadPercentage=(\d+)/)
          const cpu = cpuMatch ? parseInt(cpuMatch[1]) : 0

          const memInfo = execSync("wmic OS get FreePhysicalMemory,TotalVisibleMemorySize /value", { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] })
          const totalMemMatch = memInfo.match(/TotalVisibleMemorySize=(\d+)/)
          const freeMemMatch = memInfo.match(/FreePhysicalMemory=(\d+)/)
          const totalMem = totalMemMatch ? parseInt(totalMemMatch[1]) / 1024 / 1024 : 0
          const freeMem = freeMemMatch ? parseInt(freeMemMatch[1]) / 1024 / 1024 : 0
          const usedMem = totalMem - freeMem

          const uptime = execSync("systeminfo | findstr /C:\"System Boot Time\"", { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] })

          return {
            connections,
            listening,
            cpu: `${cpu}%`,
            memory: `${usedMem.toFixed(1)} / ${totalMem.toFixed(1)} GB (${((usedMem / totalMem) * 100).toFixed(1)}%)`,
            uptime: uptime.trim(),
          }
        } catch (e) {
          return { error: `Не удалось получить статус: ${e.message}` }
        }
      },
    }),

    server_ports: tool({
      description: "Показать открытые порты и процессы.",
      inputSchema: z.object({}),
      execute: async () => {
        try {
          const out = execSync("netstat -ano | findstr LISTENING", { encoding: "utf8", timeout: 10000, stdio: ["pipe", "pipe", "pipe"] })
          const lines = out.split("\n").filter(l => l.trim()).slice(0, 50)
          return { ports: lines, total: lines.length }
        } catch (e) {
          return { error: "Не удалось получить порты" }
        }
      },
    }),

    server_connections: tool({
      description: "Показать активные соединения.",
      inputSchema: z.object({}),
      execute: async () => {
        try {
          const out = execSync("netstat -ano | findstr ESTABLISHED", { encoding: "utf8", timeout: 10000, stdio: ["pipe", "pipe", "pipe"] })
          const lines = out.split("\n").filter(l => l.trim()).slice(0, 50)
          return { connections: lines, total: lines.length }
        } catch (e) {
          return { error: "Не удалось получить соединения" }
        }
      },
    }),

    server_kill_port: tool({
      description: "Завершить процесс на порту.",
      inputSchema: z.object({
        port: z.number().describe("Номер порта"),
      }),
      execute: async ({ port }) => {
        try {
          const out = execSync(`netstat -ano | findstr :${port}`, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] })
          const lines = out.split("\n").filter(l => l.includes("LISTENING"))
          if (lines.length === 0) return { error: `Порт ${port} не используется` }

          const pidMatch = lines[0].match(/(\d+)\s*$/)
          if (!pidMatch) return { error: "Не удалось определить PID" }

          const pid = pidMatch[1]
          execSync(`taskkill /F /PID ${pid}`, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] })
          return { success: true, port, pid, killed: true }
        } catch (e) {
          return { error: `Не удалось завершить процесс: ${e.message}` }
        }
      },
    }),

    // ── СЕТЬ ──
    network_interfaces: tool({
      description: "Показать сетевые интерфейсы.",
      inputSchema: z.object({}),
      execute: async () => {
        try {
          const out = execSync("ipconfig /all", { encoding: "utf8", timeout: 10000, stdio: ["pipe", "pipe", "pipe"] })
          return { interfaces: out }
        } catch (e) {
          return { error: "Не удалось получить интерфейсы" }
        }
      },
    }),

    network_dhcp: tool({
      description: "Показать/обновить DHCP настройки.",
      inputSchema: z.object({
        action: z.enum(["release", "renew", "show"]).describe("Действие"),
      }),
      execute: async ({ action }) => {
        try {
          const cmds = {
            release: "ipconfig /release",
            renew: "ipconfig /renew",
            show: "ipconfig",
          }
          const out = execSync(cmds[action], { encoding: "utf8", timeout: 30000, stdio: ["pipe", "pipe", "pipe"] })
          return { output: out, action }
        } catch (e) {
          return { error: `Не удалось выполнить: ${e.message}` }
        }
      },
    }),

    network_dns: tool({
      description: "Показать/изменить DNS серверы.",
      inputSchema: z.object({
        action: z.enum(["show", "flush", "set"]).describe("Действие"),
        server: z.string().optional().describe("DNS сервер (для set)"),
      }),
      execute: async ({ action, server }) => {
        try {
          if (action === "flush") {
            execSync("ipconfig /flushdns", { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] })
            return { success: true, action: "flush" }
          }
          if (action === "set" && server) {
            execSync(`netsh interface ip set dns "Wi-Fi" static ${server}`, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] })
            return { success: true, action: "set", server }
          }
          const out = execSync("ipconfig /displaydns", { encoding: "utf8", timeout: 10000, stdio: ["pipe", "pipe", "pipe"] })
          return { dns: out.slice(0, 5000) }
        } catch (e) {
          return { error: `Не удалось: ${e.message}` }
        }
      },
    }),

    network_ping: tool({
      description: "Пинговать хост.",
      inputSchema: z.object({
        host: z.string().describe("Хост или IP"),
        count: z.number().optional().describe("Количество пингов (по умолчанию 4)"),
      }),
      execute: async ({ host, count = 4 }) => {
        try {
          const out = execSync(`ping -n ${count} ${host}`, { encoding: "utf8", timeout: 30000, stdio: ["pipe", "pipe", "pipe"] })
          return { output: out }
        } catch (e) {
          return { error: `Пинг не удался: ${e.message}` }
        }
      },
    }),

    network_traceroute: tool({
      description: "Трассировка маршрута до хоста.",
      inputSchema: z.object({
        host: z.string().describe("Хост или IP"),
      }),
      execute: async ({ host }) => {
        try {
          const out = execSync(`tracert -d ${host}`, { encoding: "utf8", timeout: 60000, stdio: ["pipe", "pipe", "pipe"] })
          return { trace: out }
        } catch (e) {
          return { error: `Трассировка не удалась: ${e.message}` }
        }
      },
    }),

    network_download: tool({
      description: "Скачать файл по URL.",
      inputSchema: z.object({
        url: z.string().describe("URL файла"),
        dest: z.string().optional().describe("Путь сохранения"),
      }),
      execute: async ({ url, dest }) => {
        try {
          const destPath = dest || url.split("/").pop()
          execSync(`curl -L -o "${destPath}" "${url}"`, { encoding: "utf8", timeout: 120000, stdio: ["pipe", "pipe", "pipe"] })
          return { success: true, downloaded: destPath, url }
        } catch (e) {
          return { error: `Не удалось скачать: ${e.message}` }
        }
      },
    }),

    network_upload: tool({
      description: "Загрузить файл на сервер.",
      inputSchema: z.object({
        file: z.string().describe("Путь к файлу"),
        url: z.string().describe("URL для загрузки"),
        method: z.enum(["PUT", "POST"]).optional().describe("HTTP метод"),
      }),
      execute: async ({ file, url, method = "PUT" }) => {
        try {
          execSync(`curl -X ${method} -T "${file}" "${url}"`, { encoding: "utf8", timeout: 120000, stdio: ["pipe", "pipe", "pipe"] })
          return { success: true, uploaded: file, url, method }
        } catch (e) {
          return { error: `Не удалось загрузить: ${e.message}` }
        }
      },
    }),

    network_http_server: tool({
      description: "Запустить HTTP сервер на указанном порту.",
      inputSchema: z.object({
        port: z.number().describe("Порт сервера"),
        dir: z.string().optional().describe("Директория для раздачи"),
      }),
      execute: async ({ port, dir = "." }) => {
        try {
          const { spawn } = await import("node:child_process")
          const server = spawn("python", ["-m", "http.server", String(port)], {
            cwd: dir,
            detached: true,
            stdio: "ignore",
          })
          server.unref()
          return { success: true, port, pid: server.pid, dir }
        } catch (e) {
          return { error: `Не удалось запустить сервер: ${e.message}` }
        }
      },
    }),

    // ── БАЗЫ ДАННЫХ ──
    db_mysql: tool({
      description: "Выполнить MySQL запрос.",
      inputSchema: z.object({
        host: z.string().optional().describe("Хост (по умолчанию localhost)"),
        user: z.string().optional().describe("Пользователь"),
        password: z.string().optional().describe("Пароль"),
        database: z.string().optional().describe("База данных"),
        query: z.string().describe("SQL запрос"),
      }),
      execute: async ({ host = "localhost", user = "root", password = "", database = "", query }) => {
        try {
          const passArg = password ? `-p"${password}"` : ""
          const dbArg = database ? `-D ${database}` : ""
          const out = execSync(`mysql -h ${host} -u ${user} ${passArg} ${dbArg} -e "${query.replace(/"/g, '\\"')}"`, {
            encoding: "utf8",
            timeout: 30000,
            stdio: ["pipe", "pipe", "pipe"],
          })
          return { result: out }
        } catch (e) {
          return { error: `MySQL ошибка: ${e.message}` }
        }
      },
    }),

    db_postgres: tool({
      description: "Выполнить PostgreSQL запрос.",
      inputSchema: z.object({
        host: z.string().optional().describe("Хост"),
        user: z.string().optional().describe("Пользователь"),
        database: z.string().optional().describe("База данных"),
        query: z.string().describe("SQL запрос"),
      }),
      execute: async ({ host = "localhost", user = "postgres", database = "postgres", query }) => {
        try {
          const out = execSync(`psql -h ${host} -U ${user} -d ${database} -c "${query.replace(/"/g, '\\"')}"`, {
            encoding: "utf8",
            timeout: 30000,
            stdio: ["pipe", "pipe", "pipe"],
          })
          return { result: out }
        } catch (e) {
          return { error: `PostgreSQL ошибка: ${e.message}` }
        }
      },
    }),

    db_redis: tool({
      description: "Выполнить Redis команду.",
      inputSchema: z.object({
        host: z.string().optional().describe("Хост"),
        port: z.number().optional().describe("Порт"),
        command: z.string().describe("Redis команда"),
      }),
      execute: async ({ host = "localhost", port = 6379, command }) => {
        try {
          const out = execSync(`redis-cli -h ${host} -p ${port} ${command}`, {
            encoding: "utf8",
            timeout: 10000,
            stdio: ["pipe", "pipe", "pipe"],
          })
          return { result: out }
        } catch (e) {
          return { error: `Redis ошибка: ${e.message}` }
        }
      },
    }),

    db_mongo: tool({
      description: "Выполнить MongoDB запрос.",
      inputSchema: z.object({
        uri: z.string().optional().describe("URI подключения"),
        query: z.string().describe("MongoDB команда"),
      }),
      execute: async ({ uri = "mongodb://localhost:27017", query }) => {
        try {
          const out = execSync(`mongosh "${uri}" --eval "${query.replace(/"/g, '\\"')}"`, {
            encoding: "utf8",
            timeout: 30000,
            stdio: ["pipe", "pipe", "pipe"],
          })
          return { result: out }
        } catch (e) {
          return { error: `MongoDB ошибка: ${e.message}` }
        }
      },
    }),

    // ── DOCKER ──
    docker_ps: tool({
      description: "Показать запущенные Docker контейнеры.",
      inputSchema: z.object({
        all: z.boolean().optional().describe("Показать все контейнеры"),
      }),
      execute: async ({ all = false }) => {
        try {
          const flag = all ? "-a" : ""
          const out = execSync(`docker ps ${flag}`, { encoding: "utf8", timeout: 10000, stdio: ["pipe", "pipe", "pipe"] })
          return { containers: out }
        } catch (e) {
          return { error: `Docker ошибка: ${e.message}` }
        }
      },
    }),

    docker_run: tool({
      description: "Запустить Docker контейнер.",
      inputSchema: z.object({
        image: z.string().describe("Образ"),
        name: z.string().optional().describe("Имя контейнера"),
        ports: z.string().optional().describe("Порты (-p 8080:80)"),
        detach: z.boolean().optional().describe("Запустить в фоне"),
      }),
      execute: async ({ image, name, ports, detach = true }) => {
        try {
          let cmd = "docker run"
          if (detach) cmd += " -d"
          if (name) cmd += ` --name ${name}`
          if (ports) cmd += ` -p ${ports}`
          cmd += ` ${image}`
          const out = execSync(cmd, { encoding: "utf8", timeout: 120000, stdio: ["pipe", "pipe", "pipe"] })
          return { success: true, containerId: out.trim(), image }
        } catch (e) {
          return { error: `Docker ошибка: ${e.message}` }
        }
      },
    }),

    docker_stop: tool({
      description: "Остановить Docker контейнер.",
      inputSchema: z.object({
        container: z.string().describe("ID или имя контейнера"),
      }),
      execute: async ({ container }) => {
        try {
          execSync(`docker stop ${container}`, { encoding: "utf8", timeout: 30000, stdio: ["pipe", "pipe", "pipe"] })
          return { success: true, stopped: container }
        } catch (e) {
          return { error: `Docker ошибка: ${e.message}` }
        }
      },
    }),

    docker_logs: tool({
      description: "Показать логи Docker контейнера.",
      inputSchema: z.object({
        container: z.string().describe("ID или имя контейнера"),
        lines: z.number().optional().describe("Количество строк"),
      }),
      execute: async ({ container, lines = 100 }) => {
        try {
          const out = execSync(`docker logs --tail ${lines} ${container}`, { encoding: "utf8", timeout: 10000, stdio: ["pipe", "pipe", "pipe"] })
          return { logs: out }
        } catch (e) {
          return { error: `Docker ошибка: ${e.message}` }
        }
      },
    }),

    docker_exec: tool({
      description: "Выполнить команду в контейнере.",
      inputSchema: z.object({
        container: z.string().describe("ID или имя контейнера"),
        command: z.string().describe("Команда"),
      }),
      execute: async ({ container, command }) => {
        try {
          const out = execSync(`docker exec ${container} ${command}`, { encoding: "utf8", timeout: 60000, stdio: ["pipe", "pipe", "pipe"] })
          return { output: out }
        } catch (e) {
          return { error: `Docker ошибка: ${e.message}` }
        }
      },
    }),

    // ── PM2 / NODE.JS ──
    pm2_list: tool({
      description: "Показать PM2 процессы.",
      inputSchema: z.object({}),
      execute: async () => {
        try {
          const out = execSync("pm2 list", { encoding: "utf8", timeout: 10000, stdio: ["pipe", "pipe", "pipe"] })
          return { processes: out }
        } catch (e) {
          return { error: `PM2 ошибка: ${e.message}` }
        }
      },
    }),

    pm2_start: tool({
      description: "Запустить приложение через PM2.",
      inputSchema: z.object({
        script: z.string().describe("Путь к скрипту"),
        name: z.string().optional().describe("Имя процесса"),
      }),
      execute: async ({ script, name }) => {
        try {
          let cmd = `pm2 start ${script}`
          if (name) cmd += ` --name ${name}`
          const out = execSync(cmd, { encoding: "utf8", timeout: 30000, stdio: ["pipe", "pipe", "pipe"] })
          return { success: true, output: out }
        } catch (e) {
          return { error: `PM2 ошибка: ${e.message}` }
        }
      },
    }),

    pm2_stop: tool({
      description: "Остановить PM2 процесс.",
      inputSchema: z.object({
        name: z.string().describe("Имя или ID процесса"),
      }),
      execute: async ({ name }) => {
        try {
          execSync(`pm2 stop ${name}`, { encoding: "utf8", timeout: 10000, stdio: ["pipe", "pipe", "pipe"] })
          return { success: true, stopped: name }
        } catch (e) {
          return { error: `PM2 ошибка: ${e.message}` }
        }
      },
    }),

    pm2_logs: tool({
      description: "Показать логи PM2.",
      inputSchema: z.object({
        name: z.string().optional().describe("Имя процесса"),
        lines: z.number().optional().describe("Количество строк"),
      }),
      execute: async ({ name, lines = 50 }) => {
        try {
          const target = name || ""
          const out = execSync(`pm2 logs ${target} --lines ${lines} --nostream`, { encoding: "utf8", timeout: 10000, stdio: ["pipe", "pipe", "pipe"] })
          return { logs: out }
        } catch (e) {
          return { error: `PM2 ошибка: ${e.message}` }
        }
      },
    }),

    // ── SYSTEMD / СЛУЖБЫ WINDOWS ──
    service_list: tool({
      description: "Показать запущенные службы Windows.",
      inputSchema: z.object({}),
      execute: async () => {
        try {
          const out = execSync("net start", { encoding: "utf8", timeout: 10000, stdio: ["pipe", "pipe", "pipe"] })
          const services = out.split("\n").filter(l => l.trim()).slice(0, 50)
          return { services, total: services.length }
        } catch (e) {
          return { error: "Не удалось получить службы" }
        }
      },
    }),

    service_start: tool({
      description: "Запустить службу Windows.",
      inputSchema: z.object({
        name: z.string().describe("Имя службы"),
      }),
      execute: async ({ name }) => {
        try {
          execSync(`net start "${name}"`, { encoding: "utf8", timeout: 30000, stdio: ["pipe", "pipe", "pipe"] })
          return { success: true, started: name }
        } catch (e) {
          return { error: `Не удалось запустить: ${e.message}` }
        }
      },
    }),

    service_stop: tool({
      description: "Остановить службу Windows.",
      inputSchema: z.object({
        name: z.string().describe("Имя службы"),
      }),
      execute: async ({ name }) => {
        try {
          execSync(`net stop "${name}"`, { encoding: "utf8", timeout: 30000, stdio: ["pipe", "pipe", "pipe"] })
          return { success: true, stopped: name }
        } catch (e) {
          return { error: `Не удалось остановить: ${e.message}` }
        }
      },
    }),

    // ── РЕЕСТР ──
    registry_read: tool({
      description: "Прочитать значение из реестра Windows.",
      inputSchema: z.object({
        key: z.string().describe("Путь к ключу (HKLM\\SOFTWARE\\...)"),
        value: z.string().optional().describe("Имя значения"),
      }),
      execute: async ({ key, value }) => {
        try {
          const valArg = value ? `/v "${value}"` : ""
          const out = execSync(`reg query "${key}" ${valArg}`, { encoding: "utf8", timeout: 10000, stdio: ["pipe", "pipe", "pipe"] })
          return { result: out }
        } catch (e) {
          return { error: `Не удалось прочитать реестр: ${e.message}` }
        }
      },
    }),

    registry_write: tool({
      description: "Записать значение в реестр Windows.",
      inputSchema: z.object({
        key: z.string().describe("Путь к ключу"),
        value: z.string().describe("Имя значения"),
        type: z.string().optional().describe("Тип (REG_SZ, REG_DWORD, etc)"),
        data: z.string().describe("Данные"),
      }),
      execute: async ({ key, value, type = "REG_SZ", data }) => {
        try {
          execSync(`reg add "${key}" /v "${value}" /t ${type} /d "${data}" /f`, { encoding: "utf8", timeout: 10000, stdio: ["pipe", "pipe", "pipe"] })
          return { success: true, key, value, data }
        } catch (e) {
          return { error: `Не удалось записать в реестр: ${e.message}` }
        }
      },
    }),

    // ── СКРИПТЫ И АВТОМАТИЗАЦИЯ ──
    script_run: tool({
      description: "Запустить скрипт (.ps1, .bat, .cmd, .sh, .py, .js).",
      inputSchema: z.object({
        path: z.string().describe("Путь к скрипту"),
        args: z.string().optional().describe("Аргументы"),
      }),
      execute: async ({ path: p, args = "" }) => {
        try {
          const ext = p.split(".").pop().toLowerCase()
          const runners = {
            ps1: "powershell -ExecutionPolicy Bypass -File",
            bat: "",
            cmd: "",
            sh: "bash",
            py: "python",
            js: "node",
            mjs: "node",
          }
          const runner = runners[ext] || ""
          const cmd = runner ? `${runner} "${p}" ${args}` : `"${p}" ${args}`
          const out = execSync(cmd, { encoding: "utf8", timeout: 120000, stdio: ["pipe", "pipe", "pipe"] })
          return { output: out, script: p }
        } catch (e) {
          return { error: `Ошибка скрипта: ${e.message}` }
        }
      },
    }),

    script_schedule: tool({
      description: "Запланировать выполнение скрипта по расписанию.",
      inputSchema: z.object({
        script: z.string().describe("Путь к скрипту"),
        schedule: z.string().describe("Расписание (daily, weekly, once, onlogon)"),
        time: z.string().optional().describe("Время (HH:MM)"),
        name: z.string().optional().describe("Имя задачи"),
      }),
      execute: async ({ script, schedule, time = "09:00", name }) => {
        try {
          const taskName = name || `Stella_${Date.now()}`
          execSync(`schtasks /create /tn "${taskName}" /tr "${script}" /sc ${schedule} /st ${time} /f`, {
            encoding: "utf8",
            timeout: 10000,
            stdio: ["pipe", "pipe", "pipe"],
          })
          return { success: true, taskName, script, schedule, time }
        } catch (e) {
          return { error: `Не удалось запланировать: ${e.message}` }
        }
      },
    }),

    script_cron: tool({
      description: "Показать/добавить cron запись (Linux/WSL).",
      inputSchema: z.object({
        action: z.enum(["list", "add", "remove"]).describe("Действие"),
        entry: z.string().optional().describe("Cron запись (для add)"),
      }),
      execute: async ({ action, entry }) => {
        try {
          if (action === "list") {
            const out = execSync("crontab -l", { encoding: "utf8", timeout: 5000, stdio: ["pipe", "pipe", "pipe"] })
            return { crontab: out }
          }
          if (action === "add" && entry) {
            execSync(`(crontab -l 2>/dev/null; echo "${entry}") | crontab -`, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] })
            return { success: true, added: entry }
          }
          return { error: "Неверные аргументы" }
        } catch (e) {
          return { error: `Cron ошибка: ${e.message}` }
        }
      },
    }),

    // ── МОНИТОРИНГ ──
    monitor_cpu: tool({
      description: "Мониторинг CPU в реальном времени.",
      inputSchema: z.object({
        duration: z.number().optional().describe("Длительность в секундах"),
      }),
      execute: async ({ duration = 5 }) => {
        try {
          const out = execSync(`powershell -command "1..${duration} | ForEach-Object { (Get-WmiObject Win32_Processor).LoadMeasure; Start-Sleep 1 }"`, {
            encoding: "utf8",
            timeout: (duration + 5) * 1000,
            stdio: ["pipe", "pipe", "pipe"],
          })
          return { cpu_usage: out.split("\n").filter(l => l.trim()) }
        } catch (e) {
          return { error: `Не удалось мониторить CPU: ${e.message}` }
        }
      },
    }),

    monitor_disk: tool({
      description: "Мониторинг дисковой активности.",
      inputSchema: z.object({}),
      execute: async () => {
        try {
          const out = execSync("wmic diskdrive get size,freespace,model,status", { encoding: "utf8", timeout: 10000, stdio: ["pipe", "pipe", "pipe"] })
          return { disks: out }
        } catch (e) {
          return { error: "Не удалось получить информацию о дисках" }
        }
      },
    }),

    monitor_network: tool({
      description: "Мониторинг сетевой активности.",
      inputSchema: z.object({}),
      execute: async () => {
        try {
          const out = execSync("netstat -e", { encoding: "utf8", timeout: 10000, stdio: ["pipe", "pipe", "pipe"] })
          return { stats: out }
        } catch (e) {
          return { error: "Не удалось получить сетевую статистику" }
        }
      },
    }),

    // ── БЕЗОПАСНОСТЬ СЕРВЕРА ──
    firewall_status: tool({
      description: "Показать статус файрвола.",
      inputSchema: z.object({}),
      execute: async () => {
        try {
          const out = execSync("netsh advfirewall show allprofiles state", { encoding: "utf8", timeout: 10000, stdio: ["pipe", "pipe", "pipe"] })
          return { firewall: out }
        } catch (e) {
          return { error: "Не удалось получить статус файрвола" }
        }
      },
    }),

    firewall_block: tool({
      description: "Заблокировать порт в файрволе.",
      inputSchema: z.object({
        port: z.number().describe("Номер порта"),
        protocol: z.string().optional().describe("TCP или UDP"),
      }),
      execute: async ({ port, protocol = "TCP" }) => {
        try {
          execSync(`netsh advfirewall firewall add rule name="Block ${port}" dir=in action=block protocol=${protocol} localport=${port}`, {
            encoding: "utf8",
            timeout: 10000,
            stdio: ["pipe", "pipe", "pipe"],
          })
          return { success: true, blocked: port, protocol }
        } catch (e) {
          return { error: `Не удалось заблокировать: ${e.message}` }
        }
      },
    }),

    firewall_allow: tool({
      description: "Разрешить порт в файрволе.",
      inputSchema: z.object({
        port: z.number().describe("Номер порта"),
        protocol: z.string().optional().describe("TCP или UDP"),
      }),
      execute: async ({ port, protocol = "TCP" }) => {
        try {
          execSync(`netsh advfirewall firewall add rule name="Allow ${port}" dir=in action=allow protocol=${protocol} localport=${port}`, {
            encoding: "utf8",
            timeout: 10000,
            stdio: ["pipe", "pipe", "pipe"],
          })
          return { success: true, allowed: port, protocol }
        } catch (e) {
          return { error: `Не удалось разрешить: ${e.message}` }
        }
      },
    }),

    // ── SSH ──
    ssh_connect: tool({
      description: "Подключиться по SSH к серверу.",
      inputSchema: z.object({
        host: z.string().describe("Хост"),
        user: z.string().optional().describe("Пользователь"),
        port: z.number().optional().describe("Порт"),
        command: z.string().optional().describe("Команда для выполнения"),
      }),
      execute: async ({ host, user = "root", port = 22, command }) => {
        try {
          const cmd = command
            ? `ssh -p ${port} ${user}@${host} "${command}"`
            : `ssh -p ${port} ${user}@${host}`
          const out = execSync(cmd, { encoding: "utf8", timeout: 60000, stdio: ["pipe", "pipe", "pipe"] })
          return { output: out, host, user }
        } catch (e) {
          return { error: `SSH ошибка: ${e.message}` }
        }
      },
    }),

    ssh_copy: tool({
      description: "Копировать файлы по SCP.",
      inputSchema: z.object({
        local: z.string().describe("Локальный путь"),
        remote: z.string().describe("Удалённый путь (user@host:path)"),
      }),
      execute: async ({ local, remote }) => {
        try {
          execSync(`scp "${local}" ${remote}`, { encoding: "utf8", timeout: 120000, stdio: ["pipe", "pipe", "pipe"] })
          return { success: true, local, remote }
        } catch (e) {
          return { error: `SCP ошибка: ${e.message}` }
        }
      },
    }),

    // ── NPM / YARN / PNPM ──
    npm_scripts: tool({
      description: "Показать npm скрипты проекта.",
      inputSchema: z.object({}),
      execute: async () => {
        try {
          const pkgPath = path.join(process.cwd(), "package.json")
          if (!fs.existsSync(pkgPath)) return { error: "package.json не найден" }
          const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"))
          return { scripts: pkg.scripts || {}, name: pkg.name }
        } catch (e) {
          return { error: `Ошибка: ${e.message}` }
        }
      },
    }),

    npm_install: tool({
      description: "Установить npm зависимости.",
      inputSchema: z.object({
        package: z.string().optional().describe("Имя пакета (пусто = все)"),
        dev: z.boolean().optional().describe("Dev зависимости"),
      }),
      execute: async ({ package: pkg, dev }) => {
        try {
          const pkgManager = fs.existsSync(path.join(process.cwd(), "pnpm-lock.yaml")) ? "pnpm"
            : fs.existsSync(path.join(process.cwd(), "yarn.lock")) ? "yarn" : "npm"
          let cmd = `${pkgManager} install`
          if (pkg) cmd += ` ${pkg}`
          if (dev && pkgManager === "npm") cmd += " --save-dev"
          const out = execSync(cmd, { encoding: "utf8", timeout: 300000, stdio: ["pipe", "pipe", "pipe"] })
          return { success: true, manager: pkgManager, output: out.slice(-500) }
        } catch (e) {
          return { error: `Ошибка установки: ${e.message}` }
        }
      },
    }),

    npm_run: tool({
      description: "Запустить npm скрипт.",
      inputSchema: z.object({
        script: z.string().describe("Имя скрипта"),
      }),
      execute: async ({ script }) => {
        try {
          const pkgManager = fs.existsSync(path.join(process.cwd(), "pnpm-lock.yaml")) ? "pnpm"
            : fs.existsSync(path.join(process.cwd(), "yarn.lock")) ? "yarn" : "npm"
          const out = execSync(`${pkgManager} run ${script}`, { encoding: "utf8", timeout: 300000, stdio: ["pipe", "pipe", "pipe"] })
          return { output: out, script }
        } catch (e) {
          return { error: `Ошибка: ${e.message}` }
        }
      },
    }),

    // ── GIT SERVER ──
    git_remote_add: tool({
      description: "Добавить git remote.",
      inputSchema: z.object({
        name: z.string().describe("Имя remote"),
        url: z.string().describe("URL репозитория"),
      }),
      execute: async ({ name, url }) => {
        try {
          execSync(`git remote add ${name} ${url}`, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] })
          return { success: true, name, url }
        } catch (e) {
          return { error: `Ошибка: ${e.message}` }
        }
      },
    }),

    git_push_force: tool({
      description: "Force push (опасно!).",
      inputSchema: z.object({
        branch: z.string().optional().describe("Ветка"),
      }),
      execute: async ({ branch = "main" }) => {
        try {
          execSync(`git push --force origin ${branch}`, { encoding: "utf8", timeout: 60000, stdio: ["pipe", "pipe", "pipe"] })
          return { success: true, branch, force: true }
        } catch (e) {
          return { error: `Ошибка: ${e.message}` }
        }
      },
    }),

    git_clone_ssh: tool({
      description: "Клонировать по SSH.",
      inputSchema: z.object({
        repo: z.string().describe("SSH URL репозитория"),
        dir: z.string().optional().describe("Директория"),
      }),
      execute: async ({ repo, dir }) => {
        try {
          const cmd = dir ? `git clone ${repo} ${dir}` : `git clone ${repo}`
          execSync(cmd, { encoding: "utf8", timeout: 120000, stdio: ["pipe", "pipe", "pipe"] })
          return { success: true, repo }
        } catch (e) {
          return { error: `Ошибка: ${e.message}` }
        }
      },
    }),

    // ── ПОЛНЫЙ ДОСТУП К СИСТЕМЕ ──
    system_command: tool({
      description: "Выполнить ЛЮБУЮ системную команду. Полный доступ.",
      inputSchema: z.object({
        command: z.string().describe("Любая команда ОС"),
        elevated: z.boolean().optional().describe("Запуск от администратора"),
      }),
      execute: async ({ command, elevated = false }) => {
        try {
          const cmd = elevated
            ? `powershell -Command "Start-Process cmd -ArgumentList '/c ${command.replace(/"/g, '\\"')}' -Verb RunAs -Wait"`
            : command
          const out = execSync(cmd, {
            encoding: "utf8",
            timeout: 300000,
            maxBuffer: 100 * 1024 * 1024,
            stdio: ["pipe", "pipe", "pipe"],
          })
          return { output: out || "(пустой вывод)", exitCode: 0 }
        } catch (e) {
          return {
            output: String(e.stdout || ""),
            error: String(e.stderr || e.message),
            exitCode: e.status ?? 1,
          }
        }
      },
    }),

    // ═══════════════════════════════════════════════════════════════
    //  УМНЫЙ ДОМ — SONY TV, HDMI-CEC, SMART DEVICES
    // ═══════════════════════════════════════════════════════════════

    // ── SONY BRAVIA TV ──
    sony_tv_discover: tool({
      description: "Найти Sony TV в локальной сети (SSDP/UPnP).",
      inputSchema: z.object({}),
      execute: async () => {
        try {
          // SSDP M-SEARCH for Sony BRAVIA
          const dgram = await import("node:dgram")
          const socket = dgram.createSocket("udp4")
          const msg = [
            "M-SEARCH * HTTP/1.1",
            "HOST: 239.255.255.250:1900",
            "MAN: \"ssdp:discover\"",
            "ST: urn:schemas-upnp-org:device:Basic:1",
            "MX: 3",
            "",
            "",
          ].join("\r\n")

          return new Promise((resolve) => {
            const found = []
            socket.on("message", (buf, rinfo) => {
              const data = buf.toString()
              if (data.includes("Sony") || data.includes("BRAVIA") || data.includes("XBR") || data.includes("KD-") || data.includes("KJ-")) {
                found.push({ ip: rinfo.address, response: data.slice(0, 200) })
              }
            })
            socket.send(msg, 1900, "239.255.255.250")
            setTimeout(() => {
              socket.close()
              resolve({ devices: found, total: found.length })
            }, 4000)
          })
        } catch (e) {
          return { error: `Не удалось найти TV: ${e.message}` }
        }
      },
    }),

    sony_tv_command: tool({
      description: "Управление Sony BRAVIA TV через REST API. Включи/выключи/переключи канал/громкость.",
      inputSchema: z.object({
        ip: z.string().describe("IP адрес TV"),
        command: z.string().describe("Команда: power, volume_up, volume_down, mute, channel_up, channel_down, input, back, home, up, down, left, right, confirm"),
        value: z.string().optional().describe("Значение (для channel, volume, input)"),
        psk: z.string().optional().describe("Pre-Shared Key (если настроен)"),
      }),
      execute: async ({ ip, command, value, psk }) => {
        try {
          // Sony BRAVIA REST API
          const commands = {
            power: { method: "setPowerStatus", params: [{ status: false }] },
            power_on: { method: "setPowerStatus", params: [{ status: true }] },
            volume_up: { method: "setAudioVolume", params: [{ volume: "+1", ui: "on" }] },
            volume_down: { method: "setAudioVolume", params: [{ volume: "-1", ui: "on" }] },
            volume_set: { method: "setAudioVolume", params: [{ volume: value || "10", ui: "on" }] },
            mute: { method: "setAudioMute", params: [{ mute: true }] },
            unmute: { method: "setAudioMute", params: [{ mute: false }] },
            channel_up: { method: "setChannelPosition", params: [{ position: "+1" }] },
            channel_down: { method: "setChannelPosition", params: [{ position: "-1" }] },
            channel: { method: "setChannelPosition", params: [{ position: value || "1" }] },
            input: { method: "setPlayContent", params: [{ uri: `extInput:hdmi?port=${value || "1"}` }] },
            hdmi1: { method: "setPlayContent", params: [{ uri: "extInput:hdmi?port=1" }] },
            hdmi2: { method: "setPlayContent", params: [{ uri: "extInput:hdmi?port=2" }] },
            hdmi3: { method: "setPlayContent", params: [{ uri: "extInput:hdmi?port=3" }] },
            tv: { method: "setPlayContent", params: [{ uri: "tv:dvbt" }] },
            back: { method: "setPlayContent", params: [{ uri: "action:back" }] },
            home: { method: "setPlayContent", params: [{ uri: "action:home" }] },
            up: { method: "setPlayContent", params: [{ uri: "action:up" }] },
            down: { method: "setPlayContent", params: [{ uri: "action:down" }] },
            left: { method: "setPlayContent", params: [{ uri: "action:left" }] },
            right: { method: "setPlayContent", params: [{ uri: "action:right" }] },
            confirm: { method: "setPlayContent", params: [{ uri: "action:confirm" }] },
            pause: { method: "setPlayContent", params: [{ uri: "action:pause" }] },
            play: { method: "setPlayContent", params: [{ uri: "action:play" }] },
            stop: { method: "setPlayContent", params: [{ uri: "action:stop" }] },
          }

          const cmd = commands[command] || commands[command + "_on"]
          if (!cmd) return { error: `Неизвестная команда: ${command}` }

          const authHeader = psk ? { "X-Auth-PSK": psk } : {}
          const url = `http://${ip}/sony/videoControl`

          // First try to get the API version
          const verRes = await fetch(`http://${ip}/sony/videoControl`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...authHeader },
            body: JSON.stringify({ method: "getVersions", params: [] }),
            signal: AbortSignal.timeout(5000),
          }).catch(() => null)

          // Send the command
          const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...authHeader },
            body: JSON.stringify({
              method: cmd.method,
              params: cmd.params,
              id: 1,
              version: "1.0",
            }),
            signal: AbortSignal.timeout(5000),
          })

          const data = await res.json().catch(() => ({}))

          if (data.error && data.error.length > 0) {
            return { success: false, error: data.error, command }
          }

          return { success: true, command, response: data }
        } catch (e) {
          return { error: `Ошибка Sony TV: ${e.message}` }
        }
      },
    }),

    sony_tv_info: tool({
      description: "Получить информацию о Sony TV (модель, статус, источник).",
      inputSchema: z.object({
        ip: z.string().describe("IP адрес TV"),
        psk: z.string().optional().describe("Pre-Shared Key"),
      }),
      execute: async ({ ip, psk }) => {
        try {
          const authHeader = psk ? { "X-Auth-PSK": psk } : {}
          const url = `http://${ip}/sony/videoControl`

          // Get power status
          const powerRes = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...authHeader },
            body: JSON.stringify({ method: "getPowerStatus", params: [], id: 1 }),
            signal: AbortSignal.timeout(5000),
          })
          const power = await powerRes.json().catch(() => ({}))

          // Get current content
          const contentRes = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...authHeader },
            body: JSON.stringify({ method: "getCurrentExternalInputsStatus", params: [], id: 2 }),
            signal: AbortSignal.timeout(5000),
          })
          const content = await contentRes.json().catch(() => ({}))

          // Get volume
          const volRes = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...authHeader },
            body: JSON.stringify({ method: "getVolumeInformation", params: [], id: 3 }),
            signal: AbortSignal.timeout(5000),
          })
          const volume = await volRes.json().catch(() => ({}))

          return {
            ip,
            power: power.result?.[0]?.status || "unknown",
            inputs: content.result || [],
            volume: volume.result?.[0] || {},
          }
        } catch (e) {
          return { error: `Не удалось получить инфо: ${e.message}` }
        }
      },
    }),

    // ── HDMI-CEC (любое устройство) ──
    hdmi_cec_send: tool({
      description: "Отправить HDMI-CEC команду (включить/выключить любое устройство с CEC).",
      inputSchema: z.object({
        device: z.number().optional().describe("CEC адрес устройства (0=TV, 1-14=устройства)"),
        command: z.string().describe("Команда: on, off, standby, text, menu, up, down, left, right, select"),
      }),
      execute: async ({ device = 0, command }) => {
        try {
          // Try using cec-client or python-cec
          const cecCommands = {
            on: `echo "on ${device.toString(16).toUpperCase()}" | cec-client -s -d 1`,
            off: `echo "standby ${device.toString(16).toUpperCase()}" | cec-client -s -d 1`,
            standby: `echo "standby ${device.toString(16).toUpperCase()}" | cec-client -s -d 1`,
          }

          const cmd = cecCommands[command]
          if (!cmd) return { error: `CEC команда не поддерживается: ${command}` }

          execSync(cmd, { encoding: "utf8", timeout: 10000, stdio: ["pipe", "pipe", "pipe"] })
          return { success: true, command, device }
        } catch (e) {
          // Fallback: try powershell WMI
          try {
            if (command === "on" || command === "off") {
              execSync(`powershell -command "Get-CimInstance -Namespace root\\wmi -ClassName WmiMonitorBasicDisplayParams"`, {
                encoding: "utf8",
                stdio: "pipe",
              })
            }
            return { success: true, command, note: "CEC может не поддерживаться на этом устройстве" }
          } catch {
            return { error: `HDMI-CEC недоступен: ${e.message}` }
          }
        }
      },
    }),

    // ── SMART HOME ОБЩЕЕ ──
    smart_device_scan: tool({
      description: "Сканировать сеть на умные устройства (UPnP/SSDP).",
      inputSchema: z.object({}),
      execute: async () => {
        try {
          const dgram = await import("node:dgram")
          const socket = dgram.createSocket("udp4")
          const msg = [
            "M-SEARCH * HTTP/1.1",
            "HOST: 239.255.255.250:1900",
            "MAN: \"ssdp:discover\"",
            "ST: ssdp:all",
            "MX: 3",
            "", "",
          ].join("\r\n")

          return new Promise((resolve) => {
            const found = []
            const seen = new Set()
            socket.on("message", (buf, rinfo) => {
              if (seen.has(rinfo.address)) return
              seen.add(rinfo.address)
              const data = buf.toString()
              const stMatch = data.match(/ST:\s*(.*)/i)
              const serverMatch = data.match(/Server:\s*(.*)/i)
              found.push({
                ip: rinfo.address,
                type: stMatch?.[1]?.trim() || "unknown",
                server: serverMatch?.[1]?.trim() || "unknown",
              })
            })
            socket.send(msg, 1900, "239.255.255.250")
            setTimeout(() => {
              socket.close()
              resolve({ devices: found, total: found.length })
            }, 4000)
          })
        } catch (e) {
          return { error: `Ошибка сканирования: ${e.message}` }
        }
      },
    }),

    smart_light_control: tool({
      description: "Управление умными лампами (Hue, Yeelight, TP-Link).",
      inputSchema: z.object({
        brand: z.string().describe("Бренд: hue, yeelight, tplink"),
        ip: z.string().optional().describe("IP лампы"),
        command: z.string().describe("Команда: on, off, dim, color, scene"),
        value: z.string().optional().describe("Значение (0-100 для яркости, hex для цвета)"),
      }),
      execute: async ({ brand, ip, command, value }) => {
        try {
          if (brand === "yeelight") {
            const cmd = {
              on: '{"id":1,"method":"set_power","params":["on","smooth",500]}',
              off: '{"id":1,"method":"set_power","params":["off","smooth",500]}',
              dim: `{"id":1,"method":"set_bright","params":[${value || 50},"smooth",500]}`,
              color: `{"id":1,"method":"set_rgb","params":[${parseInt(value || "16777215", 16)},"smooth",500]}`,
            }
            const net = await import("node:net")
            return new Promise((resolve) => {
              const client = net.createConnection({ port: 55443, host: ip }, () => {
                client.write(cmd[command] || cmd.on + "\r\n")
              })
              client.on("data", (data) => {
                client.destroy()
                resolve({ success: true, response: data.toString() })
              })
              client.on("error", (e) => {
                resolve({ error: `Yeelight ошибка: ${e.message}` })
              })
              setTimeout(() => { client.destroy(); resolve({ success: true }) }, 3000)
            })
          }
          if (brand === "tplink") {
            // TP-Link smart plug/bulb
            const cmd = {
              on: '{"system":{"set_relay_state":{"state":1}}}',
              off: '{"system":{"set_relay_state":{"state":0}}}',
            }
            const net = await import("node:net")
            // TP-Link uses XOR encryption
            const encrypt = (data) => {
              let key = 171
              const buf = Buffer.alloc(data.length)
              for (let i = 0; i < data.length; i++) {
                buf[i] = key ^ data.charCodeAt(i)
                key = buf[i]
              }
              return buf
            }
            return new Promise((resolve) => {
              const client = net.createConnection({ port: 9999, host: ip }, () => {
                const payload = cmd[command] || cmd.on
                const encrypted = encrypt(payload)
                const header = Buffer.alloc(4)
                header.writeUInt32BE(encrypted.length)
                client.write(Buffer.concat([header, encrypted]))
              })
              client.on("data", () => {
                client.destroy()
                resolve({ success: true, command })
              })
              client.on("error", (e) => {
                resolve({ error: `TP-Link ошибка: ${e.message}` })
              })
              setTimeout(() => { client.destroy(); resolve({ success: true }) }, 3000)
            })
          }
          return { error: `Бренд ${brand} пока не поддерживается. Доступны: yeelight, tplink` }
        } catch (e) {
          return { error: `Ошибка: ${e.message}` }
        }
      },
    }),

    smart_ac_control: tool({
      description: "Управление кондиционером (Broadlink IR).",
      inputSchema: z.object({
        brand: z.string().optional().describe("Бренд кондиционера"),
        command: z.string().describe("Команда: on, off, temp, mode, fan"),
        value: z.string().optional().describe("Значение (температура, режим)"),
      }),
      execute: async ({ brand, command, value }) => {
        return {
          note: "Для IR-управления кондиционером нужен Broadlink RM Pro. Команда: /exec broadlink_cli --host IP --sendir КОД",
          command,
          value,
        }
      },
    }),

    // ── CHROMECAST / AIRPLAY ──
    chromecast_cast: tool({
      description: "Транслировать на Chromecast.",
      inputSchema: z.object({
        ip: z.string().describe("IP Chromecast"),
        url: z.string().describe("URL для трансляции"),
      }),
      execute: async ({ ip, url }) => {
        try {
          // Use cast CLI or catt
          execSync(`catt cast "${url}" -d ${ip}`, { encoding: "utf8", timeout: 30000, stdio: "pipe" })
          return { success: true, url, device: ip }
        } catch (e) {
          return { error: `Chromecast ошибка: ${e.message}. Установи: pip install catt` }
        }
      },
    }),

    // ── WAKE ON LAN ──
    wake_on_lan: tool({
      description: "Включить устройство по Wake-on-LAN (MAC адрес).",
      inputSchema: z.object({
        mac: z.string().describe("MAC адрес устройства"),
      }),
      execute: async ({ mac }) => {
        try {
          const cleanMac = mac.replace(/[:-]/g, "")
          const magicPacket = Buffer.alloc(6 + 16 * 6, 0xFF)
          for (let i = 0; i < 16; i++) {
            Buffer.from(cleanMac, "hex").copy(magicPacket, 6 + i * 6)
          }
          const dgram = await import("node:dgram")
          const socket = dgram.createSocket("udp4")
          return new Promise((resolve) => {
            socket.send(magicPacket, 9, "255.255.255.255", () => {
              socket.close()
              resolve({ success: true, mac, sent: true })
            })
          })
        } catch (e) {
          return { error: `WOL ошибка: ${e.message}` }
        }
      },
    }),

    // ═══════════════════════════════════════════════════════════════
    //  УПРАВЛЕНИЕ ПРИЛОЖЕНИЯМИ (COM, UI AUTOMATION, VISION)
    // ═══════════════════════════════════════════════════════════════

    // ── OFFICE: POWERPOINT ──
    ppt_create: tool({
      description: "Создать новую презентацию PowerPoint.",
      inputSchema: z.object({
        path: z.string().optional().describe("Путь для сохранения"),
      }),
      execute: async ({ path: p }) => {
        try {
          const savePath = p || "presentation.pptx"
          const ps = `
            $ppt = New-Object -ComObject PowerPoint.Application
            $ppt.Visible = 1
            $pres = $ppt.Presentations.Add()
            $pres.SaveAs("${savePath.replace(/\\/g, "\\\\")}")
            Write-Output "Created: ${savePath}"
          `
          execSync(`powershell -ExecutionPolicy Bypass -Command "${ps.replace(/"/g, '\\"')}"`, {
            encoding: "utf8", timeout: 30000, stdio: ["pipe", "pipe", "pipe"],
          })
          return { success: true, path: savePath }
        } catch (e) {
          return { error: `PowerPoint ошибка: ${e.message}` }
        }
      },
    }),

    ppt_add_slide: tool({
      description: "Добавить слайд в презентацию PowerPoint.",
      inputSchema: z.object({
        path: z.string().describe("Путь к презентации"),
        layout: z.number().optional().describe("Тип слайда (1=Title, 2=Title+Content, 3=TitleOnly, 7=Blank)"),
        title: z.string().optional().describe("Заголовок слайда"),
        content: z.string().optional().describe("Содержимое слайда"),
      }),
      execute: async ({ path: p, layout = 2, title, content }) => {
        try {
          const ps = `
            $ppt = New-Object -ComObject PowerPoint.Application
            $ppt.Visible = 1
            $pres = $ppt.Presentations.Open("${p.replace(/\\/g, "\\\\")}")
            $slide = $pres.Slides.Add($pres.Slides.Count + 1, ${layout})
            ${title ? `$slide.Shapes.Title.TextFrame.TextRange.Text = "${title.replace(/"/g, '""')}"` : ""}
            ${content ? `$slide.Shapes[2].TextFrame.TextRange.Text = "${content.replace(/"/g, '""')}"` : ""}
            $pres.Save()
            Write-Output "Slide added"
          `
          execSync(`powershell -ExecutionPolicy Bypass -Command "${ps.replace(/"/g, '\\"')}"`, {
            encoding: "utf8", timeout: 30000, stdio: ["pipe", "pipe", "pipe"],
          })
          return { success: true, layout, title }
        } catch (e) {
          return { error: `PowerPoint ошибка: ${e.message}` }
        }
      },
    }),

    ppt_export: tool({
      description: "Экспортировать презентацию в PDF.",
      inputSchema: z.object({
        path: z.string().describe("Путь к презентации"),
        output: z.string().optional().describe("Путь для PDF"),
      }),
      execute: async ({ path: p, output }) => {
        try {
          const pdfPath = output || p.replace(/\.pptx?$/i, ".pdf")
          const ps = `
            $ppt = New-Object -ComObject PowerPoint.Application
            $pres = $ppt.Presentations.Open("${p.replace(/\\/g, "\\\\")}")
            $pres.ExportAsFixedFormat(${pdfPath.replace(/\\/g, "\\\\")}, 32, 1, 1)
            $pres.Close()
            Write-Output "Exported to PDF"
          `
          execSync(`powershell -ExecutionPolicy Bypass -Command "${ps.replace(/"/g, '\\"')}"`, {
            encoding: "utf8", timeout: 60000, stdio: ["pipe", "pipe", "pipe"],
          })
          return { success: true, pdf: pdfPath }
        } catch (e) {
          return { error: `PowerPoint ошибка: ${e.message}` }
        }
      },
    }),

    // ── OFFICE: WORD ──
    word_create: tool({
      description: "Создать новый документ Word.",
      inputSchema: z.object({
        path: z.string().optional().describe("Путь для сохранения"),
        content: z.string().optional().describe("Начальное содержимое"),
      }),
      execute: async ({ path: p, content }) => {
        try {
          const savePath = p || "document.docx"
          const ps = `
            $word = New-Object -ComObject Word.Application
            $word.Visible = 1
            $doc = $word.Documents.Add()
            ${content ? `$doc.Content.Text = "${content.replace(/"/g, '""').replace(/\n/g, "`n")}"` : ""}
            $doc.SaveAs("${savePath.replace(/\\/g, "\\\\")}")
            Write-Output "Created: ${savePath}"
          `
          execSync(`powershell -ExecutionPolicy Bypass -Command "${ps.replace(/"/g, '\\"')}"`, {
            encoding: "utf8", timeout: 30000, stdio: ["pipe", "pipe", "pipe"],
          })
          return { success: true, path: savePath }
        } catch (e) {
          return { error: `Word ошибка: ${e.message}` }
        }
      },
    }),

    word_read: tool({
      description: "Прочитать текст из документа Word.",
      inputSchema: z.object({
        path: z.string().describe("Путь к документу"),
      }),
      execute: async ({ path: p }) => {
        try {
          const ps = `
            $word = New-Object -ComObject Word.Application
            $word.Visible = 0
            $doc = $word.Documents.Open("${p.replace(/\\/g, "\\\\")}")
            $text = $doc.Content.Text
            $doc.Close(0)
            $word.Quit()
            Write-Output $text
          `
          const out = execSync(`powershell -ExecutionPolicy Bypass -Command "${ps.replace(/"/g, '\\"')}"`, {
            encoding: "utf8", timeout: 30000, stdio: ["pipe", "pipe", "pipe"],
          })
          return { content: out.trim() }
        } catch (e) {
          return { error: `Word ошибка: ${e.message}` }
        }
      },
    }),

    word_format: tool({
      description: "Отформатировать документ Word (шрифт, размер, жирный).",
      inputSchema: z.object({
        path: z.string().describe("Путь к документу"),
        font: z.string().optional().describe("Шрифт"),
        size: z.number().optional().describe("Размер шрифта"),
        bold: z.boolean().optional().describe("Жирный текст"),
      }),
      execute: async ({ path: p, font, size, bold: b }) => {
        try {
          const ps = `
            $word = New-Object -ComObject Word.Application
            $word.Visible = 1
            $doc = $word.Documents.Open("${p.replace(/\\/g, "\\\\")}")
            $sel = $word.Selection
            $sel.WholeStory()
            ${font ? `$sel.Font.Name = "${font}"` : ""}
            ${size ? `$sel.Font.Size = ${size}` : ""}
            ${b !== undefined ? `$sel.Font.Bold = ${b ? 1 : 0}` : ""}
            $doc.Save()
            Write-Output "Formatted"
          `
          execSync(`powershell -ExecutionPolicy Bypass -Command "${ps.replace(/"/g, '\\"')}"`, {
            encoding: "utf8", timeout: 30000, stdio: ["pipe", "pipe", "pipe"],
          })
          return { success: true, font, size, bold: b }
        } catch (e) {
          return { error: `Word ошибка: ${e.message}` }
        }
      },
    }),

    // ── OFFICE: EXCEL ──
    excel_create: tool({
      description: "Создать новую книгу Excel.",
      inputSchema: z.object({
        path: z.string().optional().describe("Путь для сохранения"),
      }),
      execute: async ({ path: p }) => {
        try {
          const savePath = p || "workbook.xlsx"
          const ps = `
            $excel = New-Object -ComObject Excel.Application
            $excel.Visible = 1
            $wb = $excel.Workbooks.Add()
            $wb.SaveAs("${savePath.replace(/\\/g, "\\\\")}")
            Write-Output "Created: ${savePath}"
          `
          execSync(`powershell -ExecutionPolicy Bypass -Command "${ps.replace(/"/g, '\\"')}"`, {
            encoding: "utf8", timeout: 30000, stdio: ["pipe", "pipe", "pipe"],
          })
          return { success: true, path: savePath }
        } catch (e) {
          return { error: `Excel ошибка: ${e.message}` }
        }
      },
    }),

    excel_write: tool({
      description: "Записать данные в ячейку Excel.",
      inputSchema: z.object({
        path: z.string().describe("Путь к книге"),
        sheet: z.number().optional().describe("Номер листа"),
        cell: z.string().describe("Ячейка (A1, B2)"),
        value: z.string().describe("Значение"),
      }),
      execute: async ({ path: p, sheet = 1, cell, value }) => {
        try {
          const ps = `
            $excel = New-Object -ComObject Excel.Application
            $excel.Visible = 1
            $wb = $excel.Workbooks.Open("${p.replace(/\\/g, "\\\\")}")
            $ws = $wb.Sheets.Item(${sheet})
            $ws.Range("${cell}").Value = "${value.replace(/"/g, '""')}"
            $wb.Save()
            Write-Output "Written to ${cell}"
          `
          execSync(`powershell -ExecutionPolicy Bypass -Command "${ps.replace(/"/g, '\\"')}"`, {
            encoding: "utf8", timeout: 30000, stdio: ["pipe", "pipe", "pipe"],
          })
          return { success: true, cell, value }
        } catch (e) {
          return { error: `Excel ошибка: ${e.message}` }
        }
      },
    }),

    excel_read: tool({
      description: "Прочитать данные из ячейки Excel.",
      inputSchema: z.object({
        path: z.string().describe("Путь к книге"),
        sheet: z.number().optional().describe("Номер листа"),
        cell: z.string().describe("Ячейка (A1)"),
      }),
      execute: async ({ path: p, sheet = 1, cell }) => {
        try {
          const ps = `
            $excel = New-Object -ComObject Excel.Application
            $excel.Visible = 0
            $wb = $excel.Workbooks.Open("${p.replace(/\\/g, "\\\\")}")
            $ws = $wb.Sheets.Item(${sheet})
            $val = $ws.Range("${cell}").Value
            $wb.Close(0)
            $excel.Quit()
            Write-Output $val
          `
          const out = execSync(`powershell -ExecutionPolicy Bypass -Command "${ps.replace(/"/g, '\\"')}"`, {
            encoding: "utf8", timeout: 30000, stdio: ["pipe", "pipe", "pipe"],
          })
          return { cell, value: out.trim() }
        } catch (e) {
          return { error: `Excel ошибка: ${e.message}` }
        }
      },
    }),

    excel_chart: tool({
      description: "Создать диаграмму в Excel.",
      inputSchema: z.object({
        path: z.string().describe("Путь к книге"),
        sheet: z.number().optional().describe("Номер листа"),
        range: z.string().describe("Диапазон данных (A1:B5)"),
        type: z.number().optional().describe("Тип (1=Столбцы, 2=Линии, 3=Круговая)"),
      }),
      execute: async ({ path: p, sheet = 1, range: r, type = 1 }) => {
        try {
          const ps = `
            $excel = New-Object -ComObject Excel.Application
            $excel.Visible = 1
            $wb = $excel.Workbooks.Open("${p.replace(/\\/g, "\\\\")}")
            $ws = $wb.Sheets.Item(${sheet})
            $chart = $ws.ChartObjects().Add(100, 100, 400, 300).Chart
            $chart.SetSourceData($ws.Range("${r}"))
            $chart.ChartType = ${type}
            $wb.Save()
            Write-Output "Chart created"
          `
          execSync(`powershell -ExecutionPolicy Bypass -Command "${ps.replace(/"/g, '\\"')}"`, {
            encoding: "utf8", timeout: 30000, stdio: ["pipe", "pipe", "pipe"],
          })
          return { success: true, range: r, type }
        } catch (e) {
          return { error: `Excel ошибка: ${e.message}` }
        }
      },
    }),

    // ── УПРАВЛЕНИЕ ЛЮБЫМИ ПРИЛОЖЕНИЯМИ ──
    app_focus: tool({
      description: "Переключиться на окно приложения.",
      inputSchema: z.object({
        name: z.string().describe("Имя процесса или заголовок окна"),
      }),
      execute: async ({ name }) => {
        try {
          const ps = `
            $proc = Get-Process | Where-Object {$_.ProcessName -like "*${name}*" -or $_.MainWindowTitle -like "*${name}*"} | Select-Object -First 1
            if ($proc) {
              Add-Type -Name Win -Namespace User32 -MemberDefinition '[DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);'
              [User32.Win]::SetForegroundWindow($proc.MainWindowHandle)
              Write-Output "Focused: $($proc.ProcessName)"
            } else {
              Write-Output "Not found: ${name}"
            }
          `
          const out = execSync(`powershell -ExecutionPolicy Bypass -Command "${ps.replace(/"/g, '\\"')}"`, {
            encoding: "utf8", timeout: 10000, stdio: ["pipe", "pipe", "pipe"],
          })
          return { success: true, focused: name, output: out.trim() }
        } catch (e) {
          return { error: `Ошибка: ${e.message}` }
        }
      },
    }),

    app_type_text: tool({
      description: "Набрать текст в активном окне.",
      inputSchema: z.object({
        text: z.string().describe("Текст для набора"),
        delay: z.number().optional().describe("Задержка между символами (мс)"),
      }),
      execute: async ({ text, delay = 0 }) => {
        try {
          const ps = `
            Add-Type -AssemblyName System.Windows.Forms
            ${delay > 0 ? `
            foreach ($char in "${text.replace(/"/g, '""')}") {
              [System.Windows.Forms.SendKeys]::SendWait($char)
              Start-Sleep -Milliseconds ${delay}
            }
            ` : `[System.Windows.Forms.SendKeys]::SendWait("${text.replace(/"/g, '""').replace(/\{/g, "{").replace(/\}/g, "}")}")`}
          `
          execSync(`powershell -ExecutionPolicy Bypass -Command "${ps.replace(/"/g, '\\"')}"`, {
            encoding: "utf8", timeout: 60000, stdio: ["pipe", "pipe", "pipe"],
          })
          return { success: true, typed: text.length + " символов" }
        } catch (e) {
          return { error: `Ошибка: ${e.message}` }
        }
      },
    }),

    app_hotkey: tool({
      description: "Нажать комбинацию клавиш.",
      inputSchema: z.object({
        keys: z.string().describe("Комбинация: ^c (Ctrl+C), ^v, ^s, ^z, ^a, {ENTER}, {TAB}, {F5}, {DELETE}"),
      }),
      execute: async ({ keys }) => {
        try {
          execSync(`powershell -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${keys}')"`, {
            encoding: "utf8", timeout: 5000, stdio: ["pipe", "pipe", "pipe"],
          })
          return { success: true, keys }
        } catch (e) {
          return { error: `Ошибка: ${e.message}` }
        }
      },
    }),

    app_click: tool({
      description: "Кликнуть по координатам экрана.",
      inputSchema: z.object({
        x: z.number().describe("X координата"),
        y: z.number().describe("Y координата"),
        button: z.enum(["left", "right", "middle"]).optional().describe("Кнопка мыши"),
      }),
      execute: async ({ x, y, button = "left" }) => {
        try {
          const btn = button === "right" ? 2 : button === "middle" ? 4 : 1
          const ps = `
            Add-Type -TypeDefinition '
            using System; using System.Runtime.InteropServices;
            public class Mouse {
              [DllImport("user32.dll")] public static extern void mouse_event(int flags, int dx, int dy, int data, int info);
              public static void Click(int x, int y, int btn) {
                System.Windows.Forms.Cursor.Position = new System.Drawing.Point(x, y);
                mouse_event(btn, 0, 0, 0, 0);
                mouse_event(btn + 2, 0, 0, 0, 0);
              }
            }'
            [Mouse]::Click(${x}, ${y}, ${btn})
          `
          execSync(`powershell -ExecutionPolicy Bypass -Command "${ps.replace(/"/g, '\\"')}"`, {
            encoding: "utf8", timeout: 10000, stdio: ["pipe", "pipe", "pipe"],
          })
          return { success: true, x, y, button }
        } catch (e) {
          return { error: `Ошибка: ${e.message}` }
        }
      },
    }),

    app_move_mouse: tool({
      description: "Переместить курсор мыши.",
      inputSchema: z.object({
        x: z.number().describe("X координата"),
        y: z.number().describe("Y координата"),
      }),
      execute: async ({ x, y }) => {
        try {
          execSync(`powershell -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Cursor.Position] = New-Object System.Drawing.Point(${x}, ${y})"`, {
            encoding: "utf8", timeout: 5000, stdio: ["pipe", "pipe", "pipe"],
          })
          return { success: true, x, y }
        } catch (e) {
          return { error: `Ошибка: ${e.message}` }
        }
      },
    }),

    app_screenshot: tool({
      description: "Сделать скриншот экрана и вернуть путь к файлу.",
      inputSchema: z.object({
        path: z.string().optional().describe("Путь для сохранения"),
        region: z.object({
          x: z.number(),
          y: z.number(),
          width: z.number(),
          height: z.number(),
        }).optional().describe("Область экрана"),
      }),
      execute: async ({ path: p, region }) => {
        try {
          const savePath = p || `screenshot_${Date.now()}.png`
          let ps = ""
          if (region) {
            ps = `
              Add-Type -AssemblyName System.Windows.Forms
              Add-Type -AssemblyName System.Drawing
              $bmp = New-Object System.Drawing.Bitmap(${region.width}, ${region.height})
              $gfx = [System.Drawing.Graphics]::FromImage($bmp)
              $gfx.CopyFromScreen(${region.x}, ${region.y}, 0, 0, [System.Drawing.Size]::new(${region.width}, ${region.height}))
              $bmp.Save("${savePath.replace(/\\/g, "\\\\")}", [System.Drawing.Imaging.ImageFormat]::Png)
              Write-Output "Saved: ${savePath}"
            `
          } else {
            ps = `
              Add-Type -AssemblyName System.Windows.Forms
              Add-Type -AssemblyName System.Drawing
              $screen = [System.Windows.Forms.Screen]::PrimaryScreen
              $bmp = New-Object System.Drawing.Bitmap($screen.Bounds.Width, $screen.Bounds.Height)
              $gfx = [System.Drawing.Graphics]::FromImage($bmp)
              $gfx.CopyFromScreen($screen.Bounds.Location, [System.Drawing.Point]::Empty, $screen.Bounds.Size)
              $bmp.Save("${savePath.replace(/\\/g, "\\\\")}", [System.Drawing.Imaging.ImageFormat]::Png)
              Write-Output "Saved: ${savePath}"
            `
          }
          execSync(`powershell -ExecutionPolicy Bypass -Command "${ps.replace(/"/g, '\\"')}"`, {
            encoding: "utf8", timeout: 15000, stdio: ["pipe", "pipe", "pipe"],
          })
          return { success: true, path: savePath }
        } catch (e) {
          return { error: `Ошибка: ${e.message}` }
        }
      },
    }),

    app_find_window: tool({
      description: "Найти окно по заголовку или классу.",
      inputSchema: z.object({
        title: z.string().optional().describe("Заголовок окна"),
        class: z.string().optional().describe("Класс окна"),
      }),
      execute: async ({ title, class: cls }) => {
        try {
          const filter = title ? `MainWindowTitle -like "*${title}*"` : `ClassName -like "*${cls}*"`
          const ps = `
            $procs = Get-Process | Where-Object { $_.MainWindowHandle -ne 0 -and (${filter}) }
            foreach ($p in $procs) {
              Write-Output "$($p.ProcessName) | $($p.MainWindowTitle) | PID:$($p.Id)"
            }
          `
          const out = execSync(`powershell -ExecutionPolicy Bypass -Command "${ps.replace(/"/g, '\\"')}"`, {
            encoding: "utf8", timeout: 10000, stdio: ["pipe", "pipe", "pipe"],
          })
          const windows = out.trim().split("\n").filter(l => l.trim())
          return { windows, total: windows.length }
        } catch (e) {
          return { error: `Ошибка: ${e.message}` }
        }
      },
    }),

    app_list_windows: tool({
      description: "Показать все открытые окна.",
      inputSchema: z.object({}),
      execute: async () => {
        try {
          const ps = `
            Get-Process | Where-Object { $_.MainWindowTitle -ne '' } | 
            Select-Object ProcessName, MainWindowTitle, Id | 
            Format-Table -AutoSize
          `
          const out = execSync(`powershell -ExecutionPolicy Bypass -Command "${ps.replace(/"/g, '\\"')}"`, {
            encoding: "utf8", timeout: 10000, stdio: ["pipe", "pipe", "pipe"],
          })
          return { windows: out }
        } catch (e) {
          return { error: `Ошибка: ${e.message}` }
        }
      },
    }),

    app_close: tool({
      description: "Закрыть приложение.",
      inputSchema: z.object({
        name: z.string().describe("Имя процесса"),
      }),
      execute: async ({ name }) => {
        try {
          execSync(`taskkill /IM "${name}.exe" /F`, { encoding: "utf8", timeout: 10000, stdio: ["pipe", "pipe", "pipe"] })
          return { success: true, closed: name }
        } catch (e) {
          return { error: `Ошибка: ${e.message}` }
        }
      },
    }),

    // ── ВИЗУАЛ (СКРИНШОТ + АНАЛИЗ) ──
    vision_analyze: tool({
      description: "Сделать скриншот и проанализировать что на экране.",
      inputSchema: z.object({
        prompt: z.string().optional().describe("Что анализировать"),
      }),
      execute: async ({ prompt }) => {
        try {
          const ssPath = `vision_${Date.now()}.png`
          const ps = `
            Add-Type -AssemblyName System.Windows.Forms
            Add-Type -AssemblyName System.Drawing
            $screen = [System.Windows.Forms.Screen]::PrimaryScreen
            $bmp = New-Object System.Drawing.Bitmap($screen.Bounds.Width, $screen.Bounds.Height)
            $gfx = [System.Drawing.Graphics]::FromImage($bmp)
            $gfx.CopyFromScreen($screen.Bounds.Location, [System.Drawing.Point]::Empty, $screen.Bounds.Size)
            $bmp.Save("${ssPath.replace(/\\/g, "\\\\")}", [System.Drawing.Imaging.ImageFormat]::Png)
          `
          execSync(`powershell -ExecutionPolicy Bypass -Command "${ps.replace(/"/g, '\\"')}"`, {
            encoding: "utf8", timeout: 15000, stdio: ["pipe", "pipe", "pipe"],
          })
          return { screenshot: ssPath, prompt: prompt || "Опиши что на экране" }
        } catch (e) {
          return { error: `Ошибка: ${e.message}` }
        }
      },
    }),

    // ── NOTEPAD++ / БЛОКНОТ ──
    notepad_open: tool({
      description: "Открыть файл в Блокноте или Notepad++.",
      inputSchema: z.object({
        path: z.string().describe("Путь к файлу"),
        editor: z.enum(["notepad", "notepad++", "code"]).optional().describe("Редактор"),
      }),
      execute: async ({ path: p, editor = "notepad" }) => {
        try {
          const editors = {
            notepad: "notepad.exe",
            "notepad++": '"C:\\Program Files\\Notepad++\\notepad++.exe"',
            code: "code.cmd",
          }
          execSync(`start "" ${editors[editor]} "${p}"`, { shell: "cmd.exe", stdio: "pipe" })
          return { success: true, opened: p, editor }
        } catch (e) {
          return { error: `Ошибка: ${e.message}` }
        }
      },
    }),

    // ── БРАУЗЕР АВТОМАТИЗАЦИЯ ──
    browser_open: tool({
      description: "Открыть URL в браузере.",
      inputSchema: z.object({
        url: z.string().describe("URL"),
        browser: z.string().optional().describe("Браузер (chrome, edge, firefox)"),
      }),
      execute: async ({ url, browser: b = "chrome" }) => {
        try {
          const browsers = { chrome: "chrome.exe", edge: "msedge.exe", firefox: "firefox.exe" }
          execSync(`start "" "${browsers[b]}" "${url}"`, { shell: "cmd.exe", stdio: "pipe" })
          return { success: true, url, browser: b }
        } catch (e) {
          return { error: `Ошибка: ${e.message}` }
        }
      },
    }),

    browser_tabs: tool({
      description: "Показать вкладки браузера Chrome.",
      inputSchema: z.object({}),
      execute: async () => {
        try {
          const ps = `
            $chrome = Get-Process chrome -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -ne '' }
            foreach ($c in $chrome) {
              Write-Output $c.MainWindowTitle
            }
          `
          const out = execSync(`powershell -Command "${ps.replace(/"/g, '\\"')}"`, {
            encoding: "utf8", timeout: 10000, stdio: ["pipe", "pipe", "pipe"],
          })
          return { tabs: out.trim().split("\n").filter(t => t.trim()) }
        } catch (e) {
          return { error: `Ошибка: ${e.message}` }
        }
      },
    }),

    // ── PAINT ──
    paint_draw: tool({
      description: "Открыть Paint и нарисовать/вставить изображение.",
      inputSchema: z.object({
        image: z.string().optional().describe("Путь к изображению для открытия"),
      }),
      execute: async ({ image }) => {
        try {
          const cmd = image ? `mspaint "${image}"` : "mspaint"
          execSync(`start "" ${cmd}`, { shell: "cmd.exe", stdio: "pipe" })
          return { success: true, opened: image || "new" }
        } catch (e) {
          return { error: `Ошибка: ${e.message}` }
        }
      },
    }),

    // ── CALCULATOR ──
    calc: tool({
      description: "Вычислить математическое выражение.",
      inputSchema: z.object({
        expression: z.string().describe("Выражение (2+2, 100*5, sqrt(144))"),
      }),
      execute: async ({ expression }) => {
        try {
          const ps = `
            Add-Type -AssemblyName Microsoft.VisualBasic
            $result = [Microsoft.VisualBasic.Interaction]::Eval("${expression.replace(/"/g, '""')}")
            Write-Output $result
          `
          const out = execSync(`powershell -ExecutionPolicy Bypass -Command "${ps.replace(/"/g, '\\"')}"`, {
            encoding: "utf8", timeout: 10000, stdio: ["pipe", "pipe", "pipe"],
          })
          return { expression, result: out.trim() }
        } catch (e) {
          return { error: `Ошибка: ${e.message}` }
        }
      },
    }),
  }
}
