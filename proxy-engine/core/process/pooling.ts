// pooling.ts - Process pool management

import { PIDRegistry } from "./pid.ts";

/**
 * Process pool for managing worker processes
 */
export class ProcessPool {
  private readonly registry: PIDRegistry;
  private readonly minProcesses: number;
  private readonly maxProcesses: number;
  private availableProcesses: number[];
  private busyProcesses: Set<number>;

  constructor(minProcesses: number = 2, maxProcesses: number = 10) {
    this.registry = new PIDRegistry();
    this.minProcesses = minProcesses;
    this.maxProcesses = maxProcesses;
    this.availableProcesses = [];
    this.busyProcesses = new Set();

    // Initialize minimum processes
    this.initializePool();
  }

  /**
   * Initialize the pool with minimum processes
   */
  private initializePool(): void {
    for (let i = 0; i < this.minProcesses; i++) {
      const pid = this.registry.allocate('worker-' + i);
      this.availableProcesses.push(pid);
    }
  }

  /**
   * Acquire a process from the pool
   */
  acquire(): number | null {
    // Try to get an available process
    const pid = this.availableProcesses.shift();
    
    if (pid !== undefined) {
      this.busyProcesses.add(pid);
      return pid;
    }

    // Try to create a new process if under max
    if (this.registry.size() < this.maxProcesses) {
      const newPid = this.registry.allocate('worker-' + this.registry.size());
      this.busyProcesses.add(newPid);
      return newPid;
    }

    return null;
  }

  /**
   * Release a process back to the pool
   */
  release(pid: number): void {
    if (this.busyProcesses.has(pid)) {
      this.busyProcesses.delete(pid);
      this.availableProcesses.push(pid);
    }
  }

  /**
   * Remove a process from the pool
   */
  remove(pid: number): boolean {
    this.busyProcesses.delete(pid);
    const index = this.availableProcesses.indexOf(pid);
    if (index !== -1) {
      this.availableProcesses.splice(index, 1);
    }
    return this.registry.unregister(pid);
  }

  /**
   * Get pool statistics
   */
  getStats() {
    return {
      total: this.registry.size(),
      available: this.availableProcesses.length,
      busy: this.busyProcesses.size,
      min: this.minProcesses,
      max: this.maxProcesses
    };
  }

  /**
   * Shutdown all processes
   */
  shutdown(): void {
    this.registry.clear();
    this.availableProcesses = [];
    this.busyProcesses.clear();
  }
}
