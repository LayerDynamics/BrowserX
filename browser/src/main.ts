/**
 * Browser Main Entry Point
 *
 * Initializes the browser process and starts the engine.
 * Integrates request pipeline, rendering pipeline, and all browser subsystems.
 */

import type { DOMNode } from "./types/dom.ts";
import { RequestPipeline } from "./engine/RequestPipeline.ts";
import { RenderingPipeline } from "./engine/RenderingPipeline.ts";
import { StorageManager } from "./engine/storage/StorageManager.ts";
import { CookieManager } from "./engine/storage/CookieManager.ts";
import { QuotaManager } from "./engine/storage/QuotaManager.ts";
import { cacheStorageManager } from "./engine/storage/CacheAPI.ts";
import { indexedDB } from "./engine/storage/IDBDatabase.ts";

/**
 * Browser configuration
 */
export interface BrowserConfig {
    width?: number;
    height?: number;
    defaultURL?: string;
    enableJavaScript?: boolean;
    enableStorage?: boolean;
    devicePixelRatio?: number;
}

/**
 * Browser instance
 */
export class Browser {
    private requestPipeline: RequestPipeline;
    private renderingPipeline: RenderingPipeline;
    private storageManager: StorageManager;
    private cookieManager: CookieManager;
    private quotaManager: QuotaManager;
    private currentURL: string | null = null;
    private config: Required<BrowserConfig>;

    constructor(config: BrowserConfig = {}) {
        this.config = {
            width: config.width ?? 1024,
            height: config.height ?? 768,
            defaultURL: config.defaultURL ?? "about:blank",
            enableJavaScript: config.enableJavaScript ?? false,
            enableStorage: config.enableStorage ?? true,
            devicePixelRatio: config.devicePixelRatio ?? 1.0,
        };

        // Initialize subsystems
        this.quotaManager = new QuotaManager();
        this.storageManager = new StorageManager(this.quotaManager);
        this.cookieManager = new CookieManager();
        this.requestPipeline = new RequestPipeline();
        this.renderingPipeline = new RenderingPipeline({
            width: this.config.width,
            height: this.config.height,
            devicePixelRatio: this.config.devicePixelRatio,
            enableJavaScript: this.config.enableJavaScript,
        });

        console.log(`Browser initialized:
  - Viewport: ${this.config.width}x${this.config.height}
  - Device Pixel Ratio: ${this.config.devicePixelRatio}
  - JavaScript: ${this.config.enableJavaScript ? "enabled" : "disabled"}
  - Storage: ${this.config.enableStorage ? "enabled" : "disabled"}
        `);
    }

    /**
     * Navigate to URL
     */
    async navigate(url: string): Promise<void> {
        try {
            console.log(`\nNavigating to: ${url}`);
            const startTime = Date.now();

            // Render the page
            const result = await this.renderingPipeline.render(url);

            const totalTime = Date.now() - startTime;
            this.currentURL = url;

            // Log results
            console.log(`\nPage loaded successfully!`);
            console.log(`Total time: ${totalTime}ms`);
            console.log(`\nTiming breakdown:`);
            console.log(`  - HTML fetch: ${result.timing.htmlFetch}ms`);
            console.log(`  - HTML parse: ${result.timing.htmlParse}ms`);
            console.log(`  - CSS fetch: ${result.timing.cssFetch}ms`);
            console.log(`  - CSS parse: ${result.timing.cssParse}ms`);
            console.log(`  - Script execution: ${result.timing.scriptExecution}ms`);
            console.log(`  - Style resolution: ${result.timing.styleResolution}ms`);
            console.log(`  - Layout: ${result.timing.layoutComputation}ms`);
            console.log(`  - Paint: ${result.timing.paintRecording}ms`);
            console.log(`  - Composite: ${result.timing.compositing}ms`);

            console.log(`\nResources loaded: ${result.resources.length}`);
            for (const resource of result.resources) {
                console.log(
                    `  - ${resource.type}: ${resource.url} (${resource.size} bytes, ${
                        resource.cached ? "cached" : "fetched"
                    })`,
                );
            }

            console.log(`\nDOM nodes: ${this.countNodes(result.dom)}`);
            console.log(`CSS rules: ${result.cssom.getRuleCount()}`);
        } catch (error) {
            console.error(`Failed to navigate to ${url}:`, error);
            throw error;
        }
    }

    /**
     * Go back in history
     */
    back(): void {
        // TODO: Implement history navigation
        console.log("Back navigation not yet implemented");
    }

    /**
     * Go forward in history
     */
    forward(): void {
        // TODO: Implement history navigation
        console.log("Forward navigation not yet implemented");
    }

    /**
     * Reload current page
     */
    async reload(): Promise<void> {
        if (this.currentURL) {
            await this.navigate(this.currentURL);
        }
    }

    /**
     * Take screenshot
     */
    async screenshot(): Promise<Uint8ClampedArray> {
        return await this.renderingPipeline.screenshot();
    }

    /**
     * Set viewport size
     */
    setViewportSize(width: number, height: number): void {
        this.config.width = width;
        this.config.height = height;
        this.renderingPipeline.setViewportSize(width, height);
        console.log(`Viewport resized to: ${width}x${height}`);
    }

    /**
     * Get browser statistics
     */
    getStats() {
        return {
            currentURL: this.currentURL,
            viewport: {
                width: this.config.width,
                height: this.config.height,
            },
            storage: {
                quota: this.quotaManager.getGlobalQuotaInfo(),
                cookies: this.cookieManager.getCookieCount(),
                origins: this.storageManager.getAllOrigins(),
            },
            rendering: this.renderingPipeline.getStats(),
        };
    }

    /**
     * Clear all browser data
     */
    clearData(): void {
        console.log("Clearing browser data...");
        this.cookieManager.clearAll();
        this.storageManager.clearAllSessionStorage();
        this.renderingPipeline.clearCache();
        this.quotaManager.clearAll();
        console.log("Browser data cleared");
    }

    // ========================================================================
    // Subsystem Access - Composable Toolkit API
    // ========================================================================

    /**
     * Get request pipeline
     *
     * Provides access to the HTTP request pipeline for direct network operations.
     *
     * The request pipeline orchestrates:
     * - DNS resolution with caching
     * - Connection pooling and reuse
     * - TLS handshake management
     * - HTTP request/response processing
     * - HTTP caching with ETags and Last-Modified
     *
     * Use this to:
     * - Make HTTP requests independently
     * - Access DNS and connection caches
     * - Monitor network statistics
     * - Configure request options (headers, timeout, redirects)
     *
     * @returns {RequestPipeline} The request pipeline instance
     * @example
     * ```typescript
     * const browser = new Browser();
     * const requestPipeline = browser.getRequestPipeline();
     * const result = await requestPipeline.get("https://api.example.com/data");
     * console.log(`Status: ${result.response.statusCode}`);
     * ```
     */
    getRequestPipeline(): RequestPipeline {
        return this.requestPipeline;
    }

    /**
     * Get rendering pipeline
     *
     * Provides access to the rendering pipeline for page rendering and layout.
     *
     * The rendering pipeline orchestrates:
     * - HTML fetching and parsing (DOM construction)
     * - CSS fetching and parsing (CSSOM construction)
     * - JavaScript execution
     * - Style resolution and render tree construction
     * - Layout computation (box model, flexbox, grid)
     * - Paint recording (display list generation)
     * - Compositing (layer merging and pixel output)
     *
     * Use this to:
     * - Render pages independently
     * - Access DOM and CSSOM
     * - Control viewport and rendering settings
     * - Take screenshots
     * - Monitor rendering statistics
     *
     * @returns {RenderingPipeline} The rendering pipeline instance
     * @example
     * ```typescript
     * const browser = new Browser();
     * const renderingPipeline = browser.getRenderingPipeline();
     * const result = await renderingPipeline.render("https://example.com");
     * console.log(`DOM nodes: ${countNodes(result.dom)}`);
     * ```
     */
    getRenderingPipeline(): RenderingPipeline {
        return this.renderingPipeline;
    }

    /**
     * Get storage manager
     *
     * Provides access to localStorage and sessionStorage management.
     *
     * The storage manager handles:
     * - localStorage per origin with quota enforcement
     * - sessionStorage per origin (cleared on close)
     * - Storage event dispatching
     * - Quota tracking and enforcement
     *
     * Use this to:
     * - Access storage APIs directly
     * - Manage storage across origins
     * - Monitor storage usage
     * - Clear storage data
     *
     * @returns {StorageManager} The storage manager instance
     * @example
     * ```typescript
     * const browser = new Browser();
     * const storageManager = browser.getStorageManager();
     * const localStorage = storageManager.getLocalStorage("https://example.com");
     * localStorage.setItem("key", "value");
     * ```
     */
    getStorageManager(): StorageManager {
        return this.storageManager;
    }

    /**
     * Get cookie manager
     *
     * Provides access to HTTP cookie management with domain and path matching.
     *
     * The cookie manager handles:
     * - Cookie storage with expiration
     * - Domain and path matching
     * - Secure and HttpOnly flags
     * - SameSite attribute enforcement
     * - Cookie serialization for requests
     *
     * Use this to:
     * - Manage cookies across origins
     * - Set and retrieve cookies
     * - Monitor cookie count and usage
     * - Clear cookie data
     *
     * @returns {CookieManager} The cookie manager instance
     * @example
     * ```typescript
     * const browser = new Browser();
     * const cookieManager = browser.getCookieManager();
     * cookieManager.setCookie("https://example.com", {
     *   name: "session",
     *   value: "abc123",
     *   path: "/",
     *   secure: true
     * });
     * ```
     */
    getCookieManager(): CookieManager {
        return this.cookieManager;
    }

    /**
     * Get quota manager
     *
     * Provides access to storage quota management and enforcement.
     *
     * The quota manager handles:
     * - Global and per-origin quota limits
     * - Storage usage tracking
     * - Quota enforcement (throws on exceeding limits)
     * - Persistent vs temporary storage
     *
     * Use this to:
     * - Monitor storage quota across origins
     * - Configure quota limits
     * - Track storage usage
     * - Clear quota data
     *
     * @returns {QuotaManager} The quota manager instance
     * @example
     * ```typescript
     * const browser = new Browser();
     * const quotaManager = browser.getQuotaManager();
     * const info = quotaManager.getGlobalQuotaInfo();
     * console.log(`Used: ${info.usage} / ${info.quota} bytes`);
     * ```
     */
    getQuotaManager(): QuotaManager {
        return this.quotaManager;
    }

    /**
     * Close browser
     */
    async close(): Promise<void> {
        console.log("Closing browser...");
        await this.renderingPipeline.close();
        await this.requestPipeline.close();
        this.cookieManager.dispose();
        console.log("Browser closed");
    }

    /**
     * Count DOM nodes recursively
     */
    private countNodes(node: DOMNode): number {
        let count = 1;
        if (node.childNodes && node.childNodes.length > 0) {
            for (const child of node.childNodes) {
                count += this.countNodes(child);
            }
        }
        return count;
    }

    /**
     * Get current URL
     *
     * Returns the URL of the currently loaded page, or null if no page is loaded.
     *
     * @returns {string | null} The current URL or null
     * @example
     * ```typescript
     * const browser = new Browser();
     * await browser.navigate("https://example.com");
     * console.log(browser.getCurrentURL()); // "https://example.com"
     * ```
     */
    getCurrentURL(): string | null {
        return this.currentURL;
    }

    /**
     * Get IndexedDB
     *
     * Provides access to the global IndexedDB instance.
     *
     * IndexedDB provides:
     * - Object stores for structured data
     * - Indexes for efficient querying
     * - Transactions for consistency
     * - Versioning for schema upgrades
     *
     * @returns The global IndexedDB instance
     * @example
     * ```typescript
     * const browser = new Browser();
     * const idb = browser.getIndexedDB();
     * const request = idb.open("myDatabase", 1);
     * ```
     */
    getIndexedDB() {
        return indexedDB;
    }

    /**
     * Get Cache Storage
     *
     * Provides access to the Cache Storage API for the specified origin.
     *
     * Cache Storage provides:
     * - Named caches for HTTP responses
     * - Service worker cache support
     * - Request/response matching
     * - Cache lifecycle management
     *
     * @param {string} origin - The origin to get cache storage for
     * @returns Cache storage instance for the origin
     * @example
     * ```typescript
     * const browser = new Browser();
     * const cache = browser.getCacheStorage("https://example.com");
     * const httpCache = await cache.open("http-cache");
     * ```
     */
    getCacheStorage(origin: string) {
        return cacheStorageManager.getStorage(origin);
    }
}

/**
 * Main browser entry point
 */
export async function main(): Promise<void> {
    console.log("=".repeat(60));
    console.log("GeoProx Browser - Starting");
    console.log("=".repeat(60));

    // Create browser instance
    const browser = new Browser({
        width: 1024,
        height: 768,
        enableJavaScript: false,
        enableStorage: true,
    });

    // Load default page or command-line argument
    const url = Deno.args[0] || "about:blank";

    if (url !== "about:blank") {
        try {
            await browser.navigate(url);

            // Display stats
            console.log("\n" + "=".repeat(60));
            console.log("Browser Statistics");
            console.log("=".repeat(60));
            const stats = browser.getStats();
            console.log(JSON.stringify(stats, null, 2));
        } catch (error) {
            console.error("Failed to load page:", error);
        }
    }

    console.log("\n" + "=".repeat(60));
    console.log("Browser ready. Use browser.navigate(url) to load pages.");
    console.log("=".repeat(60));

    // Keep browser running in REPL mode if no URL provided
    if (url === "about:blank") {
        console.log("\nREPL mode - browser instance available as 'browser'");
        (globalThis as unknown as { browser: Browser }).browser = browser;
    } else {
        // Close after loading if URL was provided
        await browser.close();
    }
}

// Run if this is the main module
if (import.meta.main) {
    await main();
}
