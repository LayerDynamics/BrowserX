/**
 * Serial Port Device Layer
 *
 * Provides browser-level serial port access backed by the serialx Rust FFI crate.
 * Gracefully degrades when FFI is unavailable (headless/test environments).
 */

import { loadSerialx, isSerialxLoaded, getSerialxModule } from "./serialx-loader.ts";

/** Serial port information */
export interface SerialPortInfo {
  name: string;
  portType: string;
  vid: number | null;
  pid: number | null;
  manufacturer: string | null;
  product: string | null;
  serialNumber: string | null;
}

/** Serial device configuration options */
export interface SerialDeviceOptions {
  baudRate?: number;
  dataBits?: 5 | 6 | 7 | 8;
  stopBits?: 1 | 2;
  parity?: "none" | "odd" | "even";
  flowControl?: "none" | "software" | "hardware";
  timeoutMs?: number;
}

/**
 * Serial device abstraction wrapping serialx FFI
 */
export class SerialDevice {
  // deno-lint-ignore no-explicit-any
  private port: any = null;
  private portName: string = "";
  private _isOpen: boolean = false;

  /** Check if serial port support is available on this platform */
  static async isAvailable(): Promise<boolean> {
    const mod = await loadSerialx();
    if (!mod) return false;
    return mod.SerialPort.isAvailable();
  }

  /** Synchronous availability check (uses cached state) */
  static isAvailableSync(): boolean {
    if (!isSerialxLoaded()) return false;
    const mod = getSerialxModule();
    if (!mod) return false;
    return mod.SerialPort.isAvailable();
  }

  /** List all available serial ports */
  static async listPorts(): Promise<SerialPortInfo[]> {
    const mod = await loadSerialx();
    if (!mod) return [];
    return mod.SerialPort.listPorts().map((p) => ({
      name: p.name,
      portType: p.port_type,
      vid: p.vid,
      pid: p.pid,
      manufacturer: p.manufacturer,
      product: p.product,
      serialNumber: p.serial_number,
    }));
  }

  /** Open a serial port connection */
  async open(portName: string, options: SerialDeviceOptions = {}): Promise<boolean> {
    const mod = await loadSerialx();
    if (!mod) {
      throw new Error("Serial port support is not available on this platform");
    }

    this.port = new mod.SerialPort();
    const baudRate = options.baudRate ?? 9600;
    const opened = this.port.open(portName, baudRate);

    if (opened && options) {
      const config: Record<string, unknown> = {};
      if (options.dataBits !== undefined) config.data_bits = options.dataBits;
      if (options.stopBits !== undefined) config.stop_bits = options.stopBits;
      if (options.parity !== undefined) config.parity = options.parity;
      if (options.flowControl !== undefined) config.flow_control = options.flowControl;
      if (options.timeoutMs !== undefined) config.timeout_ms = options.timeoutMs;

      if (Object.keys(config).length > 0) {
        this.port.configure(config);
      }
    }

    this._isOpen = opened;
    this.portName = portName;
    return opened;
  }

  /** Close the serial port connection */
  close(): boolean {
    if (!this.port) return false;
    const result = this.port.close();
    this._isOpen = false;
    this.port = null;
    return result;
  }

  /** Configure port parameters */
  configure(options: SerialDeviceOptions): boolean {
    if (!this.port || !this._isOpen) return false;
    const config: Record<string, unknown> = {};
    if (options.dataBits !== undefined) config.data_bits = options.dataBits;
    if (options.stopBits !== undefined) config.stop_bits = options.stopBits;
    if (options.parity !== undefined) config.parity = options.parity;
    if (options.flowControl !== undefined) config.flow_control = options.flowControl;
    if (options.timeoutMs !== undefined) config.timeout_ms = options.timeoutMs;
    return this.port.configure(config);
  }

  /** Write data to the serial port */
  write(data: Uint8Array): number {
    if (!this.port || !this._isOpen) return -1;
    return this.port.write(data);
  }

  /** Read data from the serial port */
  read(maxLen: number = 1024, timeoutMs: number = 1000): Uint8Array {
    if (!this.port || !this._isOpen) return new Uint8Array(0);
    return this.port.read(maxLen, timeoutMs);
  }

  /** Flush pending data */
  flush(): boolean {
    if (!this.port || !this._isOpen) return false;
    return this.port.flush();
  }

  /** Get bytes available for reading */
  bytesAvailable(): number {
    if (!this.port || !this._isOpen) return -1;
    return this.port.bytesAvailable();
  }

  /** Check if the port is currently open */
  get isOpen(): boolean {
    return this._isOpen;
  }

  /** Get the port name */
  get name(): string {
    return this.portName;
  }

  /** Get the underlying serialx port (for EscPos usage) */
  get rawPort(): unknown {
    return this.port;
  }
}
