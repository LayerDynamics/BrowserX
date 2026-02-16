/**
 * Storage Domain Types
 *
 * Types for storage inspection, cookie management, and quota monitoring.
 * Supports localStorage, sessionStorage, IndexedDB, and Cache API.
 */

import type { Cookie } from "../../../browser/src/types/storage.ts";

/**
 * Storage type identifier
 */
export type StorageType =
    | "cookies"
    | "local_storage"
    | "session_storage"
    | "indexeddb"
    | "cache_storage";

/**
 * A single storage entry (key-value pair with type)
 */
export interface StorageEntry {
    key: string;
    value: string;
    type: StorageType;
}

/**
 * Storage usage information per origin and type
 */
export interface StorageUsageInfo {
    origin: string;
    storageType: StorageType;
    usage: number;
    quota: number;
}

/**
 * Cookie description for protocol transport
 * Extends the internal Cookie type with size and priority metadata
 */
export interface CookieDescription {
    name: string;
    value: string;
    domain: string;
    path: string;
    expires: number;
    httpOnly: boolean;
    secure: boolean;
    sameSite: "Strict" | "Lax" | "None";
    size: number;
    priority: "Low" | "Medium" | "High";
}

// ============================================================================
// Method Params and Results
// ============================================================================

/**
 * Parameters for getCookies method
 */
export interface GetCookiesParams {
    urls?: string[];
}

/**
 * Result for getCookies method
 */
export interface GetCookiesResult {
    cookies: CookieDescription[];
}

/**
 * Parameters for setCookie method
 */
export interface SetCookieParams {
    name: string;
    value: string;
    domain?: string;
    path?: string;
    expires?: number;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: "Strict" | "Lax" | "None";
}

/**
 * Parameters for deleteCookie method
 */
export interface DeleteCookieParams {
    name: string;
    url?: string;
    domain?: string;
    path?: string;
}

/**
 * Parameters for clearStorage method
 */
export interface ClearStorageParams {
    origin: string;
    storageTypes?: StorageType[];
}

/**
 * Parameters for getStorageEntries method
 */
export interface GetStorageEntriesParams {
    origin: string;
    storageType: StorageType;
}

/**
 * Result for getStorageEntries method
 */
export interface GetStorageEntriesResult {
    entries: StorageEntry[];
}

/**
 * Parameters for getUsageAndQuota method
 */
export interface GetUsageAndQuotaParams {
    origin: string;
}

/**
 * Result for getUsageAndQuota method
 */
export interface GetUsageAndQuotaResult {
    usage: number;
    quota: number;
    usageBreakdown: StorageUsageInfo[];
}

/**
 * Convert an internal Cookie to a CookieDescription for protocol transport
 */
export function cookieToCookieDescription(cookie: Cookie): CookieDescription {
    const name = cookie.name || "";
    const value = cookie.value || "";

    return {
        name,
        value,
        domain: cookie.domain || "",
        path: cookie.path || "/",
        expires: cookie.expires ? cookie.expires.getTime() / 1000 : -1,
        httpOnly: cookie.httpOnly ?? false,
        secure: cookie.secure ?? false,
        sameSite: cookie.sameSite || "Lax",
        size: name.length + value.length,
        priority: "Medium",
    };
}
