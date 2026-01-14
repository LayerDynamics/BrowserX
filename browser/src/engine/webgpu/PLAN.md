# WebGPU Module Complete Implementation Plan

**Project:** BrowserX WebGPU Engine
**Status:** Planning Phase
**Target:** Production-ready, fully functional WebGPU implementation
**Quality Standard:** Match existing browser modules (network, rendering, javascript layers)

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current State Assessment](#current-state-assessment)
3. [Architecture Overview](#architecture-overview)
4. [Implementation Phases](#implementation-phases)
5. [Core Type System](#core-type-system)
6. [Module Implementations](#module-implementations)
7. [Integration Strategy](#integration-strategy)
8. [Testing Approach](#testing-approach)
9. [Performance Targets](#performance-targets)
10. [Critical Path](#critical-path)

---

## Executive Summary

### Objective
Implement a complete, production-ready WebGPU module for BrowserX that provides:
- Modern GPU-accelerated rendering (replacing WebGL in compositor)
- Compute shader support for parallel processing
- Memory-efficient buffer and texture management
- Multi-threaded worker support
- Hardware capability detection and optimization
- Graceful fallback to WebGL when WebGPU unavailable

### Current State
- **Directory structure**: Established with 31 TypeScript files
- **Implementation**: 0% (all files are empty placeholders)
- **Integration points**: Identified in CompositorThread, GPU.ts
- **Dependencies**: Native WebGPU API (navigator.gpu)

### Success Criteria
1. **Functionality**: All 31 files fully implemented with production code
2. **Quality**: Match existing browser module standards (error handling, state machines, statistics)
3. **Performance**: 2-3x CPU reduction vs WebGL, 20-30% GPU memory reduction
4. **Integration**: Seamless replacement of WebGL compositor with WebGPU
5. **Testing**: Comprehensive unit, integration, and visual regression tests
6. **Documentation**: Complete API documentation and usage examples

---

## Current State Assessment

### File Structure Analysis

**Total Files**: 31 TypeScript files across 9 subdirectories
**Current Implementation**: 0 lines of code (all files empty)

```
/browser/src/engine/webgpu/
├── mod.ts                          # Empty - needs exports
├── WebGPU.ts                       # Empty - needs main engine class
├── Navigator.ts                    # Empty - needs navigator.gpu wrapper
├── CanvasContext.ts                # Empty - needs canvas context management
├── Acceleration.ts                 # Empty - needs hardware detection
│
├── adapter/
│   ├── mod.ts                      # Empty
│   └── Device.ts                   # Empty - needs device management
│
├── buffer/
│   ├── mod.ts                      # Empty
│   ├── Create.ts                   # Empty - needs buffer creation
│   ├── Allocate.ts                 # Empty - needs memory allocation
│   ├── Copy.ts                     # Empty - needs copy operations
│   ├── Size.ts                     # Empty - needs size calculations
│   ├── Staging.ts                  # Empty - needs staging pool
│   ├── BufferToBuffer.ts           # Empty - needs transfer ops
│   └── Array.ts                    # Empty - needs typed array utils
│
├── driver/
│   └── mod.ts                      # Empty - needs driver abstraction
│
├── encoder/
│   └── mod.ts                      # Empty - needs command encoding
│
├── memory/
│   └── mod.ts                      # Empty - needs memory management
│
├── operations/
│   ├── mod.ts                      # Empty
│   ├── render/
│   │   ├── mod.ts                  # Empty
│   │   └── shaders/mod.ts          # Empty - needs WGSL shaders
│   ├── compute/
│   │   ├── mod.ts                  # Empty
│   │   └── shaders/mod.ts          # Empty - needs compute shaders
│   ├── draw/mod.ts                 # Empty - needs draw commands
│   └── execute/mod.ts              # Empty - needs execution logic
│
├── pipelines/
│   └── mod.ts                      # Empty - needs pipeline management
│
├── utils/
│   ├── mod.ts                      # Empty
│   ├── DetectSystem.ts             # Empty - needs system detection
│   └── DetectGPUType.ts            # Empty - needs GPU detection
│
└── worker/
    ├── mod.ts                      # Empty
    └── WorkerNavigator.ts          # Empty - needs worker support
```

### Existing Integration Points

**1. GPU.ts** (`/browser/src/os/graphics/GPU.ts`)
- 170 lines using native WebGPU API
- Has TODO for WebGPU compositing pipeline (line 141)
- Currently uses WebGL fallback approach

**2. CompositorThread.ts** (`/browser/src/engine/rendering/compositor/CompositorThread.ts`)
- 575 lines using WebGL
- Needs WebGPU alternative: `WebGPUCompositorThread`
- Integration point for rendering pipeline

**3. CompositorLayer.ts** (`/browser/src/engine/rendering/compositor/CompositorLayer.ts`)
- 622 lines managing WebGL textures
- Needs WebGPU version for texture management

**4. Type System**
- No WebGPU types defined yet
- Need new file: `/browser/src/types/webgpu.ts`

### Quality Standards (from existing modules)

**Network Layer Pattern** (connection/ConnectionPool.ts):
- Resource pooling with size limits
- State machines (IDLE → IN_USE → CLOSING → CLOSED)
- Statistics tracking (pool size, reuse count, wait time)
- Cleanup timers and dispose methods

**Rendering Layer Pattern** (compositor/CompositorThread.ts):
- Factory patterns for configuration
- VSync integration for frame timing
- Comprehensive error handling
- Export APIs for debugging

**JavaScript Layer Pattern** (javascript/V8Isolate.ts):
- Strong typing with branded IDs
- Lifecycle management (initialize → ready → destroyed)
- Memory tracking and GC integration
- Async/await for long operations

---

## Architecture Overview

### System Architecture

```
Browser Process (main.ts)
    ↓
WebGPU Engine (WebGPU.ts)
    ↓
    ├── Adapter/Device Management
    │   └── Device initialization, feature detection
    ↓
    ├── Buffer Management
    │   ├── Buffer Pool (reuse)
    │   ├── Staging Ring (uploads)
    │   └── Memory Allocator
    ↓
    ├── Pipeline Management
    │   ├── Render Pipelines (WGSL shaders)
    │   ├── Compute Pipelines (parallel compute)
    │   └── Pipeline Cache
    ↓
    ├── Command Encoding
    │   ├── Command Encoder
    │   ├── Render Pass
    │   └── Compute Pass
    ↓
    ├── Operations
    │   ├── Render Operations (draw calls)
    │   ├── Compute Operations (dispatch)
    │   ├── Copy Operations (transfers)
    │   └── Execute Operations (submit)
    ↓
    ├── Worker Support
    │   ├── Worker Navigator
    │   ├── Message Protocol
    │   └── Offscreen Canvas
    ↓
    └── Utilities
        ├── GPU Detection (vendor/model)
        ├── System Detection (OS/browser)
        └── Hardware Acceleration (capabilities)
```

### Integration with Rendering Pipeline

```
RenderingPipeline.ts
    ↓
RenderToPixels.ts (generate display lists)
    ↓
LayerTree (paint layers)
    ↓
    ┌──────────────────┐
    │ CompositorFactory │ (auto-select backend)
    └──────────────────┘
           ↓
    ┌──────────┴──────────┐
    ↓                     ↓
WebGPUCompositorThread   CompositorThread (WebGL fallback)
    ↓
WebGPUCompositorLayer
    ↓
Texture Upload (WebGPU)
    ↓
Render Pass Encoding
    ↓
Command Submission
    ↓
Canvas Present (swap buffers)
```

### Data Flow

**Rendering Flow:**
1. Parse HTML/CSS → DOM/CSSOM
2. Build Render Tree
3. Layout calculation → LayoutBox tree
4. Paint → DisplayList per layer
5. Composite (WebGPU):
   - Upload textures from ImageBitmap
   - Create render pipeline with WGSL shaders
   - Encode render pass (textured quads)
   - Submit command buffer
   - Present to canvas

**Compute Flow:**
1. Compile WGSL compute shader
2. Create compute pipeline
3. Allocate input/output buffers
4. Create bind groups (bindings)
5. Encode compute pass
6. Dispatch workgroups
7. Submit command buffer
8. Read back results (buffer mapping)

---

## Implementation Phases

### Phase 1: Foundation (Week 1)
**Goal**: Core infrastructure and type system

**Tasks**:
1. Create type system (`/browser/src/types/webgpu.ts`)
   - Identifiers (GPUDeviceID, GPUBufferID, etc.)
   - Enums (state machines, usage flags)
   - Interfaces (descriptors, statistics)
   - 400+ lines

2. Implement adapter/Device.ts
   - WebGPUDevice class with state machine
   - Device initialization (requestAdapter, requestDevice)
   - Feature detection and limits
   - Error handling (device lost, validation)
   - Statistics tracking
   - 600+ lines

3. Create error classes (`errors.ts`)
   - WebGPUError base class
   - GPUDeviceError, GPUBufferError, GPUPipelineError
   - GPUShaderError, GPUValidationError
   - 150+ lines

4. Implement driver abstraction (`driver/mod.ts`)
   - WebGPUDriver class
   - Device recovery on lost
   - Error recovery strategies
   - 400+ lines

**Deliverables**:
- Complete type system
- Device management
- Error handling framework
- Driver abstraction
- Unit tests for device lifecycle

### Phase 2: Buffer Management (Week 2)
**Goal**: Memory-efficient buffer operations

**Tasks**:
1. Implement buffer/Create.ts
   - WebGPUBuffer class with state machine
   - Buffer creation with usage validation
   - write() using writeBuffer (recommended path)
   - mapAsync() for CPU access
   - 500+ lines

2. Implement buffer/Staging.ts
   - StagingBufferPool (following BufferPool pattern)
   - Standard sizes (256B to 1MB)
   - acquire()/release() methods
   - Pool statistics
   - 300+ lines

3. Implement buffer/Copy.ts
   - BufferCopyOperations class
   - copyBufferToBuffer()
   - Validation (COPY_SRC/COPY_DST usage)
   - 200+ lines

4. Implement buffer/Size.ts
   - alignSize() function
   - calculateUniformBufferSize() (256-byte aligned)
   - calculateStorageBufferSize() (4-byte aligned)
   - 100+ lines

5. Implement buffer/Array.ts
   - Typed array utilities
   - createAlignedFloat32Array()
   - createIndexArray()
   - interleaveVertexData()
   - 150+ lines

6. Implement memory/mod.ts
   - WebGPUBufferPool (full implementation)
   - StagingBufferRing (triple buffering)
   - GPUMemoryAllocator (optional defragmentation)
   - 800+ lines

**Deliverables**:
- Complete buffer management system
- Memory pooling with reuse
- Staging buffer infrastructure
- Unit tests for all buffer operations

### Phase 3: Pipeline System (Week 3)
**Goal**: Shader compilation and pipeline management

**Tasks**:
1. Implement pipelines/mod.ts
   - WebGPURenderPipeline class
   - WebGPUComputePipeline class
   - PipelineCache for reuse
   - Shader compilation with error checking
   - 700+ lines

2. Create WGSL shaders (operations/render/shaders/)
   - compositor.wgsl (vertex + fragment for layer compositing)
   - fullscreen.wgsl (post-processing)
   - Standard vertex transformation
   - 200+ lines

3. Create compute shaders (operations/compute/shaders/)
   - ImageFilter.wgsl (Gaussian blur)
   - VectorOps.wgsl (parallel math operations)
   - Reduction.wgsl (parallel sum/min/max)
   - 300+ lines

4. Implement encoder/mod.ts
   - WebGPUCommandEncoder class
   - begin()/submit() methods
   - beginRenderPass()
   - beginComputePass()
   - 300+ lines

**Deliverables**:
- Render pipeline creation
- Compute pipeline creation
- Shader library (WGSL)
- Command encoder
- Unit tests for pipeline lifecycle

### Phase 4: Rendering Integration (Week 4)
**Goal**: Replace WebGL with WebGPU in compositor

**Tasks**:
1. Implement CanvasContext.ts
   - WebGPUCanvasContext class
   - configure() for swap chain
   - getCurrentTexture()
   - present() for frame display
   - resize() handling
   - 250+ lines

2. Implement operations/render/TextureManager.ts
   - TextureManager class
   - createTextureFromBitmap() (most efficient)
   - createTextureFromPixels() (staging)
   - Sampler configuration (LINEAR, NEAREST)
   - Texture caching by ID
   - 600+ lines

3. Create WebGPUCompositorThread.ts
   - Main compositor class using WebGPU
   - initialize() with device/canvas setup
   - compositeFrame() method
   - Layer texture upload
   - Render pass encoding
   - Transform matrix calculations
   - 900+ lines

4. Create WebGPUCompositorLayer.ts
   - Layer wrapper for WebGPU
   - uploadTexture() via TextureManager
   - Tiling support (256px tiles)
   - getTextureView() for binding
   - 700+ lines

5. Implement CompositingPipeline.ts
   - Pipeline for layer compositing
   - Blend mode mapping (SOURCE_OVER, MULTIPLY, SCREEN)
   - Bind group layout (uniforms, sampler, texture)
   - 500+ lines

6. Update CompositorFactory.ts
   - Auto-detect WebGPU support
   - Backend selection (AUTO, WEBGPU, WEBGL)
   - Fallback to WebGL
   - 250+ lines

**Deliverables**:
- Complete WebGPU compositor
- Canvas context management
- Texture management system
- Rendering pipeline integration
- Visual regression tests (WebGPU vs WebGL)

### Phase 5: Compute & Advanced Features (Week 5)
**Goal**: Compute pipelines and worker support

**Tasks**:
1. Implement operations/compute/ComputePipeline.ts
   - ComputePipelineManager class
   - compileShader() for WGSL
   - dispatch() with workgroup config
   - calculateWorkgroups() helper
   - 500+ lines

2. Implement worker/WorkerNavigator.ts
   - WorkerGPUNavigator class
   - initialize() in worker context
   - createOffscreenCanvas()
   - submitCompute() from worker
   - 300+ lines

3. Implement worker/MessageProtocol.ts
   - GPUWorkerManager class
   - Message types (INIT, COMPILE_SHADER, DISPATCH_COMPUTE)
   - spawnWorker()/sendMessage()
   - Promise-based communication
   - 400+ lines

4. Implement Acceleration.ts
   - HardwareAccelerationManager class
   - initialize() with capability detection
   - getOptimizationHints() (vendor-specific)
   - Performance tier detection
   - 400+ lines

5. Implement utils/DetectGPUType.ts
   - GPUVendorDetector class
   - detectVendor() (NVIDIA, AMD, Intel, Apple)
   - detectPerformanceTier() (HIGH, MEDIUM, LOW)
   - checkFeatures()
   - 300+ lines

6. Implement utils/DetectSystem.ts
   - SystemDetector class
   - detectOS()
   - checkWebGPUSupport()
   - getSystemMemory()
   - 200+ lines

7. Implement operations/execute/mod.ts
   - CommandEncoderManager class
   - createEncoder()/submit()
   - writeBuffer()/copyBufferToBuffer()
   - 250+ lines

8. Implement operations/draw/mod.ts
   - DrawCommandManager class
   - draw()/drawIndexed()
   - drawIndirect()/drawIndexedIndirect()
   - 200+ lines

**Deliverables**:
- Compute shader support
- Worker-based GPU compute
- Hardware detection and optimization
- Draw command utilities
- Compute shader examples

### Phase 6: Main Engine & Integration (Week 6)
**Goal**: Unified WebGPU engine and browser integration

**Tasks**:
1. Implement WebGPU.ts (main engine)
   - WebGPUEngine class
   - initialize() all subsystems
   - executeCompute() high-level API
   - spawnWorker() helper
   - getStats() aggregation
   - 600+ lines

2. Implement Navigator.ts
   - navigator.gpu wrapper
   - Feature detection helpers
   - Adapter enumeration
   - 200+ lines

3. Update main.ts (browser integration)
   - Add webgpuEngine property
   - Initialize WebGPU in constructor
   - getWebGPUEngine() accessor
   - Config flag: enableWebGPU
   - 50+ lines (modifications)

4. Create mod.ts (module exports)
   - Export all public APIs
   - Re-export types
   - 100+ lines

5. Update RenderingPipeline.ts
   - Use CompositorFactory for backend selection
   - Pass config.backend flag
   - 20+ lines (modifications)

**Deliverables**:
- Complete WebGPU engine
- Browser integration
- Public API surface
- Module exports
- Configuration options

### Phase 7: Testing & Documentation (Week 7)
**Goal**: Comprehensive testing and documentation

**Tasks**:
1. Unit tests for all modules
   - Device lifecycle tests
   - Buffer pool tests
   - Pipeline compilation tests
   - Compute shader tests
   - Worker communication tests
   - 2000+ lines

2. Integration tests
   - End-to-end rendering tests
   - Compositor integration tests
   - Texture upload/download tests
   - 1000+ lines

3. Visual regression tests
   - Compare WebGPU vs WebGL output
   - Pixel-perfect comparison
   - 500+ lines

4. Performance benchmarks
   - Frame time comparison
   - Memory usage comparison
   - Compute shader benchmarks
   - 500+ lines

5. API documentation
   - JSDoc for all public APIs
   - Usage examples
   - Architecture diagrams
   - README.md

**Deliverables**:
- 95%+ test coverage
- Performance validation
- Complete documentation
- Example applications

---

## Core Type System

### File: `/browser/src/types/webgpu.ts` (NEW)

This file defines all WebGPU types used throughout the module.

**Identifiers** (20+ types):
```typescript
type GPUDeviceID = string;
type GPUBufferID = string;
type GPUTextureID = string;
type GPUPipelineID = string;
type GPUBindGroupID = string;
type ComputePipelineID = string;
type RenderPipelineID = string;
type ShaderModuleID = string;
// ... more
```

**State Machines** (5+ enums):
```typescript
enum GPUDeviceState {
    UNINITIALIZED, REQUESTING, READY, LOST, DESTROYED
}

enum GPUBufferState {
    UNMAPPED, MAPPED_FOR_READING, MAPPED_FOR_WRITING,
    PENDING_MAP, DESTROYED
}

enum GPUPipelineState {
    COMPILING, READY, ERROR, DESTROYED
}

enum GPUVendor {
    NVIDIA, AMD, INTEL, APPLE, QUALCOMM, ARM, UNKNOWN
}

enum GPUPerformanceTier {
    HIGH, MEDIUM, LOW
}
```

**Usage Flags**:
```typescript
enum GPUBufferUsageFlags {
    MAP_READ = 0x0001,
    MAP_WRITE = 0x0002,
    COPY_SRC = 0x0004,
    COPY_DST = 0x0008,
    INDEX = 0x0010,
    VERTEX = 0x0020,
    UNIFORM = 0x0040,
    STORAGE = 0x0080,
    INDIRECT = 0x0100,
    QUERY_RESOLVE = 0x0200
}
```

**Descriptors** (20+ interfaces):
```typescript
interface GPUDeviceDescriptor {
    readonly deviceId: GPUDeviceID;
    state: GPUDeviceState;
    adapter: GPUAdapterInfo;
    limits: GPUDeviceLimits;
    features: Set<string>;
    readonly createdAt: Timestamp;
    lostReason?: string;
}

interface GPUBufferDescriptor {
    readonly id: GPUBufferID;
    size: GPUSize;
    usage: number;
    mappedAtCreation: boolean;
    state: GPUBufferState;
    readonly createdAt: Timestamp;
    lastAccessedAt: Timestamp;
    accessCount: number;
}

interface GPURenderPipelineDescriptor {
    readonly id: GPUPipelineID;
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

// ... 15+ more descriptor interfaces
```

**Statistics** (5+ interfaces):
```typescript
interface GPUBufferStats {
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

interface GPUPipelineStats {
    renderPipelinesCreated: number;
    computePipelinesCreated: number;
    renderPipelinesCached: number;
    computePipelinesCached: number;
    averageCompilationTime: Duration;
    totalCompilationTime: Duration;
}

interface GPUDeviceStats {
    uptime: Duration;
    bufferStats: GPUBufferStats;
    pipelineStats: GPUPipelineStats;
    commandStats: GPUCommandStats;
    memoryUsage: ByteCount;
    peakMemoryUsage: ByteCount;
}
```

**Total**: ~400 lines of type definitions

---

## Module Implementations

### 1. Adapter Layer

#### File: `adapter/Device.ts` (~600 lines)

**Purpose**: Manage GPU device lifecycle with state machine and statistics.

**Class**: `WebGPUDevice`

**State Machine**:
```
UNINITIALIZED → REQUESTING → READY → [LOST | DESTROYED]
                                ↑_________|
                             (recovery attempt)
```

**Key Methods**:
- `async initialize(options?: GPURequestAdapterOptions): Promise<void>`
  - Request adapter from navigator.gpu
  - Request device from adapter
  - Set up device lost handler
  - Set up uncaptured error handler
  - Create descriptor with limits/features
  - Transition: UNINITIALIZED → REQUESTING → READY

- `getNativeDevice(): GPUDevice`
  - Return native GPU device
  - Validate state is READY

- `getDescriptor(): GPUDeviceDescriptor`
  - Return device descriptor (copy)

- `getStats(): GPUDeviceStats`
  - Return statistics with uptime

- `updateBufferStats(delta: Partial<GPUBufferStats>): void`
  - Update buffer statistics

- `updatePipelineStats(delta: Partial<GPUPipelineStats>): void`
  - Update pipeline statistics

- `destroy(): void`
  - Destroy native device
  - Transition to DESTROYED

**Error Handling**:
- Device lost → handleDeviceLost()
- Uncaptured errors → handleUncapturedError()
- Validation errors → log and continue
- Out of memory → log and trigger memory pressure

**Statistics Tracked**:
- Uptime
- Buffer allocations/deallocations
- Pipeline compilations
- Command submissions
- Memory usage (current and peak)

---

### 2. Buffer Management Layer

#### File: `buffer/Create.ts` (~500 lines)

**Purpose**: Create and manage GPU buffers with state machine.

**Class**: `WebGPUBuffer`

**State Machine**:
```
UNMAPPED → [MAPPING_PENDING → MAPPED → UNMAPPED] → DESTROYED
                                ↑__________|
                              (map/unmap cycle)
```

**Key Methods**:
- `create(): void`
  - Validate usage flags (no MAP_READ + MAP_WRITE)
  - Validate size against device limits
  - Create GPUBuffer with device.createBuffer()
  - Update device statistics

- `write(data: ArrayBuffer, offset?: number): void`
  - Use queue.writeBuffer() (recommended path)
  - Validate COPY_DST usage
  - Update statistics

- `async mapAsync(mode: GPUMapModeFlags): Promise<void>`
  - Validate usage (MAP_READ or MAP_WRITE)
  - State: UNMAPPED → MAPPING_PENDING → MAPPED
  - Store mapped range

- `getMappedRange(): ArrayBuffer`
  - Return mapped range
  - Validate state is MAPPED

- `unmap(): void`
  - Call buffer.unmap()
  - State: MAPPED → UNMAPPED
  - Clear mapped range

- `destroy(): void`
  - Destroy GPUBuffer
  - Update device statistics
  - State: * → DESTROYED

**Validation**:
- Usage flag conflicts (MAP_READ + MAP_WRITE)
- Size limits (uniform: 64KB, storage: 128MB)
- State transitions

#### File: `buffer/Staging.ts` (~300 lines)

**Purpose**: Pool of staging buffers for efficient CPU→GPU uploads.

**Class**: `StagingBufferPool`

**Standard Sizes**: [256, 1024, 4096, 16384, 65536, 262144, 1048576] bytes

**Key Methods**:
- `acquire(minSize: ByteCount): WebGPUBuffer`
  - Find smallest size ≥ minSize
  - Return from pool if available
  - Create new if pool empty

- `release(buffer: WebGPUBuffer): void`
  - Return to pool if standard size
  - Destroy if oversized or pool full (>20)

- `clear(): void`
  - Destroy all pooled buffers

**Pattern**: Follows existing BufferPool from network layer

#### File: `buffer/Copy.ts` (~200 lines)

**Purpose**: Buffer-to-buffer copy operations.

**Class**: `BufferCopyOperations`

**Key Methods**:
- `copyBufferToBuffer(source, destination, sourceOffset, destOffset, size?)`
  - Validate COPY_SRC/COPY_DST usage
  - Create command encoder
  - Encode copy command
  - Submit command buffer

#### File: `buffer/Size.ts` (~100 lines)

**Purpose**: Size calculation and alignment utilities.

**Functions**:
- `alignSize(size: number, alignment: number): number`
- `calculateUniformBufferSize(dataSize: number): number` (256-byte aligned)
- `calculateStorageBufferSize(dataSize: number): number` (4-byte aligned)
- `calculateVertexBufferSize(vertexCount, vertexSize): number`
- `calculateIndexBufferSize(indexCount, indexFormat): number`

#### File: `buffer/Array.ts` (~150 lines)

**Purpose**: Typed array utilities for GPU buffers.

**Functions**:
- `createAlignedFloat32Array(data: number[], alignment?: number): Float32Array`
- `createIndexArray(indices: number[]): Uint16Array | Uint32Array`
- `interleaveVertexData(attributes): Float32Array`

---

### 3. Pipeline Management Layer

#### File: `pipelines/mod.ts` (~700 lines)

**Purpose**: Shader compilation and pipeline caching.

**Classes**:

**`WebGPURenderPipeline`**:
- `async create(): Promise<void>`
  - Compile vertex/fragment shaders
  - Check compilation errors with getCompilationInfo()
  - Create render pipeline
  - Track compilation time
  - Update device statistics

- `getNativePipeline(): GPURenderPipeline`

- `destroy(): void`

**`WebGPUComputePipeline`**:
- Similar to render pipeline
- Single compute shader stage

**`PipelineCache`**:
- `async getRenderPipeline(descriptor): Promise<WebGPURenderPipeline>`
  - Hash descriptor → cache key
  - Return cached if exists
  - Create and cache if new

- `clear(): void`
  - Destroy all cached pipelines

**Shader Compilation**:
- Use device.createShaderModule() with WGSL code
- Check compilation messages for errors
- Throw GPUShaderError with line numbers

**Blend Mode Mapping**:
- SOURCE_OVER → `{ srcFactor: 'one', dstFactor: 'one-minus-src-alpha' }`
- MULTIPLY → `{ srcFactor: 'dst-color', dstFactor: 'zero' }`
- SCREEN → `{ srcFactor: 'one', dstFactor: 'one-minus-src-color' }`
- OVERLAY/DARKEN/LIGHTEN → shader-based (not fixed-function)

---

### 4. Shader Library

#### File: `operations/render/shaders/compositor.wgsl` (~100 lines)

**Vertex Shader**:
```wgsl
struct VertexInput {
    @location(0) position: vec2<f32>,
    @location(1) texcoord: vec2<f32>,
};

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) texcoord: vec2<f32>,
};

struct Uniforms {
    transform: mat4x4<f32>,
    opacity: f32,
    padding: vec3<f32>,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;
    output.position = uniforms.transform * vec4<f32>(input.position, 0.0, 1.0);
    output.texcoord = input.texcoord;
    return output;
}
```

**Fragment Shader**:
```wgsl
@group(0) @binding(1) var textureSampler: sampler;
@group(0) @binding(2) var textureData: texture_2d<f32>;

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
    var color = textureSample(textureData, textureSampler, input.texcoord);
    return vec4<f32>(color.rgb * uniforms.opacity, color.a * uniforms.opacity);
}
```

#### File: `operations/compute/shaders/ImageFilter.wgsl` (~150 lines)

**Gaussian Blur**:
```wgsl
@group(0) @binding(0) var inputTexture: texture_2d<f32>;
@group(0) @binding(1) var outputTexture: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(2) var<uniform> params: FilterParams;

struct FilterParams {
    width: u32,
    height: u32,
    blurRadius: f32,
    sigma: f32,
}

@compute
@workgroup_size(16, 16)
fn blur(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let coords = vec2<i32>(global_id.xy);

    if (coords.x >= i32(params.width) || coords.y >= i32(params.height)) {
        return;
    }

    var color = vec3<f32>(0.0);
    var weight_sum = 0.0;

    let radius = i32(params.blurRadius);
    for (var dy = -radius; dy <= radius; dy++) {
        for (var dx = -radius; dx <= radius; dx++) {
            let sample_coords = coords + vec2<i32>(dx, dy);
            let clamped = clamp(
                sample_coords,
                vec2<i32>(0),
                vec2<i32>(i32(params.width) - 1, i32(params.height) - 1)
            );

            let dist = sqrt(f32(dx * dx + dy * dy));
            let weight = exp(-(dist * dist) / (2.0 * params.sigma * params.sigma));

            let sample = textureLoad(inputTexture, clamped, 0).rgb;
            color += sample * weight;
            weight_sum += weight;
        }
    }

    color /= weight_sum;
    textureStore(outputTexture, coords, vec4<f32>(color, 1.0));
}
```

---

### 5. Rendering Integration Layer

#### File: `CanvasContext.ts` (~250 lines)

**Purpose**: Manage WebGPU canvas context and swap chain.

**Class**: `WebGPUCanvasContext`

**Key Methods**:
- `initialize(canvas: HTMLCanvasElement, device: GPUDevice): void`
  - Get WebGPU context: canvas.getContext('webgpu')
  - Store canvas and device references

- `configure(options: Partial<WebGPUCanvasConfig>): void`
  - Configure swap chain with format, alphaMode, presentMode
  - Default: bgra8unorm, premultiplied, fifo (VSync)

- `getCurrentTexture(): GPUTexture`
  - Return current swap chain texture for rendering

- `present(): void`
  - Implicit present on command submission

- `resize(width: number, height: number): void`
  - Update canvas size
  - Reconfigure context

- `unconfigure(): void`
  - Release context resources

#### File: `operations/render/TextureManager.ts` (~600 lines)

**Purpose**: Efficient texture creation and management.

**Class**: `TextureManager`

**Key Methods**:
- `createTextureFromBitmap(bitmap: ImageBitmap): { id: string; texture: GPUTexture }`
  - Create texture with same size as bitmap
  - Upload via copyExternalImageToTexture() (most efficient)
  - Cache by ID

- `createTextureFromPixels(pixels: Uint8Array, width, height): { id: string; texture: GPUTexture }`
  - Create texture with specified size
  - Upload via writeTexture() with staging

- `updateTexture(id, source, x, y, width, height): void`
  - Update sub-region of texture

- `deleteTexture(id: string): void`
  - Destroy texture
  - Remove from cache

- `getSampler(name: string): GPUSampler`
  - Return sampler by name (linear, nearest, anisotropic)

- `getTotalMemory(): number`
  - Calculate total texture memory (width × height × 4)

**Samplers**:
- `linear`: magFilter/minFilter = linear, clamp-to-edge
- `nearest`: magFilter/minFilter = nearest, clamp-to-edge
- `anisotropic`: linear with maxAnisotropy = 16

#### File: `rendering/compositor/WebGPUCompositorThread.ts` (~900 lines)

**Purpose**: Main compositor using WebGPU (replaces WebGL version).

**Class**: `WebGPUCompositorThread`

**Key Methods**:
- `async initialize(canvas: HTMLCanvasElement): Promise<void>`
  - Request adapter/device
  - Initialize canvas context
  - Create texture manager
  - Load shader module
  - Create compositing pipeline
  - Create uniform buffer
  - Create quad vertex buffer

- `compositeFrame(timing: FrameTiming): Promise<void>`
  - Update layers from paint layers
  - Upload pending textures
  - Get current swap chain texture
  - Create command encoder
  - Begin render pass
  - For each layer:
    - Update uniform buffer (transform + opacity)
    - Create bind group (uniforms, sampler, texture)
    - Set bind group and draw
  - End render pass
  - Submit command buffer

- `start(): void`
  - Start VSync loop with callback to compositeFrame()

- `stop(): void`
  - Stop VSync loop

- `resize(width: number, height: number): void`
  - Resize canvas context

- `dispose(): void`
  - Destroy all resources (buffers, pipelines, textures)

**Frame Flow**:
1. VSync callback triggers compositeFrame()
2. Update layers (check dirty flags)
3. Upload textures (async via TextureManager)
4. Begin render pass with clear
5. For each layer (in z-order):
   - Calculate transform matrix (pixel → NDC)
   - Write uniform buffer (transform + opacity)
   - Create bind group for this layer
   - Set pipeline and bind group
   - Draw quad (4 vertices, triangle strip)
6. End render pass
7. Submit command buffer
8. Present frame (automatic)

#### File: `rendering/compositor/WebGPUCompositorLayer.ts` (~700 lines)

**Purpose**: Layer wrapper for WebGPU texture management.

**Class**: `WebGPUCompositorLayer`

**Key Methods**:
- `async uploadTexture(): Promise<void>`
  - If tiled: uploadTiles()
  - Else: uploadSingleTexture()

- `uploadSingleTexture(): Promise<void>`
  - Rasterize display list to canvas
  - Create ImageBitmap from canvas
  - Upload via TextureManager.createTextureFromBitmap()

- `uploadTiles(): Promise<void>`
  - For each tile:
    - Rasterize tile region
    - Create ImageBitmap
    - Upload via TextureManager

- `getTextureView(): GPUTextureView`
  - Get texture from TextureManager
  - Create and return view

- `dispose(): void`
  - Delete textures via TextureManager

#### File: `pipelines/CompositingPipeline.ts` (~500 lines)

**Purpose**: Render pipeline for layer compositing.

**Class**: `CompositingPipeline`

**Key Methods**:
- `constructor(descriptor: CompositingPipelineDescriptor)`
  - Create bind group layout (uniforms, sampler, texture)
  - Create pipeline layout
  - Create render pipeline with vertex/fragment shaders
  - Set blend state based on compositing mode

- `getPipeline(): GPURenderPipeline`

- `getBindGroupLayout(): GPUBindGroupLayout`

**Bind Group Layout**:
- Binding 0: Uniform buffer (transform + opacity)
- Binding 1: Sampler
- Binding 2: Texture

**Vertex Format**:
- Attribute 0: position (float32x2, offset 0)
- Attribute 1: texcoord (float32x2, offset 8)
- Stride: 16 bytes

#### File: `rendering/compositor/CompositorFactory.ts` (modify existing)

**Purpose**: Auto-select WebGPU or WebGL backend.

**Class**: `CompositorFactory`

**Key Methods**:
- `static async isWebGPUAvailable(): Promise<boolean>`
  - Check navigator.gpu
  - Try requestAdapter()

- `static async create(canvas, config?): Promise<CompositorThread | WebGPUCompositorThread>`
  - If backend === WEBGPU or AUTO (and available):
    - Create WebGPUCompositorThread
  - Else:
    - Create CompositorThread (WebGL)
  - Handle fallback on error

**Config**:
```typescript
enum CompositorBackend {
    WEBGPU = 'webgpu',
    WEBGL = 'webgl',
    AUTO = 'auto'
}

interface CompositorFactoryConfig extends CompositorConfig {
    backend: CompositorBackend;
    fallbackToWebGL: boolean;
}
```

---

### 6. Compute Pipeline Layer

#### File: `operations/compute/ComputePipeline.ts` (~500 lines)

**Purpose**: Manage compute shader compilation and dispatch.

**Class**: `ComputePipelineManager`

**Key Methods**:
- `compileShader(source: string, entryPoint?: string): ComputePipelineID`
  - Create shader module with WGSL source
  - Check compilation errors
  - Store in cache
  - Return pipeline ID

- `createPipeline(shaderId, bindGroupLayouts): ComputePipelineID`
  - Create compute pipeline with shader and layout
  - Cache by ID

- `dispatch(pipelineId, workgroupCount, bindGroups): GPUCommandEncoder`
  - Create command encoder
  - Begin compute pass
  - Set pipeline and bind groups
  - Dispatch workgroups
  - End compute pass
  - Return encoder (for submission)

- `calculateWorkgroups(dataSize: number, maxWorkgroupSize?: number): WorkgroupConfig`
  - Calculate optimal workgroup count
  - Default workgroup size: 64 (or 256 for 2D)
  - Return { x, y, z }

**Workgroup Calculation**:
```typescript
// 1D: For 10,000 elements with workgroup size 64
// x = ceil(10000 / 64) = 157, y = 1, z = 1

// 2D: For 1920×1080 image with 16×16 tiles
// x = ceil(1920 / 16) = 120, y = ceil(1080 / 16) = 68, z = 1
```

---

### 7. Worker Support Layer

#### File: `worker/WorkerNavigator.ts` (~300 lines)

**Purpose**: WebGPU access in worker context.

**Class**: `WorkerGPUNavigator`

**Key Methods**:
- `async initialize(): Promise<void>`
  - Request adapter/device in worker context
  - Set up error handlers

- `createOffscreenCanvas(width, height): OffscreenCanvas`
  - Create offscreen canvas for rendering

- `getDevice(): GPUDevice`

- `submitCompute(dispatch: ComputeDispatch): Promise<void>`
  - Execute compute shader in worker
  - Return results to main thread

#### File: `worker/MessageProtocol.ts` (~400 lines)

**Purpose**: Type-safe worker communication.

**Message Types**:
```typescript
enum GPUWorkerMessageType {
    INIT,
    COMPILE_SHADER,
    DISPATCH_COMPUTE,
    UPLOAD_DATA,
    DOWNLOAD_DATA,
    DESTROY
}

interface GPUWorkerMessage {
    type: GPUWorkerMessageType;
    id: string;
    payload: unknown;
}
```

**Class**: `GPUWorkerManager`

**Key Methods**:
- `spawnWorker(workerURL: string): string`
  - Create new Worker
  - Return worker ID

- `sendMessage(workerId, message): Promise<WorkerResponse>`
  - Send message to worker
  - Return promise for response
  - Handle transfers (ArrayBuffers)

- `terminateWorker(workerId: string): void`
  - Terminate and cleanup worker

**Message Flow**:
```
Main Thread              Worker Thread
    |                        |
    |--- INIT -------------->| Initialize GPU
    |<-- SUCCESS ------------|
    |                        |
    |--- COMPILE_SHADER ---->| Compile shader
    |<-- pipelineId ---------|
    |                        |
    |--- DISPATCH_COMPUTE -->| Execute compute
    | (transfer buffers)     |
    |<-- result buffer ------| (transfer back)
```

---

### 8. GPU Detection Layer

#### File: `utils/DetectGPUType.ts` (~300 lines)

**Purpose**: Detect GPU vendor and performance tier.

**Class**: `GPUVendorDetector`

**Key Methods**:
- `static detectVendor(adapter: GPUAdapter): GPUVendor`
  - Check adapter.info.vendor and .device strings
  - Return NVIDIA, AMD, INTEL, APPLE, QUALCOMM, ARM, or UNKNOWN

- `static detectPerformanceTier(adapter: GPUAdapter): GPUPerformanceTier`
  - Check adapter.limits (maxBufferSize, maxStorageBufferBindingSize)
  - HIGH: >2GB buffers (discrete GPU)
  - MEDIUM: >500MB buffers (integrated GPU)
  - LOW: <500MB (mobile/old GPU)

- `static checkFeatures(adapter: GPUAdapter): Set<string>`
  - Return set of supported features
  - Check for: timestamp-query, texture-compression-bc, etc.

**Vendor Detection Logic**:
```typescript
const vendor = adapter.info.vendor.toLowerCase();
const device = adapter.info.device?.toLowerCase() || "";

if (vendor.includes("nvidia") || device.includes("geforce") || device.includes("rtx"))
    return GPUVendor.NVIDIA;
if (vendor.includes("amd") || device.includes("radeon"))
    return GPUVendor.AMD;
if (vendor.includes("intel"))
    return GPUVendor.INTEL;
if (vendor.includes("apple"))
    return GPUVendor.APPLE;
// ... etc
```

#### File: `utils/DetectSystem.ts` (~200 lines)

**Purpose**: System capability detection.

**Class**: `SystemDetector`

**Key Methods**:
- `static detectOS(): string`
  - Return Deno.build.os (windows, darwin, linux)

- `static async checkWebGPUSupport(): Promise<boolean>`
  - Check navigator.gpu
  - Try requestAdapter()

- `static getSystemMemory(): { total: number; available: number }`
  - Use Deno.systemMemoryInfo()

#### File: `Acceleration.ts` (~400 lines)

**Purpose**: Hardware acceleration management and optimization hints.

**Class**: `HardwareAccelerationManager`

**Key Methods**:
- `async initialize(): Promise<GPUCapabilities>`
  - Request adapter
  - Detect vendor, performance tier
  - Get limits and features
  - Return capabilities object

- `getOptimizationHints(): OptimizationHints`
  - Return vendor-specific optimization hints
  - Workgroup size (NVIDIA: 256, AMD: 256, Apple: 128, Intel: 64)
  - Tile size (16×16 or 8×8)
  - Use shared memory (yes/no based on tier)
  - Async compute (yes/no based on tier)

**Capabilities**:
```typescript
interface GPUCapabilities {
    vendor: GPUVendor;
    performanceTier: GPUPerformanceTier;
    maxTextureSize: number;
    maxBufferSize: number;
    maxComputeWorkgroupsPerDimension: number;
    maxComputeInvocationsPerWorkgroup: number;
    maxStorageBufferBindingSize: number;
    supportsTimestampQuery: boolean;
    supportsComputeShaders: boolean;
    supportsRayTracing: boolean;
    limits: GPULimitsInfo;
}
```

---

### 9. Command Execution Layer

#### File: `operations/execute/mod.ts` (~250 lines)

**Purpose**: Command encoder and queue management.

**Class**: `CommandEncoderManager`

**Key Methods**:
- `createEncoder(label?: string): GPUCommandEncoder`
  - Return device.createCommandEncoder()

- `submit(commandBuffer: GPUCommandBuffer): void`
  - Submit to device.queue

- `submitBatch(commandBuffers: GPUCommandBuffer[]): void`
  - Submit multiple command buffers

- `writeBuffer(buffer, data, offset?): void`
  - Use device.queue.writeBuffer()

- `copyBufferToBuffer(source, sourceOffset, dest, destOffset, size): void`
  - Create encoder, encode copy, submit

#### File: `operations/draw/mod.ts` (~200 lines)

**Purpose**: Draw command utilities.

**Class**: `DrawCommandManager`

**Key Methods**:
- `draw(vertexCount, instanceCount?, firstVertex?, firstInstance?)`
- `drawIndexed(indexCount, instanceCount?, firstIndex?, baseVertex?, firstInstance?)`
- `drawIndirect(indirectBuffer, indirectOffset?)`
- `drawIndexedIndirect(indirectBuffer, indirectOffset?)`

---

### 10. Main Engine Layer

#### File: `WebGPU.ts` (~600 lines)

**Purpose**: Unified WebGPU engine integrating all subsystems.

**Class**: `WebGPUEngine`

**Properties**:
```typescript
private driver: WebGPUDriver;
private bufferPool: WebGPUBufferPool;
private computeManager: ComputePipelineManager;
private workerManager: GPUWorkerManager;
private hardwareAcceleration: HardwareAccelerationManager;
```

**Key Methods**:
- `async initialize(): Promise<void>`
  - Initialize driver
  - Detect GPU capabilities
  - Request device
  - Initialize subsystems (buffer pool, compute manager, worker manager)

- `async executeCompute(shaderSource, inputData, outputSize, workgroupCount?): Promise<ArrayBuffer>`
  - High-level compute API
  - Compile shader
  - Create input buffers
  - Create output buffer
  - Dispatch compute
  - Read back results
  - Return output ArrayBuffer

- `spawnWorker(): string`
  - Delegate to workerManager.spawnWorker()

- `getStats(): WebGPUStats`
  - Aggregate statistics from all subsystems

#### File: `Navigator.ts` (~200 lines)

**Purpose**: navigator.gpu wrapper with helpers.

**Functions**:
- `async checkWebGPUSupport(): Promise<boolean>`
- `async requestAdapter(options?): Promise<GPUAdapter | null>`
- `async enumerateAdapters(): Promise<GPUAdapter[]>`

#### File: `driver/mod.ts` (~400 lines)

**Purpose**: Low-level WebGPU driver with error recovery.

**Class**: `WebGPUDriver`

**Key Methods**:
- `async initialize(options?): Promise<void>`
  - Request adapter
  - Store adapter reference

- `async requestDevice(descriptor?): Promise<GPUDevice>`
  - Request device from adapter
  - Set up device lost handler
  - Set up error handlers
  - Return device

- `onDeviceLost(info: GPUDeviceLostInfo): void`
  - Log device lost reason
  - Update state to LOST

- `async recover(): Promise<boolean>`
  - Attempt to re-initialize
  - Return true if successful

- `async getDevice(): Promise<GPUDevice>`
  - Return device if available
  - Attempt recovery if lost
  - Throw error if unavailable

- `destroy(): void`
  - Destroy device
  - Update state

---

### 11. Memory Management Layer (Advanced)

#### File: `memory/mod.ts` (~800 lines total)

**Contains**:

**`WebGPUBufferPool`** (~400 lines):
- Same as buffer/Staging.ts but more advanced
- Standard sizes: [256, 1024, 4096, 16384, 65536, 262144, 1048576]
- acquire(size, usage) → PooledGPUBuffer
- release(buffer)
- purgeUnused(maxAge)
- getStats()

**`StagingBufferRing`** (~200 lines):
- Ring buffer for continuous uploads
- Triple buffering (3 staging buffers)
- getNextBuffer() → Promise<GPUBuffer>
- upload(data, targetBuffer)
- waitForIdle()

**`GPUMemoryAllocator`** (~200 lines):
- Advanced: large memory blocks with sub-allocation
- Optional defragmentation
- allocate(size, alignment) → GPUBufferAllocation
- free(allocation)
- defragment() → Promise<DefragmentationResult>
- getMemoryPressure() → MemoryPressureInfo

---

## Integration Strategy

### Browser Integration

**File**: `/browser/src/main.ts` (modify existing)

Add WebGPU engine:
```typescript
export class Browser {
    private webgpuEngine: WebGPUEngine | null = null;  // ADD

    constructor(config: BrowserConfig = {}) {
        // ... existing code ...

        // Initialize WebGPU if enabled
        if (config.enableWebGPU !== false) {
            this.webgpuEngine = new WebGPUEngine();
            this.webgpuEngine.initialize().catch(err => {
                console.warn("WebGPU initialization failed:", err);
                this.webgpuEngine = null;
            });
        }
    }

    getWebGPUEngine(): WebGPUEngine | null {  // ADD
        return this.webgpuEngine;
    }
}

export interface BrowserConfig {  // MODIFY
    // ... existing fields ...
    enableWebGPU?: boolean;  // ADD (default: true)
}
```

### RenderingPipeline Integration

**File**: `/browser/src/engine/RenderingPipeline.ts` (modify existing)

Use CompositorFactory:
```typescript
// BEFORE:
const compositor = new CompositorThread(config);

// AFTER:
const compositor = await CompositorFactory.create(canvas, {
    backend: config.compositorBackend || CompositorBackend.AUTO,
    fallbackToWebGL: true,
    ...config
});
```

### Module Exports

**File**: `/browser/src/engine/webgpu/mod.ts`

```typescript
// Main engine
export { WebGPUEngine } from "./WebGPU.ts";

// Adapter layer
export * from "./adapter/mod.ts";

// Buffer management
export * from "./buffer/mod.ts";

// Pipeline management
export * from "./pipelines/mod.ts";

// Command encoding
export * from "./encoder/mod.ts";

// Memory management
export * from "./memory/mod.ts";

// Operations
export * from "./operations/mod.ts";

// Utilities
export * from "./utils/mod.ts";

// Worker support
export * from "./worker/mod.ts";

// Canvas context
export { WebGPUCanvasContext } from "./CanvasContext.ts";

// Navigator wrapper
export * from "./Navigator.ts";

// Hardware acceleration
export { HardwareAccelerationManager } from "./Acceleration.ts";

// Driver abstraction
export * from "./driver/mod.ts";

// Types
export type * from "../../types/webgpu.ts";

// Errors
export * from "./errors.ts";
```

---

## Testing Approach

### Unit Tests

**Location**: `/browser/tests/engine/webgpu/`

**Coverage Target**: 95%+

**Test Files**:
1. `adapter/Device.test.ts` - Device lifecycle, state machine, error handling
2. `buffer/Create.test.ts` - Buffer creation, mapping, validation
3. `buffer/Staging.test.ts` - Pool acquire/release, reuse
4. `pipelines/Pipeline.test.ts` - Shader compilation, pipeline creation
5. `memory/BufferPool.test.ts` - Pool operations, statistics
6. `compute/ComputePipeline.test.ts` - Compute shader execution
7. `worker/Worker.test.ts` - Worker communication, message protocol
8. `utils/Detection.test.ts` - GPU vendor/system detection

**Example Test**:
```typescript
import { assertEquals, assertExists } from "@std/assert";
import { WebGPUDevice } from "../../../src/engine/webgpu/adapter/Device.ts";

Deno.test("WebGPUDevice - initialize and get descriptor", async () => {
    const device = new WebGPUDevice();
    assertEquals(device.getState(), GPUDeviceState.UNINITIALIZED);

    await device.initialize();
    assertEquals(device.getState(), GPUDeviceState.READY);

    const descriptor = device.getDescriptor();
    assertExists(descriptor.adapter);
    assertExists(descriptor.limits);

    device.destroy();
    assertEquals(device.getState(), GPUDeviceState.DESTROYED);
});
```

### Integration Tests

**Location**: `/browser/tests/integration/webgpu/`

**Test Files**:
1. `compositor/WebGPUCompositor.test.ts` - End-to-end rendering
2. `pipeline/RenderPipeline.test.ts` - Full render pipeline execution
3. `compute/ComputeExecution.test.ts` - Compute shader with readback
4. `worker/WorkerCompute.test.ts` - Worker-based compute

**Example Test**:
```typescript
Deno.test("WebGPU Compositor - render single layer", async () => {
    const canvas = createTestCanvas(800, 600);
    const compositor = new WebGPUCompositorThread();
    await compositor.initialize(canvas);

    const layerTree = createTestLayerTree();
    compositor.updateLayerTree(layerTree);
    compositor.composite();

    const pixels = await compositor.getPixels();
    assertEquals(pixels.length, 800 * 600 * 4);

    compositor.dispose();
});
```

### Visual Regression Tests

**Location**: `/browser/tests/visual/webgpu/`

**Purpose**: Compare WebGPU vs WebGL output pixel-by-pixel.

**Test Files**:
1. `compositor/VisualRegression.test.ts`
2. `blending/BlendModes.test.ts`
3. `transforms/LayerTransforms.test.ts`

**Example Test**:
```typescript
Deno.test("Visual regression - WebGPU vs WebGL", async () => {
    const layerTree = createComplexLayerTree();

    // Render with WebGL
    const webglPixels = await renderWithWebGL(layerTree);

    // Render with WebGPU
    const webgpuPixels = await renderWithWebGPU(layerTree);

    // Compare (allow <1% difference for GPU precision)
    const diff = comparePixels(webglPixels, webgpuPixels);
    assert(diff < 0.01, `Pixel difference: ${diff * 100}%`);
});
```

### Performance Benchmarks

**Location**: `/browser/benchmarks/webgpu/`

**Benchmark Files**:
1. `compositor/FrameTime.bench.ts` - WebGL vs WebGPU frame time
2. `buffer/BufferPool.bench.ts` - Buffer allocation performance
3. `compute/ComputeShader.bench.ts` - Compute shader throughput

**Example Benchmark**:
```typescript
Deno.bench("Compositor - WebGPU vs WebGL", async (b) => {
    const layerTree = createRealisticLayerTree(50);  // 50 layers

    // WebGPU
    const webgpuCompositor = await setupWebGPUCompositor();
    b.start();
    for (let i = 0; i < 100; i++) {
        webgpuCompositor.composite();
    }
    b.end();

    // WebGL
    const webglCompositor = setupWebGLCompositor();
    b.start();
    for (let i = 0; i < 100; i++) {
        webglCompositor.composite();
    }
    b.end();
});
```

---

## Performance Targets

### CPU Performance

**Target**: 2-3x reduction in CPU time vs WebGL

**Metrics**:
- WebGL: ~2-3ms CPU per frame (validation, state tracking)
- WebGPU: ~0.5-1ms CPU per frame (explicit validation at pipeline creation)

**Measurement**: Performance.now() around compositeFrame()

### GPU Memory

**Target**: 20-30% reduction in GPU memory usage

**Metrics**:
- Texture memory: width × height × 4 bytes
- Buffer memory: total buffer sizes
- Peak memory usage

**Measurement**: Track all texture/buffer allocations

### Frame Time

**Target**: Consistent 16.67ms (60fps) with no frame drops

**Metrics**:
- Frame time distribution
- 99th percentile frame time
- Dropped frame count

**Measurement**: VSync timing, frame history

### Compute Throughput

**Target**: 10x faster than CPU for parallel tasks

**Metrics**:
- Compute shader execution time
- Data transfer time (CPU→GPU→CPU)
- Total operation time

**Measurement**: Timestamp queries (if supported)

---

## Critical Path

### Critical Files (Must Implement First)

**Priority 1** (blocking everything):
1. `/browser/src/types/webgpu.ts` - Complete type system
2. `/browser/src/engine/webgpu/errors.ts` - Error classes
3. `/browser/src/engine/webgpu/adapter/Device.ts` - Device management

**Priority 2** (blocking rendering):
4. `/browser/src/engine/webgpu/buffer/Create.ts` - Buffer creation
5. `/browser/src/engine/webgpu/buffer/Staging.ts` - Staging pool
6. `/browser/src/engine/webgpu/pipelines/mod.ts` - Pipeline management

**Priority 3** (rendering integration):
7. `/browser/src/engine/webgpu/CanvasContext.ts` - Canvas context
8. `/browser/src/engine/webgpu/operations/render/shaders/compositor.wgsl` - WGSL shaders
9. `/browser/src/engine/webgpu/operations/render/TextureManager.ts` - Texture management
10. `/browser/src/engine/rendering/compositor/WebGPUCompositorThread.ts` - Main compositor

**Priority 4** (advanced features):
11. `/browser/src/engine/webgpu/operations/compute/ComputePipeline.ts` - Compute support
12. `/browser/src/engine/webgpu/worker/WorkerNavigator.ts` - Worker support
13. `/browser/src/engine/webgpu/Acceleration.ts` - Hardware detection

**Priority 5** (integration):
14. `/browser/src/engine/webgpu/WebGPU.ts` - Main engine
15. `/browser/src/main.ts` - Browser integration

### Dependencies

```
types/webgpu.ts (no deps)
    ↓
errors.ts (depends on: types)
    ↓
adapter/Device.ts (depends on: types, errors)
    ↓
buffer/Create.ts (depends on: types, errors, adapter)
    ↓
buffer/Staging.ts (depends on: buffer/Create)
    ↓
pipelines/mod.ts (depends on: adapter, errors)
    ↓
CanvasContext.ts (depends on: adapter)
    ↓
operations/render/TextureManager.ts (depends on: adapter)
    ↓
operations/render/shaders/compositor.wgsl (no deps)
    ↓
WebGPUCompositorThread.ts (depends on: CanvasContext, TextureManager, pipelines)
    ↓
WebGPU.ts (depends on: all subsystems)
    ↓
main.ts (depends on: WebGPU)
```

### Implementation Sequence

**Week 1**: Types, errors, adapter, driver
**Week 2**: Buffer management, memory
**Week 3**: Pipelines, shaders, encoder
**Week 4**: Rendering integration (compositor)
**Week 5**: Compute, worker, acceleration
**Week 6**: Main engine, integration
**Week 7**: Testing, benchmarks, documentation

---

## Success Metrics

### Functionality Checklist
- [ ] All 31 files fully implemented
- [ ] Zero TODO/placeholder comments
- [ ] All functions have complete implementations
- [ ] Error handling for all edge cases
- [ ] State machines implemented correctly
- [ ] Statistics tracking functional

### Quality Checklist
- [ ] Matches existing browser module patterns
- [ ] Resource pooling implemented (BufferPool, StagingBufferRing)
- [ ] State machines with validation
- [ ] Comprehensive error handling
- [ ] Statistics tracking
- [ ] Factory patterns
- [ ] Dispose/destroy methods

### Integration Checklist
- [ ] WebGPU compositor replaces WebGL
- [ ] Automatic backend selection (CompositorFactory)
- [ ] Graceful fallback to WebGL
- [ ] Browser.getWebGPUEngine() functional
- [ ] Config flag: enableWebGPU

### Testing Checklist
- [ ] 95%+ unit test coverage
- [ ] Integration tests pass
- [ ] Visual regression tests pass (<1% difference)
- [ ] Performance benchmarks meet targets
- [ ] Cross-browser testing (Chrome, Edge, Firefox)

### Performance Checklist
- [ ] 2-3x CPU reduction vs WebGL
- [ ] 20-30% GPU memory reduction
- [ ] 60fps with no drops
- [ ] Compute 10x faster than CPU

### Documentation Checklist
- [ ] JSDoc for all public APIs
- [ ] README.md with usage examples
- [ ] Architecture diagrams
- [ ] Migration guide (WebGL → WebGPU)

---

## References

### WebGPU Specifications
- [Official W3C WebGPU Spec](https://www.w3.org/TR/webgpu/)
- [WebGPU Explainer](https://gpuweb.github.io/gpuweb/explainer/)
- [WGSL Specification](https://www.w3.org/TR/WGSL/)

### Best Practices
- [WebGPU Buffer Uploads (Toji.dev)](https://toji.dev/webgpu-best-practices/buffer-uploads.html)
- [WebGPU Fundamentals](https://webgpufundamentals.org/)
- [MDN WebGPU API](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API)

### Browser Documentation
- `/browser/docs/13.CompositorAndGPULayer.md` - Compositor architecture
- `/browser/docs/01.ArchitectureOverview.md` - Browser architecture
- `/ProxyEngine.md` - Resource pooling patterns

---

## Approval Required

This plan is ready for review and approval. Key decisions needed:

1. **Implementation Timeline**: 7-week plan acceptable?
2. **Phased Rollout**: Gradual migration (WebGPU + WebGL coexist) or complete replacement?
3. **Testing Requirements**: Are visual regression tests mandatory before merging?
4. **Performance Targets**: Are 2-3x CPU and 20-30% memory targets acceptable?
5. **Browser Support**: Minimum browser versions (Chrome 113+, Safari 18+)?

**Next Steps After Approval**:
1. Create todo list with all tasks
2. Begin Phase 1 implementation (types, adapter, driver)
3. Set up testing infrastructure
4. Implement in dependency order

---

**Plan Version**: 1.0
**Date**: 2026-01-12
**Status**: Awaiting Approval
