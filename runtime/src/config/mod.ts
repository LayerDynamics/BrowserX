/**
 * Configuration Module
 *
 * Exports configuration types and utilities
 */

export {
  createDefaultConfig,
  createDevelopmentConfig,
  createTestConfig,
  mergeConfig,
} from "./RuntimeConfig.ts";

export type {
  BrowserPoolConfig,
  BrowserXRuntimeConfig,
  EventLoopConfig,
  MetricsConfig,
  ProxyEngineConfig,
  QueryEngineConfig,
  ShutdownConfig,
  SignalConfig,
} from "./RuntimeConfig.ts";

export { assertValidConfig, validateConfig } from "./ConfigValidator.ts";

export type { ValidationError, ValidationResult } from "./ConfigValidator.ts";
