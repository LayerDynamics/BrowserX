/**
 * Aggregate Functions
 * Functions that operate on arrays/collections
 */

import type { DataType, FunctionImplementation } from "../types.ts";
import { FunctionCategory } from "../types.ts";

/**
 * SUM - Sum of numbers
 */
export const SUM: FunctionImplementation = {
  signature: {
    name: "SUM",
    category: FunctionCategory.AGGREGATE,
    minArgs: 1,
    maxArgs: "variadic",
    argTypes: [],
    returnType: "number" as DataType,
    description: "Calculate sum of numbers (array or multiple arguments)",
    examples: [
      "SUM(1, 2, 3) → 6",
      "SUM([1, 2, 3]) → 6",
    ],
    isAsync: false,
  },
  implementation: (...args: unknown[]): number => {
    // Flatten if first arg is array
    const values = Array.isArray(args[0]) && args.length === 1 ? args[0] : args;

    return values.reduce((sum, val) => sum + Number(val), 0);
  },
};

/**
 * AVG - Average of numbers
 */
export const AVG: FunctionImplementation = {
  signature: {
    name: "AVG",
    category: FunctionCategory.AGGREGATE,
    minArgs: 1,
    maxArgs: "variadic",
    argTypes: [],
    returnType: "number" as DataType,
    description: "Calculate average of numbers (array or multiple arguments)",
    examples: [
      "AVG(1, 2, 3) → 2",
      "AVG([1, 2, 3, 4]) → 2.5",
    ],
    isAsync: false,
  },
  implementation: (...args: unknown[]): number => {
    // Flatten if first arg is array
    const values = Array.isArray(args[0]) && args.length === 1 ? args[0] : args;

    if (values.length === 0) {
      return 0;
    }

    const sum = values.reduce((s, val) => s + Number(val), 0);
    return sum / values.length;
  },
};

/**
 * FIRST - First element
 */
export const FIRST: FunctionImplementation = {
  signature: {
    name: "FIRST",
    category: FunctionCategory.AGGREGATE,
    minArgs: 1,
    maxArgs: 1,
    argTypes: [["array" as DataType]],
    returnType: "any" as DataType,
    description: "Get first element from array",
    examples: ["FIRST([1, 2, 3]) → 1"],
    isAsync: false,
  },
  implementation: (arr: unknown): unknown => {
    if (!Array.isArray(arr)) {
      throw new TypeError(
        `FIRST function requires an array, got ${typeof arr}`,
      );
    }

    if (arr.length === 0) {
      return undefined;
    }

    return arr[0];
  },
};

/**
 * LAST - Last element
 */
export const LAST: FunctionImplementation = {
  signature: {
    name: "LAST",
    category: FunctionCategory.AGGREGATE,
    minArgs: 1,
    maxArgs: 1,
    argTypes: [["array" as DataType]],
    returnType: "any" as DataType,
    description: "Get last element from array",
    examples: ["LAST([1, 2, 3]) → 3"],
    isAsync: false,
  },
  implementation: (arr: unknown): unknown => {
    if (!Array.isArray(arr)) {
      throw new TypeError(
        `LAST function requires an array, got ${typeof arr}`,
      );
    }

    if (arr.length === 0) {
      return undefined;
    }

    return arr[arr.length - 1];
  },
};

/**
 * All aggregate functions
 */
export const AGGREGATE_FUNCTIONS: FunctionImplementation[] = [
  SUM,
  AVG,
  FIRST,
  LAST,
];
