/**
 * Resources Module
 *
 * Exports resource management components for the BrowserX Runtime.
 */

export {
  BrowserPool,
  type BrowserInstance,
  type BrowserInstanceState,
  type BrowserPoolStats,
} from "./BrowserPool.ts";

export {
  SerialDevicePool,
  type SerialDeviceInstance,
  type SerialDeviceState,
  type SerialDevicePoolStats,
  type SerialDevicePoolConfig,
  DEFAULT_SERIAL_POOL_CONFIG,
} from "./SerialDevicePool.ts";
