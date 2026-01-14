/**
 * Quota Manager
 *
 * Manages per-origin storage quotas and enforces limits.
 * Tracks usage across localStorage, sessionStorage, IndexedDB, and Cache API.
 */

/**
 * Storage type
 */
export enum StorageType {
    LOCAL_STORAGE = "localStorage",
    SESSION_STORAGE = "sessionStorage",
    INDEXED_DB = "indexedDB",
    CACHE_API = "cacheAPI",
}

/**
 * Quota information
 */
export interface QuotaInfo {
    quota: number;
    usage: number;
    available: number;
    usageByType: Map<StorageType, number>;
}

/**
 * Quota Manager
 */
export class QuotaManager {
    private quotas: Map<string, number> = new Map();
    private usage: Map<string, Map<StorageType, number>> = new Map();
    private defaultQuota: number;
    private globalQuota: number;
    private globalUsage: number = 0;

    constructor(
        defaultQuota: number = 50 * 1024 * 1024, // 50MB per origin
        globalQuota: number = 1024 * 1024 * 1024, // 1GB total
    ) {
        this.defaultQuota = defaultQuota;
        this.globalQuota = globalQuota;
    }

    /**
     * Check if origin has available quota
     */
    hasQuota(origin: string, requestedBytes: number): boolean {
        // Check global quota
        if (this.globalUsage + requestedBytes > this.globalQuota) {
            return false;
        }

        // Check per-origin quota
        const quota = this.getQuota(origin);
        const used = this.getUsage(origin);
        return (used + requestedBytes) <= quota;
    }

    /**
     * Update usage for origin and storage type
     */
    updateUsage(
        origin: string,
        bytes: number,
        type: StorageType = StorageType.LOCAL_STORAGE,
    ): void {
        // Get or create usage map for origin
        if (!this.usage.has(origin)) {
            this.usage.set(origin, new Map());
        }

        const originUsage = this.usage.get(origin)!;

        // Update usage for storage type
        const currentTypeUsage = originUsage.get(type) || 0;
        const newTypeUsage = Math.max(0, currentTypeUsage + bytes);
        originUsage.set(type, newTypeUsage);

        // Update global usage
        this.globalUsage = Math.max(0, this.globalUsage + bytes);

        // Clean up if usage is zero
        if (newTypeUsage === 0) {
            originUsage.delete(type);

            if (originUsage.size === 0) {
                this.usage.delete(origin);
            }
        }
    }

    /**
     * Get quota for origin
     */
    getQuota(origin: string): number {
        return this.quotas.get(origin) || this.defaultQuota;
    }

    /**
     * Set quota for origin
     */
    setQuota(origin: string, quota: number): void {
        if (quota < 0) {
            throw new Error("Quota must be non-negative");
        }

        this.quotas.set(origin, quota);
    }

    /**
     * Get total usage for origin
     */
    getUsage(origin: string): number {
        const originUsage = this.usage.get(origin);
        if (!originUsage) {
            return 0;
        }

        let total = 0;
        for (const usage of originUsage.values()) {
            total += usage;
        }
        return total;
    }

    /**
     * Get usage by storage type for origin
     */
    getUsageByType(origin: string, type: StorageType): number {
        return this.usage.get(origin)?.get(type) || 0;
    }

    /**
     * Get quota information for origin
     */
    getQuotaInfo(origin: string): QuotaInfo {
        const quota = this.getQuota(origin);
        const usage = this.getUsage(origin);
        const usageByType = this.usage.get(origin) || new Map();

        return {
            quota,
            usage,
            available: Math.max(0, quota - usage),
            usageByType: new Map(usageByType),
        };
    }

    /**
     * Get all origins with usage
     */
    getAllOrigins(): string[] {
        return Array.from(this.usage.keys());
    }

    /**
     * Clear usage for origin
     */
    clearOrigin(origin: string): void {
        const originUsage = this.usage.get(origin);
        if (originUsage) {
            // Subtract from global usage
            for (const typeUsage of originUsage.values()) {
                this.globalUsage -= typeUsage;
            }

            this.usage.delete(origin);
        }

        this.quotas.delete(origin);
    }

    /**
     * Clear all usage
     */
    clearAll(): void {
        this.usage.clear();
        this.quotas.clear();
        this.globalUsage = 0;
    }

    /**
     * Get global quota information
     */
    getGlobalQuotaInfo(): {
        quota: number;
        usage: number;
        available: number;
        originCount: number;
    } {
        return {
            quota: this.globalQuota,
            usage: this.globalUsage,
            available: Math.max(0, this.globalQuota - this.globalUsage),
            originCount: this.usage.size,
        };
    }

    /**
     * Set global quota
     */
    setGlobalQuota(quota: number): void {
        if (quota < 0) {
            throw new Error("Global quota must be non-negative");
        }

        this.globalQuota = quota;
    }

    /**
     * Set default per-origin quota
     */
    setDefaultQuota(quota: number): void {
        if (quota < 0) {
            throw new Error("Default quota must be non-negative");
        }

        this.defaultQuota = quota;
    }

    /**
     * Get default quota
     */
    getDefaultQuota(): number {
        return this.defaultQuota;
    }

    /**
     * Check if global quota is exceeded
     */
    isGlobalQuotaExceeded(): boolean {
        return this.globalUsage > this.globalQuota;
    }

    /**
     * Check if origin quota is exceeded
     */
    isOriginQuotaExceeded(origin: string): boolean {
        return this.getUsage(origin) > this.getQuota(origin);
    }

    /**
     * Get usage percentage for origin
     */
    getUsagePercentage(origin: string): number {
        const quota = this.getQuota(origin);
        if (quota === 0) {
            return 0;
        }

        const usage = this.getUsage(origin);
        return (usage / quota) * 100;
    }

    /**
     * Get global usage percentage
     */
    getGlobalUsagePercentage(): number {
        if (this.globalQuota === 0) {
            return 0;
        }

        return (this.globalUsage / this.globalQuota) * 100;
    }

    /**
     * Export quota data
     */
    export(): {
        quotas: Record<string, number>;
        usage: Record<string, Record<string, number>>;
        globalUsage: number;
    } {
        const quotas: Record<string, number> = {};
        for (const [origin, quota] of this.quotas.entries()) {
            quotas[origin] = quota;
        }

        const usage: Record<string, Record<string, number>> = {};
        for (const [origin, typeMap] of this.usage.entries()) {
            usage[origin] = {};
            for (const [type, bytes] of typeMap.entries()) {
                usage[origin][type] = bytes;
            }
        }

        return {
            quotas,
            usage,
            globalUsage: this.globalUsage,
        };
    }

    /**
     * Import quota data
     */
    import(data: {
        quotas?: Record<string, number>;
        usage?: Record<string, Record<string, number>>;
        globalUsage?: number;
    }): void {
        if (data.quotas) {
            for (const [origin, quota] of Object.entries(data.quotas)) {
                this.quotas.set(origin, quota);
            }
        }

        if (data.usage) {
            for (const [origin, typeUsage] of Object.entries(data.usage)) {
                const typeMap = new Map<StorageType, number>();
                for (const [type, bytes] of Object.entries(typeUsage)) {
                    typeMap.set(type as StorageType, bytes);
                }
                this.usage.set(origin, typeMap);
            }
        }

        if (data.globalUsage !== undefined) {
            this.globalUsage = data.globalUsage;
        }
    }
}
