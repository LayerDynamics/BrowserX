/**
 * ConfigValidator Unit Tests
 *
 * Comprehensive tests for configuration validation including
 * error detection, warning generation, and boundary conditions.
 */

import {
  assertEquals,
  assertExists,
  assertThrows,
} from "@std/assert";
import {
  validateConfig,
  assertValidConfig,
  ValidationResult,
  ValidationError,
} from "../../src/config/ConfigValidator.ts";
import {
  createDefaultConfig,
  BrowserXRuntimeConfig,
} from "../../src/config/RuntimeConfig.ts";

/**
 * Create a valid config for modification
 */
function createValidConfig(): BrowserXRuntimeConfig {
  return createDefaultConfig();
}

// ============================================================================
// Basic Validation Tests
// ============================================================================

Deno.test("ConfigValidator - validates default config as valid", () => {
  const config = createValidConfig();
  const result = validateConfig(config);

  assertEquals(result.valid, true);
  assertEquals(result.errors.length, 0);
});

Deno.test("ConfigValidator - returns validation result structure", () => {
  const config = createValidConfig();
  const result = validateConfig(config);

  assertExists(result.valid);
  assertExists(result.errors);
  assertExists(result.warnings);
  assertEquals(Array.isArray(result.errors), true);
  assertEquals(Array.isArray(result.warnings), true);
});

// ============================================================================
// Browser Config Validation Tests
// ============================================================================

Deno.test("ConfigValidator - browser.minInstances < 0 is error", () => {
  const config = createValidConfig();
  config.browser.minInstances = -1;

  const result = validateConfig(config);

  assertEquals(result.valid, false);
  const error = result.errors.find((e) => e.field === "browser.minInstances");
  assertExists(error);
  assertEquals(error.message, "Must be >= 0");
});

Deno.test("ConfigValidator - browser.maxInstances < 1 is error", () => {
  const config = createValidConfig();
  config.browser.maxInstances = 0;

  const result = validateConfig(config);

  assertEquals(result.valid, false);
  const error = result.errors.find((e) => e.field === "browser.maxInstances");
  assertExists(error);
  assertEquals(error.message, "Must be >= 1");
});

Deno.test("ConfigValidator - browser.minInstances > maxInstances is error", () => {
  const config = createValidConfig();
  config.browser.minInstances = 10;
  config.browser.maxInstances = 5;

  const result = validateConfig(config);

  assertEquals(result.valid, false);
  const error = result.errors.find((e) => e.field === "browser.minInstances");
  assertExists(error);
  assertEquals(error.message, "Cannot exceed maxInstances");
});

Deno.test("ConfigValidator - browser.idleTimeout < 1000 is warning", () => {
  const config = createValidConfig();
  config.browser.idleTimeout = 500;

  const result = validateConfig(config);

  // Still valid, just warning
  assertEquals(result.valid, true);
  const warning = result.warnings.find((w) => w.field === "browser.idleTimeout");
  assertExists(warning);
});

Deno.test("ConfigValidator - browser.maxLifetime < idleTimeout is warning", () => {
  const config = createValidConfig();
  config.browser.idleTimeout = 60000;
  config.browser.maxLifetime = 30000;

  const result = validateConfig(config);

  assertEquals(result.valid, true);
  const warning = result.warnings.find((w) => w.field === "browser.maxLifetime");
  assertExists(warning);
});

Deno.test("ConfigValidator - browser.defaultWidth out of range is error", () => {
  const config = createValidConfig();
  config.browser.defaultWidth = 50; // < 100

  const result = validateConfig(config);

  assertEquals(result.valid, false);
  const error = result.errors.find((e) => e.field === "browser.defaultWidth");
  assertExists(error);
});

Deno.test("ConfigValidator - browser.defaultHeight out of range is error", () => {
  const config = createValidConfig();
  config.browser.defaultHeight = 50000; // > 10000

  const result = validateConfig(config);

  assertEquals(result.valid, false);
  const error = result.errors.find((e) => e.field === "browser.defaultHeight");
  assertExists(error);
});

Deno.test("ConfigValidator - browser.devicePixelRatio out of range is warning", () => {
  const config = createValidConfig();
  config.browser.devicePixelRatio = 0.1; // < 0.5

  const result = validateConfig(config);

  assertEquals(result.valid, true);
  const warning = result.warnings.find(
    (w) => w.field === "browser.devicePixelRatio",
  );
  assertExists(warning);
});

// ============================================================================
// Proxy Config Validation Tests
// ============================================================================

Deno.test("ConfigValidator - proxy enabled without gateways is warning", () => {
  const config = createValidConfig();
  config.proxy.enabled = true;
  config.proxy.gateways = [];

  const result = validateConfig(config);

  assertEquals(result.valid, true);
  const warning = result.warnings.find((w) => w.field === "proxy.gateways");
  assertExists(warning);
});

Deno.test("ConfigValidator - proxy gateway invalid port is error", () => {
  const config = createValidConfig();
  config.proxy.gateways = [
    { host: "localhost", port: 0 },
  ];

  const result = validateConfig(config);

  assertEquals(result.valid, false);
  const error = result.errors.find((e) =>
    e.field === "proxy.gateways[0].port"
  );
  assertExists(error);
});

Deno.test("ConfigValidator - proxy gateway port > 65535 is error", () => {
  const config = createValidConfig();
  config.proxy.gateways = [
    { host: "localhost", port: 70000 },
  ];

  const result = validateConfig(config);

  assertEquals(result.valid, false);
  const error = result.errors.find((e) =>
    e.field === "proxy.gateways[0].port"
  );
  assertExists(error);
});

Deno.test("ConfigValidator - proxy gracefulShutdownTimeout < 1000 is warning", () => {
  const config = createValidConfig();
  config.proxy.gracefulShutdownTimeout = 500;

  const result = validateConfig(config);

  assertEquals(result.valid, true);
  const warning = result.warnings.find(
    (w) => w.field === "proxy.gracefulShutdownTimeout",
  );
  assertExists(warning);
});

Deno.test("ConfigValidator - proxy metrics enabled without port is warning", () => {
  const config = createValidConfig();
  config.proxy.metrics = true;
  config.proxy.metricsPort = undefined;

  const result = validateConfig(config);

  assertEquals(result.valid, true);
  const warning = result.warnings.find((w) => w.field === "proxy.metricsPort");
  assertExists(warning);
});

// ============================================================================
// Query Config Validation Tests
// ============================================================================

Deno.test("ConfigValidator - query.cache.defaultTTL < 0 is error", () => {
  const config = createValidConfig();
  config.query.cache.defaultTTL = -1;

  const result = validateConfig(config);

  assertEquals(result.valid, false);
  const error = result.errors.find((e) => e.field === "query.cache.defaultTTL");
  assertExists(error);
});

Deno.test("ConfigValidator - query.cache.maxSize < 1024 is warning", () => {
  const config = createValidConfig();
  config.query.cache.maxSize = 512;

  const result = validateConfig(config);

  assertEquals(result.valid, true);
  const warning = result.warnings.find((w) => w.field === "query.cache.maxSize");
  assertExists(warning);
});

Deno.test("ConfigValidator - query.sandbox.timeout < 1000 is warning", () => {
  const config = createValidConfig();
  config.query.sandbox.timeout = 500;

  const result = validateConfig(config);

  assertEquals(result.valid, true);
  const warning = result.warnings.find(
    (w) => w.field === "query.sandbox.timeout",
  );
  assertExists(warning);
});

Deno.test("ConfigValidator - query.rateLimit.requestsPerSecond < 1 is error", () => {
  const config = createValidConfig();
  config.query.rateLimit = {
    requestsPerSecond: 0,
    requestsPerMinute: 60,
  };

  const result = validateConfig(config);

  assertEquals(result.valid, false);
  const error = result.errors.find(
    (e) => e.field === "query.rateLimit.requestsPerSecond",
  );
  assertExists(error);
});

Deno.test("ConfigValidator - query.rateLimit requestsPerMinute < requestsPerSecond is error", () => {
  const config = createValidConfig();
  config.query.rateLimit = {
    requestsPerSecond: 10,
    requestsPerMinute: 5,
  };

  const result = validateConfig(config);

  assertEquals(result.valid, false);
  const error = result.errors.find(
    (e) => e.field === "query.rateLimit.requestsPerMinute",
  );
  assertExists(error);
});

// ============================================================================
// Event Loop Config Validation Tests
// ============================================================================

Deno.test("ConfigValidator - eventLoop.targetFrameRate < 1 is error", () => {
  const config = createValidConfig();
  config.eventLoop.targetFrameRate = 0;

  const result = validateConfig(config);

  assertEquals(result.valid, false);
  const error = result.errors.find(
    (e) => e.field === "eventLoop.targetFrameRate",
  );
  assertExists(error);
});

Deno.test("ConfigValidator - eventLoop.targetFrameRate > 240 is error", () => {
  const config = createValidConfig();
  config.eventLoop.targetFrameRate = 300;

  const result = validateConfig(config);

  assertEquals(result.valid, false);
  const error = result.errors.find(
    (e) => e.field === "eventLoop.targetFrameRate",
  );
  assertExists(error);
});

Deno.test("ConfigValidator - eventLoop.maxMicrotasksPerCycle < 10 is warning", () => {
  const config = createValidConfig();
  config.eventLoop.maxMicrotasksPerCycle = 5;

  const result = validateConfig(config);

  assertEquals(result.valid, true);
  const warning = result.warnings.find(
    (w) => w.field === "eventLoop.maxMicrotasksPerCycle",
  );
  assertExists(warning);
});

Deno.test("ConfigValidator - eventLoop.maxMicrotasksPerCycle > 10000 is warning", () => {
  const config = createValidConfig();
  config.eventLoop.maxMicrotasksPerCycle = 20000;

  const result = validateConfig(config);

  assertEquals(result.valid, true);
  const warning = result.warnings.find(
    (w) => w.field === "eventLoop.maxMicrotasksPerCycle",
  );
  assertExists(warning);
});

// ============================================================================
// Shutdown Config Validation Tests
// ============================================================================

Deno.test("ConfigValidator - shutdown.timeout < 1000 is warning", () => {
  const config = createValidConfig();
  config.shutdown.timeout = 500;

  const result = validateConfig(config);

  assertEquals(result.valid, true);
  const warning = result.warnings.find((w) => w.field === "shutdown.timeout");
  assertExists(warning);
});

Deno.test("ConfigValidator - shutdown.drainTimeout > timeout is warning", () => {
  const config = createValidConfig();
  config.shutdown.timeout = 5000;
  config.shutdown.drainTimeout = 10000;

  const result = validateConfig(config);

  assertEquals(result.valid, true);
  const warning = result.warnings.find(
    (w) => w.field === "shutdown.drainTimeout",
  );
  assertExists(warning);
});

// ============================================================================
// Metrics Config Validation Tests
// ============================================================================

Deno.test("ConfigValidator - metrics.port invalid is error", () => {
  const config = createValidConfig();
  config.metrics.enabled = true;
  config.metrics.port = 0;

  const result = validateConfig(config);

  assertEquals(result.valid, false);
  const error = result.errors.find((e) => e.field === "metrics.port");
  assertExists(error);
});

Deno.test("ConfigValidator - metrics.port > 65535 is error", () => {
  const config = createValidConfig();
  config.metrics.enabled = true;
  config.metrics.port = 70000;

  const result = validateConfig(config);

  assertEquals(result.valid, false);
  const error = result.errors.find((e) => e.field === "metrics.port");
  assertExists(error);
});

Deno.test("ConfigValidator - metrics.healthCheckInterval < 1000 is warning", () => {
  const config = createValidConfig();
  config.metrics.healthCheckInterval = 500;

  const result = validateConfig(config);

  assertEquals(result.valid, true);
  const warning = result.warnings.find(
    (w) => w.field === "metrics.healthCheckInterval",
  );
  assertExists(warning);
});

// ============================================================================
// assertValidConfig Tests
// ============================================================================

Deno.test("ConfigValidator - assertValidConfig does not throw for valid config", () => {
  const config = createValidConfig();

  // Should not throw
  assertValidConfig(config);
});

Deno.test("ConfigValidator - assertValidConfig throws for invalid config", () => {
  const config = createValidConfig();
  config.browser.minInstances = -1;

  assertThrows(
    () => assertValidConfig(config),
    Error,
    "Invalid runtime configuration",
  );
});

Deno.test("ConfigValidator - assertValidConfig error message includes field", () => {
  const config = createValidConfig();
  config.browser.maxInstances = 0;

  try {
    assertValidConfig(config);
  } catch (error) {
    const err = error as Error;
    assertEquals(err.message.includes("browser.maxInstances"), true);
  }
});

// ============================================================================
// Multiple Errors Tests
// ============================================================================

Deno.test("ConfigValidator - collects multiple errors", () => {
  const config = createValidConfig();
  config.browser.minInstances = -1;
  config.browser.maxInstances = 0;
  config.browser.defaultWidth = 50;

  const result = validateConfig(config);

  assertEquals(result.valid, false);
  assertEquals(result.errors.length >= 3, true);
});

Deno.test("ConfigValidator - collects multiple warnings", () => {
  const config = createValidConfig();
  config.browser.idleTimeout = 500;
  config.browser.devicePixelRatio = 0.1;
  config.shutdown.timeout = 500;

  const result = validateConfig(config);

  assertEquals(result.valid, true);
  assertEquals(result.warnings.length >= 3, true);
});

// ============================================================================
// Boundary Condition Tests
// ============================================================================

Deno.test("ConfigValidator - boundary: browser.minInstances = 0 is valid", () => {
  const config = createValidConfig();
  config.browser.minInstances = 0;

  const result = validateConfig(config);

  assertEquals(result.valid, true);
});

Deno.test("ConfigValidator - boundary: browser.maxInstances = 1 is valid", () => {
  const config = createValidConfig();
  config.browser.maxInstances = 1;
  config.browser.minInstances = 0;

  const result = validateConfig(config);

  assertEquals(result.valid, true);
});

Deno.test("ConfigValidator - boundary: browser.defaultWidth = 100 is valid", () => {
  const config = createValidConfig();
  config.browser.defaultWidth = 100;

  const result = validateConfig(config);

  assertEquals(result.valid, true);
});

Deno.test("ConfigValidator - boundary: browser.defaultWidth = 10000 is valid", () => {
  const config = createValidConfig();
  config.browser.defaultWidth = 10000;

  const result = validateConfig(config);

  assertEquals(result.valid, true);
});

Deno.test("ConfigValidator - boundary: eventLoop.targetFrameRate = 1 is valid", () => {
  const config = createValidConfig();
  config.eventLoop.targetFrameRate = 1;

  const result = validateConfig(config);

  assertEquals(result.valid, true);
});

Deno.test("ConfigValidator - boundary: eventLoop.targetFrameRate = 240 is valid", () => {
  const config = createValidConfig();
  config.eventLoop.targetFrameRate = 240;

  const result = validateConfig(config);

  assertEquals(result.valid, true);
});
