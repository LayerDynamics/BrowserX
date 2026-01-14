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

  constructor(maxConcurrency: number = 4) {
    this.maxConcurrency = maxConcurrency;
    this.activeTasks = 0;
    this.queue = [];
    this.results = new Map();
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
        if (this.results.has(task.id)) {
          const result = this.results.get(task.id) as T;
          this.results.delete(task.id);
          resolve(result);
        } else {
          setTimeout(checkQueue, 10);
        }
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
    while (this.activeTasks > 0 || this.queue.length > 0) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  /**
   * Clear all queued tasks
   */
  clear(): void {
    this.queue = [];
  }
}
