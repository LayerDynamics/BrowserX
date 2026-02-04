/**
 * Priority Queue Tests
 * Comprehensive tests for PriorityQueue and priority utilities
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import {
  PriorityQueue,
  PRIORITY_VALUES,
  comparePriority,
  isHigherPriority,
  getPriorityFromValue,
  type Priority,
} from "../../../core/process/priority.ts";

// ============================================================================
// PRIORITY_VALUES Tests
// ============================================================================

Deno.test({
  name: "PRIORITY_VALUES - has correct values",
  fn() {
    assertEquals(PRIORITY_VALUES.critical, 100);
    assertEquals(PRIORITY_VALUES.high, 75);
    assertEquals(PRIORITY_VALUES.normal, 50);
    assertEquals(PRIORITY_VALUES.low, 25);
    assertEquals(PRIORITY_VALUES.idle, 0);
  },
});

Deno.test({
  name: "PRIORITY_VALUES - values are in descending order",
  fn() {
    assert(PRIORITY_VALUES.critical > PRIORITY_VALUES.high);
    assert(PRIORITY_VALUES.high > PRIORITY_VALUES.normal);
    assert(PRIORITY_VALUES.normal > PRIORITY_VALUES.low);
    assert(PRIORITY_VALUES.low > PRIORITY_VALUES.idle);
  },
});

// ============================================================================
// comparePriority Tests
// ============================================================================

Deno.test({
  name: "comparePriority - returns negative when first is higher",
  fn() {
    assert(comparePriority("critical", "high") < 0);
    assert(comparePriority("high", "normal") < 0);
    assert(comparePriority("normal", "low") < 0);
    assert(comparePriority("low", "idle") < 0);
  },
});

Deno.test({
  name: "comparePriority - returns positive when first is lower",
  fn() {
    assert(comparePriority("idle", "low") > 0);
    assert(comparePriority("low", "normal") > 0);
    assert(comparePriority("normal", "high") > 0);
    assert(comparePriority("high", "critical") > 0);
  },
});

Deno.test({
  name: "comparePriority - returns zero for same priority",
  fn() {
    assertEquals(comparePriority("critical", "critical"), 0);
    assertEquals(comparePriority("high", "high"), 0);
    assertEquals(comparePriority("normal", "normal"), 0);
    assertEquals(comparePriority("low", "low"), 0);
    assertEquals(comparePriority("idle", "idle"), 0);
  },
});

// ============================================================================
// isHigherPriority Tests
// ============================================================================

Deno.test({
  name: "isHigherPriority - returns true when first is higher",
  fn() {
    assertEquals(isHigherPriority("critical", "high"), true);
    assertEquals(isHigherPriority("high", "normal"), true);
    assertEquals(isHigherPriority("normal", "low"), true);
    assertEquals(isHigherPriority("low", "idle"), true);
    assertEquals(isHigherPriority("critical", "idle"), true);
  },
});

Deno.test({
  name: "isHigherPriority - returns false when first is lower",
  fn() {
    assertEquals(isHigherPriority("high", "critical"), false);
    assertEquals(isHigherPriority("normal", "high"), false);
    assertEquals(isHigherPriority("low", "normal"), false);
    assertEquals(isHigherPriority("idle", "low"), false);
    assertEquals(isHigherPriority("idle", "critical"), false);
  },
});

Deno.test({
  name: "isHigherPriority - returns false for same priority",
  fn() {
    assertEquals(isHigherPriority("critical", "critical"), false);
    assertEquals(isHigherPriority("normal", "normal"), false);
    assertEquals(isHigherPriority("idle", "idle"), false);
  },
});

// ============================================================================
// getPriorityFromValue Tests
// ============================================================================

Deno.test({
  name: "getPriorityFromValue - returns critical for value >= 100",
  fn() {
    assertEquals(getPriorityFromValue(100), "critical");
    assertEquals(getPriorityFromValue(150), "critical");
    assertEquals(getPriorityFromValue(1000), "critical");
  },
});

Deno.test({
  name: "getPriorityFromValue - returns high for value >= 75",
  fn() {
    assertEquals(getPriorityFromValue(75), "high");
    assertEquals(getPriorityFromValue(99), "high");
  },
});

Deno.test({
  name: "getPriorityFromValue - returns normal for value >= 50",
  fn() {
    assertEquals(getPriorityFromValue(50), "normal");
    assertEquals(getPriorityFromValue(74), "normal");
  },
});

Deno.test({
  name: "getPriorityFromValue - returns low for value >= 25",
  fn() {
    assertEquals(getPriorityFromValue(25), "low");
    assertEquals(getPriorityFromValue(49), "low");
  },
});

Deno.test({
  name: "getPriorityFromValue - returns idle for value < 25",
  fn() {
    assertEquals(getPriorityFromValue(24), "idle");
    assertEquals(getPriorityFromValue(0), "idle");
    assertEquals(getPriorityFromValue(-10), "idle");
  },
});

// ============================================================================
// PriorityQueue Constructor Tests
// ============================================================================

Deno.test({
  name: "PriorityQueue - can be instantiated",
  fn() {
    const queue = new PriorityQueue<string>();
    assertExists(queue);
  },
});

Deno.test({
  name: "PriorityQueue - starts empty",
  fn() {
    const queue = new PriorityQueue<string>();
    assertEquals(queue.size(), 0);
    assertEquals(queue.isEmpty(), true);
  },
});

// ============================================================================
// PriorityQueue enqueue Tests
// ============================================================================

Deno.test({
  name: "PriorityQueue - enqueue adds item",
  fn() {
    const queue = new PriorityQueue<string>();
    queue.enqueue("test");
    assertEquals(queue.size(), 1);
  },
});

Deno.test({
  name: "PriorityQueue - enqueue returns unique ID",
  fn() {
    const queue = new PriorityQueue<string>();
    const id1 = queue.enqueue("item1");
    const id2 = queue.enqueue("item2");
    const id3 = queue.enqueue("item3");

    assert(id1.startsWith("pq-"));
    assert(id2.startsWith("pq-"));
    assert(id1 !== id2);
    assert(id2 !== id3);
  },
});

Deno.test({
  name: "PriorityQueue - enqueue defaults to normal priority",
  fn() {
    const queue = new PriorityQueue<string>();
    queue.enqueue("item");
    const stats = queue.getStats();
    assertEquals(stats.normal, 1);
  },
});

Deno.test({
  name: "PriorityQueue - enqueue respects explicit priority",
  fn() {
    const queue = new PriorityQueue<string>();
    queue.enqueue("critical-item", "critical");
    queue.enqueue("high-item", "high");
    queue.enqueue("low-item", "low");
    queue.enqueue("idle-item", "idle");

    const stats = queue.getStats();
    assertEquals(stats.critical, 1);
    assertEquals(stats.high, 1);
    assertEquals(stats.low, 1);
    assertEquals(stats.idle, 1);
  },
});

Deno.test({
  name: "PriorityQueue - enqueue maintains priority order",
  fn() {
    const queue = new PriorityQueue<string>();

    // Add items in mixed order
    queue.enqueue("low", "low");
    queue.enqueue("critical", "critical");
    queue.enqueue("normal", "normal");
    queue.enqueue("high", "high");
    queue.enqueue("idle", "idle");

    // Dequeue should return in priority order
    assertEquals(queue.dequeue(), "critical");
    assertEquals(queue.dequeue(), "high");
    assertEquals(queue.dequeue(), "normal");
    assertEquals(queue.dequeue(), "low");
    assertEquals(queue.dequeue(), "idle");
  },
});

Deno.test({
  name: "PriorityQueue - same priority maintains FIFO order",
  fn() {
    const queue = new PriorityQueue<string>();

    // Add items with same priority
    queue.enqueue("first", "normal");
    queue.enqueue("second", "normal");
    queue.enqueue("third", "normal");

    assertEquals(queue.dequeue(), "first");
    assertEquals(queue.dequeue(), "second");
    assertEquals(queue.dequeue(), "third");
  },
});

// ============================================================================
// PriorityQueue dequeue Tests
// ============================================================================

Deno.test({
  name: "PriorityQueue - dequeue removes highest priority item",
  fn() {
    const queue = new PriorityQueue<string>();
    queue.enqueue("normal-item", "normal");
    queue.enqueue("high-item", "high");

    const item = queue.dequeue();
    assertEquals(item, "high-item");
    assertEquals(queue.size(), 1);
  },
});

Deno.test({
  name: "PriorityQueue - dequeue returns undefined when empty",
  fn() {
    const queue = new PriorityQueue<string>();
    assertEquals(queue.dequeue(), undefined);
  },
});

Deno.test({
  name: "PriorityQueue - dequeue updates size",
  fn() {
    const queue = new PriorityQueue<string>();
    queue.enqueue("item1");
    queue.enqueue("item2");
    queue.enqueue("item3");

    assertEquals(queue.size(), 3);
    queue.dequeue();
    assertEquals(queue.size(), 2);
    queue.dequeue();
    assertEquals(queue.size(), 1);
    queue.dequeue();
    assertEquals(queue.size(), 0);
  },
});

// ============================================================================
// PriorityQueue peek Tests
// ============================================================================

Deno.test({
  name: "PriorityQueue - peek returns highest priority without removing",
  fn() {
    const queue = new PriorityQueue<string>();
    queue.enqueue("low-item", "low");
    queue.enqueue("high-item", "high");

    assertEquals(queue.peek(), "high-item");
    assertEquals(queue.size(), 2); // Not removed
    assertEquals(queue.peek(), "high-item"); // Still there
  },
});

Deno.test({
  name: "PriorityQueue - peek returns undefined when empty",
  fn() {
    const queue = new PriorityQueue<string>();
    assertEquals(queue.peek(), undefined);
  },
});

// ============================================================================
// PriorityQueue get Tests
// ============================================================================

Deno.test({
  name: "PriorityQueue - get retrieves item by ID",
  fn() {
    const queue = new PriorityQueue<string>();
    const id = queue.enqueue("my-item");

    assertEquals(queue.get(id), "my-item");
  },
});

Deno.test({
  name: "PriorityQueue - get returns undefined for non-existent ID",
  fn() {
    const queue = new PriorityQueue<string>();
    assertEquals(queue.get("non-existent"), undefined);
  },
});

// ============================================================================
// PriorityQueue remove Tests
// ============================================================================

Deno.test({
  name: "PriorityQueue - remove deletes item by ID",
  fn() {
    const queue = new PriorityQueue<string>();
    const id = queue.enqueue("to-remove");
    queue.enqueue("keep");

    assertEquals(queue.size(), 2);
    const result = queue.remove(id);

    assertEquals(result, true);
    assertEquals(queue.size(), 1);
    assertEquals(queue.get(id), undefined);
  },
});

Deno.test({
  name: "PriorityQueue - remove returns false for non-existent ID",
  fn() {
    const queue = new PriorityQueue<string>();
    const result = queue.remove("non-existent");
    assertEquals(result, false);
  },
});

// ============================================================================
// PriorityQueue updatePriority Tests
// ============================================================================

Deno.test({
  name: "PriorityQueue - updatePriority changes item priority",
  fn() {
    const queue = new PriorityQueue<string>();
    const id = queue.enqueue("item", "low");

    const result = queue.updatePriority(id, "critical");
    assertEquals(result, true);

    // Should now be first in queue
    assertEquals(queue.peek(), "item");
  },
});

Deno.test({
  name: "PriorityQueue - updatePriority reorders queue",
  fn() {
    const queue = new PriorityQueue<string>();
    queue.enqueue("always-high", "high");
    const lowId = queue.enqueue("was-low", "low");

    // "always-high" should be first
    assertEquals(queue.peek(), "always-high");

    // Upgrade "was-low" to critical
    queue.updatePriority(lowId, "critical");

    // Now "was-low" should be first
    assertEquals(queue.peek(), "was-low");
  },
});

Deno.test({
  name: "PriorityQueue - updatePriority returns false for non-existent ID",
  fn() {
    const queue = new PriorityQueue<string>();
    const result = queue.updatePriority("non-existent", "high");
    assertEquals(result, false);
  },
});

// ============================================================================
// PriorityQueue size and isEmpty Tests
// ============================================================================

Deno.test({
  name: "PriorityQueue - size returns correct count",
  fn() {
    const queue = new PriorityQueue<string>();

    assertEquals(queue.size(), 0);
    queue.enqueue("a");
    assertEquals(queue.size(), 1);
    queue.enqueue("b");
    assertEquals(queue.size(), 2);
    queue.dequeue();
    assertEquals(queue.size(), 1);
  },
});

Deno.test({
  name: "PriorityQueue - isEmpty returns true when empty",
  fn() {
    const queue = new PriorityQueue<string>();
    assertEquals(queue.isEmpty(), true);
    queue.enqueue("item");
    assertEquals(queue.isEmpty(), false);
    queue.dequeue();
    assertEquals(queue.isEmpty(), true);
  },
});

// ============================================================================
// PriorityQueue clear Tests
// ============================================================================

Deno.test({
  name: "PriorityQueue - clear removes all items",
  fn() {
    const queue = new PriorityQueue<string>();
    queue.enqueue("a", "high");
    queue.enqueue("b", "normal");
    queue.enqueue("c", "low");

    assertEquals(queue.size(), 3);
    queue.clear();
    assertEquals(queue.size(), 0);
    assertEquals(queue.isEmpty(), true);
    assertEquals(queue.dequeue(), undefined);
  },
});

// ============================================================================
// PriorityQueue toArray Tests
// ============================================================================

Deno.test({
  name: "PriorityQueue - toArray returns items in priority order",
  fn() {
    const queue = new PriorityQueue<string>();
    queue.enqueue("low", "low");
    queue.enqueue("high", "high");
    queue.enqueue("normal", "normal");

    const arr = queue.toArray();
    assertEquals(arr[0], "high");
    assertEquals(arr[1], "normal");
    assertEquals(arr[2], "low");
  },
});

Deno.test({
  name: "PriorityQueue - toArray returns empty array when empty",
  fn() {
    const queue = new PriorityQueue<string>();
    assertEquals(queue.toArray(), []);
  },
});

// ============================================================================
// PriorityQueue getByPriority Tests
// ============================================================================

Deno.test({
  name: "PriorityQueue - getByPriority returns items of specific priority",
  fn() {
    const queue = new PriorityQueue<string>();
    queue.enqueue("high-1", "high");
    queue.enqueue("normal-1", "normal");
    queue.enqueue("high-2", "high");
    queue.enqueue("normal-2", "normal");

    const highItems = queue.getByPriority("high");
    assertEquals(highItems.length, 2);
    assert(highItems.includes("high-1"));
    assert(highItems.includes("high-2"));
  },
});

Deno.test({
  name: "PriorityQueue - getByPriority returns empty array when no matches",
  fn() {
    const queue = new PriorityQueue<string>();
    queue.enqueue("normal", "normal");

    assertEquals(queue.getByPriority("critical"), []);
  },
});

// ============================================================================
// PriorityQueue countByPriority Tests
// ============================================================================

Deno.test({
  name: "PriorityQueue - countByPriority returns correct counts",
  fn() {
    const queue = new PriorityQueue<string>();
    queue.enqueue("c1", "critical");
    queue.enqueue("c2", "critical");
    queue.enqueue("h1", "high");
    queue.enqueue("n1", "normal");
    queue.enqueue("n2", "normal");
    queue.enqueue("n3", "normal");

    assertEquals(queue.countByPriority("critical"), 2);
    assertEquals(queue.countByPriority("high"), 1);
    assertEquals(queue.countByPriority("normal"), 3);
    assertEquals(queue.countByPriority("low"), 0);
    assertEquals(queue.countByPriority("idle"), 0);
  },
});

// ============================================================================
// PriorityQueue getStats Tests
// ============================================================================

Deno.test({
  name: "PriorityQueue - getStats returns comprehensive statistics",
  fn() {
    const queue = new PriorityQueue<string>();
    queue.enqueue("critical-item", "critical");
    queue.enqueue("high-item", "high");
    queue.enqueue("normal-item", "normal");
    queue.enqueue("low-item", "low");
    queue.enqueue("idle-item", "idle");

    const stats = queue.getStats();

    assertEquals(stats.total, 5);
    assertEquals(stats.critical, 1);
    assertEquals(stats.high, 1);
    assertEquals(stats.normal, 1);
    assertEquals(stats.low, 1);
    assertEquals(stats.idle, 1);
    assertExists(stats.oldestTimestamp);
    assertExists(stats.newestTimestamp);
  },
});

Deno.test({
  name: "PriorityQueue - getStats returns zeros when empty",
  fn() {
    const queue = new PriorityQueue<string>();
    const stats = queue.getStats();

    assertEquals(stats.total, 0);
    assertEquals(stats.critical, 0);
    assertEquals(stats.high, 0);
    assertEquals(stats.normal, 0);
    assertEquals(stats.low, 0);
    assertEquals(stats.idle, 0);
  },
});

// ============================================================================
// PriorityQueue Type Tests
// ============================================================================

Deno.test({
  name: "PriorityQueue - works with number type",
  fn() {
    const queue = new PriorityQueue<number>();
    queue.enqueue(100, "high");
    queue.enqueue(200, "low");
    queue.enqueue(300, "critical");

    assertEquals(queue.dequeue(), 300);
    assertEquals(queue.dequeue(), 100);
    assertEquals(queue.dequeue(), 200);
  },
});

Deno.test({
  name: "PriorityQueue - works with object type",
  fn() {
    interface Task {
      name: string;
      data: number;
    }

    const queue = new PriorityQueue<Task>();
    queue.enqueue({ name: "low-task", data: 1 }, "low");
    queue.enqueue({ name: "high-task", data: 2 }, "high");

    const item = queue.dequeue();
    assertExists(item);
    assertEquals(item.name, "high-task");
    assertEquals(item.data, 2);
  },
});

// ============================================================================
// Edge Cases and Integration Tests
// ============================================================================

Deno.test({
  name: "PriorityQueue - handles many items",
  fn() {
    const queue = new PriorityQueue<number>();

    for (let i = 0; i < 100; i++) {
      const priorities: Priority[] = ["critical", "high", "normal", "low", "idle"];
      queue.enqueue(i, priorities[i % 5]);
    }

    assertEquals(queue.size(), 100);

    // All critical should come out first
    const stats = queue.getStats();
    assertEquals(stats.critical, 20);
    assertEquals(stats.high, 20);
    assertEquals(stats.normal, 20);
    assertEquals(stats.low, 20);
    assertEquals(stats.idle, 20);
  },
});

Deno.test({
  name: "PriorityQueue - maintains order through priority updates",
  fn() {
    const queue = new PriorityQueue<string>();

    const id1 = queue.enqueue("item1", "normal");
    queue.enqueue("item2", "normal");
    queue.enqueue("item3", "normal");

    // Upgrade item1 to critical
    queue.updatePriority(id1, "critical");

    // item1 should now be first
    assertEquals(queue.dequeue(), "item1");
  },
});

Deno.test({
  name: "PriorityQueue - full lifecycle test",
  fn() {
    const queue = new PriorityQueue<string>();

    // Add items
    const id1 = queue.enqueue("task-1", "low");
    const id2 = queue.enqueue("task-2", "high");
    const id3 = queue.enqueue("task-3", "normal");

    // Check initial state
    assertEquals(queue.size(), 3);
    assertEquals(queue.peek(), "task-2");

    // Update priority
    queue.updatePriority(id1, "critical");
    assertEquals(queue.peek(), "task-1");

    // Remove one
    queue.remove(id2);
    assertEquals(queue.size(), 2);

    // Process remaining
    assertEquals(queue.dequeue(), "task-1");
    assertEquals(queue.dequeue(), "task-3");
    assertEquals(queue.isEmpty(), true);
  },
});
