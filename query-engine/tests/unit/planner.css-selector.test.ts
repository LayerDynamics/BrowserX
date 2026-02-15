/**
 * Test: FROM clause accepts CSS selectors
 */

import { assertEquals } from "@std/assert";
import { ExecutionPlanner, ExecutionStepType } from "../../planner/mod.ts";

Deno.test("Planner: FROM with CSS class selector creates DOM_QUERY without NAVIGATE", () => {
  const planner = new ExecutionPlanner();

  // Create a minimal SELECT AST with a CSS selector source
  const ast = {
    type: "SELECT" as const,
    fields: [
      { name: "name", expression: { type: "IDENTIFIER" as const, name: "name" } },
    ],
    source: { type: "URL" as const, value: ".product-card" },
  };

  const plan = planner.plan(ast, { optimizationApplied: false, appliedPasses: [], estimatedImprovement: 0 });

  // Should NOT have a NAVIGATE step (it's a selector, not a URL)
  const navSteps = plan.steps.filter((s: any) => s.type === ExecutionStepType.NAVIGATE);
  assertEquals(navSteps.length, 0, "Should not navigate for CSS selector source");

  // Should have a DOM_QUERY step with the CSS selector
  const domSteps = plan.steps.filter((s: any) => s.type === ExecutionStepType.DOM_QUERY);
  assertEquals(domSteps.length, 1, "Should have one DOM_QUERY step");
  assertEquals((domSteps[0] as any).selector, ".product-card", "Should use CSS selector from FROM clause");
});

Deno.test("Planner: FROM with CSS ID selector creates DOM_QUERY without NAVIGATE", () => {
  const planner = new ExecutionPlanner();

  const ast = {
    type: "SELECT" as const,
    fields: [
      { name: "text", expression: { type: "IDENTIFIER" as const, name: "text" } },
    ],
    source: { type: "URL" as const, value: "#main-content" },
  };

  const plan = planner.plan(ast, { optimizationApplied: false, appliedPasses: [], estimatedImprovement: 0 });

  const navSteps = plan.steps.filter((s: any) => s.type === ExecutionStepType.NAVIGATE);
  assertEquals(navSteps.length, 0, "Should not navigate for CSS ID selector");

  const domSteps = plan.steps.filter((s: any) => s.type === ExecutionStepType.DOM_QUERY);
  assertEquals(domSteps.length, 1, "Should have one DOM_QUERY step");
  assertEquals((domSteps[0] as any).selector, "#main-content", "Should use CSS ID selector from FROM clause");
});

Deno.test("Planner: FROM with actual URL still creates NAVIGATE step", () => {
  const planner = new ExecutionPlanner();

  const ast = {
    type: "SELECT" as const,
    fields: [
      { name: "title", expression: { type: "IDENTIFIER" as const, name: "title" } },
    ],
    source: { type: "URL" as const, value: "https://example.com" },
  };

  const plan = planner.plan(ast, { optimizationApplied: false, appliedPasses: [], estimatedImprovement: 0 });

  const navSteps = plan.steps.filter((s: any) => s.type === ExecutionStepType.NAVIGATE);
  assertEquals(navSteps.length, 1, "Should navigate for actual URL");
});
