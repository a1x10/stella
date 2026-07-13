import { contextBridge, ipcRenderer } from "electron";
import type { StellaDesktopApi } from "./shared/contracts";

const api: StellaDesktopApi = {
  selectWorkspace: () => ipcRenderer.invoke("workspace:select"),
  getProjectInfo: (workspace) => ipcRenderer.invoke("project:get", workspace),
  getSettings: () => ipcRenderer.invoke("settings:get"),
  setModel: (model) => ipcRenderer.invoke("settings:model", model),
  hasApiKey: () => ipcRenderer.invoke("key:has"),
  saveApiKey: (key) => ipcRenderer.invoke("key:save", key),
  deleteApiKey: () => ipcRenderer.invoke("key:delete"),
  getMetrics: () => ipcRenderer.invoke("metrics:get"),
  getTasks: () => ipcRenderer.invoke("tasks:list"),
  startTask: (input) => ipcRenderer.invoke("task:start", input),
  stopTask: (taskId) => ipcRenderer.invoke("task:stop", taskId),
  onMetrics: (listener) => {
    const wrapped = (_event: Electron.IpcRendererEvent, payload: Parameters<typeof listener>[0]) => listener(payload);
    ipcRenderer.on("metrics:update", wrapped);
    return () => ipcRenderer.removeListener("metrics:update", wrapped);
  },
  onAgentOutput: (listener) => {
    const wrapped = (_event: Electron.IpcRendererEvent, payload: Parameters<typeof listener>[0]) => listener(payload);
    ipcRenderer.on("agent:output", wrapped);
    return () => ipcRenderer.removeListener("agent:output", wrapped);
  },
  onAgentStatus: (listener) => {
    const wrapped = (_event: Electron.IpcRendererEvent, payload: Parameters<typeof listener>[0]) => listener(payload);
    ipcRenderer.on("agent:status", wrapped);
    return () => ipcRenderer.removeListener("agent:status", wrapped);
  },
  minimizeWindow: () => ipcRenderer.invoke("window:minimize"),
  toggleMaximizeWindow: () => ipcRenderer.invoke("window:maximize"),
  closeWindow: () => ipcRenderer.invoke("window:close"),
};

contextBridge.exposeInMainWorld("stella", api);
