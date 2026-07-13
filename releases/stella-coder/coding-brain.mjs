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
import { execSync } from "node:child_process"
import { generateText } from "ai"
const MAX_CONTEXT_CHARS = 800_000 
const COMPRESS_THRESHOLD = 600_000 
const MAX_FILE_READ = 50_000 
const MAX_FILES_IN_CONTEXT = 50 
export function buildRepoMap(cwd) {
  const ignoreDirs = new Set([
    "node_modules", ".git", "dist", "build", ".next", ".cache",
    "__pycache__", ".tox", "venv", ".venv", "coverage",
    ".nyc_output", "tmp", ".temp", "public/static",
  ])
  const ignoreExts = new Set([
    ".lock", ".sum", ".map", ".min.js", ".min.css",
    ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico",
    ".woff", ".woff2", ".ttf", ".eot",
  ])
  const tree = []
  const fileTypes = {}
  let totalSize = 0
  let fileCount = 0
  function scan(dir, prefix = "") {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true })
      entries.sort((a, b) => {
        if (a.isDirectory() && !b.isDirectory()) return -1
        if (!a.isDirectory() && b.isDirectory()) return 1
        return a.name.localeCompare(b.name)
      })
      for (const entry of entries) {
        if (ignoreDirs.has(entry.name)) continue
        if (entry.name.startsWith(".") && entry.name !== ".env.example" && entry.name !== ".gitignore") continue
        const fullPath = path.join(dir, entry.name)
        const relPath = prefix ? `${prefix}/${entry.name}` : entry.name
        if (entry.isDirectory()) {
          const childCount = countFilesSafe(fullPath, ignoreDirs)
          tree.push(`${prefix}📁 ${entry.name}/ (${childCount} files)`)
          scan(fullPath, relPath)
        } else {
          const ext = path.extname(entry.name).toLowerCase()
          fileTypes[ext] = (fileTypes[ext] || 0) + 1
          try {
            const stat = fs.statSync(fullPath)
            totalSize += stat.size
            fileCount++
            tree.push(`${prefix}📄 ${entry.name} (${formatSize(stat.size)})`)
          } catch {}
        }
      }
    } catch {}
  }
  scan(cwd)
  return {
    tree: tree.slice(0, 500), 
    fileTypes,
    totalSize: formatSize(totalSize),
    fileCount,
    summary: `${fileCount} файлов, ${formatSize(totalSize)}`,
  }
}
function countFilesSafe(dir, ignoreDirs) {
  let count = 0
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const e of entries) {
      if (ignoreDirs.has(e.name)) continue
      if (e.isFile()) count++
      else if (e.isDirectory()) count += countFilesSafe(path.join(dir, e.name), ignoreDirs)
    }
  } catch {}
  return count
}
function formatSize(bytes) {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}
export function buildProjectContext(cwd) {
  const context = { parts: [], totalChars: 0 }
  const map = buildRepoMap(cwd)
  addPart(context, `# Карта репозитория\n\n${map.summary}\n\n\`\`\`\n${map.tree.join("\n")}\n\`\`\``)
  for (const pkgFile of ["package.json", "tsconfig.json", "Cargo.toml", "pyproject.toml", "go.mod", "composer.json"]) {
    const p = path.join(cwd, pkgFile)
    if (fs.existsSync(p)) {
      const content = readFileSafe(p, 5000)
      if (content) addPart(context, `# ${pkgFile}\n\n\`\`\`json\n${content}\n\`\`\``)
    }
  }
  for (const cfgFile of [".env.example", ".gitignore", "eslint.config.mjs", "prettier.config.js", "biome.json"]) {
    const p = path.join(cwd, cfgFile)
    if (fs.existsSync(p)) {
      const content = readFileSafe(p, 3000)
      if (content) addPart(context, `# ${cfgFile}\n\n${content}`)
    }
  }
  for (const specFile of ["SPEC.md", "CLAUDE.md", "STELLA.md", "README.md", "AGENTS.md"]) {
    const p = path.join(cwd, specFile)
    if (fs.existsSync(p)) {
      const content = readFileSafe(p, 20000)
      if (content) addPart(context, `# ${specFile}\n\n${content}`)
    }
  }
  const importantFiles = detectImportantFiles(cwd)
  for (const f of importantFiles) {
    const content = readFileSafe(f.fullPath, MAX_FILE_READ)
    if (content) {
      addPart(context, `# ${f.relPath}\n\n\`\`\`${f.lang}\n${content}\n\`\`\``)
    }
  }
  return context
}
function addPart(ctx, text) {
  if (ctx.totalChars + text.length > MAX_CONTEXT_CHARS) return false
  ctx.parts.push(text)
  ctx.totalChars += text.length
  return true
}
function readFileSafe(filePath, maxChars) {
  try {
    const content = fs.readFileSync(filePath, "utf8")
    return content.length > maxChars ? content.slice(0, maxChars) + "\n... [truncated]" : content
  } catch { return null }
}
function detectImportantFiles(cwd) {
  const candidates = []
  const extensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".py", ".rs", ".go", ".java", ".cs", ".rb"])
  function scan(dir, rel = "") {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true })
      for (const e of entries) {
        if (["node_modules", ".git", "dist", "build", ".next"].includes(e.name)) continue
        const fullPath = path.join(dir, e.name)
        const relPath = rel ? `${rel}/${e.name}` : e.name
        if (e.isDirectory()) {
          scan(fullPath, relPath)
        } else {
          const ext = path.extname(e.name).toLowerCase()
          if (!extensions.has(ext)) continue
          try {
            const stat = fs.statSync(fullPath)
            const isIndex = /index\.(ts|tsx|js|jsx|mjs)$/.test(e.name)
            const isMain = /^(main|app|server|cli|index)\./.test(e.name)
            const isConfig = /config|settings|constants/.test(e.name.toLowerCase())
            const depth = relPath.split("/").length
            let priority = 0
            if (isMain) priority += 100
            if (isIndex) priority += 80
            if (isConfig) priority += 60
            if (depth <= 2) priority += 40
            if (stat.size > 1000 && stat.size < 50000) priority += 20
            candidates.push({
              fullPath,
              relPath,
              lang: ext.slice(1),
              size: stat.size,
              priority,
            })
          } catch {}
        }
      }
    } catch {}
  }
  scan(cwd)
  return candidates
    .sort((a, b) => b.priority - a.priority)
    .slice(0, MAX_FILES_IN_CONTEXT)
}
export async function compressContext(messages, model) {
  if (JSON.stringify(messages).length < COMPRESS_THRESHOLD) return messages
  const summaryPrompt = `Ты — эксперт по сжатию контекста. Сожми этот диалог в краткое резюме.
Включи:
1. Цели и задачи пользователя
2. Сделанные изменения (какие файлы, что изменено)
3. Текущий статус (что работает, что нет)
4. Важные решения и их обоснование
5. Следующие шаги
Пиши кратко, по-русски, используя markdown.
Максимум 3000 символов.
Диалог:
${messages.map(m => `${m.role}: ${typeof m.content === "string" ? m.content : JSON.stringify(m.content).slice(0, 2000)}`).join("\n\n")}`
  try {
    const { text } = await generateText({ model, messages: [{ role: "user", content: summaryPrompt }] })
    return [
      { role: "user", content: `Резюме предыдущего диалога (сжато):\n\n${text}` },
      { role: "assistant", content: "Понял. Контекст сжат, продолжаем работу с этим резюме." },
    ]
  } catch {
    return messages.slice(-20)
  }
}
export function loadSpec(cwd) {
  for (const specFile of ["SPEC.md", "CLAUDE.md", "AGENTS.md", "STELLA.md"]) {
    const p = path.join(cwd, specFile)
    if (fs.existsSync(p)) {
      const content = fs.readFileSync(p, "utf8")
      return { file: specFile, content, exists: true }
    }
  }
  return { file: null, content: null, exists: false }
}
export function generateSpecTemplate(projectName, description) {
  return `# SPEC: ${projectName}
## Описание
${description || "Опишите назначение проекта"}
## Архитектура
- Опишите ключевые компоненты
- Укажите зависимости между модулями
## API / Интерфейсы
- Опишите публичные интерфейсы
## Требования
### Функциональные
- [ ] Требование 1
- [ ] Требование 2
### Нефункциональные
- [ ] Производительность
- [ ] Безопасность
- [ ] Тестируемость
## Тесты
- Unit-тесты для каждого модуля
- Интеграционные тесты для API
- E2E тесты для критических путей
## Структура файлов
\`\`\`
src/
  ├── index.ts       # Точка входа
  ├── modules/       # Модули бизнес-логики
  ├── utils/         # Утилиты
  └── types/         # Типы
\`\`\`
`
}
export function detectTestFramework(cwd) {
  const checks = [
    { file: "package.json", pattern: /"vitest"|"jest"|"mocha"|"ava"|"tap"/, name: "package.json" },
    { file: "pyproject.toml", pattern: /pytest|unittest/, name: "pyproject.toml" },
    { file: "Cargo.toml", pattern: /\[dev-dependencies\]/, name: "Cargo.toml" },
    { file: "go.mod", pattern: /testify|testing/, name: "go.mod" },
  ]
  for (const check of checks) {
    const p = path.join(cwd, check.file)
    if (fs.existsSync(p)) {
      const content = fs.readFileSync(p, "utf8")
      const match = content.match(check.pattern)
      if (match) {
        return {
          detected: true,
          framework: match[0].replace(/["'\[\]]/g, ""),
          config: check.file,
        }
      }
    }
  }
  const testDirs = ["__tests__", "tests", "test", "spec", "src/__tests__"]
  for (const d of testDirs) {
    if (fs.existsSync(path.join(cwd, d))) {
      return { detected: true, framework: "unknown", config: d }
    }
  }
  return { detected: false, framework: null, config: null }
}
export function detectLinter(cwd) {
  const linters = [
    { config: ".eslintrc.js", name: "eslint", cmd: "npx eslint" },
    { config: ".eslintrc.json", name: "eslint", cmd: "npx eslint" },
    { config: ".eslintrc.yml", name: "eslint", cmd: "npx eslint" },
    { config: "eslint.config.mjs", name: "eslint", cmd: "npx eslint" },
    { config: "eslint.config.js", name: "eslint", cmd: "npx eslint" },
    { config: "biome.json", name: "biome", cmd: "npx biome check" },
    { config: ".prettierrc", name: "prettier", cmd: "npx prettier --check" },
    { config: "prettier.config.js", name: "prettier", cmd: "npx prettier --check" },
    { config: "pyproject.toml", name: "ruff", cmd: "ruff check" },
    { config: "ruff.toml", name: "ruff", cmd: "ruff check" },
    { config: ".pylintrc", name: "pylint", cmd: "pylint" },
    { config: "clippy.toml", name: "clippy", cmd: "cargo clippy" },
  ]
  for (const l of linters) {
    if (fs.existsSync(path.join(cwd, l.config))) {
      return { detected: true, ...l }
    }
  }
  return { detected: false }
}
export function detectFormatter(cwd) {
  const formatters = [
    { config: ".prettierrc", name: "prettier", cmd: "npx prettier --write" },
    { config: "prettier.config.js", name: "prettier", cmd: "npx prettier --write" },
    { config: "biome.json", name: "biome", cmd: "npx biome format --write" },
    { config: ".stylua.toml", name: "stylua", cmd: "stylua" },
  ]
  for (const f of formatters) {
    if (fs.existsSync(path.join(cwd, f.config))) {
      return { detected: true, ...f }
    }
  }
  return { detected: false }
}
export function detectTypeChecker(cwd) {
  const checkers = [
    { config: "tsconfig.json", name: "typescript", cmd: "npx tsc --noEmit" },
    { config: "mypy.ini", name: "mypy", cmd: "mypy" },
    { config: ".mypy.ini", name: "mypy", cmd: "mypy" },
    { config: "pyrightconfig.json", name: "pyright", cmd: "npx pyright" },
  ]
  for (const c of checkers) {
    if (fs.existsSync(path.join(cwd, c.config))) {
      return { detected: true, ...c }
    }
  }
  return { detected: false }
}
export function generateTestPrompt(filePath, fileContent, spec) {
  const fileName = path.basename(filePath)
  const ext = path.extname(filePath).slice(1)
  const langMap = {
    ts: "TypeScript", tsx: "TypeScript React", js: "JavaScript",
    jsx: "JavaScript React", py: "Python", rs: "Rust", go: "Go",
    java: "Java", rb: "Ruby", cs: "C#",
  }
  const lang = langMap[ext] || ext
  const testExt = { ts: "test.ts", tsx: "test.tsx", js: "test.js", jsx: "test.jsx", py: "test.py" }
  const testFile = fileName.replace(new RegExp(`\\.${ext}$`), "") + (testExt[ext] || `.test.${ext}`)
  return {
    testFile,
    prompt: `Ты — эксперт по TDD. Напиши unit-тесты для файла ${fileName}.
Файл: ${filePath}
Язык: ${lang}
Содержимое:
\`\`\`${ext}
${fileContent}
\`\`\`
${spec ? `SPEC проекта:\n${spec.slice(0, 3000)}` : ""}
Сгенерируй ТОЛЬКО код тестов. Правила:
1. Используй ${lang} и стандартные библиотеки тестирования
2. Покрой все публичные функции/методы
3. Включи edge cases и ошибки
4. Используй descriptive имена тестов
5. Формат: ${testFile}
6. Верни ТОЛЬКО код, без объяснений`,
  }
}
export function gitStatus(cwd) {
  try {
    const status = execSync("git status --porcelain", { cwd, encoding: "utf8", timeout: 10000 })
    const branch = execSync("git branch --show-current", { cwd, encoding: "utf8", timeout: 5000 }).trim()
    const ahead = execSync("git rev-list --count @{upstream}..HEAD 2>nul || echo 0", { cwd, encoding: "utf8", timeout: 5000 }).trim()
    const behind = execSync("git rev-list --count HEAD..@{upstream} 2>nul || echo 0", { cwd, encoding: "utf8", timeout: 5000 }).trim()
    const stashCount = execSync("git stash list 2>nul | find /c /v \"\" || echo 0", { cwd, encoding: "utf8", timeout: 5000 }).trim()
    const files = status.split("\n").filter(l => l.trim()).map(l => ({
      status: l.slice(0, 2).trim(),
      path: l.slice(3),
    }))
    return {
      branch,
      ahead: parseInt(ahead) || 0,
      behind: parseInt(behind) || 0,
      stashCount: parseInt(stashCount) || 0,
      files,
      clean: files.length === 0,
    }
  } catch (e) {
    return { branch: "unknown", ahead: 0, behind: 0, stashCount: 0, files: [], clean: true, error: e.message }
  }
}
export function gitDiff(cwd, file = null) {
  try {
    const cmd = file ? `git diff "${file}"` : "git diff --stat"
    return execSync(cmd, { cwd, encoding: "utf8", timeout: 30000 }).trim()
  } catch { return "" }
}
export function gitLog(cwd, count = 10) {
  try {
    return execSync(`git log --oneline -${count}`, { cwd, encoding: "utf8", timeout: 10000 }).trim()
  } catch { return "" }
}
export function gitBranches(cwd) {
  try {
    const output = execSync("git branch -a --format=%(refname:short)", { cwd, encoding: "utf8", timeout: 10000 })
    return output.trim().split("\n").filter(b => b.trim())
  } catch { return [] }
}
export function gitCreateBranch(cwd, name, startPoint = null) {
  try {
    const cmd = startPoint ? `git checkout -b "${name}" "${startPoint}"` : `git checkout -b "${name}"`
    execSync(cmd, { cwd, encoding: "utf8", timeout: 10000 })
    return { success: true, branch: name }
  } catch (e) {
    return { success: false, error: e.message }
  }
}
export function gitCheckout(cwd, branch) {
  try {
    execSync(`git checkout "${branch}"`, { cwd, encoding: "utf8", timeout: 10000 })
    return { success: true }
  } catch (e) {
    return { success: false, error: e.message }
  }
}
export function gitMerge(cwd, branch) {
  try {
    execSync(`git merge "${branch}" --no-edit`, { cwd, encoding: "utf8", timeout: 30000 })
    return { success: true }
  } catch (e) {
    try {
      const conflicts = execSync("git diff --name-only --diff-filter=U", { cwd, encoding: "utf8", timeout: 5000 })
      if (conflicts.trim()) {
        return {
          success: false,
          conflict: true,
          files: conflicts.trim().split("\n"),
          error: e.message,
        }
      }
    } catch {}
    return { success: false, error: e.message }
  }
}
export function gitStash(cwd, message = null) {
  try {
    const cmd = message ? `git stash push -m "${message}"` : "git stash push"
    execSync(cmd, { cwd, encoding: "utf8", timeout: 10000 })
    return { success: true }
  } catch (e) {
    return { success: false, error: e.message }
  }
}
export function gitStashPop(cwd) {
  try {
    execSync("git stash pop", { cwd, encoding: "utf8", timeout: 10000 })
    return { success: true }
  } catch (e) {
    return { success: false, error: e.message }
  }
}
export function gitCommit(cwd, message) {
  try {
    execSync(`git commit -m "${message}"`, { cwd, encoding: "utf8", timeout: 30000 })
    return { success: true }
  } catch (e) {
    return { success: false, error: e.message }
  }
}
export function gitPush(cwd, branch = null, force = false) {
  try {
    const cmd = force ? "git push --force-with-lease" : `git push${branch ? ` origin ${branch}` : ""}`
    execSync(cmd, { cwd, encoding: "utf8", timeout: 60000 })
    return { success: true }
  } catch (e) {
    return { success: false, error: e.message }
  }
}
export function gitPull(cwd, rebase = false) {
  try {
    const cmd = rebase ? "git pull --rebase" : "git pull"
    execSync(cmd, { cwd, encoding: "utf8", timeout: 60000 })
    return { success: true }
  } catch (e) {
    return { success: false, error: e.message }
  }
}
export function gitCreatePR(cwd, title, body, base = "main") {
  try {
    const cmd = `gh pr create --title "${title}" --body "${body}" --base ${base}`
    const output = execSync(cmd, { cwd, encoding: "utf8", timeout: 30000 })
    return { success: true, url: output.trim().match(/https:\/\/[^\s]+/)?.[0] || "" }
  } catch (e) {
    return { success: false, error: e.message }
  }
}
export function gitListPRs(cwd) {
  try {
    const output = execSync("gh pr list --json number,title,author,state,url", { cwd, encoding: "utf8", timeout: 30000 })
    return JSON.parse(output)
  } catch { return [] }
}
export function gitResolveConflicts(cwd, strategy = "theirs") {
  try {
    const files = execSync("git diff --name-only --diff-filter=U", { cwd, encoding: "utf8", timeout: 5000 })
    if (!files.trim()) return { success: true, message: "No conflicts" }
    for (const file of files.trim().split("\n")) {
      execSync(`git checkout --${strategy} "${file}"`, { cwd, encoding: "utf8", timeout: 10000 })
    }
    execSync("git add .", { cwd, encoding: "utf8", timeout: 10000 })
    return { success: true, resolved: files.trim().split("\n") }
  } catch (e) {
    return { success: false, error: e.message }
  }
}
export function runLinter(cwd, linter) {
  if (!linter.detected) return { success: false, error: "Linter not detected" }
  try {
    const output = execSync(`${linter.cmd} . 2>&1`, { cwd, encoding: "utf8", timeout: 60000 })
    return { success: true, output, hasErrors: false }
  } catch (e) {
    return { success: false, output: e.stdout || e.stderr || e.message, hasErrors: true }
  }
}
export function runFormatter(cwd, formatter) {
  if (!formatter.detected) return { success: false, error: "Formatter not detected" }
  try {
    execSync(`${formatter.cmd} .`, { cwd, encoding: "utf8", timeout: 60000 })
    return { success: true }
  } catch (e) {
    return { success: false, error: e.message }
  }
}
export function runTypeChecker(cwd, checker) {
  if (!checker.detected) return { success: false, error: "Type checker not detected" }
  try {
    const output = execSync(checker.cmd, { cwd, encoding: "utf8", timeout: 120000 })
    return { success: true, output, hasErrors: false }
  } catch (e) {
    return { success: false, output: e.stdout || e.stderr || e.message, hasErrors: true }
  }
}
export function runTests(cwd, framework) {
  if (!framework.detected) return { success: false, error: "Test framework not detected" }
  const testCmds = {
    jest: "npx jest --passWithNoTests",
    vitest: "npx vitest run",
    mocha: "npx mocha",
    pytest: "pytest",
    cargo: "cargo test",
    go: "go test ./...",
  }
  const cmd = testCmds[framework.framework] || "npm test"
  try {
    const output = execSync(cmd, { cwd, encoding: "utf8", timeout: 120000 })
    return { success: true, output, passed: true }
  } catch (e) {
    return { success: false, output: e.stdout || e.stderr || e.message, passed: false }
  }
}
export function applyEdits(edits, cwd) {
  const results = []
  for (const edit of edits) {
    const fullPath = path.resolve(cwd, edit.file)
    try {
      if (edit.action === "create") {
        const dir = path.dirname(fullPath)
        fs.mkdirSync(dir, { recursive: true })
        fs.writeFileSync(fullPath, edit.content)
        results.push({ file: edit.file, success: true, action: "created" })
      } else if (edit.action === "edit") {
        let content = fs.readFileSync(fullPath, "utf8")
        if (edit.oldString && edit.newString) {
          content = content.replace(edit.oldString, edit.newString)
        } else if (edit.content) {
          content = edit.content
        }
        fs.writeFileSync(fullPath, content)
        results.push({ file: edit.file, success: true, action: "edited" })
      } else if (edit.action === "delete") {
        fs.unlinkSync(fullPath)
        results.push({ file: edit.file, success: true, action: "deleted" })
      }
    } catch (e) {
      results.push({ file: edit.file, success: false, error: e.message })
    }
  }
  return results
}
export const CODING_BRAIN_COMMANDS = {
  "/brain": "показать состояние контекста и инструментов",
  "/brain-map": "построить карту репозитория",
  "/brain-compress": "сжать контекст сессии",
  "/spec": "показать/создать SPEC.md",
  "/tdd": "автономный TDD-цикл (тесты → код → линтер → тесты)",
  "/lint-auto": "автоматический линтер + исправление",
  "/format-auto": "автоформатирование кода",
  "/typecheck-auto": "автопроверка типов",
  "/test-auto": "автозапуск тестов",
  "/git-eco": "полная информация о Git",
  "/git-pr": "создать Pull Request",
  "/git-merge-auto": "автоматический merge с разрешением конфликтов",
  "/fix-all": "полный цикл: линтер → форматер → типы → тесты",
}
export function diagnoseProject(cwd) {
  const test = detectTestFramework(cwd)
  const lint = detectLinter(cwd)
  const fmt = detectFormatter(cwd)
  const types = detectTypeChecker(cwd)
  const git = gitStatus(cwd)
  const spec = loadSpec(cwd)
  const map = buildRepoMap(cwd)
  return {
    repo: map.summary,
    spec: spec.exists ? spec.file : "not found",
    test: test.detected ? test.framework : "not detected",
    linter: lint.detected ? lint.name : "not detected",
    formatter: fmt.detected ? fmt.name : "not detected",
    typeChecker: types.detected ? types.name : "not detected",
    git: {
      branch: git.branch,
      clean: git.clean,
      files: git.files.length,
      ahead: git.ahead,
      behind: git.behind,
    },
  }
}