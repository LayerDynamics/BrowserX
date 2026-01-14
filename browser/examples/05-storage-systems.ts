/**
 * Example 5: Storage Systems - Browser Storage APIs
 *
 * This example demonstrates using browser storage systems independently:
 * - localStorage and sessionStorage
 * - Cookie management
 * - IndexedDB operations
 * - Quota management
 */

import { Browser } from "../src/main.ts";

console.log("=".repeat(60));
console.log("Example 5: Storage Systems");
console.log("=".repeat(60));

// Create browser instance to access storage systems
const browser = new Browser({
    enableStorage: true,
});

// 1. Storage Manager (localStorage and sessionStorage)
console.log("\n1. Working with localStorage and sessionStorage...");

const storageManager = browser.getStorageManager();
const origin = "https://example.com";

// Get localStorage for origin
const localStorage = storageManager.getLocalStorage(origin);
localStorage.setItem("username", "alice");
localStorage.setItem("theme", "dark");
localStorage.setItem("fontSize", "16");
console.log(`✓ Set 3 items in localStorage`);

console.log(`  username: ${localStorage.getItem("username")}`);
console.log(`  theme: ${localStorage.getItem("theme")}`);
console.log(`  localStorage length: ${localStorage.length}`);

// Get sessionStorage for origin
const sessionStorage = storageManager.getSessionStorage(origin);
sessionStorage.setItem("sessionId", "abc123");
sessionStorage.setItem("tempData", "value");
console.log(`✓ Set 2 items in sessionStorage`);

console.log(`  sessionId: ${sessionStorage.getItem("sessionId")}`);
console.log(`  sessionStorage length: ${sessionStorage.length}`);

// Get all origins
const origins = storageManager.getAllOrigins();
console.log(`✓ Origins with storage: ${origins.join(", ")}`);

// Clear sessionStorage
storageManager.clearAllSessionStorage();
console.log(`✓ Cleared all sessionStorage`);
console.log(`  sessionStorage length after clear: ${sessionStorage.length}`);

// 2. Cookie Manager
console.log("\n2. Working with cookies...");

const cookieManager = browser.getCookieManager();

// Set cookies
cookieManager.setCookie(origin, {
    name: "session",
    value: "xyz789",
    domain: "example.com",
    path: "/",
    secure: true,
    httpOnly: true,
    sameSite: "Strict",
    expires: new Date(Date.now() + 86400000), // 24 hours
});
console.log(`✓ Set session cookie`);

cookieManager.setCookie(origin, {
    name: "preferences",
    value: JSON.stringify({ theme: "dark", lang: "en" }),
    domain: "example.com",
    path: "/",
    secure: true,
    sameSite: "Lax",
    expires: new Date(Date.now() + 2592000000), // 30 days
});
console.log(`✓ Set preferences cookie`);

cookieManager.setCookie(origin, {
    name: "tracking",
    value: "disabled",
    domain: "example.com",
    path: "/",
    expires: new Date(Date.now() + 31536000000), // 1 year
});
console.log(`✓ Set tracking cookie`);

// Get cookies
const cookies = cookieManager.getCookies(origin);
console.log(`✓ Retrieved ${cookies.length} cookies for ${origin}:`);
for (const cookie of cookies) {
    console.log(`  ${cookie.name}=${cookie.value}`);
    console.log(`    domain: ${cookie.domain}, path: ${cookie.path}`);
    console.log(`    secure: ${cookie.secure}, httpOnly: ${cookie.httpOnly}`);
}

// Get cookie string (for HTTP requests)
const cookieString = cookieManager.getCookieString(origin);
console.log(`Cookie header string: ${cookieString}`);

// Cookie count
const cookieCount = cookieManager.getCookieCount();
console.log(`Total cookies: ${cookieCount}`);

// Delete a cookie
cookieManager.deleteCookie(origin, "tracking");
console.log(`✓ Deleted tracking cookie`);

const remainingCookies = cookieManager.getCookies(origin);
console.log(`Remaining cookies: ${remainingCookies.length}`);

// 3. Quota Manager
console.log("\n3. Working with quota management...");

const quotaManager = browser.getQuotaManager();

// Get global quota info
const globalQuota = quotaManager.getGlobalQuotaInfo();
console.log(`Global quota:`);
console.log(`  Quota: ${globalQuota.quota} bytes`);
console.log(`  Usage: ${globalQuota.usage} bytes`);
console.log(`  Available: ${(globalQuota.quota - globalQuota.usage)} bytes`);
console.log(`  Percentage used: ${(globalQuota.usage / globalQuota.quota * 100).toFixed(2)}%`);

// Get origin quota
const originQuota = quotaManager.getOriginQuotaInfo(origin);
console.log(`\nOrigin quota for ${origin}:`);
console.log(`  Quota: ${originQuota.quota} bytes`);
console.log(`  Usage: ${originQuota.usage} bytes`);

// Request quota (simulated)
try {
    const granted = quotaManager.requestQuota(origin, 10 * 1024 * 1024); // 10MB
    console.log(`✓ Requested 10MB quota: ${granted ? "granted" : "denied"}`);
} catch (error) {
    console.log(`Quota request failed: ${error}`);
}

// 4. IndexedDB
console.log("\n4. Working with IndexedDB...");

const idb = browser.getIndexedDB();
console.log(`✓ Got IndexedDB instance`);

// Open database
const openRequest = idb.open("exampleDB", 1);

openRequest.onupgradeneeded = (event: any) => {
    const db = event.target.result;

    // Create object store
    const objectStore = db.createObjectStore("users", { keyPath: "id", autoIncrement: true });

    // Create indexes
    objectStore.createIndex("email", "email", { unique: true });
    objectStore.createIndex("name", "name", { unique: false });

    console.log(`✓ Created object store with indexes`);
};

openRequest.onsuccess = (event: any) => {
    const db = event.target.result;
    console.log(`✓ Opened database: ${db.name} (version ${db.version})`);

    // Start transaction
    const transaction = db.transaction(["users"], "readwrite");
    const objectStore = transaction.objectStore("users");

    // Add data
    const user1 = objectStore.add({
        name: "Alice",
        email: "alice@example.com",
        age: 30,
    });

    const user2 = objectStore.add({
        name: "Bob",
        email: "bob@example.com",
        age: 25,
    });

    user1.onsuccess = () => console.log(`✓ Added user: Alice`);
    user2.onsuccess = () => console.log(`✓ Added user: Bob`);

    transaction.oncomplete = () => {
        console.log(`✓ Transaction completed`);

        // Read data
        const readTransaction = db.transaction(["users"], "readonly");
        const readStore = readTransaction.objectStore("users");

        const getAllRequest = readStore.getAll();
        getAllRequest.onsuccess = () => {
            const users = getAllRequest.result;
            console.log(`✓ Retrieved ${users.length} users from database`);
            for (const user of users) {
                console.log(`  ${user.name} (${user.email}), age ${user.age}`);
            }
        };

        // Query by index
        const index = readStore.index("email");
        const getByEmailRequest = index.get("alice@example.com");
        getByEmailRequest.onsuccess = () => {
            const user = getByEmailRequest.result;
            if (user) {
                console.log(`✓ Found user by email: ${user.name}`);
            }
        };

        db.close();
    };
};

openRequest.onerror = (event: any) => {
    console.error(`IndexedDB error:`, event.target.error);
};

// Wait a bit for IDB operations to complete
await new Promise((resolve) => setTimeout(resolve, 100));

// 5. Cache Storage
console.log("\n5. Working with Cache Storage...");

const cacheStorage = browser.getCacheStorage(origin);
console.log(`✓ Got Cache Storage for ${origin}`);

// Open cache
const cache = await cacheStorage.open("api-cache");
console.log(`✓ Opened cache: api-cache`);

// Put request/response in cache (simulated)
const request = {
    id: "req-1" as any,
    method: "GET" as any,
    url: "https://example.com/api/data" as any,
    version: "1.1" as any,
    headers: new Map([["accept", "application/json"]]),
    createdAt: Date.now(),
};

const response = {
    id: "req-1" as any,
    statusCode: 200,
    statusText: "OK",
    version: "1.1" as any,
    headers: new Map([
        ["content-type", "application/json"],
        ["cache-control", "max-age=3600"],
    ]),
    body: new TextEncoder().encode(JSON.stringify({ data: "example" })),
    receivedAt: Date.now(),
    fromCache: false,
    timings: {
        dnsStart: 0,
        dnsEnd: 0,
        connectStart: 0,
        connectEnd: 0,
        requestStart: 0,
        responseStart: 0,
        responseEnd: 0,
        duration: 0,
    },
};

await cache.put(request, response);
console.log(`✓ Cached API response`);

// Match from cache
const cachedResponse = await cache.match(request);
if (cachedResponse) {
    console.log(`✓ Retrieved response from cache`);
    console.log(`  Status: ${cachedResponse.statusCode}`);
}

// List all caches
const cacheNames = await cacheStorage.keys();
console.log(`✓ Available caches: ${cacheNames.join(", ")}`);

// 6. Final Statistics
console.log("\n6. Final storage statistics...");

const finalStats = browser.getStats();
console.log(`Storage statistics:`);
console.log(`  Cookies: ${finalStats.storage.cookies}`);
console.log(`  Origins with data: ${finalStats.storage.origins.length}`);
console.log(`  Global quota used: ${finalStats.storage.quota.usage} / ${finalStats.storage.quota.quota} bytes`);

// Cleanup
console.log("\n7. Cleanup...");
browser.clearData();
console.log(`✓ Cleared all browser data`);

await browser.close();
console.log(`✓ Closed browser`);

console.log("\n" + "=".repeat(60));
console.log("Example complete!");
console.log("Demonstrated: localStorage, sessionStorage, cookies,");
console.log("IndexedDB, quota management, and cache storage.");
console.log("=".repeat(60));
