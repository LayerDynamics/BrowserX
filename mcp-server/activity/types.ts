/**
 * Activity Indicator Types
 * Types for MCP server activity logging and status display
 */

/**
 * Activity event types
 */
export type ActivityEventType =
  | "tool_start"
  | "tool_progress"
  | "tool_complete"
  | "tool_error"
  | "session_created"
  | "session_closed"
  | "query_start"
  | "query_complete"
  | "server_ready"
  | "server_shutdown";

/**
 * Activity event
 */
export interface ActivityEvent {
  type: ActivityEventType;
  timestamp: number;
  toolName?: string;
  sessionId?: string;
  queryId?: string;
  message?: string;
  duration?: number;
  error?: string;
  progress?: number;
}

/**
 * Status bar data
 */
export interface StatusBarData {
  uptime: string;
  activeSessions: number;
  maxSessions: number;
  activeOperations: number;
  requestsPerSecond: number;
  currentTool?: string;
  health: "healthy" | "degraded" | "unhealthy";
}

/**
 * Activity logger configuration
 */
export interface ActivityLoggerConfig {
  /** Enable spinner animation (default: true if TTY) */
  enableSpinner?: boolean;
  /** Enable tool call logging (default: true) */
  enableToolLogs?: boolean;
  /** Enable status bar (default: true if TTY) */
  enableStatusBar?: boolean;
  /** Status bar update interval in ms (default: 1000) */
  statusBarInterval?: number;
  /** Use colors in output (default: true if TTY) */
  useColors?: boolean;
  /** Output stream (default: Deno.stderr) */
  output?: { writeSync(p: Uint8Array): number };
  /** Minimum log level */
  minLogLevel?: "debug" | "info" | "warn" | "error";
}

/**
 * Spinner frames for animation
 */
export const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

/**
 * Status icons
 */
export const STATUS_ICONS = {
  healthy: "●",
  degraded: "◐",
  unhealthy: "○",
  running: "▶",
  complete: "✓",
  error: "✗",
  session: "◉",
  query: "⚡",
};

/**
 * ANSI color codes
 */
export const COLORS = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",

  // Foreground colors
  black: "\x1b[30m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  gray: "\x1b[90m",

  // Background colors
  bgBlack: "\x1b[40m",
  bgRed: "\x1b[41m",
  bgGreen: "\x1b[42m",
  bgYellow: "\x1b[43m",
  bgBlue: "\x1b[44m",
  bgMagenta: "\x1b[45m",
  bgCyan: "\x1b[46m",
  bgWhite: "\x1b[47m",
};

/**
 * Terminal control sequences
 */
export const TERMINAL = {
  clearLine: "\x1b[2K",
  cursorUp: "\x1b[1A",
  cursorDown: "\x1b[1B",
  cursorLeft: "\x1b[1D",
  cursorStart: "\r",
  hideCursor: "\x1b[?25l",
  showCursor: "\x1b[?25h",
  saveCursor: "\x1b[s",
  restoreCursor: "\x1b[u",
};
