const ___guard___ = process.env.STELLA_FINGERPRINT || (() => {
  try {
    const crypto = require("crypto") || await import("node:crypto")
    const fs = require("fs") || await import("node:fs")
    const p = require("path") || await import("node:path")
    const expect = "fce680ab2cc467b6e072b8b5df1996b2"
    const h = crypto.createHash("sha256").update(__filename + "stella-vault").digest("hex")
    if (h.slice(0, 8) !== expect.slice(0, 8)) {
      console.error("\u26a0\ufe0f Code integrity check failed")
    }
  } catch(e) {  }
  return true
})()
import fs from "node:fs"
import path from "node:path"
import os from "node:os"
import { execSync } from "node:child_process"
const CHARTS_DIR = path.join(os.homedir(), ".stella", "charts")
function ensureDir() {
  if (!fs.existsSync(CHARTS_DIR)) fs.mkdirSync(CHARTS_DIR, { recursive: true })
}
function openFile(filePath) {
  try {
    if (process.platform === "win32") {
      execSync(`start "" "${filePath}"`, { shell: "cmd.exe", stdio: "ignore" })
    } else if (process.platform === "darwin") {
      execSync(`open "${filePath}"`, { stdio: "ignore" })
    } else {
      execSync(`xdg-open "${filePath}"`, { stdio: "ignore" })
    }
  } catch {}
}
function generateChartHTML(config) {
  const {
    type = "bar",
    title = "Chart",
    labels = [],
    datasets = [],
    width = 800,
    height = 500,
    xAxisLabel = "",
    yAxisLabel = "",
    backgroundColor = [],
    borderColor = [],
    showLegend = true,
    showGrid = true,
    animationDuration = 1000,
    fontSize = 14,
    darkMode = false,
  } = config
  const bg = darkMode ? "#1e1e2e" : "#ffffff"
  const fg = darkMode ? "#cdd6f4" : "#333333"
  const gridColor = darkMode ? "#45475a" : "#e0e0e0"
  const chartDatasets = datasets.map((ds, i) => {
    const dsConfig = {
      label: ds.label || `Series ${i + 1}`,
      data: ds.data || [],
    }
    if (type === "line" || type === "radar") {
      dsConfig.borderColor = borderColor[i] || ds.borderColor || getColor(i)
      dsConfig.backgroundColor = backgroundColor[i] || ds.backgroundColor || getColorAlpha(i, 0.2)
      dsConfig.borderWidth = ds.borderWidth || 2
      dsConfig.pointRadius = ds.pointRadius ?? 4
      dsConfig.tension = ds.tension ?? 0.3
      dsConfig.fill = ds.fill ?? false
    } else if (type === "pie" || type === "doughnut") {
      dsConfig.backgroundColor = (ds.data || []).map((_, j) => backgroundColor[j] || getColor(j))
      dsConfig.borderColor = bg
      dsConfig.borderWidth = 2
    } else {
      dsConfig.backgroundColor = (ds.data || []).map((_, j) => backgroundColor[j] || getColorAlpha(j, 0.7))
      dsConfig.borderColor = (ds.data || []).map((_, j) => borderColor[j] || getColor(j))
      dsConfig.borderWidth = ds.borderWidth ?? 1
      dsConfig.borderRadius = ds.borderRadius ?? 4
    }
    return dsConfig
  })
  const chartConfig = {
    type: type === "horizontalBar" ? "bar" : type,
    data: {
      labels,
      datasets: chartDatasets,
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: animationDuration },
      plugins: {
        title: {
          display: !!title,
          text: title,
          color: fg,
          font: { size: fontSize + 4, weight: "bold" },
        },
        legend: {
          display: showLegend,
          labels: { color: fg, font: { size: fontSize } },
        },
      },
      scales: {},
    },
  }
  if (!["pie", "doughnut", "radar", "polarArea"].includes(type)) {
    chartConfig.options.indexAxis = type === "horizontalBar" ? "y" : "x"
    chartConfig.options.scales = {
      x: {
        display: true,
        title: { display: !!xAxisLabel, text: xAxisLabel, color: fg, font: { size: fontSize } },
        ticks: { color: fg, font: { size: fontSize - 2 } },
        grid: { display: showGrid, color: gridColor },
      },
      y: {
        display: true,
        title: { display: !!yAxisLabel, text: yAxisLabel, color: fg, font: { size: fontSize } },
        ticks: { color: fg, font: { size: fontSize - 2 } },
        grid: { display: showGrid, color: gridColor },
        beginAtZero: true,
      },
    }
  }
  if (type === "radar") {
    chartConfig.options.scales = {
      r: {
        angleLines: { color: gridColor },
        grid: { color: gridColor },
        pointLabels: { color: fg, font: { size: fontSize } },
        ticks: { color: fg, backdropColor: "transparent" },
      },
    }
  }
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<script src="https:
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: ${bg}; color: ${fg}; font-family: 'Segoe UI', system-ui, sans-serif; display: flex; flex-direction: column; align-items: center; padding: 24px; min-height: 100vh; }
  h1 { margin-bottom: 8px; font-size: 20px; }
  .meta { color: ${gridColor}; font-size: 12px; margin-bottom: 16px; }
  .chart-container { width: ${width}px; height: ${height}px; background: ${bg}; border-radius: 12px; padding: 16px; box-shadow: 0 2px 12px rgba(0,0,0,0.1); }
  canvas { max-width: 100%; }
  .export-btns { margin-top: 16px; display: flex; gap: 8px; }
  .export-btns button { padding: 8px 16px; border: 1px solid ${gridColor}; border-radius: 6px; background: ${bg}; color: ${fg}; cursor: pointer; font-size: 13px; }
  .export-btns button:hover { background: ${gridColor}; }
</style>
</head>
<body>
<h1>${title}</h1>
<div class="meta">Stella Coder Charts • ${new Date().toLocaleString()}</div>
<div class="chart-container">
  <canvas id="chart"></canvas>
</div>
<div class="export-btns">
  <button onclick="downloadPNG()">PNG</button>
  <button onclick="downloadSVG()">SVG</button>
  <button onclick="downloadCSV()">CSV</button>
</div>
<script>
const config = ${JSON.stringify(chartConfig, null, 2)};
const ctx = document.getElementById('chart').getContext('2d');
const chart = new Chart(ctx, config);
function downloadPNG() {
  const link = document.createElement('a');
  link.download = '${title.replace(/[^a-zA-Z0-9]/g, "_")}.png';
  link.href = chart.toBase64Image('image/png', 1);
  link.click();
}
function downloadSVG() {
  const canvas = document.getElementById('chart');
  const svgNS = 'http:
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('width', canvas.width);
  svg.setAttribute('height', canvas.height);
  const image = document.createElementNS(svgNS, 'image');
  image.setAttribute('href', canvas.toDataURL('image/png'));
  image.setAttribute('width', canvas.width);
  image.setAttribute('height', canvas.height);
  svg.appendChild(image);
  const blob = new Blob([svg.outerHTML], { type: 'image/svg+xml' });
  const link = document.createElement('a');
  link.download = '${title.replace(/[^a-zA-Z0-9]/g, "_")}.svg';
  link.href = URL.createObjectURL(blob);
  link.click();
}
function downloadCSV() {
  const labels = ${JSON.stringify(labels)};
  const datasets = ${JSON.stringify(datasets.map(ds => ({ label: ds.label, data: ds.data })))};
  let csv = 'Label,' + datasets.map(d => d.label).join(',') + '\\n';
  labels.forEach((l, i) => {
    csv += '"' + l + '",' + datasets.map(d => d.data[i] ?? '').join(',') + '\\n';
  });
  const blob = new Blob([csv], { type: 'text/csv' });
  const link = document.createElement('a');
  link.download = '${title.replace(/[^a-zA-Z0-9]/g, "_")}.csv';
  link.href = URL.createObjectURL(blob);
  link.click();
}
</script>
</body>
</html>`
}
function getColor(index) {
  const colors = [
    "#7c3aed", "#2563eb", "#059669", "#d97706", "#dc2626",
    "#8b5cf6", "#3b82f6", "#10b981", "#f59e0b", "#ef4444",
    "#6d28d9", "#1d4ed8", "#047857", "#b45309", "#b91c1c",
    "#a78bfa", "#60a5fa", "#34d399", "#fbbf24", "#f87171",
  ]
  return colors[index % colors.length]
}
function getColorAlpha(index, alpha) {
  const hex = getColor(index)
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}
export class ChartGenerator {
  constructor() {
    ensureDir()
  }
  async createChart(config) {
    const html = generateChartHTML(config)
    const filename = `chart_${Date.now()}.html`
    const filePath = path.join(CHARTS_DIR, filename)
    fs.writeFileSync(filePath, html)
    openFile(filePath)
    return { success: true, path: filePath, filename }
  }
  async bar(title, labels, data, options = {}) {
    return this.createChart({
      type: "bar",
      title,
      labels,
      datasets: [{ label: options.label || title, data }],
      ...options,
    })
  }
  async line(title, labels, datasets, options = {}) {
    return this.createChart({
      type: "line",
      title,
      labels,
      datasets: datasets.map((d, i) => ({
        label: d.label || `Series ${i + 1}`,
        data: d.data || d,
        borderColor: d.borderColor,
        backgroundColor: d.backgroundColor,
        fill: d.fill,
        tension: d.tension,
        ...d,
      })),
      ...options,
    })
  }
  async pie(title, labels, data, options = {}) {
    return this.createChart({
      type: "pie",
      title,
      labels,
      datasets: [{ label: title, data }],
      showLegend: true,
      showGrid: false,
      ...options,
    })
  }
  async doughnut(title, labels, data, options = {}) {
    return this.createChart({
      type: "doughnut",
      title,
      labels,
      datasets: [{ label: title, data }],
      showLegend: true,
      showGrid: false,
      ...options,
    })
  }
  async radar(title, labels, datasets, options = {}) {
    return this.createChart({
      type: "radar",
      title,
      labels,
      datasets: datasets.map((d, i) => ({
        label: d.label || `Series ${i + 1}`,
        data: d.data || d,
        ...d,
      })),
      showGrid: true,
      ...options,
    })
  }
  async scatter(title, dataPoints, options = {}) {
    const datasets = options.datasets || [{ label: title, data: dataPoints }]
    return this.createChart({
      type: "scatter",
      title,
      datasets: datasets.map((d, i) => ({
        label: d.label || `Series ${i + 1}`,
        data: d.data || d,
        backgroundColor: getColorAlpha(i, 0.6),
        borderColor: getColor(i),
        pointRadius: 5,
        ...d,
      })),
      ...options,
    })
  }
  async horizontalBar(title, labels, data, options = {}) {
    return this.createChart({
      type: "horizontalBar",
      title,
      labels,
      datasets: [{ label: options.label || title, data }],
      ...options,
    })
  }
  async polarArea(title, labels, data, options = {}) {
    return this.createChart({
      type: "polarArea",
      title,
      labels,
      datasets: [{ label: title, data }],
      showGrid: false,
      ...options,
    })
  }
  async bubble(title, dataPoints, options = {}) {
    return this.createChart({
      type: "bubble",
      title,
      datasets: [{
        label: options.label || title,
        data: dataPoints,
        backgroundColor: getColorAlpha(0, 0.6),
        borderColor: getColor(0),
      }],
      ...options,
    })
  }
  async fromCSV(csvPath, options = {}) {
    if (!fs.existsSync(csvPath)) return { success: false, error: "CSV file not found" }
    const content = fs.readFileSync(csvPath, "utf8")
    const lines = content.trim().split("\n")
    if (lines.length < 2) return { success: false, error: "CSV too short" }
    const headers = lines[0].split(",").map(h => h.trim().replace(/"/g, ""))
    const labels = []
    const datasets = headers.slice(1).map(h => ({ label: h, data: [] }))
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",").map(c => c.trim().replace(/"/g, ""))
      labels.push(cols[0] || `Row ${i}`)
      for (let j = 1; j < cols.length; j++) {
        datasets[j - 1].data.push(parseFloat(cols[j]) || 0)
      }
    }
    const chartType = options.type || (labels.length > 6 ? "line" : "bar")
    return this.createChart({
      type: chartType,
      title: options.title || path.basename(csvPath, ".csv"),
      labels,
      datasets,
      ...options,
    })
  }
  async fromJSON(jsonPath, options = {}) {
    if (!fs.existsSync(jsonPath)) return { success: false, error: "JSON file not found" }
    const data = JSON.parse(fs.readFileSync(jsonPath, "utf8"))
    return this.createChart({ ...data, ...options })
  }
  listCharts() {
    if (!fs.existsSync(CHARTS_DIR)) return []
    return fs.readdirSync(CHARTS_DIR)
      .filter(f => f.endsWith(".html"))
      .map(f => ({
        name: f,
        path: path.join(CHARTS_DIR, f),
        created: fs.statSync(path.join(CHARTS_DIR, f)).birthtime,
      }))
      .sort((a, b) => b.created - a.created)
  }
  deleteChart(filename) {
    const filePath = path.join(CHARTS_DIR, filename)
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
      return { success: true }
    }
    return { success: false, error: "Not found" }
  }
}