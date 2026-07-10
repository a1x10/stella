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
        violet("✻") + " Добро пожаловать в " + bold(violet("Stella Coder 5.0")) + "!",
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
