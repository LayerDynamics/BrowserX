/**
 * LifecycleManager Unit Tests
 *
 * Comprehensive tests for state machine transitions, component tracking,
 * and lifecycle management functionality.
 */

import {
  assertEquals,
  assertExists,
  assertThrows,
} from "@std/assert";
import { LifecycleManager } from "../../src/lifecycle/LifecycleManager.ts";
import { RuntimeState, ComponentId } from "../../src/types.ts";

// ============================================================================
// Basic Instantiation Tests
// ============================================================================

Deno.test("LifecycleManager - instantiation", () => {
  const manager = new LifecycleManager();

  assertExists(manager);
  assertEquals(manager.getState(), RuntimeState.STOPPED);
});

Deno.test("LifecycleManager - initial state is STOPPED", () => {
  const manager = new LifecycleManager();

  assertEquals(manager.getState(), RuntimeState.STOPPED);
  assertEquals(manager.isTerminal(), true);
  assertEquals(manager.isActive(), false);
});

// ============================================================================
// State Transition Tests
// ============================================================================

Deno.test("LifecycleManager - valid transition STOPPED -> STARTING", () => {
  const manager = new LifecycleManager();

  assertEquals(manager.canTransitionTo(RuntimeState.STARTING), true);

  manager.transition(RuntimeState.STARTING);
  assertEquals(manager.getState(), RuntimeState.STARTING);
});

Deno.test("LifecycleManager - valid transition STARTING -> RUNNING", () => {
  const manager = new LifecycleManager();
  manager.transition(RuntimeState.STARTING);

  assertEquals(manager.canTransitionTo(RuntimeState.RUNNING), true);

  manager.transition(RuntimeState.RUNNING);
  assertEquals(manager.getState(), RuntimeState.RUNNING);
});

Deno.test("LifecycleManager - valid transition RUNNING -> STOPPING", () => {
  const manager = new LifecycleManager();
  manager.transition(RuntimeState.STARTING);
  manager.transition(RuntimeState.RUNNING);

  assertEquals(manager.canTransitionTo(RuntimeState.STOPPING), true);

  manager.transition(RuntimeState.STOPPING);
  assertEquals(manager.getState(), RuntimeState.STOPPING);
});

Deno.test("LifecycleManager - valid transition STOPPING -> STOPPED", () => {
  const manager = new LifecycleManager();
  manager.transition(RuntimeState.STARTING);
  manager.transition(RuntimeState.RUNNING);
  manager.transition(RuntimeState.STOPPING);

  assertEquals(manager.canTransitionTo(RuntimeState.STOPPED), true);

  manager.transition(RuntimeState.STOPPED);
  assertEquals(manager.getState(), RuntimeState.STOPPED);
});

Deno.test("LifecycleManager - valid transition to ERROR from STARTING", () => {
  const manager = new LifecycleManager();
  manager.transition(RuntimeState.STARTING);

  assertEquals(manager.canTransitionTo(RuntimeState.ERROR), true);

  manager.transition(RuntimeState.ERROR);
  assertEquals(manager.getState(), RuntimeState.ERROR);
});

Deno.test("LifecycleManager - valid transition to ERROR from RUNNING", () => {
  const manager = new LifecycleManager();
  manager.transition(RuntimeState.STARTING);
  manager.transition(RuntimeState.RUNNING);

  assertEquals(manager.canTransitionTo(RuntimeState.ERROR), true);

  manager.transition(RuntimeState.ERROR);
  assertEquals(manager.getState(), RuntimeState.ERROR);
});

Deno.test("LifecycleManager - valid transition ERROR -> STOPPED", () => {
  const manager = new LifecycleManager();
  manager.transition(RuntimeState.STARTING);
  manager.transition(RuntimeState.ERROR);

  assertEquals(manager.canTransitionTo(RuntimeState.STOPPED), true);

  manager.transition(RuntimeState.STOPPED);
  assertEquals(manager.getState(), RuntimeState.STOPPED);
});

Deno.test("LifecycleManager - valid transition ERROR -> STARTING (recovery)", () => {
  const manager = new LifecycleManager();
  manager.transition(RuntimeState.STARTING);
  manager.transition(RuntimeState.ERROR);

  assertEquals(manager.canTransitionTo(RuntimeState.STARTING), true);

  manager.transition(RuntimeState.STARTING);
  assertEquals(manager.getState(), RuntimeState.STARTING);
});

Deno.test("LifecycleManager - invalid transition STOPPED -> RUNNING", () => {
  const manager = new LifecycleManager();

  assertEquals(manager.canTransitionTo(RuntimeState.RUNNING), false);

  assertThrows(
    () => manager.transition(RuntimeState.RUNNING),
    Error,
    "Invalid state transition",
  );
});

Deno.test("LifecycleManager - invalid transition STOPPED -> STOPPING", () => {
  const manager = new LifecycleManager();

  assertEquals(manager.canTransitionTo(RuntimeState.STOPPING), false);

  assertThrows(
    () => manager.transition(RuntimeState.STOPPING),
    Error,
    "Invalid state transition",
  );
});

Deno.test("LifecycleManager - invalid transition RUNNING -> STARTING", () => {
  const manager = new LifecycleManager();
  manager.transition(RuntimeState.STARTING);
  manager.transition(RuntimeState.RUNNING);

  assertEquals(manager.canTransitionTo(RuntimeState.STARTING), false);

  assertThrows(
    () => manager.transition(RuntimeState.STARTING),
    Error,
    "Invalid state transition",
  );
});

// ============================================================================
// Get Valid Transitions Tests
// ============================================================================

Deno.test("LifecycleManager - getValidTransitions from STOPPED", () => {
  const manager = new LifecycleManager();

  const valid = manager.getValidTransitions();

  assertEquals(valid.includes(RuntimeState.STARTING), true);
  assertEquals(valid.includes(RuntimeState.RUNNING), false);
  assertEquals(valid.includes(RuntimeState.STOPPING), false);
});

Deno.test("LifecycleManager - getValidTransitions from RUNNING", () => {
  const manager = new LifecycleManager();
  manager.transition(RuntimeState.STARTING);
  manager.transition(RuntimeState.RUNNING);

  const valid = manager.getValidTransitions();

  assertEquals(valid.includes(RuntimeState.STOPPING), true);
  assertEquals(valid.includes(RuntimeState.ERROR), true);
  assertEquals(valid.includes(RuntimeState.STARTING), false);
});

// ============================================================================
// State History Tests
// ============================================================================

Deno.test("LifecycleManager - tracks state history", () => {
  const manager = new LifecycleManager();
  manager.transition(RuntimeState.STARTING);
  manager.transition(RuntimeState.RUNNING);

  const history = manager.getStateHistory();

  assertEquals(history.length, 2);
  assertEquals(history[0].state, RuntimeState.STARTING);
  assertEquals(history[1].state, RuntimeState.RUNNING);
});

Deno.test("LifecycleManager - state history includes timestamps", () => {
  const manager = new LifecycleManager();
  manager.transition(RuntimeState.STARTING);

  const history = manager.getStateHistory();

  assertExists(history[0].timestamp);
  assertEquals(typeof history[0].timestamp, "number");
});

Deno.test("LifecycleManager - state history is bounded", () => {
  const manager = new LifecycleManager();

  // Make many transitions (back and forth between error and starting)
  for (let i = 0; i < 150; i++) {
    manager.transition(RuntimeState.STARTING);
    manager.transition(RuntimeState.ERROR);
  }

  const history = manager.getStateHistory();

  // Should be capped at 100
  assertEquals(history.length <= 100, true);
});

// ============================================================================
// Component Registration Tests
// ============================================================================

Deno.test("LifecycleManager - registerComponent adds component", () => {
  const manager = new LifecycleManager();
  const componentId: ComponentId = "browser-pool";

  manager.registerComponent(componentId);

  assertEquals(manager.hasComponent(componentId), true);
});

Deno.test("LifecycleManager - registerComponent rejects duplicate", () => {
  const manager = new LifecycleManager();
  const componentId: ComponentId = "browser-pool";

  manager.registerComponent(componentId);

  assertThrows(
    () => manager.registerComponent(componentId),
    Error,
    "Component already registered",
  );
});

Deno.test("LifecycleManager - hasComponent returns false for unregistered", () => {
  const manager = new LifecycleManager();

  assertEquals(manager.hasComponent("browser-pool"), false);
});

Deno.test("LifecycleManager - getComponentState returns undefined for unregistered", () => {
  const manager = new LifecycleManager();

  const state = manager.getComponentState("browser-pool");

  assertEquals(state, undefined);
});

Deno.test("LifecycleManager - getComponentState returns initial state", () => {
  const manager = new LifecycleManager();
  manager.registerComponent("browser-pool");

  const state = manager.getComponentState("browser-pool");

  assertExists(state);
  assertEquals(state.id, "browser-pool");
  assertEquals(state.state, RuntimeState.STOPPED);
});

// ============================================================================
// Component State Update Tests
// ============================================================================

Deno.test("LifecycleManager - updateComponentState updates state", () => {
  const manager = new LifecycleManager();
  manager.registerComponent("browser-pool");

  manager.updateComponentState("browser-pool", RuntimeState.STARTING);

  const state = manager.getComponentState("browser-pool");
  assertEquals(state?.state, RuntimeState.STARTING);
});

Deno.test("LifecycleManager - updateComponentState sets startedAt for RUNNING", () => {
  const manager = new LifecycleManager();
  manager.registerComponent("browser-pool");

  manager.updateComponentState("browser-pool", RuntimeState.RUNNING);

  const state = manager.getComponentState("browser-pool");
  assertExists(state?.startedAt);
});

Deno.test("LifecycleManager - updateComponentState sets stoppedAt for STOPPED", () => {
  const manager = new LifecycleManager();
  manager.registerComponent("browser-pool");

  manager.updateComponentState("browser-pool", RuntimeState.STOPPED);

  const state = manager.getComponentState("browser-pool");
  assertExists(state?.stoppedAt);
});

Deno.test("LifecycleManager - updateComponentState sets error for ERROR state", () => {
  const manager = new LifecycleManager();
  manager.registerComponent("browser-pool");

  const error = new Error("Test error");
  manager.updateComponentState("browser-pool", RuntimeState.ERROR, error);

  const state = manager.getComponentState("browser-pool");
  assertEquals(state?.state, RuntimeState.ERROR);
  assertEquals(state?.error, error);
});

Deno.test("LifecycleManager - updateComponentState rejects unregistered component", () => {
  const manager = new LifecycleManager();

  assertThrows(
    () => manager.updateComponentState("browser-pool", RuntimeState.RUNNING),
    Error,
    "Component not registered",
  );
});

Deno.test("LifecycleManager - updateComponentState can include stats", () => {
  const manager = new LifecycleManager();
  manager.registerComponent("browser-pool");

  const stats = { instances: 5, active: 3 };
  manager.updateComponentState(
    "browser-pool",
    RuntimeState.RUNNING,
    undefined,
    stats,
  );

  const state = manager.getComponentState("browser-pool");
  assertEquals(state?.stats, stats);
});

// ============================================================================
// Component Query Tests
// ============================================================================

Deno.test("LifecycleManager - getComponentStates returns all components", () => {
  const manager = new LifecycleManager();
  manager.registerComponent("browser-pool");
  manager.registerComponent("query-engine");
  manager.registerComponent("proxy-engine");

  const states = manager.getComponentStates();

  assertEquals(states.length, 3);
});

Deno.test("LifecycleManager - getComponentsInState filters by state", () => {
  const manager = new LifecycleManager();
  manager.registerComponent("browser-pool");
  manager.registerComponent("query-engine");
  manager.registerComponent("proxy-engine");

  manager.updateComponentState("browser-pool", RuntimeState.RUNNING);
  manager.updateComponentState("query-engine", RuntimeState.RUNNING);

  const running = manager.getComponentsInState(RuntimeState.RUNNING);
  const stopped = manager.getComponentsInState(RuntimeState.STOPPED);

  assertEquals(running.length, 2);
  assertEquals(stopped.length, 1);
});

Deno.test("LifecycleManager - allComponentsInState returns true when all match", () => {
  const manager = new LifecycleManager();
  manager.registerComponent("browser-pool");
  manager.registerComponent("query-engine");

  assertEquals(manager.allComponentsInState(RuntimeState.STOPPED), true);
});

Deno.test("LifecycleManager - allComponentsInState returns false when any differs", () => {
  const manager = new LifecycleManager();
  manager.registerComponent("browser-pool");
  manager.registerComponent("query-engine");

  manager.updateComponentState("browser-pool", RuntimeState.RUNNING);

  assertEquals(manager.allComponentsInState(RuntimeState.STOPPED), false);
});

Deno.test("LifecycleManager - allComponentsInState returns true for empty components", () => {
  const manager = new LifecycleManager();

  assertEquals(manager.allComponentsInState(RuntimeState.RUNNING), true);
});

Deno.test("LifecycleManager - anyComponentInState returns true when any matches", () => {
  const manager = new LifecycleManager();
  manager.registerComponent("browser-pool");
  manager.registerComponent("query-engine");

  manager.updateComponentState("browser-pool", RuntimeState.RUNNING);

  assertEquals(manager.anyComponentInState(RuntimeState.RUNNING), true);
});

Deno.test("LifecycleManager - anyComponentInState returns false when none match", () => {
  const manager = new LifecycleManager();
  manager.registerComponent("browser-pool");
  manager.registerComponent("query-engine");

  assertEquals(manager.anyComponentInState(RuntimeState.RUNNING), false);
});

Deno.test("LifecycleManager - getErroredComponents returns components with errors", () => {
  const manager = new LifecycleManager();
  manager.registerComponent("browser-pool");
  manager.registerComponent("query-engine");

  manager.updateComponentState(
    "browser-pool",
    RuntimeState.ERROR,
    new Error("Test"),
  );

  const errored = manager.getErroredComponents();

  assertEquals(errored.length, 1);
  assertEquals(errored[0].id, "browser-pool");
});

// ============================================================================
// State Check Tests
// ============================================================================

Deno.test("LifecycleManager - isTerminal returns true for STOPPED", () => {
  const manager = new LifecycleManager();

  assertEquals(manager.isTerminal(), true);
});

Deno.test("LifecycleManager - isTerminal returns true for ERROR", () => {
  const manager = new LifecycleManager();
  manager.transition(RuntimeState.STARTING);
  manager.transition(RuntimeState.ERROR);

  assertEquals(manager.isTerminal(), true);
});

Deno.test("LifecycleManager - isTerminal returns false for RUNNING", () => {
  const manager = new LifecycleManager();
  manager.transition(RuntimeState.STARTING);
  manager.transition(RuntimeState.RUNNING);

  assertEquals(manager.isTerminal(), false);
});

Deno.test("LifecycleManager - isActive returns true for STARTING", () => {
  const manager = new LifecycleManager();
  manager.transition(RuntimeState.STARTING);

  assertEquals(manager.isActive(), true);
});

Deno.test("LifecycleManager - isActive returns true for RUNNING", () => {
  const manager = new LifecycleManager();
  manager.transition(RuntimeState.STARTING);
  manager.transition(RuntimeState.RUNNING);

  assertEquals(manager.isActive(), true);
});

Deno.test("LifecycleManager - isActive returns true for STOPPING", () => {
  const manager = new LifecycleManager();
  manager.transition(RuntimeState.STARTING);
  manager.transition(RuntimeState.RUNNING);
  manager.transition(RuntimeState.STOPPING);

  assertEquals(manager.isActive(), true);
});

Deno.test("LifecycleManager - isActive returns false for STOPPED", () => {
  const manager = new LifecycleManager();

  assertEquals(manager.isActive(), false);
});

// ============================================================================
// Reset Tests
// ============================================================================

Deno.test("LifecycleManager - reset clears state to STOPPED", () => {
  const manager = new LifecycleManager();
  manager.transition(RuntimeState.STARTING);
  manager.transition(RuntimeState.RUNNING);

  manager.reset();

  assertEquals(manager.getState(), RuntimeState.STOPPED);
});

Deno.test("LifecycleManager - reset clears state history", () => {
  const manager = new LifecycleManager();
  manager.transition(RuntimeState.STARTING);
  manager.transition(RuntimeState.RUNNING);

  manager.reset();

  const history = manager.getStateHistory();
  assertEquals(history.length, 0);
});

Deno.test("LifecycleManager - reset resets component states", () => {
  const manager = new LifecycleManager();
  manager.registerComponent("browser-pool");
  manager.updateComponentState("browser-pool", RuntimeState.RUNNING);

  manager.reset();

  const state = manager.getComponentState("browser-pool");
  assertEquals(state?.state, RuntimeState.STOPPED);
  assertEquals(state?.startedAt, undefined);
});

// ============================================================================
// Summary Tests
// ============================================================================

Deno.test("LifecycleManager - getSummary returns correct counts", () => {
  const manager = new LifecycleManager();
  manager.registerComponent("browser-pool");
  manager.registerComponent("query-engine");
  manager.registerComponent("proxy-engine");

  manager.updateComponentState("browser-pool", RuntimeState.RUNNING);
  manager.updateComponentState(
    "query-engine",
    RuntimeState.ERROR,
    new Error("Test"),
  );

  const summary = manager.getSummary();

  assertEquals(summary.state, RuntimeState.STOPPED);
  assertEquals(summary.componentCount, 3);
  assertEquals(summary.runningComponents, 1);
  assertEquals(summary.stoppedComponents, 1);
  assertEquals(summary.erroredComponents, 1);
});
