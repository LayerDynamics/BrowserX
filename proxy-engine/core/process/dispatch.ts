/**
 * Process Dispatcher
 *
 * Dispatches requests/tasks to worker processes using various strategies
 */

import { type ProcessID } from "./pid.ts";
import type { Priority } from "./priority.ts";

/**
 * Task to be dispatched
 */
export interface Task<T = unknown> {
  id: string;
  data: T;
  priority?: Priority;
  timeout?: number;
  retries?: number;
}

/**
 * Task result
 */
export interface TaskResult<T = unknown> {
  taskId: string;
  success: boolean;
  data?: T;
  error?: string;
  processId: ProcessID;
  duration: number;
}

/**
 * Worker process info for dispatcher
 */
export interface WorkerInfo {
  id: ProcessID;
  pid: number;
  busy: boolean;
  currentTasks: number;
  totalProcessed: number;
  averageTime: number;
  lastUsed: Date;
}

/**
 * Dispatch strategy
 */
export enum DispatchStrategy {
  ROUND_ROBIN = "round_robin",
  LEAST_BUSY = "least_busy",
  RANDOM = "random",
  WEIGHTED = "weighted",
  PRIORITY = "priority",
}

/**
 * Process dispatcher
 */
export class ProcessDispatcher<T = unknown, R = unknown> {
  private workers: Map<ProcessID, WorkerInfo> = new Map();
  private taskQueue: Task<T>[] = [];
  private pendingTasks: Map<string, Task<T>> = new Map();
  private roundRobinIndex = 0;

  constructor(
    private strategy: DispatchStrategy = DispatchStrategy.ROUND_ROBIN,
  ) {}

  /**
   * Register a worker process
   */
  registerWorker(worker: WorkerInfo): void {
    this.workers.set(worker.id, worker);
  }

  /**
   * Unregister a worker process
   */
  unregisterWorker(workerId: ProcessID): void {
    this.workers.delete(workerId);
  }

  /**
   * Dispatch a task to a worker
   */
  async dispatch(task: Task<T>): Promise<ProcessID> {
    const worker = this.selectWorker(task);

    if (!worker) {
      // No worker available, queue the task
      this.taskQueue.push(task);
      this.pendingTasks.set(task.id, task);
      throw new Error("No available workers, task queued");
    }

    // Mark worker as busy
    worker.busy = true;
    worker.currentTasks++;
    worker.lastUsed = new Date();

    this.pendingTasks.set(task.id, task);

    return worker.id;
  }

  /**
   * Complete a task
   */
  completeTask(taskId: string, workerId: ProcessID, duration: number): void {
    const worker = this.workers.get(workerId);
    if (worker) {
      worker.currentTasks--;
      worker.totalProcessed++;
      worker.busy = worker.currentTasks > 0;

      // Update average processing time
      if (worker.totalProcessed === 1) {
        worker.averageTime = duration;
      } else {
        worker.averageTime =
          (worker.averageTime * (worker.totalProcessed - 1) + duration) /
          worker.totalProcessed;
      }
    }

    this.pendingTasks.delete(taskId);

    // Process queued tasks
    if (this.taskQueue.length > 0 && !worker?.busy) {
      const nextTask = this.taskQueue.shift();
      if (nextTask) {
        this.dispatch(nextTask).catch(() => {
          // Task will be retried or queued
        });
      }
    }
  }

  /**
   * Select worker based on strategy
   */
  private selectWorker(task: Task<T>): WorkerInfo | null {
    const availableWorkers = Array.from(this.workers.values()).filter(
      (w) => !w.busy || w.currentTasks === 0,
    );

    if (availableWorkers.length === 0) {
      return null;
    }

    switch (this.strategy) {
      case DispatchStrategy.ROUND_ROBIN:
        return this.selectRoundRobin(availableWorkers);

      case DispatchStrategy.LEAST_BUSY:
        return this.selectLeastBusy(availableWorkers);

      case DispatchStrategy.RANDOM:
        return this.selectRandom(availableWorkers);

      case DispatchStrategy.WEIGHTED:
        return this.selectWeighted(availableWorkers);

      case DispatchStrategy.PRIORITY:
        return this.selectByPriority(availableWorkers, task);

      default:
        return availableWorkers[0];
    }
  }

  /**
   * Round-robin selection
   */
  private selectRoundRobin(workers: WorkerInfo[]): WorkerInfo {
    const worker = workers[this.roundRobinIndex % workers.length];
    this.roundRobinIndex++;
    return worker;
  }

  /**
   * Select least busy worker
   */
  private selectLeastBusy(workers: WorkerInfo[]): WorkerInfo {
    return workers.reduce((least, current) =>
      current.currentTasks < least.currentTasks ? current : least
    );
  }

  /**
   * Random selection
   */
  private selectRandom(workers: WorkerInfo[]): WorkerInfo {
    const index = Math.floor(Math.random() * workers.length);
    return workers[index];
  }

  /**
   * Weighted selection (based on average processing time)
   */
  private selectWeighted(workers: WorkerInfo[]): WorkerInfo {
    // Prefer workers with lower average processing time
    return workers.reduce((best, current) =>
      current.averageTime < best.averageTime ? current : best
    );
  }

  /**
   * Select by priority
   */
  private selectByPriority(workers: WorkerInfo[], task: Task<T>): WorkerInfo {
    // For high priority tasks, use least busy
    // For low priority, use any available
    if (task.priority === "high") {
      return this.selectLeastBusy(workers);
    }
    return this.selectRandom(workers);
  }

  /**
   * Get worker info
   */
  getWorker(workerId: ProcessID): WorkerInfo | undefined {
    return this.workers.get(workerId);
  }

  /**
   * Get all workers
   */
  getAllWorkers(): WorkerInfo[] {
    return Array.from(this.workers.values());
  }

  /**
   * Get available workers
   */
  getAvailableWorkers(): WorkerInfo[] {
    return Array.from(this.workers.values()).filter((w) => !w.busy);
  }

  /**
   * Get queue size
   */
  getQueueSize(): number {
    return this.taskQueue.length;
  }

  /**
   * Get pending tasks count
   */
  getPendingCount(): number {
    return this.pendingTasks.size;
  }

  /**
   * Clear task queue
   */
  clearQueue(): void {
    this.taskQueue = [];
  }

  /**
   * Get statistics
   */
  getStats() {
    const workers = Array.from(this.workers.values());

    return {
      totalWorkers: workers.length,
      busyWorkers: workers.filter((w) => w.busy).length,
      availableWorkers: workers.filter((w) => !w.busy).length,
      queuedTasks: this.taskQueue.length,
      pendingTasks: this.pendingTasks.size,
      totalProcessed: workers.reduce((sum, w) => sum + w.totalProcessed, 0),
      averageProcessingTime:
        workers.reduce((sum, w) => sum + w.averageTime, 0) / workers.length || 0,
    };
  }
}
