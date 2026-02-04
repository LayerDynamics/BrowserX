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
  InsertStatement,
  Literal,
  MemberExpression,
  ObjectExpression,
  SelectStatement,
  Statement,
  UnaryExpression,
  UpdateStatement,
  WithStatement,
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
      if (stmt.limit.count < 0) {
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

    // Special operators with specific type requirements
    // IN: checks if left operand exists in right operand (array/collection)
    if (expr.operator === "IN") {
      // Right side should be an Array (or UNKNOWN which is permissive)
      if (rightType !== DataType.ARRAY && rightType !== DataType.UNKNOWN) {
        throw new TypeCheckError(
          `Right operand of IN must be Array, got ${rightType}`,
        );
      }
      return DataType.BOOLEAN;
    }

    // MATCHES: checks if string matches regex pattern
    if (expr.operator === "MATCHES") {
      // Left should be String (or UNKNOWN), right should be Regex (or UNKNOWN)
      if (leftType !== DataType.STRING && leftType !== DataType.UNKNOWN) {
        throw new TypeCheckError(
          `Left operand of MATCHES must be String, got ${leftType}`,
        );
      }
      if (rightType !== DataType.REGEX && rightType !== DataType.UNKNOWN) {
        throw new TypeCheckError(
          `Right operand of MATCHES must be Regex, got ${rightType}`,
        );
      }
      return DataType.BOOLEAN;
    }

    // LIKE: SQL-style pattern matching (both operands should be strings)
    if (expr.operator === "LIKE") {
      if (leftType !== DataType.STRING && leftType !== DataType.UNKNOWN) {
        throw new TypeCheckError(
          `Left operand of LIKE must be String, got ${leftType}`,
        );
      }
      if (rightType !== DataType.STRING && rightType !== DataType.UNKNOWN) {
        throw new TypeCheckError(
          `Right operand of LIKE must be String, got ${rightType}`,
        );
      }
      return DataType.BOOLEAN;
    }

    // CONTAINS: checks if string contains substring
    if (expr.operator === "CONTAINS") {
      if (leftType !== DataType.STRING && leftType !== DataType.UNKNOWN) {
        throw new TypeCheckError(
          `Left operand of CONTAINS must be String, got ${leftType}`,
        );
      }
      if (rightType !== DataType.STRING && rightType !== DataType.UNKNOWN) {
        throw new TypeCheckError(
          `Right operand of CONTAINS must be String, got ${rightType}`,
        );
      }
      return DataType.BOOLEAN;
    }

    // Standard comparison operators return boolean
    if (
      ["=", "!=", ">", ">=", "<", "<="].includes(expr.operator)
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
      return (symbol.metadata?.returnType as DataType) || DataType.UNKNOWN;
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
    this.checkStatement(stmt.then);
    if (stmt.else) {
      this.checkStatement(stmt.else);
    }
  }

  /**
   * Check INSERT statement
   */
  private checkInsert(stmt: InsertStatement): void {
    // Check the value expression
    if (stmt.value) {
      this.checkExpression(stmt.value);
    }
    // Check the target expression
    if (stmt.target) {
      this.checkExpression(stmt.target);
    }
  }

  /**
   * Check UPDATE statement
   */
  private checkUpdate(stmt: UpdateStatement): void {
    // Check assignment expressions
    if (stmt.assignments) {
      for (const assignment of stmt.assignments) {
        this.checkExpression(assignment.value);
      }
    }

    // Check target expression
    if (stmt.target) {
      this.checkExpression(stmt.target);
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
  private checkWith(stmt: WithStatement): void {
    // Check all CTE queries
    if (stmt.ctes) {
      for (const cte of stmt.ctes) {
        if (cte.query) {
          this.checkStatement(cte.query);
        }
      }
    }

    // Check main query
    if (stmt.query) {
      this.checkStatement(stmt.query);
    }
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

    // Allow comparison between URL and STRING (URLs are string-like)
    if (
      (type1 === DataType.URL && type2 === DataType.STRING) ||
      (type1 === DataType.STRING && type2 === DataType.URL)
    ) {
      return true;
    }

    // Allow comparison between URL and NULL
    if (
      (type1 === DataType.URL && type2 === DataType.NULL) ||
      (type1 === DataType.NULL && type2 === DataType.URL)
    ) {
      return true;
    }

    // Allow comparison between ARRAY and NULL
    if (
      (type1 === DataType.ARRAY && type2 === DataType.NULL) ||
      (type1 === DataType.NULL && type2 === DataType.ARRAY)
    ) {
      return true;
    }

    // Allow comparison between OBJECT and NULL
    if (
      (type1 === DataType.OBJECT && type2 === DataType.NULL) ||
      (type1 === DataType.NULL && type2 === DataType.OBJECT)
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

    // UNKNOWN can be used where any type is expected
    if (fromType === DataType.UNKNOWN) {
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

    // URL can be coerced to STRING (and vice versa)
    if (
      (fromType === DataType.URL && toType === DataType.STRING) ||
      (fromType === DataType.STRING && toType === DataType.URL)
    ) {
      return true;
    }

    // DOCUMENT can be coerced to STRING (serialization)
    if (fromType === DataType.DOCUMENT && toType === DataType.STRING) {
      return true;
    }

    // BYTES can be coerced to STRING (base64 encoding)
    if (fromType === DataType.BYTES && toType === DataType.STRING) {
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
