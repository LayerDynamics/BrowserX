// process_manager.ts - High-level process management

import { ProcessPool } from "./pooling.ts";
import { PIDRegistry } from "./pid.ts";

/**
 * Process manager for coordinating process lifecycle
 */
export class ProcessManager {
  private pool: ProcessPool;
  private registry: PIDRegistry;

  constructor(minProcesses: number = 2, maxProcesses: number = 10) {
    this.pool = new ProcessPool(minProcesses, maxProcesses);
    this.registry = new PIDRegistry();
  }

  /**
   * Start a new process
   */
  async start(name: string): Promise<number> {
    const pid = this.pool.acquire();
    if (pid === null) {
      throw new Error('Process pool exhausted');
    }

    this.registry.register(pid, {
      name,
      startTime: Date.now(),
      status: 'running'
    });

    return pid;
  }

  /**
   * Stop a process
   */
  async stop(pid: number): Promise<void> {
    this.registry.updateStatus(pid, 'stopped');
    this.pool.release(pid);
  }

  /**
   * Kill a process
   */
  async kill(pid: number): Promise<void> {
    this.registry.unregister(pid);
    this.pool.remove(pid);
  }

  /**
   * Get process info
   */
  getInfo(pid: number) {
    return this.registry.get(pid);
  }

  /**
   * Get all processes
   */
  getAllProcesses() {
    return this.registry.getAll();
  }

  /**
   * Get pool statistics
   */
  getStats() {
    return {
      pool: this.pool.getStats(),
      processes: this.registry.size()
    };
  }

  /**
   * Get process pool
   */
  getPool(): ProcessPool {
    return this.pool;
  }

  /**
   * Get PID registry
   */
  getRegistry(): PIDRegistry {
    return this.registry;
  }

  /**
   * Shutdown all processes
   */
  async shutdown(): Promise<void> {
    this.pool.shutdown();
    this.registry.clear();
  }
}
