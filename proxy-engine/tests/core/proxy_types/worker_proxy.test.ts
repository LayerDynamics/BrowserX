/**
 * WorkerProxy Tests
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import { WorkerProxy, type WorkerProxyConfig } from "../../../core/proxy_types/worker_proxy.ts";

Deno.test({
  name: "WorkerProxy - basic functionality",
  fn() {
    // Verify the class can be constructed
    assertExists(WorkerProxy);

    // Verify config interface exists
    const _config: WorkerProxyConfig = {
      workerCount: 2,
      distributionInterval: 500,
    };

    assert(true);
  },
});

Deno.test({
  name: "WorkerProxy - can be instantiated with defaults",
  fn() {
    const proxy = new WorkerProxy();
    assertExists(proxy);
    assertEquals(proxy.isRunning(), false);
    assertEquals(proxy.getWorkerCount(), 0);
  },
});

Deno.test({
  name: "WorkerProxy - can be instantiated with custom config",
  fn() {
    const proxy = new WorkerProxy({
      workerCount: 2,
      distributionInterval: 500,
    });
    assertExists(proxy);

    const stats = proxy.getStats();
    assertEquals(stats.configuredWorkerCount, 2);
    assertEquals(stats.distributionInterval, 500);
  },
});

Deno.test({
  name: "WorkerProxy - getStats returns correct initial state",
  fn() {
    const proxy = new WorkerProxy({ workerCount: 4 });
    const stats = proxy.getStats();

    assertEquals(stats.running, false);
    assertEquals(stats.workerCount, 0);
    assertEquals(stats.configuredWorkerCount, 4);
  },
});

Deno.test({
  name: "WorkerProxy - stop on non-running proxy does not throw",
  fn() {
    const proxy = new WorkerProxy();
    proxy.stop();
    assertEquals(proxy.isRunning(), false);
  },
});

Deno.test({
  name: "WorkerProxy - stop can be called multiple times",
  fn() {
    const proxy = new WorkerProxy();
    proxy.stop();
    proxy.stop();
    proxy.stop();
    assertEquals(proxy.isRunning(), false);
  },
});
