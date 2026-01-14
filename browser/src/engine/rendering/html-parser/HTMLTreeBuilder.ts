/**
 * HTML Tree Builder
 * Constructs DOM tree from HTML tokens using insertion modes.
 * Implements the HTML5 tree construction algorithm.
 */

import { HTMLToken, HTMLTokenType } from "./HTMLTokenizer.ts";
import type { DOMDocument, DOMElement, DOMNode, DOMNodeType } from "../../../types/dom.ts";
import type { NodeID } from "../../../types/identifiers.ts";

// Type aliases for internal use
type Token = HTMLToken;
const TokenType = HTMLTokenType;

export enum InsertionMode {
    INITIAL,
    BEFORE_HTML,
    BEFORE_HEAD,
    IN_HEAD,
    IN_HEAD_NOSCRIPT,
    AFTER_HEAD,
    IN_BODY,
    TEXT,
    IN_TABLE,
    IN_TABLE_TEXT,
    IN_CAPTION,
    IN_COLUMN_GROUP,
    IN_TABLE_BODY,
    IN_ROW,
    IN_CELL,
    IN_SELECT,
    IN_SELECT_IN_TABLE,
    AFTER_BODY,
    IN_FRAMESET,
    AFTER_FRAMESET,
    AFTER_AFTER_BODY,
    AFTER_AFTER_FRAMESET,
    IN_TEMPLATE,
}

/**
 * Simplified DOM Node for tree construction
 */
class SimpleDOMNode {
    nodeId: NodeID;
    nodeType: number;
    nodeName: string;
    nodeValue: string | null = null;
    tagName?: string;
    attributes?: Map<string, string>;
    parentNode: SimpleDOMNode | null = null;
    childNodes: SimpleDOMNode[] = [];
    firstChild: SimpleDOMNode | null = null;
    lastChild: SimpleDOMNode | null = null;
    previousSibling: SimpleDOMNode | null = null;
    nextSibling: SimpleDOMNode | null = null;

    constructor(nodeType: number, nodeName: string, nodeId: NodeID) {
        this.nodeType = nodeType;
        this.nodeName = nodeName;
        this.nodeId = nodeId;
    }

    appendChild(child: SimpleDOMNode): SimpleDOMNode {
        child.parentNode = this;

        if (this.childNodes.length > 0) {
            const lastChild = this.childNodes[this.childNodes.length - 1];
            lastChild.nextSibling = child;
            child.previousSibling = lastChild;
        } else {
            this.firstChild = child;
        }

        this.childNodes.push(child);
        this.lastChild = child;

        return child;
    }

    removeChild(child: SimpleDOMNode): SimpleDOMNode {
        const index = this.childNodes.indexOf(child);
        if (index === -1) {
            throw new Error("Node not found");
        }

        this.childNodes.splice(index, 1);
        child.parentNode = null;

        if (child.previousSibling) {
            child.previousSibling.nextSibling = child.nextSibling;
        } else {
            this.firstChild = child.nextSibling;
        }

        if (child.nextSibling) {
            child.nextSibling.previousSibling = child.previousSibling;
        } else {
            this.lastChild = child.previousSibling;
        }

        child.previousSibling = null;
        child.nextSibling = null;

        return child;
    }

    insertBefore(newNode: SimpleDOMNode, referenceNode: SimpleDOMNode | null): SimpleDOMNode {
        if (!referenceNode) {
            return this.appendChild(newNode);
        }

        const index = this.childNodes.indexOf(referenceNode);
        if (index === -1) {
            throw new Error("Reference node not found");
        }

        newNode.parentNode = this;
        this.childNodes.splice(index, 0, newNode);

        newNode.nextSibling = referenceNode;
        newNode.previousSibling = referenceNode.previousSibling;

        if (referenceNode.previousSibling) {
            referenceNode.previousSibling.nextSibling = newNode;
        } else {
            this.firstChild = newNode;
        }

        referenceNode.previousSibling = newNode;

        return newNode;
    }
}

export class HTMLTreeBuilder {
    private insertionMode: InsertionMode = InsertionMode.INITIAL;
    private document: SimpleDOMNode | null = null;
    private openElements: SimpleDOMNode[] = [];
    private currentNode: SimpleDOMNode | null = null;
    private nextNodeId: number = 1;
    private head: SimpleDOMNode | null = null;
    private formElement: SimpleDOMNode | null = null;
    private scriptingEnabled: boolean = true;
    private framesetOk: boolean = true;

    /**
     * Build DOM tree from tokens
     */
    build(tokens: Token[]): any {
        // Create document
        this.document = this.createNode(9, "#document"); // DOCUMENT type
        this.insertionMode = InsertionMode.INITIAL;
        this.openElements = [];
        this.currentNode = this.document;

        // Process tokens
        for (const token of tokens) {
            this.processToken(token);
        }

        return this.document;
    }

    /**
     * Process a single token
     */
    private processToken(token: Token): void {
        switch (this.insertionMode) {
            case InsertionMode.INITIAL:
                this.handleInitialMode(token);
                break;
            case InsertionMode.BEFORE_HTML:
                this.handleBeforeHtmlMode(token);
                break;
            case InsertionMode.BEFORE_HEAD:
                this.handleBeforeHeadMode(token);
                break;
            case InsertionMode.IN_HEAD:
                this.handleInHeadMode(token);
                break;
            case InsertionMode.AFTER_HEAD:
                this.handleAfterHeadMode(token);
                break;
            case InsertionMode.IN_BODY:
                this.handleInBodyMode(token);
                break;
            case InsertionMode.TEXT:
                this.handleTextMode(token);
                break;
            case InsertionMode.AFTER_BODY:
                this.handleAfterBodyMode(token);
                break;
            case InsertionMode.AFTER_AFTER_BODY:
                this.handleAfterAfterBodyMode(token);
                break;
            default:
                // Handle other modes with basic insertion
                this.handleDefaultMode(token);
        }
    }

    /**
     * INITIAL mode
     */
    private handleInitialMode(token: Token): void {
        if (token.type === TokenType.CHARACTER && this.isWhitespace(token.data || "")) {
            // Ignore whitespace
            return;
        }

        if (token.type === TokenType.DOCTYPE) {
            // Insert doctype (simplified)
            const doctype = this.createNode(10, token.data || "html"); // DOCUMENT_TYPE
            this.document!.appendChild(doctype);
            this.insertionMode = InsertionMode.BEFORE_HTML;
            return;
        }

        // Anything else: switch to BEFORE_HTML
        this.insertionMode = InsertionMode.BEFORE_HTML;
        this.processToken(token);
    }

    /**
     * BEFORE_HTML mode
     */
    private handleBeforeHtmlMode(token: Token): void {
        if (token.type === TokenType.START_TAG && token.tagName === "html") {
            const html = this.createElement("html", token.attributes);
            this.document!.appendChild(html);
            this.openElements.push(html);
            this.insertionMode = InsertionMode.BEFORE_HEAD;
            return;
        }

        if (token.type === TokenType.END_TAG) {
            // Ignore end tags except html, head, body, br
            if (["html", "head", "body", "br"].includes(token.tagName || "")) {
                // Create implicit html element
                const html = this.createElement("html");
                this.document!.appendChild(html);
                this.openElements.push(html);
                this.insertionMode = InsertionMode.BEFORE_HEAD;
                this.processToken(token);
            }
            return;
        }

        // Anything else: create implicit html element
        const html = this.createElement("html");
        this.document!.appendChild(html);
        this.openElements.push(html);
        this.insertionMode = InsertionMode.BEFORE_HEAD;
        this.processToken(token);
    }

    /**
     * BEFORE_HEAD mode
     */
    private handleBeforeHeadMode(token: Token): void {
        if (token.type === TokenType.CHARACTER && this.isWhitespace(token.data || "")) {
            // Ignore whitespace
            return;
        }

        if (token.type === TokenType.START_TAG && token.tagName === "head") {
            const head = this.createElement("head", token.attributes);
            this.getCurrentNode().appendChild(head);
            this.openElements.push(head);
            this.head = head;
            this.insertionMode = InsertionMode.IN_HEAD;
            return;
        }

        // Anything else: create implicit head element
        const head = this.createElement("head");
        this.getCurrentNode().appendChild(head);
        this.openElements.push(head);
        this.head = head;
        this.insertionMode = InsertionMode.IN_HEAD;
        this.processToken(token);
    }

    /**
     * IN_HEAD mode
     */
    private handleInHeadMode(token: Token): void {
        if (token.type === TokenType.CHARACTER && this.isWhitespace(token.data || "")) {
            this.insertCharacter(token.data || "");
            return;
        }

        if (token.type === TokenType.START_TAG) {
            const tagName = token.tagName || "";

            if (["meta", "link", "base"].includes(tagName)) {
                this.insertElement(tagName, token.attributes);
                this.openElements.pop(); // Self-closing
                return;
            }

            if (tagName === "title") {
                this.insertElement(tagName, token.attributes);
                this.insertionMode = InsertionMode.TEXT;
                return;
            }

            if (tagName === "script" || tagName === "style") {
                this.insertElement(tagName, token.attributes);
                this.insertionMode = InsertionMode.TEXT;
                return;
            }

            if (tagName === "head") {
                // Ignore
                return;
            }
        }

        if (token.type === TokenType.END_TAG && token.tagName === "head") {
            this.openElements.pop();
            this.insertionMode = InsertionMode.AFTER_HEAD;
            return;
        }

        // Anything else: act as if we saw end tag "head"
        this.openElements.pop();
        this.insertionMode = InsertionMode.AFTER_HEAD;
        this.processToken(token);
    }

    /**
     * AFTER_HEAD mode
     */
    private handleAfterHeadMode(token: Token): void {
        if (token.type === TokenType.CHARACTER && this.isWhitespace(token.data || "")) {
            this.insertCharacter(token.data || "");
            return;
        }

        if (token.type === TokenType.START_TAG && token.tagName === "body") {
            const body = this.createElement("body", token.attributes);
            this.getCurrentNode().appendChild(body);
            this.openElements.push(body);
            this.insertionMode = InsertionMode.IN_BODY;
            this.framesetOk = false;
            return;
        }

        // Anything else: create implicit body element
        const body = this.createElement("body");
        this.getCurrentNode().appendChild(body);
        this.openElements.push(body);
        this.insertionMode = InsertionMode.IN_BODY;
        this.processToken(token);
    }

    /**
     * IN_BODY mode
     */
    private handleInBodyMode(token: Token): void {
        if (token.type === TokenType.CHARACTER) {
            this.insertCharacter(token.data || "");
            return;
        }

        if (token.type === TokenType.COMMENT) {
            this.insertComment(token.data || "");
            return;
        }

        if (token.type === TokenType.START_TAG) {
            const tagName = token.tagName || "";

            // Void elements
            if (["br", "img", "hr", "input", "meta", "link"].includes(tagName)) {
                this.insertElement(tagName, token.attributes);
                this.openElements.pop();
                return;
            }

            // Normal elements
            this.insertElement(tagName, token.attributes);
            return;
        }

        if (token.type === TokenType.END_TAG) {
            const tagName = token.tagName || "";

            if (tagName === "body") {
                this.insertionMode = InsertionMode.AFTER_BODY;
                return;
            }

            if (tagName === "html") {
                this.insertionMode = InsertionMode.AFTER_BODY;
                this.processToken(token);
                return;
            }

            // Close matching open element
            for (let i = this.openElements.length - 1; i >= 0; i--) {
                if (this.openElements[i].tagName === tagName) {
                    this.openElements.splice(i);
                    break;
                }
            }
            return;
        }

        if (token.type === TokenType.EOF) {
            // Stop parsing
            return;
        }
    }

    /**
     * TEXT mode - for script/style/title content
     */
    private handleTextMode(token: Token): void {
        if (token.type === TokenType.CHARACTER) {
            this.insertCharacter(token.data || "");
            return;
        }

        if (token.type === TokenType.END_TAG) {
            this.openElements.pop();
            this.insertionMode = InsertionMode.IN_HEAD;
            return;
        }

        if (token.type === TokenType.EOF) {
            this.openElements.pop();
            this.insertionMode = InsertionMode.IN_HEAD;
            return;
        }
    }

    /**
     * AFTER_BODY mode
     */
    private handleAfterBodyMode(token: Token): void {
        if (token.type === TokenType.CHARACTER && this.isWhitespace(token.data || "")) {
            // Process using IN_BODY rules
            this.handleInBodyMode(token);
            return;
        }

        if (token.type === TokenType.END_TAG && token.tagName === "html") {
            this.insertionMode = InsertionMode.AFTER_AFTER_BODY;
            return;
        }

        if (token.type === TokenType.EOF) {
            // Stop parsing
            return;
        }

        // Reprocess in IN_BODY mode
        this.insertionMode = InsertionMode.IN_BODY;
        this.processToken(token);
    }

    /**
     * AFTER_AFTER_BODY mode
     */
    private handleAfterAfterBodyMode(token: Token): void {
        if (token.type === TokenType.EOF) {
            // Stop parsing
            return;
        }

        // Reprocess in IN_BODY mode
        this.insertionMode = InsertionMode.IN_BODY;
        this.processToken(token);
    }

    /**
     * Default mode handler
     */
    private handleDefaultMode(token: Token): void {
        if (token.type === TokenType.CHARACTER) {
            this.insertCharacter(token.data || "");
        } else if (token.type === TokenType.START_TAG) {
            this.insertElement(token.tagName || "", token.attributes);
        } else if (token.type === TokenType.END_TAG) {
            // Pop matching element
            const tagName = token.tagName || "";
            for (let i = this.openElements.length - 1; i >= 0; i--) {
                if (this.openElements[i].tagName === tagName) {
                    this.openElements.splice(i);
                    break;
                }
            }
        }
    }

    /**
     * Insert element
     */
    private insertElement(tagName: string, attributes?: Map<string, string>): SimpleDOMNode {
        const element = this.createElement(tagName, attributes);
        this.getCurrentNode().appendChild(element);
        this.openElements.push(element);
        return element;
    }

    /**
     * Insert character
     */
    private insertCharacter(data: string): void {
        const currentNode = this.getCurrentNode();
        const lastChild = currentNode.lastChild;

        // Coalesce adjacent text nodes
        if (lastChild && lastChild.nodeType === 3) { // TEXT_NODE
            lastChild.nodeValue = (lastChild.nodeValue || "") + data;
        } else {
            const textNode = this.createNode(3, "#text"); // TEXT_NODE
            textNode.nodeValue = data;
            currentNode.appendChild(textNode);
        }
    }

    /**
     * Insert comment
     */
    private insertComment(data: string): void {
        const comment = this.createNode(8, "#comment"); // COMMENT_NODE
        comment.nodeValue = data;
        this.getCurrentNode().appendChild(comment);
    }

    /**
     * Create element node
     */
    private createElement(tagName: string, attributes?: Map<string, string>): SimpleDOMNode {
        const element = this.createNode(1, tagName.toUpperCase()); // ELEMENT_NODE
        element.tagName = tagName;
        element.attributes = attributes || new Map();
        return element;
    }

    /**
     * Create node
     */
    private createNode(nodeType: number, nodeName: string): SimpleDOMNode {
        return new SimpleDOMNode(nodeType, nodeName, this.nextNodeId++ as NodeID);
    }

    /**
     * Get current node
     */
    private getCurrentNode(): SimpleDOMNode {
        if (this.openElements.length > 0) {
            return this.openElements[this.openElements.length - 1];
        }
        return this.document!;
    }

    /**
     * Check if string is whitespace
     */
    private isWhitespace(str: string): boolean {
        return /^[\s\n\r\t\f]*$/.test(str);
    }
}
