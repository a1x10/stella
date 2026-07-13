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
import { generateText } from "ai"
import { createOpenAICompatible } from "@ai-sdk/openai-compatible"
import fs from "node:fs"
import path from "node:path"
import { execSync } from "node:child_process"
const SUBAGENTS = {
  "codebase-investigator": {
    name: "Codebase Investigator",
    description: "Анализирует структуру проекта, находит файлы, понимает архитектуру",
    icon: "🔍",
    systemPrompt: `Ты — субагент Codebase Investigator для Stella Coder.
Твоя задача — анализировать структуру проекта, находить файлы, понимать архитектуру.
Используй инструменты для чтения файлов, поиска по glob, grep.
Возвращай краткие, структурированные отчёты.`,
  },
  "security-auditor": {
    name: "Security Auditor",
    description: "Проверяет код на уязвимости, секреты, небезопасные практики",
    icon: "🛡️",
    systemPrompt: `Ты — субагент Security Auditor для Stella Coder.
Твоя задача — проверять код на уязвимости, секреты, небезопасные практики.
Ищи: hardcoded API keys, SQL injection, XSS, небезопасные зависимости.
Возвращай список проблем с severity и рекомендациями.`,
  },
  "test-writer": {
    name: "Test Writer",
    description: "Генерирует unit-тесты и интеграционные тесты",
    icon: "🧪",
    systemPrompt: `Ты — субагент Test Writer для Stella Coder.
Твоя задача — генерировать unit-тесты и интеграционные тесты.
Определяй фреймворк тестирования из package.json.
Писай тесты с edge cases и mocking.`,
  },
  "docs-writer": {
    name: "Docs Writer",
    description: "Генерирует README, JSDoc, документацию API",
    icon: "📚",
    systemPrompt: `Ты — субагент Docs Writer для Stella Coder.
Твоя задача — генерировать документацию: README, JSDoc, API docs.
Пиши понятно, с примерами кода.`,
  },
  "refactor": {
    name: "Refactor Agent",
    description: "Рефакторит код, улучшает структуру, удаляет дублирование",
    icon: "♻️",
    systemPrompt: `Ты — субагент Refactor Agent для Stella Coder.
Твоя задача — рефакторить код, улучшать структуру, удалять дублирование.
Следи за backward compatibility.
Предлагай изменения с объяснениемBenefits.`,
  },
  "debugger": {
    name: "Debugger",
    description: "Находит и исправляет баги, анализирует ошибки",
    icon: "🐛",
    systemPrompt: `Ты — субагент Debugger для Stella Coder.
Твоя задача — находить и исправлять баги.
Анализируй stack traces, логи, поведение кода.
Предлагай исправления с объяснением корневой причины.`,
  },
  "performance": {
    name: "Performance Analyst",
    description: "Анализирует производительность, находит узкие места",
    icon: "⚡",
    systemPrompt: `Ты — субагент Performance Analyst для Stella Coder.
Твоя задача — анализировать производительность кода.
Найди: O(n²) циклы, утечки памяти, медленные запросы.
Предлагай оптимизации с benchmark-ами.`,
  },
  "git-expert": {
    name: "Git Expert",
    description: "Помогает с git: коммиты, ветки, merge conflicts",
    icon: "📦",
    systemPrompt: `Ты — субагент Git Expert для Stella Coder.
Твоя задача — помогать с git операциями.
Создавай понятные коммиты, разрешай conflicts.
Используй conventional commits.`,
  },
}
export async function runSubagent(name, task, options = {}) {
  const agent = SUBAGENTS[name]
  if (!agent) {
    return { error: `Субагент "${name}" не найден. Доступные: ${Object.keys(SUBAGENTS).join(", ")}` }
  }
  const { apiKey, model, onProgress } = options
  console.log(`\n  ${agent.icon} Запуск ${agent.name}...`)
  console.log(`  Задача: ${task}\n`)
  try {
    const zen = createOpenAICompatible({
      name: "zen",
      baseURL: "https:
      apiKey: apiKey || "",
    })
    const result = await generateText({
      model: zen.chatModel(model || "mimo-v2.5-free"),
      system: agent.systemPrompt,
      prompt: task,
      maxSteps: 20,
      tools: options.tools || {},
      onStepFinish: ({ toolCalls, toolResults }) => {
        if (toolCalls?.length) {
          for (const call of toolCalls) {
            console.log(`    → ${call.toolName}(${JSON.stringify(call.args).slice(0, 60)}...)`)
          }
        }
      },
    })
    console.log(`\n  ${agent.icon} ${agent.name} завершён\n`)
    return { success: true, result: result.text, agent: name }
  } catch (err) {
    console.error(`\n  ✗ Ошибка ${agent.name}: ${err.message}\n`)
    return { error: err.message, agent: name }
  }
}
export function listSubagents() {
  return Object.entries(SUBAGENTS).map(([id, agent]) => ({
    id,
    name: agent.name,
    description: agent.description,
    icon: agent.icon,
  }))
}
export function parseAgentCommand(input) {
  const match = input.match(/^@(\S+)\s+(.+)$/s)
  if (!match) return null
  return { agent: match[1], task: match[2].trim() }
}
export { SUBAGENTS }