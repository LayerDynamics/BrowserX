/**
 * Expression Evaluator
 * Evaluates expressions against execution context
 */

import {
  ArrayExpression,
  BinaryExpression,
  CallExpression,
  Expression,
  Identifier,
  Literal,
  MemberExpression,
  ObjectExpression,
  UnaryExpression,
} from "../types/ast.ts";
import { DataType } from "../types/primitives.ts";
import { matchesLike, matchesPattern, toBoolean, toNumber, toString } from "../utils/mod.ts";
import { createBuiltinRegistry, FunctionRegistry, globalRegistry } from "../schema/mod.ts";

/**
 * Evaluation context with variables and data
 */
export interface EvaluationContext {
  variables: Map<string, unknown>;
  currentRow?: Record<string, unknown>;
  functions: Map<string, (...args: unknown[]) => unknown>;
}

/**
 * Expression evaluation error
 */
export class EvaluationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EvaluationError";
  }
}

/**
 * Expression evaluator class
 */
export class ExpressionEvaluator {
  private context: EvaluationContext;
  private functionRegistry: FunctionRegistry;

  constructor(context: EvaluationContext, functionRegistry?: FunctionRegistry) {
    this.context = context;
    // Use provided registry or create one with built-in functions
    this.functionRegistry = functionRegistry || createBuiltinRegistry();
  }

  /**
   * Evaluate an expression to a value
   */
  async evaluate(expr: Expression): Promise<unknown> {
    switch (expr.type) {
      case "LITERAL":
        return this.evaluateLiteral(expr as Literal);

      case "IDENTIFIER":
        return this.evaluateIdentifier(expr as Identifier);

      case "BINARY":
        return await this.evaluateBinary(expr as BinaryExpression);

      case "UNARY":
        return await this.evaluateUnary(expr as UnaryExpression);

      case "CALL":
        return await this.evaluateCall(expr as CallExpression);

      case "MEMBER":
        return await this.evaluateMember(expr as MemberExpression);

      case "ARRAY":
        return await this.evaluateArray(expr as ArrayExpression);

      case "OBJECT":
        return await this.evaluateObject(expr as ObjectExpression);

      default:
        throw new EvaluationError(`Unknown expression type: ${(expr as any).type}`);
    }
  }

  /**
   * Evaluate literal expression
   */
  private evaluateLiteral(expr: Literal): unknown {
    return expr.value;
  }

  /**
   * Evaluate identifier expression
   */
  private evaluateIdentifier(expr: Identifier): unknown {
    // Check current row first (for field access)
    if (this.context.currentRow && expr.name in this.context.currentRow) {
      return this.context.currentRow[expr.name];
    }

    // Check variables
    if (this.context.variables.has(expr.name)) {
      return this.context.variables.get(expr.name);
    }

    throw new EvaluationError(`Undefined identifier: ${expr.name}`);
  }

  /**
   * Evaluate binary expression
   */
  private async evaluateBinary(expr: BinaryExpression): Promise<unknown> {
    const left = await this.evaluate(expr.left);
    const right = await this.evaluate(expr.right);

    switch (expr.operator) {
      // Arithmetic operators
      case "+":
        if (typeof left === "string" || typeof right === "string") {
          return toString(left) + toString(right);
        }
        return toNumber(left) + toNumber(right);

      case "-":
        return toNumber(left) - toNumber(right);

      case "*":
        return toNumber(left) * toNumber(right);

      case "/":
        if (toNumber(right) === 0) {
          throw new EvaluationError("Division by zero");
        }
        return toNumber(left) / toNumber(right);

      case "%":
        return toNumber(left) % toNumber(right);

      // Comparison operators
      case "=":
        return this.equals(left, right);

      case "!=":
        return !this.equals(left, right);

      case ">":
        return this.compare(left, right) > 0;

      case ">=":
        return this.compare(left, right) >= 0;

      case "<":
        return this.compare(left, right) < 0;

      case "<=":
        return this.compare(left, right) <= 0;

      // Logical operators
      case "AND":
        return toBoolean(left) && toBoolean(right);

      case "OR":
        return toBoolean(left) || toBoolean(right);

      // String operators
      case "||":
        return toString(left) + toString(right);

      case "LIKE":
        return this.like(toString(left), toString(right));

      case "MATCHES":
        return this.matches(toString(left), toString(right));

      case "CONTAINS":
        return toString(left).includes(toString(right));

      // Collection operators
      case "IN":
        if (!Array.isArray(right)) {
          throw new EvaluationError("IN operator requires array on right side");
        }
        return right.some((item) => this.equals(left, item));

      default:
        throw new EvaluationError(`Unknown binary operator: ${expr.operator}`);
    }
  }

  /**
   * Evaluate unary expression
   */
  private async evaluateUnary(expr: UnaryExpression): Promise<unknown> {
    const operand = await this.evaluate(expr.operand);

    switch (expr.operator) {
      case "NOT":
        return !toBoolean(operand);

      case "-":
        return -toNumber(operand);

      case "+":
        return +toNumber(operand);

      default:
        throw new EvaluationError(`Unknown unary operator: ${expr.operator}`);
    }
  }

  /**
   * Evaluate function call expression
   */
  private async evaluateCall(expr: CallExpression): Promise<unknown> {
    const functionName = expr.callee.toUpperCase();
    const args = await Promise.all(expr.arguments.map((arg) => this.evaluate(arg)));

    // Check function registry
    if (this.functionRegistry.has(functionName)) {
      return await this.functionRegistry.execute(functionName, args);
    }

    // Check user-defined functions in context
    if (this.context.functions.has(functionName)) {
      const fn = this.context.functions.get(functionName)!;
      const result = fn(...args);
      // Handle async user functions
      if (result instanceof Promise) {
        return await result;
      }
      return result;
    }

    throw new EvaluationError(`Unknown function: ${functionName}`);
  }

  /**
   * Evaluate member expression
   */
  private async evaluateMember(expr: MemberExpression): Promise<unknown> {
    const object = await this.evaluate(expr.object);

    if (object === null || object === undefined) {
      throw new EvaluationError(`Cannot access property of null or undefined`);
    }

    const property = expr.property; // property is always a string in the AST

    if (typeof object !== "object") {
      throw new EvaluationError(`Cannot access property of non-object type`);
    }

    return (object as Record<string, unknown>)[property];
  }

  /**
   * Evaluate array expression
   */
  private async evaluateArray(expr: ArrayExpression): Promise<unknown> {
    return await Promise.all(expr.elements.map((element) => this.evaluate(element)));
  }

  /**
   * Evaluate object expression
   */
  private async evaluateObject(expr: ObjectExpression): Promise<unknown> {
    const result: Record<string, unknown> = {};

    for (const prop of expr.properties) {
      const key = prop.key; // key is always a string in the AST
      result[key] = await this.evaluate(prop.value);
    }

    return result;
  }

  /**
   * Deep equality comparison
   */
  private equals(left: unknown, right: unknown): boolean {
    // Handle null/undefined
    if (left === null || left === undefined) {
      return right === null || right === undefined;
    }
    if (right === null || right === undefined) {
      return false;
    }

    // Handle primitives
    if (typeof left !== "object" || typeof right !== "object") {
      return left === right;
    }

    // Handle arrays
    if (Array.isArray(left) && Array.isArray(right)) {
      if (left.length !== right.length) return false;
      return left.every((item, i) => this.equals(item, right[i]));
    }

    // Handle objects
    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);

    if (leftKeys.length !== rightKeys.length) return false;

    return leftKeys.every((key) =>
      this.equals((left as Record<string, unknown>)[key], (right as Record<string, unknown>)[key])
    );
  }

  /**
   * Compare values for ordering
   */
  private compare(left: unknown, right: unknown): number {
    // Handle null/undefined
    if (left === null || left === undefined) {
      return right === null || right === undefined ? 0 : -1;
    }
    if (right === null || right === undefined) {
      return 1;
    }

    // Handle numbers
    if (typeof left === "number" && typeof right === "number") {
      return left - right;
    }

    // Handle strings
    if (typeof left === "string" && typeof right === "string") {
      return left.localeCompare(right);
    }

    // Handle booleans
    if (typeof left === "boolean" && typeof right === "boolean") {
      return left === right ? 0 : left ? 1 : -1;
    }

    // Convert to strings for comparison
    return toString(left).localeCompare(toString(right));
  }

  /**
   * Convert value to boolean
   */
  private toBoolean(value: unknown): boolean {
    if (typeof value === "boolean") return value;
    if (value === null || value === undefined) return false;
    if (typeof value === "number") return value !== 0;
    if (typeof value === "string") return value.length > 0;
    if (Array.isArray(value)) return value.length > 0;
    return true;
  }

  /**
   * SQL LIKE pattern matching
   */
  private like(text: string, pattern: string): boolean {
    // Use utility function for LIKE matching
    return matchesLike(text, pattern, true); // Case-insensitive by default
  }

  /**
   * Regex pattern matching
   */
  private matches(text: string, pattern: string): boolean {
    // Use utility function for regex matching
    return matchesPattern(text, pattern, "regex");
  }

  /**
   * Update evaluation context
   */
  setContext(context: Partial<EvaluationContext>): void {
    if (context.variables) {
      this.context.variables = context.variables;
    }
    if (context.currentRow !== undefined) {
      this.context.currentRow = context.currentRow;
    }
    if (context.functions) {
      this.context.functions = context.functions;
    }
  }

  /**
   * Get current context
   */
  getContext(): EvaluationContext {
    return { ...this.context };
  }

  /**
   * Get function registry
   */
  getFunctionRegistry(): FunctionRegistry {
    return this.functionRegistry;
  }

  /**
   * Get variables map (returns copy)
   */
  getVariables(): Map<string, unknown> {
    return new Map(this.context.variables);
  }

  /**
   * Get current row data
   */
  getCurrentRow(): Record<string, unknown> | undefined {
    return this.context.currentRow ? { ...this.context.currentRow } : undefined;
  }

  /**
   * Get functions map (returns copy)
   */
  getFunctions(): Map<string, (...args: unknown[]) => unknown> {
    return new Map(this.context.functions);
  }
}
