/**
 * Device Tools for MCP Server
 * Serial port, printer, and hardware device control
 */

import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { MCPServerContext } from "../server/mcp-server.ts";
import {
  withFeedback,
  PROGRESS_STAGES,
} from "../feedback/mod.ts";
import { ToolRateLimiter } from "./ToolRateLimiter.ts";

const deviceRateLimiter = new ToolRateLimiter({ maxRequests: 100, windowMs: 60000 });

// Lazy-load device modules from browser engine
let deviceModuleLoaded = false;
// deno-lint-ignore no-explicit-any
let deviceModule: any = null;

async function getDeviceModule() {
  if (deviceModuleLoaded) return deviceModule;
  try {
    deviceModule = await import("@browserx/browser");
    deviceModuleLoaded = true;
  } catch {
    deviceModule = null;
    deviceModuleLoaded = true;
  }
  return deviceModule;
}

/**
 * Clean up all open serial devices in a context.
 * Call this on session shutdown to prevent leaked hardware resources.
 */
export function cleanupSerialDevices(context: MCPServerContext): void {
  const devices = context.metadata?.serialDevices;
  if (!devices) return;
  for (const [deviceId, device] of Object.entries(devices)) {
    try {
      (device as { close: () => boolean }).close();
    } catch {
      // Best-effort cleanup
    }
    delete devices[deviceId];
  }
}

/**
 * Register device tools with the MCP server
 */
export function registerDeviceTools(
  server: McpServer,
  context: MCPServerContext,
): void {
  // List serial ports
  server.tool(
    "device_list_serial_ports",
    "Enumerate all available serial ports on the system, including USB device information.",
    {},
    withFeedback(
      server,
      "device_list_serial_ports",
      async (_args, ctx) => {
        context.permissionGuard.checkToolPermission("device_list_serial_ports");
        deviceRateLimiter.check("device_list_serial_ports");

        await ctx.progress.stage("STARTING", PROGRESS_STAGES.NAVIGATE.STARTING);

        const mod = await getDeviceModule();
        if (!mod?.SerialDevice) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ ports: [], available: false, message: "Serial device support not available" }) }],
          };
        }

        const available = await mod.SerialDevice.isAvailable();
        const ports = available ? await mod.SerialDevice.listPorts() : [];

        return {
          content: [{ type: "text" as const, text: JSON.stringify({ ports, available, count: ports.length }) }],
        };
      },
    ),
  );

  // List printers
  server.tool(
    "device_list_printers",
    "List all available printers (serial ESC/POS printers and OS-level printers).",
    {},
    withFeedback(
      server,
      "device_list_printers",
      async (_args, ctx) => {
        context.permissionGuard.checkToolPermission("device_list_printers");
        deviceRateLimiter.check("device_list_printers");

        await ctx.progress.stage("STARTING", PROGRESS_STAGES.NAVIGATE.STARTING);

        const mod = await getDeviceModule();
        if (!mod?.Printer) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ printers: [], available: false }) }],
          };
        }

        const printers = await mod.Printer.list();

        return {
          content: [{ type: "text" as const, text: JSON.stringify({ printers, count: printers.length }) }],
        };
      },
    ),
  );

  // Open serial port
  server.tool(
    "device_serial_open",
    "Open a serial port connection for reading/writing data.",
    {
      port: z.string().regex(/^(\/dev\/tty[\w./-]+|COM\d+|\\\\\.\\COM\d+)$/, "Must be a valid serial port path (e.g., /dev/ttyUSB0, COM3)").describe("Serial port name (e.g., /dev/ttyUSB0, COM3)"),
      baudRate: z.number().optional().default(9600).describe("Baud rate (default: 9600)"),
      dataBits: z.number().optional().describe("Data bits (5, 6, 7, or 8)"),
      stopBits: z.number().optional().describe("Stop bits (1 or 2)"),
      parity: z.enum(["none", "odd", "even"]).optional().describe("Parity mode"),
    },
    withFeedback(
      server,
      "device_serial_open",
      async ({ port, baudRate, dataBits, stopBits, parity }, ctx) => {
        context.permissionGuard.checkToolPermission("device_serial_open");
        deviceRateLimiter.check("device_serial_open");

        await ctx.progress.stage("STARTING", PROGRESS_STAGES.NAVIGATE.STARTING);

        const mod = await getDeviceModule();
        if (!mod?.SerialDevice) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ success: false, error: "Serial not available" }) }],
          };
        }

        const device = new mod.SerialDevice();
        const options: Record<string, unknown> = { baudRate: baudRate as number };
        if (dataBits !== undefined) options.dataBits = dataBits;
        if (stopBits !== undefined) options.stopBits = stopBits;
        if (parity !== undefined) options.parity = parity;

        try {
          const opened = await device.open(port as string, options);
          if (opened) {
            // Store device in context for later use
            const deviceId = `serial_${Date.now()}`;
            if (!context.metadata) context.metadata = {};
            if (!context.metadata.serialDevices) context.metadata.serialDevices = {};
            context.metadata.serialDevices[deviceId] = device;

            return {
              content: [{ type: "text" as const, text: JSON.stringify({ success: true, deviceId, port, baudRate }) }],
            };
          } else {
            return {
              content: [{ type: "text" as const, text: JSON.stringify({ success: false, error: `Failed to open ${port}` }) }],
            };
          }
        } catch (e) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ success: false, error: String(e) }) }],
          };
        }
      },
    ),
  );

  // Write to serial port
  server.tool(
    "device_serial_write",
    "Write data to an open serial port.",
    {
      deviceId: z.string().describe("Device ID from device_serial_open"),
      data: z.string().describe("Data to write (text string)"),
    },
    withFeedback(
      server,
      "device_serial_write",
      async ({ deviceId, data }, ctx) => {
        context.permissionGuard.checkToolPermission("device_serial_write");
        deviceRateLimiter.check("device_serial_write");

        await ctx.progress.stage("STARTING", PROGRESS_STAGES.NAVIGATE.STARTING);

        const device = context.metadata?.serialDevices?.[deviceId as string];
        if (!device) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ success: false, error: `Device ${deviceId} not found` }) }],
          };
        }

        const encoded = new TextEncoder().encode(data as string);
        const bytesWritten = device.write(encoded);

        return {
          content: [{ type: "text" as const, text: JSON.stringify({ success: bytesWritten >= 0, bytesWritten }) }],
        };
      },
    ),
  );

  // Read from serial port
  server.tool(
    "device_serial_read",
    "Read data from an open serial port.",
    {
      deviceId: z.string().describe("Device ID from device_serial_open"),
      maxBytes: z.number().optional().default(1024).describe("Maximum bytes to read"),
      timeoutMs: z.number().optional().default(1000).describe("Read timeout in milliseconds"),
    },
    withFeedback(
      server,
      "device_serial_read",
      async ({ deviceId, maxBytes, timeoutMs }, ctx) => {
        context.permissionGuard.checkToolPermission("device_serial_read");
        deviceRateLimiter.check("device_serial_read");

        await ctx.progress.stage("STARTING", PROGRESS_STAGES.NAVIGATE.STARTING);

        const device = context.metadata?.serialDevices?.[deviceId as string];
        if (!device) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ success: false, error: `Device ${deviceId} not found` }) }],
          };
        }

        const bytes = device.read(maxBytes as number, timeoutMs as number);
        const text = new TextDecoder().decode(bytes);

        return {
          content: [{ type: "text" as const, text: JSON.stringify({ success: true, data: text, bytesRead: bytes.length }) }],
        };
      },
    ),
  );

  // Close serial port
  server.tool(
    "device_serial_close",
    "Close an open serial port connection.",
    {
      deviceId: z.string().describe("Device ID from device_serial_open"),
    },
    withFeedback(
      server,
      "device_serial_close",
      async ({ deviceId }, ctx) => {
        context.permissionGuard.checkToolPermission("device_serial_close");
        deviceRateLimiter.check("device_serial_close");

        await ctx.progress.stage("STARTING", PROGRESS_STAGES.NAVIGATE.STARTING);

        const device = context.metadata?.serialDevices?.[deviceId as string];
        if (!device) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ success: false, error: `Device ${deviceId} not found` }) }],
          };
        }

        const closed = device.close();
        delete context.metadata.serialDevices[deviceId as string];

        return {
          content: [{ type: "text" as const, text: JSON.stringify({ success: closed }) }],
        };
      },
    ),
  );

  // Print (text/ESC-POS/PDF)
  server.tool(
    "device_print",
    "Submit a print job to a printer. Supports text, ESC/POS, and raw formats.",
    {
      content: z.string().describe("Content to print"),
      format: z.enum(["text", "escpos", "raw"]).optional().default("text").describe("Print format"),
      printerName: z.string().optional().describe("Target printer name (OS printer)"),
      serialPort: z.string().optional().describe("Serial port for ESC/POS printer"),
      options: z.object({
        bold: z.boolean().optional(),
        align: z.enum(["left", "center", "right"]).optional(),
        cut: z.boolean().optional(),
      }).optional().describe("Print options"),
    },
    withFeedback(
      server,
      "device_print",
      async ({ content, format, printerName, serialPort, options }, ctx) => {
        context.permissionGuard.checkToolPermission("device_print");
        deviceRateLimiter.check("device_print");

        await ctx.progress.stage("STARTING", PROGRESS_STAGES.NAVIGATE.STARTING);

        const mod = await getDeviceModule();
        if (!mod?.Printer) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ success: false, error: "Printer support not available" }) }],
          };
        }

        const printer = new mod.Printer();

        try {
          if (serialPort) {
            const connected = await printer.connect(serialPort as string);
            if (!connected) {
              return {
                content: [{ type: "text" as const, text: JSON.stringify({ success: false, error: `Failed to connect to ${serialPort}` }) }],
              };
            }
          } else if (printerName) {
            printer.setOSPrinter(printerName as string);
          }

          const result = await printer.print({
            content: content as string,
            format: format as "text" | "escpos" | "raw",
            options: options as Record<string, unknown> | undefined,
          });

          if (serialPort) {
            printer.disconnect();
          }

          return {
            content: [{ type: "text" as const, text: JSON.stringify(result) }],
          };
        } catch (e) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ success: false, error: String(e) }) }],
          };
        }
      },
    ),
  );

  // Print current page as PDF to printer
  server.tool(
    "device_print_pdf",
    "Print a PDF document to a printer. Can generate PDF from current page or accept PDF bytes.",
    {
      printerName: z.string().optional().describe("Target printer name"),
      sessionId: z.string().optional().describe("Browser session ID to generate PDF from current page"),
    },
    withFeedback(
      server,
      "device_print_pdf",
      async ({ printerName, sessionId }, ctx) => {
        context.permissionGuard.checkToolPermission("device_print_pdf");
        deviceRateLimiter.check("device_print_pdf");

        await ctx.progress.stage("STARTING", PROGRESS_STAGES.NAVIGATE.STARTING);

        const mod = await getDeviceModule();
        if (!mod?.Printer) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ success: false, error: "Printer support not available" }) }],
          };
        }

        try {
          // If sessionId provided, generate PDF from current page
          let pdfBytes: Uint8Array | null = null;

          if (sessionId) {
            const sessionManager = await context.getSessionManager();
            const session = sessionManager.getSession(sessionId as string);
            if (session?.browser) {
              const { PDFGenerator } = await import("@browserx/browser");
              const generator = new PDFGenerator();
              const pdfResult = generator.generatePDF(session.browser.getDOM?.() || "");
              pdfBytes = new TextEncoder().encode(pdfResult);
            }
          }

          if (!pdfBytes) {
            return {
              content: [{ type: "text" as const, text: JSON.stringify({ success: false, error: "No PDF content available. Provide sessionId for page PDF." }) }],
            };
          }

          const printer = new mod.Printer();
          const result = await printer.printPDF(pdfBytes, printerName as string | undefined);

          return {
            content: [{ type: "text" as const, text: JSON.stringify(result) }],
          };
        } catch (e) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ success: false, error: String(e) }) }],
          };
        }
      },
    ),
  );

  // device_get_trace_log — Get serial communication trace log for diagnostics
  server.tool(
    "device_get_trace_log",
    "Get the serial communication trace log for diagnostics",
    {},
    withFeedback(
      server,
      "device_get_trace_log",
      async (_args, _ctx) => {
        context.permissionGuard.checkToolPermission("device_get_trace_log");
        deviceRateLimiter.check("device_get_trace_log");
        try {
          const serialx = await import("@browserx/serialx");
          const log = serialx.SerialTrace.getLog();
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ log, count: log.length }) }],
          };
        } catch {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ log: [], count: 0, error: "SerialX not available" }) }],
          };
        }
      },
    ),
  );

  // device_clear_trace_log — Clear the serial communication trace log
  server.tool(
    "device_clear_trace_log",
    "Clear the serial communication trace log",
    {},
    withFeedback(
      server,
      "device_clear_trace_log",
      async (_args, _ctx) => {
        context.permissionGuard.checkToolPermission("device_clear_trace_log");
        deviceRateLimiter.check("device_clear_trace_log");
        try {
          const serialx = await import("@browserx/serialx");
          serialx.SerialTrace.clear();
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ success: true }) }],
          };
        } catch {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ success: false, error: "SerialX not available" }) }],
          };
        }
      },
    ),
  );
}
