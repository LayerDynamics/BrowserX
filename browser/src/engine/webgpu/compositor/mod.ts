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
  BlendMode as CompositorBlendMode,
  type CompositorConfig,
  CompositorState,
  type CompositorStatistics,
  type DamageRect as CompositorDamageRect,
  type FrameTiming,
  type LayerDescriptor as CompositorLayerDescriptor,
  type Transform as CompositorTransform,
  WebGPUCompositorThread,
} from "./WebGPUCompositorThread.ts";

export {
  BlendMode as LayerBlendMode,
  CompositorLayerError,
  type DamageRect as LayerDamageRect,
  DEFAULT_TILE_SIZE,
  type LayerConfig,
  LayerState,
  type LayerStatistics,
  LayerType,
  type TileConfig,
  type TileData,
  type Transform as LayerTransform,
  WebGPUCompositorLayer,
} from "./WebGPUCompositorLayer.ts";
