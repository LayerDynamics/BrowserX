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
 * State manager for managing execution state
 */
export class StateManager {
  private state: Map<string, unknown>;
  private snapshots: StateSnapshot[];
  private snapshotIdCounter: number;

  constructor() {
    this.state = new Map();
    this.snapshots = [];
    this.snapshotIdCounter = 0;
  }

  /**
   * Set a state value
   */
  set(key: string, value: unknown): void {
    this.state.set(key, value);
  }

  /**
   * Get a state value
   */
  get(key: string): unknown {
    return this.state.get(key);
  }

  /**
   * Check if key exists
   */
  has(key: string): boolean {
    return this.state.has(key);
  }

  /**
   * Delete a state value
   */
  delete(key: string): boolean {
    return this.state.delete(key);
  }

  /**
   * Get all state
   */
  getAll(): Record<string, unknown> {
    return Object.fromEntries(this.state);
  }

  /**
   * Clear all state
   */
  clear(): void {
    this.state.clear();
  }

  /**
   * Create a snapshot of current state
   */
  createSnapshot(): string {
    const id = 'snapshot-' + this.snapshotIdCounter++;
    const snapshot: StateSnapshot = {
      id,
      timestamp: Date.now(),
      state: new Map(this.state)
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
    this.state = new Map(snapshot.state);
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
}
