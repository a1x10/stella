# Stella

AI coding assistant in your terminal. One command to install — no setup, no API key needed.

## Install

**Windows** (PowerShell):

```powershell
irm https://raw.githubusercontent.com/a1x10/stella/main/install.ps1 | iex
```

**Linux / WSL** (bash):

```bash
curl -fsSL https://raw.githubusercontent.com/a1x10/stella/main/install.sh | bash
```

Then open a **new terminal** and run:

```
stella
```

That's it. Stella comes pre-configured with the `deepseek/deepseek-v4-pro` model.

## Update

Re-run the install command above to get the latest version.

## Uninstall

- **Windows:** delete `%USERPROFILE%\.stella` and remove it from your PATH.
- **Linux:** delete `~/.stella` and remove the `# stella` line from your shell rc file.
