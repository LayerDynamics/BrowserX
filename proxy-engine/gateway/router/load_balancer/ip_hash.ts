/**
 * IP Hash Load Balancer
 *
 * Routes requests from the same client IP to the same server (sticky sessions).
 * Provides session persistence without requiring shared session storage.
 */

import { BaseLoadBalancer } from "./types.ts";
import type { IncomingRequest, UpstreamServer } from "../request_router.ts";

/**
 * IP hash load balancer implementation
 */
export class IPHashLoadBalancer extends BaseLoadBalancer {
  select(req: IncomingRequest, servers: UpstreamServer[]): UpstreamServer | null {
    const enabled = this.getEnabledServers(servers);

    if (enabled.length === 0) {
      return null;
    }

    // Hash client IP to determine server
    const hash = this.hashIP(req.clientIP);
    const index = hash % enabled.length;
    const server = enabled[index];

    const stats = this.getOrCreateStats(server.id);
    stats.lastUsedAt = Date.now();

    return server;
  }

  /**
   * Hash IP address to a consistent number
   * Uses simple string hashing algorithm
   */
  private hashIP(ip: string): number {
    let hash = 0;

    for (let i = 0; i < ip.length; i++) {
      // Multiply by 31 (prime number) and add character code
      hash = ((hash << 5) - hash) + ip.charCodeAt(i);
      // Convert to 32-bit integer
      hash = hash & hash;
    }

    return Math.abs(hash);
  }
}
