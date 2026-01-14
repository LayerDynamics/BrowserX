/**
 * Middleware Chain
 *
 * Executes middleware in priority order with short-circuit support
 */

import type {
  MiddlewareChainConfig,
  MiddlewareResult,
  RequestContext,
  RequestMiddleware,
  ResponseMiddleware,
} from "./types.ts";
import type { HTTPRequest, HTTPResponse } from "../../core/network/transport/http/http.ts";

/**
 * Middleware chain executor
 */
export class MiddlewareChain {
  private requestMiddleware: Array<{
    middleware: RequestMiddleware;
    enabled: boolean;
    priority: number;
  }> = [];

  private responseMiddleware: Array<{
    middleware: ResponseMiddleware;
    enabled: boolean;
    priority: number;
  }> = [];

  constructor(config?: MiddlewareChainConfig) {
    if (config) {
      this.configure(config);
    }
  }

  /**
   * Configure middleware chain
   */
  configure(config: MiddlewareChainConfig): void {
    this.requestMiddleware = config.request.map((item) => ({
      middleware: item.middleware,
      enabled: item.config.enabled,
      priority: item.config.priority ?? 100,
    }));

    this.responseMiddleware = config.response.map((item) => ({
      middleware: item.middleware,
      enabled: item.config.enabled,
      priority: item.config.priority ?? 100,
    }));

    // Sort by priority (lower = earlier)
    this.requestMiddleware.sort((a, b) => a.priority - b.priority);
    this.responseMiddleware.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Add request middleware
   */
  addRequestMiddleware(
    middleware: RequestMiddleware,
    enabled = true,
    priority = 100,
  ): void {
    this.requestMiddleware.push({ middleware, enabled, priority });
    this.requestMiddleware.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Add response middleware
   */
  addResponseMiddleware(
    middleware: ResponseMiddleware,
    enabled = true,
    priority = 100,
  ): void {
    this.responseMiddleware.push({ middleware, enabled, priority });
    this.responseMiddleware.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Execute request middleware chain
   * Returns either a response to short-circuit, or null to continue
   */
  async executeRequestChain(
    request: HTTPRequest,
    context: RequestContext,
  ): Promise<HTTPResponse | null> {
    for (const item of this.requestMiddleware) {
      if (!item.enabled) {
        continue;
      }

      try {
        const result = await item.middleware.processRequest(request, context);

        switch (result.type) {
          case "continue":
            // Continue to next middleware
            break;

          case "respond":
            // Short-circuit and return response
            return result.response;

          case "error":
            // Convert error to HTTP response
            return this.createErrorResponse(result.error);
        }
      } catch (error) {
        // Unhandled error in middleware
        console.error(
          `Error in middleware ${item.middleware.name}:`,
          error,
        );
        return this.createErrorResponse(
          error instanceof Error ? error : new Error(String(error)),
        );
      }
    }

    // All middleware passed, continue to handler
    return null;
  }

  /**
   * Execute response middleware chain
   * Returns modified response
   */
  async executeResponseChain(
    request: HTTPRequest,
    response: HTTPResponse,
    context: RequestContext,
  ): Promise<HTTPResponse> {
    let currentResponse = response;

    for (const item of this.responseMiddleware) {
      if (!item.enabled) {
        continue;
      }

      try {
        currentResponse = await item.middleware.processResponse(
          request,
          currentResponse,
          context,
        );
      } catch (error) {
        // Log error but continue with current response
        console.error(
          `Error in response middleware ${item.middleware.name}:`,
          error,
        );
      }
    }

    return currentResponse;
  }

  /**
   * Get list of enabled request middleware
   */
  getRequestMiddleware(): RequestMiddleware[] {
    return this.requestMiddleware
      .filter((item) => item.enabled)
      .map((item) => item.middleware);
  }

  /**
   * Get list of enabled response middleware
   */
  getResponseMiddleware(): ResponseMiddleware[] {
    return this.responseMiddleware
      .filter((item) => item.enabled)
      .map((item) => item.middleware);
  }

  /**
   * Create error response from error
   */
  private createErrorResponse(error: Error): HTTPResponse {
    const statusCode = this.getStatusCodeFromError(error);
    const body = new TextEncoder().encode(
      JSON.stringify({
        error: error.message,
        status: statusCode,
      }),
    );

    return {
      version: "1.1",
      statusCode,
      statusText: this.getStatusText(statusCode),
      headers: {
        "content-type": "application/json",
        "content-length": body.length.toString(),
        connection: "close",
      },
      body,
    };
  }

  /**
   * Get HTTP status code from error
   */
  private getStatusCodeFromError(error: Error): number {
    // Check error name/type for common patterns
    if (error.name === "AuthenticationError" || error.message.includes("authentication")) {
      return 401;
    }
    if (error.name === "AuthorizationError" || error.message.includes("authorization")) {
      return 403;
    }
    if (error.name === "NotFoundError" || error.message.includes("not found")) {
      return 404;
    }
    if (error.name === "RateLimitError" || error.message.includes("rate limit")) {
      return 429;
    }
    if (error.name === "ValidationError" || error.message.includes("validation")) {
      return 400;
    }

    // Default to 500
    return 500;
  }

  /**
   * Get status text for code
   */
  private getStatusText(code: number): string {
    const texts: Record<number, string> = {
      400: "Bad Request",
      401: "Unauthorized",
      403: "Forbidden",
      404: "Not Found",
      429: "Too Many Requests",
      500: "Internal Server Error",
      502: "Bad Gateway",
      503: "Service Unavailable",
    };

    return texts[code] || "Error";
  }
}
