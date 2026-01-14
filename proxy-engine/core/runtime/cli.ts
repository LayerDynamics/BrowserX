/**
 * CLI Entry Point
 *
 * Command-line interface for starting the proxy engine runtime
 */

import { Runtime, RuntimeState } from "./runtime.ts";
import { ConfigLoader, createDefaultConfig } from "./config.ts";
import { parseArgs } from "https://deno.land/std@0.220.0/cli/parse_args.ts";

/**
 * Print usage information
 */
function printUsage(): void {
  console.log(`
BrowserX Proxy Engine

Usage:
  deno run --allow-all cli.ts [options]

Options:
  -c, --config <file>     Configuration file path (JSON)
  -p, --port <number>     Port to listen on (default: 8080)
  -h, --host <string>     Host to bind to (default: 0.0.0.0)
  --log-level <level>     Log level: debug, info, warn, error (default: info)
  --env <environment>     Environment: development, production, test (default: production)
  --metrics-port <port>   Enable metrics server on specified port
  --help                  Show this help message

Examples:
  # Start with default configuration
  deno run --allow-all cli.ts

  # Start with custom configuration file
  deno run --allow-all cli.ts --config config.json

  # Start on port 3000 with debug logging
  deno run --allow-all cli.ts --port 3000 --log-level debug

  # Start with metrics enabled
  deno run --allow-all cli.ts --metrics-port 9090
`);
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const args = parseArgs(Deno.args, {
    string: ["config", "host", "log-level", "env"],
    number: ["port", "metrics-port"],
    boolean: ["help"],
    alias: {
      c: "config",
      p: "port",
      h: "host",
    },
  });

  // Show help
  if (args.help) {
    printUsage();
    Deno.exit(0);
  }

  try {
    let config;

    // Load configuration
    if (args.config) {
      console.log(`Loading configuration from: ${args.config}`);
      config = await ConfigLoader.loadFromFile(args.config);
    } else {
      // Create default configuration
      const port = args.port || 8080;
      const host = args.host || "0.0.0.0";

      console.log("Using default configuration");
      config = createDefaultConfig(port);
      config.gateways[0].host = host;
    }

    // Override configuration with CLI arguments
    if (args["log-level"]) {
      config.logLevel = args["log-level"] as any;
    }

    if (args.env) {
      config.environment = args.env as any;
    }

    if (args["metrics-port"]) {
      config.metrics = true;
      config.metricsPort = args["metrics-port"];
    }

    // Create runtime
    const runtime = new Runtime(config);

    // Add event listeners
    runtime.addEventListener((event) => {
      switch (event.type) {
        case "starting":
          console.log("Runtime starting...");
          break;
        case "started":
          console.log("Runtime started successfully");
          printRuntimeInfo(runtime);
          break;
        case "stopping":
          console.log(`Runtime stopping: ${event.reason}`);
          break;
        case "stopped":
          console.log("Runtime stopped");
          break;
        case "error":
          console.error("Runtime error:", event.error);
          break;
        case "gateway_started":
          console.log(`Gateway started: ${event.host}:${event.port}`);
          break;
        case "gateway_stopped":
          console.log(`Gateway stopped: ${event.host}:${event.port}`);
          break;
      }
    });

    // Start runtime
    await runtime.start();

    // Keep process alive
    await new Promise(() => {});
  } catch (error) {
    console.error("Fatal error:", error);
    Deno.exit(1);
  }
}

/**
 * Print runtime information
 */
function printRuntimeInfo(runtime: Runtime): void {
  const stats = runtime.getStats();

  console.log("\n=================================");
  console.log("  Proxy Engine Runtime Info");
  console.log("=================================");
  console.log(`State: ${stats.state}`);
  console.log(`Active Gateways: ${stats.activeGateways}`);
  console.log("\nGateways:");
  for (const gateway of stats.gateways) {
    console.log(`  - ${gateway.host}:${gateway.port}`);
  }
  console.log("\nMemory Usage:");
  console.log(`  Heap Used: ${formatBytes(stats.memory.heapUsed)}`);
  console.log(`  Heap Total: ${formatBytes(stats.memory.heapTotal)}`);
  console.log(`  RSS: ${formatBytes(stats.memory.rss)}`);
  console.log("=================================\n");
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

// Run main
if (import.meta.main) {
  main();
}
