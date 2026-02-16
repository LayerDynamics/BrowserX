/**
 * Runtime Domain Types
 *
 * Types for JavaScript evaluation, console API, and object inspection.
 */

/**
 * Remote object identifier
 */
export type RemoteObjectID = string;

/**
 * Execution context identifier
 */
export type ExecutionContextID = number;

/**
 * Remote object representation
 */
export interface RemoteObject {
    type: "object" | "function" | "undefined" | "string" | "number" | "boolean" | "symbol" | "bigint";
    subtype?: "array" | "null" | "regexp" | "date" | "map" | "set" | "error" | "promise" | "proxy" | "node";
    className?: string;
    value?: unknown;
    unserializableValue?: string;
    description?: string;
    objectId?: RemoteObjectID;
    preview?: ObjectPreview;
}

/**
 * Object preview
 */
export interface ObjectPreview {
    type: string;
    description: string;
    overflow: boolean;
    properties: Array<{ name: string; type: string; value: string }>;
}

/**
 * Exception details
 */
export interface ExceptionDetails {
    exceptionId: number;
    text: string;
    lineNumber: number;
    columnNumber: number;
    scriptId?: string;
    url?: string;
    stackTrace?: StackTrace;
    exception?: RemoteObject;
}

/**
 * Stack trace
 */
export interface StackTrace {
    description?: string;
    callFrames: CallFrame[];
    parent?: StackTrace;
}

/**
 * Call frame
 */
export interface CallFrame {
    functionName: string;
    scriptId: string;
    url: string;
    lineNumber: number;
    columnNumber: number;
}

/**
 * Execution context description
 */
export interface ExecutionContextDescription {
    id: ExecutionContextID;
    origin: string;
    name: string;
    uniqueId: string;
}

/**
 * Console API call type
 */
export type ConsoleAPIType =
    | "log"
    | "debug"
    | "info"
    | "error"
    | "warning"
    | "dir"
    | "table"
    | "trace"
    | "clear"
    | "assert"
    | "count"
    | "timeEnd";

export interface EvaluateParams {
    expression: string;
    objectGroup?: string;
    includeCommandLineAPI?: boolean;
    silent?: boolean;
    contextId?: ExecutionContextID;
    returnByValue?: boolean;
    awaitPromise?: boolean;
    timeout?: number;
}

export interface EvaluateResult {
    result: RemoteObject;
    exceptionDetails?: ExceptionDetails;
}

export interface GetPropertiesParams {
    objectId: RemoteObjectID;
    ownProperties?: boolean;
    accessorPropertiesOnly?: boolean;
}

export interface GetPropertiesResult {
    result: Array<{
        name: string;
        value?: RemoteObject;
        writable?: boolean;
        get?: RemoteObject;
        set?: RemoteObject;
        configurable: boolean;
        enumerable: boolean;
        isOwn?: boolean;
    }>;
}

export interface ReleaseObjectParams {
    objectId: RemoteObjectID;
}

export interface ReleaseObjectGroupParams {
    objectGroup: string;
}

export interface GetHeapUsageResult {
    usedSize: number;
    totalSize: number;
}
