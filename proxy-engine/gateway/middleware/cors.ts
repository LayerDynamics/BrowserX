/**
 * CORS Middleware
 *
 * Cross-Origin Resource Sharing (CORS) support
 */

import type {
  MiddlewareResult,
  RequestContext,
  RequestMiddleware,
  ResponseMiddleware,
} from "./types.ts";
import type { HTTPRequest, HTTPResponse } from "../../core/network/transport/http/http.ts";

/**
 * CORS configuration
 */
export interface CORSConfig {
  /**
   * Allowed origins
   * - String: exact origin match
   * - RegExp: pattern match
   * - "*": allow all origins
   * - Function: custom validation
   */
  origin: string | RegExp | string[] | ((origin: string) => boolean);

  /**
   * Allowed HTTP methods
   */
  methods?: string[];

  /**
   * Allowed headers
   */
  allowedHeaders?: string[];

  /**
   * Exposed headers
   */
  exposedHeaders?: string[];

  /**
   * Allow credentials
   */
  credentials?: boolean;

  /**
   * Max age for preflight cache (seconds)
   */
  maxAge?: number;

  /**
   * Handle preflight requests
   */
  preflightContinue?: boolean;

  /**
   * Success status for OPTIONS requests
   */
  optionsSuccessStatus?: number;
}

/**
 * CORS middleware
 */
export class CORSMiddleware implements RequestMiddleware, ResponseMiddleware {
  readonly name = "cors";

  private config: Required<CORSConfig>;

  constructor(config: CORSConfig) {
    this.config = {
      origin: config.origin,
      methods: config.methods || ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE"],
      allowedHeaders: config.allowedHeaders || ["*"],
      exposedHeaders: config.exposedHeaders || [],
      credentials: config.credentials || false,
      maxAge: config.maxAge || 86400, // 24 hours
      preflightContinue: config.preflightContinue || false,
      optionsSuccessStatus: config.optionsSuccessStatus || 204,
    };
  }

  async processRequest(
    request: HTTPRequest,
    context: RequestContext,
  ): Promise<MiddlewareResult> {
    const origin = request.headers["origin"];

    // Not a CORS request
    if (!origin) {
      return { type: "continue" };
    }

    // Check if origin is allowed
    if (!this.isOriginAllowed(origin)) {
      return {
        type: "error",
        error: new Error(`Origin not allowed: ${origin}`),
      };
    }

    // Handle preflight request (OPTIONS)
    if (request.method === "OPTIONS") {
      const response = this.createPreflightResponse(request, origin);

      if (!this.config.preflightContinue) {
        // Short-circuit with preflight response
        return { type: "respond", response };
      }
    }

    // Store origin in context for response middleware
    context.metadata.corsOrigin = origin;

    return { type: "continue" };
  }

  async processResponse(
    request: HTTPRequest,
    response: HTTPResponse,
    context: RequestContext,
  ): Promise<HTTPResponse> {
    const origin = context.metadata.corsOrigin as string | undefined;

    // Not a CORS request
    if (!origin) {
      return response;
    }

    // Add CORS headers to response
    this.addCORSHeaders(response, origin);

    return response;
  }

  /**
   * Check if origin is allowed
   */
  private isOriginAllowed(origin: string): boolean {
    if (this.config.origin === "*") {
      return true;
    }

    if (typeof this.config.origin === "string") {
      return origin === this.config.origin;
    }

    if (this.config.origin instanceof RegExp) {
      return this.config.origin.test(origin);
    }

    if (Array.isArray(this.config.origin)) {
      return this.config.origin.includes(origin);
    }

    if (typeof this.config.origin === "function") {
      return this.config.origin(origin);
    }

    return false;
  }

  /**
   * Create preflight response
   */
  private createPreflightResponse(request: HTTPRequest, origin: string): HTTPResponse {
    const response: HTTPResponse = {
      version: "1.1",
      statusCode: this.config.optionsSuccessStatus,
      statusText: this.getStatusText(this.config.optionsSuccessStatus),
      headers: {
        "content-length": "0",
      },
      body: new Uint8Array(0),
    };

    // Add CORS headers
    this.addCORSHeaders(response, origin);

    // Add preflight-specific headers
    response.headers["access-control-allow-methods"] = this.config.methods.join(", ");

    const requestedHeaders = request.headers["access-control-request-headers"];
    if (requestedHeaders) {
      if (this.config.allowedHeaders.includes("*")) {
        response.headers["access-control-allow-headers"] = requestedHeaders;
      } else {
        response.headers["access-control-allow-headers"] = this.config.allowedHeaders.join(", ");
      }
    }

    response.headers["access-control-max-age"] = this.config.maxAge.toString();

    return response;
  }

  /**
   * Add CORS headers to response
   */
  private addCORSHeaders(response: HTTPResponse, origin: string): void {
    // Access-Control-Allow-Origin
    if (this.config.origin === "*" && !this.config.credentials) {
      response.headers["access-control-allow-origin"] = "*";
    } else {
      response.headers["access-control-allow-origin"] = origin;
    }

    // Access-Control-Allow-Credentials
    if (this.config.credentials) {
      response.headers["access-control-allow-credentials"] = "true";
    }

    // Access-Control-Expose-Headers
    if (this.config.exposedHeaders.length > 0) {
      response.headers["access-control-expose-headers"] = this.config.exposedHeaders.join(", ");
    }

    // Vary header
    const vary = response.headers["vary"];
    if (vary) {
      if (!vary.includes("Origin")) {
        response.headers["vary"] = `${vary}, Origin`;
      }
    } else {
      response.headers["vary"] = "Origin";
    }
  }

  /**
   * Get status text for status code
   */
  private getStatusText(code: number): string {
    const statusTexts: Record<number, string> = {
      200: "OK",
      204: "No Content",
    };
    return statusTexts[code] || "OK";
  }

  /**
   * Get configuration
   */
  getConfig(): Readonly<Required<CORSConfig>> {
    return { ...this.config };
  }

  /**
   * Get allowed origins
   */
  getAllowedOrigins(): string | RegExp | string[] | ((origin: string) => boolean) {
    return this.config.origin;
  }
}
