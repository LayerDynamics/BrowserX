/**
 * Round-Robin Load Balancer
 *
 * Distributes requests evenly across all servers in sequential order
 */

import { BaseLoadBalancer } from "./types.ts";
import type { IncomingRequest, UpstreamServer } from "../request_router.ts";

/**
 * Round-robin load balancer implementation
 */
export class RoundRobinLoadBalancer extends BaseLoadBalancer {
  private currentIndex = 0;

  select(_req: IncomingRequest, servers: UpstreamServer[]): UpstreamServer | null {
    const enabled = this.getEnabledServers(servers);

    if (enabled.length === 0) {
      return null;
    }

    // Get next server in round-robin fashion
    const server = enabled[this.currentIndex % enabled.length];
    this.currentIndex = (this.currentIndex + 1) % enabled.length;

    // Update stats
    const stats = this.getOrCreateStats(server.id);
    stats.lastUsedAt = Date.now();

    return server;
  }

  /**
   * Get current index in round-robin rotation
   */
  getCurrentIndex(): number {
    return this.currentIndex;
  }

  override reset(): void {
    super.reset();
    this.currentIndex = 0;
  }
}
