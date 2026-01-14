// ============================================================================
// PROCESS TYPES
// ============================================================================

import type { ByteCount, Percentage, ProcessID, Timestamp } from "./identifiers.ts";

/**
 * Process type
 */
export enum ProcessType {
    BROWSER = "BROWSER",
    RENDERER = "RENDERER",
    GPU = "GPU",
    NETWORK = "NETWORK",
    PLUGIN = "PLUGIN",
}

/**
 * Process info
 */
export interface ProcessInfo {
    id: ProcessID;
    type: ProcessType;
    pid: number; // OS process ID
    createdAt: Timestamp;
    memoryUsage: ByteCount;
    cpuUsage: Percentage;
}

/**
 * IPC message
 */
export interface IPCMessage {
    id: string;
    source: ProcessID;
    destination: ProcessID;
    type: string;
    payload: unknown;
    timestamp: Timestamp;
}

/**
 * Shared memory region
 */
export interface SharedMemoryRegion {
    id: string;
    size: ByteCount;
    buffer: SharedArrayBuffer;

    /**
     * Map to process address space
     */
    map(): Uint8Array;

    /**
     * Unmap from address space
     */
    unmap(): void;
}
