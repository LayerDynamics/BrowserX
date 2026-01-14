/**
 * Example 2: Rendering Pipeline - HTML/CSS Rendering
 *
 * This example demonstrates using the rendering pipeline independently
 * to parse HTML, CSS, and compute layout. Great for:
 * - Server-side rendering
 * - HTML validation
 * - Layout testing
 * - Performance profiling
 */

import { RenderingPipeline } from "../src/engine/RenderingPipeline.ts";

console.log("=".repeat(60));
console.log("Example 2: Rendering Pipeline - HTML/CSS Rendering");
console.log("=".repeat(60));

// Create a standalone rendering pipeline
const pipeline = new RenderingPipeline({
    width: 1024,
    height: 768,
    enableJavaScript: false, // Disable JS for this example
});

// Example 1: Render a simple page
console.log("\n1. Rendering a page...");
const result = await pipeline.render("https://example.com");

console.log(`\nTiming breakdown:`);
console.log(`  HTML fetch: ${result.timing.htmlFetch}ms`);
console.log(`  HTML parse: ${result.timing.htmlParse}ms`);
console.log(`  CSS fetch: ${result.timing.cssFetch}ms`);
console.log(`  CSS parse: ${result.timing.cssParse}ms`);
console.log(`  Style resolution: ${result.timing.styleResolution}ms`);
console.log(`  Layout: ${result.timing.layoutComputation}ms`);
console.log(`  Paint: ${result.timing.paintRecording}ms`);
console.log(`  Total: ${result.timing.total}ms`);

// Example 2: Access DOM tree
console.log("\n2. Inspecting DOM:");
function countNodes(node: any): number {
    let count = 1;
    if (node.childNodes) {
        for (const child of node.childNodes) {
            count += countNodes(child);
        }
    }
    return count;
}

const domNodeCount = countNodes(result.dom);
console.log(`Total DOM nodes: ${domNodeCount}`);
console.log(`Document node type: ${result.dom.nodeType}`);

// Example 3: Access CSSOM
console.log("\n3. Inspecting CSSOM:");
const ruleCount = result.cssom.getRuleCount();
console.log(`Total CSS rules: ${ruleCount}`);

// Example 4: Access layout tree
console.log("\n4. Inspecting layout:");
console.log(`Root layout box:`);
console.log(`  Position: (${result.layoutTree.x}, ${result.layoutTree.y})`);
console.log(`  Size: ${result.layoutTree.width} x ${result.layoutTree.height}`);

// Example 5: Access subsystems
console.log("\n5. Accessing subsystems:");

// Request pipeline (used for fetching HTML/CSS)
const requestPipeline = pipeline.getRequestPipeline();
const dnsCache = requestPipeline.getDNSCache();
const dnsStats = dnsCache.getStats();
console.log(`DNS cache stats - hits: ${dnsStats.hits}, misses: ${dnsStats.misses}`);

// Compositor
const compositor = pipeline.getCompositor();
const compositorStats = compositor.getStats();
console.log(`Compositor - layers: ${compositorStats.layerCount}`);

// Example 6: Resources loaded
console.log("\n6. Resources loaded:");
for (const resource of result.resources) {
    console.log(`  ${resource.type}: ${resource.url} (${resource.size} bytes, ${resource.cached ? "cached" : "fetched"})`);
}

// Example 7: Pipeline statistics
console.log("\n7. Pipeline statistics:");
const stats = pipeline.getStats();
console.log(`Viewport: ${stats.viewport.width}x${stats.viewport.height}`);
console.log(`Total resources: ${stats.resources.total}`);
console.log(`Cached resources: ${stats.resources.cachedCount}`);

// Cleanup
await pipeline.close();

console.log("\n" + "=".repeat(60));
console.log("Example complete!");
console.log("=".repeat(60));
