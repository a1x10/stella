# Stella Coder 5.0

> AI coding agent with Telegram bot, huge context, TDD, Git ecosystem, and more — all in your terminal.

## Features

- **AI Agent** — Read, create, edit files; run shell commands; search code
- **100+ commands** — `/help`, `/model`, `/plan`, `/commit`, `/exec`, `/open`, `/tv`, etc.
- **20+ AI models** — Free defaults (MiMo, DeepSeek), plus GPT, Claude, Gemini
- **Telegram Bot** — Control your computer remotely from Telegram
- **Coding Brain** — Huge context (200K tokens), auto-load SPEC/CLAUDE.md
- **TDD** — Auto-write tests, run linters, fix code
- **Git Ecosystem** — Branches, PRs, merge conflicts resolution
- **Presentations** — Create beautiful HTML presentations
- **Computer control** — Screenshot, volume, brightness, WiFi, notifications
- **Server management** — SSH, Docker, PM2, ports, firewall
- **Smart home** — Sony TV, HDMI-CEC, Yeelight, Chromecast, Wake-on-LAN
- **Office automation** — PowerPoint, Word, Excel via COM
- **Antivirus** — Built-in scanner with 100+ signatures

## Quick Install

Одна команда, без npm. Скачивается готовый бандл с GitHub.

**Windows (PowerShell):**
```powershell
irm https://raw.githubusercontent.com/a1x10/stella/master/install.ps1 | iex
```

**macOS / Linux:**
```bash
curl -fsSL https://raw.githubusercontent.com/a1x10/stella/master/install.sh | sh
```

Затем запуск командой `stella` из любого терминала.

## Usage

```bash
stella                    # Interactive REPL
stella -p "fix bug"       # One-shot command
```

## Telegram Bot

1. Start bot: `/tg`
2. Generate code: `/tg-code`
3. Share code with friends
4. Friends enter code in @stella_CLI_bot
5. They can now control your computer!

## Key Commands

| Command | Description |
|---------|-------------|
| `/help` | Show all commands |
| `/brain` | Project diagnostics |
| `/tdd <file>` | Auto-write tests |
| `/fix-all` | Lint + format + types + tests |
| `/tg` | Start Telegram bot |
| `/tg-code` | Generate access code |
| `/presentation <topic>` | Create presentation |

## Configuration

First run creates `~/.stella/config.json` with your API key and preferences.

**Free models work without API key** — just install [Ollama](https://ollama.com/download).

## License

MIT

---

**Stella Coder 5.0** · powered by codex alex
