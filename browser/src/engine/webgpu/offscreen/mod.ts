/**
 * Offscreen WebGPU Module
 *
 * Provides headless WebGPU rendering without a display canvas.
 * Enables GPU-accelerated rendering with CPU pixel readback.
 *
 * @module offscreen
 */

export {
  OffscreenDeviceLostError,
  OffscreenWebGPU,
  type OffscreenWebGPUConfig,
  OffscreenWebGPUError,
  OffscreenWebGPUState,
  type OffscreenWebGPUStatistics,
} from "./OffscreenWebGPU.ts";
