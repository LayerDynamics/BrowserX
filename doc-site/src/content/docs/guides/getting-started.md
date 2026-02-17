---
title: Getting Started
description: Install BrowserX, run your first query, and connect an AI agent in under 10 minutes.
---

## Prerequisites

- [Deno 2.x](https://deno.land) — BrowserX is built on Deno
- [Rust + Cargo](https://rustup.rs) — Required for native GPU windowing (pixpane)
- Git

## Clone the Repository

```bash
git clone https://github.com/LayerDynamics/BrowserX
cd BrowserX
```

## Run Your First Query

The Query Engine provides a SQL-like interface for interacting with web pages.

```bash
deno task query:example
```

This runs the example query against `https://example.com` and prints the extracted title and description.

### Write a Custom Query

Create a file `my-query.ts`:

```typescript
import { QueryEngine } from "./query-engine/mod.ts";

const engine = new QueryEngine();

const result = await engine.execute(
  `SELECT title, description FROM "https://example.com"`
);

console.log(result);
```

Run it:

```bash
deno run --allow-net --allow-read my-query.ts
```

## Start the MCP Server

BrowserX includes a [Model Context Protocol](https://modelcontextprotocol.io) server for AI agent integration.

### Stdio transport (default — for Claude Code, etc.)

```bash
deno task mcp:start
```

### HTTP transport (for remote agents)

```bash
deno task mcp:start:http
# Server running at http://localhost:9847
```

### Register with Claude Code

Add BrowserX as a local MCP server in your Claude Code settings (`~/.claude/settings.json`):

```json
{
  "mcpServers": {
    "browserx": {
      "command": "deno",
      "args": ["task", "mcp:start"],
      "cwd": "/path/to/BrowserX"
    }
  }
}
```

## Try the Playground

Navigate to [/playground](/playground) for an interactive query editor with live results against any public URL.

## Next Steps

- [Query Engine Syntax](/query/syntax/) — Full query language reference
- [MCP Tools Reference](/mcp/tools/) — All available AI agent tools
- [Browser Engine Overview](/browser/) — Architecture deep-dive
- [Proxy Engine Overview](/proxy/) — Traffic routing and caching
