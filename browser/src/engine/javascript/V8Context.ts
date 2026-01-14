/**
 * V8 Execution Context
 *
 * Represents a JavaScript execution context with global object.
 * Coordinates compilation, execution, and memory management.
 * Provides the main API for executing JavaScript code.
 */

import {
    createBoolean,
    createNativeFunction,
    createNumber,
    createObject,
    createString,
    createUndefined,
    type JSValue,
    setProperty,
} from "./JSValue.ts";
import { V8Compiler } from "./V8Compiler.ts";
import { IgnitionInterpreter } from "./IgnitionInterpreter.ts";
import { HeapFactory, V8Heap } from "./V8Heap.ts";
import {
    createGlobalExecutionContext,
    createRealm,
    type ExecutionContext,
    type Realm,
} from "./ExecutionContext.ts";

/**
 * Context configuration
 */
export interface V8ContextConfig {
    enableJIT?: boolean;
    heapSize?: {
        youngGeneration: number;
        oldGeneration: number;
    };
    enableDebugger?: boolean;
    strictMode?: boolean;
}

/**
 * Execution result
 */
export interface ExecutionResult {
    value: JSValue;
    executionTime: number;
    success: boolean;
    error?: Error;
}

/**
 * Context statistics
 */
export interface ContextStats {
    executionsCount: number;
    totalExecutionTime: number;
    averageExecutionTime: number;
    heapStats: {
        totalSize: number;
        objectCount: number;
    };
}

/**
 * V8Context
 * Main JavaScript execution context
 */
export class V8Context {
    private globalObject: JSValue;
    private realm: Realm;
    private executionContext: ExecutionContext;
    private compiler: V8Compiler;
    private interpreter: IgnitionInterpreter;
    private heap: V8Heap;
    private config: V8ContextConfig;
    private stats: ContextStats;

    constructor(config: V8ContextConfig = {}) {
        this.config = {
            enableJIT: false,
            heapSize: {
                youngGeneration: 16 * 1024 * 1024, // 16MB
                oldGeneration: 128 * 1024 * 1024, // 128MB
            },
            enableDebugger: false,
            strictMode: false,
            ...config,
        };

        // Create heap
        this.heap = new V8Heap(
            this.config.heapSize!.youngGeneration,
            this.config.heapSize!.oldGeneration,
        );

        // Create realm with global object
        this.realm = createRealm();
        this.globalObject = this.realm.globalObject;

        // Set up global object with built-ins
        this.setupGlobalObject();

        // Create execution context
        this.executionContext = createGlobalExecutionContext(this.realm);

        // Create compiler and interpreter
        this.compiler = new V8Compiler();
        this.interpreter = new IgnitionInterpreter(this.heap);

        // Initialize statistics
        this.stats = {
            executionsCount: 0,
            totalExecutionTime: 0,
            averageExecutionTime: 0,
            heapStats: {
                totalSize: 0,
                objectCount: 0,
            },
        };
    }

    /**
     * Execute JavaScript code
     */
    execute(code: string): ExecutionResult {
        const startTime = performance.now();

        try {
            // Compile code to bytecode
            const compiled = this.compiler.compile(code);

            // Execute bytecode
            const result = this.interpreter.executeFunction(compiled);

            const endTime = performance.now();
            const executionTime = endTime - startTime;

            // Update statistics
            this.stats.executionsCount++;
            this.stats.totalExecutionTime += executionTime;
            this.stats.averageExecutionTime = this.stats.totalExecutionTime /
                this.stats.executionsCount;
            this.updateHeapStats();

            return {
                value: result,
                executionTime,
                success: true,
            };
        } catch (error) {
            const endTime = performance.now();
            const executionTime = endTime - startTime;

            return {
                value: createUndefined(),
                executionTime,
                success: false,
                error: error as Error,
            };
        }
    }

    /**
     * Execute JavaScript expression
     * Returns the result of evaluating the expression
     */
    eval(expression: string): JSValue {
        const result = this.execute(expression);
        if (!result.success && result.error) {
            throw result.error;
        }
        return result.value;
    }

    /**
     * Execute JavaScript code asynchronously
     */
    async executeAsync(code: string): Promise<ExecutionResult> {
        // Wrap in promise to allow async execution
        return new Promise((resolve) => {
            setTimeout(() => {
                const result = this.execute(code);
                resolve(result);
            }, 0);
        });
    }

    /**
     * Set up global object with built-in functions
     */
    private setupGlobalObject(): void {
        // Console object
        const consoleObj = createObject(null);
        setProperty(
            consoleObj,
            "log",
            createNativeFunction("log", (...args) => {
                console.log(...args.map((arg) => this.jsValueToNative(arg)));
                return createUndefined();
            }, 0),
        );
        setProperty(
            consoleObj,
            "error",
            createNativeFunction("error", (...args) => {
                console.error(...args.map((arg) => this.jsValueToNative(arg)));
                return createUndefined();
            }, 0),
        );
        setProperty(
            consoleObj,
            "warn",
            createNativeFunction("warn", (...args) => {
                console.warn(...args.map((arg) => this.jsValueToNative(arg)));
                return createUndefined();
            }, 0),
        );
        setProperty(this.globalObject, "console", consoleObj);

        // Global functions
        setProperty(
            this.globalObject,
            "parseInt",
            createNativeFunction("parseInt", (value) => {
                const str = this.jsValueToNative(value) as string;
                return createNumber(parseInt(str, 10));
            }, 1),
        );

        setProperty(
            this.globalObject,
            "parseFloat",
            createNativeFunction("parseFloat", (value) => {
                const str = this.jsValueToNative(value) as string;
                return createNumber(parseFloat(str));
            }, 1),
        );

        setProperty(
            this.globalObject,
            "isNaN",
            createNativeFunction("isNaN", (value) => {
                const num = this.jsValueToNative(value) as number;
                return createBoolean(isNaN(num));
            }, 1),
        );

        setProperty(
            this.globalObject,
            "isFinite",
            createNativeFunction("isFinite", (value) => {
                const num = this.jsValueToNative(value) as number;
                return createBoolean(isFinite(num));
            }, 1),
        );

        // Math object
        const mathObj = createObject(null);
        setProperty(mathObj, "PI", createNumber(Math.PI));
        setProperty(mathObj, "E", createNumber(Math.E));
        setProperty(
            mathObj,
            "abs",
            createNativeFunction("abs", (value) => {
                const num = this.jsValueToNative(value) as number;
                return createNumber(Math.abs(num));
            }, 1),
        );
        setProperty(
            mathObj,
            "sqrt",
            createNativeFunction("sqrt", (value) => {
                const num = this.jsValueToNative(value) as number;
                return createNumber(Math.sqrt(num));
            }, 1),
        );
        setProperty(
            mathObj,
            "floor",
            createNativeFunction("floor", (value) => {
                const num = this.jsValueToNative(value) as number;
                return createNumber(Math.floor(num));
            }, 1),
        );
        setProperty(
            mathObj,
            "ceil",
            createNativeFunction("ceil", (value) => {
                const num = this.jsValueToNative(value) as number;
                return createNumber(Math.ceil(num));
            }, 1),
        );
        setProperty(
            mathObj,
            "round",
            createNativeFunction("round", (value) => {
                const num = this.jsValueToNative(value) as number;
                return createNumber(Math.round(num));
            }, 1),
        );
        setProperty(
            mathObj,
            "random",
            createNativeFunction("random", () => {
                return createNumber(Math.random());
            }, 0),
        );
        setProperty(this.globalObject, "Math", mathObj);

        // Set global this
        setProperty(this.globalObject, "globalThis", this.globalObject);
        setProperty(this.globalObject, "window", this.globalObject);
        setProperty(this.globalObject, "self", this.globalObject);

        // Undefined
        setProperty(this.globalObject, "undefined", createUndefined());
    }

    /**
     * Convert JSValue to native JavaScript value
     */
    private jsValueToNative(value: JSValue): unknown {
        switch (value.type) {
            case "undefined":
                return undefined;
            case "null":
                return null;
            case "boolean":
            case "number":
            case "string":
                return value.value;
            case "object":
                // Simplified - would recursively convert
                return "[object Object]";
            case "function":
                return "[function]";
            default:
                return undefined;
        }
    }

    /**
     * Update heap statistics
     */
    private updateHeapStats(): void {
        const heapStats = this.heap.getStats();
        this.stats.heapStats = {
            totalSize: heapStats.totalSize,
            objectCount: heapStats.objectCount,
        };
    }

    /**
     * Get global object
     */
    getGlobal(): JSValue {
        return this.globalObject;
    }

    /**
     * Get realm
     */
    getRealm(): Realm {
        return this.realm;
    }

    /**
     * Get execution context
     */
    getExecutionContext(): ExecutionContext {
        return this.executionContext;
    }

    /**
     * Get heap
     */
    getHeap(): V8Heap {
        return this.heap;
    }

    /**
     * Get compiler
     */
    getCompiler(): V8Compiler {
        return this.compiler;
    }

    /**
     * Get interpreter
     */
    getInterpreter(): IgnitionInterpreter {
        return this.interpreter;
    }

    /**
     * Get context statistics
     */
    getStats(): ContextStats {
        return { ...this.stats };
    }

    /**
     * Get configuration
     */
    getConfig(): V8ContextConfig {
        return { ...this.config };
    }

    /**
     * Get global object
     */
    get global(): JSValue {
        return this.globalObject;
    }

    /**
     * Set global variable
     */
    setGlobal(name: string, value: JSValue): void {
        setProperty(this.globalObject, name, value);
        this.interpreter.setGlobal(name, value);
    }

    /**
     * Get global variable
     */
    getGlobalVariable(name: string): JSValue {
        return this.interpreter.getGlobal(name);
    }

    /**
     * Run garbage collection
     */
    gc(): void {
        this.heap.gc();
        this.updateHeapStats();
    }

    /**
     * Reset context
     * Clears all state and reinitializes
     */
    reset(): void {
        // Clear heap
        this.heap.clear();

        // Reset interpreter
        this.interpreter.reset();

        // Recreate realm and global object
        this.realm = createRealm();
        this.globalObject = this.realm.globalObject;
        this.setupGlobalObject();

        // Recreate execution context
        this.executionContext = createGlobalExecutionContext(this.realm);

        // Reset statistics
        this.stats = {
            executionsCount: 0,
            totalExecutionTime: 0,
            averageExecutionTime: 0,
            heapStats: {
                totalSize: 0,
                objectCount: 0,
            },
        };
    }

    /**
     * Dispose context
     * Cleans up resources
     */
    dispose(): void {
        this.heap.dispose();
        this.interpreter.reset();
    }

    /**
     * Check if context is valid
     */
    isValid(): boolean {
        return this.globalObject !== null && this.heap !== null;
    }

    /**
     * Compile code without executing
     */
    compile(code: string) {
        return this.compiler.compile(code);
    }

    /**
     * Parse code to AST without compiling
     */
    parse(code: string) {
        return this.compiler.parse(code);
    }

    /**
     * Tokenize code without parsing
     */
    tokenize(code: string) {
        return this.compiler.tokenize(code);
    }
}

/**
 * Context factory
 * Creates context instances with different configurations
 */
export class ContextFactory {
    /**
     * Create default context
     */
    static createDefault(): V8Context {
        return new V8Context();
    }

    /**
     * Create context for development
     */
    static createDevelopment(): V8Context {
        return new V8Context({
            enableDebugger: true,
            strictMode: true,
        });
    }

    /**
     * Create context for production
     */
    static createProduction(): V8Context {
        return new V8Context({
            enableJIT: true,
            heapSize: {
                youngGeneration: 32 * 1024 * 1024, // 32MB
                oldGeneration: 256 * 1024 * 1024, // 256MB
            },
            strictMode: true,
        });
    }

    /**
     * Create context for testing
     */
    static createForTesting(): V8Context {
        return new V8Context({
            heapSize: {
                youngGeneration: 1 * 1024 * 1024, // 1MB
                oldGeneration: 8 * 1024 * 1024, // 8MB
            },
            strictMode: true,
        });
    }

    /**
     * Create context with custom configuration
     */
    static createWithConfig(config: V8ContextConfig): V8Context {
        return new V8Context(config);
    }
}
