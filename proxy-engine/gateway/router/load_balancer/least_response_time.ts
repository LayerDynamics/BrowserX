/**
 * Least Response Time Load Balancer
 *
 * Routes requests to the server with the lowest average response time.
 * Optimizes for performance by favoring faster servers.
 */

import { BaseLoadBalancer } from "./types.ts";
import type { IncomingRequest, UpstreamServer } from "../request_router.ts";

/**
 * Least response time load balancer implementation
 */
export class LeastResponseTimeLoadBalancer extends BaseLoadBalancer {
  select(_req: IncomingRequest, servers: UpstreamServer[]): UpstreamServer | null {
    const enabled = this.getEnabledServers(servers);

    if (enabled.length === 0) {
      return null;
    }

    // Find server with lowest average response time
    let minResponseTime = Infinity;
    let selectedServer: UpstreamServer | null = null;

    for (const server of enabled) {
      const stats = this.getOrCreateStats(server.id);

      // If no requests yet, consider it as having 0 response time (prioritize unused servers)
      const avgTime = stats.successfulRequests > 0 ? stats.averageResponseTime : 0;

      if (avgTime < minResponseTime) {
        minResponseTime = avgTime;
        selectedServer = server;
      }
    }

    if (selectedServer) {
      const stats = this.getOrCreateStats(selectedServer.id);
      stats.activeConnections++;
      stats.lastUsedAt = Date.now();
    }

    return selectedServer;
  }

  override recordSuccess(serverId: string, responseTime?: number): void {
    super.recordSuccess(serverId, responseTime);

    // Decrement active connections
    const stats = this.getOrCreateStats(serverId);
    stats.activeConnections = Math.max(0, stats.activeConnections - 1);
  }

  override recordFailure(serverId: string): void {
    super.recordFailure(serverId);

    // Decrement active connections
    const stats = this.getOrCreateStats(serverId);
    stats.activeConnections = Math.max(0, stats.activeConnections - 1);
  }
}
