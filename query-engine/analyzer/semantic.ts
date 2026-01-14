/**
 * Semantic Analyzer - Main coordinator for semantic analysis
 * Integrates symbol table, type checking, and validation
 */

import {
  DeleteStatement,
  Expression,
  Field,
  ForStatement,
  Identifier,
  IfStatement,
  InsertStatement,
  NavigateStatement,
  SelectStatement,
  SetStatement,
  ShowStatement,
  Source,
  Statement,
  UpdateStatement,
  WithStatement,
} from "../types/ast.ts";
import { DataType } from "../types/primitives.ts";
import { ScopeType, Symbol, SymbolTable, SymbolType } from "./symbols.ts";
import { TypeChecker } from "./type-checker.ts";
import { Validator } from "./validator.ts";

/**
 * Semantic analysis error
 */
export class SemanticError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SemanticError";
  }
}

/**
 * Annotated AST with type information
 */
export interface AnnotatedAST {
  ast: Statement;
  symbolTable: SymbolTable;
  typeInfo: Map<Expression, DataType>;
}

/**
 * Semantic analyzer configuration
 */
export interface SemanticAnalyzerConfig {
  allowUndefinedVariables?: boolean;
  strictTypeChecking?: boolean;
  allowPrivateIPs?: boolean;
  maxNestingDepth?: number;
}

/**
 * Main semantic analyzer class
 */
export class SemanticAnalyzer {
  private symbolTable: SymbolTable;
  private typeChecker: TypeChecker;
  private validator: Validator;
  private config: SemanticAnalyzerConfig;
  private typeInfo: Map<Expression, DataType>;
  private nestingDepth: number;

  constructor(config: SemanticAnalyzerConfig = {}) {
    this.config = {
      allowUndefinedVariables: config.allowUndefinedVariables ?? false,
      strictTypeChecking: config.strictTypeChecking ?? true,
      allowPrivateIPs: config.allowPrivateIPs ?? false,
      maxNestingDepth: config.maxNestingDepth ?? 10,
    };

    this.symbolTable = new SymbolTable();
    this.typeChecker = new TypeChecker(this.symbolTable);
    this.validator = new Validator(this.symbolTable);
    this.typeInfo = new Map();
    this.nestingDepth = 0;
  }

  /**
   * Analyze a statement and return annotated AST
   */
  analyze(stmt: Statement): AnnotatedAST {
    // Reset state
    this.typeInfo = new Map();
    this.nestingDepth = 0;

    // Phase 1: Build symbol table
    this.buildSymbolTable(stmt);

    // Phase 2: Type checking
    if (this.config.strictTypeChecking) {
      this.typeChecker.checkStatement(stmt);
    }

    // Phase 3: Semantic validation
    this.validator.validate(stmt);

    // Phase 4: Collect type information
    this.collectTypeInfo(stmt);

    return {
      ast: stmt,
      symbolTable: this.symbolTable,
      typeInfo: this.typeInfo,
    };
  }

  /**
   * Build symbol table by walking the AST
   */
  private buildSymbolTable(stmt: Statement): void {
    this.checkNestingDepth();

    switch (stmt.type) {
      case "SELECT":
        this.buildSymbolTableForSelect(stmt as SelectStatement);
        break;
      case "NAVIGATE":
        this.buildSymbolTableForNavigate(stmt as NavigateStatement);
        break;
      case "SET":
        this.buildSymbolTableForSet(stmt as SetStatement);
        break;
      case "SHOW":
        this.buildSymbolTableForShow(stmt as ShowStatement);
        break;
      case "FOR":
        this.buildSymbolTableForFor(stmt as ForStatement);
        break;
      case "IF":
        this.buildSymbolTableForIf(stmt as IfStatement);
        break;
      case "INSERT":
        this.buildSymbolTableForInsert(stmt as InsertStatement);
        break;
      case "UPDATE":
        this.buildSymbolTableForUpdate(stmt as UpdateStatement);
        break;
      case "DELETE":
        this.buildSymbolTableForDelete(stmt as DeleteStatement);
        break;
      case "WITH":
        this.buildSymbolTableForWith(stmt as WithStatement);
        break;
    }
  }

  /**
   * Build symbol table for SELECT statement
   */
  private buildSymbolTableForSelect(stmt: SelectStatement): void {
    this.symbolTable.enterScope(ScopeType.QUERY);

    // Add source to symbol table
    this.processSource(stmt.source);

    // Add fields to symbol table
    for (const field of stmt.fields) {
      if (field.alias) {
        this.symbolTable.define({
          name: field.alias,
          type: SymbolType.FIELD,
          dataType: this.inferFieldType(field),
          nullable: true,
          scope: this.symbolTable.getCurrentScope(),
        });
      }
    }

    // Process WHERE clause
    if (stmt.where) {
      this.processExpression(stmt.where);
    }

    this.symbolTable.exitScope();
  }

  /**
   * Build symbol table for NAVIGATE statement
   */
  private buildSymbolTableForNavigate(stmt: NavigateStatement): void {
    this.symbolTable.enterScope(ScopeType.QUERY);

    // Process URL expression
    this.processExpression(stmt.url);

    // Add captured fields to symbol table
    if (stmt.capture) {
      for (const field of stmt.capture.fields) {
        const fieldName = field.alias || field.name;
        this.symbolTable.define({
          name: fieldName,
          type: SymbolType.FIELD,
          dataType: this.inferFieldType(field),
          nullable: true,
          scope: this.symbolTable.getCurrentScope(),
        });

        if (field.expression) {
          this.processExpression(field.expression);
        }
      }
    }

    this.symbolTable.exitScope();
  }

  /**
   * Build symbol table for SET statement
   */
  private buildSymbolTableForSet(stmt: SetStatement): void {
    // Define variable in current scope (use first element of path as variable name)
    const variableName = stmt.path.join(".");
    this.symbolTable.define({
      name: variableName,
      type: SymbolType.VARIABLE,
      dataType: DataType.UNKNOWN, // Will be inferred from value
      nullable: true,
      scope: this.symbolTable.getCurrentScope(),
    });

    // Process value expression
    this.processExpression(stmt.value);
  }

  /**
   * Build symbol table for SHOW statement
   */
  private buildSymbolTableForShow(stmt: ShowStatement): void {
    // Validate SHOW target is valid
    const validTargets = [
      "CACHE",
      "COOKIES",
      "HEADERS",
      "METRICS",
      "STATE",
      "VARIABLES",
      "HISTORY",
      "CONNECTIONS",
    ];

    if (!validTargets.includes(stmt.target.toUpperCase())) {
      throw new SemanticError(
        `Invalid SHOW target: ${stmt.target}. Valid targets: ${validTargets.join(", ")}`,
      );
    }

    // SHOW doesn't introduce new symbols to scope
  }

  /**
   * Build symbol table for FOR statement
   */
  private buildSymbolTableForFor(stmt: ForStatement): void {
    this.symbolTable.enterScope(ScopeType.FOR_LOOP);

    // Add loop variable to symbol table
    this.symbolTable.define({
      name: stmt.variable,
      type: SymbolType.VARIABLE,
      dataType: DataType.UNKNOWN, // Element type of collection
      nullable: false,
      scope: this.symbolTable.getCurrentScope(),
    });

    // Process collection expression
    this.processExpression(stmt.collection);

    // Process body
    this.nestingDepth++;
    this.buildSymbolTable(stmt.body);
    this.nestingDepth--;

    this.symbolTable.exitScope();
  }

  /**
   * Build symbol table for IF statement
   */
  private buildSymbolTableForIf(stmt: IfStatement): void {
    // Process condition
    this.processExpression(stmt.condition);

    // Process then branch
    this.symbolTable.enterScope(ScopeType.IF_BRANCH);
    this.nestingDepth++;
    this.buildSymbolTable(stmt.thenBranch);
    this.nestingDepth--;
    this.symbolTable.exitScope();

    // Process else branch if present
    if (stmt.elseBranch) {
      this.symbolTable.enterScope(ScopeType.IF_BRANCH);
      this.nestingDepth++;
      this.buildSymbolTable(stmt.elseBranch);
      this.nestingDepth--;
      this.symbolTable.exitScope();
    }
  }

  /**
   * Build symbol table for INSERT statement
   */
  private buildSymbolTableForInsert(stmt: InsertStatement): void {
    this.symbolTable.enterScope(ScopeType.QUERY);

    // Process value expression
    this.processExpression(stmt.value);

    // Process target expression
    this.processExpression(stmt.target);

    this.symbolTable.exitScope();
  }

  /**
   * Build symbol table for UPDATE statement
   */
  private buildSymbolTableForUpdate(stmt: UpdateStatement): void {
    this.symbolTable.enterScope(ScopeType.QUERY);

    // Process target expression
    this.processExpression(stmt.target);

    // Process assignments
    for (const assignment of stmt.assignments) {
      this.processExpression(assignment.value);
    }

    this.symbolTable.exitScope();
  }

  /**
   * Build symbol table for DELETE statement
   */
  private buildSymbolTableForDelete(stmt: DeleteStatement): void {
    this.symbolTable.enterScope(ScopeType.QUERY);

    // Process target expression
    this.processExpression(stmt.target);

    this.symbolTable.exitScope();
  }

  /**
   * Build symbol table for WITH statement (CTE)
   */
  private buildSymbolTableForWith(stmt: WithStatement): void {
    this.symbolTable.enterScope(ScopeType.CTE);

    // Process each CTE
    for (const cte of stmt.ctes) {
      // Define CTE in symbol table
      this.symbolTable.define({
        name: cte.name,
        type: SymbolType.CTE,
        dataType: DataType.OBJECT,
        nullable: false,
        scope: this.symbolTable.getCurrentScope(),
        metadata: {
          query: cte.query,
        },
      });

      // Process CTE query
      this.nestingDepth++;
      this.buildSymbolTable(cte.query);
      this.nestingDepth--;
    }

    // Process main query
    this.buildSymbolTable(stmt.query);

    this.symbolTable.exitScope();
  }

  /**
   * Process source and add to symbol table
   */
  private processSource(source: Source): void {
    if (source.type === "VARIABLE") {
      const varName = source.value as string;
      const symbol = this.symbolTable.resolve(varName);

      if (!symbol && !this.config.allowUndefinedVariables) {
        throw new SemanticError(`Undefined variable: ${varName}`);
      }
    } else if (source.type === "SUBQUERY") {
      this.symbolTable.enterScope(ScopeType.SUBQUERY);
      this.nestingDepth++;
      this.buildSymbolTable(source.value as Statement);
      this.nestingDepth--;
      this.symbolTable.exitScope();
    }
  }

  /**
   * Process expression and track identifiers
   */
  private processExpression(expr: Expression): void {
    switch (expr.type) {
      case "BINARY":
        this.processExpression(expr.left);
        this.processExpression(expr.right);
        break;
      case "UNARY":
        this.processExpression(expr.operand);
        break;
      case "CALL":
        for (const arg of expr.arguments) {
          this.processExpression(arg);
        }
        break;
      case "MEMBER":
        this.processExpression(expr.object);
        break;
      case "ARRAY":
        for (const element of expr.elements) {
          this.processExpression(element);
        }
        break;
      case "OBJECT":
        for (const prop of expr.properties) {
          this.processExpression(prop.value);
        }
        break;
      case "IDENTIFIER":
        // Check if identifier is defined
        const identifier = expr as Identifier;
        const symbol = this.symbolTable.resolve(identifier.name);

        if (!symbol && !this.config.allowUndefinedVariables) {
          // Could be a DOM field or built-in, don't error
          // Just track it
        }
        break;
    }
  }

  /**
   * Collect type information for all expressions
   */
  private collectTypeInfo(stmt: Statement): void {
    this.collectTypeInfoForStatement(stmt);
  }

  /**
   * Collect type info for a statement
   */
  private collectTypeInfoForStatement(stmt: Statement): void {
    switch (stmt.type) {
      case "SELECT":
        this.collectTypeInfoForSelect(stmt as SelectStatement);
        break;
      case "NAVIGATE":
        this.collectTypeInfoForNavigate(stmt as NavigateStatement);
        break;
      case "SET":
        this.collectTypeInfoForSet(stmt as SetStatement);
        break;
      case "FOR":
        this.collectTypeInfoForFor(stmt as ForStatement);
        break;
      case "IF":
        this.collectTypeInfoForIf(stmt as IfStatement);
        break;
      case "INSERT":
        this.collectTypeInfoForInsert(stmt as InsertStatement);
        break;
      case "UPDATE":
        this.collectTypeInfoForUpdate(stmt as UpdateStatement);
        break;
      case "DELETE":
        this.collectTypeInfoForDelete(stmt as DeleteStatement);
        break;
      case "WITH":
        this.collectTypeInfoForWith(stmt as WithStatement);
        break;
    }
  }

  /**
   * Collect type info for SELECT
   */
  private collectTypeInfoForSelect(stmt: SelectStatement): void {
    if (stmt.where) {
      this.collectTypeInfoForExpression(stmt.where);
    }

    for (const field of stmt.fields) {
      if (field.expression) {
        this.collectTypeInfoForExpression(field.expression);
      }
    }
  }

  /**
   * Collect type info for NAVIGATE
   */
  private collectTypeInfoForNavigate(stmt: NavigateStatement): void {
    this.collectTypeInfoForExpression(stmt.url);

    if (stmt.capture) {
      for (const field of stmt.capture.fields) {
        if (field.expression) {
          this.collectTypeInfoForExpression(field.expression);
        }
      }
    }
  }

  /**
   * Collect type info for SET
   */
  private collectTypeInfoForSet(stmt: SetStatement): void {
    this.collectTypeInfoForExpression(stmt.value);
  }

  /**
   * Collect type info for FOR
   */
  private collectTypeInfoForFor(stmt: ForStatement): void {
    this.collectTypeInfoForExpression(stmt.collection);
    this.collectTypeInfoForStatement(stmt.body);
  }

  /**
   * Collect type info for IF
   */
  private collectTypeInfoForIf(stmt: IfStatement): void {
    this.collectTypeInfoForExpression(stmt.condition);
    this.collectTypeInfoForStatement(stmt.thenBranch);

    if (stmt.elseBranch) {
      this.collectTypeInfoForStatement(stmt.elseBranch);
    }
  }

  /**
   * Collect type info for INSERT
   */
  private collectTypeInfoForInsert(stmt: InsertStatement): void {
    this.collectTypeInfoForExpression(stmt.value);
    this.collectTypeInfoForExpression(stmt.target);
  }

  /**
   * Collect type info for UPDATE
   */
  private collectTypeInfoForUpdate(stmt: UpdateStatement): void {
    this.collectTypeInfoForExpression(stmt.target);

    for (const assignment of stmt.assignments) {
      this.collectTypeInfoForExpression(assignment.value);
    }
  }

  /**
   * Collect type info for DELETE
   */
  private collectTypeInfoForDelete(stmt: DeleteStatement): void {
    this.collectTypeInfoForExpression(stmt.target);
  }

  /**
   * Collect type info for WITH
   */
  private collectTypeInfoForWith(stmt: WithStatement): void {
    for (const cte of stmt.ctes) {
      this.collectTypeInfoForStatement(cte.query);
    }
    this.collectTypeInfoForStatement(stmt.query);
  }

  /**
   * Collect type info for an expression
   */
  private collectTypeInfoForExpression(expr: Expression): void {
    // Infer and store type
    const type = this.typeChecker.inferType(expr);
    this.typeInfo.set(expr, type);

    // Recurse into sub-expressions
    switch (expr.type) {
      case "BINARY":
        this.collectTypeInfoForExpression(expr.left);
        this.collectTypeInfoForExpression(expr.right);
        break;
      case "UNARY":
        this.collectTypeInfoForExpression(expr.operand);
        break;
      case "CALL":
        for (const arg of expr.arguments) {
          this.collectTypeInfoForExpression(arg);
        }
        break;
      case "MEMBER":
        this.collectTypeInfoForExpression(expr.object);
        break;
      case "ARRAY":
        for (const element of expr.elements) {
          this.collectTypeInfoForExpression(element);
        }
        break;
      case "OBJECT":
        for (const prop of expr.properties) {
          this.collectTypeInfoForExpression(prop.value);
        }
        break;
    }
  }

  /**
   * Infer type of a field
   */
  private inferFieldType(field: Field): DataType {
    // Priority 1: Expression-based type inference
    if (field.expression) {
      return this.typeChecker.inferType(field.expression);
    }

    // Priority 2: Schema-based type inference from field name
    const fieldName = field.name.toLowerCase();

    // DOM field patterns
    if (fieldName === "text" || fieldName === "innertext" || fieldName === "textcontent") {
      return DataType.STRING;
    }
    if (fieldName === "html" || fieldName === "innerhtml" || fieldName === "outerhtml") {
      return DataType.STRING;
    }
    if (fieldName.startsWith("attr:") || fieldName === "attributes") {
      return DataType.STRING;
    }
    if (fieldName === "count" || fieldName === "length" || fieldName === "size") {
      return DataType.NUMBER;
    }
    if (fieldName === "exists" || fieldName === "visible" || fieldName === "enabled") {
      return DataType.BOOLEAN;
    }

    // Network field patterns
    if (fieldName === "status" || fieldName === "statuscode") {
      return DataType.NUMBER;
    }
    if (fieldName === "headers" || fieldName === "cookies") {
      return DataType.OBJECT;
    }
    if (fieldName === "body" || fieldName === "content" || fieldName === "data") {
      return DataType.STRING; // Could be BUFFER but STRING more common
    }
    if (fieldName === "cached" || fieldName === "fromcache") {
      return DataType.BOOLEAN;
    }

    // Response field patterns
    if (fieldName.startsWith("response.")) {
      const subField = fieldName.slice(9); // Remove "response."
      return this.inferFieldType({ name: subField });
    }

    // DOM field patterns
    if (fieldName.startsWith("dom.")) {
      const subField = fieldName.slice(4); // Remove "dom."
      return this.inferFieldType({ name: subField });
    }

    // For fields without expressions, type is unknown
    return DataType.UNKNOWN;
  }

  /**
   * Check nesting depth to prevent stack overflow
   */
  private checkNestingDepth(): void {
    if (this.nestingDepth >= this.config.maxNestingDepth!) {
      throw new SemanticError(
        `Maximum nesting depth of ${this.config.maxNestingDepth} exceeded`,
      );
    }
  }

  /**
   * Get type information for an expression
   */
  getTypeInfo(expr: Expression): DataType | undefined {
    return this.typeInfo.get(expr);
  }

  /**
   * Get symbol table
   */
  getSymbolTable(): SymbolTable {
    return this.symbolTable;
  }

  /**
   * Get type checker instance
   */
  getTypeChecker(): TypeChecker {
    return this.typeChecker;
  }

  /**
   * Get validator instance
   */
  getValidator(): Validator {
    return this.validator;
  }

  /**
   * Get semantic analyzer configuration
   */
  getConfig(): Readonly<SemanticAnalyzerConfig> {
    return { ...this.config };
  }

  /**
   * Get all type information (returns copy)
   */
  getTypeInfoMap(): Map<Expression, DataType> {
    return new Map(this.typeInfo);
  }

  /**
   * Get current nesting depth
   */
  getNestingDepth(): number {
    return this.nestingDepth;
  }
}
