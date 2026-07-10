"use client"
import { useState } from "react"

interface Device {
  id: string
  name: string
  platform: string
  fingerprint: string
  lastActive: string
  status: "active" | "inactive"
}

interface ThreatLog {
  id: string
  file: string
  threat: string
  severity: "critical" | "high" | "medium" | "low"
  action: string
  timestamp: string
}

const DEMO_DEVICES: Device[] = [
  { id: "1", name: "Workstation-01", platform: "win32", fingerprint: "a1b2c3d4e5f6...", lastActive: "2 мин назад", status: "active" },
  { id: "2", name: "Laptop-Home", platform: "darwin", fingerprint: "f6e5d4c3b2a1...", lastActive: "1 час назад", status: "inactive" },
]

const DEMO_THREATS: ThreatLog[] = [
  { id: "1", file: "malware.exe", threat: "Trojan.GenericKD.47821344", severity: "critical", action: "Удалён", timestamp: "2026-07-01 14:32" },
  { id: "2", file: "suspicious.js", threat: "Heuristic.Keylogger", severity: "high", action: "Карантин", timestamp: "2026-06-28 09:15" },
  { id: "3", file: "backdoor.py", threat: "Backdoor.Python.ReverseShell", severity: "critical", action: "Удалён", timestamp: "2026-06-25 22:41" },
]

export default function Dashboard() {
  const [tab, setTab] = useState<"devices" | "stats" | "threats" | "settings">("devices")

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950/20 to-slate-950">
      {/* Header */}
      <header className="border-b border-white/10 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center font-bold text-sm">
              S
            </div>
            <span className="text-white font-semibold text-lg">Stella Dashboard</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-white/50 text-sm">user@example.com</span>
            <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-sm font-bold">
              U
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="border-b border-white/10 px-6">
        <div className="max-w-6xl mx-auto flex gap-6">
          {[
            { key: "devices", label: "Устройства" },
            { key: "stats", label: "Статистика ИИ" },
            { key: "threats", label: "Логи угроз" },
            { key: "settings", label: "Настройки" },
          ].map((item) => (
            <button
              key={item.key}
              onClick={() => setTab(item.key as typeof tab)}
              className={`py-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                tab === item.key
                  ? "border-purple-500 text-white"
                  : "border-transparent text-white/50 hover:text-white/70"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-6xl mx-auto p-6">
        {tab === "devices" && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-white">Привязанные устройства</h2>
              <button className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm font-medium transition-colors">
                + Добавить устройство
              </button>
            </div>
            <div className="space-y-3">
              {DEMO_DEVICES.map((device) => (
                <div key={device.id} className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-2 h-2 rounded-full ${device.status === "active" ? "bg-green-500" : "bg-white/30"}`} />
                    <div>
                      <div className="text-white font-medium">{device.name}</div>
                      <div className="text-white/50 text-sm">{device.platform} · {device.fingerprint}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-white/50 text-sm">{device.lastActive}</div>
                    <button className="text-red-400 text-xs hover:text-red-300 mt-1">Отвязать</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "stats" && (
          <div>
            <h2 className="text-xl font-semibold text-white mb-6">Статистика AI-агента</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              {[
                { label: "Всего запросов", value: "1,247", change: "+12%" },
                { label: "Токенов (вход)", value: "2.4M", change: "+8%" },
                { label: "Токенов (выход)", value: "890K", change: "+15%" },
                { label: "Стоимость", value: "$12.45", change: "+$2.10" },
              ].map((stat) => (
                <div key={stat.label} className="bg-white/5 border border-white/10 rounded-xl p-4">
                  <div className="text-white/50 text-sm">{stat.label}</div>
                  <div className="text-2xl font-bold text-white mt-1">{stat.value}</div>
                  <div className="text-green-400 text-xs mt-1">{stat.change}</div>
                </div>
              ))}
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <h3 className="text-white font-medium mb-4">Последние сессии</h3>
              <div className="space-y-3">
                {[
                  { date: "2026-07-08", turns: 45, model: "gpt-5.4", cost: "$0.32" },
                  { date: "2026-07-07", turns: 32, model: "claude-sonnet-5", cost: "$0.28" },
                  { date: "2026-07-06", turns: 67, model: "gpt-5.4", cost: "$0.51" },
                ].map((session) => (
                  <div key={session.date} className="flex items-center justify-between py-2 border-b border-white/5">
                    <span className="text-white/70">{session.date}</span>
                    <span className="text-white/50">{session.turns} запросов</span>
                    <span className="text-purple-400">{session.model}</span>
                    <span className="text-green-400">{session.cost}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === "threats" && (
          <div>
            <h2 className="text-xl font-semibold text-white mb-6">Логи угроз Stellar AV</h2>
            <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left px-4 py-3 text-white/50 text-sm font-medium">Файл</th>
                    <th className="text-left px-4 py-3 text-white/50 text-sm font-medium">Угроза</th>
                    <th className="text-left px-4 py-3 text-white/50 text-sm font-medium">Уровень</th>
                    <th className="text-left px-4 py-3 text-white/50 text-sm font-medium">Действие</th>
                    <th className="text-left px-4 py-3 text-white/50 text-sm font-medium">Дата</th>
                  </tr>
                </thead>
                <tbody>
                  {DEMO_THREATS.map((threat) => (
                    <tr key={threat.id} className="border-b border-white/5">
                      <td className="px-4 py-3 text-white font-mono text-sm">{threat.file}</td>
                      <td className="px-4 py-3 text-white/70 text-sm">{threat.threat}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          threat.severity === "critical" ? "bg-red-500/20 text-red-400" :
                          threat.severity === "high" ? "bg-orange-500/20 text-orange-400" :
                          "bg-yellow-500/20 text-yellow-400"
                        }`}>
                          {threat.severity}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-green-400 text-sm">{threat.action}</td>
                      <td className="px-4 py-3 text-white/50 text-sm">{threat.timestamp}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "settings" && (
          <div>
            <h2 className="text-xl font-semibold text-white mb-6">Настройки</h2>
            <div className="space-y-4">
              <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                <h3 className="text-white font-medium mb-4">API Ключи</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-white/70">OpenCode Zen API Key</span>
                    <div className="flex items-center gap-2">
                      <span className="text-green-400 text-sm">✓ Настроен</span>
                      <button className="text-white/50 text-sm hover:text-white">Изменить</button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-white/70">VirusTotal API Key</span>
                    <div className="flex items-center gap-2">
                      <span className="text-yellow-400 text-sm">⚠ Не задан</span>
                      <button className="text-purple-400 text-sm hover:text-purple-300">Добавить</button>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                <h3 className="text-white font-medium mb-4">Локальные модели (Ollama)</h3>
                <p className="text-white/50 text-sm mb-4">
                  Подключите Ollama для работы с локальными моделями без интернета.
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-white/30" />
                  <span className="text-white/50 text-sm">Ollama не подключён</span>
                  <button className="text-purple-400 text-sm hover:text-purple-300">Настроить</button>
                </div>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                <h3 className="text-white font-medium mb-4">Статус защиты</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <span className="text-white/70 text-sm">Stellar AV: активен</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <span className="text-white/70 text-sm">База: v3 (103 сигн.)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <span className="text-white/70 text-sm">Мониторинг: включён</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <span className="text-white/70 text-sm">Последнее скан: 2ч назад</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
