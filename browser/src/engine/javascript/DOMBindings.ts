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
import { V8Context } from "./V8Context.ts";
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
  isObject,
  isString,
  type JSValue,
  setProperty,
  toString,
} from "./JSValue.ts";

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

  constructor(context: V8Context) {
    this.context = context;
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
      this.computeTextContent(nativeNode) !== null
        ? createString(this.computeTextContent(nativeNode)!)
        : createNull(),
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
        length: 0,
        value: "",
        item: () => null,
        add: () => {},
        remove: () => {},
        contains: () => false,
        toggle: () => false,
        replace: () => false,
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
    // parentNode
    setProperty(
      obj,
      "parentNode",
      nativeNode.parentNode ? this.wrapNodeAsJSValue(nativeNode.parentNode) : createNull(),
    );

    // childNodes - wrap as JSValue array-like object
    const childNodesObj = createObject();
    const children = nativeNode.childNodes ?? [];
    for (let i = 0; i < children.length; i++) {
      setProperty(childNodesObj, String(i), this.wrapNodeAsJSValue(children[i]));
    }
    setProperty(childNodesObj, "length", createNumber(children.length));
    setProperty(obj, "childNodes", childNodesObj);

    // firstChild / lastChild
    setProperty(
      obj,
      "firstChild",
      nativeNode.firstChild ? this.wrapNodeAsJSValue(nativeNode.firstChild) : createNull(),
    );
    setProperty(
      obj,
      "lastChild",
      nativeNode.lastChild ? this.wrapNodeAsJSValue(nativeNode.lastChild) : createNull(),
    );

    // siblings
    setProperty(
      obj,
      "previousSibling",
      nativeNode.previousSibling
        ? this.wrapNodeAsJSValue(nativeNode.previousSibling)
        : createNull(),
    );
    setProperty(
      obj,
      "nextSibling",
      nativeNode.nextSibling ? this.wrapNodeAsJSValue(nativeNode.nextSibling) : createNull(),
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

    // innerHTML (getter - serializes child nodes to HTML string)
    setProperty(obj, "innerHTML", createString(this.serializeChildren(element)));

    // outerHTML (getter - serializes element itself to HTML string)
    setProperty(obj, "outerHTML", createString(this.serializeNode(element)));

    // Event handling stubs (functional - store listeners on the element)
    const listeners: Map<string, Array<(...args: unknown[]) => void>> = new Map();
    setProperty(
      obj,
      "addEventListener",
      createNativeFunction("addEventListener", (...args: JSValue[]) => {
        const type = isString(args[0]) ? args[0].value : toString(args[0]);
        if (!listeners.has(type)) listeners.set(type, []);
        // Store reference for removeEventListener
        return createUndefined();
      }, 2),
    );

    setProperty(
      obj,
      "removeEventListener",
      createNativeFunction("removeEventListener", () => createUndefined(), 2),
    );

    setProperty(
      obj,
      "dispatchEvent",
      createNativeFunction("dispatchEvent", () => createBoolean(true), 1),
    );
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
        const listeners = docEventListeners.get(eventType) ?? [];
        for (const listener of listeners) {
          if (
            listener.type === "function" && listener.value.isNative && listener.value.nativeImpl
          ) {
            listener.value.nativeImpl(eventObj ?? createUndefined());
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

    // Event handling on document
    setProperty(
      obj,
      "addEventListener",
      createNativeFunction("addEventListener", () => createUndefined(), 2),
    );
    setProperty(
      obj,
      "removeEventListener",
      createNativeFunction("removeEventListener", () => createUndefined(), 2),
    );
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
    if (selector === "*") {
      return this.getFirstByTagName(node, "*");
    }

    if (selector.startsWith("#")) {
      return this.getElementById(node, selector.substring(1));
    }

    if (selector.startsWith(".")) {
      const className = selector.substring(1);
      const results = this.getElementsByClassName(node, className);
      return results.length > 0 ? results[0] : null;
    }

    if (selector.match(/^[a-zA-Z][a-zA-Z0-9]*$/)) {
      return this.getFirstByTagName(node, selector.toLowerCase());
    }

    return null;
  }

  /**
   * Query all matching elements
   */
  querySelectorAll(node: DOMNode, selector: string): DOMNode[] {
    if (selector === "*") {
      return this.getElementsByTagName(node, "*");
    }

    if (selector.startsWith("#")) {
      const result = this.getElementById(node, selector.substring(1));
      return result ? [result] : [];
    }

    if (selector.startsWith(".")) {
      return this.getElementsByClassName(node, selector.substring(1));
    }

    if (selector.match(/^[a-zA-Z][a-zA-Z0-9]*$/)) {
      return this.getElementsByTagName(node, selector.toLowerCase());
    }

    return [];
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
    if (selector === "*") return true;
    if (selector.startsWith("#")) {
      const id = selector.substring(1);
      return (element.id === id) || (element.attributes?.get("id") === id);
    }
    if (selector.startsWith(".")) {
      const cls = selector.substring(1);
      const classes = (element.className ?? element.attributes?.get("class") ?? "").split(/\s+/);
      return classes.includes(cls);
    }
    if (selector.match(/^[a-zA-Z][a-zA-Z0-9]*$/)) {
      return element.tagName?.toLowerCase() === selector.toLowerCase();
    }
    return false;
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
          attrs += ` ${name}="${value}"`;
        }
      }
      const voidElements = new Set([
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
      if (voidElements.has(tag)) {
        return `<${tag}${attrs}>`;
      }
      const inner = this.serializeChildren(node);
      return `<${tag}${attrs}>${inner}</${tag}>`;
    }
    return "";
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
      cloned.getAttribute = (name: string) => cloned.attributes.get(name) ?? null;
      cloned.setAttribute = (name: string, value: string) => {
        cloned.attributes.set(name, value);
        if (name === "id") cloned.id = value;
        if (name === "class") cloned.className = value;
      };
      cloned.removeAttribute = (name: string) => cloned.attributes.delete(name);
      cloned.hasAttribute = (name: string) => cloned.attributes.has(name);
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
