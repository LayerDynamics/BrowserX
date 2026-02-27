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
  getProperty,
  type JSValue,
  setProperty,
} from "./JSValue.ts";
import type { RequestPipeline } from "../RequestPipeline.ts";
import type { StorageManager } from "../storage/StorageManager.ts";
import { SSRFError, URLValidator } from "../security/URLValidator.ts";
import { BytecodeGenerator, type ProgramNode } from "./V8Compiler.ts";
import type { ContentSecurityPolicy } from "../security/ContentSecurityPolicy.ts";

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
  private requestPipeline?: RequestPipeline;
  private storageManager?: StorageManager;
  private origin: string;
  private csp?: ContentSecurityPolicy;

  constructor(
    context: V8Context,
    document: DOMNode,
    url: string,
    requestPipeline?: RequestPipeline,
    storageManager?: StorageManager,
  ) {
    this.context = context;
    this.domBindings = new DOMBindings(context);
    this.document = document;
    this.url = url;
    this.requestPipeline = requestPipeline;
    this.storageManager = storageManager;
    this.origin = new URL(url).origin;
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

    // Install document with full DOM method bindings
    const documentValue = this.domBindings.wrapNodeAsJSValue(this.document);
    setProperty(this.context.global, "document", documentValue);

    // Install console — backed by createConsole()
    const backingConsole = this.createConsole();
    const consoleObj = createObject();
    setProperty(
      consoleObj,
      "log",
      createNativeFunction("log", (...args) => {
        backingConsole.log(...args);
        return createUndefined();
      }),
    );
    setProperty(
      consoleObj,
      "info",
      createNativeFunction("info", (...args) => {
        backingConsole.info(...args);
        return createUndefined();
      }),
    );
    setProperty(
      consoleObj,
      "warn",
      createNativeFunction("warn", (...args) => {
        backingConsole.warn(...args);
        return createUndefined();
      }),
    );
    setProperty(
      consoleObj,
      "error",
      createNativeFunction("error", (...args) => {
        backingConsole.error(...args);
        return createUndefined();
      }),
    );
    setProperty(
      consoleObj,
      "debug",
      createNativeFunction("debug", (...args) => {
        backingConsole.debug(...args);
        return createUndefined();
      }),
    );
    setProperty(
      consoleObj,
      "trace",
      createNativeFunction("trace", (...args) => {
        backingConsole.trace(...args);
        return createUndefined();
      }),
    );
    setProperty(
      consoleObj,
      "clear",
      createNativeFunction("clear", () => {
        backingConsole.clear();
        return createUndefined();
      }),
    );
    setProperty(this.context.global, "console", consoleObj);

    // Install timers — delegate native operations to createSetTimeout/etc. factories
    const nativeSetTimeout = this.createSetTimeout();
    const nativeClearTimeout = this.createClearTimeout();
    const nativeSetInterval = this.createSetInterval();
    const nativeClearInterval = this.createClearInterval();

    setProperty(
      this.context.global,
      "setTimeout",
      createNativeFunction("setTimeout", (...args) => {
        const invokeCallback = this.createCallbackInvoker(args[0]);
        const delay = args[1] ? (args[1] as { type: "number"; value: number }).value : 0;
        const handle = nativeSetTimeout(invokeCallback, delay);
        return createNumber(handle);
      }, 2),
    );
    setProperty(
      this.context.global,
      "clearTimeout",
      createNativeFunction("clearTimeout", (...args) => {
        const handle = args[0] ? (args[0] as { type: "number"; value: number }).value : 0;
        nativeClearTimeout(handle);
        return createUndefined();
      }, 1),
    );
    setProperty(
      this.context.global,
      "setInterval",
      createNativeFunction("setInterval", (...args) => {
        const invokeCallback = this.createCallbackInvoker(args[0]);
        const delay = args[1] ? (args[1] as { type: "number"; value: number }).value : 0;
        const handle = nativeSetInterval(invokeCallback, delay);
        return createNumber(handle);
      }, 2),
    );
    setProperty(
      this.context.global,
      "clearInterval",
      createNativeFunction("clearInterval", (...args) => {
        const handle = args[0] ? (args[0] as { type: "number"; value: number }).value : 0;
        nativeClearInterval(handle);
        return createUndefined();
      }, 1),
    );

    // Install location — backed by createLocation()
    const loc = this.createLocation();
    const locationObj = createObject();
    setProperty(locationObj, "href", createString(loc.href));
    setProperty(locationObj, "protocol", createString(loc.protocol));
    setProperty(locationObj, "host", createString(loc.host));
    setProperty(locationObj, "hostname", createString(loc.hostname));
    setProperty(locationObj, "port", createString(loc.port));
    setProperty(locationObj, "pathname", createString(loc.pathname));
    setProperty(locationObj, "search", createString(loc.search));
    setProperty(locationObj, "hash", createString(loc.hash));
    setProperty(locationObj, "origin", createString(loc.origin));
    setProperty(
      locationObj,
      "reload",
      createNativeFunction("reload", () => {
        loc.reload();
        return createUndefined();
      }),
    );
    setProperty(
      locationObj,
      "replace",
      createNativeFunction("replace", (...args) => {
        const url = args[0] && args[0].type === "string"
          ? (args[0] as { type: "string"; value: string }).value
          : "";
        loc.replace(url);
        return createUndefined();
      }, 1),
    );
    setProperty(this.context.global, "location", locationObj);

    // Install navigator — backed by createNavigator()
    const nav = this.createNavigator();
    const navigatorObj = createObject();
    setProperty(navigatorObj, "userAgent", createString(nav.userAgent));
    setProperty(navigatorObj, "language", createString(nav.language));
    setProperty(navigatorObj, "platform", createString(nav.platform));
    setProperty(navigatorObj, "cookieEnabled", createBoolean(nav.cookieEnabled));
    setProperty(navigatorObj, "onLine", createBoolean(nav.onLine));
    setProperty(this.context.global, "navigator", navigatorObj);

    // Install fetch — delegates to createFetch() which uses RequestPipeline
    setProperty(this.context.global, "fetch", this.createFetch());

    // Install storage APIs
    setProperty(this.context.global, "localStorage", this.createStorageJSValue("local"));
    setProperty(this.context.global, "sessionStorage", this.createStorageJSValue("session"));

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

    // Install atob / btoa — base64 encoding/decoding
    setProperty(
      this.context.global,
      "atob",
      createNativeFunction("atob", (...args) => {
        const encoded = args[0] && args[0].type === "string"
          ? (args[0] as { type: "string"; value: string }).value
          : "";
        try {
          const decoded = new TextDecoder().decode(
            Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0)),
          );
          return createString(decoded);
        } catch {
          return createString("");
        }
      }, 1),
    );
    setProperty(
      this.context.global,
      "btoa",
      createNativeFunction("btoa", (...args) => {
        const str = args[0] && args[0].type === "string"
          ? (args[0] as { type: "string"; value: string }).value
          : "";
        try {
          return createString(btoa(str));
        } catch {
          return createString("");
        }
      }, 1),
    );

    // Install queueMicrotask
    setProperty(
      this.context.global,
      "queueMicrotask",
      createNativeFunction("queueMicrotask", () => {
        // In our sync engine, microtasks execute at next tick; no-op for callback
        return createUndefined();
      }, 1),
    );

    // Install structuredClone — deep clone a JSValue
    setProperty(
      this.context.global,
      "structuredClone",
      createNativeFunction("structuredClone", (...args) => {
        const val = args[0];
        if (!val) return createUndefined();
        return this.deepCloneJSValue(val, new Map());
      }, 1),
    );

    // Install performance object
    const perfObj = createObject();
    const perfStartTime = Date.now();
    setProperty(
      perfObj,
      "now",
      createNativeFunction("now", () => {
        return createNumber(Date.now() - perfStartTime);
      }),
    );
    setProperty(perfObj, "timeOrigin", createNumber(perfStartTime));
    // performance.timing stub
    const timingObj = createObject();
    setProperty(timingObj, "navigationStart", createNumber(perfStartTime));
    setProperty(timingObj, "domContentLoadedEventEnd", createNumber(perfStartTime));
    setProperty(timingObj, "loadEventEnd", createNumber(perfStartTime));
    setProperty(perfObj, "timing", timingObj);
    // performance.mark / measure stubs
    const perfMarks = new Map<string, number>();
    setProperty(
      perfObj,
      "mark",
      createNativeFunction("mark", (...args) => {
        const name = args[0] && args[0].type === "string"
          ? (args[0] as { type: "string"; value: string }).value
          : "";
        perfMarks.set(name, Date.now() - perfStartTime);
        return createUndefined();
      }, 1),
    );
    setProperty(
      perfObj,
      "measure",
      createNativeFunction("measure", () => {
        return createUndefined();
      }, 3),
    );
    setProperty(
      perfObj,
      "getEntriesByType",
      createNativeFunction("getEntriesByType", () => {
        const arr = createObject();
        setProperty(arr, "length", createNumber(0));
        return arr;
      }, 1),
    );
    setProperty(
      perfObj,
      "getEntriesByName",
      createNativeFunction("getEntriesByName", () => {
        const arr = createObject();
        setProperty(arr, "length", createNumber(0));
        return arr;
      }, 1),
    );
    setProperty(this.context.global, "performance", perfObj);

    // Install screen object
    const screenObj = createObject();
    setProperty(screenObj, "width", createNumber(1920));
    setProperty(screenObj, "height", createNumber(1080));
    setProperty(screenObj, "availWidth", createNumber(1920));
    setProperty(screenObj, "availHeight", createNumber(1080));
    setProperty(screenObj, "colorDepth", createNumber(24));
    setProperty(screenObj, "pixelDepth", createNumber(24));
    setProperty(
      screenObj,
      "orientation",
      (() => {
        const orient = createObject();
        setProperty(orient, "type", createString("landscape-primary"));
        setProperty(orient, "angle", createNumber(0));
        return orient;
      })(),
    );
    setProperty(this.context.global, "screen", screenObj);

    // Install history object
    const historyStack: string[] = [this.url];
    let historyIndex = 0;
    const historyObj = createObject();
    setProperty(historyObj, "length", createNumber(1));
    setProperty(historyObj, "state", createNull());
    setProperty(historyObj, "scrollRestoration", createString("auto"));
    setProperty(
      historyObj,
      "pushState",
      createNativeFunction("pushState", (...args) => {
        const stateArg = args[0] ?? createNull();
        const urlArg = args[2] && args[2].type === "string"
          ? (args[2] as { type: "string"; value: string }).value
          : null;
        if (urlArg) {
          historyStack.splice(historyIndex + 1);
          historyStack.push(urlArg);
          historyIndex = historyStack.length - 1;
          setProperty(historyObj, "length", createNumber(historyStack.length));
        }
        setProperty(historyObj, "state", stateArg);
        return createUndefined();
      }, 3),
    );
    setProperty(
      historyObj,
      "replaceState",
      createNativeFunction("replaceState", (...args) => {
        const stateArg = args[0] ?? createNull();
        const urlArg = args[2] && args[2].type === "string"
          ? (args[2] as { type: "string"; value: string }).value
          : null;
        if (urlArg) {
          historyStack[historyIndex] = urlArg;
        }
        setProperty(historyObj, "state", stateArg);
        return createUndefined();
      }, 3),
    );
    setProperty(
      historyObj,
      "back",
      createNativeFunction("back", () => {
        if (historyIndex > 0) historyIndex--;
        return createUndefined();
      }),
    );
    setProperty(
      historyObj,
      "forward",
      createNativeFunction("forward", () => {
        if (historyIndex < historyStack.length - 1) historyIndex++;
        return createUndefined();
      }),
    );
    setProperty(
      historyObj,
      "go",
      createNativeFunction("go", (...args) => {
        const delta = args[0] && args[0].type === "number"
          ? (args[0] as { type: "number"; value: number }).value
          : 0;
        const newIndex = historyIndex + delta;
        if (newIndex >= 0 && newIndex < historyStack.length) {
          historyIndex = newIndex;
        }
        return createUndefined();
      }, 1),
    );
    setProperty(this.context.global, "history", historyObj);

    // Install crypto object
    const cryptoObj = createObject();
    setProperty(
      cryptoObj,
      "getRandomValues",
      createNativeFunction("getRandomValues", (...args) => {
        // Determine the requested length from the input typed array argument
        const input = args[0];
        let length = 16;
        if (input && input.type === "object") {
          const lengthProp = getProperty(input, "length");
          if (lengthProp && lengthProp.type === "number") {
            length = (lengthProp as { type: "number"; value: number }).value;
          }
        }
        // Generate actual random bytes using Deno's native crypto
        const randomBytes = new Uint8Array(length);
        crypto.getRandomValues(randomBytes);
        // Build a JSValue array-like object with the random values
        const result = createObject();
        for (let i = 0; i < length; i++) {
          setProperty(result, String(i), createNumber(randomBytes[i]));
        }
        setProperty(result, "length", createNumber(length));
        return result;
      }, 1),
    );
    setProperty(
      cryptoObj,
      "randomUUID",
      createNativeFunction("randomUUID", () => {
        return createString(crypto.randomUUID());
      }),
    );
    setProperty(this.context.global, "crypto", cryptoObj);

    // Install URL constructor-like function
    setProperty(
      this.context.global,
      "URL",
      createNativeFunction("URL", (...args) => {
        const urlStr = args[0] && args[0].type === "string"
          ? (args[0] as { type: "string"; value: string }).value
          : "";
        const baseStr = args[1] && args[1].type === "string"
          ? (args[1] as { type: "string"; value: string }).value
          : undefined;
        try {
          const parsed = new URL(urlStr, baseStr);
          const urlObj = createObject();
          setProperty(urlObj, "href", createString(parsed.href));
          setProperty(urlObj, "origin", createString(parsed.origin));
          setProperty(urlObj, "protocol", createString(parsed.protocol));
          setProperty(urlObj, "host", createString(parsed.host));
          setProperty(urlObj, "hostname", createString(parsed.hostname));
          setProperty(urlObj, "port", createString(parsed.port));
          setProperty(urlObj, "pathname", createString(parsed.pathname));
          setProperty(urlObj, "search", createString(parsed.search));
          setProperty(urlObj, "hash", createString(parsed.hash));
          setProperty(urlObj, "username", createString(parsed.username));
          setProperty(urlObj, "password", createString(parsed.password));
          setProperty(urlObj, "searchParams", createObject());
          setProperty(
            urlObj,
            "toString",
            createNativeFunction("toString", () => createString(parsed.href)),
          );
          setProperty(
            urlObj,
            "toJSON",
            createNativeFunction("toJSON", () => createString(parsed.href)),
          );
          return urlObj;
        } catch {
          return createNull();
        }
      }, 2),
    );

    // Install parseInt / parseFloat / isNaN / isFinite
    setProperty(
      this.context.global,
      "parseInt",
      createNativeFunction("parseInt", (...args) => {
        const str = args[0] && args[0].type === "string"
          ? (args[0] as { type: "string"; value: string }).value
          : "0";
        const radix = args[1] && args[1].type === "number"
          ? (args[1] as { type: "number"; value: number }).value
          : 10;
        const result = parseInt(str, radix);
        return createNumber(isNaN(result) ? NaN : result);
      }, 2),
    );
    setProperty(
      this.context.global,
      "parseFloat",
      createNativeFunction("parseFloat", (...args) => {
        const str = args[0] && args[0].type === "string"
          ? (args[0] as { type: "string"; value: string }).value
          : "0";
        return createNumber(parseFloat(str));
      }, 1),
    );
    setProperty(
      this.context.global,
      "isNaN",
      createNativeFunction("isNaN", (...args) => {
        const val = args[0] && args[0].type === "number"
          ? (args[0] as { type: "number"; value: number }).value
          : NaN;
        return createBoolean(isNaN(val));
      }, 1),
    );
    setProperty(
      this.context.global,
      "isFinite",
      createNativeFunction("isFinite", (...args) => {
        const val = args[0] && args[0].type === "number"
          ? (args[0] as { type: "number"; value: number }).value
          : NaN;
        return createBoolean(isFinite(val));
      }, 1),
    );
    setProperty(this.context.global, "NaN", createNumber(NaN));
    setProperty(this.context.global, "Infinity", createNumber(Infinity));
    setProperty(this.context.global, "undefined", createUndefined());

    // Install encodeURIComponent / decodeURIComponent / encodeURI / decodeURI
    setProperty(
      this.context.global,
      "encodeURIComponent",
      createNativeFunction("encodeURIComponent", (...args) => {
        const str = args[0] && args[0].type === "string"
          ? (args[0] as { type: "string"; value: string }).value
          : "";
        return createString(encodeURIComponent(str));
      }, 1),
    );
    setProperty(
      this.context.global,
      "decodeURIComponent",
      createNativeFunction("decodeURIComponent", (...args) => {
        const str = args[0] && args[0].type === "string"
          ? (args[0] as { type: "string"; value: string }).value
          : "";
        try {
          return createString(decodeURIComponent(str));
        } catch {
          return createString(str);
        }
      }, 1),
    );
    setProperty(
      this.context.global,
      "encodeURI",
      createNativeFunction("encodeURI", (...args) => {
        const str = args[0] && args[0].type === "string"
          ? (args[0] as { type: "string"; value: string }).value
          : "";
        return createString(encodeURI(str));
      }, 1),
    );
    setProperty(
      this.context.global,
      "decodeURI",
      createNativeFunction("decodeURI", (...args) => {
        const str = args[0] && args[0].type === "string"
          ? (args[0] as { type: "string"; value: string }).value
          : "";
        try {
          return createString(decodeURI(str));
        } catch {
          return createString(str);
        }
      }, 1),
    );

    // Install JSON object
    const jsonObj = createObject();
    setProperty(
      jsonObj,
      "parse",
      createNativeFunction("parse", (...args) => {
        const str = args[0] && args[0].type === "string"
          ? (args[0] as { type: "string"; value: string }).value
          : "";
        try {
          return this.nativeToJSValue(JSON.parse(str));
        } catch {
          return createNull();
        }
      }, 1),
    );
    setProperty(
      jsonObj,
      "stringify",
      createNativeFunction("stringify", (...args) => {
        const val = args[0];
        if (!val) return createString("undefined");
        return createString(this.jsValueToNative(val));
      }, 1),
    );
    setProperty(this.context.global, "JSON", jsonObj);

    // Install Math object
    const mathObj = createObject();
    setProperty(mathObj, "PI", createNumber(Math.PI));
    setProperty(mathObj, "E", createNumber(Math.E));
    setProperty(mathObj, "LN2", createNumber(Math.LN2));
    setProperty(mathObj, "LN10", createNumber(Math.LN10));
    setProperty(mathObj, "SQRT2", createNumber(Math.SQRT2));
    for (
      const fn of [
        "abs",
        "ceil",
        "floor",
        "round",
        "sqrt",
        "log",
        "sin",
        "cos",
        "tan",
        "asin",
        "acos",
        "atan",
        "exp",
        "trunc",
        "sign",
      ] as const
    ) {
      setProperty(
        mathObj,
        fn,
        createNativeFunction(fn, (...args) => {
          const val = args[0] && args[0].type === "number"
            ? (args[0] as { type: "number"; value: number }).value
            : 0;
          return createNumber(Math[fn](val));
        }, 1),
      );
    }
    setProperty(
      mathObj,
      "max",
      createNativeFunction("max", (...args) => {
        const nums = args.filter((a) => a.type === "number").map((a) =>
          (a as { type: "number"; value: number }).value
        );
        return createNumber(nums.length ? Math.max(...nums) : -Infinity);
      }),
    );
    setProperty(
      mathObj,
      "min",
      createNativeFunction("min", (...args) => {
        const nums = args.filter((a) => a.type === "number").map((a) =>
          (a as { type: "number"; value: number }).value
        );
        return createNumber(nums.length ? Math.min(...nums) : Infinity);
      }),
    );
    setProperty(
      mathObj,
      "pow",
      createNativeFunction("pow", (...args) => {
        const base = args[0] && args[0].type === "number"
          ? (args[0] as { type: "number"; value: number }).value
          : 0;
        const exp = args[1] && args[1].type === "number"
          ? (args[1] as { type: "number"; value: number }).value
          : 0;
        return createNumber(Math.pow(base, exp));
      }, 2),
    );
    setProperty(
      mathObj,
      "random",
      createNativeFunction("random", () => createNumber(Math.random())),
    );
    setProperty(this.context.global, "Math", mathObj);
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
    setProperty(windowObj, "devicePixelRatio", createNumber(1));

    // Scrolling
    setProperty(windowObj, "scrollX", createNumber(0));
    setProperty(windowObj, "scrollY", createNumber(0));
    setProperty(windowObj, "pageXOffset", createNumber(0));
    setProperty(windowObj, "pageYOffset", createNumber(0));
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

    // requestAnimationFrame / cancelAnimationFrame
    let rafId = 0;
    const rafCallbacks = new Map<number, number>();
    setProperty(
      windowObj,
      "requestAnimationFrame",
      createNativeFunction("requestAnimationFrame", (...args) => {
        const id = ++rafId;
        const invokeCallback = this.createCallbackInvoker(args[0]);
        // Schedule callback via setTimeout(cb, ~16ms) for ~60fps simulation
        const timerId = setTimeout(() => {
          rafCallbacks.delete(id);
          invokeCallback();
        }, 16) as unknown as number;
        rafCallbacks.set(id, timerId);
        return createNumber(id);
      }, 1),
    );
    setProperty(
      windowObj,
      "cancelAnimationFrame",
      createNativeFunction("cancelAnimationFrame", (...args) => {
        const id = args[0] && args[0].type === "number"
          ? (args[0] as { type: "number"; value: number }).value
          : 0;
        const timerId = rafCallbacks.get(id);
        if (timerId !== undefined) {
          clearTimeout(timerId);
          rafCallbacks.delete(id);
        }
        return createUndefined();
      }, 1),
    );

    // Event system on window
    const eventListeners = new Map<string, JSValue[]>();
    setProperty(
      windowObj,
      "addEventListener",
      createNativeFunction("addEventListener", (...args) => {
        const eventName = args[0] && args[0].type === "string"
          ? (args[0] as { type: "string"; value: string }).value
          : "";
        const handler = args[1];
        if (eventName && handler) {
          if (!eventListeners.has(eventName)) eventListeners.set(eventName, []);
          eventListeners.get(eventName)!.push(handler);
        }
        return createUndefined();
      }, 2),
    );
    setProperty(
      windowObj,
      "removeEventListener",
      createNativeFunction("removeEventListener", (...args) => {
        const eventName = args[0] && args[0].type === "string"
          ? (args[0] as { type: "string"; value: string }).value
          : "";
        const handler = args[1];
        if (eventName && handler && eventListeners.has(eventName)) {
          const listeners = eventListeners.get(eventName)!;
          const idx = listeners.indexOf(handler);
          if (idx !== -1) listeners.splice(idx, 1);
        }
        return createUndefined();
      }, 2),
    );
    setProperty(
      windowObj,
      "dispatchEvent",
      createNativeFunction("dispatchEvent", (...args) => {
        const event = args[0];
        if (event && event.type === "object") {
          const typeProp = getProperty(event, "type");
          const eventName = typeProp && typeProp.type === "string"
            ? (typeProp as { type: "string"; value: string }).value
            : "";
          const listeners = eventListeners.get(eventName) ?? [];
          for (const listener of listeners) {
            if (listener.type === "function") {
              if (listener.value.isNative && listener.value.nativeImpl) {
                listener.value.nativeImpl(event);
              } else if (listener.value.code && typeof listener.value.code === "object") {
                // Non-native JS function: compile and execute via interpreter
                try {
                  const funcNode = listener.value.code as { body?: { body: unknown[] } };
                  if (funcNode.body) {
                    const generator = new BytecodeGenerator();
                    const compiled = generator.generate({
                      type: "Program",
                      body: funcNode.body.body,
                    } as unknown as ProgramNode);
                    this.context.getInterpreter().executeFunction(compiled, [event ?? createUndefined()]);
                  }
                } catch {
                  // Best-effort execution
                }
              }
            }
          }
        }
        return createBoolean(true);
      }, 1),
    );

    // getComputedStyle — returns an object with getPropertyValue()
    setProperty(
      windowObj,
      "getComputedStyle",
      createNativeFunction("getComputedStyle", (...args) => {
        const element = args[0];
        const styleObj = createObject();

        // Default computed style values
        const defaults: Record<string, string> = {
          display: "block",
          visibility: "visible",
          position: "static",
          width: "auto",
          height: "auto",
          margin: "0px",
          padding: "0px",
          fontSize: "16px",
          color: "rgb(0, 0, 0)",
          backgroundColor: "rgba(0, 0, 0, 0)",
        };

        // If the element has a style property, read inline styles to override defaults
        if (element && element.type === "object") {
          const styleProp = getProperty(element, "style");
          if (styleProp && styleProp.type === "object") {
            for (const prop of Object.keys(defaults)) {
              const val = getProperty(styleProp, prop);
              if (val && val.type === "string") {
                defaults[prop] = (val as { type: "string"; value: string }).value;
              }
            }
          }
        }

        setProperty(
          styleObj,
          "getPropertyValue",
          createNativeFunction("getPropertyValue", (...gpvArgs) => {
            const propName = gpvArgs[0] && gpvArgs[0].type === "string"
              ? (gpvArgs[0] as { type: "string"; value: string }).value
              : "";
            // Convert CSS property name (kebab-case) to camelCase for lookup
            const camelCase = propName.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
            return createString(defaults[camelCase] ?? defaults[propName] ?? "");
          }, 1),
        );

        for (const [prop, val] of Object.entries(defaults)) {
          setProperty(styleObj, prop, createString(val));
        }

        return styleObj;
      }, 1),
    );

    // matchMedia — returns a MediaQueryList-like object
    setProperty(
      windowObj,
      "matchMedia",
      createNativeFunction("matchMedia", (...args) => {
        const query = args[0] && args[0].type === "string"
          ? (args[0] as { type: "string"; value: string }).value
          : "";
        const mql = createObject();
        setProperty(mql, "matches", createBoolean(false));
        setProperty(mql, "media", createString(query));
        setProperty(
          mql,
          "addEventListener",
          createNativeFunction("addEventListener", () => createUndefined(), 2),
        );
        setProperty(
          mql,
          "removeEventListener",
          createNativeFunction("removeEventListener", () => createUndefined(), 2),
        );
        setProperty(
          mql,
          "addListener",
          createNativeFunction("addListener", () => createUndefined(), 1),
        );
        setProperty(
          mql,
          "removeListener",
          createNativeFunction("removeListener", () => createUndefined(), 1),
        );
        return mql;
      }, 1),
    );

    // postMessage — headless no-op
    setProperty(
      windowObj,
      "postMessage",
      createNativeFunction("postMessage", () => {
        return createUndefined();
      }, 2),
    );

    // open / close / focus / blur / print — headless stubs
    setProperty(windowObj, "open", createNativeFunction("open", () => createNull(), 3));
    setProperty(windowObj, "close", createNativeFunction("close", () => createUndefined()));
    setProperty(windowObj, "focus", createNativeFunction("focus", () => createUndefined()));
    setProperty(windowObj, "blur", createNativeFunction("blur", () => createUndefined()));
    setProperty(windowObj, "print", createNativeFunction("print", () => createUndefined()));
    setProperty(windowObj, "stop", createNativeFunction("stop", () => createUndefined()));

    // getSelection — returns a Selection-like stub
    setProperty(
      windowObj,
      "getSelection",
      createNativeFunction("getSelection", () => {
        const sel = createObject();
        setProperty(sel, "toString", createNativeFunction("toString", () => createString("")));
        setProperty(sel, "anchorNode", createNull());
        setProperty(sel, "focusNode", createNull());
        setProperty(sel, "rangeCount", createNumber(0));
        setProperty(sel, "isCollapsed", createBoolean(true));
        setProperty(
          sel,
          "removeAllRanges",
          createNativeFunction("removeAllRanges", () => createUndefined()),
        );
        setProperty(sel, "collapse", createNativeFunction("collapse", () => createUndefined(), 2));
        return sel;
      }),
    );

    // Window state
    setProperty(windowObj, "closed", createBoolean(false));
    setProperty(windowObj, "name", createString(""));
    setProperty(windowObj, "opener", createNull());
    setProperty(windowObj, "parent", windowObj);
    setProperty(windowObj, "top", windowObj);
    setProperty(windowObj, "frameElement", createNull());
    setProperty(windowObj, "frames", windowObj);
    setProperty(windowObj, "length", createNumber(0));

    // Visibility
    setProperty(windowObj, "isSecureContext", createBoolean(this.url.startsWith("https:")));

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
      userAgent: "BrowserX/1.0",
      language: "en-US",
      platform: "BrowserX",
      cookieEnabled: true,
      onLine: true,
    };
  }

  /**
   * Create a JSValue Headers object from an HTTPHeaders Map with get/has/entries methods
   */
  private createHeadersJSValue(headers: Map<string, string>): JSValue {
    const headersObj = createObject();

    // Set all header values as direct properties (lowercase keys)
    for (const [key, value] of headers) {
      setProperty(headersObj, key.toLowerCase(), createString(value));
    }

    // get(name) — case-insensitive header lookup
    setProperty(
      headersObj,
      "get",
      createNativeFunction("get", (...args) => {
        const name = args[0] && args[0].type === "string"
          ? (args[0] as { type: "string"; value: string }).value.toLowerCase()
          : "";
        for (const [key, value] of headers) {
          if (key.toLowerCase() === name) return createString(value);
        }
        return createNull();
      }, 1),
    );

    // has(name) — case-insensitive header check
    setProperty(
      headersObj,
      "has",
      createNativeFunction("has", (...args) => {
        const name = args[0] && args[0].type === "string"
          ? (args[0] as { type: "string"; value: string }).value.toLowerCase()
          : "";
        for (const [key] of headers) {
          if (key.toLowerCase() === name) return createBoolean(true);
        }
        return createBoolean(false);
      }, 1),
    );

    // entries() — returns array of [key, value] pairs
    setProperty(
      headersObj,
      "entries",
      createNativeFunction("entries", () => {
        const arr = createObject();
        let i = 0;
        for (const [key, value] of headers) {
          const pair = createObject();
          setProperty(pair, "0", createString(key.toLowerCase()));
          setProperty(pair, "1", createString(value));
          setProperty(pair, "length", createNumber(2));
          setProperty(arr, String(i), pair);
          i++;
        }
        setProperty(arr, "length", createNumber(i));
        return arr;
      }),
    );

    // forEach(callback) — iterate over headers
    setProperty(
      headersObj,
      "forEach",
      createNativeFunction("forEach", () => {
        // Cannot invoke JS callbacks from native functions in this engine model
        return createUndefined();
      }, 1),
    );

    return headersObj;
  }

  /**
   * Build a fetch Response JSValue from resolved request result data
   */
  private buildFetchResponse(
    fetchUrl: string,
    cachedResult: {
      statusCode: number;
      statusText: string;
      headers: Map<string, string>;
      body: Uint8Array;
    } | null,
    resultError: Error | null,
  ): JSValue {
    const responseObj = createObject();
    let bodyUsed = false;

    if (resultError) {
      // Network error response
      setProperty(responseObj, "ok", createBoolean(false));
      setProperty(responseObj, "status", createNumber(0));
      setProperty(responseObj, "statusText", createString(resultError.message));
      setProperty(responseObj, "url", createString(fetchUrl));
      setProperty(responseObj, "type", createString("error"));
      setProperty(responseObj, "redirected", createBoolean(false));
      setProperty(responseObj, "bodyUsed", createBoolean(false));
      setProperty(responseObj, "headers", this.createHeadersJSValue(new Map()));
      setProperty(responseObj, "text", createNativeFunction("text", () => createString("")));
      setProperty(responseObj, "json", createNativeFunction("json", () => createNull()));
      setProperty(responseObj, "blob", createNativeFunction("blob", () => createObject()));
      setProperty(
        responseObj,
        "arrayBuffer",
        createNativeFunction("arrayBuffer", () => createObject()),
      );
      setProperty(
        responseObj,
        "clone",
        createNativeFunction("clone", () => {
          return this.buildFetchResponse(fetchUrl, null, resultError);
        }),
      );
      return responseObj;
    }

    const statusCode = cachedResult ? cachedResult.statusCode : 200;
    const statusText = cachedResult ? cachedResult.statusText : "OK";
    const respHeaders = cachedResult ? cachedResult.headers : new Map<string, string>();
    const respBody = cachedResult ? cachedResult.body : new Uint8Array();

    setProperty(responseObj, "ok", createBoolean(statusCode >= 200 && statusCode < 300));
    setProperty(responseObj, "status", createNumber(statusCode));
    setProperty(responseObj, "statusText", createString(statusText));
    setProperty(responseObj, "url", createString(fetchUrl));
    setProperty(responseObj, "type", createString("basic"));
    setProperty(responseObj, "redirected", createBoolean(false));
    setProperty(responseObj, "bodyUsed", createBoolean(false));
    setProperty(responseObj, "headers", this.createHeadersJSValue(respHeaders));

    const markBodyUsed = () => {
      bodyUsed = true;
      setProperty(responseObj, "bodyUsed", createBoolean(true));
    };

    setProperty(
      responseObj,
      "text",
      createNativeFunction("text", () => {
        markBodyUsed();
        return createString(new TextDecoder().decode(respBody));
      }),
    );

    setProperty(
      responseObj,
      "json",
      createNativeFunction("json", () => {
        markBodyUsed();
        try {
          const text = new TextDecoder().decode(respBody);
          const parsed = JSON.parse(text);
          return this.nativeToJSValue(parsed);
        } catch {
          return createNull();
        }
      }),
    );

    setProperty(
      responseObj,
      "blob",
      createNativeFunction("blob", () => {
        markBodyUsed();
        // Return a Blob-like JSValue with size and type
        const blobObj = createObject();
        setProperty(blobObj, "size", createNumber(respBody.byteLength));
        const contentType = respHeaders.get("content-type") ?? respHeaders.get("Content-Type") ??
          "";
        setProperty(blobObj, "type", createString(contentType));
        setProperty(
          blobObj,
          "text",
          createNativeFunction("text", () => {
            return createString(new TextDecoder().decode(respBody));
          }),
        );
        return blobObj;
      }),
    );

    setProperty(
      responseObj,
      "arrayBuffer",
      createNativeFunction("arrayBuffer", () => {
        markBodyUsed();
        // Return an ArrayBuffer-like JSValue with byteLength
        const bufObj = createObject();
        setProperty(bufObj, "byteLength", createNumber(respBody.byteLength));
        return bufObj;
      }),
    );

    setProperty(
      responseObj,
      "clone",
      createNativeFunction("clone", () => {
        return this.buildFetchResponse(fetchUrl, cachedResult, null);
      }),
    );

    return responseObj;
  }

  /**
   * Create fetch API — executes HTTP requests via RequestPipeline
   * Supports GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS methods
   * Returns a synchronous Response JSValue (engine lacks Promise support)
   */
  private createFetch(): JSValue {
    return createNativeFunction("fetch", (...args) => {
      if (!this.requestPipeline) {
        console.log("[JS] fetch called (no pipeline)", args);
        return createObject();
      }

      // Extract URL from first arg
      const urlArg = args[0];
      let fetchUrl = "";
      if (urlArg && urlArg.type === "string") {
        fetchUrl = (urlArg as { type: "string"; value: string }).value;
      } else {
        return createObject();
      }

      // SSRF validation — block private IPs, dangerous protocols, etc.
      try {
        URLValidator.validate(fetchUrl);
      } catch (e) {
        if (e instanceof SSRFError) {
          console.warn(`[JS] fetch blocked by SSRF validator: ${fetchUrl}`);
          return createObject();
        }
        throw e;
      }

      // CSP connect-src check
      if (this.csp && !this.csp.allows("connect-src", fetchUrl, this.origin)) {
        console.warn(`[JS] fetch blocked by CSP connect-src: ${fetchUrl}`);
        return this.buildFetchResponse(
          fetchUrl,
          null,
          new Error(
            `Refused to connect to '${fetchUrl}' because it violates the Content Security Policy directive: connect-src`,
          ),
        );
      }

      // Extract options from second arg
      const optionsArg = args[1];
      let method = "GET";
      const reqHeaders: Record<string, string> = {};
      let body: string | undefined;

      if (optionsArg && optionsArg.type === "object") {
        const methodProp = getProperty(optionsArg, "method");
        if (methodProp && methodProp.type === "string") {
          method = (methodProp as { type: "string"; value: string }).value.toUpperCase();
        }
        const headersProp = getProperty(optionsArg, "headers");
        if (headersProp && headersProp.type === "object") {
          const hdrObj = headersProp.value as { properties: Map<string, JSValue> };
          if (hdrObj.properties) {
            for (const [k, v] of hdrObj.properties) {
              if (v.type === "string") {
                reqHeaders[k as string] = (v as { type: "string"; value: string }).value;
              }
            }
          }
        }
        const bodyProp = getProperty(optionsArg, "body");
        if (bodyProp && bodyProp.type === "string") {
          body = (bodyProp as { type: "string"; value: string }).value;
        }
      }

      // Fire the request eagerly — use dedicated pipeline methods for
      // GET/POST/PUT/DELETE, fall back to generic request() for PATCH/HEAD/OPTIONS
      try {
        let resultPromise;
        const bodyBytes = body ? new TextEncoder().encode(body) : new Uint8Array();
        if (method === "POST") {
          resultPromise = this.requestPipeline!.post(fetchUrl, bodyBytes, { headers: reqHeaders });
        } else if (method === "PUT") {
          resultPromise = this.requestPipeline!.put(fetchUrl, bodyBytes, { headers: reqHeaders });
        } else if (method === "DELETE") {
          resultPromise = this.requestPipeline!.delete(fetchUrl, { headers: reqHeaders });
        } else if (method === "PATCH") {
          resultPromise = this.requestPipeline!.request(fetchUrl, {
            method: "PATCH",
            headers: reqHeaders,
            body: bodyBytes,
          });
        } else if (method === "HEAD") {
          resultPromise = this.requestPipeline!.request(fetchUrl, {
            method: "HEAD",
            headers: reqHeaders,
          });
        } else if (method === "OPTIONS") {
          resultPromise = this.requestPipeline!.request(fetchUrl, {
            method: "OPTIONS",
            headers: reqHeaders,
          });
        } else {
          resultPromise = this.requestPipeline!.get(fetchUrl, { headers: reqHeaders });
        }

        // Build response object — synchronous wrapper since the engine lacks Promise support
        // The request fires eagerly; body methods read from cachedResult when resolved
        let cachedResult: {
          statusCode: number;
          statusText: string;
          headers: Map<string, string>;
          body: Uint8Array;
        } | null = null;
        let resultError: Error | null = null;

        resultPromise.then((r) => {
          cachedResult = {
            statusCode: r.response.statusCode,
            statusText: r.response.statusText,
            headers: r.response.headers,
            body: r.response.body as Uint8Array,
          };
        }).catch((e) => {
          resultError = e instanceof Error ? e : new Error(String(e));
        });

        // Build a response that reads from cachedResult/resultError via closures
        const responseObj = createObject();
        let bodyUsed = false;

        // These properties update lazily when the result resolves
        // Initially set placeholders, then text()/json() etc. read from cachedResult
        setProperty(responseObj, "url", createString(fetchUrl));
        setProperty(responseObj, "type", createString("basic"));
        setProperty(responseObj, "redirected", createBoolean(false));
        setProperty(responseObj, "bodyUsed", createBoolean(false));

        // ok, status, statusText, headers — read lazily from cachedResult
        setProperty(responseObj, "ok", createBoolean(true));
        setProperty(responseObj, "status", createNumber(200));
        setProperty(responseObj, "statusText", createString("OK"));
        setProperty(responseObj, "headers", createObject());

        const markBodyUsed = () => {
          bodyUsed = true;
          setProperty(responseObj, "bodyUsed", createBoolean(true));
        };

        // Update response properties once result is available
        const updateResponseProps = () => {
          if (cachedResult) {
            setProperty(
              responseObj,
              "ok",
              createBoolean(cachedResult.statusCode >= 200 && cachedResult.statusCode < 300),
            );
            setProperty(responseObj, "status", createNumber(cachedResult.statusCode));
            setProperty(responseObj, "statusText", createString(cachedResult.statusText));
            setProperty(responseObj, "headers", this.createHeadersJSValue(cachedResult.headers));
          } else if (resultError) {
            setProperty(responseObj, "ok", createBoolean(false));
            setProperty(responseObj, "status", createNumber(0));
            setProperty(responseObj, "statusText", createString(resultError.message));
          }
        };

        setProperty(
          responseObj,
          "text",
          createNativeFunction("text", () => {
            updateResponseProps();
            markBodyUsed();
            if (cachedResult) {
              return createString(new TextDecoder().decode(cachedResult.body));
            }
            return createString("");
          }),
        );

        setProperty(
          responseObj,
          "json",
          createNativeFunction("json", () => {
            updateResponseProps();
            markBodyUsed();
            if (cachedResult) {
              try {
                const text = new TextDecoder().decode(cachedResult.body);
                const parsed = JSON.parse(text);
                return this.nativeToJSValue(parsed);
              } catch {
                return createNull();
              }
            }
            return createNull();
          }),
        );

        setProperty(
          responseObj,
          "blob",
          createNativeFunction("blob", () => {
            updateResponseProps();
            markBodyUsed();
            const blobObj = createObject();
            if (cachedResult) {
              setProperty(blobObj, "size", createNumber(cachedResult.body.byteLength));
              const ct = cachedResult.headers.get("content-type") ??
                cachedResult.headers.get("Content-Type") ?? "";
              setProperty(blobObj, "type", createString(ct));
              const bodyRef = cachedResult.body;
              setProperty(
                blobObj,
                "text",
                createNativeFunction("text", () => {
                  return createString(new TextDecoder().decode(bodyRef));
                }),
              );
            } else {
              setProperty(blobObj, "size", createNumber(0));
              setProperty(blobObj, "type", createString(""));
              setProperty(blobObj, "text", createNativeFunction("text", () => createString("")));
            }
            return blobObj;
          }),
        );

        setProperty(
          responseObj,
          "arrayBuffer",
          createNativeFunction("arrayBuffer", () => {
            updateResponseProps();
            markBodyUsed();
            const bufObj = createObject();
            setProperty(
              bufObj,
              "byteLength",
              createNumber(cachedResult ? cachedResult.body.byteLength : 0),
            );
            return bufObj;
          }),
        );

        setProperty(
          responseObj,
          "clone",
          createNativeFunction("clone", () => {
            return this.buildFetchResponse(fetchUrl, cachedResult, resultError);
          }),
        );

        return responseObj;
      } catch (e) {
        console.error("[JS] fetch error:", e);
        return this.buildFetchResponse(
          fetchUrl,
          null,
          e instanceof Error ? e : new Error(String(e)),
        );
      }
    }, 2);
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
   * Create a JSValue storage object backed by StorageManager or in-memory fallback
   */
  private createStorageJSValue(type: "local" | "session"): JSValue {
    const storageObj = createObject();
    const storage = this.storageManager
      ? (type === "local"
        ? this.storageManager.getLocalStorage(this.origin)
        : this.storageManager.getSessionStorage(this.origin))
      : null;
    const url = this.url;

    if (storage) {
      // Wired to StorageManager — origin-isolated, quota-tracked, event-emitting
      setProperty(
        storageObj,
        "getItem",
        createNativeFunction("getItem", (...args) => {
          const key = args[0] && args[0].type === "string"
            ? (args[0] as { type: "string"; value: string }).value
            : "";
          const result = storage.getItem(key);
          return result !== null ? createString(result) : createNull();
        }, 1),
      );

      setProperty(
        storageObj,
        "setItem",
        createNativeFunction("setItem", (...args) => {
          const key = args[0] && args[0].type === "string"
            ? (args[0] as { type: "string"; value: string }).value
            : "";
          const value = args[1] && args[1].type === "string"
            ? (args[1] as { type: "string"; value: string }).value
            : args[1]
            ? String((args[1] as { value?: unknown }).value ?? "")
            : "";
          storage.setItem(key, value, url);
          return createUndefined();
        }, 2),
      );

      setProperty(
        storageObj,
        "removeItem",
        createNativeFunction("removeItem", (...args) => {
          const key = args[0] && args[0].type === "string"
            ? (args[0] as { type: "string"; value: string }).value
            : "";
          storage.removeItem(key, url);
          return createUndefined();
        }, 1),
      );

      setProperty(
        storageObj,
        "clear",
        createNativeFunction("clear", () => {
          storage.clear(url);
          return createUndefined();
        }),
      );

      setProperty(
        storageObj,
        "key",
        createNativeFunction("key", (...args) => {
          const index = args[0] && args[0].type === "number"
            ? (args[0] as { type: "number"; value: number }).value
            : 0;
          const result = storage.key(index);
          return result !== null ? createString(result) : createNull();
        }, 1),
      );

      setProperty(storageObj, "length", createNumber(storage.length));
    } else {
      // Fallback: in-memory Storage backed by createLocalStorage/createSessionStorage
      // Data persists within the page lifecycle but not across reloads
      const fallback = type === "local" ? this.createLocalStorage() : this.createSessionStorage();

      setProperty(
        storageObj,
        "getItem",
        createNativeFunction("getItem", (...args) => {
          const key = args[0] && args[0].type === "string"
            ? (args[0] as { type: "string"; value: string }).value
            : "";
          const result = fallback.getItem(key);
          return result !== null ? createString(result) : createNull();
        }, 1),
      );

      setProperty(
        storageObj,
        "setItem",
        createNativeFunction("setItem", (...args) => {
          const key = args[0] && args[0].type === "string"
            ? (args[0] as { type: "string"; value: string }).value
            : "";
          const value = args[1] && args[1].type === "string"
            ? (args[1] as { type: "string"; value: string }).value
            : args[1]
            ? String((args[1] as { value?: unknown }).value ?? "")
            : "";
          fallback.setItem(key, value);
          return createUndefined();
        }, 2),
      );

      setProperty(
        storageObj,
        "removeItem",
        createNativeFunction("removeItem", (...args) => {
          const key = args[0] && args[0].type === "string"
            ? (args[0] as { type: "string"; value: string }).value
            : "";
          fallback.removeItem(key);
          return createUndefined();
        }, 1),
      );

      setProperty(
        storageObj,
        "clear",
        createNativeFunction("clear", () => {
          fallback.clear();
          return createUndefined();
        }),
      );

      setProperty(
        storageObj,
        "key",
        createNativeFunction("key", (...args) => {
          const index = args[0] && args[0].type === "number"
            ? (args[0] as { type: "number"; value: number }).value
            : 0;
          const result = fallback.key(index);
          return result !== null ? createString(result) : createNull();
        }, 1),
      );

      setProperty(storageObj, "length", createNumber(fallback.length));
    }

    return storageObj;
  }

  /**
   * Convert a native JS value to a JSValue
   */
  private nativeToJSValue(value: unknown): JSValue {
    if (value === null || value === undefined) return createNull();
    if (typeof value === "string") return createString(value);
    if (typeof value === "number") return createNumber(value);
    if (typeof value === "boolean") return createBoolean(value);
    if (Array.isArray(value)) {
      const arr = createObject();
      for (let i = 0; i < value.length; i++) {
        setProperty(arr, String(i), this.nativeToJSValue(value[i]));
      }
      setProperty(arr, "length", createNumber(value.length));
      return arr;
    }
    if (typeof value === "object") {
      const obj = createObject();
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        setProperty(obj, k, this.nativeToJSValue(v));
      }
      return obj;
    }
    return createString(String(value));
  }

  /**
   * Convert a JSValue to a native JSON string
   */
  private jsValueToNative(value: JSValue): string {
    if (value.type === "null") return "null";
    if (value.type === "undefined") return "undefined";
    if (value.type === "string") {
      return JSON.stringify((value as { type: "string"; value: string }).value);
    }
    if (value.type === "number") return String((value as { type: "number"; value: number }).value);
    if (value.type === "boolean") {
      return String((value as { type: "boolean"; value: boolean }).value);
    }
    if (value.type === "object") {
      const props = (value.value as { properties?: Map<string, JSValue> })?.properties;
      if (!props) return "{}";
      // Check if it's array-like (has "length" property that's a number)
      const lengthProp = props.get("length");
      if (lengthProp && lengthProp.type === "number") {
        const len = (lengthProp as { type: "number"; value: number }).value;
        const items: string[] = [];
        for (let i = 0; i < len; i++) {
          const item = props.get(String(i));
          items.push(item ? this.jsValueToNative(item) : "null");
        }
        return `[${items.join(",")}]`;
      }
      const entries: string[] = [];
      for (const [k, v] of props) {
        if (v.type !== "function") {
          entries.push(`${JSON.stringify(k)}:${this.jsValueToNative(v)}`);
        }
      }
      return `{${entries.join(",")}}`;
    }
    return "null";
  }

  /**
   * Deep clone a JSValue, handling circular references via a visited map
   */
  private deepCloneJSValue(val: JSValue, visited: Map<object, JSValue>): JSValue {
    if (val.type === "string") {
      return createString((val as { type: "string"; value: string }).value);
    }
    if (val.type === "number") {
      return createNumber((val as { type: "number"; value: number }).value);
    }
    if (val.type === "boolean") {
      return createBoolean((val as { type: "boolean"; value: boolean }).value);
    }
    if (val.type === "null") return createNull();
    if (val.type === "undefined") return createUndefined();
    if (val.type === "object") {
      const objValue = val.value as { properties?: Map<string, JSValue> };
      // Check for circular reference
      if (visited.has(objValue as object)) {
        return visited.get(objValue as object)!;
      }
      const clone = createObject();
      visited.set(objValue as object, clone);
      const props = objValue?.properties;
      if (props) {
        for (const [k, v] of props) {
          setProperty(clone, k as string, this.deepCloneJSValue(v, visited));
        }
      }
      return clone;
    }
    // Functions are not cloneable by structuredClone spec — return as-is
    return val;
  }

  /**
   * Create a callback invoker for a JSValue function (used by timers and rAF)
   * Handles both native functions (nativeImpl) and non-native JS functions (AST-compiled)
   */
  private createCallbackInvoker(callback: JSValue | undefined): () => void {
    if (!callback || callback.type !== "function") {
      return () => {};
    }
    const fn = callback.value as {
      isNative: boolean;
      nativeImpl?: (...args: JSValue[]) => JSValue;
      code?: unknown;
      name: string;
      length: number;
    };
    return () => {
      try {
        if (fn.isNative && fn.nativeImpl) {
          fn.nativeImpl();
        } else if (fn.code && typeof fn.code === "object" && fn.code !== null) {
          // Non-native JS function with AST body — compile and execute
          const funcNode = fn.code as { body?: { body: unknown[] } };
          if (funcNode.body) {
            const generator = new BytecodeGenerator();
            const compiled = generator.generate({
              type: "Program",
              body: funcNode.body.body,
            } as unknown as ProgramNode);
            this.context.getInterpreter().executeFunction(compiled, []);
          }
        }
      } catch (error) {
        console.error("Timer callback error:", error);
      }
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
  /**
   * Set Content Security Policy for fetch connect-src enforcement
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

  getDOMBindings(): DOMBindings {
    return this.domBindings;
  }

  /**
   * Get the document as a JSDocument wrapper
   */
  getJSDocument(): JSDocument {
    return this.domBindings.wrapNode(this.document) as JSDocument;
  }
}
