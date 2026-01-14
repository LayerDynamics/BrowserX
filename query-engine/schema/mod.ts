/**
 * Schema module exports
 * Function registry, DOM/network schemas, built-in functions
 */

// Types (exclude DataType to avoid collision with types/primitives.ts)
export {
  type CustomFunctionOptions,
  type DOMSchemaEntry,
  FunctionCategory,
  type FunctionDocumentation,
  type FunctionExecutionContext,
  type FunctionImplementation,
  type FunctionSignature,
  type NetworkSchemaEntry,
  type ParameterDoc,
  type RegistryStats,
  type SchemaResolutionResult,
  type ValidationResult,
} from "./types.ts";

// Function registry
export * from "./registry.ts";

// Schemas
export * from "./dom-schema.ts";
export * from "./network-schema.ts";

// Built-in functions
export * from "./functions/mod.ts";

// Built-in registry
export * from "./builtin-registry.ts";

// Re-export commonly used items
export { FunctionRegistry, globalRegistry } from "./registry.ts";
export { createBuiltinRegistry, registerBuiltinFunctions } from "./builtin-registry.ts";
export { getAllDOMFields, registerDOMField, resolveDOMField } from "./dom-schema.ts";
export {
  getAllNetworkFields,
  registerNetworkField,
  resolveNetworkField,
} from "./network-schema.ts";
