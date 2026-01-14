/**
 * Middleware Types
 *
 * Core types and interfaces for middleware system
 */

import type { HTTPRequest, HTTPResponse } from "../../core/network/transport/http/http.ts";

/**
 * Request context passed through middleware chain
 */
export interface RequestContext {
  /**
   * Client IP address
   */
  clientIP: string;

  /**
   * Client port
   */
  clientPort: number;

  /**
   * Protocol (http, https)
   */
  protocol: string;

  /**
   * Request start time
   */
  startTime: number;

  /**
   * Request ID for tracing
   */
  requestId: string;

  /**
   * Custom metadata that middleware can attach
   */
  metadata: Record<string, unknown>;

  /**
   * Authenticated user (set by auth middleware)
   */
  user?: AuthenticatedUser;
}

/**
 * Authenticated user information
 */
export interface AuthenticatedUser {
  /**
   * User ID
   */
  id: string;

  /**
   * Username
   */
  username: string;

  /**
   * User roles
   */
  roles: string[];

  /**
   * Additional claims/attributes
   */
  attributes: Record<string, unknown>;
}

/**
 * Middleware execution result
 */
export type MiddlewareResult =
  | { type: "continue" }
  | { type: "respond"; response: HTTPResponse }
  | { type: "error"; error: Error };

/**
 * Request middleware processes incoming requests
 */
export interface RequestMiddleware {
  /**
   * Middleware name for identification
   */
  readonly name: string;

  /**
   * Process request
   * Returns:
   * - { type: "continue" } to continue to next middleware
   * - { type: "respond", response } to short-circuit and send response
   * - { type: "error", error } to trigger error handling
   */
  processRequest(
    request: HTTPRequest,
    context: RequestContext,
  ): Promise<MiddlewareResult>;
}

/**
 * Response middleware transforms outgoing responses
 */
export interface ResponseMiddleware {
  /**
   * Middleware name for identification
   */
  readonly name: string;

  /**
   * Process response
   * Returns modified response or original response
   */
  processResponse(
    request: HTTPRequest,
    response: HTTPResponse,
    context: RequestContext,
  ): Promise<HTTPResponse>;
}

/**
 * Middleware configuration
 */
export interface MiddlewareConfig {
  /**
   * Enable middleware
   */
  enabled: boolean;

  /**
   * Middleware priority (lower = earlier execution)
   */
  priority?: number;

  /**
   * Configuration options
   */
  options?: Record<string, unknown>;
}

/**
 * Middleware chain configuration
 */
export interface MiddlewareChainConfig {
  /**
   * Request middleware
   */
  request: Array<{
    middleware: RequestMiddleware;
    config: MiddlewareConfig;
  }>;

  /**
   * Response middleware
   */
  response: Array<{
    middleware: ResponseMiddleware;
    config: MiddlewareConfig;
  }>;
}
