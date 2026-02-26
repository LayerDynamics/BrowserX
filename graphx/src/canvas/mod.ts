// Types
export type {
  StageStatus,
  PipelineType,
  StageTiming,
  StageNode,
  StageEdge,
  ProcessTrace,
  CanvasTheme,
  GraphXCanvasOptions,
  GraphXCanvasEventMap,
  Transform,
  StageNodeRect,
} from "./types.ts";

// Themes
export { CANVAS_LIGHT_THEME, CANVAS_DARK_THEME, resolveTheme } from "./themes.ts";

// Core model
export { ProcessTraceModel } from "./ProcessTraceModel.ts";

// Rendering
export { CanvasRenderer } from "./CanvasRenderer.ts";
export { InteractionManager } from "./InteractionManager.ts";
export { AnimationController } from "./AnimationController.ts";
export { DetailPanel } from "./DetailPanel.ts";

// Web component
export { GraphXCanvas } from "./GraphXCanvas.ts";

// Pipeline adapters
export {
  RenderingPipelineAdapter,
  RequestPipelineAdapter,
  QueryExecutorAdapter,
  ProxyMiddlewareAdapter,
  LiveTraceBridge,
} from "./adapters/mod.ts";

export type {
  RenderingTraceInput,
  RequestTraceInput,
  QueryStepInput,
  QueryStepResult,
  QueryExecutionTraceInput,
  ProxyMiddlewareStepInput,
  ProxyUpstreamInput,
  ProxyResponseMiddlewareInput,
  ProxyTraceInput,
  LiveStageEvent,
  TraceUpdateCallback,
  LiveTraceBridgeOptions,
} from "./adapters/mod.ts";
