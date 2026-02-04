/**
 * BrowserX Runtime Tests
 *
 * Tests for the unified BrowserX Runtime system.
 */

import { assertEquals, assertExists } from "@std/assert";

import {
  BrowserXRuntime,
  createDefaultConfig,
  createTestConfig,
  LifecycleManager,
  RuntimeState,
} from "../src/mod.ts";

Deno.test("LifecycleManager - initial state is STOPPED", () => {
  const manager = new LifecycleManager();
  assertEquals(manager.getState(), RuntimeState.STOPPED);
});

Deno.test("LifecycleManager - valid state transitions", () => {
  const manager = new LifecycleManager();

  // STOPPED -> STARTING
  assertEquals(manager.canTransitionTo(RuntimeState.STARTING), true);
  manager.transition(RuntimeState.STARTING);
  assertEquals(manager.getState(), RuntimeState.STARTING);

  // STARTING -> RUNNING
  assertEquals(manager.canTransitionTo(RuntimeState.RUNNING), true);
  manager.transition(RuntimeState.RUNNING);
  assertEquals(manager.getState(), RuntimeState.RUNNING);

  // RUNNING -> STOPPING
  assertEquals(manager.canTransitionTo(RuntimeState.STOPPING), true);
  manager.transition(RuntimeState.STOPPING);
  assertEquals(manager.getState(), RuntimeState.STOPPING);

  // STOPPING -> STOPPED
  assertEquals(manager.canTransitionTo(RuntimeState.STOPPED), true);
  manager.transition(RuntimeState.STOPPED);
  assertEquals(manager.getState(), RuntimeState.STOPPED);
});

Deno.test("LifecycleManager - invalid state transitions", () => {
  const manager = new LifecycleManager();

  // Cannot go directly from STOPPED to RUNNING
  assertEquals(manager.canTransitionTo(RuntimeState.RUNNING), false);

  // Cannot go directly from STOPPED to STOPPING
  assertEquals(manager.canTransitionTo(RuntimeState.STOPPING), false);
});

Deno.test("LifecycleManager - component registration", () => {
  const manager = new LifecycleManager();

  // Register a component
  manager.registerComponent("browser-pool");
  assertEquals(manager.hasComponent("browser-pool"), true);

  // Get component state
  const state = manager.getComponentState("browser-pool");
  assertExists(state);
  assertEquals(state.id, "browser-pool");
  assertEquals(state.state, RuntimeState.STOPPED);
});

Deno.test("LifecycleManager - component state updates", () => {
  const manager = new LifecycleManager();

  manager.registerComponent("event-coordinator");
  manager.updateComponentState("event-coordinator", RuntimeState.STARTING);

  const state = manager.getComponentState("event-coordinator");
  assertExists(state);
  assertEquals(state.state, RuntimeState.STARTING);

  manager.updateComponentState("event-coordinator", RuntimeState.RUNNING);
  const runningState = manager.getComponentState("event-coordinator");
  assertExists(runningState);
  assertEquals(runningState.state, RuntimeState.RUNNING);
  assertExists(runningState.startedAt);
});

Deno.test("LifecycleManager - error state with error object", () => {
  const manager = new LifecycleManager();

  manager.registerComponent("proxy-engine");

  const error = new Error("Test error");
  manager.updateComponentState("proxy-engine", RuntimeState.ERROR, error);

  const state = manager.getComponentState("proxy-engine");
  assertExists(state);
  assertEquals(state.state, RuntimeState.ERROR);
  assertEquals(state.error, error);
});

Deno.test("LifecycleManager - getSummary", () => {
  const manager = new LifecycleManager();

  manager.registerComponent("browser-pool");
  manager.registerComponent("event-coordinator");
  manager.registerComponent("metrics-collector");

  manager.updateComponentState("browser-pool", RuntimeState.RUNNING);
  manager.updateComponentState("event-coordinator", RuntimeState.RUNNING);
  manager.updateComponentState("metrics-collector", RuntimeState.STOPPED);

  const summary = manager.getSummary();
  assertEquals(summary.componentCount, 3);
  assertEquals(summary.runningComponents, 2);
  assertEquals(summary.stoppedComponents, 1);
  assertEquals(summary.erroredComponents, 0);
});

Deno.test("createDefaultConfig - returns valid configuration", () => {
  const config = createDefaultConfig();

  assertEquals(config.environment, "production");
  assertEquals(config.logLevel, "info");
  assertEquals(config.browser.maxInstances, 10);
  assertEquals(config.shutdown.graceful, true);
  assertEquals(config.signals.handleSIGINT, true);
});

Deno.test("createTestConfig - returns test-friendly configuration", () => {
  const config = createTestConfig();

  assertEquals(config.environment, "test");
  assertEquals(config.browser.maxInstances, 2);
  assertEquals(config.signals.handleSIGINT, false);
  assertEquals(config.signals.handleSIGTERM, false);
});

Deno.test("BrowserXRuntime - instantiation with default config", () => {
  const runtime = new BrowserXRuntime();

  assertEquals(runtime.getState(), RuntimeState.STOPPED);
  assertExists(runtime.eventCoordinator);
  assertExists(runtime.browserPool);
  assertExists(runtime.signalHandler);
  assertExists(runtime.metricsCollector);
  assertExists(runtime.healthChecker);
});

Deno.test("BrowserXRuntime - instantiation with custom config", () => {
  const runtime = new BrowserXRuntime({
    config: {
      environment: "test",
      logLevel: "debug",
      browser: {
        maxInstances: 5,
        minInstances: 0,
        idleTimeout: 60000,
        maxLifetime: 300000,
        defaultWidth: 800,
        defaultHeight: 600,
        enableJavaScript: true,
        enableStorage: true,
        devicePixelRatio: 1,
      },
    },
  });

  assertEquals(runtime.getState(), RuntimeState.STOPPED);

  const config = runtime.getConfig();
  assertEquals(config.environment, "test");
  assertEquals(config.logLevel, "debug");
  assertEquals(config.browser.maxInstances, 5);
});

Deno.test("BrowserXRuntime - isRunning returns false when stopped", () => {
  const runtime = new BrowserXRuntime();
  assertEquals(runtime.isRunning(), false);
});

Deno.test("BrowserXRuntime - getUptime returns 0 when not started", () => {
  const runtime = new BrowserXRuntime();
  assertEquals(runtime.getUptime(), 0);
});

Deno.test("BrowserXRuntime - getStats returns valid structure", () => {
  const runtime = new BrowserXRuntime();
  const stats = runtime.getStats();

  assertExists(stats.state);
  assertExists(stats.uptime);
  assertExists(stats.components);
  assertExists(stats.memory);
  assertExists(stats.resources);
  assertExists(stats.queries);
  assertExists(stats.eventLoops);
  assertExists(stats.health);
});

Deno.test("BrowserXRuntime - event listeners", () => {
  const runtime = new BrowserXRuntime();
  const events: unknown[] = [];

  const listener = (event: unknown) => {
    events.push(event);
  };

  runtime.addEventListener(listener);
  assertEquals(events.length, 0);

  runtime.removeEventListener(listener);
});
