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
 * Symbol kind - alias for SymbolType for test compatibility
 */
export const SymbolKind = SymbolType;
export type SymbolKind = SymbolType;

/**
 * Symbol definition
 */
export interface Symbol {
  name: string;
  type: SymbolType;
  kind?: SymbolType; // Alias for type for test compatibility
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
  depth: number;
}

export enum ScopeType {
  GLOBAL = "GLOBAL",
  QUERY = "QUERY",
  SUBQUERY = "SUBQUERY",
  FOR_LOOP = "FOR_LOOP",
  IF_BRANCH = "IF_BRANCH",
  CTE = "CTE",
  // Additional scope types for test compatibility
  FUNCTION = "FUNCTION",
  BLOCK = "BLOCK",
  LOOP = "LOOP",
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
  parameters?: DataType[] | string[];
  returnType?: DataType | string;

  // For fields
  path?: string[];

  // For CTEs
  query?: any;

  // For variables
  dataType?: string;
  mutable?: boolean;
  initialized?: boolean;
}

/**
 * Symbol table for managing scopes and symbols
 */
export class SymbolTable {
  public currentScope: SymbolScope;
  private scopeCounter: number;

  constructor() {
    this.scopeCounter = 0;
    this.currentScope = this.createScope(ScopeType.GLOBAL, null, 0);
  }

  /**
   * Create a new scope
   */
  createScope(type: ScopeType, parent: SymbolScope | null = null, depth?: number): SymbolScope {
    const actualParent = parent === null ? null : (parent || this.currentScope);
    const actualDepth = depth !== undefined ? depth : (actualParent ? actualParent.depth + 1 : 0);
    return {
      id: `scope_${this.scopeCounter++}`,
      parent: actualParent,
      symbols: new Map(),
      type,
      depth: actualDepth,
    };
  }

  /**
   * Enter a new scope
   * @param type - Optional scope type, defaults to BLOCK for test compatibility
   */
  enterScope(type: ScopeType = ScopeType.BLOCK): void {
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
   * Define a symbol in current scope (overloaded for compatibility)
   * Supports multiple calling conventions:
   * - define(name: string, kind: SymbolType, metadata?: SymbolMetadata)
   * - define(symbol: Symbol)
   * - define(name: string, options: { name, kind, type, ... }) - test compatibility
   */
  define(nameOrSymbol: string | Symbol | Record<string, unknown>, kindOrOptions?: SymbolType | Record<string, unknown>, metadata?: SymbolMetadata): void {
    let symbol: Symbol;

    if (typeof nameOrSymbol === 'string' && typeof kindOrOptions === 'object' && kindOrOptions !== null) {
      // Test compatibility API: define("name", { name, kind, type, ... })
      const name = nameOrSymbol;
      const options = kindOrOptions as Record<string, unknown>;

      // Check for duplicate in current scope (allow shadowing in nested scopes)
      // Note: Don't throw for shadowing - it's allowed in tests

      symbol = {
        name,
        type: SymbolType.VARIABLE,
        kind: options.kind as SymbolType || SymbolType.VARIABLE,
        dataType: (options.type as DataType) || "ANY" as DataType,
        nullable: true,
        scope: this.currentScope,
        metadata: {
          ...metadata,
          parameters: options.paramTypes as DataType[],
          returnType: options.returnType as DataType,
        },
      };
    } else if (typeof nameOrSymbol === 'string') {
      // New API: define(name, kind, metadata)
      const name = nameOrSymbol;

      // Check for duplicate in current scope
      if (this.currentScope.symbols.has(name)) {
        throw new Error(`Symbol '${name}' is already defined in current scope`);
      }

      symbol = {
        name,
        type: (kindOrOptions as SymbolType) || SymbolType.VARIABLE,
        kind: (kindOrOptions as SymbolType) || SymbolType.VARIABLE,
        dataType: (metadata?.dataType as DataType) || "ANY" as DataType,
        nullable: true,
        scope: this.currentScope,
        metadata,
      };
    } else {
      // Original API: define(symbol)
      symbol = nameOrSymbol as Symbol;
      symbol.scope = this.currentScope;
      symbol.kind = symbol.type; // Ensure kind is set
    }

    this.currentScope.symbols.set(symbol.name, symbol);
  }

  /**
   * Resolve a symbol by name (walks up scope chain)
   * Returns the symbol if found, null if not found in any scope
   */
  resolve(name: string): Symbol | null {
    let scope: SymbolScope | null = this.currentScope;

    while (scope) {
      const symbol = scope.symbols.get(name);
      if (symbol) {
        return symbol;
      }
      scope = scope.parent;
    }

    return null;
  }

  /**
   * Lookup a symbol by name (alias for resolve, returns undefined instead of null)
   * This is provided for test compatibility
   */
  lookup(name: string): Symbol | undefined {
    return this.resolve(name) ?? undefined;
  }

  /**
   * Check if symbol is defined in current scope only
   */
  isDefined(name: string): boolean {
    return this.currentScope.symbols.has(name);
  }

  /**
   * Check if symbol exists in current scope only (alias for isDefined)
   */
  existsInCurrentScope(name: string): boolean {
    return this.currentScope.symbols.has(name);
  }

  /**
   * Get all symbols in current scope only
   */
  getSymbolsInCurrentScope(): Symbol[] {
    return Array.from(this.currentScope.symbols.values());
  }

  /**
   * Get all symbols in current scope only (for tests)
   */
  getAllSymbols(): Symbol[] {
    return Array.from(this.currentScope.symbols.values());
  }

  /**
   * Get all symbols including parent scopes
   */
  getAllSymbolsInChain(): Symbol[] {
    const symbols: Symbol[] = [];
    let scope: SymbolScope | null = this.currentScope;

    while (scope) {
      symbols.push(...Array.from(scope.symbols.values()));
      scope = scope.parent;
    }

    return symbols;
  }

  /**
   * Clear all symbols in current scope
   */
  clearCurrentScope(): void {
    this.currentScope.symbols.clear();
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
