/**
 * Route Matcher
 *
 * Matches incoming requests against route patterns
 */

import type { Route } from "./request_router.ts";

/**
 * Route match result
 */
export interface RouteMatch {
  /**
   * The matched route
   */
  route: Route;

  /**
   * Path parameters extracted from the URL
   */
  params: Record<string, string>;

  /**
   * Match score (higher = better match)
   */
  score: number;
}

/**
 * Route Matcher
 *
 * Matches HTTP requests against configured routes
 */
export class RouteMatcher {
  constructor(private routes: Route[]) {
    // Sort routes by priority (higher first)
    this.routes = [...routes].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  }

  /**
   * Match request against routes
   *
   * @param method - HTTP method
   * @param path - Request path
   * @param host - Request host
   * @param headers - Request headers
   * @returns Matched route or null
   */
  match(
    method: string,
    path: string,
    host?: string,
    headers?: Map<string, string>,
  ): RouteMatch | null {
    const upperMethod = method.toUpperCase() as import("../../core/network/primitive/header/request_line_parser.ts").HTTPMethod;

    for (const route of this.routes) {
      // Check if route is enabled
      if (!route.enabled) {
        continue;
      }

      // Check method
      if (route.methods && route.methods.length > 0 && !route.methods.includes(upperMethod)) {
        continue;
      }

      // Check host pattern
      if (route.hostPattern && host) {
        if (!this.matchHostPattern(host, route.hostPattern)) {
          continue;
        }
      }

      // Check path pattern
      const pathMatch = this.matchPathPattern(path, route.pattern);
      if (!pathMatch) {
        continue;
      }

      // Check header conditions
      if (route.headerConditions && headers) {
        if (!this.matchHeaderConditions(headers, route.headerConditions)) {
          continue;
        }
      }

      // Calculate match score
      const score = this.calculateMatchScore(route, pathMatch);

      return {
        route,
        params: pathMatch.params,
        score,
      };
    }

    return null;
  }

  /**
   * Match host pattern
   */
  private matchHostPattern(host: string, pattern: RegExp | string): boolean {
    if (pattern instanceof RegExp) {
      return pattern.test(host);
    }

    // String pattern with wildcards
    const regexPattern = pattern
      .replace(/\./g, "\\.")
      .replace(/\*/g, ".*");
    const regex = new RegExp(`^${regexPattern}$`, "i");
    return regex.test(host);
  }

  /**
   * Match path pattern
   */
  private matchPathPattern(
    path: string,
    pattern: RegExp | string,
  ): { params: Record<string, string> } | null {
    if (pattern instanceof RegExp) {
      const match = path.match(pattern);
      if (!match) return null;

      // Extract named groups as params
      const params: Record<string, string> = {};
      if (match.groups) {
        Object.assign(params, match.groups);
      }

      return { params };
    }

    // String pattern with parameter extraction
    const params: Record<string, string> = {};
    const patternParts = pattern.split("/");
    const pathParts = path.split("/");

    if (patternParts.length !== pathParts.length) {
      // Check for wildcard at end
      if (!pattern.endsWith("/*")) {
        return null;
      }
    }

    for (let i = 0; i < patternParts.length; i++) {
      const patternPart = patternParts[i];
      const pathPart = pathParts[i] || "";

      if (patternPart === "*") {
        // Wildcard matches anything
        continue;
      }

      if (patternPart.startsWith(":")) {
        // Parameter
        const paramName = patternPart.substring(1);
        params[paramName] = pathPart;
        continue;
      }

      if (patternPart !== pathPart) {
        return null;
      }
    }

    return { params };
  }

  /**
   * Match header conditions
   */
  private matchHeaderConditions(
    headers: Map<string, string>,
    conditions: Record<string, string | RegExp>,
  ): boolean {
    for (const [name, condition] of Object.entries(conditions)) {
      const headerValue = headers.get(name.toLowerCase());

      if (!headerValue) {
        return false;
      }

      if (condition instanceof RegExp) {
        if (!condition.test(headerValue)) {
          return false;
        }
      } else {
        if (headerValue !== condition) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Calculate match score
   *
   * Higher score = more specific match
   */
  private calculateMatchScore(
    route: Route,
    pathMatch: { params: Record<string, string> },
  ): number {
    let score = 0;

    // Priority contributes to score
    score += (route.priority ?? 0) * 1000;

    // Exact path matches score higher than patterns
    if (typeof route.pattern === "string" && !route.pattern.includes(":") && !route.pattern.includes("*")) {
      score += 100;
    }

    // Fewer parameters = more specific
    score += Math.max(0, 50 - Object.keys(pathMatch.params).length * 10);

    // Host pattern specificity
    if (route.hostPattern) {
      if (typeof route.hostPattern === "string" && !route.hostPattern.includes("*")) {
        score += 50;
      } else {
        score += 25;
      }
    }

    // Header conditions add specificity
    if (route.headerConditions) {
      score += Object.keys(route.headerConditions).length * 10;
    }

    // Method restrictions add specificity
    if (route.methods && route.methods.length > 0) {
      score += 5;
    }

    return score;
  }

  /**
   * Get all routes
   */
  getRoutes(): Route[] {
    return [...this.routes];
  }

  /**
   * Add route
   */
  addRoute(route: Route): void {
    this.routes.push(route);
    // Re-sort by priority
    this.routes.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  }

  /**
   * Remove route
   */
  removeRoute(route: Route): boolean {
    const index = this.routes.indexOf(route);
    if (index === -1) return false;

    this.routes.splice(index, 1);
    return true;
  }

  /**
   * Clear all routes
   */
  clearRoutes(): void {
    this.routes = [];
  }
}

/**
 * Create route matcher from routes
 */
export function createRouteMatcher(routes: Route[]): RouteMatcher {
  return new RouteMatcher(routes);
}

/**
 * Test if a path matches a pattern
 */
export function testPathPattern(path: string, pattern: RegExp | string): boolean {
  if (pattern instanceof RegExp) {
    return pattern.test(path);
  }

  const matcher = new RouteMatcher([{
    id: "test",
    pattern: pattern,
    methods: [],
    priority: 0,
    enabled: true,
    upstream: {
      servers: [],
      loadBalancingStrategy: "round-robin",
      timeout: 30000,
    },
  }]);

  const result = matcher.match("GET", path);
  return result !== null;
}

/**
 * Extract parameters from path
 */
export function extractPathParams(
  path: string,
  pattern: string,
): Record<string, string> | null {
  const matcher = new RouteMatcher([{
    id: "test",
    pattern: pattern,
    methods: [],
    priority: 0,
    enabled: true,
    upstream: {
      servers: [],
      loadBalancingStrategy: "round-robin",
      timeout: 30000,
    },
  }]);

  const result = matcher.match("GET", path);
  return result ? result.params : null;
}
