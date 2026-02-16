#!/bin/bash
# BrowserX Claude Code Plugin Installer
# Usage: deno task mcp:install-plugin
#   or:  ./browserx-claude-plugin/install.sh

set -e

CYAN='\033[0;36m'
GREEN='\033[0;32m'
RED='\033[0;31m'
DIM='\033[2m'
NC='\033[0m'

log()     { echo -e "${CYAN}[browserx]${NC} $1"; }
success() { echo -e "${GREEN}[browserx]${NC} $1"; }
error()   { echo -e "${RED}[browserx]${NC} $1"; }

# Resolve BrowserX repo root (script is at browserx-claude-plugin/install.sh)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BROWSERX_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PLUGIN_SRC="$SCRIPT_DIR"
PLUGIN_DEST="$HOME/.claude/plugins/browserx"

echo ""
echo -e "${CYAN} ____                                     __  __"
echo -e "| __ ) _ __ _____      _____  ___ _ __  \\ \\/ /"
echo -e "|  _ \\| '__/ _ \\ \\ /\\ / / __|/ _ \\ '__|  \\  /"
echo -e "| |_) | | | (_) \\ V  V /\\__ \\  __/ |     /  \\"
echo -e "|____/|_|  \\___/ \\_/\\_/ |___/\\___|_|    /_/\\_\\${NC}"
echo -e "  ${DIM}Claude Code Plugin Installer${NC}"
echo ""

# Validate BrowserX repo
if [ ! -f "$BROWSERX_ROOT/deno.json" ] || [ ! -d "$BROWSERX_ROOT/mcp-server" ]; then
  error "Cannot find BrowserX repo at $BROWSERX_ROOT"
  error "Run this from the BrowserX repository root."
  exit 1
fi

log "BrowserX repo: $BROWSERX_ROOT"

# Create plugin directory
mkdir -p "$HOME/.claude/plugins"

# Remove existing installation
if [ -d "$PLUGIN_DEST" ]; then
  log "Removing existing plugin installation..."
  rm -rf "$PLUGIN_DEST"
fi

# Copy plugin files
log "Installing plugin to $PLUGIN_DEST..."
cp -r "$PLUGIN_SRC" "$PLUGIN_DEST"

# Generate .mcp.json with stdio transport pointing at this repo
cat > "$PLUGIN_DEST/.mcp.json" << EOF
{
  "browserx": {
    "type": "stdio",
    "command": "deno",
    "args": ["task", "mcp:start"],
    "cwd": "$BROWSERX_ROOT"
  }
}
EOF

log "MCP config generated (stdio → $BROWSERX_ROOT)"

# Clean up old standalone skill if it exists
OLD_SKILL="$HOME/.claude/skills/using-browserx"
if [ -d "$OLD_SKILL" ]; then
  rm -rf "$OLD_SKILL"
  log "Removed old standalone skill at ~/.claude/skills/using-browserx/"
fi

# Summary
echo ""
success "Plugin installed successfully!"
echo ""
echo -e "${CYAN}Available commands:${NC}"
echo "  /browse <url>      — Navigate and extract content"
echo "  /screenshot <url>  — Take a screenshot"
echo "  /query <sql>       — Run a BrowserX SQL-like query"
echo ""
echo -e "${CYAN}What's configured:${NC}"
echo "  - BrowserX MCP tools auto-load (no ToolSearch needed)"
echo "  - WebFetch/WebSearch redirected to BrowserX"
echo "  - Session start injects BrowserX context"
echo "  - Full syntax guide via 'using-browserx' skill"
echo ""
echo -e "${DIM}Restart Claude Code for changes to take effect.${NC}"
