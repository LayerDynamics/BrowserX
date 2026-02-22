/**
 * WebGPU Canvas Context — re-export shim
 *
 * Provides a stable top-level import path for WebGPU canvas context types
 * and the `WebGPUCanvasContext` class. The canonical implementation lives in
 * `./canvas/CanvasContext.ts`; this module re-exports everything from there
 * so consumers can import from either location without circular dependencies.
 *
 * @module webgpu
 */

export {
  CanvasContextError,
  CanvasLostError,
  CanvasState,
  ResizeMode,
  WebGPUCanvasContext,
} from "./canvas/CanvasContext.ts";

export type { CanvasContextConfig, CanvasStatistics, FrameTiming } from "./canvas/CanvasContext.ts";
