/**
 * Printer Device Layer
 *
 * Unified printer interface supporting serial printers (ESC/POS via serialx),
 * OS printers (lp/lpr), and PDF printing.
 */

import { SerialDevice, type SerialPortInfo } from "./Serial.ts";
import { loadSerialx } from "./serialx-loader.ts";

/** Printer information */
export interface PrinterInfo {
  name: string;
  type: "serial" | "os" | "network";
  port: string | null;
  status: string;
}

/** Print job definition */
export interface PrintJob {
  content: string | Uint8Array;
  format: "text" | "escpos" | "pdf" | "raw";
  copies?: number;
  options?: {
    bold?: boolean;
    align?: "left" | "center" | "right";
    fontSize?: { width: number; height: number };
    cut?: boolean;
  };
}

/** Print result */
export interface PrintResult {
  success: boolean;
  message: string;
  bytesWritten?: number;
}

/** Printer status */
export interface PrinterStatus {
  connected: boolean;
  ready: boolean;
  paperPresent: boolean;
  error: string | null;
}

/**
 * Printer device supporting serial ESC/POS printers and OS printers
 */
export class Printer {
  private serialDevice: SerialDevice | null = null;
  // deno-lint-ignore no-explicit-any
  private escpos: any = null;
  private printerName: string = "";
  private printerType: "serial" | "os" = "os";

  /** List all available printers (serial + OS) */
  static async list(): Promise<PrinterInfo[]> {
    const printers: PrinterInfo[] = [];

    // Get serial printers from serialx
    const mod = await loadSerialx();
    if (mod && mod.SerialPort.isAvailable()) {
      const serialPrinters = mod.SerialPort.listPrinters();
      for (const p of serialPrinters) {
        printers.push({
          name: p.name,
          type: p.printer_type === "serial" ? "serial" : "os",
          port: p.port,
          status: p.status,
        });
      }
    } else {
      // Fallback: try lpstat directly
      try {
        const cmd = new Deno.Command("lpstat", { args: ["-p"], stdout: "piped", stderr: "piped" });
        const output = await cmd.output();
        const stdout = new TextDecoder().decode(output.stdout);
        for (const line of stdout.split("\n")) {
          if (line.startsWith("printer ")) {
            const name = line.slice(8).split(/\s+/)[0];
            const status = line.includes("idle") ? "idle" : line.includes("disabled") ? "disabled" : "unknown";
            printers.push({ name, type: "os", port: null, status });
          }
        }
      } catch {
        // lpstat not available
      }
    }

    return printers;
  }

  /** Connect to a serial printer */
  async connect(port: string, baudRate: number = 9600): Promise<boolean> {
    this.serialDevice = new SerialDevice();
    const opened = await this.serialDevice.open(port, { baudRate });

    if (opened) {
      const mod = await loadSerialx();
      if (mod && this.serialDevice.rawPort) {
        // deno-lint-ignore no-explicit-any
        this.escpos = new mod.EscPos(this.serialDevice.rawPort as any);
        this.escpos.init();
      }
      this.printerName = port;
      this.printerType = "serial";
    }

    return opened;
  }

  /** Disconnect from a serial printer */
  disconnect(): boolean {
    if (this.serialDevice) {
      const result = this.serialDevice.close();
      this.serialDevice = null;
      this.escpos = null;
      return result;
    }
    return false;
  }

  /** Print a job */
  async print(job: PrintJob): Promise<PrintResult> {
    const copies = job.copies ?? 1;
    let lastResult: PrintResult = { success: false, message: "No copies to print" };
    let totalBytesWritten = 0;

    for (let i = 0; i < copies; i++) {
      if (this.printerType === "serial" && this.escpos) {
        lastResult = this.printSerial(job);
      } else {
        lastResult = await this.printOS(job);
      }

      if (!lastResult.success) {
        return { ...lastResult, message: `Failed on copy ${i + 1}/${copies}: ${lastResult.message}` };
      }
      totalBytesWritten += lastResult.bytesWritten ?? 0;
    }

    return { ...lastResult, bytesWritten: totalBytesWritten, message: `Printed ${copies} cop${copies === 1 ? "y" : "ies"}` };
  }

  /** Print via serial ESC/POS */
  private printSerial(job: PrintJob): PrintResult {
    if (!this.escpos || !this.serialDevice) {
      return { success: false, message: "No serial printer connected" };
    }

    try {
      if (job.format === "escpos" || job.format === "text") {
        // Apply options
        if (job.options?.align) {
          this.escpos.align(job.options.align);
        }
        if (job.options?.bold !== undefined) {
          this.escpos.bold(job.options.bold);
        }
        if (job.options?.fontSize) {
          this.escpos.fontSize(job.options.fontSize.width, job.options.fontSize.height);
        }

        // Print content
        const text = typeof job.content === "string"
          ? job.content
          : new TextDecoder().decode(job.content);

        for (const line of text.split("\n")) {
          this.escpos.print(line);
        }

        // Cut if requested
        if (job.options?.cut) {
          this.escpos.feedAndCut();
        }

        return { success: true, message: "Printed via ESC/POS", bytesWritten: text.length };
      } else if (job.format === "raw") {
        const data = typeof job.content === "string"
          ? new TextEncoder().encode(job.content)
          : job.content;
        const written = this.serialDevice.write(data);
        return {
          success: written >= 0,
          message: written >= 0 ? "Raw data sent" : "Write failed",
          bytesWritten: written >= 0 ? written : 0,
        };
      }

      return { success: false, message: `Unsupported format for serial: ${job.format}` };
    } catch (e) {
      return { success: false, message: `Serial print error: ${e}` };
    }
  }

  /** Print via OS print system (lp/lpr) */
  private async printOS(job: PrintJob): Promise<PrintResult> {
    try {
      const content = typeof job.content === "string"
        ? new TextEncoder().encode(job.content)
        : job.content;

      // Write to temp file
      const tmpFile = await Deno.makeTempFile({ suffix: job.format === "pdf" ? ".pdf" : ".txt" });
      await Deno.writeFile(tmpFile, content);

      // Use lp command
      const args = [tmpFile];
      if (this.printerName) {
        args.unshift("-d", this.printerName);
      }

      const cmd = new Deno.Command("lp", { args, stdout: "piped", stderr: "piped" });
      const output = await cmd.output();

      // Clean up temp file
      try {
        await Deno.remove(tmpFile);
      } catch {
        // Ignore cleanup errors
      }

      if (output.code === 0) {
        return { success: true, message: "Sent to OS print queue", bytesWritten: content.length };
      } else {
        const stderr = new TextDecoder().decode(output.stderr);
        return { success: false, message: `lp failed: ${stderr}` };
      }
    } catch (e) {
      return { success: false, message: `OS print error: ${e}` };
    }
  }

  /** Print a PDF to a specific printer */
  async printPDF(pdfBytes: Uint8Array, printerName?: string): Promise<PrintResult> {
    const target = printerName || this.printerName;
    const tmpFile = await Deno.makeTempFile({ suffix: ".pdf" });
    await Deno.writeFile(tmpFile, pdfBytes);

    try {
      const args = target ? ["-d", target, tmpFile] : [tmpFile];
      const cmd = new Deno.Command("lp", { args, stdout: "piped", stderr: "piped" });
      const output = await cmd.output();

      if (output.code === 0) {
        return { success: true, message: `PDF sent to ${target || "default printer"}`, bytesWritten: pdfBytes.length };
      } else {
        const stderr = new TextDecoder().decode(output.stderr);
        return { success: false, message: `PDF print failed: ${stderr}` };
      }
    } finally {
      try {
        await Deno.remove(tmpFile);
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  /** Get printer status */
  getStatus(): PrinterStatus {
    if (this.printerType === "serial" && this.serialDevice) {
      return {
        connected: this.serialDevice.isOpen,
        ready: this.serialDevice.isOpen,
        paperPresent: true, // Cannot detect via serial
        error: null,
      };
    }

    return {
      connected: false,
      ready: false,
      paperPresent: true,
      error: this.serialDevice ? null : "No printer connected",
    };
  }

  /** Set the OS printer name for OS printing (no serial connection needed) */
  setOSPrinter(name: string): void {
    this.printerName = name;
    this.printerType = "os";
  }
}

/**
 * Printer discovery utility
 */
export class PrinterDiscovery {
  /** Known printer USB vendor IDs */
  static readonly PRINTER_VIDS: number[] = [
    0x04B8, // Epson
    0x04F9, // Brother
    0x03F0, // HP
    0x04A9, // Canon
    0x0424, // Star Micronics
    0x0DD4, // Custom Engineering
  ];

  /** Discover serial printers by scanning ports for known VIDs */
  static async discover(): Promise<PrinterInfo[]> {
    const ports = await SerialDevice.listPorts();
    const printers: PrinterInfo[] = [];

    for (const port of ports) {
      if (port.vid !== null && this.PRINTER_VIDS.includes(port.vid)) {
        printers.push({
          name: port.product || port.name,
          type: "serial",
          port: port.name,
          status: "available",
        });
      }
    }

    return printers;
  }
}
