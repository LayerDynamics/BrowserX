// @ts-nocheck - JSValue discriminated union requires casting for .value access in tests
import { assertEquals, assertThrows } from "@std/assert";
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
  const interpreter = new IgnitionInterpreter();
  return interpreter.execute(compiled.bytecode, compiled.constantPool);
}

// ============================================================================
// TRY/CATCH/THROW tests
// ============================================================================

Deno.test("try/catch - catches thrown string", () => {
  const result = compileAndRun(`
    var result = 0;
    try {
      throw "error";
    } catch (e) {
      result = 1;
    }
    result
  `);
  assertEquals(result.type, JSValueType.NUMBER);
  assertEquals(result.value, 1);
});

Deno.test("try/catch - catch parameter receives thrown value", () => {
  const result = compileAndRun(`
    var msg = "";
    try {
      throw "hello";
    } catch (e) {
      msg = e;
    }
    msg
  `);
  assertEquals(result.type, JSValueType.STRING);
  assertEquals(result.value, "hello");
});

Deno.test("try/catch - finally block executes", () => {
  const result = compileAndRun(`
    var x = 0;
    try {
      x = 1;
    } finally {
      x = 2;
    }
    x
  `);
  assertEquals(result.type, JSValueType.NUMBER);
  assertEquals(result.value, 2);
});

Deno.test("try/catch - finally runs after catch", () => {
  const result = compileAndRun(`
    var x = 0;
    try {
      throw "err";
    } catch (e) {
      x = 1;
    } finally {
      x = x + 10;
    }
    x
  `);
  assertEquals(result.type, JSValueType.NUMBER);
  assertEquals(result.value, 11);
});

Deno.test("try/catch - no exception skips catch", () => {
  const result = compileAndRun(`
    var x = 0;
    try {
      x = 5;
    } catch (e) {
      x = 99;
    }
    x
  `);
  assertEquals(result.type, JSValueType.NUMBER);
  assertEquals(result.value, 5);
});

// ============================================================================
// TYPEOF tests
// ============================================================================

Deno.test("typeof - number", () => {
  const result = compileAndRun("typeof 42");
  assertEquals(result.type, JSValueType.STRING);
  assertEquals(result.value, "number");
});

Deno.test("typeof - string", () => {
  const result = compileAndRun('typeof "hello"');
  assertEquals(result.type, JSValueType.STRING);
  assertEquals(result.value, "string");
});

Deno.test("typeof - boolean", () => {
  const result = compileAndRun("typeof true");
  assertEquals(result.type, JSValueType.STRING);
  assertEquals(result.value, "boolean");
});

Deno.test("typeof - undefined", () => {
  const result = compileAndRun("typeof undefined");
  assertEquals(result.type, JSValueType.STRING);
  assertEquals(result.value, "undefined");
});

Deno.test("typeof - null is object", () => {
  const result = compileAndRun("typeof null");
  assertEquals(result.type, JSValueType.STRING);
  assertEquals(result.value, "object");
});

Deno.test("typeof - object", () => {
  const result = compileAndRun("typeof {}");
  assertEquals(result.type, JSValueType.STRING);
  assertEquals(result.value, "object");
});

Deno.test("typeof - function", () => {
  const result = compileAndRun("typeof function() {}");
  assertEquals(result.type, JSValueType.STRING);
  assertEquals(result.value, "function");
});

// ============================================================================
// SWITCH/CASE tests
// ============================================================================

Deno.test("switch - matches case", () => {
  const result = compileAndRun(`
    var x = 2;
    var result = 0;
    switch (x) {
      case 1:
        result = 10;
        break;
      case 2:
        result = 20;
        break;
      case 3:
        result = 30;
        break;
    }
    result
  `);
  assertEquals(result.type, JSValueType.NUMBER);
  assertEquals(result.value, 20);
});

Deno.test("switch - default case", () => {
  const result = compileAndRun(`
    var x = 99;
    var result = 0;
    switch (x) {
      case 1:
        result = 10;
        break;
      default:
        result = -1;
        break;
    }
    result
  `);
  assertEquals(result.type, JSValueType.NUMBER);
  assertEquals(result.value, -1);
});

// ============================================================================
// DO...WHILE tests
// ============================================================================

Deno.test("do-while - executes at least once", () => {
  const result = compileAndRun(`
    var x = 0;
    do {
      x = x + 1;
    } while (false);
    x
  `);
  assertEquals(result.type, JSValueType.NUMBER);
  assertEquals(result.value, 1);
});

Deno.test("do-while - loops correctly", () => {
  const result = compileAndRun(`
    var x = 0;
    do {
      x = x + 1;
    } while (x < 5);
    x
  `);
  assertEquals(result.type, JSValueType.NUMBER);
  assertEquals(result.value, 5);
});

// ============================================================================
// CLASS tests
// ============================================================================

Deno.test("class - basic class declaration", () => {
  const result = compileAndRun(`
    class Foo {
      constructor() {
        this.x = 42;
      }
    }
    var f = new Foo();
    f.x
  `);
  assertEquals(result.type, JSValueType.NUMBER);
  assertEquals(result.value, 42);
});

Deno.test("class - method on prototype returns this property", () => {
  const result = compileAndRun(`
    class Greeter {
      constructor() {
        this.name = "world";
      }
      greet() {
        return this.name;
      }
    }
    var g = new Greeter();
    g.greet()
  `);
  // Method should access this.name via the receiver binding
  assertEquals(result.type, JSValueType.STRING);
  assertEquals(result.value, "world");
});

Deno.test("class - static method", () => {
  const result = compileAndRun(`
    class MathHelper {
      static double(x) {
        return x * 2;
      }
    }
    MathHelper.double(21)
  `);
  assertEquals(result.type, JSValueType.NUMBER);
  assertEquals(result.value, 42);
});
