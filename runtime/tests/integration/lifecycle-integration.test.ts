/**
 * Lifecycle Integration Tests
 *
 * Tests for component lifecycle management including:
 * - Startup sequence coordination
 * - Shutdown sequence coordination
 * - State propagation across components
 * - Error handling during lifecycle transitions
 */

import {
  assertEquals,
  assertExists,
  assertRejects,
} from "@std/assert";

import { BrowserXRuntime } from "../../src/BrowserXRuntime.ts";
import { RuntimeState, type RuntimeEvent } from "../../src/types.ts";
import { createTestConfig } from "../../src/config/RuntimeConfig.ts";
import { LifecycleManager } from "../../src/lifecycle/LifecycleManager.ts";
import { InitializationSequence } from "../../src/lifecycle/InitializationSequence.ts";
import { ShutdownSequence } from "../../src/lifecycle/ShutdownSequence.ts";

// ============================================================================
// LifecycleManager + InitializationSequence Integration
// ============================================================================

Deno.test({
  name: "Integration - LifecycleManager coordinates with InitializationSequence",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const lifecycleManager = new LifecycleManager();
    const initSequence = new InitializationSequence(lifecycleManager);

    // Register components
    lifecycleManager.registerComponent("metrics-collector");
    lifecycleManager.registerComponent("event-coordinator");
    lifecycleManager.registerComponent("browser-pool");

    // Register initialization steps
    initSequence.registerStep({
      name: "Init metrics",
      component: "metrics-collector",
      execute: async () => {
        await new Promise((r) => setTimeout(r, 10));
      },
      dependencies: [],
    });

    initSequence.registerStep({
      name: "Init event coordinator",
      component: "event-coordinator",
      execute: async () => {
        await new Promise((r) => setTimeout(r, 10));
      },
      dependencies: ["metrics-collector"],
    });

    initSequence.registerStep({
      name: "Init browser pool",
      component: "browser-pool",
      execute: async () => {
        await new Promise((r) => setTimeout(r, 10));
      },
      dependencies: ["event-coordinator"],
    });

    // Transition to starting
    lifecycleManager.transition(RuntimeState.STARTING);

    // Execute initialization
    const results = await initSequence.execute();

    // All steps should succeed
    assertEquals(results.every((r) => r.success), true);

    // All component states should be updated
    assertEquals(
      lifecycleManager.getComponentState("metrics-collector")?.state,
      RuntimeState.RUNNING,
    );
    assertEquals(
      lifecycleManager.getComponentState("event-coordinator")?.state,
      RuntimeState.RUNNING,
    );
    assertEquals(
      lifecycleManager.getComponentState("browser-pool")?.state,
      RuntimeState.RUNNING,
    );
  },
});

Deno.test({
  name: "Integration - LifecycleManager coordinates with ShutdownSequence",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const lifecycleManager = new LifecycleManager();
    const shutdownSequence = new ShutdownSequence(lifecycleManager, {
      totalTimeout: 10000,
      defaultStepTimeout: 5000,
    });

    // Register components as running
    lifecycleManager.registerComponent("browser-pool");
    lifecycleManager.registerComponent("event-coordinator");
    lifecycleManager.registerComponent("metrics-collector");

    lifecycleManager.updateComponentState("browser-pool", RuntimeState.RUNNING);
    lifecycleManager.updateComponentState("event-coordinator", RuntimeState.RUNNING);
    lifecycleManager.updateComponentState("metrics-collector", RuntimeState.RUNNING);

    // Register shutdown steps (reverse order)
    shutdownSequence.registerStep({
      name: "Shutdown browser pool",
      component: "browser-pool",
      execute: async () => {
        await new Promise((r) => setTimeout(r, 10));
      },
      timeout: 5000,
    });

    shutdownSequence.registerStep({
      name: "Shutdown event coordinator",
      component: "event-coordinator",
      execute: async () => {
        await new Promise((r) => setTimeout(r, 10));
      },
      timeout: 5000,
    });

    shutdownSequence.registerStep({
      name: "Shutdown metrics",
      component: "metrics-collector",
      execute: async () => {
        await new Promise((r) => setTimeout(r, 10));
      },
      timeout: 5000,
    });

    // Transition lifecycle to stopping
    lifecycleManager.transition(RuntimeState.STARTING);
    lifecycleManager.transition(RuntimeState.RUNNING);
    lifecycleManager.transition(RuntimeState.STOPPING);

    // Execute shutdown
    const results = await shutdownSequence.execute("Test shutdown");

    // All steps should succeed
    assertEquals(results.every((r) => r.success), true);

    // All component states should be stopped
    assertEquals(
      lifecycleManager.getComponentState("browser-pool")?.state,
      RuntimeState.STOPPED,
    );
    assertEquals(
      lifecycleManager.getComponentState("event-coordinator")?.state,
      RuntimeState.STOPPED,
    );
    assertEquals(
      lifecycleManager.getComponentState("metrics-collector")?.state,
      RuntimeState.STOPPED,
    );
  },
});

// ============================================================================
// Full Lifecycle Cycle Tests
// ============================================================================

Deno.test({
  name: "Integration - Full lifecycle cycle (init -> run -> shutdown)",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const lifecycleManager = new LifecycleManager();
    const initSequence = new InitializationSequence(lifecycleManager);
    const shutdownSequence = new ShutdownSequence(lifecycleManager, {
      totalTimeout: 10000,
      defaultStepTimeout: 5000,
    });

    const executionOrder: string[] = [];

    // Register components
    lifecycleManager.registerComponent("metrics-collector");
    lifecycleManager.registerComponent("event-coordinator");

    // Register init steps
    initSequence.registerStep({
      name: "Init metrics",
      component: "metrics-collector",
      execute: async () => {
        executionOrder.push("init:metrics");
        await new Promise((r) => setTimeout(r, 5));
      },
      dependencies: [],
    });

    initSequence.registerStep({
      name: "Init events",
      component: "event-coordinator",
      execute: async () => {
        executionOrder.push("init:events");
        await new Promise((r) => setTimeout(r, 5));
      },
      dependencies: ["metrics-collector"],
    });

    // Register shutdown steps (reversed order - metrics first so it executes last after reversal)
    // ShutdownSequence reverses registration order, so register metrics first -> events second
    // After reversal: events executes first, then metrics
    shutdownSequence.registerStep({
      name: "Shutdown metrics",
      component: "metrics-collector",
      execute: async () => {
        executionOrder.push("shutdown:metrics");
        await new Promise((r) => setTimeout(r, 5));
      },
      timeout: 5000,
    });

    shutdownSequence.registerStep({
      name: "Shutdown events",
      component: "event-coordinator",
      execute: async () => {
        executionOrder.push("shutdown:events");
        await new Promise((r) => setTimeout(r, 5));
      },
      timeout: 5000,
    });

    // Execute full lifecycle
    lifecycleManager.transition(RuntimeState.STARTING);
    await initSequence.execute();
    lifecycleManager.transition(RuntimeState.RUNNING);

    // Verify running state
    assertEquals(lifecycleManager.getState(), RuntimeState.RUNNING);

    // Shutdown
    lifecycleManager.transition(RuntimeState.STOPPING);
    await shutdownSequence.execute("Test complete");
    lifecycleManager.transition(RuntimeState.STOPPED);

    // Verify execution order
    assertEquals(executionOrder, [
      "init:metrics",
      "init:events",
      "shutdown:events",
      "shutdown:metrics",
    ]);
  },
});

// ============================================================================
// Error Propagation Tests
// ============================================================================

Deno.test({
  name: "Integration - Initialization failure propagates to lifecycle",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const lifecycleManager = new LifecycleManager();
    const initSequence = new InitializationSequence(lifecycleManager);

    lifecycleManager.registerComponent("metrics-collector");
    lifecycleManager.registerComponent("browser-pool");

    initSequence.registerStep({
      name: "Init metrics",
      component: "metrics-collector",
      execute: async () => {
        await new Promise((r) => setTimeout(r, 5));
      },
      dependencies: [],
    });

    initSequence.registerStep({
      name: "Init browser pool",
      component: "browser-pool",
      execute: async () => {
        throw new Error("Browser pool initialization failed");
      },
      dependencies: ["metrics-collector"],
    });

    lifecycleManager.transition(RuntimeState.STARTING);
    const results = await initSequence.execute();

    // First step succeeds
    assertEquals(results[0].success, true);

    // Second step fails
    assertEquals(results[1].success, false);
    assertExists(results[1].error);

    // Browser pool should be in error state
    assertEquals(
      lifecycleManager.getComponentState("browser-pool")?.state,
      RuntimeState.ERROR,
    );
  },
});

Deno.test({
  name: "Integration - Shutdown continues after step failure",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const lifecycleManager = new LifecycleManager();
    const shutdownSequence = new ShutdownSequence(lifecycleManager, {
      totalTimeout: 10000,
      defaultStepTimeout: 5000,
    });

    lifecycleManager.registerComponent("browser-pool");
    lifecycleManager.registerComponent("metrics-collector");
    lifecycleManager.updateComponentState("browser-pool", RuntimeState.RUNNING);
    lifecycleManager.updateComponentState("metrics-collector", RuntimeState.RUNNING);

    let metricsShutdownCalled = false;

    // ShutdownSequence reverses registration order
    // Register metrics first (so it executes second after reversal)
    // Register browser-pool second (so it executes first after reversal and fails)
    shutdownSequence.registerStep({
      name: "Shutdown metrics",
      component: "metrics-collector",
      execute: async () => {
        metricsShutdownCalled = true;
        await new Promise((r) => setTimeout(r, 5));
      },
      timeout: 5000,
    });

    shutdownSequence.registerStep({
      name: "Shutdown browser pool",
      component: "browser-pool",
      execute: async () => {
        throw new Error("Browser pool shutdown failed");
      },
      timeout: 5000,
    });

    lifecycleManager.transition(RuntimeState.STARTING);
    lifecycleManager.transition(RuntimeState.RUNNING);
    lifecycleManager.transition(RuntimeState.STOPPING);

    const results = await shutdownSequence.execute("Test shutdown");

    // First step fails but second continues
    assertEquals(results[0].success, false);
    assertEquals(results[1].success, true);
    assertEquals(metricsShutdownCalled, true);
  },
});

// ============================================================================
// State History Integration Tests
// ============================================================================

Deno.test({
  name: "Integration - State history tracks lifecycle transitions",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const lifecycleManager = new LifecycleManager();
    const initSequence = new InitializationSequence(lifecycleManager);
    const shutdownSequence = new ShutdownSequence(lifecycleManager);

    lifecycleManager.registerComponent("metrics-collector");

    initSequence.registerStep({
      name: "Init metrics",
      component: "metrics-collector",
      execute: async () => {},
      dependencies: [],
    });

    shutdownSequence.registerStep({
      name: "Shutdown metrics",
      component: "metrics-collector",
      execute: async () => {},
      timeout: 5000,
    });

    // Execute lifecycle
    lifecycleManager.transition(RuntimeState.STARTING);
    await initSequence.execute();
    lifecycleManager.transition(RuntimeState.RUNNING);
    lifecycleManager.transition(RuntimeState.STOPPING);
    await shutdownSequence.execute("Test");
    lifecycleManager.transition(RuntimeState.STOPPED);

    // Check history
    const history = lifecycleManager.getStateHistory();
    assertEquals(history.length, 4);
    assertEquals(history[0].state, RuntimeState.STARTING);
    assertEquals(history[1].state, RuntimeState.RUNNING);
    assertEquals(history[2].state, RuntimeState.STOPPING);
    assertEquals(history[3].state, RuntimeState.STOPPED);
  },
});

// ============================================================================
// Progress Callback Integration Tests
// ============================================================================

Deno.test({
  name: "Integration - Initialization progress reflects component order",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const lifecycleManager = new LifecycleManager();
    const initSequence = new InitializationSequence(lifecycleManager);

    lifecycleManager.registerComponent("metrics-collector");
    lifecycleManager.registerComponent("event-coordinator");
    lifecycleManager.registerComponent("browser-pool");

    initSequence.registerStep({
      name: "Init metrics",
      component: "metrics-collector",
      execute: async () => {},
      dependencies: [],
    });

    initSequence.registerStep({
      name: "Init events",
      component: "event-coordinator",
      execute: async () => {},
      dependencies: ["metrics-collector"],
    });

    initSequence.registerStep({
      name: "Init browser",
      component: "browser-pool",
      execute: async () => {},
      dependencies: ["event-coordinator"],
    });

    const progressUpdates: number[] = [];

    lifecycleManager.transition(RuntimeState.STARTING);
    await initSequence.execute((progress) => {
      progressUpdates.push(progress.percentage);
    });

    // Should have incremental progress
    assertEquals(progressUpdates.length >= 3, true);
    // Progress should generally increase
    for (let i = 1; i < progressUpdates.length; i++) {
      assertEquals(progressUpdates[i] >= progressUpdates[i - 1], true);
    }
  },
});

// ============================================================================
// Event Propagation Integration Tests
// ============================================================================

Deno.test({
  name: "Integration - Events flow from InitializationSequence to listeners",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const lifecycleManager = new LifecycleManager();
    const initSequence = new InitializationSequence(lifecycleManager);

    lifecycleManager.registerComponent("metrics-collector");

    initSequence.registerStep({
      name: "Init metrics",
      component: "metrics-collector",
      execute: async () => {},
      dependencies: [],
    });

    const events: RuntimeEvent[] = [];
    initSequence.addEventListener((event) => {
      events.push(event);
    });

    lifecycleManager.transition(RuntimeState.STARTING);
    await initSequence.execute();

    // Should have component events
    const startingEvents = events.filter((e) => e.type === "component_starting");
    const startedEvents = events.filter((e) => e.type === "component_started");

    assertEquals(startingEvents.length >= 1, true);
    assertEquals(startedEvents.length >= 1, true);
  },
});

Deno.test({
  name: "Integration - Events flow from ShutdownSequence to listeners",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const lifecycleManager = new LifecycleManager();
    const shutdownSequence = new ShutdownSequence(lifecycleManager);

    lifecycleManager.registerComponent("metrics-collector");
    lifecycleManager.updateComponentState("metrics-collector", RuntimeState.RUNNING);

    shutdownSequence.registerStep({
      name: "Shutdown metrics",
      component: "metrics-collector",
      execute: async () => {},
      timeout: 5000,
    });

    const events: RuntimeEvent[] = [];
    shutdownSequence.addEventListener((event) => {
      events.push(event);
    });

    lifecycleManager.transition(RuntimeState.STARTING);
    lifecycleManager.transition(RuntimeState.RUNNING);
    lifecycleManager.transition(RuntimeState.STOPPING);
    await shutdownSequence.execute("Test");

    // Should have shutdown events
    const initiatedEvents = events.filter((e) => e.type === "shutdown_initiated");
    const stoppingEvents = events.filter((e) => e.type === "component_stopping");
    const completeEvents = events.filter((e) => e.type === "shutdown_complete");

    assertEquals(initiatedEvents.length, 1);
    assertEquals(stoppingEvents.length >= 1, true);
    assertEquals(completeEvents.length, 1);
  },
});

// ============================================================================
// Dependency Chain Integration Tests
// ============================================================================

Deno.test({
  name: "Integration - Complex dependency chains resolve correctly",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const lifecycleManager = new LifecycleManager();
    const initSequence = new InitializationSequence(lifecycleManager);

    const executionOrder: string[] = [];

    // Register 5 components with complex dependencies
    //
    // metrics (no deps)
    //    |
    //    v
    // logging (depends on metrics)
    //    |
    //    +-----+-----+
    //    v     v     v
    // events  db   cache  (all depend on logging)
    //

    lifecycleManager.registerComponent("metrics-collector");
    lifecycleManager.registerComponent("event-coordinator");
    lifecycleManager.registerComponent("browser-pool");
    lifecycleManager.registerComponent("query-engine");
    lifecycleManager.registerComponent("resource-manager");

    initSequence.registerStep({
      name: "Init metrics",
      component: "metrics-collector",
      execute: async () => {
        executionOrder.push("metrics");
      },
      dependencies: [],
    });

    initSequence.registerStep({
      name: "Init resource manager",
      component: "resource-manager",
      execute: async () => {
        executionOrder.push("resource-manager");
      },
      dependencies: ["metrics-collector"],
    });

    initSequence.registerStep({
      name: "Init events",
      component: "event-coordinator",
      execute: async () => {
        executionOrder.push("events");
      },
      dependencies: ["resource-manager"],
    });

    initSequence.registerStep({
      name: "Init browser",
      component: "browser-pool",
      execute: async () => {
        executionOrder.push("browser");
      },
      dependencies: ["resource-manager"],
    });

    initSequence.registerStep({
      name: "Init query",
      component: "query-engine",
      execute: async () => {
        executionOrder.push("query");
      },
      dependencies: ["resource-manager"],
    });

    lifecycleManager.transition(RuntimeState.STARTING);
    await initSequence.execute();

    // Metrics must be first
    assertEquals(executionOrder[0], "metrics");

    // Resource manager must be second (depends on metrics)
    assertEquals(executionOrder[1], "resource-manager");

    // Events, browser, query can be in any order but must be after resource-manager
    const afterResourceManager = executionOrder.slice(2);
    assertEquals(afterResourceManager.includes("events"), true);
    assertEquals(afterResourceManager.includes("browser"), true);
    assertEquals(afterResourceManager.includes("query"), true);
  },
});

// ============================================================================
// Concurrent Operations Integration Tests
// ============================================================================

Deno.test({
  name: "Integration - Multiple sequential lifecycle cycles work correctly",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    for (let cycle = 0; cycle < 3; cycle++) {
      const lifecycleManager = new LifecycleManager();
      const initSequence = new InitializationSequence(lifecycleManager);
      const shutdownSequence = new ShutdownSequence(lifecycleManager);

      lifecycleManager.registerComponent("metrics-collector");

      initSequence.registerStep({
        name: "Init metrics",
        component: "metrics-collector",
        execute: async () => {},
        dependencies: [],
      });

      shutdownSequence.registerStep({
        name: "Shutdown metrics",
        component: "metrics-collector",
        execute: async () => {},
        timeout: 5000,
      });

      // Start
      lifecycleManager.transition(RuntimeState.STARTING);
      await initSequence.execute();
      lifecycleManager.transition(RuntimeState.RUNNING);

      assertEquals(lifecycleManager.getState(), RuntimeState.RUNNING);
      assertEquals(
        lifecycleManager.getComponentState("metrics-collector")?.state,
        RuntimeState.RUNNING,
      );

      // Stop
      lifecycleManager.transition(RuntimeState.STOPPING);
      await shutdownSequence.execute("Cycle " + cycle);
      lifecycleManager.transition(RuntimeState.STOPPED);

      assertEquals(lifecycleManager.getState(), RuntimeState.STOPPED);
      assertEquals(
        lifecycleManager.getComponentState("metrics-collector")?.state,
        RuntimeState.STOPPED,
      );
    }
  },
});
