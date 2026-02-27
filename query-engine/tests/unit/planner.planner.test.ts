/**
 * Planner Tests
 * Comprehensive tests for ExecutionPlanner class
 */

import { assertEquals, assertExists, assert, assertThrows } from "@std/assert";
import { ExecutionPlanner, Planner } from "../../planner/planner.ts";
import {
  ExecutionPlan,
  ExecutionStepType,
  NavigateStep,
  DOMQueryStep,
  AssignStep,
  LoopStep,
  BranchStep,
  TypeStep,
  EvaluateJSStep,
  ReadVariableStep,
  FilterStep,
  SortStep,
  LimitStep,
} from "../../planner/plan.ts";
import {
  SelectStatement,
  NavigateStatement,
  SetStatement,
  ForStatement,
  IfStatement,
  InsertStatement,
  UpdateStatement,
  DeleteStatement,
  ShowStatement,
  Literal,
  Identifier,
  BinaryExpression,
  CallExpression,
  UnaryExpression,
  MemberExpression,
  ArrayExpression,
  ObjectExpression,
  Field,
} from "../../types/ast.ts";
import { DataType } from "../../types/primitives.ts";

// ============================================================================
// Constructor Tests
// ============================================================================

Deno.test({
  name: "ExecutionPlanner - constructor creates planner with initial state",
  fn() {
    const planner = new ExecutionPlanner();
    assertExists(planner);
    assertEquals(planner.getStepCounter(), 0);
    assertEquals(planner.getCurrentSteps().length, 0);
    assertExists(planner.getDependencyGraphBuilder());
  },
});

Deno.test({
  name: "ExecutionPlanner - Planner alias works correctly",
  fn() {
    const planner = new Planner();
    assertExists(planner);
    assertEquals(planner.getStepCounter(), 0);
  },
});

// ============================================================================
// Accessor Methods Tests
// ============================================================================

Deno.test({
  name: "ExecutionPlanner - getDependencyGraphBuilder returns builder",
  fn() {
    const planner = new ExecutionPlanner();
    const builder = planner.getDependencyGraphBuilder();
    assertExists(builder);
    // Check builder has expected methods
    assert(typeof builder.build === "function");
    assert(typeof builder.findParallelGroups === "function");
    assert(typeof builder.topologicalSort === "function");
    assert(typeof builder.hasCycles === "function");
    assert(typeof builder.getCriticalPath === "function");
  },
});

Deno.test({
  name: "ExecutionPlanner - getStepCounter returns current counter",
  fn() {
    const planner = new ExecutionPlanner();
    assertEquals(planner.getStepCounter(), 0);
  },
});

Deno.test({
  name: "ExecutionPlanner - getCurrentSteps returns copy of steps",
  fn() {
    const planner = new ExecutionPlanner();
    const steps = planner.getCurrentSteps();
    assertEquals(steps.length, 0);
    assert(Array.isArray(steps));
  },
});

// ============================================================================
// SELECT Statement Planning Tests
// ============================================================================

Deno.test({
  name: "ExecutionPlanner - plan SELECT with URL source",
  fn() {
    const planner = new ExecutionPlanner();

    const selectStmt: SelectStatement = {
      type: "SELECT",
      fields: [
        { name: "title", alias: undefined, expression: undefined },
      ],
      source: {
        type: "URL",
        value: "https://example.com",
      },
      where: undefined,
      orderBy: undefined,
      limit: undefined,
    };

    const plan = planner.plan(selectStmt);

    assertExists(plan);
    assertExists(plan.id);
    assert(plan.id.startsWith("plan_"));
    assertEquals(plan.query, selectStmt);
    assert(plan.steps.length >= 2); // At least NAVIGATE and DOM_QUERY

    // First step should be NAVIGATE
    const navStep = plan.steps[0] as NavigateStep;
    assertEquals(navStep.type, ExecutionStepType.NAVIGATE);
    assertEquals(navStep.url, "https://example.com");
    assertEquals(navStep.cacheable, true);
    assert(navStep.cacheKey?.startsWith("nav:"));

    // Second step should be DOM_QUERY
    const domStep = plan.steps[1] as DOMQueryStep;
    assertEquals(domStep.type, ExecutionStepType.DOM_QUERY);
    assert(domStep.dependencies.includes(navStep.id));
  },
});

Deno.test({
  name: "ExecutionPlanner - plan SELECT with WHERE clause",
  fn() {
    const planner = new ExecutionPlanner();

    const selectStmt: SelectStatement = {
      type: "SELECT",
      fields: [
        { name: "title", alias: undefined, expression: undefined },
      ],
      source: {
        type: "URL",
        value: "https://example.com",
      },
      where: {
        type: "BINARY",
        operator: ">",
        left: { type: "IDENTIFIER", name: "price" },
        right: { type: "LITERAL", value: 100, dataType: DataType.NUMBER },
      } as BinaryExpression,
      orderBy: undefined,
      limit: undefined,
    };

    const plan = planner.plan(selectStmt);

    // Should have FILTER step
    const filterStep = plan.steps.find((s) => s.type === ExecutionStepType.FILTER) as FilterStep;
    assertExists(filterStep);
    assertExists(filterStep.predicate);
    assertEquals(filterStep.inputVariable, "__query_result");
    assertEquals(filterStep.outputVariable, "__filtered_result");
  },
});

Deno.test({
  name: "ExecutionPlanner - plan SELECT with ORDER BY",
  fn() {
    const planner = new ExecutionPlanner();

    const selectStmt: SelectStatement = {
      type: "SELECT",
      fields: [
        { name: "title", alias: undefined, expression: undefined },
      ],
      source: {
        type: "URL",
        value: "https://example.com",
      },
      where: undefined,
      orderBy: [
        { field: "price", direction: "DESC" },
      ],
      limit: undefined,
    };

    const plan = planner.plan(selectStmt);

    // Should have SORT step
    const sortStep = plan.steps.find((s) => s.type === ExecutionStepType.SORT) as SortStep;
    assertExists(sortStep);
    assertEquals(sortStep.fields.length, 1);
    assertEquals(sortStep.fields[0].field, "price");
    assertEquals(sortStep.fields[0].direction, "DESC");
    assertEquals(sortStep.inputVariable, "__filtered_result");
    assertEquals(sortStep.outputVariable, "__sorted_result");
  },
});

Deno.test({
  name: "ExecutionPlanner - plan SELECT with LIMIT",
  fn() {
    const planner = new ExecutionPlanner();

    const selectStmt: SelectStatement = {
      type: "SELECT",
      fields: [
        { name: "title", alias: undefined, expression: undefined },
      ],
      source: {
        type: "URL",
        value: "https://example.com",
      },
      where: undefined,
      orderBy: undefined,
      limit: { count: 10, offset: 5 },
    };

    const plan = planner.plan(selectStmt);

    // Should have LIMIT step
    const limitStep = plan.steps.find((s) => s.type === ExecutionStepType.LIMIT) as LimitStep;
    assertExists(limitStep);
    assertEquals(limitStep.limit, 10);
    assertEquals(limitStep.offset, 5);
    assertEquals(limitStep.inputVariable, "__sorted_result");
    assertEquals(limitStep.outputVariable, "__final_result");
  },
});

Deno.test({
  name: "ExecutionPlanner - plan SELECT with SUBQUERY source",
  fn() {
    const planner = new ExecutionPlanner();

    const innerSelect: SelectStatement = {
      type: "SELECT",
      fields: [{ name: "id", alias: undefined, expression: undefined }],
      source: { type: "URL", value: "https://example.com" },
      where: undefined,
      orderBy: undefined,
      limit: undefined,
    };

    const selectStmt: SelectStatement = {
      type: "SELECT",
      fields: [{ name: "title", alias: undefined, expression: undefined }],
      source: {
        type: "SUBQUERY",
        value: innerSelect,
      },
      where: undefined,
      orderBy: undefined,
      limit: undefined,
    };

    const plan = planner.plan(selectStmt);

    assertExists(plan);
    // Should have steps for both inner and outer queries
    assert(plan.steps.length >= 3);
  },
});

Deno.test({
  name: "ExecutionPlanner - plan SELECT extracts selector from URL fragment",
  fn() {
    const planner = new ExecutionPlanner();

    const selectStmt: SelectStatement = {
      type: "SELECT",
      fields: [{ name: "title", alias: undefined, expression: undefined }],
      source: {
        type: "URL",
        value: "https://example.com#.article",
      },
      where: undefined,
      orderBy: undefined,
      limit: undefined,
    };

    const plan = planner.plan(selectStmt);

    const domStep = plan.steps.find((s) => s.type === ExecutionStepType.DOM_QUERY) as DOMQueryStep;
    assertExists(domStep);
    assertEquals(domStep.selector, ".article");
  },
});

Deno.test({
  name: "ExecutionPlanner - plan SELECT with field alias",
  fn() {
    const planner = new ExecutionPlanner();

    const selectStmt: SelectStatement = {
      type: "SELECT",
      fields: [
        { name: "title", alias: "pageTitle", expression: undefined },
        { name: "description", alias: "desc", expression: undefined },
      ],
      source: {
        type: "URL",
        value: "https://example.com",
      },
      where: undefined,
      orderBy: undefined,
      limit: undefined,
    };

    const plan = planner.plan(selectStmt);

    const domStep = plan.steps.find((s) => s.type === ExecutionStepType.DOM_QUERY) as DOMQueryStep;
    assertExists(domStep);
    assertEquals(domStep.extractFields.length, 2);
    assertEquals(domStep.extractFields[0].name, "pageTitle");
    assertEquals(domStep.extractFields[1].name, "desc");
  },
});

// ============================================================================
// NAVIGATE Statement Planning Tests
// ============================================================================

Deno.test({
  name: "ExecutionPlanner - plan NAVIGATE basic",
  fn() {
    const planner = new ExecutionPlanner();

    const navigateStmt: NavigateStatement = {
      type: "NAVIGATE",
      url: {
        type: "LITERAL",
        value: "https://example.com",
        dataType: DataType.STRING,
      } as Literal,
      options: undefined,
      capture: undefined,
    };

    const plan = planner.plan(navigateStmt);

    assertExists(plan);
    assertEquals(plan.steps.length, 1);

    const navStep = plan.steps[0] as NavigateStep;
    assertEquals(navStep.type, ExecutionStepType.NAVIGATE);
    assertEquals(navStep.url, "https://example.com");
    assertEquals(navStep.cacheable, true);
  },
});

Deno.test({
  name: "ExecutionPlanner - plan NAVIGATE with options",
  fn() {
    const planner = new ExecutionPlanner();

    const navigateStmt: NavigateStatement = {
      type: "NAVIGATE",
      url: {
        type: "LITERAL",
        value: "https://example.com",
        dataType: DataType.STRING,
      } as Literal,
      options: {
        waitUntil: "networkidle",
        timeout: 5000,
        proxy: {
          cache: true,
        },
      },
      capture: undefined,
    };

    const plan = planner.plan(navigateStmt);

    const navStep = plan.steps[0] as NavigateStep;
    assertExists(navStep.options);
    assertEquals(navStep.options?.waitFor, "networkidle");
    assertEquals(navStep.options?.timeout, 5000);
    assertEquals(navStep.options?.proxy?.cache, true);
  },
});

Deno.test({
  name: "ExecutionPlanner - plan NAVIGATE with CAPTURE clause",
  fn() {
    const planner = new ExecutionPlanner();

    const navigateStmt: NavigateStatement = {
      type: "NAVIGATE",
      url: {
        type: "LITERAL",
        value: "https://example.com",
        dataType: DataType.STRING,
      } as Literal,
      options: undefined,
      capture: {
        fields: [
          { name: "title", alias: undefined, expression: undefined },
          { name: "body", alias: undefined, expression: undefined },
        ],
      },
    };

    const plan = planner.plan(navigateStmt);

    // Should have NAVIGATE and DOM_QUERY steps
    assertEquals(plan.steps.length, 2);

    const navStep = plan.steps[0] as NavigateStep;
    assertEquals(navStep.type, ExecutionStepType.NAVIGATE);

    const domStep = plan.steps[1] as DOMQueryStep;
    assertEquals(domStep.type, ExecutionStepType.DOM_QUERY);
    assertEquals(domStep.extractFields.length, 2);
    assert(domStep.dependencies.includes(navStep.id));
  },
});

// ============================================================================
// SET Statement Planning Tests
// ============================================================================

Deno.test({
  name: "ExecutionPlanner - plan SET statement",
  fn() {
    const planner = new ExecutionPlanner();

    const setStmt: SetStatement = {
      type: "SET",
      path: ["config", "timeout"],
      value: {
        type: "LITERAL",
        value: 5000,
        dataType: DataType.NUMBER,
      } as Literal,
    };

    const plan = planner.plan(setStmt);

    assertExists(plan);
    assertEquals(plan.steps.length, 1);

    const assignStep = plan.steps[0] as AssignStep;
    assertEquals(assignStep.type, ExecutionStepType.ASSIGN);
    assertEquals(assignStep.variable, "config.timeout");
    assertExists(assignStep.value);
    assertEquals(assignStep.cacheable, false);
  },
});

Deno.test({
  name: "ExecutionPlanner - plan SET with single path element",
  fn() {
    const planner = new ExecutionPlanner();

    const setStmt: SetStatement = {
      type: "SET",
      path: ["proxy"],
      value: {
        type: "LITERAL",
        value: true,
        dataType: DataType.BOOLEAN,
      } as Literal,
    };

    const plan = planner.plan(setStmt);

    const assignStep = plan.steps[0] as AssignStep;
    assertEquals(assignStep.variable, "proxy");
  },
});

// ============================================================================
// FOR Statement Planning Tests
// ============================================================================

Deno.test({
  name: "ExecutionPlanner - plan FOR statement",
  fn() {
    const planner = new ExecutionPlanner();

    const forStmt: ForStatement = {
      type: "FOR",
      variable: "item",
      collection: {
        type: "IDENTIFIER",
        name: "items",
      } as Identifier,
      body: {
        type: "SET",
        path: ["processed"],
        value: {
          type: "IDENTIFIER",
          name: "item",
        } as Identifier,
      } as SetStatement,
    };

    const plan = planner.plan(forStmt);

    assertExists(plan);
    assertEquals(plan.steps.length, 1);

    const loopStep = plan.steps[0] as LoopStep;
    assertEquals(loopStep.type, ExecutionStepType.LOOP);
    assertEquals(loopStep.iteratorVariable, "item");
    assertEquals(loopStep.collectionVariable, "__collection");
    assertExists(loopStep.bodySteps);
    assert(loopStep.bodySteps.length > 0);
    assertEquals(loopStep.parallel, false);
  },
});

Deno.test({
  name: "ExecutionPlanner - plan FOR with nested NAVIGATE body",
  fn() {
    const planner = new ExecutionPlanner();

    const forStmt: ForStatement = {
      type: "FOR",
      variable: "url",
      collection: {
        type: "IDENTIFIER",
        name: "urls",
      } as Identifier,
      body: {
        type: "NAVIGATE",
        url: {
          type: "IDENTIFIER",
          name: "url",
        } as Identifier,
        options: undefined,
        capture: undefined,
      } as NavigateStatement,
    };

    const plan = planner.plan(forStmt);

    const loopStep = plan.steps[0] as LoopStep;
    // Body should contain NAVIGATE step
    assert(loopStep.bodySteps.some((s) => s.type === ExecutionStepType.NAVIGATE));
    // Estimated cost should be multiplied by assumed iterations (10)
    assert(loopStep.estimatedCost > 0);
  },
});

// ============================================================================
// IF Statement Planning Tests
// ============================================================================

Deno.test({
  name: "ExecutionPlanner - plan IF statement with then branch only",
  fn() {
    const planner = new ExecutionPlanner();

    const ifStmt: IfStatement = {
      type: "IF",
      condition: {
        type: "BINARY",
        operator: ">",
        left: { type: "IDENTIFIER", name: "count" },
        right: { type: "LITERAL", value: 0, dataType: DataType.NUMBER },
      } as BinaryExpression,
      then: {
        type: "SET",
        path: ["hasItems"],
        value: { type: "LITERAL", value: true, dataType: DataType.BOOLEAN },
      } as SetStatement,
      else: undefined,
    };

    const plan = planner.plan(ifStmt);

    assertExists(plan);
    assertEquals(plan.steps.length, 1);

    const branchStep = plan.steps[0] as BranchStep;
    assertEquals(branchStep.type, ExecutionStepType.BRANCH);
    assertExists(branchStep.condition);
    assertExists(branchStep.thenSteps);
    assert(branchStep.thenSteps.length > 0);
    assertEquals(branchStep.elseSteps, undefined);
  },
});

Deno.test({
  name: "ExecutionPlanner - plan IF statement with then and else branches",
  fn() {
    const planner = new ExecutionPlanner();

    const ifStmt: IfStatement = {
      type: "IF",
      condition: {
        type: "BINARY",
        operator: "=",
        left: { type: "IDENTIFIER", name: "status" },
        right: { type: "LITERAL", value: "ok", dataType: DataType.STRING },
      } as BinaryExpression,
      then: {
        type: "SET",
        path: ["success"],
        value: { type: "LITERAL", value: true, dataType: DataType.BOOLEAN },
      } as SetStatement,
      else: {
        type: "SET",
        path: ["success"],
        value: { type: "LITERAL", value: false, dataType: DataType.BOOLEAN },
      } as SetStatement,
    };

    const plan = planner.plan(ifStmt);

    const branchStep = plan.steps[0] as BranchStep;
    assertExists(branchStep.thenSteps);
    assertExists(branchStep.elseSteps);
    assert(branchStep.elseSteps.length > 0);
    // Estimated cost is average of both branches
    assert(branchStep.estimatedCost > 0);
  },
});

// ============================================================================
// INSERT Statement Planning Tests
// ============================================================================

Deno.test({
  name: "ExecutionPlanner - plan INSERT statement",
  fn() {
    const planner = new ExecutionPlanner();

    const insertStmt: InsertStatement = {
      type: "INSERT",
      value: {
        type: "LITERAL",
        value: "user@example.com",
        dataType: DataType.STRING,
      } as Literal,
      target: {
        type: "LITERAL",
        value: "#email",
        dataType: DataType.STRING,
      } as Literal,
    };

    const plan = planner.plan(insertStmt);

    assertExists(plan);
    assertEquals(plan.steps.length, 1);

    const typeStep = plan.steps[0] as TypeStep;
    assertEquals(typeStep.type, ExecutionStepType.TYPE);
    assertEquals(typeStep.text, "user@example.com");
    assertEquals(typeStep.selectorType, "css");
    assertEquals(typeStep.delay, 50);
    assertEquals(typeStep.clear, false);
  },
});

Deno.test({
  name: "ExecutionPlanner - plan INSERT with non-literal value",
  fn() {
    const planner = new ExecutionPlanner();

    const insertStmt: InsertStatement = {
      type: "INSERT",
      value: {
        type: "IDENTIFIER",
        name: "username",
      } as Identifier,
      target: {
        type: "LITERAL",
        value: "#name",
        dataType: DataType.STRING,
      } as Literal,
    };

    const plan = planner.plan(insertStmt);

    const typeStep = plan.steps[0] as TypeStep;
    // Non-literal value should result in empty string
    assertEquals(typeStep.text, "");
  },
});

// ============================================================================
// UPDATE Statement Planning Tests
// ============================================================================

Deno.test({
  name: "ExecutionPlanner - plan UPDATE statement",
  fn() {
    const planner = new ExecutionPlanner();

    const updateStmt: UpdateStatement = {
      type: "UPDATE",
      target: {
        type: "LITERAL",
        value: "#button",
        dataType: DataType.STRING,
      } as Literal,
      assignments: [
        {
          property: "disabled",
          value: { type: "LITERAL", value: true, dataType: DataType.BOOLEAN } as Literal,
        },
      ],
    };

    const plan = planner.plan(updateStmt);

    assertExists(plan);
    assertEquals(plan.steps.length, 1);

    const evalStep = plan.steps[0] as EvaluateJSStep;
    assertEquals(evalStep.type, ExecutionStepType.EVALUATE_JS);
    assertExists(evalStep.script);
    assert(evalStep.script.includes("querySelectorAll"));
  },
});

Deno.test({
  name: "ExecutionPlanner - plan UPDATE with multiple assignments",
  fn() {
    const planner = new ExecutionPlanner();

    const updateStmt: UpdateStatement = {
      type: "UPDATE",
      target: {
        type: "LITERAL",
        value: ".form-input",
        dataType: DataType.STRING,
      } as Literal,
      assignments: [
        {
          property: "disabled",
          value: { type: "LITERAL", value: false, dataType: DataType.BOOLEAN } as Literal,
        },
        {
          property: "value",
          value: { type: "LITERAL", value: "default", dataType: DataType.STRING } as Literal,
        },
      ],
    };

    const plan = planner.plan(updateStmt);

    // Should have one EVALUATE_JS step per assignment
    assertEquals(plan.steps.length, 2);
    assert(plan.steps.every((s) => s.type === ExecutionStepType.EVALUATE_JS));
  },
});

// ============================================================================
// DELETE Statement Planning Tests
// ============================================================================

Deno.test({
  name: "ExecutionPlanner - plan DELETE statement",
  fn() {
    const planner = new ExecutionPlanner();

    const deleteStmt: DeleteStatement = {
      type: "DELETE",
      target: {
        type: "LITERAL",
        value: ".ad-banner",
        dataType: DataType.STRING,
      } as Literal,
    };

    const plan = planner.plan(deleteStmt);

    assertExists(plan);
    assertEquals(plan.steps.length, 1);

    const evalStep = plan.steps[0] as EvaluateJSStep;
    assertEquals(evalStep.type, ExecutionStepType.EVALUATE_JS);
    assert(evalStep.script.includes("querySelectorAll"));
    assert(evalStep.script.includes("remove()"));
  },
});

// ============================================================================
// SHOW Statement Planning Tests
// ============================================================================

Deno.test({
  name: "ExecutionPlanner - plan SHOW CACHE statement",
  fn() {
    const planner = new ExecutionPlanner();

    const showStmt: ShowStatement = {
      type: "SHOW",
      target: "CACHE",
      where: undefined,
    };

    const plan = planner.plan(showStmt);

    assertExists(plan);
    assertEquals(plan.steps.length, 1);

    const readStep = plan.steps[0] as ReadVariableStep;
    assertEquals(readStep.type, ExecutionStepType.READ_VARIABLE);
    assertEquals(readStep.variable, "__state_cache");
    assertEquals(readStep.outputVariable, "__show_cache_result");
  },
});

Deno.test({
  name: "ExecutionPlanner - plan SHOW COOKIES statement",
  fn() {
    const planner = new ExecutionPlanner();

    const showStmt: ShowStatement = {
      type: "SHOW",
      target: "COOKIES",
      where: undefined,
    };

    const plan = planner.plan(showStmt);

    const readStep = plan.steps[0] as ReadVariableStep;
    assertEquals(readStep.variable, "__state_cookies");
    assertEquals(readStep.outputVariable, "__show_cookies_result");
  },
});

Deno.test({
  name: "ExecutionPlanner - plan SHOW STATE statement",
  fn() {
    const planner = new ExecutionPlanner();

    const showStmt: ShowStatement = {
      type: "SHOW",
      target: "STATE",
      where: undefined,
    };

    const plan = planner.plan(showStmt);

    const readStep = plan.steps[0] as ReadVariableStep;
    assertEquals(readStep.variable, "__state_state");
    assertEquals(readStep.outputVariable, "__show_state_result");
  },
});

// ============================================================================
// Plan Metadata Tests
// ============================================================================

Deno.test({
  name: "ExecutionPlanner - plan includes default metadata",
  fn() {
    const planner = new ExecutionPlanner();

    const stmt: SetStatement = {
      type: "SET",
      path: ["test"],
      value: { type: "LITERAL", value: 1, dataType: DataType.NUMBER } as Literal,
    };

    const plan = planner.plan(stmt);

    assertExists(plan.metadata);
    assertEquals(plan.metadata.optimizationApplied, false);
    assertEquals(plan.metadata.appliedPasses.length, 0);
    assertEquals(plan.metadata.estimatedImprovement, 0);
  },
});

Deno.test({
  name: "ExecutionPlanner - plan accepts custom metadata",
  fn() {
    const planner = new ExecutionPlanner();

    const stmt: SetStatement = {
      type: "SET",
      path: ["test"],
      value: { type: "LITERAL", value: 1, dataType: DataType.NUMBER } as Literal,
    };

    const plan = planner.plan(stmt, {
      optimizationApplied: true,
      appliedPasses: ["ConstantFolding", "DeadCodeElimination"],
      estimatedImprovement: 0.25,
    });

    assertEquals(plan.metadata.optimizationApplied, true);
    assertEquals(plan.metadata.appliedPasses.length, 2);
    assertEquals(plan.metadata.estimatedImprovement, 0.25);
  },
});

// ============================================================================
// Resource Requirements Tests
// ============================================================================

Deno.test({
  name: "ExecutionPlanner - calculates resource requirements for NAVIGATE",
  fn() {
    const planner = new ExecutionPlanner();

    const navigateStmt: NavigateStatement = {
      type: "NAVIGATE",
      url: { type: "LITERAL", value: "https://example.com", dataType: DataType.STRING } as Literal,
      options: undefined,
      capture: undefined,
    };

    const plan = planner.plan(navigateStmt);

    assertEquals(plan.resources.browsers, 1);
    assertEquals(plan.resources.pages, 1);
    assertEquals(plan.resources.connections, 1);
    assert(plan.resources.memory >= 100);
    assert(plan.resources.cpu >= 30);
  },
});

Deno.test({
  name: "ExecutionPlanner - calculates resource requirements for SELECT",
  fn() {
    const planner = new ExecutionPlanner();

    const selectStmt: SelectStatement = {
      type: "SELECT",
      fields: [{ name: "title", alias: undefined, expression: undefined }],
      source: { type: "URL", value: "https://example.com" },
      where: undefined,
      orderBy: undefined,
      limit: undefined,
    };

    const plan = planner.plan(selectStmt);

    // SELECT with URL source includes navigation
    assertEquals(plan.resources.browsers, 1);
    assertEquals(plan.resources.pages, 1);
    assert(plan.resources.cpu >= 20);
  },
});

// ============================================================================
// Dependency Graph Tests
// ============================================================================

Deno.test({
  name: "ExecutionPlanner - builds correct dependency graph",
  fn() {
    const planner = new ExecutionPlanner();

    const selectStmt: SelectStatement = {
      type: "SELECT",
      fields: [{ name: "title", alias: undefined, expression: undefined }],
      source: { type: "URL", value: "https://example.com" },
      where: undefined,
      orderBy: undefined,
      limit: undefined,
    };

    const plan = planner.plan(selectStmt);

    assertExists(plan.dependencies);
    assertExists(plan.dependencies.nodes);
    assertExists(plan.dependencies.roots);
    assertExists(plan.dependencies.leaves);

    // First step (NAVIGATE) should be a root
    assert(plan.dependencies.roots.length >= 1);
    // Last step should be a leaf
    assert(plan.dependencies.leaves.length >= 1);
  },
});

Deno.test({
  name: "ExecutionPlanner - identifies cacheable steps",
  fn() {
    const planner = new ExecutionPlanner();

    const selectStmt: SelectStatement = {
      type: "SELECT",
      fields: [{ name: "title", alias: undefined, expression: undefined }],
      source: { type: "URL", value: "https://example.com" },
      where: undefined,
      orderBy: undefined,
      limit: undefined,
    };

    const plan = planner.plan(selectStmt);

    assertExists(plan.cacheableSteps);
    // NAVIGATE step should be cacheable
    assert(plan.cacheableSteps.length >= 1);

    const cacheableStep = plan.steps.find((s) => plan.cacheableSteps.includes(s.id));
    assertExists(cacheableStep);
    assertEquals(cacheableStep.cacheable, true);
  },
});

Deno.test({
  name: "ExecutionPlanner - identifies parallel groups",
  fn() {
    const planner = new ExecutionPlanner();

    const selectStmt: SelectStatement = {
      type: "SELECT",
      fields: [{ name: "title", alias: undefined, expression: undefined }],
      source: { type: "URL", value: "https://example.com" },
      where: undefined,
      orderBy: undefined,
      limit: undefined,
    };

    const plan = planner.plan(selectStmt);

    assertExists(plan.parallelGroups);
    // parallelGroups is an array of arrays
    assert(Array.isArray(plan.parallelGroups));
  },
});

// ============================================================================
// Plan State Reset Tests
// ============================================================================

Deno.test({
  name: "ExecutionPlanner - resets state between plan calls",
  fn() {
    const planner = new ExecutionPlanner();

    const stmt1: SetStatement = {
      type: "SET",
      path: ["var1"],
      value: { type: "LITERAL", value: 1, dataType: DataType.NUMBER } as Literal,
    };

    const stmt2: SetStatement = {
      type: "SET",
      path: ["var2"],
      value: { type: "LITERAL", value: 2, dataType: DataType.NUMBER } as Literal,
    };

    const plan1 = planner.plan(stmt1);
    const plan2 = planner.plan(stmt2);

    // Each plan should have independent steps
    assertEquals(plan1.steps.length, 1);
    assertEquals(plan2.steps.length, 1);

    // Step IDs should start from 1 for each plan
    assertEquals(plan1.steps[0].id, "step_1");
    assertEquals(plan2.steps[0].id, "step_1");

    // Plan IDs should be unique
    assert(plan1.id !== plan2.id);
  },
});

// ============================================================================
// Estimated Cost Tests
// ============================================================================

Deno.test({
  name: "ExecutionPlanner - estimates cost correctly",
  fn() {
    const planner = new ExecutionPlanner();

    const selectStmt: SelectStatement = {
      type: "SELECT",
      fields: [{ name: "title", alias: undefined, expression: undefined }],
      source: { type: "URL", value: "https://example.com" },
      where: undefined,
      orderBy: undefined,
      limit: undefined,
    };

    const plan = planner.plan(selectStmt);

    // Estimated cost should be positive
    assert(plan.estimatedCost > 0);
    // NAVIGATE alone should cost ~500ms
    assert(plan.estimatedCost >= 500);
  },
});

Deno.test({
  name: "ExecutionPlanner - costs add up for multiple steps",
  fn() {
    const planner = new ExecutionPlanner();

    const selectStmt: SelectStatement = {
      type: "SELECT",
      fields: [{ name: "title", alias: undefined, expression: undefined }],
      source: { type: "URL", value: "https://example.com" },
      where: {
        type: "BINARY",
        operator: ">",
        left: { type: "IDENTIFIER", name: "x" },
        right: { type: "LITERAL", value: 0, dataType: DataType.NUMBER },
      } as BinaryExpression,
      orderBy: [{ field: "title", direction: "ASC" }],
      limit: { count: 10, offset: 0 },
    };

    const plan = planner.plan(selectStmt);

    // Multiple steps should have higher estimated cost
    assert(plan.estimatedCost > 500);
    // Sum of individual step costs
    const totalStepCost = plan.steps.reduce((sum, s) => sum + s.estimatedCost, 0);
    assert(totalStepCost > 0);
  },
});

// ============================================================================
// Step ID Generation Tests
// ============================================================================

Deno.test({
  name: "ExecutionPlanner - generates unique step IDs",
  fn() {
    const planner = new ExecutionPlanner();

    const selectStmt: SelectStatement = {
      type: "SELECT",
      fields: [{ name: "title", alias: undefined, expression: undefined }],
      source: { type: "URL", value: "https://example.com" },
      where: {
        type: "BINARY",
        operator: ">",
        left: { type: "IDENTIFIER", name: "x" },
        right: { type: "LITERAL", value: 0, dataType: DataType.NUMBER },
      } as BinaryExpression,
      orderBy: [{ field: "title", direction: "ASC" }],
      limit: { count: 10, offset: 0 },
    };

    const plan = planner.plan(selectStmt);

    const stepIds = plan.steps.map((s) => s.id);
    const uniqueIds = new Set(stepIds);

    // All step IDs should be unique
    assertEquals(stepIds.length, uniqueIds.size);

    // All step IDs should follow pattern
    for (const id of stepIds) {
      assert(id.startsWith("step_"));
    }
  },
});

Deno.test({
  name: "ExecutionPlanner - generates unique plan IDs",
  fn() {
    const planner = new ExecutionPlanner();

    const stmt: SetStatement = {
      type: "SET",
      path: ["test"],
      value: { type: "LITERAL", value: 1, dataType: DataType.NUMBER } as Literal,
    };

    const plan1 = planner.plan(stmt);
    const plan2 = planner.plan(stmt);
    const plan3 = planner.plan(stmt);

    // All plan IDs should be unique
    const planIds = [plan1.id, plan2.id, plan3.id];
    const uniqueIds = new Set(planIds);
    assertEquals(planIds.length, uniqueIds.size);

    // Plan IDs should follow pattern
    for (const id of planIds) {
      assert(id.startsWith("plan_"));
    }
  },
});

// ============================================================================
// Selector Extraction Tests
// ============================================================================

Deno.test({
  name: "ExecutionPlanner - extracts selector from css: field prefix",
  fn() {
    const planner = new ExecutionPlanner();

    const selectStmt: SelectStatement = {
      type: "SELECT",
      fields: [{ name: "css:.article-title", alias: "title", expression: undefined }],
      source: { type: "URL", value: "https://example.com" },
      where: undefined,
      orderBy: undefined,
      limit: undefined,
    };

    const plan = planner.plan(selectStmt);

    const domStep = plan.steps.find((s) => s.type === ExecutionStepType.DOM_QUERY) as DOMQueryStep;
    assertExists(domStep);
    assertEquals(domStep.selector, ".article-title");
  },
});

Deno.test({
  name: "ExecutionPlanner - extracts selector from xpath: field prefix",
  fn() {
    const planner = new ExecutionPlanner();

    const selectStmt: SelectStatement = {
      type: "SELECT",
      fields: [{ name: "xpath://div[@class='content']", alias: "content", expression: undefined }],
      source: { type: "URL", value: "https://example.com" },
      where: undefined,
      orderBy: undefined,
      limit: undefined,
    };

    const plan = planner.plan(selectStmt);

    const domStep = plan.steps.find((s) => s.type === ExecutionStepType.DOM_QUERY) as DOMQueryStep;
    assertExists(domStep);
    assertEquals(domStep.selector, "//div[@class='content']");
  },
});

Deno.test({
  name: "ExecutionPlanner - extracts selector from WHERE clause",
  fn() {
    const planner = new ExecutionPlanner();

    const selectStmt: SelectStatement = {
      type: "SELECT",
      fields: [{ name: "title", alias: undefined, expression: undefined }],
      source: { type: "URL", value: "https://example.com" },
      where: {
        type: "BINARY",
        operator: "=",
        left: { type: "IDENTIFIER", name: "selector" },
        right: { type: "LITERAL", value: "#main-content", dataType: DataType.STRING },
      } as BinaryExpression,
      orderBy: undefined,
      limit: undefined,
    };

    const plan = planner.plan(selectStmt);

    const domStep = plan.steps.find((s) => s.type === ExecutionStepType.DOM_QUERY) as DOMQueryStep;
    assertExists(domStep);
    assertEquals(domStep.selector, "#main-content");
  },
});

Deno.test({
  name: "ExecutionPlanner - defaults to body selector when no hint",
  fn() {
    const planner = new ExecutionPlanner();

    const selectStmt: SelectStatement = {
      type: "SELECT",
      fields: [{ name: "data", alias: undefined, expression: undefined }],
      source: { type: "URL", value: "https://example.com" },
      where: undefined,
      orderBy: undefined,
      limit: undefined,
    };

    const plan = planner.plan(selectStmt);

    const domStep = plan.steps.find((s) => s.type === ExecutionStepType.DOM_QUERY) as DOMQueryStep;
    assertExists(domStep);
    assertEquals(domStep.selector, "body");
  },
});

// ============================================================================
// Field Expression Tests
// ============================================================================

Deno.test({
  name: "ExecutionPlanner - handles field with expression",
  fn() {
    const planner = new ExecutionPlanner();

    const selectStmt: SelectStatement = {
      type: "SELECT",
      fields: [
        {
          name: "computedValue",
          alias: "result",
          expression: {
            type: "BINARY",
            operator: "+",
            left: { type: "IDENTIFIER", name: "a" },
            right: { type: "LITERAL", value: 10, dataType: DataType.NUMBER },
          } as BinaryExpression,
        },
      ],
      source: { type: "URL", value: "https://example.com" },
      where: undefined,
      orderBy: undefined,
      limit: undefined,
    };

    const plan = planner.plan(selectStmt);

    const domStep = plan.steps.find((s) => s.type === ExecutionStepType.DOM_QUERY) as DOMQueryStep;
    assertExists(domStep);
    assertEquals(domStep.extractFields[0].name, "result");
    assertExists(domStep.extractFields[0].expression);
  },
});

// ============================================================================
// Unknown Statement Type Tests
// ============================================================================

Deno.test({
  name: "ExecutionPlanner - handles unknown statement type gracefully",
  fn() {
    const planner = new ExecutionPlanner();

    // Create a statement with an unknown type
    const unknownStmt = {
      type: "UNKNOWN_TYPE",
    } as unknown as SetStatement;

    const plan = planner.plan(unknownStmt);

    // Should still create a plan, just with no steps
    assertExists(plan);
    assertEquals(plan.steps.length, 0);
  },
});

// ============================================================================
// CSS Selector Field Pattern Tests
// ============================================================================

Deno.test({
  name: "ExecutionPlanner - extracts selector from CSS class pattern in field name",
  fn() {
    const planner = new ExecutionPlanner();

    const selectStmt: SelectStatement = {
      type: "SELECT",
      fields: [
        {
          name: "content",
          alias: undefined,
          expression: { type: "IDENTIFIER", name: ".article" } as Identifier,
        },
      ],
      source: { type: "URL", value: "https://example.com" },
      where: undefined,
      orderBy: undefined,
      limit: undefined,
    };

    const plan = planner.plan(selectStmt);

    const domStep = plan.steps.find((s) => s.type === ExecutionStepType.DOM_QUERY) as DOMQueryStep;
    assertExists(domStep);
    assertEquals(domStep.selector, ".article");
  },
});

Deno.test({
  name: "ExecutionPlanner - extracts selector from CSS ID pattern",
  fn() {
    const planner = new ExecutionPlanner();

    const selectStmt: SelectStatement = {
      type: "SELECT",
      fields: [
        {
          name: "content",
          alias: undefined,
          expression: { type: "IDENTIFIER", name: "#main" } as Identifier,
        },
      ],
      source: { type: "URL", value: "https://example.com" },
      where: undefined,
      orderBy: undefined,
      limit: undefined,
    };

    const plan = planner.plan(selectStmt);

    const domStep = plan.steps.find((s) => s.type === ExecutionStepType.DOM_QUERY) as DOMQueryStep;
    assertEquals(domStep.selector, "#main");
  },
});

Deno.test({
  name: "ExecutionPlanner - extracts selector from descendant combinator pattern",
  fn() {
    const planner = new ExecutionPlanner();

    const selectStmt: SelectStatement = {
      type: "SELECT",
      fields: [
        {
          name: "content",
          alias: undefined,
          expression: { type: "IDENTIFIER", name: "div > p" } as Identifier,
        },
      ],
      source: { type: "URL", value: "https://example.com" },
      where: undefined,
      orderBy: undefined,
      limit: undefined,
    };

    const plan = planner.plan(selectStmt);

    const domStep = plan.steps.find((s) => s.type === ExecutionStepType.DOM_QUERY) as DOMQueryStep;
    assertEquals(domStep.selector, "div > p");
  },
});

// ============================================================================
// MATCHES Injection Prevention Tests
// ============================================================================

Deno.test({
  name: "ExecutionPlanner - MATCHES with non-literal RHS wraps value safely to prevent injection",
  fn() {
    const planner = new ExecutionPlanner();
    // deno-lint-ignore no-explicit-any
    const compile = (planner as any).expressionToJavaScript.bind(planner);

    // Non-literal MATCHES: RHS is an IDENTIFIER (dynamic value)
    const expr: BinaryExpression = {
      type: "BINARY",
      operator: "MATCHES",
      left: { type: "IDENTIFIER", name: "name" } as Identifier,
      right: { type: "IDENTIFIER", name: "pattern" } as Identifier,
    };

    const result: string = compile(expr);

    // Should use the safe IIFE wrapper pattern that evaluates RHS as a value
    assert(result.includes("try"), "Non-literal MATCHES should use try/catch wrapper");
    assert(result.includes("String(v)"), "Non-literal MATCHES should convert value via String(v)");
    assert(result.includes("catch"), "Non-literal MATCHES should catch invalid regex");
    // Should NOT directly embed the variable as a RegExp argument without wrapping
    assert(!result.includes("new RegExp(pattern)"), "Should not embed RHS directly into RegExp constructor");
  },
});

Deno.test({
  name: "ExecutionPlanner - MATCHES with literal RHS uses JSON.stringify safely",
  fn() {
    const planner = new ExecutionPlanner();
    // deno-lint-ignore no-explicit-any
    const compile = (planner as any).expressionToJavaScript.bind(planner);

    const expr: BinaryExpression = {
      type: "BINARY",
      operator: "MATCHES",
      left: { type: "IDENTIFIER", name: "title" } as Identifier,
      right: { type: "LITERAL", value: "^hello.*", dataType: DataType.STRING } as Literal,
    };

    const result: string = compile(expr);

    // Literal path should use JSON.stringify for safe embedding
    assert(result.includes("new RegExp"), "Should use RegExp");
    assert(result.includes('"^hello.*"'), "Literal pattern should be JSON-stringified");
    // Should NOT have the IIFE wrapper since it's the literal path
    assert(!result.includes("try"), "Literal MATCHES should not need try/catch");
  },
});

Deno.test({
  name: "ExecutionPlanner - MATCHES non-literal returns false for invalid regex instead of throwing",
  fn() {
    const planner = new ExecutionPlanner();
    // deno-lint-ignore no-explicit-any
    const compile = (planner as any).expressionToJavaScript.bind(planner);

    const expr: BinaryExpression = {
      type: "BINARY",
      operator: "MATCHES",
      left: { type: "LITERAL", value: "test", dataType: DataType.STRING } as Literal,
      right: { type: "IDENTIFIER", name: "userInput" } as Identifier,
    };

    const result: string = compile(expr);

    // The generated code should gracefully handle invalid regex via catch returning false
    assert(result.includes("return false"), "Should return false on invalid regex");

    // Verify the generated JS is valid and evaluates correctly
    // Simulate: userInput = "[invalid" (unclosed bracket = invalid regex)
    const testFn = new Function("userInput", `return ${result}`);
    assertEquals(testFn("[invalid"), false, "Invalid regex should return false, not throw");

    // Simulate: userInput = "^test$" (valid regex that matches)
    assertEquals(testFn("^test$"), true, "Valid matching regex should return true");

    // Simulate: userInput = "^nomatch$" (valid regex that doesn't match)
    assertEquals(testFn("^nomatch$"), false, "Valid non-matching regex should return false");
  },
});
