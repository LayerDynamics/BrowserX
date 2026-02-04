/**
 * Configuration Validator
 *
 * Validates runtime configuration to ensure all values are within acceptable ranges.
 */

import type { BrowserXRuntimeConfig } from "./RuntimeConfig.ts";

/**
 * Validation error with field path
 */
export interface ValidationError {
  field: string;
  message: string;
  value: unknown;
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

/**
 * Validate browser pool configuration
 */
function validateBrowserConfig(
  config: BrowserXRuntimeConfig["browser"],
  errors: ValidationError[],
  warnings: ValidationError[],
): void {
  if (config.minInstances < 0) {
    errors.push({
      field: "browser.minInstances",
      message: "Must be >= 0",
      value: config.minInstances,
    });
  }

  if (config.maxInstances < 1) {
    errors.push({
      field: "browser.maxInstances",
      message: "Must be >= 1",
      value: config.maxInstances,
    });
  }

  if (config.minInstances > config.maxInstances) {
    errors.push({
      field: "browser.minInstances",
      message: "Cannot exceed maxInstances",
      value: config.minInstances,
    });
  }

  if (config.idleTimeout < 1000) {
    warnings.push({
      field: "browser.idleTimeout",
      message: "Very short idle timeout may cause excessive browser churn",
      value: config.idleTimeout,
    });
  }

  if (config.maxLifetime < config.idleTimeout) {
    warnings.push({
      field: "browser.maxLifetime",
      message: "maxLifetime less than idleTimeout has no effect",
      value: config.maxLifetime,
    });
  }

  if (config.defaultWidth < 100 || config.defaultWidth > 10000) {
    errors.push({
      field: "browser.defaultWidth",
      message: "Must be between 100 and 10000",
      value: config.defaultWidth,
    });
  }

  if (config.defaultHeight < 100 || config.defaultHeight > 10000) {
    errors.push({
      field: "browser.defaultHeight",
      message: "Must be between 100 and 10000",
      value: config.defaultHeight,
    });
  }

  if (config.devicePixelRatio < 0.5 || config.devicePixelRatio > 4) {
    warnings.push({
      field: "browser.devicePixelRatio",
      message: "Unusual device pixel ratio, recommended 1-3",
      value: config.devicePixelRatio,
    });
  }
}

/**
 * Validate proxy configuration
 */
function validateProxyConfig(
  config: BrowserXRuntimeConfig["proxy"],
  errors: ValidationError[],
  warnings: ValidationError[],
): void {
  if (config.enabled && config.gateways.length === 0) {
    warnings.push({
      field: "proxy.gateways",
      message: "Proxy enabled but no gateways configured",
      value: config.gateways,
    });
  }

  for (let i = 0; i < config.gateways.length; i++) {
    const gw = config.gateways[i];
    if (gw.port < 1 || gw.port > 65535) {
      errors.push({
        field: `proxy.gateways[${i}].port`,
        message: "Port must be between 1 and 65535",
        value: gw.port,
      });
    }
  }

  if (config.gracefulShutdownTimeout < 1000) {
    warnings.push({
      field: "proxy.gracefulShutdownTimeout",
      message: "Very short shutdown timeout may not allow connections to drain",
      value: config.gracefulShutdownTimeout,
    });
  }

  if (config.metrics && !config.metricsPort) {
    warnings.push({
      field: "proxy.metricsPort",
      message: "Metrics enabled but no port specified",
      value: config.metricsPort,
    });
  }
}

/**
 * Validate query engine configuration
 */
function validateQueryConfig(
  config: BrowserXRuntimeConfig["query"],
  errors: ValidationError[],
  warnings: ValidationError[],
): void {
  if (config.cache.enabled) {
    if (config.cache.defaultTTL < 0) {
      errors.push({
        field: "query.cache.defaultTTL",
        message: "Must be >= 0",
        value: config.cache.defaultTTL,
      });
    }

    if (config.cache.maxSize < 1024) {
      warnings.push({
        field: "query.cache.maxSize",
        message: "Very small cache size may reduce performance",
        value: config.cache.maxSize,
      });
    }
  }

  if (config.sandbox.timeout < 1000) {
    warnings.push({
      field: "query.sandbox.timeout",
      message: "Very short sandbox timeout may cause premature query cancellation",
      value: config.sandbox.timeout,
    });
  }

  if (config.rateLimit) {
    if (config.rateLimit.requestsPerSecond < 1) {
      errors.push({
        field: "query.rateLimit.requestsPerSecond",
        message: "Must be >= 1",
        value: config.rateLimit.requestsPerSecond,
      });
    }
    if (config.rateLimit.requestsPerMinute < config.rateLimit.requestsPerSecond) {
      errors.push({
        field: "query.rateLimit.requestsPerMinute",
        message: "Must be >= requestsPerSecond",
        value: config.rateLimit.requestsPerMinute,
      });
    }
  }
}

/**
 * Validate event loop configuration
 */
function validateEventLoopConfig(
  config: BrowserXRuntimeConfig["eventLoop"],
  errors: ValidationError[],
  warnings: ValidationError[],
): void {
  if (config.targetFrameRate < 1 || config.targetFrameRate > 240) {
    errors.push({
      field: "eventLoop.targetFrameRate",
      message: "Must be between 1 and 240",
      value: config.targetFrameRate,
    });
  }

  if (config.maxMicrotasksPerCycle < 10) {
    warnings.push({
      field: "eventLoop.maxMicrotasksPerCycle",
      message: "Very low microtask limit may cause promise starvation",
      value: config.maxMicrotasksPerCycle,
    });
  }

  if (config.maxMicrotasksPerCycle > 10000) {
    warnings.push({
      field: "eventLoop.maxMicrotasksPerCycle",
      message: "Very high microtask limit may cause UI jank",
      value: config.maxMicrotasksPerCycle,
    });
  }
}

/**
 * Validate shutdown configuration
 */
function validateShutdownConfig(
  config: BrowserXRuntimeConfig["shutdown"],
  errors: ValidationError[],
  warnings: ValidationError[],
): void {
  if (config.timeout < 1000) {
    warnings.push({
      field: "shutdown.timeout",
      message: "Very short shutdown timeout may cause data loss",
      value: config.timeout,
    });
  }

  if (config.drainTimeout > config.timeout) {
    warnings.push({
      field: "shutdown.drainTimeout",
      message: "drainTimeout exceeds total timeout",
      value: config.drainTimeout,
    });
  }
}

/**
 * Validate metrics configuration
 */
function validateMetricsConfig(
  config: BrowserXRuntimeConfig["metrics"],
  errors: ValidationError[],
  warnings: ValidationError[],
): void {
  if (config.enabled && config.port !== undefined) {
    if (config.port < 1 || config.port > 65535) {
      errors.push({
        field: "metrics.port",
        message: "Port must be between 1 and 65535",
        value: config.port,
      });
    }
  }

  if (config.healthCheckInterval < 1000) {
    warnings.push({
      field: "metrics.healthCheckInterval",
      message: "Very frequent health checks may impact performance",
      value: config.healthCheckInterval,
    });
  }
}

/**
 * Validate complete runtime configuration
 */
export function validateConfig(config: BrowserXRuntimeConfig): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  validateBrowserConfig(config.browser, errors, warnings);
  validateProxyConfig(config.proxy, errors, warnings);
  validateQueryConfig(config.query, errors, warnings);
  validateEventLoopConfig(config.eventLoop, errors, warnings);
  validateShutdownConfig(config.shutdown, errors, warnings);
  validateMetricsConfig(config.metrics, errors, warnings);

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate and throw on errors
 */
export function assertValidConfig(config: BrowserXRuntimeConfig): void {
  const result = validateConfig(config);

  if (!result.valid) {
    const errorMessages = result.errors
      .map((e) => `${e.field}: ${e.message} (got: ${JSON.stringify(e.value)})`)
      .join("\n  ");
    throw new Error(`Invalid runtime configuration:\n  ${errorMessages}`);
  }

  // Log warnings
  if (result.warnings.length > 0) {
    for (const warning of result.warnings) {
      console.warn(
        `[RuntimeConfig] Warning: ${warning.field}: ${warning.message} (value: ${JSON.stringify(warning.value)})`,
      );
    }
  }
}
