/**
 * Offscreen WebGPU Module
 *
 * Provides headless WebGPU rendering without a display canvas.
 * Enables GPU-accelerated rendering with CPU pixel readback.
 *
 * @module offscreen
 */

export {
    OffscreenWebGPU,
    OffscreenWebGPUState,
    OffscreenWebGPUError,
    OffscreenDeviceLostError,
    type OffscreenWebGPUConfig,
    type OffscreenWebGPUStatistics,
} from "./OffscreenWebGPU.ts";
