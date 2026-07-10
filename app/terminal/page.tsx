"use client"
import { useState } from "react"

export default function TerminalDemo() {
  const [input, setInput] = useState("")
  const [history, setHistory] = useState([
    { role: "system", text: "✦ Stella Coder v3.9 — Web Demo" },
    { role: "system", text: "Это демонстрация CLI в браузере. Введите /help для списка команд." },
    { role: "system", text: "" },
  ])
  const [loading, setLoading] = useState(false)

  const handleCommand = async (cmd: string) => {
    if (!cmd.trim()) return

    const newHistory = [...history, { role: "user", text: `❯ ${cmd}` }]
    setHistory(newHistory)
    setInput("")

    if (cmd === "/help") {
      setHistory([...newHistory, {
        role: "system",
        text: `Команды:
  /help     — все команды
  /clear    — очистить терминал
  /version  — версия
  /demo     — демо-запрос к ИИ
  /av       — демо антивируса

Для полноценной работы скачайте CLI:
  https://github.com/stella-coder/stella-cli`,
      }])
      return
    }

    if (cmd === "/clear") {
      setHistory([])
      return
    }

    if (cmd === "/version") {
      setHistory([...newHistory, { role: "system", text: "stella-coder 3.9.0 · Zen engine · ai-sdk" }])
      return
    }

    if (cmd === "/demo") {
      setLoading(true)
      setHistory([...newHistory, { role: "system", text: "⏳ Запрос к ИИ... (демо режим)" }])

      // Simulate AI response
      setTimeout(() => {
        setHistory(prev => [...prev, {
          role: "assistant",
          text: `Привет! Я Zen — ИИ-движок Stella Coder.

В демо-режиме я могу показать базовые возможности:
- Анализ кода и исправление ошибок
- Генерация нового кода
- Работа с файловой системой
- Git-операции

Для реальной работы установите CLI:
\`\`\`bash
npm install -g stella-coder
stella
\`\`\`

Или посетите https://stella-coder.dev для подробностей.`,
        }])
        setLoading(false)
      }, 1500)
      return
    }

    if (cmd === "/av") {
      setHistory([...newHistory, {
        role: "system",
        text: `✦ STELLAR ANTIVIRUS — Демо

  База угроз: 103 сигнатуры
  YARA-правила: 12
  Эвристика: 12 правил

  Сканирование... ✓
  Угрозы: 0
  Система защищена ✓

Для реального сканирования используйте CLI:
  stellar-av`,
      }])
      return
    }

    setHistory([...newHistory, { role: "error", text: `Неизвестная команда: ${cmd}. Введите /help` }])
  }

  return (
    <div className="min-h-screen bg-black text-white font-mono">
      {/* Header */}
      <div className="border-b border-white/10 px-4 py-3 flex items-center gap-3">
        <div className="flex gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <div className="w-3 h-3 rounded-full bg-yellow-500" />
          <div className="w-3 h-3 rounded-full bg-green-500" />
        </div>
        <span className="text-white/50 text-sm">stella — Web Terminal Demo</span>
      </div>

      {/* Terminal */}
      <div className="p-4 max-w-4xl mx-auto">
        <div className="space-y-1">
          {history.map((entry, i) => (
            <div key={i} className={
              entry.role === "user"
                ? "text-purple-400"
                : entry.role === "assistant"
                ? "text-green-400"
                : entry.role === "error"
                ? "text-red-400"
                : "text-white/70"
            }>
              <pre className="whitespace-pre-wrap font-mono text-sm">{entry.text}</pre>
            </div>
          ))}
          {loading && (
            <div className="text-purple-400 animate-pulse">⏳ Думаю...</div>
          )}
        </div>

        {/* Input */}
        <div className="mt-4 flex items-center gap-2">
          <span className="text-purple-400">❯</span>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCommand(input)
            }}
            className="flex-1 bg-transparent border-none outline-none text-white font-mono text-sm placeholder-white/30"
            placeholder="Введите команду..."
            autoFocus
          />
        </div>
      </div>
    </div>
  )
}
