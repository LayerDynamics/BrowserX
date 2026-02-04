/**
 * InitializationSequence Unit Tests
 *
 * Comprehensive tests for ordered startup, dependency resolution,
 * timeout handling, and progress callbacks.
 */

import {
  assertEquals,
  assertExists,
  assertRejects,
  assertThrows,
} from "@std/assert";
import {
  InitializationSequence,
  StepExecutionResult,
  InitializationProgress,
} from "../../src/lifecycle/InitializationSequence.ts";
import { LifecycleManager } from "../../src/lifecycle/LifecycleManager.ts";
import type { InitializationStep, RuntimeEvent, ComponentId } from "../../src/types.ts";
import { RuntimeState } from "../../src/types.ts";

/**
 * Create a simple init step for testing
 */
function createTestStep(
  name: string,
  component: ComponentId,
  options: {
    execute?: () => Promise<void>;
    dependencies?: ComponentId[];
    optional?: boolean;
    timeout?: number;
  } = {},
): InitializationStep {
  return {
    name,
    component,
    execute: options.execute ?? (() => Promise.resolve()),
    dependencies: options.dependencies ?? [],
    optional: options.optional ?? false,
    timeout: options.timeout,
  };
}

// ============================================================================
// Basic Instantiation Tests
// ============================================================================

Deno.test("InitializationSequence - instantiation with lifecycle manager", () => {
  const lifecycleManager = new LifecycleManager();
  const sequence = new InitializationSequence(lifecycleManager);

  assertExists(sequence);
  assertEquals(sequence.getSteps().length, 0);
});

Deno.test("InitializationSequence - instantiation with custom config", () => {
  const lifecycleManager = new LifecycleManager();
  const sequence = new InitializationSequence(lifecycleManager, {
    defaultTimeout: 10000,
    continueOnOptionalFailure: false,
    maxConcurrency: 5,
  });

  assertExists(sequence);
});

// ============================================================================
// Step Registration Tests
// ============================================================================

Deno.test("InitializationSequence - registerStep adds step", () => {
  const lifecycleManager = new LifecycleManager();
  const sequence = new InitializationSequence(lifecycleManager);

  const step = createTestStep("init-browser", "browser-pool");
  sequence.registerStep(step);

  assertEquals(sequence.getSteps().length, 1);
  assertEquals(sequence.getSteps()[0].name, "init-browser");
});

Deno.test("InitializationSequence - registerStep registers component with lifecycle manager", () => {
  const lifecycleManager = new LifecycleManager();
  const sequence = new InitializationSequence(lifecycleManager);

  const step = createTestStep("init-browser", "browser-pool");
  sequence.registerStep(step);

  assertEquals(lifecycleManager.hasComponent("browser-pool"), true);
});

Deno.test("InitializationSequence - registerStep rejects duplicate names", () => {
  const lifecycleManager = new LifecycleManager();
  const sequence = new InitializationSequence(lifecycleManager);

  const step1 = createTestStep("init-browser", "browser-pool");
  const step2 = createTestStep("init-browser", "query-engine");

  sequence.registerStep(step1);

  assertThrows(
    () => sequence.registerStep(step2),
    Error,
    "Duplicate initialization step name",
  );
});

Deno.test("InitializationSequence - registerStep rejects invalid step", () => {
  const lifecycleManager = new LifecycleManager();
  const sequence = new InitializationSequence(lifecycleManager);

  assertThrows(
    () =>
      sequence.registerStep({
        name: "",
        component: "browser-pool",
        execute: () => Promise.resolve(),
        dependencies: [],
      }),
    Error,
    "Invalid initialization step",
  );
});

// ============================================================================
// Execution Tests
// ============================================================================

Deno.test("InitializationSequence - execute runs steps in order", async () => {
  const lifecycleManager = new LifecycleManager();
  const sequence = new InitializationSequence(lifecycleManager);

  const executionOrder: string[] = [];

  sequence.registerStep(
    createTestStep("step-1", "browser-pool", {
      execute: async () => {
        executionOrder.push("step-1");
      },
    }),
  );
  sequence.registerStep(
    createTestStep("step-2", "query-engine", {
      execute: async () => {
        executionOrder.push("step-2");
      },
    }),
  );
  sequence.registerStep(
    createTestStep("step-3", "proxy-engine", {
      execute: async () => {
        executionOrder.push("step-3");
      },
    }),
  );

  await sequence.execute();

  assertEquals(executionOrder, ["step-1", "step-2", "step-3"]);
});

Deno.test("InitializationSequence - execute returns results", async () => {
  const lifecycleManager = new LifecycleManager();
  const sequence = new InitializationSequence(lifecycleManager);

  sequence.registerStep(createTestStep("step-1", "browser-pool"));
  sequence.registerStep(createTestStep("step-2", "query-engine"));

  const results = await sequence.execute();

  assertEquals(results.length, 2);
  assertEquals(results[0].success, true);
  assertEquals(results[1].success, true);
});

Deno.test("InitializationSequence - execute records duration", async () => {
  const lifecycleManager = new LifecycleManager();
  const sequence = new InitializationSequence(lifecycleManager);

  sequence.registerStep(
    createTestStep("slow-step", "browser-pool", {
      execute: async () => {
        await new Promise((r) => setTimeout(r, 50));
      },
    }),
  );

  const results = await sequence.execute();

  assertEquals(results[0].duration >= 50, true);
});

Deno.test("InitializationSequence - execute updates component state to RUNNING on success", async () => {
  const lifecycleManager = new LifecycleManager();
  const sequence = new InitializationSequence(lifecycleManager);

  sequence.registerStep(createTestStep("step-1", "browser-pool"));

  await sequence.execute();

  const componentState = lifecycleManager.getComponentState("browser-pool");
  assertEquals(componentState?.state, RuntimeState.RUNNING);
});

// ============================================================================
// Dependency Resolution Tests
// ============================================================================

Deno.test("InitializationSequence - execute respects dependencies", async () => {
  const lifecycleManager = new LifecycleManager();
  const sequence = new InitializationSequence(lifecycleManager);

  const executionOrder: string[] = [];

  // Register in wrong order but with dependencies
  sequence.registerStep(
    createTestStep("query", "query-engine", {
      dependencies: ["browser-pool"],
      execute: async () => {
        executionOrder.push("query");
      },
    }),
  );
  sequence.registerStep(
    createTestStep("browser", "browser-pool", {
      execute: async () => {
        executionOrder.push("browser");
      },
    }),
  );

  await sequence.execute();

  assertEquals(executionOrder, ["browser", "query"]);
});

Deno.test("InitializationSequence - execute detects circular dependencies", () => {
  const lifecycleManager = new LifecycleManager();
  const sequence = new InitializationSequence(lifecycleManager);

  // Create circular dependency
  sequence.registerStep(
    createTestStep("step-a", "browser-pool", {
      dependencies: ["query-engine"],
    }),
  );
  sequence.registerStep(
    createTestStep("step-b", "query-engine", {
      dependencies: ["browser-pool"],
    }),
  );

  assertRejects(
    () => sequence.execute(),
    Error,
    "Circular dependency",
  );
});

Deno.test("InitializationSequence - execute skips step if dependencies not met", async () => {
  const lifecycleManager = new LifecycleManager();
  const sequence = new InitializationSequence(lifecycleManager);

  // Make the failing step optional so execution continues to the dependent step
  sequence.registerStep(
    createTestStep("failing-step", "browser-pool", {
      execute: async () => {
        throw new Error("Step failed");
      },
      optional: true,
    }),
  );
  sequence.registerStep(
    createTestStep("dependent-step", "query-engine", {
      dependencies: ["browser-pool"],
    }),
  );

  const results = await sequence.execute();

  // First step fails (optional), second is skipped due to failed dependency
  assertEquals(results[0].success, false);
  assertEquals(results[1].success, false);
  assertEquals(results[1].skipped, true);
});

// ============================================================================
// Error Handling Tests
// ============================================================================

Deno.test("InitializationSequence - execute handles step errors", async () => {
  const lifecycleManager = new LifecycleManager();
  const sequence = new InitializationSequence(lifecycleManager);

  sequence.registerStep(
    createTestStep("failing-step", "browser-pool", {
      execute: async () => {
        throw new Error("Initialization failed");
      },
    }),
  );

  const results = await sequence.execute();

  assertEquals(results[0].success, false);
  assertExists(results[0].error);
  assertEquals(results[0].error?.message, "Initialization failed");
});

Deno.test("InitializationSequence - execute updates component state to ERROR on failure", async () => {
  const lifecycleManager = new LifecycleManager();
  const sequence = new InitializationSequence(lifecycleManager);

  sequence.registerStep(
    createTestStep("failing-step", "browser-pool", {
      execute: async () => {
        throw new Error("Initialization failed");
      },
    }),
  );

  await sequence.execute();

  const componentState = lifecycleManager.getComponentState("browser-pool");
  assertEquals(componentState?.state, RuntimeState.ERROR);
});

Deno.test("InitializationSequence - execute stops on non-optional failure", async () => {
  const lifecycleManager = new LifecycleManager();
  const sequence = new InitializationSequence(lifecycleManager);

  const executionOrder: string[] = [];

  sequence.registerStep(
    createTestStep("step-1", "browser-pool", {
      execute: async () => {
        executionOrder.push("step-1");
        throw new Error("Failed");
      },
    }),
  );
  sequence.registerStep(
    createTestStep("step-2", "query-engine", {
      execute: async () => {
        executionOrder.push("step-2");
      },
    }),
  );

  await sequence.execute();

  // Only first step executed
  assertEquals(executionOrder, ["step-1"]);
});

Deno.test("InitializationSequence - execute continues on optional failure", async () => {
  const lifecycleManager = new LifecycleManager();
  const sequence = new InitializationSequence(lifecycleManager);

  const executionOrder: string[] = [];

  sequence.registerStep(
    createTestStep("optional-step", "browser-pool", {
      optional: true,
      execute: async () => {
        executionOrder.push("optional-step");
        throw new Error("Optional failed");
      },
    }),
  );
  sequence.registerStep(
    createTestStep("required-step", "query-engine", {
      execute: async () => {
        executionOrder.push("required-step");
      },
    }),
  );

  await sequence.execute();

  // Both steps executed
  assertEquals(executionOrder, ["optional-step", "required-step"]);
});

// ============================================================================
// Timeout Tests
// ============================================================================

Deno.test({
  name: "InitializationSequence - execute handles step timeout",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const lifecycleManager = new LifecycleManager();
    const sequence = new InitializationSequence(lifecycleManager, {
      defaultTimeout: 100,
    });

    sequence.registerStep(
      createTestStep("slow-step", "browser-pool", {
        timeout: 50,
        execute: async () => {
          await new Promise((r) => setTimeout(r, 200));
        },
      }),
    );

    const results = await sequence.execute();

    assertEquals(results[0].success, false);
    assertExists(results[0].error);
    assertEquals(results[0].error?.message.includes("timed out"), true);
  },
});

// ============================================================================
// Progress Callback Tests
// ============================================================================

Deno.test("InitializationSequence - execute calls progress callback", async () => {
  const lifecycleManager = new LifecycleManager();
  const sequence = new InitializationSequence(lifecycleManager);

  sequence.registerStep(createTestStep("step-1", "browser-pool"));
  sequence.registerStep(createTestStep("step-2", "query-engine"));

  const progressUpdates: InitializationProgress[] = [];

  await sequence.execute((progress) => {
    progressUpdates.push({ ...progress });
  });

  // Should have updates for each step plus completion
  assertEquals(progressUpdates.length >= 2, true);
  assertEquals(progressUpdates[0].completedSteps, 0);
  assertEquals(progressUpdates[0].totalSteps, 2);
});

Deno.test("InitializationSequence - execute reports final progress at 100%", async () => {
  const lifecycleManager = new LifecycleManager();
  const sequence = new InitializationSequence(lifecycleManager);

  sequence.registerStep(createTestStep("step-1", "browser-pool"));

  let finalProgress: InitializationProgress | undefined = undefined;

  await sequence.execute((progress) => {
    finalProgress = { ...progress };
  });

  assertExists(finalProgress);
  assertEquals((finalProgress as InitializationProgress).percentage, 100);
  assertEquals((finalProgress as InitializationProgress).currentStep, "complete");
});

// ============================================================================
// Result Query Tests
// ============================================================================

Deno.test("InitializationSequence - getResults returns execution results", async () => {
  const lifecycleManager = new LifecycleManager();
  const sequence = new InitializationSequence(lifecycleManager);

  sequence.registerStep(createTestStep("step-1", "browser-pool"));

  await sequence.execute();

  const results = sequence.getResults();
  assertEquals(results.size, 1);
  assertEquals(results.get("step-1")?.success, true);
});

Deno.test("InitializationSequence - isSuccessful returns true when all required succeed", async () => {
  const lifecycleManager = new LifecycleManager();
  const sequence = new InitializationSequence(lifecycleManager);

  sequence.registerStep(createTestStep("step-1", "browser-pool"));
  sequence.registerStep(
    createTestStep("step-2", "query-engine", { optional: true }),
  );

  await sequence.execute();

  assertEquals(sequence.isSuccessful(), true);
});

Deno.test("InitializationSequence - isSuccessful returns false when required fails", async () => {
  const lifecycleManager = new LifecycleManager();
  const sequence = new InitializationSequence(lifecycleManager);

  sequence.registerStep(
    createTestStep("failing-step", "browser-pool", {
      execute: async () => {
        throw new Error("Failed");
      },
    }),
  );

  await sequence.execute();

  assertEquals(sequence.isSuccessful(), false);
});

Deno.test("InitializationSequence - getFailedSteps returns failed non-skipped steps", async () => {
  const lifecycleManager = new LifecycleManager();
  const sequence = new InitializationSequence(lifecycleManager);

  sequence.registerStep(
    createTestStep("failing-step", "browser-pool", {
      execute: async () => {
        throw new Error("Failed");
      },
    }),
  );

  await sequence.execute();

  const failedSteps = sequence.getFailedSteps();
  assertEquals(failedSteps.length, 1);
  assertEquals(failedSteps[0].step.name, "failing-step");
});

Deno.test("InitializationSequence - getTotalDuration returns sum of durations", async () => {
  const lifecycleManager = new LifecycleManager();
  const sequence = new InitializationSequence(lifecycleManager);

  sequence.registerStep(
    createTestStep("step-1", "browser-pool", {
      execute: async () => {
        await new Promise((r) => setTimeout(r, 20));
      },
    }),
  );
  sequence.registerStep(
    createTestStep("step-2", "query-engine", {
      execute: async () => {
        await new Promise((r) => setTimeout(r, 20));
      },
    }),
  );

  await sequence.execute();

  assertEquals(sequence.getTotalDuration() >= 40, true);
});

// ============================================================================
// Reset Tests
// ============================================================================

Deno.test("InitializationSequence - reset clears results", async () => {
  const lifecycleManager = new LifecycleManager();
  const sequence = new InitializationSequence(lifecycleManager);

  sequence.registerStep(createTestStep("step-1", "browser-pool"));

  await sequence.execute();
  assertEquals(sequence.getResults().size, 1);

  sequence.reset();
  assertEquals(sequence.getResults().size, 0);
});

// ============================================================================
// Event Listener Tests
// ============================================================================

Deno.test("InitializationSequence - emits component_starting event", async () => {
  const lifecycleManager = new LifecycleManager();
  const sequence = new InitializationSequence(lifecycleManager);

  const events: RuntimeEvent[] = [];
  sequence.addEventListener((event) => events.push(event));

  sequence.registerStep(createTestStep("step-1", "browser-pool"));
  await sequence.execute();

  const startingEvent = events.find((e) => e.type === "component_starting");
  assertExists(startingEvent);
});

Deno.test("InitializationSequence - emits component_started event on success", async () => {
  const lifecycleManager = new LifecycleManager();
  const sequence = new InitializationSequence(lifecycleManager);

  const events: RuntimeEvent[] = [];
  sequence.addEventListener((event) => events.push(event));

  sequence.registerStep(createTestStep("step-1", "browser-pool"));
  await sequence.execute();

  const startedEvent = events.find((e) => e.type === "component_started");
  assertExists(startedEvent);
});

Deno.test("InitializationSequence - emits component_error event on failure", async () => {
  const lifecycleManager = new LifecycleManager();
  const sequence = new InitializationSequence(lifecycleManager);

  const events: RuntimeEvent[] = [];
  sequence.addEventListener((event) => events.push(event));

  sequence.registerStep(
    createTestStep("failing-step", "browser-pool", {
      execute: async () => {
        throw new Error("Failed");
      },
    }),
  );

  await sequence.execute();

  const errorEvent = events.find((e) => e.type === "component_error");
  assertExists(errorEvent);
});

Deno.test("InitializationSequence - removeEventListener stops event delivery", async () => {
  const lifecycleManager = new LifecycleManager();
  const sequence = new InitializationSequence(lifecycleManager);

  const events: RuntimeEvent[] = [];
  const listener = (event: RuntimeEvent) => events.push(event);

  sequence.addEventListener(listener);
  sequence.removeEventListener(listener);

  sequence.registerStep(createTestStep("step-1", "browser-pool"));
  await sequence.execute();

  assertEquals(events.length, 0);
});
