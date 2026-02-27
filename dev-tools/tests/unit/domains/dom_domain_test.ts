/**
 * DOM Domain Agent Tests
 *
 * Tests for DOM tree inspection, manipulation, serialization,
 * search, and box model computation.
 */

import { assertEquals, assertRejects, assertExists } from "@std/assert";
import { EventBus } from "../../../integration/event-bus.ts";
import { DOMDomain } from "../../../domains/dom/dom-domain.ts";
import {
    createMockContext,
    createMockRenderResult,
    createMockElement,
    createMockTextNode,
    createMockDocument,
    createMockRenderingPipeline,
    resetNodeIdCounter,
} from "../../helpers/mocks.ts";
import { DOMNodeType } from "../../../../browser/src/types/dom.ts";
import type { ProtocolEvent } from "../../../protocol/types.ts";

/**
 * Helper: create a rendering pipeline mock whose getStats() exposes lastRenderResult
 * so that DOMDomain.getCurrentDOM() can access the DOM tree.
 */
function createPipelineWithDOM(renderResult?: ReturnType<typeof createMockRenderResult>) {
    const result = renderResult ?? createMockRenderResult();
    return createMockRenderingPipeline(result);
}

/**
 * Helper: create a rendering pipeline mock with no DOM (getStats has no lastRenderResult)
 */
function createPipelineWithoutDOM() {
    const basePipeline = createMockRenderingPipeline();
    const pipeline = {
        ...basePipeline,
        getStats: () => ({
            viewport: { width: 1024, height: 768 },
            renders: 0,
            lastRenderTime: 0,
            resources: { totalSize: 0, count: 0 },
        }),
    };
    // Remove lastRenderResult so getCurrentDOM() returns null
    delete (pipeline as Record<string, unknown>).lastRenderResult;
    return pipeline;
}

// ---- Tests ----

Deno.test("DOMDomain - enable() returns empty object", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new DOMDomain(eventBus);
    const context = createMockContext({
        eventBus,
        renderingPipeline: createPipelineWithDOM(),
    });
    domain.initialize(context);

    const result = await domain.enable();
    assertEquals(result, {});
});

Deno.test("DOMDomain - getDocument() returns serialized DOM tree with correct fields", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new DOMDomain(eventBus);
    const renderResult = createMockRenderResult();
    const pipeline = createPipelineWithDOM(renderResult);
    const context = createMockContext({ eventBus, renderingPipeline: pipeline });
    domain.initialize(context);
    await domain.enable();

    const result = await domain.handleMethod("getDocument", {});
    const root = (result as Record<string, unknown>).root as Record<string, unknown>;

    assertExists(root);
    assertEquals(root.nodeType, DOMNodeType.DOCUMENT);
    assertEquals(root.nodeName, "#document");
    assertExists(root.nodeId);
    assertExists(root.backendNodeId);
    assertEquals(root.nodeId, root.backendNodeId);
});

Deno.test("DOMDomain - getDocument() with no DOM returns empty document", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new DOMDomain(eventBus);
    const pipeline = createPipelineWithoutDOM();
    const context = createMockContext({ eventBus, renderingPipeline: pipeline });
    domain.initialize(context);
    await domain.enable();

    const result = await domain.handleMethod("getDocument", {});
    const root = (result as Record<string, unknown>).root as Record<string, unknown>;

    assertEquals(root.nodeId, 0);
    assertEquals(root.nodeType, DOMNodeType.DOCUMENT);
    assertEquals(root.nodeName, "#document");
    assertEquals(root.childNodeCount, 0);
    assertEquals(root.children, []);
});

Deno.test("DOMDomain - getDocument() respects depth parameter", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new DOMDomain(eventBus);
    const renderResult = createMockRenderResult();
    const pipeline = createPipelineWithDOM(renderResult);
    const context = createMockContext({ eventBus, renderingPipeline: pipeline });
    domain.initialize(context);
    await domain.enable();

    // depth=0 should not include children details
    const result0 = await domain.handleMethod("getDocument", { depth: 0 });
    const root0 = (result0 as Record<string, unknown>).root as Record<string, unknown>;
    // At depth 0, children should not be serialized (no children array)
    assertEquals(root0.children, undefined);
    // But childNodeCount should still be present
    assertExists(root0.childNodeCount);

    // depth=1 should include one level of children
    const result1 = await domain.handleMethod("getDocument", { depth: 1 });
    const root1 = (result1 as Record<string, unknown>).root as Record<string, unknown>;
    const children1 = root1.children as Array<Record<string, unknown>>;
    assertExists(children1);
    // Children at depth 1 should not have their own children serialized
    if (children1.length > 0) {
        const firstChild = children1[0];
        // The child's children should not be deeply serialized (depth was 1, so children at depth 0)
        if (firstChild.childNodeCount && (firstChild.childNodeCount as number) > 0) {
            // children may or may not exist at this sub-level depending on depth decrement
            // At depth 0 for the children, they should not have children array
            assertEquals(firstChild.children, undefined);
        }
    }
});

Deno.test("DOMDomain - querySelector() delegates to element", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new DOMDomain(eventBus);

    // Create a DOM with a queryable element
    const targetDiv = createMockElement("div", { id: "target" });
    const body = createMockElement("body", {}, [targetDiv]);
    // Make querySelector return the target
    (body as unknown as Record<string, unknown>).querySelector = (_sel: string) => targetDiv;
    const doc = createMockDocument([body]);

    const renderResult = createMockRenderResult({ dom: doc });
    const pipeline = createPipelineWithDOM(renderResult);
    const context = createMockContext({ eventBus, renderingPipeline: pipeline });
    domain.initialize(context);
    await domain.enable();

    // First call getDocument to build the nodeMap
    await domain.handleMethod("getDocument", {});

    const result = await domain.handleMethod("querySelector", {
        nodeId: body.nodeId,
        selector: "#target",
    });
    assertEquals((result as Record<string, unknown>).nodeId, targetDiv.nodeId);
});

Deno.test("DOMDomain - querySelectorAll() delegates to element", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new DOMDomain(eventBus);

    const item1 = createMockElement("li", { class: "item" });
    const item2 = createMockElement("li", { class: "item" });
    const ul = createMockElement("ul", {}, [item1, item2]);
    // Make querySelectorAll return the items
    (ul as unknown as Record<string, unknown>).querySelectorAll = (_sel: string) => [item1, item2];
    const doc = createMockDocument([ul]);

    const renderResult = createMockRenderResult({ dom: doc });
    const pipeline = createPipelineWithDOM(renderResult);
    const context = createMockContext({ eventBus, renderingPipeline: pipeline });
    domain.initialize(context);
    await domain.enable();

    await domain.handleMethod("getDocument", {});

    const result = await domain.handleMethod("querySelectorAll", {
        nodeId: ul.nodeId,
        selector: ".item",
    });
    const nodeIds = (result as Record<string, unknown>).nodeIds as number[];
    assertEquals(nodeIds.length, 2);
    assertEquals(nodeIds[0], item1.nodeId);
    assertEquals(nodeIds[1], item2.nodeId);
});

Deno.test("DOMDomain - getOuterHTML() serializes element to HTML string", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new DOMDomain(eventBus);

    const textNode = createMockTextNode("Hello");
    const div = createMockElement("div", { id: "main" }, [textNode]);
    const doc = createMockDocument([div]);

    const renderResult = createMockRenderResult({ dom: doc });
    const pipeline = createPipelineWithDOM(renderResult);
    const context = createMockContext({ eventBus, renderingPipeline: pipeline });
    domain.initialize(context);
    await domain.enable();

    await domain.handleMethod("getDocument", {});

    const result = await domain.handleMethod("getOuterHTML", { nodeId: div.nodeId });
    const outerHTML = (result as Record<string, unknown>).outerHTML as string;
    assertEquals(outerHTML, '<div id="main">Hello</div>');
});

Deno.test("DOMDomain - setAttributeValue() sets attribute and emits event", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new DOMDomain(eventBus);

    const div = createMockElement("div", { id: "target" });
    const doc = createMockDocument([div]);

    const renderResult = createMockRenderResult({ dom: doc });
    const pipeline = createPipelineWithDOM(renderResult);
    const context = createMockContext({ eventBus, renderingPipeline: pipeline });
    domain.initialize(context);
    await domain.enable();

    await domain.handleMethod("getDocument", {});

    // Collect events
    const events: ProtocolEvent[] = [];
    domain.addEventListener((event) => events.push(event));

    await domain.handleMethod("setAttributeValue", {
        nodeId: div.nodeId,
        name: "class",
        value: "highlight",
    });

    // Verify attribute was set
    const attrs = (div as unknown as Record<string, unknown>).attributes as Map<string, string>;
    assertEquals(attrs.get("class"), "highlight");

    // Verify attributeModified event was emitted
    const modEvent = events.find((e) => e.method === "DOM.attributeModified");
    assertExists(modEvent);
    assertEquals(modEvent.params?.name, "class");
    assertEquals(modEvent.params?.value, "highlight");
});

Deno.test("DOMDomain - removeAttribute() removes attribute and emits event", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new DOMDomain(eventBus);

    const div = createMockElement("div", { id: "target", class: "old" });
    const doc = createMockDocument([div]);

    const renderResult = createMockRenderResult({ dom: doc });
    const pipeline = createPipelineWithDOM(renderResult);
    const context = createMockContext({ eventBus, renderingPipeline: pipeline });
    domain.initialize(context);
    await domain.enable();

    await domain.handleMethod("getDocument", {});

    const events: ProtocolEvent[] = [];
    domain.addEventListener((event) => events.push(event));

    await domain.handleMethod("removeAttribute", {
        nodeId: div.nodeId,
        name: "class",
    });

    // Verify attribute was removed
    const attrs = (div as unknown as Record<string, unknown>).attributes as Map<string, string>;
    assertEquals(attrs.has("class"), false);

    // Verify attributeRemoved event
    const rmEvent = events.find((e) => e.method === "DOM.attributeRemoved");
    assertExists(rmEvent);
    assertEquals(rmEvent.params?.name, "class");
});

Deno.test("DOMDomain - removeNode() removes node and emits event", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new DOMDomain(eventBus);

    const child = createMockElement("span");
    const parent = createMockElement("div", {}, [child]);
    const doc = createMockDocument([parent]);

    const renderResult = createMockRenderResult({ dom: doc });
    const pipeline = createPipelineWithDOM(renderResult);
    const context = createMockContext({ eventBus, renderingPipeline: pipeline });
    domain.initialize(context);
    await domain.enable();

    await domain.handleMethod("getDocument", {});

    const events: ProtocolEvent[] = [];
    domain.addEventListener((event) => events.push(event));

    await domain.handleMethod("removeNode", { nodeId: child.nodeId });

    // Verify childNodeRemoved event
    const rmEvent = events.find((e) => e.method === "DOM.childNodeRemoved");
    assertExists(rmEvent);
    assertEquals(rmEvent.params?.nodeId, child.nodeId);
    assertEquals(rmEvent.params?.parentNodeId, parent.nodeId);
});

Deno.test("DOMDomain - getBoxModel() computes correct quads from layout", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new DOMDomain(eventBus);

    // Create element with explicit layout
    const div = createMockElement("div", {}, [], {
        layout: {
            x: 10,
            y: 20,
            width: 100,
            height: 50,
            paddingTop: 5,
            paddingRight: 5,
            paddingBottom: 5,
            paddingLeft: 5,
            borderTopWidth: 2,
            borderRightWidth: 2,
            borderBottomWidth: 2,
            borderLeftWidth: 2,
            marginTop: 10,
            marginRight: 10,
            marginBottom: 10,
            marginLeft: 10,
        },
    });
    const doc = createMockDocument([div]);

    const renderResult = createMockRenderResult({ dom: doc });
    const pipeline = createPipelineWithDOM(renderResult);
    const context = createMockContext({ eventBus, renderingPipeline: pipeline });
    domain.initialize(context);
    await domain.enable();

    await domain.handleMethod("getDocument", {});

    const result = await domain.handleMethod("getBoxModel", { nodeId: div.nodeId });
    const model = (result as Record<string, unknown>).model as Record<string, unknown>;

    assertExists(model);
    assertEquals(model.width, 100);
    assertEquals(model.height, 50);

    // Content box: x=10+2+5=17, y=20+2+5=27, w=100, h=50
    const content = model.content as number[];
    assertEquals(content[0], 17); // cx
    assertEquals(content[1], 27); // cy

    // Border box: x=10, y=20
    const border = model.border as number[];
    assertEquals(border[0], 10); // bx
    assertEquals(border[1], 20); // by

    // Margin box: x=10-10=0, y=20-10=10
    const margin = model.margin as number[];
    assertEquals(margin[0], 0); // mx
    assertEquals(margin[1], 10); // my
});

Deno.test("DOMDomain - getBoxModel() with no layout returns zeros", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new DOMDomain(eventBus);

    // Element without layout / __renderObject
    const div = createMockElement("div");
    const doc = createMockDocument([div]);

    const renderResult = createMockRenderResult({ dom: doc });
    const pipeline = createPipelineWithDOM(renderResult);
    const context = createMockContext({ eventBus, renderingPipeline: pipeline });
    domain.initialize(context);
    await domain.enable();

    await domain.handleMethod("getDocument", {});

    const result = await domain.handleMethod("getBoxModel", { nodeId: div.nodeId });
    const model = (result as Record<string, unknown>).model as Record<string, unknown>;

    assertEquals(model.width, 0);
    assertEquals(model.height, 0);
    assertEquals(model.content, [0, 0, 0, 0, 0, 0, 0, 0]);
});

Deno.test("DOMDomain - requestChildNodes() emits setChildNodes event", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new DOMDomain(eventBus);

    const child1 = createMockElement("p");
    const child2 = createMockElement("span");
    const parent = createMockElement("div", {}, [child1, child2]);
    const doc = createMockDocument([parent]);

    const renderResult = createMockRenderResult({ dom: doc });
    const pipeline = createPipelineWithDOM(renderResult);
    const context = createMockContext({ eventBus, renderingPipeline: pipeline });
    domain.initialize(context);
    await domain.enable();

    await domain.handleMethod("getDocument", {});

    const events: ProtocolEvent[] = [];
    domain.addEventListener((event) => events.push(event));

    await domain.handleMethod("requestChildNodes", { nodeId: parent.nodeId });

    const setChildEvent = events.find((e) => e.method === "DOM.setChildNodes");
    assertExists(setChildEvent);
    assertEquals(setChildEvent.params?.parentId, parent.nodeId);
    const nodes = setChildEvent.params?.nodes as Array<Record<string, unknown>>;
    assertEquals(nodes.length, 2);
});

Deno.test("DOMDomain - performSearch() finds nodes by text/attribute/name", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new DOMDomain(eventBus);

    const textNode = createMockTextNode("Hello World");
    const div = createMockElement("div", { id: "main", "data-info": "searchable" }, [textNode]);
    const doc = createMockDocument([div]);

    const renderResult = createMockRenderResult({ dom: doc });
    const pipeline = createPipelineWithDOM(renderResult);
    const context = createMockContext({ eventBus, renderingPipeline: pipeline });
    domain.initialize(context);
    await domain.enable();

    // Search by text
    const textResult = await domain.handleMethod("performSearch", { query: "Hello" });
    const textCount = (textResult as Record<string, unknown>).resultCount as number;
    // Should find the text node
    assertEquals(textCount > 0, true);

    // Search by attribute value
    const attrResult = await domain.handleMethod("performSearch", { query: "searchable" });
    const attrCount = (attrResult as Record<string, unknown>).resultCount as number;
    assertEquals(attrCount > 0, true);

    // Search by node name
    const nameResult = await domain.handleMethod("performSearch", { query: "div" });
    const nameCount = (nameResult as Record<string, unknown>).resultCount as number;
    assertEquals(nameCount > 0, true);
});

Deno.test("DOMDomain - getSearchResults() returns correct range", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new DOMDomain(eventBus);

    // Build a DOM with several matching nodes
    const t1 = createMockTextNode("test item 1");
    const t2 = createMockTextNode("test item 2");
    const t3 = createMockTextNode("test item 3");
    const p1 = createMockElement("p", {}, [t1]);
    const p2 = createMockElement("p", {}, [t2]);
    const p3 = createMockElement("p", {}, [t3]);
    const body = createMockElement("div", {}, [p1, p2, p3]);
    const doc = createMockDocument([body]);

    const renderResult = createMockRenderResult({ dom: doc });
    const pipeline = createPipelineWithDOM(renderResult);
    const context = createMockContext({ eventBus, renderingPipeline: pipeline });
    domain.initialize(context);
    await domain.enable();

    // Perform a search that finds multiple results
    const searchResult = await domain.handleMethod("performSearch", { query: "test" });
    const searchId = (searchResult as Record<string, unknown>).searchId as string;
    const totalCount = (searchResult as Record<string, unknown>).resultCount as number;

    // Get a sub-range
    const rangeResult = await domain.handleMethod("getSearchResults", {
        searchId,
        fromIndex: 0,
        toIndex: Math.min(2, totalCount),
    });
    const nodeIds = (rangeResult as Record<string, unknown>).nodeIds as number[];
    assertEquals(nodeIds.length, Math.min(2, totalCount));
});

Deno.test("DOMDomain - getSearchResults() with invalid searchId returns empty", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new DOMDomain(eventBus);
    const pipeline = createPipelineWithDOM();
    const context = createMockContext({ eventBus, renderingPipeline: pipeline });
    domain.initialize(context);
    await domain.enable();

    const result = await domain.handleMethod("getSearchResults", {
        searchId: "nonexistent",
        fromIndex: 0,
        toIndex: 10,
    });
    assertEquals((result as Record<string, unknown>).nodeIds, []);
});

Deno.test("DOMDomain - dispose() clears maps", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new DOMDomain(eventBus);
    const pipeline = createPipelineWithDOM();
    const context = createMockContext({ eventBus, renderingPipeline: pipeline });
    domain.initialize(context);
    await domain.enable();

    // Build node map by getting document
    await domain.handleMethod("getDocument", {});

    // Perform a search to populate search results
    await domain.handleMethod("performSearch", { query: "div" });

    // Verify nodeMap is populated
    const nodeMap = domain.getNodeMap();
    assertEquals(nodeMap.size > 0, true);

    // Dispose and verify
    domain.dispose();
    assertEquals(domain.getNodeMap().size, 0);
});

Deno.test("DOMDomain - getNodeById returns node after getDocument populates nodeMap", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new DOMDomain(eventBus);

    const div = createMockElement("div", { id: "target" });
    const doc = createMockDocument([div]);
    const renderResult = createMockRenderResult({ dom: doc });
    const pipeline = createPipelineWithDOM(renderResult);
    const context = createMockContext({ eventBus, renderingPipeline: pipeline });
    domain.initialize(context);
    await domain.enable();

    // Trigger getDocument to populate nodeMap
    await domain.handleMethod("getDocument", {});

    // Query for a node via the public getNodeById method
    const receivedNode = domain.getNodeById(div.nodeId);

    assertExists(receivedNode);
    assertEquals((receivedNode as Record<string, unknown>).nodeId, div.nodeId);
});

Deno.test("DOMDomain - serializeToHTML escapes attribute values", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new DOMDomain(eventBus);

    const div = createMockElement("div", { title: 'he said "hello" & <bye>' });
    const doc = createMockDocument([div]);
    const renderResult = createMockRenderResult({ dom: doc });
    const pipeline = createPipelineWithDOM(renderResult);
    const context = createMockContext({ eventBus, renderingPipeline: pipeline });
    domain.initialize(context);
    await domain.enable();

    await domain.handleMethod("getDocument", {});

    const result = await domain.handleMethod("getOuterHTML", { nodeId: div.nodeId });
    const outerHTML = (result as Record<string, unknown>).outerHTML as string;

    // Should not contain raw quotes or angle brackets in attribute
    assertEquals(outerHTML.includes('"hello"'), false);
    assertEquals(outerHTML.includes('&quot;'), true);
    assertEquals(outerHTML.includes('&amp;'), true);
    assertEquals(outerHTML.includes('&lt;bye&gt;'), true);
});

Deno.test("DOMDomain - serializeToHTML escapes text node content", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new DOMDomain(eventBus);

    const textNode = createMockTextNode("<script>alert('xss')</script>");
    const div = createMockElement("div", {}, [textNode]);
    const doc = createMockDocument([div]);
    const renderResult = createMockRenderResult({ dom: doc });
    const pipeline = createPipelineWithDOM(renderResult);
    const context = createMockContext({ eventBus, renderingPipeline: pipeline });
    domain.initialize(context);
    await domain.enable();

    await domain.handleMethod("getDocument", {});

    const result = await domain.handleMethod("getOuterHTML", { nodeId: div.nodeId });
    const outerHTML = (result as Record<string, unknown>).outerHTML as string;

    // Should not contain raw <script> tags
    assertEquals(outerHTML.includes("<script>"), false);
    assertEquals(outerHTML.includes("&lt;script&gt;"), true);
});

Deno.test("DOMDomain - getNodeById returns null for unknown nodeId", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new DOMDomain(eventBus);

    const doc = createMockDocument([]);
    const renderResult = createMockRenderResult({ dom: doc });
    const pipeline = createPipelineWithDOM(renderResult);
    const context = createMockContext({ eventBus, renderingPipeline: pipeline });
    domain.initialize(context);
    await domain.enable();

    await domain.handleMethod("getDocument", {});

    const receivedNode = domain.getNodeById(99999);
    assertEquals(receivedNode, null);
});

// ============================================================================
// Enhanced Edge Case Tests
// ============================================================================

Deno.test("DOMDomain - disable() returns empty object", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new DOMDomain(eventBus);
    const pipeline = createPipelineWithDOM();
    const context = createMockContext({ eventBus, renderingPipeline: pipeline });
    domain.initialize(context);
    await domain.enable();
    assertEquals(domain.isEnabled(), true);

    const result = await domain.disable();
    assertEquals(result, {});
    assertEquals(domain.isEnabled(), false);
});

Deno.test("DOMDomain - querySelector() throws for unknown nodeId", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new DOMDomain(eventBus);
    const pipeline = createPipelineWithDOM();
    const context = createMockContext({ eventBus, renderingPipeline: pipeline });
    domain.initialize(context);
    await domain.enable();

    await domain.handleMethod("getDocument", {});

    await assertRejects(
        async () => {
            await domain.handleMethod("querySelector", { nodeId: 99999, selector: "div" });
        },
        Error,
        "not found",
    );
});

Deno.test("DOMDomain - querySelectorAll() throws for unknown nodeId", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new DOMDomain(eventBus);
    const pipeline = createPipelineWithDOM();
    const context = createMockContext({ eventBus, renderingPipeline: pipeline });
    domain.initialize(context);
    await domain.enable();

    await domain.handleMethod("getDocument", {});

    await assertRejects(
        async () => {
            await domain.handleMethod("querySelectorAll", { nodeId: 99999, selector: ".foo" });
        },
        Error,
        "not found",
    );
});

Deno.test("DOMDomain - getOuterHTML() throws for unknown nodeId", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new DOMDomain(eventBus);
    const pipeline = createPipelineWithDOM();
    const context = createMockContext({ eventBus, renderingPipeline: pipeline });
    domain.initialize(context);
    await domain.enable();

    await domain.handleMethod("getDocument", {});

    await assertRejects(
        async () => {
            await domain.handleMethod("getOuterHTML", { nodeId: 99999 });
        },
        Error,
        "not found",
    );
});

Deno.test("DOMDomain - setAttributeValue() throws for non-element node", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new DOMDomain(eventBus);

    const textNode = createMockTextNode("Just text");
    const div = createMockElement("div", {}, [textNode]);
    const doc = createMockDocument([div]);

    const renderResult = createMockRenderResult({ dom: doc });
    const pipeline = createPipelineWithDOM(renderResult);
    const context = createMockContext({ eventBus, renderingPipeline: pipeline });
    domain.initialize(context);
    await domain.enable();

    await domain.handleMethod("getDocument", {});

    await assertRejects(
        async () => {
            await domain.handleMethod("setAttributeValue", {
                nodeId: textNode.nodeId,
                name: "class",
                value: "test",
            });
        },
        Error,
        "not found",
    );
});

Deno.test("DOMDomain - performSearch() with no DOM returns zero results", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new DOMDomain(eventBus);
    const pipeline = createPipelineWithoutDOM();
    const context = createMockContext({ eventBus, renderingPipeline: pipeline });
    domain.initialize(context);
    await domain.enable();

    const result = await domain.handleMethod("performSearch", { query: "anything" });
    assertEquals((result as Record<string, unknown>).searchId, "0");
    assertEquals((result as Record<string, unknown>).resultCount, 0);
});

Deno.test("DOMDomain - handleMethod throws for unknown method", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new DOMDomain(eventBus);
    const pipeline = createPipelineWithDOM();
    const context = createMockContext({ eventBus, renderingPipeline: pipeline });
    domain.initialize(context);
    await domain.enable();

    await assertRejects(
        async () => {
            await domain.handleMethod("nonExistentMethod", {});
        },
        Error,
        "not found",
    );
});

// ============================================================================
// New Tests: XSS, comment nodes, attribute sanitization, dispose EventBus
// ============================================================================

Deno.test("DOMDomain - serializeToHTML sanitizes comment node XSS (-->)", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new DOMDomain(eventBus);

    // Create a comment node with XSS payload
    const xssComment = {
        nodeId: 9990,
        nodeType: DOMNodeType.COMMENT,
        nodeName: "#comment",
        nodeValue: 'xss --><script>alert(1)</script><!--',
        parentNode: null,
        childNodes: [],
        firstChild: null,
        lastChild: null,
        previousSibling: null,
        nextSibling: null,
        ownerDocument: null,
        cloneNode() { return this; },
        appendChild() { return this; },
        removeChild(c: unknown) { return c; },
    } as unknown as DOMNode;

    const div = createMockElement("div", {}, [xssComment]);
    // Link parent
    (xssComment as unknown as Record<string, unknown>).parentNode = div;
    const doc = createMockDocument([div]);

    const renderResult = createMockRenderResult({ dom: doc });
    const pipeline = createPipelineWithDOM(renderResult);
    const context = createMockContext({ eventBus, renderingPipeline: pipeline });
    domain.initialize(context);
    await domain.enable();
    await domain.handleMethod("getDocument", {});

    const result = await domain.handleMethod("getOuterHTML", { nodeId: div.nodeId });
    const html = (result as Record<string, unknown>).outerHTML as string;

    // The raw --> should NOT appear in the output (it's escaped to --&gt;)
    assertEquals(html.includes('--><script>'), false);
    assertEquals(html.includes('--&gt;'), true);
});

Deno.test("DOMDomain - serializeToHTML sanitizes attribute names", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new DOMDomain(eventBus);

    // Create element with malicious attribute name
    const div = createMockElement("div", {});
    const attrs = (div as unknown as Record<string, unknown>).attributes as Map<string, string>;
    attrs.set('" onclick="alert(1)', "injected");
    attrs.set("valid-attr", "ok");

    const doc = createMockDocument([div]);
    const renderResult = createMockRenderResult({ dom: doc });
    const pipeline = createPipelineWithDOM(renderResult);
    const context = createMockContext({ eventBus, renderingPipeline: pipeline });
    domain.initialize(context);
    await domain.enable();
    await domain.handleMethod("getDocument", {});

    const result = await domain.handleMethod("getOuterHTML", { nodeId: div.nodeId });
    const html = (result as Record<string, unknown>).outerHTML as string;

    // The malicious attribute name with quotes/spaces/= should be sanitized
    // The raw injection pattern '" onclick="alert(1)' should not appear
    assertEquals(html.includes('" onclick='), false);
    // Valid attribute should still be present
    assertEquals(html.includes('valid-attr="ok"'), true);
});

Deno.test("DOMDomain - serializeToHTML comment node basic serialization", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new DOMDomain(eventBus);

    const comment = {
        nodeId: 9991,
        nodeType: DOMNodeType.COMMENT,
        nodeName: "#comment",
        nodeValue: "This is a comment",
        parentNode: null,
        childNodes: [],
        firstChild: null,
        lastChild: null,
        previousSibling: null,
        nextSibling: null,
        ownerDocument: null,
        cloneNode() { return this; },
        appendChild() { return this; },
        removeChild(c: unknown) { return c; },
    } as unknown as DOMNode;

    const div = createMockElement("div", {}, [comment]);
    (comment as unknown as Record<string, unknown>).parentNode = div;
    const doc = createMockDocument([div]);

    const renderResult = createMockRenderResult({ dom: doc });
    const pipeline = createPipelineWithDOM(renderResult);
    const context = createMockContext({ eventBus, renderingPipeline: pipeline });
    domain.initialize(context);
    await domain.enable();
    await domain.handleMethod("getDocument", {});

    const result = await domain.handleMethod("getOuterHTML", { nodeId: div.nodeId });
    const html = (result as Record<string, unknown>).outerHTML as string;

    assertEquals(html.includes("<!--This is a comment-->"), true);
});

Deno.test("DOMDomain - dispose() clears nodeMap so getNodeById returns null", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new DOMDomain(eventBus);

    const div = createMockElement("div", { id: "test" });
    const doc = createMockDocument([div]);
    const renderResult = createMockRenderResult({ dom: doc });
    const pipeline = createPipelineWithDOM(renderResult);
    const context = createMockContext({ eventBus, renderingPipeline: pipeline });
    domain.initialize(context);
    await domain.enable();
    await domain.handleMethod("getDocument", {});

    // Verify getNodeById works before dispose
    const received = domain.getNodeById(div.nodeId);
    assertExists(received);

    // Dispose the domain
    domain.dispose();

    // After dispose, nodeMap is cleared — getNodeById returns null
    const afterDispose = domain.getNodeById(div.nodeId);
    assertEquals(afterDispose, null);
});

Deno.test("DOMDomain - escapeHtmlAttribute escapes single quotes", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new DOMDomain(eventBus);

    const div = createMockElement("div", { title: "it's a test" });
    const doc = createMockDocument([div]);
    const renderResult = createMockRenderResult({ dom: doc });
    const pipeline = createPipelineWithDOM(renderResult);
    const context = createMockContext({ eventBus, renderingPipeline: pipeline });
    domain.initialize(context);
    await domain.enable();
    await domain.handleMethod("getDocument", {});

    const result = await domain.handleMethod("getOuterHTML", { nodeId: div.nodeId });
    const html = (result as Record<string, unknown>).outerHTML as string;

    assertEquals(html.includes("&#39;"), true);
    assertEquals(html.includes("it's"), false);
});

// ============================================================================
// Stale nodeMap Tests — verify queries after mutations return fresh data
// ============================================================================

Deno.test("DOMDomain - querySelector finds node without prior getDocument call", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new DOMDomain(eventBus);

    const child = createMockElement("span", { class: "target" });
    const div = createMockElement("div", {}, [child]);
    // Wire querySelector on div to return child
    (div as unknown as Record<string, unknown>).querySelector = (_sel: string) => child;
    const doc = createMockDocument([div]);

    const renderResult = createMockRenderResult({ dom: doc });
    const pipeline = createPipelineWithDOM(renderResult);
    const context = createMockContext({ eventBus, renderingPipeline: pipeline });
    domain.initialize(context);
    await domain.enable();

    // Without calling getDocument first, querySelector should still work
    // because ensureNodeMapFresh rebuilds the map lazily
    const result = await domain.handleMethod("querySelector", { nodeId: div.nodeId, selector: ".target" });
    assertEquals((result as Record<string, unknown>).nodeId, child.nodeId);
});

Deno.test("DOMDomain - querySelectorAll finds nodes without prior getDocument call", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new DOMDomain(eventBus);

    const child1 = createMockElement("span");
    const child2 = createMockElement("span");
    const div = createMockElement("div", {}, [child1, child2]);
    (div as unknown as Record<string, unknown>).querySelectorAll = (_sel: string) => [child1, child2];
    const doc = createMockDocument([div]);

    const renderResult = createMockRenderResult({ dom: doc });
    const pipeline = createPipelineWithDOM(renderResult);
    const context = createMockContext({ eventBus, renderingPipeline: pipeline });
    domain.initialize(context);
    await domain.enable();

    const result = await domain.handleMethod("querySelectorAll", { nodeId: div.nodeId, selector: "span" });
    const nodeIds = (result as Record<string, unknown>).nodeIds as number[];
    assertEquals(nodeIds.length, 2);
    assertEquals(nodeIds[0], child1.nodeId);
    assertEquals(nodeIds[1], child2.nodeId);
});

Deno.test("DOMDomain - getOuterHTML works without prior getDocument call", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new DOMDomain(eventBus);

    const div = createMockElement("div", { id: "test" });
    const doc = createMockDocument([div]);

    const renderResult = createMockRenderResult({ dom: doc });
    const pipeline = createPipelineWithDOM(renderResult);
    const context = createMockContext({ eventBus, renderingPipeline: pipeline });
    domain.initialize(context);
    await domain.enable();

    // Should not throw — ensureNodeMapFresh rebuilds lazily
    const result = await domain.handleMethod("getOuterHTML", { nodeId: div.nodeId });
    const html = (result as Record<string, unknown>).outerHTML as string;
    assertEquals(html.includes("<div"), true);
});

Deno.test("DOMDomain - querySelector returns fresh data after mutation marks nodeMap dirty", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new DOMDomain(eventBus);

    const child = createMockElement("span", { class: "original" });
    const div = createMockElement("div", {}, [child]);
    (div as unknown as Record<string, unknown>).querySelector = (_sel: string) => child;
    const doc = createMockDocument([div]);

    const renderResult = createMockRenderResult({ dom: doc });
    const pipeline = createPipelineWithDOM(renderResult);
    const context = createMockContext({ eventBus, renderingPipeline: pipeline });
    domain.initialize(context);
    await domain.enable();

    // Populate nodeMap
    await domain.handleMethod("getDocument", {});

    // Mutate: set attribute marks nodeMapDirty = true
    await domain.handleMethod("setAttributeValue", {
        nodeId: child.nodeId,
        name: "class",
        value: "mutated",
    });

    // Now querySelector should still resolve the node (nodeMap rebuilt from dirty)
    const result = await domain.handleMethod("querySelector", { nodeId: div.nodeId, selector: ".mutated" });
    assertEquals((result as Record<string, unknown>).nodeId, child.nodeId);
});

Deno.test("DOMDomain - getOuterHTML reflects attribute changes after mutation", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new DOMDomain(eventBus);

    const div = createMockElement("div", { class: "old" });
    const doc = createMockDocument([div]);

    const renderResult = createMockRenderResult({ dom: doc });
    const pipeline = createPipelineWithDOM(renderResult);
    const context = createMockContext({ eventBus, renderingPipeline: pipeline });
    domain.initialize(context);
    await domain.enable();

    await domain.handleMethod("getDocument", {});

    // Mutate attribute
    await domain.handleMethod("setAttributeValue", {
        nodeId: div.nodeId,
        name: "class",
        value: "new",
    });

    // getOuterHTML should still find the node (nodeMap refreshed despite dirty flag)
    const result = await domain.handleMethod("getOuterHTML", { nodeId: div.nodeId });
    const html = (result as Record<string, unknown>).outerHTML as string;
    assertEquals(html.includes('class="new"'), true);
});

Deno.test("DOMDomain - getNodeById returns fresh node after mutation", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new DOMDomain(eventBus);

    const div = createMockElement("div", { id: "x" });
    const doc = createMockDocument([div]);

    const renderResult = createMockRenderResult({ dom: doc });
    const pipeline = createPipelineWithDOM(renderResult);
    const context = createMockContext({ eventBus, renderingPipeline: pipeline });
    domain.initialize(context);
    await domain.enable();

    await domain.handleMethod("getDocument", {});

    // Mutate to make dirty
    await domain.handleMethod("setAttributeValue", {
        nodeId: div.nodeId,
        name: "id",
        value: "y",
    });

    // getNodeById should still resolve after dirty flag set
    const node = domain.getNodeById(div.nodeId);
    assertExists(node);
    assertEquals(node!.nodeId, div.nodeId);
});
