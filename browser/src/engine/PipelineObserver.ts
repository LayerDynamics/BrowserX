/**
 * Pipeline Observer Interface
 *
 * Generic observer pattern for all BrowserX pipelines (Rendering, Request, Query, Proxy).
 * Emits stage events as pipeline stages transition through running → completed/error.
 */

/** Status of a pipeline stage */
export type StageStatus = "running" | "completed" | "error";

/** Which pipeline emitted this event */
export type PipelineKind = "rendering" | "request" | "query" | "proxy";

/**
 * Event emitted when a pipeline stage changes status.
 * Each stage emits two events: "running" (start) and "completed"/"error" (end).
 */
export interface PipelineStageEvent {
  /** Unique stage identifier within the pipeline, e.g. "html-fetch", "dns-resolution" */
  stageId: string;
  /** Human-readable stage name, e.g. "HTML Fetch", "DNS Resolution" */
  stageName: string;
  /** Which pipeline this event came from */
  pipeline: PipelineKind;
  /** Current status of the stage */
  status: StageStatus;
  /** Wall-clock time when this stage started (Date.now()) */
  startTime: number;
  /** Wall-clock time when this stage ended (only set for completed/error) */
  endTime?: number;
  /** Duration in milliseconds (only set for completed/error) */
  duration?: number;
  /** The artifact produced by this stage (DOM tree, CSSOM, LayoutBox, etc.) */
  artifact?: unknown;
  /** Error if stage failed */
  error?: Error;
}

/**
 * Observer interface for pipeline stage events.
 * Implement this to receive real-time notifications as pipeline stages execute.
 */
export interface PipelineObserver {
  onStage(event: PipelineStageEvent): void;
}
