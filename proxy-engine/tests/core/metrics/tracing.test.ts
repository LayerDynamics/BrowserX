/**
 * Tracing Tests
 * Comprehensive tests for distributed tracing functionality
 */

import { assertEquals, assertExists, assert, assertNotEquals } from "@std/assert";
import { Tracer, type Span } from "../../../core/metrics/tracing.ts";

// ============================================================================
// startSpan Tests
// ============================================================================

Deno.test({
  name: "Tracer - startSpan creates span with operation name",
  fn() {
    const tracer = new Tracer();
    const span = tracer.startSpan("test_operation");

    assertEquals(span.operation, "test_operation");
  },
});

Deno.test({
  name: "Tracer - startSpan generates unique traceId",
  fn() {
    const tracer = new Tracer();
    const span1 = tracer.startSpan("operation1");
    const span2 = tracer.startSpan("operation2");

    assertExists(span1.traceId);
    assertExists(span2.traceId);
    assertNotEquals(span1.traceId, span2.traceId);
  },
});

Deno.test({
  name: "Tracer - startSpan generates unique spanId",
  fn() {
    const tracer = new Tracer();
    const span1 = tracer.startSpan("operation1");
    const span2 = tracer.startSpan("operation2");

    assertExists(span1.spanId);
    assertExists(span2.spanId);
    assertNotEquals(span1.spanId, span2.spanId);
  },
});

Deno.test({
  name: "Tracer - startSpan sets startTime",
  fn() {
    const before = Date.now();
    const tracer = new Tracer();
    const span = tracer.startSpan("test");
    const after = Date.now();

    assert(span.startTime >= before);
    assert(span.startTime <= after);
  },
});

Deno.test({
  name: "Tracer - startSpan initializes empty tags",
  fn() {
    const tracer = new Tracer();
    const span = tracer.startSpan("test");

    assertExists(span.tags);
    assertEquals(Object.keys(span.tags).length, 0);
  },
});

Deno.test({
  name: "Tracer - startSpan does not set endTime",
  fn() {
    const tracer = new Tracer();
    const span = tracer.startSpan("test");

    assertEquals(span.endTime, undefined);
  },
});

Deno.test({
  name: "Tracer - startSpan with parent inherits traceId",
  fn() {
    const tracer = new Tracer();
    const parentSpan = tracer.startSpan("parent");
    const childSpan = tracer.startSpan("child", parentSpan);

    assertEquals(childSpan.traceId, parentSpan.traceId);
  },
});

Deno.test({
  name: "Tracer - startSpan with parent sets parentSpanId",
  fn() {
    const tracer = new Tracer();
    const parentSpan = tracer.startSpan("parent");
    const childSpan = tracer.startSpan("child", parentSpan);

    assertEquals(childSpan.parentSpanId, parentSpan.spanId);
  },
});

Deno.test({
  name: "Tracer - startSpan without parent has no parentSpanId",
  fn() {
    const tracer = new Tracer();
    const span = tracer.startSpan("root");

    assertEquals(span.parentSpanId, undefined);
  },
});

Deno.test({
  name: "Tracer - startSpan child has unique spanId",
  fn() {
    const tracer = new Tracer();
    const parentSpan = tracer.startSpan("parent");
    const childSpan = tracer.startSpan("child", parentSpan);

    assertNotEquals(childSpan.spanId, parentSpan.spanId);
  },
});

Deno.test({
  name: "Tracer - startSpan adds span to internal list",
  fn() {
    const tracer = new Tracer();
    tracer.startSpan("span1");
    tracer.startSpan("span2");
    tracer.startSpan("span3");

    assertEquals(tracer.getSpans().length, 3);
  },
});

// ============================================================================
// finishSpan Tests
// ============================================================================

Deno.test({
  name: "Tracer - finishSpan sets endTime",
  fn() {
    const tracer = new Tracer();
    const span = tracer.startSpan("test");

    assertEquals(span.endTime, undefined);

    tracer.finishSpan(span);

    assertExists(span.endTime);
    assert(span.endTime! >= span.startTime);
  },
});

Deno.test({
  name: "Tracer - finishSpan endTime is after startTime",
  async fn() {
    const tracer = new Tracer();
    const span = tracer.startSpan("test");

    // Simulate some work
    await new Promise((resolve) => setTimeout(resolve, 10));

    tracer.finishSpan(span);

    assert(span.endTime! >= span.startTime);
  },
});

Deno.test({
  name: "Tracer - finishSpan can be called multiple times",
  fn() {
    const tracer = new Tracer();
    const span = tracer.startSpan("test");

    tracer.finishSpan(span);
    const firstEndTime = span.endTime;

    // Wait a bit and finish again
    tracer.finishSpan(span);

    // End time should be updated
    assert(span.endTime! >= firstEndTime!);
  },
});

// ============================================================================
// addTags Tests
// ============================================================================

Deno.test({
  name: "Tracer - addTags adds single tag",
  fn() {
    const tracer = new Tracer();
    const span = tracer.startSpan("test");

    tracer.addTags(span, { method: "GET" });

    assertEquals(span.tags["method"], "GET");
  },
});

Deno.test({
  name: "Tracer - addTags adds multiple tags",
  fn() {
    const tracer = new Tracer();
    const span = tracer.startSpan("test");

    tracer.addTags(span, {
      method: "POST",
      url: "/api/users",
      status: "200",
    });

    assertEquals(span.tags["method"], "POST");
    assertEquals(span.tags["url"], "/api/users");
    assertEquals(span.tags["status"], "200");
  },
});

Deno.test({
  name: "Tracer - addTags merges with existing tags",
  fn() {
    const tracer = new Tracer();
    const span = tracer.startSpan("test");

    tracer.addTags(span, { method: "GET" });
    tracer.addTags(span, { url: "/api" });

    assertEquals(span.tags["method"], "GET");
    assertEquals(span.tags["url"], "/api");
  },
});

Deno.test({
  name: "Tracer - addTags overwrites existing tag",
  fn() {
    const tracer = new Tracer();
    const span = tracer.startSpan("test");

    tracer.addTags(span, { status: "pending" });
    tracer.addTags(span, { status: "complete" });

    assertEquals(span.tags["status"], "complete");
  },
});

// ============================================================================
// extractContext Tests
// ============================================================================

Deno.test({
  name: "Tracer - extractContext returns span from headers",
  fn() {
    const tracer = new Tracer();
    const headers = {
      "x-trace-id": "abc123",
      "x-span-id": "def456",
    };

    const span = tracer.extractContext(headers);

    assertExists(span);
    assertEquals(span!.traceId, "abc123");
    assertEquals(span!.spanId, "def456");
  },
});

Deno.test({
  name: "Tracer - extractContext returns undefined without trace-id",
  fn() {
    const tracer = new Tracer();
    const headers = {
      "x-span-id": "def456",
    };

    const span = tracer.extractContext(headers);

    assertEquals(span, undefined);
  },
});

Deno.test({
  name: "Tracer - extractContext returns undefined without span-id",
  fn() {
    const tracer = new Tracer();
    const headers = {
      "x-trace-id": "abc123",
    };

    const span = tracer.extractContext(headers);

    assertEquals(span, undefined);
  },
});

Deno.test({
  name: "Tracer - extractContext returns undefined for empty headers",
  fn() {
    const tracer = new Tracer();
    const headers: Record<string, string> = {};

    const span = tracer.extractContext(headers);

    assertEquals(span, undefined);
  },
});

Deno.test({
  name: "Tracer - extractContext sets operation to 'incoming'",
  fn() {
    const tracer = new Tracer();
    const headers = {
      "x-trace-id": "abc123",
      "x-span-id": "def456",
    };

    const span = tracer.extractContext(headers);

    assertEquals(span!.operation, "incoming");
  },
});

Deno.test({
  name: "Tracer - extractContext initializes empty tags",
  fn() {
    const tracer = new Tracer();
    const headers = {
      "x-trace-id": "abc123",
      "x-span-id": "def456",
    };

    const span = tracer.extractContext(headers);

    assertEquals(Object.keys(span!.tags).length, 0);
  },
});

// ============================================================================
// injectContext Tests
// ============================================================================

Deno.test({
  name: "Tracer - injectContext adds trace-id header",
  fn() {
    const tracer = new Tracer();
    const span = tracer.startSpan("test");
    const headers: Record<string, string> = {};

    tracer.injectContext(span, headers);

    assertEquals(headers["x-trace-id"], span.traceId);
  },
});

Deno.test({
  name: "Tracer - injectContext adds span-id header",
  fn() {
    const tracer = new Tracer();
    const span = tracer.startSpan("test");
    const headers: Record<string, string> = {};

    tracer.injectContext(span, headers);

    assertEquals(headers["x-span-id"], span.spanId);
  },
});

Deno.test({
  name: "Tracer - injectContext preserves existing headers",
  fn() {
    const tracer = new Tracer();
    const span = tracer.startSpan("test");
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Authorization": "Bearer token",
    };

    tracer.injectContext(span, headers);

    assertEquals(headers["Content-Type"], "application/json");
    assertEquals(headers["Authorization"], "Bearer token");
    assertExists(headers["x-trace-id"]);
    assertExists(headers["x-span-id"]);
  },
});

// ============================================================================
// Round-trip Tests
// ============================================================================

Deno.test({
  name: "Tracer - inject then extract preserves context",
  fn() {
    const tracer = new Tracer();
    const originalSpan = tracer.startSpan("original");
    const headers: Record<string, string> = {};

    tracer.injectContext(originalSpan, headers);
    const extractedSpan = tracer.extractContext(headers);

    assertExists(extractedSpan);
    assertEquals(extractedSpan!.traceId, originalSpan.traceId);
    assertEquals(extractedSpan!.spanId, originalSpan.spanId);
  },
});

// ============================================================================
// Multi-span Trace Tests
// ============================================================================

Deno.test({
  name: "Tracer - builds multi-span trace hierarchy",
  fn() {
    const tracer = new Tracer();

    const rootSpan = tracer.startSpan("proxy_request");
    const dbSpan = tracer.startSpan("database_query", rootSpan);
    const cacheSpan = tracer.startSpan("cache_lookup", rootSpan);
    const originSpan = tracer.startSpan("origin_request", rootSpan);

    // All should share the same trace ID
    assertEquals(dbSpan.traceId, rootSpan.traceId);
    assertEquals(cacheSpan.traceId, rootSpan.traceId);
    assertEquals(originSpan.traceId, rootSpan.traceId);

    // All should reference root as parent
    assertEquals(dbSpan.parentSpanId, rootSpan.spanId);
    assertEquals(cacheSpan.parentSpanId, rootSpan.spanId);
    assertEquals(originSpan.parentSpanId, rootSpan.spanId);

    // All should have unique span IDs
    const spanIds = new Set([
      rootSpan.spanId,
      dbSpan.spanId,
      cacheSpan.spanId,
      originSpan.spanId,
    ]);
    assertEquals(spanIds.size, 4);
  },
});

Deno.test({
  name: "Tracer - supports nested child spans",
  fn() {
    const tracer = new Tracer();

    const rootSpan = tracer.startSpan("root");
    const level1 = tracer.startSpan("level1", rootSpan);
    const level2 = tracer.startSpan("level2", level1);
    const level3 = tracer.startSpan("level3", level2);

    // All share trace ID
    assertEquals(level1.traceId, rootSpan.traceId);
    assertEquals(level2.traceId, rootSpan.traceId);
    assertEquals(level3.traceId, rootSpan.traceId);

    // Correct parent chain
    assertEquals(level1.parentSpanId, rootSpan.spanId);
    assertEquals(level2.parentSpanId, level1.spanId);
    assertEquals(level3.parentSpanId, level2.spanId);
  },
});

// ============================================================================
// Integration Tests
// ============================================================================

Deno.test({
  name: "Tracer - simulates proxy request flow",
  async fn() {
    const tracer = new Tracer();

    // Incoming request
    const requestSpan = tracer.startSpan("proxy_request");
    tracer.addTags(requestSpan, {
      method: "GET",
      url: "/api/users",
      client_ip: "192.168.1.100",
    });

    // Cache lookup
    const cacheSpan = tracer.startSpan("cache_lookup", requestSpan);
    await new Promise((resolve) => setTimeout(resolve, 5));
    tracer.addTags(cacheSpan, { result: "miss" });
    tracer.finishSpan(cacheSpan);

    // Origin request
    const originSpan = tracer.startSpan("origin_request", requestSpan);
    tracer.addTags(originSpan, {
      backend: "api-server-1",
      host: "api.example.com",
    });
    await new Promise((resolve) => setTimeout(resolve, 10));
    tracer.finishSpan(originSpan);

    // Finish root
    tracer.finishSpan(requestSpan);

    // Verify
    assertEquals(tracer.getSpans().length, 3);
    assert(requestSpan.endTime! >= requestSpan.startTime);
    assert(cacheSpan.endTime! >= cacheSpan.startTime);
    assert(originSpan.endTime! >= originSpan.startTime);
  },
});

Deno.test({
  name: "Tracer - clearSpans removes all spans",
  fn() {
    const tracer = new Tracer();

    tracer.startSpan("span1");
    tracer.startSpan("span2");
    tracer.startSpan("span3");

    assertEquals(tracer.getSpans().length, 3);

    tracer.clearSpans();

    assertEquals(tracer.getSpans().length, 0);
  },
});

Deno.test({
  name: "Tracer - multiple tracers are independent",
  fn() {
    const tracer1 = new Tracer();
    const tracer2 = new Tracer();

    tracer1.startSpan("span1");
    tracer1.startSpan("span2");
    tracer2.startSpan("span3");

    assertEquals(tracer1.getSpans().length, 2);
    assertEquals(tracer2.getSpans().length, 1);
  },
});

// ============================================================================
// Span Interface Tests
// ============================================================================

Deno.test({
  name: "Span - interface has required properties",
  fn() {
    const span: Span = {
      traceId: "trace-123",
      spanId: "span-456",
      operation: "test",
      startTime: Date.now(),
      tags: {},
    };

    assertExists(span.traceId);
    assertExists(span.spanId);
    assertExists(span.operation);
    assertExists(span.startTime);
    assertExists(span.tags);
  },
});

Deno.test({
  name: "Span - interface supports optional properties",
  fn() {
    const span: Span = {
      traceId: "trace-123",
      spanId: "span-456",
      parentSpanId: "parent-789",
      operation: "test",
      startTime: Date.now(),
      endTime: Date.now() + 100,
      tags: { key: "value" },
    };

    assertEquals(span.parentSpanId, "parent-789");
    assertExists(span.endTime);
    assertEquals(span.tags["key"], "value");
  },
});
