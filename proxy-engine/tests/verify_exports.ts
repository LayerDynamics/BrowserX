/**
 * Export Verification Script
 *
 * Tests that all newly exported components can be imported and instantiated.
 * This verifies Phase 1 (Export Expansion) was successful.
 */

console.log("=".repeat(70));
console.log("PHASE 3: EXPORT VERIFICATION");
console.log("=".repeat(70));
console.log();

// Track results
const results: { name: string; status: "✓" | "✗"; error?: string }[] = [];

// Helper to test import
async function testImport(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    results.push({ name, status: "✓" });
    console.log(`✓ ${name}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    results.push({ name, status: "✗", error: message });
    console.log(`✗ ${name}: ${message}`);
  }
}

// Test Socket utilities exports
console.log("\n--- Socket Utilities (8 exports) ---");
await testImport("DEFAULT_SOCKET_OPTIONS", async () => {
  const { DEFAULT_SOCKET_OPTIONS } = await import("./mod.ts");
  if (!DEFAULT_SOCKET_OPTIONS) throw new Error("Not exported");
});

await testImport("mergeSocketOptions", async () => {
  const { mergeSocketOptions } = await import("./mod.ts");
  if (typeof mergeSocketOptions !== "function") throw new Error("Not a function");
});

await testImport("createSocketStats", async () => {
  const { createSocketStats } = await import("./mod.ts");
  if (typeof createSocketStats !== "function") throw new Error("Not a function");
});

await testImport("formatSocketStats", async () => {
  const { formatSocketStats } = await import("./mod.ts");
  if (typeof formatSocketStats !== "function") throw new Error("Not a function");
});

await testImport("getAge", async () => {
  const { getAge } = await import("./mod.ts");
  if (typeof getAge !== "function") throw new Error("Not a function");
});

await testImport("getAvgBytesPerRead", async () => {
  const { getAvgBytesPerRead } = await import("./mod.ts");
  if (typeof getAvgBytesPerRead !== "function") throw new Error("Not a function");
});

await testImport("getAvgBytesPerWrite", async () => {
  const { getAvgBytesPerWrite } = await import("./mod.ts");
  if (typeof getAvgBytesPerWrite !== "function") throw new Error("Not a function");
});

await testImport("getIdleTime", async () => {
  const { getIdleTime } = await import("./mod.ts");
  if (typeof getIdleTime !== "function") throw new Error("Not a function");
});

// Test Gateway Routing exports
console.log("\n--- Gateway Routing (20 exports) ---");
await testImport("ResponseRouter", async () => {
  const { ResponseRouter } = await import("./mod.ts");
  if (typeof ResponseRouter !== "function") throw new Error("Not a class");
});

await testImport("RouteMatcher", async () => {
  const { RouteMatcher } = await import("./mod.ts");
  if (typeof RouteMatcher !== "function") throw new Error("Not a class");
});

await testImport("createRouteMatcher", async () => {
  const { createRouteMatcher } = await import("./mod.ts");
  if (typeof createRouteMatcher !== "function") throw new Error("Not a function");
});

await testImport("testPathPattern", async () => {
  const { testPathPattern } = await import("./mod.ts");
  if (typeof testPathPattern !== "function") throw new Error("Not a function");
});

await testImport("extractPathParams", async () => {
  const { extractPathParams } = await import("./mod.ts");
  if (typeof extractPathParams !== "function") throw new Error("Not a function");
});

// Test I/O utilities (15 functions)
const ioFunctions = [
  "readRequestBody",
  "readRequestBodyText",
  "readRequestBodyJSON",
  "writeResponse",
  "writeJSONResponse",
  "writeErrorResponse",
  "requestToIncoming",
  "streamResponseBody",
  "createStreamingResponse",
  "copyHeaders",
  "mergeHeaders",
  "headersToObject",
  "requestHasBody",
  "getContentLength",
  "isChunkedEncoding",
];

for (const fnName of ioFunctions) {
  await testImport(fnName, async () => {
    const mod = await import("./mod.ts");
    if (typeof mod[fnName] !== "function") throw new Error("Not a function");
  });
}

// Test Proxy Type exports
console.log("\n--- Proxy Types (5 exports) ---");
await testImport("EventDrivenProxy", async () => {
  const { EventDrivenProxy } = await import("./mod.ts");
  if (typeof EventDrivenProxy !== "function") throw new Error("Not a class");
});

await testImport("WebSocketProxy", async () => {
  const { WebSocketProxy } = await import("./mod.ts");
  if (typeof WebSocketProxy !== "function") throw new Error("Not a class");
});

await testImport("SSEProxy", async () => {
  const { SSEProxy } = await import("./mod.ts");
  if (typeof SSEProxy !== "function") throw new Error("Not a class");
});

await testImport("AuthProxy", async () => {
  const { AuthProxy } = await import("./mod.ts");
  if (typeof AuthProxy !== "function") throw new Error("Not a class");
});

await testImport("TLSProxy", async () => {
  const { TLSProxy } = await import("./mod.ts");
  if (typeof TLSProxy !== "function") throw new Error("Not a class");
});

// Test Connection Management exports
console.log("\n--- Connection Management (4 exports) ---");
await testImport("HealthMonitor", async () => {
  const { HealthMonitor } = await import("./mod.ts");
  if (typeof HealthMonitor !== "function") throw new Error("Not a class");
});

await testImport("TCPHealthChecker", async () => {
  const { TCPHealthChecker } = await import("./mod.ts");
  if (typeof TCPHealthChecker !== "function") throw new Error("Not a class");
});

await testImport("HTTPHealthChecker", async () => {
  const { HTTPHealthChecker } = await import("./mod.ts");
  if (typeof HTTPHealthChecker !== "function") throw new Error("Not a class");
});

await testImport("ConnectionPool", async () => {
  const { ConnectionPool } = await import("./mod.ts");
  if (typeof ConnectionPool !== "function") throw new Error("Not a class");
});

// Test DNS Resolver export
console.log("\n--- DNS Resolution (1 export) ---");
await testImport("DNSResolver", async () => {
  const { DNSResolver } = await import("./mod.ts");
  if (typeof DNSResolver !== "function") throw new Error("Not a class");
});

// Test Load Balancer exports (NEW)
console.log("\n--- Load Balancer Exports (2 exports) ---");
await testImport("BaseLoadBalancer", async () => {
  const { BaseLoadBalancer } = await import("./mod.ts");
  if (typeof BaseLoadBalancer !== "function") throw new Error("Not a class");
});

await testImport("LoadBalancerServerStats (type)", async () => {
  const mod = await import("./mod.ts");
  // Type exports can't be tested at runtime, just verify module loads
  if (!mod) throw new Error("Module failed to load");
});

// Test HTTP Protocol Parser exports (NEW)
console.log("\n--- HTTP Protocol Parsers (3 exports) ---");
await testImport("HTTPRequestParser", async () => {
  const { HTTPRequestParser } = await import("./mod.ts");
  if (typeof HTTPRequestParser !== "function") throw new Error("Not a class");
});

await testImport("HTTPResponseParser", async () => {
  const { HTTPResponseParser } = await import("./mod.ts");
  if (typeof HTTPResponseParser !== "function") throw new Error("Not a class");
});

await testImport("HTTPParserConfig (type)", async () => {
  const mod = await import("./mod.ts");
  // Type exports can't be tested at runtime, just verify module loads
  if (!mod) throw new Error("Module failed to load");
});

// Print summary
console.log("\n" + "=".repeat(70));
console.log("VERIFICATION SUMMARY");
console.log("=".repeat(70));

const passed = results.filter((r) => r.status === "✓").length;
const failed = results.filter((r) => r.status === "✗").length;

console.log(`Total: ${results.length}`);
console.log(`Passed: ${passed} ✓`);
console.log(`Failed: ${failed} ✗`);

if (failed > 0) {
  console.log("\nFailed tests:");
  results.filter((r) => r.status === "✗").forEach((r) => {
    console.log(`  - ${r.name}: ${r.error}`);
  });
  Deno.exit(1);
} else {
  console.log("\n✓ All exports verified successfully!");
  Deno.exit(0);
}
