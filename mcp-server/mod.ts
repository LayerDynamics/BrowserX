/**
 * BrowserX MCP Server
 * Main entry point for the Model Context Protocol server
 *
 * This server exposes BrowserX capabilities to LLMs like Claude,
 * enabling AI-driven browser automation, web scraping, and proxy control.
 *
 * Startup is fast (<100ms) - heavy services initialize lazily on first use:
 * - BrowserXRuntime: initializes on first browser tool call
 * - QueryEngine: initializes on first query tool call
 * - SessionManager: initializes on first session creation
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
import { registerGraphTools } from "./tools/graph-tools.ts";
import { registerDeviceTools } from "./tools/device-tools.ts";
import { registerPageResources } from "./resources/page-resources.ts";
import { registerMetricsResources } from "./resources/metrics-resources.ts";
import { registerVisibilityResources } from "./resources/visibility-resources.ts";
import { registerVisibilityTools } from "./tools/visibility-tools.ts";
import { registerPrompts } from "./prompts/automation-prompts.ts";
import { setGlobalActivityLogger } from "./activity/mod.ts";
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
  const startTime = Date.now();
  const config = parseConfig();

  // Log startup info to stderr (stdout is used for MCP in stdio mode)
  console.error("Starting BrowserX MCP Server...");
  console.error(`  Transport: ${config.transport}`);
  console.error(`  Permissions: ${config.permissions}`);
  console.error(`  Max Sessions: ${config.maxSessions}`);

  // Create MCP server and context (lightweight - no heavy services started yet)
  const { server, context } = createMCPServer({
    name: "browserx-mcp",
    version: "0.1.0",
    permissions: config.permissions,
    maxSessions: config.maxSessions,
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

  // Set up global activity logger for tool wrapper integration
  setGlobalActivityLogger(context.activityLogger);

  // Start the activity logger (enables status bar and logging)
  context.activityLogger.start();

  // Register all tools (they will use lazy initialization)
  console.error("Registering tools...");
  registerQueryTools(server, context);
  registerBrowserTools(server, context);
  registerProxyTools(server, context);
  registerGraphTools(server, context);
  registerDeviceTools(server, context);
  registerVisibilityTools(server, context, context.visibilityService);

  // Register all resources
  console.error("Registering resources...");
  registerPageResources(server, context);
  registerMetricsResources(server, context);
  registerVisibilityResources(server, context, context.visibilityService);

  // Register prompts
  console.error("Registering prompts...");
  registerPrompts(server);

  // Handle shutdown signals
  const shutdown = async () => {
    console.error("\nShutting down BrowserX MCP Server...");
    context.activityLogger.stop();
    await shutdownMCPServer(context);
    Deno.exit(0);
  };

  Deno.addSignalListener("SIGINT", shutdown);
  Deno.addSignalListener("SIGTERM", shutdown);

  // Log service initialization status
  const status = context.serviceInitializer.getStatus();
  console.error("Service initialization status:");
  console.error(`  Runtime: ${status.runtime} (lazy)`);
  console.error(`  QueryEngine: ${status.queryEngine} (lazy)`);
  console.error(`  SessionManager: ${status.sessionManager} (lazy)`);

  const startupTime = Date.now() - startTime;
  console.error(`Server ready in ${startupTime}ms (services will init on first use)`);

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
