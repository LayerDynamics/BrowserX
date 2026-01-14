/**
 * V8 Isolate Management
 *
 * An Isolate is an independent instance of the V8 engine with its own heap.
 * Provides:
 * - Isolated heap for memory management
 * - Multiple execution contexts
 * - Resource isolation
 * - Garbage collection control
 */

import { type GCStats, GCType, HeapFactory, type HeapStats, V8Heap } from "./V8Heap.ts";
import {
    ContextFactory,
    type ExecutionResult,
    V8Context,
    type V8ContextConfig,
} from "./V8Context.ts";
import { type JSValue } from "./JSValue.ts";

/**
 * Isolate ID
 */
export type IsolateID = string & { __brand: "IsolateID" };

/**
 * Isolate configuration
 */
export interface V8IsolateConfig {
    heapSize?: {
        youngGeneration: number;
        oldGeneration: number;
    };
    maxContexts?: number;
    enableBackgroundGC?: boolean;
    gcInterval?: number;
}

/**
 * Isolate statistics
 */
export interface IsolateStats {
    id: IsolateID;
    contextCount: number;
    heapStats: HeapStats;
    gcStats: GCStats;
    uptime: number;
}

/**
 * Context info
 */
export interface ContextInfo {
    id: string;
    context: V8Context;
    createdAt: number;
}

/**
 * V8Isolate
 * Independent V8 engine instance with isolated heap
 */
export class V8Isolate {
    readonly id: IsolateID;
    private heap: V8Heap;
    private contexts: Map<string, ContextInfo> = new Map();
    private config: V8IsolateConfig;
    private createdAt: number;
    private gcTimer: number | null = null;
    private nextContextId = 0;
    private disposed = false;

    constructor(config: V8IsolateConfig = {}) {
        this.id = this.generateIsolateId();
        this.createdAt = performance.now();

        this.config = {
            heapSize: {
                youngGeneration: 16 * 1024 * 1024, // 16MB
                oldGeneration: 128 * 1024 * 1024, // 128MB
            },
            maxContexts: 10,
            enableBackgroundGC: true,
            gcInterval: 5000, // 5 seconds
            ...config,
        };

        // Create isolated heap
        this.heap = new V8Heap(
            this.config.heapSize!.youngGeneration,
            this.config.heapSize!.oldGeneration,
        );

        // Start background GC if enabled
        if (this.config.enableBackgroundGC) {
            this.startBackgroundGC();
        }
    }

    /**
     * Create execution context
     */
    createContext(contextConfig?: V8ContextConfig): V8Context {
        if (this.disposed) {
            throw new Error("Isolate has been disposed");
        }

        if (this.contexts.size >= this.config.maxContexts!) {
            throw new Error(`Maximum context limit reached: ${this.config.maxContexts}`);
        }

        // Create context with shared heap
        const context = new V8Context({
            heapSize: this.config.heapSize,
            ...contextConfig,
        });

        // Store context
        const contextId = this.generateContextId();
        this.contexts.set(contextId, {
            id: contextId,
            context,
            createdAt: performance.now(),
        });

        return context;
    }

    /**
     * Get context by ID
     */
    getContext(contextId: string): V8Context | null {
        const info = this.contexts.get(contextId);
        return info ? info.context : null;
    }

    /**
     * Get all contexts
     */
    getAllContexts(): V8Context[] {
        return Array.from(this.contexts.values()).map((info) => info.context);
    }

    /**
     * Dispose context
     */
    disposeContext(contextId: string): boolean {
        const info = this.contexts.get(contextId);
        if (!info) {
            return false;
        }

        info.context.dispose();
        this.contexts.delete(contextId);
        return true;
    }

    /**
     * Run garbage collection
     */
    collectGarbage(type?: GCType): void {
        if (this.disposed) {
            return;
        }

        if (type) {
            this.heap.forceGC(type);
        } else {
            this.heap.gc();
        }

        // Trigger GC in all contexts
        for (const info of this.contexts.values()) {
            info.context.gc();
        }
    }

    /**
     * Start background garbage collection
     */
    private startBackgroundGC(): void {
        if (this.gcTimer !== null) {
            return;
        }

        this.gcTimer = setInterval(() => {
            if (!this.disposed) {
                this.collectGarbage();
            }
        }, this.config.gcInterval!) as unknown as number;
    }

    /**
     * Stop background garbage collection
     */
    private stopBackgroundGC(): void {
        if (this.gcTimer !== null) {
            clearInterval(this.gcTimer);
            this.gcTimer = null;
        }
    }

    /**
     * Get isolate statistics
     */
    getStats(): IsolateStats {
        return {
            id: this.id,
            contextCount: this.contexts.size,
            heapStats: this.heap.getStats(),
            gcStats: this.heap.getGCStats(),
            uptime: performance.now() - this.createdAt,
        };
    }

    /**
     * Get heap
     */
    getHeap(): V8Heap {
        return this.heap;
    }

    /**
     * Get heap statistics
     */
    getHeapStatistics(): HeapStats {
        return this.heap.getStats();
    }

    /**
     * Get configuration
     */
    getConfig(): V8IsolateConfig {
        return { ...this.config };
    }

    /**
     * Get context count
     */
    getContextCount(): number {
        return this.contexts.size;
    }

    /**
     * Check if isolate is disposed
     */
    isDisposed(): boolean {
        return this.disposed;
    }

    /**
     * Get uptime in milliseconds
     */
    getUptime(): number {
        return performance.now() - this.createdAt;
    }

    /**
     * Execute code in new context
     * Creates a temporary context, executes code, and disposes the context
     */
    executeInNewContext(code: string): ExecutionResult {
        const context = this.createContext();
        try {
            return context.execute(code);
        } finally {
            const contextId = Array.from(this.contexts.entries())
                .find(([_, info]) => info.context === context)?.[0];
            if (contextId) {
                this.disposeContext(contextId);
            }
        }
    }

    /**
     * Dispose isolate
     * Cleans up all contexts and resources
     */
    dispose(): void {
        if (this.disposed) {
            return;
        }

        // Stop background GC
        this.stopBackgroundGC();

        // Dispose all contexts
        for (const info of this.contexts.values()) {
            info.context.dispose();
        }
        this.contexts.clear();

        // Dispose heap
        this.heap.dispose();

        this.disposed = true;
    }

    /**
     * Generate isolate ID
     */
    private generateIsolateId(): IsolateID {
        return `isolate-${Date.now()}-${Math.random().toString(36).substr(2, 9)}` as IsolateID;
    }

    /**
     * Generate context ID
     */
    private generateContextId(): string {
        return `context-${this.nextContextId++}`;
    }

    /**
     * Get isolate ID
     */
    getId(): IsolateID {
        return this.id;
    }
}

/**
 * Isolate factory
 * Creates isolate instances with different configurations
 */
export class IsolateFactory {
    /**
     * Create default isolate
     */
    static createDefault(): V8Isolate {
        return new V8Isolate();
    }

    /**
     * Create isolate for development
     */
    static createDevelopment(): V8Isolate {
        return new V8Isolate({
            heapSize: {
                youngGeneration: 8 * 1024 * 1024, // 8MB
                oldGeneration: 64 * 1024 * 1024, // 64MB
            },
            maxContexts: 5,
            enableBackgroundGC: true,
            gcInterval: 10000, // 10 seconds
        });
    }

    /**
     * Create isolate for production
     */
    static createProduction(): V8Isolate {
        return new V8Isolate({
            heapSize: {
                youngGeneration: 32 * 1024 * 1024, // 32MB
                oldGeneration: 256 * 1024 * 1024, // 256MB
            },
            maxContexts: 20,
            enableBackgroundGC: true,
            gcInterval: 3000, // 3 seconds
        });
    }

    /**
     * Create isolate for testing
     */
    static createForTesting(): V8Isolate {
        return new V8Isolate({
            heapSize: {
                youngGeneration: 1 * 1024 * 1024, // 1MB
                oldGeneration: 8 * 1024 * 1024, // 8MB
            },
            maxContexts: 3,
            enableBackgroundGC: false,
        });
    }

    /**
     * Create isolate with custom configuration
     */
    static createWithConfig(config: V8IsolateConfig): V8Isolate {
        return new V8Isolate(config);
    }
}

/**
 * Isolate manager
 * Manages multiple isolates
 */
export class IsolateManager {
    private static instance: IsolateManager | null = null;
    private isolates: Map<IsolateID, V8Isolate> = new Map();

    private constructor() {}

    /**
     * Get singleton instance
     */
    static getInstance(): IsolateManager {
        if (!IsolateManager.instance) {
            IsolateManager.instance = new IsolateManager();
        }
        return IsolateManager.instance;
    }

    /**
     * Create isolate
     */
    createIsolate(config?: V8IsolateConfig): V8Isolate {
        const isolate = new V8Isolate(config);
        this.isolates.set(isolate.getId(), isolate);
        return isolate;
    }

    /**
     * Get isolate by ID
     */
    getIsolate(id: IsolateID): V8Isolate | null {
        return this.isolates.get(id) || null;
    }

    /**
     * Get all isolates
     */
    getAllIsolates(): V8Isolate[] {
        return Array.from(this.isolates.values());
    }

    /**
     * Dispose isolate
     */
    disposeIsolate(id: IsolateID): boolean {
        const isolate = this.isolates.get(id);
        if (!isolate) {
            return false;
        }

        isolate.dispose();
        this.isolates.delete(id);
        return true;
    }

    /**
     * Dispose all isolates
     */
    disposeAll(): void {
        for (const isolate of this.isolates.values()) {
            isolate.dispose();
        }
        this.isolates.clear();
    }

    /**
     * Get isolate count
     */
    getIsolateCount(): number {
        return this.isolates.size;
    }

    /**
     * Get total statistics for all isolates
     */
    getTotalStats() {
        const stats = {
            isolateCount: this.isolates.size,
            totalContexts: 0,
            totalHeapSize: 0,
            totalObjects: 0,
        };

        for (const isolate of this.isolates.values()) {
            const isolateStats = isolate.getStats();
            stats.totalContexts += isolateStats.contextCount;
            stats.totalHeapSize += isolateStats.heapStats.totalSize;
            stats.totalObjects += isolateStats.heapStats.objectCount;
        }

        return stats;
    }
}
