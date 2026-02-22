/**
 * DependencyResolver Tests
 */

import { assertEquals, assert } from "@std/assert";
import { DependencyResolver } from "../../planner/dependency-resolver.ts";

Deno.test("DependencyResolver - constructor", () => {
  const dr = new DependencyResolver();
  assertEquals(dr.size(), 0);
});

Deno.test("DependencyResolver - addDependency and size", () => {
  const dr = new DependencyResolver();
  dr.addDependency("a", [], ["x"]);
  assertEquals(dr.size(), 1);
});

Deno.test("DependencyResolver - getDependencies", () => {
  const dr = new DependencyResolver();
  dr.addDependency("a", [], ["x"]);
  const dep = dr.getDependencies("a");
  assert(dep !== undefined);
  assertEquals(dep!.id, "a");
  assert(dep!.provides.has("x"));
});

Deno.test("DependencyResolver - hasProvider and getProvider", () => {
  const dr = new DependencyResolver();
  dr.addDependency("a", [], ["x"]);
  assertEquals(dr.hasProvider("x"), true);
  assertEquals(dr.getProvider("x"), "a");
  assertEquals(dr.hasProvider("y"), false);
});

Deno.test("DependencyResolver - resolve with no dependencies", () => {
  const dr = new DependencyResolver();
  dr.addDependency("a", [], []);
  dr.addDependency("b", [], []);
  const result = dr.resolve();
  assertEquals(result.ordered.length, 2);
  assertEquals(result.cycles.length, 0);
  assertEquals(result.unresolved.length, 0);
});

Deno.test("DependencyResolver - resolve respects order", () => {
  const dr = new DependencyResolver();
  dr.addDependency("a", [], ["x"]);
  dr.addDependency("b", ["a"], []);
  const result = dr.resolve();
  const aIdx = result.ordered.indexOf("a");
  const bIdx = result.ordered.indexOf("b");
  assert(aIdx < bIdx);
});

Deno.test("DependencyResolver - resolve detects unresolved", () => {
  const dr = new DependencyResolver();
  dr.addDependency("a", ["missing"], []);
  const result = dr.resolve();
  assert(result.unresolved.includes("missing"));
});

Deno.test("DependencyResolver - clear resets state", () => {
  const dr = new DependencyResolver();
  dr.addDependency("a", [], ["x"]);
  dr.clear();
  assertEquals(dr.size(), 0);
  assertEquals(dr.hasProvider("x"), false);
});

Deno.test("DependencyResolver - multiple providers", () => {
  const dr = new DependencyResolver();
  dr.addDependency("a", [], ["x"]);
  dr.addDependency("b", [], ["y"]);
  dr.addDependency("c", ["a", "b"], []);
  const result = dr.resolve();
  const cIdx = result.ordered.indexOf("c");
  const aIdx = result.ordered.indexOf("a");
  const bIdx = result.ordered.indexOf("b");
  assert(aIdx < cIdx);
  assert(bIdx < cIdx);
});

Deno.test("DependencyResolver - getDependencies returns undefined for missing", () => {
  const dr = new DependencyResolver();
  assertEquals(dr.getDependencies("missing"), undefined);
});

Deno.test("DependencyResolver - getProvider returns undefined for missing", () => {
  const dr = new DependencyResolver();
  assertEquals(dr.getProvider("missing"), undefined);
});
