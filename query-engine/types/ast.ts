/**
 * Abstract Syntax Tree (AST) type definitions
 */

import { DataType } from "./primitives.ts";

/**
 * Base AST node interface
 */
export interface ASTNode {
  readonly type: string;
  readonly location?: SourceLocation;
}

/**
 * Source location for error reporting
 */
export interface SourceLocation {
  start: Position;
  end: Position;
}

export interface Position {
  line: number;
  column: number;
  offset: number;
}

/**
 * Statement types
 */
export type Statement =
  | SelectStatement
  | NavigateStatement
  | SetStatement
  | ShowStatement
  | ForStatement
  | IfStatement
  | InsertStatement
  | UpdateStatement
  | DeleteStatement
  | WithStatement;

/**
 * SELECT statement
 */
export interface SelectStatement extends ASTNode {
  type: "SELECT";
  fields: Field[];
  source: Source;
  where?: Expression;
  orderBy?: OrderBy[];
  limit?: LimitClause;
}

export interface Field {
  name: string;
  alias?: string;
  path?: string[]; // For nested access: obj.field.subfield
  expression?: Expression;
}

export interface Source {
  type: "URL" | "SUBQUERY" | "VARIABLE";
  value: string | Statement;
}

export interface OrderBy {
  field: string;
  direction: "ASC" | "DESC";
}

export interface LimitClause {
  limit: number;
  offset?: number;
}

/**
 * NAVIGATE statement
 */
export interface NavigateStatement extends ASTNode {
  type: "NAVIGATE";
  url: Expression;
  options?: NavigateOptions;
  capture?: CaptureClause;
}

export interface NavigateOptions {
  proxy?: ProxyConfig;
  browser?: BrowserConfig;
  waitUntil?: "load" | "domcontentloaded" | "networkidle";
  timeout?: number;
}

export interface ProxyConfig {
  cache?: boolean | "only";
  headers?: Record<string, string>;
  intercept?: InterceptConfig;
  rotate?: boolean;
  pool?: string;
  strategy?: "round-robin" | "random" | "least-connections";
  timeout?: number;
  rateLimit?: number;
}

export interface InterceptConfig {
  urls?: string[];
  methods?: string[];
  resourceTypes?: string[];
  modify?: Expression;
}

export interface BrowserConfig {
  viewport?: { width: number; height: number };
  userAgent?: string;
  headless?: boolean;
}

export interface CaptureClause {
  fields: Field[];
}

/**
 * SET statement
 */
export interface SetStatement extends ASTNode {
  type: "SET";
  path: string[];
  value: Expression;
}

/**
 * SHOW statement
 */
export interface ShowStatement extends ASTNode {
  type: "SHOW";
  target: ShowTarget;
  where?: Expression;
}

export type ShowTarget = "CACHE" | "COOKIES" | "HEADERS" | "CONNECTIONS" | "METRICS" | "STATE";

/**
 * FOR statement
 */
export interface ForStatement extends ASTNode {
  type: "FOR";
  variable: string;
  collection: Expression;
  body: Statement;
}

/**
 * IF statement
 */
export interface IfStatement extends ASTNode {
  type: "IF";
  condition: Expression;
  thenBranch: Statement;
  elseBranch?: Statement;
}

/**
 * INSERT statement
 */
export interface InsertStatement extends ASTNode {
  type: "INSERT";
  value: Expression;
  target: Expression; // CSS selector
}

/**
 * UPDATE statement
 */
export interface UpdateStatement extends ASTNode {
  type: "UPDATE";
  target: Expression; // CSS selector
  assignments: Assignment[];
}

export interface Assignment {
  property: string;
  value: Expression;
}

/**
 * DELETE statement
 */
export interface DeleteStatement extends ASTNode {
  type: "DELETE";
  target: Expression; // CSS selector
}

/**
 * WITH statement (CTE - Common Table Expression)
 */
export interface WithStatement extends ASTNode {
  type: "WITH";
  ctes: CTE[];
  query: Statement;
}

export interface CTE {
  name: string;
  query: Statement;
}

/**
 * Expression types
 */
export type Expression =
  | BinaryExpression
  | UnaryExpression
  | CallExpression
  | MemberExpression
  | Literal
  | Identifier
  | ArrayExpression
  | ObjectExpression;

/**
 * Binary expression (e.g., a + b, x > y)
 */
export interface BinaryExpression extends ASTNode {
  type: "BINARY";
  operator: BinaryOperator;
  left: Expression;
  right: Expression;
}

export type BinaryOperator =
  | "="
  | "!="
  | ">"
  | ">="
  | "<"
  | "<="
  | "+"
  | "-"
  | "*"
  | "/"
  | "%"
  | "AND"
  | "OR"
  | "IN"
  | "NOT IN"
  | "LIKE"
  | "NOT LIKE"
  | "MATCHES"
  | "CONTAINS"
  | "||"; // String concatenation

/**
 * Unary expression (e.g., NOT x, -5)
 */
export interface UnaryExpression extends ASTNode {
  type: "UNARY";
  operator: UnaryOperator;
  operand: Expression;
}

export type UnaryOperator = "NOT" | "-" | "+";

/**
 * Function call expression
 */
export interface CallExpression extends ASTNode {
  type: "CALL";
  callee: string; // Function name
  arguments: Expression[];
}

/**
 * Member access expression (e.g., obj.field)
 */
export interface MemberExpression extends ASTNode {
  type: "MEMBER";
  object: Expression;
  property: string;
  computed: boolean; // true for obj[field], false for obj.field
}

/**
 * Literal value
 */
export interface Literal extends ASTNode {
  type: "LITERAL";
  dataType: DataType;
  value: unknown;
}

/**
 * Identifier (variable or field reference)
 */
export interface Identifier extends ASTNode {
  type: "IDENTIFIER";
  name: string;
}

/**
 * Array literal [1, 2, 3]
 */
export interface ArrayExpression extends ASTNode {
  type: "ARRAY";
  elements: Expression[];
}

/**
 * Object literal {key: value}
 */
export interface ObjectExpression extends ASTNode {
  type: "OBJECT";
  properties: Property[];
}

export interface Property {
  key: string;
  value: Expression;
}

/**
 * Type annotation for expressions
 */
export interface TypeAnnotation {
  dataType: DataType;
  nullable: boolean;
  arrayOf?: DataType;
}
