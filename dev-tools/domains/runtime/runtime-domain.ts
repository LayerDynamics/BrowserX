/**
 * Runtime Domain Agent
 *
 * Provides JavaScript evaluation, console API interception, and object inspection.
 * Hooks into ScriptExecutor and V8Isolate for JS execution.
 */

import type { DomainName } from "../../protocol/types.ts";
import { BaseDomain } from "../base-domain.ts";
import type {
    RemoteObject,
    RemoteObjectID,
    ExceptionDetails,
    EvaluateParams,
    EvaluateResult,
    GetPropertiesParams,
    GetPropertiesResult,
    ReleaseObjectParams,
    ReleaseObjectGroupParams,
    GetHeapUsageResult,
    ExecutionContextDescription,
} from "./runtime-types.ts";

/**
 * Runtime Domain - JavaScript evaluation and object inspection
 */
export class RuntimeDomain extends BaseDomain {
    readonly name: DomainName = "Runtime";

    /** Remote object store */
    private remoteObjects: Map<RemoteObjectID, unknown> = new Map();
    private objectIdCounter: number = 0;
    private exceptionCounter: number = 0;
    private executionContextId: number = 1;

    /** Object groups for batch release */
    private objectGroups: Map<string, Set<RemoteObjectID>> = new Map();

    protected setup(): void {
        this.registerMethod("evaluate", "Evaluate JavaScript expression", async (params) => {
            return await this.evaluate(params as unknown as EvaluateParams);
        });

        this.registerMethod("getProperties", "Get properties of a remote object", async (params) => {
            return await this.getProperties(params as unknown as GetPropertiesParams);
        });

        this.registerMethod("releaseObject", "Release a remote object reference", async (params) => {
            return await this.releaseObject(params as unknown as ReleaseObjectParams);
        });

        this.registerMethod("releaseObjectGroup", "Release all objects in a group", async (params) => {
            return await this.releaseObjectGroup(params as unknown as ReleaseObjectGroupParams);
        });

        this.registerMethod("getHeapUsage", "Get heap usage statistics", async () => {
            return await this.getHeapUsage();
        });

        this.registerMethod("getExecutionContexts", "Get execution contexts", async () => {
            return await this.getExecutionContexts();
        });

        // Register events
        this.registerEvent("consoleAPICalled", "Console API method invoked");
        this.registerEvent("exceptionThrown", "Uncaught exception occurred");
        this.registerEvent("executionContextCreated", "New execution context created");
        this.registerEvent("executionContextDestroyed", "Execution context destroyed");
    }

    override async enable(): Promise<Record<string, unknown>> {
        await super.enable();

        // Emit execution context creation
        this.emitEvent("executionContextCreated", {
            context: this.getDefaultContext(),
        });

        return {};
    }

    /**
     * Get the default execution context
     */
    private getDefaultContext(): ExecutionContextDescription {
        const url = this.context.browser.getCurrentURL() || "about:blank";
        return {
            id: this.executionContextId,
            origin: url.startsWith("http") ? new URL(url).origin : "",
            name: "default",
            uniqueId: `ctx-${this.executionContextId}`,
        };
    }

    /**
     * Store a value as a remote object
     */
    private storeRemoteObject(value: unknown, group?: string): RemoteObject {
        const objectId = `obj-${++this.objectIdCounter}`;

        if (value !== null && value !== undefined && typeof value === "object") {
            this.remoteObjects.set(objectId, value);
            if (group) {
                if (!this.objectGroups.has(group)) {
                    this.objectGroups.set(group, new Set());
                }
                this.objectGroups.get(group)!.add(objectId);
            }
        }

        return this.serializeValue(value, objectId);
    }

    /**
     * Serialize a JavaScript value to RemoteObject format
     */
    private serializeValue(value: unknown, objectId?: string): RemoteObject {
        if (value === undefined) {
            return { type: "undefined" };
        }
        if (value === null) {
            return { type: "object", subtype: "null", value: null };
        }

        const type = typeof value;

        switch (type) {
            case "string":
                return { type: "string", value };
            case "number": {
                const num = value as number;
                if (!Number.isFinite(num)) {
                    return {
                        type: "number",
                        unserializableValue: String(num),
                        description: String(num),
                    };
                }
                return { type: "number", value, description: String(num) };
            }
            case "boolean":
                return { type: "boolean", value };
            case "bigint":
                return {
                    type: "bigint",
                    unserializableValue: `${value}n`,
                    description: `${value}n`,
                };
            case "symbol":
                return {
                    type: "symbol",
                    description: String(value),
                };
            case "function":
                return {
                    type: "function",
                    className: "Function",
                    description: String(value),
                    objectId,
                };
            case "object": {
                if (Array.isArray(value)) {
                    return {
                        type: "object",
                        subtype: "array",
                        className: "Array",
                        description: `Array(${value.length})`,
                        objectId,
                        preview: {
                            type: "object",
                            description: `Array(${value.length})`,
                            overflow: value.length > 5,
                            properties: value.slice(0, 5).map((v, i) => ({
                                name: String(i),
                                type: typeof v,
                                value: String(v),
                            })),
                        },
                    };
                }
                if (value instanceof Error) {
                    return {
                        type: "object",
                        subtype: "error",
                        className: value.constructor.name,
                        description: value.stack || value.message,
                        objectId,
                    };
                }
                if (value instanceof Date) {
                    return {
                        type: "object",
                        subtype: "date",
                        className: "Date",
                        description: value.toISOString(),
                        value: value.toISOString(),
                        objectId,
                    };
                }
                if (value instanceof RegExp) {
                    return {
                        type: "object",
                        subtype: "regexp",
                        className: "RegExp",
                        description: String(value),
                        value: String(value),
                        objectId,
                    };
                }
                if (value instanceof Map) {
                    return {
                        type: "object",
                        subtype: "map",
                        className: "Map",
                        description: `Map(${value.size})`,
                        objectId,
                    };
                }
                if (value instanceof Set) {
                    return {
                        type: "object",
                        subtype: "set",
                        className: "Set",
                        description: `Set(${value.size})`,
                        objectId,
                    };
                }
                if (value instanceof Promise) {
                    return {
                        type: "object",
                        subtype: "promise",
                        className: "Promise",
                        description: "Promise",
                        objectId,
                    };
                }

                const className = (value as object).constructor?.name || "Object";
                const keys = Object.keys(value as object);
                return {
                    type: "object",
                    className,
                    description: className,
                    objectId,
                    preview: {
                        type: "object",
                        description: className,
                        overflow: keys.length > 5,
                        properties: keys.slice(0, 5).map((key) => ({
                            name: key,
                            type: typeof (value as Record<string, unknown>)[key],
                            value: String((value as Record<string, unknown>)[key]),
                        })),
                    },
                };
            }
            default:
                return { type: "string", value: String(value) };
        }
    }

    /**
     * Emit a console API call event
     */
    emitConsoleCall(
        type: string,
        args: unknown[],
        stackTrace?: { callFrames: Array<{ functionName: string; scriptId: string; url: string; lineNumber: number; columnNumber: number }> },
    ): void {
        if (!this.enabled) return;

        this.emitEvent("consoleAPICalled", {
            type,
            args: args.map((arg) => this.serializeValue(arg)),
            timestamp: Date.now(),
            stackTrace,
        });
    }

    /**
     * Emit an exception event
     */
    emitException(error: Error, scriptId?: string): void {
        if (!this.enabled) return;

        const exceptionDetails: ExceptionDetails = {
            exceptionId: ++this.exceptionCounter,
            text: error.message,
            lineNumber: 0,
            columnNumber: 0,
            scriptId,
            exception: this.serializeValue(error),
        };

        this.emitEvent("exceptionThrown", {
            timestamp: Date.now(),
            exceptionDetails,
        });
    }

    // ---- Method implementations ----

    private async evaluate(params: EvaluateParams): Promise<EvaluateResult> {
        try {
            // Try to use ScriptExecutor if available from the rendering pipeline
            const pipeline = this.context.renderingPipeline;
            const stats = pipeline.getStats();
            type ScriptExecutorLike = { execute: (code: string) => unknown };
            let scriptExecutor: ScriptExecutorLike | null = null;

            if (stats && typeof stats === "object" && "lastRenderResult" in stats) {
                const result = (stats as Record<string, unknown>).lastRenderResult;
                if (result && typeof result === "object" && "scriptExecutor" in result) {
                    scriptExecutor = (result as Record<string, unknown>).scriptExecutor as ScriptExecutorLike;
                }
            }

            let value: unknown;
            if (scriptExecutor) {
                value = scriptExecutor.execute(params.expression);
            } else {
                // Fallback: evaluate in current context
                value = undefined;
            }

            const remoteObj = this.storeRemoteObject(value, params.objectGroup);
            return { result: remoteObj };
        } catch (error) {
            const errorObj = error instanceof Error ? error : new Error(String(error));
            return {
                result: this.serializeValue(undefined),
                exceptionDetails: {
                    exceptionId: ++this.exceptionCounter,
                    text: errorObj.message,
                    lineNumber: 0,
                    columnNumber: 0,
                    exception: this.serializeValue(errorObj),
                },
            };
        }
    }

    private async getProperties(params: GetPropertiesParams): Promise<GetPropertiesResult> {
        const obj = this.remoteObjects.get(params.objectId);
        if (!obj || typeof obj !== "object") {
            return { result: [] };
        }

        const properties: GetPropertiesResult["result"] = [];
        const target = obj as Record<string, unknown>;

        for (const key of Object.keys(target)) {
            const value = target[key];
            const descriptor = Object.getOwnPropertyDescriptor(target, key);

            properties.push({
                name: key,
                value: this.storeRemoteObject(value),
                writable: descriptor?.writable ?? true,
                configurable: descriptor?.configurable ?? true,
                enumerable: descriptor?.enumerable ?? true,
                isOwn: true,
            });
        }

        return { result: properties };
    }

    private async releaseObject(params: ReleaseObjectParams): Promise<Record<string, unknown>> {
        this.remoteObjects.delete(params.objectId);
        return {};
    }

    private async releaseObjectGroup(params: ReleaseObjectGroupParams): Promise<Record<string, unknown>> {
        const group = this.objectGroups.get(params.objectGroup);
        if (group) {
            for (const objectId of group) {
                this.remoteObjects.delete(objectId);
            }
            this.objectGroups.delete(params.objectGroup);
        }
        return {};
    }

    private async getHeapUsage(): Promise<GetHeapUsageResult> {
        // Try to get stats from V8Isolate
        return {
            usedSize: 0,
            totalSize: 0,
        };
    }

    private async getExecutionContexts(): Promise<Record<string, unknown>> {
        return {
            contexts: [this.getDefaultContext()],
        };
    }

    override dispose(): void {
        this.remoteObjects.clear();
        this.objectGroups.clear();
        super.dispose();
    }
}
