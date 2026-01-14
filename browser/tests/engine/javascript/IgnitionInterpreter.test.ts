/**
 * IgnitionInterpreter Tests
 *
 * Comprehensive tests for bytecode interpreter.
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import {
    IgnitionInterpreter,
    InterpreterFactory,
} from "../../../src/engine/javascript/IgnitionInterpreter.ts";
import { Opcode, type CompiledFunction } from "../../../src/engine/javascript/V8Compiler.ts";
import { createNumber, createString, createBoolean, createUndefined, createNull } from "../../../src/engine/javascript/JSValue.ts";
import { V8Heap } from "../../../src/engine/javascript/V8Heap.ts";

// ============================================================================
// IgnitionInterpreter Constructor Tests
// ============================================================================

Deno.test({
    name: "IgnitionInterpreter - constructor creates interpreter instance",
    fn() {
        const interpreter = new IgnitionInterpreter();

        assertExists(interpreter);
    },
});

Deno.test({
    name: "IgnitionInterpreter - constructor with heap",
    fn() {
        const heap = new V8Heap();
        const interpreter = new IgnitionInterpreter(heap);

        assertExists(interpreter);
    },
});

Deno.test({
    name: "IgnitionInterpreter - constructor initializes accumulator to undefined",
    fn() {
        const interpreter = new IgnitionInterpreter();

        const accumulator = interpreter.getAccumulator();
        assertEquals(accumulator.type, "undefined");
    },
});

Deno.test({
    name: "IgnitionInterpreter - constructor initializes stats",
    fn() {
        const interpreter = new IgnitionInterpreter();

        const stats = interpreter.getStats();
        assertEquals(stats.instructionsExecuted, 0);
        assertEquals(stats.functionsExecuted, 0);
        assertEquals(stats.totalExecutionTime, 0);
    },
});

// ============================================================================
// Basic Execution Tests
// ============================================================================

Deno.test({
    name: "IgnitionInterpreter - execute empty bytecode",
    fn() {
        const interpreter = new IgnitionInterpreter();
        const bytecode = new Uint8Array([
            Opcode.LDA_UNDEFINED,
            Opcode.RETURN,
        ]);

        const result = interpreter.execute(bytecode);

        assertEquals(result.type, "undefined");
    },
});

Deno.test({
    name: "IgnitionInterpreter - execute updates statistics",
    fn() {
        const interpreter = new IgnitionInterpreter();
        const bytecode = new Uint8Array([
            Opcode.LDA_UNDEFINED,
            Opcode.RETURN,
        ]);

        interpreter.execute(bytecode);

        const stats = interpreter.getStats();
        assertEquals(stats.instructionsExecuted, 2);
    },
});

Deno.test({
    name: "IgnitionInterpreter - executeFunction with compiled function",
    fn() {
        const interpreter = new IgnitionInterpreter();
        const compiled: CompiledFunction = {
            name: "test",
            parameterCount: 0,
            registerCount: 2,
            bytecode: new Uint8Array([
                Opcode.LDA_UNDEFINED,
                Opcode.RETURN,
            ]),
            constantPool: [],
        };

        const result = interpreter.executeFunction(compiled);

        assertEquals(result.type, "undefined");
    },
});

// ============================================================================
// Load/Store Instruction Tests
// ============================================================================

Deno.test({
    name: "IgnitionInterpreter - LDA_ZERO loads zero",
    fn() {
        const interpreter = new IgnitionInterpreter();
        const bytecode = new Uint8Array([
            Opcode.LDA_ZERO,
            Opcode.RETURN,
        ]);

        interpreter.execute(bytecode);

        const accumulator = interpreter.getAccumulator();
        assertEquals(accumulator.type, "number");
        if (accumulator.type === "number") {
            assertEquals(accumulator.value, 0);
        }
    },
});

Deno.test({
    name: "IgnitionInterpreter - LDA_UNDEFINED loads undefined",
    fn() {
        const interpreter = new IgnitionInterpreter();
        const bytecode = new Uint8Array([
            Opcode.LDA_UNDEFINED,
            Opcode.RETURN,
        ]);

        interpreter.execute(bytecode);

        const accumulator = interpreter.getAccumulator();
        assertEquals(accumulator.type, "undefined");
    },
});

Deno.test({
    name: "IgnitionInterpreter - LDA_NULL loads null",
    fn() {
        const interpreter = new IgnitionInterpreter();
        const bytecode = new Uint8Array([
            Opcode.LDA_NULL,
            Opcode.RETURN,
        ]);

        interpreter.execute(bytecode);

        const accumulator = interpreter.getAccumulator();
        assertEquals(accumulator.type, "null");
    },
});

Deno.test({
    name: "IgnitionInterpreter - LDA_TRUE loads true",
    fn() {
        const interpreter = new IgnitionInterpreter();
        const bytecode = new Uint8Array([
            Opcode.LDA_TRUE,
            Opcode.RETURN,
        ]);

        interpreter.execute(bytecode);

        const accumulator = interpreter.getAccumulator();
        assertEquals(accumulator.type, "boolean");
        if (accumulator.type === "boolean") {
            assertEquals(accumulator.value, true);
        }
    },
});

Deno.test({
    name: "IgnitionInterpreter - LDA_FALSE loads false",
    fn() {
        const interpreter = new IgnitionInterpreter();
        const bytecode = new Uint8Array([
            Opcode.LDA_FALSE,
            Opcode.RETURN,
        ]);

        interpreter.execute(bytecode);

        const accumulator = interpreter.getAccumulator();
        assertEquals(accumulator.type, "boolean");
        if (accumulator.type === "boolean") {
            assertEquals(accumulator.value, false);
        }
    },
});

Deno.test({
    name: "IgnitionInterpreter - LDA_CONSTANT loads number constant",
    fn() {
        const interpreter = new IgnitionInterpreter();
        const bytecode = new Uint8Array([
            Opcode.LDA_CONSTANT, 0,
            Opcode.RETURN,
        ]);

        interpreter.execute(bytecode, [42]);

        const accumulator = interpreter.getAccumulator();
        assertEquals(accumulator.type, "number");
        if (accumulator.type === "number") {
            assertEquals(accumulator.value, 42);
        }
    },
});

Deno.test({
    name: "IgnitionInterpreter - LDA_CONSTANT loads string constant",
    fn() {
        const interpreter = new IgnitionInterpreter();
        const bytecode = new Uint8Array([
            Opcode.LDA_CONSTANT, 0,
            Opcode.RETURN,
        ]);

        interpreter.execute(bytecode, ["hello"]);

        const accumulator = interpreter.getAccumulator();
        assertEquals(accumulator.type, "string");
        if (accumulator.type === "string") {
            assertEquals(accumulator.value, "hello");
        }
    },
});

Deno.test({
    name: "IgnitionInterpreter - STAR stores accumulator to register",
    fn() {
        const interpreter = new IgnitionInterpreter();
        const bytecode = new Uint8Array([
            Opcode.LDA_CONSTANT, 0,
            Opcode.STAR, 0,
            Opcode.RETURN,
        ]);

        interpreter.execute(bytecode, [42]);

        const register = interpreter.getRegister(0);
        assertEquals(register.type, "number");
        if (register.type === "number") {
            assertEquals(register.value, 42);
        }
    },
});

Deno.test({
    name: "IgnitionInterpreter - LDAR loads from register to accumulator",
    fn() {
        const interpreter = new IgnitionInterpreter();
        const bytecode = new Uint8Array([
            Opcode.LDA_CONSTANT, 0,
            Opcode.STAR, 0,
            Opcode.LDA_ZERO,
            Opcode.LDAR, 0,
            Opcode.RETURN,
        ]);

        interpreter.execute(bytecode, [99]);

        const accumulator = interpreter.getAccumulator();
        assertEquals(accumulator.type, "number");
        if (accumulator.type === "number") {
            assertEquals(accumulator.value, 99);
        }
    },
});

// ============================================================================
// Arithmetic Instruction Tests
// ============================================================================

Deno.test({
    name: "IgnitionInterpreter - ADD performs addition",
    fn() {
        const interpreter = new IgnitionInterpreter();
        const bytecode = new Uint8Array([
            Opcode.LDA_CONSTANT, 0,
            Opcode.STAR, 0,
            Opcode.LDA_CONSTANT, 1,
            Opcode.ADD, 0,
            Opcode.RETURN,
        ]);

        interpreter.execute(bytecode, [5, 3]);

        const accumulator = interpreter.getAccumulator();
        assertEquals(accumulator.type, "number");
        if (accumulator.type === "number") {
            assertEquals(accumulator.value, 8);
        }
    },
});

Deno.test({
    name: "IgnitionInterpreter - SUB performs subtraction",
    fn() {
        const interpreter = new IgnitionInterpreter();
        const bytecode = new Uint8Array([
            Opcode.LDA_CONSTANT, 0,
            Opcode.STAR, 0,
            Opcode.LDA_CONSTANT, 1,
            Opcode.SUB, 0,
            Opcode.RETURN,
        ]);

        interpreter.execute(bytecode, [10, 3]);

        const accumulator = interpreter.getAccumulator();
        assertEquals(accumulator.type, "number");
        if (accumulator.type === "number") {
            assertEquals(accumulator.value, 7);
        }
    },
});

Deno.test({
    name: "IgnitionInterpreter - MUL performs multiplication",
    fn() {
        const interpreter = new IgnitionInterpreter();
        const bytecode = new Uint8Array([
            Opcode.LDA_CONSTANT, 0,
            Opcode.STAR, 0,
            Opcode.LDA_CONSTANT, 1,
            Opcode.MUL, 0,
            Opcode.RETURN,
        ]);

        interpreter.execute(bytecode, [4, 5]);

        const accumulator = interpreter.getAccumulator();
        assertEquals(accumulator.type, "number");
        if (accumulator.type === "number") {
            assertEquals(accumulator.value, 20);
        }
    },
});

Deno.test({
    name: "IgnitionInterpreter - DIV performs division",
    fn() {
        const interpreter = new IgnitionInterpreter();
        const bytecode = new Uint8Array([
            Opcode.LDA_CONSTANT, 0,
            Opcode.STAR, 0,
            Opcode.LDA_CONSTANT, 1,
            Opcode.DIV, 0,
            Opcode.RETURN,
        ]);

        interpreter.execute(bytecode, [20, 4]);

        const accumulator = interpreter.getAccumulator();
        assertEquals(accumulator.type, "number");
        if (accumulator.type === "number") {
            assertEquals(accumulator.value, 5);
        }
    },
});

Deno.test({
    name: "IgnitionInterpreter - MOD performs modulo",
    fn() {
        const interpreter = new IgnitionInterpreter();
        const bytecode = new Uint8Array([
            Opcode.LDA_CONSTANT, 0,
            Opcode.STAR, 0,
            Opcode.LDA_CONSTANT, 1,
            Opcode.MOD, 0,
            Opcode.RETURN,
        ]);

        interpreter.execute(bytecode, [10, 3]);

        const accumulator = interpreter.getAccumulator();
        assertEquals(accumulator.type, "number");
        if (accumulator.type === "number") {
            assertEquals(accumulator.value, 1);
        }
    },
});

Deno.test({
    name: "IgnitionInterpreter - INC increments accumulator",
    fn() {
        const interpreter = new IgnitionInterpreter();
        const bytecode = new Uint8Array([
            Opcode.LDA_CONSTANT, 0,
            Opcode.INC,
            Opcode.RETURN,
        ]);

        interpreter.execute(bytecode, [5]);

        const accumulator = interpreter.getAccumulator();
        assertEquals(accumulator.type, "number");
        if (accumulator.type === "number") {
            assertEquals(accumulator.value, 6);
        }
    },
});

Deno.test({
    name: "IgnitionInterpreter - DEC decrements accumulator",
    fn() {
        const interpreter = new IgnitionInterpreter();
        const bytecode = new Uint8Array([
            Opcode.LDA_CONSTANT, 0,
            Opcode.DEC,
            Opcode.RETURN,
        ]);

        interpreter.execute(bytecode, [5]);

        const accumulator = interpreter.getAccumulator();
        assertEquals(accumulator.type, "number");
        if (accumulator.type === "number") {
            assertEquals(accumulator.value, 4);
        }
    },
});

Deno.test({
    name: "IgnitionInterpreter - NEGATE negates accumulator",
    fn() {
        const interpreter = new IgnitionInterpreter();
        const bytecode = new Uint8Array([
            Opcode.LDA_CONSTANT, 0,
            Opcode.NEGATE,
            Opcode.RETURN,
        ]);

        interpreter.execute(bytecode, [5]);

        const accumulator = interpreter.getAccumulator();
        assertEquals(accumulator.type, "number");
        if (accumulator.type === "number") {
            assertEquals(accumulator.value, -5);
        }
    },
});

// ============================================================================
// Comparison Instruction Tests
// ============================================================================

Deno.test({
    name: "IgnitionInterpreter - TEST_LESS_THAN compares values",
    fn() {
        const interpreter = new IgnitionInterpreter();
        const bytecode = new Uint8Array([
            Opcode.LDA_CONSTANT, 0,
            Opcode.STAR, 0,
            Opcode.LDA_CONSTANT, 1,
            Opcode.TEST_LESS_THAN, 0,
            Opcode.RETURN,
        ]);

        interpreter.execute(bytecode, [5, 10]);

        const accumulator = interpreter.getAccumulator();
        assertEquals(accumulator.type, "boolean");
        if (accumulator.type === "boolean") {
            assertEquals(accumulator.value, true);
        }
    },
});

Deno.test({
    name: "IgnitionInterpreter - TEST_GREATER_THAN compares values",
    fn() {
        const interpreter = new IgnitionInterpreter();
        const bytecode = new Uint8Array([
            Opcode.LDA_CONSTANT, 0,
            Opcode.STAR, 0,
            Opcode.LDA_CONSTANT, 1,
            Opcode.TEST_GREATER_THAN, 0,
            Opcode.RETURN,
        ]);

        interpreter.execute(bytecode, [10, 5]);

        const accumulator = interpreter.getAccumulator();
        assertEquals(accumulator.type, "boolean");
        if (accumulator.type === "boolean") {
            assertEquals(accumulator.value, true);
        }
    },
});

Deno.test({
    name: "IgnitionInterpreter - TEST_LESS_EQUAL compares values",
    fn() {
        const interpreter = new IgnitionInterpreter();
        const bytecode = new Uint8Array([
            Opcode.LDA_CONSTANT, 0,
            Opcode.STAR, 0,
            Opcode.LDA_CONSTANT, 1,
            Opcode.TEST_LESS_EQUAL, 0,
            Opcode.RETURN,
        ]);

        interpreter.execute(bytecode, [5, 5]);

        const accumulator = interpreter.getAccumulator();
        assertEquals(accumulator.type, "boolean");
        if (accumulator.type === "boolean") {
            assertEquals(accumulator.value, true);
        }
    },
});

Deno.test({
    name: "IgnitionInterpreter - TEST_GREATER_EQUAL compares values",
    fn() {
        const interpreter = new IgnitionInterpreter();
        const bytecode = new Uint8Array([
            Opcode.LDA_CONSTANT, 0,
            Opcode.STAR, 0,
            Opcode.LDA_CONSTANT, 1,
            Opcode.TEST_GREATER_EQUAL, 0,
            Opcode.RETURN,
        ]);

        interpreter.execute(bytecode, [5, 5]);

        const accumulator = interpreter.getAccumulator();
        assertEquals(accumulator.type, "boolean");
        if (accumulator.type === "boolean") {
            assertEquals(accumulator.value, true);
        }
    },
});

// ============================================================================
// Logical Instruction Tests
// ============================================================================

Deno.test({
    name: "IgnitionInterpreter - LOGICAL_NOT negates boolean",
    fn() {
        const interpreter = new IgnitionInterpreter();
        const bytecode = new Uint8Array([
            Opcode.LDA_TRUE,
            Opcode.LOGICAL_NOT,
            Opcode.RETURN,
        ]);

        interpreter.execute(bytecode);

        const accumulator = interpreter.getAccumulator();
        assertEquals(accumulator.type, "boolean");
        if (accumulator.type === "boolean") {
            assertEquals(accumulator.value, false);
        }
    },
});

Deno.test({
    name: "IgnitionInterpreter - TO_BOOLEAN converts to boolean",
    fn() {
        const interpreter = new IgnitionInterpreter();
        const bytecode = new Uint8Array([
            Opcode.LDA_CONSTANT, 0,
            Opcode.TO_BOOLEAN,
            Opcode.RETURN,
        ]);

        interpreter.execute(bytecode, [1]);

        const accumulator = interpreter.getAccumulator();
        assertEquals(accumulator.type, "boolean");
        if (accumulator.type === "boolean") {
            assertEquals(accumulator.value, true);
        }
    },
});

// ============================================================================
// Global Variable Tests
// ============================================================================

Deno.test({
    name: "IgnitionInterpreter - STA_GLOBAL stores global variable",
    fn() {
        const interpreter = new IgnitionInterpreter();
        const bytecode = new Uint8Array([
            Opcode.LDA_CONSTANT, 1,
            Opcode.STA_GLOBAL, 0,
            Opcode.RETURN,
        ]);

        interpreter.execute(bytecode, ["x", 42]);

        const value = interpreter.getGlobal("x");
        assertEquals(value.type, "number");
        if (value.type === "number") {
            assertEquals(value.value, 42);
        }
    },
});

Deno.test({
    name: "IgnitionInterpreter - LDA_GLOBAL loads global variable",
    fn() {
        const interpreter = new IgnitionInterpreter();
        interpreter.setGlobal("x", createNumber(99));

        const bytecode = new Uint8Array([
            Opcode.LDA_GLOBAL, 0,
            Opcode.RETURN,
        ]);

        interpreter.execute(bytecode, ["x"]);

        const accumulator = interpreter.getAccumulator();
        assertEquals(accumulator.type, "number");
        if (accumulator.type === "number") {
            assertEquals(accumulator.value, 99);
        }
    },
});

Deno.test({
    name: "IgnitionInterpreter - getGlobal retrieves global",
    fn() {
        const interpreter = new IgnitionInterpreter();
        interpreter.setGlobal("test", createString("hello"));

        const value = interpreter.getGlobal("test");

        assertEquals(value.type, "string");
        if (value.type === "string") {
            assertEquals(value.value, "hello");
        }
    },
});

Deno.test({
    name: "IgnitionInterpreter - getGlobal returns undefined for non-existent",
    fn() {
        const interpreter = new IgnitionInterpreter();

        const value = interpreter.getGlobal("nonexistent");

        assertEquals(value.type, "undefined");
    },
});

// ============================================================================
// State Management Tests
// ============================================================================

Deno.test({
    name: "IgnitionInterpreter - getState returns interpreter state",
    fn() {
        const interpreter = new IgnitionInterpreter();

        const state = interpreter.getState();

        assertExists(state);
        assertExists(state.accumulator);
        assertExists(state.registers);
        assertExists(state.globals);
    },
});

Deno.test({
    name: "IgnitionInterpreter - getStats returns statistics",
    fn() {
        const interpreter = new IgnitionInterpreter();

        const stats = interpreter.getStats();

        assertExists(stats);
        assertEquals(typeof stats.instructionsExecuted, "number");
        assertEquals(typeof stats.totalExecutionTime, "number");
    },
});

Deno.test({
    name: "IgnitionInterpreter - reset clears state",
    fn() {
        const interpreter = new IgnitionInterpreter();
        interpreter.setGlobal("x", createNumber(42));

        const bytecode = new Uint8Array([
            Opcode.LDA_CONSTANT, 0,
            Opcode.RETURN,
        ]);
        interpreter.execute(bytecode, [1]);

        interpreter.reset();

        const stats = interpreter.getStats();
        assertEquals(stats.instructionsExecuted, 0);
        assertEquals(interpreter.getGlobal("x").type, "undefined");
    },
});

Deno.test({
    name: "IgnitionInterpreter - isExecuting returns false initially",
    fn() {
        const interpreter = new IgnitionInterpreter();

        assertEquals(interpreter.isExecuting(), false);
    },
});

// ============================================================================
// Register Management Tests
// ============================================================================

Deno.test({
    name: "IgnitionInterpreter - getRegister returns register value",
    fn() {
        const interpreter = new IgnitionInterpreter();
        const bytecode = new Uint8Array([
            Opcode.LDA_CONSTANT, 0,
            Opcode.STAR, 5,
            Opcode.RETURN,
        ]);

        interpreter.execute(bytecode, [123]);

        const register = interpreter.getRegister(5);
        assertEquals(register.type, "number");
        if (register.type === "number") {
            assertEquals(register.value, 123);
        }
    },
});

Deno.test({
    name: "IgnitionInterpreter - getRegister returns undefined for empty register",
    fn() {
        const interpreter = new IgnitionInterpreter();

        const register = interpreter.getRegister(10);

        assertEquals(register.type, "undefined");
    },
});

// ============================================================================
// Special Instruction Tests
// ============================================================================

Deno.test({
    name: "IgnitionInterpreter - NOP does nothing",
    fn() {
        const interpreter = new IgnitionInterpreter();
        const bytecode = new Uint8Array([
            Opcode.LDA_CONSTANT, 0,
            Opcode.NOP,
            Opcode.RETURN,
        ]);

        interpreter.execute(bytecode, [42]);

        const accumulator = interpreter.getAccumulator();
        assertEquals(accumulator.type, "number");
        if (accumulator.type === "number") {
            assertEquals(accumulator.value, 42);
        }
    },
});

// ============================================================================
// InterpreterFactory Tests
// ============================================================================

Deno.test({
    name: "InterpreterFactory - createDefault creates interpreter",
    fn() {
        const interpreter = InterpreterFactory.createDefault();

        assertExists(interpreter);
    },
});

Deno.test({
    name: "InterpreterFactory - createWithHeap creates interpreter with heap",
    fn() {
        const heap = new V8Heap();
        const interpreter = InterpreterFactory.createWithHeap(heap);

        assertExists(interpreter);
    },
});

Deno.test({
    name: "InterpreterFactory - createForTesting creates interpreter",
    fn() {
        const interpreter = InterpreterFactory.createForTesting();

        assertExists(interpreter);
    },
});

// ============================================================================
// Integration Tests
// ============================================================================

Deno.test({
    name: "IgnitionInterpreter - execute complex arithmetic",
    fn() {
        const interpreter = new IgnitionInterpreter();
        // Calculate (5 + 3) * 2
        const bytecode = new Uint8Array([
            Opcode.LDA_CONSTANT, 0, // Load 5
            Opcode.STAR, 0,         // Save to r0
            Opcode.LDA_CONSTANT, 1, // Load 3
            Opcode.ADD, 0,          // Add r0 (5+3=8)
            Opcode.STAR, 0,         // Save result to r0
            Opcode.LDA_CONSTANT, 2, // Load 2
            Opcode.MUL, 0,          // Multiply by r0 (8*2=16)
            Opcode.RETURN,
        ]);

        interpreter.execute(bytecode, [5, 3, 2]);

        const accumulator = interpreter.getAccumulator();
        assertEquals(accumulator.type, "number");
        if (accumulator.type === "number") {
            assertEquals(accumulator.value, 16);
        }
    },
});

Deno.test({
    name: "IgnitionInterpreter - multiple executions",
    fn() {
        const interpreter = new IgnitionInterpreter();
        const bytecode1 = new Uint8Array([
            Opcode.LDA_CONSTANT, 0,
            Opcode.RETURN,
        ]);
        const bytecode2 = new Uint8Array([
            Opcode.LDA_CONSTANT, 0,
            Opcode.RETURN,
        ]);

        interpreter.execute(bytecode1, [1]);
        interpreter.execute(bytecode2, [2]);

        const stats = interpreter.getStats();
        assert(stats.instructionsExecuted > 0);
    },
});

Deno.test({
    name: "IgnitionInterpreter - global variables persist",
    fn() {
        const interpreter = new IgnitionInterpreter();

        const bytecode1 = new Uint8Array([
            Opcode.LDA_CONSTANT, 1,
            Opcode.STA_GLOBAL, 0,
            Opcode.RETURN,
        ]);

        const bytecode2 = new Uint8Array([
            Opcode.LDA_GLOBAL, 0,
            Opcode.RETURN,
        ]);

        interpreter.execute(bytecode1, ["x", 42]);
        interpreter.execute(bytecode2, ["x"]);

        const accumulator = interpreter.getAccumulator();
        assertEquals(accumulator.type, "number");
        if (accumulator.type === "number") {
            assertEquals(accumulator.value, 42);
        }
    },
});

Deno.test({
    name: "IgnitionInterpreter - all load constant types",
    fn() {
        const interpreter = new IgnitionInterpreter();

        // Test number
        let bytecode = new Uint8Array([Opcode.LDA_CONSTANT, 0, Opcode.RETURN]);
        interpreter.execute(bytecode, [42]);
        assertEquals(interpreter.getAccumulator().type, "number");

        // Test string
        bytecode = new Uint8Array([Opcode.LDA_CONSTANT, 0, Opcode.RETURN]);
        interpreter.execute(bytecode, ["hello"]);
        assertEquals(interpreter.getAccumulator().type, "string");

        // Test boolean
        bytecode = new Uint8Array([Opcode.LDA_CONSTANT, 0, Opcode.RETURN]);
        interpreter.execute(bytecode, [true]);
        assertEquals(interpreter.getAccumulator().type, "boolean");

        // Test null
        bytecode = new Uint8Array([Opcode.LDA_CONSTANT, 0, Opcode.RETURN]);
        interpreter.execute(bytecode, [null]);
        assertEquals(interpreter.getAccumulator().type, "null");
    },
});
