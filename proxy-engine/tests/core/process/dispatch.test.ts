/**
 * Process Dispatcher Tests
 * Comprehensive tests for ProcessDispatcher functionality
 */

import { assertEquals, assertExists, assert, assertRejects } from "@std/assert";
import {
  ProcessDispatcher,
  DispatchStrategy,
  type Task,
  type WorkerInfo,
  type ProcessID,
} from "../../../core/process/dispatch.ts";

// ============================================================================
// Helper Functions
// ============================================================================

function createTestWorker(overrides?: Partial<WorkerInfo>): WorkerInfo {
  return {
    id: `worker-${Date.now()}-${Math.random()}` as ProcessID,
    pid: Math.floor(Math.random() * 10000),
    busy: false,
    currentTasks: 0,
    totalProcessed: 0,
    averageTime: 0,
    lastUsed: new Date(),
    ...overrides,
  };
}

function createTestTask<T>(data: T, overrides?: Partial<Task<T>>): Task<T> {
  return {
    id: `task-${Date.now()}-${Math.random()}`,
    data,
    priority: "normal",
    ...overrides,
  };
}

// ============================================================================
// Constructor / Initialization Tests
// ============================================================================

Deno.test({
  name: "ProcessDispatcher - can be instantiated with default strategy",
  fn() {
    const dispatcher = new ProcessDispatcher();
    assertExists(dispatcher);
  },
});

Deno.test({
  name: "ProcessDispatcher - can be instantiated with custom strategy",
  fn() {
    const dispatcher = new ProcessDispatcher(DispatchStrategy.LEAST_BUSY);
    assertExists(dispatcher);
  },
});

Deno.test({
  name: "ProcessDispatcher - starts with no workers",
  fn() {
    const dispatcher = new ProcessDispatcher();
    assertEquals(dispatcher.getAllWorkers().length, 0);
  },
});

Deno.test({
  name: "ProcessDispatcher - starts with empty queue",
  fn() {
    const dispatcher = new ProcessDispatcher();
    assertEquals(dispatcher.getQueueSize(), 0);
    assertEquals(dispatcher.getPendingCount(), 0);
  },
});

// ============================================================================
// DispatchStrategy Enum Tests
// ============================================================================

Deno.test({
  name: "DispatchStrategy - has all expected values",
  fn() {
    assertEquals(DispatchStrategy.ROUND_ROBIN, "round_robin");
    assertEquals(DispatchStrategy.LEAST_BUSY, "least_busy");
    assertEquals(DispatchStrategy.RANDOM, "random");
    assertEquals(DispatchStrategy.WEIGHTED, "weighted");
    assertEquals(DispatchStrategy.PRIORITY, "priority");
  },
});

// ============================================================================
// registerWorker Tests
// ============================================================================

Deno.test({
  name: "ProcessDispatcher - registerWorker adds worker",
  fn() {
    const dispatcher = new ProcessDispatcher();
    const worker = createTestWorker();

    dispatcher.registerWorker(worker);

    assertEquals(dispatcher.getAllWorkers().length, 1);
    assertExists(dispatcher.getWorker(worker.id));
  },
});

Deno.test({
  name: "ProcessDispatcher - registerWorker handles multiple workers",
  fn() {
    const dispatcher = new ProcessDispatcher();
    const worker1 = createTestWorker({ id: "worker-1" as ProcessID });
    const worker2 = createTestWorker({ id: "worker-2" as ProcessID });
    const worker3 = createTestWorker({ id: "worker-3" as ProcessID });

    dispatcher.registerWorker(worker1);
    dispatcher.registerWorker(worker2);
    dispatcher.registerWorker(worker3);

    assertEquals(dispatcher.getAllWorkers().length, 3);
  },
});

Deno.test({
  name: "ProcessDispatcher - registerWorker replaces existing worker with same ID",
  fn() {
    const dispatcher = new ProcessDispatcher();
    const worker1 = createTestWorker({ id: "worker-1" as ProcessID, pid: 1000 });
    const worker2 = createTestWorker({ id: "worker-1" as ProcessID, pid: 2000 });

    dispatcher.registerWorker(worker1);
    dispatcher.registerWorker(worker2);

    assertEquals(dispatcher.getAllWorkers().length, 1);
    assertEquals(dispatcher.getWorker("worker-1" as ProcessID)?.pid, 2000);
  },
});

// ============================================================================
// unregisterWorker Tests
// ============================================================================

Deno.test({
  name: "ProcessDispatcher - unregisterWorker removes worker",
  fn() {
    const dispatcher = new ProcessDispatcher();
    const worker = createTestWorker({ id: "worker-1" as ProcessID });

    dispatcher.registerWorker(worker);
    assertEquals(dispatcher.getAllWorkers().length, 1);

    dispatcher.unregisterWorker(worker.id);
    assertEquals(dispatcher.getAllWorkers().length, 0);
    assertEquals(dispatcher.getWorker(worker.id), undefined);
  },
});

Deno.test({
  name: "ProcessDispatcher - unregisterWorker handles non-existent worker",
  fn() {
    const dispatcher = new ProcessDispatcher();
    // Should not throw
    dispatcher.unregisterWorker("non-existent" as ProcessID);
    assertEquals(dispatcher.getAllWorkers().length, 0);
  },
});

// ============================================================================
// dispatch Tests
// ============================================================================

Deno.test({
  name: "ProcessDispatcher - dispatch assigns task to available worker",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const dispatcher = new ProcessDispatcher();
    const worker = createTestWorker({ id: "worker-1" as ProcessID });
    dispatcher.registerWorker(worker);

    const task = createTestTask("test-data");
    const workerId = await dispatcher.dispatch(task);

    assertEquals(workerId, worker.id);
    assertEquals(dispatcher.getPendingCount(), 1);
  },
});

Deno.test({
  name: "ProcessDispatcher - dispatch marks worker as busy",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const dispatcher = new ProcessDispatcher();
    const worker = createTestWorker({ id: "worker-1" as ProcessID });
    dispatcher.registerWorker(worker);

    const task = createTestTask("test-data");
    await dispatcher.dispatch(task);

    const updatedWorker = dispatcher.getWorker(worker.id);
    assertEquals(updatedWorker?.busy, true);
    assertEquals(updatedWorker?.currentTasks, 1);
  },
});

Deno.test({
  name: "ProcessDispatcher - dispatch queues task when no workers available",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const dispatcher = new ProcessDispatcher();
    const task = createTestTask("test-data");

    await assertRejects(
      () => dispatcher.dispatch(task),
      Error,
      "No available workers"
    );

    assertEquals(dispatcher.getQueueSize(), 1);
  },
});

Deno.test({
  name: "ProcessDispatcher - dispatch updates lastUsed timestamp",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const dispatcher = new ProcessDispatcher();
    const oldDate = new Date(2000, 1, 1);
    const worker = createTestWorker({ id: "worker-1" as ProcessID, lastUsed: oldDate });
    dispatcher.registerWorker(worker);

    const task = createTestTask("test-data");
    await dispatcher.dispatch(task);

    const updatedWorker = dispatcher.getWorker(worker.id);
    assert(updatedWorker!.lastUsed > oldDate);
  },
});

// ============================================================================
// completeTask Tests
// ============================================================================

Deno.test({
  name: "ProcessDispatcher - completeTask decrements currentTasks",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const dispatcher = new ProcessDispatcher();
    const worker = createTestWorker({ id: "worker-1" as ProcessID });
    dispatcher.registerWorker(worker);

    const task = createTestTask("test-data");
    await dispatcher.dispatch(task);

    assertEquals(dispatcher.getWorker(worker.id)?.currentTasks, 1);

    dispatcher.completeTask(task.id, worker.id, 100);

    assertEquals(dispatcher.getWorker(worker.id)?.currentTasks, 0);
    assertEquals(dispatcher.getWorker(worker.id)?.busy, false);
  },
});

Deno.test({
  name: "ProcessDispatcher - completeTask increments totalProcessed",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const dispatcher = new ProcessDispatcher();
    const worker = createTestWorker({ id: "worker-1" as ProcessID });
    dispatcher.registerWorker(worker);

    const task1 = createTestTask("data-1");
    const task2 = createTestTask("data-2");

    await dispatcher.dispatch(task1);
    dispatcher.completeTask(task1.id, worker.id, 100);

    await dispatcher.dispatch(task2);
    dispatcher.completeTask(task2.id, worker.id, 100);

    assertEquals(dispatcher.getWorker(worker.id)?.totalProcessed, 2);
  },
});

Deno.test({
  name: "ProcessDispatcher - completeTask updates averageTime",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const dispatcher = new ProcessDispatcher();
    const worker = createTestWorker({ id: "worker-1" as ProcessID });
    dispatcher.registerWorker(worker);

    const task1 = createTestTask("data-1");
    await dispatcher.dispatch(task1);
    dispatcher.completeTask(task1.id, worker.id, 100);

    assertEquals(dispatcher.getWorker(worker.id)?.averageTime, 100);

    const task2 = createTestTask("data-2");
    await dispatcher.dispatch(task2);
    dispatcher.completeTask(task2.id, worker.id, 200);

    // Average of 100 and 200 = 150
    assertEquals(dispatcher.getWorker(worker.id)?.averageTime, 150);
  },
});

Deno.test({
  name: "ProcessDispatcher - completeTask removes from pending",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const dispatcher = new ProcessDispatcher();
    const worker = createTestWorker({ id: "worker-1" as ProcessID });
    dispatcher.registerWorker(worker);

    const task = createTestTask("test-data");
    await dispatcher.dispatch(task);

    assertEquals(dispatcher.getPendingCount(), 1);

    dispatcher.completeTask(task.id, worker.id, 100);

    assertEquals(dispatcher.getPendingCount(), 0);
  },
});

// ============================================================================
// Strategy Tests - Round Robin
// ============================================================================

Deno.test({
  name: "ProcessDispatcher - ROUND_ROBIN cycles through workers",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const dispatcher = new ProcessDispatcher(DispatchStrategy.ROUND_ROBIN);

    const worker1 = createTestWorker({ id: "worker-1" as ProcessID });
    const worker2 = createTestWorker({ id: "worker-2" as ProcessID });
    const worker3 = createTestWorker({ id: "worker-3" as ProcessID });

    dispatcher.registerWorker(worker1);
    dispatcher.registerWorker(worker2);
    dispatcher.registerWorker(worker3);

    // Dispatch and complete tasks to observe rotation
    const task1 = createTestTask("data-1");
    const workerId1 = await dispatcher.dispatch(task1);
    dispatcher.completeTask(task1.id, workerId1, 10);

    const task2 = createTestTask("data-2");
    const workerId2 = await dispatcher.dispatch(task2);
    dispatcher.completeTask(task2.id, workerId2, 10);

    const task3 = createTestTask("data-3");
    const workerId3 = await dispatcher.dispatch(task3);
    dispatcher.completeTask(task3.id, workerId3, 10);

    // Workers should have rotated
    const workers = new Set([workerId1, workerId2, workerId3]);
    assertEquals(workers.size, 3);
  },
});

// ============================================================================
// Strategy Tests - Least Busy
// ============================================================================

Deno.test({
  name: "ProcessDispatcher - LEAST_BUSY selects worker with fewest tasks",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const dispatcher = new ProcessDispatcher(DispatchStrategy.LEAST_BUSY);

    const worker1 = createTestWorker({ id: "worker-1" as ProcessID, currentTasks: 5, busy: false });
    const worker2 = createTestWorker({ id: "worker-2" as ProcessID, currentTasks: 1, busy: false });
    const worker3 = createTestWorker({ id: "worker-3" as ProcessID, currentTasks: 3, busy: false });

    dispatcher.registerWorker(worker1);
    dispatcher.registerWorker(worker2);
    dispatcher.registerWorker(worker3);

    const task = createTestTask("data");
    const workerId = await dispatcher.dispatch(task);

    assertEquals(workerId, "worker-2");
  },
});

// ============================================================================
// Strategy Tests - Weighted
// ============================================================================

Deno.test({
  name: "ProcessDispatcher - WEIGHTED prefers lower average time",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const dispatcher = new ProcessDispatcher(DispatchStrategy.WEIGHTED);

    const worker1 = createTestWorker({ id: "worker-1" as ProcessID, averageTime: 500 });
    const worker2 = createTestWorker({ id: "worker-2" as ProcessID, averageTime: 100 });
    const worker3 = createTestWorker({ id: "worker-3" as ProcessID, averageTime: 300 });

    dispatcher.registerWorker(worker1);
    dispatcher.registerWorker(worker2);
    dispatcher.registerWorker(worker3);

    const task = createTestTask("data");
    const workerId = await dispatcher.dispatch(task);

    assertEquals(workerId, "worker-2");
  },
});

// ============================================================================
// Strategy Tests - Priority
// ============================================================================

Deno.test({
  name: "ProcessDispatcher - PRIORITY uses least busy for high priority",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const dispatcher = new ProcessDispatcher(DispatchStrategy.PRIORITY);

    const worker1 = createTestWorker({ id: "worker-1" as ProcessID, currentTasks: 5, busy: false });
    const worker2 = createTestWorker({ id: "worker-2" as ProcessID, currentTasks: 1, busy: false });

    dispatcher.registerWorker(worker1);
    dispatcher.registerWorker(worker2);

    const task = createTestTask("data", { priority: "high" });
    const workerId = await dispatcher.dispatch(task);

    assertEquals(workerId, "worker-2");
  },
});

// ============================================================================
// getWorker Tests
// ============================================================================

Deno.test({
  name: "ProcessDispatcher - getWorker returns correct worker",
  fn() {
    const dispatcher = new ProcessDispatcher();
    const worker = createTestWorker({ id: "worker-1" as ProcessID, pid: 12345 });
    dispatcher.registerWorker(worker);

    const retrieved = dispatcher.getWorker("worker-1" as ProcessID);
    assertExists(retrieved);
    assertEquals(retrieved.pid, 12345);
  },
});

Deno.test({
  name: "ProcessDispatcher - getWorker returns undefined for non-existent worker",
  fn() {
    const dispatcher = new ProcessDispatcher();
    assertEquals(dispatcher.getWorker("non-existent" as ProcessID), undefined);
  },
});

// ============================================================================
// getAllWorkers Tests
// ============================================================================

Deno.test({
  name: "ProcessDispatcher - getAllWorkers returns all workers",
  fn() {
    const dispatcher = new ProcessDispatcher();

    dispatcher.registerWorker(createTestWorker({ id: "w1" as ProcessID }));
    dispatcher.registerWorker(createTestWorker({ id: "w2" as ProcessID }));
    dispatcher.registerWorker(createTestWorker({ id: "w3" as ProcessID }));

    assertEquals(dispatcher.getAllWorkers().length, 3);
  },
});

Deno.test({
  name: "ProcessDispatcher - getAllWorkers returns empty array when no workers",
  fn() {
    const dispatcher = new ProcessDispatcher();
    assertEquals(dispatcher.getAllWorkers(), []);
  },
});

// ============================================================================
// getAvailableWorkers Tests
// ============================================================================

Deno.test({
  name: "ProcessDispatcher - getAvailableWorkers returns only non-busy workers",
  fn() {
    const dispatcher = new ProcessDispatcher();

    dispatcher.registerWorker(createTestWorker({ id: "w1" as ProcessID, busy: false }));
    dispatcher.registerWorker(createTestWorker({ id: "w2" as ProcessID, busy: true }));
    dispatcher.registerWorker(createTestWorker({ id: "w3" as ProcessID, busy: false }));

    assertEquals(dispatcher.getAvailableWorkers().length, 2);
  },
});

// ============================================================================
// Queue Tests
// ============================================================================

Deno.test({
  name: "ProcessDispatcher - getQueueSize returns correct size",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const dispatcher = new ProcessDispatcher();

    // Queue tasks without workers
    try { await dispatcher.dispatch(createTestTask("1")); } catch { /* expected */ }
    try { await dispatcher.dispatch(createTestTask("2")); } catch { /* expected */ }
    try { await dispatcher.dispatch(createTestTask("3")); } catch { /* expected */ }

    assertEquals(dispatcher.getQueueSize(), 3);
  },
});

Deno.test({
  name: "ProcessDispatcher - clearQueue removes all queued tasks",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const dispatcher = new ProcessDispatcher();

    try { await dispatcher.dispatch(createTestTask("1")); } catch { /* expected */ }
    try { await dispatcher.dispatch(createTestTask("2")); } catch { /* expected */ }

    assertEquals(dispatcher.getQueueSize(), 2);

    dispatcher.clearQueue();

    assertEquals(dispatcher.getQueueSize(), 0);
  },
});

// ============================================================================
// getStats Tests
// ============================================================================

Deno.test({
  name: "ProcessDispatcher - getStats returns comprehensive statistics",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const dispatcher = new ProcessDispatcher();

    const worker1 = createTestWorker({ id: "w1" as ProcessID, totalProcessed: 10, averageTime: 100 });
    const worker2 = createTestWorker({ id: "w2" as ProcessID, totalProcessed: 20, averageTime: 200, busy: true });

    dispatcher.registerWorker(worker1);
    dispatcher.registerWorker(worker2);

    const stats = dispatcher.getStats();

    assertEquals(stats.totalWorkers, 2);
    assertEquals(stats.busyWorkers, 1);
    assertEquals(stats.availableWorkers, 1);
    assertEquals(stats.totalProcessed, 30);
    assertEquals(stats.averageProcessingTime, 150);
  },
});

Deno.test({
  name: "ProcessDispatcher - getStats returns zeros when empty",
  fn() {
    const dispatcher = new ProcessDispatcher();
    const stats = dispatcher.getStats();

    assertEquals(stats.totalWorkers, 0);
    assertEquals(stats.busyWorkers, 0);
    assertEquals(stats.availableWorkers, 0);
    assertEquals(stats.queuedTasks, 0);
    assertEquals(stats.pendingTasks, 0);
    assertEquals(stats.totalProcessed, 0);
  },
});

// ============================================================================
// Task Interface Tests
// ============================================================================

Deno.test({
  name: "Task - has correct structure",
  fn() {
    const task: Task<string> = {
      id: "task-123",
      data: "test-data",
      priority: "high",
      timeout: 5000,
      retries: 3,
    };

    assertEquals(task.id, "task-123");
    assertEquals(task.data, "test-data");
    assertEquals(task.priority, "high");
    assertEquals(task.timeout, 5000);
    assertEquals(task.retries, 3);
  },
});

Deno.test({
  name: "Task - works with complex data types",
  fn() {
    interface ComplexData {
      name: string;
      values: number[];
    }

    const task: Task<ComplexData> = {
      id: "task-complex",
      data: {
        name: "test",
        values: [1, 2, 3],
      },
    };

    assertEquals(task.data.name, "test");
    assertEquals(task.data.values.length, 3);
  },
});

// ============================================================================
// WorkerInfo Interface Tests
// ============================================================================

Deno.test({
  name: "WorkerInfo - has correct structure",
  fn() {
    const worker: WorkerInfo = {
      id: "worker-123" as ProcessID,
      pid: 12345,
      busy: true,
      currentTasks: 3,
      totalProcessed: 100,
      averageTime: 150.5,
      lastUsed: new Date(),
    };

    assertEquals(worker.id, "worker-123");
    assertEquals(worker.pid, 12345);
    assertEquals(worker.busy, true);
    assertEquals(worker.currentTasks, 3);
    assertEquals(worker.totalProcessed, 100);
    assertEquals(worker.averageTime, 150.5);
  },
});

// ============================================================================
// Edge Cases and Integration Tests
// ============================================================================

Deno.test({
  name: "ProcessDispatcher - handles many workers",
  fn() {
    const dispatcher = new ProcessDispatcher();

    for (let i = 0; i < 100; i++) {
      dispatcher.registerWorker(createTestWorker({ id: `worker-${i}` as ProcessID }));
    }

    assertEquals(dispatcher.getAllWorkers().length, 100);
  },
});

Deno.test({
  name: "ProcessDispatcher - full lifecycle test",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const dispatcher = new ProcessDispatcher(DispatchStrategy.LEAST_BUSY);

    // Register workers
    const worker1 = createTestWorker({ id: "worker-1" as ProcessID });
    const worker2 = createTestWorker({ id: "worker-2" as ProcessID });
    dispatcher.registerWorker(worker1);
    dispatcher.registerWorker(worker2);

    // Dispatch tasks
    const task1 = createTestTask("data-1");
    const task2 = createTestTask("data-2");

    const workerId1 = await dispatcher.dispatch(task1);
    const workerId2 = await dispatcher.dispatch(task2);

    assertEquals(dispatcher.getPendingCount(), 2);

    // Complete tasks
    dispatcher.completeTask(task1.id, workerId1, 100);
    dispatcher.completeTask(task2.id, workerId2, 150);

    assertEquals(dispatcher.getPendingCount(), 0);

    // Check stats
    const stats = dispatcher.getStats();
    assertEquals(stats.totalProcessed, 2);
    assert(stats.averageProcessingTime > 0);

    // Unregister workers
    dispatcher.unregisterWorker(worker1.id);
    dispatcher.unregisterWorker(worker2.id);

    assertEquals(dispatcher.getAllWorkers().length, 0);
  },
});
