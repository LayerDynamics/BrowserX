/**
 * Middleware Chain
 *
 * Executes middleware in order, handling early termination and errors
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
  }> = [];

  private responseMiddleware: Array<{
    middleware: ResponseMiddleware;
    enabled: boolean;
  }> = [];

  constructor(config?: MiddlewareChainConfig) {
    if (config) {
      // Add request middleware
      for (const item of config.request) {
        this.addRequestMiddleware(item.middleware, item.config.enabled);
      }

      // Add response middleware
      for (const item of config.response) {
        this.addResponseMiddleware(item.middleware, item.config.enabled);
      }

      // Sort by priority if available
      this.sortMiddleware();
    }
  }

  /**
   * Add request middleware
   */
  addRequestMiddleware(
    middleware: RequestMiddleware,
    enabled = true,
  ): void {
    this.requestMiddleware.push({ middleware, enabled });
  }

  /**
   * Add response middleware
   */
  addResponseMiddleware(
    middleware: ResponseMiddleware,
    enabled = true,
  ): void {
    this.responseMiddleware.push({ middleware, enabled });
  }

  /**
   * Execute request middleware chain
   * Returns:
   * - { type: "continue" } to proceed to handler
   * - { type: "respond", response } to short-circuit with response
   * - { type: "error", error } to trigger error handling
   */
  async executeRequest(
    request: HTTPRequest,
    context: RequestContext,
  ): Promise<MiddlewareResult> {
    for (const { middleware, enabled } of this.requestMiddleware) {
      if (!enabled) {
        continue;
      }

      try {
        const result = await middleware.processRequest(request, context);

        // Check if middleware wants to short-circuit
        if (result.type !== "continue") {
          return result;
        }
      } catch (error) {
        // Middleware threw an error
        return {
          type: "error",
          error: error instanceof Error ? error : new Error(`Middleware error: ${String(error)}`),
        };
      }
    }

    // All middleware passed
    return { type: "continue" };
  }

  /**
   * Execute response middleware chain
   * Returns modified response
   */
  async executeResponse(
    request: HTTPRequest,
    response: HTTPResponse,
    context: RequestContext,
  ): Promise<HTTPResponse> {
    let currentResponse = response;

    for (const { middleware, enabled } of this.responseMiddleware) {
      if (!enabled) {
        continue;
      }

      try {
        currentResponse = await middleware.processResponse(
          request,
          currentResponse,
          context,
        );
      } catch (error) {
        // Log error but continue with current response
        console.error(
          `Response middleware "${middleware.name}" failed:`,
          error,
        );
      }
    }

    return currentResponse;
  }

  /**
   * Sort middleware by priority (if available)
   */
  private sortMiddleware(): void {
    // Request middleware - lower priority = earlier execution
    this.requestMiddleware.sort((a, b) => {
      const aPriority = (a.middleware as any).priority || 100;
      const bPriority = (b.middleware as any).priority || 100;
      return aPriority - bPriority;
    });

    // Response middleware - lower priority = earlier execution
    this.responseMiddleware.sort((a, b) => {
      const aPriority = (a.middleware as any).priority || 100;
      const bPriority = (b.middleware as any).priority || 100;
      return aPriority - bPriority;
    });
  }

  /**
   * Enable middleware by name
   */
  enableMiddleware(name: string, isRequest = true): boolean {
    const middleware = isRequest ? this.requestMiddleware : this.responseMiddleware;

    for (const item of middleware) {
      if (item.middleware.name === name) {
        item.enabled = true;
        return true;
      }
    }

    return false;
  }

  /**
   * Disable middleware by name
   */
  disableMiddleware(name: string, isRequest = true): boolean {
    const middleware = isRequest ? this.requestMiddleware : this.responseMiddleware;

    for (const item of middleware) {
      if (item.middleware.name === name) {
        item.enabled = false;
        return true;
      }
    }

    return false;
  }

  /**
   * Get middleware statistics
   */
  getStats() {
    return {
      request: {
        total: this.requestMiddleware.length,
        enabled: this.requestMiddleware.filter((m) => m.enabled).length,
        middleware: this.requestMiddleware.map((m) => ({
          name: m.middleware.name,
          enabled: m.enabled,
        })),
      },
      response: {
        total: this.responseMiddleware.length,
        enabled: this.responseMiddleware.filter((m) => m.enabled).length,
        middleware: this.responseMiddleware.map((m) => ({
          name: m.middleware.name,
          enabled: m.enabled,
        })),
      },
    };
  }

  /**
   * Clear all middleware
   */
  clear(): void {
    this.requestMiddleware = [];
    this.responseMiddleware = [];
  }
}

/**
 * Create error response from middleware error
 */
export function createErrorResponse(error: Error): HTTPResponse {
  const statusCode = getStatusCodeFromError(error);
  const body = new TextEncoder().encode(
    JSON.stringify({
      error: error.name,
      message: error.message,
      statusCode,
    }),
  );

  return {
    version: "1.1",
    statusCode,
    statusText: getStatusText(statusCode),
    headers: {
      "content-type": "application/json",
      "content-length": body.length.toString(),
      "connection": "close",
    },
    body,
  };
}

/**
 * Get HTTP status code from error
 */
function getStatusCodeFromError(error: Error): number {
  const errorName = error.name.toLowerCase();

  if (errorName.includes("authentication")) {
    return 401;
  }

  if (errorName.includes("authorization") || errorName.includes("permission")) {
    return 403;
  }

  if (errorName.includes("notfound")) {
    return 404;
  }

  if (errorName.includes("ratelimit")) {
    return 429;
  }

  if (errorName.includes("timeout")) {
    return 504;
  }

  // Default to 500 Internal Server Error
  return 500;
}

/**
 * Get status text for status code
 */
function getStatusText(code: number): string {
  const statusTexts: Record<number, string> = {
    400: "Bad Request",
    401: "Unauthorized",
    403: "Forbidden",
    404: "Not Found",
    429: "Too Many Requests",
    500: "Internal Server Error",
    502: "Bad Gateway",
    503: "Service Unavailable",
    504: "Gateway Timeout",
  };

  return statusTexts[code] || "Error";
}
