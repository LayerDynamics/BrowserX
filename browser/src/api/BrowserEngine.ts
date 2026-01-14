/**
 * Browser Engine API
 *
 * Provides a high-level API for creating and managing browser instances and pages.
 * This is the main entry point for the query-engine to interact with the browser.
 */

import { Browser, type BrowserConfig } from "../main.ts";
import { BrowserPage } from "./BrowserPage.ts";

/**
 * Browser engine interface
 */
export interface IBrowserEngine {
    newPage(): Promise<BrowserPage>;
    close(): Promise<void>;
}

/**
 * Browser engine implementation
 */
export class BrowserEngine implements IBrowserEngine {
    private browser: Browser;
    private pages: BrowserPage[] = [];

    constructor(config?: BrowserConfig) {
        // Create browser instance with default configuration
        this.browser = new Browser(
            config || {
                width: 1024,
                height: 768,
                enableJavaScript: false,
                enableStorage: true,
            },
        );
    }

    /**
     * Create a new page
     */
    async newPage(): Promise<BrowserPage> {
        const page = new BrowserPage(this.browser);
        return page;
    }

    /**
     * Close the browser engine
     */
    async close(): Promise<void> {
        await this.browser.close();
    }

    /**
     * Get the underlying browser instance
     */
    getBrowser(): Browser {
        return this.browser;
    }
}
