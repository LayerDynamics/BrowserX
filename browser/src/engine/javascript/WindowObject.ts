/**
 * Window Object
 *
 * Implements the global window object exposed to JavaScript.
 * Provides Web APIs like console, setTimeout, fetch, localStorage, etc.
 */

import { V8Context } from "./V8Context.ts";
import { DOMBindings, type JSDocument } from "./DOMBindings.ts";
import type { DOMNode } from "../../types/dom.ts";
import {
    createBoolean,
    createNativeFunction,
    createNull,
    createNumber,
    createObject,
    createString,
    createUndefined,
    type JSValue,
    setProperty,
} from "./JSValue.ts";

/**
 * Timer callback
 */
export type TimerCallback = () => void;

/**
 * Timer handle
 */
export type TimerHandle = number;

/**
 * Console interface
 */
export interface Console {
    log(...args: unknown[]): void;
    info(...args: unknown[]): void;
    warn(...args: unknown[]): void;
    error(...args: unknown[]): void;
    debug(...args: unknown[]): void;
    trace(...args: unknown[]): void;
    assert(condition: boolean, ...args: unknown[]): void;
    clear(): void;
    count(label?: string): void;
    time(label: string): void;
    timeEnd(label: string): void;
}

/**
 * Location interface
 */
export interface Location {
    href: string;
    protocol: string;
    host: string;
    hostname: string;
    port: string;
    pathname: string;
    search: string;
    hash: string;
    origin: string;
    reload(): void;
    replace(url: string): void;
}

/**
 * Navigator interface
 */
export interface Navigator {
    userAgent: string;
    language: string;
    platform: string;
    cookieEnabled: boolean;
    onLine: boolean;
}

/**
 * Window Object
 * Global object exposed to JavaScript
 */
export class WindowObject {
    private context: V8Context;
    private domBindings: DOMBindings;
    private timers: Map<TimerHandle, { callback: TimerCallback; timeout: number }> = new Map();
    private nextTimerId: TimerHandle = 1;
    private url: string;
    private document: DOMNode;

    constructor(context: V8Context, document: DOMNode, url: string) {
        this.context = context;
        this.domBindings = new DOMBindings(context);
        this.document = document;
        this.url = url;
    }

    /**
     * Install window object and Web APIs
     */
    install(): void {
        // Install DOM bindings
        this.domBindings.install();

        // Install window object
        const window = this.createWindowObject();
        setProperty(this.context.global, "window", window);

        // Install global aliases
        setProperty(this.context.global, "self", window);
        setProperty(this.context.global, "globalThis", window);

        // Install document
        const jsDocument = this.domBindings.wrapNode(this.document);
        // Wrap JSNode in a JSValue object
        const documentValue = createObject();
        // Copy JSNode properties to JSValue object
        for (const key of Object.keys(jsDocument)) {
            const value = (jsDocument as any)[key];
            if (typeof value === "number") {
                setProperty(documentValue, key, createNumber(value));
            } else if (typeof value === "string") {
                setProperty(documentValue, key, createString(value));
            } else if (value === null) {
                setProperty(documentValue, key, createNull());
            } else if (value === undefined) {
                setProperty(documentValue, key, createUndefined());
            }
            // Skip functions and objects for now
        }
        setProperty(this.context.global, "document", documentValue);

        // Install console
        const consoleObj = createObject();
        setProperty(
            consoleObj,
            "log",
            createNativeFunction("log", (...args) => {
                console.log("[JS]", args);
                return createUndefined();
            }),
        );
        setProperty(
            consoleObj,
            "info",
            createNativeFunction("info", (...args) => {
                console.info("[JS]", args);
                return createUndefined();
            }),
        );
        setProperty(
            consoleObj,
            "warn",
            createNativeFunction("warn", (...args) => {
                console.warn("[JS]", args);
                return createUndefined();
            }),
        );
        setProperty(
            consoleObj,
            "error",
            createNativeFunction("error", (...args) => {
                console.error("[JS]", args);
                return createUndefined();
            }),
        );
        setProperty(this.context.global, "console", consoleObj);

        // Install timers
        setProperty(
            this.context.global,
            "setTimeout",
            createNativeFunction("setTimeout", (...args) => {
                const callback = args[0];
                const delay = args[1] ? (args[1] as { type: "number"; value: number }).value : 0;
                const handle = this.nextTimerId++;
                const timeoutId = setTimeout(() => {
                    this.timers.delete(handle);
                    // Execute callback
                }, delay);
                this.timers.set(handle, {
                    callback: () => {},
                    timeout: timeoutId as unknown as number,
                });
                return createNumber(handle);
            }, 2),
        );
        setProperty(
            this.context.global,
            "clearTimeout",
            createNativeFunction("clearTimeout", (...args) => {
                const handle = args[0] ? (args[0] as { type: "number"; value: number }).value : 0;
                const timer = this.timers.get(handle);
                if (timer) {
                    clearTimeout(timer.timeout);
                    this.timers.delete(handle);
                }
                return createUndefined();
            }, 1),
        );
        setProperty(
            this.context.global,
            "setInterval",
            createNativeFunction("setInterval", (...args) => {
                const callback = args[0];
                const delay = args[1] ? (args[1] as { type: "number"; value: number }).value : 0;
                const handle = this.nextTimerId++;
                const intervalId = setInterval(() => {
                    // Execute callback
                }, delay);
                this.timers.set(handle, {
                    callback: () => {},
                    timeout: intervalId as unknown as number,
                });
                return createNumber(handle);
            }, 2),
        );
        setProperty(
            this.context.global,
            "clearInterval",
            createNativeFunction("clearInterval", (...args) => {
                const handle = args[0] ? (args[0] as { type: "number"; value: number }).value : 0;
                const timer = this.timers.get(handle);
                if (timer) {
                    clearInterval(timer.timeout);
                    this.timers.delete(handle);
                }
                return createUndefined();
            }, 1),
        );

        // Install location
        const parsedUrl = new URL(this.url);
        const locationObj = createObject();
        setProperty(locationObj, "href", createString(parsedUrl.href));
        setProperty(locationObj, "protocol", createString(parsedUrl.protocol));
        setProperty(locationObj, "host", createString(parsedUrl.host));
        setProperty(locationObj, "hostname", createString(parsedUrl.hostname));
        setProperty(locationObj, "port", createString(parsedUrl.port));
        setProperty(locationObj, "pathname", createString(parsedUrl.pathname));
        setProperty(locationObj, "search", createString(parsedUrl.search));
        setProperty(locationObj, "hash", createString(parsedUrl.hash));
        setProperty(locationObj, "origin", createString(parsedUrl.origin));
        setProperty(this.context.global, "location", locationObj);

        // Install navigator
        const navigatorObj = createObject();
        setProperty(navigatorObj, "userAgent", createString("GeoProx-Browser/1.0"));
        setProperty(navigatorObj, "language", createString("en-US"));
        setProperty(navigatorObj, "platform", createString("GeoProx"));
        setProperty(this.context.global, "navigator", navigatorObj);

        // Install fetch (simplified)
        setProperty(
            this.context.global,
            "fetch",
            createNativeFunction("fetch", (...args) => {
                console.log("[JS] fetch called", args);
                return createObject();
            }, 1),
        );

        // Install storage APIs (simplified stubs)
        const localStorageObj = createObject();
        setProperty(
            localStorageObj,
            "getItem",
            createNativeFunction("getItem", (...args) => createNull(), 1),
        );
        setProperty(
            localStorageObj,
            "setItem",
            createNativeFunction("setItem", (...args) => createUndefined(), 2),
        );
        setProperty(this.context.global, "localStorage", localStorageObj);

        const sessionStorageObj = createObject();
        setProperty(
            sessionStorageObj,
            "getItem",
            createNativeFunction("getItem", (...args) => createNull(), 1),
        );
        setProperty(
            sessionStorageObj,
            "setItem",
            createNativeFunction("setItem", (...args) => createUndefined(), 2),
        );
        setProperty(this.context.global, "sessionStorage", sessionStorageObj);

        // Install alert, confirm, prompt (no-op for headless)
        setProperty(
            this.context.global,
            "alert",
            createNativeFunction("alert", (...args) => {
                console.log("[alert]", args);
                return createUndefined();
            }, 1),
        );
        setProperty(
            this.context.global,
            "confirm",
            createNativeFunction("confirm", (...args) => {
                console.log("[confirm]", args);
                return createBoolean(false);
            }, 1),
        );
        setProperty(
            this.context.global,
            "prompt",
            createNativeFunction("prompt", (...args) => {
                console.log("[prompt]", args);
                return createNull();
            }, 1),
        );
    }

    /**
     * Create window object
     */
    private createWindowObject(): JSValue {
        const windowObj = createObject();

        // Window dimensions
        setProperty(windowObj, "innerWidth", createNumber(1024));
        setProperty(windowObj, "innerHeight", createNumber(768));
        setProperty(windowObj, "outerWidth", createNumber(1024));
        setProperty(windowObj, "outerHeight", createNumber(768));
        setProperty(windowObj, "screenX", createNumber(0));
        setProperty(windowObj, "screenY", createNumber(0));

        // Scrolling
        setProperty(windowObj, "scrollX", createNumber(0));
        setProperty(windowObj, "scrollY", createNumber(0));
        setProperty(
            windowObj,
            "scrollTo",
            createNativeFunction("scrollTo", (...args) => {
                console.log("scrollTo called", args);
                return createUndefined();
            }, 2),
        );
        setProperty(
            windowObj,
            "scrollBy",
            createNativeFunction("scrollBy", (...args) => {
                console.log("scrollBy called", args);
                return createUndefined();
            }, 2),
        );

        return windowObj;
    }

    /**
     * Create console object
     */
    private createConsole(): Console {
        return {
            log: (...args: unknown[]) => {
                console.log("[JS]", ...args);
            },
            info: (...args: unknown[]) => {
                console.info("[JS]", ...args);
            },
            warn: (...args: unknown[]) => {
                console.warn("[JS]", ...args);
            },
            error: (...args: unknown[]) => {
                console.error("[JS]", ...args);
            },
            debug: (...args: unknown[]) => {
                console.debug("[JS]", ...args);
            },
            trace: (...args: unknown[]) => {
                console.trace("[JS]", ...args);
            },
            assert: (condition: boolean, ...args: unknown[]) => {
                if (!condition) {
                    console.error("[JS] Assertion failed:", ...args);
                }
            },
            clear: () => {
                console.clear();
            },
            count: (label?: string) => {
                console.count(label);
            },
            time: (label: string) => {
                console.time(label);
            },
            timeEnd: (label: string) => {
                console.timeEnd(label);
            },
        };
    }

    /**
     * Create setTimeout
     */
    private createSetTimeout(): (callback: TimerCallback, delay: number) => TimerHandle {
        return (callback: TimerCallback, delay: number) => {
            const handle = this.nextTimerId++;

            const timeoutId = setTimeout(() => {
                this.timers.delete(handle);
                try {
                    callback();
                } catch (error) {
                    console.error("Timer callback error:", error);
                }
            }, delay);

            this.timers.set(handle, { callback, timeout: timeoutId as unknown as number });
            return handle;
        };
    }

    /**
     * Create clearTimeout
     */
    private createClearTimeout(): (handle: TimerHandle) => void {
        return (handle: TimerHandle) => {
            const timer = this.timers.get(handle);
            if (timer) {
                clearTimeout(timer.timeout);
                this.timers.delete(handle);
            }
        };
    }

    /**
     * Create setInterval
     */
    private createSetInterval(): (callback: TimerCallback, delay: number) => TimerHandle {
        return (callback: TimerCallback, delay: number) => {
            const handle = this.nextTimerId++;

            const intervalId = setInterval(() => {
                try {
                    callback();
                } catch (error) {
                    console.error("Interval callback error:", error);
                }
            }, delay);

            this.timers.set(handle, { callback, timeout: intervalId as unknown as number });
            return handle;
        };
    }

    /**
     * Create clearInterval
     */
    private createClearInterval(): (handle: TimerHandle) => void {
        return (handle: TimerHandle) => {
            const timer = this.timers.get(handle);
            if (timer) {
                clearInterval(timer.timeout);
                this.timers.delete(handle);
            }
        };
    }

    /**
     * Create location object
     */
    private createLocation(): Location {
        const parsedUrl = new URL(this.url);

        return {
            href: parsedUrl.href,
            protocol: parsedUrl.protocol,
            host: parsedUrl.host,
            hostname: parsedUrl.hostname,
            port: parsedUrl.port,
            pathname: parsedUrl.pathname,
            search: parsedUrl.search,
            hash: parsedUrl.hash,
            origin: parsedUrl.origin,
            reload: () => {
                console.log("location.reload called");
            },
            replace: (url: string) => {
                console.log(`location.replace: ${url}`);
            },
        };
    }

    /**
     * Create navigator object
     */
    private createNavigator(): Navigator {
        return {
            userAgent: "GeoProx-Browser/1.0",
            language: "en-US",
            platform: "GeoProx",
            cookieEnabled: true,
            onLine: true,
        };
    }

    /**
     * Create fetch API (simplified)
     */
    private createFetch(): (url: string, options?: RequestInit) => Promise<Response> {
        return async (url: string, options?: RequestInit) => {
            console.log(`fetch: ${url}`, options);

            // Simplified fetch - would integrate with RequestPipeline
            return {
                ok: true,
                status: 200,
                statusText: "OK",
                headers: new Headers(),
                json: async () => ({}),
                text: async () => "",
                blob: async () => new Blob(),
                arrayBuffer: async () => new ArrayBuffer(0),
            } as Response;
        };
    }

    /**
     * Create localStorage (simplified)
     */
    private createLocalStorage(): Storage {
        const storage = new Map<string, string>();

        return {
            get length() {
                return storage.size;
            },
            getItem(key: string): string | null {
                return storage.get(key) ?? null;
            },
            setItem(key: string, value: string): void {
                storage.set(key, value);
            },
            removeItem(key: string): void {
                storage.delete(key);
            },
            clear(): void {
                storage.clear();
            },
            key(index: number): string | null {
                const keys = Array.from(storage.keys());
                return keys[index] ?? null;
            },
        };
    }

    /**
     * Create sessionStorage (simplified)
     */
    private createSessionStorage(): Storage {
        return this.createLocalStorage(); // Same interface
    }

    /**
     * Create alert function
     */
    private createAlert(): (message: string) => void {
        return (message: string) => {
            console.log(`[alert] ${message}`);
        };
    }

    /**
     * Create confirm function
     */
    private createConfirm(): (message: string) => boolean {
        return (message: string) => {
            console.log(`[confirm] ${message}`);
            return true; // Always return true in headless mode
        };
    }

    /**
     * Create prompt function
     */
    private createPrompt(): (message: string, defaultValue?: string) => string | null {
        return (message: string, defaultValue?: string) => {
            console.log(`[prompt] ${message}`);
            return defaultValue ?? null;
        };
    }

    /**
     * Clear all timers
     */
    clearTimers(): void {
        for (const [handle] of this.timers) {
            const timer = this.timers.get(handle);
            if (timer) {
                clearTimeout(timer.timeout);
            }
        }
        this.timers.clear();
    }

    /**
     * Get DOM bindings
     */
    getDOMBindings(): DOMBindings {
        return this.domBindings;
    }
}
