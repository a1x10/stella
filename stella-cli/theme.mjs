// Stella Coder 3.9 — purple/blue ANSI theme
const ESC = "\x1b["

export const reset = `${ESC}0m`
export const bold = (s) => `${ESC}1m${s}${reset}`
export const dim = (s) => `${ESC}2m${s}${reset}`
export const italic = (s) => `${ESC}3m${s}${reset}`
export const underline = (s) => `${ESC}4m${s}${reset}`
export const inverse = (s) => `${ESC}7m${s}${reset}`
export const strikethrough = (s) => `${ESC}9m${s}${reset}`

export const rgb = (r, g, b) => (s) => `${ESC}38;2;${r};${g};${b}m${s}${reset}`
export const bgRgb = (r, g, b) => (s) => `${ESC}48;2;${r};${g};${b}m${s}${reset}`

// Palette: violet -> blue
export const violet = rgb(167, 139, 250) // #a78bfa
export const purple = rgb(139, 92, 246) // #8b5cf6
export const indigo = rgb(129, 140, 248) // #818cf8
export const blue = rgb(96, 165, 250) // #60a5fa
export const cyan = rgb(103, 232, 249) // #67e8f9
export const green = rgb(74, 222, 128)
export const red = rgb(248, 113, 113)
export const yellow = rgb(250, 204, 21)
export const gray = rgb(148, 163, 184)
export const darkGray = rgb(100, 116, 139)
export const white = rgb(237, 233, 254)

// Gradient stops from violet to blue
const STOPS = [
  [167, 139, 250],
  [139, 92, 246],
  [129, 140, 248],
  [99, 102, 241],
  [96, 165, 250],
]

function lerp(a, b, t) {
  return Math.round(a + (b - a) * t)
}

export function gradientLine(text) {
  const chars = [...text]
  const n = Math.max(chars.length - 1, 1)
  let out = ""
  for (let i = 0; i < chars.length; i++) {
    const t = (i / n) * (STOPS.length - 1)
    const idx = Math.min(Math.floor(t), STOPS.length - 2)
    const f = t - idx
    const [r1, g1, b1] = STOPS[idx]
    const [r2, g2, b2] = STOPS[idx + 1]
    out += `${ESC}38;2;${lerp(r1, r2, f)};${lerp(g1, g2, f)};${lerp(b1, b2, f)}m${chars[i]}`
  }
  return out + reset
}

export function gradient(text) {
  return text
    .split("\n")
    .map((l) => gradientLine(l))
    .join("\n")
}

// Rounded box drawing
export function box(lines, { color = purple, padding = 1, title = "" } = {}) {
  const strip = (s) => s.replace(/\x1b\[[0-9;]*m/g, "")
  const width = Math.max(...lines.map((l) => strip(l).length), strip(title).length + 2)
  const pad = " ".repeat(padding)
  const inner = width + padding * 2
  // Handle color as array [r,g,b] or function
  const colorFn = Array.isArray(color) ? rgb(color[0], color[1], color[2]) : color
  const top = title
    ? colorFn("╭─ ") + bold(violet(title)) + colorFn(" " + "─".repeat(Math.max(inner - strip(title).length - 3, 0)) + "╮")
    : colorFn("╭" + "─".repeat(inner) + "╮")
  const body = lines.map((l) => colorFn("│") + pad + l + " ".repeat(width - strip(l).length) + pad + colorFn("│"))
  const bottom = colorFn("╰" + "─".repeat(inner) + "╯")
  return [top, ...body, bottom].join("\n")
}

export const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]
export const SPINNER_WORDS = [
  "Thinking",
  "Pondering",
  "Vibing",
  "Computing",
  "Reasoning",
  "Conjuring",
  "Synthesizing",
  "Brewing",
  "Crafting",
  "Weaving",
]
