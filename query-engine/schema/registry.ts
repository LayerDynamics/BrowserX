/**
 * Function Registry
 * Manages registration, validation, and execution of query functions
 */

import type {
  CustomFunctionOptions,
  DataType,
  FunctionCategory,
  FunctionDocumentation,
  FunctionExecutionContext,
  FunctionImplementation,
  FunctionSignature,
  RegistryStats,
  ValidationResult,
} from "./types.ts";

/**
 * Function Registry
 * Central registry for all query functions
 */
export class FunctionRegistry {
  private functions: Map<string, FunctionImplementation>;

  constructor() {
    this.functions = new Map();
  }

  /**
   * Register a single function
   * Performs comprehensive validation before registration
   */
  register(func: FunctionImplementation): void {
    // Comprehensive validation
    this.validateFunctionImplementation(func);

    const name = func.signature.name.toUpperCase();

    if (this.functions.has(name)) {
      throw new Error(`Function ${name} is already registered`);
    }

    this.functions.set(name, func);
  }

  /**
   * Comprehensive validation of function implementation
   * @throws {Error} If validation fails with detailed error message
   */
  private validateFunctionImplementation(func: FunctionImplementation): void {
    // Validate signature exists
    if (!func.signature) {
      throw new Error("Function registration requires a signature");
    }

    const sig = func.signature;

    // Validate name
    if (!sig.name || typeof sig.name !== "string" || sig.name.trim().length === 0) {
      throw new Error("Function name must be a non-empty string");
    }

    // Validate name format (alphanumeric and underscore only)
    if (!/^[A-Z_][A-Z0-9_]*$/i.test(sig.name)) {
      throw new Error(
        `Function name '${sig.name}' is invalid. Must start with a letter or underscore and contain only letters, numbers, and underscores`,
      );
    }

    // Validate category
    if (!sig.category || typeof sig.category !== "string") {
      throw new Error(`Function '${sig.name}' must have a valid category`);
    }

    // Validate minArgs
    if (typeof sig.minArgs !== "number" || sig.minArgs < 0 || !Number.isInteger(sig.minArgs)) {
      throw new Error(
        `Function '${sig.name}' minArgs must be a non-negative integer, got ${sig.minArgs}`,
      );
    }

    // Validate maxArgs
    if (sig.maxArgs !== "variadic") {
      if (typeof sig.maxArgs !== "number" || sig.maxArgs < 0 || !Number.isInteger(sig.maxArgs)) {
        throw new Error(
          `Function '${sig.name}' maxArgs must be a non-negative integer or 'variadic', got ${sig.maxArgs}`,
        );
      }

      if (sig.maxArgs < sig.minArgs) {
        throw new Error(
          `Function '${sig.name}' maxArgs (${sig.maxArgs}) cannot be less than minArgs (${sig.minArgs})`,
        );
      }
    }

    // Validate argTypes
    if (!Array.isArray(sig.argTypes)) {
      throw new Error(`Function '${sig.name}' argTypes must be an array`);
    }

    // Validate each argument type signature
    for (let i = 0; i < sig.argTypes.length; i++) {
      const argSig = sig.argTypes[i];

      if (!Array.isArray(argSig)) {
        throw new Error(
          `Function '${sig.name}' argTypes[${i}] must be an array of DataType, got ${typeof argSig}`,
        );
      }

      // Check argument count constraints
      if (argSig.length < sig.minArgs) {
        throw new Error(
          `Function '${sig.name}' argTypes[${i}] has ${argSig.length} types but minArgs is ${sig.minArgs}`,
        );
      }

      if (sig.maxArgs !== "variadic" && argSig.length > sig.maxArgs) {
        throw new Error(
          `Function '${sig.name}' argTypes[${i}] has ${argSig.length} types but maxArgs is ${sig.maxArgs}`,
        );
      }

      // Validate each type in the signature
      for (let j = 0; j < argSig.length; j++) {
        const type = argSig[j];
        if (!type || typeof type !== "string") {
          throw new Error(
            `Function '${sig.name}' argTypes[${i}][${j}] must be a valid DataType string, got ${typeof type}`,
          );
        }
      }
    }

    // Validate returnType
    if (!sig.returnType || typeof sig.returnType !== "string") {
      throw new Error(`Function '${sig.name}' must have a valid returnType`);
    }

    // Validate description
    if (typeof sig.description !== "string") {
      throw new Error(`Function '${sig.name}' description must be a string`);
    }

    // Warn if description is empty (best practice)
    if (sig.description.trim().length === 0) {
      console.warn(`Warning: Function '${sig.name}' has an empty description`);
    }

    // Validate examples
    if (!Array.isArray(sig.examples)) {
      throw new Error(`Function '${sig.name}' examples must be an array`);
    }

    // Warn if no examples provided (best practice)
    if (sig.examples.length === 0) {
      console.warn(`Warning: Function '${sig.name}' has no examples`);
    }

    // Validate examples are strings
    for (let i = 0; i < sig.examples.length; i++) {
      if (typeof sig.examples[i] !== "string") {
        throw new Error(
          `Function '${sig.name}' examples[${i}] must be a string, got ${typeof sig.examples[i]}`,
        );
      }
    }

    // Validate isAsync
    if (typeof sig.isAsync !== "boolean") {
      throw new Error(`Function '${sig.name}' isAsync must be a boolean, got ${typeof sig.isAsync}`);
    }

    // Validate implementation exists and is a function
    if (!func.implementation) {
      throw new Error(`Function '${sig.name}' must have an implementation`);
    }

    if (typeof func.implementation !== "function") {
      throw new Error(
        `Function '${sig.name}' implementation must be a function, got ${typeof func.implementation}`,
      );
    }

    // Validate implementation arity (parameter count) if not variadic
    if (sig.maxArgs !== "variadic") {
      const implArity = func.implementation.length;

      // Implementation should accept at least maxArgs parameters
      // (it's ok to accept more for optional context parameters)
      if (implArity < sig.maxArgs && implArity !== 0) {
        // Note: Arrow functions with rest parameters have length 0
        console.warn(
          `Warning: Function '${sig.name}' implementation has ${implArity} parameters but maxArgs is ${sig.maxArgs}`,
        );
      }
    }
  }

  /**
   * Register multiple functions at once
   */
  registerAll(funcs: FunctionImplementation[]): void {
    for (const func of funcs) {
      this.register(func);
    }
  }

  /**
   * Register custom function with simplified options
   */
  registerCustom(options: CustomFunctionOptions): void {
    const signature: FunctionSignature = {
      name: options.name.toUpperCase(),
      category: options.category || "custom" as FunctionCategory,
      minArgs: options.minArgs ?? 0,
      maxArgs: options.maxArgs ?? "variadic",
      argTypes: options.argTypes || [],
      returnType: options.returnType || "any" as DataType,
      description: options.description || "",
      examples: options.examples || [],
      isAsync: options.isAsync ?? false,
    };

    this.register({
      signature,
      implementation: options.implementation,
    });
  }

  /**
   * Get function by name
   */
  get(name: string): FunctionImplementation | undefined {
    return this.functions.get(name.toUpperCase());
  }

  /**
   * Check if function exists
   */
  has(name: string): boolean {
    return this.functions.has(name.toUpperCase());
  }

  /**
   * Get all function names
   */
  getAllNames(): string[] {
    return Array.from(this.functions.keys());
  }

  /**
   * Get functions by category
   */
  getByCategory(category: FunctionCategory | string): FunctionImplementation[] {
    return Array.from(this.functions.values()).filter(
      (func) => func.signature.category === category,
    );
  }

  /**
   * Validate function call
   */
  validate(name: string, args: unknown[]): ValidationResult {
    const func = this.get(name);

    if (!func) {
      return {
        valid: false,
        error: `Unknown function: ${name}`,
      };
    }

    const sig = func.signature;

    // Check argument count
    if (args.length < sig.minArgs) {
      return {
        valid: false,
        error: `${name} requires at least ${sig.minArgs} argument(s), got ${args.length}`,
      };
    }

    if (sig.maxArgs !== "variadic" && args.length > sig.maxArgs) {
      return {
        valid: false,
        error: `${name} accepts at most ${sig.maxArgs} argument(s), got ${args.length}`,
      };
    }

    // Check argument types if signatures are defined
    if (sig.argTypes.length > 0) {
      const actualTypes = args.map((arg) => this.inferType(arg));
      let matched = false;

      for (const expectedTypes of sig.argTypes) {
        if (this.typesMatch(actualTypes, expectedTypes)) {
          matched = true;
          break;
        }
      }

      if (!matched) {
        return {
          valid: false,
          error: `${name} argument types do not match expected signatures`,
          expectedTypes: sig.argTypes,
          actualTypes,
        };
      }
    }

    return { valid: true };
  }

  /**
   * Execute function with validation
   */
  async execute(
    name: string,
    args: unknown[],
    context?: FunctionExecutionContext,
  ): Promise<unknown> {
    const validation = this.validate(name, args);

    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const func = this.get(name)!;

    try {
      const result = func.implementation(...args);

      // Handle async functions
      if (result instanceof Promise) {
        return await result;
      }

      return result;
    } catch (error) {
      throw new Error(
        `Error executing ${name}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Generate documentation for all functions
   */
  generateDocs(): FunctionDocumentation[] {
    const docs: FunctionDocumentation[] = [];

    for (const func of this.functions.values()) {
      const sig = func.signature;

      docs.push({
        name: sig.name,
        category: sig.category,
        description: sig.description,
        signature: this.formatSignature(sig),
        parameters: this.extractParameters(sig),
        returnType: typeof sig.returnType === "string" ? sig.returnType : "dynamic",
        examples: sig.examples,
        isAsync: sig.isAsync,
      });
    }

    return docs.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Get registry statistics
   */
  getStats(): RegistryStats {
    const byCategory: Record<string, number> = {};
    let customFunctions = 0;
    let asyncFunctions = 0;

    for (const func of this.functions.values()) {
      const category = func.signature.category;
      byCategory[category] = (byCategory[category] || 0) + 1;

      if (category === "custom") {
        customFunctions++;
      }

      if (func.signature.isAsync) {
        asyncFunctions++;
      }
    }

    return {
      totalFunctions: this.functions.size,
      byCategory,
      customFunctions,
      asyncFunctions,
    };
  }

  /**
   * Clear all registered functions
   */
  clear(): void {
    this.functions.clear();
  }

  /**
   * Remove a function by name
   */
  unregister(name: string): boolean {
    return this.functions.delete(name.toUpperCase());
  }

  // Private helper methods

  private inferType(value: unknown): DataType {
    if (value === null) return "null" as DataType;
    if (value === undefined) return "undefined" as DataType;

    const type = typeof value;

    if (type === "string") return "string" as DataType;
    if (type === "number") return "number" as DataType;
    if (type === "boolean") return "boolean" as DataType;
    if (Array.isArray(value)) return "array" as DataType;
    if (type === "object") return "object" as DataType;

    return "any" as DataType;
  }

  private typesMatch(actual: DataType[], expected: DataType[]): boolean {
    if (actual.length !== expected.length) {
      return false;
    }

    for (let i = 0; i < actual.length; i++) {
      const actualType = actual[i];
      const expectedType = expected[i];

      // ANY matches everything
      if (expectedType === "any" || actualType === "any") {
        continue;
      }

      // Exact match
      if (actualType === expectedType) {
        continue;
      }

      // URL is a string
      if (expectedType === "url" && actualType === "string") {
        continue;
      }

      // CSS_SELECTOR and XPATH are strings
      if (
        (expectedType === "css_selector" || expectedType === "xpath") && actualType === "string"
      ) {
        continue;
      }

      // Type mismatch
      return false;
    }

    return true;
  }

  private formatSignature(sig: FunctionSignature): string {
    const maxArgs = sig.maxArgs === "variadic" ? "..." : sig.maxArgs;
    const argRange = sig.minArgs === sig.maxArgs
      ? `${sig.minArgs} arg(s)`
      : `${sig.minArgs}-${maxArgs} arg(s)`;

    return `${sig.name}(${argRange})`;
  }

  private extractParameters(
    sig: FunctionSignature,
  ): Array<{ name: string; type: string; optional?: boolean }> {
    if (sig.argTypes.length === 0) {
      return [];
    }

    // Use first signature for parameter documentation
    const firstSig = sig.argTypes[0];
    const params: Array<{ name: string; type: string; optional?: boolean }> = [];

    for (let i = 0; i < firstSig.length; i++) {
      params.push({
        name: `arg${i + 1}`,
        type: firstSig[i],
        optional: i >= sig.minArgs,
      });
    }

    return params;
  }

  /**
   * Get all functions (returns copy of map)
   */
  getFunctions(): Map<string, FunctionImplementation> {
    return new Map(this.functions);
  }

  /**
   * Get all function implementations as array
   */
  getAllFunctions(): FunctionImplementation[] {
    return Array.from(this.functions.values());
  }

  /**
   * Get total function count
   */
  getFunctionCount(): number {
    return this.functions.size;
  }

  /**
   * Get all unique categories
   */
  getCategories(): string[] {
    const categories = new Set<string>();
    for (const func of this.functions.values()) {
      categories.add(func.signature.category);
    }
    return Array.from(categories).sort();
  }

  /**
   * Get all async functions
   */
  getAsyncFunctions(): FunctionImplementation[] {
    return Array.from(this.functions.values()).filter(
      (func) => func.signature.isAsync,
    );
  }

  /**
   * Get all synchronous functions
   */
  getSyncFunctions(): FunctionImplementation[] {
    return Array.from(this.functions.values()).filter(
      (func) => !func.signature.isAsync,
    );
  }
}

/**
 * Global function registry instance
 */
export const globalRegistry = new FunctionRegistry();
