import fs from "node:fs"
import path from "node:path"
import os from "node:os"
import crypto from "node:crypto"
import { execSync } from "node:child_process"
const BOT_TOKEN = "8923551485:AAFw4wG8ZwOtp5rzFsnguxhu4AH-2_ebSi0"
const API_URL = `https:
const PREMIUM_CODE = "10102013"
const PREMIUM_DURATION = 30 * 24 * 60 * 60 * 1000 
const CONFIG_DIR = path.join(os.homedir(), ".stella")
const BOT_CONFIG_PATH = path.join(CONFIG_DIR, "telegram-bot.json")
const SESSIONS_PATH = path.join(CONFIG_DIR, "sessions.json")
const AUTH_PATH = path.join(CONFIG_DIR, "telegram-auth.json")
async function tg(method, body = {}) {
  try {
    const res = await fetch(`${API_URL}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    })
    const data = await res.json()
    if (!data.ok) console.error(`[TG] ${method} error:`, data.description)
    return data
  } catch (e) {
    console.error(`[TG] ${method} fetch error:`, e.message)
    return { ok: false, error: e.message }
  }
}
async function sendMessage(chatId, text, options = {}) {
  return tg("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    ...options,
  })
}
async function editMessage(chatId, messageId, text, options = {}) {
  return tg("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: "HTML",
    ...options,
  })
}
async function answerCallback(callbackQueryId, text = "") {
  return tg("answerCallbackQuery", { callback_query_id: callbackQueryId, text })
}
function getHardwareFingerprint() {
  const components = [
    os.hostname(),
    os.platform(),
    os.arch(),
    os.cpus()[0]?.model || "unknown",
    os.totalmem().toString(),
  ]
  try {
    const netInterfaces = os.networkInterfaces()
    for (const name of Object.keys(netInterfaces)) {
      for (const iface of netInterfaces[name]) {
        if (!iface.internal && iface.mac && iface.mac !== "00:00:00:00:00:00") {
          components.push(iface.mac)
          break
        }
      }
    }
  } catch {}
  try {
    if (os.platform() === "win32") {
      const diskInfo = execSync('powershell -Command "Get-PhysicalDisk | Select-Object -ExpandProperty SerialNumber"', { encoding: "utf8", timeout: 5000 })
      const serial = diskInfo.trim().split("\n")[0]?.trim()
      if (serial && serial !== "") components.push(serial)
    }
  } catch {}
  return crypto.createHash("sha256").update(components.join("|")).digest("hex").slice(0, 32)
}
function generateAuthCode(telegramId) {
  const code = String(Math.floor(1000 + Math.random() * 9000))
  return code
}
export function generateAdminCode() {
  const code = String(Math.floor(1000 + Math.random() * 9000))
  const auth = loadAuth()
  auth.adminCode = {
    code,
    hardwareId: getHardwareFingerprint(),
    hostname: os.hostname(),
    createdAt: Date.now(),
    used: false,
  }
  saveAuth(auth)
  return code
}
export function verifyAdminCode(code, telegramId, username, firstName, chatId) {
  const auth = loadAuth()
  if (!auth.adminCode) {
    return { success: false, error: "Код не сгенерирован. Запустите /tg в Stella на вашем компьютере." }
  }
  if (auth.adminCode.used) {
    return { success: false, error: "Код уже использован. Сгенерируйте новый: /tg-code" }
  }
  if (auth.adminCode.code !== code) {
    return { success: false, error: "Неверный код." }
  }
  auth.users[telegramId] = {
    username,
    firstName,
    chatId,
    hardwareId: auth.adminCode.hardwareId,
    hostname: auth.adminCode.hostname,
    authenticatedAt: Date.now(),
    role: "user",
  }
  auth.adminCode.used = true
  auth.adminCode.usedBy = telegramId
  auth.adminCode.usedAt = Date.now()
  saveAuth(auth)
  return {
    success: true,
    userId: telegramId,
    username,
    firstName,
    hostname: auth.adminCode.hostname,
  }
}
export function listAuthorizedUsers() {
  const auth = loadAuth()
  return Object.entries(auth.users).map(([id, u]) => ({
    id,
    username: u.username,
    firstName: u.firstName,
    hostname: u.hostname,
    authenticatedAt: new Date(u.authenticatedAt).toLocaleString("ru-RU"),
  }))
}
function loadAuth() {
  try {
    return JSON.parse(fs.readFileSync(AUTH_PATH, "utf8"))
  } catch {
    return { users: {}, pendingCodes: {} }
  }
}
function saveAuth(auth) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true })
  fs.writeFileSync(AUTH_PATH, JSON.stringify(auth, null, 2))
}
function loadSessions() {
  try {
    return JSON.parse(fs.readFileSync(SESSIONS_PATH, "utf8"))
  } catch {
    return { sessions: [], activeSession: null }
  }
}
function saveSessions(data) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true })
  fs.writeFileSync(SESSIONS_PATH, JSON.stringify(data, null, 2))
}
function createSession(name, model = "MiMo V2.5 Free") {
  const data = loadSessions()
  const session = {
    id: `session-${Date.now()}`,
    name,
    model,
    provider: "OpenCode Zen",
    contextLimit: "200K",
    createdAt: new Date().toISOString(),
    lastActivity: new Date().toISOString(),
    stats: {
      totalTokens: 0,
      inputTokens: 0,
      outputTokens: 0,
      cacheRead: 0,
      cacheWrite: 0,
      reasoningTokens: 0,
      userMessages: 0,
      assistantMessages: 0,
      toolCalls: 0,
      cost: 0,
      contextBreakdown: {
        user: 0,
        assistant: 0,
        tools: 0,
        other: 0,
      },
    },
  }
  data.sessions.push(session)
  data.activeSession = session.id
  saveSessions(data)
  return session
}
function updateSessionStats(sessionId, updates) {
  const data = loadSessions()
  const session = data.sessions.find(s => s.id === sessionId)
  if (!session) return null
  Object.assign(session.stats, updates)
  session.lastActivity = new Date().toISOString()
  saveSessions(data)
  return session
}
function getActiveSession() {
  const data = loadSessions()
  return data.sessions.find(s => s.id === data.activeSession) || null
}
function loadPremium() {
  try {
    return JSON.parse(fs.readFileSync(path.join(CONFIG_DIR, "premium.json"), "utf8"))
  } catch {
    return { users: {} }
  }
}
function savePremium(data) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true })
  fs.writeFileSync(path.join(CONFIG_DIR, "premium.json"), JSON.stringify(data, null, 2))
}
function isPremium(telegramId) {
  const data = loadPremium()
  const user = data.users[telegramId]
  if (!user) return false
  return Date.now() < user.expiresAt
}
function activatePremium(telegramId, duration = PREMIUM_DURATION) {
  const data = loadPremium()
  data.users[telegramId] = {
    activatedAt: Date.now(),
    expiresAt: Date.now() + duration,
  }
  savePremium(data)
}
function getPremiumExpiry(telegramId) {
  const data = loadPremium()
  const user = data.users[telegramId]
  if (!user) return null
  return new Date(user.expiresAt).toLocaleDateString("ru-RU")
}
const userStates = new Map()
function getMainMenu(telegramId) {
  const premium = isPremium(telegramId)
  return {
    text: `<b>Stella Coder Bot</b>
Добро пожаловать! ${premium ? "⭐ Premium" : ""}
<b>Команды:</b>
/start — Начать
/sessions — Мои сессии
/new — Новая сессия
/status — Статус сессии
/premium — Premium функции
/help — Помощь
<b>Удалённое управление:</b>
Просто напишите команду, и Stella выполнит её на компьютере.
Пример: "выключи телевизор", "сделай скриншот"`,
    reply_markup: {
      inline_keyboard: [
        [{ text: "📋 Сессии", callback_data: "sessions" }, { text: "➕ Новая", callback_data: "new_session" }],
        [{ text: "📊 Статус", callback_data: "status" }, { text: "⭐ Premium", callback_data: "premium" }],
        [{ text: "❓ Помощь", callback_data: "help" }],
      ],
    },
  }
}
function getSessionsList(telegramId) {
  const data = loadSessions()
  if (data.sessions.length === 0) {
    return {
      text: "📋 <b>Нет сохранённых сессий</b>\n\nСоздайте новую сессию кнопкой ниже.",
      reply_markup: {
        inline_keyboard: [[{ text: "➕ Создать сессию", callback_data: "new_session" }], [{ text: "◀️ Назад", callback_data: "main_menu" }]],
      },
    }
  }
  const lines = data.sessions.map((s, i) => {
    const isActive = s.id === data.activeSession
    const date = new Date(s.createdAt).toLocaleDateString("ru-RU")
    const msgs = s.stats.userMessages + s.stats.assistantMessages
    return `${isActive ? "🟢" : "⚪"} <b>${i + 1}. ${s.name}</b>\n    ${s.model} · ${msgs} сообщений · ${date}`
  })
  return {
    text: `<b>📋 Ваши сессии:</b>\n\n${lines.join("\n\n")}`,
    reply_markup: {
      inline_keyboard: [
        ...data.sessions.map((s, i) => [
          { text: `${s.id === data.activeSession ? "🟢" : "⚪"} ${s.name}`, callback_data: `session_${i}` },
        ]),
        [{ text: "➕ Новая сессия", callback_data: "new_session" }],
        [{ text: "◀️ Назад", callback_data: "main_menu" }],
      ],
    },
  }
}
function getSessionStats(session) {
  const stats = session.stats
  const ctxBreakdown = stats.contextBreakdown
  const totalCtx = ctxBreakdown.user + ctxBreakdown.assistant + ctxBreakdown.tools + ctxBreakdown.other
  const userPct = totalCtx > 0 ? ((ctxBreakdown.user / totalCtx) * 100).toFixed(1) : "0"
  const asstPct = totalCtx > 0 ? ((ctxBreakdown.assistant / totalCtx) * 100).toFixed(1) : "0"
  const toolsPct = totalCtx > 0 ? ((ctxBreakdown.tools / totalCtx) * 100).toFixed(1) : "0"
  const otherPct = totalCtx > 0 ? ((ctxBreakdown.other / totalCtx) * 100).toFixed(1) : "0"
  const usage = session.contextLimit ? Math.min(100, Math.round((stats.totalTokens / 200000) * 100)) : 0
  return `<b>📊 Сессия: ${session.name}</b>
<b>Провайдер:</b> ${session.provider}
<b>Лимит контекста:</b> ${session.contextLimit}
<b>Использование:</b> ${usage}%
<b>Модель:</b> ${session.model}
<b>Статистика:</b>
├ Входные токены: ${stats.inputTokens.toLocaleString()}
├ Выходные токены: ${stats.outputTokens.toLocaleString()}
├ Токены кэша: ${stats.cacheRead.toLocaleString()}/${stats.cacheWrite.toLocaleString()}
├ Токены рассуждения: ${stats.reasoningTokens.toLocaleString()}
└ Всего токенов: ${stats.totalTokens.toLocaleString()}
<b>Сообщения:</b>
├ Пользователя: ${stats.userMessages}
├ Ассистента: ${stats.assistantMessages}
├ Всего: ${stats.userMessages + stats.assistantMessages}
└ Вызовы инструментов: ${stats.toolCalls}
<b>Разбивка контекста:</b>
├ 🟢 Пользователь ${userPct}%
├ 🟣 Ассистент ${asstPct}%
├ 🟤 Вызовы инструментов ${toolsPct}%
└ ⚪ Другое ${otherPct}%
<b>Стоимость:</b> $${stats.cost.toFixed(2)}
<b>Создана:</b> ${new Date(session.createdAt).toLocaleString("ru-RU")}
<b>Последняя активность:</b> ${new Date(session.lastActivity).toLocaleString("ru-RU")}`
}
let pollingOffset = 0
let botRunning = false
export async function startBot() {
  if (botRunning) {
    console.log("[TG Bot] Already running")
    return
  }
  const me = await tg("getMe")
  if (!me.ok) {
    console.error("[TG Bot] Failed to start:", me.description || "Invalid token")
    return false
  }
  botRunning = true
  console.log(`[TG Bot] Started: @${me.result.username} (${me.result.first_name})`)
  pollUpdates()
  return true
}
export async function stopBot() {
  botRunning = false
  console.log("[TG Bot] Stopped")
}
async function pollUpdates() {
  while (botRunning) {
    try {
      const res = await tg("getUpdates", {
        offset: pollingOffset,
        timeout: 30,
        allowed_updates: ["message", "callback_query"],
      })
      if (res.ok && res.result) {
        for (const update of res.result) {
          pollingOffset = update.update_id + 1
          await handleUpdate(update)
        }
      }
    } catch (e) {
      if (botRunning) {
        console.error("[TG Bot] Poll error:", e.message)
        await sleep(5000)
      }
    }
  }
}
function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}
async function handleUpdate(update) {
  if (update.message) {
    await handleMessage(update.message)
  } else if (update.callback_query) {
    await handleCallback(update.callback_query)
  }
}
async function handleMessage(msg) {
  const chatId = msg.chat.id
  const userId = msg.from?.id
  const text = msg.text || ""
  if (text === "/start" || text === "/menu") {
    const auth = loadAuth()
    if (auth.users[userId]) {
      await sendMessage(chatId, getMainMenu(userId).text, getMainMenu(userId))
      return
    }
    if (text === "/start") {
      if (auth.adminCode && !auth.adminCode.used) {
        await sendMessage(chatId, `<b>Добро пожаловать, ${msg.from.first_name}!</b>
Для доступа к Stella введите код, который вам дали.
<b>Введите код:</b>`, {
          reply_markup: {
            inline_keyboard: [[{ text: "◀️ Отмена", callback_data: "cancel_auth" }]],
          },
        })
        userStates.set(userId, { awaiting: "admin_code" })
      } else {
        await sendMessage(chatId, `<b>Добро пожаловать, ${msg.from.first_name}!</b>
Для получения доступа к Stella:
1. Купите доступ у администратора
2. Получите код
3. Введите его здесь
<b>Нет кода?</b> Свяжитесь с администратором.`, {
          reply_markup: {
            inline_keyboard: [[{ text: "◀️ Назад", callback_data: "main_menu" }]],
          },
        })
      }
    }
    return
  }
  const userState = userStates.get(userId)
  if (userState?.awaiting === "admin_code") {
    userStates.delete(userId)
    const auth = loadAuth()
    const result = verifyAdminCode(
      text.trim(),
      userId,
      msg.from.username || msg.from.first_name,
      msg.from.first_name,
      chatId
    )
    if (result.success) {
      await sendMessage(chatId, `✅ <b>Доступ получен!</b>
Добро пожаловать, ${result.firstName}!
Теперь вы можете:
• Управлять компьютером через Telegram
• Получать уведомления
• Просматривать сессии
Нажмите /menu для главного меню.`, getMainMenu(userId))
    } else {
      await sendMessage(chatId, `❌ <b>${result.error}</b>
Попробуйте ещё раз или нажмите /start.`)
    }
    return
  }
  if (!auth.users[userId]) {
    await sendMessage(chatId, "❌ Вы не авторизованы. Нажмите /start для начала.")
    return
  }
  const session = getActiveSession()
  if (session) {
    updateSessionStats(session.id, {
      userMessages: session.stats.userMessages + 1,
      totalTokens: session.stats.totalTokens + Math.floor(text.length / 4),
      inputTokens: session.stats.inputTokens + Math.floor(text.length / 4),
    })
  }
  const processingMsg = await sendMessage(chatId, `⚙️ <b>Выполняю:</b> ${text.slice(0, 100)}...`)
  try {
    const result = execSync(`node "${path.join(process.cwd(), "stella-cli", "index.mjs")}" -p "${text.replace(/"/g, '\\"')}"`, {
      encoding: "utf8",
      timeout: 120000,
      cwd: process.cwd(),
    })
    if (session) {
      updateSessionStats(session.id, {
        assistantMessages: session.stats.assistantMessages + 1,
        outputTokens: session.stats.outputTokens + Math.floor(result.length / 4),
        totalTokens: session.stats.totalTokens + Math.floor(result.length / 4),
      })
    }
    const output = result.trim().slice(0, 4000) 
    await editMessage(chatId, processingMsg.result.message_id, `<b>✅ Результат:</b>\n\n<pre>${escapeHtml(output)}</pre>`)
  } catch (e) {
    await editMessage(chatId, processingMsg.result.message_id, `<b>❌ Ошибка:</b>\n<pre>${escapeHtml(String(e.message).slice(0, 1000))}</pre>`)
  }
}
function escapeHtml(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}
async function handleCallback(callback) {
  const chatId = callback.message.chat.id
  const userId = callback.from.id
  const data = callback.data
  await answerCallback(callback.id)
  if (data === "cancel_auth") {
    const auth = loadAuth()
    delete auth.pendingCodes[userId]
    saveAuth(auth)
    await editMessage(chatId, callback.message.message_id, "❌ Авторизация отменена.\n\nНажмите /start для начала.")
    return
  }
  const auth = loadAuth()
  if (!auth.users[userId]) {
    await sendMessage(chatId, "❌ Нажмите /start для авторизации.")
    return
  }
  switch (data) {
    case "main_menu":
      await editMessage(chatId, callback.message.message_id, getMainMenu(userId).text, getMainMenu(userId))
      break
    case "sessions":
      await editMessage(chatId, callback.message.message_id, getSessionsList(userId).text, getSessionsList(userId))
      break
    case "new_session": {
      userStates.set(userId, { awaiting: "session_name" })
      await sendMessage(chatId, "📝 Введите название новой сессии:", {
        reply_markup: { inline_keyboard: [[{ text: "◀️ Отмена", callback_data: "main_menu" }]] },
      })
      break
    }
    case "status": {
      const session = getActiveSession()
      if (!session) {
        await sendMessage(chatId, "❌ Нет активной сессии. Создайте новую.", {
          reply_markup: { inline_keyboard: [[{ text: "➕ Создать", callback_data: "new_session" }]] },
        })
        return
      }
      await sendMessage(chatId, getSessionStats(session), {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🔄 Обновить", callback_data: "status" }],
            [{ text: "◀️ Назад", callback_data: "main_menu" }],
          ],
        },
      })
      break
    }
    case "premium": {
      const premium = isPremium(userId)
      const expiry = getPremiumExpiry(userId)
      let text = ""
      if (premium) {
        text = `<b>⭐ Premium активен</b>\n\nДействует до: ${expiry}\n\nДоступные функции:\n• Удалённое управление компьютером\n• Выполнение команд\n• Мониторинг сессий\n• Приоритетная поддержка`
      } else {
        text = `<b>⭐ Premium</b>\n\nФункции Premium стоят 50 звёзд Telegram.\n\nНо вы можете получить бесплатно, зная код!\n\nВведите код: <code>${PREMIUM_CODE}</code>\n(активация на 1 месяц)`
      }
      await sendMessage(chatId, text, {
        reply_markup: {
          inline_keyboard: premium
            ? [[{ text: "◀️ Назад", callback_data: "main_menu" }]]
            : [
                [{ text: "🔑 Активировать код", callback_data: "activate_premium" }],
                [{ text: "◀️ Назад", callback_data: "main_menu" }],
              ],
        },
      })
      break
    }
    case "activate_premium": {
      userStates.set(userId, { awaiting: "premium_code" })
      await sendMessage(chatId, "🔑 Введите код активации:", {
        reply_markup: { inline_keyboard: [[{ text: "◀️ Отмена", callback_data: "premium" }]] },
      })
      break
    }
    case "help":
      await sendMessage(chatId, `<b>Помощь</b>
<b>Команды:</b>
/start — Меню
/sessions — Мои сессии
/new — Новая сессия
/status — Статус сессии
/premium — Premium функции
<b>Удалённое управление:</b>
Напишите любую команду, и Stella выполнит её на вашем компьютере.
<b>Примеры:</b>
• "выключи телевизор"
• "сделай скриншот"
• "открой браузер"
• "покажи систему"
• "обнови код"
<b>Код активации Premium:</b>
<code>${PREMIUM_CODE}</code> (1 месяц бесплатно)`, {
        reply_markup: { inline_keyboard: [[{ text: "◀️ Назад", callback_data: "main_menu" }]] },
      })
      break
    default:
      if (data.startsWith("session_")) {
        const idx = parseInt(data.replace("session_", ""))
        const sessions = loadSessions()
        if (sessions.sessions[idx]) {
          sessions.activeSession = sessions.sessions[idx].id
          saveSessions(sessions)
          await sendMessage(chatId, getSessionStats(sessions.sessions[idx]), {
            reply_markup: {
              inline_keyboard: [
                [{ text: "🔄 Обновить", callback_data: `session_${idx}` }],
                [{ text: "◀️ К сессиям", callback_data: "sessions" }],
              ],
            },
          })
        }
      }
      break
  }
}
export async function notifyUser(telegramId, message) {
  const auth = loadAuth()
  if (!auth.users[telegramId]) return false
  return sendMessage(telegramId, `📬 <b>Уведомление:</b>\n\n${message}`)
}
export async function notifyAll(message) {
  const auth = loadAuth()
  for (const userId of Object.keys(auth.users)) {
    await sendMessage(auth.users[userId].chatId, `📬 <b>Уведомление:</b>\n\n${message}`)
  }
}
export const TELEGRAM_BRAIN_COMMANDS = {
  "/tg": "запустить Telegram бота",
  "/tg-stop": "остановить Telegram бота",
  "/tg-notify": "отправить уведомление всем",
  "/tg-sessions": "показать сессии в терминале",
}
export function getBotStatus() {
  return {
    running: botRunning,
    token: BOT_TOKEN.slice(0, 10) + "...",
    auth: loadAuth(),
    sessions: loadSessions(),
    premium: loadPremium(),
  }
}
export function verifyAuthCode(code) {
  const auth = loadAuth()
  for (const [userId, pending] of Object.entries(auth.pendingCodes)) {
    if (pending.code === code) {
      auth.users[userId] = {
        username: pending.username,
        chatId: pending.chatId,
        hardwareId: getHardwareFingerprint(),
        authenticatedAt: Date.now(),
      }
      delete auth.pendingCodes[userId]
      saveAuth(auth)
      return {
        success: true,
        userId,
        username: pending.username,
        chatId: pending.chatId,
      }
    }
  }
  return { success: false, error: "Код не найден или уже использован" }
}
export function getPendingCodes() {
  const auth = loadAuth()
  return auth.pendingCodes
}