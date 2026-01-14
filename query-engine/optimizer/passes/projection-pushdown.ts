/**
 * Projection pushdown optimization pass
 * Pushes SELECT field filtering closer to the data source
 */

import { Expression, Field, SelectStatement, Source, Statement } from "../../types/ast.ts";

/**
 * Projection pushdown pass
 * Reduces the number of fields selected in subqueries
 * to only those actually needed by parent query
 */
export class ProjectionPushdownPass {
  /**
   * Apply projection pushdown to a statement
   */
  apply(stmt: Statement): Statement {
    return this.pushdownStatement(stmt);
  }

  /**
   * Push down projections in a statement
   */
  private pushdownStatement(stmt: Statement): Statement {
    switch (stmt.type) {
      case "SELECT":
        return this.pushdownSelect(stmt as SelectStatement);

      case "WITH":
        return {
          ...stmt,
          ctes: stmt.ctes.map((cte) => ({
            ...cte,
            query: this.pushdownStatement(cte.query),
          })),
          query: this.pushdownStatement(stmt.query),
        };

      case "FOR":
        return {
          ...stmt,
          body: this.pushdownStatement(stmt.body),
        };

      case "IF":
        return {
          ...stmt,
          thenBranch: this.pushdownStatement(stmt.thenBranch),
          elseBranch: stmt.elseBranch ? this.pushdownStatement(stmt.elseBranch) : undefined,
        };

      default:
        return stmt;
    }
  }

  /**
   * Push down projections in SELECT statement
   */
  private pushdownSelect(stmt: SelectStatement): SelectStatement {
    // If selecting all fields (*), can't optimize
    if (stmt.fields.length === 1 && stmt.fields[0].name === "*") {
      return stmt;
    }

    // If source is a subquery, optimize it
    if (stmt.source.type === "SUBQUERY") {
      const subquery = stmt.source.value as Statement;

      if (subquery.type === "SELECT") {
        const requiredFields = this.extractRequiredFields(stmt);
        const optimizedSubquery = this.pruneSubqueryFields(
          subquery as SelectStatement,
          requiredFields,
        );

        return {
          ...stmt,
          source: {
            type: "SUBQUERY",
            value: optimizedSubquery,
          } as Source,
        };
      }
    }

    return stmt;
  }

  /**
   * Extract fields required by a SELECT statement
   */
  private extractRequiredFields(stmt: SelectStatement): Set<string> {
    const required = new Set<string>();

    // Add fields from SELECT clause
    for (const field of stmt.fields) {
      if (field.expression) {
        this.extractFieldsFromExpression(field.expression, required);
      } else {
        required.add(field.name);
      }
    }

    // Add fields from WHERE clause
    if (stmt.where) {
      this.extractFieldsFromExpression(stmt.where, required);
    }

    // Add fields from ORDER BY
    if (stmt.orderBy) {
      for (const order of stmt.orderBy) {
        required.add(order.field);
      }
    }

    return required;
  }

  /**
   * Extract field names from an expression
   */
  private extractFieldsFromExpression(expr: Expression, fields: Set<string>): void {
    switch (expr.type) {
      case "IDENTIFIER":
        fields.add(expr.name);
        break;

      case "BINARY":
        this.extractFieldsFromExpression(expr.left, fields);
        this.extractFieldsFromExpression(expr.right, fields);
        break;

      case "UNARY":
        this.extractFieldsFromExpression(expr.operand, fields);
        break;

      case "MEMBER":
        this.extractFieldsFromExpression(expr.object, fields);
        break;

      case "CALL":
        for (const arg of expr.arguments) {
          this.extractFieldsFromExpression(arg, fields);
        }
        break;

      case "ARRAY":
        for (const element of expr.elements) {
          this.extractFieldsFromExpression(element, fields);
        }
        break;

      case "OBJECT":
        for (const prop of expr.properties) {
          this.extractFieldsFromExpression(prop.value, fields);
        }
        break;
    }
  }

  /**
   * Prune unnecessary fields from a subquery
   */
  private pruneSubqueryFields(
    subquery: SelectStatement,
    requiredFields: Set<string>,
  ): SelectStatement {
    // If subquery selects all fields, can't optimize
    if (subquery.fields.length === 1 && subquery.fields[0].name === "*") {
      return subquery;
    }

    // Filter fields to only those required
    const prunedFields = subquery.fields.filter((field) => {
      const fieldName = field.alias || field.name;
      return requiredFields.has(fieldName);
    });

    // If all fields are pruned, keep at least one field
    if (prunedFields.length === 0) {
      return subquery;
    }

    return {
      ...subquery,
      fields: prunedFields,
    };
  }
}
