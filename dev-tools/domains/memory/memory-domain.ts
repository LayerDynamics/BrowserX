/**
 * Memory Domain Agent
 *
 * Provides heap inspection, memory sampling, garbage collection control,
 * and DOM counter reporting. Hooks into the RenderingPipeline and V8
 * subsystems for memory data. Supports heap snapshot streaming and
 * allocation sampling profiles.
 */

import type { DomainName } from "../../protocol/types.ts";
import { BaseDomain } from "../base-domain.ts";
import type {
    HeapStatistics,
    GetHeapStatsResult,
    TakeHeapSnapshotParams,
    HeapSnapshotChunk,
    StartSamplingParams,
    SamplingHeapProfileNode,
    SamplingProfile,
    GetAllocationProfileResult,
    ForceGarbageCollectionResult,
    GetDOMCountersResult,
    V8HeapStatistics,
} from "./memory-types.ts";

/**
 * Internal sampling data entry
 */
interface SamplingEntry {
    /** Timestamp of the sample */
    timestamp: number;
    /** Function or location label */
    label: string;
    /** Size in bytes */
    size: number;
    /** Source URL */
    url: string;
}

/**
 * Memory Domain - heap inspection and memory profiling
 */
/** Maximum number of sampling entries to retain (rolling window) */
const MAX_SAMPLING_ENTRIES = 1000;

export class MemoryDomain extends BaseDomain {
    readonly name: DomainName = "Memory";

    /** Whether heap allocation sampling is active */
    private sampling: boolean = false;

    /** Sampling interval in bytes */
    private samplingInterval: number = 32768;

    /** Collected sampling data */
    private samplingData: SamplingEntry[] = [];

    /** Sampling timer for periodic collection */
    private samplingTimer: ReturnType<typeof setInterval> | null = null;

    protected setup(): void {
        this.registerMethod("getHeapStats", "Get V8 heap statistics", async (params) => {
            return await this.getHeapStats(params as unknown as Record<string, unknown>);
        });

        this.registerMethod("takeHeapSnapshot", "Take a heap snapshot and stream chunks", async (params) => {
            return await this.takeHeapSnapshot(params as unknown as TakeHeapSnapshotParams);
        });

        this.registerMethod("startSampling", "Start heap allocation sampling", async (params) => {
            return await this.startSampling(params as unknown as StartSamplingParams);
        });

        this.registerMethod("stopSampling", "Stop heap allocation sampling", async () => {
            return await this.stopSampling();
        });

        this.registerMethod("getAllocationProfile", "Get sampled allocation profile", async (params) => {
            return await this.getAllocationProfile(params as unknown as Record<string, unknown>);
        });

        this.registerMethod("forceGarbageCollection", "Force garbage collection", async (params) => {
            return await this.forceGarbageCollection(params as unknown as Record<string, unknown>);
        });

        this.registerMethod("getDOMCounters", "Get DOM node and event listener counts", async (params) => {
            return await this.getDOMCounters(params as unknown as Record<string, unknown>);
        });

        // Register events
        this.registerEvent("heapStatsUpdate", "Periodic heap statistics update");
        this.registerEvent("addHeapSnapshotChunk", "Heap snapshot data chunk");
    }

    override async enable(): Promise<Record<string, unknown>> {
        await super.enable();
        return {};
    }

    override async disable(): Promise<Record<string, unknown>> {
        // Stop sampling if active
        if (this.sampling) {
            this.stopSamplingTimer();
            this.sampling = false;
        }

        await super.disable();
        return {};
    }

    /**
     * Try to extract V8 heap statistics from the browser subsystems
     */
    private getV8HeapStats(): V8HeapStatistics | null {
        try {
            // Attempt to access V8 heap statistics through the rendering pipeline
            const lastResult = this.context.renderingPipeline.lastRenderResult;
            if (lastResult && lastResult.scriptExecutor) {
                const executor = lastResult.scriptExecutor as unknown as {
                    getHeapStatistics?: () => V8HeapStatistics;
                };
                if (typeof executor.getHeapStatistics === "function") {
                    return executor.getHeapStatistics();
                }
            }
        } catch {
            // V8 heap stats not available
        }
        return null;
    }

    /**
     * Build heap statistics from available data sources
     */
    private buildHeapStatistics(): HeapStatistics {
        // Try to get real V8 heap statistics
        const v8Stats = this.getV8HeapStats();
        if (v8Stats) {
            return {
                totalHeapSize: v8Stats.totalHeapSize,
                usedHeapSize: v8Stats.usedHeapSize,
                heapSizeLimit: v8Stats.heapSizeLimit,
                totalPhysicalSize: v8Stats.totalPhysicalSize,
                totalAvailableSize: v8Stats.totalAvailableSize,
                mallocedMemory: v8Stats.mallocedMemory,
                peakMallocedMemory: v8Stats.peakMallocedMemory,
                externalMemory: 0,
            };
        }

        // Fall back to estimates based on rendering pipeline resource data.
        // NOTE: These are rough estimates, not real V8 heap data.
        const stats = this.context.renderingPipeline.getStats();
        const totalResourceSize = stats.resources.totalSize;

        // Estimated heap usage based on resource sizes with typical expansion factors
        const estimatedUsedHeap = totalResourceSize * 3;
        const estimatedTotalHeap = totalResourceSize * 5;
        const heapSizeLimit = 2147483648; // 2GB default

        return {
            totalHeapSize: estimatedTotalHeap,
            usedHeapSize: estimatedUsedHeap,
            heapSizeLimit,
            totalPhysicalSize: estimatedTotalHeap,
            totalAvailableSize: heapSizeLimit - estimatedTotalHeap,
            mallocedMemory: Math.round(estimatedUsedHeap * 0.1),
            peakMallocedMemory: Math.round(estimatedUsedHeap * 0.15),
            externalMemory: 0,
        };
    }

    /**
     * Count DOM nodes recursively in the rendered DOM tree
     */
    private countDOMNodes(node: { childNodes?: { length: number } & Iterable<unknown> }): number {
        let count = 1;
        if (node.childNodes && node.childNodes.length > 0) {
            for (const child of node.childNodes) {
                count += this.countDOMNodes(child as { childNodes?: { length: number } & Iterable<unknown> });
            }
        }
        return count;
    }

    /**
     * Count document nodes (nodeType === 9) in the DOM tree
     */
    private countDocuments(node: { nodeType?: number; childNodes?: { length: number } & Iterable<unknown> }): number {
        let count = 0;
        if (node.nodeType === 9) {
            count = 1;
        }
        if (node.childNodes && node.childNodes.length > 0) {
            for (const child of node.childNodes) {
                count += this.countDocuments(child as { nodeType?: number; childNodes?: { length: number } & Iterable<unknown> });
            }
        }
        return count;
    }

    /**
     * Start the sampling timer for periodic data collection
     */
    private startSamplingTimer(): void {
        // Collect samples periodically (every 100ms)
        this.samplingTimer = setInterval(() => {
            if (this.sampling) {
                this.collectSample();
            }
        }, 100);
    }

    /**
     * Stop the sampling timer
     */
    private stopSamplingTimer(): void {
        if (this.samplingTimer !== null) {
            clearInterval(this.samplingTimer);
            this.samplingTimer = null;
        }
    }

    /**
     * Collect a single sampling data point
     */
    private collectSample(): void {
        const stats = this.buildHeapStatistics();
        const lastResult = this.context.renderingPipeline.lastRenderResult;
        const url = this.context.browser.getCurrentURL() || "about:blank";

        // Record an entry reflecting current state
        this.samplingData.push({
            timestamp: Date.now(),
            label: "(heap)",
            size: stats.usedHeapSize,
            url,
        });

        // Record resource-related allocations if available
        if (lastResult) {
            for (const resource of lastResult.resources) {
                if (resource.size >= this.samplingInterval) {
                    this.samplingData.push({
                        timestamp: Date.now(),
                        label: `load:${resource.type}`,
                        size: resource.size,
                        url: resource.url,
                    });
                }
            }
        }

        // Enforce rolling window cap
        if (this.samplingData.length > MAX_SAMPLING_ENTRIES) {
            this.samplingData = this.samplingData.slice(-MAX_SAMPLING_ENTRIES);
        }

        // Emit heap stats update event
        if (this.enabled) {
            this.emitEvent("heapStatsUpdate", {
                statsUpdate: [
                    stats.totalHeapSize,
                    stats.usedHeapSize,
                    stats.heapSizeLimit,
                ],
                timestamp: Date.now() / 1000,
            });
        }
    }

    /**
     * Build a SamplingProfile from collected sampling data
     */
    private buildSamplingProfile(): SamplingProfile {
        let nodeId = 1;

        // Root node
        const root: SamplingHeapProfileNode = {
            callFrame: {
                functionName: "(root)",
                scriptId: "0",
                url: "",
                lineNumber: 0,
                columnNumber: 0,
            },
            selfSize: 0,
            id: nodeId++,
            children: [],
        };

        // Group sampling data by label
        const groupedByLabel = new Map<string, { totalSize: number; url: string; count: number }>();
        for (const entry of this.samplingData) {
            const existing = groupedByLabel.get(entry.label);
            if (existing) {
                existing.totalSize += entry.size;
                existing.count++;
            } else {
                groupedByLabel.set(entry.label, {
                    totalSize: entry.size,
                    url: entry.url,
                    count: 1,
                });
            }
        }

        // Create child nodes for each group
        for (const [label, data] of groupedByLabel) {
            const childNode: SamplingHeapProfileNode = {
                callFrame: {
                    functionName: label,
                    scriptId: String(nodeId),
                    url: data.url,
                    lineNumber: 0,
                    columnNumber: 0,
                },
                selfSize: Math.round(data.totalSize / data.count), // Average size per sample
                id: nodeId++,
                children: [],
            };
            root.children.push(childNode);
        }

        // If no data was collected, add a placeholder
        if (root.children.length === 0) {
            root.children.push({
                callFrame: {
                    functionName: "(idle)",
                    scriptId: "1",
                    url: "",
                    lineNumber: 0,
                    columnNumber: 0,
                },
                selfSize: 0,
                id: nodeId++,
                children: [],
            });
        }

        return { head: root };
    }

    // ---- Method implementations ----

    private async getHeapStats(_params: Record<string, unknown>): Promise<GetHeapStatsResult> {
        const stats = this.buildHeapStatistics();
        return { stats };
    }

    private async takeHeapSnapshot(params: TakeHeapSnapshotParams): Promise<Record<string, unknown>> {
        const reportProgress = params.reportProgress ?? false;

        // Build a simulated heap snapshot representing current browser state
        const stats = this.buildHeapStatistics();
        const lastResult = this.context.renderingPipeline.lastRenderResult;
        const currentUrl = this.context.browser.getCurrentURL() || "about:blank";

        const snapshot: Record<string, unknown> = {
            snapshot: {
                title: `Heap Snapshot - ${currentUrl}`,
                uid: Date.now(),
                meta: {
                    node_fields: ["type", "name", "id", "self_size", "edge_count", "trace_node_id"],
                    edge_fields: ["type", "name_or_index", "to_node"],
                    node_types: [["hidden", "object", "closure", "string", "code", "synthetic", "native"]],
                    edge_types: [["context", "element", "property", "internal", "hidden", "shortcut", "weak"]],
                },
            },
            nodes: [] as number[],
            edges: [] as number[],
            strings: ["(root)", "(GC roots)", "(compiled code)"],
        };

        // Add DOM-related data if available
        if (lastResult) {
            const domNodeCount = this.countDOMNodes(lastResult.dom);
            (snapshot as Record<string, unknown>).domInfo = {
                nodeCount: domNodeCount,
                cssRuleCount: lastResult.cssom.getRuleCount(),
            };
        }

        // Add heap statistics
        (snapshot as Record<string, unknown>).heapStats = {
            totalHeapSize: stats.totalHeapSize,
            usedHeapSize: stats.usedHeapSize,
            heapSizeLimit: stats.heapSizeLimit,
        };

        // Serialize and stream as chunks
        const serialized = JSON.stringify(snapshot);
        const chunkSize = 65536; // 64KB chunks
        const totalChunks = Math.ceil(serialized.length / chunkSize);

        for (let i = 0; i < totalChunks; i++) {
            const start = i * chunkSize;
            const end = Math.min(start + chunkSize, serialized.length);
            const chunkData: HeapSnapshotChunk = {
                chunk: serialized.substring(start, end),
            };

            if (this.enabled) {
                this.emitEvent("addHeapSnapshotChunk", chunkData as unknown as Record<string, unknown>);
            }

            if (reportProgress && this.enabled) {
                this.emitEvent("reportHeapSnapshotProgress", {
                    done: Math.min(end, serialized.length),
                    total: serialized.length,
                    finished: end >= serialized.length,
                } as unknown as Record<string, unknown>);
            }
        }

        return { complete: true, totalChunks };
    }

    private async startSampling(params: StartSamplingParams): Promise<Record<string, unknown>> {
        if (this.sampling) {
            return { error: "Sampling already in progress" };
        }

        this.samplingInterval = params.samplingInterval ?? 32768;
        this.sampling = true;
        this.samplingData = [];

        // Start periodic sampling
        this.startSamplingTimer();

        // Collect initial sample immediately
        this.collectSample();

        return {};
    }

    private async stopSampling(): Promise<Record<string, unknown>> {
        if (!this.sampling) {
            return {};
        }

        this.stopSamplingTimer();
        this.sampling = false;

        // Return the collected profile
        const profile = this.buildSamplingProfile();
        return { profile } as unknown as Record<string, unknown>;
    }

    private async getAllocationProfile(_params: Record<string, unknown>): Promise<GetAllocationProfileResult> {
        const profile = this.buildSamplingProfile();
        return { profile };
    }

    private async forceGarbageCollection(_params: Record<string, unknown>): Promise<ForceGarbageCollectionResult> {
        // Attempt to trigger garbage collection if available
        try {
            // In Deno/V8, gc() may be available with --v8-flags=--expose-gc
            const globalObj = globalThis as unknown as { gc?: () => void };
            if (typeof globalObj.gc === "function") {
                globalObj.gc();
            }
        } catch {
            // GC not exposed - this is expected in most environments
        }

        // Clear internal caches to free memory
        this.context.renderingPipeline.clearCache();

        return {} as ForceGarbageCollectionResult;
    }

    private async getDOMCounters(_params: Record<string, unknown>): Promise<GetDOMCountersResult> {
        const lastResult = this.context.renderingPipeline.lastRenderResult;

        if (!lastResult) {
            return {
                documents: 0,
                nodes: 0,
                jsEventListeners: 0,
            };
        }

        const dom = lastResult.dom;
        const nodeCount = this.countDOMNodes(dom);
        const documentCount = this.countDocuments(dom);

        // Estimate event listeners from script executor if available
        let jsEventListeners = 0;
        if (lastResult.scriptExecutor) {
            const executor = lastResult.scriptExecutor as unknown as {
                getEventListenerCount?: () => number;
            };
            if (typeof executor.getEventListenerCount === "function") {
                jsEventListeners = executor.getEventListenerCount();
            }
        }

        return {
            documents: Math.max(1, documentCount), // At least 1 document
            nodes: nodeCount,
            jsEventListeners,
        };
    }

    override dispose(): void {
        this.stopSamplingTimer();
        this.sampling = false;
        this.samplingData = [];
        super.dispose();
    }
}
