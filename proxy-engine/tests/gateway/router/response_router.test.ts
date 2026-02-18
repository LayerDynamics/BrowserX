/**
 * ResponseRouter Tests
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import { ResponseRouter, type ResponseRule } from "../../../gateway/router/response_router.ts";

// ============================================================================
// Construction
// ============================================================================

Deno.test({
  name: "ResponseRouter - constructs with empty rules",
  fn() {
    const router = new ResponseRouter();
    assertExists(router);
    assertEquals(router.getRules().length, 0);
  },
});

// ============================================================================
// ResponseRule interface
// ============================================================================

Deno.test({
  name: "ResponseRule - interface has id, pattern, transform, priority fields",
  fn() {
    const rule: ResponseRule = { id: "r1", pattern: "/api", transform: (r) => r, priority: 10 };
    assertEquals(rule.id, "r1");
    assertEquals(rule.pattern, "/api");
    assertEquals(rule.priority, 10);
    assert(typeof rule.transform === "function");
  },
});

// ============================================================================
// addRule()
// ============================================================================

Deno.test({
  name: "ResponseRouter - addRule() adds a rule",
  fn() {
    const router = new ResponseRouter();
    router.addRule({ id: "r1", pattern: "/api", transform: (r) => r, priority: 0 });
    assertEquals(router.getRules().length, 1);
  },
});

Deno.test({
  name: "ResponseRouter - addRule() sorts rules by priority descending",
  fn() {
    const router = new ResponseRouter();
    router.addRule({ id: "low", pattern: "/api", transform: (r) => r, priority: 1 });
    router.addRule({ id: "high", pattern: "/api", transform: (r) => r, priority: 100 });
    const rules = router.getRules();
    assertEquals(rules[0].id, "high");
    assertEquals(rules[1].id, "low");
  },
});

Deno.test({
  name: "ResponseRouter - addRule() maintains priority order across 3 additions",
  fn() {
    const router = new ResponseRouter();
    router.addRule({ id: "r3", pattern: "/", transform: (r) => r, priority: 5 });
    router.addRule({ id: "r1", pattern: "/", transform: (r) => r, priority: 100 });
    router.addRule({ id: "r2", pattern: "/", transform: (r) => r, priority: 50 });
    const rules = router.getRules();
    assertEquals(rules[0].id, "r1");
    assertEquals(rules[1].id, "r2");
    assertEquals(rules[2].id, "r3");
  },
});

// ============================================================================
// removeRule()
// ============================================================================

Deno.test({
  name: "ResponseRouter - removeRule() returns true and removes rule",
  fn() {
    const router = new ResponseRouter();
    router.addRule({ id: "r1", pattern: "/api", transform: (r) => r, priority: 0 });
    const result = router.removeRule("r1");
    assert(result === true);
    assertEquals(router.getRules().length, 0);
  },
});

Deno.test({
  name: "ResponseRouter - removeRule() returns false for missing rule",
  fn() {
    const router = new ResponseRouter();
    assert(router.removeRule("non-existent") === false);
  },
});

// ============================================================================
// matchRules()
// ============================================================================

Deno.test({
  name: "ResponseRouter - matchRules() returns empty array with no rules",
  fn() {
    const router = new ResponseRouter();
    assertEquals(router.matchRules("/api/data").length, 0);
  },
});

Deno.test({
  name: "ResponseRouter - matchRules() matches string inclusion pattern",
  fn() {
    const router = new ResponseRouter();
    router.addRule({ id: "r1", pattern: "/api", transform: (r) => r, priority: 0 });
    const matched = router.matchRules("/api/users");
    assertEquals(matched.length, 1);
    assertEquals(matched[0].id, "r1");
  },
});

Deno.test({
  name: "ResponseRouter - matchRules() does not match non-matching string",
  fn() {
    const router = new ResponseRouter();
    router.addRule({ id: "r1", pattern: "/api", transform: (r) => r, priority: 0 });
    assertEquals(router.matchRules("/home").length, 0);
  },
});

Deno.test({
  name: "ResponseRouter - matchRules() matches RegExp pattern",
  fn() {
    const router = new ResponseRouter();
    router.addRule({ id: "r1", pattern: /^\/api\/v\d+/, transform: (r) => r, priority: 0 });
    const matched = router.matchRules("/api/v2/users");
    assertEquals(matched.length, 1);
    assertEquals(matched[0].id, "r1");
  },
});

Deno.test({
  name: "ResponseRouter - matchRules() returns multiple matching rules",
  fn() {
    const router = new ResponseRouter();
    router.addRule({ id: "r1", pattern: "/api", transform: (r) => r, priority: 10 });
    router.addRule({ id: "r2", pattern: "/api/users", transform: (r) => r, priority: 5 });
    assertEquals(router.matchRules("/api/users").length, 2);
  },
});

// ============================================================================
// transform()
// ============================================================================

Deno.test({
  name: "ResponseRouter - transform() returns response unchanged with no matching rules",
  fn() {
    const router = new ResponseRouter();
    const result = router.transform("/home", { status: 200 });
    assertEquals(result, { status: 200 });
  },
});

Deno.test({
  name: "ResponseRouter - transform() applies transform function",
  fn() {
    const router = new ResponseRouter();
    router.addRule({
      id: "r1",
      pattern: "/api",
      transform: (res) => ({ ...(res as Record<string, unknown>), transformed: true }),
      priority: 0,
    });
    const result = router.transform("/api/data", { status: 200 }) as Record<string, unknown>;
    assertEquals(result.transformed, true);
    assertEquals(result.status, 200);
  },
});

Deno.test({
  name: "ResponseRouter - transform() applies rules in priority order (highest first)",
  fn() {
    const router = new ResponseRouter();
    const order: number[] = [];
    router.addRule({ id: "low", pattern: "/api", transform: (res) => { order.push(2); return res; }, priority: 1 });
    router.addRule({ id: "high", pattern: "/api", transform: (res) => { order.push(1); return res; }, priority: 100 });
    router.transform("/api/data", {});
    assertEquals(order, [1, 2]);
  },
});

// ============================================================================
// clear()
// ============================================================================

Deno.test({
  name: "ResponseRouter - clear() removes all rules",
  fn() {
    const router = new ResponseRouter();
    router.addRule({ id: "r1", pattern: "/api", transform: (r) => r, priority: 0 });
    router.addRule({ id: "r2", pattern: "/home", transform: (r) => r, priority: 1 });
    router.clear();
    assertEquals(router.getRules().length, 0);
  },
});
