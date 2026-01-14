/**
 * JSValue Tests
 *
 * Comprehensive tests for JavaScript value types and operations.
 */

import { assertEquals, assertStrictEquals } from "@std/assert";
import {
    JSValueType,
    type JSValue,
    type JSObject,
    type JSFunction,
    type JSSymbol,
    type Environment,
    createUndefined,
    createNull,
    createBoolean,
    createNumber,
    createString,
    createBigInt,
    createSymbol,
    createObject,
    createFunction,
    createNativeFunction,
    isUndefined,
    isNull,
    isBoolean,
    isNumber,
    isString,
    isBigInt,
    isSymbol,
    isObject,
    isFunction,
    toBoolean,
    toNumber,
    toString,
    toPrimitive,
    getProperty,
    setProperty,
    deleteProperty,
    hasProperty,
    strictEquals,
    abstractEquals,
} from "../../../src/engine/javascript/JSValue.ts";

// ============================================================================
// Creator Functions Tests
// ============================================================================

Deno.test({
    name: "JSValue - createUndefined creates undefined value",
    fn() {
        const value = createUndefined();
        assertEquals(value.type, JSValueType.UNDEFINED);
    },
});

Deno.test({
    name: "JSValue - createNull creates null value",
    fn() {
        const value = createNull();
        assertEquals(value.type, JSValueType.NULL);
    },
});

Deno.test({
    name: "JSValue - createBoolean creates boolean value with true",
    fn() {
        const value = createBoolean(true);
        assertEquals(value.type, JSValueType.BOOLEAN);
        if (value.type === JSValueType.BOOLEAN) {
            assertEquals(value.value, true);
        }
    },
});

Deno.test({
    name: "JSValue - createBoolean creates boolean value with false",
    fn() {
        const value = createBoolean(false);
        assertEquals(value.type, JSValueType.BOOLEAN);
        if (value.type === JSValueType.BOOLEAN) {
            assertEquals(value.value, false);
        }
    },
});

Deno.test({
    name: "JSValue - createNumber creates number value with positive number",
    fn() {
        const value = createNumber(42);
        assertEquals(value.type, JSValueType.NUMBER);
        if (value.type === JSValueType.NUMBER) {
            assertEquals(value.value, 42);
        }
    },
});

Deno.test({
    name: "JSValue - createNumber creates number value with negative number",
    fn() {
        const value = createNumber(-3.14);
        assertEquals(value.type, JSValueType.NUMBER);
        if (value.type === JSValueType.NUMBER) {
            assertEquals(value.value, -3.14);
        }
    },
});

Deno.test({
    name: "JSValue - createNumber creates number value with zero",
    fn() {
        const value = createNumber(0);
        assertEquals(value.type, JSValueType.NUMBER);
        if (value.type === JSValueType.NUMBER) {
            assertEquals(value.value, 0);
        }
    },
});

Deno.test({
    name: "JSValue - createNumber creates number value with NaN",
    fn() {
        const value = createNumber(NaN);
        assertEquals(value.type, JSValueType.NUMBER);
        if (value.type === JSValueType.NUMBER) {
            assertEquals(Number.isNaN(value.value), true);
        }
    },
});

Deno.test({
    name: "JSValue - createNumber creates number value with Infinity",
    fn() {
        const value = createNumber(Infinity);
        assertEquals(value.type, JSValueType.NUMBER);
        if (value.type === JSValueType.NUMBER) {
            assertEquals(value.value, Infinity);
        }
    },
});

Deno.test({
    name: "JSValue - createString creates string value with text",
    fn() {
        const value = createString("hello");
        assertEquals(value.type, JSValueType.STRING);
        if (value.type === JSValueType.STRING) {
            assertEquals(value.value, "hello");
        }
    },
});

Deno.test({
    name: "JSValue - createString creates string value with empty string",
    fn() {
        const value = createString("");
        assertEquals(value.type, JSValueType.STRING);
        if (value.type === JSValueType.STRING) {
            assertEquals(value.value, "");
        }
    },
});

Deno.test({
    name: "JSValue - createBigInt creates bigint value",
    fn() {
        const value = createBigInt(123456789n);
        assertEquals(value.type, JSValueType.BIGINT);
        if (value.type === JSValueType.BIGINT) {
            assertEquals(value.value, 123456789n);
        }
    },
});

Deno.test({
    name: "JSValue - createBigInt creates bigint value with zero",
    fn() {
        const value = createBigInt(0n);
        assertEquals(value.type, JSValueType.BIGINT);
        if (value.type === JSValueType.BIGINT) {
            assertEquals(value.value, 0n);
        }
    },
});

Deno.test({
    name: "JSValue - createSymbol creates symbol value with description",
    fn() {
        const value = createSymbol("test");
        assertEquals(value.type, JSValueType.SYMBOL);
        if (value.type === JSValueType.SYMBOL) {
            assertEquals(value.value.description, "test");
            assertEquals(typeof value.value.id, "number");
        }
    },
});

Deno.test({
    name: "JSValue - createSymbol creates symbol value without description",
    fn() {
        const value = createSymbol();
        assertEquals(value.type, JSValueType.SYMBOL);
        if (value.type === JSValueType.SYMBOL) {
            assertEquals(value.value.description, undefined);
            assertEquals(typeof value.value.id, "number");
        }
    },
});

Deno.test({
    name: "JSValue - createSymbol creates unique symbols",
    fn() {
        const sym1 = createSymbol("test");
        const sym2 = createSymbol("test");
        if (sym1.type === JSValueType.SYMBOL && sym2.type === JSValueType.SYMBOL) {
            assertEquals(sym1.value.id !== sym2.value.id, true);
        }
    },
});

Deno.test({
    name: "JSValue - createObject creates object with no prototype",
    fn() {
        const value = createObject();
        assertEquals(value.type, JSValueType.OBJECT);
        if (value.type === JSValueType.OBJECT) {
            assertEquals(value.value.properties.size, 0);
            assertEquals(value.value.prototype, null);
            assertEquals(value.value.extensible, true);
        }
    },
});

Deno.test({
    name: "JSValue - createObject creates object with prototype",
    fn() {
        const proto: JSObject = {
            properties: new Map(),
            prototype: null,
            extensible: true,
            constructor: undefined,
        };
        const value = createObject(proto);
        assertEquals(value.type, JSValueType.OBJECT);
        if (value.type === JSValueType.OBJECT) {
            assertStrictEquals(value.value.prototype, proto);
        }
    },
});

Deno.test({
    name: "JSValue - createFunction creates function with string code",
    fn() {
        const value = createFunction("testFunc", "return 42", 0);
        assertEquals(value.type, JSValueType.FUNCTION);
        if (value.type === JSValueType.FUNCTION) {
            assertEquals(value.value.name, "testFunc");
            assertEquals(value.value.code, "return 42");
            assertEquals(value.value.length, 0);
            assertEquals(value.value.isNative, false);
            assertEquals(value.value.scope, null);
        }
    },
});

Deno.test({
    name: "JSValue - createFunction creates function with bytecode",
    fn() {
        const bytecode = new Uint8Array([1, 2, 3]);
        const value = createFunction("testFunc", bytecode, 2);
        assertEquals(value.type, JSValueType.FUNCTION);
        if (value.type === JSValueType.FUNCTION) {
            assertEquals(value.value.name, "testFunc");
            assertEquals(value.value.code, bytecode);
            assertEquals(value.value.length, 2);
        }
    },
});

Deno.test({
    name: "JSValue - createFunction creates function with scope",
    fn() {
        const scope: Environment = {
            bindings: new Map(),
            outer: null,
        };
        const value = createFunction("testFunc", "code", 1, scope);
        assertEquals(value.type, JSValueType.FUNCTION);
        if (value.type === JSValueType.FUNCTION) {
            assertStrictEquals(value.value.scope, scope);
        }
    },
});

Deno.test({
    name: "JSValue - createNativeFunction creates native function",
    fn() {
        const impl = () => createNumber(42);
        const value = createNativeFunction("nativeFunc", impl, 1);
        assertEquals(value.type, JSValueType.FUNCTION);
        if (value.type === JSValueType.FUNCTION) {
            assertEquals(value.value.name, "nativeFunc");
            assertEquals(value.value.length, 1);
            assertEquals(value.value.isNative, true);
            assertEquals(value.value.nativeImpl !== undefined, true);
        }
    },
});

Deno.test({
    name: "JSValue - createNativeFunction native implementation is callable",
    fn() {
        const impl = () => createNumber(42);
        const value = createNativeFunction("nativeFunc", impl);
        if (value.type === JSValueType.FUNCTION && value.value.nativeImpl) {
            const result = value.value.nativeImpl();
            assertEquals(result.type, JSValueType.NUMBER);
            if (result.type === JSValueType.NUMBER) {
                assertEquals(result.value, 42);
            }
        }
    },
});

// ============================================================================
// Type Guard Tests
// ============================================================================

Deno.test({
    name: "JSValue - isUndefined returns true for undefined",
    fn() {
        const value = createUndefined();
        assertEquals(isUndefined(value), true);
    },
});

Deno.test({
    name: "JSValue - isUndefined returns false for other types",
    fn() {
        assertEquals(isUndefined(createNull()), false);
        assertEquals(isUndefined(createBoolean(true)), false);
        assertEquals(isUndefined(createNumber(0)), false);
    },
});

Deno.test({
    name: "JSValue - isNull returns true for null",
    fn() {
        const value = createNull();
        assertEquals(isNull(value), true);
    },
});

Deno.test({
    name: "JSValue - isNull returns false for other types",
    fn() {
        assertEquals(isNull(createUndefined()), false);
        assertEquals(isNull(createBoolean(false)), false);
        assertEquals(isNull(createNumber(0)), false);
    },
});

Deno.test({
    name: "JSValue - isBoolean returns true for boolean",
    fn() {
        assertEquals(isBoolean(createBoolean(true)), true);
        assertEquals(isBoolean(createBoolean(false)), true);
    },
});

Deno.test({
    name: "JSValue - isBoolean returns false for other types",
    fn() {
        assertEquals(isBoolean(createUndefined()), false);
        assertEquals(isBoolean(createNumber(1)), false);
        assertEquals(isBoolean(createString("true")), false);
    },
});

Deno.test({
    name: "JSValue - isNumber returns true for number",
    fn() {
        assertEquals(isNumber(createNumber(42)), true);
        assertEquals(isNumber(createNumber(0)), true);
        assertEquals(isNumber(createNumber(NaN)), true);
    },
});

Deno.test({
    name: "JSValue - isNumber returns false for other types",
    fn() {
        assertEquals(isNumber(createString("42")), false);
        assertEquals(isNumber(createBoolean(true)), false);
    },
});

Deno.test({
    name: "JSValue - isString returns true for string",
    fn() {
        assertEquals(isString(createString("hello")), true);
        assertEquals(isString(createString("")), true);
    },
});

Deno.test({
    name: "JSValue - isString returns false for other types",
    fn() {
        assertEquals(isString(createNumber(42)), false);
        assertEquals(isString(createBoolean(false)), false);
    },
});

Deno.test({
    name: "JSValue - isBigInt returns true for bigint",
    fn() {
        assertEquals(isBigInt(createBigInt(123n)), true);
        assertEquals(isBigInt(createBigInt(0n)), true);
    },
});

Deno.test({
    name: "JSValue - isBigInt returns false for other types",
    fn() {
        assertEquals(isBigInt(createNumber(123)), false);
        assertEquals(isBigInt(createString("123")), false);
    },
});

Deno.test({
    name: "JSValue - isSymbol returns true for symbol",
    fn() {
        assertEquals(isSymbol(createSymbol()), true);
        assertEquals(isSymbol(createSymbol("test")), true);
    },
});

Deno.test({
    name: "JSValue - isSymbol returns false for other types",
    fn() {
        assertEquals(isSymbol(createString("symbol")), false);
        assertEquals(isSymbol(createObject()), false);
    },
});

Deno.test({
    name: "JSValue - isObject returns true for object",
    fn() {
        assertEquals(isObject(createObject()), true);
    },
});

Deno.test({
    name: "JSValue - isObject returns false for other types",
    fn() {
        assertEquals(isObject(createUndefined()), false);
        assertEquals(isObject(createFunction("f", "code")), false);
        assertEquals(isObject(createString("")), false);
    },
});

Deno.test({
    name: "JSValue - isFunction returns true for function",
    fn() {
        assertEquals(isFunction(createFunction("f", "code")), true);
        assertEquals(isFunction(createNativeFunction("f", () => createNull())), true);
    },
});

Deno.test({
    name: "JSValue - isFunction returns false for other types",
    fn() {
        assertEquals(isFunction(createObject()), false);
        assertEquals(isFunction(createString("function")), false);
    },
});

// ============================================================================
// Type Conversion Tests
// ============================================================================

Deno.test({
    name: "JSValue - toBoolean converts undefined to false",
    fn() {
        assertEquals(toBoolean(createUndefined()), false);
    },
});

Deno.test({
    name: "JSValue - toBoolean converts null to false",
    fn() {
        assertEquals(toBoolean(createNull()), false);
    },
});

Deno.test({
    name: "JSValue - toBoolean converts boolean to itself",
    fn() {
        assertEquals(toBoolean(createBoolean(true)), true);
        assertEquals(toBoolean(createBoolean(false)), false);
    },
});

Deno.test({
    name: "JSValue - toBoolean converts number 0 to false",
    fn() {
        assertEquals(toBoolean(createNumber(0)), false);
    },
});

Deno.test({
    name: "JSValue - toBoolean converts NaN to false",
    fn() {
        assertEquals(toBoolean(createNumber(NaN)), false);
    },
});

Deno.test({
    name: "JSValue - toBoolean converts non-zero number to true",
    fn() {
        assertEquals(toBoolean(createNumber(42)), true);
        assertEquals(toBoolean(createNumber(-1)), true);
        assertEquals(toBoolean(createNumber(0.001)), true);
    },
});

Deno.test({
    name: "JSValue - toBoolean converts empty string to false",
    fn() {
        assertEquals(toBoolean(createString("")), false);
    },
});

Deno.test({
    name: "JSValue - toBoolean converts non-empty string to true",
    fn() {
        assertEquals(toBoolean(createString("hello")), true);
        assertEquals(toBoolean(createString(" ")), true);
    },
});

Deno.test({
    name: "JSValue - toBoolean converts bigint 0n to false",
    fn() {
        assertEquals(toBoolean(createBigInt(0n)), false);
    },
});

Deno.test({
    name: "JSValue - toBoolean converts non-zero bigint to true",
    fn() {
        assertEquals(toBoolean(createBigInt(1n)), true);
        assertEquals(toBoolean(createBigInt(-1n)), true);
    },
});

Deno.test({
    name: "JSValue - toBoolean converts symbol to true",
    fn() {
        assertEquals(toBoolean(createSymbol()), true);
    },
});

Deno.test({
    name: "JSValue - toBoolean converts object to true",
    fn() {
        assertEquals(toBoolean(createObject()), true);
    },
});

Deno.test({
    name: "JSValue - toBoolean converts function to true",
    fn() {
        assertEquals(toBoolean(createFunction("f", "code")), true);
    },
});

Deno.test({
    name: "JSValue - toNumber converts undefined to NaN",
    fn() {
        assertEquals(Number.isNaN(toNumber(createUndefined())), true);
    },
});

Deno.test({
    name: "JSValue - toNumber converts null to 0",
    fn() {
        assertEquals(toNumber(createNull()), 0);
    },
});

Deno.test({
    name: "JSValue - toNumber converts boolean to 0 or 1",
    fn() {
        assertEquals(toNumber(createBoolean(false)), 0);
        assertEquals(toNumber(createBoolean(true)), 1);
    },
});

Deno.test({
    name: "JSValue - toNumber converts number to itself",
    fn() {
        assertEquals(toNumber(createNumber(42)), 42);
        assertEquals(toNumber(createNumber(-3.14)), -3.14);
    },
});

Deno.test({
    name: "JSValue - toNumber converts string with number to number",
    fn() {
        assertEquals(toNumber(createString("42")), 42);
        assertEquals(toNumber(createString("-3.14")), -3.14);
    },
});

Deno.test({
    name: "JSValue - toNumber converts non-numeric string to NaN",
    fn() {
        assertEquals(Number.isNaN(toNumber(createString("hello"))), true);
    },
});

Deno.test({
    name: "JSValue - toNumber converts bigint to number",
    fn() {
        assertEquals(toNumber(createBigInt(42n)), 42);
    },
});

Deno.test({
    name: "JSValue - toNumber converts symbol to NaN",
    fn() {
        assertEquals(Number.isNaN(toNumber(createSymbol())), true);
    },
});

Deno.test({
    name: "JSValue - toNumber converts object to NaN",
    fn() {
        assertEquals(Number.isNaN(toNumber(createObject())), true);
    },
});

Deno.test({
    name: "JSValue - toString converts undefined to 'undefined'",
    fn() {
        assertEquals(toString(createUndefined()), "undefined");
    },
});

Deno.test({
    name: "JSValue - toString converts null to 'null'",
    fn() {
        assertEquals(toString(createNull()), "null");
    },
});

Deno.test({
    name: "JSValue - toString converts boolean to 'true' or 'false'",
    fn() {
        assertEquals(toString(createBoolean(true)), "true");
        assertEquals(toString(createBoolean(false)), "false");
    },
});

Deno.test({
    name: "JSValue - toString converts number to string",
    fn() {
        assertEquals(toString(createNumber(42)), "42");
        assertEquals(toString(createNumber(-3.14)), "-3.14");
    },
});

Deno.test({
    name: "JSValue - toString converts string to itself",
    fn() {
        assertEquals(toString(createString("hello")), "hello");
    },
});

Deno.test({
    name: "JSValue - toString converts bigint to string",
    fn() {
        assertEquals(toString(createBigInt(123n)), "123");
    },
});

Deno.test({
    name: "JSValue - toString converts symbol with description",
    fn() {
        const result = toString(createSymbol("test"));
        assertEquals(result, "Symbol(test)");
    },
});

Deno.test({
    name: "JSValue - toString converts symbol without description",
    fn() {
        const result = toString(createSymbol());
        assertEquals(result, "Symbol()");
    },
});

Deno.test({
    name: "JSValue - toString converts object to '[object Object]'",
    fn() {
        assertEquals(toString(createObject()), "[object Object]");
    },
});

Deno.test({
    name: "JSValue - toString converts function to string representation",
    fn() {
        const result = toString(createFunction("myFunc", "code"));
        assertEquals(result.includes("function"), true);
        assertEquals(result.includes("myFunc"), true);
    },
});

Deno.test({
    name: "JSValue - toPrimitive returns primitives as-is",
    fn() {
        const num = createNumber(42);
        assertEquals(toPrimitive(num), num);
        const str = createString("hello");
        assertEquals(toPrimitive(str), str);
    },
});

Deno.test({
    name: "JSValue - toPrimitive converts object with number hint",
    fn() {
        const obj = createObject();
        const result = toPrimitive(obj, "number");
        assertEquals(result.type, JSValueType.NUMBER);
        if (result.type === JSValueType.NUMBER) {
            assertEquals(Number.isNaN(result.value), true);
        }
    },
});

Deno.test({
    name: "JSValue - toPrimitive converts object with string hint",
    fn() {
        const obj = createObject();
        const result = toPrimitive(obj, "string");
        assertEquals(result.type, JSValueType.STRING);
        if (result.type === JSValueType.STRING) {
            assertEquals(result.value, "[object Object]");
        }
    },
});

// ============================================================================
// Property Operations Tests
// ============================================================================

Deno.test({
    name: "JSValue - getProperty returns undefined for non-object",
    fn() {
        const value = createNumber(42);
        const result = getProperty(value, "prop");
        assertEquals(result.type, JSValueType.UNDEFINED);
    },
});

Deno.test({
    name: "JSValue - getProperty returns own property",
    fn() {
        const obj = createObject();
        const propValue = createString("value");
        setProperty(obj, "prop", propValue);
        const result = getProperty(obj, "prop");
        assertEquals(result.type, JSValueType.STRING);
        if (result.type === JSValueType.STRING) {
            assertEquals(result.value, "value");
        }
    },
});

Deno.test({
    name: "JSValue - getProperty returns undefined for missing property",
    fn() {
        const obj = createObject();
        const result = getProperty(obj, "missing");
        assertEquals(result.type, JSValueType.UNDEFINED);
    },
});

Deno.test({
    name: "JSValue - getProperty looks up prototype chain",
    fn() {
        const proto = createObject();
        const propValue = createString("inherited");
        setProperty(proto, "prop", propValue);

        const obj = createObject(
            proto.type === JSValueType.OBJECT ? proto.value : null
        );
        const result = getProperty(obj, "prop");
        assertEquals(result.type, JSValueType.STRING);
        if (result.type === JSValueType.STRING) {
            assertEquals(result.value, "inherited");
        }
    },
});

Deno.test({
    name: "JSValue - getProperty works with symbol keys",
    fn() {
        const obj = createObject();
        const sym = Symbol("test");
        const propValue = createNumber(42);
        setProperty(obj, sym, propValue);
        const result = getProperty(obj, sym);
        assertEquals(result.type, JSValueType.NUMBER);
        if (result.type === JSValueType.NUMBER) {
            assertEquals(result.value, 42);
        }
    },
});

Deno.test({
    name: "JSValue - getProperty works on function objects",
    fn() {
        const func = createFunction("test", "code");
        const propValue = createString("value");
        setProperty(func, "prop", propValue);
        const result = getProperty(func, "prop");
        assertEquals(result.type, JSValueType.STRING);
        if (result.type === JSValueType.STRING) {
            assertEquals(result.value, "value");
        }
    },
});

Deno.test({
    name: "JSValue - setProperty returns false for non-object",
    fn() {
        const value = createNumber(42);
        const result = setProperty(value, "prop", createString("val"));
        assertEquals(result, false);
    },
});

Deno.test({
    name: "JSValue - setProperty sets property on object",
    fn() {
        const obj = createObject();
        const success = setProperty(obj, "prop", createNumber(42));
        assertEquals(success, true);
        const value = getProperty(obj, "prop");
        assertEquals(value.type, JSValueType.NUMBER);
    },
});

Deno.test({
    name: "JSValue - setProperty updates existing property",
    fn() {
        const obj = createObject();
        setProperty(obj, "prop", createString("old"));
        setProperty(obj, "prop", createString("new"));
        const value = getProperty(obj, "prop");
        if (value.type === JSValueType.STRING) {
            assertEquals(value.value, "new");
        }
    },
});

Deno.test({
    name: "JSValue - setProperty respects extensible flag",
    fn() {
        const obj = createObject();
        if (obj.type === JSValueType.OBJECT) {
            obj.value.extensible = false;
        }
        const success = setProperty(obj, "prop", createNumber(42));
        assertEquals(success, false);
    },
});

Deno.test({
    name: "JSValue - setProperty can update existing property on non-extensible object",
    fn() {
        const obj = createObject();
        setProperty(obj, "prop", createNumber(1));
        if (obj.type === JSValueType.OBJECT) {
            obj.value.extensible = false;
        }
        const success = setProperty(obj, "prop", createNumber(2));
        assertEquals(success, true);
    },
});

Deno.test({
    name: "JSValue - setProperty works with symbol keys",
    fn() {
        const obj = createObject();
        const sym = Symbol("test");
        const success = setProperty(obj, sym, createNumber(42));
        assertEquals(success, true);
    },
});

Deno.test({
    name: "JSValue - deleteProperty returns false for non-object",
    fn() {
        const value = createNumber(42);
        const result = deleteProperty(value, "prop");
        assertEquals(result, false);
    },
});

Deno.test({
    name: "JSValue - deleteProperty removes property from object",
    fn() {
        const obj = createObject();
        setProperty(obj, "prop", createNumber(42));
        const deleted = deleteProperty(obj, "prop");
        assertEquals(deleted, true);
        const value = getProperty(obj, "prop");
        assertEquals(value.type, JSValueType.UNDEFINED);
    },
});

Deno.test({
    name: "JSValue - deleteProperty returns false for non-existent property",
    fn() {
        const obj = createObject();
        const deleted = deleteProperty(obj, "missing");
        assertEquals(deleted, false);
    },
});

Deno.test({
    name: "JSValue - hasProperty returns false for non-object",
    fn() {
        const value = createNumber(42);
        assertEquals(hasProperty(value, "prop"), false);
    },
});

Deno.test({
    name: "JSValue - hasProperty returns true for own property",
    fn() {
        const obj = createObject();
        setProperty(obj, "prop", createNumber(42));
        assertEquals(hasProperty(obj, "prop"), true);
    },
});

Deno.test({
    name: "JSValue - hasProperty returns false for missing property",
    fn() {
        const obj = createObject();
        assertEquals(hasProperty(obj, "missing"), false);
    },
});

Deno.test({
    name: "JSValue - hasProperty checks prototype chain",
    fn() {
        const proto = createObject();
        setProperty(proto, "inherited", createString("value"));

        const obj = createObject(
            proto.type === JSValueType.OBJECT ? proto.value : null
        );
        assertEquals(hasProperty(obj, "inherited"), true);
    },
});

// ============================================================================
// Comparison Operations Tests
// ============================================================================

Deno.test({
    name: "JSValue - strictEquals returns true for same undefined values",
    fn() {
        assertEquals(strictEquals(createUndefined(), createUndefined()), true);
    },
});

Deno.test({
    name: "JSValue - strictEquals returns true for same null values",
    fn() {
        assertEquals(strictEquals(createNull(), createNull()), true);
    },
});

Deno.test({
    name: "JSValue - strictEquals returns false for different types",
    fn() {
        assertEquals(strictEquals(createNull(), createUndefined()), false);
        assertEquals(strictEquals(createNumber(0), createBoolean(false)), false);
        assertEquals(strictEquals(createString("5"), createNumber(5)), false);
    },
});

Deno.test({
    name: "JSValue - strictEquals compares boolean values",
    fn() {
        assertEquals(strictEquals(createBoolean(true), createBoolean(true)), true);
        assertEquals(strictEquals(createBoolean(false), createBoolean(false)), true);
        assertEquals(strictEquals(createBoolean(true), createBoolean(false)), false);
    },
});

Deno.test({
    name: "JSValue - strictEquals compares number values",
    fn() {
        assertEquals(strictEquals(createNumber(42), createNumber(42)), true);
        assertEquals(strictEquals(createNumber(42), createNumber(43)), false);
    },
});

Deno.test({
    name: "JSValue - strictEquals compares string values",
    fn() {
        assertEquals(strictEquals(createString("hello"), createString("hello")), true);
        assertEquals(strictEquals(createString("hello"), createString("world")), false);
    },
});

Deno.test({
    name: "JSValue - strictEquals compares bigint values",
    fn() {
        assertEquals(strictEquals(createBigInt(42n), createBigInt(42n)), true);
        assertEquals(strictEquals(createBigInt(42n), createBigInt(43n)), false);
    },
});

Deno.test({
    name: "JSValue - strictEquals compares symbols by identity",
    fn() {
        const sym1 = createSymbol("test");
        const sym2 = createSymbol("test");
        assertEquals(strictEquals(sym1, sym1), true);
        assertEquals(strictEquals(sym1, sym2), false);
    },
});

Deno.test({
    name: "JSValue - strictEquals compares objects by reference",
    fn() {
        const obj1 = createObject();
        const obj2 = createObject();
        assertEquals(strictEquals(obj1, obj1), true);
        assertEquals(strictEquals(obj1, obj2), false);
    },
});

Deno.test({
    name: "JSValue - abstractEquals uses strict equality for same types",
    fn() {
        assertEquals(abstractEquals(createNumber(42), createNumber(42)), true);
        assertEquals(abstractEquals(createString("hi"), createString("hi")), true);
    },
});

Deno.test({
    name: "JSValue - abstractEquals treats null and undefined as equal",
    fn() {
        assertEquals(abstractEquals(createNull(), createUndefined()), true);
        assertEquals(abstractEquals(createUndefined(), createNull()), true);
    },
});

Deno.test({
    name: "JSValue - abstractEquals converts string to number for comparison",
    fn() {
        assertEquals(abstractEquals(createNumber(42), createString("42")), true);
        assertEquals(abstractEquals(createString("42"), createNumber(42)), true);
    },
});

Deno.test({
    name: "JSValue - abstractEquals converts boolean to number",
    fn() {
        assertEquals(abstractEquals(createBoolean(true), createNumber(1)), true);
        assertEquals(abstractEquals(createNumber(0), createBoolean(false)), true);
    },
});

Deno.test({
    name: "JSValue - abstractEquals returns false for incompatible types",
    fn() {
        assertEquals(abstractEquals(createObject(), createNumber(0)), false);
        assertEquals(abstractEquals(createSymbol(), createString("Symbol")), false);
    },
});
