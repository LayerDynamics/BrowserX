/**
 * Sandbox Worker Script
 * Runs in an isolated Deno.Worker with restricted permissions
 *
 * This worker receives code and context via message passing,
 * executes the code in a restricted environment, and returns the result.
 *
 * Security features:
 * - Runs in separate V8 isolate (true memory isolation)
 * - No access to file system, network, or environment
 * - No access to parent process memory
 * - Can be terminated on timeout
 * - Restricted global scope
 */

// Type definitions for worker messages
interface ExecutionRequest {
  type: "execute";
  id: string;
  code: string;
  context: {
    globals: Record<string, unknown>;
    functions: Record<string, string>; // Serialized function bodies (name -> function.toString())
    apis: string[]; // API names for reference
  };
  timeout: number;
}

interface ExecutionResponse {
  type: "result" | "error";
  id: string;
  result?: unknown;
  error?: {
    message: string;
    stack?: string;
  };
  timing: {
    startTime: number;
    endTime: number;
    duration: number;
  };
  memoryUsage?: {
    heapUsed: number;
    heapTotal: number;
  };
  logs?: Array<{
    level: "log" | "warn" | "error" | "info" | "debug" | "table" | "trace" | "assert" | "dir" | "group" | "groupEnd";
    args: unknown[];
    timestamp: number;
    groupDepth?: number;
  }>;
}

// Log buffer for capturing console output
interface LogEntry {
  level: "log" | "warn" | "error" | "info" | "debug" | "table" | "trace" | "assert" | "dir" | "group" | "groupEnd";
  args: unknown[];
  timestamp: number;
  groupDepth?: number;
}

let logBuffer: LogEntry[] = [];

// State for console.time/timeEnd
const timers: Map<string, number> = new Map();

// State for console.count/countReset
const counters: Map<string, number> = new Map();

// State for console.group depth tracking
let groupDepth = 0;

// Clear log buffer and reset state for new execution
function clearLogBuffer(): void {
  logBuffer = [];
  timers.clear();
  counters.clear();
  groupDepth = 0;
}

// Get and clear log buffer
function flushLogBuffer(): LogEntry[] {
  const logs = logBuffer;
  logBuffer = [];
  return logs;
}

// Create a console that buffers all output
function createBufferedConsole(): Console {
  const createLogger = (level: LogEntry["level"]) => {
    return (...args: unknown[]) => {
      // Serialize args to ensure they can be transferred
      const serializedArgs = args.map((arg) => {
        try {
          // Try to clone for structured transfer
          if (
            typeof arg === "string" ||
            typeof arg === "number" ||
            typeof arg === "boolean" ||
            arg === null ||
            arg === undefined
          ) {
            return arg;
          }
          // For objects, stringify and parse to ensure serializable
          return JSON.parse(JSON.stringify(arg));
        } catch {
          return String(arg);
        }
      });

      logBuffer.push({
        level,
        args: serializedArgs,
        timestamp: performance.now(),
      });
    };
  };

  // Helper to serialize args safely
  const serializeArgs = (args: unknown[]): unknown[] => {
    return args.map((arg) => {
      try {
        if (
          typeof arg === "string" ||
          typeof arg === "number" ||
          typeof arg === "boolean" ||
          arg === null ||
          arg === undefined
        ) {
          return arg;
        }
        return JSON.parse(JSON.stringify(arg));
      } catch {
        return String(arg);
      }
    });
  };

  return {
    log: createLogger("log"),
    warn: createLogger("warn"),
    error: createLogger("error"),
    info: createLogger("info"),
    debug: createLogger("debug"),

    // assert - logs error only if assertion fails
    assert: (condition?: boolean, ...args: unknown[]) => {
      if (!condition) {
        const message = args.length > 0 ? args : ["Assertion failed"];
        logBuffer.push({
          level: "assert",
          args: serializeArgs(["Assertion failed:", ...message]),
          timestamp: performance.now(),
          groupDepth,
        });
      }
    },

    // clear - clears the log buffer (within this execution)
    clear: () => {
      logBuffer.length = 0;
    },

    // count - logs the number of times count() has been called with this label
    count: (label: string = "default") => {
      const count = (counters.get(label) || 0) + 1;
      counters.set(label, count);
      logBuffer.push({
        level: "log",
        args: [`${label}: ${count}`],
        timestamp: performance.now(),
        groupDepth,
      });
    },

    // countReset - resets the counter for a label
    countReset: (label: string = "default") => {
      counters.delete(label);
    },

    // dir - displays object properties
    dir: (obj: unknown) => {
      logBuffer.push({
        level: "dir",
        args: serializeArgs([obj]),
        timestamp: performance.now(),
        groupDepth,
      });
    },

    // dirxml - same as dir for non-DOM environments
    dirxml: (obj: unknown) => {
      logBuffer.push({
        level: "dir",
        args: serializeArgs([obj]),
        timestamp: performance.now(),
        groupDepth,
      });
    },

    // group - starts a new inline group
    group: (...args: unknown[]) => {
      logBuffer.push({
        level: "group",
        args: serializeArgs(args.length > 0 ? args : ["group"]),
        timestamp: performance.now(),
        groupDepth,
      });
      groupDepth++;
    },

    // groupCollapsed - starts a collapsed group (same as group in buffered output)
    groupCollapsed: (...args: unknown[]) => {
      logBuffer.push({
        level: "group",
        args: serializeArgs(args.length > 0 ? args : ["group"]),
        timestamp: performance.now(),
        groupDepth,
      });
      groupDepth++;
    },

    // groupEnd - exits the current inline group
    groupEnd: () => {
      if (groupDepth > 0) {
        groupDepth--;
      }
      logBuffer.push({
        level: "groupEnd",
        args: [],
        timestamp: performance.now(),
        groupDepth,
      });
    },

    // table - displays tabular data
    table: (data: unknown, columns?: string[]) => {
      logBuffer.push({
        level: "table",
        args: serializeArgs(columns ? [data, columns] : [data]),
        timestamp: performance.now(),
        groupDepth,
      });
    },

    // time - starts a timer with a label
    time: (label: string = "default") => {
      timers.set(label, performance.now());
    },

    // timeEnd - stops a timer and logs the elapsed time
    timeEnd: (label: string = "default") => {
      const startTime = timers.get(label);
      if (startTime !== undefined) {
        const duration = performance.now() - startTime;
        timers.delete(label);
        logBuffer.push({
          level: "log",
          args: [`${label}: ${duration.toFixed(3)}ms`],
          timestamp: performance.now(),
          groupDepth,
        });
      } else {
        logBuffer.push({
          level: "warn",
          args: [`Timer '${label}' does not exist`],
          timestamp: performance.now(),
          groupDepth,
        });
      }
    },

    // timeLog - logs the current value of a timer without stopping it
    timeLog: (label: string = "default", ...args: unknown[]) => {
      const startTime = timers.get(label);
      if (startTime !== undefined) {
        const duration = performance.now() - startTime;
        logBuffer.push({
          level: "log",
          args: [`${label}: ${duration.toFixed(3)}ms`, ...serializeArgs(args)],
          timestamp: performance.now(),
          groupDepth,
        });
      } else {
        logBuffer.push({
          level: "warn",
          args: [`Timer '${label}' does not exist`],
          timestamp: performance.now(),
          groupDepth,
        });
      }
    },

    // trace - outputs a stack trace
    trace: (...args: unknown[]) => {
      const stack = new Error().stack || "";
      logBuffer.push({
        level: "trace",
        args: serializeArgs([...args, "\n" + stack]),
        timestamp: performance.now(),
        groupDepth,
      });
    },

    // profile/profileEnd/timeStamp - profiler methods (no-op in sandbox)
    profile: () => {},
    profileEnd: () => {},
    timeStamp: () => {},
  } as Console;
}

// Reconstruct functions from serialized form
function reconstructFunctions(
  serializedFns: Record<string, string>,
): Record<string, Function> {
  const functions: Record<string, Function> = {};

  for (const [name, bodyString] of Object.entries(serializedFns)) {
    try {
      // Reconstruct function from its string body
      // The body should be a full function expression or arrow function
      // deno-lint-ignore no-new-func
      functions[name] = new Function(`return (${bodyString})`)();
    } catch (error) {
      console.error(
        `Failed to reconstruct function ${name}:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  return functions;
}

// Create a restricted global scope for code execution
function createRestrictedGlobals(
  context: Record<string, unknown>,
  serializedFunctions?: Record<string, string>,
): Record<string, unknown> {
  // Reconstruct any serialized functions
  const reconstructedFns = serializedFunctions
    ? reconstructFunctions(serializedFunctions)
    : {};

  // Safe built-ins that are allowed
  const safeBuiltins: Record<string, unknown> = {
    // Math operations
    Math: Math,
    Number: Number,
    String: String,
    Boolean: Boolean,
    Array: Array,
    Object: Object,
    Map: Map,
    Set: Set,
    WeakMap: WeakMap,
    WeakSet: WeakSet,
    Date: Date,
    RegExp: RegExp,
    JSON: JSON,

    // Error types
    Error: Error,
    TypeError: TypeError,
    RangeError: RangeError,
    SyntaxError: SyntaxError,
    ReferenceError: ReferenceError,

    // Utility
    parseInt: parseInt,
    parseFloat: parseFloat,
    isNaN: isNaN,
    isFinite: isFinite,
    encodeURI: encodeURI,
    decodeURI: decodeURI,
    encodeURIComponent: encodeURIComponent,
    decodeURIComponent: decodeURIComponent,

    // Buffered console - captures all output
    console: createBufferedConsole(),

    // Promises (needed for async code)
    Promise: Promise,

    // Typed arrays (needed for binary data)
    Uint8Array: Uint8Array,
    Uint16Array: Uint16Array,
    Uint32Array: Uint32Array,
    Int8Array: Int8Array,
    Int16Array: Int16Array,
    Int32Array: Int32Array,
    Float32Array: Float32Array,
    Float64Array: Float64Array,
    ArrayBuffer: ArrayBuffer,
    DataView: DataView,

    // Explicitly undefined dangerous globals
    eval: undefined,
    Function: undefined,
    Deno: undefined,
    globalThis: undefined,
    self: undefined,
    window: undefined,
    fetch: undefined,
    XMLHttpRequest: undefined,
    WebSocket: undefined,
    Worker: undefined,
    SharedWorker: undefined,
    importScripts: undefined,
    require: undefined,
    module: undefined,
    exports: undefined,
    __dirname: undefined,
    __filename: undefined,
    process: undefined,
  };

  // Merge safe builtins with reconstructed functions and user-provided context
  // User context takes precedence (allows overriding)
  return {
    ...safeBuiltins,
    ...reconstructedFns,
    ...context,
  };
}

// Execute code in restricted environment
function executeCode(
  code: string,
  globals: Record<string, unknown>,
): unknown {
  const paramNames = Object.keys(globals);
  const paramValues = Object.values(globals);

  // The outer function is NOT strict mode, which allows us to:
  // 1. Use reserved words like 'eval', 'arguments' as parameter names
  // 2. Shadow dangerous globals by passing them as undefined parameters
  //
  // The user code runs inside a strict mode IIFE, which provides:
  // 1. Strict mode protections for user code
  // 2. Prevention of accidental global creation
  // 3. Better error messages
  //
  // This two-layer approach lets us both shadow dangerous globals AND
  // run user code in strict mode.
  const wrappedCode = `
    // User code runs in strict mode IIFE
    return (function() {
      "use strict";
      ${code}
    })();
  `;

  // Create function with restricted scope
  // deno-lint-ignore no-new-func
  const executor = new Function(...paramNames, wrappedCode);

  // Execute with provided values
  return executor(...paramValues);
}

// Async wrapper for code that returns promises
async function executeCodeAsync(
  code: string,
  globals: Record<string, unknown>,
): Promise<unknown> {
  const result = executeCode(code, globals);

  // If result is a promise, await it
  if (result instanceof Promise) {
    return await result;
  }

  return result;
}

// Get worker self reference with proper typing
const workerSelf = self as unknown as {
  onmessage: ((event: MessageEvent<ExecutionRequest>) => void) | null;
  postMessage: (message: ExecutionResponse | { type: "ready" }) => void;
};

// Message handler
workerSelf.onmessage = async (event: MessageEvent<ExecutionRequest>) => {
  const request = event.data;

  if (request.type !== "execute") {
    return;
  }

  // Clear log buffer for this execution
  clearLogBuffer();

  const startTime = performance.now();
  let response: ExecutionResponse;

  try {
    // Create restricted globals with serialized functions
    const restrictedGlobals = createRestrictedGlobals(
      request.context.globals,
      request.context.functions,
    );

    // Execute the code
    const result = await executeCodeAsync(request.code, restrictedGlobals);

    const endTime = performance.now();

    response = {
      type: "result",
      id: request.id,
      result: result,
      timing: {
        startTime,
        endTime,
        duration: endTime - startTime,
      },
      logs: flushLogBuffer(),
    };
  } catch (error) {
    const endTime = performance.now();

    response = {
      type: "error",
      id: request.id,
      error: {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      timing: {
        startTime,
        endTime,
        duration: endTime - startTime,
      },
      logs: flushLogBuffer(),
    };
  }

  // Send response back to main thread
  workerSelf.postMessage(response);
};

// Signal that worker is ready
workerSelf.postMessage({ type: "ready" });
