/**
 * Token type definitions for the lexer
 */

/**
 * Token types (80+ types as specified in architecture)
 */
export enum TokenType {
  // Keywords
  SELECT = "SELECT",
  FROM = "FROM",
  WHERE = "WHERE",
  ORDER = "ORDER",
  BY = "BY",
  LIMIT = "LIMIT",
  OFFSET = "OFFSET",
  NAVIGATE = "NAVIGATE",
  TO = "TO",
  WITH = "WITH",
  CAPTURE = "CAPTURE",
  SET = "SET",
  SHOW = "SHOW",
  FOR = "FOR",
  EACH = "EACH",
  IN = "IN",
  IF = "IF",
  THEN = "THEN",
  ELSE = "ELSE",
  INSERT = "INSERT",
  INTO = "INTO",
  UPDATE = "UPDATE",
  DELETE = "DELETE",
  AS = "AS",

  // Logical operators
  AND = "AND",
  OR = "OR",
  NOT = "NOT",

  // Comparison operators
  EQUALS = "EQUALS", // =
  NOT_EQUALS = "NOT_EQUALS", // !=
  GREATER = "GREATER", // >
  GREATER_EQ = "GREATER_EQ", // >=
  LESS = "LESS", // <
  LESS_EQ = "LESS_EQ", // <=
  LIKE = "LIKE",
  NOT_LIKE = "NOT_LIKE",
  MATCHES = "MATCHES",
  CONTAINS = "CONTAINS",

  // Arithmetic operators
  PLUS = "PLUS", // +
  MINUS = "MINUS", // -
  STAR = "STAR", // *
  SLASH = "SLASH", // /
  PERCENT = "PERCENT", // %
  CONCAT = "CONCAT", // ||

  // Literals
  STRING = "STRING",
  NUMBER = "NUMBER",
  BOOLEAN = "BOOLEAN",
  NULL = "NULL",

  // Identifiers
  IDENTIFIER = "IDENTIFIER",

  // Punctuation
  LEFT_PAREN = "LEFT_PAREN", // (
  RIGHT_PAREN = "RIGHT_PAREN", // )
  LEFT_BRACE = "LEFT_BRACE", // {
  RIGHT_BRACE = "RIGHT_BRACE", // }
  LEFT_BRACKET = "LEFT_BRACKET", // [
  RIGHT_BRACKET = "RIGHT_BRACKET", // ]
  COMMA = "COMMA", // ,
  DOT = "DOT", // .
  COLON = "COLON", // :
  SEMICOLON = "SEMICOLON", // ;
  ARROW = "ARROW", // ->

  // Special literals
  URL = "URL",
  REGEX = "REGEX",
  DURATION = "DURATION",
  BYTES = "BYTES",

  // Control flow
  PARALLEL = "PARALLEL",
  BATCH = "BATCH",
  STREAM = "STREAM",
  RETRY = "RETRY",

  // Query operations
  CLICK = "CLICK",
  TYPE = "TYPE",
  WAIT = "WAIT",
  SCREENSHOT = "SCREENSHOT",
  PDF = "PDF",
  EVALUATE = "EVALUATE",

  // Cache operations
  CACHE = "CACHE",
  CACHED = "CACHED",
  INVALIDATE = "INVALIDATE",

  // Metadata
  COOKIES = "COOKIES",
  HEADERS = "HEADERS",
  CONNECTIONS = "CONNECTIONS",
  METRICS = "METRICS",
  STATE = "STATE",

  // Special
  EOF = "EOF",
  WHITESPACE = "WHITESPACE",
  COMMENT = "COMMENT",
  NEWLINE = "NEWLINE",

  // Error
  UNKNOWN = "UNKNOWN",
}

/**
 * Token representation
 */
export interface Token {
  type: TokenType;
  value: string;
  line: number;
  column: number;
  offset: number;
}

/**
 * Position in source
 */
export interface Position {
  line: number;
  column: number;
  offset: number;
}

/**
 * Check if a string is a keyword
 */
export function isKeyword(value: string): boolean {
  const keywords = [
    "SELECT",
    "FROM",
    "WHERE",
    "ORDER",
    "BY",
    "LIMIT",
    "OFFSET",
    "NAVIGATE",
    "TO",
    "WITH",
    "CAPTURE",
    "SET",
    "SHOW",
    "FOR",
    "EACH",
    "IN",
    "IF",
    "THEN",
    "ELSE",
    "INSERT",
    "INTO",
    "UPDATE",
    "DELETE",
    "AS",
    "AND",
    "OR",
    "NOT",
    "LIKE",
    "MATCHES",
    "CONTAINS",
    "NULL",
    "TRUE",
    "FALSE",
    "PARALLEL",
    "BATCH",
    "STREAM",
    "RETRY",
    "CLICK",
    "TYPE",
    "WAIT",
    "SCREENSHOT",
    "PDF",
    "EVALUATE",
    "CACHE",
    "CACHED",
    "INVALIDATE",
    "COOKIES",
    "HEADERS",
    "CONNECTIONS",
    "METRICS",
    "STATE",
  ];

  return keywords.includes(value.toUpperCase());
}

/**
 * Get TokenType for a keyword string
 */
export function getKeywordType(value: string): TokenType {
  const upperValue = value.toUpperCase();

  // Handle TRUE/FALSE separately
  if (upperValue === "TRUE" || upperValue === "FALSE") {
    return TokenType.BOOLEAN;
  }

  // Return the TokenType enum value if it exists
  return (TokenType as any)[upperValue] || TokenType.IDENTIFIER;
}

/**
 * Create a new token
 */
export function createToken(
  type: TokenType,
  value: string,
  line: number,
  column: number,
  offset: number,
): Token {
  return { type, value, line, column, offset };
}
