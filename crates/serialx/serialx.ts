/**
 * SerialX — Serial Port & Device Communication via Rust FFI
 *
 * Provides high-level API over serialx FFI bindings for serial port
 * enumeration, I/O, ESC/POS printer protocols, and OS printer discovery.
 */

// FFI bindings may not be available (not built yet or unsupported platform)
let ffiAvailable = false;
// deno-lint-ignore no-explicit-any
let ffi: any = null;

try {
  ffi = await import("./bindings/bindings.ts");
  ffi.serialx_init();
  ffiAvailable = true;
} catch {
  // FFI not available — graceful degradation
}

/** Serial port information */
export interface SerialPortInfo {
  name: string;
  port_type: string;
  vid: number | null;
  pid: number | null;
  manufacturer: string | null;
  product: string | null;
  serial_number: string | null;
}

/** Printer information */
export interface PrinterInfo {
  name: string;
  printer_type: string;
  port: string | null;
  status: string;
}

/** Device configuration options */
export interface DeviceConfig {
  data_bits?: 5 | 6 | 7 | 8;
  stop_bits?: 1 | 2;
  parity?: "none" | "odd" | "even";
  flow_control?: "none" | "software" | "hardware";
  timeout_ms?: number;
}

/** ESC/POS alignment */
export type EscPosAlign = "left" | "center" | "right";

/**
 * Serial port device for reading/writing data
 */
export class SerialPort {
  // Device ID is bigint because Deno FFI maps Rust u64 to BigInt
  private deviceId: bigint = 0n;

  /** Check if native serial port support is available */
  static isAvailable(): boolean {
    return ffiAvailable;
  }

  /** List all available serial ports */
  static listPorts(): SerialPortInfo[] {
    if (!ffiAvailable) return [];
    try {
      const json = ffi.serialx_list_ports();
      return JSON.parse(json) as SerialPortInfo[];
    } catch {
      return [];
    }
  }

  /** List all available printers (serial + OS) */
  static listPrinters(): PrinterInfo[] {
    if (!ffiAvailable) return [];
    try {
      const json = ffi.serialx_list_printers();
      return JSON.parse(json) as PrinterInfo[];
    } catch {
      return [];
    }
  }

  /** Open a serial port connection */
  open(portName: string, baudRate: number = 9600): boolean {
    if (!ffiAvailable) {
      throw new Error("SerialX FFI not available");
    }
    this.deviceId = ffi.serialx_open(portName, baudRate) as bigint;
    return this.deviceId > 0n;
  }

  /** Close the serial port connection */
  close(): boolean {
    if (!ffiAvailable || this.deviceId === 0n) return false;
    const result = ffi.serialx_close(this.deviceId);
    if (result === 0) {
      this.deviceId = 0n;
    }
    return result === 0;
  }

  /** Configure port parameters */
  configure(config: DeviceConfig): boolean {
    if (!ffiAvailable || this.deviceId === 0n) return false;
    const result = ffi.serialx_configure(this.deviceId, JSON.stringify(config));
    return result === 0;
  }

  /** Write data to the port */
  write(data: Uint8Array): number {
    if (!ffiAvailable || this.deviceId === 0n) return -1;
    // Chunked base64 encoding to avoid call stack overflow on large arrays
    const CHUNK_SIZE = 8192;
    let binary = "";
    for (let i = 0; i < data.length; i += CHUNK_SIZE) {
      const chunk = data.subarray(i, Math.min(i + CHUNK_SIZE, data.length));
      binary += String.fromCharCode(...chunk);
    }
    const b64 = btoa(binary);
    return ffi.serialx_write(this.deviceId, b64) as number;
  }

  /** Read data from the port */
  read(maxLen: number = 1024, timeoutMs: number = 1000): Uint8Array {
    if (!ffiAvailable || this.deviceId === 0n) return new Uint8Array(0);
    const b64 = ffi.serialx_read(this.deviceId, maxLen, timeoutMs) as string;
    if (!b64) return new Uint8Array(0);
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  /** Flush pending data */
  flush(): boolean {
    if (!ffiAvailable || this.deviceId === 0n) return false;
    return ffi.serialx_flush(this.deviceId) === 0;
  }

  /** Get bytes available for reading */
  bytesAvailable(): number {
    if (!ffiAvailable || this.deviceId === 0n) return -1;
    return ffi.serialx_bytes_available(this.deviceId) as number;
  }

  /** Get the device ID (0n if not open) */
  get id(): bigint {
    return this.deviceId;
  }

  /** Check if port is open */
  get isOpen(): boolean {
    return this.deviceId > 0n;
  }
}

/**
 * ESC/POS printer command builder
 */
export class EscPos {
  private port: SerialPort;

  constructor(port: SerialPort) {
    this.port = port;
  }

  /** Get the live device ID from the port (tracks reconnections) */
  private get deviceId(): bigint {
    return this.port.id;
  }

  private sendCommand(command: Record<string, unknown>): boolean {
    if (!ffiAvailable || this.deviceId === 0n) return false;
    return ffi.serialx_escpos_command(this.deviceId, JSON.stringify(command)) === 0;
  }

  /** Initialize the printer */
  init(): boolean {
    return this.sendCommand({ type: "Init" });
  }

  /** Print text with line feed */
  print(text: string): boolean {
    return this.sendCommand({ type: "Print", text });
  }

  /** Execute a paper cut */
  cut(): boolean {
    return this.sendCommand({ type: "Cut" });
  }

  /** Feed n lines */
  feed(lines: number = 1): boolean {
    return this.sendCommand({ type: "LineFeed", lines });
  }

  /** Set bold mode */
  bold(enabled: boolean): boolean {
    return this.sendCommand({ type: "SetBold", enabled });
  }

  /** Set text alignment */
  align(align: EscPosAlign): boolean {
    return this.sendCommand({ type: "SetAlign", align });
  }

  /** Set font size (width/height multiplier 1-8) */
  fontSize(width: number, height: number): boolean {
    return this.sendCommand({ type: "SetFontSize", width, height });
  }

  /** Print a barcode */
  barcode(data: string, barcodeType: number = 2): boolean {
    return this.sendCommand({ type: "PrintBarcode", data, barcode_type: barcodeType });
  }

  /** Feed 3 lines and cut */
  feedAndCut(): boolean {
    return this.sendCommand({ type: "FeedAndCut" });
  }
}

/**
 * Trace log access for diagnostics
 */
export class SerialTrace {
  /** Get the trace log as parsed events */
  static getLog(): Array<{
    timestamp: number;
    component: string;
    message: string;
    direction: string;
    data_preview: string | null;
  }> {
    if (!ffiAvailable) return [];
    try {
      const json = ffi.serialx_get_trace_log();
      return JSON.parse(json);
    } catch {
      return [];
    }
  }

  /** Get raw trace log JSON */
  static getLogJson(): string {
    if (!ffiAvailable) return "[]";
    try {
      return ffi.serialx_get_trace_log();
    } catch {
      return "[]";
    }
  }

  /** Clear the trace log */
  static clear(): void {
    if (ffiAvailable) {
      ffi.serialx_clear_trace_log();
    }
  }
}

/** Get the serialx library version */
export function getVersion(): string {
  if (!ffiAvailable) return "unavailable";
  return ffi.serialx_version();
}

/** Get the last FFI error */
export function getLastError(): string {
  if (!ffiAvailable) return "FFI not available";
  return ffi.serialx_get_last_error();
}
