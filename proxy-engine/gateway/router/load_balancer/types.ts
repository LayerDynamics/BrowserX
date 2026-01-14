/**
 * Load Balancer Types
 *
 * Common types and interfaces for load balancing strategies
 */

import type { IncomingRequest, UpstreamServer } from "../request_router.ts";

/**
 * Server statistics for load balancing
 */
export interface LoadBalancerServerStats {
  serverId: string;
  activeConnections: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  lastUsedAt: number;
}

/**
 * Load balancer interface
 */
export interface LoadBalancer {
  /**
   * Select next upstream server for request
   */
  select(req: IncomingRequest, servers: UpstreamServer[]): UpstreamServer | null;

  /**
   * Select next upstream server (alternative signature for proxy types)
   */
  selectServer(
    servers: UpstreamServer[],
    request?: unknown,
    clientIP?: string,
  ): UpstreamServer | null;

  /**
   * Record successful connection
   */
  recordSuccess(serverId: string, responseTime?: number): void;

  /**
   * Record failed connection
   */
  recordFailure(serverId: string): void;

  /**
   * Get statistics for a server
   */
  getServerStats(serverId: string): LoadBalancerServerStats;

  /**
   * Get all server statistics
   */
  getAllStats(): Map<string, LoadBalancerServerStats>;

  /**
   * Reset statistics
   */
  reset(): void;
}

/**
 * Base load balancer with common stats tracking
 */
export abstract class BaseLoadBalancer implements LoadBalancer {
  protected stats: Map<string, LoadBalancerServerStats> = new Map();

  abstract select(req: IncomingRequest, servers: UpstreamServer[]): UpstreamServer | null;

  selectServer(
    servers: UpstreamServer[],
    request?: unknown,
    clientIP?: string,
  ): UpstreamServer | null {
    // Convert to IncomingRequest format for select() method
    const req: IncomingRequest = {
      method: "GET",
      url: new URL("http://localhost"),
      headers: {},
      body: new Uint8Array(),
      clientIP: clientIP || "unknown",
      metadata: {},
    };
    return this.select(req, servers);
  }

  recordSuccess(serverId: string, responseTime?: number): void {
    const stats = this.getOrCreateStats(serverId);
    stats.successfulRequests++;
    stats.totalRequests++;
    stats.lastUsedAt = Date.now();

    // Update average response time if provided
    if (responseTime !== undefined) {
      const totalTime = stats.averageResponseTime * (stats.successfulRequests - 1);
      stats.averageResponseTime = (totalTime + responseTime) / stats.successfulRequests;
    }
  }

  recordFailure(serverId: string): void {
    const stats = this.getOrCreateStats(serverId);
    stats.failedRequests++;
    stats.totalRequests++;
  }

  getServerStats(serverId: string): LoadBalancerServerStats {
    return this.getOrCreateStats(serverId);
  }

  getAllStats(): Map<string, LoadBalancerServerStats> {
    return new Map(this.stats);
  }

  reset(): void {
    this.stats.clear();
  }

  protected getOrCreateStats(serverId: string): LoadBalancerServerStats {
    let stats = this.stats.get(serverId);
    if (!stats) {
      stats = {
        serverId,
        activeConnections: 0,
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageResponseTime: 0,
        lastUsedAt: Date.now(),
      };
      this.stats.set(serverId, stats);
    }
    return stats;
  }

  /**
   * Filter to enabled servers only
   */
  protected getEnabledServers(servers: UpstreamServer[]): UpstreamServer[] {
    return servers.filter((s) => s.enabled);
  }
}
