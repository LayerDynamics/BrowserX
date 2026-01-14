// ============================================================================
// JAVASCRIPT TYPES
// ============================================================================

/**
 * JavaScript value types
 */
export type JSValueType =
    | "undefined"
    | "null"
    | "boolean"
    | "number"
    | "string"
    | "symbol"
    | "object"
    | "function";

/**
 * Base JavaScript value
 */
export interface JSValue {
    type?: JSValueType;
    value?: unknown;
    prototype?: JSValue;
    constructor?: JSValue;

    // For objects
    properties?: Map<string, JSValue>;

    // For functions
    call?: (...args: unknown[]) => unknown;
    apply?: (thisArg: unknown, args: unknown[]) => unknown;
    bind?: (thisArg: unknown, ...args: unknown[]) => JSValue;

    // Property descriptors
    get?: () => unknown;
    set?: (value: unknown) => void;
    writable?: boolean;
    enumerable?: boolean;
    configurable?: boolean;
}

/**
 * JavaScript function
 */
export interface JSFunction extends JSValue {
    type: "function";
    call: (...args: unknown[]) => unknown;
    apply: (thisArg: unknown, args: unknown[]) => unknown;
    bind: (thisArg: unknown, ...args: unknown[]) => JSFunction;
    name?: string;
    length?: number;
}

/**
 * JavaScript object
 */
export interface JSObject extends JSValue {
    type: "object";
    properties: Map<string, JSValue>;
}

/**
 * JavaScript array
 */
export interface JSArray extends JSObject {
    length: number;
    [index: number]: JSValue;
}

/**
 * JavaScript promise
 */
export interface JSPromise<T = unknown> extends JSObject {
    then<TResult1 = T, TResult2 = never>(
        onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null,
        onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ): JSPromise<TResult1 | TResult2>;

    catch<TResult = never>(
        onrejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null,
    ): JSPromise<T | TResult>;

    finally(onfinally?: (() => void) | null): JSPromise<T>;
}

/**
 * JavaScript error
 */
export interface JSError extends JSObject {
    name: string;
    message: string;
    stack?: string;
}

/**
 * JavaScript execution context
 */
export interface JSExecutionContext {
    globalObject: JSObject;
    thisBinding: JSValue;
    variableEnvironment: JSEnvironment;
    lexicalEnvironment: JSEnvironment;
}

/**
 * JavaScript environment record
 */
export interface JSEnvironment {
    parent: JSEnvironment | null;
    bindings: Map<string, JSValue>;
}

/**
 * JavaScript compilation result
 */
export interface JSCompiled {
    code: string;
    sourceURL?: string;
    lineOffset?: number;
    columnOffset?: number;
}

/**
 * V8 heap statistics
 */
export interface V8HeapStatistics {
    totalHeapSize: number;
    totalHeapSizeExecutable: number;
    totalPhysicalSize: number;
    totalAvailableSize: number;
    usedHeapSize: number;
    heapSizeLimit: number;
    mallocedMemory: number;
    peakMallocedMemory: number;
    doesZapGarbage: boolean;
    numberOfNativeContexts: number;
    numberOfDetachedContexts: number;
}
