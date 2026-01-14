/**
 * Built-in Function Registry
 * Auto-registers all built-in functions
 */

import { FunctionRegistry } from "./registry.ts";
import { ALL_BUILTIN_FUNCTIONS } from "./functions/mod.ts";

/**
 * Create and populate a function registry with all built-in functions
 */
export function createBuiltinRegistry(): FunctionRegistry {
  const registry = new FunctionRegistry();

  // Register all built-in functions
  registry.registerAll(ALL_BUILTIN_FUNCTIONS);

  return registry;
}

/**
 * Register built-in functions into existing registry
 */
export function registerBuiltinFunctions(registry: FunctionRegistry): void {
  registry.registerAll(ALL_BUILTIN_FUNCTIONS);
}

/**
 * Get list of all built-in function names
 */
export function getBuiltinFunctionNames(): string[] {
  return ALL_BUILTIN_FUNCTIONS.map((func) => func.signature.name);
}

/**
 * Check if function name is a built-in function
 */
export function isBuiltinFunction(name: string): boolean {
  const upperName = name.toUpperCase();
  return ALL_BUILTIN_FUNCTIONS.some((func) => func.signature.name === upperName);
}
