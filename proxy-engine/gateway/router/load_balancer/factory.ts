/**
 * Load Balancer Factory
 *
 * Creates load balancer instances based on strategy type
 */

import type { LoadBalancer } from "./types.ts";
import type { LoadBalancingStrategy } from "../request_router.ts";
import { RoundRobinLoadBalancer } from "./round_robin.ts";
import { LeastConnectionsLoadBalancer } from "./least_connections.ts";
import { WeightedRoundRobinLoadBalancer } from "./weighted_round_robin.ts";
import { IPHashLoadBalancer } from "./ip_hash.ts";
import { LeastResponseTimeLoadBalancer } from "./least_response_time.ts";
import { RandomLoadBalancer } from "./random.ts";

/**
 * Create a load balancer instance based on strategy type
 */
export function createLoadBalancer(strategy: LoadBalancingStrategy): LoadBalancer {
  switch (strategy) {
    case "round-robin":
      return new RoundRobinLoadBalancer();

    case "least-connections":
      return new LeastConnectionsLoadBalancer();

    case "weighted-round-robin":
      return new WeightedRoundRobinLoadBalancer();

    case "ip-hash":
      return new IPHashLoadBalancer();

    case "least-response-time":
      return new LeastResponseTimeLoadBalancer();

    case "random":
      return new RandomLoadBalancer();

    default:
      throw new Error(`Unknown load balancing strategy: ${strategy}`);
  }
}
