/**
 * DOMBindings Tests
 *
 * Comprehensive tests for JavaScript DOM bindings.
 */

import { assertEquals, assertExists } from "@std/assert";
import { DOMBindings } from "../../../src/engine/javascript/DOMBindings.ts";
import { DOMNodeType } from "../../../src/types/dom.ts";
import type { DOMNode, DOMElement } from "../../../src/types/dom.ts";
import { createObject, setProperty, getProperty, createString } from "../../../src/engine/javascript/JSValue.ts";

// Mock V8Context for testing
class MockV8Context {
    global = createObject();

    execute(_code: string) {
        return { value: createObject(), error: null };
    }
}

// Helper to create mock DOM nodes
function createMockTextNode(text: string): DOMNode {
    const node: DOMNode = {
        nodeId: Math.random() as any,
        nodeType: DOMNodeType.TEXT,
        nodeName: "#text",
        nodeValue: text,
        parentNode: null,
        childNodes: [],
        firstChild: null,
        lastChild: null,
        previousSibling: null,
        nextSibling: null,
        ownerDocument: null,
        cloneNode: (deep: boolean) => createMockTextNode(text),
        appendChild: (child: DOMNode) => child,
        removeChild: (child: DOMNode) => child,
        insertBefore: (newNode: DOMNode, ref: DOMNode | null) => newNode,
        replaceChild: (newNode: DOMNode, oldNode: DOMNode) => oldNode,
        contains: (other: DOMNode) => false,
        compareDocumentPosition: (other: DOMNode) => 0,
    };
    return node;
}

function createMockElement(tagName: string): DOMElement {
    const element: DOMElement = {
        nodeId: Math.random() as any,
        nodeType: DOMNodeType.ELEMENT,
        nodeName: tagName.toUpperCase(),
        tagName: tagName.toLowerCase(),
        nodeValue: null,
        parentNode: null,
        parentElement: null,
        childNodes: [],
        firstChild: null,
        lastChild: null,
        previousSibling: null,
        nextSibling: null,
        previousElementSibling: null,
        nextElementSibling: null,
        ownerDocument: null,
        attributes: new Map(),
        id: "",
        className: "",
        classList: {
            length: 0,
            value: "",
            add: () => {},
            remove: () => {},
            toggle: () => false,
            contains: () => false,
            replace: () => false,
        },
        getAttribute: (name: string) => element.attributes.get(name) ?? null,
        setAttribute: (name: string, value: string) => { element.attributes.set(name, value); },
        removeAttribute: (name: string) => { element.attributes.delete(name); },
        hasAttribute: (name: string) => element.attributes.has(name),
        cloneNode: (deep: boolean) => createMockElement(tagName),
        appendChild: (child: DOMNode) => child,
        removeChild: (child: DOMNode) => child,
        insertBefore: (newNode: DOMNode, ref: DOMNode | null) => newNode,
        replaceChild: (newNode: DOMNode, oldNode: DOMNode) => oldNode,
        contains: (other: DOMNode) => false,
        compareDocumentPosition: (other: DOMNode) => 0,
    } as any;
    return element;
}

// ============================================================================
// Constructor Tests
// ============================================================================

Deno.test({
    name: "DOMBindings - constructor creates bindings instance",
    fn() {
        const context = new MockV8Context() as any;
        const bindings = new DOMBindings(context);
        assertExists(bindings);
    },
});

// ============================================================================
// Install Tests
// ============================================================================

Deno.test({
    name: "DOMBindings - install adds Node constructor to global",
    fn() {
        const context = new MockV8Context() as any;
        const bindings = new DOMBindings(context);

        bindings.install();

        const nodeConstructor = getProperty(context.global, "Node");
        assertEquals(nodeConstructor.type, "function");
    },
});

Deno.test({
    name: "DOMBindings - install adds Element constructor to global",
    fn() {
        const context = new MockV8Context() as any;
        const bindings = new DOMBindings(context);

        bindings.install();

        const elementConstructor = getProperty(context.global, "Element");
        assertEquals(elementConstructor.type, "function");
    },
});

Deno.test({
    name: "DOMBindings - install adds Document constructor to global",
    fn() {
        const context = new MockV8Context() as any;
        const bindings = new DOMBindings(context);

        bindings.install();

        const documentConstructor = getProperty(context.global, "Document");
        assertEquals(documentConstructor.type, "function");
    },
});

Deno.test({
    name: "DOMBindings - install adds node type constants",
    fn() {
        const context = new MockV8Context() as any;
        const bindings = new DOMBindings(context);

        bindings.install();

        const elementNode = getProperty(context.global, "ELEMENT_NODE");
        assertEquals(elementNode.type, "number");
        if (elementNode.type === "number") {
            assertEquals(elementNode.value, 1);
        }

        const textNode = getProperty(context.global, "TEXT_NODE");
        assertEquals(textNode.type, "number");
        if (textNode.type === "number") {
            assertEquals(textNode.value, 3);
        }

        const documentNode = getProperty(context.global, "DOCUMENT_NODE");
        assertEquals(documentNode.type, "number");
        if (documentNode.type === "number") {
            assertEquals(documentNode.value, 9);
        }
    },
});

// ============================================================================
// Node Wrapping Tests
// ============================================================================

Deno.test({
    name: "DOMBindings - wrapNode creates JS wrapper for text node",
    fn() {
        const context = new MockV8Context() as any;
        const bindings = new DOMBindings(context);

        const textNode = createMockTextNode("Hello");
        const wrapper = bindings.wrapNode(textNode);

        assertEquals(wrapper.nodeType, DOMNodeType.TEXT);
        assertEquals(wrapper.nodeName, "#text");
        assertEquals(wrapper.nodeValue, "Hello");
        assertEquals(wrapper.textContent, "Hello");
    },
});

Deno.test({
    name: "DOMBindings - wrapNode creates JS wrapper for element",
    fn() {
        const context = new MockV8Context() as any;
        const bindings = new DOMBindings(context);

        const element = createMockElement("div");
        const wrapper = bindings.wrapNode(element);

        assertEquals(wrapper.nodeType, DOMNodeType.ELEMENT);
        assertEquals(wrapper.nodeName, "DIV");
    },
});

Deno.test({
    name: "DOMBindings - wrapNode returns same wrapper for same node",
    fn() {
        const context = new MockV8Context() as any;
        const bindings = new DOMBindings(context);

        const textNode = createMockTextNode("Test");
        const wrapper1 = bindings.wrapNode(textNode);
        const wrapper2 = bindings.wrapNode(textNode);

        assertEquals(wrapper1, wrapper2);
    },
});

Deno.test({
    name: "DOMBindings - wrapNode handles node with children",
    fn() {
        const context = new MockV8Context() as any;
        const bindings = new DOMBindings(context);

        const parent = createMockElement("div");
        const child1 = createMockTextNode("Child 1");
        const child2 = createMockTextNode("Child 2");
        parent.childNodes = [child1, child2];

        const wrapper = bindings.wrapNode(parent);

        assertEquals(wrapper.childNodes.length, 2);
        assertEquals(wrapper.childNodes[0].nodeValue, "Child 1");
        assertEquals(wrapper.childNodes[1].nodeValue, "Child 2");
    },
});

Deno.test({
    name: "DOMBindings - wrapNode creates wrapper with methods",
    fn() {
        const context = new MockV8Context() as any;
        const bindings = new DOMBindings(context);

        const element = createMockElement("div");
        const wrapper = bindings.wrapNode(element);

        assertEquals(typeof wrapper.appendChild, "function");
        assertEquals(typeof wrapper.removeChild, "function");
        assertEquals(typeof wrapper.insertBefore, "function");
        assertEquals(typeof wrapper.cloneNode, "function");
        assertEquals(typeof wrapper.contains, "function");
    },
});

// ============================================================================
// Node Unwrapping Tests
// ============================================================================

Deno.test({
    name: "DOMBindings - unwrapNode returns native node",
    fn() {
        const context = new MockV8Context() as any;
        const bindings = new DOMBindings(context);

        const nativeNode = createMockTextNode("Test");
        const wrapper = bindings.wrapNode(nativeNode);
        const unwrapped = bindings.unwrapNode(wrapper);

        assertEquals(unwrapped, nativeNode);
    },
});

Deno.test({
    name: "DOMBindings - unwrapNode returns null for unknown wrapper",
    fn() {
        const context = new MockV8Context() as any;
        const bindings = new DOMBindings(context);

        const unknownWrapper = {
            nodeType: 3,
            nodeName: "#text",
            nodeValue: "test",
            textContent: "test",
            parentNode: null,
            childNodes: [],
            firstChild: null,
            lastChild: null,
            previousSibling: null,
            nextSibling: null,
            appendChild: () => null,
            removeChild: () => null,
            insertBefore: () => null,
            cloneNode: () => null,
            contains: () => false,
        } as any;

        const unwrapped = bindings.unwrapNode(unknownWrapper);
        assertEquals(unwrapped, null);
    },
});

// ============================================================================
// Node Type Tests
// ============================================================================

Deno.test({
    name: "DOMBindings - wraps element node with correct type",
    fn() {
        const context = new MockV8Context() as any;
        const bindings = new DOMBindings(context);

        const element = createMockElement("span");
        const wrapper = bindings.wrapNode(element);

        assertEquals(wrapper.nodeType, DOMNodeType.ELEMENT);
    },
});

Deno.test({
    name: "DOMBindings - wraps text node with correct type",
    fn() {
        const context = new MockV8Context() as any;
        const bindings = new DOMBindings(context);

        const textNode = createMockTextNode("Text");
        const wrapper = bindings.wrapNode(textNode);

        assertEquals(wrapper.nodeType, DOMNodeType.TEXT);
    },
});

// ============================================================================
// Node Name Tests
// ============================================================================

Deno.test({
    name: "DOMBindings - element node name is uppercase",
    fn() {
        const context = new MockV8Context() as any;
        const bindings = new DOMBindings(context);

        const element = createMockElement("div");
        const wrapper = bindings.wrapNode(element);

        assertEquals(wrapper.nodeName, "DIV");
    },
});

Deno.test({
    name: "DOMBindings - text node name is #text",
    fn() {
        const context = new MockV8Context() as any;
        const bindings = new DOMBindings(context);

        const textNode = createMockTextNode("Test");
        const wrapper = bindings.wrapNode(textNode);

        assertEquals(wrapper.nodeName, "#text");
    },
});

// ============================================================================
// Constructor Prototype Tests
// ============================================================================

Deno.test({
    name: "DOMBindings - Node constructor has prototype with appendChild",
    fn() {
        const context = new MockV8Context() as any;
        const bindings = new DOMBindings(context);

        bindings.install();

        const nodeConstructor = getProperty(context.global, "Node");
        const prototype = getProperty(nodeConstructor, "prototype");
        const appendChild = getProperty(prototype, "appendChild");

        assertEquals(appendChild.type, "function");
    },
});

Deno.test({
    name: "DOMBindings - Node constructor has prototype with removeChild",
    fn() {
        const context = new MockV8Context() as any;
        const bindings = new DOMBindings(context);

        bindings.install();

        const nodeConstructor = getProperty(context.global, "Node");
        const prototype = getProperty(nodeConstructor, "prototype");
        const removeChild = getProperty(prototype, "removeChild");

        assertEquals(removeChild.type, "function");
    },
});

Deno.test({
    name: "DOMBindings - Node constructor has prototype with insertBefore",
    fn() {
        const context = new MockV8Context() as any;
        const bindings = new DOMBindings(context);

        bindings.install();

        const nodeConstructor = getProperty(context.global, "Node");
        const prototype = getProperty(nodeConstructor, "prototype");
        const insertBefore = getProperty(prototype, "insertBefore");

        assertEquals(insertBefore.type, "function");
    },
});

Deno.test({
    name: "DOMBindings - Element constructor has prototype with getAttribute",
    fn() {
        const context = new MockV8Context() as any;
        const bindings = new DOMBindings(context);

        bindings.install();

        const elementConstructor = getProperty(context.global, "Element");
        const prototype = getProperty(elementConstructor, "prototype");
        const getAttribute = getProperty(prototype, "getAttribute");

        assertEquals(getAttribute.type, "function");
    },
});

Deno.test({
    name: "DOMBindings - Element constructor has prototype with setAttribute",
    fn() {
        const context = new MockV8Context() as any;
        const bindings = new DOMBindings(context);

        bindings.install();

        const elementConstructor = getProperty(context.global, "Element");
        const prototype = getProperty(elementConstructor, "prototype");
        const setAttribute = getProperty(prototype, "setAttribute");

        assertEquals(setAttribute.type, "function");
    },
});

Deno.test({
    name: "DOMBindings - Element constructor has prototype with removeAttribute",
    fn() {
        const context = new MockV8Context() as any;
        const bindings = new DOMBindings(context);

        bindings.install();

        const elementConstructor = getProperty(context.global, "Element");
        const prototype = getProperty(elementConstructor, "prototype");
        const removeAttribute = getProperty(prototype, "removeAttribute");

        assertEquals(removeAttribute.type, "function");
    },
});

Deno.test({
    name: "DOMBindings - Element constructor has prototype with querySelector",
    fn() {
        const context = new MockV8Context() as any;
        const bindings = new DOMBindings(context);

        bindings.install();

        const elementConstructor = getProperty(context.global, "Element");
        const prototype = getProperty(elementConstructor, "prototype");
        const querySelector = getProperty(prototype, "querySelector");

        assertEquals(querySelector.type, "function");
    },
});

Deno.test({
    name: "DOMBindings - Document constructor has prototype with getElementById",
    fn() {
        const context = new MockV8Context() as any;
        const bindings = new DOMBindings(context);

        bindings.install();

        const documentConstructor = getProperty(context.global, "Document");
        const prototype = getProperty(documentConstructor, "prototype");
        const getElementById = getProperty(prototype, "getElementById");

        assertEquals(getElementById.type, "function");
    },
});

Deno.test({
    name: "DOMBindings - Document constructor has prototype with createElement",
    fn() {
        const context = new MockV8Context() as any;
        const bindings = new DOMBindings(context);

        bindings.install();

        const documentConstructor = getProperty(context.global, "Document");
        const prototype = getProperty(documentConstructor, "prototype");
        const createElement = getProperty(prototype, "createElement");

        assertEquals(createElement.type, "function");
    },
});

Deno.test({
    name: "DOMBindings - Document constructor has prototype with createTextNode",
    fn() {
        const context = new MockV8Context() as any;
        const bindings = new DOMBindings(context);

        bindings.install();

        const documentConstructor = getProperty(context.global, "Document");
        const prototype = getProperty(documentConstructor, "prototype");
        const createTextNode = getProperty(prototype, "createTextNode");

        assertEquals(createTextNode.type, "function");
    },
});

// ============================================================================
// Integration Tests
// ============================================================================

Deno.test({
    name: "DOMBindings - bidirectional mapping works correctly",
    fn() {
        const context = new MockV8Context() as any;
        const bindings = new DOMBindings(context);

        const nativeNode = createMockTextNode("Test");
        const wrapper1 = bindings.wrapNode(nativeNode);
        const unwrapped = bindings.unwrapNode(wrapper1);
        const wrapper2 = bindings.wrapNode(nativeNode);

        assertEquals(unwrapped, nativeNode);
        assertEquals(wrapper1, wrapper2);
    },
});

Deno.test({
    name: "DOMBindings - handles complex node tree",
    fn() {
        const context = new MockV8Context() as any;
        const bindings = new DOMBindings(context);

        const root = createMockElement("html");
        const body = createMockElement("body");
        const div = createMockElement("div");
        const text = createMockTextNode("Content");

        div.childNodes = [text];
        body.childNodes = [div];
        root.childNodes = [body];

        const wrapper = bindings.wrapNode(root);

        assertEquals(wrapper.childNodes.length, 1);
        assertEquals(wrapper.childNodes[0].childNodes.length, 1);
        assertEquals(wrapper.childNodes[0].childNodes[0].childNodes.length, 1);
        assertEquals(wrapper.childNodes[0].childNodes[0].childNodes[0].nodeValue, "Content");
    },
});

Deno.test({
    name: "DOMBindings - multiple bindings instances are independent",
    fn() {
        const context1 = new MockV8Context() as any;
        const context2 = new MockV8Context() as any;
        const bindings1 = new DOMBindings(context1);
        const bindings2 = new DOMBindings(context2);

        const node = createMockTextNode("Test");
        const wrapper1 = bindings1.wrapNode(node);
        const wrapper2 = bindings2.wrapNode(node);

        // Wrappers should be different instances
        assertEquals(wrapper1 !== wrapper2, true);

        // Each should unwrap correctly
        assertEquals(bindings1.unwrapNode(wrapper1), node);
        assertEquals(bindings2.unwrapNode(wrapper2), node);

        // Cross-instance unwrap should return null
        assertEquals(bindings1.unwrapNode(wrapper2), null);
        assertEquals(bindings2.unwrapNode(wrapper1), null);
    },
});

Deno.test({
    name: "DOMBindings - wrapper methods are callable",
    fn() {
        const context = new MockV8Context() as any;
        const bindings = new DOMBindings(context);

        const parent = createMockElement("div");
        const wrapper = bindings.wrapNode(parent);

        // Test that methods can be called without errors
        const child = createMockElement("span");
        const childWrapper = bindings.wrapNode(child);

        const result = wrapper.contains(childWrapper);
        assertEquals(typeof result, "boolean");
    },
});

Deno.test({
    name: "DOMBindings - all node type constants are installed",
    fn() {
        const context = new MockV8Context() as any;
        const bindings = new DOMBindings(context);

        bindings.install();

        const constants = [
            ["ELEMENT_NODE", 1],
            ["ATTRIBUTE_NODE", 2],
            ["TEXT_NODE", 3],
            ["CDATA_SECTION_NODE", 4],
            ["PROCESSING_INSTRUCTION_NODE", 7],
            ["COMMENT_NODE", 8],
            ["DOCUMENT_NODE", 9],
            ["DOCUMENT_TYPE_NODE", 10],
            ["DOCUMENT_FRAGMENT_NODE", 11],
        ];

        for (const [name, value] of constants) {
            const constant = getProperty(context.global, name as string);
            assertEquals(constant.type, "number");
            if (constant.type === "number") {
                assertEquals(constant.value, value);
            }
        }
    },
});
