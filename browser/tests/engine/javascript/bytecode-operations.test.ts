// @ts-nocheck - JSValue discriminated union requires casting for .value access in tests
import { assertEquals, assertNotEquals } from "@std/assert";
import { V8Compiler } from "../../../../browser/src/engine/javascript/V8Compiler.ts";
import { IgnitionInterpreter } from "../../../../browser/src/engine/javascript/IgnitionInterpreter.ts";
import { createUndefined, JSValueType } from "../../../../browser/src/engine/javascript/JSValue.ts";
import {
  CallStack,
  createExecutionContext,
  createGlobalEnvironmentRecord,
  createRealm,
} from "../../../../browser/src/engine/javascript/ExecutionContext.ts";

function compileAndRun(source: string) {
  const compiler = new V8Compiler();
  const compiled = compiler.compile(source);
  const realm = createRealm();
  const globalEnv = createGlobalEnvironmentRecord();
  const context = createExecutionContext(realm, globalEnv, createUndefined());
  const callStack = new CallStack();
  callStack.push(context);
  const interpreter = new IgnitionInterpreter();
  return interpreter.execute(compiled.bytecode, compiled.constantPool);
}

// ============================================================================
// CREATE_OBJECT tests
// ============================================================================

Deno.test("bytecode ops - CREATE_OBJECT creates an object", () => {
  const result = compileAndRun("var x = {}; x");
  assertEquals(result.type, JSValueType.OBJECT);
});

Deno.test("bytecode ops - object with properties", () => {
  const result = compileAndRun("var x = {a: 1, b: 2}; x.a");
  assertEquals(result.type, JSValueType.NUMBER);
  assertEquals(result.value, 1);
});

Deno.test("bytecode ops - object property access returns correct value", () => {
  const result = compileAndRun("var x = {name: 42}; x.name");
  assertEquals(result.type, JSValueType.NUMBER);
  assertEquals(result.value, 42);
});

// ============================================================================
// CREATE_ARRAY tests
// ============================================================================

Deno.test("bytecode ops - CREATE_ARRAY creates an array-like object", () => {
  const result = compileAndRun("var arr = [10, 20, 30]; arr");
  assertEquals(result.type, JSValueType.OBJECT);
});

Deno.test("bytecode ops - array length property", () => {
  const result = compileAndRun("var arr = [10, 20, 30]; arr.length");
  assertEquals(result.type, JSValueType.NUMBER);
  assertEquals(result.value, 3);
});

// ============================================================================
// GET_PROPERTY / SET_PROPERTY tests
// ============================================================================

Deno.test("bytecode ops - GET_PROPERTY reads property", () => {
  const result = compileAndRun("var obj = {x: 99}; obj.x");
  assertEquals(result.type, JSValueType.NUMBER);
  assertEquals(result.value, 99);
});

Deno.test("bytecode ops - GET_PROPERTY returns undefined for missing property", () => {
  const result = compileAndRun("var obj = {}; obj.missing");
  assertEquals(result.type, JSValueType.UNDEFINED);
});

Deno.test("bytecode ops - SET_PROPERTY assigns property", () => {
  const result = compileAndRun("var obj = {}; obj.x = 42; obj.x");
  assertEquals(result.type, JSValueType.NUMBER);
  assertEquals(result.value, 42);
});

// ============================================================================
// CALL tests
// ============================================================================

Deno.test("bytecode ops - CALL invokes function declaration", () => {
  const result = compileAndRun("function add(a, b) { return a + b; } add(3, 4)");
  assertEquals(result.type, JSValueType.NUMBER);
  assertEquals(result.value, 7);
});

Deno.test("bytecode ops - CALL with no args", () => {
  const result = compileAndRun("function five() { return 5; } five()");
  assertEquals(result.type, JSValueType.NUMBER);
  assertEquals(result.value, 5);
});

// ============================================================================
// CONSTRUCT tests
// ============================================================================

Deno.test("bytecode ops - CONSTRUCT creates new object", () => {
  const result = compileAndRun("function Foo() { this.x = 10; } var f = new Foo(); f.x");
  assertEquals(result.type, JSValueType.NUMBER);
  assertEquals(result.value, 10);
});

// ============================================================================
// GET_KEYED / SET_KEYED tests
// ============================================================================

Deno.test("bytecode ops - GET_KEYED reads by index", () => {
  const result = compileAndRun("var arr = [10, 20, 30]; arr[1]");
  assertEquals(result.type, JSValueType.NUMBER);
  assertEquals(result.value, 20);
});

Deno.test("bytecode ops - SET_KEYED writes by index", () => {
  const result = compileAndRun("var arr = [0, 0]; arr[0] = 99; arr[0]");
  assertEquals(result.type, JSValueType.NUMBER);
  assertEquals(result.value, 99);
});

// ============================================================================
// CREATE_CLOSURE tests
// ============================================================================

Deno.test("bytecode ops - CREATE_CLOSURE captures scope", () => {
  const result = compileAndRun(
    "function make() { var x = 5; return function() { return x; }; } var fn = make(); fn()",
  );
  assertEquals(result.type, JSValueType.NUMBER);
  assertEquals(result.value, 5);
});

// ============================================================================
// LDA_CONTEXT_SLOT / STA_CONTEXT_SLOT tests
// ============================================================================

Deno.test("bytecode ops - context slot read/write via closure", () => {
  const result = compileAndRun(
    "var y = 100; function get() { return y; } get()",
  );
  assertEquals(result.type, JSValueType.NUMBER);
  assertEquals(result.value, 100);
});

// ============================================================================
// Control flow tests (if/while/for)
// ============================================================================

Deno.test("bytecode ops - if statement true branch", () => {
  const result = compileAndRun("var x = 0; if (1) { x = 10; } x");
  assertEquals(result.type, JSValueType.NUMBER);
  assertEquals(result.value, 10);
});

Deno.test("bytecode ops - if statement false branch (else)", () => {
  const result = compileAndRun("var x = 0; if (0) { x = 10; } else { x = 20; } x");
  assertEquals(result.type, JSValueType.NUMBER);
  assertEquals(result.value, 20);
});

Deno.test("bytecode ops - while loop", () => {
  const result = compileAndRun(
    "var i = 0; var sum = 0; while (i < 5) { sum = sum + i; i = i + 1; } sum",
  );
  assertEquals(result.type, JSValueType.NUMBER);
  assertEquals(result.value, 10);
});

Deno.test("bytecode ops - for loop", () => {
  const result = compileAndRun(
    "var sum = 0; for (var i = 0; i < 4; i = i + 1) { sum = sum + i; } sum",
  );
  assertEquals(result.type, JSValueType.NUMBER);
  assertEquals(result.value, 6);
});

// ============================================================================
// Assignment expression tests
// ============================================================================

Deno.test("bytecode ops - assignment expression", () => {
  const result = compileAndRun("var x = 5; x = x + 3; x");
  assertEquals(result.type, JSValueType.NUMBER);
  assertEquals(result.value, 8);
});

// ============================================================================
// Arithmetic + comparison operators
// ============================================================================

Deno.test("bytecode ops - modulo operator", () => {
  const result = compileAndRun("7 % 3");
  assertEquals(result.type, JSValueType.NUMBER);
  assertEquals(result.value, 1);
});

Deno.test("bytecode ops - strict equality true", () => {
  const result = compileAndRun("5 === 5");
  assertEquals(result.type, JSValueType.BOOLEAN);
  assertEquals(result.value, true);
});

Deno.test("bytecode ops - less than or equal", () => {
  const result = compileAndRun("5 <= 5");
  assertEquals(result.type, JSValueType.BOOLEAN);
  assertEquals(result.value, true);
});

Deno.test("bytecode ops - greater than or equal", () => {
  const result = compileAndRun("6 >= 5");
  assertEquals(result.type, JSValueType.BOOLEAN);
  assertEquals(result.value, true);
});

// ============================================================================
// this expression
// ============================================================================

Deno.test("bytecode ops - this expression in constructor", () => {
  const result = compileAndRun(
    "function Point(x) { this.x = x; } var p = new Point(42); p.x",
  );
  assertEquals(result.type, JSValueType.NUMBER);
  assertEquals(result.value, 42);
});

// ============================================================================
// Nested function calls
// ============================================================================

Deno.test("bytecode ops - nested function calls", () => {
  const result = compileAndRun(
    "function double(n) { return n + n; } function quad(n) { return double(double(n)); } quad(3)",
  );
  assertEquals(result.type, JSValueType.NUMBER);
  assertEquals(result.value, 12);
});

// ============================================================================
// Compiler/parser tests
// ============================================================================

Deno.test("bytecode ops - compiler produces valid bytecode for object", () => {
  const compiler = new V8Compiler();
  const compiled = compiler.compile("var x = {a: 1};");
  assertNotEquals(compiled.bytecode.length, 0);
});

Deno.test("bytecode ops - compiler produces valid bytecode for function call", () => {
  const compiler = new V8Compiler();
  const compiled = compiler.compile("function f() { return 1; } f();");
  assertNotEquals(compiled.bytecode.length, 0);
});

Deno.test("bytecode ops - compiler produces valid bytecode for new expression", () => {
  const compiler = new V8Compiler();
  const compiled = compiler.compile("function F() {} new F();");
  assertNotEquals(compiled.bytecode.length, 0);
});

Deno.test("bytecode ops - compiler produces valid bytecode for array", () => {
  const compiler = new V8Compiler();
  const compiled = compiler.compile("var a = [1, 2, 3];");
  assertNotEquals(compiled.bytecode.length, 0);
});

Deno.test("bytecode ops - compiler produces valid bytecode for member expression", () => {
  const compiler = new V8Compiler();
  const compiled = compiler.compile("var o = {x: 1}; o.x;");
  assertNotEquals(compiled.bytecode.length, 0);
});

Deno.test("bytecode ops - compiler produces valid bytecode for if statement", () => {
  const compiler = new V8Compiler();
  const compiled = compiler.compile("if (1) { var x = 1; }");
  assertNotEquals(compiled.bytecode.length, 0);
});

Deno.test("bytecode ops - compiler produces valid bytecode for while loop", () => {
  const compiler = new V8Compiler();
  const compiled = compiler.compile("var i = 0; while (i < 10) { i = i + 1; }");
  assertNotEquals(compiled.bytecode.length, 0);
});

Deno.test("bytecode ops - compiler produces valid bytecode for for loop", () => {
  const compiler = new V8Compiler();
  const compiled = compiler.compile("for (var i = 0; i < 10; i = i + 1) {}");
  assertNotEquals(compiled.bytecode.length, 0);
});

// ============================================================================
// CALL argument register reliability tests
// ============================================================================

Deno.test("bytecode ops - CALL passes correct args with interleaved registers", () => {
  // This tests the bug where executeCALL scans backwards for highest non-undefined
  // register to find args, which breaks when earlier code leaves values in higher registers.
  // Setup: store values in registers via variables, then call a function.
  // The earlier variable assignments occupy registers that could confuse the heuristic.
  const result = compileAndRun(`
    function add(a, b) { return a + b; }
    var x = 10;
    var y = 20;
    var z = 30;
    add(1, 2)
  `);
  assertEquals(result.type, JSValueType.NUMBER);
  assertEquals(result.value, 3);
});

Deno.test("bytecode ops - CALL with nested call args gets correct values", () => {
  // Nested calls create intermediate register usage that can confuse backwards scanning
  const result = compileAndRun(`
    function double(n) { return n + n; }
    function addOne(n) { return n + 1; }
    addOne(double(3))
  `);
  assertEquals(result.type, JSValueType.NUMBER);
  assertEquals(result.value, 7);
});

Deno.test("bytecode ops - CALL multiple sequential calls use correct args", () => {
  // Multiple calls in sequence - earlier call results in registers shouldn't
  // pollute later calls' argument resolution
  const result = compileAndRun(`
    function id(x) { return x; }
    var a = id(100);
    var b = id(200);
    id(42)
  `);
  assertEquals(result.type, JSValueType.NUMBER);
  assertEquals(result.value, 42);
});

Deno.test("bytecode ops - CALL with expression arg that allocates intermediate registers", () => {
  // When the second arg is a binary expression, the compiler allocates a temp
  // register between argReg[0] and argReg[1], making args non-consecutive.
  // e.g., foo(c, a + b) -> funcReg=R0, argReg[0]=R1(c), tempR2(a), argReg[1]=R3(a+b)
  // The backwards heuristic would compute argBase = R3-2+1 = R2 (the temp), not R1.
  const result = compileAndRun(`
    function add(a, b) { return a + b; }
    add(10, 1 + 2)
  `);
  assertEquals(result.type, JSValueType.NUMBER);
  assertEquals(result.value, 13);  // add(10, 3) = 13, NOT add(1, 3) = 4
});

Deno.test("bytecode ops - CALL with multiple expression args", () => {
  // Both args are expressions, creating multiple intermediate registers
  const result = compileAndRun(`
    function sub(a, b) { return a - b; }
    sub(10 + 5, 3 + 1)
  `);
  assertEquals(result.type, JSValueType.NUMBER);
  assertEquals(result.value, 11);  // sub(15, 4) = 11
});

// ============================================================================
// Instruction budget tests
// ============================================================================

import { assertThrows } from "@std/assert";

Deno.test("bytecode ops - instruction budget prevents infinite loops", () => {
  const compiler = new V8Compiler();
  const compiled = compiler.compile("while (true) { }");
  const interpreter = new IgnitionInterpreter();
  interpreter.setMaxInstructions(1000);
  assertThrows(
    () => interpreter.execute(compiled.bytecode, compiled.constantPool),
    Error,
    "Script exceeded instruction budget",
  );
});

Deno.test("bytecode ops - instruction budget allows normal programs", () => {
  const interpreter = new IgnitionInterpreter();
  interpreter.setMaxInstructions(100_000);
  const compiler = new V8Compiler();
  const compiled = compiler.compile(
    "var sum = 0; for (var i = 0; i < 100; i = i + 1) { sum = sum + i; } sum",
  );
  const result = interpreter.execute(compiled.bytecode, compiled.constantPool);
  assertEquals(result.type, JSValueType.NUMBER);
  assertEquals(result.value, 4950);
});

Deno.test("bytecode ops - getMaxInstructions returns current budget", () => {
  const interpreter = new IgnitionInterpreter();
  assertEquals(interpreter.getMaxInstructions(), 10_000_000);
  interpreter.setMaxInstructions(500);
  assertEquals(interpreter.getMaxInstructions(), 500);
});
