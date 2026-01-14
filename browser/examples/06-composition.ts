/**
 * Example 6: Component Composition
 *
 * This example demonstrates how to compose multiple browser components
 * together to build custom workflows. Shows how subsystems can be:
 * - Used independently
 * - Shared between components
 * - Combined for complex operations
 * - Monitored for performance
 */

import { Browser } from "../src/main.ts";
import { RequestPipeline } from "../src/engine/RequestPipeline.ts";
import { RenderingPipeline } from "../src/engine/RenderingPipeline.ts";
import { ScriptExecutor } from "../src/engine/javascript/ScriptExecutor.ts";

console.log("=".repeat(60));
console.log("Example 6: Component Composition");
console.log("=".repeat(60));

// Scenario 1: Custom HTTP client with shared connection pooling
console.log("\n1. Custom HTTP client with shared connection pool...");

const requestPipeline1 = new RequestPipeline();
const requestPipeline2 = new RequestPipeline();

// Make parallel requests
const [result1, result2] = await Promise.all([
    requestPipeline1.get("https://example.com"),
    requestPipeline2.get("https://example.com"),
]);

console.log(`✓ Request 1: ${result1.response.statusCode} (${result1.timing.total}ms)`);
console.log(`✓ Request 2: ${result2.response.statusCode} (${result2.timing.total}ms)`);

// Access shared subsystems
const connectionPool1 = requestPipeline1.getConnectionPool();
const dnsCache1 = requestPipeline1.getDNSCache();

console.log(`Connection pool stats:`, connectionPool1.getStats());
console.log(`DNS cache stats:`, dnsCache1.getStats());

// Scenario 2: Rendering with custom request pipeline
console.log("\n2. Rendering pipeline with shared HTTP client...");

const sharedRequestPipeline = new RequestPipeline();
const renderingPipeline = new RenderingPipeline({
    width: 1024,
    height: 768,
    enableJavaScript: false,
});

// Get rendering pipeline's request pipeline to see its stats
const renderRequestPipeline = renderingPipeline.getRequestPipeline();

// Render a page
const renderResult = await renderingPipeline.render("https://example.com");

console.log(`✓ Rendered page:`);
console.log(`  DOM nodes: ${countNodes(renderResult.dom)}`);
console.log(`  CSS rules: ${renderResult.cssom.getRuleCount()}`);
console.log(`  Resources: ${renderResult.resources.length}`);
console.log(`  Total time: ${renderResult.timing.total}ms`);

// Access render pipeline's subsystems
const compositor = renderingPipeline.getCompositor();
const compositorStats = compositor.getStats();
console.log(`Compositor stats:`, compositorStats);

// Scenario 3: Full browser with access to all subsystems
console.log("\n3. Full browser with composable access...");

const browser = new Browser({
    width: 1280,
    height: 720,
    enableJavaScript: false,
    enableStorage: true,
});

// Navigate to a page
await browser.navigate("https://example.com");

// Access all major subsystems
const browserRequestPipeline = browser.getRequestPipeline();
const browserRenderingPipeline = browser.getRenderingPipeline();
const storageManager = browser.getStorageManager();
const cookieManager = browser.getCookieManager();
const quotaManager = browser.getQuotaManager();

console.log(`✓ Accessed all browser subsystems`);

// Get DNS cache from request pipeline
const dnsCache = browserRequestPipeline.getDNSCache();
const dnsStats = dnsCache.getStats();
console.log(`DNS cache - hits: ${dnsStats.hits}, misses: ${dnsStats.misses}`);

// Get connection pool stats
const connectionPool = browserRequestPipeline.getConnectionPool();
const poolStats = connectionPool.getStats();
console.log(`Connection pool - total: ${poolStats.totalConnections}, idle: ${poolStats.idleConnections}`);

// Get compositor from rendering pipeline
const browserCompositor = browserRenderingPipeline.getCompositor();
console.log(`Compositor layers: ${browserCompositor.getStats().layerCount}`);

// Storage operations
const localStorage = storageManager.getLocalStorage("https://example.com");
localStorage.setItem("visited", "true");
console.log(`✓ Set localStorage item`);

cookieManager.setCookie("https://example.com", {
    name: "session",
    value: "composed-workflow",
    domain: "example.com",
    path: "/",
});
console.log(`✓ Set cookie`);

// Scenario 4: Custom workflow - fetch + parse + execute
console.log("\n4. Custom workflow: fetch → parse → execute...");

// Step 1: Fetch HTML
const customRequestPipeline = new RequestPipeline();
const htmlResponse = await customRequestPipeline.get("https://example.com");
console.log(`✓ Fetched HTML (${htmlResponse.response.body.byteLength} bytes)`);

// Step 2: Parse HTML to DOM
const customRenderPipeline = new RenderingPipeline({
    width: 800,
    height: 600,
    enableJavaScript: false,
});

const parseResult = await customRenderPipeline.render("https://example.com");
console.log(`✓ Parsed HTML to DOM (${countNodes(parseResult.dom)} nodes)`);

// Step 3: Execute JavaScript on DOM
if (parseResult.scriptExecutor) {
    const executor = parseResult.scriptExecutor;

    // Execute custom script
    const scriptResult = await executor.execute(`
        // DOM manipulation
        const title = "Custom Workflow";
        console.log("Running in custom workflow:", title);
        title;
    `);

    console.log(`✓ Executed script: ${scriptResult.value}`);

    // Access V8 subsystems
    const isolate = executor.getIsolate();
    const heapStats = isolate.getHeapStatistics();
    console.log(`  V8 heap used: ${heapStats.usedHeapSize} bytes`);

    const eventLoop = executor.getEventLoop();
    console.log(`  Pending tasks: ${eventLoop.hasPendingTasks()}`);

    await executor.dispose();
}

// Scenario 5: Performance monitoring across subsystems
console.log("\n5. Performance monitoring across all subsystems...");

// Collect stats from all components
const stats = {
    browser: browser.getStats(),
    requestPipeline: {
        dns: browserRequestPipeline.getDNSCache().getStats(),
        connectionPool: browserRequestPipeline.getConnectionPool().getStats(),
    },
    rendering: browserRenderingPipeline.getStats(),
    storage: {
        quota: quotaManager.getGlobalQuotaInfo(),
        cookies: cookieManager.getCookieCount(),
    },
};

console.log(`\nComprehensive statistics:`);
console.log(JSON.stringify(stats, null, 2));

// Scenario 6: Cleanup and resource management
console.log("\n6. Cleanup and resource management...");

// Close individual pipelines
await customRequestPipeline.close();
await customRenderPipeline.close();
await requestPipeline1.close();
await requestPipeline2.close();
await sharedRequestPipeline.close();
await renderingPipeline.close();
console.log(`✓ Closed standalone pipelines`);

// Close browser (closes its subsystems)
await browser.close();
console.log(`✓ Closed browser and all subsystems`);

console.log("\n" + "=".repeat(60));
console.log("Example complete!");
console.log("Demonstrated: component composition, subsystem sharing,");
console.log("custom workflows, performance monitoring, and cleanup.");
console.log("=".repeat(60));

// Helper function
function countNodes(node: any): number {
    let count = 1;
    if (node.childNodes) {
        for (const child of node.childNodes) {
            count += countNodes(child);
        }
    }
    return count;
}
