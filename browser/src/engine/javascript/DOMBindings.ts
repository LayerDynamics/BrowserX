/**
 * DOM Bindings
 *
 * Provides JavaScript bindings for DOM objects, exposing DOM APIs to JavaScript code.
 * Implements the Web IDL interfaces for Document, Element, Node, etc.
 */

import type { DOMNode } from "../../types/dom.ts";
import { DOMNodeType } from "../../types/dom.ts";
import { V8Context } from "./V8Context.ts";
import {
    createNativeFunction,
    createNull,
    createNumber,
    createObject,
    createString,
    createUndefined,
    type JSValue,
    setProperty,
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
 * DOM Bindings Manager
 * Bridges between native DOM and JavaScript objects
 */
export class DOMBindings {
    private context: V8Context;
    private nodeMap: WeakMap<DOMNode, JSNode> = new WeakMap();
    private reverseMap: WeakMap<JSNode, DOMNode> = new WeakMap();

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
     * Create Node constructor
     */
    private createNodeConstructor(): JSValue {
        // Create the constructor function
        const constructor = createNativeFunction("Node", () => createUndefined(), 0);

        // Create prototype object
        const prototype = createObject(null);

        // Add appendChild method
        setProperty(
            prototype,
            "appendChild",
            createNativeFunction("appendChild", (child: JSValue) => {
                // Note: In real implementation, 'this' would be bound to the node
                return child;
            }, 1),
        );

        // Add removeChild method
        setProperty(
            prototype,
            "removeChild",
            createNativeFunction("removeChild", (child: JSValue) => {
                return child;
            }, 1),
        );

        // Add insertBefore method
        setProperty(
            prototype,
            "insertBefore",
            createNativeFunction("insertBefore", (newNode: JSValue, referenceNode: JSValue) => {
                return newNode;
            }, 2),
        );

        // Set prototype on constructor
        setProperty(constructor, "prototype", prototype);

        return constructor;
    }

    /**
     * Create Element constructor
     */
    private createElementConstructor(): JSValue {
        // Create the constructor function
        const constructor = createNativeFunction("Element", () => createUndefined(), 0);

        // Create prototype object
        const prototype = createObject(null);

        // Add getAttribute method
        setProperty(
            prototype,
            "getAttribute",
            createNativeFunction("getAttribute", (name: JSValue) => {
                // Note: In real implementation, 'this' would be bound to the element
                return createNull();
            }, 1),
        );

        // Add setAttribute method
        setProperty(
            prototype,
            "setAttribute",
            createNativeFunction("setAttribute", (name: JSValue, value: JSValue) => {
                return createUndefined();
            }, 2),
        );

        // Add removeAttribute method
        setProperty(
            prototype,
            "removeAttribute",
            createNativeFunction("removeAttribute", (name: JSValue) => {
                return createUndefined();
            }, 1),
        );

        // Add querySelector method
        setProperty(
            prototype,
            "querySelector",
            createNativeFunction("querySelector", (selector: JSValue) => {
                return createNull();
            }, 1),
        );

        // Set prototype on constructor
        setProperty(constructor, "prototype", prototype);

        return constructor;
    }

    /**
     * Create Document constructor
     */
    private createDocumentConstructor(): JSValue {
        // Create the constructor function
        const constructor = createNativeFunction("Document", () => createUndefined(), 0);

        // Create prototype object
        const prototype = createObject(null);

        // Add getElementById method
        setProperty(
            prototype,
            "getElementById",
            createNativeFunction("getElementById", (id: JSValue) => {
                // Note: In real implementation, 'this' would be bound to the document
                return createNull();
            }, 1),
        );

        // Add createElement method
        setProperty(
            prototype,
            "createElement",
            createNativeFunction("createElement", (tagName: JSValue) => {
                // Note: In real implementation, would create actual element
                return createUndefined();
            }, 1),
        );

        // Add createTextNode method
        setProperty(
            prototype,
            "createTextNode",
            createNativeFunction("createTextNode", (data: JSValue) => {
                // Note: In real implementation, would create actual text node
                return createUndefined();
            }, 1),
        );

        // Set prototype on constructor
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

    /**
     * Create wrapper for native node
     */
    private createNodeWrapper(nativeNode: DOMNode): JSNode {
        // Get textContent - for text nodes use nodeValue, for others compute from children
        let textContent: string | null = null;
        if (nativeNode.nodeType === DOMNodeType.TEXT) {
            textContent = nativeNode.nodeValue;
        }

        const wrapper: JSNode = {
            nodeType: this.getNodeType(nativeNode),
            nodeName: this.getNodeName(nativeNode),
            nodeValue: nativeNode.nodeValue,
            textContent,
            parentNode: null, // Set by parent
            childNodes: (nativeNode.childNodes ?? []).map((child) => this.wrapNode(child)),
            firstChild: null,
            lastChild: null,
            previousSibling: null,
            nextSibling: null,

            appendChild: (child: JSNode) => wrapper.appendChild(child),
            removeChild: (child: JSNode) => wrapper.removeChild(child),
            insertBefore: (newNode: JSNode, ref: JSNode | null) =>
                wrapper.insertBefore(newNode, ref),
            cloneNode: (deep?: boolean) => this.cloneNodeWrapper(wrapper, deep),
            contains: (other: JSNode) => this.containsNode(wrapper, other),
        };

        return wrapper;
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
        if (node.nodeType === 1) {
            const element = node as import("../../types/dom.ts").DOMElement;
            return element.tagName.toUpperCase();
        }
        if (node.nodeType === 3) {
            return "#text";
        }
        if (node.nodeType === 9) {
            return "#document";
        }
        return "";
    }

    /**
     * Query selector (simplified implementation)
     */
    private querySelector(node: DOMNode, selector: string): DOMNode | null {
        // Simplified: only support ID and tag name selectors
        if (selector.startsWith("#")) {
            const id = selector.substring(1);
            return this.getElementById(node, id);
        }

        if (selector.match(/^[a-zA-Z]+$/)) {
            return this.getFirstByTagName(node, selector.toLowerCase());
        }

        return null;
    }

    /**
     * Get element by ID
     */
    private getElementById(node: DOMNode, id: string): DOMNode | null {
        if (node.nodeType === 1) {
            const element = node as import("../../types/dom.ts").DOMElement;
            if (element.attributes?.get("id") === id) {
                return node;
            }
        }

        if (node.childNodes) {
            for (const child of node.childNodes) {
                const result = this.getElementById(child, id);
                if (result) {
                    return result;
                }
            }
        }

        return null;
    }

    /**
     * Get first element by tag name
     */
    private getFirstByTagName(node: DOMNode, tagName: string): DOMNode | null {
        if (node.nodeType === 1) {
            const element = node as import("../../types/dom.ts").DOMElement;
            if (element.tagName === tagName) {
                return node;
            }
        }

        if (node.childNodes) {
            for (const child of node.childNodes) {
                const result = this.getFirstByTagName(child, tagName);
                if (result) {
                    return result;
                }
            }
        }

        return null;
    }

    /**
     * Clone node wrapper
     */
    private cloneNodeWrapper(node: JSNode, deep?: boolean): JSNode {
        const nativeNode = this.unwrapNode(node);
        if (!nativeNode) {
            return node;
        }

        const cloned = this.cloneNativeNode(nativeNode, deep ?? false);
        return this.wrapNode(cloned);
    }

    /**
     * Clone native node
     */
    private cloneNativeNode(node: DOMNode, deep: boolean): any {
        const cloned: any = {
            nodeType: node.nodeType,
            nodeName: node.nodeName,
            nodeValue: node.nodeValue,
            childNodes: deep && node.childNodes
                ? node.childNodes.map((child) => this.cloneNativeNode(child, true))
                : [],
        };

        if (node.nodeType === 1) {
            const element = node as import("../../types/dom.ts").DOMElement;
            cloned.tagName = element.tagName;
            cloned.attributes = element.attributes ? new Map(element.attributes) : undefined;
        }

        return cloned;
    }

    /**
     * Check if node contains another
     */
    private containsNode(parent: JSNode, child: JSNode): boolean {
        for (const node of parent.childNodes) {
            if (node === child) {
                return true;
            }
            if (this.containsNode(node, child)) {
                return true;
            }
        }
        return false;
    }
}
