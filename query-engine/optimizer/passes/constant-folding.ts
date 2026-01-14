/**
 * Constant folding optimization pass
 * Evaluates constant expressions at compile time
 */

import {
  ArrayExpression,
  BinaryExpression,
  Expression,
  Literal,
  ObjectExpression,
  Statement,
  UnaryExpression,
} from "../../types/ast.ts";
import { DataType } from "../../types/primitives.ts";

/**
 * Constant folding pass
 * Evaluates expressions with only literal operands at compile time
 */
export class ConstantFoldingPass {
  /**
   * Apply constant folding to a statement
   */
  apply(stmt: Statement): Statement {
    return this.foldStatement(stmt);
  }

  /**
   * Fold a statement
   */
  private foldStatement(stmt: Statement): Statement {
    switch (stmt.type) {
      case "SELECT":
        return {
          ...stmt,
          where: stmt.where ? this.foldExpression(stmt.where) : undefined,
          fields: stmt.fields.map((field) => ({
            ...field,
            expression: field.expression ? this.foldExpression(field.expression) : undefined,
          })),
        };

      case "NAVIGATE":
        return {
          ...stmt,
          url: this.foldExpression(stmt.url),
          capture: stmt.capture
            ? {
              ...stmt.capture,
              fields: stmt.capture.fields.map((field) => ({
                ...field,
                expression: field.expression ? this.foldExpression(field.expression) : undefined,
              })),
            }
            : undefined,
        };

      case "SET":
        return {
          ...stmt,
          value: this.foldExpression(stmt.value),
        };

      case "FOR":
        return {
          ...stmt,
          collection: this.foldExpression(stmt.collection),
          body: this.foldStatement(stmt.body),
        };

      case "IF":
        return {
          ...stmt,
          condition: this.foldExpression(stmt.condition),
          thenBranch: this.foldStatement(stmt.thenBranch),
          elseBranch: stmt.elseBranch ? this.foldStatement(stmt.elseBranch) : undefined,
        };

      case "INSERT":
        return {
          ...stmt,
          value: this.foldExpression(stmt.value),
          target: this.foldExpression(stmt.target),
        };

      case "UPDATE":
        return {
          ...stmt,
          target: this.foldExpression(stmt.target),
          assignments: stmt.assignments.map((a) => ({
            ...a,
            value: this.foldExpression(a.value),
          })),
        };

      case "DELETE":
        return {
          ...stmt,
          target: this.foldExpression(stmt.target),
        };

      case "WITH":
        return {
          ...stmt,
          ctes: stmt.ctes.map((cte) => ({
            ...cte,
            query: this.foldStatement(cte.query),
          })),
          query: this.foldStatement(stmt.query),
        };

      default:
        return stmt;
    }
  }

  /**
   * Fold an expression
   */
  private foldExpression(expr: Expression): Expression {
    switch (expr.type) {
      case "BINARY":
        return this.foldBinary(expr as BinaryExpression);
      case "UNARY":
        return this.foldUnary(expr as UnaryExpression);
      case "ARRAY":
        return this.foldArray(expr as ArrayExpression);
      case "OBJECT":
        return this.foldObject(expr as ObjectExpression);
      case "CALL":
        return {
          ...expr,
          arguments: expr.arguments.map((arg) => this.foldExpression(arg)),
        };
      case "MEMBER":
        return {
          ...expr,
          object: this.foldExpression(expr.object),
        };
      default:
        return expr;
    }
  }

  /**
   * Fold binary expression
   */
  private foldBinary(expr: BinaryExpression): Expression {
    const left = this.foldExpression(expr.left);
    const right = this.foldExpression(expr.right);

    // Both operands must be literals to fold
    if (left.type !== "LITERAL" || right.type !== "LITERAL") {
      return { ...expr, left, right };
    }

    const leftLit = left as Literal;
    const rightLit = right as Literal;

    try {
      // Arithmetic operators
      if (leftLit.dataType === DataType.NUMBER && rightLit.dataType === DataType.NUMBER) {
        const leftVal = leftLit.value as number;
        const rightVal = rightLit.value as number;

        switch (expr.operator) {
          case "+":
            return this.createNumberLiteral(leftVal + rightVal);
          case "-":
            return this.createNumberLiteral(leftVal - rightVal);
          case "*":
            return this.createNumberLiteral(leftVal * rightVal);
          case "/":
            if (rightVal === 0) break; // Don't fold division by zero
            return this.createNumberLiteral(leftVal / rightVal);
          case "%":
            if (rightVal === 0) break;
            return this.createNumberLiteral(leftVal % rightVal);
          case ">":
            return this.createBooleanLiteral(leftVal > rightVal);
          case ">=":
            return this.createBooleanLiteral(leftVal >= rightVal);
          case "<":
            return this.createBooleanLiteral(leftVal < rightVal);
          case "<=":
            return this.createBooleanLiteral(leftVal <= rightVal);
          case "=":
            return this.createBooleanLiteral(leftVal === rightVal);
          case "!=":
            return this.createBooleanLiteral(leftVal !== rightVal);
        }
      }

      // String operators
      if (leftLit.dataType === DataType.STRING && rightLit.dataType === DataType.STRING) {
        const leftVal = leftLit.value as string;
        const rightVal = rightLit.value as string;

        switch (expr.operator) {
          case "+":
          case "||":
            return this.createStringLiteral(leftVal + rightVal);
          case "=":
            return this.createBooleanLiteral(leftVal === rightVal);
          case "!=":
            return this.createBooleanLiteral(leftVal !== rightVal);
          case "LIKE":
            // Simple LIKE implementation
            const pattern = rightVal.replace(/%/g, ".*").replace(/_/g, ".");
            return this.createBooleanLiteral(new RegExp(`^${pattern}$`).test(leftVal));
        }
      }

      // Boolean operators
      if (leftLit.dataType === DataType.BOOLEAN && rightLit.dataType === DataType.BOOLEAN) {
        const leftVal = leftLit.value as boolean;
        const rightVal = rightLit.value as boolean;

        switch (expr.operator) {
          case "AND":
            return this.createBooleanLiteral(leftVal && rightVal);
          case "OR":
            return this.createBooleanLiteral(leftVal || rightVal);
          case "=":
            return this.createBooleanLiteral(leftVal === rightVal);
          case "!=":
            return this.createBooleanLiteral(leftVal !== rightVal);
        }
      }

      // Equality for any type
      switch (expr.operator) {
        case "=":
          return this.createBooleanLiteral(leftLit.value === rightLit.value);
        case "!=":
          return this.createBooleanLiteral(leftLit.value !== rightLit.value);
      }
    } catch (_error) {
      // If evaluation fails, return original expression
    }

    return { ...expr, left, right };
  }

  /**
   * Fold unary expression
   */
  private foldUnary(expr: UnaryExpression): Expression {
    const operand = this.foldExpression(expr.operand);

    if (operand.type !== "LITERAL") {
      return { ...expr, operand };
    }

    const literal = operand as Literal;

    try {
      switch (expr.operator) {
        case "NOT":
          if (literal.dataType === DataType.BOOLEAN) {
            return this.createBooleanLiteral(!(literal.value as boolean));
          }
          break;
        case "-":
          if (literal.dataType === DataType.NUMBER) {
            return this.createNumberLiteral(-(literal.value as number));
          }
          break;
        case "+":
          if (literal.dataType === DataType.NUMBER) {
            return this.createNumberLiteral(+(literal.value as number));
          }
          break;
      }
    } catch (_error) {
      // If evaluation fails, return original expression
    }

    return { ...expr, operand };
  }

  /**
   * Fold array expression
   */
  private foldArray(expr: ArrayExpression): Expression {
    return {
      ...expr,
      elements: expr.elements.map((el) => this.foldExpression(el)),
    };
  }

  /**
   * Fold object expression
   */
  private foldObject(expr: ObjectExpression): Expression {
    return {
      ...expr,
      properties: expr.properties.map((prop) => ({
        ...prop,
        value: this.foldExpression(prop.value),
      })),
    };
  }

  /**
   * Create a number literal
   */
  private createNumberLiteral(value: number): Literal {
    return {
      type: "LITERAL",
      dataType: DataType.NUMBER,
      value,
    };
  }

  /**
   * Create a string literal
   */
  private createStringLiteral(value: string): Literal {
    return {
      type: "LITERAL",
      dataType: DataType.STRING,
      value,
    };
  }

  /**
   * Create a boolean literal
   */
  private createBooleanLiteral(value: boolean): Literal {
    return {
      type: "LITERAL",
      dataType: DataType.BOOLEAN,
      value,
    };
  }
}
