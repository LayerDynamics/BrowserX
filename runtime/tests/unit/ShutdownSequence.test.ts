/**
 * ShutdownSequence Unit Tests
 *
 * Comprehensive tests for ordered shutdown, timeout handling,
 * force shutdown, and progress callbacks.
 */

import {
  assertEquals,
  assertExists,
  assertRejects,
  assertThrows,
} from "@std/assert";
import {
  ShutdownSequence,
  ShutdownStepResult,
  ShutdownProgress,
} from "../../src/lifecycle/ShutdownSequence.ts";
import { LifecycleManager } from "../../src/lifecycle/LifecycleManager.ts";
import type { ShutdownStep, RuntimeEvent, ComponentId } from "../../src/types.ts";
import { RuntimeState } from "../../src/types.ts";

/**
 * Create a simple shutdown step for testing
 */
function createTestStep(
  name: string,
  component: ComponentId,
  options: {
    execute?: () => Promise<void>;
    timeout?: number;
    graceful?: boolean;
  } = {},
): ShutdownStep {
  return {
    name,
    component,
    execute: options.execute ?? (() => Promise.resolve()),
    timeout: options.timeout ?? 5000,
    graceful: options.graceful ?? true,
  };
}

// ============================================================================
// Basic Instantiation Tests
// ============================================================================

Deno.test("ShutdownSequence - instantiation with lifecycle manager", () => {
  const lifecycleManager = new LifecycleManager();
  const sequence = new ShutdownSequence(lifecycleManager);

  assertExists(sequence);
  assertEquals(sequence.getSteps().length, 0);
  assertEquals(sequence.isShuttingDown(), false);
});

Deno.test("ShutdownSequence - instantiation with custom config", () => {
  const lifecycleManager = new LifecycleManager();
  const sequence = new ShutdownSequence(lifecycleManager, {
    totalTimeout: 60000,
    defaultStepTimeout: 10000,
    forceOnTimeout: false,
    forceShutdownDelay: 2000,
  });

  assertExists(sequence);
});

// ============================================================================
// Step Registration Tests
// ============================================================================

Deno.test("ShutdownSequence - registerStep adds step", () => {
  const lifecycleManager = new LifecycleManager();
  const sequence = new ShutdownSequence(lifecycleManager);

  const step = createTestStep("stop-browser", "browser-pool");
  sequence.registerStep(step);

  assertEquals(sequence.getSteps().length, 1);
  assertEquals(sequence.getSteps()[0].name, "stop-browser");
});

Deno.test("ShutdownSequence - registerStep assigns default timeout", () => {
  const lifecycleManager = new LifecycleManager();
  const sequence = new ShutdownSequence(lifecycleManager, {
    defaultStepTimeout: 3000,
  });

  sequence.registerStep({
    name: "step-1",
    component: "browser-pool",
    execute: () => Promise.resolve(),
    timeout: 0, // Will be replaced with default
    graceful: true,
  });

  // Note: timeout gets set in registerStep
  assertEquals(sequence.getSteps()[0].timeout, 3000);
});

Deno.test("ShutdownSequence - registerStep rejects duplicate names", () => {
  const lifecycleManager = new LifecycleManager();
  const sequence = new ShutdownSequence(lifecycleManager);

  const step1 = createTestStep("stop-browser", "browser-pool");
  const step2 = createTestStep("stop-browser", "query-engine");

  sequence.registerStep(step1);

  assertThrows(
    () => sequence.registerStep(step2),
    Error,
    "Duplicate shutdown step name",
  );
});

Deno.test("ShutdownSequence - registerStep rejects invalid step", () => {
  const lifecycleManager = new LifecycleManager();
  const sequence = new ShutdownSequence(lifecycleManager);

  assertThrows(
    () =>
      sequence.registerStep({
        name: "",
        component: "browser-pool",
        execute: () => Promise.resolve(),
        timeout: 5000,
      }),
    Error,
    "Invalid shutdown step",
  );
});

// ============================================================================
// Execution Tests
// ============================================================================

Deno.test("ShutdownSequence - execute runs steps in reverse order", async () => {
  const lifecycleManager = new LifecycleManager();
  lifecycleManager.registerComponent("browser-pool");
  lifecycleManager.registerComponent("query-engine");
  lifecycleManager.registerComponent("proxy-engine");

  const sequence = new ShutdownSequence(lifecycleManager);

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

  await sequence.execute("test shutdown");

  // Reverse order - last registered first
  assertEquals(executionOrder, ["step-3", "step-2", "step-1"]);
});

Deno.test("ShutdownSequence - execute returns results", async () => {
  const lifecycleManager = new LifecycleManager();
  lifecycleManager.registerComponent("browser-pool");
  lifecycleManager.registerComponent("query-engine");

  const sequence = new ShutdownSequence(lifecycleManager);

  sequence.registerStep(createTestStep("step-1", "browser-pool"));
  sequence.registerStep(createTestStep("step-2", "query-engine"));

  const results = await sequence.execute("test shutdown");

  assertEquals(results.length, 2);
  assertEquals(results[0].success, true);
  assertEquals(results[1].success, true);
});

Deno.test("ShutdownSequence - execute records duration", async () => {
  const lifecycleManager = new LifecycleManager();
  lifecycleManager.registerComponent("browser-pool");

  const sequence = new ShutdownSequence(lifecycleManager);

  sequence.registerStep(
    createTestStep("slow-step", "browser-pool", {
      execute: async () => {
        await new Promise((r) => setTimeout(r, 50));
      },
    }),
  );

  const results = await sequence.execute("test shutdown");

  assertEquals(results[0].duration >= 50, true);
});

Deno.test("ShutdownSequence - execute updates component state to STOPPED on success", async () => {
  const lifecycleManager = new LifecycleManager();
  lifecycleManager.registerComponent("browser-pool");

  const sequence = new ShutdownSequence(lifecycleManager);

  sequence.registerStep(createTestStep("step-1", "browser-pool"));

  await sequence.execute("test shutdown");

  const componentState = lifecycleManager.getComponentState("browser-pool");
  assertEquals(componentState?.state, RuntimeState.STOPPED);
});

Deno.test("ShutdownSequence - execute rejects if already running", async () => {
  const lifecycleManager = new LifecycleManager();
  lifecycleManager.registerComponent("browser-pool");

  const sequence = new ShutdownSequence(lifecycleManager);

  sequence.registerStep(
    createTestStep("slow-step", "browser-pool", {
      execute: async () => {
        await new Promise((r) => setTimeout(r, 100));
      },
    }),
  );

  // Start shutdown
  const promise1 = sequence.execute("test shutdown 1");

  // Try to start another
  await assertRejects(
    () => sequence.execute("test shutdown 2"),
    Error,
    "already in progress",
  );

  await promise1;
});

// ============================================================================
// Error Handling Tests
// ============================================================================

Deno.test("ShutdownSequence - execute handles step errors", async () => {
  const lifecycleManager = new LifecycleManager();
  lifecycleManager.registerComponent("browser-pool");

  const sequence = new ShutdownSequence(lifecycleManager);

  sequence.registerStep(
    createTestStep("failing-step", "browser-pool", {
      execute: async () => {
        throw new Error("Shutdown failed");
      },
    }),
  );

  const results = await sequence.execute("test shutdown");

  assertEquals(results[0].success, false);
  assertExists(results[0].error);
  assertEquals(results[0].error?.message, "Shutdown failed");
});

Deno.test("ShutdownSequence - execute updates component state to ERROR on failure", async () => {
  const lifecycleManager = new LifecycleManager();
  lifecycleManager.registerComponent("browser-pool");

  const sequence = new ShutdownSequence(lifecycleManager);

  sequence.registerStep(
    createTestStep("failing-step", "browser-pool", {
      graceful: false, // Don't trigger force shutdown
      execute: async () => {
        throw new Error("Shutdown failed");
      },
    }),
  );

  await sequence.execute("test shutdown");

  const componentState = lifecycleManager.getComponentState("browser-pool");
  assertEquals(componentState?.state, RuntimeState.ERROR);
});

Deno.test("ShutdownSequence - execute continues after step failure", async () => {
  const lifecycleManager = new LifecycleManager();
  lifecycleManager.registerComponent("browser-pool");
  lifecycleManager.registerComponent("query-engine");

  const sequence = new ShutdownSequence(lifecycleManager);

  const executionOrder: string[] = [];

  sequence.registerStep(
    createTestStep("step-1", "browser-pool", {
      graceful: false,
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

  await sequence.execute("test shutdown");

  // Both steps executed (step-2 first in reverse order)
  assertEquals(executionOrder, ["step-2", "step-1"]);
});

// ============================================================================
// Timeout Tests
// ============================================================================

Deno.test({
  name: "ShutdownSequence - execute handles step timeout",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const lifecycleManager = new LifecycleManager();
    lifecycleManager.registerComponent("browser-pool");

    const sequence = new ShutdownSequence(lifecycleManager, {
      forceOnTimeout: false,
    });

    sequence.registerStep(
      createTestStep("slow-step", "browser-pool", {
        timeout: 50,
        graceful: false,
        execute: async () => {
          await new Promise((r) => setTimeout(r, 200));
        },
      }),
    );

    const results = await sequence.execute("test shutdown");

    assertEquals(results[0].success, false);
    assertEquals(results[0].timedOut, true);
  },
});

Deno.test({
  name: "ShutdownSequence - execute force shuts down on graceful timeout",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const lifecycleManager = new LifecycleManager();
    lifecycleManager.registerComponent("browser-pool");

    const sequence = new ShutdownSequence(lifecycleManager, {
      forceOnTimeout: true,
      forceShutdownDelay: 10,
    });

    sequence.registerStep(
      createTestStep("slow-step", "browser-pool", {
        timeout: 50,
        graceful: true, // Will trigger force shutdown
        execute: async () => {
          await new Promise((r) => setTimeout(r, 200));
        },
      }),
    );

    const results = await sequence.execute("test shutdown");

    assertEquals(results[0].success, true);
    assertEquals(results[0].forced, true);
  },
});

// ============================================================================
// Progress Callback Tests
// ============================================================================

Deno.test("ShutdownSequence - execute calls progress callback", async () => {
  const lifecycleManager = new LifecycleManager();
  lifecycleManager.registerComponent("browser-pool");
  lifecycleManager.registerComponent("query-engine");

  const sequence = new ShutdownSequence(lifecycleManager);

  sequence.registerStep(createTestStep("step-1", "browser-pool"));
  sequence.registerStep(createTestStep("step-2", "query-engine"));

  const progressUpdates: ShutdownProgress[] = [];

  await sequence.execute("test shutdown", (progress) => {
    progressUpdates.push({ ...progress });
  });

  // Should have updates for each step plus completion
  assertEquals(progressUpdates.length >= 2, true);
  assertEquals(progressUpdates[0].totalSteps, 2);
});

Deno.test("ShutdownSequence - execute reports elapsed and remaining time", async () => {
  const lifecycleManager = new LifecycleManager();
  lifecycleManager.registerComponent("browser-pool");

  const sequence = new ShutdownSequence(lifecycleManager, {
    totalTimeout: 10000,
  });

  sequence.registerStep(
    createTestStep("step-1", "browser-pool", {
      execute: async () => {
        await new Promise((r) => setTimeout(r, 50));
      },
    }),
  );

  let lastProgress: ShutdownProgress | undefined = undefined;

  await sequence.execute("test shutdown", (progress) => {
    lastProgress = { ...progress };
  });

  assertExists(lastProgress);
  assertEquals((lastProgress as ShutdownProgress).percentage, 100);
});

// ============================================================================
// Abort Tests
// ============================================================================

Deno.test({
  name: "ShutdownSequence - abort forces remaining steps",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const lifecycleManager = new LifecycleManager();
    lifecycleManager.registerComponent("browser-pool");
    lifecycleManager.registerComponent("query-engine");

    const sequence = new ShutdownSequence(lifecycleManager, {
      forceShutdownDelay: 10,
    });

    // Register steps in order that after reversal, step-2 runs first (fast),
    // then slow-step runs. Since abort is checked at the START of each step,
    // we need a fast step to complete, abort to fire, then remaining steps get forced.
    //
    // Registration order: slow-step, step-2
    // Execution order (reversed): step-2 (executes), slow-step (should be forced)
    //
    // We'll make step-2 take 100ms so abort (at 50ms) happens during step-2,
    // then slow-step will be checked for abort at the start and get forced.
    sequence.registerStep(
      createTestStep("slow-step", "browser-pool", {
        execute: async () => {
          await new Promise((r) => setTimeout(r, 200));
        },
      }),
    );
    sequence.registerStep(
      createTestStep("step-2", "query-engine", {
        execute: async () => {
          await new Promise((r) => setTimeout(r, 100));
        },
      }),
    );

    // Start shutdown then abort
    const promise = sequence.execute("test shutdown");

    // Abort after step-2 starts but before it finishes
    setTimeout(() => {
      sequence.abort();
    }, 50);

    const results = await promise;

    // slow-step should be forced since abort was triggered during step-2
    const forcedSteps = results.filter((r) => r.forced);
    assertEquals(forcedSteps.length >= 1, true);
  },
});

// ============================================================================
// Result Query Tests
// ============================================================================

Deno.test("ShutdownSequence - getResults returns execution results", async () => {
  const lifecycleManager = new LifecycleManager();
  lifecycleManager.registerComponent("browser-pool");

  const sequence = new ShutdownSequence(lifecycleManager);

  sequence.registerStep(createTestStep("step-1", "browser-pool"));

  await sequence.execute("test shutdown");

  const results = sequence.getResults();
  assertEquals(results.size, 1);
  assertEquals(results.get("step-1")?.success, true);
});

Deno.test("ShutdownSequence - isSuccessful returns true when all succeed", async () => {
  const lifecycleManager = new LifecycleManager();
  lifecycleManager.registerComponent("browser-pool");

  const sequence = new ShutdownSequence(lifecycleManager);

  sequence.registerStep(createTestStep("step-1", "browser-pool"));

  await sequence.execute("test shutdown");

  assertEquals(sequence.isSuccessful(), true);
});

Deno.test("ShutdownSequence - isSuccessful returns false when any fails", async () => {
  const lifecycleManager = new LifecycleManager();
  lifecycleManager.registerComponent("browser-pool");

  const sequence = new ShutdownSequence(lifecycleManager);

  sequence.registerStep(
    createTestStep("failing-step", "browser-pool", {
      graceful: false,
      execute: async () => {
        throw new Error("Failed");
      },
    }),
  );

  await sequence.execute("test shutdown");

  assertEquals(sequence.isSuccessful(), false);
});

Deno.test("ShutdownSequence - getFailedSteps returns failed steps", async () => {
  const lifecycleManager = new LifecycleManager();
  lifecycleManager.registerComponent("browser-pool");

  const sequence = new ShutdownSequence(lifecycleManager);

  sequence.registerStep(
    createTestStep("failing-step", "browser-pool", {
      graceful: false,
      execute: async () => {
        throw new Error("Failed");
      },
    }),
  );

  await sequence.execute("test shutdown");

  const failedSteps = sequence.getFailedSteps();
  assertEquals(failedSteps.length, 1);
  assertEquals(failedSteps[0].step.name, "failing-step");
});

Deno.test("ShutdownSequence - getTotalDuration returns sum of durations", async () => {
  const lifecycleManager = new LifecycleManager();
  lifecycleManager.registerComponent("browser-pool");
  lifecycleManager.registerComponent("query-engine");

  const sequence = new ShutdownSequence(lifecycleManager);

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

  await sequence.execute("test shutdown");

  assertEquals(sequence.getTotalDuration() >= 40, true);
});

// ============================================================================
// Reset Tests
// ============================================================================

Deno.test("ShutdownSequence - reset clears results", async () => {
  const lifecycleManager = new LifecycleManager();
  lifecycleManager.registerComponent("browser-pool");

  const sequence = new ShutdownSequence(lifecycleManager);

  sequence.registerStep(createTestStep("step-1", "browser-pool"));

  await sequence.execute("test shutdown");
  assertEquals(sequence.getResults().size, 1);

  sequence.reset();
  assertEquals(sequence.getResults().size, 0);
});

Deno.test("ShutdownSequence - reset rejects if shutdown in progress", async () => {
  const lifecycleManager = new LifecycleManager();
  lifecycleManager.registerComponent("browser-pool");

  const sequence = new ShutdownSequence(lifecycleManager);

  sequence.registerStep(
    createTestStep("slow-step", "browser-pool", {
      execute: async () => {
        await new Promise((r) => setTimeout(r, 100));
      },
    }),
  );

  const promise = sequence.execute("test shutdown");

  assertThrows(
    () => sequence.reset(),
    Error,
    "Cannot reset while shutdown is in progress",
  );

  await promise;
});

// ============================================================================
// Event Listener Tests
// ============================================================================

Deno.test("ShutdownSequence - emits shutdown_initiated event", async () => {
  const lifecycleManager = new LifecycleManager();
  lifecycleManager.registerComponent("browser-pool");

  const sequence = new ShutdownSequence(lifecycleManager);

  const events: RuntimeEvent[] = [];
  sequence.addEventListener((event) => events.push(event));

  sequence.registerStep(createTestStep("step-1", "browser-pool"));
  await sequence.execute("test shutdown");

  const initiatedEvent = events.find((e) => e.type === "shutdown_initiated");
  assertExists(initiatedEvent);
});

Deno.test("ShutdownSequence - emits component_stopping event", async () => {
  const lifecycleManager = new LifecycleManager();
  lifecycleManager.registerComponent("browser-pool");

  const sequence = new ShutdownSequence(lifecycleManager);

  const events: RuntimeEvent[] = [];
  sequence.addEventListener((event) => events.push(event));

  sequence.registerStep(createTestStep("step-1", "browser-pool"));
  await sequence.execute("test shutdown");

  const stoppingEvent = events.find((e) => e.type === "component_stopping");
  assertExists(stoppingEvent);
});

Deno.test("ShutdownSequence - emits component_stopped event on success", async () => {
  const lifecycleManager = new LifecycleManager();
  lifecycleManager.registerComponent("browser-pool");

  const sequence = new ShutdownSequence(lifecycleManager);

  const events: RuntimeEvent[] = [];
  sequence.addEventListener((event) => events.push(event));

  sequence.registerStep(createTestStep("step-1", "browser-pool"));
  await sequence.execute("test shutdown");

  const stoppedEvent = events.find((e) => e.type === "component_stopped");
  assertExists(stoppedEvent);
});

Deno.test("ShutdownSequence - emits shutdown_complete event", async () => {
  const lifecycleManager = new LifecycleManager();
  lifecycleManager.registerComponent("browser-pool");

  const sequence = new ShutdownSequence(lifecycleManager);

  const events: RuntimeEvent[] = [];
  sequence.addEventListener((event) => events.push(event));

  sequence.registerStep(createTestStep("step-1", "browser-pool"));
  await sequence.execute("test shutdown");

  const completeEvent = events.find((e) => e.type === "shutdown_complete");
  assertExists(completeEvent);
});

Deno.test("ShutdownSequence - removeEventListener stops event delivery", async () => {
  const lifecycleManager = new LifecycleManager();
  lifecycleManager.registerComponent("browser-pool");

  const sequence = new ShutdownSequence(lifecycleManager);

  const events: RuntimeEvent[] = [];
  const listener = (event: RuntimeEvent) => events.push(event);

  sequence.addEventListener(listener);
  sequence.removeEventListener(listener);

  sequence.registerStep(createTestStep("step-1", "browser-pool"));
  await sequence.execute("test shutdown");

  assertEquals(events.length, 0);
});
