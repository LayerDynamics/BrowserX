/**
 * Debugger Domain Types
 *
 * Types for JavaScript debugging: breakpoints, call frames, stepping,
 * script management, and expression evaluation on paused call frames.
 */

/**
 * Unique breakpoint identifier
 */
export type BreakpointID = string;

/**
 * Unique script identifier
 */
export type ScriptID = string;

/**
 * Unique call frame identifier
 */
export type CallFrameID = string;

/**
 * Source location in a script
 */
export interface Location {
    scriptId: ScriptID;
    lineNumber: number;
    columnNumber?: number;
}

/**
 * Breakpoint location with optional type annotation
 */
export interface BreakLocation extends Location {
    type?: "debuggerStatement" | "call" | "return";
}

/**
 * Remote object reference for values in debugger scope
 */
export interface RemoteObjectReference {
    type: string;
    objectId?: string;
    value?: unknown;
    description?: string;
}

/**
 * Variable scope in a call frame
 */
export interface Scope {
    type:
        | "global"
        | "local"
        | "with"
        | "closure"
        | "catch"
        | "block"
        | "script"
        | "eval"
        | "module";
    object: RemoteObjectReference;
    name?: string;
    startLocation?: Location;
    endLocation?: Location;
}

/**
 * Call frame in the debugger
 */
export interface CallFrame {
    callFrameId: CallFrameID;
    functionName: string;
    location: Location;
    url: string;
    scopeChain: Scope[];
    this: RemoteObjectReference;
}

/**
 * Script description - metadata about a parsed script
 */
export interface ScriptDescription {
    scriptId: ScriptID;
    url: string;
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
    hash?: string;
    sourceMapURL?: string;
}

// ---- Method parameter and result types ----

/**
 * Parameters for setBreakpoint
 */
export interface SetBreakpointParams {
    location: Location;
    condition?: string;
}

/**
 * Result of setBreakpoint
 */
export interface SetBreakpointResult {
    breakpointId: BreakpointID;
    actualLocation: Location;
}

/**
 * Parameters for setBreakpointByUrl
 */
export interface SetBreakpointByUrlParams {
    url: string;
    lineNumber: number;
    columnNumber?: number;
    condition?: string;
}

/**
 * Result of setBreakpointByUrl
 */
export interface SetBreakpointByUrlResult {
    breakpointId: BreakpointID;
    locations: Location[];
}

/**
 * Parameters for removeBreakpoint
 */
export interface RemoveBreakpointParams {
    breakpointId: BreakpointID;
}

/**
 * Parameters for getScriptSource
 */
export interface GetScriptSourceParams {
    scriptId: ScriptID;
}

/**
 * Result of getScriptSource
 */
export interface GetScriptSourceResult {
    scriptSource: string;
}

/**
 * Parameters for resume (empty)
 */
export type ResumeParams = Record<string, never>;

/**
 * Parameters for stepOver (empty)
 */
export type StepOverParams = Record<string, never>;

/**
 * Parameters for stepInto (empty)
 */
export type StepIntoParams = Record<string, never>;

/**
 * Parameters for stepOut (empty)
 */
export type StepOutParams = Record<string, never>;

/**
 * Parameters for pause (empty)
 */
export type PauseParams = Record<string, never>;

/**
 * Parameters for evaluateOnCallFrame
 */
export interface EvaluateOnCallFrameParams {
    callFrameId: CallFrameID;
    expression: string;
}

/**
 * Result of evaluateOnCallFrame
 */
export interface EvaluateOnCallFrameResult {
    result: RemoteObjectReference;
}

/**
 * Parameters for getPossibleBreakpoints
 */
export interface GetPossibleBreakpointsParams {
    start: Location;
    end?: Location;
}

/**
 * Result of getPossibleBreakpoints
 */
export interface GetPossibleBreakpointsResult {
    locations: BreakLocation[];
}
