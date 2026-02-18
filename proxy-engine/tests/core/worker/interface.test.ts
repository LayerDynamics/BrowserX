/**
 * WorkerInterface Tests
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import {
  WorkerState,
  WorkerMessageType,
  createWorkerMessage,
  isTaskMessage,
  isResultMessage,
  isErrorMessage,
} from "../../../core/worker/interface.ts";

// ============================================================================
// WorkerState enum values
// ============================================================================

Deno.test({
  name: "WorkerState - IDLE value is 'idle'",
  fn() { assertEquals(WorkerState.IDLE, "idle"); },
});

Deno.test({
  name: "WorkerState - BUSY value is 'busy'",
  fn() { assertEquals(WorkerState.BUSY, "busy"); },
});

Deno.test({
  name: "WorkerState - PAUSED value is 'paused'",
  fn() { assertEquals(WorkerState.PAUSED, "paused"); },
});

Deno.test({
  name: "WorkerState - TERMINATED value is 'terminated'",
  fn() { assertEquals(WorkerState.TERMINATED, "terminated"); },
});

Deno.test({
  name: "WorkerState - ERROR value is 'error'",
  fn() { assertEquals(WorkerState.ERROR, "error"); },
});

Deno.test({
  name: "WorkerState - has exactly 5 values",
  fn() { assertEquals(Object.values(WorkerState).length, 5); },
});

// ============================================================================
// WorkerMessageType enum values
// ============================================================================

Deno.test({
  name: "WorkerMessageType - TASK value is 'task'",
  fn() { assertEquals(WorkerMessageType.TASK, "task"); },
});

Deno.test({
  name: "WorkerMessageType - RESULT value is 'result'",
  fn() { assertEquals(WorkerMessageType.RESULT, "result"); },
});

Deno.test({
  name: "WorkerMessageType - ERROR value is 'error'",
  fn() { assertEquals(WorkerMessageType.ERROR, "error"); },
});

Deno.test({
  name: "WorkerMessageType - PING value is 'ping'",
  fn() { assertEquals(WorkerMessageType.PING, "ping"); },
});

Deno.test({
  name: "WorkerMessageType - PONG value is 'pong'",
  fn() { assertEquals(WorkerMessageType.PONG, "pong"); },
});

Deno.test({
  name: "WorkerMessageType - TERMINATE value is 'terminate'",
  fn() { assertEquals(WorkerMessageType.TERMINATE, "terminate"); },
});

Deno.test({
  name: "WorkerMessageType - PAUSE value is 'pause'",
  fn() { assertEquals(WorkerMessageType.PAUSE, "pause"); },
});

Deno.test({
  name: "WorkerMessageType - RESUME value is 'resume'",
  fn() { assertEquals(WorkerMessageType.RESUME, "resume"); },
});

Deno.test({
  name: "WorkerMessageType - has exactly 8 values",
  fn() { assertEquals(Object.values(WorkerMessageType).length, 8); },
});

// ============================================================================
// createWorkerMessage()
// ============================================================================

Deno.test({
  name: "createWorkerMessage - creates message with correct type",
  fn() {
    const msg = createWorkerMessage(WorkerMessageType.PING);
    assertEquals(msg.type, WorkerMessageType.PING);
  },
});

Deno.test({
  name: "createWorkerMessage - generates a unique id",
  fn() {
    const msg = createWorkerMessage(WorkerMessageType.TASK);
    assertExists(msg.id);
    assert(msg.id.length > 0);
  },
});

Deno.test({
  name: "createWorkerMessage - sets timestamp to current time",
  fn() {
    const before = Date.now();
    const msg = createWorkerMessage(WorkerMessageType.PING);
    const after = Date.now();
    assert(msg.timestamp >= before && msg.timestamp <= after);
  },
});

Deno.test({
  name: "createWorkerMessage - includes provided data",
  fn() {
    const msg = createWorkerMessage(WorkerMessageType.TASK, { value: 42 });
    assertEquals((msg.data as { value: number }).value, 42);
  },
});

Deno.test({
  name: "createWorkerMessage - two messages have different ids",
  fn() {
    const msg1 = createWorkerMessage(WorkerMessageType.PING);
    const msg2 = createWorkerMessage(WorkerMessageType.PING);
    assert(msg1.id !== msg2.id);
  },
});

// ============================================================================
// Type guard functions
// ============================================================================

Deno.test({
  name: "isTaskMessage - returns true for TASK type",
  fn() { assert(isTaskMessage(createWorkerMessage(WorkerMessageType.TASK))); },
});

Deno.test({
  name: "isTaskMessage - returns false for PING type",
  fn() { assert(!isTaskMessage(createWorkerMessage(WorkerMessageType.PING))); },
});

Deno.test({
  name: "isResultMessage - returns true for RESULT type",
  fn() { assert(isResultMessage(createWorkerMessage(WorkerMessageType.RESULT))); },
});

Deno.test({
  name: "isResultMessage - returns false for ERROR type",
  fn() { assert(!isResultMessage(createWorkerMessage(WorkerMessageType.ERROR))); },
});

Deno.test({
  name: "isErrorMessage - returns true for ERROR type",
  fn() { assert(isErrorMessage(createWorkerMessage(WorkerMessageType.ERROR))); },
});

Deno.test({
  name: "isErrorMessage - returns false for RESULT type",
  fn() { assert(!isErrorMessage(createWorkerMessage(WorkerMessageType.RESULT))); },
});
