/**
 * Parser implementation using recursive descent parsing
 * Converts token streams into Abstract Syntax Trees (AST)
 */

import { Token, TokenType } from "../lexer/token.ts";
import {
  ArrayExpression,
  Assignment,
  BinaryExpression,
  BinaryOperator,
  CallExpression,
  CTE,
  DeleteStatement,
  Expression,
  Field,
  ForStatement,
  Identifier,
  IfStatement,
  InsertStatement,
  LimitClause,
  Literal,
  MemberExpression,
  NavigateStatement,
  ObjectExpression,
  OrderBy,
  SelectStatement,
  SetStatement,
  ShowStatement,
  Source,
  Statement,
  UnaryExpression,
  UpdateStatement,
  WithStatement,
} from "../types/ast.ts";
import { DataType } from "../types/primitives.ts";

/**
 * Parser class for building AST from tokens
 */
export class Parser {
  private tokens: Token[];
  private current: number;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
    this.current = 0;
  }

  /**
   * Parse tokens into an AST
   */
  parse(): Statement {
    return this.parseStatement();
  }

  /**
   * Parse a statement
   */
  private parseStatement(): Statement {
    const token = this.peek();

    switch (token.type) {
      case TokenType.SELECT:
        return this.parseSelect();
      case TokenType.NAVIGATE:
        return this.parseNavigate();
      case TokenType.SET:
        return this.parseSet();
      case TokenType.SHOW:
        return this.parseShow();
      case TokenType.FOR:
        return this.parseFor();
      case TokenType.IF:
        return this.parseIf();
      case TokenType.INSERT:
        return this.parseInsert();
      case TokenType.UPDATE:
        return this.parseUpdate();
      case TokenType.DELETE:
        return this.parseDelete();
      case TokenType.WITH:
        return this.parseWith();
      default:
        throw this.error(`Unexpected statement: ${token.value}`);
    }
  }

  /**
   * Parse SELECT statement
   */
  private parseSelect(): SelectStatement {
    this.consume(TokenType.SELECT);

    const fields = this.parseFieldList();
    this.consume(TokenType.FROM);
    const source = this.parseSource();

    const where = this.match(TokenType.WHERE) ? this.parseExpression() : undefined;
    const orderBy = this.match(TokenType.ORDER) ? this.parseOrderBy() : undefined;
    const limit = this.match(TokenType.LIMIT) ? this.parseLimit() : undefined;

    return {
      type: "SELECT",
      fields,
      source,
      where,
      orderBy,
      limit,
    };
  }

  /**
   * Parse field list
   */
  private parseFieldList(): Field[] {
    const fields: Field[] = [];

    // Handle SELECT *
    if (this.match(TokenType.STAR)) {
      fields.push({ name: "*" });
      return fields;
    }

    do {
      const field = this.parseField();
      fields.push(field);
    } while (this.match(TokenType.COMMA));

    return fields;
  }

  /**
   * Parse a single field
   */
  private parseField(): Field {
    // Field can be an expression
    const expression = this.parseExpression();

    // Check for alias
    const alias = this.match(TokenType.AS) ? this.consume(TokenType.IDENTIFIER).value : undefined;

    // If it's an identifier, extract the name
    if (expression.type === "IDENTIFIER") {
      return {
        name: (expression as Identifier).name,
        alias,
      };
    }

    // If it's a member expression, extract the path
    if (expression.type === "MEMBER") {
      const path: string[] = [];
      this.extractMemberPath(expression as MemberExpression, path);
      return {
        name: path[0],
        path,
        alias,
        expression,
      };
    }

    // Otherwise, it's a complex expression
    return {
      name: alias || "expr",
      alias,
      expression,
    };
  }

  /**
   * Extract member access path
   */
  private extractMemberPath(expr: MemberExpression, path: string[]): void {
    if (expr.object.type === "IDENTIFIER") {
      path.unshift((expr.object as Identifier).name);
    } else if (expr.object.type === "MEMBER") {
      this.extractMemberPath(expr.object as MemberExpression, path);
    }
    path.push(expr.property);
  }

  /**
   * Parse source (URL or subquery)
   */
  private parseSource(): Source {
    if (this.check(TokenType.STRING)) {
      const token = this.advance();
      return { type: "URL", value: token.value };
    }

    if (this.match(TokenType.LEFT_PAREN)) {
      const subquery = this.parseStatement();
      this.consume(TokenType.RIGHT_PAREN);
      return { type: "SUBQUERY", value: subquery };
    }

    if (this.check(TokenType.IDENTIFIER)) {
      const token = this.advance();
      return { type: "VARIABLE", value: token.value };
    }

    throw this.error("Expected source (URL, subquery, or variable)");
  }

  /**
   * Parse ORDER BY clause
   */
  private parseOrderBy(): OrderBy[] {
    this.consume(TokenType.BY);

    const orderBy: OrderBy[] = [];

    do {
      const field = this.consume(TokenType.IDENTIFIER).value;
      let direction: "ASC" | "DESC" = "ASC";

      if (this.check(TokenType.IDENTIFIER)) {
        const token = this.peek();
        if (token.value.toUpperCase() === "ASC") {
          this.advance();
          direction = "ASC";
        } else if (token.value.toUpperCase() === "DESC") {
          this.advance();
          direction = "DESC";
        }
      }

      orderBy.push({ field, direction });
    } while (this.match(TokenType.COMMA));

    return orderBy;
  }

  /**
   * Parse LIMIT clause
   */
  private parseLimit(): LimitClause {
    const limit = parseInt(this.consume(TokenType.NUMBER).value);
    const offset = this.match(TokenType.OFFSET)
      ? parseInt(this.consume(TokenType.NUMBER).value)
      : undefined;

    return { limit, offset };
  }

  /**
   * Parse NAVIGATE statement
   */
  private parseNavigate(): NavigateStatement {
    this.consume(TokenType.NAVIGATE);
    this.consume(TokenType.TO);

    const url = this.parseExpression();
    const options = this.match(TokenType.WITH) ? this.parseNavigateOptions() : undefined;
    const capture = this.match(TokenType.CAPTURE) ? this.parseCaptureClause() : undefined;

    return {
      type: "NAVIGATE",
      url,
      options,
      capture,
    };
  }

  /**
   * Parse navigate options with validation
   */
  private parseNavigateOptions(): any {
    const obj = this.parseObjectLiteral() as any;

    // Validate structure
    const validTopLevelKeys = new Set([
      "proxy",
      "browser",
      "waitFor",
      "waitUntil",
      "timeout",
      "screenshot",
    ]);

    for (const key of Object.keys(obj)) {
      if (!validTopLevelKeys.has(key)) {
        throw new Error(
          `Invalid navigate option: '${key}'. Valid options are: ${Array.from(validTopLevelKeys).join(", ")}`,
        );
      }
    }

    // Validate proxy option
    if (obj.proxy !== undefined) {
      if (typeof obj.proxy !== "object" || obj.proxy === null) {
        throw new Error("Navigate proxy option must be an object");
      }

      const validProxyKeys = new Set([
        "enabled",
        "cache",
        "rateLimit",
        "intercept",
      ]);

      for (const key of Object.keys(obj.proxy)) {
        if (!validProxyKeys.has(key)) {
          throw new Error(
            `Invalid proxy option: '${key}'. Valid options are: ${Array.from(validProxyKeys).join(", ")}`,
          );
        }
      }

      // Validate nested cache object
      if (obj.proxy.cache !== undefined && typeof obj.proxy.cache !== "object") {
        throw new Error("Proxy cache option must be an object");
      }
    }

    // Validate browser option
    if (obj.browser !== undefined) {
      if (typeof obj.browser !== "object" || obj.browser === null) {
        throw new Error("Navigate browser option must be an object");
      }

      const validBrowserKeys = new Set([
        "viewport",
        "userAgent",
        "timeout",
        "headers",
      ]);

      for (const key of Object.keys(obj.browser)) {
        if (!validBrowserKeys.has(key)) {
          throw new Error(
            `Invalid browser option: '${key}'. Valid options are: ${Array.from(validBrowserKeys).join(", ")}`,
          );
        }
      }
    }

    // Validate waitFor/waitUntil option
    if (obj.waitFor !== undefined && obj.waitUntil !== undefined) {
      throw new Error("Cannot specify both 'waitFor' and 'waitUntil'");
    }

    const validWaitValues = new Set([
      "load",
      "domcontentloaded",
      "networkidle",
    ]);

    if (obj.waitFor !== undefined) {
      const waitForStr = String(obj.waitFor);
      if (!validWaitValues.has(waitForStr) && !waitForStr.match(/^[.#\[].*$/)) {
        throw new Error(
          `Invalid waitFor value: '${waitForStr}'. Must be 'load', 'domcontentloaded', 'networkidle', or a CSS selector`,
        );
      }
    }

    if (obj.waitUntil !== undefined) {
      const waitUntilStr = String(obj.waitUntil);
      if (!validWaitValues.has(waitUntilStr) && !waitUntilStr.match(/^[.#\[].*$/)) {
        throw new Error(
          `Invalid waitUntil value: '${waitUntilStr}'. Must be 'load', 'domcontentloaded', 'networkidle', or a CSS selector`,
        );
      }
    }

    // Validate timeout option
    if (obj.timeout !== undefined) {
      const timeout = Number(obj.timeout);
      if (isNaN(timeout) || timeout < 0) {
        throw new Error("Timeout must be a non-negative number");
      }
    }

    // Validate screenshot option
    if (obj.screenshot !== undefined && typeof obj.screenshot !== "boolean") {
      throw new Error("Screenshot option must be a boolean");
    }

    return obj;
  }

  /**
   * Parse CAPTURE clause
   */
  private parseCaptureClause(): { fields: Field[] } {
    const fields = this.parseFieldList();
    return { fields };
  }

  /**
   * Parse SET statement
   */
  private parseSet(): SetStatement {
    this.consume(TokenType.SET);

    const path: string[] = [];
    path.push(this.consume(TokenType.IDENTIFIER).value);

    while (this.match(TokenType.DOT)) {
      path.push(this.consume(TokenType.IDENTIFIER).value);
    }

    this.consume(TokenType.EQUALS);
    const value = this.parseExpression();

    return {
      type: "SET",
      path,
      value,
    };
  }

  /**
   * Parse SHOW statement
   */
  private parseShow(): ShowStatement {
    this.consume(TokenType.SHOW);

    const token = this.advance();
    const target = token.value.toUpperCase() as any;

    const where = this.match(TokenType.WHERE) ? this.parseExpression() : undefined;

    return {
      type: "SHOW",
      target,
      where,
    };
  }

  /**
   * Parse FOR statement
   */
  private parseFor(): ForStatement {
    this.consume(TokenType.FOR);
    this.consume(TokenType.EACH);

    const variable = this.consume(TokenType.IDENTIFIER).value;

    this.consume(TokenType.IN);

    const collection = this.parseExpression();
    const body = this.parseStatement();

    return {
      type: "FOR",
      variable,
      collection,
      body,
    };
  }

  /**
   * Parse IF statement
   */
  private parseIf(): IfStatement {
    this.consume(TokenType.IF);

    const condition = this.parseExpression();

    this.consume(TokenType.THEN);
    const thenBranch = this.parseStatement();

    const elseBranch = this.match(TokenType.ELSE) ? this.parseStatement() : undefined;

    return {
      type: "IF",
      condition,
      thenBranch,
      elseBranch,
    };
  }

  /**
   * Parse INSERT statement
   */
  private parseInsert(): InsertStatement {
    this.consume(TokenType.INSERT);

    const value = this.parseExpression();

    this.consume(TokenType.INTO);

    const target = this.parseExpression();

    return {
      type: "INSERT",
      value,
      target,
    };
  }

  /**
   * Parse UPDATE statement
   */
  private parseUpdate(): UpdateStatement {
    this.consume(TokenType.UPDATE);

    const target = this.parseExpression();

    this.consume(TokenType.SET);

    const assignments: Assignment[] = [];

    do {
      const property = this.consume(TokenType.IDENTIFIER).value;
      this.consume(TokenType.EQUALS);
      const value = this.parseExpression();

      assignments.push({ property, value });
    } while (this.match(TokenType.COMMA));

    return {
      type: "UPDATE",
      target,
      assignments,
    };
  }

  /**
   * Parse DELETE statement
   */
  private parseDelete(): DeleteStatement {
    this.consume(TokenType.DELETE);

    const target = this.parseExpression();

    return {
      type: "DELETE",
      target,
    };
  }

  /**
   * Parse WITH statement (CTE)
   */
  private parseWith(): WithStatement {
    this.consume(TokenType.WITH);

    const ctes: CTE[] = [];

    do {
      const name = this.consume(TokenType.IDENTIFIER).value;
      this.consume(TokenType.AS);
      this.consume(TokenType.LEFT_PAREN);
      const query = this.parseStatement();
      this.consume(TokenType.RIGHT_PAREN);

      ctes.push({ name, query });
    } while (this.match(TokenType.COMMA));

    const query = this.parseStatement();

    return {
      type: "WITH",
      ctes,
      query,
    };
  }

  /**
   * Parse expression with operator precedence
   */
  private parseExpression(): Expression {
    return this.parseLogicalOr();
  }

  /**
   * Parse logical OR
   */
  private parseLogicalOr(): Expression {
    let left = this.parseLogicalAnd();

    while (this.match(TokenType.OR)) {
      const operator = "OR";
      const right = this.parseLogicalAnd();
      left = {
        type: "BINARY",
        operator,
        left,
        right,
      };
    }

    return left;
  }

  /**
   * Parse logical AND
   */
  private parseLogicalAnd(): Expression {
    let left = this.parseEquality();

    while (this.match(TokenType.AND)) {
      const operator = "AND";
      const right = this.parseEquality();
      left = {
        type: "BINARY",
        operator,
        left,
        right,
      };
    }

    return left;
  }

  /**
   * Parse equality (=, !=, IN, LIKE, etc.)
   */
  private parseEquality(): Expression {
    let left = this.parseComparison();

    while (
      this.match(TokenType.EQUALS) ||
      this.match(TokenType.NOT_EQUALS) ||
      this.match(TokenType.IN) ||
      this.match(TokenType.LIKE) ||
      this.match(TokenType.MATCHES) ||
      this.match(TokenType.CONTAINS)
    ) {
      const operator = this.previous().value.toUpperCase() as BinaryOperator;
      const right = this.parseComparison();
      left = {
        type: "BINARY",
        operator,
        left,
        right,
      };
    }

    return left;
  }

  /**
   * Parse comparison (>, >=, <, <=)
   */
  private parseComparison(): Expression {
    let left = this.parseConcatenation();

    while (
      this.match(TokenType.GREATER) ||
      this.match(TokenType.GREATER_EQ) ||
      this.match(TokenType.LESS) ||
      this.match(TokenType.LESS_EQ)
    ) {
      const token = this.previous();
      const operator = token.value as BinaryOperator;
      const right = this.parseConcatenation();
      left = {
        type: "BINARY",
        operator,
        left,
        right,
      };
    }

    return left;
  }

  /**
   * Parse string concatenation (||)
   */
  private parseConcatenation(): Expression {
    let left = this.parseAddition();

    while (this.match(TokenType.CONCAT)) {
      const operator = "||";
      const right = this.parseAddition();
      left = {
        type: "BINARY",
        operator,
        left,
        right,
      };
    }

    return left;
  }

  /**
   * Parse addition and subtraction
   */
  private parseAddition(): Expression {
    let left = this.parseMultiplication();

    while (this.match(TokenType.PLUS) || this.match(TokenType.MINUS)) {
      const operator = this.previous().value as BinaryOperator;
      const right = this.parseMultiplication();
      left = {
        type: "BINARY",
        operator,
        left,
        right,
      };
    }

    return left;
  }

  /**
   * Parse multiplication, division, modulo
   */
  private parseMultiplication(): Expression {
    let left = this.parseUnary();

    while (
      this.match(TokenType.STAR) || this.match(TokenType.SLASH) || this.match(TokenType.PERCENT)
    ) {
      const operator = this.previous().value as BinaryOperator;
      const right = this.parseUnary();
      left = {
        type: "BINARY",
        operator,
        left,
        right,
      };
    }

    return left;
  }

  /**
   * Parse unary expressions (NOT, -)
   */
  private parseUnary(): Expression {
    if (this.match(TokenType.NOT) || this.match(TokenType.MINUS)) {
      const operator = this.previous().value.toUpperCase() as any;
      const operand = this.parseUnary();
      return {
        type: "UNARY",
        operator,
        operand,
      };
    }

    return this.parseCall();
  }

  /**
   * Parse function calls
   */
  private parseCall(): Expression {
    let expr = this.parseMember();

    while (true) {
      if (this.match(TokenType.LEFT_PAREN)) {
        // Function call
        if (expr.type === "IDENTIFIER") {
          const callee = (expr as Identifier).name;
          const args = this.parseArgumentList();
          this.consume(TokenType.RIGHT_PAREN);
          expr = {
            type: "CALL",
            callee,
            arguments: args,
          };
        } else {
          throw this.error("Invalid function call");
        }
      } else {
        break;
      }
    }

    return expr;
  }

  /**
   * Parse argument list
   */
  private parseArgumentList(): Expression[] {
    const args: Expression[] = [];

    if (!this.check(TokenType.RIGHT_PAREN)) {
      do {
        args.push(this.parseExpression());
      } while (this.match(TokenType.COMMA));
    }

    return args;
  }

  /**
   * Parse member access
   */
  private parseMember(): Expression {
    let expr = this.parsePrimary();

    while (true) {
      if (this.match(TokenType.DOT)) {
        const property = this.consume(TokenType.IDENTIFIER).value;
        expr = {
          type: "MEMBER",
          object: expr,
          property,
          computed: false,
        };
      } else if (this.match(TokenType.LEFT_BRACKET)) {
        const property = this.parseExpression();
        this.consume(TokenType.RIGHT_BRACKET);

        // Convert property to string if it's a literal
        const propName = property.type === "LITERAL" ? String((property as Literal).value) : "";

        expr = {
          type: "MEMBER",
          object: expr,
          property: propName,
          computed: true,
        };
      } else {
        break;
      }
    }

    return expr;
  }

  /**
   * Parse primary expressions (literals, identifiers, etc.)
   */
  private parsePrimary(): Expression {
    // Literals
    if (this.match(TokenType.STRING)) {
      return {
        type: "LITERAL",
        dataType: DataType.STRING,
        value: this.previous().value,
      };
    }

    if (this.match(TokenType.NUMBER)) {
      return {
        type: "LITERAL",
        dataType: DataType.NUMBER,
        value: parseFloat(this.previous().value),
      };
    }

    if (this.match(TokenType.BOOLEAN)) {
      return {
        type: "LITERAL",
        dataType: DataType.BOOLEAN,
        value: this.previous().value.toUpperCase() === "TRUE",
      };
    }

    if (this.match(TokenType.NULL)) {
      return {
        type: "LITERAL",
        dataType: DataType.NULL,
        value: null,
      };
    }

    // Array literal
    if (this.match(TokenType.LEFT_BRACKET)) {
      const elements: Expression[] = [];

      if (!this.check(TokenType.RIGHT_BRACKET)) {
        do {
          elements.push(this.parseExpression());
        } while (this.match(TokenType.COMMA));
      }

      this.consume(TokenType.RIGHT_BRACKET);

      return {
        type: "ARRAY",
        elements,
      };
    }

    // Object literal
    if (this.match(TokenType.LEFT_BRACE)) {
      return this.parseObjectLiteral();
    }

    // Parenthesized expression
    if (this.match(TokenType.LEFT_PAREN)) {
      const expr = this.parseExpression();
      this.consume(TokenType.RIGHT_PAREN);
      return expr;
    }

    // Identifier
    if (this.match(TokenType.IDENTIFIER)) {
      return {
        type: "IDENTIFIER",
        name: this.previous().value,
      };
    }

    throw this.error("Expected expression");
  }

  /**
   * Parse object literal
   */
  private parseObjectLiteral(): ObjectExpression {
    const properties: { key: string; value: Expression }[] = [];

    if (!this.check(TokenType.RIGHT_BRACE)) {
      do {
        const key = this.consume(TokenType.IDENTIFIER).value;
        this.consume(TokenType.COLON);
        const value = this.parseExpression();

        properties.push({ key, value });
      } while (this.match(TokenType.COMMA));
    }

    this.consume(TokenType.RIGHT_BRACE);

    return {
      type: "OBJECT",
      properties,
    };
  }

  /**
   * Helper methods
   */
  private match(...types: TokenType[]): boolean {
    for (const type of types) {
      if (this.check(type)) {
        this.advance();
        return true;
      }
    }
    return false;
  }

  private check(type: TokenType): boolean {
    if (this.isAtEnd()) return false;
    return this.peek().type === type;
  }

  private advance(): Token {
    if (!this.isAtEnd()) this.current++;
    return this.previous();
  }

  private isAtEnd(): boolean {
    return this.peek().type === TokenType.EOF;
  }

  private peek(): Token {
    return this.tokens[this.current];
  }

  private previous(): Token {
    return this.tokens[this.current - 1];
  }

  private consume(type: TokenType): Token {
    if (this.check(type)) return this.advance();

    throw this.error(`Expected ${TokenType[type]}, got ${TokenType[this.peek().type]}`);
  }

  private error(message: string): Error {
    const token = this.peek();
    return new Error(`Parse error at line ${token.line}, column ${token.column}: ${message}`);
  }

  /**
   * Get all tokens (returns copy)
   */
  getTokens(): Token[] {
    return [...this.tokens];
  }

  /**
   * Get current token
   */
  getCurrentToken(): Token {
    return this.peek();
  }

  /**
   * Get current position in token stream
   */
  getPosition(): number {
    return this.current;
  }

  /**
   * Get peek token (next token to be consumed)
   */
  getPeekToken(): Token {
    return this.peek();
  }
}
