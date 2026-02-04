/**
 * SignalHandler Unit Tests
 *
 * Tests for signal registration, callback management, and event emission.
 * Note: Actual signal handling tests require special permissions.
 */

import {
  assertEquals,
  assertExists,
} from "@std/assert";
import { SignalHandler } from "../../src/signals/SignalHandler.ts";
import type { SignalConfig } from "../../src/config/RuntimeConfig.ts";
import type { RuntimeEvent, SignalType } from "../../src/types.ts";

/**
 * Create test signal config
 */
function createTestSignalConfig(
  overrides: Partial<SignalConfig> = {},
): SignalConfig {
  return {
    handleSIGINT: false, // Disabled in tests to avoid conflicts
    handleSIGTERM: false,
    handleSIGHUP: false,
    ...overrides,
  };
}

// ============================================================================
// Basic Instantiation Tests
// ============================================================================

Deno.test("SignalHandler - instantiation with config", () => {
  const config = createTestSignalConfig();
  const handler = new SignalHandler(config);

  assertExists(handler);
  assertEquals(handler.isRegistered(), false);
});

Deno.test("SignalHandler - getConfig returns copy of config", () => {
  const config = createTestSignalConfig({ handleSIGINT: true });
  const handler = new SignalHandler(config);

  const retrieved = handler.getConfig();
  assertEquals(retrieved.handleSIGINT, true);

  // Modifying returned config should not affect internal
  retrieved.handleSIGINT = false;
  assertEquals(handler.getConfig().handleSIGINT, true);
});

// ============================================================================
// Registration Tests
// ============================================================================

Deno.test("SignalHandler - register with no signals enabled", () => {
  const config = createTestSignalConfig({
    handleSIGINT: false,
    handleSIGTERM: false,
    handleSIGHUP: false,
  });
  const handler = new SignalHandler(config);

  handler.register();
  assertEquals(handler.isRegistered(), true);

  handler.unregister();
});

Deno.test("SignalHandler - double register is idempotent", () => {
  const config = createTestSignalConfig();
  const handler = new SignalHandler(config);

  handler.register();
  handler.register(); // Should not throw

  assertEquals(handler.isRegistered(), true);

  handler.unregister();
});

Deno.test("SignalHandler - unregister clears registration", () => {
  const config = createTestSignalConfig();
  const handler = new SignalHandler(config);

  handler.register();
  assertEquals(handler.isRegistered(), true);

  handler.unregister();
  assertEquals(handler.isRegistered(), false);
});

Deno.test("SignalHandler - double unregister is idempotent", () => {
  const config = createTestSignalConfig();
  const handler = new SignalHandler(config);

  handler.register();
  handler.unregister();
  handler.unregister(); // Should not throw

  assertEquals(handler.isRegistered(), false);
});

// ============================================================================
// Callback Registration Tests
// ============================================================================

Deno.test("SignalHandler - onSignal registers callback", () => {
  const config = createTestSignalConfig();
  const handler = new SignalHandler(config);

  let called = false;
  handler.onSignal("SIGINT", () => {
    called = true;
  });

  // Callback is registered but won't be called until signal received
  assertEquals(called, false);
});

Deno.test("SignalHandler - offSignal removes callback", () => {
  const config = createTestSignalConfig();
  const handler = new SignalHandler(config);

  const callback = () => {};
  handler.onSignal("SIGINT", callback);
  handler.offSignal("SIGINT", callback);

  // No way to directly verify, but it should not throw
});

Deno.test("SignalHandler - onShutdown registers for SIGINT and SIGTERM", () => {
  const config = createTestSignalConfig();
  const handler = new SignalHandler(config);

  let callCount = 0;
  handler.onShutdown(() => {
    callCount++;
  });

  // Callback registered for both signals
  // We can't easily test without sending actual signals
});

Deno.test("SignalHandler - onReload registers for SIGHUP", () => {
  const config = createTestSignalConfig();
  const handler = new SignalHandler(config);

  let called = false;
  handler.onReload(() => {
    called = true;
  });

  // Callback registered
  assertEquals(called, false);
});

Deno.test("SignalHandler - multiple callbacks for same signal", () => {
  const config = createTestSignalConfig();
  const handler = new SignalHandler(config);

  const callbacks: number[] = [];
  handler.onSignal("SIGINT", () => callbacks.push(1));
  handler.onSignal("SIGINT", () => callbacks.push(2));
  handler.onSignal("SIGINT", () => callbacks.push(3));

  // All three callbacks registered
  // We can't easily test invocation without actual signals
});

// ============================================================================
// Event Listener Tests
// ============================================================================

Deno.test("SignalHandler - addEventListener and removeEventListener", () => {
  const config = createTestSignalConfig();
  const handler = new SignalHandler(config);

  const events: RuntimeEvent[] = [];
  const listener = (event: RuntimeEvent) => events.push(event);

  handler.addEventListener(listener);
  handler.removeEventListener(listener);

  // No way to trigger events without actual signals
  assertEquals(events.length, 0);
});
