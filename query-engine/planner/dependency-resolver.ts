/**
 * Dependency resolver for query execution
 * Tracks and resolves dependencies between statements and variables
 */

import type { Statement, Expression } from "../types/ast.ts";
import {
  DiGraph,
  GraphNode,
  GraphEdge,
  topologicalSort as graphxTopoSort,
} from "@browserx/graphx";

/**
 * Dependency information for a statement or expression
 */
export interface Dependency {
  id: string;
  requires: Set<string>; // IDs of dependencies this item needs
  provides: Set<string>; // Variable names this item provides
}

/**
 * Dependency graph resolution result
 */
export interface ResolutionResult {
  ordered: string[]; // Topologically sorted IDs
  cycles: string[][]; // Detected circular dependencies
  unresolved: string[]; // Dependencies that cannot be satisfied
}

/**
 * DependencyResolver analyzes and resolves dependencies between statements
 */
export class DependencyResolver {
  private dependencies: Map<string, Dependency>;
  private variableProviders: Map<string, string>; // variable name -> provider ID

  constructor() {
    this.dependencies = new Map();
    this.variableProviders = new Map();
  }

  /**
   * Add a dependency entry
   */
  addDependency(id: string, requires: string[], provides: string[]): void {
    const dep: Dependency = {
      id,
      requires: new Set(requires),
      provides: new Set(provides),
    };

    this.dependencies.set(id, dep);

    // Track which ID provides each variable
    for (const variable of provides) {
      this.variableProviders.set(variable, id);
    }
  }

  /**
   * Analyze a statement to extract its dependencies
   */
  analyzeStatement(stmt: Statement, id: string): void {
    const requires: string[] = [];
    const provides: string[] = [];

    // Extract variables used by this statement
    const usedVars = this.extractUsedVariables(stmt);
    for (const varName of usedVars) {
      const providerId = this.variableProviders.get(varName);
      if (providerId) {
        requires.push(providerId);
      }
    }

    // Extract variables provided by this statement
    switch (stmt.type) {
      case "SET":
        provides.push(stmt.path[0]); // First element of path is the variable name
        break;
      case "SELECT":
        // SELECT statements can be assigned to variables in WITH clauses
        provides.push(`__result_${id}`);
        break;
      case "WITH":
        // CTEs provide named results
        for (const cte of stmt.ctes) {
          provides.push(cte.name);
        }
        break;
    }

    this.addDependency(id, requires, provides);
  }

  /**
   * Extract all variable references from a statement
   */
  private extractUsedVariables(stmt: Statement): Set<string> {
    const vars = new Set<string>();

    const visitExpression = (expr: Expression): void => {
      switch (expr.type) {
        case "IDENTIFIER":
          vars.add(expr.name);
          break;
        case "BINARY":
          visitExpression(expr.left);
          visitExpression(expr.right);
          break;
        case "UNARY":
          visitExpression(expr.operand);
          break;
        case "CALL":
          for (const arg of expr.arguments) {
            visitExpression(arg);
          }
          break;
        case "MEMBER":
          visitExpression(expr.object);
          break;
        case "ARRAY":
          for (const elem of expr.elements) {
            visitExpression(elem);
          }
          break;
        case "OBJECT":
          for (const prop of expr.properties) {
            visitExpression(prop.value);
          }
          break;
      }
    };

    const visitStatement = (s: Statement): void => {
      switch (s.type) {
        case "SELECT":
          if (s.source.type === "VARIABLE") {
            vars.add(s.source.value as string);
          }
          if (s.where) visitExpression(s.where);
          for (const field of s.fields) {
            if (field.expression) visitExpression(field.expression);
          }
          break;
        case "SET":
          visitExpression(s.value);
          break;
        case "FOR":
          visitExpression(s.collection);
          visitStatement(s.body);
          break;
        case "IF":
          visitExpression(s.condition);
          visitStatement(s.then);
          if (s.else) visitStatement(s.else);
          break;
        case "WITH":
          for (const cte of s.ctes) {
            visitStatement(cte.query);
          }
          visitStatement(s.query);
          break;
        case "NAVIGATE":
          visitExpression(s.url);
          break;
        case "INSERT":
          visitExpression(s.value);
          visitExpression(s.target);
          break;
        case "UPDATE":
          visitExpression(s.target);
          for (const assign of s.assignments) {
            visitExpression(assign.value);
          }
          break;
        case "DELETE":
          visitExpression(s.target);
          break;
      }
    };

    visitStatement(stmt);
    return vars;
  }

  /**
   * Resolve dependencies and return topologically sorted order
   */
  resolve(): ResolutionResult {
    const cycles: string[][] = [];
    const unresolved: string[] = [];

    // Check for unresolved dependencies first
    for (const dep of this.dependencies.values()) {
      for (const reqId of dep.requires) {
        if (!this.dependencies.has(reqId)) {
          if (!unresolved.includes(reqId)) {
            unresolved.push(reqId);
          }
        }
      }
    }

    // Build a DiGraph from the dependencies
    const digraph = new DiGraph<Dependency, void>();
    for (const [id, dep] of this.dependencies) {
      digraph.addNode(new GraphNode(id, dep, id));
    }
    for (const [id, dep] of this.dependencies) {
      for (const reqId of dep.requires) {
        if (this.dependencies.has(reqId)) {
          digraph.addEdge(new GraphEdge(`${reqId}->${id}`, reqId, id));
        }
      }
    }

    // Use GraphX topological sort
    const result = graphxTopoSort(digraph);

    if (result.hasCycle) {
      // Detect cycle paths using DFS for detailed reporting
      const visited = new Set<string>();
      const visiting = new Set<string>();

      const detectCycles = (id: string, path: string[]): void => {
        if (visited.has(id)) return;
        if (visiting.has(id)) {
          const cycleStart = path.indexOf(id);
          if (cycleStart >= 0) {
            cycles.push([...path.slice(cycleStart), id]);
          }
          return;
        }
        visiting.add(id);
        path.push(id);
        const dep = this.dependencies.get(id);
        if (dep) {
          for (const reqId of dep.requires) {
            if (this.dependencies.has(reqId)) {
              detectCycles(reqId, [...path]);
            }
          }
        }
        visiting.delete(id);
        visited.add(id);
      };

      for (const id of this.dependencies.keys()) {
        if (!visited.has(id)) {
          detectCycles(id, []);
        }
      }
    }

    return { ordered: result.order, cycles, unresolved };
  }

  /**
   * Check if a variable is provided by any statement
   */
  hasProvider(variable: string): boolean {
    return this.variableProviders.has(variable);
  }

  /**
   * Get the ID of the statement that provides a variable
   */
  getProvider(variable: string): string | undefined {
    return this.variableProviders.get(variable);
  }

  /**
   * Get all dependencies for a given ID
   */
  getDependencies(id: string): Dependency | undefined {
    return this.dependencies.get(id);
  }

  /**
   * Clear all tracked dependencies
   */
  clear(): void {
    this.dependencies.clear();
    this.variableProviders.clear();
  }

  /**
   * Get the number of tracked dependencies
   */
  size(): number {
    return this.dependencies.size;
  }
}
