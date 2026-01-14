/**
 * Least Connections Load Balancer
 *
 * Routes requests to the server with the fewest active connections
 */

import { BaseLoadBalancer } from "./types.ts";
import type { IncomingRequest, UpstreamServer } from "../request_router.ts";

/**
 * Least connections load balancer implementation
 */
export class LeastConnectionsLoadBalancer extends BaseLoadBalancer {
  select(_req: IncomingRequest, servers: UpstreamServer[]): UpstreamServer | null {
    const enabled = this.getEnabledServers(servers);

    if (enabled.length === 0) {
      return null;
    }

    // Find server with least active connections
    let minConnections = Infinity;
    let selectedServer: UpstreamServer | null = null;

    for (const server of enabled) {
      const stats = this.getOrCreateStats(server.id);
      if (stats.activeConnections < minConnections) {
        minConnections = stats.activeConnections;
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
