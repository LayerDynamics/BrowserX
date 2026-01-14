/**
 * State Synchronization
 *
 * Synchronize state across workers and processes
 */

/**
 * State change type
 */
export type StateChangeType = "set" | "delete" | "update";

/**
 * State change event
 */
export interface StateChange {
  type: StateChangeType;
  key: string;
  value?: unknown;
  timestamp: number;
  source: string; // Worker/process ID
}

/**
 * State sync message
 */
export interface StateSyncMessage {
  type: "sync" | "request" | "response";
  changes?: StateChange[];
  requestId?: string;
  timestamp: number;
}

/**
 * State Synchronizer
 */
export class StateSynchronizer {
  private state: Map<string, unknown> = new Map();
  private pendingChanges: StateChange[] = [];
  private syncInterval = 1000; // 1 second
  private syncTimer?: number;
  private workerId: string;
  private onSyncCallback?: (message: StateSyncMessage) => void;

  constructor(workerId: string) {
    this.workerId = workerId;
  }

  /**
   * Set state value
   */
  set(key: string, value: unknown): void {
    this.state.set(key, value);

    const change: StateChange = {
      type: "set",
      key,
      value,
      timestamp: Date.now(),
      source: this.workerId,
    };

    this.pendingChanges.push(change);
  }

  /**
   * Get state value
   */
  get(key: string): unknown {
    return this.state.get(key);
  }

  /**
   * Delete state value
   */
  delete(key: string): void {
    this.state.delete(key);

    const change: StateChange = {
      type: "delete",
      key,
      timestamp: Date.now(),
      source: this.workerId,
    };

    this.pendingChanges.push(change);
  }

  /**
   * Update state value (merge)
   */
  update(key: string, updates: Record<string, unknown>): void {
    const current = this.state.get(key);

    let newValue: unknown;
    if (current && typeof current === "object" && !Array.isArray(current)) {
      newValue = { ...current as Record<string, unknown>, ...updates };
    } else {
      newValue = updates;
    }

    this.state.set(key, newValue);

    const change: StateChange = {
      type: "update",
      key,
      value: newValue,
      timestamp: Date.now(),
      source: this.workerId,
    };

    this.pendingChanges.push(change);
  }

  /**
   * Check if key exists
   */
  has(key: string): boolean {
    return this.state.has(key);
  }

  /**
   * Clear all state
   */
  clear(): void {
    this.state.clear();
    this.pendingChanges = [];
  }

  /**
   * Get all keys
   */
  keys(): string[] {
    return Array.from(this.state.keys());
  }

  /**
   * Get all state as object
   */
  toObject(): Record<string, unknown> {
    const obj: Record<string, unknown> = {};
    for (const [key, value] of this.state.entries()) {
      obj[key] = value;
    }
    return obj;
  }

  /**
   * Apply state changes from other workers
   */
  applyChanges(changes: StateChange[]): void {
    for (const change of changes) {
      // Skip changes from self
      if (change.source === this.workerId) {
        continue;
      }

      switch (change.type) {
        case "set":
          this.state.set(change.key, change.value);
          break;
        case "delete":
          this.state.delete(change.key);
          break;
        case "update":
          if (change.value) {
            this.state.set(change.key, change.value);
          }
          break;
      }
    }
  }

  /**
   * Get pending changes
   */
  getPendingChanges(): StateChange[] {
    return [...this.pendingChanges];
  }

  /**
   * Clear pending changes
   */
  clearPendingChanges(): void {
    this.pendingChanges = [];
  }

  /**
   * Start automatic sync
   */
  startSync(
    callback: (message: StateSyncMessage) => void,
    interval: number = 1000,
  ): void {
    this.onSyncCallback = callback;
    this.syncInterval = interval;

    this.syncTimer = setInterval(() => {
      this.sync();
    }, this.syncInterval);
  }

  /**
   * Stop automatic sync
   */
  stopSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = undefined;
    }
  }

  /**
   * Perform sync
   */
  sync(): void {
    if (this.pendingChanges.length === 0) {
      return;
    }

    const message: StateSyncMessage = {
      type: "sync",
      changes: this.getPendingChanges(),
      timestamp: Date.now(),
    };

    this.onSyncCallback?.(message);
    this.clearPendingChanges();
  }

  /**
   * Handle sync message from other workers
   */
  handleMessage(message: StateSyncMessage): void {
    if (message.type === "sync" && message.changes) {
      this.applyChanges(message.changes);
    } else if (message.type === "request") {
      // Send full state as response
      const response: StateSyncMessage = {
        type: "response",
        changes: Array.from(this.state.entries()).map(([key, value]) => ({
          type: "set" as const,
          key,
          value,
          timestamp: Date.now(),
          source: this.workerId,
        })),
        requestId: message.requestId,
        timestamp: Date.now(),
      };

      this.onSyncCallback?.(response);
    } else if (message.type === "response" && message.changes) {
      this.applyChanges(message.changes);
    }
  }

  /**
   * Request full state from other workers
   */
  requestFullState(): void {
    const message: StateSyncMessage = {
      type: "request",
      requestId: `${this.workerId}_${Date.now()}`,
      timestamp: Date.now(),
    };

    this.onSyncCallback?.(message);
  }
}

/**
 * Shared state using BroadcastChannel (for workers)
 */
export class BroadcastStateSynchronizer extends StateSynchronizer {
  private channel?: BroadcastChannel;

  constructor(workerId: string, channelName: string = "network-state-sync") {
    super(workerId);

    try {
      this.channel = new BroadcastChannel(channelName);
      this.channel.onmessage = (event) => {
        this.handleMessage(event.data);
      };
    } catch {
      // BroadcastChannel not available
    }
  }

  /**
   * Override sync to use BroadcastChannel
   */
  override sync(): void {
    const pending = this.getPendingChanges();
    if (pending.length === 0 || !this.channel) {
      return;
    }

    const message: StateSyncMessage = {
      type: "sync",
      changes: pending,
      timestamp: Date.now(),
    };

    this.channel.postMessage(message);
    this.clearPendingChanges();
  }

  /**
   * Close channel
   */
  close(): void {
    this.stopSync();
    this.channel?.close();
  }
}
