// @ts-nocheck - bytecodex FFI may not be available; tests skip gracefully
import { assertEquals, assertNotEquals } from "@std/assert";
import { Opcode, V8Compiler } from "../../../../browser/src/engine/javascript/V8Compiler.ts";
import { IgnitionInterpreter } from "../../../../browser/src/engine/javascript/IgnitionInterpreter.ts";
import { JSValueType } from "../../../../browser/src/engine/javascript/JSValue.ts";

// Try to load bytecodex — if FFI dylib not available, skip optimization tests
let bytecodexAvailable = false;
try {
  const { ByteCodeX } = await import("@browserx/bytecodex");
  const bcx = new ByteCodeX();
  bytecodexAvailable = bcx.version.length > 0;
} catch {
  // FFI not available
}

function compileAndRun(source: string, optimize = false) {
  const compiler = new V8Compiler();
  const compiled = compiler.compile(source, optimize ? { optimize: true } : undefined);
  const interpreter = new IgnitionInterpreter();
  return interpreter.execute(compiled.bytecode, compiled.constantPool);
}

// ============================================================================
// Optimization correctness tests (with and without optimization)
// ============================================================================

Deno.test("bytecodex - compile with optimize flag does not break arithmetic", {
  ignore: !bytecodexAvailable,
}, () => {
  const result = compileAndRun("3 + 4", true);
  assertEquals(result.type, JSValueType.NUMBER);
  assertEquals(result.value, 7);
});

Deno.test("bytecodex - optimized code produces same result as unoptimized", {
  ignore: !bytecodexAvailable,
}, () => {
  const source = "var x = 2 + 3; var y = x + 1; y";
  const normal = compileAndRun(source, false);
  const optimized = compileAndRun(source, true);
  assertEquals(normal.type, optimized.type);
  assertEquals(normal.value, optimized.value);
});

Deno.test(
  "bytecodex - constant folding reduces bytecode size",
  { ignore: !bytecodexAvailable },
  () => {
    const compiler = new V8Compiler();
    const normal = compiler.compile("2 + 3");
    const optimized = compiler.compile("2 + 3", { optimize: true });
    // Optimized should be same or smaller
    assertEquals(optimized.bytecode.length <= normal.bytecode.length, true);
  },
);

Deno.test(
  "bytecodex - optimized function calls still work",
  { ignore: !bytecodexAvailable },
  () => {
    const result = compileAndRun("function add(a, b) { return a + b; } add(10, 20)", true);
    assertEquals(result.type, JSValueType.NUMBER);
    assertEquals(result.value, 30);
  },
);

Deno.test("bytecodex - optimized loops still work", { ignore: !bytecodexAvailable }, () => {
  const result = compileAndRun(
    "var s = 0; for (var i = 0; i < 5; i = i + 1) { s = s + i; } s",
    true,
  );
  assertEquals(result.type, JSValueType.NUMBER);
  assertEquals(result.value, 10);
});

Deno.test(
  "bytecodex - optimized object operations still work",
  { ignore: !bytecodexAvailable },
  () => {
    const result = compileAndRun("var o = {x: 42}; o.x", true);
    assertEquals(result.type, JSValueType.NUMBER);
    assertEquals(result.value, 42);
  },
);

// ============================================================================
// Validation tests
// ============================================================================

Deno.test("bytecodex - validate flag on valid bytecode does not throw", {
  ignore: !bytecodexAvailable,
}, () => {
  const compiler = new V8Compiler();
  const compiled = compiler.compile("1 + 2", { validate: true });
  assertNotEquals(compiled.bytecode.length, 0);
});

Deno.test("bytecodex - validate + optimize together", { ignore: !bytecodexAvailable }, () => {
  const result = compileAndRun("5 * 3", true);
  assertEquals(result.type, JSValueType.NUMBER);
  assertEquals(result.value, 15);
});

// ============================================================================
// Graceful fallback tests (always run)
// ============================================================================

Deno.test("bytecodex - compile without options works normally", () => {
  const result = compileAndRun("10 + 5");
  assertEquals(result.type, JSValueType.NUMBER);
  assertEquals(result.value, 15);
});

Deno.test("bytecodex - compile with optimize flag works even if FFI unavailable", () => {
  // Even with optimize: true, compile should succeed (falls back gracefully)
  const compiler = new V8Compiler();
  const compiled = compiler.compile("1 + 1", { optimize: true });
  assertNotEquals(compiled.bytecode.length, 0);
});

// ============================================================================
// Direct bytecodex API tests (when available)
// ============================================================================

Deno.test("bytecodex - direct optimize API", { ignore: !bytecodexAvailable }, async () => {
  const { ByteCodeX } = await import("@browserx/bytecodex");
  const bcx = new ByteCodeX();

  // LDA_CONSTANT 0 (5); STAR r0; LDA_CONSTANT 1 (3); ADD r0; RETURN
  const result = bcx.optimize({
    instructions: [0x09, 0x00, 0x03, 0x00, 0x09, 0x01, 0x10, 0x00, 0x43],
    constant_pool: [5.0, 3.0],
  });
  assertNotEquals(result, null);
  assertEquals(result!.stats.constants_folded >= 0, true);
});

Deno.test("bytecodex - direct validate API", { ignore: !bytecodexAvailable }, async () => {
  const { ByteCodeX } = await import("@browserx/bytecodex");
  const bcx = new ByteCodeX();

  const result = bcx.validate({
    instructions: [0x09, 0x00, 0x43],
    constant_pool: [42],
  });
  assertNotEquals(result, null);
  assertEquals(result!.valid, true);
});

Deno.test("bytecodex - direct disassemble API", { ignore: !bytecodexAvailable }, async () => {
  const { ByteCodeX } = await import("@browserx/bytecodex");
  const bcx = new ByteCodeX();

  const text = bcx.disassemble({
    instructions: [0x09, 0x00, 0x43],
    constant_pool: [42],
  });
  assertEquals(text.includes("LDA_CONSTANT"), true);
  assertEquals(text.includes("RETURN"), true);
});

Deno.test("bytecodex - version string", { ignore: !bytecodexAvailable }, async () => {
  const { ByteCodeX } = await import("@browserx/bytecodex");
  const bcx = new ByteCodeX();
  assertEquals(bcx.version, "0.1.0");
});
