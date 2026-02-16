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
   * Deep clone a Map
   */
  private deepClone(source: Map<string, unknown>): Map<string, unknown> {
    const result = new Map<string, unknown>();

    for (const [key, value] of source) {
      result.set(key, this.deepCloneValue(value));
    }

    return result;
  }

  /**
   * Deep clone a value (handles objects, arrays, primitives)
   */
  private deepCloneValue(value: unknown): unknown {
    // Handle null and undefined
    if (value === null || value === undefined) {
      return value;
    }

    // Handle primitives
    if (typeof value !== 'object') {
      return value;
    }

    // Handle Date
    if (value instanceof Date) {
      return new Date(value.getTime());
    }

    // Handle RegExp
    if (value instanceof RegExp) {
      return new RegExp(value.source, value.flags);
    }

    // Handle Map
    if (value instanceof Map) {
      const map = new Map();
      for (const [k, v] of value) {
        map.set(k, this.deepCloneValue(v));
      }
      return map;
    }

    // Handle Set
    if (value instanceof Set) {
      const set = new Set();
      for (const item of value) {
        set.add(this.deepCloneValue(item));
      }
      return set;
    }

    // Handle Array
    if (Array.isArray(value)) {
      return value.map(item => this.deepCloneValue(item));
    }

    // Handle plain objects by recursively cloning enumerable properties
    // Note: circular references are not supported and will result in a stack overflow
    try {
      const cloned: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        // Skip symbol properties
        if (typeof k !== 'symbol') {
          cloned[k] = this.deepCloneValue(v);
        }
      }
      return cloned;
    } catch {
      // If cloning fails, return the original value
      return value;
    }
  }
}
