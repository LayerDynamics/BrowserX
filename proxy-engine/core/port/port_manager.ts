// port_manager.ts - Port allocation and management

/**
 * Port allocation state
 */
export interface PortState {
  port: number;
  inUse: boolean;
  bindAddress?: string;
  allocatedAt?: number;
  releasedAt?: number;
}

/**
 * Port manager for allocating and tracking ports
 */
export class PortManager {
  private ports: Map<number, PortState>;
  private readonly minPort: number;
  private readonly maxPort: number;

  constructor(minPort: number = 8000, maxPort: number = 9000) {
    this.ports = new Map();
    this.minPort = minPort;
    this.maxPort = maxPort;
  }

  /**
   * Allocate an available port
   */
  allocate(preferredPort?: number): number | null {
    if (preferredPort !== undefined) {
      if (this.isAvailable(preferredPort)) {
        this.markInUse(preferredPort);
        return preferredPort;
      }
      return null;
    }

    // Find first available port
    for (let port = this.minPort; port <= this.maxPort; port++) {
      if (this.isAvailable(port)) {
        this.markInUse(port);
        return port;
      }
    }

    return null;
  }

  /**
   * Release a port
   */
  release(port: number): void {
    const state = this.ports.get(port);
    if (state) {
      state.inUse = false;
      state.releasedAt = Date.now();
    }
  }

  /**
   * Check if a port is available
   */
  isAvailable(port: number): boolean {
    if (port < this.minPort || port > this.maxPort) {
      return false;
    }

    const state = this.ports.get(port);
    return !state || !state.inUse;
  }

  /**
   * Mark port as in use
   */
  private markInUse(port: number, bindAddress?: string): void {
    this.ports.set(port, {
      port,
      inUse: true,
      bindAddress,
      allocatedAt: Date.now()
    });
  }

  /**
   * Get all allocated ports
   */
  getAllocated(): number[] {
    return Array.from(this.ports.values())
      .filter(state => state.inUse)
      .map(state => state.port);
  }

  /**
   * Get port state
   */
  getState(port: number): PortState | null {
    return this.ports.get(port) ?? null;
  }

  /**
   * Get minimum port
   */
  getMinPort(): number {
    return this.minPort;
  }

  /**
   * Get maximum port
   */
  getMaxPort(): number {
    return this.maxPort;
  }

  /**
   * Get all ports and their states
   */
  getAllPorts(): Map<number, PortState> {
    return new Map(this.ports);
  }

  /**
   * Get allocation statistics
   */
  getStats() {
    const allocated = Array.from(this.ports.values()).filter(s => s.inUse).length;
    const totalPorts = this.maxPort - this.minPort + 1;

    return {
      totalPorts,
      allocatedPorts: allocated,
      availablePorts: totalPorts - allocated,
      minPort: this.minPort,
      maxPort: this.maxPort,
    };
  }

  /**
   * Clear all allocations
   */
  clear(): void {
    this.ports.clear();
  }
}
