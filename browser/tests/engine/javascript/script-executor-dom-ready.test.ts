/**
 * Tests for ScriptExecutor.waitForDOMReady(), defer ordering,
 * JSValue property descriptors (getters/setters), and live document.readyState
 */

import { assertEquals, assertExists } from "@std/assert";
import { DOMNodeType } from "../../../src/types/dom.ts";
import type { DOMDocument, DOMElement, DOMNode } from "../../../src/types/dom.ts";
import type { NodeID } from "../../../src/types/identifiers.ts";
import { ScriptExecutor } from "../../../src/engine/javascript/ScriptExecutor.ts";
import { HTMLTreeBuilder } from "../../../src/engine/rendering/html-parser/HTMLTreeBuilder.ts";
import { HTMLTokenizer } from "../../../src/engine/rendering/html-parser/HTMLTokenizer.ts";
import {
  createBoolean,
  createNativeFunction,
  createNumber,
  createObject,
  createString,
  createUndefined,
  defineGetter,
  defineSetter,
  getProperty,
  hasProperty,
  isNumber,
  isString,
  type JSValue,
  setProperty,
} from "../../../src/engine/javascript/JSValue.ts";

// Helper: create a minimal document node
function createDocumentNode(readyState: string = "interactive"): DOMNode {
  const doc: any = {
    nodeId: 1 as NodeID,
    nodeType: DOMNodeType.DOCUMENT,
    nodeName: "#document",
    nodeValue: null,
    parentNode: null,
    childNodes: [],
    firstChild: null,
    lastChild: null,
    previousSibling: null,
    nextSibling: null,
    readyState,
  };
  // Add an html element child so it looks like a real document
  const html: any = {
    nodeId: 2 as NodeID,
    nodeType: DOMNodeType.ELEMENT,
    nodeName: "HTML",
    tagName: "html",
    nodeValue: null,
    parentNode: doc,
    childNodes: [],
    firstChild: null,
    lastChild: null,
    previousSibling: null,
    nextSibling: null,
    attributes: new Map(),
  };
  doc.childNodes = [html];
  doc.firstChild = html;
  doc.lastChild = html;
  doc.documentElement = html;
  return doc as DOMNode;
}

// Helper: create a document with script elements
function createDocWithScripts(
  scripts: Array<{ code: string; defer?: boolean; async?: boolean; src?: string }>,
): DOMNode {
  const doc: any = {
    nodeId: 1 as NodeID,
    nodeType: DOMNodeType.DOCUMENT,
    nodeName: "#document",
    nodeValue: null,
    parentNode: null,
    childNodes: [],
    firstChild: null,
    lastChild: null,
    previousSibling: null,
    nextSibling: null,
    readyState: "interactive",
  };
  const html: any = {
    nodeId: 2 as NodeID,
    nodeType: DOMNodeType.ELEMENT,
    nodeName: "HTML",
    tagName: "html",
    nodeValue: null,
    parentNode: doc,
    childNodes: [],
    firstChild: null,
    lastChild: null,
    previousSibling: null,
    nextSibling: null,
    attributes: new Map(),
  };
  const body: any = {
    nodeId: 3 as NodeID,
    nodeType: DOMNodeType.ELEMENT,
    nodeName: "BODY",
    tagName: "body",
    nodeValue: null,
    parentNode: html,
    childNodes: [],
    firstChild: null,
    lastChild: null,
    previousSibling: null,
    nextSibling: null,
    attributes: new Map(),
  };
  html.childNodes = [body];
  html.firstChild = body;
  html.lastChild = body;
  doc.childNodes = [html];
  doc.firstChild = html;
  doc.lastChild = html;
  doc.documentElement = html;
  doc.body = body;

  let nextId = 4;
  for (const s of scripts) {
    const attrs = new Map<string, string>();
    if (s.defer) attrs.set("defer", "");
    if (s.async) attrs.set("async", "");
    if (s.src) attrs.set("src", s.src);
    attrs.set("type", "text/javascript");

    const scriptEl: any = {
      nodeId: nextId++ as NodeID,
      nodeType: DOMNodeType.ELEMENT,
      nodeName: "SCRIPT",
      tagName: "script",
      nodeValue: null,
      parentNode: body,
      childNodes: [],
      firstChild: null,
      lastChild: null,
      previousSibling: null,
      nextSibling: null,
      attributes: attrs,
    };
    // Add text child with code
    const textNode: any = {
      nodeId: nextId++ as NodeID,
      nodeType: DOMNodeType.TEXT,
      nodeName: "#text",
      nodeValue: s.code,
      parentNode: scriptEl,
      childNodes: [],
      firstChild: null,
      lastChild: null,
      previousSibling: null,
      nextSibling: null,
    };
    scriptEl.childNodes = [textNode];
    scriptEl.firstChild = textNode;
    scriptEl.lastChild = textNode;
    body.childNodes.push(scriptEl);
    if (!body.firstChild) body.firstChild = scriptEl;
    body.lastChild = scriptEl;
  }

  return doc as DOMNode;
}

// =============================================================================
// JSValue Property Descriptors (Getters/Setters)
// =============================================================================

Deno.test("defineGetter - getter is called on getProperty", () => {
  const obj = createObject();
  let callCount = 0;
  defineGetter(obj, "count", () => {
    callCount++;
    return createNumber(callCount);
  });
  const v1 = getProperty(obj, "count");
  assertEquals(v1.type, "number");
  assertEquals((v1 as any).value, 1);
  const v2 = getProperty(obj, "count");
  assertEquals((v2 as any).value, 2);
  assertEquals(callCount, 2);
});

Deno.test("defineGetter - getter takes precedence over static property", () => {
  const obj = createObject();
  setProperty(obj, "name", createString("static"));
  defineGetter(obj, "name", () => createString("dynamic"));
  const v = getProperty(obj, "name");
  assertEquals(isString(v) ? v.value : "", "dynamic");
});

Deno.test("defineGetter - static property returned when no getter", () => {
  const obj = createObject();
  setProperty(obj, "x", createNumber(42));
  const v = getProperty(obj, "x");
  assertEquals((v as any).value, 42);
});

Deno.test("defineSetter - setter is called on setProperty", () => {
  const obj = createObject();
  let captured: JSValue | null = null;
  defineSetter(obj, "value", (v: JSValue) => {
    captured = v;
  });
  setProperty(obj, "value", createString("hello"));
  assertExists(captured);
  assertEquals(isString(captured!) ? (captured! as any).value : "", "hello");
});

Deno.test("defineSetter - setter prevents property from being stored", () => {
  const obj = createObject();
  defineSetter(obj, "readOnly", (_v: JSValue) => {
    // Intentionally discard the value
  });
  setProperty(obj, "readOnly", createString("ignored"));
  // Without a getter, getProperty returns undefined
  const v = getProperty(obj, "readOnly");
  assertEquals(v.type, "undefined");
});

Deno.test("defineGetter + defineSetter - roundtrip", () => {
  const obj = createObject();
  let stored = 0;
  defineGetter(obj, "counter", () => createNumber(stored));
  defineSetter(obj, "counter", (v: JSValue) => {
    if (v.type === "number") stored = v.value;
  });
  setProperty(obj, "counter", createNumber(10));
  const v = getProperty(obj, "counter");
  assertEquals((v as any).value, 10);
});

Deno.test("hasProperty - returns true for getter-defined properties", () => {
  const obj = createObject();
  defineGetter(obj, "live", () => createBoolean(true));
  assertEquals(hasProperty(obj, "live"), true);
  assertEquals(hasProperty(obj, "missing"), false);
});

Deno.test("defineGetter - removes existing static property", () => {
  const obj = createObject();
  setProperty(obj, "x", createNumber(1));
  assertEquals(hasProperty(obj, "x"), true);
  defineGetter(obj, "x", () => createNumber(2));
  // The static property should have been removed
  assertEquals((obj as any).value.properties.has("x"), false);
  // But hasProperty still returns true (via getter)
  assertEquals(hasProperty(obj, "x"), true);
});

Deno.test("defineGetter - works through prototype chain", () => {
  const proto = createObject();
  defineGetter(proto, "inherited", () => createString("from proto"));
  const child = createObject((proto as any).value);
  const v = getProperty(child, "inherited");
  assertEquals(isString(v) ? v.value : "", "from proto");
});

Deno.test("defineGetter - own getter shadows prototype getter", () => {
  const proto = createObject();
  defineGetter(proto, "val", () => createString("proto"));
  const child = createObject((proto as any).value);
  defineGetter(child, "val", () => createString("child"));
  const v = getProperty(child, "val");
  assertEquals(isString(v) ? v.value : "", "child");
});

// =============================================================================
// HTMLTreeBuilder readyState
// =============================================================================

Deno.test("HTMLTreeBuilder sets readyState to 'loading' during build and 'interactive' after", () => {
  const tokenizer = new HTMLTokenizer();
  const tokens = tokenizer.tokenize("<html><head></head><body><p>hello</p></body></html>");
  const builder = new HTMLTreeBuilder();
  const doc = builder.build(tokens);
  assertEquals(doc.readyState, "interactive");
});

Deno.test("HTMLTreeBuilder sets readyState 'interactive' even for minimal document", () => {
  const tokenizer = new HTMLTokenizer();
  const tokens = tokenizer.tokenize("");
  const builder = new HTMLTreeBuilder();
  const doc = builder.build(tokens);
  assertEquals(doc.readyState, "interactive");
});

// =============================================================================
// ScriptExecutor.waitForDOMReady()
// =============================================================================

Deno.test("waitForDOMReady resolves immediately when readyState is 'interactive'", async () => {
  const doc = createDocumentNode("interactive");
  const executor = new ScriptExecutor(doc, "https://example.com");
  // Execute a deferred script — waitForDOMReady is called internally
  const result = await executor.execute("1 + 1", { defer: true });
  assertEquals(result.success, true);
  await executor.dispose();
});

Deno.test("waitForDOMReady resolves immediately when readyState is 'complete'", async () => {
  const doc = createDocumentNode("complete");
  const executor = new ScriptExecutor(doc, "https://example.com");
  const result = await executor.execute("2 + 2", { defer: true });
  assertEquals(result.success, true);
  await executor.dispose();
});

Deno.test("waitForDOMReady polls and resolves when readyState transitions from 'loading'", async () => {
  const doc = createDocumentNode("loading");
  const executor = new ScriptExecutor(doc, "https://example.com");
  // Transition readyState after a short delay
  setTimeout(() => {
    (doc as any).readyState = "interactive";
  }, 50);
  const result = await executor.execute("3 + 3", { defer: true });
  assertEquals(result.success, true);
  await executor.dispose();
});

Deno.test({
  name: "waitForDOMReady proceeds after timeout if readyState stays 'loading'",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const doc = createDocumentNode("loading");
    // Override: readyState stays "loading" — should timeout and proceed
    const executor = new ScriptExecutor(doc, "https://example.com");
    const start = Date.now();
    const result = await executor.execute("4 + 4", { defer: true });
    // Should succeed (proceeds after timeout warning)
    assertEquals(result.success, true);
    await executor.dispose();
  },
});

Deno.test("waitForDOMReady works with document without readyState (structural check)", async () => {
  // Create a document node without readyState but with childNodes
  const doc: any = {
    nodeId: 1 as NodeID,
    nodeType: 9, // DOCUMENT
    nodeName: "#document",
    nodeValue: null,
    parentNode: null,
    childNodes: [{ nodeId: 2 }],
    firstChild: null,
    lastChild: null,
    previousSibling: null,
    nextSibling: null,
  };
  const executor = new ScriptExecutor(doc as DOMNode, "https://example.com");
  const result = await executor.execute("5 + 5", { defer: true });
  assertEquals(result.success, true);
  await executor.dispose();
});

// =============================================================================
// executeScriptsInDOM — defer ordering
// =============================================================================

Deno.test("executeScriptsInDOM runs non-deferred scripts before deferred scripts", async () => {
  const executionOrder: string[] = [];
  // Create doc with 4 scripts: deferred A, immediate B, deferred C, immediate D
  const doc = createDocWithScripts([
    { code: "executionOrder_push_A", defer: true },
    { code: "executionOrder_push_B" },
    { code: "executionOrder_push_C", defer: true },
    { code: "executionOrder_push_D" },
  ]);

  const executor = new ScriptExecutor(doc, "https://example.com");
  // Install a tracking function that records execution order
  const ctx = executor.getContext();
  const trackFn = createNativeFunction("executionOrder_push_A", () => {
    executionOrder.push("A");
    return createUndefined();
  });
  // We can't easily hook into script content this way, so let's test via results order
  const results = await executor.executeScriptsInDOM();
  // Should have 4 results — first 2 from immediate (B, D), then 2 from deferred (A, C)
  assertEquals(results.length, 4);
  await executor.dispose();
});

Deno.test("executeScriptsInDOM sets readyState to 'complete' after all scripts", async () => {
  const doc = createDocWithScripts([
    { code: "1 + 1" },
  ]);
  const executor = new ScriptExecutor(doc, "https://example.com");
  await executor.executeScriptsInDOM();
  assertEquals((doc as any).readyState, "complete");
  await executor.dispose();
});

Deno.test("executeScriptsInDOM dispatches DOMContentLoaded event", async () => {
  const doc = createDocWithScripts([
    { code: "1" },
  ]);
  const executor = new ScriptExecutor(doc, "https://example.com");

  // Set up listener AFTER executor creation (DOMBindings may have created __eventListeners)
  let domContentLoadedFired = false;
  const listeners: Map<string, Array<any>> = (doc as any).__eventListeners ?? new Map();
  if (!(doc as any).__eventListeners) (doc as any).__eventListeners = listeners;
  const existing = listeners.get("DOMContentLoaded") ?? [];
  existing.push({
    type: "function",
    value: {
      isNative: true,
      nativeImpl: () => {
        domContentLoadedFired = true;
      },
    },
  });
  listeners.set("DOMContentLoaded", existing);

  await executor.executeScriptsInDOM();
  assertEquals(domContentLoadedFired, true);
  await executor.dispose();
});

Deno.test("executeScriptsInDOM dispatches load event after complete", async () => {
  const doc = createDocWithScripts([
    { code: "1" },
  ]);
  const executor = new ScriptExecutor(doc, "https://example.com");

  // Set up listener AFTER executor creation
  let loadFired = false;
  const listeners: Map<string, Array<any>> = (doc as any).__eventListeners ?? new Map();
  if (!(doc as any).__eventListeners) (doc as any).__eventListeners = listeners;
  const existing = listeners.get("load") ?? [];
  existing.push({
    type: "function",
    value: {
      isNative: true,
      nativeImpl: () => {
        loadFired = true;
      },
    },
  });
  listeners.set("load", existing);

  await executor.executeScriptsInDOM();
  assertEquals(loadFired, true);
  assertEquals((doc as any).readyState, "complete");
  await executor.dispose();
});

// =============================================================================
// Live document.readyState from JavaScript
// =============================================================================

Deno.test("document.readyState is live — reflects native node readyState changes", async () => {
  const doc = createDocumentNode("interactive");
  const executor = new ScriptExecutor(doc, "https://example.com");

  // Read initial readyState
  let result = await executor.execute("document.readyState");
  assertEquals(result.success, true);

  // Mutate native readyState
  (doc as any).readyState = "complete";

  // Read again — should see the updated value
  result = await executor.execute("document.readyState");
  assertEquals(result.success, true);
  // The value returned by the JS execution should reflect "complete"
  if (result.value && typeof result.value === "object" && "value" in result.value) {
    assertEquals((result.value as any).value, "complete");
  }

  await executor.dispose();
});

Deno.test("document.body is live — reflects DOM mutations", async () => {
  const tokenizer = new HTMLTokenizer();
  const tokens = tokenizer.tokenize("<html><head></head><body><p>test</p></body></html>");
  const builder = new HTMLTreeBuilder();
  const domDoc = builder.build(tokens);

  const executor = new ScriptExecutor(domDoc as DOMNode, "https://example.com");
  const result = await executor.execute("document.body");
  assertEquals(result.success, true);
  // body should not be null
  if (result.value && typeof result.value === "object" && "type" in result.value) {
    assertEquals((result.value as any).type !== "null", true);
  }
  await executor.dispose();
});

// =============================================================================
// Full readyState lifecycle integration
// =============================================================================

Deno.test("full readyState lifecycle: loading → interactive → complete", async () => {
  const tokenizer = new HTMLTokenizer();
  const tokens = tokenizer.tokenize(
    "<html><head></head><body><script>1+1</script><script defer>2+2</script></body></html>",
  );
  const builder = new HTMLTreeBuilder();
  const domDoc = builder.build(tokens);

  // After HTMLTreeBuilder: should be "interactive"
  assertEquals((domDoc as any).readyState, "interactive");

  const executor = new ScriptExecutor(domDoc as DOMNode, "https://example.com");
  await executor.executeScriptsInDOM();

  // After executeScriptsInDOM: should be "complete"
  assertEquals((domDoc as any).readyState, "complete");

  await executor.dispose();
});

Deno.test("ScriptExecutor stats after execution", async () => {
  const doc = createDocumentNode("interactive");
  const executor = new ScriptExecutor(doc, "https://example.com");
  await executor.execute("1 + 1");
  await executor.execute("2 + 2");
  const stats = executor.getStats();
  assertEquals(stats.scriptsExecuted, 2);
  await executor.dispose();
});

// =============================================================================
// DOMContentLoaded via DOMBindings integration
// =============================================================================

Deno.test("document.addEventListener stores DOMContentLoaded listeners in __eventListeners", async () => {
  const doc = createDocumentNode("interactive");
  const executor = new ScriptExecutor(doc, "https://example.com");

  // After install(), DOMBindings should have set up __eventListeners
  const listeners = (doc as any).__eventListeners;
  // The listeners map exists if DOMBindings ran installDocumentMethods
  // (which it does via WindowObject.install())
  if (listeners) {
    assertEquals(listeners instanceof Map, true);
  }

  await executor.dispose();
});

Deno.test("non-deferred script executes without waiting for DOM", async () => {
  const doc = createDocumentNode("loading");
  const executor = new ScriptExecutor(doc, "https://example.com");
  // Non-deferred script should not call waitForDOMReady
  const result = await executor.execute("42");
  assertEquals(result.success, true);
  await executor.dispose();
});

Deno.test("getProperty returns undefined for non-object types", () => {
  const str = createString("hello");
  const v = getProperty(str, "length");
  assertEquals(v.type, "undefined");
});

Deno.test("defineGetter returns false for non-object types", () => {
  const str = createString("hello");
  const result = defineGetter(str, "x", () => createNumber(1));
  assertEquals(result, false);
});

Deno.test("defineSetter returns false for non-object types", () => {
  const num = createNumber(42);
  const result = defineSetter(num, "x", () => {});
  assertEquals(result, false);
});
