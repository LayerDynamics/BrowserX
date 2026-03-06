/**
 * Ignition Interpreter
 *
 * Executes V8 Ignition bytecode.
 * Implements:
 * - Register-based bytecode execution
 * - Accumulator pattern
 * - Call stack management
 * - Integration with heap and execution contexts
 */

import {
  abstractEquals,
  createBoolean,
  createFunction,
  createNull,
  createNumber,
  createObject,
  createString,
  createUndefined,
  type Environment,
  type JSFunction,
  type JSValue,
  JSValueType,
  strictEquals,
  toBoolean,
  toNumber,
  toString as jsToString,
} from "./JSValue.ts";
import {
  CallStack,
  createExecutionContext,
  createFunctionEnvironmentRecord,
  createFunctionExecutionContext,
  createGlobalEnvironmentRecord,
  createRealm,
  type EnvironmentRecord,
  type ExecutionContext,
  getIdentifierReference,
  setIdentifierReference,
} from "./ExecutionContext.ts";
import { type HeapObjectID, type V8Heap } from "./V8Heap.ts";
import {
  BytecodeGenerator,
  type CompiledFunction,
  type FunctionDeclarationNode,
  type FunctionExpressionNode,
  type IdentifierNode,
  Opcode,
  Parser,
  type ProgramNode,
} from "./V8Compiler.ts";

/**
 * Interpreter state
 */
export interface InterpreterState {
  accumulator: JSValue;
  registers: JSValue[];
  programCounter: number;
  callStack: CallStack;
  currentContext: ExecutionContext;
  heap: V8Heap | null;
  globals: Map<string, JSValue>;
}

/**
 * Frame information for call stack
 */
export interface FrameInfo {
  function: CompiledFunction;
  returnAddress: number;
  savedRegisters: JSValue[];
  savedAccumulator: JSValue;
}

/**
 * Interpreter statistics
 */
export interface InterpreterStats {
  instructionsExecuted: number;
  functionsExecuted: number;
  totalExecutionTime: number;
  averageInstructionTime: number;
}

/**
 * Ignition Interpreter
 * Executes bytecode in register-based VM
 */
export class IgnitionInterpreter {
  private accumulator: JSValue;
  private registers: JSValue[];
  private programCounter: number = 0;
  private callStack: CallStack;
  private currentContext: ExecutionContext;
  private heap: V8Heap | null = null;
  private globals: Map<string, JSValue>;
  private constantPool: unknown[];
  private frameStack: FrameInfo[] = [];
  private isRunning: boolean = false;
  private stats: InterpreterStats;
  private maxInstructions: number = 10_000_000;

  /** Inline cache for GET_PROPERTY keyed by bytecode offset */
  private propertyCache = new Map<
    number,
    { objectRef: WeakRef<Record<string, unknown>>; name: string; value: JSValue }
  >();
  private cacheHits = 0;
  private cacheMisses = 0;

  /** Exception handler stack for try/catch */
  private exceptionHandlers: Array<{
    catchOffset: number;
    frameDepth: number;
    bytecodeRef: Uint8Array;
  }> = [];

  /** Caught exception value (set by THROW, read by SET_CATCH_PARAM) */
  private caughtException: JSValue = createUndefined();

  /** Pending 'this' binding for next method call (set by STA_CONTEXT_SLOT "this", consumed by CALL) */
  private pendingThisBinding: JSValue | null = null;

  constructor(heap: V8Heap | null = null) {
    this.accumulator = createUndefined();
    this.registers = [];
    this.callStack = new CallStack();
    this.globals = new Map();
    this.constantPool = [];
    this.heap = heap;

    // Create initial execution context
    const realm = createRealm();
    const globalEnv = createGlobalEnvironmentRecord(realm.globalObject);
    this.currentContext = createExecutionContext(globalEnv, realm.globalObject, realm);
    this.callStack.push(this.currentContext);

    this.stats = {
      instructionsExecuted: 0,
      functionsExecuted: 0,
      totalExecutionTime: 0,
      averageInstructionTime: 0,
    };
  }

  /**
   * Set the maximum number of instructions per execution.
   * Prevents infinite loops in user scripts from blocking the event loop.
   */
  setMaxInstructions(max: number): void {
    this.maxInstructions = max;
  }

  /**
   * Get the current instruction budget.
   */
  getMaxInstructions(): number {
    return this.maxInstructions;
  }

  /**
   * Execute bytecode
   */
  execute(bytecode: Uint8Array, constantPool: unknown[] = []): JSValue {
    this.constantPool = constantPool;
    this.programCounter = 0;
    this.isRunning = true;

    const startTime = performance.now();
    let instructionsThisExecution = 0;

    try {
      while (this.isRunning && this.programCounter < bytecode.length) {
        if (instructionsThisExecution >= this.maxInstructions) {
          throw new Error(
            `Script exceeded instruction budget of ${this.maxInstructions} instructions (possible infinite loop)`,
          );
        }
        try {
          this.executeInstruction(bytecode);
        } catch (e) {
          // If we have a JS-level exception handler, route to it
          if (this.exceptionHandlers.length > 0) {
            const msg = e instanceof Error ? e.message : String(e);
            this.throwException(createString(msg));
            this.stats.instructionsExecuted++;
            instructionsThisExecution++;
            continue;
          }
          throw e;
        }
        this.stats.instructionsExecuted++;
        instructionsThisExecution++;
      }

      const endTime = performance.now();
      this.stats.totalExecutionTime += endTime - startTime;
      this.stats.averageInstructionTime = this.stats.totalExecutionTime /
        this.stats.instructionsExecuted;

      return this.accumulator;
    } catch (error) {
      this.isRunning = false;
      throw error;
    }
  }

  /**
   * Execute compiled function
   */
  executeFunction(compiled: CompiledFunction, args: JSValue[] = []): JSValue {
    // Initialize registers
    this.registers = new Array(compiled.registerCount).fill(createUndefined());

    // Set up parameters
    for (let i = 0; i < Math.min(args.length, compiled.parameterCount); i++) {
      this.registers[i] = args[i];
    }

    // Execute bytecode
    return this.execute(compiled.bytecode, compiled.constantPool);
  }

  /**
   * Execute single instruction
   */
  private executeInstruction(bytecode: Uint8Array): void {
    const opcode = bytecode[this.programCounter++] as Opcode;

    switch (opcode) {
      // Load/Store
      case Opcode.LDA:
        this.executeLDA(bytecode);
        break;
      case Opcode.LDAR:
        this.executeLDAR(bytecode);
        break;
      case Opcode.STAR:
        this.executeSTAR(bytecode);
        break;
      case Opcode.LDA_ZERO:
        this.accumulator = createNumber(0);
        break;
      case Opcode.LDA_UNDEFINED:
        this.accumulator = createUndefined();
        break;
      case Opcode.LDA_NULL:
        this.accumulator = createNull();
        break;
      case Opcode.LDA_TRUE:
        this.accumulator = createBoolean(true);
        break;
      case Opcode.LDA_FALSE:
        this.accumulator = createBoolean(false);
        break;
      case Opcode.LDA_CONSTANT:
        this.executeLDAConstant(bytecode);
        break;

      // Arithmetic
      case Opcode.ADD:
        this.executeADD(bytecode);
        break;
      case Opcode.SUB:
        this.executeSUB(bytecode);
        break;
      case Opcode.MUL:
        this.executeMUL(bytecode);
        break;
      case Opcode.DIV:
        this.executeDIV(bytecode);
        break;
      case Opcode.MOD:
        this.executeMOD(bytecode);
        break;
      case Opcode.INC:
        this.executeINC();
        break;
      case Opcode.DEC:
        this.executeDEC();
        break;
      case Opcode.NEGATE:
        this.executeNEGATE();
        break;

      // Comparison
      case Opcode.TEST_EQUAL:
        this.executeTEST_EQUAL(bytecode);
        break;
      case Opcode.TEST_NOT_EQUAL:
        this.executeTEST_NOT_EQUAL(bytecode);
        break;
      case Opcode.TEST_STRICT_EQUAL:
        this.executeTEST_STRICT_EQUAL(bytecode);
        break;
      case Opcode.TEST_LESS_THAN:
        this.executeTEST_LESS_THAN(bytecode);
        break;
      case Opcode.TEST_GREATER_THAN:
        this.executeTEST_GREATER_THAN(bytecode);
        break;
      case Opcode.TEST_LESS_EQUAL:
        this.executeTEST_LESS_EQUAL(bytecode);
        break;
      case Opcode.TEST_GREATER_EQUAL:
        this.executeTEST_GREATER_EQUAL(bytecode);
        break;

      // Logical
      case Opcode.LOGICAL_NOT:
        this.executeLOGICAL_NOT();
        break;
      case Opcode.TO_BOOLEAN:
        this.executeTO_BOOLEAN();
        break;

      // Control flow
      case Opcode.JUMP:
        this.executeJUMP(bytecode);
        break;
      case Opcode.JUMP_IF_TRUE:
        this.executeJUMP_IF_TRUE(bytecode);
        break;
      case Opcode.JUMP_IF_FALSE:
        this.executeJUMP_IF_FALSE(bytecode);
        break;
      case Opcode.RETURN:
        this.executeRETURN();
        break;

      // Function calls
      case Opcode.CALL:
        this.executeCALL(bytecode);
        break;
      case Opcode.CONSTRUCT:
        this.executeCONSTRUCT(bytecode);
        break;

      // Property access
      case Opcode.GET_PROPERTY:
        this.executeGET_PROPERTY(bytecode);
        break;
      case Opcode.SET_PROPERTY:
        this.executeSET_PROPERTY(bytecode);
        break;
      case Opcode.GET_KEYED:
        this.executeGET_KEYED(bytecode);
        break;
      case Opcode.SET_KEYED:
        this.executeSET_KEYED(bytecode);
        break;

      // Variable access
      case Opcode.LDA_GLOBAL:
        this.executeLDA_GLOBAL(bytecode);
        break;
      case Opcode.STA_GLOBAL:
        this.executeSTA_GLOBAL(bytecode);
        break;
      case Opcode.LDA_CONTEXT_SLOT:
        this.executeLDA_CONTEXT_SLOT(bytecode);
        break;
      case Opcode.STA_CONTEXT_SLOT:
        this.executeSTA_CONTEXT_SLOT(bytecode);
        break;

      // Object creation
      case Opcode.CREATE_OBJECT:
        this.executeCREATE_OBJECT();
        break;
      case Opcode.CREATE_ARRAY:
        this.executeCREATE_ARRAY(bytecode);
        break;
      case Opcode.CREATE_CLOSURE:
        this.executeCREATE_CLOSURE(bytecode);
        break;

      // Special
      case Opcode.NOP:
        // No operation
        break;
      case Opcode.DEBUGGER:
        console.log("Debugger statement", {
          accumulator: this.accumulator,
          registers: this.registers,
        });
        break;

      // Exception handling
      case Opcode.TRY_START:
        this.executeTRY_START(bytecode);
        break;
      case Opcode.TRY_END:
        this.executeTRY_END();
        break;
      case Opcode.THROW:
        this.executeTHROW(bytecode);
        break;
      case Opcode.SET_CATCH_PARAM:
        this.executeSET_CATCH_PARAM(bytecode);
        break;

      // Operators
      case Opcode.TYPEOF:
        this.executeTYPEOF();
        break;
      case Opcode.INSTANCEOF:
        this.executeINSTANCEOF(bytecode);
        break;

      default:
        throw new Error(`Unknown opcode: ${opcode}`);
    }
  }

  /**
   * LDA - Load Direct Accumulator
   */
  private executeLDA(bytecode: Uint8Array): void {
    const value = this.readOperand(bytecode);
    this.accumulator = createNumber(value);
  }

  /**
   * LDAR - Load Accumulator from Register
   */
  private executeLDAR(bytecode: Uint8Array): void {
    const registerIndex = this.readOperand(bytecode);
    this.accumulator = this.registers[registerIndex] || createUndefined();
  }

  /**
   * STAR - Store Accumulator to Register
   */
  private executeSTAR(bytecode: Uint8Array): void {
    const registerIndex = this.readOperand(bytecode);
    this.ensureRegister(registerIndex);
    this.registers[registerIndex] = this.accumulator;
  }

  /**
   * LDA_CONSTANT - Load constant to accumulator
   */
  private executeLDAConstant(bytecode: Uint8Array): void {
    const constantIndex = this.readOperand(bytecode);
    const constant = this.constantPool[constantIndex];

    if (typeof constant === "number") {
      this.accumulator = createNumber(constant);
    } else if (typeof constant === "string") {
      this.accumulator = createString(constant);
    } else if (typeof constant === "boolean") {
      this.accumulator = createBoolean(constant);
    } else if (constant === null) {
      this.accumulator = createNull();
    } else {
      this.accumulator = createUndefined();
    }
  }

  /**
   * ADD - Addition
   */
  private executeADD(bytecode: Uint8Array): void {
    const registerIndex = this.readOperand(bytecode);
    const left = this.registers[registerIndex] || createUndefined();
    const right = this.accumulator;

    // JavaScript + operator: string concatenation if either operand is a string
    if (left.type === JSValueType.STRING || right.type === JSValueType.STRING) {
      const leftStr = jsToString(left);
      const rightStr = jsToString(right);
      this.accumulator = createString(leftStr + rightStr);
    } else {
      const leftNum = toNumber(left);
      const rightNum = toNumber(right);
      this.accumulator = createNumber(leftNum + rightNum);
    }
  }

  /**
   * SUB - Subtraction
   */
  private executeSUB(bytecode: Uint8Array): void {
    const registerIndex = this.readOperand(bytecode);
    const left = this.registers[registerIndex] || createUndefined();
    const right = this.accumulator;

    const leftNum = toNumber(left);
    const rightNum = toNumber(right);
    this.accumulator = createNumber(leftNum - rightNum);
  }

  /**
   * MUL - Multiplication
   */
  private executeMUL(bytecode: Uint8Array): void {
    const registerIndex = this.readOperand(bytecode);
    const left = this.registers[registerIndex] || createUndefined();
    const right = this.accumulator;

    const leftNum = toNumber(left);
    const rightNum = toNumber(right);
    this.accumulator = createNumber(leftNum * rightNum);
  }

  /**
   * DIV - Division
   */
  private executeDIV(bytecode: Uint8Array): void {
    const registerIndex = this.readOperand(bytecode);
    const left = this.registers[registerIndex] || createUndefined();
    const right = this.accumulator;

    const leftNum = toNumber(left);
    const rightNum = toNumber(right);
    this.accumulator = createNumber(leftNum / rightNum);
  }

  /**
   * MOD - Modulo
   */
  private executeMOD(bytecode: Uint8Array): void {
    const registerIndex = this.readOperand(bytecode);
    const left = this.registers[registerIndex] || createUndefined();
    const right = this.accumulator;

    const leftNum = toNumber(left);
    const rightNum = toNumber(right);
    this.accumulator = createNumber(leftNum % rightNum);
  }

  /**
   * INC - Increment
   */
  private executeINC(): void {
    const num = toNumber(this.accumulator);
    this.accumulator = createNumber(num + 1);
  }

  /**
   * DEC - Decrement
   */
  private executeDEC(): void {
    const num = toNumber(this.accumulator);
    this.accumulator = createNumber(num - 1);
  }

  /**
   * NEGATE - Negate
   */
  private executeNEGATE(): void {
    const num = toNumber(this.accumulator);
    this.accumulator = createNumber(-num);
  }

  /**
   * TEST_EQUAL - Test abstract equality
   */
  private executeTEST_EQUAL(bytecode: Uint8Array): void {
    const registerIndex = this.readOperand(bytecode);
    const left = this.registers[registerIndex] || createUndefined();
    const right = this.accumulator;

    this.accumulator = createBoolean(abstractEquals(left, right));
  }

  /**
   * TEST_NOT_EQUAL - Test abstract inequality
   */
  private executeTEST_NOT_EQUAL(bytecode: Uint8Array): void {
    const registerIndex = this.readOperand(bytecode);
    const left = this.registers[registerIndex] || createUndefined();
    const right = this.accumulator;

    this.accumulator = createBoolean(!abstractEquals(left, right));
  }

  /**
   * TEST_STRICT_EQUAL - Test strict equality
   */
  private executeTEST_STRICT_EQUAL(bytecode: Uint8Array): void {
    const registerIndex = this.readOperand(bytecode);
    const left = this.registers[registerIndex] || createUndefined();
    const right = this.accumulator;

    this.accumulator = createBoolean(strictEquals(left, right));
  }

  /**
   * TEST_LESS_THAN - Test less than
   */
  private executeTEST_LESS_THAN(bytecode: Uint8Array): void {
    const registerIndex = this.readOperand(bytecode);
    const left = this.registers[registerIndex] || createUndefined();
    const right = this.accumulator;

    const leftNum = toNumber(left);
    const rightNum = toNumber(right);
    this.accumulator = createBoolean(leftNum < rightNum);
  }

  /**
   * TEST_GREATER_THAN - Test greater than
   */
  private executeTEST_GREATER_THAN(bytecode: Uint8Array): void {
    const registerIndex = this.readOperand(bytecode);
    const left = this.registers[registerIndex] || createUndefined();
    const right = this.accumulator;

    const leftNum = toNumber(left);
    const rightNum = toNumber(right);
    this.accumulator = createBoolean(leftNum > rightNum);
  }

  /**
   * TEST_LESS_EQUAL - Test less than or equal
   */
  private executeTEST_LESS_EQUAL(bytecode: Uint8Array): void {
    const registerIndex = this.readOperand(bytecode);
    const left = this.registers[registerIndex] || createUndefined();
    const right = this.accumulator;

    const leftNum = toNumber(left);
    const rightNum = toNumber(right);
    this.accumulator = createBoolean(leftNum <= rightNum);
  }

  /**
   * TEST_GREATER_EQUAL - Test greater than or equal
   */
  private executeTEST_GREATER_EQUAL(bytecode: Uint8Array): void {
    const registerIndex = this.readOperand(bytecode);
    const left = this.registers[registerIndex] || createUndefined();
    const right = this.accumulator;

    const leftNum = toNumber(left);
    const rightNum = toNumber(right);
    this.accumulator = createBoolean(leftNum >= rightNum);
  }

  /**
   * LOGICAL_NOT - Logical NOT
   */
  private executeLOGICAL_NOT(): void {
    const bool = toBoolean(this.accumulator);
    this.accumulator = createBoolean(!bool);
  }

  /**
   * TO_BOOLEAN - Convert to boolean
   */
  private executeTO_BOOLEAN(): void {
    const bool = toBoolean(this.accumulator);
    this.accumulator = createBoolean(bool);
  }

  /**
   * JUMP - Unconditional jump
   */
  private executeJUMP(bytecode: Uint8Array): void {
    const offset = this.readOperand(bytecode);
    this.programCounter = offset;
  }

  /**
   * JUMP_IF_TRUE - Jump if accumulator is truthy
   */
  private executeJUMP_IF_TRUE(bytecode: Uint8Array): void {
    const offset = this.readOperand(bytecode);
    if (toBoolean(this.accumulator)) {
      this.programCounter = offset;
    }
  }

  /**
   * JUMP_IF_FALSE - Jump if accumulator is falsy
   */
  private executeJUMP_IF_FALSE(bytecode: Uint8Array): void {
    const offset = this.readOperand(bytecode);
    if (!toBoolean(this.accumulator)) {
      this.programCounter = offset;
    }
  }

  /**
   * RETURN - Return from function
   */
  private executeRETURN(): void {
    if (this.frameStack.length > 0) {
      const frame = this.frameStack.pop()!;
      const returnValue = this.accumulator;
      this.registers = frame.savedRegisters;
      this.programCounter = frame.returnAddress;
      this.constantPool = frame.function.constantPool;
      this.accumulator = returnValue;
      // Pop the function execution context
      this.callStack.pop();
      const prev = this.callStack.current();
      if (prev) {
        this.currentContext = prev;
      }
    } else {
      this.isRunning = false;
    }
  }

  /**
   * CALL - Call function
   * Convention: accumulator = function, args in recent registers
   */
  private executeCALL(bytecode: Uint8Array): void {
    const argCount = this.readOperand(bytecode);
    const firstArgReg = this.readOperand(bytecode);
    const func = this.accumulator;

    if (func.type !== JSValueType.FUNCTION) {
      this.accumulator = createUndefined();
      return;
    }

    const fn = func.value as JSFunction;

    // Collect arguments from consecutive registers starting at firstArgReg.
    // The compiler guarantees args are in registers firstArgReg..firstArgReg+argCount-1
    // by copying evaluated arg values into consecutive slots after all temps.
    const args: JSValue[] = [];
    for (let i = 0; i < argCount; i++) {
      const reg = firstArgReg + i;
      args.push(
        reg >= 0 && reg < this.registers.length
          ? (this.registers[reg] || createUndefined())
          : createUndefined(),
      );
    }

    // Native function shortcut
    if (fn.isNative && fn.nativeImpl) {
      this.accumulator = fn.nativeImpl(...args);
      this.stats.functionsExecuted++;
      return;
    }

    // Get function node BEFORE compileFunctionBody (which caches bytecode on fn.code)
    const funcNode = this.getFunctionNode(fn);

    // Compile function body if needed
    const compiled = this.compileFunctionBody(fn);
    if (!compiled) {
      this.accumulator = createUndefined();
      return;
    }

    // Save current frame
    this.frameStack.push({
      function: {
        bytecode,
        constantPool: this.constantPool,
        name: "<caller>",
        parameterCount: 0,
        registerCount: 0,
      },
      returnAddress: this.programCounter,
      savedRegisters: [...this.registers],
      savedAccumulator: this.accumulator,
    });

    // Create function execution context with optional 'this' from method call
    const thisValue = this.pendingThisBinding || createUndefined();
    this.pendingThisBinding = null;
    const outer = this.currentContext.lexicalEnvironment;
    const realm = this.currentContext.realm!;
    const funcCtx = createFunctionExecutionContext(
      func,
      thisValue,
      undefined,
      outer,
      realm,
    );

    // Bind 'this' in function context
    if (thisValue.type !== JSValueType.UNDEFINED) {
      funcCtx.lexicalEnvironment.bindings.set("this", thisValue);
    }

    // Bind parameters
    if (funcNode) {
      for (let i = 0; i < funcNode.params.length; i++) {
        funcCtx.lexicalEnvironment.bindings.set(
          funcNode.params[i].name,
          args[i] || createUndefined(),
        );
      }
    }

    this.callStack.push(funcCtx);
    this.currentContext = funcCtx;

    // Execute function bytecode
    this.registers = new Array(compiled.registerCount).fill(null).map(() => createUndefined());
    for (let i = 0; i < Math.min(args.length, compiled.parameterCount); i++) {
      this.registers[i] = args[i];
    }
    this.constantPool = compiled.constantPool;
    this.programCounter = 0;
    this.stats.functionsExecuted++;
    // Execution continues in the main loop with the new bytecode context
    // But we need to run it inline since our main loop uses the outer bytecode
    this.runInnerFunction(compiled);
  }

  /**
   * Run an inner function's bytecode to completion
   */
  private runInnerFunction(compiled: CompiledFunction): void {
    const innerBytecode = compiled.bytecode;
    const savedRunning = this.isRunning;
    const savedFrameDepth = this.frameStack.length;
    this.isRunning = true;
    this.programCounter = 0;

    while (this.isRunning && this.programCounter < innerBytecode.length) {
      this.executeInstruction(innerBytecode);
      this.stats.instructionsExecuted++;
      // If RETURN popped our frame (back to caller level), stop this inner loop
      if (this.frameStack.length < savedFrameDepth) {
        break;
      }
    }

    this.isRunning = savedRunning;
    // After inner function returns, frameStack pop already happened in RETURN
  }

  /**
   * CONSTRUCT - Construct object with new
   */
  private executeCONSTRUCT(bytecode: Uint8Array): void {
    const argCount = this.readOperand(bytecode);
    const firstArgReg = this.readOperand(bytecode);
    const func = this.accumulator;

    if (func.type !== JSValueType.FUNCTION) {
      this.accumulator = createUndefined();
      return;
    }

    const fn = func.value as JSFunction;

    // Collect arguments from consecutive registers starting at firstArgReg
    const args: JSValue[] = [];
    for (let i = 0; i < argCount; i++) {
      const reg = firstArgReg + i;
      args.push(
        reg >= 0 && reg < this.registers.length
          ? (this.registers[reg] || createUndefined())
          : createUndefined(),
      );
    }

    // Create new object with constructor's prototype
    // Check both fn.prototype field and fn.properties.get("prototype")
    let ctorProto = fn.prototype || null;
    if (!ctorProto && fn.properties?.has("prototype")) {
      const protoProp = fn.properties.get("prototype");
      if (protoProp && protoProp.type === JSValueType.OBJECT) {
        ctorProto = protoProp.value as import("./JSValue.ts").JSObject;
      }
    }
    const newObj = createObject(ctorProto);
    if (newObj.type === JSValueType.OBJECT) {
      newObj.value.constructor = fn;
    }

    // Native constructor
    if (fn.isNative && fn.nativeImpl) {
      const result = fn.nativeImpl(...args);
      this.accumulator =
        (result.type === JSValueType.OBJECT || result.type === JSValueType.FUNCTION)
          ? result
          : newObj;
      return;
    }

    // Get function node BEFORE compileFunctionBody (which caches bytecode on fn.code)
    const funcNode = this.getFunctionNode(fn);

    // Compile and execute constructor
    const compiled = this.compileFunctionBody(fn);
    if (!compiled) {
      this.accumulator = newObj;
      return;
    }

    // Save frame
    this.frameStack.push({
      function: {
        bytecode,
        constantPool: this.constantPool,
        name: "<caller>",
        parameterCount: 0,
        registerCount: 0,
      },
      returnAddress: this.programCounter,
      savedRegisters: [...this.registers],
      savedAccumulator: this.accumulator,
    });

    // Create execution context with 'this' = newObj
    const outer = this.currentContext.lexicalEnvironment;
    const realm = this.currentContext.realm!;
    const funcCtx = createFunctionExecutionContext(func, newObj, func, outer, realm);
    if (funcNode) {
      for (let i = 0; i < funcNode.params.length; i++) {
        funcCtx.lexicalEnvironment.bindings.set(
          funcNode.params[i].name,
          args[i] || createUndefined(),
        );
      }
    }
    // Bind 'this' in context
    funcCtx.lexicalEnvironment.bindings.set("this", newObj);

    this.callStack.push(funcCtx);
    this.currentContext = funcCtx;

    this.registers = new Array(compiled.registerCount).fill(null).map(() => createUndefined());
    for (let i = 0; i < Math.min(args.length, compiled.parameterCount); i++) {
      this.registers[i] = args[i];
    }
    this.constantPool = compiled.constantPool;

    this.runInnerFunction(compiled);

    // If constructor returned non-object, use newObj
    if (
      this.accumulator.type !== JSValueType.OBJECT && this.accumulator.type !== JSValueType.FUNCTION
    ) {
      this.accumulator = newObj;
    }
  }

  /**
   * GET_PROPERTY - Get named property from object in accumulator
   * Uses inline cache keyed by bytecode offset for repeated access on the same object.
   */
  private executeGET_PROPERTY(bytecode: Uint8Array): void {
    // The PC already advanced past the opcode; record offset of the operand for cache key
    const cacheKey = this.programCounter;
    const nameIndex = this.readOperand(bytecode);
    const name = this.constantPool[nameIndex] as string;
    const obj = this.accumulator;

    if (obj.type === JSValueType.OBJECT || obj.type === JSValueType.FUNCTION) {
      // Inline cache check: same object identity + same property name
      const cached = this.propertyCache.get(cacheKey);
      if (cached && cached.name === name && cached.objectRef.deref() === (obj.value as unknown as Record<string, unknown>)) {
        const current = (obj.value as import("./JSValue.ts").JSObject).properties.get(name);
        if (current !== undefined && current === cached.value) {
          this.accumulator = cached.value;
          this.cacheHits++;
          return;
        }
      }
      this.cacheMisses++;

      // Slow path: walk prototype chain
      let current: import("./JSValue.ts").JSObject | null = obj.value;
      while (current) {
        if (current.getters?.has(name)) {
          // Never cache getter results — they may return different values each call
          this.accumulator = current.getters.get(name)!();
          return;
        }
        if (current.properties.has(name)) {
          const value = current.properties.get(name)!;
          // Cache only own-property plain values (not from prototype, not getters)
          if (current === obj.value) {
            this.propertyCache.set(cacheKey, {
              objectRef: new WeakRef(obj.value as unknown as Record<string, unknown>),
              name,
              value,
            });
          }
          this.accumulator = value;
          return;
        }
        current = current.prototype;
      }
    }
    this.accumulator = createUndefined();
  }

  /**
   * SET_PROPERTY - Set named property on object
   * Operands: nameIndex, objectRegister
   */
  private executeSET_PROPERTY(bytecode: Uint8Array): void {
    const nameIndex = this.readOperand(bytecode);
    const objRegister = this.readOperand(bytecode);
    const name = this.constantPool[nameIndex] as string;
    const value = this.accumulator;
    const obj = this.registers[objRegister] || createUndefined();

    if (obj.type === JSValueType.OBJECT || obj.type === JSValueType.FUNCTION) {
      // Check setters first (dynamic/live properties)
      if (obj.value.setters?.has(name)) {
        obj.value.setters.get(name)!(value);
        return;
      }
      obj.value.properties.set(name, value);

      // Invalidate any inline cache entries that reference this object + property
      for (const [key, entry] of this.propertyCache) {
        if (entry.name === name && entry.objectRef.deref() === (obj.value as unknown as Record<string, unknown>)) {
          this.propertyCache.delete(key);
        }
      }
    }
  }

  /**
   * GET_KEYED - Get property by computed key
   */
  private executeGET_KEYED(bytecode: Uint8Array): void {
    const keyRegister = this.readOperand(bytecode);
    const key = this.registers[keyRegister] || createUndefined();
    const obj = this.accumulator;

    const keyStr = this.jsValueToPropertyKey(key);
    if (obj.type === JSValueType.OBJECT || obj.type === JSValueType.FUNCTION) {
      let current: import("./JSValue.ts").JSObject | null = obj.value;
      while (current) {
        if (current.getters?.has(keyStr)) {
          this.accumulator = current.getters.get(keyStr)!();
          return;
        }
        if (current.properties.has(keyStr)) {
          this.accumulator = current.properties.get(keyStr)!;
          return;
        }
        current = current.prototype;
      }
    }
    this.accumulator = createUndefined();
  }

  /**
   * SET_KEYED - Set property by computed key
   * Operands: keyRegister, objectRegister
   */
  private executeSET_KEYED(bytecode: Uint8Array): void {
    const keyRegister = this.readOperand(bytecode);
    const objRegister = this.readOperand(bytecode);
    const key = this.registers[keyRegister] || createUndefined();
    const value = this.accumulator;
    const obj = this.registers[objRegister] || createUndefined();

    const keyStr = this.jsValueToPropertyKey(key);
    if (obj.type === JSValueType.OBJECT || obj.type === JSValueType.FUNCTION) {
      // Check setters first (dynamic/live properties)
      if (obj.value.setters?.has(keyStr)) {
        obj.value.setters.get(keyStr)!(value);
        return;
      }
      obj.value.properties.set(keyStr, value);
      // Update length for array-like objects
      if (typeof keyStr === "string" && /^\d+$/.test(keyStr)) {
        const idx = parseInt(keyStr, 10);
        const lengthVal = obj.value.properties.get("length");
        const currentLength = lengthVal && lengthVal.type === JSValueType.NUMBER
          ? lengthVal.value
          : 0;
        if (idx >= currentLength) {
          obj.value.properties.set("length", createNumber(idx + 1));
        }
      }
    }
  }

  /**
   * LDA_GLOBAL - Load global variable
   */
  private executeLDA_GLOBAL(bytecode: Uint8Array): void {
    const nameIndex = this.readOperand(bytecode);
    const name = this.constantPool[nameIndex] as string;

    // First check lexical environment chain (for function parameters, locals, closures)
    const envValue = getIdentifierReference(this.currentContext.lexicalEnvironment, name);
    if (envValue !== null) {
      this.accumulator = envValue;
      return;
    }

    // Then check globals
    if (this.globals.has(name)) {
      this.accumulator = this.globals.get(name)!;
    } else {
      this.accumulator = createUndefined();
    }
  }

  /**
   * STA_GLOBAL - Store global variable
   */
  private executeSTA_GLOBAL(bytecode: Uint8Array): void {
    const nameIndex = this.readOperand(bytecode);
    const name = this.constantPool[nameIndex] as string;

    // First check if name exists in lexical environment chain
    if (setIdentifierReference(this.currentContext.lexicalEnvironment, name, this.accumulator)) {
      return;
    }
    this.globals.set(name, this.accumulator);
  }

  /**
   * LDA_CONTEXT_SLOT - Load from context slot
   * Operand is a constant pool index containing the variable name
   */
  private executeLDA_CONTEXT_SLOT(bytecode: Uint8Array): void {
    const nameIndex = this.readOperand(bytecode);
    const name = this.constantPool[nameIndex] as string;

    // Look up in current execution context's environment chain
    const value = getIdentifierReference(this.currentContext.lexicalEnvironment, name);
    this.accumulator = value ?? createUndefined();
  }

  /**
   * STA_CONTEXT_SLOT - Store to context slot
   * Operand is a constant pool index containing the variable name
   */
  private executeSTA_CONTEXT_SLOT(bytecode: Uint8Array): void {
    const nameIndex = this.readOperand(bytecode);
    const name = this.constantPool[nameIndex] as string;

    // Track 'this' for method calls
    if (name === "this") {
      this.pendingThisBinding = this.accumulator;
    }

    // Set in current execution context's environment chain
    const success = setIdentifierReference(
      this.currentContext.lexicalEnvironment,
      name,
      this.accumulator,
    );
    if (!success) {
      // If not found, create in current environment
      this.currentContext.lexicalEnvironment.bindings.set(name, this.accumulator);
    }
  }

  /**
   * CREATE_OBJECT - Create empty object literal
   */
  private executeCREATE_OBJECT(): void {
    this.accumulator = createObject();
  }

  /**
   * CREATE_ARRAY - Create array with given capacity
   */
  private executeCREATE_ARRAY(bytecode: Uint8Array): void {
    const elementCount = this.readOperand(bytecode);
    const arr = createObject();
    if (arr.type === JSValueType.OBJECT) {
      arr.value.properties.set("length", createNumber(elementCount));
    }
    this.accumulator = arr;
  }

  /**
   * CREATE_CLOSURE - Create function closure from constant pool entry
   */
  private executeCREATE_CLOSURE(bytecode: Uint8Array): void {
    const funcIndex = this.readOperand(bytecode);
    const funcNode = this.constantPool[funcIndex];

    // Capture current scope for closure
    const scope: Environment = {
      bindings: new Map(this.currentContext.lexicalEnvironment.bindings),
      outer: this.currentContext.lexicalEnvironment.outer
        ? {
          bindings: new Map(this.currentContext.lexicalEnvironment.outer.bindings),
          outer: this.currentContext.lexicalEnvironment.outer.outer,
        }
        : null,
    };

    // Determine function name and param count
    const node = funcNode as { id?: { name: string } | null; params?: { name: string }[] };
    const name = node.id?.name || "<anonymous>";
    const paramCount = node.params?.length || 0;

    this.accumulator = createFunction(name, funcNode as string, paramCount, scope);
  }

  /**
   * Convert JSValue to property key string
   */
  private jsValueToPropertyKey(key: JSValue): string {
    if (key.type === JSValueType.STRING) return key.value;
    if (key.type === JSValueType.NUMBER) return String(key.value);
    if (key.type === JSValueType.BOOLEAN) return String(key.value);
    return "undefined";
  }

  /**
   * Get function AST node from JSFunction's code field
   */
  private getFunctionNode(
    fn: JSFunction,
  ): { params: IdentifierNode[]; body: { body: unknown[] } } | null {
    if (typeof fn.code === "object" && fn.code !== null && !(fn.code instanceof Uint8Array)) {
      return fn.code as { params: IdentifierNode[]; body: { body: unknown[] } };
    }
    return null;
  }

  /**
   * Compile a function body (AST node) to bytecode
   * Caches the result on the JSFunction for subsequent calls
   */
  /** Cache for compiled function bodies (keyed by JSFunction reference) */
  private compiledFunctionCache = new WeakMap<object, CompiledFunction>();

  private compileFunctionBody(fn: JSFunction): CompiledFunction | null {
    // Check cache first
    const cached = this.compiledFunctionCache.get(fn as unknown as object);
    if (cached) {
      return cached;
    }

    // If code is already compiled bytecode (from external source)
    if (fn.code instanceof Uint8Array) {
      const result: CompiledFunction = {
        name: fn.name,
        parameterCount: fn.length,
        registerCount: 16,
        bytecode: fn.code,
        constantPool: [],
      };
      this.compiledFunctionCache.set(fn as unknown as object, result);
      return result;
    }

    // If code is a function AST node, compile it
    const funcNode = fn.code as unknown as {
      type: string;
      body?: { body: unknown[] };
      params?: { name: string }[];
    };
    if (funcNode && typeof funcNode === "object" && funcNode.body) {
      const generator = new BytecodeGenerator();
      const programNode = {
        type: "Program",
        body: funcNode.body.body,
      } as unknown as ProgramNode;
      const compiled = generator.generate(programNode);
      compiled.name = fn.name;
      compiled.parameterCount = fn.length;

      // Cache the full compiled result (bytecode + constantPool)
      this.compiledFunctionCache.set(fn as unknown as object, compiled);

      return compiled;
    }

    return null;
  }

  /**
   * Read operand from bytecode
   */
  private readOperand(bytecode: Uint8Array): number {
    return bytecode[this.programCounter++];
  }

  /**
   * Ensure register exists
   */
  private ensureRegister(index: number): void {
    while (this.registers.length <= index) {
      this.registers.push(createUndefined());
    }
  }

  /**
   * Get current state
   */
  getState(): InterpreterState {
    return {
      accumulator: this.accumulator,
      registers: [...this.registers],
      programCounter: this.programCounter,
      callStack: this.callStack,
      currentContext: this.currentContext,
      heap: this.heap,
      globals: new Map(this.globals),
    };
  }

  /**
   * Get statistics
   */
  getStats(): InterpreterStats {
    return { ...this.stats };
  }

  /**
   * Get inline cache statistics
   */
  getCacheStats(): { hits: number; misses: number } {
    return { hits: this.cacheHits, misses: this.cacheMisses };
  }

  /**
   * Reset interpreter
   */
  reset(): void {
    this.accumulator = createUndefined();
    this.registers = [];
    this.programCounter = 0;
    this.globals.clear();
    this.constantPool = [];
    this.frameStack = [];
    this.isRunning = false;
    this.propertyCache.clear();
    this.cacheHits = 0;
    this.cacheMisses = 0;

    this.stats = {
      instructionsExecuted: 0,
      functionsExecuted: 0,
      totalExecutionTime: 0,
      averageInstructionTime: 0,
    };
  }

  /**
   * Get accumulator value
   */
  getAccumulator(): JSValue {
    return this.accumulator;
  }

  /**
   * Get register value
   */
  getRegister(index: number): JSValue {
    return this.registers[index] || createUndefined();
  }

  /**
   * Get global variable
   */
  getGlobal(name: string): JSValue {
    return this.globals.get(name) || createUndefined();
  }

  /**
   * Set global variable
   */
  setGlobal(name: string, value: JSValue): void {
    this.globals.set(name, value);
  }

  /**
   * Check if interpreter is running
   */
  isExecuting(): boolean {
    return this.isRunning;
  }

  // ======================================================================
  // Exception handling opcodes
  // ======================================================================

  /**
   * TRY_START - Register exception handler
   * Operand: catch handler offset (absolute bytecode position)
   */
  private executeTRY_START(bytecode: Uint8Array): void {
    const catchOffset = this.readOperand(bytecode);
    this.exceptionHandlers.push({
      catchOffset,
      frameDepth: this.frameStack.length,
      bytecodeRef: bytecode,
    });
  }

  /**
   * TRY_END - Remove current exception handler
   */
  private executeTRY_END(): void {
    if (this.exceptionHandlers.length > 0) {
      this.exceptionHandlers.pop();
    }
  }

  /**
   * THROW - Throw exception from accumulator
   * If a handler is registered, jump to catch; otherwise rethrow as JS Error
   */
  private executeTHROW(_bytecode: Uint8Array): void {
    this.throwException(this.accumulator);
  }

  /**
   * Internal: route exception to nearest catch handler or rethrow
   */
  private throwException(value: JSValue): void {
    if (this.exceptionHandlers.length > 0) {
      const handler = this.exceptionHandlers.pop()!;
      // Unwind frames if we're deeper than when the handler was registered
      while (this.frameStack.length > handler.frameDepth) {
        const frame = this.frameStack.pop()!;
        this.registers = frame.savedRegisters;
        this.constantPool = frame.function.constantPool;
        this.callStack.pop();
        const prev = this.callStack.current();
        if (prev) this.currentContext = prev;
      }
      this.caughtException = value;
      this.programCounter = handler.catchOffset;
    } else {
      // No handler — convert to real throw
      const msg = value.type === JSValueType.STRING
        ? value.value as string
        : value.type === JSValueType.OBJECT && (value.value as unknown as Record<string, unknown>)?.message
        ? String((value.value as unknown as Record<string, unknown>).message)
        : "value" in value ? String(value.value) : "undefined";
      throw new Error(msg);
    }
  }

  /**
   * SET_CATCH_PARAM - Store caught exception into a variable name
   * Operand: constant pool index of the variable name
   */
  private executeSET_CATCH_PARAM(bytecode: Uint8Array): void {
    const nameIndex = this.readOperand(bytecode);
    const name = this.constantPool[nameIndex] as string;
    // Store exception in current scope
    this.currentContext.lexicalEnvironment.bindings.set(name, this.caughtException);
    // Also put it in the accumulator for convenience
    this.accumulator = this.caughtException;
  }

  // ======================================================================
  // Operator opcodes
  // ======================================================================

  /**
   * TYPEOF - typeof accumulator → string in accumulator
   */
  private executeTYPEOF(): void {
    const val = this.accumulator;
    let result: string;
    switch (val.type) {
      case JSValueType.UNDEFINED:
        result = "undefined";
        break;
      case JSValueType.NULL:
        result = "object"; // typeof null === "object" per spec
        break;
      case JSValueType.BOOLEAN:
        result = "boolean";
        break;
      case JSValueType.NUMBER:
        result = "number";
        break;
      case JSValueType.STRING:
        result = "string";
        break;
      case JSValueType.FUNCTION:
        result = "function";
        break;
      case JSValueType.SYMBOL:
        result = "symbol";
        break;
      case JSValueType.BIGINT:
        result = "bigint";
        break;
      default:
        result = "object";
        break;
    }
    this.accumulator = createString(result);
  }

  /**
   * INSTANCEOF - accumulator instanceof register → boolean in accumulator
   * Operand: register index containing the constructor
   */
  private executeINSTANCEOF(bytecode: Uint8Array): void {
    const registerIndex = this.readOperand(bytecode);
    const obj = this.accumulator;
    const ctor = this.registers[registerIndex] || createUndefined();

    // Walk prototype chain
    if (obj.type === JSValueType.OBJECT && ctor.type === JSValueType.FUNCTION) {
      const ctorFn = ctor.value as JSFunction;
      const ctorPrototype = ctorFn.properties?.get("prototype");
      if (ctorPrototype) {
        let proto = (obj.value as unknown as Record<string, unknown>)?.__proto__ as JSValue | undefined;
        while (proto && proto.type !== JSValueType.NULL && proto.type !== JSValueType.UNDEFINED) {
          if (proto === ctorPrototype) {
            this.accumulator = createBoolean(true);
            return;
          }
          proto = "value" in proto ? (proto.value as unknown as Record<string, unknown>)?.__proto__ as JSValue | undefined : undefined;
        }
      }
    }
    this.accumulator = createBoolean(false);
  }
}

/**
 * Interpreter factory
 * Creates interpreter instances with different configurations
 */
export class InterpreterFactory {
  /**
   * Create default interpreter
   */
  static createDefault(): IgnitionInterpreter {
    return new IgnitionInterpreter();
  }

  /**
   * Create interpreter with heap
   */
  static createWithHeap(heap: V8Heap): IgnitionInterpreter {
    return new IgnitionInterpreter(heap);
  }

  /**
   * Create interpreter for testing
   */
  static createForTesting(): IgnitionInterpreter {
    return new IgnitionInterpreter();
  }
}
