/**
 * DOMBindings Tests
 *
 * Comprehensive tests for JavaScript DOM bindings.
 */

import { assertEquals, assertExists, assertNotEquals } from "@std/assert";
import { DOMBindings } from "../../../src/engine/javascript/DOMBindings.ts";
import { DOMNodeType } from "../../../src/types/dom.ts";
import type { DOMDocument, DOMElement, DOMNode } from "../../../src/types/dom.ts";
import {
  createBoolean,
  createNull,
  createNumber,
  createObject,
  createString,
  createUndefined,
  defineGetter,
  getProperty,
  isFunction,
  isObject,
  isString,
  setProperty,
} from "../../../src/engine/javascript/JSValue.ts";
import { LayoutBoxImpl } from "../../../src/engine/rendering/layout/LayoutBox.ts";
import type { RenderTree } from "../../../src/engine/rendering/rendering/RenderTree.ts";
import type { Pixels } from "../../../src/types/identifiers.ts";

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
    setAttribute: (name: string, value: string) => {
      element.attributes.set(name, value);
    },
    removeAttribute: (name: string) => {
      element.attributes.delete(name);
    },
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

// ============================================================================
// Native DOM Mutation Tests
// ============================================================================

Deno.test({
  name: "DOMBindings - appendChildNative adds child to parent",
  fn() {
    const context = new MockV8Context() as any;
    const bindings = new DOMBindings(context);

    const parent = createMockElement("div");
    const child = createMockElement("span");

    bindings.appendChildNative(parent, child);

    assertEquals(parent.childNodes.length, 1);
    assertEquals(parent.childNodes[0], child);
    assertEquals(child.parentNode, parent);
    assertEquals(parent.firstChild, child);
    assertEquals(parent.lastChild, child);
  },
});

Deno.test({
  name: "DOMBindings - appendChildNative updates sibling pointers",
  fn() {
    const context = new MockV8Context() as any;
    const bindings = new DOMBindings(context);

    const parent = createMockElement("div");
    const child1 = createMockElement("span");
    const child2 = createMockElement("p");

    bindings.appendChildNative(parent, child1);
    bindings.appendChildNative(parent, child2);

    assertEquals(parent.childNodes.length, 2);
    assertEquals(child1.nextSibling, child2);
    assertEquals(child2.previousSibling, child1);
    assertEquals(parent.firstChild, child1);
    assertEquals(parent.lastChild, child2);
  },
});

Deno.test({
  name: "DOMBindings - appendChildNative removes from old parent first",
  fn() {
    const context = new MockV8Context() as any;
    const bindings = new DOMBindings(context);

    const parent1 = createMockElement("div");
    const parent2 = createMockElement("section");
    const child = createMockElement("span");

    bindings.appendChildNative(parent1, child);
    assertEquals(parent1.childNodes.length, 1);

    bindings.appendChildNative(parent2, child);
    assertEquals(parent1.childNodes.length, 0);
    assertEquals(parent2.childNodes.length, 1);
    assertEquals(child.parentNode, parent2);
  },
});

Deno.test({
  name: "DOMBindings - removeChildNative removes child from parent",
  fn() {
    const context = new MockV8Context() as any;
    const bindings = new DOMBindings(context);

    const parent = createMockElement("div");
    const child = createMockElement("span");

    bindings.appendChildNative(parent, child);
    bindings.removeChildNative(parent, child);

    assertEquals(parent.childNodes.length, 0);
    assertEquals(child.parentNode, null);
    assertEquals(parent.firstChild, null);
    assertEquals(parent.lastChild, null);
  },
});

Deno.test({
  name: "DOMBindings - removeChildNative updates siblings correctly",
  fn() {
    const context = new MockV8Context() as any;
    const bindings = new DOMBindings(context);

    const parent = createMockElement("div");
    const child1 = createMockElement("span");
    const child2 = createMockElement("p");
    const child3 = createMockElement("a");

    bindings.appendChildNative(parent, child1);
    bindings.appendChildNative(parent, child2);
    bindings.appendChildNative(parent, child3);

    // Remove middle child
    bindings.removeChildNative(parent, child2);

    assertEquals(parent.childNodes.length, 2);
    assertEquals(child1.nextSibling, child3);
    assertEquals(child3.previousSibling, child1);
    assertEquals(child2.previousSibling, null);
    assertEquals(child2.nextSibling, null);
  },
});

Deno.test({
  name: "DOMBindings - insertBeforeNative inserts at correct position",
  fn() {
    const context = new MockV8Context() as any;
    const bindings = new DOMBindings(context);

    const parent = createMockElement("div");
    const child1 = createMockElement("span");
    const child2 = createMockElement("p");
    const newChild = createMockElement("a");

    bindings.appendChildNative(parent, child1);
    bindings.appendChildNative(parent, child2);
    bindings.insertBeforeNative(parent, newChild, child2);

    assertEquals(parent.childNodes.length, 3);
    assertEquals(parent.childNodes[0], child1);
    assertEquals(parent.childNodes[1], newChild);
    assertEquals(parent.childNodes[2], child2);
    assertEquals(child1.nextSibling, newChild);
    assertEquals(newChild.previousSibling, child1);
    assertEquals(newChild.nextSibling, child2);
    assertEquals(child2.previousSibling, newChild);
  },
});

Deno.test({
  name: "DOMBindings - insertBeforeNative with null ref appends",
  fn() {
    const context = new MockV8Context() as any;
    const bindings = new DOMBindings(context);

    const parent = createMockElement("div");
    const child1 = createMockElement("span");
    const newChild = createMockElement("a");

    bindings.appendChildNative(parent, child1);
    bindings.insertBeforeNative(parent, newChild, null);

    assertEquals(parent.childNodes.length, 2);
    assertEquals(parent.lastChild, newChild);
  },
});

Deno.test({
  name: "DOMBindings - createElementNative creates proper element",
  fn() {
    const context = new MockV8Context() as any;
    const bindings = new DOMBindings(context);

    const element = bindings.createElementNative("div");

    assertEquals(element.nodeType, DOMNodeType.ELEMENT);
    assertEquals((element as any).tagName, "div");
    assertEquals(element.nodeName, "DIV");
    assertEquals(element.childNodes.length, 0);
    assertEquals(element.parentNode, null);
    assertExists((element as any).attributes);
  },
});

Deno.test({
  name: "DOMBindings - createTextNodeNative creates proper text node",
  fn() {
    const context = new MockV8Context() as any;
    const bindings = new DOMBindings(context);

    const textNode = bindings.createTextNodeNative("Hello World");

    assertEquals(textNode.nodeType, DOMNodeType.TEXT);
    assertEquals(textNode.nodeName, "#text");
    assertEquals(textNode.nodeValue, "Hello World");
    assertEquals(textNode.parentNode, null);
  },
});

// ============================================================================
// wrapNodeAsJSValue Tests
// ============================================================================

Deno.test({
  name: "DOMBindings - wrapNodeAsJSValue creates JSValue with nodeType",
  fn() {
    const context = new MockV8Context() as any;
    const bindings = new DOMBindings(context);

    const element = createMockElement("div");
    const jsValue = bindings.wrapNodeAsJSValue(element);

    assertEquals(jsValue.type, "object");
    const nodeType = getProperty(jsValue, "nodeType");
    assertEquals(nodeType.type, "number");
    if (nodeType.type === "number") assertEquals(nodeType.value, DOMNodeType.ELEMENT);
  },
});

Deno.test({
  name: "DOMBindings - wrapNodeAsJSValue creates JSValue with nodeName",
  fn() {
    const context = new MockV8Context() as any;
    const bindings = new DOMBindings(context);

    const element = createMockElement("div");
    const jsValue = bindings.wrapNodeAsJSValue(element);

    const nodeName = getProperty(jsValue, "nodeName");
    assertEquals(nodeName.type, "string");
    if (nodeName.type === "string") assertEquals(nodeName.value, "DIV");
  },
});

Deno.test({
  name: "DOMBindings - wrapNodeAsJSValue has appendChild method",
  fn() {
    const context = new MockV8Context() as any;
    const bindings = new DOMBindings(context);

    const element = createMockElement("div");
    const jsValue = bindings.wrapNodeAsJSValue(element);

    const appendChild = getProperty(jsValue, "appendChild");
    assertEquals(appendChild.type, "function");
  },
});

Deno.test({
  name: "DOMBindings - wrapNodeAsJSValue appendChild performs real mutation",
  fn() {
    const context = new MockV8Context() as any;
    const bindings = new DOMBindings(context);

    const parent = createMockElement("div");
    const child = createMockElement("span");

    const parentJS = bindings.wrapNodeAsJSValue(parent);
    const childJS = bindings.wrapNodeAsJSValue(child);

    // Call appendChild via nativeImpl
    const appendChildFn = getProperty(parentJS, "appendChild");
    if (appendChildFn.type === "function" && appendChildFn.value.nativeImpl) {
      appendChildFn.value.nativeImpl(childJS);
    }

    // Verify native DOM was mutated
    assertEquals(parent.childNodes.length, 1);
    assertEquals(parent.childNodes[0], child);
    assertEquals(child.parentNode, parent);
  },
});

Deno.test({
  name: "DOMBindings - wrapNodeAsJSValue removeChild performs real mutation",
  fn() {
    const context = new MockV8Context() as any;
    const bindings = new DOMBindings(context);

    const parent = createMockElement("div");
    const child = createMockElement("span");
    bindings.appendChildNative(parent, child);

    const parentJS = bindings.wrapNodeAsJSValue(parent);
    const childJS = bindings.wrapNodeAsJSValue(child);

    const removeChildFn = getProperty(parentJS, "removeChild");
    if (removeChildFn.type === "function" && removeChildFn.value.nativeImpl) {
      removeChildFn.value.nativeImpl(childJS);
    }

    assertEquals(parent.childNodes.length, 0);
    assertEquals(child.parentNode, null);
  },
});

Deno.test({
  name: "DOMBindings - wrapNodeAsJSValue element has getAttribute",
  fn() {
    const context = new MockV8Context() as any;
    const bindings = new DOMBindings(context);

    const element = createMockElement("div");
    element.attributes.set("class", "container");

    const jsValue = bindings.wrapNodeAsJSValue(element);
    const getAttrFn = getProperty(jsValue, "getAttribute");

    assertEquals(getAttrFn.type, "function");
    if (getAttrFn.type === "function" && getAttrFn.value.nativeImpl) {
      const result = getAttrFn.value.nativeImpl(createString("class"));
      assertEquals(result.type, "string");
      if (result.type === "string") assertEquals(result.value, "container");
    }
  },
});

Deno.test({
  name: "DOMBindings - wrapNodeAsJSValue element getAttribute returns null for missing",
  fn() {
    const context = new MockV8Context() as any;
    const bindings = new DOMBindings(context);

    const element = createMockElement("div");
    const jsValue = bindings.wrapNodeAsJSValue(element);
    const getAttrFn = getProperty(jsValue, "getAttribute");

    if (getAttrFn.type === "function" && getAttrFn.value.nativeImpl) {
      const result = getAttrFn.value.nativeImpl(createString("nonexistent"));
      assertEquals(result.type, "null");
    }
  },
});

Deno.test({
  name: "DOMBindings - wrapNodeAsJSValue element setAttribute mutates attributes",
  fn() {
    const context = new MockV8Context() as any;
    const bindings = new DOMBindings(context);

    const element = createMockElement("div");
    const jsValue = bindings.wrapNodeAsJSValue(element);
    const setAttrFn = getProperty(jsValue, "setAttribute");

    if (setAttrFn.type === "function" && setAttrFn.value.nativeImpl) {
      setAttrFn.value.nativeImpl(createString("data-value"), createString("42"));
    }

    assertEquals(element.attributes.get("data-value"), "42");
  },
});

Deno.test({
  name: "DOMBindings - wrapNodeAsJSValue element hasAttribute works",
  fn() {
    const context = new MockV8Context() as any;
    const bindings = new DOMBindings(context);

    const element = createMockElement("div");
    element.attributes.set("id", "test");
    const jsValue = bindings.wrapNodeAsJSValue(element);
    const hasAttrFn = getProperty(jsValue, "hasAttribute");

    if (hasAttrFn.type === "function" && hasAttrFn.value.nativeImpl) {
      const result = hasAttrFn.value.nativeImpl(createString("id"));
      assertEquals(result.type, "boolean");
      if (result.type === "boolean") assertEquals(result.value, true);

      const result2 = hasAttrFn.value.nativeImpl(createString("missing"));
      assertEquals(result2.type, "boolean");
      if (result2.type === "boolean") assertEquals(result2.value, false);
    }
  },
});

Deno.test({
  name: "DOMBindings - wrapNodeAsJSValue element removeAttribute works",
  fn() {
    const context = new MockV8Context() as any;
    const bindings = new DOMBindings(context);

    const element = createMockElement("div");
    element.attributes.set("class", "old");
    const jsValue = bindings.wrapNodeAsJSValue(element);
    const removeAttrFn = getProperty(jsValue, "removeAttribute");

    if (removeAttrFn.type === "function" && removeAttrFn.value.nativeImpl) {
      removeAttrFn.value.nativeImpl(createString("class"));
    }

    assertEquals(element.attributes.has("class"), false);
  },
});

// ============================================================================
// querySelector / getElementById Tests
// ============================================================================

Deno.test({
  name: "DOMBindings - getElementById finds element by id attribute",
  fn() {
    const context = new MockV8Context() as any;
    const bindings = new DOMBindings(context);

    const root = createMockElement("div");
    const target = createMockElement("span");
    target.attributes.set("id", "mySpan");
    root.childNodes = [target];

    const result = bindings.getElementById(root, "mySpan");
    assertExists(result);
    assertEquals(result, target);
  },
});

Deno.test({
  name: "DOMBindings - getElementById returns null when not found",
  fn() {
    const context = new MockV8Context() as any;
    const bindings = new DOMBindings(context);

    const root = createMockElement("div");
    const result = bindings.getElementById(root, "nonexistent");
    assertEquals(result, null);
  },
});

Deno.test({
  name: "DOMBindings - getElementById searches nested children",
  fn() {
    const context = new MockV8Context() as any;
    const bindings = new DOMBindings(context);

    const root = createMockElement("div");
    const child = createMockElement("section");
    const grandchild = createMockElement("p");
    grandchild.attributes.set("id", "deep");
    child.childNodes = [grandchild];
    root.childNodes = [child];

    const result = bindings.getElementById(root, "deep");
    assertExists(result);
    assertEquals(result, grandchild);
  },
});

Deno.test({
  name: "DOMBindings - querySelector with # finds by id",
  fn() {
    const context = new MockV8Context() as any;
    const bindings = new DOMBindings(context);

    const root = createMockElement("div");
    const target = createMockElement("span");
    target.attributes.set("id", "target");
    root.childNodes = [target];

    const result = bindings.querySelector(root, "#target");
    assertExists(result);
    assertEquals(result, target);
  },
});

Deno.test({
  name: "DOMBindings - querySelector with tag name finds by tag",
  fn() {
    const context = new MockV8Context() as any;
    const bindings = new DOMBindings(context);

    const root = createMockElement("div");
    const child = createMockElement("p");
    root.childNodes = [child];

    const result = bindings.querySelector(root, "p");
    assertExists(result);
    assertEquals(result, child);
  },
});

Deno.test({
  name: "DOMBindings - querySelector with . finds by class",
  fn() {
    const context = new MockV8Context() as any;
    const bindings = new DOMBindings(context);

    const root = createMockElement("div");
    const child = createMockElement("span");
    child.className = "highlight";
    child.attributes.set("class", "highlight");
    root.childNodes = [child];

    const result = bindings.querySelector(root, ".highlight");
    assertExists(result);
    assertEquals(result, child);
  },
});

Deno.test({
  name: "DOMBindings - querySelectorAll returns all matching elements",
  fn() {
    const context = new MockV8Context() as any;
    const bindings = new DOMBindings(context);

    const root = createMockElement("div");
    const p1 = createMockElement("p");
    const p2 = createMockElement("p");
    const span = createMockElement("span");
    root.childNodes = [p1, span, p2];

    const results = bindings.querySelectorAll(root, "p");
    assertEquals(results.length, 2);
    assertEquals(results[0], p1);
    assertEquals(results[1], p2);
  },
});

Deno.test({
  name: "DOMBindings - getElementsByTagName collects all matching",
  fn() {
    const context = new MockV8Context() as any;
    const bindings = new DOMBindings(context);

    const root = createMockElement("div");
    const child1 = createMockElement("span");
    const child2 = createMockElement("span");
    root.childNodes = [child1, child2];

    const results = bindings.getElementsByTagName(root, "span");
    assertEquals(results.length, 2);
  },
});

Deno.test({
  name: "DOMBindings - getElementsByClassName collects by class",
  fn() {
    const context = new MockV8Context() as any;
    const bindings = new DOMBindings(context);

    const root = createMockElement("div");
    const child1 = createMockElement("span");
    child1.className = "item";
    child1.attributes.set("class", "item");
    const child2 = createMockElement("p");
    child2.className = "item other";
    child2.attributes.set("class", "item other");
    const child3 = createMockElement("a");
    root.childNodes = [child1, child2, child3];

    const results = bindings.getElementsByClassName(root, "item");
    assertEquals(results.length, 2);
  },
});

// ============================================================================
// Document-Level wrapNodeAsJSValue Tests
// ============================================================================

function createMockDocument(): DOMNode {
  const body = createMockElement("body");
  const head = createMockElement("head");
  const html = createMockElement("html");
  html.childNodes = [head, body];

  const doc: any = {
    nodeId: 1 as any,
    nodeType: DOMNodeType.DOCUMENT,
    nodeName: "#document",
    nodeValue: null,
    parentNode: null,
    childNodes: [html],
    firstChild: html,
    lastChild: html,
    previousSibling: null,
    nextSibling: null,
    ownerDocument: null,
    documentElement: html,
    head: head,
    body: body,
    URL: "https://example.com",
    documentURI: "https://example.com",
    origin: "https://example.com",
    title: "Test Page",
    characterSet: "utf-8",
    readyState: "complete",
    styleSheets: [],
    cloneNode: () => doc,
    appendChild: (child: DOMNode) => child,
    removeChild: (child: DOMNode) => child,
    insertBefore: (n: DOMNode) => n,
    replaceChild: (_n: DOMNode, o: DOMNode) => o,
    contains: () => false,
    compareDocumentPosition: () => 0,
    createElement: (tag: string) => createMockElement(tag),
    createTextNode: (text: string) => createMockTextNode(text),
    createComment: () => createMockTextNode(""),
    createDocumentFragment: () => createMockElement("fragment") as any,
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
  };
  return doc as DOMNode;
}

Deno.test({
  name: "DOMBindings - wrapNodeAsJSValue document has getElementById",
  fn() {
    const context = new MockV8Context() as any;
    const bindings = new DOMBindings(context);

    const doc = createMockDocument();
    const jsDoc = bindings.wrapNodeAsJSValue(doc);

    const getByIdFn = getProperty(jsDoc, "getElementById");
    assertEquals(getByIdFn.type, "function");
  },
});

Deno.test({
  name: "DOMBindings - wrapNodeAsJSValue document getElementById finds element",
  fn() {
    const context = new MockV8Context() as any;
    const bindings = new DOMBindings(context);

    const doc = createMockDocument();
    // Add an element with an id to the body
    const docAny = doc as any;
    const targetEl = createMockElement("div");
    targetEl.attributes.set("id", "main");
    docAny.body.childNodes = [targetEl];
    docAny.childNodes[0].childNodes = [docAny.head, docAny.body];

    const jsDoc = bindings.wrapNodeAsJSValue(doc);
    const getByIdFn = getProperty(jsDoc, "getElementById");

    if (getByIdFn.type === "function" && getByIdFn.value.nativeImpl) {
      const result = getByIdFn.value.nativeImpl(createString("main"));
      assertEquals(result.type, "object");
      if (result.type === "object") {
        const tagName = getProperty(result, "tagName");
        assertEquals(tagName.type, "string");
        if (tagName.type === "string") assertEquals(tagName.value, "DIV");
      }
    }
  },
});

Deno.test({
  name: "DOMBindings - wrapNodeAsJSValue document createElement works",
  fn() {
    const context = new MockV8Context() as any;
    const bindings = new DOMBindings(context);

    const doc = createMockDocument();
    const jsDoc = bindings.wrapNodeAsJSValue(doc);

    const createElFn = getProperty(jsDoc, "createElement");
    if (createElFn.type === "function" && createElFn.value.nativeImpl) {
      const result = createElFn.value.nativeImpl(createString("span"));
      assertEquals(result.type, "object");
      if (result.type === "object") {
        const nodeType = getProperty(result, "nodeType");
        assertEquals(nodeType.type, "number");
        if (nodeType.type === "number") assertEquals(nodeType.value, DOMNodeType.ELEMENT);
      }
    }
  },
});

Deno.test({
  name: "DOMBindings - wrapNodeAsJSValue document createTextNode works",
  fn() {
    const context = new MockV8Context() as any;
    const bindings = new DOMBindings(context);

    const doc = createMockDocument();
    const jsDoc = bindings.wrapNodeAsJSValue(doc);

    const createTextFn = getProperty(jsDoc, "createTextNode");
    if (createTextFn.type === "function" && createTextFn.value.nativeImpl) {
      const result = createTextFn.value.nativeImpl(createString("Hello"));
      assertEquals(result.type, "object");
      if (result.type === "object") {
        const nodeType = getProperty(result, "nodeType");
        assertEquals(nodeType.type, "number");
        if (nodeType.type === "number") assertEquals(nodeType.value, DOMNodeType.TEXT);

        const nodeValue = getProperty(result, "nodeValue");
        assertEquals(nodeValue.type, "string");
        if (nodeValue.type === "string") assertEquals(nodeValue.value, "Hello");
      }
    }
  },
});

Deno.test({
  name: "DOMBindings - wrapNodeAsJSValue document has title property",
  fn() {
    const context = new MockV8Context() as any;
    const bindings = new DOMBindings(context);

    const doc = createMockDocument();
    const jsDoc = bindings.wrapNodeAsJSValue(doc);

    const title = getProperty(jsDoc, "title");
    assertEquals(title.type, "string");
    if (title.type === "string") assertEquals(title.value, "Test Page");
  },
});

Deno.test({
  name: "DOMBindings - wrapNodeAsJSValue document has body property",
  fn() {
    const context = new MockV8Context() as any;
    const bindings = new DOMBindings(context);

    const doc = createMockDocument();
    const jsDoc = bindings.wrapNodeAsJSValue(doc);

    const body = getProperty(jsDoc, "body");
    assertEquals(body.type, "object");
  },
});

// ============================================================================
// Full Round-Trip Tests
// ============================================================================

Deno.test({
  name: "DOMBindings - full round-trip: create, set attributes, append, query",
  fn() {
    const context = new MockV8Context() as any;
    const bindings = new DOMBindings(context);

    // Create parent
    const parent = createMockElement("div");
    parent.attributes.set("id", "container");

    // Create child with bindings
    const child = bindings.createElementNative("p");
    const childEl = child as any;
    childEl.attributes.set("class", "content");
    childEl.className = "content";

    // Append child to parent
    bindings.appendChildNative(parent, child);

    // Query back
    const found = bindings.querySelector(parent, ".content");
    assertExists(found);
    assertEquals(found, child);

    // Query by tag
    const foundByTag = bindings.querySelector(parent, "p");
    assertExists(foundByTag);
    assertEquals(foundByTag, child);
  },
});

Deno.test({
  name: "DOMBindings - wrapNode appendChild performs real DOM mutation",
  fn() {
    const context = new MockV8Context() as any;
    const bindings = new DOMBindings(context);

    const parent = createMockElement("div");
    const child = createMockElement("span");

    const parentWrapper = bindings.wrapNode(parent);
    const childWrapper = bindings.wrapNode(child);

    parentWrapper.appendChild(childWrapper);

    // JSNode level updated
    assertEquals(parentWrapper.childNodes.length, 1);
    assertEquals(parentWrapper.childNodes[0], childWrapper);

    // Native DOM level updated
    assertEquals(parent.childNodes.length, 1);
    assertEquals(parent.childNodes[0], child);
    assertEquals(child.parentNode, parent);
  },
});

Deno.test({
  name: "DOMBindings - wrapNode removeChild performs real DOM mutation",
  fn() {
    const context = new MockV8Context() as any;
    const bindings = new DOMBindings(context);

    const parent = createMockElement("div");
    const child = createMockElement("span");
    bindings.appendChildNative(parent, child);

    const parentWrapper = bindings.wrapNode(parent);
    const childWrapper = parentWrapper.childNodes[0];

    parentWrapper.removeChild(childWrapper);

    assertEquals(parentWrapper.childNodes.length, 0);
    assertEquals(parent.childNodes.length, 0);
    assertEquals(child.parentNode, null);
  },
});

Deno.test({
  name: "DOMBindings - unwrapJSValue retrieves native node from JSValue",
  fn() {
    const context = new MockV8Context() as any;
    const bindings = new DOMBindings(context);

    const element = createMockElement("div");
    const jsValue = bindings.wrapNodeAsJSValue(element);

    const unwrapped = bindings.unwrapJSValue(jsValue);
    assertExists(unwrapped);
    assertEquals(unwrapped, element);
  },
});

Deno.test({
  name: "DOMBindings - wrapNodeAsJSValue has contains method",
  fn() {
    const context = new MockV8Context() as any;
    const bindings = new DOMBindings(context);

    const parent = createMockElement("div");
    const child = createMockElement("span");
    bindings.appendChildNative(parent, child);

    const parentJS = bindings.wrapNodeAsJSValue(parent);
    const childJS = bindings.wrapNodeAsJSValue(child);

    const containsFn = getProperty(parentJS, "contains");
    if (containsFn.type === "function" && containsFn.value.nativeImpl) {
      const result = containsFn.value.nativeImpl(childJS);
      assertEquals(result.type, "boolean");
      if (result.type === "boolean") assertEquals(result.value, true);
    }
  },
});

Deno.test({
  name: "DOMBindings - wrapNodeAsJSValue has cloneNode method",
  fn() {
    const context = new MockV8Context() as any;
    const bindings = new DOMBindings(context);

    const element = createMockElement("div");
    element.attributes.set("id", "original");

    const jsValue = bindings.wrapNodeAsJSValue(element);
    const cloneFn = getProperty(jsValue, "cloneNode");

    assertEquals(cloneFn.type, "function");
  },
});

Deno.test({
  name: "DOMBindings - wrapNodeAsJSValue element has querySelector",
  fn() {
    const context = new MockV8Context() as any;
    const bindings = new DOMBindings(context);

    const parent = createMockElement("div");
    const child = createMockElement("span");
    child.attributes.set("id", "inner");
    parent.childNodes = [child];

    const parentJS = bindings.wrapNodeAsJSValue(parent);
    const qsFn = getProperty(parentJS, "querySelector");

    if (qsFn.type === "function" && qsFn.value.nativeImpl) {
      const result = qsFn.value.nativeImpl(createString("#inner"));
      assertEquals(result.type, "object");
      if (result.type === "object") {
        const tagName = getProperty(result, "tagName");
        if (tagName.type === "string") assertEquals(tagName.value, "SPAN");
      }
    }
  },
});

Deno.test({
  name: "DOMBindings - wrapNodeAsJSValue querySelector returns null when not found",
  fn() {
    const context = new MockV8Context() as any;
    const bindings = new DOMBindings(context);

    const element = createMockElement("div");
    const jsValue = bindings.wrapNodeAsJSValue(element);
    const qsFn = getProperty(jsValue, "querySelector");

    if (qsFn.type === "function" && qsFn.value.nativeImpl) {
      const result = qsFn.value.nativeImpl(createString("#nonexistent"));
      assertEquals(result.type, "null");
    }
  },
});

// ============================================================================
// replaceChild Tests
// ============================================================================

Deno.test({
  name: "DOMBindings - replaceChild via JSValue replaces child in DOM",
  fn() {
    const context = new MockV8Context() as any;
    const bindings = new DOMBindings(context);

    const parent = createMockElement("div");
    const oldChild = createMockElement("span");
    const newChild = createMockElement("p");

    bindings.appendChildNative(parent, oldChild);

    const parentJS = bindings.wrapNodeAsJSValue(parent);
    const oldChildJS = bindings.wrapNodeAsJSValue(oldChild);
    const newChildJS = bindings.wrapNodeAsJSValue(newChild);

    const replaceFn = getProperty(parentJS, "replaceChild");
    if (replaceFn.type === "function" && replaceFn.value.nativeImpl) {
      replaceFn.value.nativeImpl(newChildJS, oldChildJS);
    }

    assertEquals(parent.childNodes.length, 1);
    assertEquals(parent.childNodes[0], newChild);
    assertEquals(oldChild.parentNode, null);
    assertEquals(newChild.parentNode, parent);
  },
});

Deno.test({
  name: "DOMBindings - replaceChild preserves sibling order",
  fn() {
    const context = new MockV8Context() as any;
    const bindings = new DOMBindings(context);

    const parent = createMockElement("div");
    const first = createMockElement("a");
    const middle = createMockElement("b");
    const last = createMockElement("c");
    const replacement = createMockElement("x");

    bindings.appendChildNative(parent, first);
    bindings.appendChildNative(parent, middle);
    bindings.appendChildNative(parent, last);

    const parentJS = bindings.wrapNodeAsJSValue(parent);
    const middleJS = bindings.wrapNodeAsJSValue(middle);
    const replJS = bindings.wrapNodeAsJSValue(replacement);

    const replaceFn = getProperty(parentJS, "replaceChild");
    if (replaceFn.type === "function" && replaceFn.value.nativeImpl) {
      replaceFn.value.nativeImpl(replJS, middleJS);
    }

    assertEquals(parent.childNodes.length, 3);
    assertEquals(parent.childNodes[0], first);
    assertEquals(parent.childNodes[1], replacement);
    assertEquals(parent.childNodes[2], last);
  },
});

// ============================================================================
// setTextContent Tests
// ============================================================================

Deno.test({
  name: "DOMBindings - setTextContent replaces children with text node",
  fn() {
    const context = new MockV8Context() as any;
    const bindings = new DOMBindings(context);

    const parent = createMockElement("div");
    const child1 = createMockElement("span");
    const child2 = createMockElement("p");
    bindings.appendChildNative(parent, child1);
    bindings.appendChildNative(parent, child2);

    const parentJS = bindings.wrapNodeAsJSValue(parent);
    const setTextFn = getProperty(parentJS, "setTextContent");

    if (setTextFn.type === "function" && setTextFn.value.nativeImpl) {
      setTextFn.value.nativeImpl(createString("new text"));
    }

    assertEquals(parent.childNodes.length, 1);
    assertEquals(parent.childNodes[0].nodeType, DOMNodeType.TEXT);
    assertEquals(parent.childNodes[0].nodeValue, "new text");
  },
});

Deno.test({
  name: "DOMBindings - textContent computed from nested text nodes",
  fn() {
    const context = new MockV8Context() as any;
    const bindings = new DOMBindings(context);

    const parent = createMockElement("div");
    const span = createMockElement("span");
    const text1 = createMockTextNode("Hello ");
    const text2 = createMockTextNode("World");

    bindings.appendChildNative(span, text1);
    bindings.appendChildNative(parent, span);
    bindings.appendChildNative(parent, text2);

    const parentJS = bindings.wrapNodeAsJSValue(parent);
    const textContent = getProperty(parentJS, "textContent");
    assertEquals(textContent.type, "string");
    if (textContent.type === "string") {
      assertEquals(textContent.value, "Hello World");
    }
  },
});

// ============================================================================
// matches / closest Tests
// ============================================================================

Deno.test({
  name: "DOMBindings - matches returns true for matching tag selector",
  fn() {
    const context = new MockV8Context() as any;
    const bindings = new DOMBindings(context);

    const element = createMockElement("div");
    const jsValue = bindings.wrapNodeAsJSValue(element);
    const matchesFn = getProperty(jsValue, "matches");

    if (matchesFn.type === "function" && matchesFn.value.nativeImpl) {
      const result = matchesFn.value.nativeImpl(createString("div"));
      assertEquals(result.type, "boolean");
      if (result.type === "boolean") assertEquals(result.value, true);
    }
  },
});

Deno.test({
  name: "DOMBindings - matches returns false for non-matching selector",
  fn() {
    const context = new MockV8Context() as any;
    const bindings = new DOMBindings(context);

    const element = createMockElement("div");
    const jsValue = bindings.wrapNodeAsJSValue(element);
    const matchesFn = getProperty(jsValue, "matches");

    if (matchesFn.type === "function" && matchesFn.value.nativeImpl) {
      const result = matchesFn.value.nativeImpl(createString("span"));
      assertEquals(result.type, "boolean");
      if (result.type === "boolean") assertEquals(result.value, false);
    }
  },
});

Deno.test({
  name: "DOMBindings - matches works with id selector",
  fn() {
    const context = new MockV8Context() as any;
    const bindings = new DOMBindings(context);

    const element = createMockElement("div");
    element.attributes.set("id", "main");
    element.id = "main";
    const jsValue = bindings.wrapNodeAsJSValue(element);
    const matchesFn = getProperty(jsValue, "matches");

    if (matchesFn.type === "function" && matchesFn.value.nativeImpl) {
      const result = matchesFn.value.nativeImpl(createString("#main"));
      assertEquals(result.type, "boolean");
      if (result.type === "boolean") assertEquals(result.value, true);
    }
  },
});

Deno.test({
  name: "DOMBindings - matches works with class selector",
  fn() {
    const context = new MockV8Context() as any;
    const bindings = new DOMBindings(context);

    const element = createMockElement("div");
    element.className = "active";
    element.attributes.set("class", "active");
    const jsValue = bindings.wrapNodeAsJSValue(element);
    const matchesFn = getProperty(jsValue, "matches");

    if (matchesFn.type === "function" && matchesFn.value.nativeImpl) {
      const result = matchesFn.value.nativeImpl(createString(".active"));
      assertEquals(result.type, "boolean");
      if (result.type === "boolean") assertEquals(result.value, true);
    }
  },
});

Deno.test({
  name: "DOMBindings - matches with wildcard * returns true for any element",
  fn() {
    const context = new MockV8Context() as any;
    const bindings = new DOMBindings(context);

    const element = createMockElement("section");
    const jsValue = bindings.wrapNodeAsJSValue(element);
    const matchesFn = getProperty(jsValue, "matches");

    if (matchesFn.type === "function" && matchesFn.value.nativeImpl) {
      const result = matchesFn.value.nativeImpl(createString("*"));
      assertEquals(result.type, "boolean");
      if (result.type === "boolean") assertEquals(result.value, true);
    }
  },
});

Deno.test({
  name: "DOMBindings - closest finds matching ancestor",
  fn() {
    const context = new MockV8Context() as any;
    const bindings = new DOMBindings(context);

    const grandparent = createMockElement("section");
    grandparent.attributes.set("class", "wrapper");
    grandparent.className = "wrapper";
    const parent = createMockElement("div");
    const child = createMockElement("span");

    bindings.appendChildNative(grandparent, parent);
    bindings.appendChildNative(parent, child);

    const childJS = bindings.wrapNodeAsJSValue(child);
    const closestFn = getProperty(childJS, "closest");

    if (closestFn.type === "function" && closestFn.value.nativeImpl) {
      const result = closestFn.value.nativeImpl(createString(".wrapper"));
      assertEquals(result.type, "object");
      if (result.type === "object") {
        const tagName = getProperty(result, "tagName");
        if (tagName.type === "string") assertEquals(tagName.value, "SECTION");
      }
    }
  },
});

Deno.test({
  name: "DOMBindings - closest returns null when no match",
  fn() {
    const context = new MockV8Context() as any;
    const bindings = new DOMBindings(context);

    const parent = createMockElement("div");
    const child = createMockElement("span");
    bindings.appendChildNative(parent, child);

    const childJS = bindings.wrapNodeAsJSValue(child);
    const closestFn = getProperty(childJS, "closest");

    if (closestFn.type === "function" && closestFn.value.nativeImpl) {
      const result = closestFn.value.nativeImpl(createString(".nonexistent"));
      assertEquals(result.type, "null");
    }
  },
});

Deno.test({
  name: "DOMBindings - closest matches self",
  fn() {
    const context = new MockV8Context() as any;
    const bindings = new DOMBindings(context);

    const element = createMockElement("div");
    element.attributes.set("id", "self");
    element.id = "self";

    const jsValue = bindings.wrapNodeAsJSValue(element);
    const closestFn = getProperty(jsValue, "closest");

    if (closestFn.type === "function" && closestFn.value.nativeImpl) {
      const result = closestFn.value.nativeImpl(createString("#self"));
      assertEquals(result.type, "object");
    }
  },
});

// ============================================================================
// children / parentElement / Element Sibling Tests
// ============================================================================

Deno.test({
  name: "DOMBindings - children contains only element children",
  fn() {
    const context = new MockV8Context() as any;
    const bindings = new DOMBindings(context);

    const parent = createMockElement("div");
    const text = createMockTextNode("text");
    const span = createMockElement("span");
    const p = createMockElement("p");

    bindings.appendChildNative(parent, text);
    bindings.appendChildNative(parent, span);
    bindings.appendChildNative(parent, p);

    const parentJS = bindings.wrapNodeAsJSValue(parent);
    const children = getProperty(parentJS, "children");
    assertEquals(children.type, "object");
    if (children.type === "object") {
      const length = getProperty(children, "length");
      assertEquals(length.type, "number");
      if (length.type === "number") assertEquals(length.value, 2);
    }
  },
});

Deno.test({
  name: "DOMBindings - parentElement is set for child of element",
  fn() {
    const context = new MockV8Context() as any;
    const bindings = new DOMBindings(context);

    const parent = createMockElement("div");
    const child = createMockElement("span");
    bindings.appendChildNative(parent, child);

    const childJS = bindings.wrapNodeAsJSValue(child);
    const parentEl = getProperty(childJS, "parentElement");
    assertEquals(parentEl.type, "object");
    if (parentEl.type === "object") {
      const tagName = getProperty(parentEl, "tagName");
      if (tagName.type === "string") assertEquals(tagName.value, "DIV");
    }
  },
});

Deno.test({
  name: "DOMBindings - parentElement is null for root element",
  fn() {
    const context = new MockV8Context() as any;
    const bindings = new DOMBindings(context);

    const element = createMockElement("div");
    const jsValue = bindings.wrapNodeAsJSValue(element);
    const parentEl = getProperty(jsValue, "parentElement");
    assertEquals(parentEl.type, "null");
  },
});

Deno.test({
  name: "DOMBindings - nextElementSibling skips text nodes",
  fn() {
    const context = new MockV8Context() as any;
    const bindings = new DOMBindings(context);

    const parent = createMockElement("div");
    const first = createMockElement("span");
    const text = createMockTextNode("text");
    const second = createMockElement("p");

    bindings.appendChildNative(parent, first);
    bindings.appendChildNative(parent, text);
    bindings.appendChildNative(parent, second);

    const firstJS = bindings.wrapNodeAsJSValue(first);
    const nextEl = getProperty(firstJS, "nextElementSibling");
    assertEquals(nextEl.type, "object");
    if (nextEl.type === "object") {
      const tagName = getProperty(nextEl, "tagName");
      if (tagName.type === "string") assertEquals(tagName.value, "P");
    }
  },
});

Deno.test({
  name: "DOMBindings - previousElementSibling skips text nodes",
  fn() {
    const context = new MockV8Context() as any;
    const bindings = new DOMBindings(context);

    const parent = createMockElement("div");
    const first = createMockElement("span");
    const text = createMockTextNode("text");
    const second = createMockElement("p");

    bindings.appendChildNative(parent, first);
    bindings.appendChildNative(parent, text);
    bindings.appendChildNative(parent, second);

    const secondJS = bindings.wrapNodeAsJSValue(second);
    const prevEl = getProperty(secondJS, "previousElementSibling");
    assertEquals(prevEl.type, "object");
    if (prevEl.type === "object") {
      const tagName = getProperty(prevEl, "tagName");
      if (tagName.type === "string") assertEquals(tagName.value, "SPAN");
    }
  },
});

Deno.test({
  name: "DOMBindings - nextElementSibling is null when no next element",
  fn() {
    const context = new MockV8Context() as any;
    const bindings = new DOMBindings(context);

    const parent = createMockElement("div");
    const child = createMockElement("span");
    bindings.appendChildNative(parent, child);

    const childJS = bindings.wrapNodeAsJSValue(child);
    const nextEl = getProperty(childJS, "nextElementSibling");
    assertEquals(nextEl.type, "null");
  },
});

// ============================================================================
// innerHTML / outerHTML Tests
// ============================================================================

Deno.test({
  name: "DOMBindings - innerHTML serializes children",
  fn() {
    const context = new MockV8Context() as any;
    const bindings = new DOMBindings(context);

    const parent = createMockElement("div");
    const text = createMockTextNode("Hello");
    bindings.appendChildNative(parent, text);

    const parentJS = bindings.wrapNodeAsJSValue(parent);
    const innerHTML = getProperty(parentJS, "innerHTML");
    assertEquals(innerHTML.type, "string");
    if (innerHTML.type === "string") assertEquals(innerHTML.value, "Hello");
  },
});

Deno.test({
  name: "DOMBindings - innerHTML serializes nested elements",
  fn() {
    const context = new MockV8Context() as any;
    const bindings = new DOMBindings(context);

    const parent = createMockElement("div");
    const span = bindings.createElementNative("span");
    const text = bindings.createTextNodeNative("inner");
    bindings.appendChildNative(span, text);
    bindings.appendChildNative(parent, span);

    const parentJS = bindings.wrapNodeAsJSValue(parent);
    const innerHTML = getProperty(parentJS, "innerHTML");
    assertEquals(innerHTML.type, "string");
    if (innerHTML.type === "string") assertEquals(innerHTML.value, "<span>inner</span>");
  },
});

Deno.test({
  name: "DOMBindings - outerHTML includes the element itself",
  fn() {
    const context = new MockV8Context() as any;
    const bindings = new DOMBindings(context);

    const element = bindings.createElementNative("p");
    const text = bindings.createTextNodeNative("content");
    bindings.appendChildNative(element, text);

    const jsValue = bindings.wrapNodeAsJSValue(element);
    const outerHTML = getProperty(jsValue, "outerHTML");
    assertEquals(outerHTML.type, "string");
    if (outerHTML.type === "string") assertEquals(outerHTML.value, "<p>content</p>");
  },
});

Deno.test({
  name: "DOMBindings - outerHTML includes attributes",
  fn() {
    const context = new MockV8Context() as any;
    const bindings = new DOMBindings(context);

    const element = bindings.createElementNative("div");
    (element as any).attributes.set("id", "main");
    (element as any).attributes.set("class", "container");

    const jsValue = bindings.wrapNodeAsJSValue(element);
    const outerHTML = getProperty(jsValue, "outerHTML");
    assertEquals(outerHTML.type, "string");
    if (outerHTML.type === "string") {
      assertEquals(outerHTML.value.includes('id="main"'), true);
      assertEquals(outerHTML.value.includes('class="container"'), true);
    }
  },
});

Deno.test({
  name: "DOMBindings - innerHTML of void element is empty",
  fn() {
    const context = new MockV8Context() as any;
    const bindings = new DOMBindings(context);

    const br = bindings.createElementNative("br");
    const jsValue = bindings.wrapNodeAsJSValue(br);
    const innerHTML = getProperty(jsValue, "innerHTML");
    assertEquals(innerHTML.type, "string");
    if (innerHTML.type === "string") assertEquals(innerHTML.value, "");
  },
});

// ============================================================================
// createComment Tests
// ============================================================================

Deno.test({
  name: "DOMBindings - createCommentNative creates comment node",
  fn() {
    const context = new MockV8Context() as any;
    const bindings = new DOMBindings(context);

    const comment = bindings.createCommentNative("this is a comment");
    assertEquals(comment.nodeType, DOMNodeType.COMMENT);
    assertEquals(comment.nodeName, "#comment");
    assertEquals(comment.nodeValue, "this is a comment");
  },
});

Deno.test({
  name: "DOMBindings - document createComment via JSValue",
  fn() {
    const context = new MockV8Context() as any;
    const bindings = new DOMBindings(context);

    const doc = createMockDocument();
    const jsDoc = bindings.wrapNodeAsJSValue(doc);

    const createCommentFn = getProperty(jsDoc, "createComment");
    assertEquals(createCommentFn.type, "function");

    if (createCommentFn.type === "function" && createCommentFn.value.nativeImpl) {
      const result = createCommentFn.value.nativeImpl(createString("comment text"));
      assertEquals(result.type, "object");
      if (result.type === "object") {
        const nodeType = getProperty(result, "nodeType");
        assertEquals(nodeType.type, "number");
        if (nodeType.type === "number") assertEquals(nodeType.value, DOMNodeType.COMMENT);
      }
    }
  },
});

// ============================================================================
// Wildcard * querySelector Tests
// ============================================================================

Deno.test({
  name: "DOMBindings - querySelector with * returns first element child",
  fn() {
    const context = new MockV8Context() as any;
    const bindings = new DOMBindings(context);

    const root = createMockElement("div");
    const child1 = createMockElement("span");
    const child2 = createMockElement("p");
    root.childNodes = [child1, child2];

    const result = bindings.querySelector(root, "*");
    // The root itself matches * since it is an element
    assertExists(result);
  },
});

Deno.test({
  name: "DOMBindings - querySelectorAll with * returns all elements",
  fn() {
    const context = new MockV8Context() as any;
    const bindings = new DOMBindings(context);

    const root = createMockElement("div");
    const span = createMockElement("span");
    const p = createMockElement("p");
    const text = createMockTextNode("text");
    root.childNodes = [span, text, p];

    const results = bindings.querySelectorAll(root, "*");
    // root + span + p = 3 elements (text nodes excluded)
    assertEquals(results.length, 3);
  },
});

Deno.test({
  name: "DOMBindings - getElementsByTagName with * returns all elements",
  fn() {
    const context = new MockV8Context() as any;
    const bindings = new DOMBindings(context);

    const root = createMockElement("div");
    const span = createMockElement("span");
    const text = createMockTextNode("hello");
    root.childNodes = [span, text];

    const results = bindings.getElementsByTagName(root, "*");
    assertEquals(results.length, 2); // root + span
  },
});

// ============================================================================
// hasChildNodes Tests
// ============================================================================

Deno.test({
  name: "DOMBindings - hasChildNodes returns true when children exist",
  fn() {
    const context = new MockV8Context() as any;
    const bindings = new DOMBindings(context);

    const parent = createMockElement("div");
    const child = createMockElement("span");
    bindings.appendChildNative(parent, child);

    const parentJS = bindings.wrapNodeAsJSValue(parent);
    const fn = getProperty(parentJS, "hasChildNodes");
    if (fn.type === "function" && fn.value.nativeImpl) {
      const result = fn.value.nativeImpl();
      assertEquals(result.type, "boolean");
      if (result.type === "boolean") assertEquals(result.value, true);
    }
  },
});

Deno.test({
  name: "DOMBindings - hasChildNodes returns false when empty",
  fn() {
    const context = new MockV8Context() as any;
    const bindings = new DOMBindings(context);

    const element = createMockElement("div");
    const jsValue = bindings.wrapNodeAsJSValue(element);
    const fn = getProperty(jsValue, "hasChildNodes");
    if (fn.type === "function" && fn.value.nativeImpl) {
      const result = fn.value.nativeImpl();
      assertEquals(result.type, "boolean");
      if (result.type === "boolean") assertEquals(result.value, false);
    }
  },
});

// ============================================================================
// cloneNode Tests
// ============================================================================

Deno.test({
  name: "DOMBindings - cloneNode shallow produces independent copy",
  fn() {
    const context = new MockV8Context() as any;
    const bindings = new DOMBindings(context);

    const element = createMockElement("div");
    element.attributes.set("id", "original");
    const child = createMockElement("span");
    bindings.appendChildNative(element, child);

    const jsValue = bindings.wrapNodeAsJSValue(element);
    const cloneFn = getProperty(jsValue, "cloneNode");

    if (cloneFn.type === "function" && cloneFn.value.nativeImpl) {
      const cloned = cloneFn.value.nativeImpl(createBoolean(false));
      assertEquals(cloned.type, "object");
      if (cloned.type === "object") {
        const nodeType = getProperty(cloned, "nodeType");
        if (nodeType.type === "number") assertEquals(nodeType.value, DOMNodeType.ELEMENT);
        // Shallow clone should have no children
        const childNodes = getProperty(cloned, "childNodes");
        if (childNodes.type === "object") {
          const length = getProperty(childNodes, "length");
          if (length.type === "number") assertEquals(length.value, 0);
        }
      }
    }
  },
});

Deno.test({
  name: "DOMBindings - cloneNode deep copies children",
  fn() {
    const context = new MockV8Context() as any;
    const bindings = new DOMBindings(context);

    const element = createMockElement("div");
    const child = createMockElement("span");
    bindings.appendChildNative(element, child);

    const jsValue = bindings.wrapNodeAsJSValue(element);
    const cloneFn = getProperty(jsValue, "cloneNode");

    if (cloneFn.type === "function" && cloneFn.value.nativeImpl) {
      const cloned = cloneFn.value.nativeImpl(createBoolean(true));
      assertEquals(cloned.type, "object");
      if (cloned.type === "object") {
        const childNodes = getProperty(cloned, "childNodes");
        if (childNodes.type === "object") {
          const length = getProperty(childNodes, "length");
          if (length.type === "number") assertEquals(length.value, 1);
        }
      }
    }
  },
});

// ============================================================================
// insertBefore at First Position Tests
// ============================================================================

Deno.test({
  name: "DOMBindings - insertBefore at first position updates firstChild",
  fn() {
    const context = new MockV8Context() as any;
    const bindings = new DOMBindings(context);

    const parent = createMockElement("div");
    const existing = createMockElement("span");
    const newFirst = createMockElement("p");

    bindings.appendChildNative(parent, existing);
    bindings.insertBeforeNative(parent, newFirst, existing);

    assertEquals(parent.firstChild, newFirst);
    assertEquals(parent.childNodes[0], newFirst);
    assertEquals(parent.childNodes[1], existing);
    assertEquals(newFirst.nextSibling, existing);
    assertEquals(existing.previousSibling, newFirst);
  },
});

// ============================================================================
// setAttribute id/class sync Tests
// ============================================================================

Deno.test({
  name: "DOMBindings - setAttribute id syncs to element id property",
  fn() {
    const context = new MockV8Context() as any;
    const bindings = new DOMBindings(context);

    const element = createMockElement("div");
    const jsValue = bindings.wrapNodeAsJSValue(element);
    const setAttrFn = getProperty(jsValue, "setAttribute");

    if (setAttrFn.type === "function" && setAttrFn.value.nativeImpl) {
      setAttrFn.value.nativeImpl(createString("id"), createString("myId"));
    }

    assertEquals(element.attributes.get("id"), "myId");
    assertEquals(element.id, "myId");
  },
});

Deno.test({
  name: "DOMBindings - setAttribute class syncs to element className",
  fn() {
    const context = new MockV8Context() as any;
    const bindings = new DOMBindings(context);

    const element = createMockElement("div");
    const jsValue = bindings.wrapNodeAsJSValue(element);
    const setAttrFn = getProperty(jsValue, "setAttribute");

    if (setAttrFn.type === "function" && setAttrFn.value.nativeImpl) {
      setAttrFn.value.nativeImpl(createString("class"), createString("foo bar"));
    }

    assertEquals(element.attributes.get("class"), "foo bar");
    assertEquals(element.className, "foo bar");
  },
});

// ============================================================================
// Document createDocumentFragment Integration Test
// ============================================================================

Deno.test({
  name: "DOMBindings - createDocumentFragment workflow: create, add children, append to DOM",
  fn() {
    const context = new MockV8Context() as any;
    const bindings = new DOMBindings(context);

    const doc = createMockDocument();
    const jsDoc = bindings.wrapNodeAsJSValue(doc);

    // Create fragment
    const fragFn = getProperty(jsDoc, "createDocumentFragment");
    assertExists(fragFn);
    assertEquals(fragFn.type, "function");

    if (fragFn.type === "function" && fragFn.value.nativeImpl) {
      const frag = fragFn.value.nativeImpl();
      assertEquals(frag.type, "object");
      if (frag.type === "object") {
        const nodeType = getProperty(frag, "nodeType");
        assertEquals(nodeType.type, "number");
        if (nodeType.type === "number") assertEquals(nodeType.value, DOMNodeType.DOCUMENT_FRAGMENT);
      }
    }
  },
});

// ============================================================================
// Multi-Step DOM Manipulation Integration Tests
// ============================================================================

Deno.test({
  name: "DOMBindings - multi-step: create -> setAttribute -> append -> query -> modify -> re-query",
  fn() {
    const context = new MockV8Context() as any;
    const bindings = new DOMBindings(context);

    // Step 1: Create elements
    const container = bindings.createElementNative("div");
    (container as any).attributes.set("id", "container");
    (container as any).id = "container";

    const item1 = bindings.createElementNative("p");
    (item1 as any).attributes.set("class", "item");
    (item1 as any).className = "item";

    const item2 = bindings.createElementNative("p");
    (item2 as any).attributes.set("class", "item");
    (item2 as any).className = "item";

    const item3 = bindings.createElementNative("span");
    (item3 as any).attributes.set("class", "other");
    (item3 as any).className = "other";

    // Step 2: Build tree
    bindings.appendChildNative(container, item1);
    bindings.appendChildNative(container, item2);
    bindings.appendChildNative(container, item3);

    // Step 3: Query
    const items = bindings.querySelectorAll(container, ".item");
    assertEquals(items.length, 2);

    const byTag = bindings.getElementsByTagName(container, "p");
    assertEquals(byTag.length, 2);

    // Step 4: Remove one
    bindings.removeChildNative(container, item1);
    const afterRemove = bindings.querySelectorAll(container, ".item");
    assertEquals(afterRemove.length, 1);

    // Step 5: Replace
    const replacement = bindings.createElementNative("article");
    (replacement as any).attributes.set("class", "item");
    (replacement as any).className = "item";
    bindings.insertBeforeNative(container, replacement, item2);
    bindings.removeChildNative(container, item2);

    const finalItems = bindings.querySelectorAll(container, ".item");
    assertEquals(finalItems.length, 1);
    assertEquals((finalItems[0] as any).tagName, "article");
  },
});

Deno.test({
  name: "DOMBindings - integration: deeply nested querySelector",
  fn() {
    const context = new MockV8Context() as any;
    const bindings = new DOMBindings(context);

    const root = createMockElement("div");
    const level1 = createMockElement("section");
    const level2 = createMockElement("article");
    const level3 = createMockElement("p");
    level3.attributes.set("id", "deep-target");

    bindings.appendChildNative(root, level1);
    bindings.appendChildNative(level1, level2);
    bindings.appendChildNative(level2, level3);

    const result = bindings.querySelector(root, "#deep-target");
    assertExists(result);
    assertEquals((result as any).tagName, "p");
  },
});

Deno.test({
  name: "DOMBindings - integration: empty tree textContent is empty string",
  fn() {
    const context = new MockV8Context() as any;
    const bindings = new DOMBindings(context);

    const element = createMockElement("div");
    const jsValue = bindings.wrapNodeAsJSValue(element);
    const textContent = getProperty(jsValue, "textContent");
    assertEquals(textContent.type, "string");
    if (textContent.type === "string") assertEquals(textContent.value, "");
  },
});

Deno.test({
  name: "DOMBindings - integration: text-only tree textContent",
  fn() {
    const context = new MockV8Context() as any;
    const bindings = new DOMBindings(context);

    const text = createMockTextNode("just text");
    const jsValue = bindings.wrapNodeAsJSValue(text);
    const textContent = getProperty(jsValue, "textContent");
    assertEquals(textContent.type, "string");
    if (textContent.type === "string") assertEquals(textContent.value, "just text");
  },
});

Deno.test({
  name: "DOMBindings - integration: comment serialization in innerHTML",
  fn() {
    const context = new MockV8Context() as any;
    const bindings = new DOMBindings(context);

    const parent = createMockElement("div");
    const comment = bindings.createCommentNative("a comment");
    const text = bindings.createTextNodeNative("text");
    bindings.appendChildNative(parent, comment);
    bindings.appendChildNative(parent, text);

    const parentJS = bindings.wrapNodeAsJSValue(parent);
    const innerHTML = getProperty(parentJS, "innerHTML");
    assertEquals(innerHTML.type, "string");
    if (innerHTML.type === "string") {
      assertEquals(innerHTML.value, "<!--a comment-->text");
    }
  },
});

Deno.test({
  name: "DOMBindings - integration: contains returns false for unrelated node",
  fn() {
    const context = new MockV8Context() as any;
    const bindings = new DOMBindings(context);

    const parent = createMockElement("div");
    const child = createMockElement("span");
    const unrelated = createMockElement("p");
    bindings.appendChildNative(parent, child);

    const parentJS = bindings.wrapNodeAsJSValue(parent);
    const unrelatedJS = bindings.wrapNodeAsJSValue(unrelated);

    const containsFn = getProperty(parentJS, "contains");
    if (containsFn.type === "function" && containsFn.value.nativeImpl) {
      const result = containsFn.value.nativeImpl(unrelatedJS);
      assertEquals(result.type, "boolean");
      if (result.type === "boolean") assertEquals(result.value, false);
    }
  },
});

Deno.test({
  name: "DOMBindings - integration: contains returns true for deep descendant",
  fn() {
    const context = new MockV8Context() as any;
    const bindings = new DOMBindings(context);

    const root = createMockElement("div");
    const child = createMockElement("section");
    const grandchild = createMockElement("p");
    bindings.appendChildNative(root, child);
    bindings.appendChildNative(child, grandchild);

    const rootJS = bindings.wrapNodeAsJSValue(root);
    const gcJS = bindings.wrapNodeAsJSValue(grandchild);

    const containsFn = getProperty(rootJS, "contains");
    if (containsFn.type === "function" && containsFn.value.nativeImpl) {
      const result = containsFn.value.nativeImpl(gcJS);
      assertEquals(result.type, "boolean");
      if (result.type === "boolean") assertEquals(result.value, true);
    }
  },
});

// ============================================================================
// element.style Tests
// ============================================================================

Deno.test({
  name: "DOMBindings - element has style property",
  fn() {
    const context = new MockV8Context() as any;
    const bindings = new DOMBindings(context);

    const element = createMockElement("div");
    const jsValue = bindings.wrapNodeAsJSValue(element);
    const style = getProperty(jsValue, "style");
    assertEquals(style.type, "object");
  },
});

Deno.test({
  name: "DOMBindings - style.color getter returns empty string when unset",
  fn() {
    const context = new MockV8Context() as any;
    const bindings = new DOMBindings(context);

    const element = createMockElement("div");
    const jsValue = bindings.wrapNodeAsJSValue(element);
    const style = getProperty(jsValue, "style");

    if (style.type === "object") {
      const colorGetter = getProperty(style, "color");
      assertEquals(colorGetter.type, "string");
      if (colorGetter.type === "string") assertEquals(colorGetter.value, "");
    }
  },
});

Deno.test({
  name: "DOMBindings - style.setProperty sets CSS property and syncs to attribute",
  fn() {
    const context = new MockV8Context() as any;
    const bindings = new DOMBindings(context);

    const element = createMockElement("div");
    const jsValue = bindings.wrapNodeAsJSValue(element);
    const style = getProperty(jsValue, "style");

    if (style.type === "object") {
      const setPropFn = getProperty(style, "setProperty");
      if (setPropFn.type === "function" && setPropFn.value.nativeImpl) {
        setPropFn.value.nativeImpl(createString("color"), createString("red"));
      }
      assertEquals(element.attributes.get("style"), "color: red");
    }
  },
});

Deno.test({
  name: "DOMBindings - style.getPropertyValue reads CSS property",
  fn() {
    const context = new MockV8Context() as any;
    const bindings = new DOMBindings(context);

    const element = createMockElement("div");
    element.attributes.set("style", "font-size: 14px; color: blue");
    const jsValue = bindings.wrapNodeAsJSValue(element);
    const style = getProperty(jsValue, "style");

    if (style.type === "object") {
      const getPropFn = getProperty(style, "getPropertyValue");
      if (getPropFn.type === "function" && getPropFn.value.nativeImpl) {
        const result = getPropFn.value.nativeImpl(createString("color"));
        assertEquals(result.type, "string");
        if (result.type === "string") assertEquals(result.value, "blue");

        const result2 = getPropFn.value.nativeImpl(createString("font-size"));
        assertEquals(result2.type, "string");
        if (result2.type === "string") assertEquals(result2.value, "14px");
      }
    }
  },
});

Deno.test({
  name: "DOMBindings - style.removeProperty removes property and returns old value",
  fn() {
    const context = new MockV8Context() as any;
    const bindings = new DOMBindings(context);

    const element = createMockElement("div");
    element.attributes.set("style", "color: red; display: none");
    const jsValue = bindings.wrapNodeAsJSValue(element);
    const style = getProperty(jsValue, "style");

    if (style.type === "object") {
      const removePropFn = getProperty(style, "removeProperty");
      if (removePropFn.type === "function" && removePropFn.value.nativeImpl) {
        const old = removePropFn.value.nativeImpl(createString("color"));
        assertEquals(old.type, "string");
        if (old.type === "string") assertEquals(old.value, "red");
        assertEquals(element.attributes.get("style"), "display: none");
      }
    }
  },
});

Deno.test({
  name: "DOMBindings - style.cssText returns full style string",
  fn() {
    const context = new MockV8Context() as any;
    const bindings = new DOMBindings(context);

    const element = createMockElement("div");
    element.attributes.set("style", "color: red; font-size: 16px");
    const jsValue = bindings.wrapNodeAsJSValue(element);
    const style = getProperty(jsValue, "style");

    if (style.type === "object") {
      const cssText = getProperty(style, "cssText");
      assertEquals(cssText.type, "string");
      if (cssText.type === "string") {
        assertEquals(cssText.value.includes("color: red"), true);
        assertEquals(cssText.value.includes("font-size: 16px"), true);
      }
    }
  },
});

Deno.test({
  name: "DOMBindings - style.length reflects number of properties",
  fn() {
    const context = new MockV8Context() as any;
    const bindings = new DOMBindings(context);

    const element = createMockElement("div");
    element.attributes.set("style", "color: red; display: none; opacity: 0.5");
    const jsValue = bindings.wrapNodeAsJSValue(element);
    const style = getProperty(jsValue, "style");

    if (style.type === "object") {
      const length = getProperty(style, "length");
      assertEquals(length.type, "number");
      if (length.type === "number") assertEquals(length.value, 3);
    }
  },
});

Deno.test({
  name: "DOMBindings - style camelCase getter reads kebab-case property",
  fn() {
    const context = new MockV8Context() as any;
    const bindings = new DOMBindings(context);

    const element = createMockElement("div");
    element.attributes.set("style", "background-color: green; font-size: 12px");
    const jsValue = bindings.wrapNodeAsJSValue(element);
    const style = getProperty(jsValue, "style");

    if (style.type === "object") {
      const bgColor = getProperty(style, "backgroundColor");
      assertEquals(bgColor.type, "string");
      if (bgColor.type === "string") assertEquals(bgColor.value, "green");

      const fontSize = getProperty(style, "fontSize");
      assertEquals(fontSize.type, "string");
      if (fontSize.type === "string") assertEquals(fontSize.value, "12px");
    }
  },
});

Deno.test({
  name: "DOMBindings - style.item returns property name by index",
  fn() {
    const context = new MockV8Context() as any;
    const bindings = new DOMBindings(context);

    const element = createMockElement("div");
    element.attributes.set("style", "color: red; display: block");
    const jsValue = bindings.wrapNodeAsJSValue(element);
    const style = getProperty(jsValue, "style");

    if (style.type === "object") {
      const itemFn = getProperty(style, "item");
      if (itemFn.type === "function" && itemFn.value.nativeImpl) {
        const result = itemFn.value.nativeImpl(createNumber(0));
        assertEquals(result.type, "string");
        if (result.type === "string") assertEquals(result.value, "color");
      }
    }
  },
});

Deno.test({
  name: "DOMBindings - style on element with no style attribute starts empty",
  fn() {
    const context = new MockV8Context() as any;
    const bindings = new DOMBindings(context);

    const element = createMockElement("div");
    const jsValue = bindings.wrapNodeAsJSValue(element);
    const style = getProperty(jsValue, "style");

    if (style.type === "object") {
      const cssText = getProperty(style, "cssText");
      assertEquals(cssText.type, "string");
      if (cssText.type === "string") assertEquals(cssText.value, "");

      const length = getProperty(style, "length");
      assertEquals(length.type, "number");
      if (length.type === "number") assertEquals(length.value, 0);
    }
  },
});

Deno.test({
  name: "DOMBindings - style serializes into outerHTML",
  fn() {
    const context = new MockV8Context() as any;
    const bindings = new DOMBindings(context);

    const element = bindings.createElementNative("div");
    const jsValue = bindings.wrapNodeAsJSValue(element);
    const style = getProperty(jsValue, "style");

    if (style.type === "object") {
      const setPropFn = getProperty(style, "setProperty");
      if (setPropFn.type === "function" && setPropFn.value.nativeImpl) {
        setPropFn.value.nativeImpl(createString("color"), createString("red"));
        setPropFn.value.nativeImpl(createString("display"), createString("none"));
      }
    }

    const outerHTML = getProperty(jsValue, "outerHTML");
    assertEquals(outerHTML.type, "string");
    if (outerHTML.type === "string") {
      assertEquals(outerHTML.value.includes('style="color: red; display: none"'), true);
    }
  },
});

// ============================================================================
// Geometry Properties Tests
// ============================================================================

/** Create a mock RenderTree that maps an element to a LayoutBox */
function createMockRenderTree(element: DOMElement, layoutBox: LayoutBoxImpl): RenderTree {
  return {
    findByElement(el: DOMElement) {
      if (el === element) return { element, layout: layoutBox, children: [] };
      return null;
    },
    build() {},
    getRoot() { throw new Error("not built"); },
    isBuilt() { return true; },
    clear() {},
    getStats() { return { nodeCount: 0, depth: 0 }; },
  } as unknown as RenderTree;
}

function makeLayoutBox(overrides: Partial<LayoutBoxImpl> = {}): LayoutBoxImpl {
  const box = new LayoutBoxImpl();
  Object.assign(box, overrides);
  return box;
}

Deno.test({
  name: "DOMBindings - getBoundingClientRect returns zeros without render tree",
  fn() {
    const context = new MockV8Context() as any;
    const bindings = new DOMBindings(context);
    const element = createMockElement("div");
    const jsValue = bindings.wrapNodeAsJSValue(element);

    const fn = getProperty(jsValue, "getBoundingClientRect");
    assertEquals(fn.type, "function");
    const rect = fn.value.nativeImpl!();
    assertEquals(getProperty(rect, "x").value, 0);
    assertEquals(getProperty(rect, "y").value, 0);
    assertEquals(getProperty(rect, "width").value, 0);
    assertEquals(getProperty(rect, "height").value, 0);
  },
});

Deno.test({
  name: "DOMBindings - getBoundingClientRect returns border-box from layout",
  fn() {
    const context = new MockV8Context() as any;
    const bindings = new DOMBindings(context);
    const element = createMockElement("div");

    const box = makeLayoutBox({
      x: 10 as Pixels, y: 20 as Pixels,
      width: 200 as Pixels, height: 100 as Pixels,
      marginLeft: 5 as Pixels, marginTop: 5 as Pixels,
      paddingLeft: 8 as Pixels, paddingRight: 8 as Pixels,
      paddingTop: 4 as Pixels, paddingBottom: 4 as Pixels,
      borderLeftWidth: 2 as Pixels, borderRightWidth: 2 as Pixels,
      borderTopWidth: 1 as Pixels, borderBottomWidth: 1 as Pixels,
    });

    bindings.setRenderTree(createMockRenderTree(element, box));
    const jsValue = bindings.wrapNodeAsJSValue(element);

    const fn = getProperty(jsValue, "getBoundingClientRect");
    const rect = fn.value.nativeImpl!();
    const borderBox = box.getBorderBox();
    assertEquals(getProperty(rect, "x").value, borderBox.x);
    assertEquals(getProperty(rect, "y").value, borderBox.y);
    assertEquals(getProperty(rect, "width").value, borderBox.width);
    assertEquals(getProperty(rect, "height").value, borderBox.height);
    assertEquals(getProperty(rect, "top").value, borderBox.y);
    assertEquals(getProperty(rect, "left").value, borderBox.x);
    assertEquals(getProperty(rect, "right").value, borderBox.x + borderBox.width);
    assertEquals(getProperty(rect, "bottom").value, borderBox.y + borderBox.height);
  },
});

Deno.test({
  name: "DOMBindings - offsetWidth/offsetHeight return border-box dimensions",
  fn() {
    const context = new MockV8Context() as any;
    const bindings = new DOMBindings(context);
    const element = createMockElement("div");

    const box = makeLayoutBox({
      width: 100 as Pixels, height: 50 as Pixels,
      paddingLeft: 10 as Pixels, paddingRight: 10 as Pixels,
      paddingTop: 5 as Pixels, paddingBottom: 5 as Pixels,
      borderLeftWidth: 1 as Pixels, borderRightWidth: 1 as Pixels,
      borderTopWidth: 1 as Pixels, borderBottomWidth: 1 as Pixels,
    });

    bindings.setRenderTree(createMockRenderTree(element, box));
    const jsValue = bindings.wrapNodeAsJSValue(element);

    const ow = getProperty(jsValue, "offsetWidth");
    const oh = getProperty(jsValue, "offsetHeight");
    // border-box = content + padding + border
    assertEquals(ow.value, 100 + 10 + 10 + 1 + 1); // 122
    assertEquals(oh.value, 50 + 5 + 5 + 1 + 1);     // 62
  },
});

Deno.test({
  name: "DOMBindings - clientWidth/clientHeight return padding-box dimensions",
  fn() {
    const context = new MockV8Context() as any;
    const bindings = new DOMBindings(context);
    const element = createMockElement("div");

    const box = makeLayoutBox({
      width: 100 as Pixels, height: 50 as Pixels,
      paddingLeft: 10 as Pixels, paddingRight: 10 as Pixels,
      paddingTop: 5 as Pixels, paddingBottom: 5 as Pixels,
      borderLeftWidth: 2 as Pixels, borderRightWidth: 2 as Pixels,
      borderTopWidth: 3 as Pixels, borderBottomWidth: 3 as Pixels,
    });

    bindings.setRenderTree(createMockRenderTree(element, box));
    const jsValue = bindings.wrapNodeAsJSValue(element);

    // padding-box = content + padding (no border)
    assertEquals(getProperty(jsValue, "clientWidth").value, 100 + 10 + 10); // 120
    assertEquals(getProperty(jsValue, "clientHeight").value, 50 + 5 + 5);   // 60
  },
});

Deno.test({
  name: "DOMBindings - clientTop/clientLeft return border widths",
  fn() {
    const context = new MockV8Context() as any;
    const bindings = new DOMBindings(context);
    const element = createMockElement("div");

    const box = makeLayoutBox({
      borderTopWidth: 3 as Pixels,
      borderLeftWidth: 5 as Pixels,
    });

    bindings.setRenderTree(createMockRenderTree(element, box));
    const jsValue = bindings.wrapNodeAsJSValue(element);

    assertEquals(getProperty(jsValue, "clientTop").value, 3);
    assertEquals(getProperty(jsValue, "clientLeft").value, 5);
  },
});

Deno.test({
  name: "DOMBindings - offsetTop/offsetLeft return border-box position",
  fn() {
    const context = new MockV8Context() as any;
    const bindings = new DOMBindings(context);
    const element = createMockElement("div");

    const box = makeLayoutBox({
      x: 15 as Pixels, y: 25 as Pixels,
      marginLeft: 5 as Pixels, marginTop: 10 as Pixels,
    });

    bindings.setRenderTree(createMockRenderTree(element, box));
    const jsValue = bindings.wrapNodeAsJSValue(element);

    const bb = box.getBorderBox();
    assertEquals(getProperty(jsValue, "offsetTop").value, bb.y);
    assertEquals(getProperty(jsValue, "offsetLeft").value, bb.x);
  },
});

Deno.test({
  name: "DOMBindings - scrollTop/scrollLeft are read-write",
  fn() {
    const context = new MockV8Context() as any;
    const bindings = new DOMBindings(context);
    const element = createMockElement("div");
    const jsValue = bindings.wrapNodeAsJSValue(element);

    // Initially zero
    assertEquals(getProperty(jsValue, "scrollTop").value, 0);
    assertEquals(getProperty(jsValue, "scrollLeft").value, 0);

    // Set and read back (use defineGetter mock — but since these are live getters,
    // we need to set via the setter mechanism)
    // The setters are installed via defineSetter, which stores on __setters__
    const setters = getProperty(jsValue, "__setters__");
    if (setters.type === "object") {
      const scrollTopSetter = getProperty(setters, "scrollTop");
      if (scrollTopSetter.type === "function" && scrollTopSetter.value.nativeImpl) {
        scrollTopSetter.value.nativeImpl(createNumber(42));
      }
      const scrollLeftSetter = getProperty(setters, "scrollLeft");
      if (scrollLeftSetter.type === "function" && scrollLeftSetter.value.nativeImpl) {
        scrollLeftSetter.value.nativeImpl(createNumber(17));
      }
    }

    // Read via getters
    const getters = getProperty(jsValue, "__getters__");
    if (getters.type === "object") {
      const scrollTopGetter = getProperty(getters, "scrollTop");
      if (scrollTopGetter.type === "function" && scrollTopGetter.value.nativeImpl) {
        assertEquals(scrollTopGetter.value.nativeImpl().value, 42);
      }
      const scrollLeftGetter = getProperty(getters, "scrollLeft");
      if (scrollLeftGetter.type === "function" && scrollLeftGetter.value.nativeImpl) {
        assertEquals(scrollLeftGetter.value.nativeImpl().value, 17);
      }
    }
  },
});

Deno.test({
  name: "DOMBindings - getClientRects returns single rect with layout",
  fn() {
    const context = new MockV8Context() as any;
    const bindings = new DOMBindings(context);
    const element = createMockElement("div");

    const box = makeLayoutBox({
      x: 5 as Pixels, y: 10 as Pixels,
      width: 200 as Pixels, height: 100 as Pixels,
    });

    bindings.setRenderTree(createMockRenderTree(element, box));
    const jsValue = bindings.wrapNodeAsJSValue(element);

    const fn = getProperty(jsValue, "getClientRects");
    const rects = fn.value.nativeImpl!();
    assertEquals(getProperty(rects, "length").value, 1);
    const rect0 = getProperty(rects, "0");
    assertEquals(getProperty(rect0, "width").value, box.getBorderBox().width);
  },
});

Deno.test({
  name: "DOMBindings - getClientRects returns empty array without render tree",
  fn() {
    const context = new MockV8Context() as any;
    const bindings = new DOMBindings(context);
    const element = createMockElement("div");
    const jsValue = bindings.wrapNodeAsJSValue(element);

    const fn = getProperty(jsValue, "getClientRects");
    const rects = fn.value.nativeImpl!();
    assertEquals(getProperty(rects, "length").value, 0);
  },
});

Deno.test({
  name: "DOMBindings - offsetParent returns null when no parent",
  fn() {
    const context = new MockV8Context() as any;
    const bindings = new DOMBindings(context);
    const element = createMockElement("div");
    const jsValue = bindings.wrapNodeAsJSValue(element);

    const getters = getProperty(jsValue, "__getters__");
    if (getters.type === "object") {
      const offsetParentGetter = getProperty(getters, "offsetParent");
      if (offsetParentGetter.type === "function" && offsetParentGetter.value.nativeImpl) {
        const result = offsetParentGetter.value.nativeImpl();
        assertEquals(result.type, "null");
      }
    }
  },
});

Deno.test({
  name: "DOMBindings - scrollWidth/scrollHeight equal padding-box without overflow",
  fn() {
    const context = new MockV8Context() as any;
    const bindings = new DOMBindings(context);
    const element = createMockElement("div");

    const box = makeLayoutBox({
      width: 100 as Pixels, height: 80 as Pixels,
      paddingLeft: 5 as Pixels, paddingRight: 5 as Pixels,
      paddingTop: 3 as Pixels, paddingBottom: 3 as Pixels,
    });

    bindings.setRenderTree(createMockRenderTree(element, box));
    const jsValue = bindings.wrapNodeAsJSValue(element);

    const getters = getProperty(jsValue, "__getters__");
    if (getters.type === "object") {
      const swGetter = getProperty(getters, "scrollWidth");
      if (swGetter.type === "function" && swGetter.value.nativeImpl) {
        assertEquals(swGetter.value.nativeImpl().value, 110); // 100 + 5 + 5
      }
      const shGetter = getProperty(getters, "scrollHeight");
      if (shGetter.type === "function" && shGetter.value.nativeImpl) {
        assertEquals(shGetter.value.nativeImpl().value, 86);  // 80 + 3 + 3
      }
    }
  },
});

Deno.test({
  name: "DOMBindings - geometry returns 0 for element not in render tree",
  fn() {
    const context = new MockV8Context() as any;
    const bindings = new DOMBindings(context);
    const element = createMockElement("div");
    const other = createMockElement("span");

    const box = makeLayoutBox({ width: 100 as Pixels, height: 50 as Pixels });
    // renderTree only maps 'other', not 'element'
    bindings.setRenderTree(createMockRenderTree(other, box));
    const jsValue = bindings.wrapNodeAsJSValue(element);

    const getters = getProperty(jsValue, "__getters__");
    if (getters.type === "object") {
      const owGetter = getProperty(getters, "offsetWidth");
      if (owGetter.type === "function" && owGetter.value.nativeImpl) {
        assertEquals(owGetter.value.nativeImpl().value, 0);
      }
    }
  },
});
