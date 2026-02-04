/**
 * BrowserX MCP Server
 * Main entry point for the Model Context Protocol server
 *
 * This server exposes BrowserX capabilities to LLMs like Claude,
 * enabling AI-driven browser automation, web scraping, and proxy control.
 *
 * Usage:
 *   deno run --allow-all mod.ts           # stdio transport (default)
 *   deno run --allow-all mod.ts --http    # HTTP transport
 *
 * Environment variables:
 *   MCP_TRANSPORT=stdio|http        Transport mode
 *   MCP_PORT=3000                   HTTP port (if http transport)
 *   MCP_PERMISSIONS=AUTOMATION      READONLY | AUTOMATION | FULL
 *   MCP_MAX_SESSIONS=10             Max concurrent browser sessions
 */

import { createMCPServer, shutdownMCPServer } from "./server/mcp-server.ts";
import { startStdioServer } from "./server/transports/stdio.ts";
import { startHttpServer } from "./server/transports/http.ts";
import { registerQueryTools } from "./tools/query-tools.ts";
import { registerBrowserTools } from "./tools/browser-tools.ts";
import { registerProxyTools } from "./tools/proxy-tools.ts";
import { registerPageResources } from "./resources/page-resources.ts";
import { registerMetricsResources } from "./resources/metrics-resources.ts";
import { registerPrompts } from "./prompts/automation-prompts.ts";
import type { PermissionSet } from "./security/permission-guard.ts";

/**
 * Safely parse an integer with validation
 */
function parseIntSafe(value: string, defaultValue: number, min: number, max: number): number {
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < min || parsed > max) {
    return defaultValue;
  }
  return parsed;
}

/**
 * Parse and validate port number
 */
function parsePort(value: string | undefined, defaultPort: number): number {
  if (!value) {
    return defaultPort;
  }
  const port = parseIntSafe(value, defaultPort, 1, 65535);
  return port;
}

/**
 * Parse command line arguments and environment variables
 */
function parseConfig(): {
  transport: "stdio" | "http";
  port: number;
  permissions: PermissionSet;
  maxSessions: number;
} {
  // Check for --http flag
  const useHttp = Deno.args.includes("--http") ||
    Deno.env.get("MCP_TRANSPORT") === "http";

  // Parse port with validation (1-65535)
  const portArg = Deno.args.find((arg) => arg.startsWith("--port="));
  const portValue = portArg ? portArg.split("=")[1] : Deno.env.get("MCP_PORT");
  const port = parsePort(portValue, 3000);

  // Warn if invalid port was provided
  if (portValue && parsePort(portValue, -1) === -1) {
    console.error(`Warning: Invalid port "${portValue}", using default 3000`);
  }

  // Parse permissions
  const permissionsEnv = Deno.env.get("MCP_PERMISSIONS") || "AUTOMATION";
  const permissions = ["READONLY", "AUTOMATION", "FULL"].includes(permissionsEnv)
    ? (permissionsEnv as PermissionSet)
    : "AUTOMATION";

  // Parse max sessions with validation (1-1000)
  const maxSessionsEnv = Deno.env.get("MCP_MAX_SESSIONS") || "10";
  const maxSessions = parseIntSafe(maxSessionsEnv, 10, 1, 1000);

  // Warn if invalid max sessions was provided
  if (maxSessionsEnv !== "10" && parseIntSafe(maxSessionsEnv, -1, 1, 1000) === -1) {
    console.error(`Warning: Invalid MCP_MAX_SESSIONS "${maxSessionsEnv}", using default 10`);
  }

  return {
    transport: useHttp ? "http" : "stdio",
    port,
    permissions,
    maxSessions,
  };
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const config = parseConfig();

  // Log startup info to stderr (stdout is used for MCP in stdio mode)
  console.error("Starting BrowserX MCP Server...");
  console.error(`  Transport: ${config.transport}`);
  console.error(`  Permissions: ${config.permissions}`);
  console.error(`  Max Sessions: ${config.maxSessions}`);

  // Create MCP server and context
  const { server, context } = await createMCPServer({
    name: "browserx-mcp",
    version: "0.1.0",
    permissions: config.permissions,
    sessionConfig: {
      maxSessions: config.maxSessions,
    },
    queryEngineConfig: {
      security: {
        sandbox: {
          enabled: true,
          timeout: 30000,
        },
      },
    },
  });

  // Log runtime stats to verify event loops are running
  const stats = context.runtime.getStats();
  console.error("BrowserX Runtime started:");
  console.error(`  State: ${stats.state}`);
  console.error(`  Event Loops: proxy=${stats.eventLoops.proxyLoopRunning}, browser=${stats.eventLoops.browserLoopsActive} active`);
  console.error(`  Browser Pool: ${stats.resources.browserInstances} instances`);

  // Register all tools
  console.error("Registering tools...");
  registerQueryTools(server, context);
  registerBrowserTools(server, context);
  registerProxyTools(server, context);

  // Register all resources
  console.error("Registering resources...");
  registerPageResources(server, context);
  registerMetricsResources(server, context);

  // Register prompts
  console.error("Registering prompts...");
  registerPrompts(server);

  // Handle shutdown signals
  const shutdown = async () => {
    console.error("\nShutting down BrowserX MCP Server...");
    await shutdownMCPServer(context);
    Deno.exit(0);
  };

  Deno.addSignalListener("SIGINT", shutdown);
  Deno.addSignalListener("SIGTERM", shutdown);

  // Start server with selected transport
  if (config.transport === "http") {
    await startHttpServer(server, { port: config.port });
  } else {
    await startStdioServer(server);
  }
}

// Run main
main().catch((error) => {
  console.error("Fatal error:", error);
  Deno.exit(1);
});
