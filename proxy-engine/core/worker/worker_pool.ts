// worker_pool.ts - Worker pool for task distribution

import { WorkerManager } from "./worker_manager.ts";

/**
 * Worker pool for distributing tasks across workers
 */
export class WorkerPool {
  private manager: WorkerManager;
  private readonly minWorkers: number;
  private readonly maxWorkers: number;

  constructor(minWorkers: number = 2, maxWorkers: number = 10) {
    this.manager = new WorkerManager();
    this.minWorkers = minWorkers;
    this.maxWorkers = maxWorkers;

    // Initialize minimum workers
    this.initializePool();
  }

  /**
   * Initialize pool with minimum workers
   */
  private initializePool(): void {
    for (let i = 0; i < this.minWorkers; i++) {
      this.manager.create();
    }
  }

  /**
   * Acquire a worker from the pool
   */
  acquire(): number | null {
    // Get idle workers
    const idle = this.manager.getIdle();
    
    if (idle.length > 0) {
      const workerId = idle[0];
      this.manager.markBusy(workerId);
      return workerId;
    }

    // Try to create a new worker if under max
    const stats = this.manager.getStats();
    if (stats.total < this.maxWorkers) {
      const workerId = this.manager.create();
      this.manager.markBusy(workerId);
      return workerId;
    }

    return null;
  }

  /**
   * Release a worker back to the pool
   */
  release(workerId: number): void {
    this.manager.markIdle(workerId);
  }

  /**
   * Remove a worker from the pool
   */
  remove(workerId: number): boolean {
    this.manager.stop(workerId);
    return this.manager.remove(workerId);
  }

  /**
   * Get pool statistics
   */
  getStats() {
    return {
      ...this.manager.getStats(),
      min: this.minWorkers,
      max: this.maxWorkers
    };
  }

  /**
   * Execute a task with a worker
   */
  async execute<T>(fn: () => Promise<T> | T): Promise<T> {
    const workerId = this.acquire();
    
    if (workerId === null) {
      throw new Error('Worker pool exhausted');
    }

    try {
      const result = await fn();
      return result;
    } finally {
      this.release(workerId);
    }
  }

  /**
   * Get minimum workers
   */
  getMinWorkers(): number {
    return this.minWorkers;
  }

  /**
   * Get maximum workers
   */
  getMaxWorkers(): number {
    return this.maxWorkers;
  }

  /**
   * Get worker manager
   */
  getManager(): WorkerManager {
    return this.manager;
  }

  /**
   * Shutdown all workers
   */
  shutdown(): void {
    this.manager.clear();
  }
}
