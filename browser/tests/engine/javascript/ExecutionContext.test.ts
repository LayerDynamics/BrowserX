/**
 * ExecutionContext Tests
 *
 * Comprehensive tests for JavaScript execution contexts and environment records.
 */

import { assertEquals, assertThrows } from "@std/assert";
import {
    EnvironmentRecordType,
    type EnvironmentRecord,
    type DeclarativeEnvironmentRecord,
    type FunctionEnvironmentRecord,
    type GlobalEnvironmentRecord,
    type ExecutionContext,
    type Realm,
    CallStack,
    createDeclarativeEnvironmentRecord,
    createFunctionEnvironmentRecord,
    createGlobalEnvironmentRecord,
    createRealm,
    createExecutionContext,
    createGlobalExecutionContext,
    createFunctionExecutionContext,
    getIdentifierReference,
    setIdentifierReference,
    createMutableBinding,
    createImmutableBinding,
    initializeBinding,
    setMutableBinding,
    getBindingValue,
    hasBinding,
    deleteBinding,
} from "../../../src/engine/javascript/ExecutionContext.ts";
import {
    createUndefined,
    createNumber,
    createString,
    createObject,
    createFunction,
} from "../../../src/engine/javascript/JSValue.ts";

// ============================================================================
// CallStack Tests
// ============================================================================

Deno.test({
    name: "CallStack - push adds context to stack",
    fn() {
        const stack = new CallStack();
        const env = createDeclarativeEnvironmentRecord();
        const context = createExecutionContext(env);

        stack.push(context);
        assertEquals(stack.depth(), 1);
    },
});

Deno.test({
    name: "CallStack - pop removes and returns context from stack",
    fn() {
        const stack = new CallStack();
        const env = createDeclarativeEnvironmentRecord();
        const context = createExecutionContext(env);

        stack.push(context);
        const popped = stack.pop();

        assertEquals(popped, context);
        assertEquals(stack.depth(), 0);
    },
});

Deno.test({
    name: "CallStack - pop returns undefined when stack is empty",
    fn() {
        const stack = new CallStack();
        const popped = stack.pop();
        assertEquals(popped, undefined);
    },
});

Deno.test({
    name: "CallStack - current returns top context without removing it",
    fn() {
        const stack = new CallStack();
        const env = createDeclarativeEnvironmentRecord();
        const context = createExecutionContext(env);

        stack.push(context);
        const current = stack.current();

        assertEquals(current, context);
        assertEquals(stack.depth(), 1);
    },
});

Deno.test({
    name: "CallStack - current returns null when stack is empty",
    fn() {
        const stack = new CallStack();
        const current = stack.current();
        assertEquals(current, null);
    },
});

Deno.test({
    name: "CallStack - depth returns number of contexts",
    fn() {
        const stack = new CallStack();
        assertEquals(stack.depth(), 0);

        const env1 = createDeclarativeEnvironmentRecord();
        stack.push(createExecutionContext(env1));
        assertEquals(stack.depth(), 1);

        const env2 = createDeclarativeEnvironmentRecord();
        stack.push(createExecutionContext(env2));
        assertEquals(stack.depth(), 2);
    },
});

Deno.test({
    name: "CallStack - clear removes all contexts",
    fn() {
        const stack = new CallStack();

        for (let i = 0; i < 5; i++) {
            const env = createDeclarativeEnvironmentRecord();
            stack.push(createExecutionContext(env));
        }

        assertEquals(stack.depth(), 5);
        stack.clear();
        assertEquals(stack.depth(), 0);
    },
});

Deno.test({
    name: "CallStack - push throws error when max stack size exceeded",
    fn() {
        const stack = new CallStack();
        const env = createDeclarativeEnvironmentRecord();

        assertThrows(
            () => {
                // Push more than max (10000)
                for (let i = 0; i <= 10000; i++) {
                    stack.push(createExecutionContext(env));
                }
            },
            Error,
            "Maximum call stack size exceeded"
        );
    },
});

Deno.test({
    name: "CallStack - getStackTrace returns trace of all contexts",
    fn() {
        const stack = new CallStack();

        // Push global context
        const globalEnv = createDeclarativeEnvironmentRecord();
        stack.push(createExecutionContext(globalEnv));

        // Push function context
        const funcEnv = createDeclarativeEnvironmentRecord();
        const funcContext = createExecutionContext(funcEnv);
        funcContext.function = createFunction("testFunc", "code");
        stack.push(funcContext);

        const trace = stack.getStackTrace();
        assertEquals(trace.length, 2);
        assertEquals(trace[0].includes("function"), true);
        assertEquals(trace[1].includes("global"), true);
    },
});

// ============================================================================
// Environment Record Creation Tests
// ============================================================================

Deno.test({
    name: "ExecutionContext - createDeclarativeEnvironmentRecord creates record without outer",
    fn() {
        const env = createDeclarativeEnvironmentRecord();

        assertEquals(env.type, EnvironmentRecordType.DECLARATIVE);
        assertEquals(env.bindings.size, 0);
        assertEquals(env.outer, null);
        assertEquals(env.mutableBindings.size, 0);
        assertEquals(env.initializedBindings.size, 0);
    },
});

Deno.test({
    name: "ExecutionContext - createDeclarativeEnvironmentRecord creates record with outer",
    fn() {
        const outer = createDeclarativeEnvironmentRecord();
        const inner = createDeclarativeEnvironmentRecord(outer);

        assertEquals(inner.outer, outer);
    },
});

Deno.test({
    name: "ExecutionContext - createFunctionEnvironmentRecord creates function record",
    fn() {
        const funcObj = createFunction("test", "code");
        const newTarget = createUndefined();
        const env = createFunctionEnvironmentRecord(funcObj, newTarget);

        assertEquals(env.type, EnvironmentRecordType.FUNCTION);
        assertEquals(env.bindings.size, 0);
        assertEquals(env.outer, null);
        assertEquals(env.thisBindingStatus, "uninitialized");
        assertEquals(env.functionObject, funcObj);
        assertEquals(env.newTarget, newTarget);
    },
});

Deno.test({
    name: "ExecutionContext - createFunctionEnvironmentRecord creates record with outer",
    fn() {
        const outer = createDeclarativeEnvironmentRecord();
        const funcObj = createFunction("test", "code");
        const env = createFunctionEnvironmentRecord(funcObj, undefined, outer);

        assertEquals(env.outer, outer);
    },
});

Deno.test({
    name: "ExecutionContext - createGlobalEnvironmentRecord creates global record",
    fn() {
        const globalObj = createObject();
        const env = createGlobalEnvironmentRecord(globalObj);

        assertEquals(env.type, EnvironmentRecordType.GLOBAL);
        assertEquals(env.globalThisValue, globalObj);
        assertEquals(env.objectRecord.type, EnvironmentRecordType.OBJECT);
        assertEquals(env.objectRecord.bindingObject, globalObj);
        assertEquals(env.declarativeRecord.type, EnvironmentRecordType.DECLARATIVE);
    },
});

Deno.test({
    name: "ExecutionContext - createRealm creates realm with global object",
    fn() {
        const realm = createRealm();

        assertEquals(realm.globalObject.type, "object");
        assertEquals(realm.globalEnvironment.type, EnvironmentRecordType.GLOBAL);
        assertEquals(realm.intrinsics.size, 0);
    },
});

// ============================================================================
// Execution Context Creation Tests
// ============================================================================

Deno.test({
    name: "ExecutionContext - createExecutionContext creates context",
    fn() {
        const env = createDeclarativeEnvironmentRecord();
        const thisBinding = createObject();
        const realm = createRealm();
        const context = createExecutionContext(env, thisBinding, realm);

        assertEquals(context.variableEnvironment, env);
        assertEquals(context.lexicalEnvironment, env);
        assertEquals(context.thisBinding, thisBinding);
        assertEquals(context.realm, realm);
        assertEquals(context.function, null);
        assertEquals(context.scriptOrModule, null);
    },
});

Deno.test({
    name: "ExecutionContext - createExecutionContext uses default thisBinding",
    fn() {
        const env = createDeclarativeEnvironmentRecord();
        const context = createExecutionContext(env);

        assertEquals(context.thisBinding.type, "undefined");
    },
});

Deno.test({
    name: "ExecutionContext - createGlobalExecutionContext creates global context",
    fn() {
        const realm = createRealm();
        const context = createGlobalExecutionContext(realm);

        assertEquals(context.variableEnvironment, realm.globalEnvironment);
        assertEquals(context.lexicalEnvironment, realm.globalEnvironment);
        assertEquals(context.thisBinding, realm.globalObject);
        assertEquals(context.realm, realm);
        assertEquals(context.function, null);
    },
});

Deno.test({
    name: "ExecutionContext - createFunctionExecutionContext creates function context",
    fn() {
        const realm = createRealm();
        const funcObj = createFunction("test", "code");
        const thisValue = createObject();
        const newTarget = createUndefined();
        const outer = createDeclarativeEnvironmentRecord();

        const context = createFunctionExecutionContext(funcObj, thisValue, newTarget, outer, realm);

        assertEquals(context.function, funcObj);
        assertEquals(context.thisBinding, thisValue);
        assertEquals(context.realm, realm);
        assertEquals(context.variableEnvironment.type, EnvironmentRecordType.FUNCTION);

        const funcEnv = context.variableEnvironment as FunctionEnvironmentRecord;
        assertEquals(funcEnv.thisValue, thisValue);
        assertEquals(funcEnv.thisBindingStatus, "initialized");
        assertEquals(funcEnv.functionObject, funcObj);
        assertEquals(funcEnv.newTarget, newTarget);
    },
});

// ============================================================================
// Identifier Reference Tests
// ============================================================================

Deno.test({
    name: "ExecutionContext - getIdentifierReference finds binding in current env",
    fn() {
        const env = createDeclarativeEnvironmentRecord();
        const value = createNumber(42);
        env.bindings.set("x", value);

        const result = getIdentifierReference(env, "x");
        assertEquals(result, value);
    },
});

Deno.test({
    name: "ExecutionContext - getIdentifierReference finds binding in outer env",
    fn() {
        const outer = createDeclarativeEnvironmentRecord();
        const value = createNumber(42);
        outer.bindings.set("x", value);

        const inner = createDeclarativeEnvironmentRecord(outer);
        const result = getIdentifierReference(inner, "x");
        assertEquals(result, value);
    },
});

Deno.test({
    name: "ExecutionContext - getIdentifierReference returns null for missing binding",
    fn() {
        const env = createDeclarativeEnvironmentRecord();
        const result = getIdentifierReference(env, "missing");
        assertEquals(result, null);
    },
});

Deno.test({
    name: "ExecutionContext - getIdentifierReference returns null for null env",
    fn() {
        const result = getIdentifierReference(null, "x");
        assertEquals(result, null);
    },
});

Deno.test({
    name: "ExecutionContext - setIdentifierReference sets binding in current env",
    fn() {
        const env = createDeclarativeEnvironmentRecord();
        env.bindings.set("x", createNumber(1));

        const newValue = createNumber(42);
        const success = setIdentifierReference(env, "x", newValue);

        assertEquals(success, true);
        assertEquals(env.bindings.get("x"), newValue);
    },
});

Deno.test({
    name: "ExecutionContext - setIdentifierReference sets binding in outer env",
    fn() {
        const outer = createDeclarativeEnvironmentRecord();
        outer.bindings.set("x", createNumber(1));

        const inner = createDeclarativeEnvironmentRecord(outer);
        const newValue = createNumber(42);
        const success = setIdentifierReference(inner, "x", newValue);

        assertEquals(success, true);
        assertEquals(outer.bindings.get("x"), newValue);
    },
});

Deno.test({
    name: "ExecutionContext - setIdentifierReference returns false for missing binding",
    fn() {
        const env = createDeclarativeEnvironmentRecord();
        const success = setIdentifierReference(env, "missing", createNumber(1));
        assertEquals(success, false);
    },
});

Deno.test({
    name: "ExecutionContext - setIdentifierReference returns false for null env",
    fn() {
        const success = setIdentifierReference(null, "x", createNumber(1));
        assertEquals(success, false);
    },
});

// ============================================================================
// Binding Operations Tests
// ============================================================================

Deno.test({
    name: "ExecutionContext - createMutableBinding creates mutable binding",
    fn() {
        const env = createDeclarativeEnvironmentRecord();
        createMutableBinding(env, "x");

        assertEquals(env.bindings.has("x"), true);
        assertEquals(env.mutableBindings.has("x"), true);
        assertEquals(env.bindings.get("x")?.type, "undefined");
    },
});

Deno.test({
    name: "ExecutionContext - createMutableBinding works with function env",
    fn() {
        const funcObj = createFunction("test", "code");
        const env = createFunctionEnvironmentRecord(funcObj, undefined);
        createMutableBinding(env, "x");

        assertEquals(env.bindings.has("x"), true);
        assertEquals(env.mutableBindings.has("x"), true);
    },
});

Deno.test({
    name: "ExecutionContext - createImmutableBinding creates immutable binding",
    fn() {
        const env = createDeclarativeEnvironmentRecord();
        createImmutableBinding(env, "x");

        assertEquals(env.bindings.has("x"), true);
        assertEquals(env.mutableBindings.has("x"), false);
    },
});

Deno.test({
    name: "ExecutionContext - initializeBinding initializes binding with value",
    fn() {
        const env = createDeclarativeEnvironmentRecord();
        createMutableBinding(env, "x");

        const value = createNumber(42);
        initializeBinding(env, "x", value);

        assertEquals(env.bindings.get("x"), value);
        assertEquals(env.initializedBindings.has("x"), true);
    },
});

Deno.test({
    name: "ExecutionContext - setMutableBinding sets value of mutable binding",
    fn() {
        const env = createDeclarativeEnvironmentRecord();
        createMutableBinding(env, "x");
        initializeBinding(env, "x", createNumber(1));

        const newValue = createNumber(42);
        setMutableBinding(env, "x", newValue);

        assertEquals(env.bindings.get("x"), newValue);
    },
});

Deno.test({
    name: "ExecutionContext - setMutableBinding throws for immutable binding in strict mode",
    fn() {
        const env = createDeclarativeEnvironmentRecord();
        createImmutableBinding(env, "x");
        initializeBinding(env, "x", createNumber(1));

        assertThrows(
            () => {
                setMutableBinding(env, "x", createNumber(42), true);
            },
            Error,
            "Cannot assign to const variable"
        );
    },
});

Deno.test({
    name: "ExecutionContext - setMutableBinding throws for uninitialized binding",
    fn() {
        const env = createDeclarativeEnvironmentRecord();
        createMutableBinding(env, "x");

        assertThrows(
            () => {
                setMutableBinding(env, "x", createNumber(42));
            },
            Error,
            "Cannot access 'x' before initialization"
        );
    },
});

Deno.test({
    name: "ExecutionContext - setMutableBinding silently fails for immutable binding in non-strict mode",
    fn() {
        const env = createDeclarativeEnvironmentRecord();
        createImmutableBinding(env, "x");
        initializeBinding(env, "x", createNumber(1));

        // Should not throw
        setMutableBinding(env, "x", createNumber(42), false);

        // Value should not change
        const value = env.bindings.get("x");
        if (value?.type === "number") {
            assertEquals(value.value, 1);
        }
    },
});

Deno.test({
    name: "ExecutionContext - getBindingValue returns binding value",
    fn() {
        const env = createDeclarativeEnvironmentRecord();
        createMutableBinding(env, "x");
        const value = createNumber(42);
        initializeBinding(env, "x", value);

        const result = getBindingValue(env, "x");
        assertEquals(result, value);
    },
});

Deno.test({
    name: "ExecutionContext - getBindingValue throws for undefined binding",
    fn() {
        const env = createDeclarativeEnvironmentRecord();

        assertThrows(
            () => {
                getBindingValue(env, "missing");
            },
            Error,
            "missing is not defined"
        );
    },
});

Deno.test({
    name: "ExecutionContext - getBindingValue throws for uninitialized binding",
    fn() {
        const env = createDeclarativeEnvironmentRecord();
        createMutableBinding(env, "x");

        assertThrows(
            () => {
                getBindingValue(env, "x");
            },
            Error,
            "Cannot access 'x' before initialization"
        );
    },
});

Deno.test({
    name: "ExecutionContext - hasBinding returns true for existing binding",
    fn() {
        const env = createDeclarativeEnvironmentRecord();
        createMutableBinding(env, "x");

        assertEquals(hasBinding(env, "x"), true);
    },
});

Deno.test({
    name: "ExecutionContext - hasBinding returns false for missing binding",
    fn() {
        const env = createDeclarativeEnvironmentRecord();
        assertEquals(hasBinding(env, "missing"), false);
    },
});

Deno.test({
    name: "ExecutionContext - deleteBinding returns true for non-existent binding",
    fn() {
        const env = createDeclarativeEnvironmentRecord();
        const result = deleteBinding(env, "missing");
        assertEquals(result, true);
    },
});

Deno.test({
    name: "ExecutionContext - deleteBinding returns false for declarative binding",
    fn() {
        const env = createDeclarativeEnvironmentRecord();
        createMutableBinding(env, "x");

        const result = deleteBinding(env, "x");
        assertEquals(result, false);
    },
});

Deno.test({
    name: "ExecutionContext - deleteBinding works with object environment",
    fn() {
        const globalObj = createObject();
        const env = createGlobalEnvironmentRecord(globalObj);
        env.objectRecord.bindings.set("x", createNumber(42));

        const result = deleteBinding(env.objectRecord, "x");
        assertEquals(result, true);
        assertEquals(env.objectRecord.bindings.has("x"), false);
    },
});

// ============================================================================
// Integration Tests
// ============================================================================

Deno.test({
    name: "ExecutionContext - complete scope chain resolution",
    fn() {
        // Create nested environments
        const global = createDeclarativeEnvironmentRecord();
        global.bindings.set("globalVar", createString("global"));

        const funcEnv = createDeclarativeEnvironmentRecord(global);
        funcEnv.bindings.set("funcVar", createString("function"));

        const blockEnv = createDeclarativeEnvironmentRecord(funcEnv);
        blockEnv.bindings.set("blockVar", createString("block"));

        // Test resolution at each level
        const blockResult = getIdentifierReference(blockEnv, "blockVar");
        if (blockResult?.type === "string") {
            assertEquals(blockResult.value, "block");
        }

        const funcResult = getIdentifierReference(blockEnv, "funcVar");
        if (funcResult?.type === "string") {
            assertEquals(funcResult.value, "function");
        }

        const globalResult = getIdentifierReference(blockEnv, "globalVar");
        if (globalResult?.type === "string") {
            assertEquals(globalResult.value, "global");
        }
    },
});

Deno.test({
    name: "ExecutionContext - temporal dead zone behavior",
    fn() {
        const env = createDeclarativeEnvironmentRecord();

        // Create binding but don't initialize
        createMutableBinding(env, "x");

        // Should throw when accessing before initialization
        assertThrows(
            () => {
                getBindingValue(env, "x");
            },
            Error,
            "Cannot access 'x' before initialization"
        );

        // Initialize
        initializeBinding(env, "x", createNumber(42));

        // Should work now
        const value = getBindingValue(env, "x");
        if (value.type === "number") {
            assertEquals(value.value, 42);
        }
    },
});

Deno.test({
    name: "ExecutionContext - const immutability behavior",
    fn() {
        const env = createDeclarativeEnvironmentRecord();

        // Create immutable binding
        createImmutableBinding(env, "PI");
        initializeBinding(env, "PI", createNumber(3.14));

        // Should throw when trying to modify in strict mode
        assertThrows(
            () => {
                setMutableBinding(env, "PI", createNumber(3), true);
            },
            Error,
            "Cannot assign to const variable"
        );

        // Value should remain unchanged
        const value = getBindingValue(env, "PI");
        if (value.type === "number") {
            assertEquals(value.value, 3.14);
        }
    },
});
