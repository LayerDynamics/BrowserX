/**
 * ExecutionContext and ExecutionContextManager Tests
 */

import { assertEquals, assert } from "@std/assert";
import { ExecutionContext, ExecutionContextManager } from "../../executor/execution-context.ts";

Deno.test("ExecutionContext - constructor", () => {
  const ctx = new ExecutionContext();
  assert(ctx instanceof ExecutionContext);
});

Deno.test("ExecutionContext - setVariable and getVariable", () => {
  const ctx = new ExecutionContext();
  ctx.setVariable("x", 42);
  assertEquals(ctx.getVariable("x"), 42);
});

Deno.test("ExecutionContext - hasVariable", () => {
  const ctx = new ExecutionContext();
  assertEquals(ctx.hasVariable("x"), false);
  ctx.setVariable("x", 1);
  assertEquals(ctx.hasVariable("x"), true);
});

Deno.test("ExecutionContext - getVariable returns undefined for missing", () => {
  const ctx = new ExecutionContext();
  assertEquals(ctx.getVariable("missing"), undefined);
});

Deno.test("ExecutionContext - getAllVariables", () => {
  const ctx = new ExecutionContext();
  ctx.setVariable("a", 1);
  ctx.setVariable("b", "two");
  const all = ctx.getAllVariables();
  assertEquals(all.a, 1);
  assertEquals(all.b, "two");
});

Deno.test("ExecutionContext - clear removes all variables", () => {
  const ctx = new ExecutionContext();
  ctx.setVariable("x", 1);
  ctx.clear();
  assertEquals(ctx.hasVariable("x"), false);
});

Deno.test("ExecutionContext - getExecutionTime returns non-negative", () => {
  const ctx = new ExecutionContext();
  assert(ctx.getExecutionTime() >= 0);
});

Deno.test("ExecutionContext - clone creates independent copy", () => {
  const ctx = new ExecutionContext();
  ctx.setVariable("x", 42);
  const cloned = ctx.clone();
  assertEquals(cloned.getVariable("x"), 42);
  cloned.setVariable("x", 99);
  assertEquals(ctx.getVariable("x"), 42);
});

Deno.test("ExecutionContextManager - constructor", () => {
  const mgr = new ExecutionContextManager();
  assert(mgr instanceof ExecutionContextManager);
});

Deno.test("ExecutionContextManager - createContext and getContext", () => {
  const mgr = new ExecutionContextManager();
  const ctx = mgr.createContext("c1");
  assert(ctx instanceof ExecutionContext);
  assertEquals(mgr.getContext("c1"), ctx);
});

Deno.test("ExecutionContextManager - getCurrentContext", () => {
  const mgr = new ExecutionContextManager();
  assertEquals(mgr.getCurrentContext(), undefined);
  const ctx = mgr.createContext("c1");
  assertEquals(mgr.getCurrentContext(), ctx);
});

Deno.test("ExecutionContextManager - removeContext", () => {
  const mgr = new ExecutionContextManager();
  mgr.createContext("c1");
  assertEquals(mgr.removeContext("c1"), true);
  assertEquals(mgr.getContext("c1"), undefined);
});

Deno.test("ExecutionContextManager - clearAll", () => {
  const mgr = new ExecutionContextManager();
  mgr.createContext("c1");
  mgr.createContext("c2");
  mgr.clearAll();
  assertEquals(mgr.getContext("c1"), undefined);
  assertEquals(mgr.getCurrentContext(), undefined);
});

Deno.test("ExecutionContextManager - removeContext returns false for missing", () => {
  const mgr = new ExecutionContextManager();
  assertEquals(mgr.removeContext("missing"), false);
});
