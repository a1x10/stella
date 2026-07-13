import fs from "node:fs"
import path from "node:path"
import os from "node:os"
import { execSync } from "node:child_process"
const CONFIG_DIR = path.join(os.homedir(), ".stella", "gmail")
const TOKEN_FILE = path.join(CONFIG_DIR, "token.json")
const CREDS_FILE = path.join(CONFIG_DIR, "credentials.json")
const SENT_DIR = path.join(CONFIG_DIR, "sent")
function ensureDirs() {
  for (const dir of [CONFIG_DIR, SENT_DIR]) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  }
}
function getOAuth2URL(clientId, redirectUri) {
  const scopes = [
    "https:
    "https:
    "https:
    "https:
  ]
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: scopes.join(" "),
    access_type: "offline",
    prompt: "consent",
  })
  return `https:
}
async function exchangeCode(clientId, clientSecret, code, redirectUri) {
  const resp = await fetch("https:
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }).toString(),
  })
  return await resp.json()
}
async function refreshToken(clientId, clientSecret, refreshTokenValue) {
  const resp = await fetch("https:
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshTokenValue,
      grant_type: "refresh_token",
    }).toString(),
  })
  return await resp.json()
}
function loadToken() {
  if (!fs.existsSync(TOKEN_FILE)) return null
  return JSON.parse(fs.readFileSync(TOKEN_FILE, "utf8"))
}
function saveToken(token) {
  ensureDirs()
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(token, null, 2))
}
function loadCredentials() {
  if (!fs.existsSync(CREDS_FILE)) return null
  return JSON.parse(fs.readFileSync(CREDS_FILE, "utf8"))
}
function buildMimeMessage({ to, cc, bcc, subject, body, isHtml, attachments }) {
  const boundary = `stella_boundary_${Date.now()}_${Math.random().toString(36).slice(2)}`
  const lines = []
  lines.push(`To: ${to}`)
  if (cc) lines.push(`Cc: ${cc}`)
  if (bcc) lines.push(`Bcc: ${bcc}`)
  lines.push(`Subject: ${subject}`)
  lines.push("MIME-Version: 1.0")
  if (attachments && attachments.length > 0) {
    lines.push(`Content-Type: multipart/mixed; boundary="${boundary}"`)
    lines.push("")
    lines.push(`--${boundary}`)
    if (isHtml) {
      lines.push("Content-Type: text/html; charset=UTF-8")
    } else {
      lines.push("Content-Type: text/plain; charset=UTF-8")
    }
    lines.push("")
    lines.push(body)
    for (const att of attachments) {
      const filePath = att
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath)
        const b64 = content.toString("base64")
        const name = path.basename(filePath)
        lines.push("")
        lines.push(`--${boundary}`)
        lines.push(`Content-Type: application/octet-stream; name="${name}"`)
        lines.push(`Content-Disposition: attachment; filename="${name}"`)
        lines.push("Content-Transfer-Encoding: base64")
        lines.push("")
        lines.push(b64.match(/.{1,76}/g).join("\n"))
      }
    }
    lines.push("")
    lines.push(`--${boundary}--`)
  } else {
    if (isHtml) {
      lines.push("Content-Type: text/html; charset=UTF-8")
    } else {
      lines.push("Content-Type: text/plain; charset=UTF-8")
    }
    lines.push("")
    lines.push(body)
  }
  return Buffer.from(lines.join("\r\n")).toString("base64url")
}
async function gmailApiRequest(accessToken, method, url, body) {
  const opts = {
    method,
    headers: { Authorization: `Bearer ${accessToken}` },
  }
  if (body) {
    opts.headers["Content-Type"] = "application/json"
    opts.body = JSON.stringify(body)
  }
  const resp = await fetch(url, opts)
  return await resp.json()
}
export class GmailClient {
  constructor() {
    ensureDirs()
  }
  isConfigured() {
    return fs.existsSync(CREDS_FILE) && fs.existsSync(TOKEN_FILE)
  }
  getSetupURL() {
    const creds = loadCredentials()
    if (!creds || !creds.installed || !creds.installed.client_id) return null
    const redirectUri = creds.installed.redirect_uris?.[0] || "http:
    return getOAuth2URL(creds.installed.client_id, redirectUri)
  }
  async completeAuth(code) {
    const creds = loadCredentials()
    if (!creds || !creds.installed) return { success: false, error: "No credentials.json" }
    const redirectUri = creds.installed.redirect_uris?.[0] || "http:
    const token = await exchangeCode(
      creds.installed.client_id,
      creds.installed.client_secret,
      code,
      redirectUri
    )
    if (token.error) return { success: false, error: token.error_description || token.error }
    saveToken(token)
    return { success: true }
  }
  async getAccessToken() {
    const creds = loadCredentials()
    const token = loadToken()
    if (!creds || !token) return null
    if (token.expiry_date && token.expiry_date > Date.now()) return token.access_token
    const refreshed = await refreshToken(
      creds.installed.client_id,
      creds.installed.client_secret,
      token.refresh_token
    )
    if (refreshed.access_token) {
      token.access_token = refreshed.access_token
      token.expiry_date = Date.now() + (refreshed.expires_in || 3600) * 1000
      saveToken(token)
      return refreshed.access_token
    }
    return null
  }
  async sendEmail({ to, cc, bcc, subject, body, isHtml = false, attachments = [] }) {
    const accessToken = await this.getAccessToken()
    if (!accessToken) return { success: false, error: "Not authenticated. Run /gmail-setup first." }
    const raw = buildMimeMessage({ to, cc, bcc, subject, body, isHtml, attachments })
    const result = await gmailApiRequest(
      accessToken,
      "POST",
      "https:
      { raw }
    )
    if (result.id) {
      const sentFile = path.join(SENT_DIR, `${Date.now()}.json`)
      fs.writeFileSync(sentFile, JSON.stringify({
        id: result.id,
        to, cc, bcc, subject,
        date: new Date().toISOString(),
      }, null, 2))
      return { success: true, messageId: result.id }
    }
    return { success: false, error: result.error?.message || "Send failed" }
  }
  async listMessages({ query = "", maxResults = 20, labelIds = [] } = {}) {
    const accessToken = await this.getAccessToken()
    if (!accessToken) return { success: false, error: "Not authenticated" }
    const params = new URLSearchParams({ maxResults: String(maxResults) })
    if (query) params.set("q", query)
    for (const lid of labelIds) params.append("labelIds", lid)
    const list = await gmailApiRequest(
      accessToken,
      "GET",
      `https:
    )
    if (!list.messages) return { success: true, messages: [] }
    const messages = []
    for (const msg of list.messages.slice(0, maxResults)) {
      const detail = await gmailApiRequest(
        accessToken,
        "GET",
        `https:
      )
      const headers = detail.payload?.headers || []
      const get = (name) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || ""
      messages.push({
        id: msg.id,
        threadId: msg.threadId,
        subject: get("Subject"),
        from: get("From"),
        to: get("To"),
        date: get("Date"),
        snippet: detail.snippet || "",
        labels: detail.labelIds || [],
      })
    }
    return { success: true, messages }
  }
  async getMessage(messageId) {
    const accessToken = await this.getAccessToken()
    if (!accessToken) return { success: false, error: "Not authenticated" }
    const msg = await gmailApiRequest(
      accessToken,
      "GET",
      `https:
    )
    if (!msg.id) return { success: false, error: "Message not found" }
    const headers = msg.payload?.headers || []
    const get = (name) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || ""
    let textBody = ""
    let htmlBody = ""
    const attachments = []
    function extractParts(payload) {
      if (!payload) return
      if (payload.mimeType === "text/plain" && payload.body?.data) {
        textBody += Buffer.from(payload.body.data, "base64url").toString("utf8")
      }
      if (payload.mimeType === "text/html" && payload.body?.data) {
        htmlBody += Buffer.from(payload.body.data, "base64url").toString("utf8")
      }
      if (payload.filename && payload.body?.attachmentId) {
        attachments.push({
          filename: payload.filename,
          mimeType: payload.mimeType,
          size: payload.body.size,
          attachmentId: payload.body.attachmentId,
        })
      }
      for (const part of payload.parts || []) {
        extractParts(part)
      }
    }
    extractParts(msg.payload)
    return {
      success: true,
      message: {
        id: msg.id,
        threadId: msg.threadId,
        subject: get("Subject"),
        from: get("From"),
        to: get("To"),
        cc: get("Cc"),
        date: get("Date"),
        textBody,
        htmlBody,
        attachments,
        labels: msg.labelIds || [],
        snippet: msg.snippet || "",
      },
    }
  }
  async getAttachment(messageId, attachmentId, filename) {
    const accessToken = await this.getAccessToken()
    if (!accessToken) return { success: false, error: "Not authenticated" }
    const resp = await fetch(
      `https:
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    const data = await resp.json()
    if (data.data) {
      const buffer = Buffer.from(data.data, "base64url")
      const savePath = path.join(SENT_DIR, filename)
      fs.writeFileSync(savePath, buffer)
      return { success: true, path: savePath, size: buffer.length }
    }
    return { success: false, error: "Attachment not found" }
  }
  async listLabels() {
    const accessToken = await this.getAccessToken()
    if (!accessToken) return { success: false, error: "Not authenticated" }
    const result = await gmailApiRequest(
      accessToken,
      "GET",
      "https:
    )
    return {
      success: true,
      labels: (result.labels || []).map(l => ({ id: l.id, name: l.name, type: l.type })),
    }
  }
  async markAsRead(messageId) {
    const accessToken = await this.getAccessToken()
    if (!accessToken) return { success: false, error: "Not authenticated" }
    await gmailApiRequest(
      accessToken,
      "POST",
      `https:
      { removeLabelIds: ["UNREAD"] }
    )
    return { success: true }
  }
  async markAsUnread(messageId) {
    const accessToken = await this.getAccessToken()
    if (!accessToken) return { success: false, error: "Not authenticated" }
    await gmailApiRequest(
      accessToken,
      "POST",
      `https:
      { addLabelIds: ["UNREAD"] }
    )
    return { success: true }
  }
  async deleteMessage(messageId) {
    const accessToken = await this.getAccessToken()
    if (!accessToken) return { success: false, error: "Not authenticated" }
    await gmailApiRequest(
      accessToken,
      "DELETE",
      `https:
    )
    return { success: true }
  }
  async getProfile() {
    const accessToken = await this.getAccessToken()
    if (!accessToken) return { success: false, error: "Not authenticated" }
    const result = await gmailApiRequest(
      accessToken,
      "GET",
      "https:
    )
    return {
      success: true,
      email: result.emailAddress,
      totalMessages: result.messagesTotal,
    }
  }
  async searchMessages(query, maxResults = 10) {
    return this.listMessages({ query, maxResults })
  }
  async getUnreadCount() {
    const result = await this.listMessages({ query: "is:unread", maxResults: 1, labelIds: ["INBOX"] })
    if (!result.success) return 0
    const full = await this.listMessages({ query: "is:unread", maxResults: 100 })
    return full.messages?.length || 0
  }
}