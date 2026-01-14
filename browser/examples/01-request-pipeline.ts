/**
 * Example 1: Request Pipeline - HTTP Networking
 *
 * This example demonstrates using the HTTP networking stack independently
 * without the full browser. Great for:
 * - Building HTTP clients
 * - API testing
 * - Web scraping (HTML only)
 * - Performance monitoring
 */

import { RequestPipeline } from "../src/engine/RequestPipeline.ts";

console.log("=".repeat(60));
console.log("Example 1: Request Pipeline - HTTP Networking");
console.log("=".repeat(60));

// Create a standalone request pipeline
const pipeline = new RequestPipeline();

// Example 1: Make a simple HTTP GET request
console.log("\n1. Making HTTP GET request...");
const result = await pipeline.get("https://example.com");

console.log(`Status: ${result.response.statusCode} ${result.response.statusText}`);
console.log(`From cache: ${result.fromCache}`);
console.log(`Body size: ${result.response.body.byteLength} bytes`);

// Example 2: Access timing information
console.log("\n2. Timing breakdown:");
console.log(`  DNS lookup: ${result.timing.dnsLookup}ms`);
console.log(`  TCP connection: ${result.timing.tcpConnection}ms`);
console.log(`  TLS handshake: ${result.timing.tlsHandshake}ms`);
console.log(`  Request sent: ${result.timing.requestSent}ms`);
console.log(`  First byte: ${result.timing.firstByte}ms`);
console.log(`  Download: ${result.timing.download}ms`);
console.log(`  Total: ${result.timing.total}ms`);

// Example 3: Access subsystems directly
console.log("\n3. Accessing subsystems:");

// DNS resolver
const dnsResolver = pipeline.getDNSResolver();
const addresses = await dnsResolver.resolve("example.com");
console.log(`Resolved addresses: ${addresses.join(", ")}`);

// DNS cache
const dnsCache = pipeline.getDNSCache();
const cacheStats = dnsCache.getStats();
console.log(`DNS cache - hits: ${cacheStats.hits}, misses: ${cacheStats.misses}`);

// Connection pool
const connectionPool = pipeline.getConnectionPool();
const poolStats = connectionPool.getStats();
console.log(`Connection pool - total: ${poolStats.totalConnections}, idle: ${poolStats.idleConnections}`);

// Example 4: Make another request (should use cached DNS and connection)
console.log("\n4. Making second request (should be faster)...");
const result2 = await pipeline.get("https://example.com");
console.log(`Second request total time: ${result2.timing.total}ms`);
console.log(`From cache: ${result2.fromCache}`);

// Example 5: Pipeline statistics
console.log("\n5. Pipeline statistics:");
const stats = pipeline.getStats();
console.log(JSON.stringify(stats, null, 2));

// Cleanup
await pipeline.close();

console.log("\n" + "=".repeat(60));
console.log("Example complete!");
console.log("=".repeat(60));
