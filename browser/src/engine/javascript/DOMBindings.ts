/**
 * DOM Bindings
 *
 * Provides JavaScript bindings for DOM objects, exposing DOM APIs to JavaScript code.
 * Implements the Web IDL interfaces for Document, Element, Node, etc.
 * All methods perform real DOM mutations on the native DOM tree.
 */

import type { DOMDocument, DOMElement, DOMNode } from "../../types/dom.ts";
import { DOMNodeType } from "../../types/dom.ts";
import type { NodeID } from "../../types/identifiers.ts";
import type { LayoutBox } from "../../types/rendering.ts";
import type { RenderTree } from "../rendering/rendering/RenderTree.ts";
import { V8Context } from "./V8Context.ts";
import { BytecodeGenerator, type ProgramNode } from "./V8Compiler.ts";
import {
  createBoolean,
  createNativeFunction,
  createNull,
  createNumber,
  createObject,
  createString,
  createUndefined,
  defineGetter,
  defineSetter,
  getProperty,
  isBoolean,
  isFunction,
  isObject,
  isString,
  type JSValue,
  setProperty,
  toString,
} from "./JSValue.ts";

/** Escape HTML attribute values to prevent XSS in serialized HTML */
function escapeHtmlAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Void HTML elements that have no closing tag */
const VOID_ELEMENTS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

/**
 * JavaScript-exposed DOM Node
 */
export interface JSNode {
  nodeType: number;
  nodeName: string;
  nodeValue: string | null;
  textContent: string | null;
  parentNode: JSNode | null;
  childNodes: JSNode[];
  firstChild: JSNode | null;
  lastChild: JSNode | null;
  previousSibling: JSNode | null;
  nextSibling: JSNode | null;

  // Methods
  appendChild(child: JSNode): JSNode;
  removeChild(child: JSNode): JSNode;
  insertBefore(newNode: JSNode, referenceNode: JSNode | null): JSNode;
  cloneNode(deep?: boolean): JSNode;
  contains(other: JSNode): boolean;
}

/**
 * JavaScript-exposed Element
 */
export interface JSElement extends JSNode {
  tagName: string;
  id: string;
  className: string;
  classList: DOMTokenList;
  attributes: NamedNodeMap;
  innerHTML: string;
  outerHTML: string;
  style: CSSStyleDeclarationLike;

  // Methods
  getAttribute(name: string): string | null;
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
  hasAttribute(name: string): boolean;
  getElementsByTagName(tagName: string): JSElement[];
  getElementsByClassName(className: string): JSElement[];
  querySelector(selector: string): JSElement | null;
  querySelectorAll(selector: string): JSElement[];

  // Event handling
  addEventListener(
    type: string,
    listener: EventListener,
    options?: AddEventListenerOptions,
  ): void;
  removeEventListener(
    type: string,
    listener: EventListener,
    options?: EventListenerOptions,
  ): void;
  dispatchEvent(event: Event): boolean;
}

/**
 * CSS Style Declaration (subset of CSSStyleDeclaration)
 * Supports reading/writing inline styles via element.style.propertyName
 */
export interface CSSStyleDeclarationLike {
  cssText: string;
  length: number;
  getPropertyValue(property: string): string;
  setProperty(property: string, value: string, priority?: string): void;
  removeProperty(property: string): string;
  item(index: number): string;
}

/**
 * JavaScript-exposed Document
 */
export interface JSDocument extends JSNode {
  documentElement: JSElement | null;
  head: JSElement | null;
  body: JSElement | null;
  title: string;
  URL: string;
  domain: string;
  readyState: "loading" | "interactive" | "complete";

  // Methods
  getElementById(id: string): JSElement | null;
  getElementsByTagName(tagName: string): JSElement[];
  getElementsByClassName(className: string): JSElement[];
  querySelector(selector: string): JSElement | null;
  querySelectorAll(selector: string): JSElement[];
  createElement(tagName: string): JSElement;
  createTextNode(data: string): JSNode;
  createDocumentFragment(): DocumentFragment;

  // Event handling
  addEventListener(
    type: string,
    listener: EventListener,
    options?: AddEventListenerOptions,
  ): void;
  removeEventListener(
    type: string,
    listener: EventListener,
    options?: EventListenerOptions,
  ): void;
}

/**
 * Event listener function
 */
export type EventListener = (event: Event) => void;

/**
 * Add event listener options
 */
export interface AddEventListenerOptions {
  capture?: boolean;
  once?: boolean;
  passive?: boolean;
}

/**
 * Event listener options
 */
export interface EventListenerOptions {
  capture?: boolean;
}

/**
 * DOM Token List (classList)
 */
export interface DOMTokenList {
  length: number;
  value: string;
  add(...tokens: string[]): void;
  remove(...tokens: string[]): void;
  toggle(token: string, force?: boolean): boolean;
  contains(token: string): boolean;
  replace(oldToken: string, newToken: string): boolean;
}

/**
 * Named Node Map (attributes)
 */
export interface NamedNodeMap {
  length: number;
  getNamedItem(name: string): Attr | null;
  setNamedItem(attr: Attr): Attr | null;
  removeNamedItem(name: string): Attr;
  item(index: number): Attr | null;
}

/**
 * Attribute
 */
export interface Attr {
  name: string;
  value: string;
  ownerElement: JSElement | null;
}

/**
 * Document Fragment
 */
export interface DocumentFragment extends JSNode {
  querySelector(selector: string): JSElement | null;
  querySelectorAll(selector: string): JSElement[];
}

/**
 * Hidden property key for storing native DOMNode reference on JSValue objects
 */
const NATIVE_NODE_KEY = "__nativeNode__";

/**
 * Mutable synthetic DOM node - used when creating nodes programmatically.
 * Allows setting readonly properties (nodeId, nodeType) during construction.
 */
interface SyntheticDOMNode {
  nodeId: NodeID;
  nodeType: DOMNodeType;
  nodeName: string;
  nodeValue: string | null;
  parentNode: DOMNode | null;
  childNodes: DOMNode[];
  firstChild: DOMNode | null;
  lastChild: DOMNode | null;
  previousSibling: DOMNode | null;
  nextSibling: DOMNode | null;
  ownerDocument: DOMDocument | null;
  cloneNode(deep: boolean): DOMNode;
  appendChild(child: DOMNode): DOMNode;
  removeChild(child: DOMNode): DOMNode;
  insertBefore(newNode: DOMNode, referenceNode: DOMNode | null): DOMNode;
  replaceChild(newNode: DOMNode, oldNode: DOMNode): DOMNode;
  contains(node: DOMNode): boolean;
  compareDocumentPosition(node: DOMNode): number;
  // Element-specific (optional)
  tagName?: string;
  attributes?: Map<string, string>;
  id?: string;
  className?: string;
  classList?: DOMElement["classList"];
  parentElement?: DOMElement | null;
  previousElementSibling?: DOMElement | null;
  nextElementSibling?: DOMElement | null;
  getAttribute?(name: string): string | null;
  setAttribute?(name: string, value: string): void;
  removeAttribute?(name: string): void;
  hasAttribute?(name: string): boolean;
  querySelector?(selector: string): DOMNode | null;
  querySelectorAll?(selector: string): DOMNode[];
  getElementsByTagName?(tagName: string): DOMNode[];
  getElementsByClassName?(className: string): DOMNode[];
  matches?(selector: string): boolean;
  closest?(selector: string): DOMNode | null;
  // Document readyState
  readyState?: string;
  // Event listeners registry (used by ScriptExecutor)
  __eventListeners?: Map<string, Array<JSValue>>;
}

/**
 * DOM Bindings Manager
 * Bridges between native DOM and JavaScript objects
 */
export class DOMBindings {
  private context: V8Context;
  private nodeMap: WeakMap<DOMNode, JSNode> = new WeakMap();
  private reverseMap: WeakMap<JSNode, DOMNode> = new WeakMap();
  private jsValueNodeMap: Map<number, DOMNode> = new Map();
  private jsValueCacheByNode: WeakMap<DOMNode, JSValue> = new WeakMap();
  private nextSyntheticNodeId: number = 100000;
  private renderTree: RenderTree | null = null;

  constructor(context: V8Context) {
    this.context = context;
  }

  /**
   * Set render tree for geometry property resolution.
   * Must be called after layout is computed so geometry APIs return real values.
   */
  setRenderTree(renderTree: RenderTree): void {
    this.renderTree = renderTree;
  }

  /**
   * Look up computed LayoutBox for an element via the render tree.
   * Returns null if no render tree or element has no render object.
   */
  private getLayoutForElement(element: DOMElement): LayoutBox | null {
    if (!this.renderTree) return null;
    const renderObj = this.renderTree.findByElement(element);
    return renderObj?.layout ?? null;
  }

  /**
   * Install DOM bindings in V8 context
   */
  install(): void {
    // Install Node interface
    setProperty(this.context.global, "Node", this.createNodeConstructor());

    // Install Element interface
    setProperty(this.context.global, "Element", this.createElementConstructor());

    // Install Document interface
    setProperty(this.context.global, "Document", this.createDocumentConstructor());

    // Install constants
    this.installNodeTypeConstants();
  }

  /**
   * Wrap native DOM node for JavaScript
   */
  wrapNode(nativeNode: DOMNode): JSNode {
    // Check if already wrapped
    const existing = this.nodeMap.get(nativeNode);
    if (existing) {
      return existing;
    }

    // Create wrapper based on node type
    const wrapper = this.createNodeWrapper(nativeNode);

    // Store bidirectional mapping
    this.nodeMap.set(nativeNode, wrapper);
    this.reverseMap.set(wrapper, nativeNode);

    return wrapper;
  }

  /**
   * Unwrap JavaScript node to native DOM
   */
  unwrapNode(jsNode: JSNode): DOMNode | null {
    return this.reverseMap.get(jsNode) ?? null;
  }

  /**
   * Look up native DOMNode from a JSValue object via the hidden __nativeNode__ property
   */
  unwrapJSValue(jsValue: JSValue): DOMNode | null {
    if (!isObject(jsValue)) return null;
    const nodeIdValue = getProperty(jsValue, NATIVE_NODE_KEY);
    if (nodeIdValue.type === "number") {
      return this.jsValueNodeMap.get(nodeIdValue.value) ?? null;
    }
    return null;
  }

  /**
   * Wrap a native DOMNode into a full JSValue object with all DOM methods
   * This is the main entry point for creating JS-accessible DOM objects
   */
  wrapNodeAsJSValue(nativeNode: DOMNode): JSValue {
    const nodeId = nativeNode.nodeId ?? this.nextSyntheticNodeId++;

    // Check cache to prevent infinite recursion (parent↔child cycles)
    const cached = this.jsValueCacheByNode.get(nativeNode);
    if (cached) return cached;

    const obj = createObject();

    // Store in cache BEFORE tree navigation to break cycles
    this.jsValueCacheByNode.set(nativeNode, obj);

    // Store mapping from nodeId to native node
    this.jsValueNodeMap.set(nodeId, nativeNode);

    // Hidden reference to native node
    setProperty(obj, NATIVE_NODE_KEY, createNumber(nodeId));

    // Scalar properties
    setProperty(obj, "nodeType", createNumber(nativeNode.nodeType));
    setProperty(obj, "nodeName", createString(this.getNodeName(nativeNode)));
    setProperty(
      obj,
      "nodeValue",
      nativeNode.nodeValue !== null ? createString(nativeNode.nodeValue) : createNull(),
    );
    setProperty(
      obj,
      "textContent",
      (() => {
        const tc = this.computeTextContent(nativeNode);
        return tc !== null ? createString(tc) : createNull();
      })(),
    );

    // Tree navigation (as getters would require Proxy, install current values)
    this.installTreeNavigation(obj, nativeNode);

    // Install Node methods
    this.installNodeMethods(obj, nativeNode);

    // Install Element methods if applicable
    if (nativeNode.nodeType === DOMNodeType.ELEMENT) {
      this.installElementMethods(obj, nativeNode as DOMElement);
    }

    // Install Document methods if applicable
    if (nativeNode.nodeType === DOMNodeType.DOCUMENT) {
      this.installDocumentMethods(obj, nativeNode);
    }

    return obj;
  }

  // =========================================================================
  // Native DOM Tree Mutation Operations
  // =========================================================================

  /**
   * Append a child node to a parent, performing real tree mutations
   */
  appendChildNative(parent: DOMNode, child: DOMNode): DOMNode {
    // Remove from old parent if already in tree
    if (child.parentNode) {
      this.removeChildNative(child.parentNode, child);
    }

    // Add to new parent
    if (!parent.childNodes) {
      parent.childNodes = [];
    }
    parent.childNodes.push(child);

    // Update parent reference
    child.parentNode = parent;

    // Update sibling pointers
    const prevSibling = parent.childNodes.length > 1
      ? parent.childNodes[parent.childNodes.length - 2]
      : null;
    if (prevSibling) {
      prevSibling.nextSibling = child;
      child.previousSibling = prevSibling;
    } else {
      child.previousSibling = null;
    }
    child.nextSibling = null;

    // Update first/last child
    if (parent.childNodes.length === 1) {
      parent.firstChild = child;
    }
    parent.lastChild = child;

    return child;
  }

  /**
   * Remove a child node from its parent
   */
  removeChildNative(parent: DOMNode, child: DOMNode): DOMNode {
    if (!parent.childNodes) return child;

    const index = parent.childNodes.indexOf(child);
    if (index === -1) return child;

    // Update sibling pointers
    const prev = child.previousSibling;
    const next = child.nextSibling;
    if (prev) prev.nextSibling = next;
    if (next) next.previousSibling = prev;

    // Remove from array
    parent.childNodes.splice(index, 1);

    // Update first/last child
    parent.firstChild = parent.childNodes[0] ?? null;
    parent.lastChild = parent.childNodes[parent.childNodes.length - 1] ?? null;

    // Clear parent/sibling on removed node
    child.parentNode = null;
    child.previousSibling = null;
    child.nextSibling = null;

    return child;
  }

  /**
   * Insert a node before a reference node
   */
  insertBeforeNative(parent: DOMNode, newNode: DOMNode, refNode: DOMNode | null): DOMNode {
    if (!refNode) {
      return this.appendChildNative(parent, newNode);
    }

    // Remove from old parent
    if (newNode.parentNode) {
      this.removeChildNative(newNode.parentNode, newNode);
    }

    if (!parent.childNodes) {
      parent.childNodes = [];
    }

    const refIndex = parent.childNodes.indexOf(refNode);
    if (refIndex === -1) {
      return this.appendChildNative(parent, newNode);
    }

    // Insert at position
    parent.childNodes.splice(refIndex, 0, newNode);
    newNode.parentNode = parent;

    // Update sibling pointers
    const prev = refIndex > 0 ? parent.childNodes[refIndex - 1] : null;
    if (prev) {
      prev.nextSibling = newNode;
    }
    newNode.previousSibling = prev;
    newNode.nextSibling = refNode;
    refNode.previousSibling = newNode;

    // Update firstChild
    if (refIndex === 0) {
      parent.firstChild = newNode;
    }

    return newNode;
  }

  /**
   * Create a new native DOMElement
   */
  createElementNative(tagName: string): DOMNode {
    const nodeId = this.nextSyntheticNodeId++ as NodeID;
    const element: SyntheticDOMNode = {
      nodeId,
      nodeType: DOMNodeType.ELEMENT,
      nodeName: tagName.toUpperCase(),
      tagName: tagName.toLowerCase(),
      nodeValue: null,
      parentNode: null,
      childNodes: [],
      firstChild: null,
      lastChild: null,
      previousSibling: null,
      nextSibling: null,
      ownerDocument: null,
      parentElement: null,
      previousElementSibling: null,
      nextElementSibling: null,
      attributes: new Map<string, string>(),
      id: "",
      className: "",
      classList: {
        get length() {
          const cn = element.className?.trim();
          return cn ? cn.split(/\s+/).length : 0;
        },
        get value() {
          return element.className ?? "";
        },
        item(index: number) {
          const classes = (element.className ?? "").trim().split(/\s+/).filter(Boolean);
          return classes[index] ?? null;
        },
        add(cls: string) {
          const classes = (element.className ?? "").trim().split(/\s+/).filter(Boolean);
          if (!classes.includes(cls)) {
            classes.push(cls);
            element.className = classes.join(" ");
            element.attributes!.set("class", element.className!);
          }
        },
        remove(cls: string) {
          const classes = (element.className ?? "").trim().split(/\s+/).filter(Boolean);
          const filtered = classes.filter((c: string) => c !== cls);
          element.className = filtered.join(" ");
          element.attributes!.set("class", element.className!);
        },
        contains(cls: string) {
          const classes = (element.className ?? "").trim().split(/\s+/).filter(Boolean);
          return classes.includes(cls);
        },
        toggle(cls: string) {
          if (this.contains(cls)) {
            this.remove(cls);
            return false;
          } else {
            this.add(cls);
            return true;
          }
        },
        replace(oldCls: string, newCls: string) {
          if (!this.contains(oldCls)) return false;
          this.remove(oldCls);
          this.add(newCls);
          return true;
        },
      },
      getAttribute(name: string) {
        return this.attributes!.get(name) ?? null;
      },
      setAttribute(name: string, value: string) {
        this.attributes!.set(name, value);
        if (name === "id") this.id = value;
        if (name === "class") this.className = value;
      },
      removeAttribute(name: string) {
        this.attributes!.delete(name);
      },
      hasAttribute(name: string) {
        return this.attributes!.has(name);
      },
      cloneNode: () => element as unknown as DOMNode,
      appendChild: (child: DOMNode) => this.appendChildNative(element as unknown as DOMNode, child),
      removeChild: (child: DOMNode) => this.removeChildNative(element as unknown as DOMNode, child),
      insertBefore: (newNode: DOMNode, ref: DOMNode | null) =>
        this.insertBeforeNative(element as unknown as DOMNode, newNode, ref),
      replaceChild: (newNode: DOMNode, oldNode: DOMNode) => {
        this.insertBeforeNative(element as unknown as DOMNode, newNode, oldNode);
        this.removeChildNative(element as unknown as DOMNode, oldNode);
        return oldNode;
      },
      contains: (node: DOMNode) => this.containsNative(element as unknown as DOMNode, node),
      compareDocumentPosition: () => 0,
      querySelector: (sel: string) => this.querySelector(element as unknown as DOMNode, sel),
      querySelectorAll: (sel: string) => this.querySelectorAll(element as unknown as DOMNode, sel),
      getElementsByTagName: (tag: string) =>
        this.getElementsByTagName(element as unknown as DOMNode, tag),
      getElementsByClassName: (cls: string) =>
        this.getElementsByClassName(element as unknown as DOMNode, cls),
      matches: () => false,
      closest: () => null,
    };
    return element as unknown as DOMNode;
  }

  /**
   * Create a new native text node
   */
  createTextNodeNative(data: string): DOMNode {
    const nodeId = this.nextSyntheticNodeId++ as NodeID;
    const textNode: SyntheticDOMNode = {
      nodeId,
      nodeType: DOMNodeType.TEXT,
      nodeName: "#text",
      nodeValue: data,
      parentNode: null,
      childNodes: [],
      firstChild: null,
      lastChild: null,
      previousSibling: null,
      nextSibling: null,
      ownerDocument: null,
      cloneNode: () => textNode as unknown as DOMNode,
      appendChild: () => textNode as unknown as DOMNode,
      removeChild: () => textNode as unknown as DOMNode,
      insertBefore: () => textNode as unknown as DOMNode,
      replaceChild: () => textNode as unknown as DOMNode,
      contains: () => false,
      compareDocumentPosition: () => 0,
    };
    return textNode as unknown as DOMNode;
  }

  // =========================================================================
  // JSValue Method Installation
  // =========================================================================

  /**
   * Install tree navigation properties on a JSValue
   */
  private installTreeNavigation(obj: JSValue, nativeNode: DOMNode): void {
    // Use defineGetter for dynamic/live tree navigation that reflects current DOM state

    // parentNode — live getter
    defineGetter(obj, "parentNode", () =>
      nativeNode.parentNode ? this.wrapNodeAsJSValue(nativeNode.parentNode) : createNull()
    );

    // childNodes — live getter returning array-like object
    defineGetter(obj, "childNodes", () => {
      const childNodesObj = createObject();
      const children = nativeNode.childNodes ?? [];
      for (let i = 0; i < children.length; i++) {
        setProperty(childNodesObj, String(i), this.wrapNodeAsJSValue(children[i]));
      }
      setProperty(childNodesObj, "length", createNumber(children.length));
      return childNodesObj;
    });

    // firstChild / lastChild — live getters
    defineGetter(obj, "firstChild", () =>
      nativeNode.firstChild ? this.wrapNodeAsJSValue(nativeNode.firstChild) : createNull()
    );
    defineGetter(obj, "lastChild", () =>
      nativeNode.lastChild ? this.wrapNodeAsJSValue(nativeNode.lastChild) : createNull()
    );

    // siblings — live getters
    defineGetter(obj, "previousSibling", () =>
      nativeNode.previousSibling
        ? this.wrapNodeAsJSValue(nativeNode.previousSibling)
        : createNull()
    );
    defineGetter(obj, "nextSibling", () =>
      nativeNode.nextSibling ? this.wrapNodeAsJSValue(nativeNode.nextSibling) : createNull()
    );
  }

  /**
   * Install Node-level methods on a JSValue
   */
  private installNodeMethods(obj: JSValue, nativeNode: DOMNode): void {
    // appendChild
    setProperty(
      obj,
      "appendChild",
      createNativeFunction("appendChild", (...args: JSValue[]) => {
        const childNode = this.unwrapJSValue(args[0]);
        if (childNode) {
          this.appendChildNative(nativeNode, childNode);
          return this.wrapNodeAsJSValue(childNode);
        }
        return args[0] ?? createNull();
      }, 1),
    );

    // removeChild
    setProperty(
      obj,
      "removeChild",
      createNativeFunction("removeChild", (...args: JSValue[]) => {
        const childNode = this.unwrapJSValue(args[0]);
        if (childNode) {
          this.removeChildNative(nativeNode, childNode);
          return this.wrapNodeAsJSValue(childNode);
        }
        return args[0] ?? createNull();
      }, 1),
    );

    // insertBefore
    setProperty(
      obj,
      "insertBefore",
      createNativeFunction("insertBefore", (...args: JSValue[]) => {
        const newNode = this.unwrapJSValue(args[0]);
        const refNode = args[1] ? this.unwrapJSValue(args[1]) : null;
        if (newNode) {
          this.insertBeforeNative(nativeNode, newNode, refNode);
          return this.wrapNodeAsJSValue(newNode);
        }
        return args[0] ?? createNull();
      }, 2),
    );

    // cloneNode
    setProperty(
      obj,
      "cloneNode",
      createNativeFunction("cloneNode", (...args: JSValue[]) => {
        const deep = args[0] && isBoolean(args[0]) ? args[0].value : false;
        const cloned = this.cloneNativeNode(nativeNode, deep);
        return this.wrapNodeAsJSValue(cloned);
      }, 1),
    );

    // contains
    setProperty(
      obj,
      "contains",
      createNativeFunction("contains", (...args: JSValue[]) => {
        const otherNode = this.unwrapJSValue(args[0]);
        if (otherNode) {
          return createBoolean(this.containsNative(nativeNode, otherNode));
        }
        return createBoolean(false);
      }, 1),
    );

    // hasChildNodes
    setProperty(
      obj,
      "hasChildNodes",
      createNativeFunction("hasChildNodes", () => {
        return createBoolean(
          nativeNode.childNodes != null && nativeNode.childNodes.length > 0,
        );
      }, 0),
    );

    // replaceChild
    setProperty(
      obj,
      "replaceChild",
      createNativeFunction("replaceChild", (...args: JSValue[]) => {
        const newNode = this.unwrapJSValue(args[0]);
        const oldNode = this.unwrapJSValue(args[1]);
        if (newNode && oldNode) {
          this.insertBeforeNative(nativeNode, newNode, oldNode);
          this.removeChildNative(nativeNode, oldNode);
          return this.wrapNodeAsJSValue(oldNode);
        }
        return args[1] ?? createNull();
      }, 2),
    );

    // textContent setter (install as setTextContent native function)
    setProperty(
      obj,
      "setTextContent",
      createNativeFunction("setTextContent", (...args: JSValue[]) => {
        const text = isString(args[0]) ? args[0].value : toString(args[0]);
        // Remove all existing children
        while (nativeNode.childNodes && nativeNode.childNodes.length > 0) {
          this.removeChildNative(nativeNode, nativeNode.childNodes[0]);
        }
        // Add a text node with the new content
        const textNode = this.createTextNodeNative(text);
        this.appendChildNative(nativeNode, textNode);
        // Update the textContent property on the JSValue
        setProperty(obj, "textContent", createString(text));
        return createUndefined();
      }, 1),
    );
  }

  /**
   * Install Element-level methods on a JSValue
   */
  private installElementMethods(obj: JSValue, element: DOMElement): void {
    // Element properties
    setProperty(obj, "tagName", createString(element.tagName?.toUpperCase() ?? ""));
    setProperty(obj, "id", createString(element.id ?? element.attributes?.get("id") ?? ""));
    setProperty(
      obj,
      "className",
      createString(element.className ?? element.attributes?.get("class") ?? ""),
    );

    // style — CSSStyleDeclaration-like object backed by the element's style attribute
    this.installStyleProperty(obj, element);

    // getAttribute
    setProperty(
      obj,
      "getAttribute",
      createNativeFunction("getAttribute", (...args: JSValue[]) => {
        const name = isString(args[0]) ? args[0].value : toString(args[0]);
        const value = element.attributes?.get(name) ?? null;
        return value !== null ? createString(value) : createNull();
      }, 1),
    );

    // setAttribute
    setProperty(
      obj,
      "setAttribute",
      createNativeFunction("setAttribute", (...args: JSValue[]) => {
        const name = isString(args[0]) ? args[0].value : toString(args[0]);
        const value = isString(args[1]) ? args[1].value : toString(args[1]);
        if (!element.attributes) {
          element.attributes = new Map<string, string>();
        }
        element.attributes.set(name, value);
        if (name === "id") element.id = value;
        if (name === "class") element.className = value;
        return createUndefined();
      }, 2),
    );

    // removeAttribute
    setProperty(
      obj,
      "removeAttribute",
      createNativeFunction("removeAttribute", (...args: JSValue[]) => {
        const name = isString(args[0]) ? args[0].value : toString(args[0]);
        element.attributes?.delete(name);
        return createUndefined();
      }, 1),
    );

    // hasAttribute
    setProperty(
      obj,
      "hasAttribute",
      createNativeFunction("hasAttribute", (...args: JSValue[]) => {
        const name = isString(args[0]) ? args[0].value : toString(args[0]);
        return createBoolean(element.attributes?.has(name) ?? false);
      }, 1),
    );

    // querySelector
    setProperty(
      obj,
      "querySelector",
      createNativeFunction("querySelector", (...args: JSValue[]) => {
        const selector = isString(args[0]) ? args[0].value : toString(args[0]);
        const result = this.querySelector(element, selector);
        return result ? this.wrapNodeAsJSValue(result) : createNull();
      }, 1),
    );

    // querySelectorAll
    setProperty(
      obj,
      "querySelectorAll",
      createNativeFunction("querySelectorAll", (...args: JSValue[]) => {
        const selector = isString(args[0]) ? args[0].value : toString(args[0]);
        const results = this.querySelectorAll(element, selector);
        const arr = createObject();
        for (let i = 0; i < results.length; i++) {
          setProperty(arr, String(i), this.wrapNodeAsJSValue(results[i]));
        }
        setProperty(arr, "length", createNumber(results.length));
        return arr;
      }, 1),
    );

    // getElementsByTagName
    setProperty(
      obj,
      "getElementsByTagName",
      createNativeFunction("getElementsByTagName", (...args: JSValue[]) => {
        const tagName = isString(args[0]) ? args[0].value : toString(args[0]);
        const results = this.getElementsByTagName(element, tagName.toLowerCase());
        const arr = createObject();
        for (let i = 0; i < results.length; i++) {
          setProperty(arr, String(i), this.wrapNodeAsJSValue(results[i]));
        }
        setProperty(arr, "length", createNumber(results.length));
        return arr;
      }, 1),
    );

    // getElementsByClassName
    setProperty(
      obj,
      "getElementsByClassName",
      createNativeFunction("getElementsByClassName", (...args: JSValue[]) => {
        const className = isString(args[0]) ? args[0].value : toString(args[0]);
        const results = this.getElementsByClassName(element, className);
        const arr = createObject();
        for (let i = 0; i < results.length; i++) {
          setProperty(arr, String(i), this.wrapNodeAsJSValue(results[i]));
        }
        setProperty(arr, "length", createNumber(results.length));
        return arr;
      }, 1),
    );

    // matches(selector) - tests if element matches a CSS selector
    setProperty(
      obj,
      "matches",
      createNativeFunction("matches", (...args: JSValue[]) => {
        const selector = isString(args[0]) ? args[0].value : toString(args[0]);
        return createBoolean(this.matchesSelector(element, selector));
      }, 1),
    );

    // closest(selector) - traverses up the tree to find first matching ancestor
    setProperty(
      obj,
      "closest",
      createNativeFunction("closest", (...args: JSValue[]) => {
        const selector = isString(args[0]) ? args[0].value : toString(args[0]);
        let current: DOMNode | null = element;
        while (current) {
          if (
            current.nodeType === DOMNodeType.ELEMENT &&
            this.matchesSelector(current as DOMElement, selector)
          ) {
            return this.wrapNodeAsJSValue(current);
          }
          current = current.parentNode;
        }
        return createNull();
      }, 1),
    );

    // children - element-only child collection
    const childElements = (element.childNodes ?? []).filter(
      (c: DOMNode) => c.nodeType === DOMNodeType.ELEMENT,
    );
    const childrenObj = createObject();
    for (let i = 0; i < childElements.length; i++) {
      setProperty(childrenObj, String(i), this.wrapNodeAsJSValue(childElements[i]));
    }
    setProperty(childrenObj, "length", createNumber(childElements.length));
    setProperty(obj, "children", childrenObj);

    // parentElement
    setProperty(
      obj,
      "parentElement",
      element.parentNode && element.parentNode.nodeType === DOMNodeType.ELEMENT
        ? this.wrapNodeAsJSValue(element.parentNode)
        : createNull(),
    );

    // previousElementSibling
    setProperty(
      obj,
      "previousElementSibling",
      this.findElementSibling(element, "previous")
        ? this.wrapNodeAsJSValue(this.findElementSibling(element, "previous")!)
        : createNull(),
    );

    // nextElementSibling
    setProperty(
      obj,
      "nextElementSibling",
      this.findElementSibling(element, "next")
        ? this.wrapNodeAsJSValue(this.findElementSibling(element, "next")!)
        : createNull(),
    );

    // innerHTML (getter/setter - serializes child nodes to HTML string, setter replaces children)
    defineGetter(obj, "innerHTML", () => createString(this.serializeChildren(element)));
    defineSetter(obj, "innerHTML", (v: JSValue) => {
      const html = isString(v) ? v.value : toString(v);
      // Remove all existing children
      while (element.childNodes && element.childNodes.length > 0) {
        this.removeChildNative(element, element.childNodes[0]);
      }
      // Parse HTML string into proper DOM nodes
      if (html.length > 0) {
        this.parseHTMLFragment(html, element);
      }
    });

    // outerHTML (getter - serializes element itself to HTML string)
    defineGetter(obj, "outerHTML", () => createString(this.serializeNode(element)));

    // Event handling (functional - store listeners on the element)
    const listeners: Map<string, Array<JSValue>> = new Map();
    setProperty(
      obj,
      "addEventListener",
      createNativeFunction("addEventListener", (...args: JSValue[]) => {
        const type = isString(args[0]) ? args[0].value : toString(args[0]);
        if (!listeners.has(type)) listeners.set(type, []);
        const callback = args[1];
        if (callback) {
          listeners.get(type)!.push(callback);
        }
        return createUndefined();
      }, 2),
    );

    setProperty(
      obj,
      "removeEventListener",
      createNativeFunction("removeEventListener", (...args: JSValue[]) => {
        const type = isString(args[0]) ? args[0].value : toString(args[0]);
        const callback = args[1];
        const typeListeners = listeners.get(type);
        if (typeListeners && callback) {
          const idx = typeListeners.indexOf(callback);
          if (idx !== -1) typeListeners.splice(idx, 1);
        }
        return createUndefined();
      }, 2),
    );

    setProperty(
      obj,
      "dispatchEvent",
      createNativeFunction("dispatchEvent", (...args: JSValue[]) => {
        const event = args[0];
        const type = event && isObject(event) ? toString(getProperty(event, "type")) : "";
        const typeListeners = listeners.get(type);
        if (typeListeners) {
          for (const listener of typeListeners) {
            if (isFunction(listener)) {
              if (listener.value.isNative && listener.value.nativeImpl) {
                listener.value.nativeImpl(event);
              } else if (listener.value.code && typeof listener.value.code === "object") {
                // Non-native JS function: compile and execute via interpreter
                try {
                  const funcNode = listener.value.code as { body?: { body: unknown[] } };
                  if (funcNode.body) {
                    const generator = new BytecodeGenerator();
                    const compiled = generator.generate({
                      type: "Program",
                      body: funcNode.body.body,
                    } as unknown as ProgramNode);
                    this.context.getInterpreter().executeFunction(compiled, [event ?? createUndefined()]);
                  }
                } catch {
                  // Best-effort execution
                }
              }
            }
          }
        }
        return createBoolean(true);
      }, 1),
    );

    // Install geometry properties (getBoundingClientRect, offset*, client*, scroll*)
    this.installGeometryProperties(obj, element);

    // Install form-specific bindings based on tag name
    this.installFormElementBindings(obj, element);
  }

  /**
   * Install geometry properties on element:
   * getBoundingClientRect(), getClientRects(),
   * offsetWidth, offsetHeight, offsetTop, offsetLeft, offsetParent,
   * clientWidth, clientHeight, clientTop, clientLeft,
   * scrollWidth, scrollHeight, scrollTop, scrollLeft
   */
  private installGeometryProperties(obj: JSValue, element: DOMElement): void {
    // Helper: create a DOMRect-like JSValue
    const makeDOMRect = (x: number, y: number, width: number, height: number): JSValue => {
      const rect = createObject();
      setProperty(rect, "x", createNumber(x));
      setProperty(rect, "y", createNumber(y));
      setProperty(rect, "width", createNumber(width));
      setProperty(rect, "height", createNumber(height));
      setProperty(rect, "top", createNumber(y));
      setProperty(rect, "right", createNumber(x + width));
      setProperty(rect, "bottom", createNumber(y + height));
      setProperty(rect, "left", createNumber(x));
      return rect;
    };

    // getBoundingClientRect()
    setProperty(
      obj,
      "getBoundingClientRect",
      createNativeFunction("getBoundingClientRect", () => {
        const layout = this.getLayoutForElement(element);
        if (!layout) return makeDOMRect(0, 0, 0, 0);
        const borderBox = layout.getBorderBox();
        return makeDOMRect(borderBox.x, borderBox.y, borderBox.width, borderBox.height);
      }, 0),
    );

    // getClientRects() — returns array with single rect (no fragmentation)
    setProperty(
      obj,
      "getClientRects",
      createNativeFunction("getClientRects", () => {
        const layout = this.getLayoutForElement(element);
        const arr = createObject();
        if (layout) {
          const borderBox = layout.getBorderBox();
          setProperty(arr, "0", makeDOMRect(borderBox.x, borderBox.y, borderBox.width, borderBox.height));
          setProperty(arr, "length", createNumber(1));
        } else {
          setProperty(arr, "length", createNumber(0));
        }
        return arr;
      }, 0),
    );

    // offsetWidth = border-box width (content + padding + border)
    defineGetter(obj, "offsetWidth", () => {
      const layout = this.getLayoutForElement(element);
      if (!layout) return createNumber(0);
      const bb = layout.getBorderBox();
      return createNumber(bb.width);
    });

    // offsetHeight = border-box height
    defineGetter(obj, "offsetHeight", () => {
      const layout = this.getLayoutForElement(element);
      if (!layout) return createNumber(0);
      const bb = layout.getBorderBox();
      return createNumber(bb.height);
    });

    // offsetTop = border-box y relative to offsetParent
    defineGetter(obj, "offsetTop", () => {
      const layout = this.getLayoutForElement(element);
      if (!layout) return createNumber(0);
      const bb = layout.getBorderBox();
      return createNumber(bb.y);
    });

    // offsetLeft = border-box x relative to offsetParent
    defineGetter(obj, "offsetLeft", () => {
      const layout = this.getLayoutForElement(element);
      if (!layout) return createNumber(0);
      const bb = layout.getBorderBox();
      return createNumber(bb.x);
    });

    // offsetParent — nearest positioned ancestor or body
    defineGetter(obj, "offsetParent", () => {
      let current = element.parentNode;
      while (current) {
        if ((current as DOMElement).tagName === "body") {
          return this.wrapNodeAsJSValue(current as DOMNode);
        }
        const pos = (current as DOMElement).attributes?.get("style") ?? "";
        if (/position\s*:\s*(relative|absolute|fixed|sticky)/.test(pos)) {
          return this.wrapNodeAsJSValue(current as DOMNode);
        }
        current = current.parentNode;
      }
      return createNull();
    });

    // clientWidth = padding-box width (content + padding, no border)
    defineGetter(obj, "clientWidth", () => {
      const layout = this.getLayoutForElement(element);
      if (!layout) return createNumber(0);
      const pb = layout.getPaddingBox();
      return createNumber(pb.width);
    });

    // clientHeight = padding-box height
    defineGetter(obj, "clientHeight", () => {
      const layout = this.getLayoutForElement(element);
      if (!layout) return createNumber(0);
      const pb = layout.getPaddingBox();
      return createNumber(pb.height);
    });

    // clientTop = border-top-width
    defineGetter(obj, "clientTop", () => {
      const layout = this.getLayoutForElement(element);
      if (!layout) return createNumber(0);
      return createNumber(layout.borderTopWidth);
    });

    // clientLeft = border-left-width
    defineGetter(obj, "clientLeft", () => {
      const layout = this.getLayoutForElement(element);
      if (!layout) return createNumber(0);
      return createNumber(layout.borderLeftWidth);
    });

    // scrollWidth — content width (includes overflow); without overflow tracking, same as clientWidth
    defineGetter(obj, "scrollWidth", () => {
      const layout = this.getLayoutForElement(element);
      if (!layout) return createNumber(0);
      const pb = layout.getPaddingBox();
      return createNumber(pb.width);
    });

    // scrollHeight — content height (includes overflow)
    defineGetter(obj, "scrollHeight", () => {
      const layout = this.getLayoutForElement(element);
      if (!layout) return createNumber(0);
      const pb = layout.getPaddingBox();
      return createNumber(pb.height);
    });

    // scrollTop / scrollLeft — mutable scroll offsets (stored on element)
    const scrollState = { top: 0, left: 0 };

    defineGetter(obj, "scrollTop", () => createNumber(scrollState.top));
    defineSetter(obj, "scrollTop", (v: JSValue) => {
      scrollState.top = v.type === "number" ? v.value : parseFloat(toString(v)) || 0;
    });

    defineGetter(obj, "scrollLeft", () => createNumber(scrollState.left));
    defineSetter(obj, "scrollLeft", (v: JSValue) => {
      scrollState.left = v.type === "number" ? v.value : parseFloat(toString(v)) || 0;
    });
  }

  /**
   * Convert a CSS property name from camelCase to kebab-case
   */
  private camelToKebab(name: string): string {
    return name.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
  }

  /**
   * Parse a CSS style string into a Map of property→value
   */
  private parseStyleString(styleStr: string): Map<string, string> {
    const map = new Map<string, string>();
    if (!styleStr) return map;
    const declarations = styleStr.split(";").map((s) => s.trim()).filter(Boolean);
    for (const decl of declarations) {
      const colonIdx = decl.indexOf(":");
      if (colonIdx === -1) continue;
      const prop = decl.substring(0, colonIdx).trim();
      const val = decl.substring(colonIdx + 1).trim();
      if (prop && val) map.set(prop, val);
    }
    return map;
  }

  /**
   * Serialize a style Map back to a CSS style string
   */
  private serializeStyleMap(map: Map<string, string>): string {
    const parts: string[] = [];
    for (const [prop, val] of map) {
      parts.push(`${prop}: ${val}`);
    }
    return parts.join("; ");
  }

  /**
   * Sync the style Map back to the element's "style" attribute
   */
  private syncStyleAttribute(element: DOMElement, styleMap: Map<string, string>): void {
    if (!element.attributes) {
      element.attributes = new Map<string, string>();
    }
    const serialized = this.serializeStyleMap(styleMap);
    if (serialized) {
      element.attributes.set("style", serialized);
    } else {
      element.attributes.delete("style");
    }
  }

  /**
   * Install the `style` property on an element JSValue.
   * Creates a CSSStyleDeclaration-like object supporting:
   * - camelCase property access: element.style.backgroundColor = "red"
   * - methods: getPropertyValue, setProperty, removeProperty, item
   * - cssText getter/setter
   * - Syncs with the element's "style" attribute
   */
  private installStyleProperty(obj: JSValue, element: DOMElement): void {
    const existingStyle = element.attributes?.get("style") ?? "";
    const styleMap = this.parseStyleString(existingStyle);

    const styleObj = createObject();

    // style is a live getter so cssText/length stay current
    defineGetter(obj, "style", () => {
      setProperty(styleObj, "cssText", createString(this.serializeStyleMap(styleMap)));
      setProperty(styleObj, "length", createNumber(styleMap.size));
      return styleObj;
    });

    setProperty(styleObj, "cssText", createString(existingStyle));
    defineSetter(styleObj, "cssText", (v: JSValue) => {
      const newCss = isString(v) ? v.value : toString(v);
      styleMap.clear();
      const parsed = this.parseStyleString(newCss);
      for (const [k, val] of parsed) {
        styleMap.set(k, val);
      }
      this.syncStyleAttribute(element, styleMap);
    });

    setProperty(styleObj, "length", createNumber(styleMap.size));

    // getPropertyValue(property)
    setProperty(
      styleObj,
      "getPropertyValue",
      createNativeFunction("getPropertyValue", (...args: JSValue[]) => {
        const prop = isString(args[0]) ? args[0].value : toString(args[0]);
        const kebab = prop.includes("-") ? prop : this.camelToKebab(prop);
        return createString(styleMap.get(kebab) ?? "");
      }, 1),
    );

    // setProperty(property, value, priority?)
    setProperty(
      styleObj,
      "setProperty",
      createNativeFunction("setProperty", (...args: JSValue[]) => {
        const prop = isString(args[0]) ? args[0].value : toString(args[0]);
        const value = isString(args[1]) ? args[1].value : toString(args[1]);
        const kebab = prop.includes("-") ? prop : this.camelToKebab(prop);
        if (value === "" || value === "undefined") {
          styleMap.delete(kebab);
        } else {
          const priority = args[2] && isString(args[2]) ? args[2].value : "";
          const fullValue = priority === "important" ? `${value} !important` : value;
          styleMap.set(kebab, fullValue);
        }
        this.syncStyleAttribute(element, styleMap);
        return createUndefined();
      }, 2),
    );

    // removeProperty(property)
    setProperty(
      styleObj,
      "removeProperty",
      createNativeFunction("removeProperty", (...args: JSValue[]) => {
        const prop = isString(args[0]) ? args[0].value : toString(args[0]);
        const kebab = prop.includes("-") ? prop : this.camelToKebab(prop);
        const old = styleMap.get(kebab) ?? "";
        styleMap.delete(kebab);
        this.syncStyleAttribute(element, styleMap);
        return createString(old);
      }, 1),
    );

    // item(index)
    setProperty(
      styleObj,
      "item",
      createNativeFunction("item", (...args: JSValue[]) => {
        const idx = args[0]?.type === "number" ? args[0].value : 0;
        const keys = Array.from(styleMap.keys());
        return idx >= 0 && idx < keys.length ? createString(keys[idx]) : createString("");
      }, 1),
    );

    // Install common CSS property getters/setters for camelCase access
    const commonProperties = [
      "color", "background", "backgroundColor", "backgroundImage", "backgroundSize",
      "backgroundPosition", "backgroundRepeat",
      "display", "visibility", "opacity", "overflow", "overflowX", "overflowY",
      "position", "top", "right", "bottom", "left", "zIndex",
      "width", "height", "minWidth", "minHeight", "maxWidth", "maxHeight",
      "margin", "marginTop", "marginRight", "marginBottom", "marginLeft",
      "padding", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
      "border", "borderTop", "borderRight", "borderBottom", "borderLeft",
      "borderWidth", "borderStyle", "borderColor", "borderRadius",
      "font", "fontFamily", "fontSize", "fontWeight", "fontStyle",
      "lineHeight", "letterSpacing", "textAlign", "textDecoration", "textTransform",
      "whiteSpace", "wordBreak", "wordWrap",
      "float", "clear",
      "flex", "flexDirection", "flexWrap", "justifyContent", "alignItems", "alignSelf",
      "gap", "rowGap", "columnGap",
      "gridTemplateColumns", "gridTemplateRows", "gridColumn", "gridRow",
      "cursor", "pointerEvents", "userSelect",
      "transform", "transition", "animation",
      "boxShadow", "textShadow", "outline",
      "content", "listStyle", "listStyleType",
      "verticalAlign", "tableLayout", "borderCollapse",
      "boxSizing",
    ];

    for (const camelProp of commonProperties) {
      const kebabProp = this.camelToKebab(camelProp);
      defineGetter(styleObj, camelProp, () => {
        return createString(styleMap.get(kebabProp) ?? "");
      });
      defineSetter(styleObj, camelProp, (v: JSValue) => {
        const value = isString(v) ? v.value : toString(v);
        if (value === "" || value === "undefined") {
          styleMap.delete(kebabProp);
        } else {
          styleMap.set(kebabProp, value);
        }
        this.syncStyleAttribute(element, styleMap);
      });
    }
  }

  /**
   * Install Document-level methods on a JSValue
   */
  private installDocumentMethods(obj: JSValue, docNode: DOMNode): void {
    const doc = docNode as DOMDocument;

    // Document properties — live getters for dynamic values
    defineGetter(
      obj,
      "documentElement",
      () =>
        doc.documentElement ? this.wrapNodeAsJSValue(doc.documentElement as DOMNode) : createNull(),
    );
    defineGetter(
      obj,
      "head",
      () => doc.head ? this.wrapNodeAsJSValue(doc.head as DOMNode) : createNull(),
    );
    defineGetter(
      obj,
      "body",
      () => doc.body ? this.wrapNodeAsJSValue(doc.body as DOMNode) : createNull(),
    );
    defineGetter(obj, "title", () => createString(doc.title ?? ""));
    defineSetter(obj, "title", (v: JSValue) => {
      doc.title = isString(v) ? v.value : toString(v);
    });
    setProperty(obj, "URL", createString(doc.URL ?? ""));
    defineGetter(
      obj,
      "readyState",
      () =>
        createString(
          (docNode as unknown as SyntheticDOMNode).readyState ?? doc.readyState ?? "complete",
        ),
    );

    // DOMContentLoaded and readystatechange event support
    const docEventListeners: Map<string, Array<JSValue>> = new Map();
    setProperty(
      obj,
      "addEventListener",
      createNativeFunction("addEventListener", (...args: JSValue[]) => {
        const type = isString(args[0]) ? args[0].value : toString(args[0]);
        const callback = args[1];
        if (!docEventListeners.has(type)) docEventListeners.set(type, []);
        docEventListeners.get(type)!.push(callback);
        return createUndefined();
      }, 2),
    );
    setProperty(
      obj,
      "removeEventListener",
      createNativeFunction("removeEventListener", (...args: JSValue[]) => {
        const type = isString(args[0]) ? args[0].value : toString(args[0]);
        const callback = args[1];
        const listeners = docEventListeners.get(type);
        if (listeners) {
          const idx = listeners.indexOf(callback);
          if (idx !== -1) listeners.splice(idx, 1);
        }
        return createUndefined();
      }, 2),
    );
    setProperty(
      obj,
      "dispatchEvent",
      createNativeFunction("dispatchEvent", (...args: JSValue[]) => {
        const eventObj = args[0];
        const eventType = isObject(eventObj)
          ? toString(getProperty(eventObj, "type"))
          : toString(eventObj);
        const docListeners = docEventListeners.get(eventType) ?? [];
        for (const listener of docListeners) {
          if (listener.type === "function") {
            if (listener.value.isNative && listener.value.nativeImpl) {
              listener.value.nativeImpl(eventObj ?? createUndefined());
            } else if (listener.value.code && typeof listener.value.code === "object") {
              try {
                const funcNode = listener.value.code as { body?: { body: unknown[] } };
                if (funcNode.body) {
                  const generator = new BytecodeGenerator();
                  const compiled = generator.generate({
                    type: "Program",
                    body: funcNode.body.body,
                  } as unknown as ProgramNode);
                  this.context.getInterpreter().executeFunction(compiled, [eventObj ?? createUndefined()]);
                }
              } catch {
                // Best-effort execution
              }
            }
          }
        }
        return createBoolean(true);
      }, 1),
    );

    // Store listener registry on the document node for external dispatch
    (docNode as unknown as SyntheticDOMNode).__eventListeners = docEventListeners;

    // getElementById
    setProperty(
      obj,
      "getElementById",
      createNativeFunction("getElementById", (...args: JSValue[]) => {
        const id = isString(args[0]) ? args[0].value : toString(args[0]);
        const result = this.getElementById(docNode, id);
        return result ? this.wrapNodeAsJSValue(result) : createNull();
      }, 1),
    );

    // createElement
    setProperty(
      obj,
      "createElement",
      createNativeFunction("createElement", (...args: JSValue[]) => {
        const tagName = isString(args[0]) ? args[0].value : toString(args[0]);
        const newElement = this.createElementNative(tagName);
        return this.wrapNodeAsJSValue(newElement);
      }, 1),
    );

    // createTextNode
    setProperty(
      obj,
      "createTextNode",
      createNativeFunction("createTextNode", (...args: JSValue[]) => {
        const data = isString(args[0]) ? args[0].value : toString(args[0]);
        const textNode = this.createTextNodeNative(data);
        return this.wrapNodeAsJSValue(textNode);
      }, 1),
    );

    // querySelector (document-level)
    setProperty(
      obj,
      "querySelector",
      createNativeFunction("querySelector", (...args: JSValue[]) => {
        const selector = isString(args[0]) ? args[0].value : toString(args[0]);
        const result = this.querySelector(docNode, selector);
        return result ? this.wrapNodeAsJSValue(result) : createNull();
      }, 1),
    );

    // querySelectorAll (document-level)
    setProperty(
      obj,
      "querySelectorAll",
      createNativeFunction("querySelectorAll", (...args: JSValue[]) => {
        const selector = isString(args[0]) ? args[0].value : toString(args[0]);
        const results = this.querySelectorAll(docNode, selector);
        const arr = createObject();
        for (let i = 0; i < results.length; i++) {
          setProperty(arr, String(i), this.wrapNodeAsJSValue(results[i]));
        }
        setProperty(arr, "length", createNumber(results.length));
        return arr;
      }, 1),
    );

    // getElementsByTagName (document-level)
    setProperty(
      obj,
      "getElementsByTagName",
      createNativeFunction("getElementsByTagName", (...args: JSValue[]) => {
        const tagName = isString(args[0]) ? args[0].value : toString(args[0]);
        const results = this.getElementsByTagName(docNode, tagName.toLowerCase());
        const arr = createObject();
        for (let i = 0; i < results.length; i++) {
          setProperty(arr, String(i), this.wrapNodeAsJSValue(results[i]));
        }
        setProperty(arr, "length", createNumber(results.length));
        return arr;
      }, 1),
    );

    // getElementsByClassName (document-level)
    setProperty(
      obj,
      "getElementsByClassName",
      createNativeFunction("getElementsByClassName", (...args: JSValue[]) => {
        const className = isString(args[0]) ? args[0].value : toString(args[0]);
        const results = this.getElementsByClassName(docNode, className);
        const arr = createObject();
        for (let i = 0; i < results.length; i++) {
          setProperty(arr, String(i), this.wrapNodeAsJSValue(results[i]));
        }
        setProperty(arr, "length", createNumber(results.length));
        return arr;
      }, 1),
    );

    // createComment
    setProperty(
      obj,
      "createComment",
      createNativeFunction("createComment", (...args: JSValue[]) => {
        const data = isString(args[0]) ? args[0].value : toString(args[0]);
        const commentNode = this.createCommentNative(data);
        return this.wrapNodeAsJSValue(commentNode);
      }, 1),
    );

    // createDocumentFragment
    setProperty(
      obj,
      "createDocumentFragment",
      createNativeFunction("createDocumentFragment", () => {
        const fragId = this.nextSyntheticNodeId++ as NodeID;
        const frag: SyntheticDOMNode = {
          nodeId: fragId,
          nodeType: DOMNodeType.DOCUMENT_FRAGMENT,
          nodeName: "#document-fragment",
          nodeValue: null,
          parentNode: null,
          childNodes: [],
          firstChild: null,
          lastChild: null,
          previousSibling: null,
          nextSibling: null,
          ownerDocument: null,
          cloneNode: () => frag as unknown as DOMNode,
          appendChild: (child: DOMNode) =>
            this.appendChildNative(frag as unknown as DOMNode, child),
          removeChild: (child: DOMNode) =>
            this.removeChildNative(frag as unknown as DOMNode, child),
          insertBefore: (newNode: DOMNode, ref: DOMNode | null) =>
            this.insertBeforeNative(frag as unknown as DOMNode, newNode, ref),
          replaceChild: () => frag as unknown as DOMNode,
          contains: (node: DOMNode) => this.containsNative(frag as unknown as DOMNode, node),
          compareDocumentPosition: () => 0,
        };
        return this.wrapNodeAsJSValue(frag as unknown as DOMNode);
      }, 0),
    );

    // Event handling on document — functional implementation at lines 1052-1075 is authoritative
  }

  // =========================================================================
  // Form Element Bindings
  // =========================================================================

  /**
   * Install tag-specific form element property bindings.
   * Exposes value, checked, disabled, name, etc. as direct properties
   * mirroring HTMLInputElement, HTMLSelectElement, HTMLTextAreaElement,
   * HTMLFormElement, and HTMLButtonElement interfaces.
   */
  private installFormElementBindings(obj: JSValue, element: DOMElement): void {
    const tag = element.tagName?.toLowerCase() ?? "";

    // Helper: find closest <form> ancestor
    const findFormAncestor = (): JSValue => {
      let current: DOMNode | null = element.parentNode;
      while (current) {
        if (
          current.nodeType === DOMNodeType.ELEMENT &&
          (current as DOMElement).tagName?.toLowerCase() === "form"
        ) {
          return this.wrapNodeAsJSValue(current);
        }
        current = current.parentNode;
      }
      return createNull();
    };

    // Helper: string attribute getter/setter
    const bindStringAttr = (prop: string, attr: string, defaultVal = "") => {
      defineGetter(obj, prop, () =>
        createString(element.attributes?.get(attr) ?? defaultVal)
      );
      defineSetter(obj, prop, (v: JSValue) => {
        const val = isString(v) ? v.value : toString(v);
        if (!element.attributes) element.attributes = new Map<string, string>();
        element.attributes.set(attr, val);
      });
    };

    // Helper: boolean attribute getter/setter (presence-based)
    const bindBooleanAttr = (prop: string, attr: string) => {
      defineGetter(obj, prop, () =>
        createBoolean(element.attributes?.has(attr) ?? false)
      );
      defineSetter(obj, prop, (v: JSValue) => {
        const boolVal = isBoolean(v) ? v.value : toString(v) === "true";
        if (!element.attributes) element.attributes = new Map<string, string>();
        if (boolVal) {
          element.attributes.set(attr, "");
        } else {
          element.attributes.delete(attr);
        }
      });
    };

    // Helper: numeric attribute getter/setter
    const bindNumericAttr = (prop: string, attr: string, defaultVal: number) => {
      defineGetter(obj, prop, () => {
        const raw = element.attributes?.get(attr);
        return createNumber(raw !== undefined ? parseInt(raw, 10) || defaultVal : defaultVal);
      });
      defineSetter(obj, prop, (v: JSValue) => {
        const num = v.type === "number" ? v.value : parseInt(toString(v), 10) || 0;
        if (!element.attributes) element.attributes = new Map<string, string>();
        element.attributes.set(attr, String(num));
      });
    };

    switch (tag) {
      case "input": {
        // value — programmatic override via closure (mirrors real browser behavior)
        let _inputValue: string | undefined;
        defineGetter(obj, "value", () =>
          createString(_inputValue ?? element.attributes?.get("value") ?? "")
        );
        defineSetter(obj, "value", (v: JSValue) => {
          _inputValue = isString(v) ? v.value : toString(v);
        });

        bindStringAttr("type", "type", "text");
        bindStringAttr("name", "name");
        bindStringAttr("placeholder", "placeholder");

        // checked — boolean attribute
        defineGetter(obj, "checked", () => createBoolean(element.attributes?.has("checked") ?? false));
        defineSetter(obj, "checked", (v: JSValue) => {
          const boolVal = isBoolean(v) ? v.value : toString(v) === "true";
          if (!element.attributes) element.attributes = new Map<string, string>();
          if (boolVal) element.attributes.set("checked", "");
          else element.attributes.delete("checked");
        });

        bindBooleanAttr("disabled", "disabled");
        bindBooleanAttr("readOnly", "readonly");
        bindBooleanAttr("required", "required");
        defineGetter(obj, "form", findFormAncestor);

        // focus/blur/select — no-op in headless
        setProperty(obj, "focus", createNativeFunction("focus", () => createUndefined(), 0));
        setProperty(obj, "blur", createNativeFunction("blur", () => createUndefined(), 0));
        setProperty(obj, "select", createNativeFunction("select", () => createUndefined(), 0));
        break;
      }

      case "select": {
        let _selectedIndex = -1;

        // options — getter returns all descendant <option> elements (including those in <optgroup>)
        const getOptions = (): DOMNode[] => {
          const opts: DOMNode[] = [];
          const collectOptions = (parent: DOMNode) => {
            for (const child of parent.childNodes ?? []) {
              if (child.nodeType === DOMNodeType.ELEMENT) {
                const tag = (child as DOMElement).tagName?.toLowerCase();
                if (tag === "option") {
                  opts.push(child);
                } else if (tag === "optgroup") {
                  collectOptions(child);
                }
              }
            }
          };
          collectOptions(element);
          return opts;
        };

        defineGetter(obj, "options", () => {
          const opts = getOptions();
          const arr = createObject();
          for (let i = 0; i < opts.length; i++) {
            setProperty(arr, String(i), this.wrapNodeAsJSValue(opts[i]));
          }
          setProperty(arr, "length", createNumber(opts.length));
          return arr;
        });

        defineGetter(obj, "selectedIndex", () => {
          const opts = getOptions();
          if (_selectedIndex >= 0 && _selectedIndex < opts.length) return createNumber(_selectedIndex);
          return createNumber(opts.length > 0 ? 0 : -1);
        });
        defineSetter(obj, "selectedIndex", (v: JSValue) => {
          _selectedIndex = v.type === "number" ? v.value : parseInt(toString(v), 10) || 0;
        });

        defineGetter(obj, "value", () => {
          const opts = getOptions();
          const idx = _selectedIndex >= 0 ? _selectedIndex : (opts.length > 0 ? 0 : -1);
          if (idx >= 0 && idx < opts.length) {
            const opt = opts[idx] as DOMElement;
            return createString(
              opt.attributes?.get("value") ?? this.computeTextContent(opt as DOMNode) ?? ""
            );
          }
          return createString("");
        });
        defineSetter(obj, "value", (v: JSValue) => {
          const target = isString(v) ? v.value : toString(v);
          const opts = getOptions();
          for (let i = 0; i < opts.length; i++) {
            const opt = opts[i] as DOMElement;
            const optVal = opt.attributes?.get("value") ?? this.computeTextContent(opt as DOMNode) ?? "";
            if (optVal === target) {
              _selectedIndex = i;
              return;
            }
          }
        });

        bindBooleanAttr("disabled", "disabled");
        bindStringAttr("name", "name");
        bindBooleanAttr("multiple", "multiple");
        defineGetter(obj, "form", findFormAncestor);
        break;
      }

      case "textarea": {
        // value — initial value from text content, programmatic override via closure
        let _textareaValue: string | undefined;
        defineGetter(obj, "value", () =>
          createString(_textareaValue ?? this.computeTextContent(element as DOMNode) ?? "")
        );
        defineSetter(obj, "value", (v: JSValue) => {
          _textareaValue = isString(v) ? v.value : toString(v);
        });

        bindBooleanAttr("disabled", "disabled");
        bindStringAttr("name", "name");
        bindStringAttr("placeholder", "placeholder");
        bindBooleanAttr("readOnly", "readonly");
        bindBooleanAttr("required", "required");
        bindNumericAttr("rows", "rows", 2);
        bindNumericAttr("cols", "cols", 20);
        defineGetter(obj, "form", findFormAncestor);
        break;
      }

      case "form": {
        bindStringAttr("action", "action");

        // method — default "get"
        defineGetter(obj, "method", () =>
          createString(element.attributes?.get("method")?.toLowerCase() ?? "get")
        );
        defineSetter(obj, "method", (v: JSValue) => {
          const val = isString(v) ? v.value : toString(v);
          if (!element.attributes) element.attributes = new Map<string, string>();
          element.attributes.set("method", val.toLowerCase());
        });

        // elements — all descendant input/select/textarea/button
        const FORM_TAGS = new Set(["input", "select", "textarea", "button"]);
        const collectFormElements = (node: DOMNode, results: DOMNode[]) => {
          for (const child of node.childNodes ?? []) {
            if (child.nodeType === DOMNodeType.ELEMENT) {
              if (FORM_TAGS.has((child as DOMElement).tagName?.toLowerCase() ?? "")) {
                results.push(child);
              }
              collectFormElements(child, results);
            }
          }
        };

        defineGetter(obj, "elements", () => {
          const elems: DOMNode[] = [];
          collectFormElements(element as DOMNode, elems);
          const arr = createObject();
          for (let i = 0; i < elems.length; i++) {
            setProperty(arr, String(i), this.wrapNodeAsJSValue(elems[i]));
          }
          setProperty(arr, "length", createNumber(elems.length));
          return arr;
        });

        defineGetter(obj, "length", () => {
          const elems: DOMNode[] = [];
          collectFormElements(element as DOMNode, elems);
          return createNumber(elems.length);
        });

        // submit() / reset() — dispatch events
        setProperty(obj, "submit", createNativeFunction("submit", () => {
          const event = createObject();
          setProperty(event, "type", createString("submit"));
          setProperty(event, "target", obj);
          const dispatchFn = getProperty(obj, "dispatchEvent");
          if (isFunction(dispatchFn) && dispatchFn.value.nativeImpl) {
            dispatchFn.value.nativeImpl(event);
          }
          return createUndefined();
        }, 0));

        setProperty(obj, "reset", createNativeFunction("reset", () => {
          const event = createObject();
          setProperty(event, "type", createString("reset"));
          setProperty(event, "target", obj);
          const dispatchFn = getProperty(obj, "dispatchEvent");
          if (isFunction(dispatchFn) && dispatchFn.value.nativeImpl) {
            dispatchFn.value.nativeImpl(event);
          }
          return createUndefined();
        }, 0));
        break;
      }

      case "button": {
        bindStringAttr("type", "type", "submit");
        bindBooleanAttr("disabled", "disabled");
        bindStringAttr("name", "name");
        bindStringAttr("value", "value");
        defineGetter(obj, "form", findFormAncestor);
        break;
      }

      default:
        break;
    }
  }

  // =========================================================================
  // Constructor Methods (for global Node, Element, Document constructors)
  // =========================================================================

  /**
   * Create Node constructor
   */
  private createNodeConstructor(): JSValue {
    const constructor = createNativeFunction("Node", () => createUndefined(), 0);
    const prototype = createObject(null);

    // Prototype methods serve as fallbacks (per-instance methods from wrapNodeAsJSValue shadow these)
    setProperty(
      prototype,
      "appendChild",
      createNativeFunction("appendChild", (...args: JSValue[]) => args[0] ?? createUndefined(), 1),
    );
    setProperty(
      prototype,
      "removeChild",
      createNativeFunction("removeChild", (...args: JSValue[]) => args[0] ?? createUndefined(), 1),
    );
    setProperty(
      prototype,
      "insertBefore",
      createNativeFunction("insertBefore", (...args: JSValue[]) => args[0] ?? createUndefined(), 2),
    );

    setProperty(constructor, "prototype", prototype);
    return constructor;
  }

  /**
   * Create Element constructor
   */
  private createElementConstructor(): JSValue {
    const constructor = createNativeFunction("Element", () => createUndefined(), 0);
    const prototype = createObject(null);

    setProperty(
      prototype,
      "getAttribute",
      createNativeFunction("getAttribute", () => createNull(), 1),
    );
    setProperty(
      prototype,
      "setAttribute",
      createNativeFunction("setAttribute", () => createUndefined(), 2),
    );
    setProperty(
      prototype,
      "removeAttribute",
      createNativeFunction("removeAttribute", () => createUndefined(), 1),
    );
    setProperty(
      prototype,
      "querySelector",
      createNativeFunction("querySelector", () => createNull(), 1),
    );

    setProperty(constructor, "prototype", prototype);
    return constructor;
  }

  /**
   * Create Document constructor
   */
  private createDocumentConstructor(): JSValue {
    const constructor = createNativeFunction("Document", () => createUndefined(), 0);
    const prototype = createObject(null);

    setProperty(
      prototype,
      "getElementById",
      createNativeFunction("getElementById", () => createNull(), 1),
    );
    setProperty(
      prototype,
      "createElement",
      createNativeFunction("createElement", () => createUndefined(), 1),
    );
    setProperty(
      prototype,
      "createTextNode",
      createNativeFunction("createTextNode", () => createUndefined(), 1),
    );

    setProperty(constructor, "prototype", prototype);
    return constructor;
  }

  /**
   * Install Node type constants
   */
  private installNodeTypeConstants(): void {
    const nodeTypes = {
      ELEMENT_NODE: 1,
      ATTRIBUTE_NODE: 2,
      TEXT_NODE: 3,
      CDATA_SECTION_NODE: 4,
      PROCESSING_INSTRUCTION_NODE: 7,
      COMMENT_NODE: 8,
      DOCUMENT_NODE: 9,
      DOCUMENT_TYPE_NODE: 10,
      DOCUMENT_FRAGMENT_NODE: 11,
    };

    for (const [name, value] of Object.entries(nodeTypes)) {
      setProperty(this.context.global, name, createNumber(value));
    }
  }

  // =========================================================================
  // JSNode Wrapper (legacy, used by wrapNode)
  // =========================================================================

  /**
   * Create wrapper for native node
   */
  private createNodeWrapper(nativeNode: DOMNode): JSNode {
    let textContent: string | null = null;
    if (nativeNode.nodeType === DOMNodeType.TEXT) {
      textContent = nativeNode.nodeValue;
    } else {
      textContent = this.computeTextContent(nativeNode);
    }

    const self = this;
    const wrapper: JSNode = {
      nodeType: this.getNodeType(nativeNode),
      nodeName: this.getNodeName(nativeNode),
      nodeValue: nativeNode.nodeValue,
      textContent,
      parentNode: null,
      childNodes: (nativeNode.childNodes ?? []).map((child) => this.wrapNode(child)),
      firstChild: null,
      lastChild: null,
      previousSibling: null,
      nextSibling: null,

      appendChild(child: JSNode): JSNode {
        const nativeChild = self.unwrapNode(child);
        if (nativeChild) {
          self.appendChildNative(nativeNode, nativeChild);
        }
        // Update wrapper's childNodes
        wrapper.childNodes.push(child);
        child.parentNode = wrapper;
        wrapper.firstChild = wrapper.childNodes[0] ?? null;
        wrapper.lastChild = wrapper.childNodes[wrapper.childNodes.length - 1] ?? null;
        return child;
      },
      removeChild(child: JSNode): JSNode {
        const nativeChild = self.unwrapNode(child);
        if (nativeChild) {
          self.removeChildNative(nativeNode, nativeChild);
        }
        const idx = wrapper.childNodes.indexOf(child);
        if (idx !== -1) wrapper.childNodes.splice(idx, 1);
        child.parentNode = null;
        wrapper.firstChild = wrapper.childNodes[0] ?? null;
        wrapper.lastChild = wrapper.childNodes[wrapper.childNodes.length - 1] ?? null;
        return child;
      },
      insertBefore(newNode: JSNode, ref: JSNode | null): JSNode {
        const nativeNew = self.unwrapNode(newNode);
        const nativeRef = ref ? self.unwrapNode(ref) : null;
        if (nativeNew) {
          self.insertBeforeNative(nativeNode, nativeNew, nativeRef);
        }
        if (ref) {
          const refIdx = wrapper.childNodes.indexOf(ref);
          if (refIdx !== -1) {
            wrapper.childNodes.splice(refIdx, 0, newNode);
          } else {
            wrapper.childNodes.push(newNode);
          }
        } else {
          wrapper.childNodes.push(newNode);
        }
        newNode.parentNode = wrapper;
        wrapper.firstChild = wrapper.childNodes[0] ?? null;
        wrapper.lastChild = wrapper.childNodes[wrapper.childNodes.length - 1] ?? null;
        return newNode;
      },
      cloneNode: (deep?: boolean) => self.cloneNodeWrapper(wrapper, deep),
      contains: (other: JSNode) => self.containsNode(wrapper, other),
    };

    // Set up child relationships
    if (wrapper.childNodes.length > 0) {
      wrapper.firstChild = wrapper.childNodes[0];
      wrapper.lastChild = wrapper.childNodes[wrapper.childNodes.length - 1];
      for (let i = 0; i < wrapper.childNodes.length; i++) {
        wrapper.childNodes[i].parentNode = wrapper;
        wrapper.childNodes[i].previousSibling = i > 0 ? wrapper.childNodes[i - 1] : null;
        wrapper.childNodes[i].nextSibling = i < wrapper.childNodes.length - 1
          ? wrapper.childNodes[i + 1]
          : null;
      }
    }

    return wrapper;
  }

  // =========================================================================
  // DOM Tree Query Operations
  // =========================================================================

  /**
   * Compute text content by concatenating all descendant text nodes
   */
  private computeTextContent(node: DOMNode): string | null {
    if (node.nodeType === DOMNodeType.TEXT) {
      return node.nodeValue;
    }
    if (!node.childNodes || node.childNodes.length === 0) {
      return "";
    }
    let result = "";
    for (const child of node.childNodes) {
      const text = this.computeTextContent(child);
      if (text !== null) result += text;
    }
    return result;
  }

  /**
   * Get node type constant
   */
  private getNodeType(node: DOMNode): number {
    return node.nodeType;
  }

  /**
   * Get node name
   */
  private getNodeName(node: DOMNode): string {
    if (node.nodeType === DOMNodeType.ELEMENT) {
      const element = node as DOMElement;
      return element.tagName?.toUpperCase() ?? "";
    }
    if (node.nodeType === DOMNodeType.TEXT) {
      return "#text";
    }
    if (node.nodeType === DOMNodeType.DOCUMENT) {
      return "#document";
    }
    if (node.nodeType === DOMNodeType.DOCUMENT_FRAGMENT) {
      return "#document-fragment";
    }
    if (node.nodeType === DOMNodeType.COMMENT) {
      return "#comment";
    }
    return "";
  }

  /**
   * Query selector (supports #id, .class, tagName selectors)
   */
  querySelector(node: DOMNode, selector: string): DOMNode | null {
    const results = this.querySelectorAll(node, selector);
    return results.length > 0 ? results[0] : null;
  }

  /**
   * Query all matching elements — supports:
   * - Simple selectors: tagName, #id, .class, *
   * - Compound selectors: div.foo, input#name.active
   * - Attribute selectors: [attr], [attr="value"], [attr^="prefix"], [attr$="suffix"], [attr*="substr"]
   * - Descendant combinator: div p, .parent .child
   * - Child combinator: div > p
   * - Comma-separated lists: div, span
   */
  querySelectorAll(node: DOMNode, selector: string): DOMNode[] {
    // Handle comma-separated selectors
    if (selector.includes(",")) {
      const parts = selector.split(",").map((s) => s.trim()).filter(Boolean);
      const seen = new Set<DOMNode>();
      const results: DOMNode[] = [];
      for (const part of parts) {
        for (const match of this.querySelectorAll(node, part)) {
          if (!seen.has(match)) {
            seen.add(match);
            results.push(match);
          }
        }
      }
      return results;
    }

    // Split on descendant/child combinators
    const tokens = this.tokenizeSelectorCombinators(selector.trim());

    if (tokens.length === 1) {
      // Single compound selector — no combinators, search entire subtree (including root)
      const results: DOMNode[] = [];
      this.collectMatchingCompound(node, tokens[0].selector, results);
      return results;
    }

    // Multi-part selector with combinators
    let candidates: DOMNode[] = [];
    this.collectMatchingCompound(node, tokens[0].selector, candidates);

    for (let i = 1; i < tokens.length; i++) {
      const combinator = tokens[i].combinator;
      const compoundSel = tokens[i].selector;
      const nextCandidates: DOMNode[] = [];

      for (const parent of candidates) {
        if (combinator === ">") {
          // Child combinator — only direct children
          for (const child of parent.childNodes ?? []) {
            if (child.nodeType === DOMNodeType.ELEMENT && this.matchesCompound(child as DOMElement, compoundSel)) {
              nextCandidates.push(child);
            }
          }
        } else {
          // Descendant combinator (space)
          const matches: DOMNode[] = [];
          this.collectMatchingDescendants(parent, compoundSel, matches);
          nextCandidates.push(...matches);
        }
      }
      candidates = nextCandidates;
    }

    return candidates;
  }

  /**
   * Tokenize a selector string into compound selectors and combinators
   */
  private tokenizeSelectorCombinators(selector: string): Array<{ combinator: string; selector: string }> {
    const tokens: Array<{ combinator: string; selector: string }> = [];
    let current = "";
    let i = 0;
    const len = selector.length;

    while (i < len) {
      // Check for child combinator '>'
      if (selector[i] === ">" && current.trim()) {
        tokens.push({ combinator: tokens.length === 0 ? "" : " ", selector: current.trim() });
        current = "";
        i++; // skip '>'
        // The next token has '>' combinator
        // Skip whitespace
        while (i < len && selector[i] === " ") i++;
        // Collect next compound
        let next = "";
        while (i < len && selector[i] !== " " && selector[i] !== ">") {
          // Include attribute selectors (brackets)
          if (selector[i] === "[") {
            while (i < len && selector[i] !== "]") next += selector[i++];
            if (i < len) next += selector[i++]; // include ']'
          } else {
            next += selector[i++];
          }
        }
        tokens.push({ combinator: ">", selector: next.trim() });
        continue;
      }

      // Check for whitespace (descendant combinator)
      if (selector[i] === " " && current.trim()) {
        // Look ahead to check if it's a child combinator
        let j = i;
        while (j < len && selector[j] === " ") j++;
        if (j < len && selector[j] === ">") {
          i = j;
          continue;
        }
        tokens.push({ combinator: tokens.length === 0 ? "" : " ", selector: current.trim() });
        current = "";
        i = j;
        continue;
      }

      // Include brackets as part of compound
      if (selector[i] === "[") {
        while (i < len && selector[i] !== "]") current += selector[i++];
        if (i < len) current += selector[i++]; // include ']'
        continue;
      }

      current += selector[i++];
    }
    if (current.trim()) {
      tokens.push({ combinator: tokens.length === 0 ? "" : " ", selector: current.trim() });
    }
    return tokens;
  }

  /**
   * Collect matching descendants only (exclude the root node itself)
   */
  private collectMatchingDescendants(node: DOMNode, compoundSelector: string, results: DOMNode[]): void {
    if (node.childNodes) {
      for (const child of node.childNodes) {
        this.collectMatchingCompound(child, compoundSelector, results);
      }
    }
  }

  /**
   * Collect all descendant elements matching a compound selector (includes node itself)
   */
  private collectMatchingCompound(node: DOMNode, compoundSelector: string, results: DOMNode[]): void {
    if (node.nodeType === DOMNodeType.ELEMENT) {
      if (this.matchesCompound(node as DOMElement, compoundSelector)) {
        results.push(node);
      }
    }
    if (node.childNodes) {
      for (const child of node.childNodes) {
        this.collectMatchingCompound(child, compoundSelector, results);
      }
    }
  }

  /**
   * Test if an element matches a compound selector (e.g., "div.foo#bar[type='text']")
   */
  private matchesCompound(element: DOMElement, compoundSelector: string): boolean {
    if (compoundSelector === "*") return true;

    // Parse compound selector into parts: tag, ids, classes, attributes
    const parts = this.parseCompoundSelector(compoundSelector);

    // Check tag
    if (parts.tag && parts.tag !== "*" && element.tagName?.toLowerCase() !== parts.tag.toLowerCase()) {
      return false;
    }

    // Check id
    if (parts.id) {
      const elId = element.id || element.attributes?.get("id") || "";
      if (elId !== parts.id) return false;
    }

    // Check classes
    const elClasses = (element.className || element.attributes?.get("class") || "").split(/\s+/);
    for (const cls of parts.classes) {
      if (!elClasses.includes(cls)) return false;
    }

    // Check attribute selectors
    for (const attr of parts.attributes) {
      const attrVal = element.attributes?.get(attr.name) ?? null;
      if (attr.op === null) {
        // [attr] — just check existence
        if (attrVal === null) return false;
      } else if (attr.op === "=") {
        if (attrVal !== attr.value) return false;
      } else if (attr.op === "^=") {
        if (attrVal === null || !attrVal.startsWith(attr.value)) return false;
      } else if (attr.op === "$=") {
        if (attrVal === null || !attrVal.endsWith(attr.value)) return false;
      } else if (attr.op === "*=") {
        if (attrVal === null || !attrVal.includes(attr.value)) return false;
      } else if (attr.op === "~=") {
        if (attrVal === null || !attrVal.split(/\s+/).includes(attr.value)) return false;
      }
    }

    return true;
  }

  /**
   * Parse a compound selector into its constituent parts
   */
  private parseCompoundSelector(selector: string): {
    tag: string | null;
    id: string | null;
    classes: string[];
    attributes: Array<{ name: string; op: string | null; value: string }>;
  } {
    let tag: string | null = null;
    let id: string | null = null;
    const classes: string[] = [];
    const attributes: Array<{ name: string; op: string | null; value: string }> = [];

    let i = 0;
    const len = selector.length;

    // Parse leading tag name
    if (i < len && /[a-zA-Z*]/.test(selector[i])) {
      let t = "";
      while (i < len && /[a-zA-Z0-9\-]/.test(selector[i])) t += selector[i++];
      tag = t;
    }

    while (i < len) {
      if (selector[i] === "#") {
        i++;
        let idStr = "";
        while (i < len && /[a-zA-Z0-9\-_]/.test(selector[i])) idStr += selector[i++];
        id = idStr;
      } else if (selector[i] === ".") {
        i++;
        let cls = "";
        while (i < len && /[a-zA-Z0-9\-_]/.test(selector[i])) cls += selector[i++];
        classes.push(cls);
      } else if (selector[i] === "[") {
        i++; // skip '['
        let attrName = "";
        while (i < len && /[a-zA-Z0-9\-_]/.test(selector[i])) attrName += selector[i++];
        if (i < len && selector[i] === "]") {
          i++; // just [attr]
          attributes.push({ name: attrName, op: null, value: "" });
        } else {
          // Parse operator
          let op = "";
          while (i < len && /[=^$*~|!]/.test(selector[i])) op += selector[i++];
          // Parse value
          let val = "";
          if (i < len && (selector[i] === '"' || selector[i] === "'")) {
            const q = selector[i++];
            while (i < len && selector[i] !== q) val += selector[i++];
            if (i < len) i++; // skip closing quote
          } else {
            while (i < len && selector[i] !== "]") val += selector[i++];
          }
          if (i < len && selector[i] === "]") i++; // skip ']'
          attributes.push({ name: attrName, op: op || "=", value: val });
        }
      } else {
        i++;
      }
    }

    return { tag, id, classes, attributes };
  }

  /**
   * Get element by ID
   */
  getElementById(node: DOMNode, id: string): DOMNode | null {
    if (node.nodeType === DOMNodeType.ELEMENT) {
      const element = node as DOMElement;
      if (element.attributes?.get("id") === id || element.id === id) {
        return node;
      }
    }

    if (node.childNodes) {
      for (const child of node.childNodes) {
        const result = this.getElementById(child, id);
        if (result) return result;
      }
    }

    return null;
  }

  /**
   * Get all elements by tag name
   */
  getElementsByTagName(node: DOMNode, tagName: string): DOMNode[] {
    const results: DOMNode[] = [];
    this.collectByTagName(node, tagName, results);
    return results;
  }

  private collectByTagName(node: DOMNode, tagName: string, results: DOMNode[]): void {
    if (node.nodeType === DOMNodeType.ELEMENT) {
      const element = node as DOMElement;
      if (element.tagName?.toLowerCase() === tagName || tagName === "*") {
        results.push(node);
      }
    }
    if (node.childNodes) {
      for (const child of node.childNodes) {
        this.collectByTagName(child, tagName, results);
      }
    }
  }

  /**
   * Get all elements by class name
   */
  getElementsByClassName(node: DOMNode, className: string): DOMNode[] {
    const results: DOMNode[] = [];
    this.collectByClassName(node, className, results);
    return results;
  }

  private collectByClassName(node: DOMNode, className: string, results: DOMNode[]): void {
    if (node.nodeType === DOMNodeType.ELEMENT) {
      const element = node as DOMElement;
      const classes = (element.className ?? element.attributes?.get("class") ?? "").split(/\s+/);
      if (classes.includes(className)) {
        results.push(node);
      }
    }
    if (node.childNodes) {
      for (const child of node.childNodes) {
        this.collectByClassName(child, className, results);
      }
    }
  }

  /**
   * Get first element by tag name
   */
  private getFirstByTagName(node: DOMNode, tagName: string): DOMNode | null {
    if (node.nodeType === DOMNodeType.ELEMENT) {
      const element = node as DOMElement;
      if (tagName === "*" || element.tagName?.toLowerCase() === tagName) {
        return node;
      }
    }

    if (node.childNodes) {
      for (const child of node.childNodes) {
        const result = this.getFirstByTagName(child, tagName);
        if (result) return result;
      }
    }

    return null;
  }

  /**
   * Check if a node contains another (native)
   */
  private containsNative(parent: DOMNode, child: DOMNode): boolean {
    if (!parent.childNodes) return false;
    for (const node of parent.childNodes) {
      if (node === child) return true;
      if (this.containsNative(node, child)) return true;
    }
    return false;
  }

  // =========================================================================
  // Additional Native Node Creation
  // =========================================================================

  /**
   * Create a new native comment node
   */
  createCommentNative(data: string): DOMNode {
    const nodeId = this.nextSyntheticNodeId++ as NodeID;
    const commentNode: SyntheticDOMNode = {
      nodeId,
      nodeType: DOMNodeType.COMMENT,
      nodeName: "#comment",
      nodeValue: data,
      parentNode: null,
      childNodes: [],
      firstChild: null,
      lastChild: null,
      previousSibling: null,
      nextSibling: null,
      ownerDocument: null,
      cloneNode: () => commentNode as unknown as DOMNode,
      appendChild: () => commentNode as unknown as DOMNode,
      removeChild: () => commentNode as unknown as DOMNode,
      insertBefore: () => commentNode as unknown as DOMNode,
      replaceChild: () => commentNode as unknown as DOMNode,
      contains: () => false,
      compareDocumentPosition: () => 0,
    };
    return commentNode as unknown as DOMNode;
  }

  // =========================================================================
  // Selector Matching
  // =========================================================================

  /**
   * Test if an element matches a simple CSS selector
   */
  private matchesSelector(element: DOMElement, selector: string): boolean {
    return this.matchesCompound(element, selector);
  }

  /**
   * Find the next or previous element sibling
   */
  private findElementSibling(node: DOMNode, direction: "next" | "previous"): DOMNode | null {
    let current = direction === "next" ? node.nextSibling : node.previousSibling;
    while (current) {
      if (current.nodeType === DOMNodeType.ELEMENT) return current;
      current = direction === "next" ? current.nextSibling : current.previousSibling;
    }
    return null;
  }

  // =========================================================================
  // HTML Serialization
  // =========================================================================

  /**
   * Serialize child nodes to an HTML string
   */
  private serializeChildren(node: DOMNode): string {
    if (!node.childNodes || node.childNodes.length === 0) return "";
    return node.childNodes.map((child) => this.serializeNode(child)).join("");
  }

  /**
   * Serialize a single node to an HTML string
   */
  private serializeNode(node: DOMNode): string {
    if (node.nodeType === DOMNodeType.TEXT) {
      return node.nodeValue ?? "";
    }
    if (node.nodeType === DOMNodeType.COMMENT) {
      return `<!--${node.nodeValue ?? ""}-->`;
    }
    if (node.nodeType === DOMNodeType.ELEMENT) {
      const el = node as DOMElement;
      const tag = el.tagName?.toLowerCase() ?? "";
      let attrs = "";
      if (el.attributes) {
        for (const [name, value] of el.attributes) {
          attrs += ` ${name}="${escapeHtmlAttribute(value)}"`;
        }
      }
      if (VOID_ELEMENTS.has(tag)) {
        return `<${tag}${attrs}>`;
      }
      const inner = this.serializeChildren(node);
      return `<${tag}${attrs}>${inner}</${tag}>`;
    }
    return "";
  }

  // =========================================================================
  // HTML Fragment Parser
  // =========================================================================

  /**
   * Parse an HTML string into DOM nodes and append them to a parent element.
   * Supports basic HTML tags, attributes, nested elements, and text nodes.
   */
  private parseHTMLFragment(html: string, parent: DOMNode): void {
    let pos = 0;
    const len = html.length;

    const parseNodes = (parentNode: DOMNode): void => {
      while (pos < len) {
        if (html[pos] === "<") {
          // Check for closing tag
          if (html[pos + 1] === "/") {
            // Closing tag — return to parent
            const closeEnd = html.indexOf(">", pos);
            if (closeEnd !== -1) {
              pos = closeEnd + 1;
            } else {
              pos = len;
            }
            return;
          }

          // Check for comment
          if (html.substring(pos, pos + 4) === "<!--") {
            const commentEnd = html.indexOf("-->", pos + 4);
            if (commentEnd !== -1) {
              const commentData = html.substring(pos + 4, commentEnd);
              const commentNode = this.createCommentNative(commentData);
              this.appendChildNative(parentNode, commentNode);
              pos = commentEnd + 3;
            } else {
              pos = len;
            }
            continue;
          }

          // Opening tag
          pos++; // skip '<'
          // Parse tag name
          let tagName = "";
          while (pos < len && /[a-zA-Z0-9\-]/.test(html[pos])) {
            tagName += html[pos++];
          }
          if (!tagName) {
            // Malformed: treat '<' as text
            const textNode = this.createTextNodeNative("<");
            this.appendChildNative(parentNode, textNode);
            continue;
          }

          const el = this.createElementNative(tagName);
          const syntheticEl = el as unknown as SyntheticDOMNode;

          // Parse attributes
          while (pos < len && html[pos] !== ">" && !(html[pos] === "/" && html[pos + 1] === ">")) {
            // Skip whitespace
            while (pos < len && /\s/.test(html[pos])) pos++;
            if (pos >= len || html[pos] === ">" || (html[pos] === "/" && html[pos + 1] === ">")) break;

            // Parse attribute name
            let attrName = "";
            while (pos < len && /[a-zA-Z0-9\-_]/.test(html[pos])) {
              attrName += html[pos++];
            }
            if (!attrName) { pos++; continue; }

            let attrValue = "";
            // Skip whitespace around '='
            while (pos < len && /\s/.test(html[pos])) pos++;
            if (pos < len && html[pos] === "=") {
              pos++; // skip '='
              while (pos < len && /\s/.test(html[pos])) pos++;
              if (pos < len && (html[pos] === '"' || html[pos] === "'")) {
                const quote = html[pos++];
                while (pos < len && html[pos] !== quote) {
                  attrValue += html[pos++];
                }
                if (pos < len) pos++; // skip closing quote
              } else {
                // Unquoted attribute value
                while (pos < len && !/[\s>]/.test(html[pos])) {
                  attrValue += html[pos++];
                }
              }
            }

            if (syntheticEl.setAttribute) {
              syntheticEl.setAttribute(attrName, attrValue);
            } else if (syntheticEl.attributes) {
              syntheticEl.attributes.set(attrName, attrValue);
            }
          }

          // Self-closing tag or void element
          const isSelfClosing = pos < len && html[pos] === "/" && html[pos + 1] === ">";
          if (isSelfClosing) {
            pos += 2; // skip '/>'
          } else if (pos < len) {
            pos++; // skip '>'
          }

          this.appendChildNative(parentNode, el);

          // If not void/self-closing, parse children
          if (!isSelfClosing && !VOID_ELEMENTS.has(tagName.toLowerCase())) {
            parseNodes(el);
          }
        } else {
          // Text content
          let text = "";
          while (pos < len && html[pos] !== "<") {
            text += html[pos++];
          }
          if (text) {
            const textNode = this.createTextNodeNative(text);
            this.appendChildNative(parentNode, textNode);
          }
        }
      }
    };

    parseNodes(parent);
  }

  // =========================================================================
  // Clone and Contains (JSNode-level)
  // =========================================================================

  /**
   * Clone node wrapper
   */
  private cloneNodeWrapper(node: JSNode, deep?: boolean): JSNode {
    const nativeNode = this.unwrapNode(node);
    if (!nativeNode) return node;

    const cloned = this.cloneNativeNode(nativeNode, deep ?? false);
    return this.wrapNode(cloned);
  }

  /**
   * Clone native node
   */
  private cloneNativeNode(node: DOMNode, deep: boolean): DOMNode {
    const nodeId = this.nextSyntheticNodeId++ as NodeID;
    const cloned: SyntheticDOMNode = {
      nodeId,
      nodeType: node.nodeType,
      nodeName: node.nodeName,
      nodeValue: node.nodeValue,
      parentNode: null,
      childNodes: [],
      firstChild: null,
      lastChild: null,
      previousSibling: null,
      nextSibling: null,
      ownerDocument: null,
      cloneNode: (d: boolean) => this.cloneNativeNode(cloned as unknown as DOMNode, d),
      appendChild: (child: DOMNode) => this.appendChildNative(cloned as unknown as DOMNode, child),
      removeChild: (child: DOMNode) => this.removeChildNative(cloned as unknown as DOMNode, child),
      insertBefore: (newNode: DOMNode, ref: DOMNode | null) =>
        this.insertBeforeNative(cloned as unknown as DOMNode, newNode, ref),
      replaceChild: (newNode: DOMNode, oldNode: DOMNode) => {
        this.insertBeforeNative(cloned as unknown as DOMNode, newNode, oldNode);
        this.removeChildNative(cloned as unknown as DOMNode, oldNode);
        return oldNode;
      },
      contains: (n: DOMNode) => this.containsNative(cloned as unknown as DOMNode, n),
      compareDocumentPosition: () => 0,
    };

    if (node.nodeType === DOMNodeType.ELEMENT) {
      const element = node as DOMElement;
      cloned.tagName = element.tagName;
      cloned.attributes = element.attributes ? new Map(element.attributes) : new Map();
      cloned.id = element.id ?? "";
      cloned.className = element.className ?? "";
      cloned.parentElement = null;
      cloned.previousElementSibling = null;
      cloned.nextElementSibling = null;
      cloned.classList = {
        length: 0,
        value: "",
        item: () => null,
        add: () => {},
        remove: () => {},
        contains: () => false,
        toggle: () => false,
        replace: () => false,
      };
      cloned.getAttribute = (name: string) => cloned.attributes!.get(name) ?? null;
      cloned.setAttribute = (name: string, value: string) => {
        cloned.attributes!.set(name, value);
        if (name === "id") cloned.id = value;
        if (name === "class") cloned.className = value;
      };
      cloned.removeAttribute = (name: string) => cloned.attributes!.delete(name);
      cloned.hasAttribute = (name: string) => cloned.attributes!.has(name);
      cloned.querySelector = (sel: string) => this.querySelector(cloned, sel);
      cloned.querySelectorAll = (sel: string) => this.querySelectorAll(cloned, sel);
      cloned.getElementsByTagName = (tag: string) => this.getElementsByTagName(cloned, tag);
      cloned.getElementsByClassName = (cls: string) => this.getElementsByClassName(cloned, cls);
      cloned.matches = () => false;
      cloned.closest = () => null;
    }

    // Deep clone children after cloned is initialized
    if (deep && node.childNodes) {
      for (const child of node.childNodes) {
        const clonedChild = this.cloneNativeNode(child, true);
        clonedChild.parentNode = cloned as unknown as DOMNode;
        cloned.childNodes.push(clonedChild);
      }
    }

    // Set up children relationships
    if (cloned.childNodes.length > 0) {
      cloned.firstChild = cloned.childNodes[0];
      cloned.lastChild = cloned.childNodes[cloned.childNodes.length - 1];
      for (let i = 0; i < cloned.childNodes.length; i++) {
        cloned.childNodes[i].previousSibling = i > 0 ? cloned.childNodes[i - 1] : null;
        cloned.childNodes[i].nextSibling = i < cloned.childNodes.length - 1
          ? cloned.childNodes[i + 1]
          : null;
      }
    }

    return cloned as unknown as DOMNode;
  }

  /**
   * Check if node contains another (JSNode level)
   */
  private containsNode(parent: JSNode, child: JSNode): boolean {
    for (const node of parent.childNodes) {
      if (node === child) return true;
      if (this.containsNode(node, child)) return true;
    }
    return false;
  }
}
