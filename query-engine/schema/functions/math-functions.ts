/**
 * Math Functions
 * Built-in mathematical functions
 */

import type { DataType, FunctionImplementation } from "../types.ts";
import { FunctionCategory } from "../types.ts";

/**
 * ABS - Absolute value
 */
export const ABS: FunctionImplementation = {
  signature: {
    name: "ABS",
    category: FunctionCategory.MATH,
    minArgs: 1,
    maxArgs: 1,
    argTypes: [["number" as DataType]],
    returnType: "number" as DataType,
    description: "Return absolute value of number",
    examples: ["ABS(-5) → 5", "ABS(3.14) → 3.14"],
    isAsync: false,
  },
  implementation: (num: unknown): number => {
    return Math.abs(Number(num));
  },
};

/**
 * CEIL - Round up to nearest integer
 */
export const CEIL: FunctionImplementation = {
  signature: {
    name: "CEIL",
    category: FunctionCategory.MATH,
    minArgs: 1,
    maxArgs: 1,
    argTypes: [["number" as DataType]],
    returnType: "number" as DataType,
    description: "Round up to nearest integer",
    examples: ["CEIL(3.14) → 4", "CEIL(-2.5) → -2"],
    isAsync: false,
  },
  implementation: (num: unknown): number => {
    return Math.ceil(Number(num));
  },
};

/**
 * FLOOR - Round down to nearest integer
 */
export const FLOOR: FunctionImplementation = {
  signature: {
    name: "FLOOR",
    category: FunctionCategory.MATH,
    minArgs: 1,
    maxArgs: 1,
    argTypes: [["number" as DataType]],
    returnType: "number" as DataType,
    description: "Round down to nearest integer",
    examples: ["FLOOR(3.14) → 3", "FLOOR(-2.5) → -3"],
    isAsync: false,
  },
  implementation: (num: unknown): number => {
    return Math.floor(Number(num));
  },
};

/**
 * ROUND - Round to nearest integer or decimal places
 */
export const ROUND: FunctionImplementation = {
  signature: {
    name: "ROUND",
    category: FunctionCategory.MATH,
    minArgs: 1,
    maxArgs: 2,
    argTypes: [
      ["number" as DataType],
      ["number" as DataType, "number" as DataType],
    ],
    returnType: "number" as DataType,
    description: "Round to nearest integer or specified decimal places",
    examples: [
      "ROUND(3.14) → 3",
      "ROUND(3.14159, 2) → 3.14",
    ],
    isAsync: false,
  },
  implementation: (num: unknown, decimals?: unknown): number => {
    const n = Number(num);

    if (decimals === undefined) {
      return Math.round(n);
    }

    const d = Number(decimals);
    const multiplier = Math.pow(10, d);
    return Math.round(n * multiplier) / multiplier;
  },
};

/**
 * SQRT - Square root
 */
export const SQRT: FunctionImplementation = {
  signature: {
    name: "SQRT",
    category: FunctionCategory.MATH,
    minArgs: 1,
    maxArgs: 1,
    argTypes: [["number" as DataType]],
    returnType: "number" as DataType,
    description: "Calculate square root",
    examples: ["SQRT(16) → 4", "SQRT(2) → 1.414..."],
    isAsync: false,
  },
  implementation: (num: unknown): number => {
    return Math.sqrt(Number(num));
  },
};

/**
 * POW - Power/exponentiation
 */
export const POW: FunctionImplementation = {
  signature: {
    name: "POW",
    category: FunctionCategory.MATH,
    minArgs: 2,
    maxArgs: 2,
    argTypes: [["number" as DataType, "number" as DataType]],
    returnType: "number" as DataType,
    description: "Raise number to power",
    examples: ["POW(2, 3) → 8", "POW(10, 2) → 100"],
    isAsync: false,
  },
  implementation: (base: unknown, exponent: unknown): number => {
    return Math.pow(Number(base), Number(exponent));
  },
};

/**
 * MIN - Minimum value
 */
export const MIN: FunctionImplementation = {
  signature: {
    name: "MIN",
    category: FunctionCategory.MATH,
    minArgs: 1,
    maxArgs: "variadic",
    argTypes: [],
    returnType: "number" as DataType,
    description: "Return minimum value from arguments",
    examples: ["MIN(5, 2, 8, 1) → 1"],
    isAsync: false,
  },
  implementation: (...args: unknown[]): number => {
    const numbers = args.map((arg) => Number(arg));
    return Math.min(...numbers);
  },
};

/**
 * MAX - Maximum value
 */
export const MAX: FunctionImplementation = {
  signature: {
    name: "MAX",
    category: FunctionCategory.MATH,
    minArgs: 1,
    maxArgs: "variadic",
    argTypes: [],
    returnType: "number" as DataType,
    description: "Return maximum value from arguments",
    examples: ["MAX(5, 2, 8, 1) → 8"],
    isAsync: false,
  },
  implementation: (...args: unknown[]): number => {
    const numbers = args.map((arg) => Number(arg));
    return Math.max(...numbers);
  },
};

/**
 * RANDOM - Random number
 */
export const RANDOM: FunctionImplementation = {
  signature: {
    name: "RANDOM",
    category: FunctionCategory.MATH,
    minArgs: 0,
    maxArgs: 2,
    argTypes: [
      [],
      ["number" as DataType],
      ["number" as DataType, "number" as DataType],
    ],
    returnType: "number" as DataType,
    description: "Generate random number (0-1, 0-max, or min-max)",
    examples: [
      "RANDOM() → 0.547...",
      "RANDOM(10) → 7",
      "RANDOM(5, 10) → 8",
    ],
    isAsync: false,
  },
  implementation: (min?: unknown, max?: unknown): number => {
    if (min === undefined && max === undefined) {
      return Math.random();
    }

    if (max === undefined) {
      // RANDOM(max) → 0 to max
      return Math.floor(Math.random() * Number(min));
    }

    // RANDOM(min, max) → min to max
    const minNum = Number(min);
    const maxNum = Number(max);
    return Math.floor(Math.random() * (maxNum - minNum + 1)) + minNum;
  },
};

/**
 * All math functions
 */
export const MATH_FUNCTIONS: FunctionImplementation[] = [
  ABS,
  CEIL,
  FLOOR,
  ROUND,
  SQRT,
  POW,
  MIN,
  MAX,
  RANDOM,
];
