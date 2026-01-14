/**
 * Worker Module
 *
 * Exports all worker management functionality
 */

export * from "./worker_pool.ts";
export * from "./worker_manager.ts";
export type {
  WorkerID,
  WorkerMessage,
  WorkerMessageType,
  WorkerStats,
  WorkerConfig,
  IWorker,
  TaskMessage,
  ResultMessage,
  ErrorMessage,
} from "./interface.ts";
export {
  WorkerState,
  createWorkerMessage,
  isResultMessage,
  isErrorMessage,
} from "./interface.ts";
