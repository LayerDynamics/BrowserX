/**
 * Variable scope implementation with lexical parent chains
 * Supports variable shadowing, scope nesting, and scope chain lookup
 */

import type { ScopeID } from "./types.ts";

/**
 * Variable scope with parent chain for lexical scoping
 *
 * Example:
 * ```
 * global: { x: 1, y: 2 }
 *   ↓
 * loop: { x: 10, z: 3 }  // shadows x from parent
 *   ↓
 * nested: { w: 4 }       // inherits x, y, z from parents
 * ```
 */
export class VariableScope {
  private readonly id: ScopeID;
  private readonly parent: VariableScope | null;
  private readonly variables: Map<string, unknown>;
  private readonly children: Set<VariableScope>;

  constructor(parent: VariableScope | null = null, id?: ScopeID) {
    this.id = id || crypto.randomUUID();
    this.parent = parent;
    this.variables = new Map();
    this.children = new Set();

    if (parent) {
      parent.children.add(this);
    }
  }

  /**
   * Get scope ID
   */
  getId(): ScopeID {
    return this.id;
  }

  /**
   * Get parent scope
   */
  getParent(): VariableScope | null {
    return this.parent;
  }

  /**
   * Check if this is the root (global) scope
   */
  isRoot(): boolean {
    return this.parent === null;
  }

  /**
   * Get variable from this scope or parent chain
   * Searches up the scope chain until found or reaches root
   */
  get(name: string): unknown {
    // Check current scope first
    if (this.variables.has(name)) {
      return this.variables.get(name);
    }

    // Search parent chain
    if (this.parent) {
      return this.parent.get(name);
    }

    // Not found in any scope
    return undefined;
  }

  /**
   * Check if variable exists in this scope or parent chain
   */
  has(name: string): boolean {
    return this.variables.has(name) || (this.parent?.has(name) ?? false);
  }

  /**
   * Check if variable exists in this scope only (not parent chain)
   */
  hasOwn(name: string): boolean {
    return this.variables.has(name);
  }

  /**
   * Set variable in current scope (creates or shadows)
   * This enables variable shadowing in nested scopes
   */
  set(name: string, value: unknown): void {
    this.variables.set(name, value);
  }

  /**
   * Update variable where it's defined in scope chain
   * If not found anywhere, sets in current scope
   *
   * This is useful for updating loop counters that might be
   * defined in parent scope
   */
  update(name: string, value: unknown): void {
    // Check if defined in current scope
    if (this.variables.has(name)) {
      this.variables.set(name, value);
      return;
    }

    // Check if defined in parent chain
    if (this.parent?.has(name)) {
      this.parent.update(name, value);
      return;
    }

    // Not found anywhere, set in current scope
    this.variables.set(name, value);
  }

  /**
   * Delete variable from current scope only
   * Does not affect parent scopes
   */
  delete(name: string): boolean {
    return this.variables.delete(name);
  }

  /**
   * Get all variables in current scope only (not parent chain)
   */
  getOwnVariables(): Map<string, unknown> {
    return new Map(this.variables);
  }

  /**
   * Get all variables including parent chain
   * Parent variables are overridden by child variables
   */
  getAllVariables(): Map<string, unknown> {
    const allVars = new Map<string, unknown>();

    // Start from root and work down to current scope
    // This ensures child scopes override parent values
    const scopes: VariableScope[] = [];
    let current: VariableScope | null = this;
    while (current) {
      scopes.unshift(current);
      current = current.parent;
    }

    // Merge variables from root to current
    for (const scope of scopes) {
      for (const [name, value] of scope.variables) {
        allVars.set(name, value);
      }
    }

    return allVars;
  }

  /**
   * Get all variable names in scope chain
   */
  getVariableNames(): string[] {
    const names = new Set<string>();

    // Add own variables
    for (const name of this.variables.keys()) {
      names.add(name);
    }

    // Add parent variables
    if (this.parent) {
      for (const name of this.parent.getVariableNames()) {
        names.add(name);
      }
    }

    return Array.from(names);
  }

  /**
   * Get scope depth (distance from root)
   * Root scope has depth 0
   */
  getDepth(): number {
    let depth = 0;
    let current = this.parent;
    while (current) {
      depth++;
      current = current.parent;
    }
    return depth;
  }

  /**
   * Create child scope
   */
  createChild(id?: ScopeID): VariableScope {
    return new VariableScope(this, id);
  }

  /**
   * Get all child scopes
   */
  getChildren(): VariableScope[] {
    return Array.from(this.children);
  }

  /**
   * Clear all variables in current scope
   * Does not affect parent or child scopes
   */
  clear(): void {
    this.variables.clear();
  }

  /**
   * Get scope chain as array from root to current
   */
  getScopeChain(): VariableScope[] {
    const chain: VariableScope[] = [];
    let current: VariableScope | null = this;
    while (current) {
      chain.unshift(current);
      current = current.parent;
    }
    return chain;
  }

  /**
   * Get root scope
   */
  getRoot(): VariableScope {
    let current: VariableScope = this;
    while (current.parent) {
      current = current.parent;
    }
    return current;
  }

  /**
   * Find scope that defines a variable
   * Returns null if not found
   */
  findDefiningScope(name: string): VariableScope | null {
    if (this.variables.has(name)) {
      return this;
    }

    if (this.parent) {
      return this.parent.findDefiningScope(name);
    }

    return null;
  }

  /**
   * Export scope state for debugging
   */
  toJSON(): object {
    return {
      id: this.id,
      depth: this.getDepth(),
      isRoot: this.isRoot(),
      variables: Object.fromEntries(this.variables),
      childCount: this.children.size,
      parentId: this.parent?.getId() || null,
    };
  }

  /**
   * Create string representation for debugging
   */
  toString(): string {
    const indent = "  ".repeat(this.getDepth());
    const vars = Array.from(this.variables.entries())
      .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
      .join(", ");
    return `${indent}Scope[${this.id.slice(0, 8)}]: {${vars}}`;
  }

  /**
   * Print scope tree for debugging
   */
  printTree(): string {
    const lines: string[] = [this.toString()];
    for (const child of this.children) {
      lines.push(child.printTree());
    }
    return lines.join("\n");
  }
}
