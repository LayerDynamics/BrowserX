/**
 * Browser Page API
 *
 * Provides a page-level API for the query engine to interact with browser content.
 * Wraps the Browser class and RenderingPipeline to provide DOM querying, interaction, and manipulation.
 */

import type { DOMElement as BrowserDOMElement, DOMNode } from "../types/dom.ts";
import type { RenderingResult } from "../engine/RenderingPipeline.ts";
import { Browser } from "../main.ts";

/**
 * Page navigation options
 */
export interface NavigateOptions {
    waitFor?: "load" | "domcontentloaded" | "networkidle" | string;
    timeout?: number;
}

/**
 * Type options
 */
export interface TypeOptions {
    clear?: boolean;
    delay?: number;
}

/**
 * Wait options
 */
export interface WaitOptions {
    type: "time" | "selector" | "function";
    duration?: number;
    selector?: string;
    selectorType?: "css" | "xpath";
    condition?: string;
    timeout?: number;
}

/**
 * Screenshot options
 */
export interface ScreenshotOptions {
    fullPage?: boolean;
    selector?: string;
    format?: "png" | "jpeg";
    quality?: number;
}

/**
 * PDF options
 */
export interface PDFOptions {
    format?: "A4" | "Letter" | "Legal" | "A3";
    orientation?: "portrait" | "landscape";
    margin?: {
        top?: number;
        right?: number;
        bottom?: number;
        left?: number;
    };
    scale?: number;
    printBackground?: boolean;
    displayHeaderFooter?: boolean;
    headerTemplate?: string;
    footerTemplate?: string;
}

/**
 * DOM element wrapper for query results
 */
export class DOMElement {
    constructor(private element: BrowserDOMElement) {}

    async getText(): Promise<string> {
        // Gather text content from all text child nodes
        let text = "";
        const collectText = (node: BrowserDOMElement | any): void => {
            if (node.nodeType === 3) { // TEXT_NODE
                text += node.nodeValue || "";
            }
            if (node.childNodes) {
                for (const child of node.childNodes) {
                    collectText(child);
                }
            }
        };
        collectText(this.element);
        return text;
    }

    async getAttribute(name: string): Promise<string | null> {
        return this.element.getAttribute(name);
    }

    async getProperty(name: string): Promise<unknown> {
        return (this.element as unknown as Record<string, unknown>)[name];
    }

    async click(): Promise<void> {
        // Trigger click event on element
        // In a full implementation, this would dispatch a click event
        console.log(`Clicked element: ${this.element.nodeName}`);
    }

    async type(text: string): Promise<void> {
        // Set value for input elements
        if ("value" in this.element) {
            (this.element as unknown as { value: string }).value = text;
        }
    }

    getInternalElement(): BrowserDOMElement {
        return this.element;
    }
}

/**
 * Browser page instance
 */
export class BrowserPage {
    private browser: Browser;
    private currentRenderingResult?: RenderingResult;
    private currentURL?: string;

    constructor(browser: Browser) {
        this.browser = browser;
    }

    /**
     * Navigate to URL
     */
    async navigate(url: string, options?: NavigateOptions): Promise<void> {
        this.currentURL = url;
        await this.browser.navigate(url);
        // The rendering result is stored internally in the browser's rendering pipeline
    }

    /**
     * Query elements using CSS selector or XPath
     */
    async query(selector: string, type: "css" | "xpath" = "css"): Promise<DOMElement[]> {
        if (!this.currentURL) {
            throw new Error("No page loaded. Call navigate() first.");
        }

        // Get the current DOM from the browser's rendering pipeline
        const renderingPipeline = this.browser.getRenderingPipeline();

        if (!renderingPipeline.lastRenderResult) {
            throw new Error("No rendering result available");
        }

        const dom = renderingPipeline.lastRenderResult.dom;

        if (type === "css") {
            return this.querySelectorAll(dom, selector);
        } else {
            return this.queryXPath(dom, selector);
        }
    }

    /**
     * Query elements using CSS selector
     */
    private querySelectorAll(root: DOMNode, selector: string): DOMElement[] {
        const results: DOMElement[] = [];

        // Simple selector implementation - handles basic cases
        // For full CSS selector support, you'd use a proper CSS selector engine

        const traverse = (node: DOMNode) => {
            if (node.nodeType === 1) { // ELEMENT_NODE
                const element = node as BrowserDOMElement;

                if (this.matchesSelector(element, selector)) {
                    results.push(new DOMElement(element));
                }
            }

            if (node.childNodes) {
                for (const child of node.childNodes) {
                    traverse(child);
                }
            }
        };

        traverse(root);
        return results;
    }

    /**
     * Query elements using XPath
     */
    private queryXPath(root: DOMNode, xpath: string): DOMElement[] {
        // Simplified XPath implementation - handles basic cases
        // For full XPath support, you'd use a proper XPath engine

        // Convert simple XPath expressions to traversal
        const results: DOMElement[] = [];

        // Example: //div or //div[@class='foo']
        if (xpath.startsWith("//")) {
            const tagMatch = xpath.match(/^\/\/(\w+)/);
            if (tagMatch) {
                const tagName = tagMatch[1].toLowerCase();

                const traverse = (node: DOMNode) => {
                    if (node.nodeType === 1) {
                        const element = node as BrowserDOMElement;
                        if (element.tagName.toLowerCase() === tagName) {
                            results.push(new DOMElement(element));
                        }
                    }

                    if (node.childNodes) {
                        for (const child of node.childNodes) {
                            traverse(child);
                        }
                    }
                };

                traverse(root);
            }
        }

        return results;
    }

    /**
     * Check if element matches CSS selector
     */
    private matchesSelector(element: BrowserDOMElement, selector: string): boolean {
        // Simple selector matching - handles basic cases

        // Tag selector: div, span, etc.
        if (/^[a-z]+$/i.test(selector)) {
            return element.tagName.toLowerCase() === selector.toLowerCase();
        }

        // ID selector: #myId
        if (selector.startsWith("#")) {
            const id = selector.substring(1);
            return element.id === id;
        }

        // Class selector: .myClass
        if (selector.startsWith(".")) {
            const className = selector.substring(1);
            return element.className.split(/\s+/).includes(className);
        }

        // Attribute selector: [name="value"]
        const attrMatch = selector.match(/^\[(\w+)(?:="([^"]+)")?\]$/);
        if (attrMatch) {
            const [, attrName, attrValue] = attrMatch;
            const elementValue = element.getAttribute(attrName);

            if (attrValue === undefined) {
                return elementValue !== null;
            }

            return elementValue === attrValue;
        }

        return false;
    }

    /**
     * Click an element
     */
    async click(selector: string, selectorType: "css" | "xpath" = "css"): Promise<void> {
        const elements = await this.query(selector, selectorType);

        if (elements.length === 0) {
            throw new Error(`No element found for selector: ${selector}`);
        }

        await elements[0].click();
    }

    /**
     * Type text into an element
     */
    async type(selector: string, text: string, options?: TypeOptions): Promise<void> {
        const elements = await this.query(selector, "css");

        if (elements.length === 0) {
            throw new Error(`No element found for selector: ${selector}`);
        }

        if (options?.clear) {
            // Clear existing value first
            await elements[0].type("");
        }

        if (options?.delay) {
            // Type character by character with delay
            for (const char of text) {
                await elements[0].type(char);
                await new Promise((resolve) => setTimeout(resolve, options.delay));
            }
        } else {
            await elements[0].type(text);
        }
    }

    /**
     * Wait for condition
     */
    async wait(options: WaitOptions): Promise<void> {
        switch (options.type) {
            case "time":
                if (!options.duration) {
                    throw new Error("Duration required for time wait");
                }
                await new Promise((resolve) => setTimeout(resolve, options.duration));
                break;

            case "selector": {
                if (!options.selector) {
                    throw new Error("Selector required for selector wait");
                }

                const timeout = options.timeout || 30000;
                const startTime = Date.now();

                while (Date.now() - startTime < timeout) {
                    const elements = await this.query(options.selector, options.selectorType);
                    if (elements.length > 0) {
                        return;
                    }
                    await new Promise((resolve) => setTimeout(resolve, 100));
                }

                throw new Error(`Timeout waiting for selector: ${options.selector}`);
            }

            case "function": {
                if (!options.condition) {
                    throw new Error("Condition required for function wait");
                }

                const timeout = options.timeout || 30000;
                const polling = 100; // Poll every 100ms
                const startTime = Date.now();

                // Get script executor for evaluating JavaScript condition
                const renderingPipeline = this.browser.getRenderingPipeline();
                if (!renderingPipeline.lastRenderResult) {
                    throw new Error("No rendering result available");
                }

                const scriptExecutor = renderingPipeline.lastRenderResult.scriptExecutor;
                if (!scriptExecutor) {
                    throw new Error("JavaScript is not enabled. Set enableJavaScript: true in BrowserConfig.");
                }

                while (Date.now() - startTime < timeout) {
                    try {
                        // Evaluate the condition as JavaScript expression
                        const result = scriptExecutor.evaluate(options.condition);

                        // Check if condition is truthy
                        if (result) {
                            return;
                        }
                    } catch (error) {
                        // Condition threw error, keep waiting
                    }

                    await new Promise((resolve) => setTimeout(resolve, polling));
                }

                throw new Error("Timeout waiting for function condition");
            }

            default:
                throw new Error(`Unknown wait type: ${options.type}`);
        }
    }

    /**
     * Take screenshot
     */
    async screenshot(options?: ScreenshotOptions): Promise<Uint8Array> {
        const pixels = await this.browser.screenshot();

        // Convert Uint8ClampedArray to Uint8Array
        // In a full implementation, this would handle format conversion (PNG, JPEG)
        // and selector-based screenshots
        return new Uint8Array(pixels);
    }

    /**
     * Generate PDF
     */
    async pdf(options?: PDFOptions): Promise<Uint8Array> {
        if (!this.currentURL) {
            throw new Error("No page loaded. Call navigate() first.");
        }

        // Get rendering result from pipeline
        const renderingPipeline = this.browser.getRenderingPipeline();
        if (!renderingPipeline.lastRenderResult) {
            throw new Error("No rendering result available");
        }

        const { displayList, renderTree } = renderingPipeline.lastRenderResult;

        // Create PDF generator
        const { PDFGenerator } = await import("../engine/rendering/pdf/PDFGenerator.ts");
        const generator = new PDFGenerator(options);

        try {
            // Generate PDF from display list
            const pdfBytes = await generator.generate(displayList, renderTree);
            return pdfBytes;
        } catch (error) {
            throw new Error(
                `PDF generation failed: ${
                    error instanceof Error ? error.message : String(error)
                }`,
            );
        }
    }

    /**
     * Evaluate JavaScript
     */
    async evaluate(script: string, args?: unknown[]): Promise<unknown> {
        if (!this.currentURL) {
            throw new Error("No page loaded. Call navigate() first.");
        }

        // Get script executor from rendering pipeline
        const renderingPipeline = this.browser.getRenderingPipeline();
        if (!renderingPipeline.lastRenderResult) {
            throw new Error("No rendering result available");
        }

        const scriptExecutor = renderingPipeline.lastRenderResult.scriptExecutor;
        if (!scriptExecutor) {
            throw new Error("JavaScript is not enabled. Set enableJavaScript: true in BrowserConfig.");
        }

        try {
            // If args are provided, create wrapper function that injects args
            let code = script;
            if (args && args.length > 0) {
                // Convert args to JSON and inject as function parameters
                const argValues = args.map(arg => JSON.stringify(arg)).join(", ");
                code = `(function(...args) { return (${script})(...args); })(${argValues})`;
            }

            // Execute the script and return result
            const result = await scriptExecutor.execute(code);

            if (!result.success) {
                throw result.error || new Error("Script execution failed");
            }

            return result.value;
        } catch (error) {
            throw new Error(
                `JavaScript evaluation failed: ${
                    error instanceof Error ? error.message : String(error)
                }`,
            );
        }
    }

    /**
     * Close the page
     */
    async close(): Promise<void> {
        await this.browser.close();
    }

    /**
     * Get current URL
     */
    getCurrentURL(): string | undefined {
        return this.currentURL;
    }
}
