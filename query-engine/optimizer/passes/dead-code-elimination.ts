/**
 * Dead code elimination optimization pass
 * Removes unreachable code and unused statements
 */

import { Expression, ForStatement, IfStatement, Literal, Statement } from "../../types/ast.ts";
import { DataType } from "../../types/primitives.ts";

/**
 * Dead code elimination pass
 * Removes code that will never execute
 */
export class DeadCodeEliminationPass {
  /**
   * Apply dead code elimination to a statement
   */
  apply(stmt: Statement): Statement | null {
    return this.eliminateStatement(stmt);
  }

  /**
   * Eliminate dead code from a statement
   */
  private eliminateStatement(stmt: Statement): Statement | null {
    switch (stmt.type) {
      case "IF":
        return this.eliminateIf(stmt as IfStatement);

      case "FOR":
        return this.eliminateFor(stmt as ForStatement);

      case "WITH":
        const ctes = stmt.ctes.map((cte) => ({
          ...cte,
          query: this.eliminateStatement(cte.query),
        })).filter((cte) => cte.query !== null);
        const query = this.eliminateStatement(stmt.query);
        if (!query || ctes.length === 0) return null;
        return {
          ...stmt,
          ctes: ctes as typeof stmt.ctes,
          query,
        };

      default:
        return stmt;
    }
  }

  /**
   * Eliminate dead code from IF statement
   */
  private eliminateIf(stmt: IfStatement): Statement | null {
    const condition = stmt.condition;

    // If condition is a constant literal, we can eliminate one branch
    if (condition.type === "LITERAL") {
      const literal = condition as Literal;

      if (literal.dataType === DataType.BOOLEAN) {
        const value = literal.value as boolean;

        if (value) {
          // Condition is always true, take then branch
          return this.eliminateStatement(stmt.thenBranch);
        } else {
          // Condition is always false, take else branch
          if (stmt.elseBranch) {
            return this.eliminateStatement(stmt.elseBranch);
          } else {
            // No else branch and condition is false = dead code
            return null;
          }
        }
      }
    }

    // Condition is not constant, keep both branches but eliminate within them
    const thenBranch = this.eliminateStatement(stmt.thenBranch);
    const elseBranch = stmt.elseBranch ? this.eliminateStatement(stmt.elseBranch) : undefined;

    // If then branch is eliminated but else exists, invert the condition
    if (!thenBranch && elseBranch) {
      return {
        ...stmt,
        condition: this.invertCondition(condition),
        thenBranch: elseBranch,
        elseBranch: undefined,
      };
    }

    // If both branches are eliminated, the whole IF is dead
    if (!thenBranch && !elseBranch) {
      return null;
    }

    return {
      ...stmt,
      thenBranch: thenBranch || this.createNoOp(),
      elseBranch: elseBranch || undefined,
    };
  }

  /**
   * Eliminate dead code from FOR loop
   */
  private eliminateFor(stmt: ForStatement): Statement | null {
    const collection = stmt.collection;

    // If collection is empty array literal, loop will never execute
    if (collection.type === "ARRAY" && collection.elements.length === 0) {
      return null;
    }

    // Eliminate dead code within body
    const body = this.eliminateStatement(stmt.body);

    if (!body) {
      // If body is entirely eliminated, keep the FOR as it might have side effects
      // from collection evaluation, but with a no-op body
      return {
        ...stmt,
        body: this.createNoOp(),
      };
    }

    return {
      ...stmt,
      body,
    };
  }

  /**
   * Invert a boolean condition
   */
  private invertCondition(condition: Expression): Expression {
    // If already a NOT, remove it
    if (condition.type === "UNARY" && condition.operator === "NOT") {
      return condition.operand;
    }

    // Otherwise, wrap in NOT
    return {
      type: "UNARY",
      operator: "NOT",
      operand: condition,
    };
  }

  /**
   * Create a no-op statement
   */
  private createNoOp(): Statement {
    return {
      type: "SHOW",
      target: "METRICS",
    };
  }
}
