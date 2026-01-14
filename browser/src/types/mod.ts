/**
 * Type Definitions
 *
 * Core type definitions for the browser implementation including
 * identifiers, DOM, HTTP, network, CSS, rendering, storage, events, and processes.
 */

export * from "./identifiers.ts";
export * from "./dom.ts";
export * from "./http.ts";
export * from "./network.ts";
export * from "./css.ts";
export * from "./rendering.ts";
export * from "./storage.ts";
export * from "./event.ts";
export * from "./process.ts";
export * from "./javascript.ts";

// WebGPU types exported as namespace to avoid naming conflicts with DOM types
// (Blob, CanvasGradient, CanvasPattern, CanvasRenderingContext2D, HTMLCanvasElement, WebGLRenderingContext, LayerID)
export * as WebGPUTypes from "./webgpu.ts";
