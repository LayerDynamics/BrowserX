/**
 * Memory Domain Types
 *
 * Types for heap inspection, memory sampling, garbage collection,
 * and DOM counter reporting. Maps closely to the Chrome DevTools
 * Protocol Memory domain.
 */

import type { V8HeapStatistics } from "../../../browser/src/types/javascript.ts";

// ---- Heap Snapshot ----

/**
 * A chunk of a serialized heap snapshot
 */
export interface HeapSnapshotChunk {
    /** Serialized snapshot data chunk (JSON fragment) */
    chunk: string;
}

// ---- Sampling Profile ----

/**
 * A node in the sampling heap profile tree
 */
export interface SamplingHeapProfileNode {
    /** Call frame information */
    callFrame: {
        /** Function name */
        functionName: string;
        /** Script identifier */
        scriptId: string;
        /** Script URL */
        url: string;
        /** Line number (0-based) */
        lineNumber: number;
        /** Column number (0-based) */
        columnNumber: number;
    };
    /** Size of memory directly allocated by this node (bytes) */
    selfSize: number;
    /** Unique node ID */
    id: number;
    /** Child nodes */
    children: SamplingHeapProfileNode[];
}

/**
 * A sampling heap profile
 */
export interface SamplingProfile {
    /** Root node of the allocation profile tree */
    head: SamplingHeapProfileNode;
}

// ---- Heap Statistics ----

/**
 * V8 heap statistics description for protocol transport
 */
export interface HeapStatistics {
    /** Total heap size (bytes) */
    totalHeapSize: number;
    /** Used heap size (bytes) */
    usedHeapSize: number;
    /** Heap size limit (bytes) */
    heapSizeLimit: number;
    /** Total physical memory allocated (bytes) */
    totalPhysicalSize: number;
    /** Total available heap size (bytes) */
    totalAvailableSize: number;
    /** Memory allocated via malloc (bytes) */
    mallocedMemory: number;
    /** Peak memory allocated via malloc (bytes) */
    peakMallocedMemory: number;
    /** External memory used by V8 (bytes) */
    externalMemory: number;
}

/**
 * Result of getHeapStats method
 */
export interface GetHeapStatsResult {
    /** V8 heap statistics */
    stats: HeapStatistics;
}

// ---- Heap Snapshot Parameters ----

/**
 * Parameters for takeHeapSnapshot method
 */
export interface TakeHeapSnapshotParams {
    /** Whether to report progress via events */
    reportProgress?: boolean;
}

// ---- Sampling Parameters ----

/**
 * Parameters for startSampling method
 */
export interface StartSamplingParams {
    /** Average sample interval in bytes (default: 32768) */
    samplingInterval?: number;
}

// ---- Allocation Profile ----

/**
 * Result of getAllocationProfile method
 */
export interface GetAllocationProfileResult {
    /** The collected allocation profile */
    profile: SamplingProfile;
}

// ---- Garbage Collection ----

/**
 * Result of forceGarbageCollection method (empty on success)
 */
export type ForceGarbageCollectionResult = Record<string, never>;

// ---- DOM Counters ----

/**
 * Result of getDOMCounters method
 */
export interface GetDOMCountersResult {
    /** Number of documents (frames/iframes) */
    documents: number;
    /** Total number of DOM nodes */
    nodes: number;
    /** Number of JavaScript event listeners */
    jsEventListeners: number;
}

// ---- Re-exports for convenience ----

export type { V8HeapStatistics };
