/**
 * Semantic validator for query validation
 * Validates semantic rules beyond type checking
 */

import {
  Expression,
  Field,
  ForStatement,
  IfStatement,
  NavigateStatement,
  SelectStatement,
  Source,
  Statement,
} from "../types/ast.ts";
import { SymbolTable } from "./symbols.ts";

/**
 * Validation error
 */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

/**
 * Semantic validator
 */
export class Validator {
  private symbolTable: SymbolTable;

  constructor(symbolTable: SymbolTable) {
    this.symbolTable = symbolTable;
  }

  /**
   * Validate a statement
   */
  validate(stmt: Statement): void {
    switch (stmt.type) {
      case "SELECT":
        this.validateSelect(stmt as SelectStatement);
        break;
      case "NAVIGATE":
        this.validateNavigate(stmt as NavigateStatement);
        break;
      case "FOR":
        this.validateFor(stmt as ForStatement);
        break;
      case "IF":
        this.validateIf(stmt as IfStatement);
        break;
        // Add other statement types as needed
    }
  }

  /**
   * Validate SELECT statement
   */
  private validateSelect(stmt: SelectStatement): void {
    // Validate fields
    if (stmt.fields.length === 0) {
      throw new ValidationError("SELECT must have at least one field");
    }

    // Check for duplicate field names
    const fieldNames = new Set<string>();
    for (const field of stmt.fields) {
      const name = field.alias || field.name;
      if (fieldNames.has(name)) {
        throw new ValidationError(`Duplicate field name: ${name}`);
      }
      fieldNames.add(name);
    }

    // Validate source
    this.validateSource(stmt.source);

    // Validate WHERE clause
    if (stmt.where) {
      this.validateExpression(stmt.where);
    }

    // Validate ORDER BY
    if (stmt.orderBy) {
      for (const order of stmt.orderBy) {
        // Check that order.field exists in selected fields
        const fieldExists = stmt.fields.some(
          (f) => f.name === order.field || f.alias === order.field,
        );
        if (!fieldExists && stmt.fields[0]?.name !== "*") {
          throw new ValidationError(
            `ORDER BY field '${order.field}' not in SELECT list`,
          );
        }
      }
    }

    // Validate LIMIT
    if (stmt.limit) {
      if (stmt.limit.limit <= 0) {
        throw new ValidationError("LIMIT must be positive");
      }
      if (stmt.limit.offset !== undefined && stmt.limit.offset < 0) {
        throw new ValidationError("OFFSET must be non-negative");
      }
    }
  }

  /**
   * Validate source
   */
  private validateSource(source: Source): void {
    if (source.type === "URL") {
      const url = source.value as string;
      this.validateURL(url);
    } else if (source.type === "SUBQUERY") {
      this.validate(source.value as Statement);
    } else if (source.type === "VARIABLE") {
      const varName = source.value as string;
      const symbol = this.symbolTable.resolve(varName);
      if (!symbol) {
        throw new ValidationError(`Undefined variable: ${varName}`);
      }
    }
  }

  /**
   * Validate URL
   */
  private validateURL(url: string): void {
    try {
      const parsed = new URL(url);

      // Check protocol
      const allowedProtocols = ["http:", "https:"];
      if (!allowedProtocols.includes(parsed.protocol)) {
        throw new ValidationError(
          `Protocol ${parsed.protocol} not allowed. Use http: or https:`,
        );
      }

      // Check for localhost/private IPs
      // Security policy determines if this is allowed
      if (this.isPrivateIP(parsed.hostname)) {
        // Will be checked by SecurityValidator
      }
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new ValidationError(`Invalid URL: ${url}`);
    }
  }

  /**
   * Check if hostname is a private IP
   */
  private isPrivateIP(hostname: string): boolean {
    // Check for localhost
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return true;
    }

    // Check for private IPv4 ranges
    const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    const match = hostname.match(ipv4Regex);

    if (match) {
      const [, a, b, c, d] = match.map(Number);

      // 10.0.0.0/8
      if (a === 10) return true;

      // 172.16.0.0/12
      if (a === 172 && b >= 16 && b <= 31) return true;

      // 192.168.0.0/16
      if (a === 192 && b === 168) return true;

      // 169.254.0.0/16 (link-local)
      if (a === 169 && b === 254) return true;
    }

    return false;
  }

  /**
   * Validate NAVIGATE statement
   */
  private validateNavigate(stmt: NavigateStatement): void {
    // Validate URL expression
    this.validateExpression(stmt.url);

    // Validate options
    if (stmt.options) {
      // Validate proxy options
      if (stmt.options.proxy) {
        const proxy = stmt.options.proxy;

        // Validate timeout
        if (proxy.timeout !== undefined && proxy.timeout <= 0) {
          throw new ValidationError("Proxy timeout must be positive");
        }

        // Validate rate limit
        if (proxy.rateLimit !== undefined && proxy.rateLimit <= 0) {
          throw new ValidationError("Rate limit must be positive");
        }
      }

      // Validate browser options
      if (stmt.options.browser) {
        const browser = stmt.options.browser;

        // Validate viewport
        if (browser.viewport) {
          if (browser.viewport.width <= 0 || browser.viewport.height <= 0) {
            throw new ValidationError("Viewport dimensions must be positive");
          }
        }
      }

      // Validate timeout
      if (stmt.options.timeout !== undefined && stmt.options.timeout <= 0) {
        throw new ValidationError("Timeout must be positive");
      }
    }

    // Validate capture clause
    if (stmt.capture) {
      for (const field of stmt.capture.fields) {
        if (field.expression) {
          this.validateExpression(field.expression);
        }
      }
    }
  }

  /**
   * Validate FOR statement
   */
  private validateFor(stmt: ForStatement): void {
    // Validate collection expression
    this.validateExpression(stmt.collection);

    // Validate body
    this.validate(stmt.body);
  }

  /**
   * Validate IF statement
   */
  private validateIf(stmt: IfStatement): void {
    // Validate condition
    this.validateExpression(stmt.condition);

    // Validate branches
    this.validate(stmt.thenBranch);
    if (stmt.elseBranch) {
      this.validate(stmt.elseBranch);
    }
  }

  /**
   * Validate expression
   */
  private validateExpression(expr: Expression): void {
    switch (expr.type) {
      case "BINARY":
        this.validateExpression(expr.left);
        this.validateExpression(expr.right);
        break;
      case "UNARY":
        this.validateExpression(expr.operand);
        break;
      case "CALL":
        for (const arg of expr.arguments) {
          this.validateExpression(arg);
        }
        break;
      case "MEMBER":
        this.validateExpression(expr.object);
        break;
      case "ARRAY":
        for (const element of expr.elements) {
          this.validateExpression(element);
        }
        break;
      case "OBJECT":
        for (const prop of expr.properties) {
          this.validateExpression(prop.value);
        }
        break;
      case "IDENTIFIER":
        // Check if identifier is defined
        const symbol = this.symbolTable.resolve(expr.name);
        if (!symbol) {
          // Could be a DOM field or built-in, don't error here
        }
        break;
      case "LITERAL":
        // Literals are always valid
        break;
    }
  }
}
