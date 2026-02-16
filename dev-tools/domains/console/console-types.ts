/**
 * Console Domain Types
 *
 * Types for console log messages and error display.
 */

import type { StackTrace } from "../runtime/runtime-types.ts";

/**
 * Console message severity
 */
export type ConsoleMessageLevel = "verbose" | "info" | "warning" | "error";

/**
 * Console message source
 */
export type ConsoleMessageSource =
    | "javascript"
    | "network"
    | "security"
    | "storage"
    | "appcache"
    | "rendering"
    | "deprecation"
    | "other";

/**
 * Console message
 */
export interface ConsoleMessage {
    source: ConsoleMessageSource;
    level: ConsoleMessageLevel;
    text: string;
    url?: string;
    line?: number;
    column?: number;
    timestamp: number;
    stackTrace?: StackTrace;
}

export interface ClearMessagesParams {}

export interface MessageAddedParams {
    message: ConsoleMessage;
}
