import { bold, dim, italic, violet, blue, cyan, purple, gray, bgRgb, rgb } from "./theme.mjs"
const codeBg = bgRgb(30, 27, 55)
const codeFg = rgb(196, 181, 253)
export function renderInline(text) {
  let out = text
  out = out.replace(/\*\*([^*]+)\*\*/g, (_, s) => bold(violet(s)))
  out = out.replace(/(^|[^*])\*([^*\n]+)\*/g, (_, p, s) => p + italic(s))
  out = out.replace(/`([^`]+)`/g, (_, s) => codeBg(codeFg(` ${s} `)))
  out = out.replace(/\[([^\]]+)\][(]([^)]+)[)]/g, (_, label, url) => blue(label) + dim(` (${url})`))
  return out
}
export function renderMarkdown(md) {
  const lines = md.split("\n")
  const out = []
  let inCode = false
  let codeLang = ""
  let codeBuf = []
  for (const line of lines) {
    const fence = line.match(/^\s*```(\w*)/)
    if (fence) {
      if (!inCode) {
        inCode = true
        codeLang = fence[1] || ""
        codeBuf = []
      } else {
        inCode = false
        const width = Math.max(...codeBuf.map((l) => l.length), codeLang.length + 2, 20)
        out.push(purple("  ╭─") + dim(codeLang ? ` ${codeLang} ` : "") + purple("─".repeat(Math.max(width - codeLang.length, 2)) + "╮"))
        for (const cl of codeBuf) {
          out.push(purple("  │ ") + codeFg(cl) + " ".repeat(width - cl.length + 1) + purple("│"))
        }
        out.push(purple("  ╰" + "─".repeat(width + 3) + "╯"))
      }
      continue
    }
    if (inCode) {
      codeBuf.push(line)
      continue
    }
    const h = line.match(/^(#{1,4})\s+(.*)/)
    if (h) {
      out.push("")
      out.push(bold(violet(h[2])))
      continue
    }
    const li = line.match(/^(\s*)[-*]\s+(.*)/)
    if (li) {
      out.push(li[1] + violet("•") + " " + renderInline(li[2]))
      continue
    }
    const ol = line.match(/^(\s*)(\d+)\.\s+(.*)/)
    if (ol) {
      out.push(ol[1] + blue(ol[2] + ".") + " " + renderInline(ol[3]))
      continue
    }
    const bq = line.match(/^\s*>\s?(.*)/)
    if (bq) {
      out.push(purple("  ▎") + dim(renderInline(bq[1])))
      continue
    }
    if (/^\s*(---|\*\*\*)\s*$/.test(line)) {
      out.push(dim("  " + "─".repeat(40)))
      continue
    }
    out.push(renderInline(line))
  }
  if (inCode && codeBuf.length) {
    for (const cl of codeBuf) out.push(codeFg("  " + cl))
  }
  return out.join("\n")
}
export function createStreamRenderer(write) {
  let buf = ""
  return {
    push(delta) {
      buf += delta
      const idx = buf.lastIndexOf("\n")
      if (idx === -1) return
      const flushable = buf.slice(0, idx + 1)
      const fences = (flushable.match(/```/g) || []).length
      if (fences % 2 !== 0) return
      write(renderMarkdown(flushable.replace(/\n$/, "")) + "\n")
      buf = buf.slice(idx + 1)
    },
    flush() {
      if (buf.trim()) write(renderMarkdown(buf) + "\n")
      else if (buf) write(buf)
      buf = ""
    },
  }
}