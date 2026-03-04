/**
 * Serial Domain
 *
 * Chrome DevTools Protocol domain for serial device inspection and debugging.
 * Provides methods for listing ports, opening/closing connections,
 * reading/writing data, and monitoring serial traffic.
 */

import type { DomainName } from "../../protocol/types.ts";
import { BaseDomain } from "../base-domain.ts";

// deno-lint-ignore no-explicit-any
type SerialDeviceRef = any;

interface OpenPortEntry {
    portName: string;
    baudRate: number;
    openedAt: number;
    device: SerialDeviceRef;
}

/**
 * Serial domain for DevTools serial device debugging
 */
export class SerialDomain extends BaseDomain {
    readonly name: DomainName = "Serial";

    /** Tracked open ports by device ID — stores actual device references */
    private openPorts: Map<string, OpenPortEntry> = new Map();

    protected setup(): void {
        this.registerMethod(
            "getPorts",
            "List all available serial ports",
            async () => {
                if (!this.enabled) return { ports: [] };
                try {
                    const { SerialDevice } = await import(
                        "../../../browser/src/os/devices/Serial.ts"
                    );
                    const ports = await SerialDevice.listPorts();
                    return { ports };
                } catch {
                    return { ports: [] };
                }
            },
        );

        this.registerMethod(
            "openPort",
            "Open a serial port connection",
            async (params: Record<string, unknown>) => {
                if (!this.enabled) return { success: false, error: "Domain not enabled" };
                const portName = params.portName as string;
                const baudRate = (params.baudRate as number) ?? 9600;
                if (!portName) return { success: false, error: "portName required" };

                try {
                    const { SerialDevice } = await import(
                        "../../../browser/src/os/devices/Serial.ts"
                    );
                    const device = new SerialDevice();
                    const opened = await device.open(portName, { baudRate });

                    if (opened) {
                        const deviceId = `serial-${Date.now()}`;
                        this.openPorts.set(deviceId, {
                            portName,
                            baudRate,
                            openedAt: Date.now(),
                            device,
                        });
                        this.emitEvent("portConnected", { deviceId, portName, baudRate });
                        return { success: true, deviceId };
                    }
                    return { success: false, error: "Failed to open port" };
                } catch (e) {
                    return { success: false, error: String(e) };
                }
            },
        );

        this.registerMethod(
            "closePort",
            "Close a serial port connection",
            async (params: Record<string, unknown>) => {
                if (!this.enabled) return { success: false, error: "Domain not enabled" };
                const deviceId = params.deviceId as string;
                if (!deviceId) return { success: false, error: "deviceId required" };

                const entry = this.openPorts.get(deviceId);
                if (entry) {
                    entry.device.close();
                    this.openPorts.delete(deviceId);
                    this.emitEvent("portDisconnected", {
                        deviceId,
                        portName: entry.portName,
                    });
                    return { success: true };
                }
                return { success: false, error: `Device ${deviceId} not found` };
            },
        );

        this.registerMethod(
            "writeData",
            "Write data to an open serial port",
            async (params: Record<string, unknown>) => {
                if (!this.enabled) return { success: false, error: "Domain not enabled" };
                const deviceId = params.deviceId as string;
                const data = params.data as string;
                if (!deviceId || !data) {
                    return { success: false, error: "deviceId and data required" };
                }

                const entry = this.openPorts.get(deviceId);
                if (!entry) {
                    return { success: false, error: `Device ${deviceId} not found` };
                }

                const bytes = new TextEncoder().encode(data);
                const written = entry.device.write(bytes);

                this.emitEvent("dataSent", {
                    deviceId,
                    length: written >= 0 ? written : 0,
                    preview: data.substring(0, 64),
                });
                return { success: written >= 0, bytesWritten: written >= 0 ? written : 0 };
            },
        );

        this.registerMethod(
            "readData",
            "Read data from an open serial port",
            async (params: Record<string, unknown>) => {
                if (!this.enabled) return { success: false, error: "Domain not enabled" };
                const deviceId = params.deviceId as string;
                const maxLen = (params.maxLen as number) ?? 1024;
                const timeoutMs = (params.timeoutMs as number) ?? 1000;
                if (!deviceId) return { success: false, error: "deviceId required" };

                const entry = this.openPorts.get(deviceId);
                if (!entry) {
                    return { success: false, error: `Device ${deviceId} not found` };
                }

                const bytes = entry.device.read(maxLen, timeoutMs);
                const data = new TextDecoder().decode(bytes);

                this.emitEvent("dataReceived", {
                    deviceId,
                    length: bytes.length,
                    preview: data.substring(0, 64),
                });
                return { success: true, data, length: bytes.length };
            },
        );

        this.registerMethod(
            "getTraceLog",
            "Get the serial communication trace log",
            async () => {
                if (!this.enabled) return { log: [] };
                try {
                    const serialx = await import("@browserx/serialx");
                    const log = serialx.SerialTrace.getLog();
                    return { log };
                } catch {
                    return { log: [] };
                }
            },
        );

        this.registerMethod(
            "clearTraceLog",
            "Clear the serial communication trace log",
            async () => {
                if (!this.enabled) return {};
                try {
                    const serialx = await import("@browserx/serialx");
                    serialx.SerialTrace.clear();
                } catch {
                    // serialx not available
                }
                return {};
            },
        );

        // Register events
        this.registerEvent("portConnected", "Fired when a serial port is connected");
        this.registerEvent("portDisconnected", "Fired when a serial port is disconnected");
        this.registerEvent("dataReceived", "Fired when data is received on a serial port");
        this.registerEvent("dataSent", "Fired when data is sent on a serial port");
    }

    async enable(): Promise<Record<string, unknown>> {
        await super.enable();
        return {};
    }

    async disable(): Promise<Record<string, unknown>> {
        // Close all open ports on disable
        for (const [deviceId, entry] of this.openPorts) {
            try {
                entry.device.close();
            } catch {
                // Best-effort cleanup
            }
            this.emitEvent("portDisconnected", { deviceId, portName: entry.portName });
        }
        this.openPorts.clear();
        await super.disable();
        return {};
    }

    dispose(): void {
        for (const entry of this.openPorts.values()) {
            try {
                entry.device.close();
            } catch {
                // Best-effort cleanup
            }
        }
        this.openPorts.clear();
    }
}
