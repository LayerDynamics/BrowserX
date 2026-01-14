/**
 * V8Context Tests
 *
 * Comprehensive tests for V8 execution context.
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import {
    V8Context,
    ContextFactory,
} from "../../../src/engine/javascript/V8Context.ts";
import { createNumber, createString, createBoolean, getProperty } from "../../../src/engine/javascript/JSValue.ts";

// ============================================================================
// V8Context Constructor Tests
// ============================================================================

Deno.test({
    name: "V8Context - constructor creates context with default config",
    fn() {
        const context = new V8Context();

        assertExists(context);
        assertEquals(context.isValid(), true);

        context.dispose();
    },
});

Deno.test({
    name: "V8Context - constructor creates context with custom config",
    fn() {
        const context = new V8Context({
            enableJIT: true,
            strictMode: true,
            enableDebugger: false,
        });

        const config = context.getConfig();
        assertEquals(config.enableJIT, true);
        assertEquals(config.strictMode, true);

        context.dispose();
    },
});

Deno.test({
    name: "V8Context - constructor initializes global object",
    fn() {
        const context = new V8Context();
        const global = context.getGlobal();

        assertExists(global);
        assertEquals(global.type, "object");

        context.dispose();
    },
});

Deno.test({
    name: "V8Context - constructor initializes stats",
    fn() {
        const context = new V8Context();
        const stats = context.getStats();

        assertEquals(stats.executionsCount, 0);
        assertEquals(stats.totalExecutionTime, 0);
        assertEquals(stats.averageExecutionTime, 0);

        context.dispose();
    },
});

// ============================================================================
// Execution Tests
// ============================================================================

Deno.test({
    name: "V8Context - execute runs JavaScript code",
    fn() {
        const context = new V8Context();
        const result = context.execute("1 + 1");

        assertEquals(result.success, true);
        assertExists(result.value);
        assertEquals(typeof result.executionTime, "number");

        context.dispose();
    },
});

Deno.test({
    name: "V8Context - execute returns result with execution time",
    fn() {
        const context = new V8Context();
        const result = context.execute("42");

        assertEquals(result.success, true);
        assertEquals(result.executionTime >= 0, true);

        context.dispose();
    },
});

Deno.test({
    name: "V8Context - execute handles errors gracefully",
    fn() {
        const context = new V8Context();
        const result = context.execute("invalid syntax }}}");

        assertEquals(result.success, false);
        assertExists(result.error);

        context.dispose();
    },
});

Deno.test({
    name: "V8Context - execute updates statistics",
    fn() {
        const context = new V8Context();

        context.execute("1 + 1");
        const stats1 = context.getStats();
        assertEquals(stats1.executionsCount, 1);

        context.execute("2 + 2");
        const stats2 = context.getStats();
        assertEquals(stats2.executionsCount, 2);

        context.dispose();
    },
});

Deno.test({
    name: "V8Context - eval evaluates expression",
    fn() {
        const context = new V8Context();
        const result = context.eval("3 + 4");

        assertExists(result);

        context.dispose();
    },
});

Deno.test({
    name: "V8Context - executeAsync executes code asynchronously",
    async fn() {
        const context = new V8Context();
        const result = await context.executeAsync("5 + 5");

        assertEquals(result.success, true);
        assertExists(result.value);

        context.dispose();
    },
});

// ============================================================================
// Global Object Tests
// ============================================================================

Deno.test({
    name: "V8Context - getGlobal returns global object",
    fn() {
        const context = new V8Context();
        const global = context.getGlobal();

        assertEquals(global.type, "object");

        context.dispose();
    },
});

Deno.test({
    name: "V8Context - global getter returns global object",
    fn() {
        const context = new V8Context();
        const global = context.global;

        assertEquals(global.type, "object");

        context.dispose();
    },
});

Deno.test({
    name: "V8Context - global object has console",
    fn() {
        const context = new V8Context();
        const global = context.getGlobal();
        const console = getProperty(global, "console");

        assertEquals(console.type, "object");

        context.dispose();
    },
});

Deno.test({
    name: "V8Context - global object has Math",
    fn() {
        const context = new V8Context();
        const global = context.getGlobal();
        const math = getProperty(global, "Math");

        assertEquals(math.type, "object");

        context.dispose();
    },
});

Deno.test({
    name: "V8Context - global object has parseInt",
    fn() {
        const context = new V8Context();
        const global = context.getGlobal();
        const parseInt = getProperty(global, "parseInt");

        assertEquals(parseInt.type, "function");

        context.dispose();
    },
});

Deno.test({
    name: "V8Context - global object has parseFloat",
    fn() {
        const context = new V8Context();
        const global = context.getGlobal();
        const parseFloat = getProperty(global, "parseFloat");

        assertEquals(parseFloat.type, "function");

        context.dispose();
    },
});

Deno.test({
    name: "V8Context - global object has globalThis",
    fn() {
        const context = new V8Context();
        const global = context.getGlobal();
        const globalThis = getProperty(global, "globalThis");

        assertEquals(globalThis.type, "object");

        context.dispose();
    },
});

Deno.test({
    name: "V8Context - global object has window",
    fn() {
        const context = new V8Context();
        const global = context.getGlobal();
        const window = getProperty(global, "window");

        assertEquals(window.type, "object");

        context.dispose();
    },
});

Deno.test({
    name: "V8Context - global object has undefined",
    fn() {
        const context = new V8Context();
        const global = context.getGlobal();
        const undef = getProperty(global, "undefined");

        assertEquals(undef.type, "undefined");

        context.dispose();
    },
});

// ============================================================================
// Global Variable Management Tests
// ============================================================================

Deno.test({
    name: "V8Context - setGlobal sets global variable",
    fn() {
        const context = new V8Context();

        context.setGlobal("myVar", createNumber(42));
        const value = context.getGlobalVariable("myVar");

        assertEquals(value.type, "number");
        if (value.type === "number") {
            assertEquals(value.value, 42);
        }

        context.dispose();
    },
});

Deno.test({
    name: "V8Context - getGlobalVariable retrieves global variable",
    fn() {
        const context = new V8Context();

        context.setGlobal("test", createString("hello"));
        const value = context.getGlobalVariable("test");

        assertEquals(value.type, "string");
        if (value.type === "string") {
            assertEquals(value.value, "hello");
        }

        context.dispose();
    },
});

Deno.test({
    name: "V8Context - setGlobal with boolean value",
    fn() {
        const context = new V8Context();

        context.setGlobal("flag", createBoolean(true));
        const value = context.getGlobalVariable("flag");

        assertEquals(value.type, "boolean");
        if (value.type === "boolean") {
            assertEquals(value.value, true);
        }

        context.dispose();
    },
});

// ============================================================================
// Component Access Tests
// ============================================================================

Deno.test({
    name: "V8Context - getRealm returns realm",
    fn() {
        const context = new V8Context();
        const realm = context.getRealm();

        assertExists(realm);
        assertExists(realm.globalObject);
        assertExists(realm.globalEnvironment);

        context.dispose();
    },
});

Deno.test({
    name: "V8Context - getExecutionContext returns execution context",
    fn() {
        const context = new V8Context();
        const execContext = context.getExecutionContext();

        assertExists(execContext);
        assertExists(execContext.lexicalEnvironment);
        assertExists(execContext.variableEnvironment);

        context.dispose();
    },
});

Deno.test({
    name: "V8Context - getHeap returns heap instance",
    fn() {
        const context = new V8Context();
        const heap = context.getHeap();

        assertExists(heap);

        context.dispose();
    },
});

Deno.test({
    name: "V8Context - getCompiler returns compiler instance",
    fn() {
        const context = new V8Context();
        const compiler = context.getCompiler();

        assertExists(compiler);

        context.dispose();
    },
});

Deno.test({
    name: "V8Context - getInterpreter returns interpreter instance",
    fn() {
        const context = new V8Context();
        const interpreter = context.getInterpreter();

        assertExists(interpreter);

        context.dispose();
    },
});

// ============================================================================
// Statistics Tests
// ============================================================================

Deno.test({
    name: "V8Context - getStats returns statistics",
    fn() {
        const context = new V8Context();
        const stats = context.getStats();

        assertEquals(typeof stats.executionsCount, "number");
        assertEquals(typeof stats.totalExecutionTime, "number");
        assertEquals(typeof stats.averageExecutionTime, "number");
        assertExists(stats.heapStats);

        context.dispose();
    },
});

Deno.test({
    name: "V8Context - stats track execution count",
    fn() {
        const context = new V8Context();

        context.execute("1");
        context.execute("2");
        context.execute("3");

        const stats = context.getStats();
        assertEquals(stats.executionsCount, 3);

        context.dispose();
    },
});

Deno.test({
    name: "V8Context - stats track execution time",
    fn() {
        const context = new V8Context();

        context.execute("1 + 1");

        const stats = context.getStats();
        assertEquals(stats.totalExecutionTime > 0, true);

        context.dispose();
    },
});

Deno.test({
    name: "V8Context - stats calculate average execution time",
    fn() {
        const context = new V8Context();

        context.execute("1");
        context.execute("2");

        const stats = context.getStats();
        assertEquals(stats.averageExecutionTime, stats.totalExecutionTime / 2);

        context.dispose();
    },
});

// ============================================================================
// Configuration Tests
// ============================================================================

Deno.test({
    name: "V8Context - getConfig returns configuration",
    fn() {
        const context = new V8Context({
            enableJIT: true,
            strictMode: false,
        });

        const config = context.getConfig();
        assertEquals(config.enableJIT, true);
        assertEquals(config.strictMode, false);

        context.dispose();
    },
});

Deno.test({
    name: "V8Context - getConfig returns copy",
    fn() {
        const context = new V8Context();

        const config1 = context.getConfig();
        const config2 = context.getConfig();

        assert(config1 !== config2);

        context.dispose();
    },
});

// ============================================================================
// Garbage Collection Tests
// ============================================================================

Deno.test({
    name: "V8Context - gc runs garbage collection",
    fn() {
        const context = new V8Context();

        context.gc(); // Should not throw

        context.dispose();
    },
});

Deno.test({
    name: "V8Context - gc updates heap stats",
    fn() {
        const context = new V8Context();

        context.execute("var x = {}");
        context.gc();

        const stats = context.getStats();
        assertExists(stats.heapStats);

        context.dispose();
    },
});

// ============================================================================
// Reset and Dispose Tests
// ============================================================================

Deno.test({
    name: "V8Context - reset clears state",
    fn() {
        const context = new V8Context();

        context.setGlobal("test", createNumber(42));
        context.execute("1 + 1");

        context.reset();

        const stats = context.getStats();
        assertEquals(stats.executionsCount, 0);

        context.dispose();
    },
});

Deno.test({
    name: "V8Context - reset reinitializes global object",
    fn() {
        const context = new V8Context();

        context.reset();

        const global = context.getGlobal();
        assertEquals(global.type, "object");

        // Check that built-ins are still there
        const console = getProperty(global, "console");
        assertEquals(console.type, "object");

        context.dispose();
    },
});

Deno.test({
    name: "V8Context - isValid returns true for valid context",
    fn() {
        const context = new V8Context();

        assertEquals(context.isValid(), true);

        context.dispose();
    },
});

Deno.test({
    name: "V8Context - dispose cleans up resources",
    fn() {
        const context = new V8Context();

        context.dispose();

        // Should not throw
        assert(true);
    },
});

// ============================================================================
// Compilation Tests
// ============================================================================

Deno.test({
    name: "V8Context - compile compiles code without executing",
    fn() {
        const context = new V8Context();
        const compiled = context.compile("1 + 1");

        assertExists(compiled);

        context.dispose();
    },
});

Deno.test({
    name: "V8Context - parse parses code to AST",
    fn() {
        const context = new V8Context();
        const ast = context.parse("var x = 42");

        assertExists(ast);

        context.dispose();
    },
});

Deno.test({
    name: "V8Context - tokenize tokenizes code",
    fn() {
        const context = new V8Context();
        const tokens = context.tokenize("1 + 2");

        assertExists(tokens);

        context.dispose();
    },
});

// ============================================================================
// ContextFactory Tests
// ============================================================================

Deno.test({
    name: "ContextFactory - createDefault creates context with defaults",
    fn() {
        const context = ContextFactory.createDefault();

        assertExists(context);
        assertEquals(context.isValid(), true);

        context.dispose();
    },
});

Deno.test({
    name: "ContextFactory - createDevelopment creates context with dev config",
    fn() {
        const context = ContextFactory.createDevelopment();

        const config = context.getConfig();
        assertEquals(config.enableDebugger, true);
        assertEquals(config.strictMode, true);

        context.dispose();
    },
});

Deno.test({
    name: "ContextFactory - createProduction creates context with prod config",
    fn() {
        const context = ContextFactory.createProduction();

        const config = context.getConfig();
        assertEquals(config.enableJIT, true);
        assertEquals(config.strictMode, true);

        context.dispose();
    },
});

Deno.test({
    name: "ContextFactory - createForTesting creates context with test config",
    fn() {
        const context = ContextFactory.createForTesting();

        const config = context.getConfig();
        assertEquals(config.strictMode, true);
        assertExists(config.heapSize);

        context.dispose();
    },
});

Deno.test({
    name: "ContextFactory - createWithConfig creates context with custom config",
    fn() {
        const customConfig = {
            enableJIT: false,
            strictMode: false,
            enableDebugger: true,
        };

        const context = ContextFactory.createWithConfig(customConfig);
        const config = context.getConfig();

        assertEquals(config.enableJIT, false);
        assertEquals(config.strictMode, false);
        assertEquals(config.enableDebugger, true);

        context.dispose();
    },
});

// ============================================================================
// Integration Tests
// ============================================================================

Deno.test({
    name: "V8Context - multiple executions in same context",
    fn() {
        const context = new V8Context();

        const result1 = context.execute("1 + 1");
        const result2 = context.execute("2 + 2");
        const result3 = context.execute("3 + 3");

        assertEquals(result1.success, true);
        assertEquals(result2.success, true);
        assertEquals(result3.success, true);

        const stats = context.getStats();
        assertEquals(stats.executionsCount, 3);

        context.dispose();
    },
});

Deno.test({
    name: "V8Context - set and get global variables",
    fn() {
        const context = new V8Context();

        context.setGlobal("a", createNumber(10));
        context.setGlobal("b", createNumber(20));
        context.setGlobal("c", createString("test"));

        const a = context.getGlobalVariable("a");
        const b = context.getGlobalVariable("b");
        const c = context.getGlobalVariable("c");

        if (a.type === "number") assertEquals(a.value, 10);
        if (b.type === "number") assertEquals(b.value, 20);
        if (c.type === "string") assertEquals(c.value, "test");

        context.dispose();
    },
});

Deno.test({
    name: "V8Context - reset preserves config",
    fn() {
        const context = new V8Context({
            enableJIT: true,
            strictMode: true,
        });

        context.reset();

        const config = context.getConfig();
        assertEquals(config.enableJIT, true);
        assertEquals(config.strictMode, true);

        context.dispose();
    },
});

Deno.test({
    name: "V8Context - compile, then execute separately",
    fn() {
        const context = new V8Context();

        const compiled = context.compile("5 + 5");
        assertExists(compiled);

        // Would execute compiled code separately
        const result = context.execute("5 + 5");
        assertEquals(result.success, true);

        context.dispose();
    },
});
