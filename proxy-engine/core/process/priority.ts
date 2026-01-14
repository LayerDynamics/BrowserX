/**
 * Priority Management
 *
 * Priority levels and queuing for process tasks
 */

/**
 * Priority levels
 */
export type Priority = "critical" | "high" | "normal" | "low" | "idle";

/**
 * Priority numeric values (higher = more important)
 */
export const PRIORITY_VALUES: Record<Priority, number> = {
  critical: 100,
  high: 75,
  normal: 50,
  low: 25,
  idle: 0,
};

/**
 * Priority queue item
 */
export interface PriorityItem<T> {
  data: T;
  priority: Priority;
  timestamp: number;
  id: string;
}

/**
 * Priority queue implementation
 */
export class PriorityQueue<T> {
  private items: PriorityItem<T>[] = [];
  private nextId = 1;

  /**
   * Add item to queue
   */
  enqueue(data: T, priority: Priority = "normal"): string {
    const id = `pq-${this.nextId++}`;
    const item: PriorityItem<T> = {
      data,
      priority,
      timestamp: Date.now(),
      id,
    };

    this.items.push(item);
    this.items.sort((a, b) => {
      // Sort by priority first (descending)
      const priorityDiff = PRIORITY_VALUES[b.priority] - PRIORITY_VALUES[a.priority];
      if (priorityDiff !== 0) {
        return priorityDiff;
      }

      // Then by timestamp (ascending, older first)
      return a.timestamp - b.timestamp;
    });

    return id;
  }

  /**
   * Remove and return highest priority item
   */
  dequeue(): T | undefined {
    const item = this.items.shift();
    return item?.data;
  }

  /**
   * Get highest priority item without removing
   */
  peek(): T | undefined {
    return this.items[0]?.data;
  }

  /**
   * Get item by ID
   */
  get(id: string): T | undefined {
    const item = this.items.find((i) => i.id === id);
    return item?.data;
  }

  /**
   * Remove item by ID
   */
  remove(id: string): boolean {
    const index = this.items.findIndex((i) => i.id === id);
    if (index !== -1) {
      this.items.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Update item priority
   */
  updatePriority(id: string, newPriority: Priority): boolean {
    const item = this.items.find((i) => i.id === id);
    if (item) {
      item.priority = newPriority;
      // Re-sort queue
      this.items.sort((a, b) => {
        const priorityDiff = PRIORITY_VALUES[b.priority] - PRIORITY_VALUES[a.priority];
        if (priorityDiff !== 0) {
          return priorityDiff;
        }
        return a.timestamp - b.timestamp;
      });
      return true;
    }
    return false;
  }

  /**
   * Get queue size
   */
  size(): number {
    return this.items.length;
  }

  /**
   * Check if queue is empty
   */
  isEmpty(): boolean {
    return this.items.length === 0;
  }

  /**
   * Clear queue
   */
  clear(): void {
    this.items = [];
  }

  /**
   * Get all items (sorted by priority)
   */
  toArray(): T[] {
    return this.items.map((item) => item.data);
  }

  /**
   * Get items by priority level
   */
  getByPriority(priority: Priority): T[] {
    return this.items
      .filter((item) => item.priority === priority)
      .map((item) => item.data);
  }

  /**
   * Get count by priority
   */
  countByPriority(priority: Priority): number {
    return this.items.filter((item) => item.priority === priority).length;
  }

  /**
   * Get statistics
   */
  getStats() {
    const counts: Record<Priority, number> = {
      critical: 0,
      high: 0,
      normal: 0,
      low: 0,
      idle: 0,
    };

    for (const item of this.items) {
      counts[item.priority]++;
    }

    return {
      total: this.items.length,
      critical: counts.critical,
      high: counts.high,
      normal: counts.normal,
      low: counts.low,
      idle: counts.idle,
      oldestTimestamp: this.items[this.items.length - 1]?.timestamp,
      newestTimestamp: this.items[0]?.timestamp,
    };
  }
}

/**
 * Compare two priorities
 */
export function comparePriority(a: Priority, b: Priority): number {
  return PRIORITY_VALUES[b] - PRIORITY_VALUES[a];
}

/**
 * Check if priority A is higher than priority B
 */
export function isHigherPriority(a: Priority, b: Priority): boolean {
  return PRIORITY_VALUES[a] > PRIORITY_VALUES[b];
}

/**
 * Get priority from numeric value
 */
export function getPriorityFromValue(value: number): Priority {
  if (value >= PRIORITY_VALUES.critical) return "critical";
  if (value >= PRIORITY_VALUES.high) return "high";
  if (value >= PRIORITY_VALUES.normal) return "normal";
  if (value >= PRIORITY_VALUES.low) return "low";
  return "idle";
}
