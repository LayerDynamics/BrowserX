/**
 * Schema module type definitions
 * Function signatures, DOM/network schema entries, registry types
 */

import type { CSSSelector, URLString, XPathExpression } from "../types/primitives.ts";
import type { ExecutionContext } from "../planner/plan.ts";

/**
 * Data types for function parameters and return values
 */
export enum DataType {
  STRING = "string",
  NUMBER = "number",
  BOOLEAN = "boolean",
  ARRAY = "array",
  OBJECT = "object",
  NULL = "null",
  UNDEFINED = "undefined",
  ANY = "any",
  URL = "url",
  CSS_SELECTOR = "css_selector",
  XPATH = "xpath",
  DATE = "date",
  BUFFER = "buffer",
}

/**
 * Function categories for organization
 */
export enum FunctionCategory {
  STRING = "string",
  DOM = "dom",
  NETWORK = "network",
  UTILITY = "utility",
  MATH = "math",
  AGGREGATE = "aggregate",
  CUSTOM = "custom",
}

/**
 * Function signature definition
 * Describes function metadata without implementation
 */
export interface FunctionSignature {
  readonly name: string;
  readonly category: FunctionCategory;
  readonly minArgs: number;
  readonly maxArgs: number | "variadic";
  readonly argTypes: DataType[][]; // Multiple signatures for overloading
  readonly returnType: DataType | ((args: DataType[]) => DataType);
  readonly description: string;
  readonly examples: string[];
  readonly isAsync: boolean;
}

/**
 * Function implementation
 * Combines signature with executable code
 */
export interface FunctionImplementation {
  readonly signature: FunctionSignature;
  readonly implementation: (...args: unknown[]) => unknown | Promise<unknown>;
}

/**
 * Function validation result
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
  expectedTypes?: DataType[][];
  actualTypes?: DataType[];
}

/**
 * Function documentation
 */
export interface FunctionDocumentation {
  name: string;
  category: string;
  description: string;
  signature: string;
  parameters: ParameterDoc[];
  returnType: string;
  examples: string[];
  isAsync: boolean;
}

export interface ParameterDoc {
  name: string;
  type: string;
  description?: string;
  optional?: boolean;
}

/**
 * DOM schema entry
 * Maps field names to DOM selectors
 */
export interface DOMSchemaEntry {
  readonly field: string;
  readonly selector: CSSSelector | XPathExpression;
  readonly type: "css" | "xpath";
  readonly extract: "text" | "html" | "attr" | "property";
  readonly attribute?: string;
  readonly property?: string;
  readonly description?: string;
  readonly multiple?: boolean; // Extract multiple elements
}

/**
 * Network schema entry
 * Maps field names to network request/response properties
 */
export interface NetworkSchemaEntry {
  readonly field: string;
  readonly source: "request" | "response" | "timing";
  readonly path: string[]; // Property path (e.g., ['headers', 'content-type'])
  readonly type: DataType;
  readonly description?: string;
}

/**
 * Schema resolution result
 */
export interface SchemaResolutionResult {
  found: boolean;
  entry?: DOMSchemaEntry | NetworkSchemaEntry;
  error?: string;
}

/**
 * Function execution context
 * Additional context passed to functions during execution
 */
export interface FunctionExecutionContext extends ExecutionContext {
  currentElement?: unknown; // DOM element (injected by browser context)
  currentPage?: unknown; // Browser page object
  currentBrowser?: unknown; // Browser instance
}

/**
 * Custom function registration options
 */
export interface CustomFunctionOptions {
  name: string;
  category?: FunctionCategory;
  minArgs?: number;
  maxArgs?: number | "variadic";
  argTypes?: DataType[][];
  returnType?: DataType | ((args: DataType[]) => DataType);
  description?: string;
  examples?: string[];
  isAsync?: boolean;
  implementation: (...args: unknown[]) => unknown | Promise<unknown>;
}

/**
 * Function registry statistics
 */
export interface RegistryStats {
  totalFunctions: number;
  byCategory: Record<string, number>;
  customFunctions: number;
  asyncFunctions: number;
}
