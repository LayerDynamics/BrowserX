/**
 * Random Load Balancer
 *
 * Randomly selects a server for each request.
 * Simple strategy that provides good distribution over time.
 */

import { BaseLoadBalancer } from "./types.ts";
import type { IncomingRequest, UpstreamServer } from "../request_router.ts";

/**
 * Random load balancer implementation
 */
export class RandomLoadBalancer extends BaseLoadBalancer {
  select(_req: IncomingRequest, servers: UpstreamServer[]): UpstreamServer | null {
    const enabled = this.getEnabledServers(servers);

    if (enabled.length === 0) {
      return null;
    }

    // Select random server
    const randomIndex = Math.floor(Math.random() * enabled.length);
    const server = enabled[randomIndex];

    const stats = this.getOrCreateStats(server.id);
    stats.lastUsedAt = Date.now();

    return server;
  }
}
