/**
 * Test Utilities for Query Engine Tests
 * Provides helper functions for parsing, mocking, and test assertions
 */

import { Lexer } from "../../lexer/tokenizer.ts";
import { Parser } from "../../parser/parser.ts";
import type { Statement } from "../../types/ast.ts";
import type { Expression } from "../../types/ast.ts";
import type { Token } from "../../lexer/token.ts";

/**
 * Parse a query string into an AST statement
 */
export function parseQuery(query: string): Statement {
  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  return parser.parse();
}

/**
 * Parse an expression string into an AST expression
 * Note: parseExpression is private, so we parse as a SET statement instead
 */
export function parseExpression(expr: string): Expression {
  const lexer = new Lexer(`SET temp = ${expr}`);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const stmt = parser.parse() as any;
  return stmt.value; // Return the value expression from SET statement
}

/**
 * Tokenize a query string
 */
export function tokenize(input: string): Token[] {
  const lexer = new Lexer(input);
  return lexer.tokenize();
}

/**
 * Mock BrowserPage interface
 */
export interface MockBrowserPage {
  navigate: (url: string, options?: any) => Promise<void>;
  query: (selector: string, type?: string) => Promise<MockDOMElement[]>;
  click: (selector: string, type?: string) => Promise<void>;
  type: (selector: string, text: string, options?: any) => Promise<void>;
  wait: (options: any) => Promise<void>;
  screenshot: (options?: any) => Promise<Uint8Array>;
  pdf: (options?: any) => Promise<Uint8Array>;
  evaluate: (script: string, args?: unknown[]) => Promise<unknown>;
  close: () => Promise<void>;
}

/**
 * Mock DOM element interface
 */
export interface MockDOMElement {
  getText: () => Promise<string>;
  getAttribute: (name: string) => Promise<string | null>;
  getProperty: (name: string) => Promise<unknown>;
  click: () => Promise<void>;
  type: (text: string) => Promise<void>;
  getInternalElement: () => any;
}

/**
 * Create mock DOM element
 */
export function createMockDOMElement(overrides?: Partial<MockDOMElement>): MockDOMElement {
  return {
    getText: async () => "mock text",
    getAttribute: async (name: string) => `mock-${name}`,
    getProperty: async (name: string) => `mock-${name}`,
    click: async () => {},
    type: async (_text: string) => {},
    getInternalElement: () => ({
      tagName: "DIV",
      attributes: new Map([["id", "test"], ["class", "mock"]]),
    }),
    ...overrides,
  };
}

/**
 * Create mock browser page
 */
export function createMockBrowserPage(overrides?: Partial<MockBrowserPage>): MockBrowserPage {
  return {
    navigate: async (_url: string, _options?: any) => {},
    query: async (_selector: string, _type?: string) => [createMockDOMElement()],
    click: async (_selector: string, _type?: string) => {},
    type: async (_selector: string, _text: string, _options?: any) => {},
    wait: async (_options: any) => {},
    screenshot: async (_options?: any) => new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
    pdf: async (_options?: any) => new Uint8Array([0x25, 0x50, 0x44, 0x46]),
    evaluate: async (_script: string, _args?: unknown[]) => ({ result: "mock" }),
    close: async () => {},
    ...overrides,
  };
}

/**
 * Mock BrowserEngine interface
 */
export interface MockBrowserEngine {
  newPage: () => Promise<MockBrowserPage>;
  close: () => Promise<void>;
}

/**
 * Create mock browser engine
 */
export function createMockBrowserEngine(
  overrides?: Partial<MockBrowserEngine>,
): MockBrowserEngine {
  return {
    newPage: async () => createMockBrowserPage(),
    close: async () => {},
    ...overrides,
  };
}

/**
 * Mock BrowserController
 */
export function createMockBrowserController(overrides?: any) {
  return {
    executeNavigate: async (step: any) => ({ navigated: true, url: step.url }),
    executeDOMQuery: async (_step: any) => [{ text: "mock text", id: "mock-id" }],
    executeClick: async (_step: any) => {},
    executeType: async (_step: any) => {},
    executeWait: async (_step: any) => {},
    executeScreenshot: async (_step: any) => new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
    executePDF: async (_step: any) => new Uint8Array([0x25, 0x50, 0x44, 0x46]),
    executeEvaluateJS: async (_step: any) => ({ result: "mock" }),
    closePage: async () => {},
    getCurrentPage: () => createMockBrowserPage(),
    ...overrides,
  };
}

/**
 * Mock ProxyController
 */
export function createMockProxyController(overrides?: any) {
  return {
    configureSettings: async (_settings: any) => {},
    interceptRequest: async (_request: any) => {},
    interceptResponse: async (_response: any) => {},
    getCachedResponse: async (_key: string) => null,
    setCachedResponse: async (_key: string, _response: any) => {},
    getMetrics: () => ({
      totalRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
    }),
    ...overrides,
  };
}

/**
 * Mock Cache interface
 */
export interface MockCache {
  get: (key: string) => Promise<any>;
  set: (key: string, value: any, ttl?: number) => Promise<void>;
  has: (key: string) => Promise<boolean>;
  delete: (key: string) => Promise<boolean>;
  clear: () => Promise<void>;
}

/**
 * Create mock cache
 */
export function createMockCache(overrides?: Partial<MockCache>): MockCache {
  const cache = new Map<string, any>();

  return {
    get: async (key: string) => cache.get(key),
    set: async (key: string, value: any, _ttl?: number) => {
      cache.set(key, value);
    },
    has: async (key: string) => cache.has(key),
    delete: async (key: string) => cache.delete(key),
    clear: async () => {
      cache.clear();
    },
    ...overrides,
  };
}

/**
 * Create mock execution context
 */
export function createMockExecutionContext(overrides?: any) {
  return {
    variables: new Map(),
    stepResults: new Map(),
    metadata: {},
    startTime: Date.now(),
    ...overrides,
  };
}

/**
 * Create mock evaluation context
 */
export function createMockEvaluationContext(overrides?: any) {
  return {
    variables: new Map(),
    functions: new Map(),
    ...overrides,
  };
}

/**
 * Helper to extract error message from thrown error
 */
export function getErrorMessage(fn: () => void): string {
  try {
    fn();
    return "";
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

/**
 * Helper to check if function throws specific error
 */
export function throwsError(fn: () => void, expectedMessage?: string): boolean {
  try {
    fn();
    return false;
  } catch (error) {
    if (!expectedMessage) {
      return true;
    }
    const message = error instanceof Error ? error.message : String(error);
    return message.includes(expectedMessage);
  }
}

/**
 * Helper to create test query strings
 */
export const TestQueries = {
  simpleSelect: "SELECT * FROM http://example.com",
  selectWithWhere: "SELECT title, price FROM products WHERE price > 100",
  selectWithOrderBy: "SELECT * FROM users ORDER BY age DESC",
  selectWithLimit: "SELECT * FROM posts LIMIT 10",
  navigate: "NAVIGATE TO 'http://example.com'",
  navigateWithOptions: "NAVIGATE TO 'http://example.com' WITH { timeout: 5000 }",
  forEach: "FOR EACH item IN items { SHOW item }",
  ifThenElse: "IF x > 10 THEN { SHOW 'large' } ELSE { SHOW 'small' }",
  withCTE: "WITH users AS (SELECT * FROM http://api.com/users) SELECT * FROM users",
};

/**
 * Helper to compare AST nodes (shallow comparison)
 */
export function compareASTNodes(node1: any, node2: any): boolean {
  if (node1.type !== node2.type) return false;

  // Compare based on node type
  switch (node1.type) {
    case "LITERAL":
      return node1.value === node2.value;
    case "IDENTIFIER":
      return node1.name === node2.name;
    case "BINARY":
      return node1.operator === node2.operator;
    case "UNARY":
      return node1.operator === node2.operator;
    default:
      return true; // For complex nodes, just check type
  }
}

/**
 * Helper to measure execution time
 */
export async function measureTime<T>(fn: () => Promise<T>): Promise<{ result: T; duration: number }> {
  const start = performance.now();
  const result = await fn();
  const duration = performance.now() - start;
  return { result, duration };
}

/**
 * Helper to wait for async operations
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Type guard functions for narrowing Statement types
 */
export function isSelectStatement(stmt: Statement): stmt is import("../../types/ast.ts").SelectStatement {
  return stmt.type === "SELECT";
}

export function isNavigateStatement(stmt: Statement): stmt is import("../../types/ast.ts").NavigateStatement {
  return stmt.type === "NAVIGATE";
}

export function isSetStatement(stmt: Statement): stmt is import("../../types/ast.ts").SetStatement {
  return stmt.type === "SET";
}

export function isForStatement(stmt: Statement): stmt is import("../../types/ast.ts").ForStatement {
  return stmt.type === "FOR";
}

export function isIfStatement(stmt: Statement): stmt is import("../../types/ast.ts").IfStatement {
  return stmt.type === "IF";
}

export function isWithStatement(stmt: Statement): stmt is import("../../types/ast.ts").WithStatement {
  return stmt.type === "WITH";
}

export function isInsertStatement(stmt: Statement): stmt is import("../../types/ast.ts").InsertStatement {
  return stmt.type === "INSERT";
}

export function isUpdateStatement(stmt: Statement): stmt is import("../../types/ast.ts").UpdateStatement {
  return stmt.type === "UPDATE";
}

export function isDeleteStatement(stmt: Statement): stmt is import("../../types/ast.ts").DeleteStatement {
  return stmt.type === "DELETE";
}

/**
 * Type guard functions for narrowing Expression types
 */
export function isBinaryExpression(expr: Expression): expr is import("../../types/ast.ts").BinaryExpression {
  return expr.type === "BINARY";
}

export function isUnaryExpression(expr: Expression): expr is import("../../types/ast.ts").UnaryExpression {
  return expr.type === "UNARY";
}

export function isCallExpression(expr: Expression): expr is import("../../types/ast.ts").CallExpression {
  return expr.type === "CALL";
}

export function isMemberExpression(expr: Expression): expr is import("../../types/ast.ts").MemberExpression {
  return expr.type === "MEMBER";
}

export function isLiteral(expr: Expression): expr is import("../../types/ast.ts").Literal {
  return expr.type === "LITERAL";
}

export function isIdentifier(expr: Expression): expr is import("../../types/ast.ts").Identifier {
  return expr.type === "IDENTIFIER";
}

export function isArrayExpression(expr: Expression): expr is import("../../types/ast.ts").ArrayExpression {
  return expr.type === "ARRAY";
}

export function isObjectExpression(expr: Expression): expr is import("../../types/ast.ts").ObjectExpression {
  return expr.type === "OBJECT";
}
