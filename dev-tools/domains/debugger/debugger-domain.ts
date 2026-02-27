/**
 * Debugger Domain Agent
 *
 * Provides JavaScript debugging capabilities: breakpoints, stepping,
 * call stack inspection, script source retrieval, and expression evaluation.
 * Hooks into the ScriptExecutor and V8Isolate for debugger functionality.
 */

import type { DomainName } from "../../protocol/types.ts";
import { BaseDomain } from "../base-domain.ts";
import type {
    BreakpointID,
    ScriptID,
    CallFrameID,
    Location,
    BreakLocation,
    CallFrame,
    Scope,
    RemoteObjectReference,
    ScriptDescription,
    SetBreakpointParams,
    SetBreakpointResult,
    SetBreakpointByUrlParams,
    SetBreakpointByUrlResult,
    RemoveBreakpointParams,
    GetScriptSourceParams,
    GetScriptSourceResult,
    EvaluateOnCallFrameParams,
    EvaluateOnCallFrameResult,
    GetPossibleBreakpointsParams,
    GetPossibleBreakpointsResult,
} from "./debugger-types.ts";
import { validateParams } from "../../protocol/validate-params.ts";
import { validateSetBreakpointParams, validateSetBreakpointByUrlParams, validateRemoveBreakpointParams, validateGetScriptSourceParams, validateEvaluateOnCallFrameParams, validateGetPossibleBreakpointsParams, validateGetPropertiesParams } from "./debugger-validators.ts";

/**
 * Internal breakpoint storage
 */
interface BreakpointEntry {
    locations: Location[];
    condition?: string;
}

/**
 * Debugger Domain - breakpoints, stepping, and script inspection
 */
export class DebuggerDomain extends BaseDomain {
    readonly name: DomainName = "Debugger";

    /** Registered breakpoints */
    private breakpoints: Map<BreakpointID, BreakpointEntry> = new Map();

    /** Known scripts */
    private scripts: Map<ScriptID, ScriptDescription> = new Map();

    /** Counters for ID generation */
    private breakpointCounter: number = 0;
    private scriptCounter: number = 0;

    /** Remote object store for stable objectIds */
    private objectStore: Map<string, unknown> = new Map();
    private objectIdCounter: number = 0;

    /** Debugger pause state */
    private paused: boolean = false;
    private pauseReason: string = "";
    private callFrames: CallFrame[] = [];

    protected setup(): void {
        // Register methods
        this.registerMethod("setBreakpoint", "Set breakpoint at a specific location", async (params) => {
            return await this.setBreakpoint(validateParams(params, validateSetBreakpointParams) as SetBreakpointParams);
        });

        this.registerMethod("setBreakpointByUrl", "Set breakpoint by URL and line number", async (params) => {
            return await this.setBreakpointByUrl(validateParams(params, validateSetBreakpointByUrlParams) as SetBreakpointByUrlParams);
        });

        this.registerMethod("removeBreakpoint", "Remove a breakpoint", async (params) => {
            return await this.removeBreakpoint(validateParams(params, validateRemoveBreakpointParams) as RemoveBreakpointParams);
        });

        this.registerMethod("getScriptSource", "Get source code of a script", async (params) => {
            return await this.getScriptSource(validateParams(params, validateGetScriptSourceParams) as GetScriptSourceParams);
        });

        this.registerMethod("resume", "Resume script execution", async (params) => {
            return await this.resume();
        });

        this.registerMethod("stepOver", "Step over the next statement", async (params) => {
            return await this.stepOver();
        });

        this.registerMethod("stepInto", "Step into the next function call", async (params) => {
            return await this.stepInto();
        });

        this.registerMethod("stepOut", "Step out of the current function", async (params) => {
            return await this.stepOut();
        });

        this.registerMethod("pause", "Pause script execution", async (params) => {
            return await this.pause();
        });

        this.registerMethod("evaluateOnCallFrame", "Evaluate expression on a specific call frame", async (params) => {
            return await this.evaluateOnCallFrame(validateParams(params, validateEvaluateOnCallFrameParams) as EvaluateOnCallFrameParams);
        });

        this.registerMethod("getPossibleBreakpoints", "Get possible breakpoint locations in a range", async (params) => {
            return await this.getPossibleBreakpoints(validateParams(params, validateGetPossibleBreakpointsParams) as GetPossibleBreakpointsParams);
        });

        this.registerMethod("getStackTrace", "Get the current call stack trace", async (params) => {
            return await this.getStackTrace();
        });

        this.registerMethod("getProperties", "Get properties of a remote object by objectId", async (params) => {
            return await this.getProperties(validateParams(params, validateGetPropertiesParams));
        });

        // Register events
        this.registerEvent("scriptParsed", "A new script has been parsed");
        this.registerEvent("paused", "Script execution has been paused");
        this.registerEvent("resumed", "Script execution has been resumed");
        this.registerEvent("breakpointResolved", "A breakpoint has been resolved to a location");
    }

    override async enable(): Promise<Record<string, unknown>> {
        await super.enable();

        // Emit scriptParsed events for any known scripts
        for (const [_scriptId, script] of this.scripts) {
            this.emitEvent("scriptParsed", {
                scriptId: script.scriptId,
                url: script.url,
                startLine: script.startLine,
                startColumn: script.startColumn,
                endLine: script.endLine,
                endColumn: script.endColumn,
                hash: script.hash,
                sourceMapURL: script.sourceMapURL,
            });
        }

        // Try to discover scripts from the rendering pipeline
        await this.discoverScripts();

        return {};
    }

    override async disable(): Promise<Record<string, unknown>> {
        // Resume if paused when disabling
        if (this.paused) {
            this.paused = false;
            this.pauseReason = "";
            this.callFrames = [];
            this.emitEvent("resumed", {});
        }

        return await super.disable();
    }

    // ---- Method implementations ----

    /**
     * Set a breakpoint at a specific script location
     */
    private async setBreakpoint(params: SetBreakpointParams): Promise<SetBreakpointResult> {
        const breakpointId: BreakpointID = `bp-${++this.breakpointCounter}`;

        const entry: BreakpointEntry = {
            locations: [params.location],
            condition: params.condition,
        };

        this.breakpoints.set(breakpointId, entry);

        // The actual location may differ from the requested one
        // In a real implementation, the V8 debugger would resolve the actual location
        const actualLocation: Location = {
            scriptId: params.location.scriptId,
            lineNumber: params.location.lineNumber,
            columnNumber: params.location.columnNumber ?? 0,
        };

        // Emit breakpointResolved event
        if (this.enabled) {
            this.emitEvent("breakpointResolved", {
                breakpointId,
                location: actualLocation,
            });
        }

        return {
            breakpointId,
            actualLocation,
        };
    }

    /**
     * Set a breakpoint by URL and line number
     * Resolves across all matching scripts
     */
    private async setBreakpointByUrl(params: SetBreakpointByUrlParams): Promise<SetBreakpointByUrlResult> {
        const breakpointId: BreakpointID = `bp-${++this.breakpointCounter}`;

        // Find all scripts matching the URL
        const matchingScripts: ScriptDescription[] = [];
        for (const [_id, script] of this.scripts) {
            if (script.url === params.url || script.url.endsWith(params.url)) {
                matchingScripts.push(script);
            }
        }

        const locations: Location[] = [];

        if (matchingScripts.length > 0) {
            // Create breakpoint locations for each matching script
            for (const script of matchingScripts) {
                const location: Location = {
                    scriptId: script.scriptId,
                    lineNumber: params.lineNumber,
                    columnNumber: params.columnNumber ?? 0,
                };

                locations.push(location);

                // Emit breakpointResolved for each resolved location
                if (this.enabled) {
                    this.emitEvent("breakpointResolved", {
                        breakpointId,
                        location,
                    });
                }
            }

            // Store all locations under a single breakpoint entry
            this.breakpoints.set(breakpointId, {
                locations,
                condition: params.condition,
            });
        } else {
            // No matching scripts found yet - store as pending breakpoint
            // It will be resolved when a matching script is parsed
            const pendingLocation: Location = {
                scriptId: `pending-${params.url}`,
                lineNumber: params.lineNumber,
                columnNumber: params.columnNumber ?? 0,
            };

            this.breakpoints.set(breakpointId, {
                locations: [pendingLocation],
                condition: params.condition,
            });
        }

        return {
            breakpointId,
            locations,
        };
    }

    /**
     * Remove a breakpoint by ID
     */
    private async removeBreakpoint(params: RemoveBreakpointParams): Promise<Record<string, unknown>> {
        this.breakpoints.delete(params.breakpointId);
        return {};
    }

    /**
     * Get the source code for a script
     */
    private async getScriptSource(params: GetScriptSourceParams): Promise<GetScriptSourceResult> {
        const script = this.scripts.get(params.scriptId);

        if (!script) {
            return { scriptSource: "" };
        }

        // Try to retrieve source from the script executor
        try {
            const lastResult = this.context.renderingPipeline.lastRenderResult;
            if (lastResult && lastResult.scriptExecutor) {
                const executor = lastResult.scriptExecutor as unknown as Record<string, unknown>;
                if (typeof executor.getSource === "function") {
                    const source = executor.getSource(params.scriptId);
                    if (typeof source === "string") {
                        return { scriptSource: source };
                    }
                }
            }
        } catch (_error) {
            // Fall through to return empty source
        }

        // Return placeholder if source is not available
        return { scriptSource: `// Source for script ${params.scriptId} (${script.url}) not available` };
    }

    /**
     * Resume execution after a pause
     */
    private async resume(): Promise<Record<string, unknown>> {
        if (this.paused) {
            this.paused = false;
            this.pauseReason = "";
            this.callFrames = [];

            if (this.enabled) {
                this.emitEvent("resumed", {});
            }
        }

        return {};
    }

    /**
     * Step over the next statement
     */
    private async stepOver(): Promise<Record<string, unknown>> {
        if (!this.paused) {
            return {};
        }

        // In a real implementation, this would instruct V8 to step over
        // For now, simulate stepping by advancing the location
        if (this.callFrames.length > 0) {
            const topFrame = this.callFrames[0];
            const newLocation: Location = {
                scriptId: topFrame.location.scriptId,
                lineNumber: topFrame.location.lineNumber + 1,
                columnNumber: 0,
            };

            this.callFrames[0] = {
                ...topFrame,
                location: newLocation,
            };

            this.pauseReason = "stepOver";

            if (this.enabled) {
                this.emitEvent("paused", {
                    callFrames: this.callFrames,
                    reason: "step",
                    hitBreakpoints: [],
                });
            }
        }

        return {};
    }

    /**
     * Step into the next function call
     */
    private async stepInto(): Promise<Record<string, unknown>> {
        if (!this.paused) {
            return {};
        }

        // In a real implementation, this would instruct V8 to step into
        if (this.callFrames.length > 0) {
            const topFrame = this.callFrames[0];
            const newLocation: Location = {
                scriptId: topFrame.location.scriptId,
                lineNumber: topFrame.location.lineNumber + 1,
                columnNumber: 0,
            };

            // Create a new call frame as if stepping into a function
            const newFrame: CallFrame = {
                callFrameId: `cf-step-${Date.now()}`,
                functionName: "<stepped-into>",
                location: newLocation,
                url: topFrame.url,
                scopeChain: [{
                    type: "local",
                    object: { type: "object", objectId: `scope-local-${Date.now()}`, description: "Local" },
                }],
                this: { type: "object", description: "Window" },
            };

            this.callFrames.unshift(newFrame);
            this.pauseReason = "stepInto";

            if (this.enabled) {
                this.emitEvent("paused", {
                    callFrames: this.callFrames,
                    reason: "step",
                    hitBreakpoints: [],
                });
            }
        }

        return {};
    }

    /**
     * Step out of the current function
     */
    private async stepOut(): Promise<Record<string, unknown>> {
        if (!this.paused) {
            return {};
        }

        // In a real implementation, this would instruct V8 to step out
        if (this.callFrames.length > 1) {
            // Remove the top frame (stepping out of the current function)
            this.callFrames.shift();
            this.pauseReason = "stepOut";

            if (this.enabled) {
                this.emitEvent("paused", {
                    callFrames: this.callFrames,
                    reason: "step",
                    hitBreakpoints: [],
                });
            }
        } else {
            // At top-level, resume execution
            await this.resume();
        }

        return {};
    }

    /**
     * Pause script execution
     */
    private async pause(): Promise<Record<string, unknown>> {
        if (this.paused) {
            return {};
        }

        this.paused = true;
        this.pauseReason = "pause";

        // Build a synthetic call frame representing the current execution point
        const currentUrl = this.context.browser.getCurrentURL() || "about:blank";
        const globalScope: Scope = {
            type: "global",
            object: { type: "object", objectId: "scope-global-0", description: "Window" },
            name: "global",
        };

        const localScope: Scope = {
            type: "local",
            object: { type: "object", objectId: `scope-local-${Date.now()}`, description: "Local" },
        };

        // Find the first known script or create a synthetic one
        let scriptId: ScriptID = "script-0";
        for (const [id, _script] of this.scripts) {
            scriptId = id;
            break;
        }

        const frame: CallFrame = {
            callFrameId: `cf-pause-${Date.now()}`,
            functionName: "(paused)",
            location: {
                scriptId,
                lineNumber: 0,
                columnNumber: 0,
            },
            url: currentUrl,
            scopeChain: [localScope, globalScope],
            this: { type: "object", description: "Window" },
        };

        this.callFrames = [frame];

        if (this.enabled) {
            this.emitEvent("paused", {
                callFrames: this.callFrames,
                reason: "pause",
                hitBreakpoints: [],
            });
        }

        return {};
    }

    /**
     * Evaluate an expression on a specific call frame
     */
    private async evaluateOnCallFrame(params: EvaluateOnCallFrameParams): Promise<EvaluateOnCallFrameResult> {
        // Verify the call frame exists
        const frame = this.callFrames.find((f) => f.callFrameId === params.callFrameId);

        if (!frame) {
            return {
                result: {
                    type: "undefined",
                    description: "Call frame not found",
                },
            };
        }

        // Try to evaluate using the script executor
        try {
            const lastResult = this.context.renderingPipeline.lastRenderResult;
            if (lastResult && lastResult.scriptExecutor) {
                type ScriptExecutorLike = { execute: (code: string) => unknown };
                const executor = lastResult.scriptExecutor as unknown as ScriptExecutorLike;

                if (typeof executor.execute === "function") {
                    const value = executor.execute(params.expression);
                    return {
                        result: this.serializeValue(value),
                    };
                }
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            return {
                result: {
                    type: "object",
                    objectId: undefined,
                    description: `Error: ${errorMessage}`,
                },
            };
        }

        // Fallback: return undefined
        return {
            result: {
                type: "undefined",
                description: "Evaluation not available",
            },
        };
    }

    /**
     * Get possible breakpoint locations within a source range
     */
    private async getPossibleBreakpoints(params: GetPossibleBreakpointsParams): Promise<GetPossibleBreakpointsResult> {
        const script = this.scripts.get(params.start.scriptId);

        if (!script) {
            return { locations: [] };
        }

        const startLine = params.start.lineNumber;
        const endLine = params.end?.lineNumber ?? script.endLine;

        // Generate possible breakpoint locations for each line in range
        const MAX_BREAKPOINT_LOCATIONS = 10000;
        const locations: BreakLocation[] = [];
        for (let line = startLine; line <= endLine; line++) {
            if (locations.length >= MAX_BREAKPOINT_LOCATIONS) break;
            locations.push({
                scriptId: params.start.scriptId,
                lineNumber: line,
                columnNumber: 0,
                type: "debuggerStatement",
            });
        }

        return { locations };
    }

    /**
     * Get the current stack trace
     */
    private async getStackTrace(): Promise<Record<string, unknown>> {
        return {
            callFrames: this.callFrames,
            paused: this.paused,
            reason: this.pauseReason,
        };
    }

    /**
     * Get properties of a stored remote object by objectId
     */
    private async getProperties(params: { objectId: string }): Promise<{ result: Array<{ name: string; value: RemoteObjectReference; writable: boolean; configurable: boolean; enumerable: boolean; isOwn: boolean }> }> {
        const obj = this.objectStore.get(params.objectId);
        if (!obj || typeof obj !== "object") {
            return { result: [] };
        }

        const properties: Array<{ name: string; value: RemoteObjectReference; writable: boolean; configurable: boolean; enumerable: boolean; isOwn: boolean }> = [];
        const target = obj as Record<string, unknown>;

        for (const key of Object.keys(target)) {
            const value = target[key];
            const descriptor = Object.getOwnPropertyDescriptor(target, key);

            properties.push({
                name: key,
                value: this.serializeValue(value),
                writable: descriptor?.writable ?? true,
                configurable: descriptor?.configurable ?? true,
                enumerable: descriptor?.enumerable ?? true,
                isOwn: true,
            });
        }

        return { result: properties };
    }

    // ---- Helper methods ----

    /**
     * Discover scripts from the rendering pipeline
     */
    private async discoverScripts(): Promise<void> {
        try {
            const lastResult = this.context.renderingPipeline.lastRenderResult;
            if (!lastResult) {
                return;
            }

            // Check if there's a script executor with script information
            if (lastResult.scriptExecutor) {
                const executor = lastResult.scriptExecutor as unknown as Record<string, unknown>;

                // Try to get script list from executor
                if (typeof executor.getScripts === "function") {
                    const executorScripts = executor.getScripts() as Array<{
                        id: string;
                        url: string;
                        source: string;
                    }>;

                    for (const script of executorScripts) {
                        await this.registerScript(script.url, script.source);
                    }
                } else {
                    // Register a synthetic script for the current page
                    const url = this.context.browser.getCurrentURL() || "about:blank";
                    if (url !== "about:blank") {
                        await this.registerScript(url, "");
                    }
                }
            }
        } catch (_error) {
            // Script discovery is best-effort
        }
    }

    /**
     * Register a new script and emit scriptParsed event
     */
    async registerScript(url: string, source: string): Promise<ScriptID> {
        const scriptId: ScriptID = `script-${++this.scriptCounter}`;
        const lines = source.split("\n");

        const description: ScriptDescription = {
            scriptId,
            url,
            startLine: 0,
            startColumn: 0,
            endLine: Math.max(0, lines.length - 1),
            endColumn: lines.length > 0 ? lines[lines.length - 1].length : 0,
            hash: await this.computeScriptHash(source),
        };

        this.scripts.set(scriptId, description);

        // Emit scriptParsed event if domain is enabled
        if (this.enabled) {
            this.emitEvent("scriptParsed", {
                scriptId: description.scriptId,
                url: description.url,
                startLine: description.startLine,
                startColumn: description.startColumn,
                endLine: description.endLine,
                endColumn: description.endColumn,
                hash: description.hash,
                sourceMapURL: description.sourceMapURL,
            });
        }

        // Check if any pending breakpoints match this script
        this.resolvePendingBreakpoints(url, scriptId);

        return scriptId;
    }

    /**
     * Resolve pending breakpoints that match a newly parsed script
     */
    private resolvePendingBreakpoints(url: string, scriptId: ScriptID): void {
        for (const [breakpointId, entry] of this.breakpoints) {
            const pendingIdx = entry.locations.findIndex(l => l.scriptId === `pending-${url}`);
            if (pendingIdx !== -1) {
                // Update the pending location with the resolved script ID
                const pending = entry.locations[pendingIdx];
                const resolvedLocation: Location = {
                    scriptId,
                    lineNumber: pending.lineNumber,
                    columnNumber: pending.columnNumber ?? 0,
                };

                entry.locations[pendingIdx] = resolvedLocation;

                if (this.enabled) {
                    this.emitEvent("breakpointResolved", {
                        breakpointId,
                        location: resolvedLocation,
                    });
                }
            }
        }
    }

    /**
     * Trigger a breakpoint hit (called externally by the script executor)
     */
    triggerBreakpoint(breakpointId: BreakpointID, callFrames: CallFrame[]): void {
        if (!this.enabled) {
            return;
        }

        const entry = this.breakpoints.get(breakpointId);
        if (!entry) {
            return;
        }

        // Check condition if one exists
        if (entry.condition) {
            // In a real implementation, evaluate the condition
            // For now, always trigger
        }

        this.paused = true;
        this.pauseReason = "breakpoint";
        this.callFrames = callFrames;

        this.emitEvent("paused", {
            callFrames: this.callFrames,
            reason: "breakpoint",
            hitBreakpoints: [breakpointId],
        });
    }

    /**
     * Serialize a JavaScript value to RemoteObjectReference
     */
    private serializeValue(value: unknown): RemoteObjectReference {
        if (value === undefined) {
            return { type: "undefined" };
        }
        if (value === null) {
            return { type: "object", value: null, description: "null" };
        }

        const type = typeof value;

        switch (type) {
            case "string":
                return { type: "string", value, description: String(value) };
            case "number":
                return { type: "number", value, description: String(value) };
            case "boolean":
                return { type: "boolean", value, description: String(value) };
            case "function": {
                const fnId = `obj-${++this.objectIdCounter}`;
                this.objectStore.set(fnId, value);
                return {
                    type: "function",
                    description: String(value),
                    objectId: fnId,
                };
            }
            case "object": {
                const objId = `obj-${++this.objectIdCounter}`;
                this.objectStore.set(objId, value);
                if (Array.isArray(value)) {
                    return {
                        type: "object",
                        description: `Array(${value.length})`,
                        objectId: objId,
                    };
                }
                const className = (value as object).constructor?.name || "Object";
                return {
                    type: "object",
                    description: className,
                    objectId: objId,
                };
            }
            default:
                return { type: "string", value: String(value), description: String(value) };
        }
    }

    /**
     * Compute a SHA-256 hash of a string (async, uses Web Crypto)
     */
    private async computeScriptHash(source: string): Promise<string> {
        const data = new TextEncoder().encode(source);
        const hashBuffer = await crypto.subtle.digest("SHA-256", data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
    }

    /**
     * Compute a simple hash of a string (sync fallback)
     */
    private simpleHash(str: string): string {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash).toString(16).padStart(8, "0");
    }

    override dispose(): void {
        this.breakpoints.clear();
        this.scripts.clear();
        this.objectStore.clear();
        this.objectIdCounter = 0;
        this.callFrames = [];
        this.paused = false;
        this.pauseReason = "";
        super.dispose();
    }
}
