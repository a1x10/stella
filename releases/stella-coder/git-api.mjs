import { execSync } from "child_process"
import { readFileSync, existsSync } from "fs"
import { join } from "path"
import http from "http"
import https from "https"

function apiRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith("https") ? https : http
    const urlObj = new URL(url)
    const headers = {
      "Accept": "application/vnd.github+json",
      ...options.headers,
    }
    if (options.token) headers["Authorization"] = `Bearer ${options.token}`

    const reqOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: options.method || "GET",
      headers,
    }

    const req = mod.request(reqOptions, (res) => {
      let data = ""
      res.on("data", (chunk) => data += chunk)
      res.on("end", () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }) }
        catch { resolve({ status: res.statusCode, data }) }
      })
    })
    req.on("error", reject)
    if (options.body) req.write(JSON.stringify(options.body))
    req.end()
  })
}

function getGitRemote() {
  try {
    const remote = execSync("git remote get-url origin", { encoding: "utf-8" }).trim()
    // Parse owner/repo from URL
    const match = remote.match(/github\.com[/:]([^/]+)\/([^/.]+)/)
    if (match) return { provider: "github", owner: match[1], repo: match[2] }
    const glMatch = remote.match(/gitlab\.com[/:]([^/]+)\/([^/.]+)/)
    if (glMatch) return { provider: "gitlab", owner: glMatch[1], repo: glMatch[2] }
    return { provider: "unknown", remote }
  } catch {
    return null
  }
}

function getToken(provider) {
  // Try environment variables
  if (provider === "github") return process.env.GITHUB_TOKEN || process.env.GH_TOKEN
  if (provider === "gitlab") return process.env.GITLAB_TOKEN || process.env.GL_TOKEN

  // Try git credential
  try {
    const config = execSync("git config --get credential.helper", { encoding: "utf-8" }).trim()
    if (config.includes("store")) {
      const credPath = join(process.env.USERPROFILE || process.env.HOME || "", ".git-credentials")
      if (existsSync(credPath)) {
        const creds = readFileSync(credPath, "utf-8")
        const match = creds.match(/https:\/\/[^:]+:([^@]+)@github\.com/)
        if (match) return match[1]
      }
    }
  } catch {}

  return null
}

export class GitAPI {
  constructor() {
    this.info = getGitRemote()
    this.token = this.info ? getToken(this.info.provider) : null
  }

  isConfigured() {
    return this.info && this.info.provider !== "unknown"
  }

  hasToken() {
    return !!this.token
  }

  // ===== ISSUES =====
  async listIssues(state = "open", perPage = 20) {
    if (!this.isConfigured()) return { success: false, error: "No GitHub/GitLab remote configured" }
    const { provider, owner, repo } = this.info
    const token = this.token

    if (provider === "github") {
      const url = `https://api.github.com/repos/${owner}/${repo}/issues?state=${state}&per_page=${perPage}`
      const res = await apiRequest(url, { token: this.token })
      return { success: true, issues: Array.isArray(res.data) ? res.data : [] }
    }

    if (provider === "gitlab") {
      const encoded = encodeURIComponent(`${owner}/${repo}`)
      const url = `https://gitlab.com/api/v4/projects/${encoded}/issues?state=${state}`
      const res = await apiRequest(url, { token: this.token })
      return { success: true, issues: Array.isArray(res.data) ? res.data : [] }
    }

    return { success: false, error: "Unknown provider" }
  }

  async createIssue(title, body, labels = []) {
    if (!this.isConfigured()) return { success: false, error: "No git remote configured" }

    const { provider, owner, repo } = this.info

    if (provider === "github") {
      const url = `https://api.github.com/repos/${owner}/${repo}/issues`
      const res = await apiRequest(url, {
        method: "POST",
        token: this.token,
        body: { title, body, labels },
      })
      return { success: res.status === 201, data: res.data, url: res.data?.html_url }
    }

    if (provider === "gitlab") {
      const encoded = encodeURIComponent(`${owner}/${repo}`)
      const url = `https://gitlab.com/api/v4/projects/${encoded}/issues`
      const res = await apiRequest(url, {
        method: "POST",
        token: this.token,
        body: { title, description: body, labels: labels.join(",") },
      })
      return { success: res.status === 201, data: res.data, url: res.data?.web_url }
    }

    return { success: false, error: "Unknown provider" }
  }

  async closeIssue(issueNumber) {
    if (!this.isConfigured()) return { success: false, error: "No git remote configured" }

    const { provider, owner, repo } = this.info

    if (provider === "github") {
      const url = `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}`
      const res = await apiRequest(url, {
        method: "PATCH",
        token: this.token,
        body: { state: "closed" },
      })
      return { success: res.status === 200, data: res.data }
    }

    if (provider === "gitlab") {
      const encoded = encodeURIComponent(`${owner}/${repo}`)
      const url = `https://gitlab.com/api/v4/projects/${encoded}/issues/${issueNumber}`
      const res = await apiRequest(url, {
        method: "PUT",
        token: this.token,
        body: { state_event: "close" },
      })
      return { success: res.status === 200, data: res.data }
    }

    return { success: false, error: "Unknown provider" }
  }

  // ===== PULL REQUESTS / MERGE REQUESTS =====
  async listPRs(state = "open") {
    if (!this.isConfigured()) return { success: false, error: "No git remote configured" }

    const { provider, owner, repo } = this.info

    if (provider === "github") {
      const url = `https://api.github.com/repos/${owner}/${repo}/pulls?state=${state}`
      const res = await apiRequest(url, { token: this.token })
      return { success: true, prs: Array.isArray(res.data) ? res.data : [] }
    }

    if (provider === "gitlab") {
      const encoded = encodeURIComponent(`${owner}/${repo}`)
      const stateMap = { open: "opened", closed: "closed", merged: "merged" }
      const url = `https://gitlab.com/api/v4/projects/${encoded}/merge_requests?state=${stateMap[state] || state}`
      const res = await apiRequest(url, { token: this.token })
      return { success: true, prs: Array.isArray(res.data) ? res.data : [] }
    }

    return { success: false, error: "Unknown provider" }
  }

  async createPR(title, body, head = "main", base = "main") {
    if (!this.isConfigured()) return { success: false, error: "No git remote configured" }

    const { provider, owner, repo } = this.info

    if (provider === "github") {
      const url = `https://api.github.com/repos/${owner}/${repo}/pulls`
      const res = await apiRequest(url, {
        method: "POST",
        token: this.token,
        body: { title, body, head, base },
      })
      return { success: res.status === 201, data: res.data, url: res.data?.html_url }
    }

    if (provider === "gitlab") {
      const encoded = encodeURIComponent(`${owner}/${repo}`)
      const url = `https://gitlab.com/api/v4/projects/${encoded}/merge_requests`
      const res = await apiRequest(url, {
        method: "POST",
        token: this.token,
        body: { title, description: body, source_branch: head, target_branch: base },
      })
      return { success: res.status === 201, data: res.data, url: res.data?.web_url }
    }

    return { success: false, error: "Unknown provider" }
  }

  async reviewPR(prNumber, event, body) {
    if (!this.isConfigured()) return { success: false, error: "No git remote configured" }

    const { provider, owner, repo } = this.info

    if (provider === "github") {
      const url = `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/reviews`
      const res = await apiRequest(url, {
        method: "POST",
        token: this.token,
        body: { event, body },
      })
      return { success: res.status === 200 || res.status === 201, data: res.data }
    }

    if (provider === "gitlab") {
      const encoded = encodeURIComponent(`${owner}/${repo}`)
      const url = `https://gitlab.com/api/v4/projects/${encoded}/merge_requests/${prNumber}/approvals`
      const res = await apiRequest(url, {
        method: "POST",
        token: this.token,
      })
      return { success: res.status === 201, data: res.data }
    }

    return { success: false, error: "Unknown provider" }
  }

  async mergePR(prNumber) {
    if (!this.isConfigured()) return { success: false, error: "No git remote configured" }

    const { provider, owner, repo } = this.info

    if (provider === "github") {
      const url = `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/merge`
      const res = await apiRequest(url, {
        method: "PUT",
        token: this.token,
        body: { merge_method: "squash" },
      })
      return { success: res.status === 200, data: res.data }
    }

    if (provider === "gitlab") {
      const encoded = encodeURIComponent(`${owner}/${repo}`)
      const url = `https://gitlab.com/api/v4/projects/${encoded}/merge_requests/${prNumber}/merge`
      const res = await apiRequest(url, {
        method: "PUT",
        token: this.token,
      })
      return { success: res.status === 200, data: res.data }
    }

    return { success: false, error: "Unknown provider" }
  }

  // ===== CODE REVIEW =====
  async getPRFiles(prNumber) {
    if (!this.isConfigured()) return { success: false, error: "No git remote configured" }

    const { provider, owner, repo } = this.info

    if (provider === "github") {
      const url = `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/files`
      const res = await apiRequest(url, { token: this.token })
      return { success: true, files: Array.isArray(res.data) ? res.data : [] }
    }

    if (provider === "gitlab") {
      const encoded = encodeURIComponent(`${owner}/${repo}`)
      const url = `https://gitlab.com/api/v4/projects/${encoded}/merge_requests/${prNumber}/changes`
      const res = await apiRequest(url, { token: this.token })
      return { success: true, files: res.data?.changes || [] }
    }

    return { success: false, error: "Unknown provider" }
  }

  async addComment(prNumber, body, filePath, position) {
    if (!this.isConfigured()) return { success: false, error: "No git remote configured" }

    const { provider, owner, repo } = this.info

    if (provider === "github" && filePath && position) {
      // Get latest commit SHA
      const prUrl = `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`
      const prRes = await apiRequest(prUrl, { token: this.token })
      const commitId = prRes.data?.head?.sha

      if (commitId) {
        const url = `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/comments`
        const res = await apiRequest(url, {
          method: "POST",
          token: this.token,
          body: { body, path: filePath, position, commit_id: commitId },
        })
        return { success: res.status === 201, data: res.data }
      }
    }

    // Fallback: general comment
    return await this.reviewPR(prNumber, "COMMENT", body)
  }

  // ===== REPOS =====
  async getRepoInfo() {
    if (!this.isConfigured()) return { success: false, error: "No git remote configured" }

    const { provider, owner, repo } = this.info

    if (provider === "github") {
      const url = `https://api.github.com/repos/${owner}/${repo}`
      const res = await apiRequest(url, { token: this.token })
      return { success: true, repo: res.data }
    }

    if (provider === "gitlab") {
      const encoded = encodeURIComponent(`${owner}/${repo}`)
      const url = `https://gitlab.com/api/v4/projects/${encoded}`
      const res = await apiRequest(url, { token: this.token })
      return { success: true, repo: res.data }
    }

    return { success: false, error: "Unknown provider" }
  }

  async listBranches() {
    if (!this.isConfigured()) return { success: false, error: "No git remote configured" }

    const { provider, owner, repo } = this.info

    if (provider === "github") {
      const url = `https://api.github.com/repos/${owner}/${repo}/branches`
      const res = await apiRequest(url, { token: this.token })
      return { success: true, branches: Array.isArray(res.data) ? res.data.map(b => b.name) : [] }
    }

    if (provider === "gitlab") {
      const encoded = encodeURIComponent(`${owner}/${repo}`)
      const url = `https://gitlab.com/api/v4/projects/${encoded}/repository/branches`
      const res = await apiRequest(url, { token: this.token })
      return { success: true, branches: Array.isArray(res.data) ? res.data.map(b => b.name) : [] }
    }

    return { success: false, error: "Unknown provider" }
  }

  async listReleases() {
    if (!this.isConfigured()) return { success: false, error: "No git remote configured" }

    const { provider, owner, repo } = this.info

    if (provider === "github") {
      const url = `https://api.github.com/repos/${owner}/${repo}/releases`
      const res = await apiRequest(url, { token: this.token })
      return { success: true, releases: Array.isArray(res.data) ? res.data : [] }
    }

    if (provider === "gitlab") {
      const encoded = encodeURIComponent(`${owner}/${repo}`)
      const url = `https://gitlab.com/api/v4/projects/${encoded}/releases`
      const res = await apiRequest(url, { token: this.token })
      return { success: true, releases: Array.isArray(res.data) ? res.data : [] }
    }

    return { success: false, error: "Unknown provider" }
  }

  async createRelease(tag, name, body) {
    if (!this.isConfigured()) return { success: false, error: "No git remote configured" }

    const { provider, owner, repo } = this.info

    if (provider === "github") {
      const url = `https://api.github.com/repos/${owner}/${repo}/releases`
      const res = await apiRequest(url, {
        method: "POST",
        token: this.token,
        body: { tag_name: tag, name, body },
      })
      return { success: res.status === 201, data: res.data, url: res.data?.html_url }
    }

    return { success: false, error: "Release creation only supported on GitHub" }
  }
}

export default GitAPI
