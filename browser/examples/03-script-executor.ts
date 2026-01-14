/**
 * Example 3: Script Executor - JavaScript Engine
 *
 * This example demonstrates using the JavaScript execution engine independently
 * to run JavaScript code with V8. Great for:
 * - JavaScript testing
 * - Code evaluation
 * - Sandboxed execution
 * - Performance profiling
 */

import { ScriptExecutor } from "../src/engine/javascript/ScriptExecutor.ts";
import { DOMNodeType } from "../src/types/dom.ts";
import type { DOMNode, DOMElement } from "../src/types/dom.ts";

console.log("=".repeat(60));
console.log("Example 3: Script Executor - JavaScript Engine");
console.log("=".repeat(60));

// Create a simple DOM structure for testing
const document: DOMNode = {
    id: "doc-1" as any,
    nodeType: DOMNodeType.DOCUMENT,
    nodeName: "#document",
    nodeValue: null,
    parentNode: null,
    childNodes: [],
    appendChild(child: DOMNode) {
        this.childNodes.push(child);
        child.parentNode = this;
        return child;
    },
    removeChild(child: DOMNode) {
        const index = this.childNodes.indexOf(child);
        if (index !== -1) {
            this.childNodes.splice(index, 1);
            child.parentNode = null;
        }
        return child;
    },
    insertBefore(newChild: DOMNode, refChild: DOMNode | null) {
        if (!refChild) {
            return this.appendChild(newChild);
        }
        const index = this.childNodes.indexOf(refChild);
        if (index !== -1) {
            this.childNodes.splice(index, 0, newChild);
            newChild.parentNode = this;
        }
        return newChild;
    },
    replaceChild(newChild: DOMNode, oldChild: DOMNode) {
        const index = this.childNodes.indexOf(oldChild);
        if (index !== -1) {
            this.childNodes[index] = newChild;
            newChild.parentNode = this;
            oldChild.parentNode = null;
        }
        return oldChild;
    },
    cloneNode() {
        return { ...this };
    },
    contains() {
        return false;
    },
    get firstChild() {
        return this.childNodes[0] || null;
    },
    get lastChild() {
        return this.childNodes[this.childNodes.length - 1] || null;
    },
    get nextSibling() {
        return null;
    },
    get previousSibling() {
        return null;
    },
};

// Create script executor
const executor = new ScriptExecutor(document, "https://example.com");

// Example 1: Execute simple JavaScript
console.log("\n1. Executing simple JavaScript:");
const result1 = await executor.execute("2 + 2");
console.log(`Result: ${result1.value}`);
console.log(`Success: ${result1.success}`);
console.log(`Execution time: ${result1.executionTime}ms`);

// Example 2: Execute code with variables
console.log("\n2. Executing code with variables:");
const result2 = await executor.execute(`
    const x = 10;
    const y = 20;
    x * y
`);
console.log(`Result: ${result2.value}`);

// Example 3: Access V8 subsystems
console.log("\n3. Accessing V8 subsystems:");

// Get V8 isolate
const isolate = executor.getIsolate();
const heapStats = isolate.getHeapStatistics();
console.log(`Heap statistics:`);
console.log(`  Total heap size: ${heapStats.totalHeapSize} bytes`);
console.log(`  Used heap size: ${heapStats.usedHeapSize} bytes`);
console.log(`  Heap size limit: ${heapStats.heapSizeLimit} bytes`);

// Get V8 context
const context = executor.getContext();
console.log(`Context created successfully`);

// Get event loop
const eventLoop = executor.getEventLoop();
console.log(`Event loop has pending tasks: ${eventLoop.hasPendingTasks()}`);

// Get window object
const windowObject = executor.getWindow();
console.log(`Window object available`);

// Example 4: Execute async code
console.log("\n4. Executing async code:");
const result3 = await executor.execute(`
    Promise.resolve(42)
`, { async: true });
console.log(`Async result: ${result3.value}`);

// Example 5: Evaluate expressions
console.log("\n5. Evaluating expressions:");
const evalResult = executor.evaluate("Math.PI");
console.log(`Math.PI = ${evalResult}`);

// Example 6: Execution statistics
console.log("\n6. Execution statistics:");
const stats = executor.getStats();
console.log(`Scripts executed: ${stats.scriptsExecuted}`);
console.log(`Heap stats:`, stats.heapStats);

// Example 7: Error handling
console.log("\n7. Error handling:");
const errorResult = await executor.execute("throw new Error('Test error')");
console.log(`Success: ${errorResult.success}`);
console.log(`Error: ${errorResult.error?.message}`);

// Cleanup
await executor.dispose();

console.log("\n" + "=".repeat(60));
console.log("Example complete!");
console.log("=".repeat(60));
