---
title: Quick Start
description: Get up and running with BrowserX in minutes.
---

This guide walks you through installing BrowserX, starting the MCP server, and running your first query.

## Requirements

- [Deno](https://deno.land/) 1.40 or later
- Git

## Installation

Clone the repository and enter the project directory:

```bash
git clone https://github.com/LayerDynamics/BrowserX.git
cd BrowserX
```

BrowserX uses a Deno workspace — no separate install step is required. Deno resolves all dependencies from `deno.json` on first use.

## Starting the MCP Server

The MCP server exposes browser tools over the Model Context Protocol for AI agent integration.

**stdio transport (default):**

```bash
deno task mcp:start
```

**HTTP transport (port 9847):**

```bash
deno task mcp:start:http
```

Once running, the server accepts MCP tool calls such as `browser_navigate`, `browser_screenshot`, and `browserx_query`. See the [MCP Server docs](/mcp/) for the full tool reference.

## Running a Query Engine Example

The query engine provides a SQL-like interface for browser automation. Run the bundled example to see it in action:

```bash
deno task query:example
```

This executes a sample query against a live URL and prints structured output to the terminal.

You can also run queries programmatically:

```typescript
import { QueryEngine } from "@browserx/query-engine";

const engine = new QueryEngine();
const result = await engine.execute(
  `SELECT title, description FROM "https://example.com"`
);
console.log(result);
```

## Type Checking and Tests

Verify your setup is working:

```bash
# Type-check all workspaces
deno task check

# Run all tests
deno task test
```

## Next Steps

- [Browser Engine](/browser/) — Understand the full page load pipeline
- [Query Engine](/query/) — Learn the complete query syntax
- [Proxy Engine](/proxy/) — Configure middleware, caching, and connection pooling
- [Runtime](/runtime/) — Compose engines into coordinated workflows
- [MCP Server](/mcp/) — Integrate with AI agents via the Model Context Protocol
