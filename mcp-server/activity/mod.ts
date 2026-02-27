/**
 * Activity Module
 * Exports activity logging functionality for MCP server
 */

export {
  type ActivityEvent,
  type ActivityEventType,
  type ActivityLoggerConfig,
  type StatusBarData,
  COLORS,
  SPINNER_FRAMES,
  STATUS_ICONS,
  TERMINAL,
} from "./types.ts";

export { Spinner, createSpinner } from "./spinner.ts";

export {
  ActivityLogger,
  createActivityLogger,
  setGlobalActivityLogger,
  getGlobalActivityLogger,
  logToolStart,
  logToolComplete,
  logToolError,
  logToolProgress,
} from "./activity-logger.ts";

// Activity Tracker - persistent file-based activity logging
export {
  ActivityTracker,
  getActivityTracker,
  initActivityTracker,
  resetActivityTracker,
  type ActivityEntry,
  type ScreenshotEntry,
  type ActivityTrackerOptions,
} from "./ActivityTracker.ts";
