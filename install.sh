#!/usr/bin/env bash
# Stella installer (Linux)
# Usage:  curl -fsSL https://raw.githubusercontent.com/a1x10/stella/main/install.sh | bash
set -euo pipefail

REPO="a1x10/stella"
INSTALL_DIR="$HOME/.stella/bin"

arch=$(uname -m)
case "$arch" in
  x86_64|amd64) asset="stella-linux-x64.tar.gz" ;;
  aarch64|arm64) asset="stella-linux-arm64.tar.gz" ;;
  *) echo "Unsupported architecture: $arch" >&2; exit 1 ;;
esac

url="https://github.com/$REPO/releases/latest/download/$asset"

echo ""
echo "Installing Stella..."
mkdir -p "$INSTALL_DIR"
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

echo "Downloading $url"
curl -fsSL -o "$tmp/$asset" "$url"
tar -xzf "$tmp/$asset" -C "$tmp"

# Find the extracted binary (named stella or opencode) and install as "stella"
bin=$(find "$tmp" -maxdepth 2 -type f \( -name stella -o -name opencode \) | head -n1)
if [ -z "$bin" ]; then
  echo "Could not find the stella binary in the archive" >&2
  exit 1
fi
install -m 755 "$bin" "$INSTALL_DIR/stella"

# Add to PATH in the user's shell rc if missing
add_path_line="export PATH=\"$INSTALL_DIR:\$PATH\""
for rc in "$HOME/.bashrc" "$HOME/.zshrc" "$HOME/.profile"; do
  if [ -f "$rc" ] && ! grep -qF "$INSTALL_DIR" "$rc"; then
    printf '\n# stella\n%s\n' "$add_path_line" >> "$rc"
  fi
done

echo ""
echo "Stella installed to $INSTALL_DIR/stella"
case ":$PATH:" in
  *":$INSTALL_DIR:"*) echo "Run:  stella" ;;
  *) echo "Open a NEW terminal (or run: $add_path_line) then run:  stella" ;;
esac
echo ""
