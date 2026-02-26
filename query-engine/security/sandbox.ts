/**
 * Query sandbox for secure execution
 * Provides V8 isolate for sandboxed query execution via Deno.Worker
 *
 * Security model:
 * - Code executes in a separate Deno.Worker (true V8 isolate)
 * - Worker spawned with no permissions (--no-permissions)
 * - Message passing for communication (no shared memory)
 * - Timeout enforcement via worker termination
 * - Restricted global scope in worker
 */

import { DataType } from "../types/primitives.ts";

/**
 * Sandbox configuration
 */
export interface SandboxConfig {
  enabled: boolean;
  timeout: number; // Maximum execution time in ms
  memoryLimit: number; // Maximum memory in bytes
  allowedAPIs: string[]; // Whitelist of allowed APIs
  workerPoolSize: number; // Number of workers to maintain in pool
  /**
   * Explicit acknowledgment required to run unsandboxed code.
   * Must be set to "I_UNDERSTAND_THE_SECURITY_RISKS" to allow unsandboxed execution.
   * This is a safeguard to prevent accidental unsandboxed execution in production.
   */
  allowUnsandboxedExecution?: "I_UNDERSTAND_THE_SECURITY_RISKS";
  /**
   * Environment mode. When set to "production", unsandboxed execution is blocked
   * regardless of other settings.
   */
  environment?: "development" | "test" | "production";
}

/**
 * Sandbox execution context
 */
export interface SandboxContext {
  globals: Record<string, unknown>;
  apis: Record<string, Function>;
}

/**
 * Worker execution request message
 */
interface WorkerExecutionRequest {
  type: "execute";
  id: string;
  code: string;
  context: {
    globals: Record<string, unknown>;
    functions: Record<string, string>; // Serialized function bodies
    apis: string[];
  };
  timeout: number;
}

/**
 * Log entry from sandboxed execution
 */
export interface SandboxLogEntry {
  level: "log" | "warn" | "error" | "info" | "debug" | "table" | "trace" | "assert" | "dir" | "group" | "groupEnd";
  args: unknown[];
  timestamp: number;
  groupDepth?: number;
}

/**
 * Worker execution response message
 */
interface WorkerExecutionResponse {
  type: "result" | "error" | "ready";
  id?: string;
  result?: unknown;
  error?: {
    message: string;
    stack?: string;
  };
  timing?: {
    startTime: number;
    endTime: number;
    duration: number;
  };
  memoryUsage?: {
    heapUsed: number;
    heapTotal: number;
  };
  logs?: SandboxLogEntry[];
}

/**
 * Pooled worker instance
 */
interface PooledWorker {
  worker: Worker;
  busy: boolean;
  createdAt: number;
  requestCount: number;
}

/**
 * Query sandbox
 */
export class QuerySandbox {
  private config: SandboxConfig;
  private workerPool: PooledWorker[] = [];
  private pendingRequests: Map<
    string,
    {
      resolve: (value: unknown) => void;
      reject: (error: Error) => void;
      timeoutId: number;
    }
  > = new Map();
  private requestCounter = 0;
  private workerScriptUrl: string;

  constructor(config: Partial<SandboxConfig> = {}) {
    // Detect environment from Deno env or config
    const detectedEnv = this.detectEnvironment();

    this.config = {
      enabled: config.enabled ?? true,
      timeout: config.timeout ?? 30000,
      memoryLimit: config.memoryLimit ?? 100 * 1024 * 1024, // 100MB
      allowedAPIs: config.allowedAPIs ?? [],
      workerPoolSize: config.workerPoolSize ?? 2,
      allowUnsandboxedExecution: config.allowUnsandboxedExecution,
      environment: config.environment ?? detectedEnv,
    };

    // Resolve worker script URL relative to this module
    this.workerScriptUrl = new URL("./sandbox-worker.ts", import.meta.url).href;
  }

  /**
   * Detect environment from Deno environment variables
   */
  private detectEnvironment(): "development" | "test" | "production" {
    try {
      // Access Deno global safely (may not exist in all environments)
      const denoGlobal = globalThis as { Deno?: { env: { get(key: string): string | undefined } } };

      if (!denoGlobal.Deno?.env) {
        return "development";
      }

      // Check common environment variable patterns
      const nodeEnv = denoGlobal.Deno.env.get("NODE_ENV");
      const denoEnv = denoGlobal.Deno.env.get("DENO_ENV");
      const env = denoGlobal.Deno.env.get("ENV") || denoGlobal.Deno.env.get("ENVIRONMENT");

      const envValue = (nodeEnv || denoEnv || env || "").toLowerCase();

      if (envValue === "production" || envValue === "prod") {
        return "production";
      }
      if (envValue === "test" || envValue === "testing") {
        return "test";
      }
      return "development";
    } catch {
      // If we can't read env vars (permissions), assume development
      return "development";
    }
  }

  /**
   * Execute code in sandbox
   */
  async execute<T>(
    code: string,
    context: SandboxContext,
    timeout?: number,
  ): Promise<T> {
    if (!this.config.enabled) {
      // Sandbox is disabled - apply security safeguards before allowing unsandboxed execution
      return this.handleUnsandboxedExecution(code, context);
    }

    const executionTimeout = timeout || this.config.timeout;

    // Create promise with timeout that can be cancelled
    let timeoutId: number | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(
        () => reject(new Error("Sandbox execution timeout")),
        executionTimeout,
      );
    });

    const executionPromise = this.executeInIsolate<T>(code, context);

    try {
      // Race between execution and timeout
      const result = await Promise.race([executionPromise, timeoutPromise]);
      // Clear the timeout if execution won the race
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
      return result as T;
    } catch (error) {
      // Clear the timeout even if execution threw (unless it was the timeout itself)
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
      throw error;
    }
  }

  /**
   * Handle unsandboxed execution with security safeguards
   */
  private handleUnsandboxedExecution<T>(
    code: string,
    context: SandboxContext,
  ): T {
    // SAFEGUARD 1: Block in production environment
    if (this.config.environment === "production") {
      throw new Error(
        "SECURITY ERROR: Unsandboxed code execution is BLOCKED in production environment. " +
        "Sandbox must be enabled (config.enabled = true) for production use. " +
        "This is a critical security feature that cannot be bypassed in production."
      );
    }

    // SAFEGUARD 2: Require explicit acknowledgment
    if (this.config.allowUnsandboxedExecution !== "I_UNDERSTAND_THE_SECURITY_RISKS") {
      throw new Error(
        "SECURITY ERROR: Unsandboxed code execution requires explicit acknowledgment. " +
        "To enable unsandboxed execution in non-production environments, you must set: " +
        'config.allowUnsandboxedExecution = "I_UNDERSTAND_THE_SECURITY_RISKS". ' +
        "WARNING: This bypasses all security isolation and should NEVER be used with untrusted code."
      );
    }

    // SAFEGUARD 3: Log detailed warning with context
    console.warn(
      "\n" +
      "╔══════════════════════════════════════════════════════════════════════════════╗\n" +
      "║  ⚠️  SECURITY WARNING: EXECUTING CODE WITHOUT SANDBOX                         ║\n" +
      "╠══════════════════════════════════════════════════════════════════════════════╣\n" +
      "║  Environment: " + (this.config.environment || "unknown").padEnd(62) + "║\n" +
      "║  Code Length: " + String(code.length + " characters").padEnd(62) + "║\n" +
      "║  Timestamp:   " + new Date().toISOString().padEnd(62) + "║\n" +
      "║                                                                              ║\n" +
      "║  This execution bypasses all security isolation. The code has full access   ║\n" +
      "║  to the runtime environment. Only use with TRUSTED code in development.     ║\n" +
      "╚══════════════════════════════════════════════════════════════════════════════╝\n"
    );

    // SAFEGUARD 4: Validate code before execution
    const validation = this.validate(code);
    if (!validation.valid) {
      throw new Error(
        "SECURITY ERROR: Code validation failed before unsandboxed execution:\n" +
        validation.errors.map(e => `  - ${e}`).join("\n")
      );
    }

    return this.executeUnsandboxed(code, context);
  }

  /**
   * Create a new sandboxed worker with no permissions
   */
  private createWorker(): PooledWorker {
    const worker = new Worker(this.workerScriptUrl, {
      type: "module",
      // Deno worker permissions - completely restricted
      deno: {
        permissions: {
          read: false,
          write: false,
          net: false,
          env: false,
          run: false,
          ffi: false,
          hrtime: false,
        },
      },
    } as WorkerOptions);

    const pooledWorker: PooledWorker = {
      worker,
      busy: false,
      createdAt: Date.now(),
      requestCount: 0,
    };

    // Set up message handler for this worker
    worker.onmessage = (event: MessageEvent<WorkerExecutionResponse>) => {
      this.handleWorkerMessage(pooledWorker, event.data);
    };

    worker.onerror = (error: ErrorEvent) => {
      console.error("Worker error:", error.message);
      // Mark worker as not busy so it can be replaced
      pooledWorker.busy = false;
    };

    return pooledWorker;
  }

  /**
   * Handle message from worker
   */
  private handleWorkerMessage(
    pooledWorker: PooledWorker,
    response: WorkerExecutionResponse,
  ): void {
    if (response.type === "ready") {
      // Worker is ready, nothing to do
      return;
    }

    if (!response.id) {
      return;
    }

    const pending = this.pendingRequests.get(response.id);
    if (!pending) {
      return;
    }

    // Clear timeout
    clearTimeout(pending.timeoutId);
    this.pendingRequests.delete(response.id);

    // Mark worker as available
    pooledWorker.busy = false;

    if (response.type === "error") {
      pending.reject(
        new Error(
          `Sandbox execution error: ${response.error?.message || "Unknown error"}`,
        ),
      );
    } else {
      pending.resolve(response.result);
    }
  }

  /**
   * Get an available worker from the pool or create a new one
   */
  private async getWorker(): Promise<PooledWorker> {
    // Find an available worker
    let availableWorker = this.workerPool.find((w) => !w.busy);

    if (!availableWorker) {
      // Create new worker if pool isn't at capacity
      if (this.workerPool.length < this.config.workerPoolSize) {
        availableWorker = this.createWorker();
        this.workerPool.push(availableWorker);

        // Wait for worker to be ready
        await new Promise<void>((resolve) => {
          const originalHandler = availableWorker!.worker.onmessage;
          availableWorker!.worker.onmessage = (
            event: MessageEvent<WorkerExecutionResponse>,
          ) => {
            if (event.data.type === "ready") {
              availableWorker!.worker.onmessage = originalHandler;
              resolve();
            } else if (originalHandler) {
              originalHandler.call(availableWorker!.worker, event);
            }
          };
        });
      } else {
        // Wait for a worker to become available (with 30s timeout)
        await new Promise<void>((resolve, reject) => {
          const maxWaitMs = 30000;
          const startWait = Date.now();
          const checkInterval = setInterval(() => {
            const worker = this.workerPool.find((w) => !w.busy);
            if (worker) {
              clearInterval(checkInterval);
              availableWorker = worker;
              resolve();
            } else if (Date.now() - startWait >= maxWaitMs) {
              clearInterval(checkInterval);
              reject(new Error("Timed out waiting for available sandbox worker (30s)"));
            }
          }, 10);
        });
      }
    }

    return availableWorker!;
  }

  /**
   * Execute in V8 isolate (sandboxed) using Deno.Worker
   */
  private async executeInIsolate<T>(
    code: string,
    context: SandboxContext,
  ): Promise<T> {
    const worker = await this.getWorker();
    worker.busy = true;
    worker.requestCount++;

    const requestId = `req_${++this.requestCounter}_${Date.now()}`;

    return new Promise<T>((resolve, reject) => {
      // Set up timeout
      const timeoutId = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        worker.busy = false;

        // Terminate and replace the worker on timeout
        this.terminateWorker(worker);

        reject(new Error("Sandbox execution timeout"));
      }, this.config.timeout);

      // Store pending request
      this.pendingRequests.set(requestId, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timeoutId,
      });

      // Serialize context for worker transfer
      const { globals, functions } = this.serializeContext(context);

      // Prepare execution request
      const request: WorkerExecutionRequest = {
        type: "execute",
        id: requestId,
        code,
        context: {
          globals,
          functions,
          apis: Object.keys(context.apis),
        },
        timeout: this.config.timeout,
      };

      // Send to worker
      worker.worker.postMessage(request);
    });
  }

  /**
   * Serialize context for worker transfer
   * Separates serializable values from functions (which are stringified)
   */
  private serializeContext(context: SandboxContext): {
    globals: Record<string, unknown>;
    functions: Record<string, string>;
  } {
    const globals: Record<string, unknown> = {};
    const functions: Record<string, string> = {};

    // Process globals
    for (const [key, value] of Object.entries(context.globals)) {
      if (typeof value === "function") {
        // Serialize function as string
        functions[key] = value.toString();
      } else {
        // Try to serialize, skip if it fails
        try {
          JSON.stringify(value);
          globals[key] = value;
        } catch {
          // Value is not serializable (circular refs, etc.)
          // Skip it
        }
      }
    }

    // Process APIs (all functions)
    for (const [key, fn] of Object.entries(context.apis)) {
      if (typeof fn === "function") {
        functions[key] = fn.toString();
      }
    }

    return { globals, functions };
  }

  /**
   * Terminate a worker and remove from pool
   */
  private terminateWorker(pooledWorker: PooledWorker): void {
    pooledWorker.worker.terminate();
    const index = this.workerPool.indexOf(pooledWorker);
    if (index !== -1) {
      this.workerPool.splice(index, 1);
    }
  }

  /**
   * Execute without sandbox (ONLY for testing/development)
   */
  private executeUnsandboxed<T>(
    code: string,
    context: SandboxContext,
  ): T {
    console.warn("SECURITY WARNING: Executing code without sandbox");

    // Block dangerous patterns in unsandboxed execution
    const dangerousPatterns = /\b(eval|Function|import|require|Deno|process|globalThis)\b/;
    if (dangerousPatterns.test(code)) {
      throw new Error("Code contains blocked patterns for unsandboxed execution");
    }

    const contextKeys = Object.keys(context.globals);
    const contextValues = Object.values(context.globals);

    const fn = new Function(...contextKeys, code);
    return fn(...contextValues) as T;
  }

  /**
   * Validate code before execution
   * Uses comprehensive pattern detection to prevent sandbox escapes
   */
  validate(code: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Normalize code for detection (remove string literals to avoid false positives in strings)
    // But keep the original for length check
    const normalizedCode = code
      .replace(/"(?:[^"\\]|\\.)*"/g, '""')  // Remove double-quoted strings
      .replace(/'(?:[^'\\]|\\.)*'/g, "''")  // Remove single-quoted strings
      .replace(/`(?:[^`\\]|\\.)*`/g, '``'); // Remove template literals

    // Check for dangerous patterns with descriptions
    const dangerousPatterns: Array<{ pattern: RegExp; description: string }> = [
      // Direct dangerous function calls
      { pattern: /\brequire\s*\(/, description: "Node.js require" },
      { pattern: /\bimport\s*\(/, description: "Dynamic import" },
      { pattern: /\bimport\s+/, description: "ES module import" },
      { pattern: /\beval\s*\(/, description: "eval function" },

      // Function constructor bypass attempts
      { pattern: /\bFunction\s*\(/, description: "Function constructor" },
      { pattern: /\bconstructor\s*\[/, description: "Constructor bracket access" },
      { pattern: /\[\s*['"]constructor['"]\s*\]/, description: "Constructor via bracket notation" },
      { pattern: /\.constructor\b/, description: "Constructor property access" },

      // Prototype chain manipulation
      { pattern: /__proto__/, description: "Prototype access" },
      { pattern: /prototype\s*\[/, description: "Prototype bracket access" },
      { pattern: /\[\s*['"]prototype['"]\s*\]/, description: "Prototype via bracket notation" },
      { pattern: /Object\s*\.\s*getPrototypeOf/, description: "Object.getPrototypeOf" },
      { pattern: /Object\s*\.\s*setPrototypeOf/, description: "Object.setPrototypeOf" },
      { pattern: /Reflect\s*\.\s*getPrototypeOf/, description: "Reflect.getPrototypeOf" },

      // Global access attempts
      { pattern: /\bprocess\s*\./, description: "Process access" },
      { pattern: /\[\s*['"]process['"]\s*\]/, description: "Process via bracket notation" },
      { pattern: /\bDeno\s*\./, description: "Deno namespace" },
      { pattern: /\[\s*['"]Deno['"]\s*\]/, description: "Deno via bracket notation" },
      { pattern: /\bglobalThis\s*\./, description: "globalThis access" },
      { pattern: /\bglobalThis\s*\[/, description: "globalThis bracket access" },
      { pattern: /\bwindow\s*\[/, description: "Window bracket access" },
      { pattern: /\bself\s*\[/, description: "Self bracket access" },

      // Filesystem paths
      { pattern: /__dirname\b/, description: "Directory path" },
      { pattern: /__filename\b/, description: "Filename path" },

      // setTimeout/setInterval with string argument (code execution)
      { pattern: /\bsetTimeout\s*\(\s*['"`]/, description: "setTimeout with string code" },
      { pattern: /\bsetInterval\s*\(\s*['"`]/, description: "setInterval with string code" },

      // Dangerous property access via strings
      { pattern: /\[\s*['"]eval['"]\s*\]/, description: "eval via bracket notation" },

      // WebAssembly (potential escape)
      { pattern: /\bWebAssembly\b/, description: "WebAssembly access" },
    ];

    for (const { pattern, description } of dangerousPatterns) {
      if (pattern.test(normalizedCode)) {
        errors.push(`Dangerous pattern detected: ${description}`);
      }
    }

    // Check for suspicious string concatenation that might build dangerous identifiers
    // e.g., 'ev' + 'al' or similar tricks
    const suspiciousConcat = /['"`][a-zA-Z]{1,4}['"`]\s*\+\s*['"`][a-zA-Z]{1,4}['"`]/;
    const potentialDangerous = ['eval', 'func', 'tion', 'requ', 'ire', 'proc', 'ess', 'deno', 'glob'];
    if (suspiciousConcat.test(code)) {
      // Extract the concatenated parts and check if they form dangerous words
      const matches = code.match(/['"`]([a-zA-Z]{1,6})['"`]\s*\+\s*['"`]([a-zA-Z]{1,6})['"`]/g) || [];
      for (const match of matches) {
        const parts = match.match(/['"`]([a-zA-Z]+)['"`]/g) || [];
        const combined = parts.map((p: string) => p.replace(/['"`]/g, '')).join('').toLowerCase();
        if (potentialDangerous.some(d => combined.includes(d))) {
          errors.push(`Suspicious string concatenation detected that may form dangerous identifier`);
          break;
        }
      }
    }

    // Check code length
    if (code.length > 100000) {
      errors.push("Code exceeds maximum length (100KB)");
    }

    // Check for excessive nesting (potential DoS)
    const maxNesting = 50;
    let nesting = 0;
    let maxNestingFound = 0;
    for (const char of normalizedCode) {
      if (char === '(' || char === '[' || char === '{') {
        nesting++;
        maxNestingFound = Math.max(maxNestingFound, nesting);
      } else if (char === ')' || char === ']' || char === '}') {
        nesting--;
      }
    }
    if (maxNestingFound > maxNesting) {
      errors.push(`Excessive nesting depth (${maxNestingFound} > ${maxNesting})`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get sandbox configuration
   */
  getConfig(): Readonly<SandboxConfig> {
    return { ...this.config };
  }

  /**
   * Update sandbox configuration
   */
  updateConfig(config: Partial<SandboxConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Destroy sandbox and cleanup all workers
   */
  destroy(): void {
    // Cancel all pending requests
    for (const [requestId, pending] of this.pendingRequests) {
      clearTimeout(pending.timeoutId);
      pending.reject(new Error("Sandbox destroyed"));
      this.pendingRequests.delete(requestId);
    }

    // Terminate all workers in the pool
    for (const pooledWorker of this.workerPool) {
      pooledWorker.worker.terminate();
    }
    this.workerPool = [];
  }

  /**
   * Get pool statistics
   */
  getPoolStats(): {
    totalWorkers: number;
    busyWorkers: number;
    idleWorkers: number;
    totalRequests: number;
    pendingRequests: number;
  } {
    const busyWorkers = this.workerPool.filter((w) => w.busy).length;
    const totalRequests = this.workerPool.reduce(
      (sum, w) => sum + w.requestCount,
      0,
    );

    return {
      totalWorkers: this.workerPool.length,
      busyWorkers,
      idleWorkers: this.workerPool.length - busyWorkers,
      totalRequests,
      pendingRequests: this.pendingRequests.size,
    };
  }

  /**
   * Coerce sandbox result to expected DataType
   * Used by query engine to ensure type consistency
   */
  coerceResult(value: unknown, expectedType: DataType): unknown {
    if (value === null || value === undefined) {
      return value;
    }

    switch (expectedType) {
      case DataType.STRING:
        return String(value);

      case DataType.NUMBER: {
        const numVal = Number(value);
        return isNaN(numVal) ? null : numVal;
      }

      case DataType.BOOLEAN:
        if (typeof value === "boolean") return value;
        if (typeof value === "string") {
          return value.toLowerCase() === "true" || value === "1";
        }
        return Boolean(value);

      case DataType.ARRAY:
        return Array.isArray(value) ? value : [value];

      case DataType.OBJECT:
        if (typeof value === "object" && !Array.isArray(value)) return value;
        return { value };

      case DataType.NULL:
        return null;

      default:
        return value;
    }
  }
}
