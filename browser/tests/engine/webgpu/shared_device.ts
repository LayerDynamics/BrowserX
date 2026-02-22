/**
 * Shared WebGPU device for test files.
 *
 * Creating multiple GPUDevice instances across test files exhausts Deno's
 * internal V8/Dawn GPU adapter state, causing "cannot be converted to a
 * sequence" errors and runtime crashes. This module provides a single shared
 * device that all GPU test files should use.
 */

import { WebGPUDevice } from "../../../src/engine/webgpu/adapter/Device.ts";

let _sharedDevice: WebGPUDevice | null = null;
let _initPromise: Promise<WebGPUDevice> | null = null;

/**
 * Get the shared WebGPU device, initializing on first call.
 * Safe to call concurrently — deduplicates initialization.
 */
export function getSharedDevice(): Promise<WebGPUDevice> {
  if (_sharedDevice) return Promise.resolve(_sharedDevice);
  if (_initPromise) return _initPromise;
  _initPromise = (async () => {
    const device = new WebGPUDevice();
    await device.initialize();
    _sharedDevice = device;
    return device;
  })();
  return _initPromise;
}

/**
 * Check if WebGPU is available in this environment.
 */
export const webgpuAvailable = typeof navigator !== "undefined" && "gpu" in navigator;
