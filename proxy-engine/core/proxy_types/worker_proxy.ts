// worker_proxy.ts - Multi-worker proxy

/**
 * Configuration for WorkerProxy
 */
export interface WorkerProxyConfig {
  workerCount?: number;
  distributionInterval?: number;
  workerScriptUrl?: string;
}

/**
 * WorkerProxy manages multiple worker threads for parallel request handling
 */
export class WorkerProxy {
  private workers: Worker[] = [];
  private currentWorker = 0;
  private distributionIntervalId?: number;
  private readonly config: Required<WorkerProxyConfig>;
  private running = false;

  constructor(config: WorkerProxyConfig = {}) {
    this.config = {
      workerCount: config.workerCount ?? (typeof navigator !== "undefined" ? navigator.hardwareConcurrency : 4) ?? 4,
      distributionInterval: config.distributionInterval ?? 1000,
      workerScriptUrl: config.workerScriptUrl ?? new URL("./proxy_worker.ts", import.meta.url).href,
    };
  }

  /**
   * Start the worker proxy
   */
  start(): void {
    if (this.running) {
      return;
    }

    this.running = true;
    console.log(`=== Multi-Worker Proxy ===`);
    console.log(`Spawning ${this.config.workerCount} worker threads...\n`);

    for (let i = 0; i < this.config.workerCount; i++) {
      const worker = new Worker(this.config.workerScriptUrl, {
        type: "module",
      });

      worker.onmessage = (event) => {
        console.log(`[Worker ${i}] ${event.data}`);
      };

      worker.onerror = (error) => {
        console.error(`[Worker ${i}] Error:`, error.message);
      };

      this.workers.push(worker);
      console.log(`[Main] Worker ${i} spawned`);
    }

    // Start connection distribution
    this.distributionIntervalId = setInterval(() => {
      if (this.workers.length > 0) {
        const worker = this.workers[this.currentWorker];
        worker.postMessage({ type: "handle_connection", connId: Math.random().toString(36) });
        this.currentWorker = (this.currentWorker + 1) % this.workers.length;
      }
    }, this.config.distributionInterval) as unknown as number;

    console.log("\n=== Key Benefits ===");
    console.log("- Utilizes all CPU cores");
    console.log("- True parallel processing");
    console.log("- Worker isolation (crash in one does not affect others)");
    console.log("- Scales with hardware");
  }

  /**
   * Stop the worker proxy and clean up resources
   */
  stop(): void {
    if (!this.running) {
      return;
    }

    this.running = false;

    // Clear the distribution interval
    if (this.distributionIntervalId !== undefined) {
      clearInterval(this.distributionIntervalId);
      this.distributionIntervalId = undefined;
    }

    // Terminate all workers
    for (const worker of this.workers) {
      worker.terminate();
    }
    this.workers = [];
    this.currentWorker = 0;
  }

  /**
   * Check if proxy is running
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Get number of workers
   */
  getWorkerCount(): number {
    return this.workers.length;
  }

  /**
   * Get proxy statistics
   */
  getStats() {
    return {
      running: this.running,
      workerCount: this.workers.length,
      configuredWorkerCount: this.config.workerCount,
      distributionInterval: this.config.distributionInterval,
    };
  }

  /**
   * Send a message to a specific worker
   */
  sendToWorker(workerIndex: number, message: unknown): void {
    if (workerIndex < 0 || workerIndex >= this.workers.length) {
      throw new Error(`Invalid worker index: ${workerIndex}`);
    }
    this.workers[workerIndex].postMessage(message);
  }

  /**
   * Send a message to the next worker (round-robin)
   */
  sendToNextWorker(message: unknown): void {
    if (this.workers.length === 0) {
      throw new Error("No workers available");
    }
    this.workers[this.currentWorker].postMessage(message);
    this.currentWorker = (this.currentWorker + 1) % this.workers.length;
  }
}
