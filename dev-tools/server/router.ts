/**
 * Protocol Message Router
 *
 * Parses "Domain.method" strings and routes to the correct domain in the registry.
 * Handles error wrapping and response construction for CDP-style JSON-RPC messages.
 */

import type {
    ProtocolRequest,
    ProtocolResponse,
    ProtocolEvent,
    ProtocolError,
    ProtocolMethod,
} from "../protocol/types.ts";
import { ProtocolErrorCode } from "../protocol/types.ts";
import type { DomainRegistry } from "../protocol/domains.ts";

/**
 * Protocol message router - dispatches incoming requests to the correct domain
 * agent via the DomainRegistry and constructs proper protocol responses.
 */
export class Router {
    private registry: DomainRegistry;

    constructor(registry: DomainRegistry) {
        this.registry = registry;
    }

    /**
     * Route a protocol request to the appropriate domain and return a response.
     *
     * Parses the "Domain.method" format, delegates to `registry.handleMethod()`,
     * and wraps the result (or error) in a ProtocolResponse.
     */
    async route(request: ProtocolRequest): Promise<ProtocolResponse> {
        try {
            const result = await this.registry.handleMethod(
                request.method,
                request.params ?? {},
            );

            const response: ProtocolResponse = {
                id: request.id,
                result: result ?? {},
            };

            if (request.sessionId) {
                response.sessionId = request.sessionId;
            }

            return response;
        } catch (error: unknown) {
            return this.buildErrorResponse(request, error);
        }
    }

    /**
     * Parse a raw JSON string into a ProtocolRequest.
     *
     * Validates that the parsed object contains the required `id` (number)
     * and `method` (string in "Domain.method" format) fields.
     *
     * @throws An object with `code` and `message` on parse or validation failure.
     */
    parseMessage(data: string): ProtocolRequest {
        let parsed: unknown;
        try {
            parsed = JSON.parse(data);
        } catch {
            throw {
                code: ProtocolErrorCode.PARSE_ERROR,
                message: "Failed to parse JSON message",
            };
        }

        if (typeof parsed !== "object" || parsed === null) {
            throw {
                code: ProtocolErrorCode.INVALID_REQUEST,
                message: "Message must be a JSON object",
            };
        }

        const msg = parsed as Record<string, unknown>;

        if (typeof msg.id !== "number") {
            throw {
                code: ProtocolErrorCode.INVALID_REQUEST,
                message: 'Message must contain a numeric "id" field',
            };
        }

        if (typeof msg.method !== "string") {
            throw {
                code: ProtocolErrorCode.INVALID_REQUEST,
                message: 'Message must contain a string "method" field',
            };
        }

        // Validate "Domain.method" format
        if (!msg.method.includes(".")) {
            throw {
                code: ProtocolErrorCode.INVALID_REQUEST,
                message: `Invalid method format: "${msg.method}". Expected "Domain.method".`,
            };
        }

        const request: ProtocolRequest = {
            id: msg.id as number,
            method: msg.method as ProtocolMethod,
        };

        if (msg.params !== undefined) {
            if (typeof msg.params !== "object" || msg.params === null) {
                throw {
                    code: ProtocolErrorCode.INVALID_PARAMS,
                    message: '"params" must be an object',
                };
            }
            request.params = msg.params as Record<string, unknown>;
        }

        if (typeof msg.sessionId === "string") {
            request.sessionId = msg.sessionId;
        }

        return request;
    }

    /**
     * Serialize a ProtocolResponse or ProtocolEvent to a JSON string.
     */
    serialize(message: ProtocolResponse | ProtocolEvent): string {
        return JSON.stringify(message);
    }

    /**
     * Build an error response from a caught error.
     * Handles both structured protocol errors (with code/message) and
     * unexpected Error instances.
     */
    private buildErrorResponse(
        request: ProtocolRequest,
        error: unknown,
    ): ProtocolResponse {
        let protocolError: ProtocolError;

        if (
            typeof error === "object" &&
            error !== null &&
            "code" in error &&
            "message" in error
        ) {
            // Structured protocol error thrown by DomainRegistry or domains
            const structured = error as { code: number; message: string; data?: unknown };
            protocolError = {
                code: structured.code,
                message: structured.message,
            };
            if (structured.data !== undefined) {
                protocolError.data = structured.data;
            }
        } else if (error instanceof Error) {
            protocolError = {
                code: ProtocolErrorCode.INTERNAL_ERROR,
                message: error.message,
            };
        } else {
            protocolError = {
                code: ProtocolErrorCode.INTERNAL_ERROR,
                message: String(error),
            };
        }

        const response: ProtocolResponse = {
            id: request.id,
            error: protocolError,
        };

        if (request.sessionId) {
            response.sessionId = request.sessionId;
        }

        return response;
    }
}
