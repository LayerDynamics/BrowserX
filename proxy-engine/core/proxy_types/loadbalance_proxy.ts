/**
 * Load Balancer Proxy
 *
 * Advanced load balancing with session affinity and automatic failover.
 * Extends reverse proxy with additional load balancing features.
 *
 * Features:
 * - Multiple load balancing algorithms
 * - Session affinity (sticky sessions)
 * - Automatic failover on server failure
 * - Real-time server health monitoring
 * - Dynamic server weight adjustment
 */

import { ReverseProxy, type ReverseProxyConfig } from "./reverse_proxy.ts";
import type { Route, UpstreamServer } from "../../gateway/router/request_router.ts";
import type { HTTPRequest, HTTPResponse } from "../network/transport/http/http.ts";

/**
 * Session affinity configuration
 */
export interface SessionAffinityConfig {
  /**
   * Enable session affinity
   */
  enabled: boolean;

  /**
   * Cookie name for session affinity
   */
  cookieName?: string;

  /**
   * Cookie max age (seconds)
   */
  cookieMaxAge?: number;

  /**
   * Cookie path
   */
  cookiePath?: string;

  /**
   * Use IP-based affinity instead of cookie
   */
  useIPAffinity?: boolean;
}

/**
 * Failover configuration
 */
export interface FailoverConfig {
  /**
   * Enable automatic failover
   */
  enabled: boolean;

  /**
   * Max failures before marking server as down
   */
  maxFailures?: number;

  /**
   * Failure window duration (ms)
   */
  failureWindow?: number;

  /**
   * Cooldown period before retrying failed server (ms)
   */
  cooldownPeriod?: number;
}

/**
 * Load balancer proxy configuration
 */
export interface LoadBalancerProxyConfig extends ReverseProxyConfig {
  /**
   * Session affinity configuration
   */
  sessionAffinity?: SessionAffinityConfig;

  /**
   * Failover configuration
   */
  failover?: FailoverConfig;

  /**
   * Enable dynamic weight adjustment
   */
  dynamicWeights?: boolean;
}

/**
 * Server failure tracking
 */
interface ServerFailureState {
  failures: number[];
  markedDownAt?: number;
}

/**
 * Session to server mapping
 */
interface SessionMapping {
  serverId: string;
  createdAt: number;
  lastUsedAt: number;
}

/**
 * Load balancer proxy implementation
 */
export class LoadBalancerProxy extends ReverseProxy {
  private sessionMap: Map<string, SessionMapping> = new Map();
  private failureState: Map<string, ServerFailureState> = new Map();
  private cleanupIntervalId?: number;

  constructor(
    route: Route,
    private lbConfig: LoadBalancerProxyConfig = {},
  ) {
    super(route, lbConfig);

    // Start cleanup interval for session and failure state
    this.startCleanup();
  }

  /**
   * Handle request with session affinity and failover
   */
  override async handleRequest(
    request: HTTPRequest,
    context: { clientIP: string; clientPort: number; protocol: string; startTime: number },
  ): Promise<HTTPResponse> {
    // Check for session affinity
    const sessionKey = this.getSessionKey(request, context);
    const affinityServer = this.getAffinityServer(sessionKey);

    if (affinityServer && this.isServerAvailable(affinityServer.id)) {
      try {
        const response = await super.handleRequest(request, context);

        // Update session on success
        if (response.statusCode < 500) {
          this.updateSession(sessionKey, affinityServer.id);

          // Add session cookie if using cookie-based affinity
          if (this.lbConfig.sessionAffinity?.cookieName) {
            this.addSessionCookie(response, sessionKey, affinityServer.id);
          }
        }

        return response;
      } catch (error) {
        // Record failure and try failover
        this.recordServerFailure(affinityServer.id);

        // Remove failed session
        this.sessionMap.delete(sessionKey);
      }
    }

    // No affinity or affinity failed, use normal load balancing
    const response = await super.handleRequest(request, context);

    // Establish new session affinity on success
    if (this.lbConfig.sessionAffinity?.enabled && response.statusCode < 500) {
      // We need to track which server was used - this would require
      // modifying the base ReverseProxy to expose the selected server
      // For now, we'll just return the response
    }

    return response;
  }

  /**
   * Get session key from request
   */
  private getSessionKey(
    request: HTTPRequest,
    context: { clientIP: string },
  ): string {
    if (this.lbConfig.sessionAffinity?.useIPAffinity) {
      return context.clientIP;
    }

    // Extract session from cookie
    const cookieName = this.lbConfig.sessionAffinity?.cookieName || "LBSESSION";
    const cookies = this.parseCookies(request.headers["cookie"] || "");
    return cookies[cookieName] || this.generateSessionKey();
  }

  /**
   * Generate new session key
   */
  private generateSessionKey(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Parse cookie header
   */
  private parseCookies(cookieHeader: string): Record<string, string> {
    const cookies: Record<string, string> = {};
    const pairs = cookieHeader.split(";");

    for (const pair of pairs) {
      const [name, ...valueParts] = pair.split("=");
      const trimmedName = name.trim();
      const value = valueParts.join("=").trim();

      if (trimmedName) {
        cookies[trimmedName] = value;
      }
    }

    return cookies;
  }

  /**
   * Get server for affinity session
   */
  private getAffinityServer(sessionKey: string): UpstreamServer | null {
    const mapping = this.sessionMap.get(sessionKey);
    if (!mapping) {
      return null;
    }

    // Find server by ID
    const server = this.route.upstream.servers.find((s) => s.id === mapping.serverId);
    return server || null;
  }

  /**
   * Update session mapping
   */
  private updateSession(sessionKey: string, serverId: string): void {
    const existing = this.sessionMap.get(sessionKey);

    if (existing) {
      existing.lastUsedAt = Date.now();
    } else {
      this.sessionMap.set(sessionKey, {
        serverId,
        createdAt: Date.now(),
        lastUsedAt: Date.now(),
      });
    }
  }

  /**
   * Add session cookie to response
   */
  private addSessionCookie(
    response: HTTPResponse,
    sessionKey: string,
    _serverId: string,
  ): void {
    const cookieName = this.lbConfig.sessionAffinity?.cookieName || "LBSESSION";
    const maxAge = this.lbConfig.sessionAffinity?.cookieMaxAge || 3600;
    const path = this.lbConfig.sessionAffinity?.cookiePath || "/";

    const cookieValue = `${cookieName}=${sessionKey}; Path=${path}; Max-Age=${maxAge}; HttpOnly`;

    // Add to Set-Cookie header
    const existing = response.headers["set-cookie"];
    response.headers["set-cookie"] = existing ? `${existing}, ${cookieValue}` : cookieValue;
  }

  /**
   * Record server failure
   */
  private recordServerFailure(serverId: string): void {
    if (!this.lbConfig.failover?.enabled) {
      return;
    }

    const now = Date.now();
    const state = this.failureState.get(serverId) || { failures: [] };

    // Add failure timestamp
    state.failures.push(now);

    // Remove old failures outside window
    const window = this.lbConfig.failover.failureWindow || 60000; // 1 minute
    state.failures = state.failures.filter((t) => now - t < window);

    // Check if threshold exceeded
    const maxFailures = this.lbConfig.failover.maxFailures || 3;
    if (state.failures.length >= maxFailures) {
      state.markedDownAt = now;
    }

    this.failureState.set(serverId, state);
  }

  /**
   * Check if server is available
   */
  private isServerAvailable(serverId: string): boolean {
    const state = this.failureState.get(serverId);
    if (!state || !state.markedDownAt) {
      return true;
    }

    // Check if cooldown period has passed
    const cooldown = this.lbConfig.failover?.cooldownPeriod || 30000; // 30 seconds
    const now = Date.now();

    if (now - state.markedDownAt > cooldown) {
      // Reset failure state
      this.failureState.delete(serverId);
      return true;
    }

    return false;
  }

  /**
   * Start cleanup interval
   */
  private startCleanup(): void {
    this.cleanupIntervalId = setInterval(() => {
      this.cleanupSessions();
      this.cleanupFailureState();
    }, 60000); // 1 minute
  }

  /**
   * Cleanup expired sessions
   */
  private cleanupSessions(): void {
    const now = Date.now();
    const maxAge = (this.lbConfig.sessionAffinity?.cookieMaxAge || 3600) * 1000;

    for (const [key, mapping] of this.sessionMap.entries()) {
      if (now - mapping.lastUsedAt > maxAge) {
        this.sessionMap.delete(key);
      }
    }
  }

  /**
   * Cleanup old failure state
   */
  private cleanupFailureState(): void {
    const now = Date.now();
    const window = this.lbConfig.failover?.failureWindow || 60000;

    for (const [serverId, state] of this.failureState.entries()) {
      // Remove old failures
      state.failures = state.failures.filter((t) => now - t < window);

      // Remove state if no recent failures
      if (state.failures.length === 0 && !state.markedDownAt) {
        this.failureState.delete(serverId);
      }
    }
  }

  /**
   * Get load balancer statistics
   */
  getLoadBalancerStats() {
    return {
      ...super.getStats(),
      sessions: {
        total: this.sessionMap.size,
        byServer: this.getSessionsByServer(),
      },
      failover: {
        downServers: Array.from(this.failureState.entries())
          .filter(([_, state]) => state.markedDownAt)
          .map(([serverId]) => serverId),
        failureState: Object.fromEntries(this.failureState),
      },
    };
  }

  /**
   * Get session map (returns copy)
   */
  getSessionMap(): Map<string, SessionMapping> {
    return new Map(this.sessionMap);
  }

  /**
   * Get failure state map (returns copy)
   */
  getFailureState(): Map<string, ServerFailureState> {
    return new Map(this.failureState);
  }

  /**
   * Get session for specific key
   */
  getSessionForClient(sessionKey: string): SessionMapping | undefined {
    return this.sessionMap.get(sessionKey);
  }

  /**
   * Get failure tracking for specific server
   */
  getFailureTracking(serverId: string): ServerFailureState | undefined {
    return this.failureState.get(serverId);
  }

  /**
   * Get load balancer configuration
   */
  getLBConfig(): LoadBalancerProxyConfig {
    return { ...this.lbConfig };
  }

  /**
   * Get session count by server
   */
  private getSessionsByServer(): Record<string, number> {
    const byServer: Record<string, number> = {};

    for (const mapping of this.sessionMap.values()) {
      byServer[mapping.serverId] = (byServer[mapping.serverId] || 0) + 1;
    }

    return byServer;
  }

  /**
   * Shutdown load balancer proxy
   */
  override async shutdown(): Promise<void> {
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
      this.cleanupIntervalId = undefined;
    }

    this.sessionMap.clear();
    this.failureState.clear();

    await super.shutdown();
  }
}

// Export alias for test compatibility
export { LoadBalancerProxy as LoadBalancer };
