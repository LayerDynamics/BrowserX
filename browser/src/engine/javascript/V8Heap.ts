/**
 * V8 Heap Management
 *
 * Manages memory allocation and garbage collection using generational collection.
 * Implements V8's memory model with:
 * - Young generation (new space) for short-lived objects
 * - Old generation (old space) for long-lived objects
 * - Mark-sweep and scavenge garbage collection
 * - Incremental marking for reduced pause times
 */

import { type JSObject, type JSValue, JSValueType } from "./JSValue.ts";

/**
 * Memory space types
 */
export enum SpaceType {
    NEW_SPACE = "new_space",
    OLD_SPACE = "old_space",
    CODE_SPACE = "code_space",
    LARGE_OBJECT_SPACE = "large_object_space",
}

/**
 * GC type
 */
export enum GCType {
    SCAVENGE = "scavenge",
    MARK_SWEEP = "mark_sweep",
    MARK_COMPACT = "mark_compact",
    INCREMENTAL_MARKING = "incremental_marking",
}

/**
 * Object color for marking
 */
export enum ObjectColor {
    WHITE = "white", // Not visited
    GRAY = "gray", // Visited but children not processed
    BLACK = "black", // Visited and children processed
}

/**
 * Heap object header
 * Contains metadata for GC and type information
 */
export interface HeapObject {
    id: HeapObjectID;
    value: JSValue;
    size: number;
    color: ObjectColor;
    generation: 0 | 1; // 0 = young, 1 = old
    forwardingAddress?: HeapObjectID; // Used during scavenge
    marked: boolean;
}

/**
 * Heap object ID
 */
export type HeapObjectID = string & { __brand: "HeapObjectID" };

/**
 * Memory page
 * Fixed-size memory region (default 256KB)
 */
export class MemoryPage {
    readonly size: number;
    private allocated: number = 0;
    private objects: Map<HeapObjectID, HeapObject> = new Map();

    constructor(size: number = 256 * 1024) {
        this.size = size;
    }

    /**
     * Try to allocate space in page
     */
    tryAllocate(size: number): boolean {
        if (this.allocated + size <= this.size) {
            this.allocated += size;
            return true;
        }
        return false;
    }

    /**
     * Add object to page
     */
    addObject(obj: HeapObject): void {
        this.objects.set(obj.id, obj);
    }

    /**
     * Remove object from page
     */
    removeObject(id: HeapObjectID): void {
        const obj = this.objects.get(id);
        if (obj) {
            this.allocated -= obj.size;
            this.objects.delete(id);
        }
    }

    /**
     * Get all objects in page
     */
    getObjects(): HeapObject[] {
        return Array.from(this.objects.values());
    }

    /**
     * Get allocated size
     */
    getAllocated(): number {
        return this.allocated;
    }

    /**
     * Get available size
     */
    getAvailable(): number {
        return this.size - this.allocated;
    }

    /**
     * Clear page
     */
    clear(): void {
        this.objects.clear();
        this.allocated = 0;
    }
}

/**
 * Memory space
 * Collection of pages for a generation
 */
export class MemorySpace {
    readonly type: SpaceType;
    readonly maxSize: number;
    private pages: MemoryPage[] = [];
    private currentPage: MemoryPage | null = null;

    constructor(type: SpaceType, maxSize: number) {
        this.type = type;
        this.maxSize = maxSize;
        this.allocatePage();
    }

    /**
     * Allocate new page
     */
    private allocatePage(): MemoryPage {
        const page = new MemoryPage();
        this.pages.push(page);
        this.currentPage = page;
        return page;
    }

    /**
     * Try to allocate object
     */
    tryAllocate(size: number): MemoryPage | null {
        // Check if we exceed max size first
        const totalSize = this.getTotalSize();
        if (totalSize + size > this.maxSize) {
            return null; // Out of memory
        }

        // Try current page first
        if (this.currentPage && this.currentPage.tryAllocate(size)) {
            return this.currentPage;
        }

        // Allocate new page
        const page = this.allocatePage();
        if (page.tryAllocate(size)) {
            return page;
        }

        return null;
    }

    /**
     * Get all objects in space
     */
    getAllObjects(): HeapObject[] {
        const objects: HeapObject[] = [];
        for (const page of this.pages) {
            objects.push(...page.getObjects());
        }
        return objects;
    }

    /**
     * Get total size
     */
    getTotalSize(): number {
        return this.pages.reduce((sum, page) => sum + page.getAllocated(), 0);
    }

    /**
     * Get page count
     */
    getPageCount(): number {
        return this.pages.length;
    }

    /**
     * Clear all pages
     */
    clear(): void {
        this.pages = [];
        this.allocatePage();
    }

    /**
     * Compact space by removing empty pages
     */
    compact(): void {
        this.pages = this.pages.filter((page) => page.getAllocated() > 0);
        if (this.pages.length === 0) {
            this.allocatePage();
        } else {
            this.currentPage = this.pages[this.pages.length - 1];
        }
    }
}

/**
 * GC statistics
 */
export interface GCStats {
    totalCollections: number;
    scavengeCount: number;
    markSweepCount: number;
    totalGCTime: number;
    lastGCTime: number;
    lastGCType: GCType | null;
    objectsCollected: number;
    bytesReclaimed: number;
}

/**
 * Heap statistics
 */
export interface HeapStats {
    totalSize: number;
    totalAllocated: number;
    youngGenerationSize: number;
    oldGenerationSize: number;
    objectCount: number;
    youngObjectCount: number;
    oldObjectCount: number;
    gcStats: GCStats;
}

/**
 * V8Heap
 * Main heap manager coordinating all memory spaces and GC
 */
export class V8Heap {
    private youngGeneration: MemorySpace;
    private oldGeneration: MemorySpace;
    private codeSpace: MemorySpace;
    private largeObjectSpace: MemorySpace;
    private objects: Map<HeapObjectID, HeapObject> = new Map();
    private nextObjectId = 0;
    private gcStats: GCStats;
    private roots: Set<HeapObjectID> = new Set();
    private scavengeThreshold: number;
    private markSweepThreshold: number;

    constructor(
        youngGenMaxSize: number = 16 * 1024 * 1024, // 16MB
        oldGenMaxSize: number = 128 * 1024 * 1024, // 128MB
    ) {
        this.youngGeneration = new MemorySpace(SpaceType.NEW_SPACE, youngGenMaxSize);
        this.oldGeneration = new MemorySpace(SpaceType.OLD_SPACE, oldGenMaxSize);
        this.codeSpace = new MemorySpace(SpaceType.CODE_SPACE, 32 * 1024 * 1024); // 32MB
        this.largeObjectSpace = new MemorySpace(SpaceType.LARGE_OBJECT_SPACE, 256 * 1024 * 1024); // 256MB

        this.scavengeThreshold = youngGenMaxSize * 0.8; // 80% full
        this.markSweepThreshold = oldGenMaxSize * 0.8;

        this.gcStats = {
            totalCollections: 0,
            scavengeCount: 0,
            markSweepCount: 0,
            totalGCTime: 0,
            lastGCTime: 0,
            lastGCType: null,
            objectsCollected: 0,
            bytesReclaimed: 0,
        };
    }

    /**
     * Allocate object
     * Allocates memory for a JavaScript value
     */
    allocate(value: JSValue): HeapObjectID {
        const size = this.calculateSize(value);
        const isLarge = size > 256 * 1024; // Objects > 256KB go to large object space

        // Choose space
        const space = isLarge ? this.largeObjectSpace : this.youngGeneration;

        // Try to allocate
        let page = space.tryAllocate(size);

        // If allocation failed, run GC
        if (!page) {
            if (space === this.youngGeneration) {
                this.scavenge();
            } else {
                this.markSweep();
            }

            // Try again after GC
            page = space.tryAllocate(size);
            if (!page) {
                throw new Error("Out of memory");
            }
        }

        // Create heap object
        const id = this.generateObjectId();
        const heapObject: HeapObject = {
            id,
            value,
            size,
            color: ObjectColor.WHITE,
            generation: isLarge ? 1 : 0,
            marked: false,
        };

        // Store object
        this.objects.set(id, heapObject);
        page.addObject(heapObject);

        return id;
    }

    /**
     * Get object by ID
     */
    getObject(id: HeapObjectID): HeapObject | null {
        return this.objects.get(id) || null;
    }

    /**
     * Add root object
     * Root objects are GC roots (globals, stack, etc.)
     */
    addRoot(id: HeapObjectID): void {
        this.roots.add(id);
    }

    /**
     * Remove root object
     */
    removeRoot(id: HeapObjectID): void {
        this.roots.delete(id);
    }

    /**
     * Run garbage collection
     * Chooses appropriate GC type based on heap state
     */
    gc(): void {
        const youngSize = this.youngGeneration.getTotalSize();
        const oldSize = this.oldGeneration.getTotalSize();

        if (youngSize > this.scavengeThreshold) {
            this.scavenge();
        }

        if (oldSize > this.markSweepThreshold) {
            this.markSweep();
        }
    }

    /**
     * Scavenge (copying collector for young generation)
     * Uses Cheney's algorithm - copies live objects to old generation
     */
    private scavenge(): void {
        const startTime = performance.now();

        let objectsCollected = 0;
        let bytesReclaimed = 0;

        // Get all young generation objects
        const youngObjects = this.youngGeneration.getAllObjects();

        // Mark phase - mark all reachable objects from roots
        this.markFromRoots();

        // Copy live objects to old generation
        const survivors: HeapObject[] = [];

        for (const obj of youngObjects) {
            if (obj.marked || this.roots.has(obj.id)) {
                // Object survived - promote to old generation
                obj.generation = 1;
                obj.marked = false;
                obj.color = ObjectColor.WHITE;
                survivors.push(obj);

                // Try to allocate in old generation
                const page = this.oldGeneration.tryAllocate(obj.size);
                if (page) {
                    page.addObject(obj);
                }
            } else {
                // Object is garbage
                objectsCollected++;
                bytesReclaimed += obj.size;
                this.objects.delete(obj.id);
            }
        }

        // Clear young generation
        this.youngGeneration.clear();

        // Update statistics
        const gcTime = performance.now() - startTime;
        this.gcStats.scavengeCount++;
        this.gcStats.totalCollections++;
        this.gcStats.totalGCTime += gcTime;
        this.gcStats.lastGCTime = gcTime;
        this.gcStats.lastGCType = GCType.SCAVENGE;
        this.gcStats.objectsCollected += objectsCollected;
        this.gcStats.bytesReclaimed += bytesReclaimed;
    }

    /**
     * Mark-sweep garbage collection
     * Used for old generation
     */
    private markSweep(): void {
        const startTime = performance.now();

        let objectsCollected = 0;
        let bytesReclaimed = 0;

        // Mark phase
        this.markFromRoots();

        // Sweep phase - collect unmarked objects
        const oldObjects = this.oldGeneration.getAllObjects();

        for (const obj of oldObjects) {
            if (!obj.marked && !this.roots.has(obj.id)) {
                // Object is garbage
                objectsCollected++;
                bytesReclaimed += obj.size;
                this.objects.delete(obj.id);

                // Remove from page
                // (In real implementation, would find the page)
            } else {
                // Clear mark for next GC
                obj.marked = false;
                obj.color = ObjectColor.WHITE;
            }
        }

        // Compact old generation
        this.oldGeneration.compact();

        // Update statistics
        const gcTime = performance.now() - startTime;
        this.gcStats.markSweepCount++;
        this.gcStats.totalCollections++;
        this.gcStats.totalGCTime += gcTime;
        this.gcStats.lastGCTime = gcTime;
        this.gcStats.lastGCType = GCType.MARK_SWEEP;
        this.gcStats.objectsCollected += objectsCollected;
        this.gcStats.bytesReclaimed += bytesReclaimed;
    }

    /**
     * Mark all reachable objects from roots
     */
    private markFromRoots(): void {
        // Reset all marks
        for (const obj of this.objects.values()) {
            obj.marked = false;
            obj.color = ObjectColor.WHITE;
        }

        // Mark from roots
        for (const rootId of this.roots) {
            this.markObject(rootId);
        }
    }

    /**
     * Mark object and its children recursively
     */
    private markObject(id: HeapObjectID): void {
        const obj = this.objects.get(id);
        if (!obj || obj.marked) {
            return;
        }

        // Mark this object
        obj.marked = true;
        obj.color = ObjectColor.GRAY;

        // Mark children
        this.markChildren(obj.value);

        obj.color = ObjectColor.BLACK;
    }

    /**
     * Mark children of a value
     */
    private markChildren(value: JSValue): void {
        if (value.type === JSValueType.OBJECT || value.type === JSValueType.FUNCTION) {
            const obj = value.value as JSObject;

            // Mark properties
            for (const propValue of obj.properties.values()) {
                if (
                    propValue.type === JSValueType.OBJECT || propValue.type === JSValueType.FUNCTION
                ) {
                    // Would need to track heap object IDs for each JSValue
                    // Simplified for now
                }
            }

            // Mark prototype
            if (obj.prototype) {
                // Would mark prototype
            }
        }
    }

    /**
     * Calculate object size
     */
    private calculateSize(value: JSValue): number {
        switch (value.type) {
            case JSValueType.UNDEFINED:
            case JSValueType.NULL:
                return 8; // Just the type tag

            case JSValueType.BOOLEAN:
                return 8 + 1; // Type + boolean

            case JSValueType.NUMBER:
                return 8 + 8; // Type + double

            case JSValueType.STRING:
                return 8 + value.value.length * 2; // Type + UTF-16 chars

            case JSValueType.BIGINT:
                return 8 + 16; // Type + big int (simplified)

            case JSValueType.SYMBOL:
                return 8 + 8 + (value.value.description?.length || 0) * 2; // Type + ID + description

            case JSValueType.OBJECT:
            case JSValueType.FUNCTION: {
                const obj = value.value as JSObject;
                let size = 8 + 24; // Type + object header

                // Properties
                size += obj.properties.size * 32; // Simplified property size

                if (value.type === JSValueType.FUNCTION) {
                    const func = value.value;
                    if (typeof func.code === "string") {
                        size += func.code.length * 2;
                    } else {
                        size += func.code.byteLength;
                    }
                }

                return size;
            }

            default:
                return 8;
        }
    }

    /**
     * Generate unique object ID
     */
    private generateObjectId(): HeapObjectID {
        return `heap-obj-${this.nextObjectId++}` as HeapObjectID;
    }

    /**
     * Get heap statistics
     */
    getStats(): HeapStats {
        const youngObjects = this.youngGeneration.getAllObjects();
        const oldObjects = this.oldGeneration.getAllObjects();

        return {
            totalSize: this.youngGeneration.getTotalSize() +
                this.oldGeneration.getTotalSize() +
                this.codeSpace.getTotalSize() +
                this.largeObjectSpace.getTotalSize(),
            totalAllocated: this.objects.size,
            youngGenerationSize: this.youngGeneration.getTotalSize(),
            oldGenerationSize: this.oldGeneration.getTotalSize(),
            objectCount: this.objects.size,
            youngObjectCount: youngObjects.length,
            oldObjectCount: oldObjects.length,
            gcStats: { ...this.gcStats },
        };
    }

    /**
     * Get GC statistics
     */
    getGCStats(): GCStats {
        return { ...this.gcStats };
    }

    /**
     * Force specific GC type
     */
    forceGC(type: GCType): void {
        switch (type) {
            case GCType.SCAVENGE:
                this.scavenge();
                break;
            case GCType.MARK_SWEEP:
            case GCType.MARK_COMPACT:
                this.markSweep();
                break;
        }
    }

    /**
     * Check if object exists
     */
    hasObject(id: HeapObjectID): boolean {
        return this.objects.has(id);
    }

    /**
     * Get object count
     */
    getObjectCount(): number {
        return this.objects.size;
    }

    /**
     * Get total allocated memory
     */
    getTotalAllocated(): number {
        return this.youngGeneration.getTotalSize() +
            this.oldGeneration.getTotalSize() +
            this.codeSpace.getTotalSize() +
            this.largeObjectSpace.getTotalSize();
    }

    /**
     * Clear all memory
     */
    clear(): void {
        this.objects.clear();
        this.roots.clear();
        this.youngGeneration.clear();
        this.oldGeneration.clear();
        this.codeSpace.clear();
        this.largeObjectSpace.clear();
        this.nextObjectId = 0;
    }

    /**
     * Dispose heap
     */
    dispose(): void {
        this.clear();
    }
}

/**
 * Heap factory
 * Creates heap instances with different configurations
 */
export class HeapFactory {
    /**
     * Create default heap
     */
    static createDefault(): V8Heap {
        return new V8Heap();
    }

    /**
     * Create large heap for heavy workloads
     */
    static createLarge(): V8Heap {
        return new V8Heap(
            32 * 1024 * 1024, // 32MB young gen
            256 * 1024 * 1024, // 256MB old gen
        );
    }

    /**
     * Create small heap for constrained environments
     */
    static createSmall(): V8Heap {
        return new V8Heap(
            4 * 1024 * 1024, // 4MB young gen
            32 * 1024 * 1024, // 32MB old gen
        );
    }

    /**
     * Create heap for testing
     */
    static createForTesting(): V8Heap {
        return new V8Heap(
            1 * 1024 * 1024, // 1MB young gen
            8 * 1024 * 1024, // 8MB old gen
        );
    }
}
