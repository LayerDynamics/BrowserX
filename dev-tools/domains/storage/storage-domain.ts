/**
 * Storage Domain Agent
 *
 * Inspects and manages browser storage: cookies, localStorage, sessionStorage,
 * IndexedDB, and Cache API. Hooks into StorageManager, CookieManager, and
 * QuotaManager for comprehensive storage operations.
 */

import type { DomainName } from "../../protocol/types.ts";
import { BaseDomain } from "../base-domain.ts";
import { validateParams } from "../../protocol/validate-params.ts";
import { validateSetCookieParams, validateGetCookiesParams, validateDeleteCookieParams, validateGetStorageEntriesParams, validateClearStorageParams, validateGetUsageAndQuotaParams } from "./storage-validators.ts";
import type { Cookie } from "../../../browser/src/types/storage.ts";
import type {
    StorageType,
    StorageEntry,
    StorageUsageInfo,
    CookieDescription,
    GetCookiesParams,
    GetCookiesResult,
    SetCookieParams,
    DeleteCookieParams,
    ClearStorageParams,
    GetStorageEntriesParams,
    GetStorageEntriesResult,
    GetUsageAndQuotaParams,
    GetUsageAndQuotaResult,
} from "./storage-types.ts";
import { cookieToCookieDescription } from "./storage-types.ts";

/**
 * Storage Domain - cookie, localStorage, sessionStorage, IndexedDB, Cache API management
 */
export class StorageDomain extends BaseDomain {
    readonly name: DomainName = "Storage";

    protected setup(): void {
        // Register methods
        this.registerMethod("getCookies", "Get cookies matching the given URLs", async (params) => {
            return await this.getCookies(validateParams(params, validateGetCookiesParams) as GetCookiesParams);
        });

        this.registerMethod("setCookie", "Set a cookie with the given parameters", async (params) => {
            return await this.setCookie(validateParams(params, validateSetCookieParams) as SetCookieParams);
        });

        this.registerMethod("deleteCookie", "Delete a cookie by name and optional scope", async (params) => {
            return await this.deleteCookie(validateParams(params, validateDeleteCookieParams) as DeleteCookieParams);
        });

        this.registerMethod("clearCookies", "Clear all browser cookies", async () => {
            return await this.clearCookies();
        });

        this.registerMethod("getStorageEntries", "Get storage entries for an origin and type", async (params) => {
            return await this.getStorageEntries(validateParams(params, validateGetStorageEntriesParams) as GetStorageEntriesParams);
        });

        this.registerMethod("clearStorage", "Clear storage for an origin", async (params) => {
            return await this.clearStorage(validateParams(params, validateClearStorageParams) as ClearStorageParams);
        });

        this.registerMethod("getUsageAndQuota", "Get storage usage and quota for an origin", async (params) => {
            return await this.getUsageAndQuota(validateParams(params, validateGetUsageAndQuotaParams) as GetUsageAndQuotaParams);
        });

        // Register events
        this.registerEvent("storageCleared", "Storage cleared for an origin");
        this.registerEvent("cookieAdded", "A cookie was added");
        this.registerEvent("cookieDeleted", "A cookie was deleted");
    }

    /**
     * Get cookies matching the given URLs.
     * If no URLs are provided, returns all cookies.
     */
    private async getCookies(params: GetCookiesParams): Promise<GetCookiesResult> {
        const cookieManager = this.context.cookieManager;
        const urls = params.urls || [];
        const cookieDescriptions: CookieDescription[] = [];

        if (urls.length > 0) {
            // Collect cookies for each URL, deduplicating by name+domain+path
            const seen = new Set<string>();
            for (const url of urls) {
                const cookies: Cookie[] = cookieManager.getCookies(url);
                for (const cookie of cookies) {
                    const key = `${cookie.name}:${cookie.domain || ""}:${cookie.path || "/"}`;
                    if (!seen.has(key)) {
                        seen.add(key);
                        cookieDescriptions.push(cookieToCookieDescription(cookie));
                    }
                }
            }
        } else {
            // Return all cookies
            const allCookies: Cookie[] = cookieManager.getAllCookies();
            for (const cookie of allCookies) {
                cookieDescriptions.push(cookieToCookieDescription(cookie));
            }
        }

        return { cookies: cookieDescriptions };
    }

    /**
     * Set a cookie with the given parameters.
     * Emits cookieAdded event on success.
     */
    private async setCookie(params: SetCookieParams): Promise<Record<string, unknown>> {
        const cookieManager = this.context.cookieManager;

        const cookie: Cookie = {
            name: params.name,
            value: params.value,
            domain: params.domain,
            path: params.path || "/",
            httpOnly: params.httpOnly,
            secure: params.secure,
            sameSite: params.sameSite,
        };

        // Set expires from numeric timestamp (seconds since epoch)
        if (params.expires !== undefined && params.expires > 0) {
            cookie.expires = new Date(params.expires * 1000);
        }

        const requestUrl = params.domain
            ? `https://${params.domain}/`
            : "https://localhost/";

        try {
            cookieManager.setCookie(cookie, requestUrl);

            if (this.enabled) {
                this.emitEvent("cookieAdded", {
                    cookie: cookieToCookieDescription(cookie),
                });
            }

            return { success: true };
        } catch {
            return { success: false };
        }
    }

    /**
     * Delete a cookie by name and optional domain/path scope.
     * Emits cookieDeleted event on success.
     */
    private async deleteCookie(params: DeleteCookieParams): Promise<Record<string, unknown>> {
        const cookieManager = this.context.cookieManager;

        const domain = params.domain || (params.url ? this.extractDomain(params.url) : "localhost");
        const path = params.path || "/";

        cookieManager.deleteCookie(params.name, domain, path);

        if (this.enabled) {
            this.emitEvent("cookieDeleted", {
                name: params.name,
                domain,
                path,
            });
        }

        return {};
    }

    /**
     * Clear all cookies from the browser.
     */
    private async clearCookies(): Promise<Record<string, unknown>> {
        this.context.cookieManager.clearAll();
        return {};
    }

    /**
     * Get storage entries for a given origin and storage type.
     * Supports local_storage and session_storage types.
     * Other types return empty arrays as they have different access patterns.
     */
    private async getStorageEntries(params: GetStorageEntriesParams): Promise<GetStorageEntriesResult> {
        const storageManager = this.context.storageManager;
        const entries: StorageEntry[] = [];

        switch (params.storageType) {
            case "local_storage": {
                const localStorage = storageManager.getLocalStorage(params.origin);
                const localEntries = localStorage.entries();
                for (const [key, value] of localEntries) {
                    entries.push({
                        key,
                        value,
                        type: "local_storage",
                    });
                }
                break;
            }

            case "session_storage": {
                const sessionStorage = storageManager.getSessionStorage(params.origin);
                const sessionEntries = sessionStorage.entries();
                for (const [key, value] of sessionEntries) {
                    entries.push({
                        key,
                        value,
                        type: "session_storage",
                    });
                }
                break;
            }

            case "cookies": {
                // Return cookies scoped to the origin
                const cookies: Cookie[] = this.context.cookieManager.getCookies(params.origin);
                for (const cookie of cookies) {
                    entries.push({
                        key: cookie.name,
                        value: cookie.value,
                        type: "cookies",
                    });
                }
                break;
            }

            case "indexeddb":
            case "cache_storage":
                // IndexedDB and Cache API entries require specialized access
                // Return empty entries for now; these storage types use different APIs
                break;
        }

        return { entries };
    }

    /**
     * Clear storage for an origin.
     * If storageTypes is specified, only those types are cleared.
     * Otherwise, all storage types are cleared.
     */
    private async clearStorage(params: ClearStorageParams): Promise<Record<string, unknown>> {
        const storageManager = this.context.storageManager;
        const cookieManager = this.context.cookieManager;
        const quotaManager = this.context.quotaManager;

        const typesToClear: StorageType[] = params.storageTypes || [
            "cookies",
            "local_storage",
            "session_storage",
            "indexeddb",
            "cache_storage",
        ];

        for (const storageType of typesToClear) {
            switch (storageType) {
                case "local_storage": {
                    const localStorage = storageManager.getLocalStorage(params.origin);
                    localStorage.clear(params.origin);
                    break;
                }
                case "session_storage": {
                    const sessionStorage = storageManager.getSessionStorage(params.origin);
                    sessionStorage.clear(params.origin);
                    break;
                }

                case "cookies":
                    // Clear cookies for the origin's domain
                    try {
                        const domain = this.extractDomain(params.origin);
                        cookieManager.deleteCookiesForDomain(domain);
                    } catch {
                        // Origin may not be a valid URL, clear all as fallback
                        cookieManager.clearAll();
                    }
                    break;

                case "indexeddb":
                case "cache_storage":
                    // Clear quota tracking for these types
                    quotaManager.clearOrigin(params.origin);
                    break;
            }
        }

        if (this.enabled) {
            this.emitEvent("storageCleared", {
                origin: params.origin,
                storageTypes: typesToClear,
            });
        }

        return {};
    }

    /**
     * Get storage usage and quota for an origin.
     * Returns total usage, quota, and a breakdown by storage type.
     */
    private async getUsageAndQuota(params: GetUsageAndQuotaParams): Promise<GetUsageAndQuotaResult> {
        const storageManager = this.context.storageManager;
        const quotaManager = this.context.quotaManager;

        // Get quota info from QuotaManager
        const quotaInfo = quotaManager.getQuotaInfo(params.origin);

        // Get storage usage breakdown
        const storageUsage = storageManager.getUsage(params.origin);

        const usageBreakdown: StorageUsageInfo[] = [
            {
                origin: params.origin,
                storageType: "local_storage",
                usage: storageUsage.local,
                quota: quotaInfo.quota,
            },
            {
                origin: params.origin,
                storageType: "session_storage",
                usage: storageUsage.session,
                quota: quotaInfo.quota,
            },
        ];

        // Add IndexedDB and Cache API usage from QuotaManager type breakdown
        for (const [type, typeUsage] of quotaInfo.usageByType.entries()) {
            const storageType = this.mapQuotaStorageType(type);
            if (storageType && storageType !== "local_storage" && storageType !== "session_storage") {
                usageBreakdown.push({
                    origin: params.origin,
                    storageType,
                    usage: typeUsage,
                    quota: quotaInfo.quota,
                });
            }
        }

        return {
            usage: quotaInfo.usage,
            quota: quotaInfo.quota,
            usageBreakdown,
        };
    }

    /**
     * Extract domain from a URL string
     */
    private extractDomain(url: string): string {
        try {
            return new URL(url).hostname;
        } catch {
            return url;
        }
    }

    /**
     * Map QuotaManager StorageType enum values to our StorageType string union
     */
    private mapQuotaStorageType(quotaType: string): StorageType | null {
        switch (quotaType) {
            case "localStorage":
                return "local_storage";
            case "sessionStorage":
                return "session_storage";
            case "indexedDB":
                return "indexeddb";
            case "cacheAPI":
                return "cache_storage";
            default:
                return null;
        }
    }

    override dispose(): void {
        super.dispose();
    }
}
