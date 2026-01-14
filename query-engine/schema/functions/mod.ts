/**
 * Function module exports
 * All built-in query functions
 */

export * from "./string-functions.ts";
export * from "./math-functions.ts";
export * from "./utility-functions.ts";
export * from "./aggregate-functions.ts";
export * from "./dom-functions.ts";
export * from "./network-functions.ts";

import { STRING_FUNCTIONS } from "./string-functions.ts";
import { MATH_FUNCTIONS } from "./math-functions.ts";
import { UTILITY_FUNCTIONS } from "./utility-functions.ts";
import { AGGREGATE_FUNCTIONS } from "./aggregate-functions.ts";
import { DOM_FUNCTIONS } from "./dom-functions.ts";
import { NETWORK_FUNCTIONS } from "./network-functions.ts";

import type { FunctionImplementation } from "../types.ts";

/**
 * All built-in functions (40+ functions)
 */
export const ALL_BUILTIN_FUNCTIONS: FunctionImplementation[] = [
  ...STRING_FUNCTIONS, // 11 functions
  ...MATH_FUNCTIONS, // 9 functions
  ...UTILITY_FUNCTIONS, // 7 functions
  ...AGGREGATE_FUNCTIONS, // 4 functions
  ...DOM_FUNCTIONS, // 5 functions
  ...NETWORK_FUNCTIONS, // 4 functions
];
