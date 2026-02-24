/**
 * Console Domain Agent
 *
 * Collects and dispatches console log messages.
 * Subscribes to Runtime domain events for console API calls.
 */

import type { DomainName, ProtocolMethod } from "../../protocol/types.ts";
import { BaseDomain } from "../base-domain.ts";
import type { ConsoleMessage, ConsoleMessageLevel, ConsoleMessageSource } from "./console-types.ts";
import type { StackTrace } from "../runtime/runtime-types.ts";

/**
 * Console Domain - log message collection
 */
export class ConsoleDomain extends BaseDomain {
    readonly name: DomainName = "Console";

    /** Message buffer */
    private messages: ConsoleMessage[] = [];
    private maxMessages: number = 1000;

    /** Stored EventBus handler references for cleanup */
    private consoleApiHandler: ((data: unknown) => void) | null = null;
    private exceptionHandler: ((data: unknown) => void) | null = null;

    protected setup(): void {
        this.registerMethod("clearMessages", "Clear console message buffer", async () => {
            return await this.clearMessages();
        });

        this.registerMethod("getMessages", "Get buffered console messages", async () => {
            return { messages: this.messages };
        });

        // Register events
        this.registerEvent("messageAdded", "New console message");

        // Subscribe to Runtime.consoleAPICalled events via event bus
        this.consoleApiHandler = (data: unknown) => {
            if (!this.enabled) return;
            const params = data as {
                type: string;
                args: Array<{ value?: unknown; description?: string }>;
                timestamp: number;
                stackTrace?: StackTrace;
            };

            const level = this.mapConsoleTypeToLevel(params.type);
            const text = params.args
                .map((arg) => {
                    if (arg.value !== undefined) return String(arg.value);
                    if (arg.description) return arg.description;
                    return "[object]";
                })
                .join(" ");

            this.addMessage({
                source: "javascript",
                level,
                text,
                timestamp: params.timestamp,
                stackTrace: params.stackTrace,
            });
        };
        this.eventBus.on("Runtime.consoleAPICalled" as ProtocolMethod, this.consoleApiHandler);

        // Subscribe to Runtime.exceptionThrown events
        this.exceptionHandler = (data: unknown) => {
            if (!this.enabled) return;
            const params = data as {
                timestamp: number;
                exceptionDetails: {
                    text: string;
                    lineNumber: number;
                    columnNumber: number;
                    url?: string;
                    stackTrace?: StackTrace;
                };
            };

            this.addMessage({
                source: "javascript",
                level: "error",
                text: params.exceptionDetails.text,
                line: params.exceptionDetails.lineNumber,
                column: params.exceptionDetails.columnNumber,
                url: params.exceptionDetails.url,
                timestamp: params.timestamp,
                stackTrace: params.exceptionDetails.stackTrace,
            });
        };
        this.eventBus.on("Runtime.exceptionThrown" as ProtocolMethod, this.exceptionHandler);
    }

    /**
     * Add a console message
     */
    addMessage(message: ConsoleMessage): void {
        this.messages.push(message);

        // Trim buffer if needed
        if (this.messages.length > this.maxMessages) {
            this.messages = this.messages.slice(-this.maxMessages);
        }

        if (this.enabled) {
            this.emitEvent("messageAdded", { message });
        }
    }

    /**
     * Log a message programmatically
     */
    log(
        level: ConsoleMessageLevel,
        text: string,
        source: ConsoleMessageSource = "other",
    ): void {
        this.addMessage({
            source,
            level,
            text,
            timestamp: Date.now(),
        });
    }

    /**
     * Map console API type to message level
     */
    private mapConsoleTypeToLevel(type: string): ConsoleMessageLevel {
        switch (type) {
            case "error":
            case "assert":
                return "error";
            case "warning":
            case "warn":
                return "warning";
            case "debug":
                return "verbose";
            case "log":
            case "info":
            case "dir":
            case "table":
            case "trace":
            case "count":
            case "timeEnd":
            default:
                return "info";
        }
    }

    private async clearMessages(): Promise<Record<string, unknown>> {
        this.messages = [];
        return {};
    }

    override dispose(): void {
        if (this.consoleApiHandler) {
            this.eventBus.off("Runtime.consoleAPICalled" as ProtocolMethod, this.consoleApiHandler);
            this.consoleApiHandler = null;
        }
        if (this.exceptionHandler) {
            this.eventBus.off("Runtime.exceptionThrown" as ProtocolMethod, this.exceptionHandler);
            this.exceptionHandler = null;
        }
        this.messages = [];
        super.dispose();
    }
}
