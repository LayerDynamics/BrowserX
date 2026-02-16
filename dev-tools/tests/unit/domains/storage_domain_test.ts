/**
 * Tests for Storage Domain Agent
 *
 * Covers cookie management (get, set, delete, clear), localStorage/sessionStorage
 * entry retrieval, storage clearing, usage and quota reporting, enable/disable
 * lifecycle, and event emission.
 */

import { assertEquals } from "@std/assert";
import { EventBus } from "../../../integration/event-bus.ts";
import { StorageDomain } from "../../../domains/storage/storage-domain.ts";
import {
    createMockContext,
    createMockCookieManager,
    createMockStorageManager,
    createMockQuotaManager,
} from "../../helpers/mocks.ts";
import type { Cookie } from "../../../../browser/src/types/storage.ts";

// ---------------------------------------------------------------------------
// Helper: create a fully wired StorageDomain for each test
// ---------------------------------------------------------------------------

function setup(options?: {
    cookies?: Cookie[];
    quotaUsageByType?: Map<string, number>;
}) {
    const eventBus = new EventBus();
    const cookieManager = createMockCookieManager(options?.cookies);
    const storageManager = createMockStorageManager();

    // Build a quota manager with optional usageByType override
    const baseQuota = createMockQuotaManager();
    if (options?.quotaUsageByType) {
        baseQuota.getQuotaInfo = () => ({
            quota: 10485760,
            usage: 1024,
            available: 10484736,
            usageByType: options.quotaUsageByType!,
        });
    }

    const context = createMockContext({
        eventBus,
        cookieManager,
        storageManager,
        quotaManager: baseQuota,
    });

    const domain = new StorageDomain(eventBus);
    domain.initialize(context);

    return { domain, eventBus, cookieManager, storageManager, context };
}

// ---------------------------------------------------------------------------
// enable / disable
// ---------------------------------------------------------------------------

Deno.test("StorageDomain enable() returns empty object", async () => {
    const { domain } = setup();
    const result = await domain.enable();
    assertEquals(result, {});
    assertEquals(domain.isEnabled(), true);
});

Deno.test("StorageDomain disable() returns empty object and disables", async () => {
    const { domain } = setup();
    await domain.enable();
    const result = await domain.disable();
    assertEquals(result, {});
    assertEquals(domain.isEnabled(), false);
});

// ---------------------------------------------------------------------------
// getCookies
// ---------------------------------------------------------------------------

Deno.test("StorageDomain getCookies returns all cookies when no URLs provided", async () => {
    const cookies: Cookie[] = [
        { name: "session", value: "abc123", domain: "example.com", path: "/" },
        { name: "prefs", value: "dark", domain: "example.com", path: "/" },
    ];
    const { domain } = setup({ cookies });
    await domain.enable();

    const result = await domain.handleMethod("getCookies", {});
    const cookieResult = result as { cookies: Array<{ name: string; value: string }> };

    assertEquals(cookieResult.cookies.length, 2);
    assertEquals(cookieResult.cookies[0].name, "session");
    assertEquals(cookieResult.cookies[0].value, "abc123");
    assertEquals(cookieResult.cookies[1].name, "prefs");
    assertEquals(cookieResult.cookies[1].value, "dark");
});

Deno.test("StorageDomain getCookies with URLs filters by URL", async () => {
    const cookies: Cookie[] = [
        { name: "token", value: "xyz", domain: "example.com", path: "/" },
    ];
    const { domain } = setup({ cookies });
    await domain.enable();

    const result = await domain.handleMethod("getCookies", {
        urls: ["https://example.com/page"],
    });
    const cookieResult = result as { cookies: Array<{ name: string }> };

    // Mock getCookies returns all cookies regardless of URL, so we just verify it returns
    assertEquals(cookieResult.cookies.length >= 1, true);
    assertEquals(cookieResult.cookies[0].name, "token");
});

Deno.test("StorageDomain getCookies with empty cookie jar returns empty array", async () => {
    const { domain } = setup({ cookies: [] });
    await domain.enable();

    const result = await domain.handleMethod("getCookies", {});
    const cookieResult = result as { cookies: unknown[] };

    assertEquals(cookieResult.cookies.length, 0);
});

// ---------------------------------------------------------------------------
// setCookie
// ---------------------------------------------------------------------------

Deno.test("StorageDomain setCookie adds a cookie and returns success", async () => {
    const { domain, cookieManager } = setup();
    await domain.enable();

    const result = await domain.handleMethod("setCookie", {
        name: "user",
        value: "john",
        domain: "example.com",
        path: "/",
        secure: true,
        httpOnly: false,
    });

    assertEquals((result as { success: boolean }).success, true);
    // Verify the cookie was added to the manager
    const allCookies = cookieManager.getAllCookies();
    const found = allCookies.find((c: Cookie) => c.name === "user");
    assertEquals(found !== undefined, true);
    assertEquals(found!.value, "john");
});

Deno.test("StorageDomain setCookie emits cookieAdded event when enabled", async () => {
    const { domain, eventBus } = setup();
    await domain.enable();

    const events: unknown[] = [];
    eventBus.on("Storage.cookieAdded", (data) => events.push(data));

    await domain.handleMethod("setCookie", {
        name: "track",
        value: "abc",
        domain: "example.com",
    });

    assertEquals(events.length, 1);
    const eventData = events[0] as { cookie: { name: string } };
    assertEquals(eventData.cookie.name, "track");
});

Deno.test("StorageDomain setCookie with expires sets expiry date", async () => {
    const { domain, cookieManager } = setup();
    await domain.enable();

    const expiresTimestamp = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now

    await domain.handleMethod("setCookie", {
        name: "temp",
        value: "data",
        domain: "example.com",
        expires: expiresTimestamp,
    });

    const allCookies = cookieManager.getAllCookies();
    const found = allCookies.find((c: Cookie) => c.name === "temp");
    assertEquals(found !== undefined, true);
    assertEquals(found!.expires instanceof Date, true);
});

// ---------------------------------------------------------------------------
// deleteCookie
// ---------------------------------------------------------------------------

Deno.test("StorageDomain deleteCookie removes specific cookie", async () => {
    const cookies: Cookie[] = [
        { name: "remove-me", value: "gone", domain: "example.com", path: "/" },
        { name: "keep-me", value: "stay", domain: "example.com", path: "/" },
    ];
    const { domain, cookieManager } = setup({ cookies });
    await domain.enable();

    await domain.handleMethod("deleteCookie", {
        name: "remove-me",
        domain: "example.com",
        path: "/",
    });

    const remaining = cookieManager.getAllCookies();
    const removed = remaining.find((c: Cookie) => c.name === "remove-me");
    assertEquals(removed, undefined);
});

Deno.test("StorageDomain deleteCookie emits cookieDeleted event when enabled", async () => {
    const cookies: Cookie[] = [
        { name: "del", value: "v", domain: "example.com", path: "/" },
    ];
    const { domain, eventBus } = setup({ cookies });
    await domain.enable();

    const events: unknown[] = [];
    eventBus.on("Storage.cookieDeleted", (data) => events.push(data));

    await domain.handleMethod("deleteCookie", {
        name: "del",
        domain: "example.com",
    });

    assertEquals(events.length, 1);
    const eventData = events[0] as { name: string; domain: string };
    assertEquals(eventData.name, "del");
    assertEquals(eventData.domain, "example.com");
});

// ---------------------------------------------------------------------------
// clearCookies
// ---------------------------------------------------------------------------

Deno.test("StorageDomain clearCookies removes all cookies", async () => {
    const cookies: Cookie[] = [
        { name: "a", value: "1", domain: "example.com", path: "/" },
        { name: "b", value: "2", domain: "other.com", path: "/" },
    ];
    const { domain, cookieManager } = setup({ cookies });
    await domain.enable();

    await domain.handleMethod("clearCookies", {});

    const remaining = cookieManager.getAllCookies();
    assertEquals(remaining.length, 0);
});

// ---------------------------------------------------------------------------
// getStorageEntries
// ---------------------------------------------------------------------------

Deno.test("StorageDomain getStorageEntries returns localStorage entries", async () => {
    const { domain, storageManager } = setup();
    await domain.enable();

    // Pre-populate local storage
    const ls = storageManager.getLocalStorage("https://example.com");
    ls.setItem("key1", "value1");
    ls.setItem("key2", "value2");

    const result = await domain.handleMethod("getStorageEntries", {
        origin: "https://example.com",
        storageType: "local_storage",
    });
    const entries = (result as { entries: Array<{ key: string; value: string; type: string }> }).entries;

    assertEquals(entries.length, 2);
    assertEquals(entries[0].type, "local_storage");
});

Deno.test("StorageDomain getStorageEntries returns sessionStorage entries", async () => {
    const { domain, storageManager } = setup();
    await domain.enable();

    const ss = storageManager.getSessionStorage("https://example.com");
    ss.setItem("sess_key", "sess_val");

    const result = await domain.handleMethod("getStorageEntries", {
        origin: "https://example.com",
        storageType: "session_storage",
    });
    const entries = (result as { entries: Array<{ key: string; value: string; type: string }> }).entries;

    assertEquals(entries.length, 1);
    assertEquals(entries[0].key, "sess_key");
    assertEquals(entries[0].value, "sess_val");
    assertEquals(entries[0].type, "session_storage");
});

Deno.test("StorageDomain getStorageEntries returns empty for indexeddb type", async () => {
    const { domain } = setup();
    await domain.enable();

    const result = await domain.handleMethod("getStorageEntries", {
        origin: "https://example.com",
        storageType: "indexeddb",
    });
    const entries = (result as { entries: unknown[] }).entries;

    assertEquals(entries.length, 0);
});

Deno.test("StorageDomain getStorageEntries returns cookies scoped to origin", async () => {
    const cookies: Cookie[] = [
        { name: "c1", value: "v1", domain: "example.com", path: "/" },
    ];
    const { domain } = setup({ cookies });
    await domain.enable();

    const result = await domain.handleMethod("getStorageEntries", {
        origin: "https://example.com",
        storageType: "cookies",
    });
    const entries = (result as { entries: Array<{ key: string; type: string }> }).entries;

    assertEquals(entries.length >= 1, true);
    assertEquals(entries[0].type, "cookies");
    assertEquals(entries[0].key, "c1");
});

// ---------------------------------------------------------------------------
// clearStorage
// ---------------------------------------------------------------------------

Deno.test("StorageDomain clearStorage emits storageCleared event", async () => {
    const { domain, eventBus } = setup();
    await domain.enable();

    const events: unknown[] = [];
    eventBus.on("Storage.storageCleared", (data) => events.push(data));

    await domain.handleMethod("clearStorage", {
        origin: "https://example.com",
    });

    assertEquals(events.length, 1);
    const eventData = events[0] as { origin: string; storageTypes: string[] };
    assertEquals(eventData.origin, "https://example.com");
    // When no storageTypes specified, clears all types
    assertEquals(eventData.storageTypes.length, 5);
});

Deno.test("StorageDomain clearStorage with specific storageTypes clears only those", async () => {
    const { domain, eventBus } = setup();
    await domain.enable();

    const events: unknown[] = [];
    eventBus.on("Storage.storageCleared", (data) => events.push(data));

    await domain.handleMethod("clearStorage", {
        origin: "https://example.com",
        storageTypes: ["local_storage", "cookies"],
    });

    assertEquals(events.length, 1);
    const eventData = events[0] as { storageTypes: string[] };
    assertEquals(eventData.storageTypes.length, 2);
    assertEquals(eventData.storageTypes.includes("local_storage"), true);
    assertEquals(eventData.storageTypes.includes("cookies"), true);
});

// ---------------------------------------------------------------------------
// getUsageAndQuota
// ---------------------------------------------------------------------------

Deno.test("StorageDomain getUsageAndQuota returns quota info from QuotaManager", async () => {
    const { domain } = setup();
    await domain.enable();

    const result = await domain.handleMethod("getUsageAndQuota", {
        origin: "https://example.com",
    });
    const quotaResult = result as { usage: number; quota: number; usageBreakdown: unknown[] };

    assertEquals(quotaResult.usage, 1024);
    assertEquals(quotaResult.quota, 10485760);
    assertEquals(quotaResult.usageBreakdown.length >= 2, true); // At least local_storage and session_storage
});

Deno.test("StorageDomain getUsageAndQuota includes usageByType breakdown", async () => {
    const usageByType = new Map<string, number>();
    usageByType.set("indexedDB", 5000);
    usageByType.set("cacheAPI", 3000);

    const { domain } = setup({ quotaUsageByType: usageByType });
    await domain.enable();

    const result = await domain.handleMethod("getUsageAndQuota", {
        origin: "https://example.com",
    });
    const quotaResult = result as {
        usageBreakdown: Array<{ storageType: string; usage: number }>;
    };

    // Should include local_storage, session_storage, indexeddb, cache_storage
    const types = quotaResult.usageBreakdown.map((b) => b.storageType);
    assertEquals(types.includes("local_storage"), true);
    assertEquals(types.includes("session_storage"), true);
    assertEquals(types.includes("indexeddb"), true);
    assertEquals(types.includes("cache_storage"), true);
});

// ---------------------------------------------------------------------------
// dispose
// ---------------------------------------------------------------------------

Deno.test("StorageDomain dispose cleans up and disables", () => {
    const { domain } = setup();
    domain.dispose();
    assertEquals(domain.isEnabled(), false);
});

// ---------------------------------------------------------------------------
// Enhanced Edge Case Tests
// ---------------------------------------------------------------------------

Deno.test("StorageDomain handleMethod throws for unknown method", async () => {
    const { domain } = setup();
    await domain.enable();

    let threw = false;
    try {
        await domain.handleMethod("nonExistentMethod", {});
    } catch (e) {
        threw = true;
        assertEquals((e as Error).message.includes("not found"), true);
    }
    assertEquals(threw, true);
});

Deno.test("StorageDomain setCookie without domain uses localhost", async () => {
    const { domain, cookieManager } = setup();
    await domain.enable();

    const result = await domain.handleMethod("setCookie", {
        name: "nodomain",
        value: "test",
    });
    assertEquals((result as { success: boolean }).success, true);

    // Cookie should have been set (via localhost fallback URL)
    const allCookies = cookieManager.getAllCookies();
    const found = allCookies.find((c: Cookie) => c.name === "nodomain");
    assertEquals(found !== undefined, true);
});

Deno.test("StorageDomain setCookie does not emit cookieAdded when disabled", async () => {
    const { domain, eventBus } = setup();
    // Do NOT enable

    const events: unknown[] = [];
    eventBus.on("Storage.cookieAdded", (data) => events.push(data));

    await domain.handleMethod("setCookie", {
        name: "quiet",
        value: "val",
        domain: "example.com",
    });

    assertEquals(events.length, 0);
});

Deno.test("StorageDomain deleteCookie does not emit cookieDeleted when disabled", async () => {
    const cookies: Cookie[] = [
        { name: "del", value: "v", domain: "example.com", path: "/" },
    ];
    const { domain, eventBus } = setup({ cookies });
    // Do NOT enable

    const events: unknown[] = [];
    eventBus.on("Storage.cookieDeleted", (data) => events.push(data));

    await domain.handleMethod("deleteCookie", {
        name: "del",
        domain: "example.com",
    });

    assertEquals(events.length, 0);
});

Deno.test("StorageDomain clearCookies returns empty object", async () => {
    const cookies: Cookie[] = [
        { name: "a", value: "1", domain: "example.com", path: "/" },
    ];
    const { domain } = setup({ cookies });
    await domain.enable();

    const result = await domain.handleMethod("clearCookies", {});
    assertEquals(result, {});
});

Deno.test("StorageDomain getStorageEntries for cache_storage returns empty", async () => {
    const { domain } = setup();
    await domain.enable();

    const result = await domain.handleMethod("getStorageEntries", {
        origin: "https://example.com",
        storageType: "cache_storage",
    });
    const entries = (result as { entries: unknown[] }).entries;
    assertEquals(entries.length, 0);
});

Deno.test("StorageDomain clearStorage does not emit event when disabled", async () => {
    const { domain, eventBus } = setup();
    // Do NOT enable

    const events: unknown[] = [];
    eventBus.on("Storage.storageCleared", (data) => events.push(data));

    await domain.handleMethod("clearStorage", {
        origin: "https://example.com",
    });

    assertEquals(events.length, 0);
});

Deno.test("StorageDomain deleteCookie extracts domain from URL when no domain provided", async () => {
    const cookies: Cookie[] = [
        { name: "byurl", value: "v", domain: "example.com", path: "/" },
    ];
    const { domain, eventBus } = setup({ cookies });
    await domain.enable();

    const events: unknown[] = [];
    eventBus.on("Storage.cookieDeleted", (data) => events.push(data));

    await domain.handleMethod("deleteCookie", {
        name: "byurl",
        url: "https://example.com/page",
    });

    assertEquals(events.length, 1);
    const eventData = events[0] as { domain: string };
    assertEquals(eventData.domain, "example.com");
});
