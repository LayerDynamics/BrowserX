/**
 * Thread Worker Implementation
 *
 * Wrapper around Deno Worker for managing background threads
 */

import type {
  WorkerID,
  WorkerMessage,
  WorkerMessageType,
  WorkerStats,
  WorkerConfig,
  IWorker,
  TaskMessage,
  ResultMessage,
  ErrorMessage,
} from "../worker/interface.ts";
import {
  WorkerState,
  createWorkerMessage,
  isResultMessage,
  isErrorMessage,
} from "../worker/interface.ts";

/**
 * Thread worker implementation using Deno.Worker
 */
export class ThreadWorker implements IWorker {
  readonly id: WorkerID;
  private worker: Worker;
  private _state: WorkerState = WorkerState.IDLE;
  private pendingTasks = new Map<string, {
    resolve: (result: unknown) => void;
    reject: (error: Error) => void;
    startTime: number;
    timeout?: number;
  }>();
  private messageHandlers = new Map<string, Set<(data: unknown) => void>>();
  private stats: WorkerStats;
  private totalTaskTime = 0;

  constructor(
    scriptPath: string,
    config: WorkerConfig = {},
  ) {
    this.id = `worker-${Date.now()}-${Math.random().toString(36).slice(2, 11)}` as WorkerID;

    // Create Deno Worker
    this.worker = new Worker(scriptPath, {
      type: "module",
      name: config.name || this.id,
    });

    // Initialize stats
    this.stats = {
      id: this.id,
      state: WorkerState.IDLE,
      tasksProcessed: 0,
      tasksSucceeded: 0,
      tasksFailed: 0,
      averageTaskTime: 0,
      totalTime: 0,
      uptime: 0,
      createdAt: new Date(),
    };

    // Set up message handler
    this.worker.onmessage = (event: MessageEvent) => {
      this.handleMessage(event.data);
    };

    // Set up error handler
    this.worker.onerror = (event: ErrorEvent) => {
      this.handleError(event);
    };

    // Set up message error handler
    this.worker.onmessageerror = (event: MessageEvent) => {
      console.error(`[ThreadWorker ${this.id}] Message error:`, event);
    };
  }

  get state(): WorkerState {
    return this._state;
  }

  /**
   * Send a task to the worker
   */
  async sendTask<T = unknown, R = unknown>(
    task: T,
    taskId: string,
    timeout?: number,
  ): Promise<R> {
    if (this._state === WorkerState.TERMINATED) {
      throw new Error(`Worker ${this.id} is terminated`);
    }

    if (this._state === WorkerState.PAUSED) {
      throw new Error(`Worker ${this.id} is paused`);
    }

    return new Promise<R>((resolve, reject) => {
      const startTime = Date.now();

      // Store pending task
      this.pendingTasks.set(taskId, {
        resolve: resolve as (result: unknown) => void,
        reject,
        startTime,
        timeout,
      });

      // Set timeout if specified
      if (timeout) {
        setTimeout(() => {
          const pending = this.pendingTasks.get(taskId);
          if (pending) {
            this.pendingTasks.delete(taskId);
            this.stats.tasksFailed++;
            reject(new Error(`Task ${taskId} timed out after ${timeout}ms`));
          }
        }, timeout);
      }

      // Send task to worker
      const message: TaskMessage<T> = {
        type: "task" as WorkerMessageType.TASK,
        id: crypto.randomUUID(),
        taskId,
        data: task,
        timestamp: Date.now(),
        timeout,
      };

      this._state = WorkerState.BUSY;
      this.worker.postMessage(message);
    });
  }

  /**
   * Terminate the worker
   */
  terminate(): void {
    // Reject all pending tasks
    for (const [taskId, pending] of this.pendingTasks.entries()) {
      pending.reject(new Error(`Worker ${this.id} terminated`));
    }
    this.pendingTasks.clear();

    this.worker.terminate();
    this._state = WorkerState.TERMINATED;

    // Emit terminated event
    this.emit("terminated", { workerId: this.id });
  }

  /**
   * Pause the worker
   */
  pause(): void {
    if (this._state === WorkerState.TERMINATED) {
      throw new Error(`Cannot pause terminated worker ${this.id}`);
    }

    const message = createWorkerMessage("pause" as WorkerMessageType.PAUSE);
    this.worker.postMessage(message);
    this._state = WorkerState.PAUSED;
  }

  /**
   * Resume the worker
   */
  resume(): void {
    if (this._state !== WorkerState.PAUSED) {
      throw new Error(`Worker ${this.id} is not paused`);
    }

    const message = createWorkerMessage("resume" as WorkerMessageType.RESUME);
    this.worker.postMessage(message);
    this._state = WorkerState.IDLE;
  }

  /**
   * Ping the worker to check if alive
   */
  async ping(): Promise<boolean> {
    if (this._state === WorkerState.TERMINATED) {
      return false;
    }

    return new Promise((resolve) => {
      const pingId = crypto.randomUUID();
      const timeout = setTimeout(() => {
        this.off("message", handler);
        resolve(false);
      }, 5000);

      const handler = (data: unknown) => {
        const message = data as WorkerMessage;
        if (message.type === "pong" as WorkerMessageType.PONG && message.id === pingId) {
          clearTimeout(timeout);
          this.off("message", handler);
          resolve(true);
        }
      };

      this.on("message", handler);

      const message = createWorkerMessage("ping" as WorkerMessageType.PING, undefined, {
        id: pingId,
      });
      this.worker.postMessage(message);
    });
  }

  /**
   * Get worker statistics
   */
  getStats(): WorkerStats {
    this.stats.state = this._state;
    this.stats.uptime = Date.now() - this.stats.createdAt.getTime();
    this.stats.totalTime = this.totalTaskTime;

    return { ...this.stats };
  }

  /**
   * Add event listener
   */
  on(event: "message" | "error" | "terminated", handler: (data: unknown) => void): void {
    if (!this.messageHandlers.has(event)) {
      this.messageHandlers.set(event, new Set());
    }
    this.messageHandlers.get(event)!.add(handler);
  }

  /**
   * Remove event listener
   */
  off(event: "message" | "error" | "terminated", handler: (data: unknown) => void): void {
    const handlers = this.messageHandlers.get(event);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  /**
   * Handle message from worker
   */
  private handleMessage(data: unknown): void {
    const message = data as WorkerMessage;

    // Emit message event
    this.emit("message", message);

    if (isResultMessage(message)) {
      this.handleResult(message as ResultMessage);
    } else if (isErrorMessage(message)) {
      this.handleErrorMessage(message as ErrorMessage);
    }
  }

  /**
   * Handle result message
   */
  private handleResult(message: ResultMessage): void {
    const pending = this.pendingTasks.get(message.taskId);
    if (!pending) {
      return;
    }

    this.pendingTasks.delete(message.taskId);

    // Update stats
    this.stats.tasksProcessed++;
    if (message.success) {
      this.stats.tasksSucceeded++;
    } else {
      this.stats.tasksFailed++;
    }

    const duration = message.duration || (Date.now() - pending.startTime);
    this.totalTaskTime += duration;
    this.stats.averageTaskTime = this.totalTaskTime / this.stats.tasksProcessed;
    this.stats.lastTaskAt = new Date();

    // Update state
    this._state = this.pendingTasks.size > 0 ? WorkerState.BUSY : WorkerState.IDLE;

    // Resolve or reject promise
    if (message.success) {
      pending.resolve(message.data);
    } else {
      pending.reject(new Error(message.error || "Task failed"));
    }
  }

  /**
   * Handle error message
   */
  private handleErrorMessage(message: ErrorMessage): void {
    const taskId = message.taskId;

    if (taskId) {
      const pending = this.pendingTasks.get(taskId);
      if (pending) {
        this.pendingTasks.delete(taskId);
        this.stats.tasksFailed++;
        pending.reject(new Error(message.error));
      }
    }

    // Emit error event
    this.emit("error", new Error(message.error));
  }

  /**
   * Handle error event
   */
  private handleError(event: ErrorEvent): void {
    console.error(`[ThreadWorker ${this.id}] Error:`, event.error);

    // Emit error event
    this.emit("error", event.error);

    // If critical error, terminate
    if (event.error && event.error.message?.includes("critical")) {
      this._state = WorkerState.ERROR;
    }
  }

  /**
   * Emit event to handlers
   */
  private emit(event: "message" | "error" | "terminated", data: unknown): void {
    const handlers = this.messageHandlers.get(event);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(data);
        } catch (error) {
          console.error(`[ThreadWorker ${this.id}] Handler error:`, error);
        }
      }
    }
  }
}

/**
 * Create a basic worker script that processes tasks
 *
 * Usage in worker script:
 * ```ts
 * import { createWorkerHandler } from "./worker.ts";
 *
 * createWorkerHandler(async (task) => {
 *   // Process task
 *   return result;
 * });
 * ```
 */
export function createWorkerHandler<T = unknown, R = unknown>(
  handler: (task: T) => Promise<R> | R,
): void {
  self.onmessage = async (event: MessageEvent) => {
    const message = event.data as WorkerMessage<T>;

    if (message.type === "task" as WorkerMessageType.TASK) {
      const taskMessage = message as TaskMessage<T>;
      const startTime = Date.now();

      try {
        const result = await handler(taskMessage.data!);
        const duration = Date.now() - startTime;

        const response: ResultMessage<R> = {
          type: "result" as WorkerMessageType.RESULT,
          id: crypto.randomUUID(),
          taskId: taskMessage.taskId,
          data: result,
          success: true,
          duration,
          timestamp: Date.now(),
        };

        self.postMessage(response);
      } catch (error) {
        const duration = Date.now() - startTime;

        const response: ErrorMessage = {
          type: "error" as WorkerMessageType.ERROR,
          id: crypto.randomUUID(),
          taskId: taskMessage.taskId,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          timestamp: Date.now(),
        };

        self.postMessage(response);
      }
    } else if (message.type === "ping" as WorkerMessageType.PING) {
      const response = createWorkerMessage("pong" as WorkerMessageType.PONG, undefined, {
        id: message.id,
      });
      self.postMessage(response);
    } else if (message.type === "terminate" as WorkerMessageType.TERMINATE) {
      self.close();
    }
  };
}
