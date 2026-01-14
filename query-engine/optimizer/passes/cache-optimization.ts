/**
 * Cache optimization pass
 * Identifies cacheable sub-queries and marks them for caching
 */

import {
  Expression,
  NavigateStatement,
  SelectStatement,
  Source,
  Statement,
} from "../../types/ast.ts";

/**
 * Cacheability metadata
 */
export interface CacheMetadata {
  cacheable: boolean;
  cacheKey?: string;
  ttl?: number; // Time to live in milliseconds
  reason?: string; // Why it's not cacheable
}

/**
 * Cache optimization pass
 * Analyzes queries to determine which parts can be cached
 */
export class CacheOptimizationPass {
  private cacheMetadata: Map<Statement, CacheMetadata>;

  constructor() {
    this.cacheMetadata = new Map();
  }

  /**
   * Apply cache optimization to a statement
   */
  apply(stmt: Statement): Statement {
    this.analyzeCacheability(stmt);
    return stmt;
  }

  /**
   * Analyze cacheability of a statement
   */
  private analyzeCacheability(stmt: Statement): CacheMetadata {
    switch (stmt.type) {
      case "SELECT":
        return this.analyzeSelectCacheability(stmt as SelectStatement);

      case "NAVIGATE":
        return this.analyzeNavigateCacheability(stmt as NavigateStatement);

      case "FOR":
        // FOR loops with side effects are not cacheable
        const bodyCacheability = this.analyzeCacheability(stmt.body);
        const metadata: CacheMetadata = {
          cacheable: false,
          reason: "FOR loops with iterations are not cacheable",
        };
        this.cacheMetadata.set(stmt, metadata);
        return metadata;

      case "IF":
        // IF statements are not cacheable due to branching
        const metadata2: CacheMetadata = {
          cacheable: false,
          reason: "IF statements with branching are not cacheable",
        };
        this.cacheMetadata.set(stmt, metadata2);
        return metadata2;

      case "WITH":
        // Analyze CTE queries
        for (const cte of stmt.ctes) {
          this.analyzeCacheability(cte.query);
        }
        this.analyzeCacheability(stmt.query);
        const metadata3: CacheMetadata = {
          cacheable: false,
          reason: "WITH statements are not directly cacheable",
        };
        this.cacheMetadata.set(stmt, metadata3);
        return metadata3;

      default:
        // By default, statements are not cacheable
        const defaultMetadata: CacheMetadata = {
          cacheable: false,
          reason: "Statement type not supported for caching",
        };
        this.cacheMetadata.set(stmt, defaultMetadata);
        return defaultMetadata;
    }
  }

  /**
   * Analyze cacheability of SELECT statement
   */
  private analyzeSelectCacheability(stmt: SelectStatement): CacheMetadata {
    // SELECT is cacheable if:
    // 1. Source is a URL (static data)
    // 2. No user-defined functions in expressions
    // 3. No time-dependent functions (NOW(), etc.)
    // 4. No random functions (RANDOM(), etc.)

    // Check source
    if (stmt.source.type !== "URL") {
      const metadata: CacheMetadata = {
        cacheable: false,
        reason: "Source is not a static URL",
      };
      this.cacheMetadata.set(stmt, metadata);
      return metadata;
    }

    // Check for non-deterministic expressions
    const hasNonDeterministic = this.hasNonDeterministicExpressions(stmt);

    if (hasNonDeterministic) {
      const metadata: CacheMetadata = {
        cacheable: false,
        reason: "Contains non-deterministic expressions",
      };
      this.cacheMetadata.set(stmt, metadata);
      return metadata;
    }

    // Generate cache key from URL and query
    const cacheKey = this.generateCacheKey(stmt);

    // Determine TTL based on query characteristics
    const ttl = this.determineTTL(stmt);

    const metadata: CacheMetadata = {
      cacheable: true,
      cacheKey,
      ttl,
    };

    this.cacheMetadata.set(stmt, metadata);
    return metadata;
  }

  /**
   * Analyze cacheability of NAVIGATE statement
   */
  private analyzeNavigateCacheability(stmt: NavigateStatement): CacheMetadata {
    // NAVIGATE is cacheable if:
    // 1. URL is a literal (not dynamic)
    // 2. No user interactions (clicks, typing)
    // 3. Options are deterministic

    // Check if URL is a literal
    if (stmt.url.type !== "LITERAL") {
      const metadata: CacheMetadata = {
        cacheable: false,
        reason: "URL is not a literal",
      };
      this.cacheMetadata.set(stmt, metadata);
      return metadata;
    }

    // Check for proxy configuration that may affect caching
    if (stmt.options && stmt.options.proxy && stmt.options.proxy.cache === false) {
      const metadata: CacheMetadata = {
        cacheable: false,
        reason: "Caching explicitly disabled",
      };
      this.cacheMetadata.set(stmt, metadata);
      return metadata;
    }

    const cacheKey = `navigate:${stmt.url.value}`;
    const ttl = 300000; // 5 minutes default for page navigation

    const metadata: CacheMetadata = {
      cacheable: true,
      cacheKey,
      ttl,
    };

    this.cacheMetadata.set(stmt, metadata);
    return metadata;
  }

  /**
   * Check if statement contains non-deterministic expressions
   */
  private hasNonDeterministicExpressions(stmt: SelectStatement): boolean {
    // Check WHERE clause
    if (stmt.where && this.isNonDeterministic(stmt.where)) {
      return true;
    }

    // Check field expressions
    for (const field of stmt.fields) {
      if (field.expression && this.isNonDeterministic(field.expression)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if expression is non-deterministic
   */
  private isNonDeterministic(expr: Expression): boolean {
    switch (expr.type) {
      case "CALL":
        // Check for non-deterministic functions
        const functionName = expr.callee.toUpperCase();
        const nonDeterministicFunctions = [
          "NOW",
          "CURRENT_TIME",
          "CURRENT_DATE",
          "RANDOM",
          "RAND",
          "UUID",
          "NEWID",
        ];

        if (nonDeterministicFunctions.includes(functionName)) {
          return true;
        }

        // Check arguments
        return expr.arguments.some((arg) => this.isNonDeterministic(arg));

      case "BINARY":
        return (
          this.isNonDeterministic(expr.left) || this.isNonDeterministic(expr.right)
        );

      case "UNARY":
        return this.isNonDeterministic(expr.operand);

      case "MEMBER":
        return this.isNonDeterministic(expr.object);

      case "ARRAY":
        return expr.elements.some((el) => this.isNonDeterministic(el));

      case "OBJECT":
        return expr.properties.some((prop) => this.isNonDeterministic(prop.value));

      default:
        return false;
    }
  }

  /**
   * Generate cache key for a SELECT statement
   */
  private generateCacheKey(stmt: SelectStatement): string {
    // Use URL as base
    const url = (stmt.source as Source).value as string;

    // Add field names
    const fieldNames = stmt.fields.map((f) => f.alias || f.name).join(",");

    // Add WHERE clause if present
    const whereClause = stmt.where ? JSON.stringify(stmt.where) : "";

    // Add ORDER BY if present
    const orderBy = stmt.orderBy
      ? stmt.orderBy.map((o) => `${o.field}:${o.direction}`).join(",")
      : "";

    // Add LIMIT if present
    const limit = stmt.limit ? `${stmt.limit.limit}:${stmt.limit.offset || 0}` : "";

    return `select:${url}:${fieldNames}:${whereClause}:${orderBy}:${limit}`;
  }

  /**
   * Determine TTL for a statement
   */
  private determineTTL(stmt: SelectStatement): number {
    // Default TTL: 60 seconds
    let ttl = 60000;

    // If ORDER BY or LIMIT is present, data is more likely to change
    if (stmt.orderBy || stmt.limit) {
      ttl = 30000; // 30 seconds
    }

    // If WHERE clause filters by time-sensitive fields, reduce TTL
    if (stmt.where && this.hasTimeSensitiveFilter(stmt.where)) {
      ttl = 10000; // 10 seconds
    }

    return ttl;
  }

  /**
   * Check if expression has time-sensitive filters
   */
  private hasTimeSensitiveFilter(expr: Expression): boolean {
    // Check for common time-sensitive field names
    const timeSensitiveFields = [
      "timestamp",
      "created_at",
      "updated_at",
      "modified_at",
      "date",
      "time",
    ];

    const extractIdentifiers = (e: Expression): string[] => {
      const identifiers: string[] = [];

      const walk = (ex: Expression) => {
        if (ex.type === "IDENTIFIER") {
          identifiers.push(ex.name.toLowerCase());
        } else if (ex.type === "BINARY") {
          walk(ex.left);
          walk(ex.right);
        } else if (ex.type === "UNARY") {
          walk(ex.operand);
        } else if (ex.type === "MEMBER") {
          walk(ex.object);
        }
      };

      walk(e);
      return identifiers;
    };

    const identifiers = extractIdentifiers(expr);
    return identifiers.some((id) => timeSensitiveFields.some((field) => id.includes(field)));
  }

  /**
   * Get cache metadata for a statement
   */
  getCacheMetadata(stmt: Statement): CacheMetadata | undefined {
    return this.cacheMetadata.get(stmt);
  }

  /**
   * Get all cacheable statements
   */
  getCacheableStatements(): Statement[] {
    const cacheable: Statement[] = [];

    for (const [stmt, metadata] of this.cacheMetadata) {
      if (metadata.cacheable) {
        cacheable.push(stmt);
      }
    }

    return cacheable;
  }
}
