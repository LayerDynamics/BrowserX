/**
 * JavaScript Value Types
 *
 * Represents JavaScript values with proper type system:
 * - Primitive types: undefined, null, boolean, number, string, symbol, bigint
 * - Object types: object, function, array
 * - Internal types for engine optimization
 */

/**
 * JavaScript value type tags
 */
export enum JSValueType {
    UNDEFINED = "undefined",
    NULL = "null",
    BOOLEAN = "boolean",
    NUMBER = "number",
    STRING = "string",
    OBJECT = "object",
    FUNCTION = "function",
    SYMBOL = "symbol",
    BIGINT = "bigint",
}

/**
 * JavaScript object
 */
export interface JSObject {
    properties: Map<string | symbol, JSValue>;
    prototype: JSObject | null;
    extensible: boolean;
    constructor?: JSFunction;
}

/**
 * JavaScript function
 */
export interface JSFunction extends JSObject {
    name: string;
    length: number;
    code: string | Uint8Array; // Source code or bytecode
    scope: Environment | null;
    isNative: boolean;
    nativeImpl?: (...args: JSValue[]) => JSValue;
}

/**
 * JavaScript symbol
 */
export interface JSSymbol {
    description: string | undefined;
    id: number;
}

/**
 * Environment record for scope chain
 */
export interface Environment {
    bindings: Map<string, JSValue>;
    outer: Environment | null;
}

/**
 * JavaScript value representation
 * Uses tagged union for type safety
 */
export type JSValue =
    | { type: JSValueType.UNDEFINED }
    | { type: JSValueType.NULL }
    | { type: JSValueType.BOOLEAN; value: boolean }
    | { type: JSValueType.NUMBER; value: number }
    | { type: JSValueType.STRING; value: string }
    | { type: JSValueType.BIGINT; value: bigint }
    | { type: JSValueType.SYMBOL; value: JSSymbol }
    | { type: JSValueType.OBJECT; value: JSObject }
    | { type: JSValueType.FUNCTION; value: JSFunction };

/**
 * Create undefined value
 */
export function createUndefined(): JSValue {
    return { type: JSValueType.UNDEFINED };
}

/**
 * Create null value
 */
export function createNull(): JSValue {
    return { type: JSValueType.NULL };
}

/**
 * Create boolean value
 */
export function createBoolean(value: boolean): JSValue {
    return { type: JSValueType.BOOLEAN, value };
}

/**
 * Create number value
 */
export function createNumber(value: number): JSValue {
    return { type: JSValueType.NUMBER, value };
}

/**
 * Create string value
 */
export function createString(value: string): JSValue {
    return { type: JSValueType.STRING, value };
}

/**
 * Create bigint value
 */
export function createBigInt(value: bigint): JSValue {
    return { type: JSValueType.BIGINT, value };
}

/**
 * Create symbol value
 */
export function createSymbol(description?: string): JSValue {
    return {
        type: JSValueType.SYMBOL,
        value: {
            description,
            id: Math.random(), // Simplified - should use proper unique ID
        },
    };
}

/**
 * Create object value
 */
export function createObject(prototype: JSObject | null = null): JSValue {
    return {
        type: JSValueType.OBJECT,
        value: {
            properties: new Map(),
            prototype,
            extensible: true,
            constructor: undefined,
        },
    };
}

/**
 * Create function value
 */
export function createFunction(
    name: string,
    code: string | Uint8Array,
    length: number = 0,
    scope: Environment | null = null,
): JSValue {
    const func: JSFunction = {
        name,
        length,
        code,
        scope,
        isNative: false,
        properties: new Map(),
        prototype: null,
        extensible: true,
        constructor: undefined,
    };

    return {
        type: JSValueType.FUNCTION,
        value: func,
    };
}

/**
 * Create native function value
 */
export function createNativeFunction(
    name: string,
    impl: (...args: JSValue[]) => JSValue,
    length: number = 0,
): JSValue {
    const func: JSFunction = {
        name,
        length,
        code: "",
        scope: null,
        isNative: true,
        nativeImpl: impl,
        properties: new Map(),
        prototype: null,
        extensible: true,
        constructor: undefined,
    };

    return {
        type: JSValueType.FUNCTION,
        value: func,
    };
}

/**
 * Type guards
 */
export function isUndefined(value: JSValue): value is { type: JSValueType.UNDEFINED } {
    return value.type === JSValueType.UNDEFINED;
}

export function isNull(value: JSValue): value is { type: JSValueType.NULL } {
    return value.type === JSValueType.NULL;
}

export function isBoolean(value: JSValue): value is { type: JSValueType.BOOLEAN; value: boolean } {
    return value.type === JSValueType.BOOLEAN;
}

export function isNumber(value: JSValue): value is { type: JSValueType.NUMBER; value: number } {
    return value.type === JSValueType.NUMBER;
}

export function isString(value: JSValue): value is { type: JSValueType.STRING; value: string } {
    return value.type === JSValueType.STRING;
}

export function isBigInt(value: JSValue): value is { type: JSValueType.BIGINT; value: bigint } {
    return value.type === JSValueType.BIGINT;
}

export function isSymbol(value: JSValue): value is { type: JSValueType.SYMBOL; value: JSSymbol } {
    return value.type === JSValueType.SYMBOL;
}

export function isObject(value: JSValue): value is { type: JSValueType.OBJECT; value: JSObject } {
    return value.type === JSValueType.OBJECT;
}

export function isFunction(
    value: JSValue,
): value is { type: JSValueType.FUNCTION; value: JSFunction } {
    return value.type === JSValueType.FUNCTION;
}

/**
 * Type conversions
 */

/**
 * ToBoolean abstract operation
 */
export function toBoolean(value: JSValue): boolean {
    switch (value.type) {
        case JSValueType.UNDEFINED:
        case JSValueType.NULL:
            return false;
        case JSValueType.BOOLEAN:
            return value.value;
        case JSValueType.NUMBER:
            return value.value !== 0 && !Number.isNaN(value.value);
        case JSValueType.STRING:
            return value.value.length > 0;
        case JSValueType.BIGINT:
            return value.value !== 0n;
        case JSValueType.SYMBOL:
        case JSValueType.OBJECT:
        case JSValueType.FUNCTION:
            return true;
    }
}

/**
 * ToNumber abstract operation (simplified)
 */
export function toNumber(value: JSValue): number {
    switch (value.type) {
        case JSValueType.UNDEFINED:
            return NaN;
        case JSValueType.NULL:
            return 0;
        case JSValueType.BOOLEAN:
            return value.value ? 1 : 0;
        case JSValueType.NUMBER:
            return value.value;
        case JSValueType.STRING:
            return Number(value.value);
        case JSValueType.BIGINT:
            return Number(value.value);
        default:
            return NaN;
    }
}

/**
 * ToString abstract operation (simplified)
 */
export function toString(value: JSValue): string {
    switch (value.type) {
        case JSValueType.UNDEFINED:
            return "undefined";
        case JSValueType.NULL:
            return "null";
        case JSValueType.BOOLEAN:
            return value.value ? "true" : "false";
        case JSValueType.NUMBER:
            return String(value.value);
        case JSValueType.STRING:
            return value.value;
        case JSValueType.BIGINT:
            return String(value.value);
        case JSValueType.SYMBOL:
            return `Symbol(${value.value.description ?? ""})`;
        case JSValueType.OBJECT:
            return "[object Object]";
        case JSValueType.FUNCTION:
            return `function ${value.value.name}() { [native code] }`;
    }
}

/**
 * ToPrimitive abstract operation (simplified)
 */
export function toPrimitive(value: JSValue, hint: "number" | "string" = "number"): JSValue {
    // Primitives return as-is
    if (value.type !== JSValueType.OBJECT && value.type !== JSValueType.FUNCTION) {
        return value;
    }

    // For objects, would call valueOf/toString
    // Simplified implementation
    if (hint === "number") {
        return createNumber(NaN);
    } else {
        return createString("[object Object]");
    }
}

/**
 * Property access
 */

/**
 * Get property from object
 */
export function getProperty(obj: JSValue, key: string | symbol): JSValue {
    if (!isObject(obj) && !isFunction(obj)) {
        return createUndefined();
    }

    const object = obj.value;

    // Check own properties
    if (object.properties.has(key)) {
        return object.properties.get(key)!;
    }

    // Check prototype chain
    if (object.prototype) {
        return getProperty({ type: JSValueType.OBJECT, value: object.prototype }, key);
    }

    return createUndefined();
}

/**
 * Set property on object
 */
export function setProperty(obj: JSValue, key: string | symbol, value: JSValue): boolean {
    if (!isObject(obj) && !isFunction(obj)) {
        return false;
    }

    const object = obj.value;

    if (!object.extensible && !object.properties.has(key)) {
        return false;
    }

    object.properties.set(key, value);
    return true;
}

/**
 * Delete property from object
 */
export function deleteProperty(obj: JSValue, key: string | symbol): boolean {
    if (!isObject(obj) && !isFunction(obj)) {
        return false;
    }

    return obj.value.properties.delete(key);
}

/**
 * Has property check
 */
export function hasProperty(obj: JSValue, key: string | symbol): boolean {
    if (!isObject(obj) && !isFunction(obj)) {
        return false;
    }

    if (obj.value.properties.has(key)) {
        return true;
    }

    if (obj.value.prototype) {
        return hasProperty({ type: JSValueType.OBJECT, value: obj.value.prototype }, key);
    }

    return false;
}

/**
 * Comparison operations
 */

/**
 * Strict equality (===)
 */
export function strictEquals(a: JSValue, b: JSValue): boolean {
    if (a.type !== b.type) {
        return false;
    }

    switch (a.type) {
        case JSValueType.UNDEFINED:
        case JSValueType.NULL:
            return true;
        case JSValueType.BOOLEAN:
        case JSValueType.NUMBER:
        case JSValueType.STRING:
        case JSValueType.BIGINT:
            return a.value === (b as typeof a).value;
        case JSValueType.SYMBOL:
            return a.value.id === (b as typeof a).value.id;
        case JSValueType.OBJECT:
        case JSValueType.FUNCTION:
            return a.value === (b as typeof a).value;
    }
}

/**
 * Abstract equality (==) (simplified)
 */
export function abstractEquals(a: JSValue, b: JSValue): boolean {
    // Same type - use strict equality
    if (a.type === b.type) {
        return strictEquals(a, b);
    }

    // null == undefined
    if ((isNull(a) && isUndefined(b)) || (isUndefined(a) && isNull(b))) {
        return true;
    }

    // Number comparisons
    if (isNumber(a) && isString(b)) {
        return a.value === toNumber(b);
    }
    if (isString(a) && isNumber(b)) {
        return toNumber(a) === b.value;
    }

    // Boolean to number
    if (isBoolean(a)) {
        return abstractEquals(createNumber(a.value ? 1 : 0), b);
    }
    if (isBoolean(b)) {
        return abstractEquals(a, createNumber(b.value ? 1 : 0));
    }

    return false;
}
