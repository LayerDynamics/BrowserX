/**
 * Event Loop
 *
 * Implements the JavaScript event loop with task queues.
 * Manages macrotasks (setTimeout, setInterval) and microtasks (promises, queueMicrotask).
 * Coordinates asynchronous execution with the V8 engine.
 *
 * Event Loop Phases:
 * 1. Execute one macrotask from task queue
 * 2. Execute all microtasks until queue is empty
 * 3. Perform rendering if needed
 * 4. Repeat
 */

import { createUndefined, type JSFunction, type JSValue } from "./JSValue.ts";
import { type ExecutionResult, type V8Context } from "./V8Context.ts";

/**
 * Task ID
 */
export type TaskID = number & { __brand: "TaskID" };

/**
 * Task priority
 */
export enum TaskPriority {
    IMMEDIATE = 0, // Microtasks, promises
    HIGH = 1, // User interaction
    NORMAL = 2, // setTimeout(0), network responses
    LOW = 3, // setTimeout with delay
    IDLE = 4, // requestIdleCallback
}

/**
 * Task type
 */
export enum TaskType {
    MACROTASK = "macrotask",
    MICROTASK = "microtask",
    RENDER = "render",
    IDLE = "idle",
}

/**
 * Task callback
 */
export type TaskCallback = () => void;

/**
 * Task
 */
export interface Task {
    id: TaskID;
    type: TaskType;
    priority: TaskPriority;
    callback: TaskCallback;
    scheduledAt: number;
    executeAt: number;
    recurring?: {
        interval: number;
        lastExecutedAt: number;
    };
    cancelled: boolean;
}

/**
 * Event loop statistics
 */
export interface EventLoopStats {
    macrotasksExecuted: number;
    microtasksExecuted: number;
    totalExecutionTime: number;
    averageTaskTime: number;
    currentQueueSize: number;
    idleTime: number;
    loopIterations: number;
}

/**
 * Event loop configuration
 */
export interface EventLoopConfig {
    maxMicrotasksPerCycle?: number;
    maxTaskExecutionTime?: number;
    enableIdleTasks?: boolean;
    targetFrameRate?: number;
}

/**
 * EventLoop
 * JavaScript event loop implementation
 */
export class EventLoop {
    private taskQueue: Task[] = [];
    private microtaskQueue: Task[] = [];
    private renderTasks: Task[] = [];
    private idleTasks: Task[] = [];
    private nextTaskId: number = 1;
    private running: boolean = false;
    private context: V8Context | null = null;
    private config: EventLoopConfig;
    private stats: EventLoopStats;
    private animationFrameId: TaskID | null = null;
    private lastFrameTime: number = 0;
    private frameInterval: number;

    constructor(config: EventLoopConfig = {}) {
        this.config = {
            maxMicrotasksPerCycle: 1000,
            maxTaskExecutionTime: 50, // 50ms
            enableIdleTasks: true,
            targetFrameRate: 60,
            ...config,
        };

        this.frameInterval = 1000 / this.config.targetFrameRate!;

        this.stats = {
            macrotasksExecuted: 0,
            microtasksExecuted: 0,
            totalExecutionTime: 0,
            averageTaskTime: 0,
            currentQueueSize: 0,
            idleTime: 0,
            loopIterations: 0,
        };
    }

    /**
     * Set V8 context for task execution
     */
    setContext(context: V8Context): void {
        this.context = context;
    }

    /**
     * Start event loop
     */
    start(): void {
        if (this.running) {
            return;
        }

        this.running = true;
        this.scheduleNextIteration();
    }

    /**
     * Stop event loop
     */
    stop(): void {
        this.running = false;
        if (this.animationFrameId !== null) {
            this.cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    /**
     * Schedule next event loop iteration
     */
    private scheduleNextIteration(): void {
        if (!this.running) {
            return;
        }

        this.animationFrameId = this.requestAnimationFrame(() => {
            this.runIteration(performance.now());
            this.scheduleNextIteration();
        });
    }

    /**
     * Run single event loop iteration
     */
    private runIteration(timestamp: number): void {
        this.stats.loopIterations++;
        const iterationStart = performance.now();

        // Phase 1: Execute one macrotask
        if (this.taskQueue.length > 0) {
            this.executeNextMacrotask();
        }

        // Phase 2: Execute all microtasks
        this.executeMicrotasks();

        // Phase 3: Rendering
        if (timestamp - this.lastFrameTime >= this.frameInterval) {
            this.executeRenderTasks();
            this.lastFrameTime = timestamp;
        }

        // Phase 4: Idle tasks (if time permits)
        const iterationTime = performance.now() - iterationStart;
        const remainingTime = this.frameInterval - iterationTime;

        if (this.config.enableIdleTasks && remainingTime > 1) {
            this.executeIdleTasks(remainingTime);
        }

        // Update statistics
        const idleTime = this.frameInterval - (performance.now() - iterationStart);
        if (idleTime > 0) {
            this.stats.idleTime += idleTime;
        }

        this.stats.currentQueueSize = this.taskQueue.length + this.microtaskQueue.length;
    }

    /**
     * Execute next macrotask
     */
    private executeNextMacrotask(): void {
        // Sort by priority and scheduled time
        this.taskQueue.sort((a, b) => {
            if (a.priority !== b.priority) {
                return a.priority - b.priority;
            }
            return a.executeAt - b.executeAt;
        });

        const now = performance.now();

        // Remove cancelled tasks first
        this.taskQueue = this.taskQueue.filter((task) => !task.cancelled);

        // Find next task ready to execute
        const taskIndex = this.taskQueue.findIndex(
            (task) => task.executeAt <= now,
        );

        if (taskIndex === -1) {
            return;
        }

        const task = this.taskQueue[taskIndex];
        this.taskQueue.splice(taskIndex, 1);

        this.executeTask(task);

        // Handle recurring tasks
        if (task.recurring && !task.cancelled) {
            task.executeAt = now + task.recurring.interval;
            task.recurring.lastExecutedAt = now;
            this.taskQueue.push(task);
        }

        this.stats.macrotasksExecuted++;
    }

    /**
     * Execute all microtasks
     */
    private executeMicrotasks(): void {
        let executed = 0;
        const maxMicrotasks = this.config.maxMicrotasksPerCycle!;

        while (this.microtaskQueue.length > 0 && executed < maxMicrotasks) {
            // Sort by priority
            this.microtaskQueue.sort((a, b) => a.priority - b.priority);

            const task = this.microtaskQueue.shift();
            if (!task || task.cancelled) {
                continue;
            }

            this.executeTask(task);
            executed++;
            this.stats.microtasksExecuted++;
        }

        // Warn if microtask queue is growing too large
        if (this.microtaskQueue.length >= maxMicrotasks) {
            console.warn(`Microtask queue overflow: ${this.microtaskQueue.length} tasks pending`);
        }
    }

    /**
     * Execute render tasks
     */
    private executeRenderTasks(): void {
        const tasks = [...this.renderTasks];
        this.renderTasks = [];

        for (const task of tasks) {
            if (!task.cancelled) {
                this.executeTask(task);
            }
        }
    }

    /**
     * Execute idle tasks
     */
    private executeIdleTasks(timeRemaining: number): void {
        const deadline = performance.now() + timeRemaining;

        while (this.idleTasks.length > 0 && performance.now() < deadline) {
            const task = this.idleTasks.shift();
            if (!task || task.cancelled) {
                continue;
            }

            this.executeTask(task);
        }
    }

    /**
     * Execute task
     */
    private executeTask(task: Task): void {
        const startTime = performance.now();

        try {
            task.callback();
        } catch (error) {
            console.error("Task execution error:", error);
        }

        const executionTime = performance.now() - startTime;
        this.stats.totalExecutionTime += executionTime;
        this.stats.averageTaskTime = this.stats.totalExecutionTime /
            (this.stats.macrotasksExecuted + this.stats.microtasksExecuted);

        // Warn about long-running tasks
        if (executionTime > this.config.maxTaskExecutionTime!) {
            console.warn(`Long task detected: ${executionTime.toFixed(2)}ms`);
        }
    }

    /**
     * Schedule macrotask (setTimeout)
     */
    setTimeout(
        callback: TaskCallback,
        delay: number = 0,
        priority: TaskPriority = TaskPriority.NORMAL,
    ): TaskID {
        const id = this.generateTaskId();
        const now = performance.now();

        const task: Task = {
            id,
            type: TaskType.MACROTASK,
            priority,
            callback,
            scheduledAt: now,
            executeAt: now + delay,
            cancelled: false,
        };

        this.taskQueue.push(task);
        return id;
    }

    /**
     * Schedule recurring macrotask (setInterval)
     */
    setInterval(
        callback: TaskCallback,
        interval: number,
        priority: TaskPriority = TaskPriority.NORMAL,
    ): TaskID {
        const id = this.generateTaskId();
        const now = performance.now();

        const task: Task = {
            id,
            type: TaskType.MACROTASK,
            priority,
            callback,
            scheduledAt: now,
            executeAt: now + interval,
            recurring: {
                interval,
                lastExecutedAt: now,
            },
            cancelled: false,
        };

        this.taskQueue.push(task);
        return id;
    }

    /**
     * Queue task
     */
    queueTask(task: () => void): void {
        this.setTimeout(task, 0);
    }

    /**
     * Queue microtask
     */
    queueMicrotask(
        callback: TaskCallback,
        priority: TaskPriority = TaskPriority.IMMEDIATE,
    ): TaskID {
        const id = this.generateTaskId();
        const now = performance.now();

        const task: Task = {
            id,
            type: TaskType.MICROTASK,
            priority,
            callback,
            scheduledAt: now,
            executeAt: now,
            cancelled: false,
        };

        this.microtaskQueue.push(task);
        return id;
    }

    /**
     * Schedule render task (requestAnimationFrame)
     */
    requestAnimationFrame(callback: TaskCallback): TaskID {
        const id = this.generateTaskId();
        const now = performance.now();

        const task: Task = {
            id,
            type: TaskType.RENDER,
            priority: TaskPriority.HIGH,
            callback,
            scheduledAt: now,
            executeAt: now,
            cancelled: false,
        };

        this.renderTasks.push(task);
        return id;
    }

    /**
     * Schedule idle task (requestIdleCallback)
     */
    requestIdleCallback(callback: TaskCallback): TaskID {
        const id = this.generateTaskId();
        const now = performance.now();

        const task: Task = {
            id,
            type: TaskType.IDLE,
            priority: TaskPriority.IDLE,
            callback,
            scheduledAt: now,
            executeAt: now,
            cancelled: false,
        };

        this.idleTasks.push(task);
        return id;
    }

    /**
     * Cancel task
     */
    clearTimeout(id: TaskID): boolean {
        return this.cancelTask(id);
    }

    /**
     * Cancel interval
     */
    clearInterval(id: TaskID): boolean {
        return this.cancelTask(id);
    }

    /**
     * Cancel animation frame
     */
    cancelAnimationFrame(id: TaskID): boolean {
        return this.cancelTask(id);
    }

    /**
     * Cancel idle callback
     */
    cancelIdleCallback(id: TaskID): boolean {
        return this.cancelTask(id);
    }

    /**
     * Cancel task by ID
     */
    private cancelTask(id: TaskID): boolean {
        // Search in all queues
        const queues = [
            this.taskQueue,
            this.microtaskQueue,
            this.renderTasks,
            this.idleTasks,
        ];

        for (const queue of queues) {
            const task = queue.find((t) => t.id === id);
            if (task) {
                task.cancelled = true;
                return true;
            }
        }

        return false;
    }

    /**
     * Execute code in context asynchronously
     */
    async executeAsync(code: string): Promise<ExecutionResult> {
        return new Promise((resolve, reject) => {
            this.queueMicrotask(() => {
                if (!this.context) {
                    reject(new Error("No execution context set"));
                    return;
                }

                try {
                    const result = this.context.execute(code);
                    resolve(result);
                } catch (error) {
                    reject(error);
                }
            });
        });
    }

    /**
     * Execute function in context asynchronously
     */
    async executeFunctionAsync(fn: JSFunction, ...args: JSValue[]): Promise<JSValue> {
        return new Promise((resolve, reject) => {
            this.queueMicrotask(() => {
                if (!this.context) {
                    reject(new Error("No execution context set"));
                    return;
                }

                try {
                    if (fn.isNative && fn.nativeImpl) {
                        const result = fn.nativeImpl(...args);
                        resolve(result);
                    } else {
                        // Compile and execute function code
                        const result = this.context.execute(fn.code as string);
                        resolve(result.value);
                    }
                } catch (error) {
                    reject(error);
                }
            });
        });
    }

    /**
     * Run event loop
     */
    run(): void {
        this.start();
    }

    /**
     * Get event loop statistics
     */
    getStats(): EventLoopStats {
        return { ...this.stats };
    }

    /**
     * Get configuration
     */
    getConfig(): EventLoopConfig {
        return { ...this.config };
    }

    /**
     * Check if event loop is running
     */
    isRunning(): boolean {
        return this.running;
    }

    /**
     * Get current queue sizes
     */
    getQueueSizes(): {
        macrotasks: number;
        microtasks: number;
        renderTasks: number;
        idleTasks: number;
    } {
        return {
            macrotasks: this.taskQueue.length,
            microtasks: this.microtaskQueue.length,
            renderTasks: this.renderTasks.length,
            idleTasks: this.idleTasks.length,
        };
    }

    /**
     * Clear all queues
     */
    clearAllQueues(): void {
        this.taskQueue = [];
        this.microtaskQueue = [];
        this.renderTasks = [];
        this.idleTasks = [];
    }

    /**
     * Check if there are pending tasks
     */
    hasPendingTasks(): boolean {
        return this.taskQueue.length > 0 ||
            this.microtaskQueue.length > 0 ||
            this.renderTasks.length > 0 ||
            this.idleTasks.length > 0;
    }

    /**
     * Reset statistics
     */
    resetStats(): void {
        this.stats = {
            macrotasksExecuted: 0,
            microtasksExecuted: 0,
            totalExecutionTime: 0,
            averageTaskTime: 0,
            currentQueueSize: 0,
            idleTime: 0,
            loopIterations: 0,
        };
    }

    /**
     * Generate task ID
     */
    private generateTaskId(): TaskID {
        return this.nextTaskId++ as TaskID;
    }

    /**
     * Process pending tasks synchronously (for testing)
     */
    processPendingTasks(): void {
        const now = performance.now();

        // Remove cancelled tasks
        this.taskQueue = this.taskQueue.filter((task) => !task.cancelled);

        // Execute any existing microtasks first
        this.executeMicrotasks();

        // Execute all ready macrotasks (not delayed ones)
        while (this.taskQueue.length > 0) {
            // Check if any task is ready to execute
            const hasReadyTask = this.taskQueue.some((task) => task.executeAt <= now);
            if (!hasReadyTask) {
                break;
            }

            this.executeNextMacrotask();
            this.executeMicrotasks();
        }

        // Execute remaining microtasks
        this.executeMicrotasks();

        // Execute render tasks
        this.executeRenderTasks();
    }

    /**
     * Get next task scheduled time
     */
    getNextTaskTime(): number | null {
        if (this.taskQueue.length === 0) {
            return null;
        }

        return Math.min(...this.taskQueue.map((task) => task.executeAt));
    }

    /**
     * Drain microtask queue (execute all pending microtasks)
     */
    drainMicrotaskQueue(): void {
        while (this.microtaskQueue.length > 0) {
            const task = this.microtaskQueue.shift();
            if (task && !task.cancelled) {
                this.executeTask(task);
                this.stats.microtasksExecuted++;
            }
        }
    }
}

/**
 * Event loop factory
 * Creates event loop instances with different configurations
 */
export class EventLoopFactory {
    /**
     * Create default event loop
     */
    static createDefault(): EventLoop {
        return new EventLoop();
    }

    /**
     * Create event loop for development
     */
    static createDevelopment(): EventLoop {
        return new EventLoop({
            maxMicrotasksPerCycle: 500,
            maxTaskExecutionTime: 100,
            enableIdleTasks: true,
            targetFrameRate: 60,
        });
    }

    /**
     * Create event loop for production
     */
    static createProduction(): EventLoop {
        return new EventLoop({
            maxMicrotasksPerCycle: 2000,
            maxTaskExecutionTime: 16, // One frame at 60fps
            enableIdleTasks: true,
            targetFrameRate: 60,
        });
    }

    /**
     * Create event loop for testing
     */
    static createForTesting(): EventLoop {
        return new EventLoop({
            maxMicrotasksPerCycle: 100,
            maxTaskExecutionTime: 1000,
            enableIdleTasks: false,
            targetFrameRate: 60,
        });
    }

    /**
     * Create event loop with custom configuration
     */
    static createWithConfig(config: EventLoopConfig): EventLoop {
        return new EventLoop(config);
    }
}

/**
 * Global event loop instance
 */
let globalEventLoop: EventLoop | null = null;

/**
 * Get or create global event loop
 */
export function getGlobalEventLoop(): EventLoop {
    if (!globalEventLoop) {
        globalEventLoop = EventLoopFactory.createDefault();
    }
    return globalEventLoop;
}

/**
 * Set global event loop
 */
export function setGlobalEventLoop(eventLoop: EventLoop): void {
    globalEventLoop = eventLoop;
}

/**
 * Global setTimeout wrapper
 */
export function setTimeout(callback: TaskCallback, delay: number = 0): TaskID {
    return getGlobalEventLoop().setTimeout(callback, delay);
}

/**
 * Global setInterval wrapper
 */
export function setInterval(callback: TaskCallback, interval: number): TaskID {
    return getGlobalEventLoop().setInterval(callback, interval);
}

/**
 * Global queueMicrotask wrapper
 */
export function queueMicrotask(callback: TaskCallback): TaskID {
    return getGlobalEventLoop().queueMicrotask(callback);
}

/**
 * Global requestAnimationFrame wrapper
 */
export function requestAnimationFrame(callback: TaskCallback): TaskID {
    return getGlobalEventLoop().requestAnimationFrame(callback);
}

/**
 * Global requestIdleCallback wrapper
 */
export function requestIdleCallback(callback: TaskCallback): TaskID {
    return getGlobalEventLoop().requestIdleCallback(callback);
}

/**
 * Global clearTimeout wrapper
 */
export function clearTimeout(id: TaskID): boolean {
    return getGlobalEventLoop().clearTimeout(id);
}

/**
 * Global clearInterval wrapper
 */
export function clearInterval(id: TaskID): boolean {
    return getGlobalEventLoop().clearInterval(id);
}

/**
 * Global cancelAnimationFrame wrapper
 */
export function cancelAnimationFrame(id: TaskID): boolean {
    return getGlobalEventLoop().cancelAnimationFrame(id);
}

/**
 * Global cancelIdleCallback wrapper
 */
export function cancelIdleCallback(id: TaskID): boolean {
    return getGlobalEventLoop().cancelIdleCallback(id);
}
