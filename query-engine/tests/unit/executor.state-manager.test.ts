/**
 * StateManager Tests
 * Comprehensive tests for StateManager
 */

import { assertEquals, assertExists, assert, assertNotEquals } from "@std/assert";
import { StateManager } from "../../executor/state-manager.ts";

// ============================================================================
// State Snapshots Tests (8 tests)
// ============================================================================

Deno.test("StateManager - creates snapshot of current state", () => {
  const stateManager = new StateManager();
  stateManager.setState({ foo: "bar", count: 42 });

  const snapshotId = stateManager.createSnapshot();

  assertExists(snapshotId);
  assert(snapshotId.startsWith("snapshot-"));

  // Verify snapshot captured current state
  const allState = stateManager.getAll();
  assertEquals(allState.foo, "bar");
  assertEquals(allState.count, 42);
});

Deno.test("StateManager - restores state from snapshot", () => {
  const stateManager = new StateManager();
  stateManager.setState({ foo: "bar", count: 42 });

  const snapshotId = stateManager.createSnapshot();

  // Modify state
  stateManager.setState({ foo: "modified", count: 100 });
  assertEquals(stateManager.get("foo"), "modified");
  assertEquals(stateManager.get("count"), 100);

  // Restore from snapshot
  const restored = stateManager.restoreSnapshot(snapshotId);
  assert(restored);
  assertEquals(stateManager.get("foo"), "bar");
  assertEquals(stateManager.get("count"), 42);
});

Deno.test("StateManager - multiple snapshots with stack behavior", () => {
  const stateManager = new StateManager();

  // Create first snapshot
  stateManager.setState({ version: 1 });
  const snapshot1 = stateManager.createSnapshot();

  // Create second snapshot
  stateManager.setState({ version: 2 });
  const snapshot2 = stateManager.createSnapshot();

  // Create third snapshot
  stateManager.setState({ version: 3 });
  const snapshot3 = stateManager.createSnapshot();

  // Modify state
  stateManager.setState({ version: 999 });

  // Restore to snapshot2
  stateManager.restoreSnapshot(snapshot2);
  assertEquals(stateManager.get("version"), 2);

  // Restore to snapshot1
  stateManager.restoreSnapshot(snapshot1);
  assertEquals(stateManager.get("version"), 1);

  // Restore to snapshot3
  stateManager.restoreSnapshot(snapshot3);
  assertEquals(stateManager.get("version"), 3);
});

Deno.test("StateManager - snapshot isolation (changes don't affect snapshot)", () => {
  const stateManager = new StateManager();
  stateManager.setState({ data: { count: 10 } });

  const snapshotId = stateManager.createSnapshot();

  // Modify state deeply
  const data = stateManager.get("data") as { count: number };
  data.count = 999;
  stateManager.set("data", data);
  stateManager.set("newKey", "newValue");

  // Restore snapshot - should get original state
  stateManager.restoreSnapshot(snapshotId);
  const restoredData = stateManager.get("data") as { count: number };
  assertEquals(restoredData.count, 10);
  assertEquals(stateManager.has("newKey"), false);
});

Deno.test("StateManager - empty state snapshots", () => {
  const stateManager = new StateManager();

  const snapshotId = stateManager.createSnapshot();
  assertExists(snapshotId);

  // Add some data
  stateManager.setState({ foo: "bar" });
  assertEquals(stateManager.get("foo"), "bar");

  // Restore to empty snapshot
  stateManager.restoreSnapshot(snapshotId);
  assertEquals(stateManager.has("foo"), false);

  const allState = stateManager.getAll();
  assertEquals(Object.keys(allState).length, 0);
});

Deno.test("StateManager - large state snapshots", () => {
  const stateManager = new StateManager();

  // Create large state
  const largeState: Record<string, unknown> = {};
  for (let i = 0; i < 1000; i++) {
    largeState[`key_${i}`] = { value: i, nested: { data: `value_${i}` } };
  }
  stateManager.setState(largeState);

  const snapshotId = stateManager.createSnapshot();

  // Modify state
  stateManager.clear();
  assertEquals(Object.keys(stateManager.getAll()).length, 0);

  // Restore
  stateManager.restoreSnapshot(snapshotId);
  const restored = stateManager.getAll();
  assertEquals(Object.keys(restored).length, 1000);
  assertEquals((restored.key_500 as any).value, 500);
});

Deno.test("StateManager - nested object snapshots", () => {
  const stateManager = new StateManager();

  const nestedData = {
    level1: {
      level2: {
        level3: {
          value: "deep"
        }
      },
      array: [1, 2, { nested: true }]
    }
  };

  stateManager.setState({ data: nestedData });
  const snapshotId = stateManager.createSnapshot();

  // Modify deeply
  stateManager.setState({ data: { different: true } });

  // Restore
  stateManager.restoreSnapshot(snapshotId);
  const restored = stateManager.get("data") as any;
  assertEquals(restored.level1.level2.level3.value, "deep");
  assertEquals(restored.level1.array[2].nested, true);
});

Deno.test("StateManager - array handling in snapshots", () => {
  const stateManager = new StateManager();

  stateManager.setState({
    simpleArray: [1, 2, 3],
    objectArray: [{ id: 1 }, { id: 2 }],
    nestedArray: [[1, 2], [3, 4]]
  });

  const snapshotId = stateManager.createSnapshot();

  // Modify arrays
  stateManager.setState({
    simpleArray: [99],
    objectArray: [],
    nestedArray: []
  });

  // Restore
  stateManager.restoreSnapshot(snapshotId);
  const simple = stateManager.get("simpleArray") as number[];
  const objects = stateManager.get("objectArray") as Array<{ id: number }>;
  const nested = stateManager.get("nestedArray") as number[][];

  assertEquals(simple, [1, 2, 3]);
  assertEquals(objects.length, 2);
  assertEquals(objects[0].id, 1);
  assertEquals(nested[0], [1, 2]);
});

// ============================================================================
// Rollback Functionality Tests (7 tests)
// ============================================================================

Deno.test("StateManager - rollback to previous state", () => {
  const stateManager = new StateManager();

  stateManager.setState({ value: "original" });
  stateManager.createSnapshot();

  stateManager.setState({ value: "modified" });
  assertEquals(stateManager.get("value"), "modified");

  const rolled = stateManager.rollback();
  assert(rolled);
  assertEquals(stateManager.get("value"), "original");
});

Deno.test("StateManager - multiple rollbacks in sequence", () => {
  const stateManager = new StateManager();

  stateManager.setState({ step: 1 });
  stateManager.createSnapshot();

  stateManager.setState({ step: 2 });
  stateManager.createSnapshot();

  stateManager.setState({ step: 3 });
  stateManager.createSnapshot();

  stateManager.setState({ step: 4 });

  // Rollback to step 3
  stateManager.rollback();
  assertEquals(stateManager.get("step"), 3);

  // Rollback to step 2
  stateManager.rollback();
  assertEquals(stateManager.get("step"), 2);

  // Rollback to step 1
  stateManager.rollback();
  assertEquals(stateManager.get("step"), 1);
});

Deno.test("StateManager - rollback after no changes", () => {
  const stateManager = new StateManager();

  stateManager.setState({ unchanged: true });
  stateManager.createSnapshot();

  // No changes made
  const rolled = stateManager.rollback();
  assert(rolled);
  assertEquals(stateManager.get("unchanged"), true);
});

Deno.test("StateManager - rollback with nested state changes", () => {
  const stateManager = new StateManager();

  const original = {
    user: { name: "Alice", age: 30 },
    settings: { theme: "dark" }
  };
  stateManager.setState(original);
  stateManager.createSnapshot();

  // Make nested changes
  stateManager.setState({
    user: { name: "Bob", age: 25 },
    settings: { theme: "light" }
  });

  stateManager.rollback();

  const user = stateManager.get("user") as any;
  const settings = stateManager.get("settings") as any;
  assertEquals(user.name, "Alice");
  assertEquals(user.age, 30);
  assertEquals(settings.theme, "dark");
});

Deno.test("StateManager - rollback clears current changes", () => {
  const stateManager = new StateManager();

  stateManager.setState({ old: "value" });
  stateManager.createSnapshot();

  stateManager.clear();
  stateManager.setState({ new: "value" });
  assertEquals(stateManager.has("old"), false);
  assertEquals(stateManager.has("new"), true);

  stateManager.rollback();
  assertEquals(stateManager.has("old"), true);
  assertEquals(stateManager.has("new"), false);
});

Deno.test("StateManager - cannot rollback beyond initial state", () => {
  const stateManager = new StateManager();

  stateManager.setState({ initial: true });
  stateManager.createSnapshot();

  // Rollback once
  const firstRollback = stateManager.rollback();
  assert(firstRollback);

  // Try to rollback again - should fail
  const secondRollback = stateManager.rollback();
  assertEquals(secondRollback, false);
});

Deno.test("StateManager - rollback with empty stack", () => {
  const stateManager = new StateManager();

  stateManager.setState({ data: "value" });
  // No snapshot created

  const rolled = stateManager.rollback();
  assertEquals(rolled, false);

  // State should be unchanged
  assertEquals(stateManager.get("data"), "value");
});

// ============================================================================
// Transaction Isolation Tests (6 tests)
// ============================================================================

Deno.test("StateManager - begin transaction", () => {
  const stateManager = new StateManager();

  stateManager.setState({ before: "transaction" });

  const txId = stateManager.beginTransaction();
  assertExists(txId);
  assert(txId.startsWith("transaction-"));
  assert(stateManager.inTransaction());
  assertEquals(stateManager.getTransactionDepth(), 1);

  // Changes in transaction
  stateManager.setState({ during: "transaction" });
  assertEquals(stateManager.get("during"), "transaction");
  assertEquals(stateManager.get("before"), "transaction");
});

Deno.test("StateManager - commit transaction", () => {
  const stateManager = new StateManager();

  stateManager.setState({ initial: "value" });
  stateManager.beginTransaction();

  stateManager.setState({ txChange: "committed" });
  stateManager.set("initial", "updated");

  const committed = stateManager.commitTransaction();
  assert(committed);
  assertEquals(stateManager.inTransaction(), false);

  // Changes should persist after commit
  assertEquals(stateManager.get("txChange"), "committed");
  assertEquals(stateManager.get("initial"), "updated");
});

Deno.test("StateManager - rollback transaction", () => {
  const stateManager = new StateManager();

  stateManager.setState({ initial: "value" });
  stateManager.beginTransaction();

  stateManager.setState({ txChange: "shouldNotPersist" });
  stateManager.set("initial", "shouldNotUpdate");

  const rolledBack = stateManager.rollbackTransaction();
  assert(rolledBack);
  assertEquals(stateManager.inTransaction(), false);

  // Changes should not persist after rollback
  assertEquals(stateManager.has("txChange"), false);
  assertEquals(stateManager.get("initial"), "value");
});

Deno.test("StateManager - nested transactions", () => {
  const stateManager = new StateManager();

  stateManager.setState({ value: 0 });

  // Start first transaction
  stateManager.beginTransaction();
  stateManager.set("value", 1);
  assertEquals(stateManager.getTransactionDepth(), 1);

  // Start nested transaction
  stateManager.beginTransaction();
  stateManager.set("value", 2);
  assertEquals(stateManager.getTransactionDepth(), 2);

  // Commit nested transaction
  stateManager.commitTransaction();
  assertEquals(stateManager.getTransactionDepth(), 1);
  assertEquals(stateManager.get("value"), 2);

  // Commit outer transaction
  stateManager.commitTransaction();
  assertEquals(stateManager.getTransactionDepth(), 0);
  assertEquals(stateManager.get("value"), 2);
});

Deno.test("StateManager - transaction state isolation", () => {
  const stateManager = new StateManager();

  stateManager.setState({ shared: "original" });

  stateManager.beginTransaction();
  stateManager.set("shared", "tx1Modified");
  stateManager.set("tx1Only", "value1");

  // Start nested transaction
  stateManager.beginTransaction();
  stateManager.set("shared", "tx2Modified");
  stateManager.set("tx2Only", "value2");

  // Rollback nested transaction
  stateManager.rollbackTransaction();

  // Should have tx1 state
  assertEquals(stateManager.get("shared"), "tx1Modified");
  assertEquals(stateManager.get("tx1Only"), "value1");
  assertEquals(stateManager.has("tx2Only"), false);

  // Rollback outer transaction
  stateManager.rollbackTransaction();

  // Should have original state
  assertEquals(stateManager.get("shared"), "original");
  assertEquals(stateManager.has("tx1Only"), false);
});

Deno.test("StateManager - commit updates main state", () => {
  const stateManager = new StateManager();

  stateManager.setState({ counter: 0 });

  stateManager.beginTransaction();
  stateManager.set("counter", 10);
  stateManager.set("newKey", "newValue");

  // Before commit, transaction is active
  assert(stateManager.inTransaction());

  stateManager.commitTransaction();

  // After commit, transaction is complete
  assertEquals(stateManager.inTransaction(), false);

  // Main state should be updated
  assertEquals(stateManager.get("counter"), 10);
  assertEquals(stateManager.get("newKey"), "newValue");

  // Verify by creating new transaction
  stateManager.beginTransaction();
  assertEquals(stateManager.get("counter"), 10);
  assertEquals(stateManager.get("newKey"), "newValue");
  stateManager.rollbackTransaction();
});

// ============================================================================
// State Cloning Tests (5 tests)
// ============================================================================

Deno.test("StateManager - deep clone objects", () => {
  const stateManager = new StateManager();

  const original = { nested: { value: 42 } };
  stateManager.set("obj", original);

  stateManager.beginTransaction();
  const retrieved = stateManager.get("obj") as any;
  retrieved.nested.value = 999;

  stateManager.rollbackTransaction();

  // Original should be unchanged after rollback
  const afterRollback = stateManager.get("obj") as any;
  assertEquals(afterRollback.nested.value, 42);
});

Deno.test("StateManager - clone arrays", () => {
  const stateManager = new StateManager();

  stateManager.set("arr", [1, 2, 3]);

  stateManager.beginTransaction();
  const arr = stateManager.get("arr") as number[];
  arr.push(4);

  stateManager.rollbackTransaction();

  const afterRollback = stateManager.get("arr") as number[];
  assertEquals(afterRollback, [1, 2, 3]);
});

Deno.test("StateManager - clone primitives", () => {
  const stateManager = new StateManager();

  stateManager.setState({
    str: "string",
    num: 42,
    bool: true,
    nullVal: null,
    undefinedVal: undefined
  });

  stateManager.beginTransaction();
  stateManager.setState({
    str: "changed",
    num: 999,
    bool: false
  });

  stateManager.rollbackTransaction();

  assertEquals(stateManager.get("str"), "string");
  assertEquals(stateManager.get("num"), 42);
  assertEquals(stateManager.get("bool"), true);
  assertEquals(stateManager.get("nullVal"), null);
  assertEquals(stateManager.get("undefinedVal"), undefined);
});

Deno.test("StateManager - clone nested structures", () => {
  const stateManager = new StateManager();

  const complex = {
    level1: {
      level2: {
        level3: {
          array: [{ id: 1 }, { id: 2 }],
          value: "deep"
        }
      }
    },
    topArray: [1, [2, [3, 4]]]
  };

  stateManager.set("complex", complex);

  stateManager.beginTransaction();
  const retrieved = stateManager.get("complex") as any;
  retrieved.level1.level2.level3.value = "modified";
  retrieved.topArray[1][1][0] = 999;

  stateManager.rollbackTransaction();

  const original = stateManager.get("complex") as any;
  assertEquals(original.level1.level2.level3.value, "deep");
  assertEquals(original.topArray[1][1][0], 3);
});

Deno.test("StateManager - clone maintains independence", () => {
  const stateManager = new StateManager();

  stateManager.set("data", { count: 0 });

  const snapshot1 = stateManager.createSnapshot();

  stateManager.set("data", { count: 1 });
  const snapshot2 = stateManager.createSnapshot();

  stateManager.set("data", { count: 2 });

  // Restore snapshot1
  stateManager.restoreSnapshot(snapshot1);
  assertEquals((stateManager.get("data") as any).count, 0);

  // Restore snapshot2
  stateManager.restoreSnapshot(snapshot2);
  assertEquals((stateManager.get("data") as any).count, 1);

  // Snapshots should maintain independent copies
  stateManager.restoreSnapshot(snapshot1);
  assertEquals((stateManager.get("data") as any).count, 0);
});

// ============================================================================
// Edge Cases Tests (6 tests)
// ============================================================================

Deno.test("StateManager - undefined and null values", () => {
  const stateManager = new StateManager();

  stateManager.set("nullKey", null);
  stateManager.set("undefinedKey", undefined);

  assertEquals(stateManager.get("nullKey"), null);
  assertEquals(stateManager.get("undefinedKey"), undefined);

  const snapshot = stateManager.createSnapshot();
  stateManager.set("nullKey", "changed");

  stateManager.restoreSnapshot(snapshot);
  assertEquals(stateManager.get("nullKey"), null);
});

Deno.test("StateManager - large state objects", () => {
  const stateManager = new StateManager();

  // Create very large nested structure
  const largeData: Record<string, unknown> = {};
  for (let i = 0; i < 500; i++) {
    largeData[`key${i}`] = {
      id: i,
      data: Array(100).fill(i),
      nested: {
        deep: {
          value: `value_${i}`
        }
      }
    };
  }

  stateManager.set("largeData", largeData);
  stateManager.beginTransaction();

  const retrieved = stateManager.get("largeData") as any;
  retrieved.key0.data[0] = 999;

  stateManager.rollbackTransaction();

  const afterRollback = stateManager.get("largeData") as any;
  assertEquals(afterRollback.key0.data[0], 0);
});

Deno.test("StateManager - concurrent snapshot and transaction", () => {
  const stateManager = new StateManager();

  stateManager.setState({ value: "original" });
  const snapshot = stateManager.createSnapshot();

  stateManager.beginTransaction();
  stateManager.set("value", "inTransaction");

  // Restore snapshot while in transaction - should affect transaction state
  stateManager.restoreSnapshot(snapshot);
  assertEquals(stateManager.get("value"), "original");

  // Commit the transaction with restored state
  stateManager.commitTransaction();
  assertEquals(stateManager.get("value"), "original");

  // Start new transaction
  stateManager.beginTransaction();
  stateManager.set("value", "newTransaction");
  stateManager.commitTransaction();

  assertEquals(stateManager.get("value"), "newTransaction");
});

Deno.test("StateManager - special object types", () => {
  const stateManager = new StateManager();

  const date = new Date("2024-01-01");
  const regex = /test/gi;

  stateManager.set("date", date);
  stateManager.set("regex", regex);

  stateManager.beginTransaction();

  const retrievedDate = stateManager.get("date") as Date;
  const retrievedRegex = stateManager.get("regex") as RegExp;

  assert(retrievedDate instanceof Date);
  assert(retrievedRegex instanceof RegExp);
  assertEquals(retrievedRegex.source, "test");
  assertEquals(retrievedRegex.flags, "gi");

  stateManager.rollbackTransaction();
});

Deno.test("StateManager - Map and Set in state", () => {
  const stateManager = new StateManager();

  const map = new Map([["key1", "value1"], ["key2", "value2"]]);
  const set = new Set([1, 2, 3]);

  stateManager.set("map", map);
  stateManager.set("set", set);

  stateManager.beginTransaction();

  const txMap = stateManager.get("map") as Map<string, string>;
  const txSet = stateManager.get("set") as Set<number>;

  assert(txMap instanceof Map);
  assert(txSet instanceof Set);
  assertEquals(txMap.get("key1"), "value1");
  assert(txSet.has(2));

  stateManager.rollbackTransaction();
});

Deno.test("StateManager - delete operation in transaction", () => {
  const stateManager = new StateManager();

  stateManager.setState({ key1: "value1", key2: "value2", key3: "value3" });

  stateManager.beginTransaction();

  stateManager.delete("key2");
  assertEquals(stateManager.has("key2"), false);
  assertEquals(stateManager.has("key1"), true);
  assertEquals(stateManager.has("key3"), true);

  stateManager.rollbackTransaction();

  // After rollback, key2 should exist again
  assertEquals(stateManager.has("key2"), true);
  assertEquals(stateManager.get("key2"), "value2");
});

// ============================================================================
// Additional Integration Tests (2 tests)
// ============================================================================

Deno.test("StateManager - complex workflow with snapshots and transactions", () => {
  const stateManager = new StateManager();

  // Initial state
  stateManager.setState({ step: 0, data: [] });
  const initialSnapshot = stateManager.createSnapshot();

  // Step 1: Add data
  stateManager.set("step", 1);
  stateManager.set("data", [1, 2, 3]);
  const step1Snapshot = stateManager.createSnapshot();

  // Step 2: Transaction that commits
  stateManager.beginTransaction();
  stateManager.set("step", 2);
  stateManager.set("data", [1, 2, 3, 4]);
  stateManager.commitTransaction();
  const step2Snapshot = stateManager.createSnapshot();

  // Step 3: Transaction that rolls back
  stateManager.beginTransaction();
  stateManager.set("step", 999);
  stateManager.set("data", []);
  stateManager.rollbackTransaction();

  // Should still be at step 2
  assertEquals(stateManager.get("step"), 2);
  assertEquals((stateManager.get("data") as number[]).length, 4);

  // Rollback to step 1
  stateManager.restoreSnapshot(step1Snapshot);
  assertEquals(stateManager.get("step"), 1);
  assertEquals((stateManager.get("data") as number[]).length, 3);
});

Deno.test("StateManager - getSnapshots returns all snapshots", () => {
  const stateManager = new StateManager();

  stateManager.setState({ value: 1 });
  const id1 = stateManager.createSnapshot();

  stateManager.setState({ value: 2 });
  const id2 = stateManager.createSnapshot();

  stateManager.setState({ value: 3 });
  const id3 = stateManager.createSnapshot();

  const snapshots = stateManager.getSnapshots();
  assertEquals(snapshots.length, 3);
  assertEquals(snapshots[0].id, id1);
  assertEquals(snapshots[1].id, id2);
  assertEquals(snapshots[2].id, id3);

  // Delete middle snapshot
  stateManager.deleteSnapshot(id2);
  const remaining = stateManager.getSnapshots();
  assertEquals(remaining.length, 2);
  assertEquals(remaining[0].id, id1);
  assertEquals(remaining[1].id, id3);
});
