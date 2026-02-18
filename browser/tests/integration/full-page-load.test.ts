/**
 * Full Page Load Integration Tests
 *
 * Tests the complete page load pipeline from URL to rendered pixels:
 * Network → HTML Parser → CSS Parser → Render Tree → Layout → Paint → Composite
 *
 * Also tests storage persistence, cookies, JavaScript execution, and edge cases.
 */

import { assertEquals, assertExists, assertGreater, assertRejects } from "@std/assert";
import { Browser } from "../../src/main.ts";
import type { DOMNode, DOMElement } from "../../src/types/dom.ts";

/**
 * Helper: Count DOM nodes recursively
 */
function countNodes(node: DOMNode): number {
    let count = 1;
    if (node.childNodes && node.childNodes.length > 0) {
        for (const child of node.childNodes) {
            count += countNodes(child);
        }
    }
    return count;
}

/**
 * Helper: Find element by tag name
 */
function findElementByTagName(node: DOMNode, tagName: string): DOMElement | null {
    if (node.nodeType === 1 && (node as DOMElement).tagName?.toLowerCase() === tagName.toLowerCase()) {
        return node as DOMElement;
    }
    if (node.childNodes && node.childNodes.length > 0) {
        for (const child of node.childNodes) {
            const found = findElementByTagName(child, tagName);
            if (found) return found;
        }
    }
    return null;
}

/**
 * Helper: Extract text content from node
 */
function getTextContent(node: DOMNode): string {
    if (node.nodeType === 3) { // Text node
        return node.nodeValue || "";
    }
    let text = "";
    if (node.childNodes && node.childNodes.length > 0) {
        for (const child of node.childNodes) {
            text += getTextContent(child);
        }
    }
    return text;
}

Deno.test({
    name: "Full page load - basic HTML to DOM tree",
    sanitizeResources: false,
    sanitizeOps: false,
    async fn() {
        const browser = new Browser({
            width: 800,
            height: 600,
            enableJavaScript: false,
            enableStorage: false,
        });

        const html = `
            <!DOCTYPE html>
            <html>
                <head>
                    <title>Test Page</title>
                </head>
                <body>
                    <h1>Hello World</h1>
                    <p>This is a test page.</p>
                </body>
            </html>
        `;

        const dataUrl = `data:text/html;base64,${btoa(html)}`;
        await browser.navigate(dataUrl);

        const pipeline = browser.getRenderingPipeline();
        const result = pipeline.lastRenderResult;

        assertExists(result, "Rendering result should exist");
        assertExists(result.dom, "DOM tree should exist");
        assertExists(result.renderTree, "Render tree should exist");
        assertExists(result.layoutTree, "Layout tree should exist");
        assertExists(result.displayList, "Display list should exist");

        // Verify DOM structure
        const nodeCount = countNodes(result.dom);
        assertGreater(nodeCount, 5, "Should have multiple DOM nodes");

        // Verify title element exists
        const titleElement = findElementByTagName(result.dom, "title");
        assertExists(titleElement, "Title element should exist");

        await browser.close();
    },
});

Deno.test({
    name: "Full page load - HTML with CSS styling",
    sanitizeResources: false,
    sanitizeOps: false,
    async fn() {
        const browser = new Browser({
            width: 800,
            height: 600,
            enableJavaScript: false,
        });

        const html = `
            <!DOCTYPE html>
            <html>
                <head>
                    <style>
                        body {
                            margin: 0;
                            background-color: red;
                        }
                        h1 {
                            color: blue;
                            font-size: 24px;
                        }
                        .box {
                            width: 100px;
                            height: 100px;
                            background: green;
                        }
                    </style>
                </head>
                <body>
                    <h1>Styled Page</h1>
                    <div class="box"></div>
                </body>
            </html>
        `;

        const dataUrl = `data:text/html;base64,${btoa(html)}`;
        await browser.navigate(dataUrl);

        const pipeline = browser.getRenderingPipeline();
        const result = pipeline.lastRenderResult;

        assertExists(result);
        assertExists(result.cssom);

        // Verify CSS rules were parsed
        const ruleCount = result.cssom.getRuleCount();
        assertGreater(ruleCount, 0, "Should have CSS rules");

        // Verify timing
        assertExists(result.timing.cssFetch);
        assertExists(result.timing.cssParse);
        assertExists(result.timing.styleResolution);

        await browser.close();
    },
});

Deno.test({
    name: "Full page load - timing breakdown is captured",
    sanitizeResources: false,
    sanitizeOps: false,
    async fn() {
        const browser = new Browser({
            width: 800,
            height: 600,
            enableJavaScript: false,
        });

        const html = `<!DOCTYPE html><html><body><h1>Timing Test</h1></body></html>`;
        const dataUrl = `data:text/html;base64,${btoa(html)}`;
        await browser.navigate(dataUrl);

        const pipeline = browser.getRenderingPipeline();
        const result = pipeline.lastRenderResult;

        assertExists(result);
        assertExists(result.timing);

        // All timing fields should be present (may be 0 for some)
        assertEquals(typeof result.timing.htmlFetch, "number");
        assertEquals(typeof result.timing.htmlParse, "number");
        assertEquals(typeof result.timing.cssFetch, "number");
        assertEquals(typeof result.timing.cssParse, "number");
        assertEquals(typeof result.timing.scriptExecution, "number");
        assertEquals(typeof result.timing.styleResolution, "number");
        assertEquals(typeof result.timing.layoutComputation, "number");
        assertEquals(typeof result.timing.paintRecording, "number");
        assertEquals(typeof result.timing.compositing, "number");
        assertEquals(typeof result.timing.total, "number");

        // Total should be sum of all stages
        const sum = result.timing.htmlFetch +
            result.timing.htmlParse +
            result.timing.cssFetch +
            result.timing.cssParse +
            result.timing.scriptExecution +
            result.timing.styleResolution +
            result.timing.layoutComputation +
            result.timing.paintRecording +
            result.timing.compositing;

        assertEquals(result.timing.total, sum);

        await browser.close();
    },
});

Deno.test({
    name: "Full page load - pixels are rendered",
    sanitizeResources: false,
    sanitizeOps: false,
    async fn() {
        const browser = new Browser({
            width: 100,
            height: 100,
            enableJavaScript: false,
        });

        const html = `
            <!DOCTYPE html>
            <html>
                <head>
                    <style>
                        body {
                            margin: 0;
                            background: blue;
                            width: 100px;
                            height: 100px;
                        }
                    </style>
                </head>
                <body></body>
            </html>
        `;

        const dataUrl = `data:text/html;base64,${btoa(html)}`;
        await browser.navigate(dataUrl);

        const pipeline = browser.getRenderingPipeline();
        const pixels = await pipeline.getPixels();

        assertExists(pixels);
        assertEquals(pixels.length, 100 * 100 * 4, "Should have correct pixel count");

        await browser.close();
    },
});

Deno.test({
    name: "Full page load - localStorage persists across navigations",
    sanitizeResources: false,
    sanitizeOps: false,
    async fn() {
        const browser = new Browser({
            width: 800,
            height: 600,
            enableJavaScript: false,
            enableStorage: true,
        });

        // Navigate to first page
        const html1 = `<!DOCTYPE html><html><body><h1>Page 1</h1></body></html>`;
        await browser.navigate(`data:text/html;base64,${btoa(html1)}`);

        // Set localStorage value
        const storage = browser.getStorageManager();
        const localStorage = storage.getLocalStorage("http://example.com");
        localStorage.setItem("test-key", "test-value");

        // Navigate to second page
        const html2 = `<!DOCTYPE html><html><body><h1>Page 2</h1></body></html>`;
        await browser.navigate(`data:text/html;base64,${btoa(html2)}`);

        // Navigate back to first origin
        await browser.navigate(`data:text/html;base64,${btoa(html1)}`);

        // Retrieve value - should persist
        const localStorage2 = storage.getLocalStorage("http://example.com");
        const value = localStorage2.getItem("test-key");
        assertEquals(value, "test-value", "localStorage should persist");

        await browser.close();
    },
});

Deno.test({
    name: "Full page load - cookies are set and retrieved",
    sanitizeResources: false,
    sanitizeOps: false,
    async fn() {
        const browser = new Browser({
            width: 800,
            height: 600,
            enableJavaScript: false,
            enableStorage: true,
        });

        const html = `<!DOCTYPE html><html><body><h1>Cookie Test</h1></body></html>`;
        await browser.navigate(`data:text/html;base64,${btoa(html)}`);

        const cookieManager = browser.getCookieManager();

        // Set a cookie
        cookieManager.setCookie({
            name: "session",
            value: "abc123",
            domain: "example.com",
            path: "/",
            secure: false,
            httpOnly: false,
            sameSite: "Lax",
        }, "http://example.com");

        // Retrieve cookies
        const cookies = cookieManager.getCookies("http://example.com");
        assertEquals(cookies.length, 1);
        assertEquals(cookies[0].name, "session");
        assertEquals(cookies[0].value, "abc123");

        await browser.close();
    },
});

Deno.test({
    name: "Full page load - multiple navigations in same browser instance",
    sanitizeResources: false,
    sanitizeOps: false,
    async fn() {
        const browser = new Browser({
            width: 800,
            height: 600,
            enableJavaScript: false,
        });

        // First navigation
        const html1 = `<!DOCTYPE html><html><head><title>Page 1</title></head><body><h1>First</h1></body></html>`;
        await browser.navigate(`data:text/html;base64,${btoa(html1)}`);

        let pipeline = browser.getRenderingPipeline();
        let result = pipeline.lastRenderResult;
        assertExists(result);
        const titleElement1 = findElementByTagName(result.dom, "title");
        assertExists(titleElement1);

        // Second navigation
        const html2 = `<!DOCTYPE html><html><head><title>Page 2</title></head><body><h1>Second</h1></body></html>`;
        await browser.navigate(`data:text/html;base64,${btoa(html2)}`);

        pipeline = browser.getRenderingPipeline();
        result = pipeline.lastRenderResult;
        assertExists(result);
        const titleElement2 = findElementByTagName(result.dom, "title");
        assertExists(titleElement2);

        // Third navigation
        const html3 = `<!DOCTYPE html><html><head><title>Page 3</title></head><body><h1>Third</h1></body></html>`;
        await browser.navigate(`data:text/html;base64,${btoa(html3)}`);

        pipeline = browser.getRenderingPipeline();
        result = pipeline.lastRenderResult;
        assertExists(result);
        const titleElement3 = findElementByTagName(result.dom, "title");
        assertExists(titleElement3);

        await browser.close();
    },
});

Deno.test({
    name: "Full page load - history navigation (back/forward)",
    sanitizeResources: false,
    sanitizeOps: false,
    async fn() {
        const browser = new Browser({
            width: 800,
            height: 600,
            enableJavaScript: false,
        });

        // Navigate to three pages
        const html1 = `<!DOCTYPE html><html><body><h1>Page 1</h1></body></html>`;
        const html2 = `<!DOCTYPE html><html><body><h1>Page 2</h1></body></html>`;
        const html3 = `<!DOCTYPE html><html><body><h1>Page 3</h1></body></html>`;

        await browser.navigate(`data:text/html;base64,${btoa(html1)}`);
        await browser.navigate(`data:text/html;base64,${btoa(html2)}`);
        await browser.navigate(`data:text/html;base64,${btoa(html3)}`);

        // Go back
        const backResult = await browser.back();
        assertEquals(backResult, true, "Should be able to go back");

        // Go back again
        const backResult2 = await browser.back();
        assertEquals(backResult2, true, "Should be able to go back again");

        // Try to go back at beginning - should fail
        const backResult3 = await browser.back();
        assertEquals(backResult3, false, "Should not be able to go back past beginning");

        // Go forward
        const forwardResult = await browser.forward();
        assertEquals(forwardResult, true, "Should be able to go forward");

        await browser.close();
    },
});

Deno.test({
    name: "Full page load - malformed HTML is gracefully handled",
    sanitizeResources: false,
    sanitizeOps: false,
    async fn() {
        const browser = new Browser({
            width: 800,
            height: 600,
            enableJavaScript: false,
        });

        // Malformed HTML (unclosed tags, no doctype, etc.)
        const html = `
            <html>
                <body>
                    <div>
                        <p>Unclosed paragraph
                        <span>Nested content
                    </div>
        `;

        const dataUrl = `data:text/html;base64,${btoa(html)}`;

        // Should not throw - HTML parser should handle malformed input
        await browser.navigate(dataUrl);

        const pipeline = browser.getRenderingPipeline();
        const result = pipeline.lastRenderResult;

        assertExists(result);
        assertExists(result.dom);

        await browser.close();
    },
});

Deno.test({
    name: "Full page load - empty page (about:blank)",
    sanitizeResources: false,
    sanitizeOps: false,
    async fn() {
        const browser = new Browser({
            width: 800,
            height: 600,
            enableJavaScript: false,
        });

        await browser.navigate("about:blank");

        const pipeline = browser.getRenderingPipeline();
        const result = pipeline.lastRenderResult;

        assertExists(result);
        assertExists(result.dom);
        assertExists(result.renderTree);

        await browser.close();
    },
});

Deno.test({
    name: "Full page load - page with inline styles and external CSS",
    sanitizeResources: false,
    sanitizeOps: false,
    async fn() {
        const browser = new Browser({
            width: 800,
            height: 600,
            enableJavaScript: false,
        });

        const html = `
            <!DOCTYPE html>
            <html>
                <head>
                    <style>
                        body { margin: 0; }
                        .red { color: red; }
                    </style>
                </head>
                <body style="background: white;">
                    <h1 class="red" style="font-size: 24px;">Mixed Styles</h1>
                </body>
            </html>
        `;

        const dataUrl = `data:text/html;base64,${btoa(html)}`;
        await browser.navigate(dataUrl);

        const pipeline = browser.getRenderingPipeline();
        const result = pipeline.lastRenderResult;

        assertExists(result);
        assertExists(result.cssom);

        // Should have parsed both inline and style tag CSS
        const ruleCount = result.cssom.getRuleCount();
        assertGreater(ruleCount, 0);

        await browser.close();
    },
});

Deno.test({
    name: "Full page load - resources are tracked",
    sanitizeResources: false,
    sanitizeOps: false,
    async fn() {
        const browser = new Browser({
            width: 800,
            height: 600,
            enableJavaScript: false,
        });

        const html = `
            <!DOCTYPE html>
            <html>
                <head>
                    <style>body { margin: 0; }</style>
                </head>
                <body>
                    <h1>Resource Tracking</h1>
                </body>
            </html>
        `;

        const dataUrl = `data:text/html;base64,${btoa(html)}`;
        await browser.navigate(dataUrl);

        const pipeline = browser.getRenderingPipeline();
        const result = pipeline.lastRenderResult;

        assertExists(result);
        assertExists(result.resources);

        // Should have at least the HTML resource
        assertGreater(result.resources.length, 0);

        // Verify resource structure
        for (const resource of result.resources) {
            assertExists(resource.url);
            assertExists(resource.type);
            assertEquals(typeof resource.size, "number");
            assertEquals(typeof resource.fetchTime, "number");
            assertEquals(typeof resource.cached, "boolean");
        }

        await browser.close();
    },
});

Deno.test({
    name: "Full page load - complex layout with multiple elements",
    sanitizeResources: false,
    sanitizeOps: false,
    async fn() {
        const browser = new Browser({
            width: 800,
            height: 600,
            enableJavaScript: false,
        });

        const html = `
            <!DOCTYPE html>
            <html>
                <head>
                    <style>
                        .container {
                            display: flex;
                            flex-direction: row;
                        }
                        .box {
                            width: 100px;
                            height: 100px;
                            margin: 10px;
                        }
                        .red { background: red; }
                        .blue { background: blue; }
                        .green { background: green; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="box red"></div>
                        <div class="box blue"></div>
                        <div class="box green"></div>
                    </div>
                    <h1>Complex Layout</h1>
                    <p>This page has multiple elements with flexbox layout.</p>
                    <ul>
                        <li>Item 1</li>
                        <li>Item 2</li>
                        <li>Item 3</li>
                    </ul>
                </body>
            </html>
        `;

        const dataUrl = `data:text/html;base64,${btoa(html)}`;
        await browser.navigate(dataUrl);

        const pipeline = browser.getRenderingPipeline();
        const result = pipeline.lastRenderResult;

        assertExists(result);
        assertExists(result.layoutTree);
        assertExists(result.displayList);

        // Should have many DOM nodes
        const nodeCount = countNodes(result.dom);
        assertGreater(nodeCount, 15);

        // Layout computation should have occurred (time may be 0 for fast operations)
        assertEquals(typeof result.timing.layoutComputation, "number");

        await browser.close();
    },
});

Deno.test({
    name: "Full page load - text content is preserved",
    sanitizeResources: false,
    sanitizeOps: false,
    async fn() {
        const browser = new Browser({
            width: 800,
            height: 600,
            enableJavaScript: false,
        });

        const testText = "This is important test content that should be preserved.";
        const html = `
            <!DOCTYPE html>
            <html>
                <body>
                    <p>${testText}</p>
                </body>
            </html>
        `;

        const dataUrl = `data:text/html;base64,${btoa(html)}`;
        await browser.navigate(dataUrl);

        const pipeline = browser.getRenderingPipeline();
        const result = pipeline.lastRenderResult;

        assertExists(result);

        // Extract text content from DOM
        const pElement = findElementByTagName(result.dom, "p");
        assertExists(pElement);

        const textContent = getTextContent(pElement);
        assertEquals(textContent.includes(testText), true, "Text content should be preserved");

        await browser.close();
    },
});

Deno.test({
    name: "Full page load - compositor stats are available",
    sanitizeResources: false,
    sanitizeOps: false,
    async fn() {
        const browser = new Browser({
            width: 800,
            height: 600,
            enableJavaScript: false,
        });

        const html = `<!DOCTYPE html><html><body><h1>Stats Test</h1></body></html>`;
        const dataUrl = `data:text/html;base64,${btoa(html)}`;
        await browser.navigate(dataUrl);

        const pipeline = browser.getRenderingPipeline();
        const stats = pipeline.getStats();

        assertExists(stats);
        assertExists(stats.viewport);
        assertExists(stats.compositor);
        assertExists(stats.resources);

        // Verify viewport dimensions
        assertEquals(stats.viewport.width, 800);
        assertEquals(stats.viewport.height, 600);

        await browser.close();
    },
});
