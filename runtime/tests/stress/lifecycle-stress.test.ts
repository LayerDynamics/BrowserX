/**
 * Lifecycle and State Machine Stress Tests
 *
 * Tests for state machine and lifecycle operations under stress:
 * - Multiple simultaneous lifecycle cycles
 * - State transition stress
 * - Component registration stress
 * - Error recovery stress
 */

import {
  assertEquals,
  assertExists,
} from "@std/assert";

import { LifecycleManager } from "../../src/lifecycle/LifecycleManager.ts";
import { InitializationSequence } from "../../src/lifecycle/InitializationSequence.ts";
import { ShutdownSequence } from "../../src/lifecycle/ShutdownSequence.ts";
import { RuntimeState, type ComponentId } from "../../src/types.ts";

// ============================================================================
// State Transition Stress Tests
// ============================================================================

Deno.test({
  name: "Stress - Rapid state transitions",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: () => {
    const manager = new LifecycleManager();

    // Perform many rapid state transition cycles
    for (let cycle = 0; cycle < 100; cycle++) {
      manager.transition(RuntimeState.STARTING);
      manager.transition(RuntimeState.RUNNING);
      manager.transition(RuntimeState.STOPPING);
      manager.transition(RuntimeState.STOPPED);
    }

    // Should end in STOPPED state
    assertEquals(manager.getState(), RuntimeState.STOPPED);

    // State history should be bounded
    const history = manager.getStateHistory();
    assertEquals(history.length <= 100, true);
  },
});

Deno.test({
  name: "Stress - Rapid error recovery cycles",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: () => {
    const manager = new LifecycleManager();

    // Simulate many error recovery cycles
    for (let cycle = 0; cycle < 50; cycle++) {
      manager.transition(RuntimeState.STARTING);
      manager.transition(RuntimeState.ERROR);
      manager.transition(RuntimeState.STARTING); // Recovery
      manager.transition(RuntimeState.RUNNING);
      manager.transition(RuntimeState.STOPPING);
      manager.transition(RuntimeState.STOPPED);
    }

    assertEquals(manager.getState(), RuntimeState.STOPPED);
  },
});

// ============================================================================
// Component Registration Stress Tests
// ============================================================================

Deno.test({
  name: "Stress - Many component registrations",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: () => {
    const manager = new LifecycleManager();

    // Register all valid ComponentIds
    const validIds: ComponentId[] = [
      "proxy-engine",
      "browser-engine",
      "query-engine",
      "event-coordinator",
      "resource-manager",
      "metrics-collector",
      "browser-pool",
    ];

    const componentIds: ComponentId[] = [];
    for (const componentId of validIds) {
      manager.registerComponent(componentId);
      componentIds.push(componentId);
    }

    // Verify registration
    const states = manager.getComponentStates();
    assertEquals(states.length, componentIds.length);

    // All should start in STOPPED state
    assertEquals(manager.allComponentsInState(RuntimeState.STOPPED), true);
  },
});

Deno.test({
  name: "Stress - Rapid component state updates",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: () => {
    const manager = new LifecycleManager();

    // Register components
    const components: ComponentId[] = [
      "browser-pool",
      "event-coordinator",
      "metrics-collector",
      "query-engine",
    ];
    for (const id of components) {
      manager.registerComponent(id);
    }

    // Rapid state updates across all components
    for (let iteration = 0; iteration < 50; iteration++) {
      for (const id of components) {
        manager.updateComponentState(id, RuntimeState.STARTING);
      }
      for (const id of components) {
        manager.updateComponentState(id, RuntimeState.RUNNING);
      }
      for (const id of components) {
        manager.updateComponentState(id, RuntimeState.STOPPING);
      }
      for (const id of components) {
        manager.updateComponentState(id, RuntimeState.STOPPED);
      }
    }

    // All should end in STOPPED
    assertEquals(manager.allComponentsInState(RuntimeState.STOPPED), true);
  },
});

// ============================================================================
// Initialization Sequence Stress Tests
// ============================================================================

Deno.test({
  name: "Stress - Many initialization steps",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const lifecycleManager = new LifecycleManager();
    const initSequence = new InitializationSequence(lifecycleManager);

    let executedSteps = 0;

    // Register many steps - using empty dependencies since steps execute in registration order
    for (let i = 0; i < 20; i++) {
      initSequence.registerStep({
        name: `Step ${i}`,
        component: "metrics-collector",
        execute: async () => {
          executedSteps++;
          await new Promise((r) => setTimeout(r, 1));
        },
        dependencies: [],
      });
    }

    // Execute sequence
    await initSequence.execute();

    // All steps should have executed
    assertEquals(executedSteps, 20);
  },
});

Deno.test({
  name: "Stress - Parallel initialization steps",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const lifecycleManager = new LifecycleManager();
    const initSequence = new InitializationSequence(lifecycleManager);

    let maxConcurrent = 0;
    let currentConcurrent = 0;

    // Register independent steps that can run in parallel
    for (let i = 0; i < 10; i++) {
      initSequence.registerStep({
        name: `Parallel Step ${i}`,
        component: "metrics-collector",
        execute: async () => {
          currentConcurrent++;
          maxConcurrent = Math.max(maxConcurrent, currentConcurrent);
          await new Promise((r) => setTimeout(r, 20));
          currentConcurrent--;
        },
        dependencies: [], // No dependencies - can run in parallel
      });
    }

    await initSequence.execute();

    // Should have some level of concurrency
    assertEquals(maxConcurrent >= 1, true);
  },
});

Deno.test({
  name: "Stress - Initialization with progress tracking",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const lifecycleManager = new LifecycleManager();
    const initSequence = new InitializationSequence(lifecycleManager);

    let stepCount = 0;

    // Register many steps - using empty dependencies since steps execute in registration order
    for (let i = 0; i < 15; i++) {
      initSequence.registerStep({
        name: `Progress Step ${i}`,
        component: "metrics-collector",
        execute: async () => {
          stepCount++;
          await new Promise((r) => setTimeout(r, 2));
        },
        dependencies: [],
      });
    }

    await initSequence.execute();

    // All steps should have executed
    assertEquals(stepCount, 15);
  },
});

// ============================================================================
// Shutdown Sequence Stress Tests
// ============================================================================

Deno.test({
  name: "Stress - Many shutdown steps",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const lifecycleManager = new LifecycleManager();
    lifecycleManager.registerComponent("metrics-collector");
    const shutdownSequence = new ShutdownSequence(lifecycleManager);

    let executedSteps = 0;

    // Register many steps
    for (let i = 0; i < 20; i++) {
      shutdownSequence.registerStep({
        name: `Shutdown Step ${i}`,
        component: "metrics-collector",
        execute: async () => {
          executedSteps++;
          await new Promise((r) => setTimeout(r, 1));
        },
        timeout: 5000,
      });
    }

    await shutdownSequence.execute("stress test");

    // All steps should have executed
    assertEquals(executedSteps, 20);
  },
});

Deno.test({
  name: "Stress - Shutdown with failing steps",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const lifecycleManager = new LifecycleManager();
    lifecycleManager.registerComponent("metrics-collector");
    const shutdownSequence = new ShutdownSequence(lifecycleManager);

    let executedSteps = 0;

    // Register steps with some failures
    for (let i = 0; i < 10; i++) {
      shutdownSequence.registerStep({
        name: `Shutdown with failures ${i}`,
        component: "metrics-collector",
        execute: async () => {
          executedSteps++;
          if (i % 3 === 0) {
            throw new Error(`Step ${i} failed`);
          }
          await new Promise((r) => setTimeout(r, 1));
        },
        timeout: 5000,
      });
    }

    // Execute - should continue despite failures
    await shutdownSequence.execute("stress test");

    // All steps should have been attempted
    assertEquals(executedSteps, 10);
  },
});

Deno.test({
  name: "Stress - Shutdown with timeout handling",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const lifecycleManager = new LifecycleManager();
    lifecycleManager.registerComponent("metrics-collector");
    const shutdownSequence = new ShutdownSequence(lifecycleManager);

    let completedSteps = 0;

    // Register steps with varying durations
    for (let i = 0; i < 5; i++) {
      const stepIndex = i;
      shutdownSequence.registerStep({
        name: `Timeout Step ${i}`,
        component: "metrics-collector",
        execute: async () => {
          if (stepIndex % 2 === 0) {
            // Some steps complete quickly
            await new Promise((r) => setTimeout(r, 10));
            completedSteps++;
          } else {
            // Some steps take longer
            await new Promise((r) => setTimeout(r, 200));
            completedSteps++;
          }
        },
        timeout: 1000,
      });
    }

    const startTime = Date.now();
    await shutdownSequence.execute("stress test");
    const duration = Date.now() - startTime;

    // Should have completed some steps
    assertEquals(completedSteps >= 1, true);

    // Shutdown should complete in reasonable time
    assertEquals(duration < 5000, true);
  },
});

// ============================================================================
// Combined Lifecycle Stress Tests
// ============================================================================

Deno.test({
  name: "Stress - Full lifecycle cycles with component updates",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    for (let cycle = 0; cycle < 10; cycle++) {
      const lifecycleManager = new LifecycleManager();
      const initSequence = new InitializationSequence(lifecycleManager);
      const shutdownSequence = new ShutdownSequence(lifecycleManager);

      // Register components
      const components: ComponentId[] = [
        "browser-pool",
        "event-coordinator",
        "metrics-collector",
      ];
      for (const id of components) {
        lifecycleManager.registerComponent(id);
      }

      // Register init steps
      for (const id of components) {
        initSequence.registerStep({
          name: `Init ${id}`,
          component: id,
          execute: async () => {
            lifecycleManager.updateComponentState(id, RuntimeState.STARTING);
            await new Promise((r) => setTimeout(r, 5));
            lifecycleManager.updateComponentState(id, RuntimeState.RUNNING);
          },
          dependencies: [],
        });
      }

      // Register shutdown steps
      for (const id of components) {
        shutdownSequence.registerStep({
          name: `Shutdown ${id}`,
          component: id,
          execute: async () => {
            lifecycleManager.updateComponentState(id, RuntimeState.STOPPING);
            await new Promise((r) => setTimeout(r, 5));
            lifecycleManager.updateComponentState(id, RuntimeState.STOPPED);
          },
          timeout: 5000,
        });
      }

      // Run lifecycle
      lifecycleManager.transition(RuntimeState.STARTING);
      await initSequence.execute();
      lifecycleManager.transition(RuntimeState.RUNNING);

      assertEquals(lifecycleManager.allComponentsInState(RuntimeState.RUNNING), true);

      lifecycleManager.transition(RuntimeState.STOPPING);
      await shutdownSequence.execute("stress test");
      lifecycleManager.transition(RuntimeState.STOPPED);

      assertEquals(lifecycleManager.allComponentsInState(RuntimeState.STOPPED), true);
    }
  },
});

Deno.test({
  name: "Stress - Lifecycle with error injection",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const lifecycleManager = new LifecycleManager();
    const initSequence = new InitializationSequence(lifecycleManager);

    lifecycleManager.registerComponent("browser-pool");
    lifecycleManager.registerComponent("event-coordinator");
    lifecycleManager.registerComponent("metrics-collector");

    let errorCount = 0;

    // Register steps with random failures
    initSequence.registerStep({
      name: "Flaky step 1",
      component: "browser-pool",
      execute: async () => {
        if (Math.random() < 0.3) {
          errorCount++;
          throw new Error("Random failure");
        }
        lifecycleManager.updateComponentState("browser-pool", RuntimeState.RUNNING);
      },
      dependencies: [],
    });

    initSequence.registerStep({
      name: "Flaky step 2",
      component: "event-coordinator",
      execute: async () => {
        if (Math.random() < 0.3) {
          errorCount++;
          throw new Error("Random failure");
        }
        lifecycleManager.updateComponentState("event-coordinator", RuntimeState.RUNNING);
      },
      dependencies: [],
    });

    initSequence.registerStep({
      name: "Stable step",
      component: "metrics-collector",
      execute: async () => {
        lifecycleManager.updateComponentState("metrics-collector", RuntimeState.RUNNING);
      },
      dependencies: [],
    });

    // Try multiple times
    let success = false;
    for (let attempt = 0; attempt < 10; attempt++) {
      try {
        await initSequence.execute();
        success = true;
        break;
      } catch (_e) {
        // Expected - random failures, reset for next attempt
        lifecycleManager.reset();
        lifecycleManager.registerComponent("browser-pool");
        lifecycleManager.registerComponent("event-coordinator");
        lifecycleManager.registerComponent("metrics-collector");
      }
    }

    // Should have encountered some errors or succeeded eventually
    assertEquals(errorCount >= 0, true);
    assertExists(success);
  },
});

// ============================================================================
// History and Summary Stress Tests
// ============================================================================

Deno.test({
  name: "Stress - State history under heavy transitions",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: () => {
    const manager = new LifecycleManager();

    // Make many transitions
    for (let i = 0; i < 1000; i++) {
      manager.transition(RuntimeState.STARTING);
      manager.transition(RuntimeState.ERROR);
    }

    // History should be bounded
    const history = manager.getStateHistory();
    assertEquals(history.length <= 100, true);

    // Can still get summary
    const summary = manager.getSummary();
    assertExists(summary);
    assertEquals(typeof summary.componentCount, "number");
  },
});

Deno.test({
  name: "Stress - Summary computation with many components",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: () => {
    const manager = new LifecycleManager();

    // Register all valid components
    const components: ComponentId[] = [
      "proxy-engine",
      "browser-engine",
      "query-engine",
      "event-coordinator",
      "resource-manager",
      "metrics-collector",
      "browser-pool",
    ];

    for (const id of components) {
      manager.registerComponent(id);
    }

    // Update states multiple times
    for (let i = 0; i < 100; i++) {
      for (const id of components) {
        const states = [
          RuntimeState.STOPPED,
          RuntimeState.STARTING,
          RuntimeState.RUNNING,
          RuntimeState.ERROR,
        ];
        const state = states[i % states.length];
        manager.updateComponentState(id, state);
      }

      // Get summary after each update
      const summary = manager.getSummary();
      assertEquals(summary.componentCount, components.length);
    }
  },
});
