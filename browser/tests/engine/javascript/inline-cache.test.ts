import { assertEquals } from "@std/assert";
import { V8Compiler } from "../../../src/engine/javascript/V8Compiler.ts";
import { IgnitionInterpreter } from "../../../src/engine/javascript/IgnitionInterpreter.ts";

function compileAndRun(
  source: string,
): {
  result: import("../../../src/engine/javascript/JSValue.ts").JSValue;
  interp: IgnitionInterpreter;
} {
  const compiler = new V8Compiler();
  const compiled = compiler.compile(source);
  const interp = new IgnitionInterpreter();
  const result = interp.executeFunction(compiled);
  return { result, interp };
}

Deno.test("InlineCache - property access uses cache on repeated access", () => {
  const { result, interp } = compileAndRun(`
        var obj = { x: 42 };
        var sum = 0;
        for (var i = 0; i < 100; i = i + 1) {
            sum = sum + obj.x;
        }
        sum;
    `);
  assertEquals(result.value, 4200);
  const stats = interp.getCacheStats();
  assertEquals(stats.hits > 0, true, "Should have cache hits after repeated access");
});

Deno.test("InlineCache - cache invalidated when property is set", () => {
  const { result, interp } = compileAndRun(`
        var obj = { x: 1 };
        var a = obj.x;
        obj.x = 99;
        var b = obj.x;
        b;
    `);
  assertEquals(result.value, 99);
  const stats = interp.getCacheStats();
  // After SET_PROPERTY invalidation, subsequent GET should miss
  assertEquals(stats.misses >= 2, true, "Should have misses after invalidation");
});

Deno.test("InlineCache - different objects don't share cache entries", () => {
  const { result, interp } = compileAndRun(`
        var a = { x: 10 };
        var b = { x: 20 };
        var r1 = a.x;
        var r2 = b.x;
        r1 + r2;
    `);
  assertEquals(result.value, 30);
  const stats = interp.getCacheStats();
  // Both accesses at same bytecode offset but different objects => at least one miss per
  assertEquals(stats.misses >= 2, true, "Different objects should cause cache misses");
});

Deno.test("InlineCache - stats reflect hits and misses accurately", () => {
  const { result, interp } = compileAndRun(`
        var obj = { val: 5 };
        var total = 0;
        for (var i = 0; i < 10; i = i + 1) {
            total = total + obj.val;
        }
        total;
    `);
  assertEquals(result.value, 50);
  const stats = interp.getCacheStats();
  // First access = miss, remaining 9 = hits
  assertEquals(stats.hits, 9);
  assertEquals(stats.misses, 1);
});

Deno.test("InlineCache - getCacheStats returns zero on fresh interpreter", () => {
  const interp = new IgnitionInterpreter();
  const stats = interp.getCacheStats();
  assertEquals(stats.hits, 0);
  assertEquals(stats.misses, 0);
});

Deno.test("InlineCache - reset clears cache stats", () => {
  const { interp } = compileAndRun(`
        var obj = { x: 1 };
        var a = obj.x;
        var b = obj.x;
        b;
    `);
  const before = interp.getCacheStats();
  assertEquals(before.hits > 0 || before.misses > 0, true);
  interp.reset();
  const after = interp.getCacheStats();
  assertEquals(after.hits, 0);
  assertEquals(after.misses, 0);
});
