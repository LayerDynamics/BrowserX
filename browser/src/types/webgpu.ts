/**
 * WebGPU Type System
 *
 * Complete type definitions for the WebGPU module.
 * Defines identifiers, enums, interfaces, and statistics types.
 */

import type { Timestamp, Duration, Nanoseconds, ByteCount, Pixels } from "./identifiers.ts";

// Re-export commonly used types
export type { Timestamp, Duration, Nanoseconds, ByteCount, Pixels };

// ============================================================================
// IDENTIFIERS
// ============================================================================

/**
 * Unique identifier for GPU device instance
 */
export type GPUDeviceID = string;

/**
 * Unique identifier for GPU buffer
 */
export type GPUBufferID = string;

/**
 * Unique identifier for GPU texture
 */
export type GPUTextureID = string;

/**
 * Unique identifier for GPU render pipeline
 */
export type GPURenderPipelineID = string;

/**
 * Unique identifier for GPU compute pipeline
 */
export type GPUComputePipelineID = string;

/**
 * Unique identifier for GPU bind group
 */
export type GPUBindGroupID = string;

/**
 * Unique identifier for shader module
 */
export type GPUShaderModuleID = string;

/**
 * Unique identifier for command buffer
 */
export type GPUCommandBufferID = string;

/**
 * Unique identifier for command encoder
 */
export type GPUCommandEncoderID = string;

/**
 * Unique identifier for render pass
 */
export type GPURenderPassID = string;

/**
 * Unique identifier for compute pass
 */
export type GPUComputePassID = string;

/**
 * Unified pipeline identifier (render or compute)
 */
export type PipelineID = GPURenderPipelineID | GPUComputePipelineID;

/**
 * Unique identifier for compositor layer
 */
export type LayerID = string & { readonly __brand: "LayerID" };

/**
 * GPU size in bytes
 */
export type GPUSize = number;

/**
 * GPU buffer index
 */
export type GPUIndex = number;

// ============================================================================
// BROWSER DOM TYPES (for engine implementation)
// ============================================================================

/**
 * HTML Image Element interface
 */
export interface HTMLImageElement {
    src: string;
    width: number;
    height: number;
    naturalWidth: number;
    naturalHeight: number;
    complete: boolean;
    decode(): Promise<void>;
}

/**
 * HTML Canvas Element interface
 */
export interface HTMLCanvasElement {
    width: number;
    height: number;
    getContext(contextId: "2d"): CanvasRenderingContext2D | null;
    getContext(contextId: "webgpu"): GPUCanvasContext | null;
    getContext(contextId: "webgl" | "webgl2"): WebGLRenderingContext | null;
    toDataURL(type?: string, quality?: number): string;
    toBlob(callback: (blob: Blob | null) => void, type?: string, quality?: number): void;
    getBoundingClientRect(): DOMRect;
}

/**
 * Offscreen Canvas interface
 */
export interface OffscreenCanvas {
    width: number;
    height: number;
    getContext(contextId: "2d"): OffscreenCanvasRenderingContext2D | null;
    getContext(contextId: "webgpu"): GPUCanvasContext | null;
    getContext(contextId: "webgl" | "webgl2"): WebGLRenderingContext | null;
    convertToBlob(options?: { type?: string; quality?: number }): Promise<Blob>;
    transferToImageBitmap(): ImageBitmap;
}

/**
 * Canvas Rendering Context 2D interface (minimal)
 */
export interface CanvasRenderingContext2D {
    canvas: HTMLCanvasElement;
    fillStyle: string | CanvasGradient | CanvasPattern;
    strokeStyle: string | CanvasGradient | CanvasPattern;
    fillRect(x: number, y: number, width: number, height: number): void;
    clearRect(x: number, y: number, width: number, height: number): void;
    strokeRect(x: number, y: number, width: number, height: number): void;
    getImageData(sx: number, sy: number, sw: number, sh: number): ImageData;
    putImageData(imageData: ImageData, dx: number, dy: number): void;
}

/**
 * Offscreen Canvas Rendering Context 2D interface (minimal)
 */
export interface OffscreenCanvasRenderingContext2D {
    canvas: OffscreenCanvas;
    fillStyle: string | CanvasGradient | CanvasPattern;
    strokeStyle: string | CanvasGradient | CanvasPattern;
    fillRect(x: number, y: number, width: number, height: number): void;
    clearRect(x: number, y: number, width: number, height: number): void;
    strokeRect(x: number, y: number, width: number, height: number): void;
    getImageData(sx: number, sy: number, sw: number, sh: number): ImageData;
    putImageData(imageData: ImageData, dx: number, dy: number): void;
}

/**
 * WebGL Rendering Context (minimal stub)
 */
export interface WebGLRenderingContext {
    canvas: HTMLCanvasElement | OffscreenCanvas;
    drawingBufferWidth: number;
    drawingBufferHeight: number;
}

/**
 * Canvas Gradient interface
 */
export interface CanvasGradient {
    addColorStop(offset: number, color: string): void;
}

/**
 * Canvas Pattern interface
 */
export interface CanvasPattern {
    setTransform(transform?: DOMMatrix): void;
}

/**
 * DOM Rect interface
 */
export interface DOMRect {
    x: number;
    y: number;
    width: number;
    height: number;
    top: number;
    right: number;
    bottom: number;
    left: number;
}

/**
 * DOM Matrix interface (minimal)
 */
export interface DOMMatrix {
    a: number;
    b: number;
    c: number;
    d: number;
    e: number;
    f: number;
}

/**
 * Blob interface
 */
export interface Blob {
    readonly size: number;
    readonly type: string;
    arrayBuffer(): Promise<ArrayBuffer>;
    slice(start?: number, end?: number, contentType?: string): Blob;
    stream(): ReadableStream<Uint8Array>;
    text(): Promise<string>;
}

/**
 * ResizeObserver interface
 */
export interface ResizeObserver {
    observe(target: Element): void;
    unobserve(target: Element): void;
    disconnect(): void;
}

/**
 * ResizeObserver entry
 */
export interface ResizeObserverEntry {
    readonly target: Element;
    readonly contentRect: DOMRect;
    readonly borderBoxSize: ReadonlyArray<ResizeObserverSize>;
    readonly contentBoxSize: ReadonlyArray<ResizeObserverSize>;
    readonly devicePixelContentBoxSize: ReadonlyArray<ResizeObserverSize>;
}

/**
 * ResizeObserver size
 */
export interface ResizeObserverSize {
    readonly inlineSize: number;
    readonly blockSize: number;
}

/**
 * Element interface (minimal)
 */
export interface Element {
    readonly tagName: string;
}

// ============================================================================
// STATE MACHINES
// ============================================================================

/**
 * GPU device state machine
 * UNINITIALIZED → REQUESTING → READY → [LOST | DESTROYED]
 */
export enum GPUDeviceState {
  UNINITIALIZED = "UNINITIALIZED",
  REQUESTING = "REQUESTING",
  READY = "READY",
  LOST = "LOST",
  DESTROYED = "DESTROYED",
}

/**
 * GPU buffer state machine
 * UNMAPPED → [MAPPING_PENDING → MAPPED → UNMAPPED] → DESTROYED
 */
export enum GPUBufferState {
  UNMAPPED = "UNMAPPED",
  MAPPED_FOR_READING = "MAPPED_FOR_READING",
  MAPPED_FOR_WRITING = "MAPPED_FOR_WRITING",
  MAPPING_PENDING = "MAPPING_PENDING",
  DESTROYED = "DESTROYED",
}

/**
 * GPU pipeline state
 */
export enum GPUPipelineState {
  COMPILING = "COMPILING",
  READY = "READY",
  ERROR = "ERROR",
  DESTROYED = "DESTROYED",
}

// ============================================================================
// GPU HARDWARE DETECTION
// ============================================================================

/**
 * GPU vendor enumeration
 */
export enum GPUVendor {
  NVIDIA = "NVIDIA",
  AMD = "AMD",
  INTEL = "INTEL",
  APPLE = "APPLE",
  QUALCOMM = "QUALCOMM",
  ARM = "ARM",
  UNKNOWN = "UNKNOWN",
}

/**
 * GPU performance tier classification
 */
export enum GPUPerformanceTier {
  HIGH = "HIGH", // Discrete GPU, >8GB VRAM
  MEDIUM = "MEDIUM", // Integrated GPU, 4-8GB VRAM
  LOW = "LOW", // Integrated GPU, <4GB VRAM
}

// ============================================================================
// USAGE FLAGS AND ENUMS
// ============================================================================

/**
 * GPU buffer usage flags (bitfield)
 */
export enum GPUBufferUsageFlags {
  MAP_READ = 0x0001,
  MAP_WRITE = 0x0002,
  COPY_SRC = 0x0004,
  COPY_DST = 0x0008,
  INDEX = 0x0010,
  VERTEX = 0x0020,
  UNIFORM = 0x0040,
  STORAGE = 0x0080,
  INDIRECT = 0x0100,
  QUERY_RESOLVE = 0x0200,
}

/**
 * GPU texture format enumeration
 */
export enum GPUTextureFormat {
  RGBA8_UNORM = "rgba8unorm",
  RGBA8_UNORM_SRGB = "rgba8unorm-srgb",
  BGRA8_UNORM = "bgra8unorm",
  BGRA8_UNORM_SRGB = "bgra8unorm-srgb",
  RGBA16_FLOAT = "rgba16float",
  RGBA32_FLOAT = "rgba32float",
  DEPTH24_PLUS = "depth24plus",
  DEPTH32_FLOAT = "depth32float",
}

/**
 * GPU shader stage flags
 */
export enum GPUShaderStageFlags {
  VERTEX = 0x1,
  FRAGMENT = 0x2,
  COMPUTE = 0x4,
}

/**
 * GPU primitive topology
 */
export enum GPUPrimitiveTopology {
  POINT_LIST = "point-list",
  LINE_LIST = "line-list",
  LINE_STRIP = "line-strip",
  TRIANGLE_LIST = "triangle-list",
  TRIANGLE_STRIP = "triangle-strip",
}

/**
 * GPU index format
 */
export enum GPUIndexFormat {
  UINT16 = "uint16",
  UINT32 = "uint32",
}

/**
 * GPU present mode (vsync control)
 */
export enum GPUPresentMode {
  IMMEDIATE = "immediate", // No vsync
  MAILBOX = "mailbox", // Triple buffering
  FIFO = "fifo", // Vsync (60fps)
}

// ============================================================================
// ADAPTER AND DEVICE
// ============================================================================

/**
 * GPU adapter information
 */
export interface GPUAdapterInfo {
  readonly id: string;
  readonly vendor: string;
  readonly architecture: string;
  readonly device: string;
  readonly description: string;
  readonly isFallbackAdapter: boolean;
}

/**
 * GPU device limits
 */
export interface GPUDeviceLimits {
  maxTextureDimension1D: number;
  maxTextureDimension2D: number;
  maxTextureDimension3D: number;
  maxTextureArrayLayers: number;
  maxBindGroups: number;
  maxBindingsPerBindGroup: number;
  maxDynamicUniformBuffersPerPipelineLayout: number;
  maxDynamicStorageBuffersPerPipelineLayout: number;
  maxSampledTexturesPerShaderStage: number;
  maxSamplersPerShaderStage: number;
  maxStorageBuffersPerShaderStage: number;
  maxStorageTexturesPerShaderStage: number;
  maxUniformBuffersPerShaderStage: number;
  maxUniformBufferBindingSize: number; // Typically 64KB
  maxStorageBufferBindingSize: number; // Typically 128MB
  maxBufferSize: number;
  maxVertexBuffers: number;
  maxVertexAttributes: number;
  maxVertexBufferArrayStride: number;
  maxComputeWorkgroupStorageSize: number;
  maxComputeInvocationsPerWorkgroup: number;
  maxComputeWorkgroupSizeX: number;
  maxComputeWorkgroupSizeY: number;
  maxComputeWorkgroupSizeZ: number;
  maxComputeWorkgroupsPerDimension: number;
}

/**
 * GPU device features
 */
export interface GPUDeviceFeatures {
  depthClipControl: boolean;
  depth32floatStencil8: boolean;
  textureCompressionBC: boolean;
  textureCompressionETC2: boolean;
  textureCompressionASTC: boolean;
  timestampQuery: boolean;
  indirectFirstInstance: boolean;
  shaderF16: boolean;
  rg11b10ufloatRenderable: boolean;
  bgra8unormStorage: boolean;
  float32Filterable: boolean;
}

/**
 * GPU device descriptor
 */
export interface GPUDeviceDescriptor {
  readonly deviceId: GPUDeviceID;
  state: GPUDeviceState;
  adapter: GPUAdapterInfo;
  limits: GPUDeviceLimits;
  features: Set<string>;
  readonly createdAt: Timestamp;
  lostReason?: string;
}

// ============================================================================
// BUFFERS
// ============================================================================

/**
 * GPU buffer descriptor
 */
export interface GPUBufferDescriptor {
  readonly id: GPUBufferID;
  size: GPUSize;
  usage: number; // Bitfield of GPUBufferUsageFlags
  mappedAtCreation: boolean;
  state: GPUBufferState;
  readonly createdAt: Timestamp;
  lastAccessedAt: Timestamp;
  accessCount: number;
}

/**
 * Pooled GPU buffer entry
 */
export interface PooledGPUBuffer {
  readonly id: GPUBufferID;
  buffer: GPUBuffer;
  size: GPUSize;
  usage: number;
  state: GPUBufferState;
  readonly createdAt: Timestamp;
  lastUsedAt: Timestamp;
  useCount: number;
  mappedRange: ArrayBuffer | null;
}

// ============================================================================
// SHADERS AND PIPELINES
// ============================================================================

/**
 * GPU shader module descriptor
 */
export interface GPUShaderModuleDescriptor {
  code: string; // WGSL source code
  label?: string;
  sourceMap?: Record<string, unknown>;
}

/**
 * GPU vertex attribute
 */
export interface GPUVertexAttribute {
  format: string; // "float32x2", "float32x3", "float32x4", etc.
  offset: number;
  shaderLocation: number;
}

/**
 * GPU vertex buffer layout
 */
export interface GPUVertexBufferLayout {
  arrayStride: number;
  stepMode: "vertex" | "instance";
  attributes: GPUVertexAttribute[];
}

/**
 * GPU render pipeline descriptor
 */
export interface GPURenderPipelineDescriptor {
  readonly id: GPURenderPipelineID;
  label?: string;
  vertexShader: GPUShaderModuleDescriptor;
  fragmentShader?: GPUShaderModuleDescriptor;
  primitiveTopology: GPUPrimitiveTopology;
  vertexBuffers: GPUVertexBufferLayout[];
  colorFormats: GPUTextureFormat[];
  depthStencilFormat?: GPUTextureFormat;
  sampleCount: number;
  state: GPUPipelineState;
  readonly createdAt: Timestamp;
  compilationTime?: Duration;
}

/**
 * GPU compute pipeline descriptor
 */
export interface GPUComputePipelineDescriptor {
  readonly id: GPUComputePipelineID;
  label?: string;
  shader: GPUShaderModuleDescriptor;
  entryPoint: string;
  state: GPUPipelineState;
  readonly createdAt: Timestamp;
  compilationTime?: Duration;
}

// ============================================================================
// TEXTURES
// ============================================================================

/**
 * GPU texture descriptor
 */
export interface GPUTextureDescriptor {
  readonly id: GPUTextureID;
  width: Pixels;
  height: Pixels;
  depth?: number;
  format: GPUTextureFormat;
  usage: number; // GPUTextureUsage flags
  mipLevelCount: number;
  sampleCount: number;
  readonly createdAt: Timestamp;
}

/**
 * GPU texture view
 */
export interface GPUTextureView {
  readonly id: string;
  texture: GPUTextureID;
  format: GPUTextureFormat;
  dimension: "1d" | "2d" | "2d-array" | "cube" | "3d";
  baseMipLevel: number;
  mipLevelCount: number;
  baseArrayLayer: number;
  arrayLayerCount: number;
}

// ============================================================================
// COMMAND ENCODING
// ============================================================================

/**
 * GPU command encoder descriptor
 */
export interface GPUCommandEncoderDescriptor {
  label?: string;
  measureExecutionTime?: boolean;
}

/**
 * GPU color attachment
 */
export interface GPUColorAttachment {
  view: GPUTextureView;
  loadOp: "load" | "clear";
  storeOp: "store" | "discard";
  clearValue?: { r: number; g: number; b: number; a: number };
}

/**
 * GPU depth stencil attachment
 */
export interface GPUDepthStencilAttachment {
  view: GPUTextureView;
  depthLoadOp: "load" | "clear";
  depthStoreOp: "store" | "discard";
  depthClearValue?: number;
  stencilLoadOp?: "load" | "clear";
  stencilStoreOp?: "store" | "discard";
  stencilClearValue?: number;
}

/**
 * GPU render pass descriptor
 */
export interface GPURenderPassDescriptor {
  label?: string;
  colorAttachments: GPUColorAttachment[];
  depthStencilAttachment?: GPUDepthStencilAttachment;
  timestampWrites?: unknown;
}

/**
 * GPU compute pass descriptor
 */
export interface GPUComputePassDescriptor {
  label?: string;
  timestampWrites?: unknown;
}

// ============================================================================
// COMPUTE WORKGROUPS
// ============================================================================

/**
 * Compute workgroup configuration
 */
export interface WorkgroupConfig {
  x: number; // Workgroup count X (max varies by GPU)
  y: number; // Workgroup count Y
  z: number; // Workgroup count Z
}

/**
 * Compute dispatch configuration
 */
export interface ComputeDispatch {
  pipeline: GPUComputePipeline;
  bindGroups: GPUBindGroup[];
  workgroupCount: WorkgroupConfig;
  debugLabel?: string;
}

// ============================================================================
// MEMORY MANAGEMENT
// ============================================================================

/**
 * Memory allocation strategy
 */
export enum AllocationStrategy {
  POOLED = "POOLED", // Fixed-size pools
  DYNAMIC = "DYNAMIC", // On-demand allocation
  STAGING_RING = "STAGING_RING", // Ring buffer for streaming
}

/**
 * Memory pressure level
 */
export type MemoryPressureLevel =
  | "none"
  | "low"
  | "medium"
  | "high"
  | "critical";

/**
 * Memory pressure information
 */
export interface MemoryPressureInfo {
  totalAllocated: ByteCount;
  totalAvailable: ByteCount;
  pressureLevel: MemoryPressureLevel;
  recommendedAction: "none" | "reduce" | "purge" | "block";
}

/**
 * Staging buffer ring
 */
export interface StagingBufferRing {
  buffers: GPUBuffer[];
  currentIndex: number;
  bufferSize: GPUSize;
  bufferCount: number;
}

/**
 * GPU buffer allocation
 */
export interface GPUBufferAllocation {
  buffer: GPUBuffer;
  offset: number;
  size: GPUSize;
}

/**
 * Memory block
 */
export interface MemoryBlock {
  buffer: GPUBuffer;
  size: GPUSize;
  allocations: Map<number, GPUBufferAllocation>;
  freeRanges: FreeRange[];
}

/**
 * Free memory range
 */
export interface FreeRange {
  offset: number;
  size: GPUSize;
}

// ============================================================================
// GPU CAPABILITIES
// ============================================================================

/**
 * GPU capabilities
 */
export interface GPUCapabilities {
  vendor: GPUVendor;
  performanceTier: GPUPerformanceTier;
  maxTextureSize: Pixels;
  maxBufferSize: ByteCount;
  maxComputeWorkgroupsPerDimension: number;
  maxComputeInvocationsPerWorkgroup: number;
  maxStorageBufferBindingSize: ByteCount;
  supportsTimestampQuery: boolean;
  supportsComputeShaders: boolean;
  supportsRayTracing: boolean;
  limits: GPULimitsInfo;
}

/**
 * GPU limits information
 */
export interface GPULimitsInfo {
  maxBindGroups: number;
  maxDynamicUniformBuffersPerPipelineLayout: number;
  maxDynamicStorageBuffersPerPipelineLayout: number;
  maxSampledTexturesPerShaderStage: number;
  maxStorageBuffersPerShaderStage: number;
  maxUniformBuffersPerShaderStage: number;
}

/**
 * Optimization hints
 */
export interface OptimizationHints {
  preferredWorkgroupSize: number;
  preferredTileSize: number;
  useSharedMemory: boolean;
  asyncCompute: boolean;
}

// ============================================================================
// STATISTICS
// ============================================================================

/**
 * GPU buffer statistics
 */
export interface GPUBufferStats {
  totalAllocated: number;
  totalDeallocated: number;
  currentInUse: number;
  totalBytes: ByteCount;
  peakBytes: ByteCount;
  mapOperations: number;
  unmapOperations: number;
  writeOperations: number;
  readOperations: number;
}

/**
 * GPU pipeline statistics
 */
export interface GPUPipelineStats {
  renderPipelinesCreated: number;
  computePipelinesCreated: number;
  renderPipelinesCached: number;
  computePipelinesCached: number;
  averageCompilationTime: Duration;
  totalCompilationTime: Duration;
}

/**
 * GPU command statistics
 */
export interface GPUCommandStats {
  commandBuffersCreated: number;
  commandBuffersSubmitted: number;
  renderPassesEncoded: number;
  computePassesEncoded: number;
  drawCalls: number;
  dispatchCalls: number;
  totalGPUTime?: Duration;
}

/**
 * GPU device statistics
 */
export interface GPUDeviceStats {
  uptime: Duration;
  bufferStats: GPUBufferStats;
  pipelineStats: GPUPipelineStats;
  commandStats: GPUCommandStats;
  memoryUsage: ByteCount;
  peakMemoryUsage: ByteCount;
}

/**
 * Buffer pool statistics
 */
export interface BufferPoolStats {
  poolHits: number;
  poolMisses: number;
  totalAcquired: number;
  totalReleased: number;
  currentPooled: number;
  poolSizes: Map<number, number>; // Size → count
}

/**
 * WebGPU engine statistics (aggregate)
 */
export interface WebGPUEngineStats {
  deviceStats: GPUDeviceStats;
  bufferPoolStats: BufferPoolStats;
  capabilities: GPUCapabilities;
  memoryPressure: MemoryPressureInfo;
}

// ============================================================================
// CANVAS CONTEXT
// ============================================================================

/**
 * WebGPU canvas alpha mode
 */
export type GPUCanvasAlphaMode = "opaque" | "premultiplied";

/**
 * WebGPU canvas configuration
 */
export interface WebGPUCanvasConfig {
  device: GPUDevice;
  canvas: HTMLCanvasElement;
  format: GPUTextureFormat;
  alphaMode: GPUCanvasAlphaMode;
  usage: number; // GPUTextureUsage flags
  colorSpace: PredefinedColorSpace;
  presentMode: GPUPresentMode;
}

// ============================================================================
// WORKER SUPPORT
// ============================================================================

/**
 * GPU worker message type
 */
export enum GPUWorkerMessageType {
  INIT = "INIT",
  COMPILE_SHADER = "COMPILE_SHADER",
  DISPATCH_COMPUTE = "DISPATCH_COMPUTE",
  UPLOAD_DATA = "UPLOAD_DATA",
  DOWNLOAD_DATA = "DOWNLOAD_DATA",
  DESTROY = "DESTROY",
}

/**
 * GPU worker message
 */
export interface GPUWorkerMessage {
  type: GPUWorkerMessageType;
  id: string; // Request ID
  payload: unknown;
}

/**
 * Worker response
 */
export interface WorkerResponse {
  id: string;
  success: boolean;
  result?: unknown;
  error?: string;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * WebGPU device configuration
 */
export interface WebGPUDeviceConfig {
  powerPreference?: "low-power" | "high-performance";
  requiredFeatures?: string[];
  requiredLimits?: Partial<GPUDeviceLimits>;
}

/**
 * Compositor backend selection
 */
export enum CompositorBackend {
  WEBGPU = "webgpu",
  WEBGL = "webgl",
  AUTO = "auto",
}

/**
 * Compositor configuration
 */
export interface CompositorConfig {
  enableVSync: boolean;
  enableTiling: boolean;
  targetFPS: number;
  maxTextureSize: Pixels;
  backend?: CompositorBackend;
  fallbackToWebGL?: boolean;
}
