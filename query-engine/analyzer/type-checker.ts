/**
 * Type checker for semantic analysis
 * Performs type inference and type checking on AST nodes
 */

import {
  ArrayExpression,
  BinaryExpression,
  CallExpression,
  Expression,
  Identifier,
  Literal,
  MemberExpression,
  ObjectExpression,
  SelectStatement,
  Statement,
  UnaryExpression,
} from "../types/ast.ts";
import { DataType } from "../types/primitives.ts";
import { Symbol, SymbolTable, SymbolType } from "./symbols.ts";

/**
 * Type checking error
 */
export class TypeCheckError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TypeCheckError";
  }
}

/**
 * Type checker class
 */
export class TypeChecker {
  private symbolTable: SymbolTable;

  constructor(symbolTable: SymbolTable) {
    this.symbolTable = symbolTable;
  }

  /**
   * Check a statement
   */
  checkStatement(stmt: Statement): void {
    switch (stmt.type) {
      case "SELECT":
        this.checkSelect(stmt as SelectStatement);
        break;
      case "NAVIGATE":
        this.checkNavigate(stmt);
        break;
      case "SET":
        this.checkSet(stmt);
        break;
      case "FOR":
        this.checkFor(stmt);
        break;
      case "IF":
        this.checkIf(stmt);
        break;
      case "INSERT":
        this.checkInsert(stmt);
        break;
      case "UPDATE":
        this.checkUpdate(stmt);
        break;
      case "DELETE":
        this.checkDelete(stmt);
        break;
      case "WITH":
        this.checkWith(stmt);
        break;
      case "SHOW":
        // SHOW statements have no type constraints
        break;
    }
  }

  /**
   * Check SELECT statement
   */
  private checkSelect(stmt: SelectStatement): void {
    // Check WHERE clause
    if (stmt.where) {
      const whereType = this.inferType(stmt.where);
      if (whereType !== DataType.BOOLEAN) {
        throw new TypeCheckError(
          `WHERE clause must be Boolean, got ${whereType}`,
        );
      }
    }

    // Check fields exist in source
    for (const field of stmt.fields) {
      if (field.expression) {
        this.checkExpression(field.expression);
      }
    }

    // Check ORDER BY fields
    if (stmt.orderBy) {
      for (const order of stmt.orderBy) {
        // Verify field exists in selected fields
        const fieldExists = stmt.fields.some(
          (f) => (f.alias || f.name) === order.field,
        );
        if (!fieldExists && stmt.fields[0]?.name !== "*") {
          throw new TypeCheckError(
            `ORDER BY field '${order.field}' not found in SELECT list`,
          );
        }
      }
    }

    // Check LIMIT is a number
    if (stmt.limit) {
      if (stmt.limit.limit < 0) {
        throw new TypeCheckError("LIMIT must be non-negative");
      }
      if (stmt.limit.offset !== undefined && stmt.limit.offset < 0) {
        throw new TypeCheckError("OFFSET must be non-negative");
      }
    }
  }

  /**
   * Check an expression
   */
  checkExpression(expr: Expression): void {
    this.inferType(expr);
  }

  /**
   * Infer the type of an expression
   */
  inferType(expr: Expression): DataType {
    switch (expr.type) {
      case "LITERAL":
        return (expr as Literal).dataType;

      case "IDENTIFIER":
        return this.inferIdentifierType(expr as Identifier);

      case "BINARY":
        return this.inferBinaryType(expr as BinaryExpression);

      case "UNARY":
        return this.inferUnaryType(expr as UnaryExpression);

      case "CALL":
        return this.inferCallType(expr as CallExpression);

      case "MEMBER":
        return this.inferMemberType(expr as MemberExpression);

      case "ARRAY":
        return DataType.ARRAY;

      case "OBJECT":
        return DataType.OBJECT;

      default:
        return DataType.UNKNOWN;
    }
  }

  /**
   * Infer identifier type from symbol table
   */
  private inferIdentifierType(expr: Identifier): DataType {
    const symbol = this.symbolTable.resolve(expr.name);

    if (!symbol) {
      // Could be a DOM field or built-in
      return DataType.UNKNOWN;
    }

    return symbol.dataType;
  }

  /**
   * Infer binary expression type
   */
  private inferBinaryType(expr: BinaryExpression): DataType {
    const leftType = this.inferType(expr.left);
    const rightType = this.inferType(expr.right);

    // Comparison operators return boolean
    if (
      ["=", "!=", ">", ">=", "<", "<=", "IN", "LIKE", "MATCHES", "CONTAINS"].includes(expr.operator)
    ) {
      // Check types are compatible
      if (
        leftType !== DataType.UNKNOWN &&
        rightType !== DataType.UNKNOWN &&
        !this.areTypesCompatible(leftType, rightType)
      ) {
        throw new TypeCheckError(
          `Cannot compare ${leftType} and ${rightType} with ${expr.operator}`,
        );
      }
      return DataType.BOOLEAN;
    }

    // Logical operators
    if (["AND", "OR"].includes(expr.operator)) {
      if (leftType !== DataType.BOOLEAN && leftType !== DataType.UNKNOWN) {
        throw new TypeCheckError(
          `Left operand of ${expr.operator} must be Boolean, got ${leftType}`,
        );
      }
      if (rightType !== DataType.BOOLEAN && rightType !== DataType.UNKNOWN) {
        throw new TypeCheckError(
          `Right operand of ${expr.operator} must be Boolean, got ${rightType}`,
        );
      }
      return DataType.BOOLEAN;
    }

    // Arithmetic operators
    if (["+", "-", "*", "/", "%"].includes(expr.operator)) {
      if (leftType === DataType.STRING || rightType === DataType.STRING) {
        // String concatenation
        if (expr.operator === "+") {
          return DataType.STRING;
        }
        throw new TypeCheckError(
          `Cannot apply ${expr.operator} to string`,
        );
      }

      if (
        (leftType !== DataType.NUMBER && leftType !== DataType.UNKNOWN) ||
        (rightType !== DataType.NUMBER && rightType !== DataType.UNKNOWN)
      ) {
        throw new TypeCheckError(
          `Arithmetic operator ${expr.operator} requires numeric operands`,
        );
      }

      return DataType.NUMBER;
    }

    // String concatenation
    if (expr.operator === "||") {
      return DataType.STRING;
    }

    return DataType.UNKNOWN;
  }

  /**
   * Infer unary expression type
   */
  private inferUnaryType(expr: UnaryExpression): DataType {
    const operandType = this.inferType(expr.operand);

    if (expr.operator === "NOT") {
      if (operandType !== DataType.BOOLEAN && operandType !== DataType.UNKNOWN) {
        throw new TypeCheckError(
          `NOT operator requires Boolean operand, got ${operandType}`,
        );
      }
      return DataType.BOOLEAN;
    }

    if (expr.operator === "-" || expr.operator === "+") {
      if (operandType !== DataType.NUMBER && operandType !== DataType.UNKNOWN) {
        throw new TypeCheckError(
          `Unary ${expr.operator} requires numeric operand, got ${operandType}`,
        );
      }
      return DataType.NUMBER;
    }

    return DataType.UNKNOWN;
  }

  /**
   * Infer function call type
   */
  private inferCallType(expr: CallExpression): DataType {
    const functionName = expr.callee.toUpperCase();

    // String functions
    if (["UPPER", "LOWER", "TRIM", "SUBSTRING", "REPLACE"].includes(functionName)) {
      return DataType.STRING;
    }

    // DOM functions
    if (["TEXT", "HTML", "ATTR"].includes(functionName)) {
      return DataType.STRING;
    }

    if (["COUNT"].includes(functionName)) {
      return DataType.NUMBER;
    }

    if (["EXISTS"].includes(functionName)) {
      return DataType.BOOLEAN;
    }

    // Network functions
    if (["HEADER", "BODY"].includes(functionName)) {
      return DataType.STRING;
    }

    if (["STATUS"].includes(functionName)) {
      return DataType.NUMBER;
    }

    if (["CACHED"].includes(functionName)) {
      return DataType.BOOLEAN;
    }

    // Utility functions
    if (["PARSE_JSON"].includes(functionName)) {
      return DataType.OBJECT;
    }

    if (["PARSE_HTML"].includes(functionName)) {
      return DataType.DOCUMENT;
    }

    if (["SCREENSHOT", "PDF"].includes(functionName)) {
      return DataType.BYTES;
    }

    // Check symbol table for user-defined functions
    const symbol = this.symbolTable.resolve(functionName);
    if (symbol && symbol.type === SymbolType.FUNCTION) {
      return symbol.metadata?.returnType || DataType.UNKNOWN;
    }

    return DataType.UNKNOWN;
  }

  /**
   * Infer member expression type
   */
  private inferMemberType(expr: MemberExpression): DataType {
    const objectType = this.inferType(expr.object);

    // If object is unknown, property type is also unknown
    if (objectType === DataType.UNKNOWN) {
      return DataType.UNKNOWN;
    }

    // For known object types, property type depends on runtime schema
    // Without static schema, we return UNKNOWN
    return DataType.UNKNOWN;
  }

  /**
   * Check NAVIGATE statement
   */
  private checkNavigate(stmt: any): void {
    // Check URL expression type
    const urlType = this.inferType(stmt.url);
    if (urlType !== DataType.STRING && urlType !== DataType.URL && urlType !== DataType.UNKNOWN) {
      throw new TypeCheckError(
        `NAVIGATE URL must be String or URL, got ${urlType}`,
      );
    }

    // Check capture expressions
    if (stmt.capture) {
      for (const field of stmt.capture.fields) {
        if (field.expression) {
          this.checkExpression(field.expression);
        }
      }
    }
  }

  /**
   * Check SET statement
   */
  private checkSet(stmt: any): void {
    // Check value expression
    this.checkExpression(stmt.value);
  }

  /**
   * Check FOR statement
   */
  private checkFor(stmt: any): void {
    // Check collection expression
    const collectionType = this.inferType(stmt.collection);
    if (collectionType !== DataType.ARRAY && collectionType !== DataType.UNKNOWN) {
      throw new TypeCheckError(
        `FOR collection must be Array, got ${collectionType}`,
      );
    }

    // Check body
    this.checkStatement(stmt.body);
  }

  /**
   * Check IF statement
   */
  private checkIf(stmt: any): void {
    // Check condition is boolean
    const conditionType = this.inferType(stmt.condition);
    if (conditionType !== DataType.BOOLEAN && conditionType !== DataType.UNKNOWN) {
      throw new TypeCheckError(
        `IF condition must be Boolean, got ${conditionType}`,
      );
    }

    // Check branches
    this.checkStatement(stmt.thenBranch);
    if (stmt.elseBranch) {
      this.checkStatement(stmt.elseBranch);
    }
  }

  /**
   * Check INSERT statement
   */
  private checkInsert(stmt: any): void {
    // Check all values are expressions
    for (const value of stmt.values) {
      this.checkExpression(value);
    }
  }

  /**
   * Check UPDATE statement
   */
  private checkUpdate(stmt: any): void {
    // Check SET clause expressions
    for (const [_field, value] of Object.entries(stmt.set)) {
      this.checkExpression(value as any);
    }

    // Check WHERE clause
    if (stmt.where) {
      const whereType = this.inferType(stmt.where);
      if (whereType !== DataType.BOOLEAN && whereType !== DataType.UNKNOWN) {
        throw new TypeCheckError(
          `WHERE clause must be Boolean, got ${whereType}`,
        );
      }
    }
  }

  /**
   * Check DELETE statement
   */
  private checkDelete(stmt: any): void {
    // Check WHERE clause
    if (stmt.where) {
      const whereType = this.inferType(stmt.where);
      if (whereType !== DataType.BOOLEAN && whereType !== DataType.UNKNOWN) {
        throw new TypeCheckError(
          `WHERE clause must be Boolean, got ${whereType}`,
        );
      }
    }
  }

  /**
   * Check WITH statement
   */
  private checkWith(stmt: any): void {
    // Check CTE query
    this.checkStatement(stmt.query);

    // Check body
    this.checkStatement(stmt.body);
  }

  /**
   * Check if two types are compatible for comparison
   */
  private areTypesCompatible(type1: DataType, type2: DataType): boolean {
    if (type1 === type2) {
      return true;
    }

    // Allow comparison between NUMBER and NULL
    if (
      (type1 === DataType.NUMBER && type2 === DataType.NULL) ||
      (type1 === DataType.NULL && type2 === DataType.NUMBER)
    ) {
      return true;
    }

    // Allow comparison between STRING and NULL
    if (
      (type1 === DataType.STRING && type2 === DataType.NULL) ||
      (type1 === DataType.NULL && type2 === DataType.STRING)
    ) {
      return true;
    }

    // Allow comparison between BOOLEAN and NULL
    if (
      (type1 === DataType.BOOLEAN && type2 === DataType.NULL) ||
      (type1 === DataType.NULL && type2 === DataType.BOOLEAN)
    ) {
      return true;
    }

    return false;
  }

  /**
   * Check if a type can be coerced to another type
   */
  canCoerce(fromType: DataType, toType: DataType): boolean {
    // Same type
    if (fromType === toType) {
      return true;
    }

    // Any type can be coerced to UNKNOWN
    if (toType === DataType.UNKNOWN) {
      return true;
    }

    // NULL can be coerced to any nullable type
    if (fromType === DataType.NULL) {
      return true;
    }

    // NUMBER can be coerced to STRING
    if (fromType === DataType.NUMBER && toType === DataType.STRING) {
      return true;
    }

    // BOOLEAN can be coerced to STRING
    if (fromType === DataType.BOOLEAN && toType === DataType.STRING) {
      return true;
    }

    return false;
  }

  /**
   * Get symbol table
   */
  getSymbolTable(): SymbolTable {
    return this.symbolTable;
  }
}
