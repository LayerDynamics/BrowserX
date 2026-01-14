/**
 * Browser Engine
 *
 * Complete browser engine including network, rendering, JavaScript, storage, and WebGPU layers.
 */

// High-level pipelines
export * from "./RequestPipeline.ts";
export * from "./RenderingPipeline.ts";

// Core engine layers
export * from "./network/mod.ts";
export * from "./rendering/mod.ts";
export * from "./javascript/mod.ts";
export * from "./storage/mod.ts";

// WebGPU layer - exported as namespace to avoid naming conflicts
// To use: import * as WebGPU from "./webgpu/mod.ts" or import specific items
export * as WebGPU from "./webgpu/mod.ts";
