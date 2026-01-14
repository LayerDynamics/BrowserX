/**
 * Weighted Round-Robin Load Balancer
 *
 * Distributes requests based on server weights.
 * Servers with higher weights receive proportionally more requests.
 */

import { BaseLoadBalancer } from "./types.ts";
import type { IncomingRequest, UpstreamServer } from "../request_router.ts";

/**
 * Weighted round-robin load balancer implementation
 */
export class WeightedRoundRobinLoadBalancer extends BaseLoadBalancer {
  private currentWeight = 0;
  private currentIndex = 0;

  select(_req: IncomingRequest, servers: UpstreamServer[]): UpstreamServer | null {
    const enabled = this.getEnabledServers(servers);

    if (enabled.length === 0) {
      return null;
    }

    // Calculate max weight and greatest common divisor
    const maxWeight = Math.max(...enabled.map((s) => s.weight));
    const gcd = this.calculateGCD(enabled.map((s) => s.weight));

    // Find next server based on weights
    while (true) {
      this.currentIndex = (this.currentIndex + 1) % enabled.length;

      if (this.currentIndex === 0) {
        this.currentWeight = this.currentWeight - gcd;
        if (this.currentWeight <= 0) {
          this.currentWeight = maxWeight;
        }
      }

      const server = enabled[this.currentIndex];
      if (server.weight >= this.currentWeight) {
        const stats = this.getOrCreateStats(server.id);
        stats.lastUsedAt = Date.now();
        return server;
      }
    }
  }

  /**
   * Get current weight in weighted round-robin rotation
   */
  getCurrentWeight(): number {
    return this.currentWeight;
  }

  /**
   * Get current index in weighted round-robin rotation
   */
  getCurrentIndex(): number {
    return this.currentIndex;
  }

  override reset(): void {
    super.reset();
    this.currentWeight = 0;
    this.currentIndex = 0;
  }

  /**
   * Calculate greatest common divisor of an array of numbers
   */
  private calculateGCD(numbers: number[]): number {
    const gcd2 = (a: number, b: number): number => {
      return b === 0 ? a : gcd2(b, a % b);
    };

    return numbers.reduce((acc, num) => gcd2(acc, num));
  }
}
