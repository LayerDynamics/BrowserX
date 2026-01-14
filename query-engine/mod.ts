/**
 * Query Engine Main Module
 *
 * This module provides the unified interface layer for controlling both
 * Browser Engine and Proxy Engine through a declarative query language.
 */

// Core engine
export * from "./core/mod.ts";

// Types
export * from "./types/mod.ts";

// Lexer
export * from "./lexer/mod.ts";

// Parser
export * from "./parser/mod.ts";

// Semantic Analyzer
export * from "./analyzer/mod.ts";

// Optimizer
export * from "./optimizer/mod.ts";

// Planner
export * from "./planner/mod.ts";

// Executor
export * from "./executor/mod.ts";

// State Management
export * from "./state/mod.ts";

// Schema & Functions
export * from "./schema/mod.ts";

// Formatter
export * from "./formatter/mod.ts";

// Controllers
export * from "./controllers/mod.ts";

// Security
export * from "./security/mod.ts";

// Metrics
export * from "./metrics/mod.ts";

// Errors
export * from "./errors/mod.ts";

// Re-export main QueryEngine class for convenience
export { type IQueryEngine, QueryEngine } from "./core/engine.ts";
