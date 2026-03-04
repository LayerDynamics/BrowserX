/**
 * DevTools Protocol Types
 *
 * CDP-inspired JSON-RPC protocol for BrowserX DevTools communication.
 * Defines message formats, error codes, and type guards for all protocol messages.
 */

/**
 * Unique identifier for a protocol message
 */
export type MessageID = number;

/**
 * Session identifier for multi-target debugging
 */
export type SessionID = string;

/**
 * Target identifier (a browser instance or page)
 */
export type TargetID = string;

/**
 * Domain name identifiers
 */
export type DomainName =
    | "DOM"
    | "CSS"
    | "Network"
    | "Runtime"
    | "Debugger"
    | "Performance"
    | "Memory"
    | "Storage"
    | "Security"
    | "Page"
    | "Rendering"
    | "Console"
    | "Overlay"
    | "Emulation"
    | "Serial";

/**
 * Fully-qualified method name: "Domain.method"
 */
export type ProtocolMethod = `${DomainName}.${string}`;

/**
 * Protocol request message (client -> server)
 */
export interface ProtocolRequest {
    id: MessageID;
    method: ProtocolMethod;
    params?: Record<string, unknown>;
    sessionId?: SessionID;
}

/**
 * Protocol response message (server -> client)
 */
export interface ProtocolResponse {
    id: MessageID;
    result?: Record<string, unknown>;
    error?: ProtocolError;
    sessionId?: SessionID;
}

/**
 * Protocol event message (server -> client, no id)
 */
export interface ProtocolEvent {
    method: ProtocolMethod;
    params?: Record<string, unknown>;
    sessionId?: SessionID;
}

/**
 * Protocol error
 */
export interface ProtocolError {
    code: number;
    message: string;
    data?: unknown;
}

/**
 * Standard error codes (aligned with JSON-RPC and CDP)
 */
export enum ProtocolErrorCode {
    PARSE_ERROR = -32700,
    INVALID_REQUEST = -32600,
    METHOD_NOT_FOUND = -32601,
    INVALID_PARAMS = -32602,
    INTERNAL_ERROR = -32603,
    SERVER_ERROR = -32000,
    DOMAIN_NOT_ENABLED = -32001,
    NODE_NOT_FOUND = -32002,
    STYLESHEET_NOT_FOUND = -32003,
    BREAKPOINT_NOT_FOUND = -32004,
    OBJECT_NOT_FOUND = -32005,
    SESSION_NOT_FOUND = -32006,
    TARGET_NOT_FOUND = -32007,
}

/**
 * Union type for all protocol messages
 */
export type ProtocolMessage = ProtocolRequest | ProtocolResponse | ProtocolEvent;

/**
 * Type guard for request messages
 */
export function isRequest(msg: ProtocolMessage): msg is ProtocolRequest {
    return "id" in msg && "method" in msg && typeof (msg as ProtocolRequest).id === "number" && typeof (msg as ProtocolRequest).method === "string";
}

/**
 * Type guard for response messages
 */
export function isResponse(msg: ProtocolMessage): msg is ProtocolResponse {
    return "id" in msg && typeof (msg as ProtocolResponse).id === "number" && !("method" in msg) && ("result" in msg || "error" in msg);
}

/**
 * Type guard for event messages
 */
export function isEvent(msg: ProtocolMessage): msg is ProtocolEvent {
    return !("id" in msg) && "method" in msg;
}

/**
 * Domain method handler signature
 * Uses generic return to allow typed result interfaces
 */
// deno-lint-ignore no-explicit-any
export type MethodHandler = (params: Record<string, unknown>) => Promise<any>;

/**
 * Domain method definition
 */
export interface MethodDefinition {
    name: string;
    description: string;
    handler: MethodHandler;
}

/**
 * Domain event definition
 */
export interface EventDefinition {
    name: string;
    description: string;
}
