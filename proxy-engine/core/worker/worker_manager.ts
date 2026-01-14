// worker_manager.ts - Worker lifecycle management

/**
 * Worker state
 */
export interface WorkerState {
  id: number;
  status: 'idle' | 'busy' | 'stopped';
  tasksCompleted: number;
  createdAt: number;
  lastActivityAt: number;
}

/**
 * Worker manager for managing worker lifecycles
 */
export class WorkerManager {
  private workers: Map<number, WorkerState>;
  private nextWorkerId: number;

  constructor() {
    this.workers = new Map();
    this.nextWorkerId = 1;
  }

  /**
   * Create a new worker
   */
  create(): number {
    const id = this.nextWorkerId++;
    this.workers.set(id, {
      id,
      status: 'idle',
      tasksCompleted: 0,
      createdAt: Date.now(),
      lastActivityAt: Date.now()
    });
    return id;
  }

  /**
   * Mark worker as busy
   */
  markBusy(id: number): void {
    const worker = this.workers.get(id);
    if (worker) {
      worker.status = 'busy';
      worker.lastActivityAt = Date.now();
    }
  }

  /**
   * Mark worker as idle
   */
  markIdle(id: number): void {
    const worker = this.workers.get(id);
    if (worker) {
      worker.status = 'idle';
      worker.tasksCompleted++;
      worker.lastActivityAt = Date.now();
    }
  }

  /**
   * Stop a worker
   */
  stop(id: number): boolean {
    const worker = this.workers.get(id);
    if (worker) {
      worker.status = 'stopped';
      return true;
    }
    return false;
  }

  /**
   * Remove a worker
   */
  remove(id: number): boolean {
    return this.workers.delete(id);
  }

  /**
   * Get worker state
   */
  getState(id: number): WorkerState | null {
    return this.workers.get(id) ?? null;
  }

  /**
   * Get all workers
   */
  getAll(): WorkerState[] {
    return Array.from(this.workers.values());
  }

  /**
   * Get idle workers
   */
  getIdle(): number[] {
    return Array.from(this.workers.values())
      .filter(w => w.status === 'idle')
      .map(w => w.id);
  }

  /**
   * Get busy workers
   */
  getBusy(): number[] {
    return Array.from(this.workers.values())
      .filter(w => w.status === 'busy')
      .map(w => w.id);
  }

  /**
   * Get statistics
   */
  getStats() {
    const workers = Array.from(this.workers.values());
    return {
      total: workers.length,
      idle: workers.filter(w => w.status === 'idle').length,
      busy: workers.filter(w => w.status === 'busy').length,
      stopped: workers.filter(w => w.status === 'stopped').length,
      totalTasksCompleted: workers.reduce((sum, w) => sum + w.tasksCompleted, 0)
    };
  }

  /**
   * Clear all workers
   */
  clear(): void {
    this.workers.clear();
  }
}
