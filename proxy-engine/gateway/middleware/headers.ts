/**
 * Header Transformation Middleware
 *
 * Add, remove, or modify headers on requests and responses
 */

import type {
  MiddlewareResult,
  RequestContext,
  RequestMiddleware,
  ResponseMiddleware,
} from "./types.ts";
import type { HTTPRequest, HTTPResponse } from "../../core/network/transport/http/http.ts";

/**
 * Header operation type
 */
export type HeaderOperation = "set" | "append" | "remove";

/**
 * Header rule
 */
export interface HeaderRule {
  /**
   * Header name
   */
  name: string;

  /**
   * Operation to perform
   */
  operation: HeaderOperation;

  /**
   * Value for set/append operations
   * Can be a static string or a function that generates value
   */
  value?: string | ((request: HTTPRequest, context: RequestContext) => string);

  /**
   * Condition for applying rule
   */
  condition?: (request: HTTPRequest, context: RequestContext) => boolean;
}

/**
 * Header transformation configuration
 */
export interface HeaderTransformConfig {
  /**
   * Rules to apply to request headers
   */
  requestRules?: HeaderRule[];

  /**
   * Rules to apply to response headers
   */
  responseRules?: HeaderRule[];

  /**
   * Add security headers to responses
   */
  securityHeaders?: boolean;

  /**
   * Remove proxy headers from responses
   */
  removeProxyHeaders?: boolean;
}

/**
 * Request header transformation middleware
 */
export class RequestHeaderMiddleware implements RequestMiddleware {
  readonly name = "request_headers";

  constructor(private rules: HeaderRule[]) {}

  async processRequest(
    request: HTTPRequest,
    context: RequestContext,
  ): Promise<MiddlewareResult> {
    for (const rule of this.rules) {
      // Check condition
      if (rule.condition && !rule.condition(request, context)) {
        continue;
      }

      // Apply operation
      this.applyRule(request.headers, rule, request, context);
    }

    return { type: "continue" };
  }

  /**
   * Apply header rule
   */
  private applyRule(
    headers: Record<string, string>,
    rule: HeaderRule,
    request: HTTPRequest,
    context: RequestContext,
  ): void {
    const headerName = rule.name.toLowerCase();

    switch (rule.operation) {
      case "set": {
        const value = this.getValue(rule.value, request, context);
        if (value) {
          headers[headerName] = value;
        }
        break;
      }

      case "append": {
        const value = this.getValue(rule.value, request, context);
        if (value) {
          const existing = headers[headerName];
          headers[headerName] = existing ? `${existing}, ${value}` : value;
        }
        break;
      }

      case "remove":
        delete headers[headerName];
        break;
    }
  }

  /**
   * Get value from rule
   */
  private getValue(
    value: string | ((request: HTTPRequest, context: RequestContext) => string) | undefined,
    request: HTTPRequest,
    context: RequestContext,
  ): string | undefined {
    if (typeof value === "function") {
      return value(request, context);
    }
    return value;
  }

  /**
   * Get header rules
   */
  getRules(): HeaderRule[] {
    return [...this.rules];
  }
}

/**
 * Response header transformation middleware
 */
export class ResponseHeaderMiddleware implements ResponseMiddleware {
  readonly name = "response_headers";

  constructor(
    private rules: HeaderRule[],
    private config: {
      securityHeaders?: boolean;
      removeProxyHeaders?: boolean;
    } = {},
  ) {}

  async processResponse(
    request: HTTPRequest,
    response: HTTPResponse,
    context: RequestContext,
  ): Promise<HTTPResponse> {
    // Apply custom rules
    for (const rule of this.rules) {
      // Check condition
      if (rule.condition && !rule.condition(request, context)) {
        continue;
      }

      // Apply operation
      this.applyRule(response.headers, rule, request, context);
    }

    // Add security headers
    if (this.config.securityHeaders) {
      this.addSecurityHeaders(response.headers);
    }

    // Remove proxy headers
    if (this.config.removeProxyHeaders) {
      this.removeProxyHeaders(response.headers);
    }

    return response;
  }

  /**
   * Apply header rule
   */
  private applyRule(
    headers: Record<string, string>,
    rule: HeaderRule,
    request: HTTPRequest,
    context: RequestContext,
  ): void {
    const headerName = rule.name.toLowerCase();

    switch (rule.operation) {
      case "set": {
        const value = this.getValue(rule.value, request, context);
        if (value) {
          headers[headerName] = value;
        }
        break;
      }

      case "append": {
        const value = this.getValue(rule.value, request, context);
        if (value) {
          const existing = headers[headerName];
          headers[headerName] = existing ? `${existing}, ${value}` : value;
        }
        break;
      }

      case "remove":
        delete headers[headerName];
        break;
    }
  }

  /**
   * Get value from rule
   */
  private getValue(
    value: string | ((request: HTTPRequest, context: RequestContext) => string) | undefined,
    request: HTTPRequest,
    context: RequestContext,
  ): string | undefined {
    if (typeof value === "function") {
      return value(request, context);
    }
    return value;
  }

  /**
   * Add security headers
   */
  private addSecurityHeaders(headers: Record<string, string>): void {
    // X-Content-Type-Options
    if (!headers["x-content-type-options"]) {
      headers["x-content-type-options"] = "nosniff";
    }

    // X-Frame-Options
    if (!headers["x-frame-options"]) {
      headers["x-frame-options"] = "DENY";
    }

    // X-XSS-Protection
    if (!headers["x-xss-protection"]) {
      headers["x-xss-protection"] = "1; mode=block";
    }

    // Strict-Transport-Security (only for HTTPS)
    if (!headers["strict-transport-security"]) {
      headers["strict-transport-security"] = "max-age=31536000; includeSubDomains";
    }

    // Referrer-Policy
    if (!headers["referrer-policy"]) {
      headers["referrer-policy"] = "strict-origin-when-cross-origin";
    }

    // Permissions-Policy
    if (!headers["permissions-policy"]) {
      headers["permissions-policy"] = "geolocation=(), microphone=(), camera=()";
    }
  }

  /**
   * Remove proxy-specific headers
   */
  private removeProxyHeaders(headers: Record<string, string>): void {
    const proxyHeaders = [
      "proxy-connection",
      "proxy-authenticate",
      "proxy-authorization",
      "via",
      "x-forwarded-for",
      "x-forwarded-host",
      "x-forwarded-port",
      "x-forwarded-proto",
      "forwarded",
    ];

    for (const header of proxyHeaders) {
      delete headers[header];
    }
  }

  /**
   * Get header rules
   */
  getRules(): HeaderRule[] {
    return [...this.rules];
  }

  /**
   * Get configuration
   */
  getConfig() {
    return { ...this.config };
  }
}

/**
 * Combined header transformation middleware
 */
export class HeaderTransformMiddleware implements RequestMiddleware, ResponseMiddleware {
  readonly name = "header_transform";

  private requestMiddleware: RequestHeaderMiddleware;
  private responseMiddleware: ResponseHeaderMiddleware;

  constructor(config: HeaderTransformConfig) {
    this.requestMiddleware = new RequestHeaderMiddleware(config.requestRules || []);
    this.responseMiddleware = new ResponseHeaderMiddleware(
      config.responseRules || [],
      {
        securityHeaders: config.securityHeaders,
        removeProxyHeaders: config.removeProxyHeaders,
      },
    );
  }

  async processRequest(
    request: HTTPRequest,
    context: RequestContext,
  ): Promise<MiddlewareResult> {
    return await this.requestMiddleware.processRequest(request, context);
  }

  async processResponse(
    request: HTTPRequest,
    response: HTTPResponse,
    context: RequestContext,
  ): Promise<HTTPResponse> {
    return await this.responseMiddleware.processResponse(request, response, context);
  }

  /**
   * Get request middleware
   */
  getRequestMiddleware(): RequestHeaderMiddleware {
    return this.requestMiddleware;
  }

  /**
   * Get response middleware
   */
  getResponseMiddleware(): ResponseHeaderMiddleware {
    return this.responseMiddleware;
  }
}
