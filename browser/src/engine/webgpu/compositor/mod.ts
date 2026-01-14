/**
 * WebGPU Compositor Module
 *
 * GPU-accelerated compositor for layer-based rendering:
 * - WebGPUCompositorThread: Main compositor orchestration
 * - WebGPUCompositorLayer: Individual layer management
 *
 * @module compositor
 */

export {
    WebGPUCompositorThread,
    type CompositorConfig,
    type FrameTiming,
    type CompositorStatistics,
    CompositorState,
    BlendMode as CompositorBlendMode,
    type LayerDescriptor as CompositorLayerDescriptor,
    type Transform as CompositorTransform,
    type DamageRect as CompositorDamageRect,
} from "./WebGPUCompositorThread.ts";

export {
    WebGPUCompositorLayer,
    LayerState,
    LayerType,
    BlendMode as LayerBlendMode,
    type Transform as LayerTransform,
    type DamageRect as LayerDamageRect,
    type LayerConfig,
    type LayerStatistics,
    CompositorLayerError,
} from "./WebGPUCompositorLayer.ts";
