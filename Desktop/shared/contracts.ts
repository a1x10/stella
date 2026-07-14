export type TaskStatus = "running" | "completed" | "failed" | "cancelled";

export interface ModelOption {
  id: string;
  label: string;
}

export const MODELS: ModelOption[] = [
  { id: "deepseek-v4-flash-free", label: "DeepSeek V4 Flash (бесплатная)" },
  { id: "deepseek-v4-flash-free", label: "DeepSeek V4 Flash — бесплатно" },
  { id: "gpt-5.4", label: "GPT-5.4" },
  { id: "gpt-5.4-mini", label: "GPT-5.4 Mini" },
  { id: "gpt-5.2-codex", label: "GPT-5.2 Codex" },
  { id: "gpt-5-codex", label: "GPT-5 Codex" },
  { id: "claude-sonnet-4.5", label: "Claude Sonnet 4.5" },
  { id: "claude-opus-4.5", label: "Claude Opus 4.5" },
  { id: "gemini-3-flash", label: "Gemini 3 Flash" },
  { id: "deepseek-v4-pro", label: "DeepSeek V4 Pro" },
  { id: "glm-5.2", label: "GLM 5.2" },
  { id: "kimi-k2.6", label: "Kimi K2.6" },
];

export interface DesktopSettings {
  model: string;
  recentWorkspaces: string[];
}

export interface ProjectInfo {
  path: string;
  name: string;
  branch: string | null;
  changedFiles: string[];
  isGitRepository: boolean;
}

export interface SystemMetrics {
  cpuPercent: number | null;
  memoryUsedGb: number;
  memoryTotalGb: number;
  diskUsedGb: number | null;
  diskTotalGb: number | null;
  gpuName: string | null;
  gpuPercent: number | null;
  gpuTemperature: number | null;
}

export interface TaskRecord {
  id: string;
  prompt: string;
  workspace: string;
  model: string;
  status: TaskStatus;
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  output: string;
  changedFiles: string[];
}

export interface AgentOutputEvent {
  taskId: string;
  channel: "stdout" | "stderr";
  text: string;
}

export interface AgentStatusEvent {
  task: TaskRecord;
}

export interface StellaDesktopApi {
  selectWorkspace(): Promise<ProjectInfo | null>;
  getProjectInfo(workspace: string): Promise<ProjectInfo>;
  getSettings(): Promise<DesktopSettings>;
  setModel(model: string): Promise<DesktopSettings>;
  hasApiKey(): Promise<boolean>;
  saveApiKey(key: string): Promise<{ ok: boolean; error?: string }>;
  deleteApiKey(): Promise<{ ok: boolean; error?: string }>;
  getMetrics(): Promise<SystemMetrics>;
  getTasks(): Promise<TaskRecord[]>;
  startTask(input: { workspace: string; prompt: string; model: string }): Promise<TaskRecord>;
  stopTask(taskId: string): Promise<void>;
  onMetrics(listener: (metrics: SystemMetrics) => void): () => void;
  onAgentOutput(listener: (event: AgentOutputEvent) => void): () => void;
  onAgentStatus(listener: (event: AgentStatusEvent) => void): () => void;
  minimizeWindow(): Promise<void>;
  toggleMaximizeWindow(): Promise<void>;
  closeWindow(): Promise<void>;
}
