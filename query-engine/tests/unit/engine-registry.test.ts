/**
 * QueryEngine.getFunctionRegistry() Unit Tests
 *
 * Tests that the QueryEngine exposes its function registry
 * for runtime registration/unregistration of custom functions.
 */

import { assertEquals, assertExists } from "@std/assert";
import { QueryEngine } from "../../core/engine.ts";
import { globalRegistry } from "../../schema/registry.ts";

Deno.test("QueryEngine - getFunctionRegistry returns the global registry", () => {
  const engine = new QueryEngine();
  const registry = engine.getFunctionRegistry();

  assertExists(registry);
  assertEquals(registry, globalRegistry);
});

Deno.test("QueryEngine - getFunctionRegistry has register method", () => {
  const engine = new QueryEngine();
  const registry = engine.getFunctionRegistry();

  assertEquals(typeof registry.register, "function");
});

Deno.test("QueryEngine - getFunctionRegistry has unregister method", () => {
  const engine = new QueryEngine();
  const registry = engine.getFunctionRegistry();

  assertEquals(typeof registry.unregister, "function");
});

Deno.test("QueryEngine - getFunctionRegistry has has method", () => {
  const engine = new QueryEngine();
  const registry = engine.getFunctionRegistry();

  assertEquals(typeof registry.has, "function");
});
