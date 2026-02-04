#!/bin/bash
# BrowserX MCP Server Setup Script
# Automatically adds BrowserX to Claude Code MCP settings

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MCP_SERVER_PATH="$SCRIPT_DIR/mod.ts"

echo "=== BrowserX MCP Server Setup ==="
echo ""
echo "Server path: $MCP_SERVER_PATH"
echo ""

# Check if claude CLI is available
if ! command -v claude &> /dev/null; then
    echo "Error: 'claude' CLI not found in PATH"
    echo "Please install Claude Code first: https://claude.ai/code"
    exit 1
fi

# Check if deno is available
if ! command -v deno &> /dev/null; then
    echo "Error: 'deno' not found in PATH"
    echo "Please install Deno first: https://deno.land"
    exit 1
fi

# Remove existing browserx server if it exists
echo "Removing any existing BrowserX MCP configuration..."
claude mcp remove browserx 2>/dev/null || true

# Add BrowserX MCP server (stdio transport for Claude Code)
echo "Adding BrowserX MCP server..."
claude mcp add --scope user --transport stdio browserx -- deno run --allow-all "$MCP_SERVER_PATH"

echo ""
echo "=== Setup Complete ==="
echo ""
echo "BrowserX MCP server has been added to Claude Code."
echo ""
echo "Available tools:"
echo "  - browserx_query         Execute SQL-like browser queries"
echo "  - browserx_query_explain Get execution plan without running"
echo "  - browser_navigate       Navigate to URL"
echo "  - browser_click          Click element"
echo "  - browser_type           Type text into element"
echo "  - browser_screenshot     Take screenshot"
echo "  - browser_pdf            Generate PDF"
echo "  - browser_evaluate       Run JavaScript"
echo "  - browser_query_dom      Extract DOM data"
echo "  - browser_wait           Wait for condition"
echo "  - proxy_cache_get/set    Cache operations"
echo ""
echo "To verify, run: claude mcp list"
echo "To use in Claude Code, restart your session or run: /mcp"
