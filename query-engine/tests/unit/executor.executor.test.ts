/**
 * Executor Tests
 * Comprehensive tests for QueryExecutor class
 */

import { assertEquals, assertExists, assert, assertRejects } from "@std/assert";
import { QueryExecutor, Executor, ExecutionResult } from "../../executor/executor.ts";
import { StateManager } from "../../state/mod.ts";
import {
  ExecutionPlan,
  ExecutionStepType,
  AssignStep,
  FilterStep,
  SortStep,
  LimitStep,
  BranchStep,
  LoopStep,
  MapStep,
  ReduceStep,
  JoinStep,
  ReadVariableStep,
  WriteVariableStep,
  ParallelStep,
  SequentialStep,
  ExecutionContext,
} from "../../planner/plan.ts";
import {
  Literal,
  BinaryExpression,
  Identifier,
} from "../../types/ast.ts";
import { DataType } from "../../types/primitives.ts";

// Helper function to create a state manager with cleanup disabled for tests
function createTestStateManager(): StateManager {
  return new StateManager({
    sessionCleanupInterval: 0,  // Disable session auto-cleanup to prevent interval leaks in tests
    cache: {
      cleanupInterval: 0,  // Disable cache auto-cleanup to prevent interval leaks in tests
    },
  });
}

// Helper function to create an executor with cleanup disabled for tests
function createTestExecutor(): QueryExecutor {
  return new QueryExecutor(undefined, undefined, createTestStateManager());
}

// Helper function to create a simple execution plan
function createSimplePlan(
  steps: any[],
  id: string = "test_plan_1",
): ExecutionPlan {
  return {
    id,
    query: { type: "SET", path: ["test"], value: { type: "LITERAL", value: 1, dataType: DataType.NUMBER } } as any,
    steps,
    estimatedCost: 100,
    resources: {
      browsers: 0,
      pages: 0,
      connections: 0,
      memory: 10,
      cpu: 5,
    },
    dependencies: {
      nodes: new Map(),
      roots: [],
      leaves: [],
    },
    cacheableSteps: [],
    parallelGroups: [],
    metadata: {
      optimizationApplied: false,
      appliedPasses: [],
      estimatedImprovement: 0,
    },
  };
}

// ============================================================================
// Constructor Tests
// ============================================================================

Deno.test({
  name: "QueryExecutor - constructor creates executor with defaults",
  fn() {
    const executor = createTestExecutor();
    assertExists(executor);
    assertEquals(executor.getBrowserController(), undefined);
    assertEquals(executor.getProxyController(), undefined);
    assertExists(executor.getStateManager());
  },
});

Deno.test({
  name: "QueryExecutor - constructor accepts custom state manager",
  fn() {
    const stateManager = createTestStateManager();
    const executor = new QueryExecutor(undefined, undefined, stateManager);
    assertEquals(executor.getStateManager(), stateManager);
  },
});

Deno.test({
  name: "QueryExecutor - Executor alias works correctly",
  fn() {
    const executor = new Executor(undefined, undefined, createTestStateManager());
    assertExists(executor);
    assertExists(executor.getStateManager());
  },
});

// ============================================================================
// Accessor Methods Tests
// ============================================================================

Deno.test({
  name: "QueryExecutor - getStateManager returns state manager",
  fn() {
    const executor = createTestExecutor();
    const stateManager = executor.getStateManager();
    assertExists(stateManager);
  },
});

Deno.test({
  name: "QueryExecutor - getCurrentContextManager is undefined before execute",
  fn() {
    const executor = createTestExecutor();
    assertEquals(executor.getCurrentContextManager(), undefined);
  },
});

// ============================================================================
// ASSIGN Step Tests
// ============================================================================

Deno.test({
  name: "QueryExecutor - executes ASSIGN step with literal value",
  async fn() {
    const executor = createTestExecutor();

    const assignStep: AssignStep = {
      id: "step_1",
      type: ExecutionStepType.ASSIGN,
      variable: "myVar",
      value: { type: "LITERAL", value: 42, dataType: DataType.NUMBER } as Literal,
      estimatedCost: 1,
      dependencies: [],
      cacheable: false,
    };

    const plan = createSimplePlan([assignStep]);
    const result = await executor.execute(plan);

    assertEquals(result.success, true);
    assertEquals(result.data, 42);
    assertExists(result.timing);
    assert(result.timing.totalTime >= 0);
  },
});

Deno.test({
  name: "QueryExecutor - executes ASSIGN step with string value",
  async fn() {
    const executor = createTestExecutor();

    const assignStep: AssignStep = {
      id: "step_1",
      type: ExecutionStepType.ASSIGN,
      variable: "greeting",
      value: { type: "LITERAL", value: "Hello, World!", dataType: DataType.STRING } as Literal,
      estimatedCost: 1,
      dependencies: [],
      cacheable: false,
    };

    const plan = createSimplePlan([assignStep]);
    const result = await executor.execute(plan);

    assertEquals(result.success, true);
    assertEquals(result.data, "Hello, World!");
  },
});

Deno.test({
  name: "QueryExecutor - executes ASSIGN step with boolean value",
  async fn() {
    const executor = createTestExecutor();

    const assignStep: AssignStep = {
      id: "step_1",
      type: ExecutionStepType.ASSIGN,
      variable: "isActive",
      value: { type: "LITERAL", value: true, dataType: DataType.BOOLEAN } as Literal,
      estimatedCost: 1,
      dependencies: [],
      cacheable: false,
    };

    const plan = createSimplePlan([assignStep]);
    const result = await executor.execute(plan);

    assertEquals(result.success, true);
    assertEquals(result.data, true);
  },
});

// ============================================================================
// Multiple Steps Tests
// ============================================================================

Deno.test({
  name: "QueryExecutor - executes multiple ASSIGN steps in order",
  async fn() {
    const executor = createTestExecutor();

    const step1: AssignStep = {
      id: "step_1",
      type: ExecutionStepType.ASSIGN,
      variable: "a",
      value: { type: "LITERAL", value: 10, dataType: DataType.NUMBER } as Literal,
      estimatedCost: 1,
      dependencies: [],
      cacheable: false,
    };

    const step2: AssignStep = {
      id: "step_2",
      type: ExecutionStepType.ASSIGN,
      variable: "b",
      value: { type: "LITERAL", value: 20, dataType: DataType.NUMBER } as Literal,
      estimatedCost: 1,
      dependencies: ["step_1"],
      cacheable: false,
    };

    const plan = createSimplePlan([step1, step2]);
    const result = await executor.execute(plan);

    assertEquals(result.success, true);
    assertEquals(result.stepResults.size, 2);
    assert(result.stepResults.has("step_1"));
    assert(result.stepResults.has("step_2"));
  },
});

// ============================================================================
// FILTER Step Tests
// ============================================================================

Deno.test({
  name: "QueryExecutor - executes FILTER step on array",
  async fn() {
    const executor = createTestExecutor();

    // First assign an array of objects with 'value' property
    // The filter predicate references 'value', so items must be objects with that property
    const assignStep: AssignStep = {
      id: "step_1",
      type: ExecutionStepType.ASSIGN,
      variable: "__input",
      value: {
        type: "ARRAY",
        elements: [
          { type: "OBJECT", properties: [{ key: "value", value: { type: "LITERAL", value: 1, dataType: DataType.NUMBER } }] },
          { type: "OBJECT", properties: [{ key: "value", value: { type: "LITERAL", value: 2, dataType: DataType.NUMBER } }] },
          { type: "OBJECT", properties: [{ key: "value", value: { type: "LITERAL", value: 3, dataType: DataType.NUMBER } }] },
          { type: "OBJECT", properties: [{ key: "value", value: { type: "LITERAL", value: 4, dataType: DataType.NUMBER } }] },
          { type: "OBJECT", properties: [{ key: "value", value: { type: "LITERAL", value: 5, dataType: DataType.NUMBER } }] },
        ],
      } as any,
      estimatedCost: 1,
      dependencies: [],
      cacheable: false,
    };

    // Then filter for values > 2
    const filterStep: FilterStep = {
      id: "step_2",
      type: ExecutionStepType.FILTER,
      predicate: {
        type: "BINARY",
        operator: ">",
        left: { type: "IDENTIFIER", name: "value" },
        right: { type: "LITERAL", value: 2, dataType: DataType.NUMBER },
      } as BinaryExpression,
      inputVariable: "__input",
      outputVariable: "__output",
      estimatedCost: 5,
      dependencies: ["step_1"],
      cacheable: false,
    };

    const plan = createSimplePlan([assignStep, filterStep]);
    const result = await executor.execute(plan);

    assertEquals(result.success, true);
  },
});

// ============================================================================
// SORT Step Tests
// ============================================================================

Deno.test({
  name: "QueryExecutor - executes SORT step ascending",
  async fn() {
    const executor = createTestExecutor();

    // Assign an array
    const assignStep: AssignStep = {
      id: "step_1",
      type: ExecutionStepType.ASSIGN,
      variable: "__input",
      value: {
        type: "ARRAY",
        elements: [
          { type: "LITERAL", value: 3, dataType: DataType.NUMBER },
          { type: "LITERAL", value: 1, dataType: DataType.NUMBER },
          { type: "LITERAL", value: 2, dataType: DataType.NUMBER },
        ],
      } as any,
      estimatedCost: 1,
      dependencies: [],
      cacheable: false,
    };

    // Sort ascending
    const sortStep: SortStep = {
      id: "step_2",
      type: ExecutionStepType.SORT,
      fields: [{ field: "value", direction: "ASC" }],
      inputVariable: "__input",
      outputVariable: "__output",
      estimatedCost: 10,
      dependencies: ["step_1"],
      cacheable: false,
    };

    const plan = createSimplePlan([assignStep, sortStep]);
    const result = await executor.execute(plan);

    assertEquals(result.success, true);
  },
});

Deno.test({
  name: "QueryExecutor - executes SORT step descending",
  async fn() {
    const executor = createTestExecutor();

    const assignStep: AssignStep = {
      id: "step_1",
      type: ExecutionStepType.ASSIGN,
      variable: "__input",
      value: {
        type: "ARRAY",
        elements: [
          { type: "LITERAL", value: 1, dataType: DataType.NUMBER },
          { type: "LITERAL", value: 3, dataType: DataType.NUMBER },
          { type: "LITERAL", value: 2, dataType: DataType.NUMBER },
        ],
      } as any,
      estimatedCost: 1,
      dependencies: [],
      cacheable: false,
    };

    const sortStep: SortStep = {
      id: "step_2",
      type: ExecutionStepType.SORT,
      fields: [{ field: "value", direction: "DESC" }],
      inputVariable: "__input",
      outputVariable: "__output",
      estimatedCost: 10,
      dependencies: ["step_1"],
      cacheable: false,
    };

    const plan = createSimplePlan([assignStep, sortStep]);
    const result = await executor.execute(plan);

    assertEquals(result.success, true);
  },
});

// ============================================================================
// LIMIT Step Tests
// ============================================================================

Deno.test({
  name: "QueryExecutor - executes LIMIT step",
  async fn() {
    const executor = createTestExecutor();

    const assignStep: AssignStep = {
      id: "step_1",
      type: ExecutionStepType.ASSIGN,
      variable: "__input",
      value: {
        type: "ARRAY",
        elements: [
          { type: "LITERAL", value: 1, dataType: DataType.NUMBER },
          { type: "LITERAL", value: 2, dataType: DataType.NUMBER },
          { type: "LITERAL", value: 3, dataType: DataType.NUMBER },
          { type: "LITERAL", value: 4, dataType: DataType.NUMBER },
          { type: "LITERAL", value: 5, dataType: DataType.NUMBER },
        ],
      } as any,
      estimatedCost: 1,
      dependencies: [],
      cacheable: false,
    };

    const limitStep: LimitStep = {
      id: "step_2",
      type: ExecutionStepType.LIMIT,
      limit: 3,
      offset: 0,
      inputVariable: "__input",
      outputVariable: "__output",
      estimatedCost: 1,
      dependencies: ["step_1"],
      cacheable: false,
    };

    const plan = createSimplePlan([assignStep, limitStep]);
    const result = await executor.execute(plan);

    assertEquals(result.success, true);
  },
});

Deno.test({
  name: "QueryExecutor - executes LIMIT step with offset",
  async fn() {
    const executor = createTestExecutor();

    const assignStep: AssignStep = {
      id: "step_1",
      type: ExecutionStepType.ASSIGN,
      variable: "__input",
      value: {
        type: "ARRAY",
        elements: [
          { type: "LITERAL", value: 1, dataType: DataType.NUMBER },
          { type: "LITERAL", value: 2, dataType: DataType.NUMBER },
          { type: "LITERAL", value: 3, dataType: DataType.NUMBER },
          { type: "LITERAL", value: 4, dataType: DataType.NUMBER },
          { type: "LITERAL", value: 5, dataType: DataType.NUMBER },
        ],
      } as any,
      estimatedCost: 1,
      dependencies: [],
      cacheable: false,
    };

    const limitStep: LimitStep = {
      id: "step_2",
      type: ExecutionStepType.LIMIT,
      limit: 2,
      offset: 2,
      inputVariable: "__input",
      outputVariable: "__output",
      estimatedCost: 1,
      dependencies: ["step_1"],
      cacheable: false,
    };

    const plan = createSimplePlan([assignStep, limitStep]);
    const result = await executor.execute(plan);

    assertEquals(result.success, true);
  },
});

// ============================================================================
// BRANCH Step Tests
// ============================================================================

Deno.test({
  name: "QueryExecutor - executes BRANCH step with true condition",
  async fn() {
    const executor = createTestExecutor();

    // Assign a value first
    const assignStep: AssignStep = {
      id: "step_1",
      type: ExecutionStepType.ASSIGN,
      variable: "x",
      value: { type: "LITERAL", value: 10, dataType: DataType.NUMBER } as Literal,
      estimatedCost: 1,
      dependencies: [],
      cacheable: false,
    };

    // Branch based on condition x > 5 (should be true)
    const thenStep: AssignStep = {
      id: "then_1",
      type: ExecutionStepType.ASSIGN,
      variable: "result",
      value: { type: "LITERAL", value: "greater", dataType: DataType.STRING } as Literal,
      estimatedCost: 1,
      dependencies: [],
      cacheable: false,
    };

    const elseStep: AssignStep = {
      id: "else_1",
      type: ExecutionStepType.ASSIGN,
      variable: "result",
      value: { type: "LITERAL", value: "less", dataType: DataType.STRING } as Literal,
      estimatedCost: 1,
      dependencies: [],
      cacheable: false,
    };

    const branchStep: BranchStep = {
      id: "step_2",
      type: ExecutionStepType.BRANCH,
      condition: {
        type: "BINARY",
        operator: ">",
        left: { type: "IDENTIFIER", name: "x" },
        right: { type: "LITERAL", value: 5, dataType: DataType.NUMBER },
      } as BinaryExpression,
      thenSteps: [thenStep],
      elseSteps: [elseStep],
      estimatedCost: 5,
      dependencies: ["step_1"],
      cacheable: false,
    };

    const plan = createSimplePlan([assignStep, branchStep]);
    const result = await executor.execute(plan);

    assertEquals(result.success, true);
    assertEquals(result.data, "greater");
  },
});

Deno.test({
  name: "QueryExecutor - executes BRANCH step with false condition",
  async fn() {
    const executor = createTestExecutor();

    const assignStep: AssignStep = {
      id: "step_1",
      type: ExecutionStepType.ASSIGN,
      variable: "x",
      value: { type: "LITERAL", value: 3, dataType: DataType.NUMBER } as Literal,
      estimatedCost: 1,
      dependencies: [],
      cacheable: false,
    };

    const thenStep: AssignStep = {
      id: "then_1",
      type: ExecutionStepType.ASSIGN,
      variable: "result",
      value: { type: "LITERAL", value: "greater", dataType: DataType.STRING } as Literal,
      estimatedCost: 1,
      dependencies: [],
      cacheable: false,
    };

    const elseStep: AssignStep = {
      id: "else_1",
      type: ExecutionStepType.ASSIGN,
      variable: "result",
      value: { type: "LITERAL", value: "less", dataType: DataType.STRING } as Literal,
      estimatedCost: 1,
      dependencies: [],
      cacheable: false,
    };

    const branchStep: BranchStep = {
      id: "step_2",
      type: ExecutionStepType.BRANCH,
      condition: {
        type: "BINARY",
        operator: ">",
        left: { type: "IDENTIFIER", name: "x" },
        right: { type: "LITERAL", value: 5, dataType: DataType.NUMBER },
      } as BinaryExpression,
      thenSteps: [thenStep],
      elseSteps: [elseStep],
      estimatedCost: 5,
      dependencies: ["step_1"],
      cacheable: false,
    };

    const plan = createSimplePlan([assignStep, branchStep]);
    const result = await executor.execute(plan);

    assertEquals(result.success, true);
    assertEquals(result.data, "less");
  },
});

Deno.test({
  name: "QueryExecutor - executes BRANCH step without else branch",
  async fn() {
    const executor = createTestExecutor();

    const assignStep: AssignStep = {
      id: "step_1",
      type: ExecutionStepType.ASSIGN,
      variable: "x",
      value: { type: "LITERAL", value: 3, dataType: DataType.NUMBER } as Literal,
      estimatedCost: 1,
      dependencies: [],
      cacheable: false,
    };

    const thenStep: AssignStep = {
      id: "then_1",
      type: ExecutionStepType.ASSIGN,
      variable: "result",
      value: { type: "LITERAL", value: "executed", dataType: DataType.STRING } as Literal,
      estimatedCost: 1,
      dependencies: [],
      cacheable: false,
    };

    const branchStep: BranchStep = {
      id: "step_2",
      type: ExecutionStepType.BRANCH,
      condition: {
        type: "BINARY",
        operator: ">",
        left: { type: "IDENTIFIER", name: "x" },
        right: { type: "LITERAL", value: 5, dataType: DataType.NUMBER },
      } as BinaryExpression,
      thenSteps: [thenStep],
      elseSteps: undefined,
      estimatedCost: 5,
      dependencies: ["step_1"],
      cacheable: false,
    };

    const plan = createSimplePlan([assignStep, branchStep]);
    const result = await executor.execute(plan);

    assertEquals(result.success, true);
    // Condition is false and no else branch, so result is null
    assertEquals(result.data, null);
  },
});

// ============================================================================
// LOOP Step Tests
// ============================================================================

Deno.test({
  name: "QueryExecutor - executes LOOP step",
  async fn() {
    const executor = createTestExecutor();

    // Assign a collection
    const assignStep: AssignStep = {
      id: "step_1",
      type: ExecutionStepType.ASSIGN,
      variable: "__collection",
      value: {
        type: "ARRAY",
        elements: [
          { type: "LITERAL", value: 1, dataType: DataType.NUMBER },
          { type: "LITERAL", value: 2, dataType: DataType.NUMBER },
          { type: "LITERAL", value: 3, dataType: DataType.NUMBER },
        ],
      } as any,
      estimatedCost: 1,
      dependencies: [],
      cacheable: false,
    };

    // Loop body assigns a value
    const bodyStep: AssignStep = {
      id: "body_1",
      type: ExecutionStepType.ASSIGN,
      variable: "processed",
      value: { type: "IDENTIFIER", name: "item" } as Identifier,
      estimatedCost: 1,
      dependencies: [],
      cacheable: false,
    };

    const loopStep: LoopStep = {
      id: "step_2",
      type: ExecutionStepType.LOOP,
      iteratorVariable: "item",
      collectionVariable: "__collection",
      bodySteps: [bodyStep],
      estimatedCost: 30,
      dependencies: ["step_1"],
      cacheable: false,
      parallel: false,
    };

    const plan = createSimplePlan([assignStep, loopStep]);
    const result = await executor.execute(plan);

    assertEquals(result.success, true);
    // Loop returns array of results
    assert(Array.isArray(result.data));
  },
});

// ============================================================================
// READ_VARIABLE and WRITE_VARIABLE Step Tests
// ============================================================================

Deno.test({
  name: "QueryExecutor - executes WRITE_VARIABLE and READ_VARIABLE steps",
  async fn() {
    const executor = createTestExecutor();

    // Write a variable
    const writeStep: WriteVariableStep = {
      id: "step_1",
      type: ExecutionStepType.WRITE_VARIABLE,
      variable: "myValue",
      value: { type: "LITERAL", value: "test data", dataType: DataType.STRING } as Literal,
      estimatedCost: 1,
      dependencies: [],
      cacheable: false,
    };

    // Read it back
    const readStep: ReadVariableStep = {
      id: "step_2",
      type: ExecutionStepType.READ_VARIABLE,
      variable: "myValue",
      outputVariable: "readValue",
      estimatedCost: 1,
      dependencies: ["step_1"],
      cacheable: false,
    };

    const plan = createSimplePlan([writeStep, readStep]);
    const result = await executor.execute(plan);

    assertEquals(result.success, true);
    assertEquals(result.data, "test data");
  },
});

Deno.test({
  name: "QueryExecutor - READ_VARIABLE fails for undefined variable",
  async fn() {
    const executor = createTestExecutor();

    const readStep: ReadVariableStep = {
      id: "step_1",
      type: ExecutionStepType.READ_VARIABLE,
      variable: "nonexistent",
      outputVariable: "output",
      estimatedCost: 1,
      dependencies: [],
      cacheable: false,
    };

    const plan = createSimplePlan([readStep]);
    const result = await executor.execute(plan);

    assertEquals(result.success, false);
    assertExists(result.error);
  },
});

// ============================================================================
// PARALLEL Step Tests
// ============================================================================

Deno.test({
  name: "QueryExecutor - executes PARALLEL step",
  async fn() {
    const executor = createTestExecutor();

    const step1: AssignStep = {
      id: "parallel_1",
      type: ExecutionStepType.ASSIGN,
      variable: "a",
      value: { type: "LITERAL", value: 1, dataType: DataType.NUMBER } as Literal,
      estimatedCost: 1,
      dependencies: [],
      cacheable: false,
    };

    const step2: AssignStep = {
      id: "parallel_2",
      type: ExecutionStepType.ASSIGN,
      variable: "b",
      value: { type: "LITERAL", value: 2, dataType: DataType.NUMBER } as Literal,
      estimatedCost: 1,
      dependencies: [],
      cacheable: false,
    };

    const parallelStep: ParallelStep = {
      id: "step_1",
      type: ExecutionStepType.PARALLEL,
      steps: [step1, step2],
      estimatedCost: 2,
      dependencies: [],
      cacheable: false,
    };

    const plan = createSimplePlan([parallelStep]);
    const result = await executor.execute(plan);

    assertEquals(result.success, true);
    // Parallel returns array of results
    assert(Array.isArray(result.data));
    assertEquals((result.data as any[]).length, 2);
  },
});

// ============================================================================
// SEQUENTIAL Step Tests
// ============================================================================

Deno.test({
  name: "QueryExecutor - executes SEQUENTIAL step",
  async fn() {
    const executor = createTestExecutor();

    const step1: AssignStep = {
      id: "seq_1",
      type: ExecutionStepType.ASSIGN,
      variable: "first",
      value: { type: "LITERAL", value: "first", dataType: DataType.STRING } as Literal,
      estimatedCost: 1,
      dependencies: [],
      cacheable: false,
    };

    const step2: AssignStep = {
      id: "seq_2",
      type: ExecutionStepType.ASSIGN,
      variable: "second",
      value: { type: "LITERAL", value: "second", dataType: DataType.STRING } as Literal,
      estimatedCost: 1,
      dependencies: [],
      cacheable: false,
    };

    const seqStep: SequentialStep = {
      id: "step_1",
      type: ExecutionStepType.SEQUENTIAL,
      steps: [step1, step2],
      estimatedCost: 2,
      dependencies: [],
      cacheable: false,
    };

    const plan = createSimplePlan([seqStep]);
    const result = await executor.execute(plan);

    assertEquals(result.success, true);
    // Sequential returns last result
    assertEquals(result.data, "second");
  },
});

// ============================================================================
// MAP Step Tests
// ============================================================================

Deno.test({
  name: "QueryExecutor - executes MAP step",
  async fn() {
    const executor = createTestExecutor();

    // Array of objects with 'value' property since the transform references 'value'
    const assignStep: AssignStep = {
      id: "step_1",
      type: ExecutionStepType.ASSIGN,
      variable: "__input",
      value: {
        type: "ARRAY",
        elements: [
          { type: "OBJECT", properties: [{ key: "value", value: { type: "LITERAL", value: 1, dataType: DataType.NUMBER } }] },
          { type: "OBJECT", properties: [{ key: "value", value: { type: "LITERAL", value: 2, dataType: DataType.NUMBER } }] },
          { type: "OBJECT", properties: [{ key: "value", value: { type: "LITERAL", value: 3, dataType: DataType.NUMBER } }] },
        ],
      } as any,
      estimatedCost: 1,
      dependencies: [],
      cacheable: false,
    };

    const mapStep: MapStep = {
      id: "step_2",
      type: ExecutionStepType.MAP,
      transform: {
        type: "BINARY",
        operator: "*",
        left: { type: "IDENTIFIER", name: "value" },
        right: { type: "LITERAL", value: 2, dataType: DataType.NUMBER },
      } as BinaryExpression,
      inputVariable: "__input",
      outputVariable: "__output",
      estimatedCost: 5,
      dependencies: ["step_1"],
      cacheable: false,
    };

    const plan = createSimplePlan([assignStep, mapStep]);
    const result = await executor.execute(plan);

    assertEquals(result.success, true);
    assert(Array.isArray(result.data));
  },
});

// ============================================================================
// REDUCE Step Tests
// ============================================================================

Deno.test({
  name: "QueryExecutor - executes REDUCE step",
  async fn() {
    const executor = createTestExecutor();

    // Array of objects with 'value' property since the reducer references 'value'
    const assignStep: AssignStep = {
      id: "step_1",
      type: ExecutionStepType.ASSIGN,
      variable: "__input",
      value: {
        type: "ARRAY",
        elements: [
          { type: "OBJECT", properties: [{ key: "value", value: { type: "LITERAL", value: 1, dataType: DataType.NUMBER } }] },
          { type: "OBJECT", properties: [{ key: "value", value: { type: "LITERAL", value: 2, dataType: DataType.NUMBER } }] },
          { type: "OBJECT", properties: [{ key: "value", value: { type: "LITERAL", value: 3, dataType: DataType.NUMBER } }] },
        ],
      } as any,
      estimatedCost: 1,
      dependencies: [],
      cacheable: false,
    };

    const reduceStep: ReduceStep = {
      id: "step_2",
      type: ExecutionStepType.REDUCE,
      reducer: {
        type: "BINARY",
        operator: "+",
        left: { type: "IDENTIFIER", name: "accumulator" },
        right: { type: "IDENTIFIER", name: "value" },
      } as BinaryExpression,
      initialValue: { type: "LITERAL", value: 0, dataType: DataType.NUMBER } as Literal,
      inputVariable: "__input",
      outputVariable: "__output",
      estimatedCost: 5,
      dependencies: ["step_1"],
      cacheable: false,
    };

    const plan = createSimplePlan([assignStep, reduceStep]);
    const result = await executor.execute(plan);

    assertEquals(result.success, true);
  },
});

// ============================================================================
// JOIN Step Tests
// ============================================================================

Deno.test({
  name: "QueryExecutor - executes JOIN step (inner join)",
  async fn() {
    const executor = createTestExecutor();

    // Left dataset
    const leftAssign: AssignStep = {
      id: "step_1",
      type: ExecutionStepType.ASSIGN,
      variable: "__left",
      value: {
        type: "ARRAY",
        elements: [
          { type: "OBJECT", properties: [{ key: "id", value: { type: "LITERAL", value: 1, dataType: DataType.NUMBER } }, { key: "name", value: { type: "LITERAL", value: "Alice", dataType: DataType.STRING } }] },
          { type: "OBJECT", properties: [{ key: "id", value: { type: "LITERAL", value: 2, dataType: DataType.NUMBER } }, { key: "name", value: { type: "LITERAL", value: "Bob", dataType: DataType.STRING } }] },
        ],
      } as any,
      estimatedCost: 1,
      dependencies: [],
      cacheable: false,
    };

    // Right dataset
    const rightAssign: AssignStep = {
      id: "step_2",
      type: ExecutionStepType.ASSIGN,
      variable: "__right",
      value: {
        type: "ARRAY",
        elements: [
          { type: "OBJECT", properties: [{ key: "userId", value: { type: "LITERAL", value: 1, dataType: DataType.NUMBER } }, { key: "score", value: { type: "LITERAL", value: 100, dataType: DataType.NUMBER } }] },
          { type: "OBJECT", properties: [{ key: "userId", value: { type: "LITERAL", value: 2, dataType: DataType.NUMBER } }, { key: "score", value: { type: "LITERAL", value: 200, dataType: DataType.NUMBER } }] },
        ],
      } as any,
      estimatedCost: 1,
      dependencies: [],
      cacheable: false,
    };

    const joinStep: JoinStep = {
      id: "step_3",
      type: ExecutionStepType.JOIN,
      leftVariable: "__left",
      rightVariable: "__right",
      leftKey: { type: "IDENTIFIER", name: "id" } as Identifier,
      rightKey: { type: "IDENTIFIER", name: "userId" } as Identifier,
      joinType: "inner",
      outputVariable: "__joined",
      estimatedCost: 20,
      dependencies: ["step_1", "step_2"],
      cacheable: false,
    };

    const plan = createSimplePlan([leftAssign, rightAssign, joinStep]);
    const result = await executor.execute(plan);

    assertEquals(result.success, true);
    assert(Array.isArray(result.data));
  },
});

// ============================================================================
// Caching Tests
// ============================================================================

Deno.test({
  name: "QueryExecutor - handles cacheable steps",
  async fn() {
    const executor = createTestExecutor();

    const cacheableStep: AssignStep = {
      id: "step_1",
      type: ExecutionStepType.ASSIGN,
      variable: "cached",
      value: { type: "LITERAL", value: "cached value", dataType: DataType.STRING } as Literal,
      estimatedCost: 1,
      dependencies: [],
      cacheable: true,
      cacheKey: "test_cache_key",
    };

    const plan = createSimplePlan([cacheableStep]);
    plan.cacheableSteps = ["step_1"];

    // First execution - should be a cache miss
    const result1 = await executor.execute(plan);
    assertEquals(result1.success, true);

    // Second execution with same plan - should use cache
    const result2 = await executor.execute(plan);
    assertEquals(result2.success, true);
  },
});

Deno.test({
  name: "QueryExecutor - tracks cache hits and misses",
  async fn() {
    const executor = createTestExecutor();

    const cacheableStep: AssignStep = {
      id: "step_1",
      type: ExecutionStepType.ASSIGN,
      variable: "test",
      value: { type: "LITERAL", value: 42, dataType: DataType.NUMBER } as Literal,
      estimatedCost: 1,
      dependencies: [],
      cacheable: true,
      cacheKey: "unique_test_key",
    };

    const plan = createSimplePlan([cacheableStep]);
    plan.cacheableSteps = ["step_1"];

    const result = await executor.execute(plan);

    assertEquals(result.success, true);
    // First run should have 1 miss and 0 hits
    assertEquals(result.cacheMisses, 1);
    assertEquals(result.cacheHits, 0);
  },
});

// ============================================================================
// Error Handling Tests
// ============================================================================

Deno.test({
  name: "QueryExecutor - returns failure on step error",
  async fn() {
    const executor = createTestExecutor();

    // Try to filter a non-array
    const assignStep: AssignStep = {
      id: "step_1",
      type: ExecutionStepType.ASSIGN,
      variable: "__input",
      value: { type: "LITERAL", value: "not an array", dataType: DataType.STRING } as Literal,
      estimatedCost: 1,
      dependencies: [],
      cacheable: false,
    };

    const filterStep: FilterStep = {
      id: "step_2",
      type: ExecutionStepType.FILTER,
      predicate: {
        type: "BINARY",
        operator: ">",
        left: { type: "IDENTIFIER", name: "x" },
        right: { type: "LITERAL", value: 0, dataType: DataType.NUMBER },
      } as BinaryExpression,
      inputVariable: "__input",
      outputVariable: "__output",
      estimatedCost: 5,
      dependencies: ["step_1"],
      cacheable: false,
    };

    const plan = createSimplePlan([assignStep, filterStep]);
    const result = await executor.execute(plan);

    assertEquals(result.success, false);
    assertExists(result.error);
  },
});

// ============================================================================
// Timing Tests
// ============================================================================

Deno.test({
  name: "QueryExecutor - records execution timing",
  async fn() {
    const executor = createTestExecutor();

    const step: AssignStep = {
      id: "step_1",
      type: ExecutionStepType.ASSIGN,
      variable: "x",
      value: { type: "LITERAL", value: 1, dataType: DataType.NUMBER } as Literal,
      estimatedCost: 1,
      dependencies: [],
      cacheable: false,
    };

    const plan = createSimplePlan([step]);
    const result = await executor.execute(plan);

    assertExists(result.timing);
    assert(result.timing.startTime > 0);
    assert(result.timing.endTime >= result.timing.startTime);
    assert(result.timing.totalTime >= 0);
  },
});

Deno.test({
  name: "QueryExecutor - records per-step timing",
  async fn() {
    const executor = createTestExecutor();

    const step: AssignStep = {
      id: "step_1",
      type: ExecutionStepType.ASSIGN,
      variable: "x",
      value: { type: "LITERAL", value: 1, dataType: DataType.NUMBER } as Literal,
      estimatedCost: 1,
      dependencies: [],
      cacheable: false,
    };

    const plan = createSimplePlan([step]);
    const result = await executor.execute(plan);

    const stepResult = result.stepResults.get("step_1");
    assertExists(stepResult);
    assertExists(stepResult.timing);
    assert(stepResult.timing.duration >= 0);
  },
});

// ============================================================================
// Execution Order Tests
// ============================================================================

Deno.test({
  name: "QueryExecutor - respects step dependencies",
  async fn() {
    const executor = createTestExecutor();

    // Step 2 depends on step 1
    const step1: AssignStep = {
      id: "step_1",
      type: ExecutionStepType.ASSIGN,
      variable: "first",
      value: { type: "LITERAL", value: 1, dataType: DataType.NUMBER } as Literal,
      estimatedCost: 1,
      dependencies: [],
      cacheable: false,
    };

    const step2: AssignStep = {
      id: "step_2",
      type: ExecutionStepType.ASSIGN,
      variable: "second",
      value: { type: "LITERAL", value: 2, dataType: DataType.NUMBER } as Literal,
      estimatedCost: 1,
      dependencies: ["step_1"],
      cacheable: false,
    };

    // Put step2 first in array, but it depends on step1
    const plan = createSimplePlan([step2, step1]);
    const result = await executor.execute(plan);

    assertEquals(result.success, true);
    // Both steps should have executed
    assertEquals(result.stepResults.size, 2);
  },
});

// ============================================================================
// Query ID Tests
// ============================================================================

Deno.test({
  name: "QueryExecutor - preserves query ID in result",
  async fn() {
    const executor = createTestExecutor();

    const step: AssignStep = {
      id: "step_1",
      type: ExecutionStepType.ASSIGN,
      variable: "x",
      value: { type: "LITERAL", value: 1, dataType: DataType.NUMBER } as Literal,
      estimatedCost: 1,
      dependencies: [],
      cacheable: false,
    };

    const plan = createSimplePlan([step], "my_query_id_123");
    const result = await executor.execute(plan);

    assertEquals(result.queryId, "my_query_id_123");
  },
});

// ============================================================================
// Empty Plan Tests
// ============================================================================

Deno.test({
  name: "QueryExecutor - handles empty plan",
  async fn() {
    const executor = createTestExecutor();

    const plan = createSimplePlan([]);
    const result = await executor.execute(plan);

    assertEquals(result.success, true);
    assertEquals(result.data, undefined);
    assertEquals(result.stepResults.size, 0);
  },
});

// ============================================================================
// Step Results Tests
// ============================================================================

Deno.test({
  name: "QueryExecutor - stores all step results",
  async fn() {
    const executor = createTestExecutor();

    const step1: AssignStep = {
      id: "step_1",
      type: ExecutionStepType.ASSIGN,
      variable: "a",
      value: { type: "LITERAL", value: 1, dataType: DataType.NUMBER } as Literal,
      estimatedCost: 1,
      dependencies: [],
      cacheable: false,
    };

    const step2: AssignStep = {
      id: "step_2",
      type: ExecutionStepType.ASSIGN,
      variable: "b",
      value: { type: "LITERAL", value: 2, dataType: DataType.NUMBER } as Literal,
      estimatedCost: 1,
      dependencies: ["step_1"],
      cacheable: false,
    };

    const step3: AssignStep = {
      id: "step_3",
      type: ExecutionStepType.ASSIGN,
      variable: "c",
      value: { type: "LITERAL", value: 3, dataType: DataType.NUMBER } as Literal,
      estimatedCost: 1,
      dependencies: ["step_2"],
      cacheable: false,
    };

    const plan = createSimplePlan([step1, step2, step3]);
    const result = await executor.execute(plan);

    assertEquals(result.success, true);
    assertEquals(result.stepResults.size, 3);

    const step1Result = result.stepResults.get("step_1");
    const step2Result = result.stepResults.get("step_2");
    const step3Result = result.stepResults.get("step_3");

    assertExists(step1Result);
    assertExists(step2Result);
    assertExists(step3Result);

    assertEquals(step1Result.success, true);
    assertEquals(step2Result.success, true);
    assertEquals(step3Result.success, true);

    assertEquals(step1Result.data, 1);
    assertEquals(step2Result.data, 2);
    assertEquals(step3Result.data, 3);
  },
});
