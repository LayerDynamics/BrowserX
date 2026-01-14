/**
 * Request Router
 *
 * Pattern-based request routing with support for:
 * - String patterns with parameters (e.g., /users/:id)
 * - RegExp patterns
 * - Priority-based route ordering
 * - Method filtering
 * - Host pattern matching
 */

import type { HTTPMethod } from "../../core/network/primitive/header/request_line_parser.ts";
import type { RouteMatch } from "./route_matcher.ts";

// Re-export RouteMatch for external use
export type { RouteMatch };

/**
 * Route definition
 */
export interface Route {
  /**
   * Unique route identifier
   */
  id: string;

  /**
   * URL pattern to match (string with :params or RegExp)
   */
  pattern: string | RegExp;

  /**
   * HTTP methods to match
   */
  methods: HTTPMethod[];

  /**
   * Host pattern (optional, e.g., "*.example.com")
   */
  hostPattern?: string | RegExp;

  /**
   * Header conditions for matching (optional)
   */
  headerConditions?: Record<string, string | RegExp>;

  /**
   * Route priority (higher = matched first)
   */
  priority: number;

  /**
   * Route enabled state
   */
  enabled: boolean;

  /**
   * Upstream configuration
   */
  upstream: UpstreamConfig;

  /**
   * Route metadata
   */
  metadata?: Record<string, unknown>;
}

/**
 * Upstream configuration
 */
export interface UpstreamConfig {
  /**
   * Upstream servers
   */
  servers: UpstreamServer[];

  /**
   * Load balancing strategy
   */
  loadBalancingStrategy: LoadBalancingStrategy;

  /**
   * Health check configuration
   */
  healthCheck?: HealthCheckConfig;

  /**
   * Retry policy
   */
  retryPolicy?: RetryPolicy;

  /**
   * Request timeout
   */
  timeout: number;

  /**
   * Max connections per server
   */
  maxConnections?: number;

  /**
   * Session affinity configuration
   */
  sessionAffinity?: unknown;

  /**
   * Failover configuration
   */
  failover?: unknown;
}

/**
 * Upstream server definition
 */
export interface UpstreamServer {
  id: string;
  host: string;
  port: number;
  protocol?: "http" | "https";
  weight: number;
  enabled: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * Load balancing strategy
 */
export type LoadBalancingStrategy =
  | "round-robin"
  | "least-connections"
  | "weighted-round-robin"
  | "ip-hash"
  | "least-response-time"
  | "random";

/**
 * Health check configuration
 */
export interface HealthCheckConfig {
  type: "tcp" | "http" | "ping";
  interval: number;
  timeout: number;
  unhealthyThreshold: number;
  healthyThreshold: number;
  httpPath?: string;
}

/**
 * Retry policy
 */
export interface RetryPolicy {
  maxRetries: number;
  retryDelay: number;
  retryOn: ("error" | "timeout" | "5xx")[];
}

/**
 * Route match result
 */

/**
 * Incoming request (simplified)
 */
export interface IncomingRequest {
  method: HTTPMethod;
  url: URL;
  headers: Record<string, string>;
  body?: Uint8Array;
  clientIP: string;
  metadata: Record<string, unknown>;
}

/**
 * Router interface
 */
export interface Router {
  /**
   * Add a route to the router
   */
  addRoute(route: Route): void;

  /**
   * Remove a route by ID
   */
  removeRoute(routeId: string): boolean;

  /**
   * Find matching route for request
   */
  match(req: IncomingRequest): RouteMatch | null;

  /**
   * Get all routes
   */
  getRoutes(): Route[];

  /**
   * Update route configuration
   */
  updateRoute(routeId: string, updates: Partial<Route>): boolean;

  /**
   * Clear all routes
   */
  clear(): void;
}

/**
 * Pattern-based router implementation
 */
export class PatternRouter implements Router {
  private routes: Route[] = [];

  addRoute(route: Route): void {
    // Insert in priority order (highest priority first)
    const index = this.routes.findIndex((r) => r.priority < route.priority);
    if (index === -1) {
      this.routes.push(route);
    } else {
      this.routes.splice(index, 0, route);
    }
  }

  removeRoute(routeId: string): boolean {
    const index = this.routes.findIndex((r) => r.id === routeId);
    if (index !== -1) {
      this.routes.splice(index, 1);
      return true;
    }
    return false;
  }

  match(req: IncomingRequest): RouteMatch | null {
    for (const route of this.routes) {
      if (!route.enabled) {
        continue;
      }

      // Check method
      if (!route.methods.includes(req.method)) {
        continue;
      }

      // Check host pattern if specified
      if (route.hostPattern) {
        const host = req.headers["host"] || req.url.hostname;
        if (!this.matchHost(route.hostPattern, host)) {
          continue;
        }
      }

      // Check path pattern
      const matchResult = this.matchPattern(route.pattern, req.url.pathname);
      if (matchResult) {
        return {
          route,
          params: matchResult.params,
          score: route.priority,
        };
      }
    }

    return null;
  }

  getRoutes(): Route[] {
    return [...this.routes];
  }

  updateRoute(routeId: string, updates: Partial<Route>): boolean {
    const route = this.routes.find((r) => r.id === routeId);
    if (route) {
      Object.assign(route, updates);

      // Re-sort if priority changed
      if (updates.priority !== undefined) {
        this.routes.sort((a, b) => b.priority - a.priority);
      }

      return true;
    }
    return false;
  }

  clear(): void {
    this.routes = [];
  }

  /**
   * Match URL pattern
   */
  private matchPattern(
    pattern: string | RegExp,
    path: string,
  ): { params: Record<string, string> } | null {
    if (typeof pattern === "string") {
      return this.matchStringPattern(pattern, path);
    } else {
      return this.matchRegExpPattern(pattern, path);
    }
  }

  /**
   * Match string pattern with :param syntax
   * Examples:
   *   /users/:id -> matches /users/123 with params { id: "123" }
   *   /posts/:postId/comments/:id -> matches /posts/5/comments/10
   */
  private matchStringPattern(
    pattern: string,
    path: string,
  ): { params: Record<string, string> } | null {
    const params: Record<string, string> = {};

    // Convert pattern to regex with named groups
    // /users/:id -> /users/(?<id>[^/]+)
    const regexStr = pattern.replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, (_, name) => {
      return `(?<${name}>[^/]+)`;
    });

    const regex = new RegExp(`^${regexStr}$`);
    const match = path.match(regex);

    if (!match) {
      return null;
    }

    if (match.groups) {
      Object.assign(params, match.groups);
    }

    return { params };
  }

  /**
   * Match RegExp pattern
   */
  private matchRegExpPattern(
    pattern: RegExp,
    path: string,
  ): { params: Record<string, string> } | null {
    const match = path.match(pattern);

    if (!match) {
      return null;
    }

    const params: Record<string, string> = {};
    if (match.groups) {
      Object.assign(params, match.groups);
    }

    return { params };
  }

  /**
   * Match host pattern
   * Supports wildcards: *.example.com
   */
  private matchHost(pattern: string | RegExp, host: string): boolean {
    if (typeof pattern === "string") {
      // Remove port if present
      const hostWithoutPort = host.split(":")[0];

      // Convert wildcard pattern to regex
      const regexStr = pattern
        .replace(/\./g, "\\.")
        .replace(/\*/g, ".*");

      const regex = new RegExp(`^${regexStr}$`, "i");
      return regex.test(hostWithoutPort);
    } else {
      return pattern.test(host);
    }
  }
}

/**
 * Create a route with defaults
 */
export function createRoute(options: {
  id: string;
  pattern: string | RegExp;
  methods?: HTTPMethod[];
  upstream: UpstreamConfig;
  priority?: number;
  enabled?: boolean;
  hostPattern?: string | RegExp;
  metadata?: Record<string, unknown>;
}): Route {
  return {
    id: options.id,
    pattern: options.pattern,
    methods: options.methods || ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"],
    upstream: options.upstream,
    priority: options.priority || 0,
    enabled: options.enabled !== false,
    hostPattern: options.hostPattern,
    metadata: options.metadata,
  };
}

// Export alias for test compatibility
export { PatternRouter as RequestRouter };
