/**
 * Execution Context
 *
 * Represents JavaScript execution context with environment records and scope chain.
 * ECMAScript execution contexts track:
 * - Variable Environment (for var declarations)
 * - Lexical Environment (for let/const/function declarations)
 * - This binding
 * - Realm (global object and built-ins)
 */

import { createObject, createUndefined, type Environment, type JSValue } from "./JSValue.ts";

/**
 * Environment record types
 */
export enum EnvironmentRecordType {
    DECLARATIVE = "declarative",
    OBJECT = "object",
    FUNCTION = "function",
    GLOBAL = "global",
    MODULE = "module",
}

/**
 * Environment Record
 * Base for all environment record types
 */
export interface EnvironmentRecord {
    type: EnvironmentRecordType;
    bindings: Map<string, JSValue>;
    outer: EnvironmentRecord | null;
}

/**
 * Declarative Environment Record
 * For let, const, function, class declarations
 */
export interface DeclarativeEnvironmentRecord extends EnvironmentRecord {
    type: EnvironmentRecordType.DECLARATIVE;
    mutableBindings: Set<string>; // let, var, function
    initializedBindings: Set<string>; // Initialized bindings
}

/**
 * Object Environment Record
 * For with statements
 */
export interface ObjectEnvironmentRecord extends EnvironmentRecord {
    type: EnvironmentRecordType.OBJECT;
    bindingObject: JSValue; // The object providing bindings
}

/**
 * Function Environment Record
 * For function calls
 */
export interface FunctionEnvironmentRecord extends EnvironmentRecord {
    type: EnvironmentRecordType.FUNCTION;
    mutableBindings: Set<string>; // let, var, function
    initializedBindings: Set<string>; // Initialized bindings
    thisValue: JSValue;
    thisBindingStatus: "lexical" | "initialized" | "uninitialized";
    functionObject: JSValue;
    newTarget: JSValue | undefined;
}

/**
 * Global Environment Record
 * For global scope
 */
export interface GlobalEnvironmentRecord extends EnvironmentRecord {
    type: EnvironmentRecordType.GLOBAL;
    objectRecord: ObjectEnvironmentRecord;
    globalThisValue: JSValue;
    declarativeRecord: DeclarativeEnvironmentRecord;
}

/**
 * Execution Context
 * Represents a JavaScript execution context
 */
export interface ExecutionContext {
    variableEnvironment: EnvironmentRecord;
    lexicalEnvironment: EnvironmentRecord;
    thisBinding: JSValue;
    realm: Realm | null;
    function: JSValue | null;
    scriptOrModule: unknown | null;
}

/**
 * Realm
 * Represents a realm (global object + built-ins)
 */
export interface Realm {
    globalObject: JSValue;
    globalEnvironment: GlobalEnvironmentRecord;
    intrinsics: Map<string, JSValue>; // Built-in objects
}

/**
 * Call stack
 */
export class CallStack {
    private stack: ExecutionContext[] = [];
    private maxStackSize: number = 10000;

    /**
     * Push execution context
     */
    push(context: ExecutionContext): void {
        if (this.stack.length >= this.maxStackSize) {
            throw new Error("Maximum call stack size exceeded");
        }
        this.stack.push(context);
    }

    /**
     * Pop execution context
     */
    pop(): ExecutionContext | undefined {
        return this.stack.pop();
    }

    /**
     * Get current execution context
     */
    current(): ExecutionContext | null {
        return this.stack.length > 0 ? this.stack[this.stack.length - 1] : null;
    }

    /**
     * Get stack depth
     */
    depth(): number {
        return this.stack.length;
    }

    /**
     * Clear stack
     */
    clear(): void {
        this.stack = [];
    }

    /**
     * Get stack trace
     */
    getStackTrace(): string[] {
        const trace: string[] = [];
        for (let i = this.stack.length - 1; i >= 0; i--) {
            const context = this.stack[i];
            if (context.function) {
                // Would extract function name here
                trace.push(`at <function>`);
            } else {
                trace.push("at <global>");
            }
        }
        return trace;
    }
}

/**
 * Create declarative environment record
 */
export function createDeclarativeEnvironmentRecord(
    outer: EnvironmentRecord | null = null,
): DeclarativeEnvironmentRecord {
    return {
        type: EnvironmentRecordType.DECLARATIVE,
        bindings: new Map(),
        outer,
        mutableBindings: new Set(),
        initializedBindings: new Set(),
    };
}

/**
 * Create function environment record
 */
export function createFunctionEnvironmentRecord(
    functionObject: JSValue,
    newTarget: JSValue | undefined,
    outer: EnvironmentRecord | null = null,
): FunctionEnvironmentRecord {
    return {
        type: EnvironmentRecordType.FUNCTION,
        bindings: new Map(),
        outer,
        mutableBindings: new Set(),
        initializedBindings: new Set(),
        thisValue: createUndefined(),
        thisBindingStatus: "uninitialized",
        functionObject,
        newTarget,
    };
}

/**
 * Create global environment record
 */
export function createGlobalEnvironmentRecord(globalObject: JSValue): GlobalEnvironmentRecord {
    const declarativeRecord = createDeclarativeEnvironmentRecord(null);
    const objectRecord: ObjectEnvironmentRecord = {
        type: EnvironmentRecordType.OBJECT,
        bindings: new Map(),
        outer: null,
        bindingObject: globalObject,
    };

    return {
        type: EnvironmentRecordType.GLOBAL,
        bindings: new Map(),
        outer: null,
        objectRecord,
        globalThisValue: globalObject,
        declarativeRecord,
    };
}

/**
 * Create realm
 */
export function createRealm(): Realm {
    const globalObject = createObject(null);
    const globalEnvironment = createGlobalEnvironmentRecord(globalObject);

    return {
        globalObject,
        globalEnvironment,
        intrinsics: new Map(),
    };
}

/**
 * Create execution context
 */
export function createExecutionContext(
    environment: EnvironmentRecord,
    thisBinding: JSValue = createUndefined(),
    realm: Realm | null = null,
): ExecutionContext {
    return {
        variableEnvironment: environment,
        lexicalEnvironment: environment,
        thisBinding,
        realm,
        function: null,
        scriptOrModule: null,
    };
}

/**
 * Create global execution context
 */
export function createGlobalExecutionContext(realm: Realm): ExecutionContext {
    return {
        variableEnvironment: realm.globalEnvironment,
        lexicalEnvironment: realm.globalEnvironment,
        thisBinding: realm.globalObject,
        realm,
        function: null,
        scriptOrModule: null,
    };
}

/**
 * Create function execution context
 */
export function createFunctionExecutionContext(
    functionObject: JSValue,
    thisValue: JSValue,
    newTarget: JSValue | undefined,
    outer: EnvironmentRecord,
    realm: Realm,
): ExecutionContext {
    const funcEnv = createFunctionEnvironmentRecord(functionObject, newTarget, outer);
    funcEnv.thisValue = thisValue;
    funcEnv.thisBindingStatus = "initialized";

    return {
        variableEnvironment: funcEnv,
        lexicalEnvironment: funcEnv,
        thisBinding: thisValue,
        realm,
        function: functionObject,
        scriptOrModule: null,
    };
}

/**
 * Get identifier reference
 * Resolves identifier in scope chain
 */
export function getIdentifierReference(
    env: EnvironmentRecord | null,
    name: string,
): JSValue | null {
    if (!env) {
        return null;
    }

    // Check current environment
    if (env.bindings.has(name)) {
        return env.bindings.get(name)!;
    }

    // Check outer environment
    return getIdentifierReference(env.outer, name);
}

/**
 * Set identifier reference
 * Sets identifier in scope chain
 */
export function setIdentifierReference(
    env: EnvironmentRecord | null,
    name: string,
    value: JSValue,
): boolean {
    if (!env) {
        return false;
    }

    // Check current environment
    if (env.bindings.has(name)) {
        env.bindings.set(name, value);
        return true;
    }

    // Check outer environment
    return setIdentifierReference(env.outer, name, value);
}

/**
 * Create mutable binding
 * Creates a new binding that can be mutated (var, let)
 */
export function createMutableBinding(
    env: EnvironmentRecord,
    name: string,
    deletable: boolean = false,
): void {
    if (
        env.type === EnvironmentRecordType.DECLARATIVE ||
        env.type === EnvironmentRecordType.FUNCTION
    ) {
        const declEnv = env as DeclarativeEnvironmentRecord;
        declEnv.bindings.set(name, createUndefined());
        declEnv.mutableBindings.add(name);
    } else {
        env.bindings.set(name, createUndefined());
    }
}

/**
 * Create immutable binding
 * Creates a new binding that cannot be mutated (const)
 */
export function createImmutableBinding(
    env: EnvironmentRecord,
    name: string,
    strict: boolean = true,
): void {
    if (
        env.type === EnvironmentRecordType.DECLARATIVE ||
        env.type === EnvironmentRecordType.FUNCTION
    ) {
        const declEnv = env as DeclarativeEnvironmentRecord;
        declEnv.bindings.set(name, createUndefined());
        // Don't add to mutableBindings - makes it immutable
    } else {
        env.bindings.set(name, createUndefined());
    }
}

/**
 * Initialize binding
 * Initializes a binding with a value
 */
export function initializeBinding(
    env: EnvironmentRecord,
    name: string,
    value: JSValue,
): void {
    if (
        env.type === EnvironmentRecordType.DECLARATIVE ||
        env.type === EnvironmentRecordType.FUNCTION
    ) {
        const declEnv = env as DeclarativeEnvironmentRecord;
        declEnv.bindings.set(name, value);
        declEnv.initializedBindings.add(name);
    } else {
        env.bindings.set(name, value);
    }
}

/**
 * Set mutable binding
 * Sets value of a mutable binding
 */
export function setMutableBinding(
    env: EnvironmentRecord,
    name: string,
    value: JSValue,
    strict: boolean = false,
): void {
    if (
        env.type === EnvironmentRecordType.DECLARATIVE ||
        env.type === EnvironmentRecordType.FUNCTION
    ) {
        const declEnv = env as DeclarativeEnvironmentRecord;

        if (!declEnv.mutableBindings.has(name)) {
            if (strict) {
                throw new Error(`Cannot assign to const variable: ${name}`);
            }
            return;
        }

        if (!declEnv.initializedBindings.has(name)) {
            throw new Error(`Cannot access '${name}' before initialization`);
        }

        declEnv.bindings.set(name, value);
    } else {
        env.bindings.set(name, value);
    }
}

/**
 * Get binding value
 * Gets value of a binding
 */
export function getBindingValue(
    env: EnvironmentRecord,
    name: string,
    strict: boolean = false,
): JSValue {
    if (
        env.type === EnvironmentRecordType.DECLARATIVE ||
        env.type === EnvironmentRecordType.FUNCTION
    ) {
        const declEnv = env as DeclarativeEnvironmentRecord;

        if (!declEnv.bindings.has(name)) {
            throw new Error(`${name} is not defined`);
        }

        if (!declEnv.initializedBindings.has(name)) {
            throw new Error(`Cannot access '${name}' before initialization`);
        }

        return declEnv.bindings.get(name)!;
    }

    if (env.bindings.has(name)) {
        return env.bindings.get(name)!;
    }

    throw new Error(`${name} is not defined`);
}

/**
 * Has binding
 * Checks if binding exists
 */
export function hasBinding(env: EnvironmentRecord, name: string): boolean {
    return env.bindings.has(name);
}

/**
 * Delete binding
 * Deletes a binding
 */
export function deleteBinding(env: EnvironmentRecord, name: string): boolean {
    if (
        env.type === EnvironmentRecordType.DECLARATIVE ||
        env.type === EnvironmentRecordType.FUNCTION
    ) {
        const declEnv = env as DeclarativeEnvironmentRecord;

        if (!declEnv.bindings.has(name)) {
            return true;
        }

        // Cannot delete non-deletable bindings
        return false;
    }

    return env.bindings.delete(name);
}
