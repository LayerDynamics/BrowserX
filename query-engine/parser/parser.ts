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
  BlockStatement,
  CallExpression,
  ClickStatement,
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
  NavigateOptions,
  NavigateStatement,
  ObjectExpression,
  OrderBy,
  PdfStatement,
  ScreenshotStatement,
  SelectStatement,
  SetStatement,
  ShowStatement,
  Source,
  Statement,
  UnaryExpression,
  UpdateStatement,
  WaitStatement,
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
      case TokenType.LEFT_BRACE:
        return this.parseBraceBlockStatement();
      case TokenType.CLICK:
        return this.parseClick();
      case TokenType.WAIT:
        return this.parseWait();
      case TokenType.SCREENSHOT:
        return this.parseScreenshot();
      case TokenType.PDF:
        return this.parsePdf();
      default:
        throw this.error(`Unexpected statement: ${token.value}`);
    }
  }

  /**
   * Parse a brace-delimited block statement { ... }
   */
  private parseBraceBlockStatement(): Statement {
    this.consume(TokenType.LEFT_BRACE);
    const statements: Statement[] = [];

    while (!this.check(TokenType.RIGHT_BRACE) && !this.isAtEnd()) {
      statements.push(this.parseStatement());
    }

    this.consume(TokenType.RIGHT_BRACE);

    if (statements.length === 1) {
      return statements[0];
    }

    return {
      type: "BLOCK",
      statements,
    };
  }

  /**
   * Parse a DO...END block, returning a BlockStatement or single Statement
   */
  private parseDoEndBlock(): Statement {
    this.consume(TokenType.DO);
    const statements: Statement[] = [];

    while (!this.check(TokenType.END) && !this.isAtEnd()) {
      statements.push(this.parseStatement());
    }

    this.consume(TokenType.END);

    if (statements.length === 1) {
      return statements[0];
    }

    return {
      type: "BLOCK",
      statements,
    };
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
   * Parse source (URL, CSS selector, or subquery)
   */
  private parseSource(): Source {
    if (this.check(TokenType.STRING)) {
      const token = this.advance();
      const value = token.value;
      // Detect CSS selectors: starts with ., #, [, or contains > + ~ or element.class patterns without protocol
      const isCssSelector = this.isCssSelector(value);
      return { type: isCssSelector ? "SELECTOR" : "URL", value };
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
   * Detect if a string is a CSS selector rather than a URL
   */
  private isCssSelector(value: string): boolean {
    // If it looks like a URL (has protocol), it's not a CSS selector
    if (/^https?:\/\//i.test(value)) {
      return false;
    }
    // CSS selectors typically:
    // - Start with . (class), # (id), [ (attribute), or * (universal)
    // - Contain > + ~ (combinators)
    // - Contain : (pseudo-class/element)
    // - Start with element name followed by . or # or [ (e.g., div.class, a[href])
    const cssSelectorPatterns = [
      /^\./,               // Class selector: .class
      /^#/,                // ID selector: #id
      /^\[/,               // Attribute selector: [attr]
      /^\*/,               // Universal selector: *
      /^[a-z]+\./i,        // Element with class: div.class
      /^[a-z]+#/i,         // Element with ID: div#id
      /^[a-z]+\[/i,        // Element with attribute: a[href]
      /[>\+~]/,            // Combinators: >, +, ~
      /:[a-z-]+/i,         // Pseudo-class/element: :hover, ::before
    ];
    return cssSelectorPatterns.some(pattern => pattern.test(value));
  }

  /**
   * Parse ORDER BY clause
   */
  private parseOrderBy(): OrderBy[] {
    this.consume(TokenType.BY);

    const orderBy: OrderBy[] = [];

    do {
      // Parse field name with optional dotted path (e.g., user.age)
      let field = this.consume(TokenType.IDENTIFIER).value;
      while (this.match(TokenType.DOT)) {
        field += "." + this.consume(TokenType.IDENTIFIER).value;
      }

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
    const count = parseInt(this.consume(TokenType.NUMBER).value);
    const offset = this.match(TokenType.OFFSET)
      ? parseInt(this.consume(TokenType.NUMBER).value)
      : undefined;

    return { count, offset };
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
  private parseNavigateOptions(): NavigateOptions {
    // Consume the opening brace before parsing object literal
    this.consume(TokenType.LEFT_BRACE);
    const obj = this.parseObjectLiteral();

    // Validate structure - check properties array for valid top-level keys
    const validTopLevelKeys = new Set([
      "proxy",
      "browser",
      "waitFor",
      "waitUntil",
      "timeout",
      "screenshot",
    ]);

    // Check for duplicate keys
    const seenKeys = new Set<string>();
    for (const prop of obj.properties) {
      if (!validTopLevelKeys.has(prop.key)) {
        throw this.error(
          `Invalid navigate option: '${prop.key}'. Valid options are: ${Array.from(validTopLevelKeys).join(", ")}`,
        );
      }
      if (seenKeys.has(prop.key)) {
        throw this.error(`Duplicate navigate option: '${prop.key}'`);
      }
      seenKeys.add(prop.key);
    }

    // Check for mutually exclusive options
    if (seenKeys.has("waitFor") && seenKeys.has("waitUntil")) {
      throw this.error("Cannot specify both 'waitFor' and 'waitUntil'");
    }

    // Transform ObjectExpression into NavigateOptions
    return this.transformToNavigateOptions(obj);
  }

  /**
   * Transform an ObjectExpression AST node into a NavigateOptions object
   */
  private transformToNavigateOptions(obj: ObjectExpression): NavigateOptions {
    const options: NavigateOptions = {};

    for (const prop of obj.properties) {
      const value = this.extractLiteralValue(prop.value);

      switch (prop.key) {
        case "timeout":
          options.timeout = value as number;
          break;
        case "waitUntil":
          options.waitUntil = value as "load" | "domcontentloaded" | "networkidle";
          break;
        case "proxy":
          options.proxy = this.extractProxyConfig(prop.value);
          break;
        case "browser":
          options.browser = this.extractBrowserConfig(prop.value);
          break;
      }
    }

    return options;
  }

  /**
   * Extract a literal value from an Expression
   */
  private extractLiteralValue(expr: Expression): unknown {
    if (expr.type === "LITERAL") {
      return (expr as Literal).value;
    }
    if (expr.type === "OBJECT") {
      const result: Record<string, unknown> = {};
      for (const prop of (expr as ObjectExpression).properties) {
        result[prop.key] = this.extractLiteralValue(prop.value);
      }
      return result;
    }
    if (expr.type === "ARRAY") {
      return (expr as ArrayExpression).elements.map((el) =>
        this.extractLiteralValue(el)
      );
    }
    return undefined;
  }

  /**
   * Extract ProxyConfig from an Expression with validation
   */
  private extractProxyConfig(expr: Expression): NavigateOptions["proxy"] {
    if (expr.type !== "OBJECT") return undefined;
    const obj = expr as ObjectExpression;
    const config: NavigateOptions["proxy"] = {};

    const validProxyKeys = new Set([
      "enabled",
      "cache",
      "ttl",
      "headers",
      "rotate",
      "pool",
      "strategy",
      "timeout",
      "rateLimit",
    ]);

    for (const prop of obj.properties) {
      // Validate proxy option key
      if (!validProxyKeys.has(prop.key)) {
        throw this.error(
          `Invalid proxy option: '${prop.key}'. Valid options are: ${Array.from(validProxyKeys).join(", ")}`,
        );
      }

      const value = this.extractLiteralValue(prop.value);
      switch (prop.key) {
        case "enabled":
          config.enabled = value as boolean;
          break;
        case "cache":
          config.cache = value as boolean | "only";
          break;
        case "ttl":
          config.ttl = value as number;
          break;
        case "headers":
          config.headers = value as Record<string, string>;
          break;
        case "rotate":
          config.rotate = value as boolean;
          break;
        case "pool":
          config.pool = value as string;
          break;
        case "strategy":
          config.strategy = value as "round-robin" | "random" | "least-connections";
          break;
        case "timeout":
          config.timeout = value as number;
          break;
        case "rateLimit":
          config.rateLimit = value as number;
          break;
      }
    }

    return config;
  }

  /**
   * Extract BrowserConfig from an Expression with validation
   */
  private extractBrowserConfig(expr: Expression): NavigateOptions["browser"] {
    if (expr.type !== "OBJECT") return undefined;
    const obj = expr as ObjectExpression;
    const config: NavigateOptions["browser"] = {};

    const validBrowserKeys = new Set([
      "viewport",
      "userAgent",
      "headless",
    ]);

    for (const prop of obj.properties) {
      // Validate browser option key
      if (!validBrowserKeys.has(prop.key)) {
        throw this.error(
          `Invalid browser option: '${prop.key}'. Valid options are: ${Array.from(validBrowserKeys).join(", ")}`,
        );
      }

      const value = this.extractLiteralValue(prop.value);
      switch (prop.key) {
        case "viewport":
          config.viewport = value as { width: number; height: number };
          break;
        case "userAgent":
          config.userAgent = value as string;
          break;
        case "headless":
          config.headless = value as boolean;
          break;
      }
    }

    return config;
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
   * Supports:
   *   FOR variable IN collection DO ... END
   *   FOR EACH variable IN collection statement
   */
  private parseFor(): ForStatement {
    this.consume(TokenType.FOR);

    // EACH keyword is optional
    this.match(TokenType.EACH);

    const variable = this.consume(TokenType.IDENTIFIER).value;

    this.consume(TokenType.IN);

    const collection = this.parseExpression();

    // Check for DO...END block syntax or single statement
    let body: Statement;
    if (this.check(TokenType.DO)) {
      body = this.parseDoEndBlock();
    } else {
      body = this.parseStatement();
    }

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
    const thenStatement = this.parseStatement();

    const elseStatement = this.match(TokenType.ELSE) ? this.parseStatement() : undefined;

    return {
      type: "IF",
      condition,
      then: thenStatement,
      else: elseStatement,
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
   * Syntax: DELETE FROM <target> or DELETE <target>
   */
  private parseDelete(): DeleteStatement {
    this.consume(TokenType.DELETE);

    // Optionally consume FROM keyword
    this.match(TokenType.FROM);

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
   * Parse CLICK statement
   */
  private parseClick(): ClickStatement {
    this.consume(TokenType.CLICK);

    const selector = this.parseExpression();

    return {
      type: "CLICK",
      selector,
    };
  }

  /**
   * Parse WAIT statement
   */
  private parseWait(): WaitStatement {
    this.consume(TokenType.WAIT);

    // Check for WAIT FOR selector syntax
    if (this.match(TokenType.FOR)) {
      const value = this.parseExpression();
      return {
        type: "WAIT",
        waitType: "selector",
        value,
      };
    }

    // WAIT duration (number in ms)
    const value = this.parseExpression();

    return {
      type: "WAIT",
      waitType: "time",
      value,
    };
  }

  /**
   * Parse SCREENSHOT statement
   */
  private parseScreenshot(): ScreenshotStatement {
    this.consume(TokenType.SCREENSHOT);

    // Check for optional options
    const options = this.match(TokenType.WITH) ? this.parseScreenshotOptions() : undefined;

    return {
      type: "SCREENSHOT",
      options,
    };
  }

  /**
   * Parse screenshot options
   */
  private parseScreenshotOptions(): {
    selector?: Expression;
    fullPage?: boolean;
    format?: "png" | "jpeg";
    quality?: number;
    path?: string;
  } {
    this.consume(TokenType.LEFT_BRACE);
    const options: {
      selector?: Expression;
      fullPage?: boolean;
      format?: "png" | "jpeg";
      quality?: number;
      path?: string;
    } = {};

    if (!this.check(TokenType.RIGHT_BRACE)) {
      do {
        const key = this.consumeKeywordOrIdentifier().value.toLowerCase();
        this.consume(TokenType.COLON);
        const value = this.parseExpression();

        switch (key) {
          case "selector":
            options.selector = value;
            break;
          case "fullpage":
            options.fullPage =
              value.type === "LITERAL" && (value as Literal).value === true;
            break;
          case "format":
            if (value.type === "LITERAL") {
              options.format = (value as Literal).value as "png" | "jpeg";
            }
            break;
          case "quality":
            if (value.type === "LITERAL") {
              options.quality = (value as Literal).value as number;
            }
            break;
          case "path":
            if (value.type === "LITERAL") {
              options.path = (value as Literal).value as string;
            }
            break;
        }
      } while (this.match(TokenType.COMMA));
    }

    this.consume(TokenType.RIGHT_BRACE);

    return options;
  }

  /**
   * Parse PDF statement
   */
  private parsePdf(): PdfStatement {
    this.consume(TokenType.PDF);

    // Check for optional options
    const options = this.match(TokenType.WITH) ? this.parsePdfOptions() : undefined;

    return {
      type: "PDF",
      options,
    };
  }

  /**
   * Parse PDF options
   */
  private parsePdfOptions(): {
    format?: "A4" | "Letter" | "Legal" | "A3";
    landscape?: boolean;
    path?: string;
  } {
    this.consume(TokenType.LEFT_BRACE);
    const options: {
      format?: "A4" | "Letter" | "Legal" | "A3";
      landscape?: boolean;
      path?: string;
    } = {};

    if (!this.check(TokenType.RIGHT_BRACE)) {
      do {
        const key = this.consumeKeywordOrIdentifier().value.toLowerCase();
        this.consume(TokenType.COLON);
        const value = this.parseExpression();

        switch (key) {
          case "format":
            if (value.type === "LITERAL") {
              options.format = (value as Literal).value as "A4" | "Letter" | "Legal" | "A3";
            }
            break;
          case "landscape":
            options.landscape =
              value.type === "LITERAL" && (value as Literal).value === true;
            break;
          case "path":
            if (value.type === "LITERAL") {
              options.path = (value as Literal).value as string;
            }
            break;
        }
      } while (this.match(TokenType.COMMA));
    }

    this.consume(TokenType.RIGHT_BRACE);

    return options;
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

        // For literals, inline the string key; for dynamic expressions, preserve the AST node
        const propName = property.type === "LITERAL" ? String((property as Literal).value) : "";

        expr = {
          type: "MEMBER",
          object: expr,
          property: propName,
          computed: true,
          ...(property.type !== "LITERAL" ? { computedProperty: property } : {}),
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
   * Accepts keywords, identifiers, and string literals as keys (e.g., { cache: true, "Authorization": "Bearer token" })
   */
  private parseObjectLiteral(): ObjectExpression {
    const properties: { key: string; value: Expression }[] = [];

    if (!this.check(TokenType.RIGHT_BRACE)) {
      do {
        let key: string;
        // Accept string literals as keys (e.g., "Authorization": "value")
        if (this.check(TokenType.STRING)) {
          key = this.advance().value;
        } else {
          key = this.consumeKeywordOrIdentifier().value;
        }
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

    const expected = this.tokenTypeToUserString(type);
    const got = this.tokenToUserString(this.peek());
    throw this.error(`Expected ${expected}, got ${got}`);
  }

  /**
   * Consume a keyword or identifier token (for object keys that can be keywords)
   */
  private consumeKeywordOrIdentifier(): Token {
    const token = this.peek();

    // Accept identifier
    if (token.type === TokenType.IDENTIFIER) {
      return this.advance();
    }

    // Accept any keyword token as an identifier in key position
    const keywordTokenTypes = [
      TokenType.CACHE,
      TokenType.CACHED,
      TokenType.HEADERS,
      TokenType.COOKIES,
      TokenType.SCREENSHOT,
      TokenType.PDF,
      TokenType.SELECT,
      TokenType.FROM,
      TokenType.WHERE,
      TokenType.ORDER,
      TokenType.BY,
      TokenType.LIMIT,
      TokenType.OFFSET,
      TokenType.NAVIGATE,
      TokenType.TO,
      TokenType.WITH,
      TokenType.CAPTURE,
      TokenType.SET,
      TokenType.SHOW,
      TokenType.FOR,
      TokenType.EACH,
      TokenType.IN,
      TokenType.IF,
      TokenType.THEN,
      TokenType.ELSE,
      TokenType.DO,
      TokenType.END,
      TokenType.INSERT,
      TokenType.INTO,
      TokenType.UPDATE,
      TokenType.DELETE,
      TokenType.AS,
      TokenType.AND,
      TokenType.OR,
      TokenType.NOT,
      TokenType.LIKE,
      TokenType.MATCHES,
      TokenType.CONTAINS,
      TokenType.NULL,
      TokenType.PARALLEL,
      TokenType.BATCH,
      TokenType.STREAM,
      TokenType.RETRY,
      TokenType.CLICK,
      TokenType.TYPE,
      TokenType.WAIT,
      TokenType.EVALUATE,
      TokenType.INVALIDATE,
      TokenType.CONNECTIONS,
      TokenType.METRICS,
      TokenType.STATE,
    ];

    if (keywordTokenTypes.includes(token.type)) {
      return this.advance();
    }

    throw this.error(`Expected an identifier, got ${this.tokenToUserString(token)}`);
  }

  /**
   * Convert a token type to a user-friendly string
   */
  private tokenTypeToUserString(type: TokenType): string {
    const friendlyNames: Partial<Record<TokenType, string>> = {
      [TokenType.LEFT_PAREN]: "'('",
      [TokenType.RIGHT_PAREN]: "')'",
      [TokenType.LEFT_BRACE]: "'{'",
      [TokenType.RIGHT_BRACE]: "'}'",
      [TokenType.LEFT_BRACKET]: "'['",
      [TokenType.RIGHT_BRACKET]: "']'",
      [TokenType.COMMA]: "','",
      [TokenType.DOT]: "'.'",
      [TokenType.SEMICOLON]: "';'",
      [TokenType.COLON]: "':'",
      [TokenType.STAR]: "'*'",
      [TokenType.PLUS]: "'+'",
      [TokenType.MINUS]: "'-'",
      [TokenType.SLASH]: "'/'",
      [TokenType.EQUALS]: "'='",
      [TokenType.NOT_EQUALS]: "'!=' or '<>'",
      [TokenType.LESS]: "'<'",
      [TokenType.LESS_EQ]: "'<='",
      [TokenType.GREATER]: "'>'",
      [TokenType.GREATER_EQ]: "'>='",
      [TokenType.STRING]: "a string",
      [TokenType.NUMBER]: "a number",
      [TokenType.IDENTIFIER]: "an identifier",
      [TokenType.EOF]: "end of query",
      [TokenType.SELECT]: "'SELECT'",
      [TokenType.FROM]: "'FROM'",
      [TokenType.WHERE]: "'WHERE'",
      [TokenType.AND]: "'AND'",
      [TokenType.OR]: "'OR'",
      [TokenType.NOT]: "'NOT'",
      [TokenType.AS]: "'AS'",
      [TokenType.BOOLEAN]: "a boolean (TRUE or FALSE)",
      [TokenType.NULL]: "'NULL'",
      [TokenType.NAVIGATE]: "'NAVIGATE'",
      [TokenType.TO]: "'TO'",
      [TokenType.WITH]: "'WITH'",
      [TokenType.SET]: "'SET'",
      [TokenType.SHOW]: "'SHOW'",
      [TokenType.FOR]: "'FOR'",
      [TokenType.IN]: "'IN'",
      [TokenType.IF]: "'IF'",
      [TokenType.THEN]: "'THEN'",
      [TokenType.ELSE]: "'ELSE'",
      [TokenType.INSERT]: "'INSERT'",
      [TokenType.INTO]: "'INTO'",
      [TokenType.UPDATE]: "'UPDATE'",
      [TokenType.DELETE]: "'DELETE'",
      [TokenType.CLICK]: "'CLICK'",
      [TokenType.TYPE]: "'TYPE'",
      [TokenType.WAIT]: "'WAIT'",
      [TokenType.CAPTURE]: "'CAPTURE'",
    };
    return friendlyNames[type] ?? TokenType[type];
  }

  /**
   * Convert a token to a user-friendly string (includes value for identifiers/literals)
   */
  private tokenToUserString(token: Token): string {
    switch (token.type) {
      case TokenType.IDENTIFIER:
        return `identifier '${token.value}'`;
      case TokenType.STRING:
        return `string "${token.value}"`;
      case TokenType.NUMBER:
        return `number ${token.value}`;
      case TokenType.EOF:
        return "end of query";
      default:
        return this.tokenTypeToUserString(token.type);
    }
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
