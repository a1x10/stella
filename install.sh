#!/bin/sh
# Stella Coder — установка в ОДНУ команду для macOS и Linux
# ------------------------------------------------------------
#   curl -fsSL https://raw.githubusercontent.com/a1x10/stella/master/install.sh | sh
#
# Скачивается готовый бандл напрямую с GitHub (никакого npm install и
# прав root не нужно). После установки команда `stella` работает из любого
# терминала. Аналог install.ps1 для Windows.
# ------------------------------------------------------------
set -eu

NODE_VER="v22.14.0"
BASE="$HOME/.stella-coder"
BIN_DIR="$BASE/bin"
BUNDLE_URL="https://raw.githubusercontent.com/a1x10/stella/master/dist/stella.mjs"

C_MAGENTA="$(printf '\033[35m')"
C_GREEN="$(printf '\033[32m')"
C_YELLOW="$(printf '\033[33m')"
C_CYAN="$(printf '\033[36m')"
C_DIM="$(printf '\033[2m')"
C_OFF="$(printf '\033[0m')"

say() { printf '%s\n' "$1"; }

say ""
say "  ${C_MAGENTA}==============================${C_OFF}"
say "  ${C_MAGENTA} Stella Coder — установка${C_OFF}"
say "  ${C_MAGENTA}==============================${C_OFF}"
say ""

mkdir -p "$BIN_DIR"

# [1] Node.js — системный, иначе портативный в профиль
if command -v node >/dev/null 2>&1; then
  NODE_EXE="$(command -v node)"
  say "  ${C_GREEN}[1/3] Node.js найден: $(node -v)${C_OFF}"
else
  say "  ${C_YELLOW}[1/3] Node.js не найден — скачиваю портативную версию...${C_OFF}"

  os="$(uname -s)"
  case "$os" in
    Darwin) node_os="darwin" ;;
    Linux)  node_os="linux" ;;
    *) say "  Неизвестная ОС: $os. Установите Node.js вручную: https://nodejs.org"; exit 1 ;;
  esac

  arch="$(uname -m)"
  case "$arch" in
    arm64|aarch64) node_arch="arm64" ;;
    x86_64|amd64)  node_arch="x64" ;;
    *) say "  Неизвестная архитектура: $arch. Установите Node.js вручную: https://nodejs.org"; exit 1 ;;
  esac

  node_dir_name="node-$NODE_VER-$node_os-$node_arch"
  node_path="$BASE/node/$node_dir_name"

  if [ ! -x "$node_path/bin/node" ]; then
    tarball="$node_dir_name.tar.gz"
    url="https://nodejs.org/dist/$NODE_VER/$tarball"
    tmp="$(mktemp -d)"
    say "  ${C_DIM}       $url${C_OFF}"
    curl -fsSL "$url" -o "$tmp/$tarball"
    mkdir -p "$BASE/node"
    tar -xzf "$tmp/$tarball" -C "$BASE/node"
    rm -rf "$tmp"
    [ -x "$node_path/bin/node" ] || { say "  Не удалось распаковать Node.js"; exit 1; }
  fi

  NODE_EXE="$node_path/bin/node"
  say "  ${C_GREEN}[OK] Node.js установлен ($NODE_VER)${C_OFF}"
fi

# [2] Скачиваем бандл Stella напрямую с GitHub
say "  ${C_YELLOW}[2/3] Скачиваю Stella Coder...${C_OFF}"
curl -fsSL "$BUNDLE_URL" -o "$BASE/stella.mjs"
[ -s "$BASE/stella.mjs" ] || { say "  Не удалось скачать stella.mjs"; exit 1; }
say "  ${C_GREEN}[OK] Stella Coder загружена${C_OFF}"

# [3] Создаём команду `stella`
say "  ${C_YELLOW}[3/3] Привязываю команду stella...${C_OFF}"

cat > "$BIN_DIR/stella" <<EOF
#!/bin/sh
exec "$NODE_EXE" "$BASE/stella.mjs" "\$@"
EOF
chmod +x "$BIN_DIR/stella"

# Прописываем bin в PATH через профиль активной оболочки
add_path_line='export PATH="$HOME/.stella-coder/bin:$PATH"'
for profile in "$HOME/.zshrc" "$HOME/.bashrc" "$HOME/.profile"; do
  [ -f "$profile" ] || continue
  if ! grep -qF "$add_path_line" "$profile" 2>/dev/null; then
    printf '\n# Stella Coder\n%s\n' "$add_path_line" >> "$profile"
  fi
done
# на случай, если ни одного профиля не было (первый запуск zsh на macOS)
if [ ! -f "$HOME/.zshrc" ] && [ ! -f "$HOME/.bashrc" ] && [ ! -f "$HOME/.profile" ]; then
  printf '# Stella Coder\n%s\n' "$add_path_line" > "$HOME/.profile"
fi

export PATH="$BIN_DIR:$PATH"
say "  ${C_GREEN}[OK] stella доступна во всех терминалах${C_OFF}"

say ""
say "  ${C_GREEN}Готово! ✓${C_OFF}"
say ""
printf '  Запуск:  %sstella%s\n' "$C_CYAN" "$C_OFF"
say "  ${C_DIM}(в уже открытых окнах — перезапустите терминал или: source ~/.zshrc)${C_OFF}"
say ""

# Запускаем сразу, если терминал интерактивный
if [ -t 0 ]; then
  "$BIN_DIR/stella" || say "  ${C_YELLOW}Откройте новый терминал и введите: stella${C_OFF}"
fi
