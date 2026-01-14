// tracing.ts - Distributed tracing

interface Span {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  operation: string;
  startTime: number;
  endTime?: number;
  tags: Record<string, string>;
}

class Tracer {
  private spans: Span[] = [];

  /**
   * Start a new trace or continue existing one
   */
  startSpan(operation: string, parentSpan?: Span): Span {
    const span: Span = {
      traceId: parentSpan?.traceId || this.generateId(),
      spanId: this.generateId(),
      parentSpanId: parentSpan?.spanId,
      operation: operation,
      startTime: Date.now(),
      tags: {},
    };

    this.spans.push(span);

    return span;
  }

  /**
   * Finish span
   */
  finishSpan(span: Span): void {
    span.endTime = Date.now();

    const duration = span.endTime - span.startTime;
    console.log(`[TRACE] ${span.operation} (${span.spanId}) took ${duration}ms`);
  }

  /**
   * Add tags to span
   */
  addTags(span: Span, tags: Record<string, string>): void {
    Object.assign(span.tags, tags);
  }

  /**
   * Extract trace context from headers
   */
  extractContext(headers: Record<string, string>): Span | undefined {
    const traceId = headers["x-trace-id"];
    const spanId = headers["x-span-id"];

    if (traceId && spanId) {
      return {
        traceId: traceId,
        spanId: spanId,
        operation: "incoming",
        startTime: Date.now(),
        tags: {},
      };
    }

    return undefined;
  }

  /**
   * Inject trace context into headers
   */
  injectContext(span: Span, headers: Record<string, string>): void {
    headers["x-trace-id"] = span.traceId;
    headers["x-span-id"] = span.spanId;
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 15);
  }

  displayTraces(): void {
    console.log(`\n${"=".repeat(70)}`);
    console.log("Distributed Traces");
    console.log("=".repeat(70));

    const traceMap = new Map<string, Span[]>();

    for (const span of this.spans) {
      if (!traceMap.has(span.traceId)) {
        traceMap.set(span.traceId, []);
      }
      traceMap.get(span.traceId)!.push(span);
    }

    for (const [traceId, spans] of traceMap.entries()) {
      console.log(`\nTrace: ${traceId}`);

      for (const span of spans) {
        const indent = span.parentSpanId ? "  " : "";
        const duration = span.endTime ? span.endTime - span.startTime : "ongoing";
        console.log(`${indent}↳ ${span.operation} (${span.spanId}): ${duration}ms`);

        if (Object.keys(span.tags).length > 0) {
          console.log(`${indent}  Tags:`, JSON.stringify(span.tags));
        }
      }
    }

    console.log("=".repeat(70) + "\n");
  }
}

// Example usage
const tracer = new Tracer();

console.log("=== Distributed Tracing Demo ===\n");

// Simulate incoming request
const incomingHeaders = {};
const rootSpan = tracer.startSpan("proxy_request");
tracer.addTags(rootSpan, { method: "GET", url: "/api/users", client_ip: "192.168.1.100" });

// Inject trace context for forwarding to origin
const forwardHeaders: Record<string, string> = {};
tracer.injectContext(rootSpan, forwardHeaders);

console.log("Forwarding request with trace headers:", forwardHeaders);

// Simulate origin processing
const originSpan = tracer.startSpan("origin_request", rootSpan);
tracer.addTags(originSpan, { backend: "backend-1", host: "api.example.com" });

// Simulate work
await new Promise((resolve) => setTimeout(resolve, 120));

tracer.finishSpan(originSpan);

// Finish root span
tracer.finishSpan(rootSpan);

// Display traces
tracer.displayTraces();

console.log("=== Benefits of Distributed Tracing ===");
console.log("✓ Track requests across multiple services");
console.log("✓ Identify bottlenecks and slow operations");
console.log("✓ Debug issues in microservices architecture");
console.log("✓ Visualize service dependencies");
console.log("✓ Measure end-to-end latency");
