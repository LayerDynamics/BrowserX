/**
 * Parallel execution detection pass
 * Identifies independent operations that can be executed in parallel
 */

import {
  Expression,
  ForStatement,
  SelectStatement,
  Statement,
  WithStatement,
} from "../../types/ast.ts";

/**
 * Parallel execution opportunity
 */
export interface ParallelGroup {
  statements: Statement[];
  dependencies: string[]; // Variable names this group depends on
  produces: string[]; // Variable names this group produces
}

/**
 * Parallel detection pass
 * Analyzes queries to find independent operations
 */
export class ParallelDetectionPass {
  private parallelGroups: ParallelGroup[];

  constructor() {
    this.parallelGroups = [];
  }

  /**
   * Apply parallel detection to a statement
   */
  apply(stmt: Statement): Statement {
    this.detectParallelism(stmt);
    return stmt;
  }

  /**
   * Detect parallelism in a statement
   */
  private detectParallelism(stmt: Statement): void {
    switch (stmt.type) {
      case "WITH":
        this.detectWithParallelism(stmt as WithStatement);
        break;

      case "FOR":
        this.detectForParallelism(stmt as ForStatement);
        break;

      case "SELECT":
        // Check if subquery can be parallelized
        const selectStmt = stmt as SelectStatement;
        if (selectStmt.source.type === "SUBQUERY") {
          this.detectParallelism(selectStmt.source.value as Statement);
        }
        break;
    }
  }

  /**
   * Detect parallelism in WITH (CTE) statements
   */
  private detectWithParallelism(stmt: WithStatement): void {
    // Analyze dependencies and production for each CTE
    const cteInfos = stmt.ctes.map((cte) => ({
      cte,
      dependencies: this.extractDependencies(cte.query),
      produces: [cte.name],
    }));

    // Analyze dependencies in main query
    const queryDependencies = this.extractDependencies(stmt.query);
    const queryProduces = this.extractProducedVariables(stmt.query);

    // Find CTEs that can run in parallel (no dependencies on each other or main query)
    for (let i = 0; i < cteInfos.length; i++) {
      for (let j = i + 1; j < cteInfos.length; j++) {
        const cte1 = cteInfos[i];
        const cte2 = cteInfos[j];

        const hasDependency = cte1.dependencies.some((dep) => cte2.produces.includes(dep)) ||
          cte2.dependencies.some((dep) => cte1.produces.includes(dep));

        if (!hasDependency) {
          this.parallelGroups.push({
            statements: [cte1.cte.query, cte2.cte.query],
            dependencies: cte1.dependencies.concat(cte2.dependencies),
            produces: cte1.produces.concat(cte2.produces),
          });
        }
      }
    }

    // Recursively analyze each CTE query and main query
    stmt.ctes.forEach((cte) => this.detectParallelism(cte.query));
    this.detectParallelism(stmt.query);
  }

  /**
   * Detect parallelism in FOR loops
   */
  private detectForParallelism(stmt: ForStatement): void {
    // Check if loop body has no dependencies between iterations
    const bodyDependencies = this.extractDependencies(stmt.body);
    const loopVariable = stmt.variable;

    // If body only depends on loop variable, iterations can be parallel
    const hasCrossDependencies = bodyDependencies.some(
      (dep) => dep !== loopVariable,
    );

    if (!hasCrossDependencies) {
      // Mark as parallelizable loop
      this.parallelGroups.push({
        statements: [stmt.body],
        dependencies: [loopVariable],
        produces: this.extractProducedVariables(stmt.body),
      });
    }

    // Recursively analyze body
    this.detectParallelism(stmt.body);
  }

  /**
   * Extract variable dependencies from a statement
   */
  private extractDependencies(stmt: Statement): string[] {
    const dependencies = new Set<string>();

    const extractFromExpr = (expr: Expression) => {
      switch (expr.type) {
        case "IDENTIFIER":
          dependencies.add(expr.name);
          break;

        case "BINARY":
          extractFromExpr(expr.left);
          extractFromExpr(expr.right);
          break;

        case "UNARY":
          extractFromExpr(expr.operand);
          break;

        case "MEMBER":
          extractFromExpr(expr.object);
          break;

        case "CALL":
          expr.arguments.forEach(extractFromExpr);
          break;

        case "ARRAY":
          expr.elements.forEach(extractFromExpr);
          break;

        case "OBJECT":
          expr.properties.forEach((p) => extractFromExpr(p.value));
          break;
      }
    };

    switch (stmt.type) {
      case "SELECT":
        const selectStmt = stmt as SelectStatement;

        if (selectStmt.where) {
          extractFromExpr(selectStmt.where);
        }

        for (const field of selectStmt.fields) {
          if (field.expression) {
            extractFromExpr(field.expression);
          }
        }

        if (selectStmt.source.type === "VARIABLE") {
          dependencies.add(selectStmt.source.value as string);
        }
        break;

      case "SET":
        extractFromExpr(stmt.value);
        break;

      case "FOR":
        extractFromExpr(stmt.collection);
        break;

      case "IF":
        extractFromExpr(stmt.condition);
        break;

      case "NAVIGATE":
        extractFromExpr(stmt.url);
        break;

      case "INSERT":
        extractFromExpr(stmt.value);
        extractFromExpr(stmt.target);
        break;

      case "UPDATE":
        extractFromExpr(stmt.target);
        stmt.assignments.forEach((a) => extractFromExpr(a.value));
        break;

      case "DELETE":
        extractFromExpr(stmt.target);
        break;
    }

    return Array.from(dependencies);
  }

  /**
   * Extract variables produced by a statement
   */
  private extractProducedVariables(stmt: Statement): string[] {
    const produced: string[] = [];

    switch (stmt.type) {
      case "SET":
        produced.push(stmt.path.join("."));
        break;

      case "WITH":
        stmt.ctes.forEach((cte) => {
          produced.push(cte.name);
          produced.push(...this.extractProducedVariables(cte.query));
        });
        produced.push(...this.extractProducedVariables(stmt.query));
        break;

      case "FOR":
        produced.push(stmt.variable);
        produced.push(...this.extractProducedVariables(stmt.body));
        break;

      case "IF":
        produced.push(...this.extractProducedVariables(stmt.thenBranch));
        if (stmt.elseBranch) {
          produced.push(...this.extractProducedVariables(stmt.elseBranch));
        }
        break;
    }

    return produced;
  }

  /**
   * Get detected parallel groups
   */
  getParallelGroups(): ParallelGroup[] {
    return this.parallelGroups;
  }

  /**
   * Check if two statements can run in parallel
   */
  canRunInParallel(stmt1: Statement, stmt2: Statement): boolean {
    const deps1 = this.extractDependencies(stmt1);
    const produces1 = this.extractProducedVariables(stmt1);

    const deps2 = this.extractDependencies(stmt2);
    const produces2 = this.extractProducedVariables(stmt2);

    // Check if stmt2 depends on what stmt1 produces
    const hasForwardDependency = deps2.some((dep) => produces1.includes(dep));

    // Check if stmt1 depends on what stmt2 produces
    const hasBackwardDependency = deps1.some((dep) => produces2.includes(dep));

    // Can run in parallel if no dependencies between them
    return !hasForwardDependency && !hasBackwardDependency;
  }
}
