/**
 * AST Builder Test Helpers
 * Provides a DSL for programmatically building AST nodes in tests
 * Reduces boilerplate and makes test code cleaner and more readable
 */

import {
  ArrayExpression,
  Assignment,
  BinaryExpression,
  BinaryOperator,
  BlockStatement,
  CallExpression,
  Expression,
  Field,
  Identifier,
  IfStatement,
  Literal,
  MemberExpression,
  NavigateOptions,
  NavigateStatement,
  ObjectExpression,
  Property,
  SelectStatement,
  Source,
  Statement,
  UnaryExpression,
  UnaryOperator,
} from "../../types/ast.ts";
import { DataType } from "../../types/primitives.ts";

/**
 * Build a SELECT statement
 */
export function buildSelectStatement(options: {
  fields: (string | Field)[];
  source: string | Source;
  where?: Expression;
  orderBy?: Array<{ field: string; direction: "ASC" | "DESC" }>;
  limit?: { count: number; offset?: number };
}): SelectStatement {
  const fields = options.fields.map((f) =>
    typeof f === "string" ? { name: f } : f
  );

  const source: Source = typeof options.source === "string"
    ? { type: "URL", value: options.source }
    : options.source;

  return {
    type: "SELECT",
    fields,
    source,
    where: options.where,
    orderBy: options.orderBy,
    limit: options.limit,
  };
}

/**
 * Build a binary expression (e.g., a = b, x > y, foo AND bar)
 */
export function buildBinaryExpression(
  left: Expression,
  operator: BinaryOperator,
  right: Expression,
): BinaryExpression {
  return {
    type: "BINARY",
    operator,
    left,
    right,
  };
}

/**
 * Build a unary expression (e.g., NOT x, -5)
 */
export function buildUnaryExpression(
  operator: UnaryOperator,
  operand: Expression,
): UnaryExpression {
  return {
    type: "UNARY",
    operator,
    operand,
  };
}

/**
 * Build an identifier node
 */
export function buildIdentifier(name: string): Identifier {
  return {
    type: "IDENTIFIER",
    name,
  };
}

/**
 * Build a literal node (string, number, boolean, null)
 */
export function buildLiteral(
  value: unknown,
  dataType?: DataType,
): Literal {
  // Auto-detect type if not provided
  const inferredType = dataType || inferDataType(value);

  return {
    type: "LITERAL",
    dataType: inferredType,
    value,
  };
}

/**
 * Infer DataType from JavaScript value
 */
function inferDataType(value: unknown): DataType {
  if (value === null) return DataType.NULL;
  if (typeof value === "string") return DataType.STRING;
  if (typeof value === "number") return DataType.NUMBER;
  if (typeof value === "boolean") return DataType.BOOLEAN;
  if (Array.isArray(value)) return DataType.ARRAY;
  if (typeof value === "object") return DataType.OBJECT;
  return DataType.UNKNOWN;
}

/**
 * Build a function call expression
 */
export function buildFunctionCall(
  name: string,
  args: Expression[],
): CallExpression {
  return {
    type: "CALL",
    callee: name,
    arguments: args,
  };
}

/**
 * Build a member access expression (e.g., obj.field)
 */
export function buildMemberExpression(
  object: Expression,
  property: string,
  computed = false,
): MemberExpression {
  return {
    type: "MEMBER",
    object,
    property,
    computed,
  };
}

/**
 * Build an array expression [1, 2, 3]
 */
export function buildArrayExpression(
  elements: Expression[],
): ArrayExpression {
  return {
    type: "ARRAY",
    elements,
  };
}

/**
 * Build an object expression {key: value}
 */
export function buildObjectExpression(
  properties: Record<string, Expression>,
): ObjectExpression {
  const props: Property[] = Object.entries(properties).map(([key, value]) => ({
    key,
    value,
  }));

  return {
    type: "OBJECT",
    properties: props,
  };
}

/**
 * Build a NAVIGATE statement
 */
export function buildNavigateStatement(options: {
  url: string | Expression;
  navigateOptions?: NavigateOptions;
  capture?: { fields: (string | Field)[] };
}): NavigateStatement {
  const url = typeof options.url === "string"
    ? buildLiteral(options.url, DataType.STRING)
    : options.url;

  const capture = options.capture
    ? {
      fields: options.capture.fields.map((f) =>
        typeof f === "string" ? { name: f } : f
      ),
    }
    : undefined;

  return {
    type: "NAVIGATE",
    url,
    options: options.navigateOptions,
    capture,
  };
}

/**
 * Build an IF statement
 */
export function buildIfStatement(
  condition: Expression,
  thenBranch: Statement,
  elseBranch?: Statement,
): IfStatement {
  return {
    type: "IF",
    condition,
    then: thenBranch,
    else: elseBranch,
  };
}

/**
 * Build a block statement containing multiple statements
 */
export function buildBlockStatement(
  statements: Statement[],
): BlockStatement {
  return {
    type: "BLOCK",
    statements,
  };
}

/**
 * Build a Field object for SELECT statements
 */
export function buildField(
  name: string,
  options?: {
    alias?: string;
    path?: string[];
    expression?: Expression;
  },
): Field {
  return {
    name,
    alias: options?.alias,
    path: options?.path,
    expression: options?.expression,
  };
}

/**
 * Build an Assignment for UPDATE statements
 */
export function buildAssignment(
  property: string,
  value: Expression,
): Assignment {
  return {
    property,
    value,
  };
}
