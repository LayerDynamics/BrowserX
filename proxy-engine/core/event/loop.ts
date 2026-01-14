/**
 * Event Loop
 *
 * Non-blocking event loop for async operations with macro/micro task queues
 */

/**
 * Task type
 */
export interface Task {
  id: number;
  callback: () => Promise<void>;
  priority?: "high" | "normal" | "low";
}

/**
 * Timer type
 */
export interface Timer {
  id: number;
  callback: () => void;
  delay: number;
  interval: boolean;
  nextRun: number;
}

/**
 * Event loop for managing async operations
 */
export class EventLoop {
  private macroTasks: Task[] = [];
  private microTasks: Task[] = [];
  private timers = new Map<number, Timer>();
  private running = false;
  private nextTimerId = 1;
  private nextTaskId = 1;
  private currentTime = 0;

  /**
   * Start the event loop
   */
  async run(): Promise<void> {
    if (this.running) {
      return;
    }

    this.running = true;
    this.currentTime = Date.now();

    while (this.running) {
      // Process all micro tasks first (until queue is empty)
      while (this.microTasks.length > 0) {
        const task = this.microTasks.shift();
        if (task) {
          try {
            await task.callback();
          } catch (error) {
            console.error(`[EventLoop] Micro task ${task.id} error:`, error);
          }
        }
      }

      // Process timers
      this.currentTime = Date.now();
      await this.processTimers();

      // Process one macro task (if available)
      if (this.macroTasks.length > 0) {
        const task = this.macroTasks.shift();
        if (task) {
          try {
            await task.callback();
          } catch (error) {
            console.error(`[EventLoop] Macro task ${task.id} error:`, error);
          }
        }
      } else {
        // If no tasks, wait a bit before next iteration
        await this.sleep(10);
      }

      // Update current time
      this.currentTime = Date.now();
    }
  }

  /**
   * Stop the event loop
   */
  stop(): void {
    this.running = false;
  }

  /**
   * Check if loop is running
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Schedule a callback to run after a delay
   */
  setTimeout(callback: () => void, delay: number): number {
    const id = this.nextTimerId++;
    const timer: Timer = {
      id,
      callback,
      delay,
      interval: false,
      nextRun: this.currentTime + delay,
    };

    this.timers.set(id, timer);
    return id;
  }

  /**
   * Schedule a callback to run repeatedly at intervals
   */
  setInterval(callback: () => void, interval: number): number {
    const id = this.nextTimerId++;
    const timer: Timer = {
      id,
      callback,
      delay: interval,
      interval: true,
      nextRun: this.currentTime + interval,
    };

    this.timers.set(id, timer);
    return id;
  }

  /**
   * Cancel a timeout
   */
  clearTimeout(id: number): void {
    this.timers.delete(id);
  }

  /**
   * Cancel an interval
   */
  clearInterval(id: number): void {
    this.timers.delete(id);
  }

  /**
   * Queue a macro task
   */
  queueMacroTask(task: () => Promise<void>, priority: "high" | "normal" | "low" = "normal"): number {
    const id = this.nextTaskId++;
    const taskObj: Task = {
      id,
      callback: task,
      priority,
    };

    // Insert based on priority
    if (priority === "high") {
      this.macroTasks.unshift(taskObj);
    } else if (priority === "low") {
      this.macroTasks.push(taskObj);
    } else {
      // Find insertion point for normal priority
      // (after high priority, before low priority)
      let insertIndex = this.macroTasks.findIndex(
        (t) => t.priority === "low"
      );
      if (insertIndex === -1) {
        insertIndex = this.macroTasks.length;
      }
      this.macroTasks.splice(insertIndex, 0, taskObj);
    }

    return id;
  }

  /**
   * Queue a micro task
   */
  queueMicroTask(task: () => Promise<void>): number {
    const id = this.nextTaskId++;
    const taskObj: Task = {
      id,
      callback: task,
    };

    this.microTasks.push(taskObj);
    return id;
  }

  /**
   * Cancel a queued task
   */
  cancelTask(id: number): boolean {
    // Try to find and remove from macro tasks
    const macroIndex = this.macroTasks.findIndex((t) => t.id === id);
    if (macroIndex !== -1) {
      this.macroTasks.splice(macroIndex, 1);
      return true;
    }

    // Try to find and remove from micro tasks
    const microIndex = this.microTasks.findIndex((t) => t.id === id);
    if (microIndex !== -1) {
      this.microTasks.splice(microIndex, 1);
      return true;
    }

    return false;
  }

  /**
   * Get statistics about the event loop
   */
  getStats() {
    return {
      running: this.running,
      macroTaskCount: this.macroTasks.length,
      microTaskCount: this.microTasks.length,
      timerCount: this.timers.size,
      currentTime: this.currentTime,
    };
  }

  /**
   * Clear all tasks and timers
   */
  clear(): void {
    this.macroTasks = [];
    this.microTasks = [];
    this.timers.clear();
  }

  /**
   * Process timers that are ready to run
   */
  private async processTimers(): Promise<void> {
    const now = this.currentTime;
    const readyTimers: Timer[] = [];

    // Find all timers ready to run
    for (const timer of this.timers.values()) {
      if (timer.nextRun <= now) {
        readyTimers.push(timer);
      }
    }

    // Execute ready timers
    for (const timer of readyTimers) {
      try {
        timer.callback();
      } catch (error) {
        console.error(`[EventLoop] Timer ${timer.id} error:`, error);
      }

      // Reschedule interval timers or remove one-shot timers
      if (timer.interval) {
        timer.nextRun = now + timer.delay;
      } else {
        this.timers.delete(timer.id);
      }
    }
  }

  /**
   * Sleep for a specified duration
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      globalThis.setTimeout(resolve, ms);
    });
  }
}

/**
 * Global event loop instance
 */
export const globalEventLoop = new EventLoop();
