/**
 * Port Binding Manager
 *
 * Manages the lifecycle of network port bindings
 */

import {
  type PortNumber,
  PortState,
  type PortBinding,
  type PortRange,
  isValidPort,
  findAvailablePort,
  findRandomPortInRange,
  formatAddress,
  PORT_RANGES,
} from "./port.ts";

/**
 * Port binding configuration
 */
export interface PortBindingConfig {
  reuseAddress?: boolean;
  reusePort?: boolean;
  backlog?: number;
  preferredRange?: PortRange;
}

/**
 * Port allocation strategy
 */
export enum AllocationStrategy {
  SEQUENTIAL = "sequential", // Try ports sequentially
  RANDOM = "random", // Try random ports in range
  PREFERRED = "preferred", // Use preferred port if available
}

/**
 * Port binding manager
 */
export class PortBindingManager {
  private bindings = new Map<string, PortBinding>();
  private reservations = new Set<string>();

  /**
   * Bind to a specific port
   */
  async bind(
    port: PortNumber,
    hostname = "127.0.0.1",
    config: PortBindingConfig = {},
  ): Promise<PortBinding> {
    if (!isValidPort(port)) {
      throw new Error(`Invalid port: ${port}`);
    }

    const key = this.getKey(hostname, port);

    // Check if already bound
    if (this.bindings.has(key)) {
      const existing = this.bindings.get(key)!;
      if (existing.state === PortState.BOUND || existing.state === PortState.LISTENING) {
        throw new Error(`Port ${port} on ${hostname} is already bound`);
      }
    }

    try {
      // Attempt to bind
      const listener = Deno.listen({
        port,
        hostname,
        reuseAddress: config.reuseAddress,
        reusePort: config.reusePort,
      });

      const binding: PortBinding = {
        port,
        host: hostname,
        state: PortState.BOUND,
        boundAt: new Date(),
        listener,
        metadata: {},
      };

      this.bindings.set(key, binding);
      this.reservations.delete(key);

      return binding;
    } catch (error) {
      const errorBinding: PortBinding = {
        port,
        host: hostname,
        state: PortState.ERROR,
        boundAt: new Date(),
        metadata: { error: String(error) },
      };

      this.bindings.set(key, errorBinding);
      throw error;
    }
  }

  /**
   * Bind to any available port in range
   */
  async bindAny(
    range: PortRange = PORT_RANGES.EPHEMERAL,
    hostname = "127.0.0.1",
    strategy: AllocationStrategy = AllocationStrategy.SEQUENTIAL,
    config: PortBindingConfig = {},
  ): Promise<PortBinding> {
    let port: PortNumber | null = null;

    if (strategy === AllocationStrategy.RANDOM) {
      port = await findRandomPortInRange(range, hostname);
    } else {
      port = await findAvailablePort(range.start, range.end, hostname);
    }

    if (port === null) {
      throw new Error(`No available ports in range ${range.start}-${range.end}`);
    }

    return await this.bind(port, hostname, config);
  }

  /**
   * Reserve a port without binding
   */
  reserve(port: PortNumber, hostname = "127.0.0.1"): void {
    if (!isValidPort(port)) {
      throw new Error(`Invalid port: ${port}`);
    }

    const key = this.getKey(hostname, port);

    if (this.bindings.has(key)) {
      throw new Error(`Port ${port} on ${hostname} is already in use`);
    }

    if (this.reservations.has(key)) {
      throw new Error(`Port ${port} on ${hostname} is already reserved`);
    }

    const binding: PortBinding = {
      port,
      host: hostname,
      state: PortState.RESERVED,
      boundAt: new Date(),
      metadata: {},
    };

    this.bindings.set(key, binding);
    this.reservations.add(key);
  }

  /**
   * Release a reservation
   */
  releaseReservation(port: PortNumber, hostname = "127.0.0.1"): void {
    const key = this.getKey(hostname, port);

    if (!this.reservations.has(key)) {
      throw new Error(`Port ${port} on ${hostname} is not reserved`);
    }

    this.reservations.delete(key);
    this.bindings.delete(key);
  }

  /**
   * Start listening on a bound port
   */
  listen(port: PortNumber, hostname = "127.0.0.1"): void {
    const key = this.getKey(hostname, port);
    const binding = this.bindings.get(key);

    if (!binding) {
      throw new Error(`No binding found for ${hostname}:${port}`);
    }

    if (!binding.listener) {
      throw new Error(`No listener available for ${hostname}:${port}`);
    }

    binding.state = PortState.LISTENING;
  }

  /**
   * Unbind and close a port
   */
  unbind(port: PortNumber, hostname = "127.0.0.1"): void {
    const key = this.getKey(hostname, port);
    const binding = this.bindings.get(key);

    if (!binding) {
      return; // Already unbound
    }

    // Close listener if exists
    if (binding.listener) {
      try {
        binding.listener.close();
      } catch (_error) {
        // Ignore close errors
      }
    }

    this.bindings.delete(key);
    this.reservations.delete(key);
  }

  /**
   * Unbind all ports
   */
  unbindAll(): void {
    for (const binding of this.bindings.values()) {
      if (binding.listener) {
        try {
          binding.listener.close();
        } catch (_error) {
          // Ignore close errors
        }
      }
    }

    this.bindings.clear();
    this.reservations.clear();
  }

  /**
   * Get binding info
   */
  getBinding(port: PortNumber, hostname = "127.0.0.1"): PortBinding | undefined {
    const key = this.getKey(hostname, port);
    return this.bindings.get(key);
  }

  /**
   * Check if port is bound
   */
  isBound(port: PortNumber, hostname = "127.0.0.1"): boolean {
    const key = this.getKey(hostname, port);
    const binding = this.bindings.get(key);
    return binding?.state === PortState.BOUND || binding?.state === PortState.LISTENING;
  }

  /**
   * Check if port is reserved
   */
  isReserved(port: PortNumber, hostname = "127.0.0.1"): boolean {
    const key = this.getKey(hostname, port);
    return this.reservations.has(key);
  }

  /**
   * Get all bindings
   */
  getAllBindings(): PortBinding[] {
    return Array.from(this.bindings.values());
  }

  /**
   * Get bindings by state
   */
  getBindingsByState(state: PortState): PortBinding[] {
    return Array.from(this.bindings.values()).filter((b) => b.state === state);
  }

  /**
   * Get bindings for a specific host
   */
  getBindingsByHost(hostname: string): PortBinding[] {
    return Array.from(this.bindings.values()).filter((b) => b.host === hostname);
  }

  /**
   * Get statistics
   */
  getStats() {
    const bindings = Array.from(this.bindings.values());

    return {
      total: bindings.length,
      bound: bindings.filter((b) => b.state === PortState.BOUND).length,
      listening: bindings.filter((b) => b.state === PortState.LISTENING).length,
      reserved: bindings.filter((b) => b.state === PortState.RESERVED).length,
      error: bindings.filter((b) => b.state === PortState.ERROR).length,
      reservations: this.reservations.size,
    };
  }

  /**
   * Get key for binding map
   */
  private getKey(hostname: string, port: PortNumber): string {
    return formatAddress(hostname, port);
  }

  /**
   * Clean up stale bindings
   */
  cleanup(maxAge: number = 3600000): void {
    const now = Date.now();

    for (const [key, binding] of this.bindings.entries()) {
      const age = now - binding.boundAt.getTime();

      // Clean up error states and old reservations
      if (
        (binding.state === PortState.ERROR && age > maxAge) ||
        (binding.state === PortState.RESERVED && age > maxAge)
      ) {
        if (binding.listener) {
          try {
            binding.listener.close();
          } catch (_error) {
            // Ignore
          }
        }
        this.bindings.delete(key);
        this.reservations.delete(key);
      }
    }
  }
}

/**
 * Global port binding manager instance
 */
export const globalPortManager = new PortBindingManager();
