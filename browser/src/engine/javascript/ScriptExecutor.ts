/**
 * Script Executor
 *
 * Executes JavaScript code in the context of a web page.
 * Manages V8 isolate, context, and DOM bindings.
 */

import type { DOMElement, DOMNode } from "../../types/dom.ts";
import { DOMNodeType } from "../../types/dom.ts";
import type { ByteBuffer } from "../../types/identifiers.ts";
import { V8Isolate } from "./V8Isolate.ts";
import { V8Context } from "./V8Context.ts";
import { WindowObject } from "./WindowObject.ts";
import { EventLoop } from "./EventLoop.ts";

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
    private isolate: V8Isolate;
    private context: V8Context;
    private windowObject: WindowObject;
    private eventLoop: EventLoop;
    private document: DOMNode;
    private url: string;
    private scriptsExecuted: number = 0;

    constructor(document: DOMNode, url: string) {
        this.document = document;
        this.url = url;

        // Create V8 isolate and context
        this.isolate = new V8Isolate();
        this.context = this.isolate.createContext();

        // Create window object and install Web APIs
        this.windowObject = new WindowObject(this.context, document, url);
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
            console.error(`Script execution error:`, error);

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
            console.error(`Evaluation error:`, error);
            return undefined;
        }
    }

    /**
     * Find and execute all scripts in DOM
     */
    async executeScriptsInDOM(): Promise<ScriptExecutionResult[]> {
        const scripts = this.findScriptElements(this.document);
        const results: ScriptExecutionResult[] = [];

        for (const script of scripts) {
            // Script elements are always elements
            if (script.nodeType !== DOMNodeType.ELEMENT) {
                continue;
            }

            const scriptElement = script as DOMElement;

            // Check if external or inline
            const src = scriptElement.attributes?.get("src");

            if (src) {
                // External script
                const result = await this.executeExternal(src);
                results.push(result);
            } else {
                // Inline script
                const result = await this.executeInline(script);
                results.push(result);
            }
        }

        return results;
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
     */
    private async waitForDOMReady(): Promise<void> {
        // Simplified - assume DOM is ready
        return Promise.resolve();
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
