// thread_pool.ts - Thread pool for concurrent task execution

/**
 * Task to be executed
 */
export interface Task<T = unknown> {
  id: string;
  fn: () => Promise<T> | T;
  priority?: number;
}

/**
 * Thread pool for managing concurrent tasks
 */
export class ThreadPool {
  private readonly maxConcurrency: number;
  private activeTasks: number;
  private queue: Task[];
  private results: Map<string, unknown>;
  private errors: Map<string, Error>;
  private pendingPolls: Map<string, number>;
  private drainTimeoutId?: number;
  private drainResolve?: () => void;
  private stopped = false;

  constructor(maxConcurrency: number = 4) {
    this.maxConcurrency = maxConcurrency;
    this.activeTasks = 0;
    this.queue = [];
    this.results = new Map();
    this.errors = new Map();
    this.pendingPolls = new Map();
  }

  /**
   * Submit a task to the pool
   */
  async submit<T>(task: Task<T>): Promise<T> {
    // If we have capacity, run immediately
    if (this.activeTasks < this.maxConcurrency) {
      return this.executeTask(task);
    }

    // Otherwise, queue it
    this.queue.push(task);

    // Wait for task to be processed
    return new Promise((resolve, reject) => {
      const checkQueue = () => {
        // Check for successful result
        if (this.results.has(task.id)) {
          this.pendingPolls.delete(task.id);
          const result = this.results.get(task.id) as T;
          this.results.delete(task.id);
          resolve(result);
          return;
        }
        // Check for error
        if (this.errors.has(task.id)) {
          this.pendingPolls.delete(task.id);
          const error = this.errors.get(task.id)!;
          this.errors.delete(task.id);
          reject(error);
          return;
        }
        // Store timeout ID so it can be cancelled
        const timeoutId = setTimeout(checkQueue, 10) as unknown as number;
        this.pendingPolls.set(task.id, timeoutId);
      };
      checkQueue();
    });
  }

  /**
   * Execute a task
   */
  private async executeTask<T>(task: Task<T>): Promise<T> {
    this.activeTasks++;

    try {
      const result = await task.fn();
      this.results.set(task.id, result);
      return result;
    } catch (error) {
      // Store the error so the polling loop can find it
      this.errors.set(task.id, error instanceof Error ? error : new Error(String(error)));
      throw error;
    } finally {
      this.activeTasks--;
      this.processQueue();
    }
  }

  /**
   * Process queued tasks
   */
  private processQueue(): void {
    while (this.activeTasks < this.maxConcurrency && this.queue.length > 0) {
      // Get highest priority task
      this.queue.sort((a, b) => (b.priority || 0) - (a.priority || 0));
      const task = this.queue.shift();
      
      if (task) {
        this.executeTask(task).catch(err => {
          console.error('Task execution failed:', err);
        });
      }
    }
  }

  /**
   * Get pool statistics
   */
  getStats() {
    return {
      maxConcurrency: this.maxConcurrency,
      activeTasks: this.activeTasks,
      queuedTasks: this.queue.length,
      utilization: (this.activeTasks / this.maxConcurrency * 100).toFixed(2) + '%'
    };
  }

  /**
   * Wait for all tasks to complete
   */
  async drain(): Promise<void> {
    while (!this.stopped && (this.activeTasks > 0 || this.queue.length > 0)) {
      await new Promise<void>(resolve => {
        this.drainResolve = resolve;
        this.drainTimeoutId = setTimeout(() => {
          this.drainTimeoutId = undefined;
          this.drainResolve = undefined;
          resolve();
        }, 10) as unknown as number;
      });
    }
  }

  /**
   * Stop the pool and clear all pending operations
   */
  stop(): void {
    this.stopped = true;

    // Clear drain timeout
    if (this.drainTimeoutId !== undefined) {
      clearTimeout(this.drainTimeoutId);
      this.drainTimeoutId = undefined;
    }
    if (this.drainResolve) {
      this.drainResolve();
      this.drainResolve = undefined;
    }

    this.clear();
  }

  /**
   * Clear all queued tasks
   */
  clear(): void {
    this.queue = [];
    // Cancel all pending polling timeouts to prevent memory leak
    for (const timeoutId of this.pendingPolls.values()) {
      clearTimeout(timeoutId);
    }
    this.pendingPolls.clear();
    this.errors.clear();
    this.results.clear();

    // Clear drain timeout
    if (this.drainTimeoutId !== undefined) {
      clearTimeout(this.drainTimeoutId);
      this.drainTimeoutId = undefined;
    }
    if (this.drainResolve) {
      this.drainResolve();
      this.drainResolve = undefined;
    }
  }
}
