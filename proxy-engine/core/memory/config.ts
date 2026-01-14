/**
 * Memory Configuration
 *
 * Configuration settings for memory management
 */

/**
 * Memory configuration options
 */
export interface MemoryConfig {
  /**
   * Maximum heap size in bytes (0 = unlimited)
   */
  maxHeapSize: number;

  /**
   * Maximum RSS (Resident Set Size) in bytes (0 = unlimited)
   */
  maxRSS: number;

  /**
   * Warning threshold as percentage of heap total (0-100)
   */
  warningThreshold: number;

  /**
   * Critical threshold as percentage of heap total (0-100)
   */
  criticalThreshold: number;

  /**
   * GC interval in milliseconds
   */
  gcInterval: number;

  /**
   * Auto GC when critical threshold is reached
   */
  autoGC: boolean;

  /**
   * Monitor interval in milliseconds
   */
  monitorInterval: number;

  /**
   * Enable memory profiling
   */
  enableProfiling: boolean;

  /**
   * Maximum memory history entries to keep
   */
  maxHistorySize: number;
}

/**
 * Default memory configuration
 */
export const DEFAULT_MEMORY_CONFIG: MemoryConfig = {
  maxHeapSize: 0, // No limit by default
  maxRSS: 0, // No limit by default
  warningThreshold: 75, // Warn at 75% heap usage
  criticalThreshold: 90, // Critical at 90% heap usage
  gcInterval: 60000, // GC every 60 seconds if needed
  autoGC: true,
  monitorInterval: 5000, // Monitor every 5 seconds
  enableProfiling: false,
  maxHistorySize: 100,
};

/**
 * Create memory configuration with defaults
 */
export function createMemoryConfig(
  overrides?: Partial<MemoryConfig>,
): MemoryConfig {
  return {
    ...DEFAULT_MEMORY_CONFIG,
    ...overrides,
  };
}

/**
 * Validate memory configuration
 */
export function validateMemoryConfig(config: MemoryConfig): void {
  if (config.warningThreshold < 0 || config.warningThreshold > 100) {
    throw new Error("Warning threshold must be between 0 and 100");
  }

  if (config.criticalThreshold < 0 || config.criticalThreshold > 100) {
    throw new Error("Critical threshold must be between 0 and 100");
  }

  if (config.warningThreshold >= config.criticalThreshold) {
    throw new Error("Warning threshold must be less than critical threshold");
  }

  if (config.gcInterval < 1000) {
    throw new Error("GC interval must be at least 1000ms");
  }

  if (config.monitorInterval < 100) {
    throw new Error("Monitor interval must be at least 100ms");
  }

  if (config.maxHistorySize < 10) {
    throw new Error("Max history size must be at least 10");
  }
}

/**
 * Preset configurations for different environments
 */
export const MEMORY_PRESETS = {
  /**
   * Development environment (generous limits)
   */
  DEVELOPMENT: createMemoryConfig({
    maxHeapSize: 2 * 1024 * 1024 * 1024, // 2 GB
    maxRSS: 4 * 1024 * 1024 * 1024, // 4 GB
    warningThreshold: 80,
    criticalThreshold: 95,
    gcInterval: 120000, // 2 minutes
    autoGC: true,
    monitorInterval: 10000, // 10 seconds
    enableProfiling: true,
    maxHistorySize: 200,
  }),

  /**
   * Production environment (conservative limits)
   */
  PRODUCTION: createMemoryConfig({
    maxHeapSize: 1 * 1024 * 1024 * 1024, // 1 GB
    maxRSS: 2 * 1024 * 1024 * 1024, // 2 GB
    warningThreshold: 70,
    criticalThreshold: 85,
    gcInterval: 60000, // 1 minute
    autoGC: true,
    monitorInterval: 5000, // 5 seconds
    enableProfiling: false,
    maxHistorySize: 100,
  }),

  /**
   * Low memory environment (strict limits)
   */
  LOW_MEMORY: createMemoryConfig({
    maxHeapSize: 512 * 1024 * 1024, // 512 MB
    maxRSS: 1024 * 1024 * 1024, // 1 GB
    warningThreshold: 60,
    criticalThreshold: 75,
    gcInterval: 30000, // 30 seconds
    autoGC: true,
    monitorInterval: 3000, // 3 seconds
    enableProfiling: false,
    maxHistorySize: 50,
  }),

  /**
   * High performance environment (relaxed limits, less monitoring)
   */
  HIGH_PERFORMANCE: createMemoryConfig({
    maxHeapSize: 4 * 1024 * 1024 * 1024, // 4 GB
    maxRSS: 8 * 1024 * 1024 * 1024, // 8 GB
    warningThreshold: 85,
    criticalThreshold: 95,
    gcInterval: 300000, // 5 minutes
    autoGC: false, // Let V8 handle it
    monitorInterval: 30000, // 30 seconds
    enableProfiling: false,
    maxHistorySize: 50,
  }),

  /**
   * Testing environment (similar to production but with profiling)
   */
  TESTING: createMemoryConfig({
    maxHeapSize: 1 * 1024 * 1024 * 1024, // 1 GB
    maxRSS: 2 * 1024 * 1024 * 1024, // 2 GB
    warningThreshold: 70,
    criticalThreshold: 85,
    gcInterval: 60000,
    autoGC: true,
    monitorInterval: 5000,
    enableProfiling: true,
    maxHistorySize: 150,
  }),
} as const;

/**
 * Get preset configuration by environment
 */
export function getPresetConfig(
  preset: keyof typeof MEMORY_PRESETS,
): MemoryConfig {
  return MEMORY_PRESETS[preset];
}

/**
 * Parse memory size string to bytes
 *
 * Supports units: B, KB, MB, GB, TB
 * Examples: "512MB", "2GB", "1024KB"
 */
export function parseMemorySize(size: string): number {
  const match = size.match(/^(\d+(?:\.\d+)?)\s*([KMGT]?B?)$/i);

  if (!match) {
    throw new Error(`Invalid memory size format: ${size}`);
  }

  const value = parseFloat(match[1]);
  const unit = (match[2] || "B").toUpperCase();

  const multipliers: Record<string, number> = {
    B: 1,
    KB: 1024,
    MB: 1024 * 1024,
    GB: 1024 * 1024 * 1024,
    TB: 1024 * 1024 * 1024 * 1024,
  };

  const multiplier = multipliers[unit];
  if (!multiplier) {
    throw new Error(`Unknown memory unit: ${unit}`);
  }

  return Math.floor(value * multiplier);
}

/**
 * Format bytes to human-readable string
 */
export function formatMemorySize(bytes: number): string {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }

  return `${value.toFixed(2)} ${units[unitIndex]}`;
}
