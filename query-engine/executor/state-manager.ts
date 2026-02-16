// state-manager.ts - State management for query execution

/**
 * State snapshot for rollback
 */
export interface StateSnapshot {
  id: string;
  timestamp: number;
  state: Map<string, unknown>;
}

/**
 * Transaction context for isolated state changes
 */
interface TransactionContext {
  id: string;
  state: Map<string, unknown>;
  parent?: TransactionContext;
}

/**
 * State manager for managing execution state
 */
export class StateManager {
  private state: Map<string, unknown>;
  private snapshots: StateSnapshot[];
  private snapshotIdCounter: number;
  private transactionStack: TransactionContext[];
  private transactionIdCounter: number;

  constructor() {
    this.state = new Map();
    this.snapshots = [];
    this.snapshotIdCounter = 0;
    this.transactionStack = [];
    this.transactionIdCounter = 0;
  }

  /**
   * Set a state value
   */
  set(key: string, value: unknown): void {
    const targetState = this.getCurrentState();
    targetState.set(key, value);
  }

  /**
   * Get a state value
   */
  get(key: string): unknown {
    const targetState = this.getCurrentState();
    return targetState.get(key);
  }

  /**
   * Set multiple state values at once
   */
  setState(values: Record<string, unknown>): void {
    for (const [key, value] of Object.entries(values)) {
      this.set(key, value);
    }
  }

  /**
   * Check if key exists
   */
  has(key: string): boolean {
    const targetState = this.getCurrentState();
    return targetState.has(key);
  }

  /**
   * Delete a state value
   */
  delete(key: string): boolean {
    const targetState = this.getCurrentState();
    return targetState.delete(key);
  }

  /**
   * Get all state
   */
  getAll(): Record<string, unknown> {
    const targetState = this.getCurrentState();
    return Object.fromEntries(targetState);
  }

  /**
   * Clear all state
   */
  clear(): void {
    const targetState = this.getCurrentState();
    targetState.clear();
  }

  /**
   * Get current state (transaction or main state)
   */
  private getCurrentState(): Map<string, unknown> {
    if (this.transactionStack.length > 0) {
      return this.transactionStack[this.transactionStack.length - 1].state;
    }
    return this.state;
  }

  /**
   * Create a snapshot of current state
   */
  createSnapshot(): string {
    const id = 'snapshot-' + this.snapshotIdCounter++;
    const snapshot: StateSnapshot = {
      id,
      timestamp: Date.now(),
      state: this.deepClone(this.state)
    };
    this.snapshots.push(snapshot);
    return id;
  }

  /**
   * Restore state from a snapshot
   */
  restoreSnapshot(id: string): boolean {
    const snapshot = this.snapshots.find(s => s.id === id);
    if (!snapshot) {
      return false;
    }

    // If in transaction, restore to transaction state
    if (this.transactionStack.length > 0) {
      this.transactionStack[this.transactionStack.length - 1].state = this.deepClone(snapshot.state);
    } else {
      // Otherwise restore to main state
      this.state = this.deepClone(snapshot.state);
    }
    return true;
  }

  /**
   * Delete a snapshot
   */
  deleteSnapshot(id: string): boolean {
    const index = this.snapshots.findIndex(s => s.id === id);
    if (index === -1) {
      return false;
    }
    this.snapshots.splice(index, 1);
    return true;
  }

  /**
   * Get all snapshots
   */
  getSnapshots(): StateSnapshot[] {
    return [...this.snapshots];
  }

  /**
   * Clear all snapshots
   */
  clearSnapshots(): void {
    this.snapshots = [];
  }

  /**
   * Rollback to most recent snapshot
   */
  rollback(): boolean {
    if (this.snapshots.length === 0) {
      return false;
    }
    const lastSnapshot = this.snapshots[this.snapshots.length - 1];

    // Transaction-aware: restore to active transaction or main state
    if (this.transactionStack.length > 0) {
      this.transactionStack[this.transactionStack.length - 1].state = this.deepClone(lastSnapshot.state);
    } else {
      this.state = this.deepClone(lastSnapshot.state);
    }

    this.snapshots.pop();
    return true;
  }

  /**
   * Begin a new transaction
   */
  beginTransaction(): string {
    const id = 'transaction-' + this.transactionIdCounter++;
    const parent = this.transactionStack.length > 0
      ? this.transactionStack[this.transactionStack.length - 1]
      : undefined;

    const transaction: TransactionContext = {
      id,
      state: this.deepClone(this.getCurrentState()),
      parent
    };

    this.transactionStack.push(transaction);
    return id;
  }

  /**
   * Commit current transaction
   */
  commitTransaction(): boolean {
    if (this.transactionStack.length === 0) {
      return false;
    }

    const transaction = this.transactionStack.pop()!;

    if (this.transactionStack.length === 0) {
      // Top-level transaction - commit to main state
      this.state = transaction.state;
    } else {
      // Nested transaction - commit to parent transaction
      this.transactionStack[this.transactionStack.length - 1].state = transaction.state;
    }

    return true;
  }

  /**
   * Rollback current transaction
   */
  rollbackTransaction(): boolean {
    if (this.transactionStack.length === 0) {
      return false;
    }

    // Simply pop the transaction, discarding changes
    this.transactionStack.pop();
    return true;
  }

  /**
   * Check if currently in a transaction
   */
  inTransaction(): boolean {
    return this.transactionStack.length > 0;
  }

  /**
   * Get current transaction depth
   */
  getTransactionDepth(): number {
    return this.transactionStack.length;
  }

  /**
   * Deep clone a Map, handling circular references
   */
  private deepClone(source: Map<string, unknown>): Map<string, unknown> {
    const cache = new WeakMap<object, unknown>();
    const result = new Map<string, unknown>();

    for (const [key, value] of source) {
      result.set(key, this.deepCloneValue(value, cache));
    }

    return result;
  }

  /**
   * Deep clone a value (handles objects, arrays, primitives, and circular references)
   */
  private deepCloneValue(value: unknown, cache: WeakMap<object, unknown>): unknown {
    // Handle primitives, null, and undefined
    if (value === null || typeof value !== 'object') {
      return value;
    }

    // Handle circular references
    if (cache.has(value)) {
      return cache.get(value);
    }

    // Handle Date
    if (value instanceof Date) {
      const cloned = new Date(value.getTime());
      cache.set(value, cloned);
      return cloned;
    }

    // Handle RegExp
    if (value instanceof RegExp) {
      const cloned = new RegExp(value.source, value.flags);
      cache.set(value, cloned);
      return cloned;
    }

    // Handle Map
    if (value instanceof Map) {
      const cloned = new Map();
      cache.set(value, cloned);
      for (const [k, v] of value) {
        cloned.set(k, this.deepCloneValue(v, cache));
      }
      return cloned;
    }

    // Handle Set
    if (value instanceof Set) {
      const cloned = new Set();
      cache.set(value, cloned);
      for (const item of value) {
        cloned.add(this.deepCloneValue(item, cache));
      }
      return cloned;
    }

    // Handle Array
    if (Array.isArray(value)) {
      const cloned: unknown[] = [];
      cache.set(value, cloned);
      for (let i = 0; i < value.length; i++) {
        cloned[i] = this.deepCloneValue(value[i], cache);
      }
      return cloned;
    }

    // Handle plain objects
    const cloned: Record<string, unknown> = {};
    cache.set(value, cloned);
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      // Skip symbol properties
      if (typeof k !== 'symbol') {
        cloned[k] = this.deepCloneValue(v, cache);
      }
    }
    return cloned;
  }
}
