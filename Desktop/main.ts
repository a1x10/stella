import { app, BrowserWindow, dialog, ipcMain } from "electron";
import { execFile, spawn, type ChildProcess } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { pathToFileURL } from "node:url";
import type {
  AgentOutputEvent,
  AgentStatusEvent,
  DesktopSettings,
  ProjectInfo,
  SystemMetrics,
  TaskRecord,
} from "./shared/contracts";

const execFileAsync = promisify(execFile);
const DEFAULT_SETTINGS: DesktopSettings = { model: "deepseek-v4-flash-free", recentWorkspaces: [] };
const MAX_HISTORY = 20;
const MAX_OUTPUT_LENGTH = 12000;
let mainWindow: BrowserWindow | null = null;
let activeProcess: ChildProcess | null = null;
let activeTask: TaskRecord | null = null;
let cpuSample: Array<{ idle: number; total: number }> | null = null;

function desktopDataPath(file: string) {
  return path.join(app.getPath("userData"), file);
}

function sourceRoot() {
  return app.isPackaged ? path.join(process.resourcesPath, "app.asar.unpacked") : path.resolve(__dirname, "../../..");
}

function cliPath() {
  return path.join(sourceRoot(), "stella-cli", "index.mjs");
}

async function loadJson<T>(file: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await fs.readFile(file, "utf8")) as T;
  } catch {
    return fallback;
  }
}

async function saveJson(file: string, value: unknown) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(value, null, 2), "utf8");
}

async function getSettings(): Promise<DesktopSettings> {
  const saved = await loadJson<Partial<DesktopSettings>>(desktopDataPath("settings.json"), {});
  return { ...DEFAULT_SETTINGS, ...saved, recentWorkspaces: saved.recentWorkspaces ?? [] };
}

async function saveSettings(next: Partial<DesktopSettings>) {
  const settings = { ...(await getSettings()), ...next };
  await saveJson(desktopDataPath("settings.json"), settings);
  return settings;
}

async function getTasks() {
  return loadJson<TaskRecord[]>(desktopDataPath("tasks.json"), []);
}

async function storeTask(task: TaskRecord) {
  const tasks = await getTasks();
  const withoutCurrent = tasks.filter((entry) => entry.id !== task.id);
  await saveJson(desktopDataPath("tasks.json"), [task, ...withoutCurrent].slice(0, MAX_HISTORY));
}

function redactSecrets(value: string) {
  return value
    .replace(/Bearer\s+[^\s]+/gi, "Bearer [скрыто]")
    .replace(/\b(?:sk-|zen-|opk_)[A-Za-z0-9_-]{8,}\b/g, "[скрыто]");
}

function emit(channel: "agent:output" | "agent:status" | "metrics:update", payload: AgentOutputEvent | AgentStatusEvent | SystemMetrics) {
  mainWindow?.webContents.send(channel, payload);
}

function appendOutput(channel: "stdout" | "stderr", raw: string) {
  if (!activeTask) return;
  const text = redactSecrets(raw);
  activeTask.output = (activeTask.output + text).slice(-MAX_OUTPUT_LENGTH);
  emit("agent:output", { taskId: activeTask.id, channel, text });
}

async function getProjectInfo(workspace: string): Promise<ProjectInfo> {
  const resolved = path.resolve(workspace);
  const name = path.basename(resolved) || resolved;
  try {
    await fs.access(resolved);
  } catch {
    throw new Error("Папка проекта недоступна");
  }
  try {
    const { stdout } = await execFileAsync("git", ["-C", resolved, "status", "--short", "--branch"], { windowsHide: true });
    const lines = stdout.split(/\r?\n/).filter(Boolean);
    const branchLine = lines.shift() ?? "";
    const branch = branchLine.startsWith("## ") ? branchLine.slice(3).split("...")[0] : null;
    const changedFiles = lines.map((line) => line.slice(3).trim()).filter(Boolean).slice(0, 100);
    return { path: resolved, name, branch, changedFiles, isGitRepository: true };
  } catch {
    return { path: resolved, name, branch: null, changedFiles: [], isGitRepository: false };
  }
}

function cpuTotals() {
  return os.cpus().map((cpu) => ({
    idle: cpu.times.idle,
    total: Object.values(cpu.times).reduce((sum, value) => sum + value, 0),
  }));
}

async function powerShellJson(command: string): Promise<unknown> {
  const { stdout } = await execFileAsync("powershell.exe", ["-NoProfile", "-Command", command], { windowsHide: true, timeout: 5000 });
  return JSON.parse(stdout.trim() || "null");
}

async function getMetrics(): Promise<SystemMetrics> {
  const now = cpuTotals();
  let cpuPercent: number | null = null;
  if (cpuSample?.length === now.length) {
    const idle = now.reduce((sum, entry, index) => sum + entry.idle - (cpuSample?.[index]?.idle ?? 0), 0);
    const total = now.reduce((sum, entry, index) => sum + entry.total - (cpuSample?.[index]?.total ?? 0), 0);
    cpuPercent = total > 0 ? Math.round((1 - idle / total) * 100) : null;
  }
  cpuSample = now;
  const totalMemory = os.totalmem();
  const memoryUsedGb = Number(((totalMemory - os.freemem()) / 1024 ** 3).toFixed(1));
  const memoryTotalGb = Number((totalMemory / 1024 ** 3).toFixed(1));
  let diskUsedGb: number | null = null;
  let diskTotalGb: number | null = null;
  let gpuName: string | null = null;
  let gpuPercent: number | null = null;
  let gpuTemperature: number | null = null;
  try {
    const disk = await powerShellJson("Get-CimInstance Win32_LogicalDisk -Filter \"DeviceID='C:'\" | Select-Object Size,FreeSpace | ConvertTo-Json -Compress") as { Size?: number; FreeSpace?: number };
    if (disk?.Size) {
      diskTotalGb = Number((disk.Size / 1024 ** 3).toFixed(1));
      diskUsedGb = Number(((disk.Size - (disk.FreeSpace ?? 0)) / 1024 ** 3).toFixed(1));
    }
  } catch {}
  try {
    const { stdout } = await execFileAsync("nvidia-smi", ["--query-gpu=name,utilization.gpu,temperature.gpu", "--format=csv,noheader,nounits"], { windowsHide: true, timeout: 5000 });
    const [name, usage, temperature] = stdout.trim().split(",").map((entry) => entry.trim());
    gpuName = name || null;
    gpuPercent = Number.isFinite(Number(usage)) ? Number(usage) : null;
    gpuTemperature = Number.isFinite(Number(temperature)) ? Number(temperature) : null;
  } catch {}
  return { cpuPercent, memoryUsedGb, memoryTotalGb, diskUsedGb, diskTotalGb, gpuName, gpuPercent, gpuTemperature };
}

async function securityModule() {
  const modulePath = path.join(sourceRoot(), "stella-cli", "security.mjs");
  return import(pathToFileURL(modulePath).href) as Promise<{
    getApiKey: () => { apiKey?: string } | null;
    saveApiKey: (key: string) => { ok: boolean; error?: string };
    deleteApiKey: () => { ok: boolean; error?: string };
  }>;
}

async function finishActiveTask(status: TaskRecord["status"]) {
  if (!activeTask) return;
  activeTask.status = status;
  activeTask.finishedAt = new Date().toISOString();
  activeTask.durationMs = Date.now() - Date.parse(activeTask.startedAt);
  const project = await getProjectInfo(activeTask.workspace);
  activeTask.changedFiles = project.changedFiles;
  await storeTask(activeTask);
  emit("agent:status", { task: activeTask });
  activeTask = null;
  activeProcess = null;
}

async function startTask(input: { workspace: string; prompt: string; model: string }) {
  if (activeProcess) throw new Error("Сейчас уже выполняется задача");
  const prompt = input.prompt.trim();
  if (!prompt) throw new Error("Введите задачу для Stella");
  const project = await getProjectInfo(input.workspace);
  const task: TaskRecord = {
    id: crypto.randomUUID(), prompt, workspace: project.path, model: input.model,
    status: "running", startedAt: new Date().toISOString(), output: "", changedFiles: [],
  };
  activeTask = task;
  const child = spawn(process.execPath, [cliPath(), "-p", prompt, "--model", input.model], {
    cwd: project.path,
    windowsHide: true,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", FORCE_COLOR: "0" },
  });
  activeProcess = child;
  emit("agent:status", { task });
  child.stdout?.on("data", (chunk: Buffer) => appendOutput("stdout", chunk.toString()));
  child.stderr?.on("data", (chunk: Buffer) => appendOutput("stderr", chunk.toString()));
  child.on("error", (error) => appendOutput("stderr", `\n${error.message}\n`));
  child.on("close", async (code) => {
    const status = code === 0 ? "completed" : "failed";
    await finishActiveTask(status);
  });
  return task;
}

async function stopTask(taskId: string) {
  if (!activeProcess || !activeTask || activeTask.id !== taskId) return;
  const pid = activeProcess.pid;
  if (pid && process.platform === "win32") {
    try { await execFileAsync("taskkill", ["/pid", String(pid), "/t", "/f"], { windowsHide: true }); } catch {}
  } else {
    activeProcess.kill();
  }
  await finishActiveTask("cancelled");
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200, height: 760, minWidth: 980, minHeight: 660,
    frame: false, backgroundColor: "#f8f8fc", show: false,
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  const devUrl = process.env.ELECTRON_RENDERER_URL;
  if (devUrl) void mainWindow.loadURL(devUrl); else void mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  mainWindow.once("ready-to-show", () => mainWindow?.show());
}

app.whenReady().then(() => {
  ipcMain.handle("workspace:select", async () => {
    const result = await dialog.showOpenDialog(mainWindow!, { properties: ["openDirectory", "createDirectory"] });
    if (result.canceled || !result.filePaths[0]) return null;
    const project = await getProjectInfo(result.filePaths[0]);
    const settings = await getSettings();
    await saveSettings({ recentWorkspaces: [project.path, ...settings.recentWorkspaces.filter((entry) => entry !== project.path)].slice(0, 8) });
    return project;
  });
  ipcMain.handle("project:get", (_event, workspace: string) => getProjectInfo(workspace));
  ipcMain.handle("settings:get", () => getSettings());
  ipcMain.handle("settings:model", (_event, model: string) => saveSettings({ model }));
  ipcMain.handle("key:has", async () => Boolean((await securityModule()).getApiKey()?.apiKey));
  ipcMain.handle("key:save", async (_event, key: string) => (await securityModule()).saveApiKey(key));
  ipcMain.handle("key:delete", async () => (await securityModule()).deleteApiKey());
  ipcMain.handle("metrics:get", () => getMetrics());
  ipcMain.handle("tasks:list", () => getTasks());
  ipcMain.handle("task:start", (_event, input) => startTask(input));
  ipcMain.handle("task:stop", (_event, id: string) => stopTask(id));
  ipcMain.handle("window:minimize", () => mainWindow?.minimize());
  ipcMain.handle("window:maximize", () => mainWindow?.isMaximized() ? mainWindow.unmaximize() : mainWindow?.maximize());
  ipcMain.handle("window:close", () => mainWindow?.close());
  setInterval(() => void getMetrics().then((metrics) => emit("metrics:update", metrics)), 2000);
  createWindow();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
