import { useEffect, useMemo, useState } from "react";
import {
  Bell, Bot, Box, Braces, CheckSquare, ChevronLeft, ChevronRight, CircleStop,
  Cpu, FolderOpen, Gauge, GitBranch, KeyRound, LayoutDashboard, Menu,
  Minimize2, MonitorCog, Play, Plug, Settings, SlidersHorizontal, Sparkles,
  TerminalSquare, X, Zap,
} from "lucide-react";
import { MODELS, type ProjectInfo, type SystemMetrics, type TaskRecord } from "../../../shared/contracts";

type NavItem = "Главная" | "Проекты" | "Команды" | "Модели" | "Агент" | "Плагины" | "Настройки";
type Drawer = Exclude<NavItem, "Главная"> | "tasks" | "changes" | "notifications" | null;

const navigation: Array<{ name: NavItem; icon: typeof LayoutDashboard }> = [
  { name: "Главная", icon: LayoutDashboard }, { name: "Проекты", icon: FolderOpen },
  { name: "Команды", icon: TerminalSquare }, { name: "Модели", icon: Box },
  { name: "Агент", icon: Bot }, { name: "Плагины", icon: Plug }, { name: "Настройки", icon: Settings },
];

const commands = [
  ["/help", "Полный список команд Stella"], ["/plan", "План реализации задачи"],
  ["/tdd", "Тесты и исправление кода"], ["/fix-all", "Проверки, линтеры и исправления"],
  ["/git-status", "Состояние репозитория"], ["/doctor", "Диагностика окружения"],
];

function metric(value: number | null, suffix = "%") {
  return value === null ? "н/д" : `${value}${suffix}`;
}

function elapsed(task?: TaskRecord | null) {
  if (!task) return "—";
  const milliseconds = task.durationMs ?? Date.now() - Date.parse(task.startedAt);
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export default function App() {
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [keyError, setKeyError] = useState("");
  const [project, setProject] = useState<ProjectInfo | null>(null);
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [model, setModel] = useState(MODELS[0].id);
  const [prompt, setPrompt] = useState("");
  const [task, setTask] = useState<TaskRecord | null>(null);
  const [output, setOutput] = useState("");
  const [history, setHistory] = useState<TaskRecord[]>([]);
  const [drawer, setDrawer] = useState<Drawer>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void Promise.all([window.stella.hasApiKey(), window.stella.getSettings(), window.stella.getMetrics(), window.stella.getTasks()])
      .then(([key, settings, nextMetrics, tasks]) => {
        setHasKey(key); setModel(settings.model); setMetrics(nextMetrics); setHistory(tasks);
        if (settings.recentWorkspaces[0]) void window.stella.getProjectInfo(settings.recentWorkspaces[0]).then(setProject).catch(() => undefined);
      });
    const offMetrics = window.stella.onMetrics(setMetrics);
    const offOutput = window.stella.onAgentOutput((event) => {
      setOutput((previous) => (previous + event.text).slice(-12000));
    });
    const offStatus = window.stella.onAgentStatus((event) => {
      setTask(event.task);
      if (event.task.status !== "running") {
        setBusy(false);
        void window.stella.getTasks().then(setHistory);
        void window.stella.getProjectInfo(event.task.workspace).then(setProject).catch(() => undefined);
      }
    });
    return () => { offMetrics(); offOutput(); offStatus(); };
  }, []);

  const modelLabel = useMemo(() => MODELS.find((entry) => entry.id === model)?.label ?? model, [model]);
  const currentTask = task?.status === "running" ? task : null;

  async function saveKey() {
    setKeyError("");
    const result = await window.stella.saveApiKey(apiKey.trim());
    if (!result.ok) { setKeyError(result.error ?? "Не удалось сохранить ключ"); return; }
    setApiKey(""); setHasKey(true);
  }

  async function chooseProject() {
    const next = await window.stella.selectWorkspace();
    if (next) { setProject(next); setDrawer(null); }
  }

  async function runTask() {
    if (!project || !prompt.trim() || busy) return;
    setBusy(true); setOutput("");
    try { setTask(await window.stella.startTask({ workspace: project.path, prompt, model })); setPrompt(""); }
    catch (error) { setOutput(error instanceof Error ? error.message : "Не удалось запустить задачу"); setBusy(false); }
  }

  async function selectModel(id: string) {
    const settings = await window.stella.setModel(id);
    setModel(settings.model); setDrawer(null);
  }

  if (hasKey === null) return <div className="boot">Запуск Stella Coder…</div>;
  if (!hasKey) return <Onboarding apiKey={apiKey} setApiKey={setApiKey} saveKey={saveKey} error={keyError} />;

  return (
    <main className="app-shell">
      <div className="liquid liquid-one" /><div className="liquid liquid-two" /><div className="liquid liquid-three" />
      <header className="topbar">
        <div className="drag-zone" />
        <nav>
          {navigation.map(({ name, icon: Icon }) => (
            <button key={name} className={name === "Главная" && !drawer ? "nav active" : "nav"} onClick={() => setDrawer(name === "Главная" ? null : name)}>
              <Icon size={15} />{name}
            </button>
          ))}
        </nav>
        <div className="window-controls">
          <button onClick={() => void window.stella.minimizeWindow()} aria-label="Свернуть"><Minimize2 size={16} /></button>
          <button onClick={() => void window.stella.toggleMaximizeWindow()} aria-label="Развернуть"><Menu size={16} /></button>
          <button className="close" onClick={() => void window.stella.closeWindow()} aria-label="Закрыть"><X size={16} /></button>
        </div>
      </header>

      <section className="dashboard">
        <aside className="left-widgets">
          <div className="info-card project-card">
            <FolderOpen size={31} strokeWidth={1.8} />
            <div><strong>{project?.name ?? "Проект не выбран"}</strong><span>{project?.branch ? <><GitBranch size={12} /> {project.branch}</> : "Выберите рабочую папку"}</span></div>
            <button className="inline-link" onClick={() => void chooseProject()}>{project ? "Сменить" : "Открыть"}</button>
          </div>
          <div className="info-card model-card">
            <Sparkles size={25} /><div><span>Модель / режим</span><strong>{modelLabel}</strong><em><Zap size={12} /> Полная автономность</em></div>
            <button className="inline-link" onClick={() => setDrawer("Модели")}>Выбрать</button>
          </div>
        </aside>

        <section className="hero">
          <p className="eyebrow">ЛОКАЛЬНЫЙ AI-АГЕНТ ДЛЯ РАЗРАБОТКИ</p>
          <h1>Stella <span>Coder</span><i>✦</i></h1>
          <p className="subtitle">Ваш автономный ассистент для программирования</p>
          <div className="hero-actions">
            <button className="soft-button" onClick={() => void chooseProject()}><FolderOpen size={17} /> Проект</button>
            <button className="primary-button" onClick={() => document.querySelector<HTMLTextAreaElement>(".task-input")?.focus()} disabled={!project}><Bot size={17} /> Новая задача</button>
          </div>
        </section>

        <aside className="metrics-card">
          <MetricRow label="CPU" value={metric(metrics?.cpuPercent ?? null)} percent={metrics?.cpuPercent ?? null} />
          <MetricRow label="RAM" value={`${metrics?.memoryUsedGb ?? "—"} / ${metrics?.memoryTotalGb ?? "—"} GB`} percent={metrics ? Math.round(metrics.memoryUsedGb / metrics.memoryTotalGb * 100) : null} />
          <MetricRow label="DISK" value={metrics?.diskTotalGb ? `${metrics.diskUsedGb} / ${metrics.diskTotalGb} GB` : "н/д"} percent={metrics?.diskTotalGb ? Math.round((metrics.diskUsedGb ?? 0) / metrics.diskTotalGb * 100) : null} />
          <MetricRow label={metrics?.gpuName ? "GPU" : "GPU / TEMP"} value={metrics?.gpuName ? `${metric(metrics.gpuPercent)} · ${metric(metrics.gpuTemperature, "°C")}` : "недоступно"} percent={metrics?.gpuPercent ?? null} />
        </aside>

        <section className="task-card">
          <div className="task-heading"><div className={currentTask ? "status-dot running" : "status-dot"} /><div><strong>{currentTask ? "Stella работает" : "Готова к задаче"}</strong><span>{currentTask ? `${elapsed(currentTask)} · ${modelLabel}` : project ? project.path : "Откройте папку проекта"}</span></div>{currentTask && <button className="stop" onClick={() => void window.stella.stopTask(currentTask.id)}><CircleStop size={18} /> Остановить</button>}</div>
          <textarea className="task-input" value={prompt} disabled={!project || Boolean(currentTask)} onChange={(event) => setPrompt(event.target.value)} onKeyDown={(event) => { if ((event.ctrlKey || event.metaKey) && event.key === "Enter") void runTask(); }} placeholder={project ? "Например: исправь ошибку, добавь тесты и проверь проект…" : "Сначала откройте папку проекта"} />
          <div className="task-footer"><span><Braces size={14} /> {project ? `${project.changedFiles.length} изменений Git` : "Проект не выбран"}</span><button className="run" onClick={() => void runTask()} disabled={!project || !prompt.trim() || Boolean(currentTask)}><Play size={15} fill="currentColor" /> Запустить</button></div>
          {(output || currentTask) && <pre className="output">{output || "Подключаю Stella CLI…"}</pre>}
        </section>
      </section>

      <footer className="footerbar">
        <div><span className="brand">STELLA</span><span className="badge">DESKTOP</span></div>
        <div className="footer-actions">
          <button onClick={() => setDrawer("tasks")}><CheckSquare size={18} /><b>{history.length}</b></button>
          <button onClick={() => setDrawer("changes")}><GitBranch size={18} /></button>
          <button onClick={() => setDrawer("notifications")}><Bell size={18} /></button>
        </div>
        <div className="service-status"><span>ZEN API</span><span>AGENT</span><span>{model.includes("free") ? "FREE" : "CLOUD"}</span></div>
      </footer>
      {drawer && <Drawer drawer={drawer} close={() => setDrawer(null)} project={project} history={history} model={model} selectModel={selectModel} chooseProject={chooseProject} deleteKey={async () => { await window.stella.deleteApiKey(); setHasKey(false); }} setPrompt={setPrompt} />}
    </main>
  );
}

function MetricRow({ label, value, percent }: { label: string; value: string; percent: number | null }) {
  return <div className="metric"><div><span>{label}</span><b>{value}</b></div><div className="bar"><i style={{ width: `${Math.max(0, Math.min(percent ?? 0, 100))}%` }} /></div></div>;
}

function Onboarding({ apiKey, setApiKey, saveKey, error }: { apiKey: string; setApiKey: (value: string) => void; saveKey: () => void; error: string }) {
  return <main className="onboarding"><div className="liquid liquid-one" /><div className="liquid liquid-two" /><section><div className="logo"><Sparkles size={28} /></div><p className="eyebrow">STELLA CODER DESKTOP</p><h1>Подключите <span>AI</span></h1><p>Введите ключ OpenCode/Zen. Он сохранится локально и не попадёт в историю задач.</p><label>API-ключ<input type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} onKeyDown={(event) => event.key === "Enter" && saveKey()} placeholder="Введите API-ключ" autoFocus /></label>{error && <small className="error">{error}</small>}<button className="primary-button wide" onClick={saveKey} disabled={apiKey.trim().length < 10}><KeyRound size={17} /> Сохранить и продолжить</button><small>Первый выпуск поддерживает OpenCode/Zen-compatible API.</small></section></main>;
}

function Drawer({ drawer, close, project, history, model, selectModel, chooseProject, deleteKey, setPrompt }: { drawer: Drawer; close: () => void; project: ProjectInfo | null; history: TaskRecord[]; model: string; selectModel: (id: string) => void; chooseProject: () => void; deleteKey: () => void; setPrompt: (value: string) => void; }) {
  const title = drawer === "tasks" ? "Очередь и история" : drawer === "changes" ? "Изменения проекта" : drawer === "notifications" ? "Уведомления" : drawer;
  return <aside className="drawer"><header><h2>{title}</h2><button onClick={close}><X size={18} /></button></header>
    {drawer === "Проекты" && <><button className="primary-button wide" onClick={() => void chooseProject()}><FolderOpen size={17} /> Открыть папку</button><p className="muted">Активный проект</p><div className="drawer-card"><strong>{project?.name ?? "Не выбран"}</strong><span>{project?.path ?? "Выберите папку, в которой Stella сможет работать."}</span></div></>}
    {drawer === "Команды" && <div className="list">{commands.map(([command, description]) => <button key={command} className="command" onClick={() => { setPrompt(command); close(); }}><code>{command}</code><span>{description}</span><ChevronRight size={16} /></button>)}</div>}
    {drawer === "Модели" && <div className="list">{MODELS.map((entry) => <button key={entry.id} className={entry.id === model ? "model selected" : "model"} onClick={() => void selectModel(entry.id)}><Sparkles size={16} /><span>{entry.label}</span>{entry.id === model && <CheckSquare size={16} />}</button>)}</div>}
    {drawer === "Агент" && <div className="drawer-card"><Bot size={24} /><strong>Автономный режим включён</strong><span>Stella запускает неизменённый CLI в выбранной папке проекта.</span></div>}
    {drawer === "Плагины" && <div className="list"><div className="drawer-card"><Plug size={23} /><strong>MCP и CLI-плагины</strong><span>Используйте установленные инструменты Stella в задачах агента.</span></div><div className="drawer-card"><MonitorCog size={23} /><strong>Windows tools</strong><span>Системные и проектные инструменты доступны через текущий CLI.</span></div></div>}
    {drawer === "Настройки" && <div className="list"><div className="drawer-card"><SlidersHorizontal size={23} /><strong>Полная автономность</strong><span>После запуска задачи CLI имеет доступ к выбранной папке.</span></div><button className="danger" onClick={() => void deleteKey()}><KeyRound size={17} /> Удалить API-ключ</button></div>}
    {drawer === "tasks" && <div className="list">{history.length ? history.map((entry) => <div className="history" key={entry.id}><b className={entry.status}>{entry.status}</b><strong>{entry.prompt}</strong><span>{entry.workspace} · {entry.changedFiles.length} файлов</span></div>) : <p className="muted">Задач пока нет.</p>}</div>}
    {drawer === "changes" && <div className="list">{project?.isGitRepository ? project.changedFiles.length ? project.changedFiles.map((file) => <div className="file" key={file}><GitBranch size={15} /> {file}</div>) : <p className="muted">В Git нет незакоммиченных изменений.</p> : <p className="muted">Выберите Git-проект, чтобы увидеть изменения.</p>}</div>}
    {drawer === "notifications" && <div className="drawer-card"><Bell size={24} /><strong>Всё спокойно</strong><span>О завершении и ошибках задач Stella сообщает здесь.</span></div>}
  </aside>;
}
