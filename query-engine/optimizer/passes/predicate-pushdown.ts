/**
 * Predicate pushdown optimization pass
 * Pushes WHERE clauses closer to the data source
 */

import {
  BinaryExpression,
  Expression,
  SelectStatement,
  Source,
  Statement,
} from "../../types/ast.ts";

/**
 * Predicate pushdown pass
 * Moves filter conditions as close to the data source as possible
 * to reduce the amount of data processed
 */
export class PredicatePushdownPass {
  /**
   * Apply predicate pushdown to a statement
   */
  apply(stmt: Statement): Statement {
    return this.pushdownStatement(stmt);
  }

  /**
   * Push down predicates in a statement
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
   * Push down predicates in SELECT statement
   */
  private pushdownSelect(stmt: SelectStatement): SelectStatement {
    // If there's no WHERE clause, nothing to push down
    if (!stmt.where) {
      return stmt;
    }

    // If source is a subquery, try to push predicates into it
    if (stmt.source.type === "SUBQUERY") {
      const subquery = stmt.source.value as Statement;

      if (subquery.type === "SELECT") {
        const pushdownResult = this.tryPushdownToSubquery(
          subquery as SelectStatement,
          stmt.where,
        );

        return {
          ...stmt,
          source: {
            type: "SUBQUERY",
            value: pushdownResult.subquery,
          } as Source,
          where: pushdownResult.remainingPredicate,
        };
      }
    }

    return stmt;
  }

  /**
   * Try to push down predicates to a subquery
   */
  private tryPushdownToSubquery(
    subquery: SelectStatement,
    predicate: Expression,
  ): { subquery: SelectStatement; remainingPredicate: Expression | undefined } {
    // Split predicate into pushable and non-pushable parts
    const { pushable, nonPushable } = this.splitPredicate(predicate, subquery);

    if (!pushable) {
      // Nothing to push down
      return { subquery, remainingPredicate: predicate };
    }

    // Combine pushed predicate with existing WHERE clause
    const newWhere = subquery.where
      ? this.combinePredicates(pushable, subquery.where, "AND")
      : pushable;

    return {
      subquery: {
        ...subquery,
        where: newWhere,
      },
      remainingPredicate: nonPushable,
    };
  }

  /**
   * Split predicate into pushable and non-pushable parts
   */
  private splitPredicate(
    predicate: Expression,
    subquery: SelectStatement,
  ): { pushable: Expression | undefined; nonPushable: Expression | undefined } {
    // For AND expressions, try to push down each conjunct
    if (predicate.type === "BINARY" && predicate.operator === "AND") {
      const binExpr = predicate as BinaryExpression;

      const leftSplit = this.splitPredicate(binExpr.left, subquery);
      const rightSplit = this.splitPredicate(binExpr.right, subquery);

      const pushable = this.combinePredicates(leftSplit.pushable, rightSplit.pushable, "AND");
      const nonPushable = this.combinePredicates(
        leftSplit.nonPushable,
        rightSplit.nonPushable,
        "AND",
      );

      return { pushable, nonPushable };
    }

    // Check if predicate only references fields from subquery
    const referencedFields = this.extractReferencedFields(predicate);
    const subqueryFields = subquery.fields.map((f) => f.alias || f.name);

    const allFieldsInSubquery = referencedFields.every((field) => subqueryFields.includes(field));

    if (allFieldsInSubquery) {
      // Can push down
      return { pushable: predicate, nonPushable: undefined };
    } else {
      // Cannot push down
      return { pushable: undefined, nonPushable: predicate };
    }
  }

  /**
   * Extract field names referenced in an expression
   */
  private extractReferencedFields(expr: Expression): string[] {
    const fields: string[] = [];

    const walk = (e: Expression) => {
      switch (e.type) {
        case "IDENTIFIER":
          fields.push(e.name);
          break;
        case "BINARY":
          walk(e.left);
          walk(e.right);
          break;
        case "UNARY":
          walk(e.operand);
          break;
        case "MEMBER":
          walk(e.object);
          break;
        case "CALL":
          e.arguments.forEach(walk);
          break;
        case "ARRAY":
          e.elements.forEach(walk);
          break;
        case "OBJECT":
          e.properties.forEach((p) => walk(p.value));
          break;
      }
    };

    walk(expr);
    return fields;
  }

  /**
   * Combine two predicates with an operator
   */
  private combinePredicates(
    left: Expression | undefined,
    right: Expression | undefined,
    operator: "AND" | "OR",
  ): Expression | undefined {
    if (!left && !right) return undefined;
    if (!left) return right;
    if (!right) return left;

    return {
      type: "BINARY",
      operator,
      left,
      right,
    } as BinaryExpression;
  }
}
