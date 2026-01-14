/**
 * Worker Interface
 *
 * Defines the interface for worker threads that process tasks
 */

/**
 * Worker ID type
 */
export type WorkerID = string;

/**
 * Worker state
 */
export enum WorkerState {
  IDLE = "idle",
  BUSY = "busy",
  PAUSED = "paused",
  TERMINATED = "terminated",
  ERROR = "error",
}

/**
 * Worker message types
 */
export enum WorkerMessageType {
  TASK = "task",
  RESULT = "result",
  ERROR = "error",
  PING = "ping",
  PONG = "pong",
  TERMINATE = "terminate",
  PAUSE = "pause",
  RESUME = "resume",
}

/**
 * Base worker message
 */
export interface WorkerMessage<T = unknown> {
  type: WorkerMessageType;
  id: string;
  data?: T;
  error?: string;
  timestamp: number;
}

/**
 * Task message
 */
export interface TaskMessage<T = unknown> extends WorkerMessage<T> {
  type: WorkerMessageType.TASK;
  taskId: string;
  priority?: number;
  timeout?: number;
}

/**
 * Result message
 */
export interface ResultMessage<T = unknown> extends WorkerMessage<T> {
  type: WorkerMessageType.RESULT;
  taskId: string;
  success: boolean;
  duration: number;
}

/**
 * Error message
 */
export interface ErrorMessage extends WorkerMessage {
  type: WorkerMessageType.ERROR;
  taskId?: string;
  error: string;
  stack?: string;
}

/**
 * Worker configuration
 */
export interface WorkerConfig {
  name?: string;
  maxConcurrentTasks?: number;
  timeout?: number;
  retries?: number;
  autoRestart?: boolean;
}

/**
 * Worker statistics
 */
export interface WorkerStats {
  id: WorkerID;
  state: WorkerState;
  tasksProcessed: number;
  tasksSucceeded: number;
  tasksFailed: number;
  averageTaskTime: number;
  totalTime: number;
  uptime: number;
  memoryUsage?: number;
  cpuUsage?: number;
  lastTaskAt?: Date;
  createdAt: Date;
}

/**
 * Worker interface
 */
export interface IWorker {
  readonly id: WorkerID;
  readonly state: WorkerState;

  /**
   * Send a task to the worker
   */
  sendTask<T = unknown, R = unknown>(task: T, taskId: string, timeout?: number): Promise<R>;

  /**
   * Terminate the worker
   */
  terminate(): void;

  /**
   * Pause the worker
   */
  pause(): void;

  /**
   * Resume the worker
   */
  resume(): void;

  /**
   * Ping the worker to check if alive
   */
  ping(): Promise<boolean>;

  /**
   * Get worker statistics
   */
  getStats(): WorkerStats;

  /**
   * Add message listener
   */
  on(event: "message" | "error" | "terminated", handler: (data: unknown) => void): void;

  /**
   * Remove message listener
   */
  off(event: "message" | "error" | "terminated", handler: (data: unknown) => void): void;
}

/**
 * Worker pool interface
 */
export interface IWorkerPool {
  readonly size: number;
  readonly available: number;

  /**
   * Execute a task on any available worker
   */
  execute<T = unknown, R = unknown>(task: T, priority?: number): Promise<R>;

  /**
   * Execute tasks in parallel
   */
  executeMany<T = unknown, R = unknown>(tasks: T[]): Promise<R[]>;

  /**
   * Add a worker to the pool
   */
  addWorker(worker: IWorker): void;

  /**
   * Remove a worker from the pool
   */
  removeWorker(workerId: WorkerID): void;

  /**
   * Get a specific worker
   */
  getWorker(workerId: WorkerID): IWorker | undefined;

  /**
   * Terminate all workers
   */
  terminateAll(): void;

  /**
   * Get pool statistics
   */
  getStats(): {
    totalWorkers: number;
    idleWorkers: number;
    busyWorkers: number;
    totalTasksProcessed: number;
    averageTaskTime: number;
  };
}

/**
 * Worker task handler function
 */
export type WorkerTaskHandler<T = unknown, R = unknown> = (task: T) => Promise<R> | R;

/**
 * Create a worker message
 */
export function createWorkerMessage<T = unknown>(
  type: WorkerMessageType,
  data?: T,
  options?: {
    id?: string;
    taskId?: string;
    error?: string;
    success?: boolean;
    duration?: number;
  },
): WorkerMessage<T> {
  const message: WorkerMessage<T> = {
    type,
    id: options?.id || crypto.randomUUID(),
    timestamp: Date.now(),
    data,
  };

  if (options?.error) {
    (message as ErrorMessage).error = options.error;
  }

  if (options?.taskId) {
    (message as TaskMessage<T> | ResultMessage<T>).taskId = options.taskId;
  }

  if (options?.success !== undefined) {
    (message as ResultMessage<T>).success = options.success;
  }

  if (options?.duration !== undefined) {
    (message as ResultMessage<T>).duration = options.duration;
  }

  return message;
}

/**
 * Check if message is a task message
 */
export function isTaskMessage(message: WorkerMessage): message is TaskMessage {
  return message.type === WorkerMessageType.TASK;
}

/**
 * Check if message is a result message
 */
export function isResultMessage(message: WorkerMessage): message is ResultMessage {
  return message.type === WorkerMessageType.RESULT;
}

/**
 * Check if message is an error message
 */
export function isErrorMessage(message: WorkerMessage): message is ErrorMessage {
  return message.type === WorkerMessageType.ERROR;
}
