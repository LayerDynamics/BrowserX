/**
 * Getter Verification Script
 * Tests that all getter methods return expected values
 */

import {
  QueryEngine,
  Lexer,
  Parser,
  SemanticAnalyzer,
  SymbolTable,
  TypeChecker,
  QueryOptimizer,
  CostEstimator,
  ExecutionPlanner,
  QueryExecutor,
  StateManager,
  QueryCacheManager,
  SessionStateManager,
  BrowserStateTracker,
  VariableScope,
  BrowserController,
  ProxyController,
  FunctionRegistry,
  MetricsCollector,
  ExpressionEvaluator,
  SecurityValidator,
  ResultFormatter,
} from "./mod.ts";

console.log("✓ Getter Verification Starting...\n");

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void | Promise<void>) {
  try {
    const result = fn();
    if (result instanceof Promise) {
      result.then(() => {
        console.log(`✓ ${name}`);
        passed++;
      }).catch((error) => {
        console.error(`✗ ${name}: ${error instanceof Error ? error.message : String(error)}`);
        failed++;
      });
    } else {
      console.log(`✓ ${name}`);
      passed++;
    }
  } catch (error) {
    console.error(`✗ ${name}: ${error instanceof Error ? error.message : String(error)}`);
    failed++;
  }
}

function assertExists(value: unknown, name: string) {
  if (value === undefined) {
    throw new Error(`${name} returned undefined`);
  }
}

// QueryEngine getters
test("QueryEngine.getConfig()", () => {
  const engine = new QueryEngine({ timeout: 5000 });
  const config = engine.getConfig();
  assertExists(config, "config");
  if (config.timeout !== 5000) throw new Error("Config not preserved");
});

test("QueryEngine.getQueries()", () => {
  const engine = new QueryEngine();
  const queries = engine.getQueries();
  assertExists(queries, "queries");
  if (!(queries instanceof Map)) throw new Error("Not a Map");
});

test("QueryEngine.getAbortControllers()", () => {
  const engine = new QueryEngine();
  const controllers = engine.getAbortControllers();
  assertExists(controllers, "controllers");
  if (!(controllers instanceof Map)) throw new Error("Not a Map");
});

test("QueryEngine.isInitialized()", () => {
  const engine = new QueryEngine();
  const initialized = engine.isInitialized();
  if (typeof initialized !== "boolean") throw new Error("Not a boolean");
});

// Lexer getters
test("Lexer.getSource()", () => {
  const lexer = new Lexer("SELECT * FROM page");
  const source = lexer.getSource();
  if (source !== "SELECT * FROM page") throw new Error("Source mismatch");
});

test("Lexer.getTokens()", () => {
  const lexer = new Lexer("SELECT * FROM page");
  lexer.tokenize();
  const tokens = lexer.getTokens();
  if (!Array.isArray(tokens)) throw new Error("Not an array");
});

test("Lexer.getPosition()", () => {
  const lexer = new Lexer("SELECT");
  const pos = lexer.getPosition();
  if (typeof pos !== "number") throw new Error("Not a number");
});

test("Lexer.getLine()", () => {
  const lexer = new Lexer("SELECT");
  const line = lexer.getLine();
  if (typeof line !== "number") throw new Error("Not a number");
});

test("Lexer.getColumn()", () => {
  const lexer = new Lexer("SELECT");
  const col = lexer.getColumn();
  if (typeof col !== "number") throw new Error("Not a number");
});

// Parser getters
test("Parser.getTokens()", () => {
  const lexer = new Lexer("SELECT * FROM page");
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const parserTokens = parser.getTokens();
  if (!Array.isArray(parserTokens)) throw new Error("Not an array");
});

test("Parser.getCurrentToken()", () => {
  const lexer = new Lexer("SELECT * FROM page");
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const token = parser.getCurrentToken();
  assertExists(token, "token");
});

test("Parser.getPosition()", () => {
  const lexer = new Lexer("SELECT * FROM page");
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const pos = parser.getPosition();
  if (typeof pos !== "number") throw new Error("Not a number");
});

// SymbolTable getters
test("SymbolTable.getParentScope()", () => {
  const table = new SymbolTable();
  const parent = table.getParentScope();
  // Root scope should have null parent
  if (parent !== null) {
    throw new Error("Root scope should have null parent");
  }
});

test("SymbolTable.getScopeCounter()", () => {
  const table = new SymbolTable();
  const counter = table.getScopeCounter();
  if (typeof counter !== "number") throw new Error("Not a number");
});

// QueryCacheManager getters
test("QueryCacheManager.getConfig()", () => {
  const cache = new QueryCacheManager({ maxSize: 1024 });
  const config = cache.getConfig();
  assertExists(config, "config");
  if (config.maxSize !== 1024) throw new Error("Config not preserved");
});

test("QueryCacheManager.getMaxSize()", () => {
  const cache = new QueryCacheManager({ maxSize: 2048 });
  const maxSize = cache.getMaxSize();
  if (maxSize !== 2048) throw new Error("MaxSize mismatch");
});

test("QueryCacheManager.getCurrentSize()", () => {
  const cache = new QueryCacheManager();
  const size = cache.getCurrentSize();
  if (typeof size !== "number") throw new Error("Not a number");
});

test("QueryCacheManager.getEntryCount()", () => {
  const cache = new QueryCacheManager();
  const count = cache.getEntryCount();
  if (typeof count !== "number") throw new Error("Not a number");
});

// SessionStateManager getters
test("SessionStateManager.getSessionTimeout()", () => {
  const mgr = new SessionStateManager(60000);
  const timeout = mgr.getSessionTimeout();
  if (timeout !== 60000) throw new Error("Timeout mismatch");
});

test("SessionStateManager.getAllSessionIds()", () => {
  const mgr = new SessionStateManager();
  const ids = mgr.getAllSessionIds();
  if (!Array.isArray(ids)) throw new Error("Not an array");
});

test("SessionStateManager.getAllSessions()", () => {
  const mgr = new SessionStateManager();
  const sessions = mgr.getAllSessions();
  if (!(sessions instanceof Map)) throw new Error("Not a Map");
});

// BrowserStateTracker getters
test("BrowserStateTracker.getCurrentURL()", () => {
  const tracker = new BrowserStateTracker();
  const url = tracker.getCurrentURL();
  // Can be undefined initially
  if (url !== undefined && typeof url !== "string") throw new Error("Invalid URL");
});

test("BrowserStateTracker.getNavigationHistory()", () => {
  const tracker = new BrowserStateTracker();
  const history = tracker.getNavigationHistory();
  if (!Array.isArray(history)) throw new Error("Not an array");
});

test("BrowserStateTracker.getHistoryIndex()", () => {
  const tracker = new BrowserStateTracker();
  const index = tracker.getHistoryIndex();
  if (typeof index !== "number") throw new Error("Not a number");
});

// VariableScope getters
test("VariableScope.getId()", () => {
  const scope = new VariableScope();
  const id = scope.getId();
  if (typeof id !== "string") throw new Error("Not a string");
});

test("VariableScope.getParent()", () => {
  const scope = new VariableScope();
  const parent = scope.getParent();
  // Root scope has no parent
  if (parent !== null && typeof parent !== "object") throw new Error("Invalid parent");
});

test("VariableScope.getOwnVariables()", () => {
  const scope = new VariableScope();
  const vars = scope.getOwnVariables();
  if (!(vars instanceof Map)) throw new Error("Not a Map");
});

test("VariableScope.getAllVariables()", () => {
  const scope = new VariableScope();
  const vars = scope.getAllVariables();
  if (!(vars instanceof Map)) throw new Error("Not a Map");
});

test("VariableScope.getDepth()", () => {
  const scope = new VariableScope();
  const depth = scope.getDepth();
  if (typeof depth !== "number") throw new Error("Not a number");
});

// FunctionRegistry getters
test("FunctionRegistry.getFunctions()", () => {
  const registry = new FunctionRegistry();
  const funcs = registry.getFunctions();
  if (!(funcs instanceof Map)) throw new Error("Not a Map");
});

test("FunctionRegistry.getAllFunctions()", () => {
  const registry = new FunctionRegistry();
  const funcs = registry.getAllFunctions();
  if (!Array.isArray(funcs)) throw new Error("Not an array");
});

test("FunctionRegistry.getFunctionCount()", () => {
  const registry = new FunctionRegistry();
  const count = registry.getFunctionCount();
  if (typeof count !== "number") throw new Error("Not a number");
});

test("FunctionRegistry.getCategories()", () => {
  const registry = new FunctionRegistry();
  const cats = registry.getCategories();
  if (!Array.isArray(cats)) throw new Error("Not an array");
});

test("FunctionRegistry.getAsyncFunctions()", () => {
  const registry = new FunctionRegistry();
  const funcs = registry.getAsyncFunctions();
  if (!Array.isArray(funcs)) throw new Error("Not an array");
});

test("FunctionRegistry.getSyncFunctions()", () => {
  const registry = new FunctionRegistry();
  const funcs = registry.getSyncFunctions();
  if (!Array.isArray(funcs)) throw new Error("Not an array");
});

// MetricsCollector getters
test("MetricsCollector.getCountersMap()", () => {
  const metrics = new MetricsCollector();
  const counters = metrics.getCountersMap();
  if (!(counters instanceof Map)) throw new Error("Not a Map");
});

test("MetricsCollector.getGaugesMap()", () => {
  const metrics = new MetricsCollector();
  const gauges = metrics.getGaugesMap();
  if (!(gauges instanceof Map)) throw new Error("Not a Map");
});

test("MetricsCollector.getHistogramsMap()", () => {
  const metrics = new MetricsCollector();
  const histograms = metrics.getHistogramsMap();
  if (!(histograms instanceof Map)) throw new Error("Not a Map");
});

test("MetricsCollector.getCounterCount()", () => {
  const metrics = new MetricsCollector();
  const count = metrics.getCounterCount();
  if (typeof count !== "number") throw new Error("Not a number");
});

test("MetricsCollector.getQueryMetrics()", () => {
  const metrics = new MetricsCollector();
  const qMetrics = metrics.getQueryMetrics();
  if (!Array.isArray(qMetrics)) throw new Error("Not an array");
});

// ExpressionEvaluator getters
test("ExpressionEvaluator.getContext()", () => {
  const evaluator = new ExpressionEvaluator({
    variables: new Map(),
    functions: new Map(),
  });
  const ctx = evaluator.getContext();
  assertExists(ctx, "context");
  if (!ctx.variables) throw new Error("Missing variables");
});

test("ExpressionEvaluator.getFunctionRegistry()", () => {
  const evaluator = new ExpressionEvaluator({
    variables: new Map(),
    functions: new Map(),
  });
  const registry = evaluator.getFunctionRegistry();
  assertExists(registry, "registry");
});

test("ExpressionEvaluator.getVariables()", () => {
  const evaluator = new ExpressionEvaluator({
    variables: new Map(),
    functions: new Map(),
  });
  const vars = evaluator.getVariables();
  if (!(vars instanceof Map)) throw new Error("Not a Map");
});

test("ExpressionEvaluator.getFunctions()", () => {
  const evaluator = new ExpressionEvaluator({
    variables: new Map(),
    functions: new Map(),
  });
  const funcs = evaluator.getFunctions();
  if (!(funcs instanceof Map)) throw new Error("Not a Map");
});

// SecurityValidator getters
test("SecurityValidator.getPolicy()", () => {
  const validator = new SecurityValidator();
  const policy = validator.getPolicy();
  assertExists(policy, "policy");
  if (!policy.allowedPermissions) throw new Error("Missing permissions");
});

test("SecurityValidator.getQueryDepth()", () => {
  const validator = new SecurityValidator();
  const depth = validator.getQueryDepth();
  if (typeof depth !== "number") throw new Error("Not a number");
});

test("SecurityValidator.getMaxQueryDepth()", () => {
  const validator = new SecurityValidator({ maxQueryDepth: 20 });
  const maxDepth = validator.getMaxQueryDepth();
  if (maxDepth !== 20) throw new Error("Max depth mismatch");
});

test("SecurityValidator.getAllowedPermissions()", () => {
  const validator = new SecurityValidator();
  const perms = validator.getAllowedPermissions();
  if (!Array.isArray(perms)) throw new Error("Not an array");
});

test("SecurityValidator.getAllowedProtocols()", () => {
  const validator = new SecurityValidator();
  const protocols = validator.getAllowedProtocols();
  if (!Array.isArray(protocols)) throw new Error("Not an array");
});

// ResultFormatter getters
test("ResultFormatter.getSupportedFormats()", () => {
  const formatter = new ResultFormatter();
  const formats = formatter.getSupportedFormats();
  if (!Array.isArray(formats)) throw new Error("Not an array");
  if (formats.length === 0) throw new Error("No formats");
});

// Wait a bit for async tests
await new Promise((resolve) => setTimeout(resolve, 100));

// Results
console.log("\n" + "=".repeat(50));
console.log(`Getter Verification Complete`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log("=".repeat(50));

if (failed > 0) {
  Deno.exit(1);
}
