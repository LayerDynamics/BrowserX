/**
 * Symbol table and symbol definitions for semantic analysis
 */

import { DataType } from "../types/primitives.ts";

/**
 * Symbol types
 */
export enum SymbolType {
  VARIABLE = "VARIABLE",
  FIELD = "FIELD",
  FUNCTION = "FUNCTION",
  PARAMETER = "PARAMETER",
  CTE = "CTE", // Common Table Expression
}

/**
 * Symbol definition
 */
export interface Symbol {
  name: string;
  type: SymbolType;
  dataType: DataType;
  nullable: boolean;
  scope: SymbolScope;
  location?: SymbolLocation;
  metadata?: SymbolMetadata;
}

/**
 * Symbol scope
 */
export interface SymbolScope {
  readonly id: string;
  parent: SymbolScope | null;
  symbols: Map<string, Symbol>;
  type: ScopeType;
}

export enum ScopeType {
  GLOBAL = "GLOBAL",
  QUERY = "QUERY",
  SUBQUERY = "SUBQUERY",
  FOR_LOOP = "FOR_LOOP",
  IF_BRANCH = "IF_BRANCH",
  CTE = "CTE",
}

/**
 * Symbol location in source
 */
export interface SymbolLocation {
  line: number;
  column: number;
}

/**
 * Additional symbol metadata
 */
export interface SymbolMetadata {
  // For functions
  parameters?: DataType[];
  returnType?: DataType;

  // For fields
  path?: string[];

  // For CTEs
  query?: any;
}

/**
 * Symbol table for managing scopes and symbols
 */
export class SymbolTable {
  private currentScope: SymbolScope;
  private scopeCounter: number;

  constructor() {
    this.scopeCounter = 0;
    this.currentScope = this.createScope(ScopeType.GLOBAL, null);
  }

  /**
   * Create a new scope
   */
  createScope(type: ScopeType, parent: SymbolScope | null = null): SymbolScope {
    return {
      id: `scope_${this.scopeCounter++}`,
      parent: parent === null ? null : (parent || this.currentScope),
      symbols: new Map(),
      type,
    };
  }

  /**
   * Enter a new scope
   */
  enterScope(type: ScopeType): void {
    this.currentScope = this.createScope(type, this.currentScope);
  }

  /**
   * Exit current scope
   */
  exitScope(): void {
    if (this.currentScope.parent) {
      this.currentScope = this.currentScope.parent;
    }
  }

  /**
   * Get current scope
   */
  getCurrentScope(): SymbolScope {
    return this.currentScope;
  }

  /**
   * Define a symbol in current scope
   */
  define(symbol: Symbol): void {
    symbol.scope = this.currentScope;
    this.currentScope.symbols.set(symbol.name, symbol);
  }

  /**
   * Resolve a symbol by name (walks up scope chain)
   * Returns the symbol if found, undefined if not found in any scope
   */
  resolve(name: string): Symbol | undefined {
    let scope: SymbolScope | null = this.currentScope;

    while (scope) {
      const symbol = scope.symbols.get(name);
      if (symbol) {
        return symbol;
      }
      scope = scope.parent;
    }

    return undefined;
  }

  /**
   * Check if symbol exists in current scope only
   */
  existsInCurrentScope(name: string): boolean {
    return this.currentScope.symbols.has(name);
  }

  /**
   * Get all symbols in current scope
   */
  getSymbolsInCurrentScope(): Symbol[] {
    return Array.from(this.currentScope.symbols.values());
  }

  /**
   * Get all symbols (including parent scopes)
   */
  getAllSymbols(): Symbol[] {
    const symbols: Symbol[] = [];
    let scope: SymbolScope | null = this.currentScope;

    while (scope) {
      symbols.push(...Array.from(scope.symbols.values()));
      scope = scope.parent;
    }

    return symbols;
  }

  /**
   * Get parent scope of current scope
   */
  getParentScope(): SymbolScope | null {
    return this.currentScope.parent;
  }

  /**
   * Get scope counter (for debugging)
   */
  getScopeCounter(): number {
    return this.scopeCounter;
  }
}
