/**
 * Script Executor
 *
 * Executes JavaScript code in the context of a web page.
 * Manages V8 isolate, context, and DOM bindings.
 */

import type { DOMDocument, DOMElement, DOMNode } from "../../types/dom.ts";
import { DOMNodeType } from "../../types/dom.ts";
import type { JSValue } from "./JSValue.ts";
import type { ByteBuffer } from "../../types/identifiers.ts";
import { V8Isolate } from "./V8Isolate.ts";
import { V8Context } from "./V8Context.ts";
import { WindowObject } from "./WindowObject.ts";
import { EventLoop } from "./EventLoop.ts";
import type { RequestPipeline } from "../RequestPipeline.ts";
import { BrowserConsole } from "../logging/BrowserConsole.ts";
import { StorageManager } from "../storage/StorageManager.ts";
import type { ContentSecurityPolicy } from "../security/ContentSecurityPolicy.ts";

/**
 * DOM node with event listeners registry (installed by DOMBindings)
 */
interface DOMNodeWithEvents extends DOMNode {
    readyState?: string;
    __eventListeners?: Map<string, Array<JSValue>>;
}

/**
 * Script type
 */
export type ScriptType = "classic" | "module";

/**
 * Script execution options
 */
export interface ScriptExecutionOptions {
    type?: ScriptType;
    async?: boolean;
    defer?: boolean;
    timeout?: number;
    sourceURL?: string;
}

/**
 * Script execution result
 */
export interface ScriptExecutionResult {
    success: boolean;
    value?: unknown;
    error?: Error;
    executionTime: number;
}

/**
 * Script Executor
 */
export class ScriptExecutor {
    private logger = new BrowserConsole("ScriptExecutor");
    private isolate: V8Isolate;
    private context: V8Context;
    private windowObject: WindowObject;
    private eventLoop: EventLoop;
    private document: DOMNode;
    private url: string;
    private scriptsExecuted: number = 0;
    private csp?: ContentSecurityPolicy;

    constructor(document: DOMNode, url: string, requestPipeline?: RequestPipeline, storageManager?: StorageManager) {
        this.document = document;
        this.url = url;

        // Create V8 isolate and context
        this.isolate = new V8Isolate();
        this.context = this.isolate.createContext();

        // Ensure StorageManager is always available — create a default if none provided
        // This guarantees origin-isolated, quota-tracked storage even for standalone usage
        const effectiveStorageManager = storageManager ?? new StorageManager();

        // Create window object and install Web APIs
        this.windowObject = new WindowObject(this.context, document, url, requestPipeline, effectiveStorageManager);
        this.windowObject.install();

        // Create event loop
        this.eventLoop = new EventLoop();
    }

    /**
     * Execute JavaScript code
     */
    async execute(
        code: string,
        options: ScriptExecutionOptions = {},
    ): Promise<ScriptExecutionResult> {
        const startTime = Date.now();

        try {
            // Check if script execution should be deferred
            if (options.defer) {
                // Defer execution until DOM is ready
                await this.waitForDOMReady();
            }

            // Execute the script
            let result: unknown;

            if (options.async) {
                // Async script - execute asynchronously
                result = await this.executeAsync(code, options);
            } else {
                // Sync script - execute immediately
                result = this.executeSync(code, options);
            }

            this.scriptsExecuted++;

            return {
                success: true,
                value: result,
                executionTime: Date.now() - startTime,
            };
        } catch (error) {
            this.logger.error("Script execution error:", error);

            return {
                success: false,
                error: error instanceof Error ? error : new Error(String(error)),
                executionTime: Date.now() - startTime,
            };
        }
    }

    /**
     * Execute script synchronously
     */
    private executeSync(code: string, options: ScriptExecutionOptions): unknown {
        try {
            // Execute script
            const result = this.context.execute(code);

            // Check if execution failed
            if (!result.success) {
                throw new Error(
                    `Script execution failed: ${result.error?.message || "Unknown error"}`,
                );
            }

            // Process microtasks
            // Note: EventLoop.processMicrotasks() is not yet implemented
            // this.eventLoop.processMicrotasks();

            return result.value;
        } catch (error) {
            throw new Error(
                `Script execution failed: ${
                    error instanceof Error ? error.message : String(error)
                }`,
            );
        }
    }

    /**
     * Execute script asynchronously
     */
    private async executeAsync(code: string, options: ScriptExecutionOptions): Promise<unknown> {
        return new Promise((resolve, reject) => {
            try {
                // Execute in next tick
                queueMicrotask(() => {
                    try {
                        const result = this.executeSync(code, options);
                        resolve(result);
                    } catch (error) {
                        reject(error);
                    }
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Execute external script from URL
     */
    async executeExternal(
        url: string,
        options: ScriptExecutionOptions = {},
    ): Promise<ScriptExecutionResult> {
        try {
            // CSP external script source check
            if (this.csp) {
                const pageOrigin = new URL(this.url).origin;
                if (!this.csp.allows("script-src", url, pageOrigin)) {
                    return {
                        success: false,
                        error: new Error(`Blocked by Content Security Policy: script-src does not allow '${url}'`),
                        executionTime: 0,
                    };
                }
            }

            // Fetch script content (simplified - would use RequestPipeline)
            const response = await fetch(url);
            const code = await response.text();

            // Execute with source URL
            return await this.execute(code, {
                ...options,
                sourceURL: url,
            });
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error : new Error(String(error)),
                executionTime: 0,
            };
        }
    }

    /**
     * Execute inline script from script tag
     */
    async executeInline(scriptElement: DOMNode): Promise<ScriptExecutionResult> {
        // Script elements are always element nodes
        if (scriptElement.nodeType !== DOMNodeType.ELEMENT) {
            throw new Error("Script element must be an element node");
        }

        const element = scriptElement as DOMElement;

        // Extract script content from text children
        let code = "";
        for (const child of element.childNodes) {
            if (child.nodeType === DOMNodeType.TEXT) {
                code += child.nodeValue ?? "";
            }
        }

        // Check for type attribute
        const type = element.attributes?.get("type") ?? "text/javascript";

        // Skip if not JavaScript
        if (type !== "text/javascript" && type !== "application/javascript" && type !== "") {
            return {
                success: true,
                executionTime: 0,
            };
        }

        // CSP inline script check
        if (this.csp) {
            const nonce = element.attributes?.get("nonce") ?? undefined;
            if (!this.csp.allowsInlineScript(nonce)) {
                return {
                    success: false,
                    error: new Error("Blocked by Content Security Policy: inline script not allowed"),
                    executionTime: 0,
                };
            }
        }

        // Check for async/defer attributes
        const async = element.attributes?.has("async") ?? false;
        const defer = element.attributes?.has("defer") ?? false;

        // Execute
        return await this.execute(code, {
            async,
            defer,
            sourceURL: "inline-script",
        });
    }

    /**
     * Evaluate JavaScript expression
     */
    evaluate(expression: string): unknown {
        try {
            const result = this.context.eval(expression);
            return result;
        } catch (error) {
            this.logger.error("Evaluation error:", error);
            return undefined;
        }
    }

    /**
     * Find and execute all scripts in DOM
     */
    async executeScriptsInDOM(): Promise<ScriptExecutionResult[]> {
        const scripts = this.findScriptElements(this.document);
        const results: ScriptExecutionResult[] = [];

        // Separate scripts by execution timing per HTML spec:
        // 1. Non-deferred, non-async scripts execute in document order
        // 2. Deferred scripts execute after parsing in document order
        // 3. Async scripts fire independently (handled by execute() options.async)
        const immediateScripts: DOMNode[] = [];
        const deferredScripts: DOMNode[] = [];

        for (const script of scripts) {
            if (script.nodeType !== DOMNodeType.ELEMENT) continue;
            const el = script as DOMElement;
            const isDefer = el.attributes?.has("defer") ?? false;
            if (isDefer) {
                deferredScripts.push(script);
            } else {
                immediateScripts.push(script);
            }
        }

        // Execute immediate scripts first (in document order)
        for (const script of immediateScripts) {
            const result = await this.executeScriptElement(script as DOMElement);
            results.push(result);
        }

        // Dispatch DOMContentLoaded — DOM is interactive, deferred scripts about to run
        this.dispatchDocumentEvent("DOMContentLoaded");

        // Execute deferred scripts after immediate scripts (in document order)
        // waitForDOMReady() is called inside execute() when defer=true
        for (const script of deferredScripts) {
            const result = await this.executeScriptElement(script as DOMElement);
            results.push(result);
        }

        // All scripts executed — mark document as complete
        const doc = this.document as DOMNodeWithEvents;
        if (doc.readyState) {
            doc.readyState = "complete";
        }

        // Dispatch readystatechange for "complete"
        this.dispatchDocumentEvent("readystatechange");

        // Dispatch load event on window
        this.dispatchDocumentEvent("load");

        return results;
    }

    /**
     * Execute a single script element (external or inline)
     */
    private async executeScriptElement(element: DOMElement): Promise<ScriptExecutionResult> {
        const src = element.attributes?.get("src");
        if (src) {
            return await this.executeExternal(src);
        }
        return await this.executeInline(element);
    }

    /**
     * Find all script elements in DOM
     */
    private findScriptElements(node: DOMNode): DOMNode[] {
        const scripts: DOMNode[] = [];

        if (node.nodeType === DOMNodeType.ELEMENT) {
            const element = node as DOMElement;
            if (element.tagName === "script") {
                scripts.push(node);
            }
        }

        if (node.childNodes) {
            for (const child of node.childNodes) {
                scripts.push(...this.findScriptElements(child));
            }
        }

        return scripts;
    }

    /**
     * Wait for DOM ready state
     * Checks document.readyState and structural integrity before allowing
     * deferred scripts to execute. Per HTML spec, deferred scripts run after
     * HTML parsing is complete (readyState >= "interactive").
     */
    private async waitForDOMReady(): Promise<void> {
        const doc = this.document as DOMNodeWithEvents;

        // Check readyState if available on the document node
        if (doc.readyState) {
            if (doc.readyState === "interactive" || doc.readyState === "complete") {
                return;
            }

            // readyState is "loading" — poll until it transitions
            const maxWait = 5000; // 5 second timeout
            const pollInterval = 10;
            let waited = 0;
            while (doc.readyState === "loading" && waited < maxWait) {
                await new Promise(resolve => setTimeout(resolve, pollInterval));
                waited += pollInterval;
            }

            if (doc.readyState === "loading") {
                this.logger.warn("DOM readyState still 'loading' after timeout, proceeding anyway");
            }
            return;
        }

        // No readyState property — verify DOM structural integrity as fallback
        // Document node (type 9) should have child elements (at least <html>)
        if (doc.nodeType === 9 && doc.childNodes && doc.childNodes.length > 0) {
            // DOM tree exists with children — consider it ready
            return;
        }

        // Fallback: check for documentElement
        if (doc.documentElement) {
            return;
        }

        // If nothing is available, warn and proceed
        this.logger.warn("Cannot determine DOM readiness, proceeding");
    }

    /**
     * Dispatch an event on the document node's event listener registry.
     * Uses the __eventListeners map installed by DOMBindings.
     */
    private dispatchDocumentEvent(eventType: string): void {
        const doc = this.document as DOMNodeWithEvents;
        const listeners = doc.__eventListeners;
        if (!listeners) return;
        const callbacks = listeners.get(eventType);
        if (!callbacks) return;
        for (const callback of callbacks) {
            if (callback?.type === "function" && callback.value?.isNative && callback.value?.nativeImpl) {
                try {
                    callback.value.nativeImpl();
                } catch {
                    // Swallow errors in event handlers
                }
            }
        }
    }

    /**
     * Get execution statistics
     */
    getStats() {
        return {
            scriptsExecuted: this.scriptsExecuted,
            heapStats: this.isolate.getHeapStatistics(),
            eventLoop: {
                pending: this.eventLoop.hasPendingTasks(),
            },
        };
    }

    /**
     * Clear all timers and cleanup
     */
    async dispose(): Promise<void> {
        // Clear timers
        this.windowObject.clearTimers();

        // Stop event loop
        this.eventLoop.stop();

        // Dispose context and isolate
        this.context.dispose();
        this.isolate.dispose();
    }

    // ========================================================================
    // Subsystem Access - Composable Toolkit API
    // ========================================================================

    /**
     * Get V8 isolate
     *
     * Provides access to the V8 isolate for advanced JavaScript engine operations.
     *
     * The V8 isolate represents an isolated JavaScript execution environment with:
     * - Independent heap and garbage collector
     * - Compilation and optimization pipeline
     * - Heap statistics and profiling
     * - Memory management controls
     *
     * Use this to:
     * - Monitor heap usage and GC behavior
     * - Trigger manual garbage collection
     * - Create additional contexts
     * - Access V8-specific features
     *
     * @returns {V8Isolate} The V8 isolate instance
     * @example
     * ```typescript
     * const executor = new ScriptExecutor(document, "https://example.com");
     * const isolate = executor.getIsolate();
     * const heapStats = isolate.getHeapStatistics();
     * console.log(`Heap size: ${heapStats.totalHeapSize} bytes`);
     * ```
     */
    getIsolate(): V8Isolate {
        return this.isolate;
    }

    /**
     * Get V8 context
     *
     * Provides access to the V8 execution context.
     *
     * The V8 context represents a JavaScript execution context with:
     * - Global object and built-ins
     * - Execution stack
     * - Variable scope chains
     * - Direct code execution capability
     *
     * Use this to:
     * - Execute JavaScript code directly
     * - Evaluate expressions
     * - Access global objects
     * - Inspect execution state
     *
     * @returns {V8Context} The V8 context instance
     * @example
     * ```typescript
     * const executor = new ScriptExecutor(document, "https://example.com");
     * const context = executor.getContext();
     * const result = context.execute("2 + 2");
     * console.log(result.value); // 4
     * ```
     */
    getContext(): V8Context {
        return this.context;
    }

    /**
     * Get window object
     *
     * Provides access to the browser window object with Web APIs.
     *
     * The window object provides:
     * - DOM manipulation APIs
     * - Timer functions (setTimeout, setInterval)
     * - Console logging
     * - Navigation and location
     * - Web API implementations
     *
     * Use this to:
     * - Access Web APIs from outside scripts
     * - Manage timers
     * - Inspect window state
     * - Test Web API implementations
     *
     * @returns {WindowObject} The window object instance
     * @example
     * ```typescript
     * const executor = new ScriptExecutor(document, "https://example.com");
     * const window = executor.getWindow();
     * window.clearTimers(); // Clear all active timers
     * ```
     */
    getWindow(): WindowObject {
        return this.windowObject;
    }

    /**
     * Get event loop
     *
     * Provides access to the JavaScript event loop for async operations.
     *
     * The event loop manages:
     * - Macro tasks (setTimeout, setInterval, I/O)
     * - Micro tasks (Promise callbacks, queueMicrotask)
     * - Task scheduling and execution order
     * - Event loop lifecycle
     *
     * Use this to:
     * - Monitor pending tasks
     * - Control event loop execution
     * - Debug async behavior
     * - Coordinate with external event sources
     *
     * @returns {EventLoop} The event loop instance
     * @example
     * ```typescript
     * const executor = new ScriptExecutor(document, "https://example.com");
     * const eventLoop = executor.getEventLoop();
     * console.log(`Has pending tasks: ${eventLoop.hasPendingTasks()}`);
     * ```
     */
    getEventLoop(): EventLoop {
        return this.eventLoop;
    }

    /**
     * Get document
     *
     * Provides access to the DOM document being executed against.
     *
     * The document represents:
     * - Complete DOM tree structure
     * - Document element and metadata
     * - Script execution context
     * - DOM manipulation target
     *
     * Use this to:
     * - Inspect DOM state after script execution
     * - Verify script modifications
     * - Access document structure
     * - Test DOM API implementations
     *
     * @returns {DOMNode} The document node
     * @example
     * ```typescript
     * const executor = new ScriptExecutor(document, "https://example.com");
     * await executor.execute("document.body.textContent = 'Hello'");
     * const doc = executor.getDocument();
     * // Inspect modified DOM
     * ```
     */
    getDocument(): DOMNode {
        return this.document;
    }

    /**
     * Set Content Security Policy for script execution enforcement
     */
    setCSP(csp: ContentSecurityPolicy): void {
        this.csp = csp;
    }

    /**
     * Get the current Content Security Policy
     */
    getCSP(): ContentSecurityPolicy | undefined {
        return this.csp;
    }
}

/**
 * Script Loader
 * Manages loading and caching of scripts
 */
export class ScriptLoader {
    private cache: Map<string, string> = new Map();
    private loading: Map<string, Promise<string>> = new Map();

    /**
     * Load script from URL
     */
    async load(url: string): Promise<string> {
        // Check cache
        const cached = this.cache.get(url);
        if (cached) {
            return cached;
        }

        // Check if already loading
        const inProgress = this.loading.get(url);
        if (inProgress) {
            return await inProgress;
        }

        // Start loading
        const loadPromise = this.fetchScript(url);
        this.loading.set(url, loadPromise);

        try {
            const code = await loadPromise;

            // Cache result
            this.cache.set(url, code);
            this.loading.delete(url);

            return code;
        } catch (error) {
            this.loading.delete(url);
            throw error;
        }
    }

    /**
     * Fetch script from URL
     */
    private async fetchScript(url: string): Promise<string> {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return await response.text();
        } catch (error) {
            throw new Error(
                `Failed to load script: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }

    /**
     * Clear cache
     */
    clearCache(): void {
        this.cache.clear();
    }

    /**
     * Get cache statistics
     */
    getCacheStats() {
        return {
            cached: this.cache.size,
            loading: this.loading.size,
        };
    }
}
