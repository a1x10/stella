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
import { gradient, dim, violet, blue, gray, box, bold, purple } from "./theme.mjs"
const LOGO = String.raw`
 ███████╗████████╗███████╗██╗     ██╗      █████╗
 ██╔════╝╚══██╔══╝██╔════╝██║     ██║     ██╔══██╗
 ███████╗   ██║   █████╗  ██║     ██║     ███████║
 ╚════██║   ██║   ██╔══╝  ██║     ██║     ██╔══██║
 ███████║   ██║   ███████╗███████╗███████╗██║  ██║
 ╚══════╝   ╚═╝   ╚══════╝╚══════╝╚══════╝╚═╝  ╚═╝
      ██████╗ ██████╗ ██████╗ ███████╗██████╗
     ██╔════╝██╔═══██╗██╔══██╗██╔════╝██╔══██╗
     ██║     ██║   ██║██║  ██║█████╗  ██████╔╝
     ██║     ██║   ██║██║  ██║██╔══╝  ██╔══██╗
     ╚██████╗╚██████╔╝██████╔╝███████╗██║  ██║
      ╚═════╝ ╚═════╝ ╚═════╝ ╚══════╝╚═╝  ╚═╝`
export function printBanner({ model, cwd, version }) {
  console.log(gradient(LOGO))
  console.log()
  console.log(
    "   " +
      gradient("✦ Stella Coder") +
      " " +
      bold(violet(`v${version}`)) +
      dim("  ·  powered by ") +
      bold(blue("codex")) +
      dim(" alex"),
  )
  console.log()
  console.log(
    box(
      [
        violet("✻") + " Добро пожаловать в " + bold(violet("Stella Coder 5.1")) + "!",
        "",
        dim("  модель:  ") + blue(model),
        dim("  папка:   ") + gray(cwd),
        "",
        dim("  ") + purple("/help") + dim(" — все команды   ") + purple("/model") + dim(" — сменить модель"),
        dim("  ") + purple("!cmd") + dim("  — запустить shell-команду напрямую"),
        dim("  ") + purple("Ctrl+C") + dim(" — прервать ответ, дважды — выход"),
      ],
      { title: "✦ System", padding: 2 },
    ),
  )
  console.log()
}