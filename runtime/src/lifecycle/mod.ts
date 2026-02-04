/**
 * Lifecycle Module
 *
 * Exports lifecycle management components for the BrowserX Runtime.
 */

export { LifecycleManager } from "./LifecycleManager.ts";

export {
  InitializationSequence,
  type InitializationProgress,
  type StepExecutionResult,
} from "./InitializationSequence.ts";

export {
  ShutdownSequence,
  type ShutdownProgress,
  type ShutdownStepResult,
} from "./ShutdownSequence.ts";
