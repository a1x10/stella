import { readFileSync, writeFileSync, mkdirSync, existsSync, appendFileSync } from "fs"
import { join } from "path"
import { homedir } from "os"
import { execSync } from "child_process"

const STELLA_DIR = join(homedir(), ".stella")
const AUTO_DIR = join(STELLA_DIR, "autonomous")
const MEMORY_FILE = join(AUTO_DIR, "memory.json")
const TASKS_FILE = join(AUTO_DIR, "tasks.json")
const LOG_FILE = join(AUTO_DIR, "activity.log")
const DASHBOARD_FILE = join(AUTO_DIR, "dashboard.html")
const STATE_FILE = join(AUTO_DIR, "state.json")

function ensureDir() {
  if (!existsSync(AUTO_DIR)) mkdirSync(AUTO_DIR, { recursive: true })
}

function loadJSON(file, fallback) {
  try { return JSON.parse(readFileSync(file, "utf-8")) } catch { return fallback }
}

function saveJSON(file, data) {
  ensureDir()
  writeFileSync(file, JSON.stringify(data, null, 2))
}

function logEntry(action, details) {
  ensureDir()
  const entry = `[${new Date().toISOString()}] ${action}: ${details}\n`
  appendFileSync(LOG_FILE, entry)
}

function shellRun(cmd) {
  try {
    execSync(cmd, { timeout: 60000, stdio: "pipe", shell: true })
    return true
  } catch { return false }
}

export class AutonomousAgent {
  constructor() {
    ensureDir()
    this.memory = loadJSON(MEMORY_FILE, { projects: [], accounts: [], videos: [], earnings: 0, lessons: [] })
    this.tasks = loadJSON(TASKS_FILE, { queue: [], completed: [], failed: [] })
    this.state = loadJSON(STATE_FILE, { running: false, startedAt: null, goal: "", pid: null, iterations: 0 })
  }

  save() {
    saveJSON(MEMORY_FILE, this.memory)
    saveJSON(TASKS_FILE, this.tasks)
    saveJSON(STATE_FILE, this.state)
  }

  planGoal(goal) {
    const plan = {
      id: Date.now().toString(36),
      goal,
      createdAt: new Date().toISOString(),
      steps: [],
      status: "planning"
    }

    const g = goal.toLowerCase()

    if (g.includes("видео") || g.includes("video")) {
      plan.steps = [
        { id: "concept", name: "Create video concept and script", status: "pending", subtasks: [
          "Write a compelling script/storyboard for the video",
          "Create HTML presentation with animations showing the product",
          "Add text overlays, transitions, and effects"
        ], results: [] },
        { id: "build_video", name: "Build HTML video/animation", status: "pending", subtasks: [
          "Create self-contained HTML file with CSS animations",
          "Add GSAP or CSS keyframe animations",
          "Create cinematic transitions between scenes",
          "Add background music placeholder"
        ], results: [] },
        { id: "export", name: "Export and place on desktop", status: "pending", subtasks: [
          "Copy the HTML video file to Desktop",
          "Create a .bat launcher to open it in browser",
          "Create a poster/thumbnail image"
        ], results: [] },
        { id: "promote", name: "Promote the content", status: "pending", subtasks: [
          "Create social media post templates",
          "Write promotional text for sharing"
        ], results: [] }
      ]
    } else if (g.includes("приложен") || g.includes("app") || g.includes("заработ") || g.includes("$") || g.includes("монетиз") || g.includes("donate") || g.includes("заработ")) {
      plan.steps = [
        { id: "research", name: "Research market & competitors", status: "pending", subtasks: [
          "Search for trending app ideas and niches",
          "Analyze top competitors in the space",
          "Define monetization strategy (ads, subscriptions, donations)"
        ], results: [] },
        { id: "architect", name: "Architecture & design", status: "pending", subtasks: [
          "Choose tech stack (Next.js + Tailwind + Supabase)",
          "Design database schema",
          "Create API structure"
        ], results: [] },
        { id: "build", name: "Build the application", status: "pending", subtasks: [
          "Create project with package.json, config files",
          "Build frontend with UI components",
          "Build backend API routes",
          "Add Stripe/Paddle payment integration",
          "Add donation button (Buy Me a Coffee / Ko-fi)",
          "Add user authentication"
        ], results: [] },
        { id: "deploy", name: "Deploy to production", status: "pending", subtasks: [
          "Initialize git repo, commit all files",
          "Push to GitHub",
          "Deploy frontend to Vercel",
          "Deploy backend to Railway/Render",
          "Configure custom domain if needed"
        ], results: [] },
        { id: "accounts", name: "Create promo accounts", status: "pending", subtasks: [
          "Create YouTube channel for the project",
          "Create TikTok account",
          "Create Twitter/X account",
          "Create Telegram channel",
          "Create Product Hunt listing"
        ], results: [] },
        { id: "content", name: "Create promotional content", status: "pending", subtasks: [
          "Write launch blog post",
          "Create demo video script",
          "Write Reddit posts for r/SideProject, r/webdev",
          "Create Hacker News Show HN post",
          "Write Product Hunt description"
        ], results: [] },
        { id: "dashboard", name: "Build management dashboard", status: "pending", subtasks: [
          "Create HTML dashboard page",
          "Add analytics tracking",
          "Add financial metrics view",
          "Add user management"
        ], results: [] },
        { id: "optimize", name: "Growth & optimization", status: "pending", subtasks: [
          "SEO optimization",
          "Performance audit",
          "Add analytics (Google Analytics / Plausible)",
          "Set up email list"
        ], results: [] }
      ]
    } else if (g.includes("сайт") || g.includes("website") || g.includes("лендинг")) {
      plan.steps = [
        { id: "design", name: "Design the website", status: "pending", subtasks: [
          "Create wireframe and layout",
          "Design UI with modern dark theme",
          "Write compelling copy"
        ], results: [] },
        { id: "build", name: "Build the website", status: "pending", subtasks: [
          "Create HTML/CSS/JS files",
          "Add responsive design",
          "Add animations and interactions"
        ], results: [] },
        { id: "seo", name: "SEO & performance", status: "pending", subtasks: [
          "Add meta tags and Open Graph",
          "Optimize images and loading",
          "Add structured data"
        ], results: [] },
        { id: "deploy", name: "Deploy the website", status: "pending", subtasks: [
          "Push to GitHub",
          "Enable GitHub Pages or deploy to Vercel",
          "Configure domain"
        ], results: [] },
        { id: "promo", name: "Promote the website", status: "pending", subtasks: [
          "Share on social media",
          "Submit to directories",
          "Run ad campaigns"
        ], results: [] }
      ]
    } else {
      plan.steps = [
        { id: "analyze", name: "Analyze the task", status: "pending", subtasks: [
          "Break down requirements",
          "Identify needed resources",
          "Create execution plan"
        ], results: [] },
        { id: "execute", name: "Execute the plan", status: "pending", subtasks: [
          "Implement step by step",
          "Test at each stage",
          "Handle errors and retry"
        ], results: [] },
        { id: "deliver", name: "Deliver results", status: "pending", subtasks: [
          "Document everything",
          "Create summary report",
          "Generate dashboard"
        ], results: [] }
      ]
    }

    this.tasks.queue.push(plan)
    this.state.goal = goal
    this.save()
    logEntry("PLAN_CREATED", goal)
    return plan
  }

  async executeSubtask(subtask, goal, apiCall) {
    const prompt = `You are an autonomous coding agent. Complete this task: "${subtask}"
Context: Goal is "${goal}"

You MUST return a JSON object with actual executable commands and file contents.
DO NOT just describe — ACTUALLY PLAN THE EXECUTION.

Return this exact JSON structure:
{
  "action": "what will be done",
  "filesToCreate": [
    {"path": "relative/path/file.ext", "content": "FULL file content with all code"}
  ],
  "commandsToRun": [
    "shell command 1",
    "shell command 2"
  ],
  "result": "description of what will happen",
  "nextSteps": ["what to do next"]
}

IMPORTANT:
- filesToCreate must contain REAL, COMPLETE, WORKING code (not placeholders)
- commandsToRun must be real shell commands (npm init, mkdir, etc.)
- Return ONLY the JSON, no markdown, no explanations`

    const response = await apiCall(prompt)
    let parsed
    try {
      // Strip markdown code fences if present
      let clean = response.trim()
      if (clean.startsWith("```")) {
        clean = clean.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "")
      }
      parsed = JSON.parse(clean)
    } catch {
      parsed = { action: "completed", result: response, filesToCreate: [], commandsToRun: [] }
    }

    const created = []
    const executed = []

    // Create actual files
    if (parsed.filesToCreate && Array.isArray(parsed.filesToCreate)) {
      for (const file of parsed.filesToCreate) {
        if (file.path && file.content) {
          try {
            const fullPath = join(process.cwd(), file.path)
            const dir = dirname(fullPath)
            if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
            writeFileSync(fullPath, file.content, "utf-8")
            created.push(file.path)
            this.memory.projects.push({ file: file.path, created: new Date().toISOString(), goal, subtask })
            logEntry("FILE_CREATED", file.path)
          } catch (err) {
            logEntry("FILE_ERROR", `${file.path}: ${err.message}`)
          }
        }
      }
    }

    // Execute actual commands
    if (parsed.commandsToRun && Array.isArray(parsed.commandsToRun)) {
      for (const cmd of parsed.commandsToRun) {
        try {
          execSync(cmd, { timeout: 30000, stdio: "pipe", shell: true, cwd: process.cwd() })
          executed.push(cmd)
          logEntry("CMD_RUN", cmd)
        } catch (err) {
          logEntry("CMD_FAIL", `${cmd}: ${err.message?.slice(0, 100)}`)
        }
      }
    }

    logEntry("SUBTASK_DONE", `${subtask}: ${created.length} files, ${executed.length} cmds`)
    this.save()
    return { ...parsed, filesCreated: created, commandsRun: executed }
  }

  async runIteration(apiCall, onProgress) {
    const plan = this.tasks.queue.find(p => p.status !== "completed" && p.status !== "failed")
    if (!plan) return null

    plan.status = "running"
    const step = plan.steps.find(s => s.status === "pending")
    if (!step) {
      const hasFailed = plan.steps.some(s => s.status === "failed")
      plan.status = hasFailed ? "failed" : "completed"
      this.save()
      logEntry("PLAN_DONE", `${plan.goal}: ${plan.status}`)
      return { type: "plan_done", plan }
    }

    step.status = "running"
    this.save()
    if (onProgress) onProgress(`⚡ Executing: ${step.name}`)
    logEntry("STEP_START", step.name)

    const stepResults = []
    let failed = false

    for (const subtask of step.subtasks) {
      try {
        if (onProgress) onProgress(`  → ${subtask}`)
        const result = await this.executeSubtask(subtask, plan.goal, apiCall)
        stepResults.push(result)
        
        // Report created files
        if (result.filesCreated && result.filesCreated.length > 0) {
          for (const f of result.filesCreated) {
            if (onProgress) onProgress(`  📄 Created: ${f}`)
          }
        }
        if (result.commandsRun && result.commandsRun.length > 0) {
          for (const c of result.commandsRun) {
            if (onProgress) onProgress(`  ⚙️ Ran: ${c}`)
          }
        }
      } catch (err) {
        logEntry("SUBTASK_FAIL", `${subtask}: ${err.message}`)
        stepResults.push({ error: err.message })
        failed = true
      }
    }

    step.status = failed ? "failed" : "completed"
    step.results = stepResults
    this.save()
    logEntry("STEP_DONE", `${step.name}: ${step.status}`)
    return { type: "step_done", step, plan }
  }

  async start(goal, apiCall, onProgress) {
    this.state.running = true
    this.state.startedAt = new Date().toISOString()
    this.state.goal = goal
    this.state.iterations = 0
    this.save()

    const plan = this.planGoal(goal)
    logEntry("AGENT_START", goal)

    while (this.state.running) {
      this.state.iterations++
      const result = await this.runIteration(apiCall, onProgress)

      if (!result) {
        this.state.running = false
        this.save()
        logEntry("AGENT_DONE", "All plans completed!")
        if (onProgress) onProgress("ALL_DONE")
        break
      }

      if (result.type === "plan_done") {
        if (onProgress) onProgress(`Plan completed: ${result.plan.goal}`)
      } else if (result.type === "step_done") {
        if (onProgress) onProgress(`Step done: ${result.step.name}`)
      }

      await new Promise(r => setTimeout(r, 500))
    }

    this.state.running = false
    this.save()
  }

  stop() {
    this.state.running = false
    this.save()
    logEntry("AGENT_STOPPED", "Manually stopped")
  }

  getStatus() {
    const plan = this.tasks.queue.find(p => p.status === "running" || p.status === "planning")
    return {
      running: this.state.running,
      goal: this.state.goal,
      iterations: this.state.iterations,
      startedAt: this.state.startedAt,
      currentPlan: plan ? {
        goal: plan.goal,
        status: plan.status,
        steps: plan.steps.map(s => ({
          name: s.name,
          status: s.status,
          total: s.subtasks.length,
          done: (s.results || []).filter(r => !r.error).length
        }))
      } : null,
      completedPlans: this.tasks.queue.filter(p => p.status === "completed").length,
      failedPlans: this.tasks.queue.filter(p => p.status === "failed").length,
      totalFiles: this.memory.projects.length,
      totalEarnings: this.memory.earnings,
      accounts: this.memory.accounts.length
    }
  }

  generateDashboard() {
    const completedPlans = this.tasks.queue.filter(p => p.status === "completed")
    const failedPlans = this.tasks.queue.filter(p => p.status === "failed")
    const activePlans = this.tasks.queue.filter(p => p.status === "running" || p.status === "planning")
    const allFiles = [...new Set(this.memory.projects.map(p => p.file))]
    const logs = existsSync(LOG_FILE) ? readFileSync(LOG_FILE, "utf-8").split("\n").filter(Boolean).slice(-100) : []

    const html = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Stella Autonomous Dashboard</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{background:#0a0a0f;color:#f8fafc;font-family:'Courier New',monospace;min-height:100vh}
    .hdr{background:linear-gradient(135deg,#0f0f1a,#1a0a2e);padding:2rem 3rem;border-bottom:2px solid #22c55e;display:flex;justify-content:space-between;align-items:center}
    .hdr h1{font-size:2rem;color:#22c55e}
    .hdr .status{display:flex;align-items:center;gap:8px}
    .hdr .dot{width:12px;height:12px;border-radius:50%;background:${this.state.running ? "#22c55e" : "#ef4444"};animation:pulse 1.5s infinite}
    @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
    .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:1rem;padding:2rem 3rem}
    .card{background:#111118;border:1px solid #22c55e33;border-radius:12px;padding:1.5rem;text-align:center;transition:border-color .3s}
    .card:hover{border-color:#22c55e}
    .card .num{font-size:2.5rem;color:#22c55e;font-weight:bold}
    .card .lbl{color:#94a3b8;margin-top:.3rem;font-size:.85rem}
    .sec{padding:1.5rem 3rem}
    .sec h2{color:#22c55e;font-size:1.3rem;margin-bottom:1rem;display:flex;align-items:center;gap:8px}
    .plan-card{background:#111118;border:1px solid #333;border-radius:12px;padding:1.5rem;margin-bottom:1rem}
    .plan-card h3{color:#e2e8f0;font-size:1.1rem}
    .plan-card .meta{color:#64748b;font-size:.8rem;margin:.5rem 0}
    .step-row{display:flex;align-items:center;gap:10px;padding:.6rem 0;border-bottom:1px solid #1a1a2e}
    .step-row:last-child{border:none}
    .badge{padding:3px 10px;border-radius:6px;font-size:.7rem;font-weight:bold;text-transform:uppercase}
    .badge.completed{background:#22c55e22;color:#22c55e}
    .badge.failed{background:#ef444422;color:#ef4444}
    .badge.running{background:#eab30822;color:#eab308}
    .badge.pending{background:#64748b22;color:#64748b}
    .badge.planning{background:#3b82f622;color:#3b82f6}
    .files-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:.5rem}
    .file-item{background:#16161f;padding:.5rem 1rem;border-radius:6px;font-size:.85rem;color:#22c55e;display:flex;align-items:center;gap:6px}
    .log-box{background:#111118;border-radius:12px;padding:1rem;max-height:400px;overflow-y:auto;font-size:.78rem;color:#94a3b8;line-height:1.6}
    .log-box div{padding:2px 0;border-bottom:1px solid #111}
    .log-box .ts{color:#64748b}
    .footer{text-align:center;padding:2rem;color:#475569;border-top:1px solid #1a1a2e;margin-top:2rem}
    .empty{text-align:center;padding:3rem;color:#475569;font-size:1.1rem}
  </style>
</head>
<body>
  <div class="hdr">
    <div>
      <h1>🤖 Stella Autonomous Agent</h1>
      <p style="color:#94a3b8;margin-top:.3rem">Self-driving coding machine — powered by codex alex</p>
    </div>
    <div class="status">
      <div class="dot"></div>
      <span style="color:${this.state.running ? "#22c55e" : "#ef4444"};font-weight:bold">${this.state.running ? "RUNNING" : "IDLE"}</span>
    </div>
  </div>

  <div class="grid">
    <div class="card"><div class="num">${completedPlans.length}</div><div class="lbl">Plans Done</div></div>
    <div class="card"><div class="num">${activePlans.length}</div><div class="lbl">Active Plans</div></div>
    <div class="card"><div class="num">${failedPlans.length}</div><div class="lbl">Failed</div></div>
    <div class="card"><div class="num">${allFiles.length}</div><div class="lbl">Files Created</div></div>
    <div class="card"><div class="num">$${this.memory.earnings.toFixed(2)}</div><div class="lbl">Earnings</div></div>
    <div class="card"><div class="num">${this.memory.accounts.length}</div><div class="lbl">Accounts</div></div>
    <div class="card"><div class="num">${this.state.iterations}</div><div class="lbl">Iterations</div></div>
    <div class="card"><div class="num">${this.memory.videos.length}</div><div class="lbl">Videos</div></div>
  </div>

  ${activePlans.length > 0 ? `
  <div class="sec">
    <h2>⚡ Active Plans</h2>
    ${activePlans.map(p => `
      <div class="plan-card">
        <h3>${p.goal}</h3>
        <div class="meta">Started: ${new Date(p.createdAt).toLocaleString()}</div>
        ${p.steps.map(s => `
          <div class="step-row">
            <span class="badge ${s.status}">${s.status}</span>
            <span>${s.name}</span>
            <span style="margin-left:auto;color:#64748b">${(s.results||[]).filter(r=>!r.error).length}/${s.subtasks.length}</span>
          </div>
        `).join("")}
      </div>
    `).join("")}
  </div>` : ""}

  ${completedPlans.length > 0 ? `
  <div class="sec">
    <h2>✅ Completed Plans</h2>
    ${completedPlans.map(p => `
      <div class="plan-card">
        <h3>${p.goal}</h3>
        <div class="meta">Completed: ${new Date(p.createdAt).toLocaleString()}</div>
        ${p.steps.map(s => `
          <div class="step-row">
            <span class="badge completed">done</span>
            <span>${s.name}</span>
          </div>
        `).join("")}
      </div>
    `).join("")}
  </div>` : ""}

  ${failedPlans.length > 0 ? `
  <div class="sec">
    <h2>❌ Failed Plans</h2>
    ${failedPlans.map(p => `
      <div class="plan-card">
        <h3>${p.goal}</h3>
        ${p.steps.filter(s=>s.status==="failed").map(s => `
          <div class="step-row">
            <span class="badge failed">failed</span>
            <span>${s.name}</span>
          </div>
        `).join("")}
      </div>
    `).join("")}
  </div>` : ""}

  <div class="sec">
    <h2>📁 All Created Files</h2>
    ${allFiles.length > 0 ? `
      <div class="files-grid">
        ${allFiles.map(f => `<div class="file-item">📄 ${f}</div>`).join("")}
      </div>
    ` : '<div class="empty">No files created yet</div>'}
  </div>

  <div class="sec">
    <h2>📝 Activity Log (last 100 entries)</h2>
    <div class="log-box">
      ${logs.length > 0 ? logs.map(l => {
        const parts = l.match(/\[(.*?)\] (\w+): (.*)/)
        if (parts) return `<div><span class="ts">${parts[1]}</span> <span style="color:#22c55e">${parts[2]}</span> ${parts[3]}</div>`
        return `<div>${l}</div>`
      }).join("") : '<div>No activity yet</div>'}
    </div>
  </div>

  <div class="footer">
    <p>Stella Coder 5.1 — Autonomous Agent Dashboard</p>
    <p>Generated: ${new Date().toLocaleString()} · Goal: ${this.state.goal || "None"}</p>
  </div>
</body>
</html>`

    ensureDir()
    writeFileSync(DASHBOARD_FILE, html)
    return DASHBOARD_FILE
  }
}

export default AutonomousAgent
