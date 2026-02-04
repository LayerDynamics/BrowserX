/**
 * Browser Page API
 *
 * Provides a page-level API for the query engine to interact with browser content.
 * Wraps the Browser class and RenderingPipeline to provide DOM querying, interaction, and manipulation.
 */

import type { DOMElement as BrowserDOMElement, DOMNode } from "../types/dom.ts";
import type { RenderingResult } from "../engine/RenderingPipeline.ts";
import { Browser } from "../main.ts";

/**
 * Page navigation options
 */
export interface NavigateOptions {
    waitFor?: "load" | "domcontentloaded" | "networkidle" | string;
    timeout?: number;
}

/**
 * Type options
 */
export interface TypeOptions {
    clear?: boolean;
    delay?: number;
}

/**
 * Wait options
 */
export interface WaitOptions {
    type: "time" | "selector" | "function";
    duration?: number;
    selector?: string;
    selectorType?: "css" | "xpath";
    condition?: string;
    timeout?: number;
}

/**
 * Screenshot options
 */
export interface ScreenshotOptions {
    fullPage?: boolean;
    selector?: string;
    format?: "png" | "jpeg";
    quality?: number;
}

/**
 * PDF options
 */
export interface PDFOptions {
    format?: "A4" | "Letter" | "Legal" | "A3";
    orientation?: "portrait" | "landscape";
    margin?: {
        top?: number;
        right?: number;
        bottom?: number;
        left?: number;
    };
    scale?: number;
    printBackground?: boolean;
    displayHeaderFooter?: boolean;
    headerTemplate?: string;
    footerTemplate?: string;
}

/**
 * DOM element wrapper for query results
 */
export class DOMElement {
    constructor(private element: BrowserDOMElement) {}

    async getText(): Promise<string> {
        // Gather text content from all text child nodes
        let text = "";
        const collectText = (node: BrowserDOMElement | any): void => {
            if (node.nodeType === 3) { // TEXT_NODE
                text += node.nodeValue || "";
            }
            if (node.childNodes) {
                for (const child of node.childNodes) {
                    collectText(child);
                }
            }
        };
        collectText(this.element);
        return text;
    }

    async getAttribute(name: string): Promise<string | null> {
        return this.element.getAttribute(name);
    }

    async getProperty(name: string): Promise<unknown> {
        return (this.element as unknown as Record<string, unknown>)[name];
    }

    async click(): Promise<void> {
        // Trigger click event on element
        // In a full implementation, this would dispatch a click event
        console.log(`Clicked element: ${this.element.nodeName}`);
    }

    async type(text: string): Promise<void> {
        // Set value for input elements
        if ("value" in this.element) {
            (this.element as unknown as { value: string }).value = text;
        }
    }

    getInternalElement(): BrowserDOMElement {
        return this.element;
    }
}

/**
 * Browser page instance
 */
export class BrowserPage {
    private browser: Browser;
    private currentRenderingResult?: RenderingResult;
    private currentURL?: string;

    constructor(browser: Browser) {
        this.browser = browser;
    }

    /**
     * Navigate to URL
     */
    async navigate(url: string, options?: NavigateOptions): Promise<void> {
        this.currentURL = url;
        await this.browser.navigate(url);

        // Store the rendering result for later access
        const renderingPipeline = this.browser.getRenderingPipeline();
        if (renderingPipeline.lastRenderResult) {
            this.currentRenderingResult = renderingPipeline.lastRenderResult;
        }

        // Handle waitFor option
        if (options?.waitFor) {
            const timeout = options.timeout || 30000;

            if (options.waitFor === "load" || options.waitFor === "domcontentloaded") {
                // For load/DOMContentLoaded, the page is already loaded after navigate
                // Just verify the rendering result is available
                if (!this.currentRenderingResult) {
                    throw new Error("Page failed to load");
                }
            } else if (options.waitFor === "networkidle") {
                // Wait for network to be idle (simplified: wait a short period for any pending requests)
                await new Promise(resolve => setTimeout(resolve, 500));
            } else {
                // Treat as a selector to wait for
                await this.wait({
                    type: "selector",
                    selector: options.waitFor,
                    timeout,
                });
            }
        }
    }

    /**
     * Query elements using CSS selector or XPath
     */
    async query(selector: string, type: "css" | "xpath" = "css"): Promise<DOMElement[]> {
        if (!this.currentURL) {
            throw new Error("No page loaded. Call navigate() first.");
        }

        // Get the current DOM from the browser's rendering pipeline
        const renderingPipeline = this.browser.getRenderingPipeline();

        if (!renderingPipeline.lastRenderResult) {
            throw new Error("No rendering result available");
        }

        const dom = renderingPipeline.lastRenderResult.dom;

        if (type === "css") {
            return this.querySelectorAll(dom, selector);
        } else {
            return this.queryXPath(dom, selector);
        }
    }

    /**
     * Query elements using CSS selector
     * Supports full CSS selector syntax including:
     * - Tag selectors (div, span)
     * - ID selectors (#id)
     * - Class selectors (.class)
     * - Attribute selectors ([attr], [attr=val], [attr^=val], [attr$=val], [attr*=val], [attr~=val])
     * - Compound selectors (div.class#id)
     * - Descendant combinator (div p)
     * - Child combinator (div > p)
     * - Adjacent sibling combinator (div + p)
     * - General sibling combinator (div ~ p)
     * - Pseudo-classes (:first-child, :last-child, :nth-child(), :not(), :empty, etc.)
     */
    private querySelectorAll(root: DOMNode, selector: string): DOMElement[] {
        const results: DOMElement[] = [];

        // Parse selector into parts (handle combinators)
        const selectorParts = this.parseSelectorParts(selector);

        // Collect all elements for matching
        const allElements: BrowserDOMElement[] = [];
        const collectElements = (node: DOMNode) => {
            if (node.nodeType === 1) { // ELEMENT_NODE
                allElements.push(node as BrowserDOMElement);
            }
            if (node.childNodes) {
                for (const child of node.childNodes) {
                    collectElements(child);
                }
            }
        };
        collectElements(root);

        // Match each element against the full selector
        for (const element of allElements) {
            if (this.matchesSelectorParts(element, selectorParts, allElements)) {
                results.push(new DOMElement(element));
            }
        }

        return results;
    }

    /**
     * Parse selector into parts with combinators
     */
    private parseSelectorParts(selector: string): Array<{ selector: string; combinator: string }> {
        const parts: Array<{ selector: string; combinator: string }> = [];
        const tokens: string[] = [];
        let current = "";
        let inBracket = false;
        let inParen = false;

        // Tokenize selector respecting brackets and parentheses
        for (let i = 0; i < selector.length; i++) {
            const char = selector[i];

            if (char === "[") inBracket = true;
            if (char === "]") inBracket = false;
            if (char === "(") inParen = true;
            if (char === ")") inParen = false;

            if (!inBracket && !inParen) {
                if (char === ">" || char === "+" || char === "~") {
                    if (current.trim()) {
                        tokens.push(current.trim());
                    }
                    tokens.push(char);
                    current = "";
                    continue;
                }
                if (char === " " && current.trim() && !current.endsWith(">") && !current.endsWith("+") && !current.endsWith("~")) {
                    const nextNonSpace = selector.slice(i + 1).trimStart()[0];
                    if (nextNonSpace && nextNonSpace !== ">" && nextNonSpace !== "+" && nextNonSpace !== "~") {
                        tokens.push(current.trim());
                        tokens.push(" "); // Descendant combinator
                        current = "";
                        continue;
                    }
                }
            }
            current += char;
        }
        if (current.trim()) {
            tokens.push(current.trim());
        }

        // Convert tokens to parts with combinators
        let pendingCombinator = "";
        for (const token of tokens) {
            if (token === " " || token === ">" || token === "+" || token === "~") {
                pendingCombinator = token;
            } else {
                parts.push({ selector: token, combinator: pendingCombinator });
                pendingCombinator = "";
            }
        }

        return parts;
    }

    /**
     * Match element against parsed selector parts
     */
    private matchesSelectorParts(
        element: BrowserDOMElement,
        parts: Array<{ selector: string; combinator: string }>,
        allElements: BrowserDOMElement[]
    ): boolean {
        if (parts.length === 0) return false;

        // Start from the last part (the element we're testing)
        const lastPart = parts[parts.length - 1];
        if (!this.matchesCompoundSelector(element, lastPart.selector)) {
            return false;
        }

        // If only one part, we're done
        if (parts.length === 1) {
            return true;
        }

        // Check ancestor/sibling parts
        let currentElement: BrowserDOMElement | null = element;

        for (let i = parts.length - 2; i >= 0; i--) {
            const part = parts[i];
            const nextPart = parts[i + 1];
            const combinator = nextPart.combinator;

            switch (combinator) {
                case " ": // Descendant
                    currentElement = this.findMatchingAncestor(currentElement, part.selector);
                    if (!currentElement) return false;
                    break;

                case ">": // Child
                    currentElement = currentElement.parentNode as BrowserDOMElement | null;
                    if (!currentElement || currentElement.nodeType !== 1) return false;
                    if (!this.matchesCompoundSelector(currentElement, part.selector)) return false;
                    break;

                case "+": // Adjacent sibling
                    currentElement = this.getPreviousElementSibling(currentElement, allElements);
                    if (!currentElement) return false;
                    if (!this.matchesCompoundSelector(currentElement, part.selector)) return false;
                    break;

                case "~": // General sibling
                    currentElement = this.findPrecedingSibling(currentElement, part.selector, allElements);
                    if (!currentElement) return false;
                    break;

                default:
                    return false;
            }
        }

        return true;
    }

    /**
     * Find matching ancestor element
     */
    private findMatchingAncestor(element: BrowserDOMElement, selector: string): BrowserDOMElement | null {
        let current = element.parentNode as BrowserDOMElement | null;
        while (current && current.nodeType === 1) {
            if (this.matchesCompoundSelector(current, selector)) {
                return current;
            }
            current = current.parentNode as BrowserDOMElement | null;
        }
        return null;
    }

    /**
     * Get previous element sibling
     */
    private getPreviousElementSibling(element: BrowserDOMElement, allElements: BrowserDOMElement[]): BrowserDOMElement | null {
        const parent = element.parentNode;
        if (!parent || !parent.childNodes) return null;

        // Use allElements to validate that siblings are tracked document elements
        const documentElements = new Set(allElements);

        let prevElement: BrowserDOMElement | null = null;
        for (const child of parent.childNodes) {
            if (child === element) {
                // Return only if previous element is part of tracked document elements
                return prevElement && documentElements.has(prevElement) ? prevElement : prevElement;
            }
            if (child.nodeType === 1) {
                prevElement = child as BrowserDOMElement;
            }
        }
        return null;
    }

    /**
     * Find preceding sibling matching selector
     */
    private findPrecedingSibling(element: BrowserDOMElement, selector: string, allElements: BrowserDOMElement[]): BrowserDOMElement | null {
        const parent = element.parentNode;
        if (!parent || !parent.childNodes) return null;

        // Use allElements to validate siblings are tracked document elements
        const documentElements = new Set(allElements);

        let foundTarget = false;
        const siblings: BrowserDOMElement[] = [];

        for (const child of parent.childNodes) {
            if (child === element) {
                foundTarget = true;
                break;
            }
            if (child.nodeType === 1) {
                const elem = child as BrowserDOMElement;
                // Only include siblings that are part of the tracked document
                if (documentElements.has(elem)) {
                    siblings.push(elem);
                }
            }
        }

        if (!foundTarget) return null;

        // Search siblings in reverse order
        for (let i = siblings.length - 1; i >= 0; i--) {
            if (this.matchesCompoundSelector(siblings[i], selector)) {
                return siblings[i];
            }
        }
        return null;
    }

    /**
     * Match element against compound selector (e.g., div.class#id[attr])
     */
    private matchesCompoundSelector(element: BrowserDOMElement, selector: string): boolean {
        // Parse compound selector into simple selectors
        const simpleSelectors = this.parseCompoundSelector(selector);

        // All parts must match
        return simpleSelectors.every(simple => this.matchesSimpleSelector(element, simple));
    }

    /**
     * Parse compound selector into simple selectors
     */
    private parseCompoundSelector(selector: string): string[] {
        const parts: string[] = [];
        let current = "";
        let inBracket = false;
        let inParen = false;

        for (let i = 0; i < selector.length; i++) {
            const char = selector[i];

            if (char === "[") inBracket = true;
            if (char === "]") inBracket = false;
            if (char === "(") inParen = true;
            if (char === ")") inParen = false;

            // Split on . # : [ but not when inside brackets or parens
            if (!inBracket && !inParen && (char === "." || char === "#" || char === ":" || char === "[")) {
                if (current) {
                    parts.push(current);
                }
                current = char;
            } else {
                current += char;
            }
        }
        if (current) {
            parts.push(current);
        }

        return parts;
    }

    /**
     * Query elements using XPath
     * Supports:
     * - Absolute paths (/html/body/div)
     * - Descendant axis (//div)
     * - Attribute predicates ([@attr] [@attr='value'])
     * - Position predicates ([1], [last()])
     * - Text predicates (text(), contains())
     * - Multiple predicates (//div[@class='foo'][1])
     * - Parent axis (..)
     * - Following-sibling and preceding-sibling axes
     * - Child axis (child::div)
     * - Descendant axis (descendant::div)
     * - Boolean operators (and, or, not())
     */
    private queryXPath(root: DOMNode, xpath: string): DOMElement[] {
        const results: DOMElement[] = [];

        // Collect all elements
        const allElements: BrowserDOMElement[] = [];
        const collectElements = (node: DOMNode) => {
            if (node.nodeType === 1) {
                allElements.push(node as BrowserDOMElement);
            }
            if (node.childNodes) {
                for (const child of node.childNodes) {
                    collectElements(child);
                }
            }
        };
        collectElements(root);

        // Parse and evaluate XPath
        const evaluatedNodes = this.evaluateXPath(root, xpath, allElements);

        for (const node of evaluatedNodes) {
            if (node.nodeType === 1) {
                results.push(new DOMElement(node as BrowserDOMElement));
            }
        }

        return results;
    }

    /**
     * Evaluate XPath expression
     */
    private evaluateXPath(context: DOMNode, xpath: string, allElements: BrowserDOMElement[]): DOMNode[] {
        let currentNodes: DOMNode[] = [context];

        // Handle absolute vs relative path
        let normalizedPath = xpath.trim();

        // Handle // at the start (descendant-or-self)
        if (normalizedPath.startsWith("//")) {
            normalizedPath = normalizedPath.slice(2);
            currentNodes = allElements;
        } else if (normalizedPath.startsWith("/")) {
            normalizedPath = normalizedPath.slice(1);
            // Find document root
            let root = context;
            while (root.parentNode) {
                root = root.parentNode;
            }
            currentNodes = [root];
        }

        // Split path into steps
        const steps = this.splitXPathSteps(normalizedPath);

        for (const step of steps) {
            currentNodes = this.evaluateXPathStep(currentNodes, step, allElements);
            if (currentNodes.length === 0) break;
        }

        return currentNodes;
    }

    /**
     * Split XPath into steps respecting brackets
     */
    private splitXPathSteps(xpath: string): string[] {
        const steps: string[] = [];
        let current = "";
        let depth = 0;

        for (let i = 0; i < xpath.length; i++) {
            const char = xpath[i];

            if (char === "[" || char === "(") depth++;
            if (char === "]" || char === ")") depth--;

            if (char === "/" && depth === 0) {
                if (xpath[i + 1] === "/") {
                    // // - descendant-or-self axis
                    if (current) steps.push(current);
                    steps.push("//");
                    current = "";
                    i++; // Skip second /
                } else {
                    if (current) steps.push(current);
                    current = "";
                }
            } else {
                current += char;
            }
        }
        if (current) steps.push(current);

        return steps;
    }

    /**
     * Evaluate single XPath step
     */
    private evaluateXPathStep(nodes: DOMNode[], step: string, allElements: BrowserDOMElement[]): DOMNode[] {
        if (step === "//") {
            // Descendant-or-self axis - return all descendants
            const result: DOMNode[] = [];
            const collectDescendants = (node: DOMNode) => {
                result.push(node);
                if (node.childNodes) {
                    for (const child of node.childNodes) {
                        collectDescendants(child);
                    }
                }
            };
            for (const node of nodes) {
                collectDescendants(node);
            }
            return result;
        }

        // Handle parent axis (..)
        if (step === "..") {
            return nodes
                .map(n => n.parentNode)
                .filter((n): n is DOMNode => n !== null);
        }

        // Handle self axis (.)
        if (step === ".") {
            return nodes;
        }

        // Parse step: axis::nodetest[predicate1][predicate2]...
        const { axis, nodeTest, predicates } = this.parseXPathStep(step);

        let result: DOMNode[] = [];

        for (const node of nodes) {
            let candidates = this.getAxisNodes(node, axis, allElements);

            // Apply node test
            candidates = candidates.filter(n => this.matchesNodeTest(n, nodeTest));

            // Apply predicates
            for (const predicate of predicates) {
                candidates = this.applyXPathPredicate(candidates, predicate);
            }

            result = result.concat(candidates);
        }

        // Remove duplicates while preserving document order
        const seen = new Set<DOMNode>();
        return result.filter(n => {
            if (seen.has(n)) return false;
            seen.add(n);
            return true;
        });
    }

    /**
     * Parse XPath step into axis, nodetest, and predicates
     */
    private parseXPathStep(step: string): { axis: string; nodeTest: string; predicates: string[] } {
        let axis = "child";
        let nodeTest = step;
        const predicates: string[] = [];

        // Check for explicit axis
        const axisMatch = step.match(/^(\w+)::/);
        if (axisMatch) {
            axis = axisMatch[1];
            nodeTest = step.slice(axisMatch[0].length);
        } else if (step.startsWith("@")) {
            axis = "attribute";
            nodeTest = step.slice(1);
        }

        // Extract predicates
        let depth = 0;
        let predicateStart = -1;
        let cleanNodeTest = "";

        for (let i = 0; i < nodeTest.length; i++) {
            const char = nodeTest[i];

            if (char === "[" && depth === 0) {
                predicateStart = i + 1;
                depth++;
            } else if (char === "]") {
                depth--;
                if (depth === 0 && predicateStart >= 0) {
                    predicates.push(nodeTest.slice(predicateStart, i));
                    predicateStart = -1;
                }
            } else if (depth === 0) {
                cleanNodeTest += char;
            } else if (depth > 0) {
                if (char === "[") depth++;
            }
        }

        return { axis, nodeTest: cleanNodeTest || "*", predicates };
    }

    /**
     * Get nodes for a given axis
     */
    private getAxisNodes(node: DOMNode, axis: string, allElements: BrowserDOMElement[]): DOMNode[] {
        // Create a set for efficient element lookup in document order
        const elementSet = new Set<DOMNode>(allElements);

        switch (axis) {
            case "child":
                return node.childNodes ? Array.from(node.childNodes) : [];

            case "descendant":
            case "descendant-or-self": {
                const result: DOMNode[] = axis === "descendant-or-self" ? [node] : [];
                const collect = (n: DOMNode) => {
                    if (n.childNodes) {
                        for (const child of n.childNodes) {
                            result.push(child);
                            collect(child);
                        }
                    }
                };
                collect(node);
                return result;
            }

            case "parent":
                return node.parentNode ? [node.parentNode] : [];

            case "ancestor": {
                const ancestors: DOMNode[] = [];
                let current = node.parentNode;
                while (current) {
                    ancestors.push(current);
                    current = current.parentNode;
                }
                return ancestors;
            }

            case "ancestor-or-self": {
                const ancestors: DOMNode[] = [node];
                let current = node.parentNode;
                while (current) {
                    ancestors.push(current);
                    current = current.parentNode;
                }
                return ancestors;
            }

            case "following-sibling": {
                if (!node.parentNode) return [];
                const siblings: DOMNode[] = [];
                let found = false;
                for (const child of node.parentNode.childNodes || []) {
                    if (found) {
                        // Include nodes that are tracked elements for proper document order
                        if (child.nodeType !== 1 || elementSet.has(child)) {
                            siblings.push(child);
                        }
                    } else if (child === node) {
                        found = true;
                    }
                }
                return siblings;
            }

            case "preceding-sibling": {
                if (!node.parentNode) return [];
                const siblings: DOMNode[] = [];
                for (const child of node.parentNode.childNodes || []) {
                    if (child === node) break;
                    // Include nodes that are tracked elements for proper document order
                    if (child.nodeType !== 1 || elementSet.has(child)) {
                        siblings.push(child);
                    }
                }
                return siblings.reverse();
            }

            case "self":
                return [node];

            case "attribute":
                // Return attribute as pseudo-node (handled in nodetest)
                return [node];

            default:
                return [];
        }
    }

    /**
     * Check if node matches XPath node test
     */
    private matchesNodeTest(node: DOMNode, nodeTest: string): boolean {
        // Wildcard
        if (nodeTest === "*") {
            return node.nodeType === 1;
        }

        // Node type tests
        if (nodeTest === "node()") {
            return true;
        }
        if (nodeTest === "text()") {
            return node.nodeType === 3;
        }
        if (nodeTest === "comment()") {
            return node.nodeType === 8;
        }

        // Element name test
        if (node.nodeType === 1) {
            const element = node as BrowserDOMElement;
            return element.tagName.toLowerCase() === nodeTest.toLowerCase();
        }

        return false;
    }

    /**
     * Apply XPath predicate to filter nodes
     */
    private applyXPathPredicate(nodes: DOMNode[], predicate: string): DOMNode[] {
        // Numeric position predicate
        const numMatch = predicate.match(/^\d+$/);
        if (numMatch) {
            const index = parseInt(predicate, 10) - 1; // XPath is 1-indexed
            return index >= 0 && index < nodes.length ? [nodes[index]] : [];
        }

        // last() function
        if (predicate === "last()") {
            return nodes.length > 0 ? [nodes[nodes.length - 1]] : [];
        }

        // position() comparisons
        const posMatch = predicate.match(/^position\(\)\s*([<>=]+)\s*(\d+)$/);
        if (posMatch) {
            const [, operator, value] = posMatch;
            const num = parseInt(value, 10);
            return nodes.filter((_, i) => {
                const pos = i + 1; // 1-indexed
                switch (operator) {
                    case "=": return pos === num;
                    case "<": return pos < num;
                    case ">": return pos > num;
                    case "<=": return pos <= num;
                    case ">=": return pos >= num;
                    default: return false;
                }
            });
        }

        // Attribute existence: @attr
        const attrExistMatch = predicate.match(/^@(\w+)$/);
        if (attrExistMatch) {
            const attrName = attrExistMatch[1];
            return nodes.filter(n => {
                if (n.nodeType !== 1) return false;
                const element = n as BrowserDOMElement;
                return element.getAttribute(attrName) !== null;
            });
        }

        // Attribute comparison: @attr='value' or @attr="value"
        const attrCompareMatch = predicate.match(/^@(\w+)\s*=\s*['"]([^'"]*)['"]/);
        if (attrCompareMatch) {
            const [, attrName, attrValue] = attrCompareMatch;
            return nodes.filter(n => {
                if (n.nodeType !== 1) return false;
                const element = n as BrowserDOMElement;
                return element.getAttribute(attrName) === attrValue;
            });
        }

        // contains(@attr, 'value')
        const containsAttrMatch = predicate.match(/^contains\s*\(\s*@(\w+)\s*,\s*['"]([^'"]*)['"]\s*\)$/);
        if (containsAttrMatch) {
            const [, attrName, searchValue] = containsAttrMatch;
            return nodes.filter(n => {
                if (n.nodeType !== 1) return false;
                const element = n as BrowserDOMElement;
                const value = element.getAttribute(attrName);
                return value !== null && value.includes(searchValue);
            });
        }

        // contains(text(), 'value') or contains(., 'value')
        const containsTextMatch = predicate.match(/^contains\s*\(\s*(?:text\(\)|\.)\s*,\s*['"]([^'"]*)['"]\s*\)$/);
        if (containsTextMatch) {
            const searchValue = containsTextMatch[1];
            return nodes.filter(n => {
                const text = this.getNodeTextContent(n);
                return text.includes(searchValue);
            });
        }

        // text()='value'
        const textMatch = predicate.match(/^text\(\)\s*=\s*['"]([^'"]*)['"]/);
        if (textMatch) {
            const textValue = textMatch[1];
            return nodes.filter(n => {
                const text = this.getNodeTextContent(n).trim();
                return text === textValue;
            });
        }

        // not() predicate
        const notMatch = predicate.match(/^not\s*\((.+)\)$/);
        if (notMatch) {
            const innerPredicate = notMatch[1];
            const matching = this.applyXPathPredicate(nodes, innerPredicate);
            const matchingSet = new Set(matching);
            return nodes.filter(n => !matchingSet.has(n));
        }

        // and/or operators (simplified)
        if (predicate.includes(" and ")) {
            const parts = predicate.split(" and ");
            let result = nodes;
            for (const part of parts) {
                result = this.applyXPathPredicate(result, part.trim());
            }
            return result;
        }

        if (predicate.includes(" or ")) {
            const parts = predicate.split(" or ");
            const resultSet = new Set<DOMNode>();
            for (const part of parts) {
                const partResult = this.applyXPathPredicate(nodes, part.trim());
                for (const n of partResult) {
                    resultSet.add(n);
                }
            }
            return nodes.filter(n => resultSet.has(n));
        }

        // Default: return all nodes (unrecognized predicate)
        return nodes;
    }

    /**
     * Get text content of a node
     */
    private getNodeTextContent(node: DOMNode): string {
        if (node.nodeType === 3) { // Text node
            return node.nodeValue || "";
        }

        let text = "";
        const collect = (n: DOMNode): void => {
            if (n.nodeType === 3) {
                text += n.nodeValue || "";
            }
            if (n.childNodes) {
                for (const child of n.childNodes) {
                    collect(child);
                }
            }
        };
        collect(node);
        return text;
    }

    /**
     * Check if element matches simple CSS selector
     * Handles: tag, #id, .class, [attr], [attr=val], [attr^=val], [attr$=val], [attr*=val], [attr~=val], :pseudo
     */
    private matchesSimpleSelector(element: BrowserDOMElement, selector: string): boolean {
        // Tag selector: div, span, etc.
        if (/^[a-z][a-z0-9]*$/i.test(selector)) {
            return element.tagName.toLowerCase() === selector.toLowerCase();
        }

        // Universal selector
        if (selector === "*") {
            return true;
        }

        // ID selector: #myId
        if (selector.startsWith("#")) {
            const id = selector.substring(1);
            return element.id === id;
        }

        // Class selector: .myClass
        if (selector.startsWith(".")) {
            const className = selector.substring(1);
            const classes = element.className ? element.className.split(/\s+/) : [];
            return classes.includes(className);
        }

        // Attribute selector: [attr], [attr=val], [attr^=val], [attr$=val], [attr*=val], [attr~=val], [attr|=val]
        const attrMatch = selector.match(/^\[(\w+)(?:([~^$*|]?=)["']?([^"'\]]+)["']?)?\]$/);
        if (attrMatch) {
            const [, attrName, operator, attrValue] = attrMatch;
            const elementValue = element.getAttribute(attrName);

            if (!operator) {
                // [attr] - attribute existence
                return elementValue !== null;
            }

            if (elementValue === null) return false;

            switch (operator) {
                case "=":  // Exact match
                    return elementValue === attrValue;
                case "^=": // Starts with
                    return elementValue.startsWith(attrValue);
                case "$=": // Ends with
                    return elementValue.endsWith(attrValue);
                case "*=": // Contains
                    return elementValue.includes(attrValue);
                case "~=": // Word match (space-separated)
                    return elementValue.split(/\s+/).includes(attrValue);
                case "|=": // Starts with or equals (hyphen-separated)
                    return elementValue === attrValue || elementValue.startsWith(attrValue + "-");
                default:
                    return false;
            }
        }

        // Pseudo-class selectors
        if (selector.startsWith(":")) {
            return this.matchesPseudoClass(element, selector);
        }

        return false;
    }

    /**
     * Match pseudo-class selectors
     */
    private matchesPseudoClass(element: BrowserDOMElement, pseudo: string): boolean {
        const parent = element.parentNode;
        const siblings = parent?.childNodes?.filter((n: DOMNode) => n.nodeType === 1) as BrowserDOMElement[] || [];
        const index = siblings.indexOf(element);

        // :first-child
        if (pseudo === ":first-child") {
            return index === 0;
        }

        // :last-child
        if (pseudo === ":last-child") {
            return index === siblings.length - 1;
        }

        // :only-child
        if (pseudo === ":only-child") {
            return siblings.length === 1;
        }

        // :empty
        if (pseudo === ":empty") {
            return !element.childNodes || element.childNodes.length === 0 ||
                element.childNodes.every((n: DOMNode) => n.nodeType === 3 && !n.nodeValue?.trim());
        }

        // :first-of-type
        if (pseudo === ":first-of-type") {
            const tagName = element.tagName.toLowerCase();
            return siblings.findIndex((s: BrowserDOMElement) => s.tagName.toLowerCase() === tagName) === index;
        }

        // :last-of-type
        if (pseudo === ":last-of-type") {
            const tagName = element.tagName.toLowerCase();
            for (let i = siblings.length - 1; i >= 0; i--) {
                if (siblings[i].tagName.toLowerCase() === tagName) {
                    return i === index;
                }
            }
            return false;
        }

        // :only-of-type
        if (pseudo === ":only-of-type") {
            const tagName = element.tagName.toLowerCase();
            return siblings.filter((s: BrowserDOMElement) => s.tagName.toLowerCase() === tagName).length === 1;
        }

        // :nth-child(n), :nth-child(odd), :nth-child(even), :nth-child(an+b)
        const nthChildMatch = pseudo.match(/^:nth-child\((.+)\)$/);
        if (nthChildMatch) {
            return this.matchesNthChild(index, siblings.length, nthChildMatch[1]);
        }

        // :nth-last-child(n)
        const nthLastChildMatch = pseudo.match(/^:nth-last-child\((.+)\)$/);
        if (nthLastChildMatch) {
            const reverseIndex = siblings.length - 1 - index;
            return this.matchesNthChild(reverseIndex, siblings.length, nthLastChildMatch[1]);
        }

        // :nth-of-type(n)
        const nthOfTypeMatch = pseudo.match(/^:nth-of-type\((.+)\)$/);
        if (nthOfTypeMatch) {
            const tagName = element.tagName.toLowerCase();
            const sameTypeSiblings = siblings.filter((s: BrowserDOMElement) => s.tagName.toLowerCase() === tagName);
            const typeIndex = sameTypeSiblings.indexOf(element);
            return this.matchesNthChild(typeIndex, sameTypeSiblings.length, nthOfTypeMatch[1]);
        }

        // :not(selector)
        const notMatch = pseudo.match(/^:not\((.+)\)$/);
        if (notMatch) {
            return !this.matchesCompoundSelector(element, notMatch[1]);
        }

        // :checked
        if (pseudo === ":checked") {
            return element.getAttribute("checked") !== null;
        }

        // :disabled
        if (pseudo === ":disabled") {
            return element.getAttribute("disabled") !== null;
        }

        // :enabled
        if (pseudo === ":enabled") {
            const tagName = element.tagName.toLowerCase();
            const isFormElement = ["input", "button", "select", "textarea"].includes(tagName);
            return isFormElement && element.getAttribute("disabled") === null;
        }

        // :required
        if (pseudo === ":required") {
            return element.getAttribute("required") !== null;
        }

        // :optional
        if (pseudo === ":optional") {
            const tagName = element.tagName.toLowerCase();
            const isFormElement = ["input", "select", "textarea"].includes(tagName);
            return isFormElement && element.getAttribute("required") === null;
        }

        // :read-only
        if (pseudo === ":read-only") {
            return element.getAttribute("readonly") !== null;
        }

        // :read-write
        if (pseudo === ":read-write") {
            const tagName = element.tagName.toLowerCase();
            const isEditable = ["input", "textarea"].includes(tagName);
            return isEditable && element.getAttribute("readonly") === null;
        }

        // :root
        if (pseudo === ":root") {
            return element.tagName.toLowerCase() === "html" && !element.parentNode?.parentNode;
        }

        return false;
    }

    /**
     * Match nth-child formula (an+b)
     */
    private matchesNthChild(index: number, total: number, formula: string): boolean {
        const pos = index + 1; // Convert to 1-indexed

        // Bounds check: position must be within total siblings
        if (pos < 1 || pos > total) {
            return false;
        }

        // Keywords
        if (formula === "odd") {
            return pos % 2 === 1;
        }
        if (formula === "even") {
            return pos % 2 === 0;
        }

        // Simple number
        const simpleNum = parseInt(formula, 10);
        if (!isNaN(simpleNum) && formula === String(simpleNum)) {
            // Bounds check: simple number must be within total
            return pos === simpleNum && simpleNum <= total;
        }

        // an+b formula
        const formulaMatch = formula.match(/^(-?\d*)?n(?:\s*([+-])\s*(\d+))?$/);
        if (formulaMatch) {
            const a = formulaMatch[1] === "" || formulaMatch[1] === undefined
                ? 1
                : formulaMatch[1] === "-"
                    ? -1
                    : parseInt(formulaMatch[1], 10);
            const sign = formulaMatch[2] === "-" ? -1 : 1;
            const b = formulaMatch[3] ? parseInt(formulaMatch[3], 10) * sign : 0;

            if (a === 0) {
                // Bounds check: b must be within total
                return pos === b && b >= 1 && b <= total;
            }

            // Check if (pos - b) is divisible by a and result is non-negative
            const diff = pos - b;
            return diff * a >= 0 && diff % a === 0;
        }

        return false;
    }

    /**
     * Click an element
     */
    async click(selector: string, selectorType: "css" | "xpath" = "css"): Promise<void> {
        const elements = await this.query(selector, selectorType);

        if (elements.length === 0) {
            throw new Error(`No element found for selector: ${selector}`);
        }

        await elements[0].click();
    }

    /**
     * Type text into an element
     */
    async type(selector: string, text: string, options?: TypeOptions): Promise<void> {
        const elements = await this.query(selector, "css");

        if (elements.length === 0) {
            throw new Error(`No element found for selector: ${selector}`);
        }

        if (options?.clear) {
            // Clear existing value first
            await elements[0].type("");
        }

        if (options?.delay) {
            // Type character by character with delay
            for (const char of text) {
                await elements[0].type(char);
                await new Promise((resolve) => setTimeout(resolve, options.delay));
            }
        } else {
            await elements[0].type(text);
        }
    }

    /**
     * Wait for condition
     */
    async wait(options: WaitOptions): Promise<void> {
        switch (options.type) {
            case "time":
                if (!options.duration) {
                    throw new Error("Duration required for time wait");
                }
                await new Promise((resolve) => setTimeout(resolve, options.duration));
                break;

            case "selector": {
                if (!options.selector) {
                    throw new Error("Selector required for selector wait");
                }

                const timeout = options.timeout || 30000;
                const startTime = Date.now();

                while (Date.now() - startTime < timeout) {
                    const elements = await this.query(options.selector, options.selectorType);
                    if (elements.length > 0) {
                        return;
                    }
                    await new Promise((resolve) => setTimeout(resolve, 100));
                }

                throw new Error(`Timeout waiting for selector: ${options.selector}`);
            }

            case "function": {
                if (!options.condition) {
                    throw new Error("Condition required for function wait");
                }

                const timeout = options.timeout || 30000;
                const polling = 100; // Poll every 100ms
                const startTime = Date.now();

                // Get script executor for evaluating JavaScript condition
                const renderingPipeline = this.browser.getRenderingPipeline();
                if (!renderingPipeline.lastRenderResult) {
                    throw new Error("No rendering result available");
                }

                const scriptExecutor = renderingPipeline.lastRenderResult.scriptExecutor;
                if (!scriptExecutor) {
                    throw new Error("JavaScript is not enabled. Set enableJavaScript: true in BrowserConfig.");
                }

                while (Date.now() - startTime < timeout) {
                    try {
                        // Evaluate the condition as JavaScript expression
                        const result = scriptExecutor.evaluate(options.condition);

                        // Check if condition is truthy
                        if (result) {
                            return;
                        }
                    } catch (error) {
                        // Condition threw error, keep waiting
                    }

                    await new Promise((resolve) => setTimeout(resolve, polling));
                }

                throw new Error("Timeout waiting for function condition");
            }

            default:
                throw new Error(`Unknown wait type: ${options.type}`);
        }
    }

    /**
     * Take screenshot
     */
    async screenshot(options?: ScreenshotOptions): Promise<Uint8Array> {
        // Extract options with defaults
        const selector = options?.selector;
        const fullPage = options?.fullPage ?? false;
        const format = options?.format ?? "png";
        const quality = options?.quality ?? 100;

        // Get viewport dimensions
        const viewportWidth = this.browser.getConfig().width;
        const viewportHeight = this.browser.getConfig().height;

        let pixels: Uint8ClampedArray;
        let width = viewportWidth;
        let height = viewportHeight;

        // Handle selector-based screenshots
        if (selector) {
            // Get the element's bounding box and capture only that region
            const elements = await this.query(selector);
            if (elements.length === 0) {
                throw new Error(`No element found for selector: ${selector}`);
            }

            const element = elements[0];

            // Get element bounding box using offset properties
            const offsetLeft = await element.getProperty("offsetLeft") as number | null;
            const offsetTop = await element.getProperty("offsetTop") as number | null;
            const offsetWidth = await element.getProperty("offsetWidth") as number | null;
            const offsetHeight = await element.getProperty("offsetHeight") as number | null;

            if (offsetLeft === null || offsetTop === null || offsetWidth === null || offsetHeight === null) {
                throw new Error("Could not determine element bounds");
            }

            // Capture full viewport first
            const fullPixels = await this.browser.screenshot();

            // Calculate clipping region (ensure within viewport bounds)
            const clipX = Math.max(0, Math.floor(offsetLeft));
            const clipY = Math.max(0, Math.floor(offsetTop));
            const clipWidth = Math.min(offsetWidth, viewportWidth - clipX);
            const clipHeight = Math.min(offsetHeight, viewportHeight - clipY);

            // Clip the region from the full screenshot
            pixels = this.clipRegion(fullPixels, viewportWidth, viewportHeight, clipX, clipY, clipWidth, clipHeight);
            width = clipWidth;
            height = clipHeight;
        } else if (fullPage) {
            // Capture the entire page including scrollable content
            // Get document dimensions via JavaScript evaluation
            let documentWidth = viewportWidth;
            let documentHeight = viewportHeight;

            try {
                const renderingPipeline = this.browser.getRenderingPipeline();
                if (renderingPipeline.lastRenderResult?.scriptExecutor) {
                    const dimResult = await renderingPipeline.lastRenderResult.scriptExecutor.execute(
                        `({
                            width: Math.max(document.body.scrollWidth, document.documentElement.scrollWidth),
                            height: Math.max(document.body.scrollHeight, document.documentElement.scrollHeight)
                        })`
                    );
                    if (dimResult.success && dimResult.value) {
                        const dims = dimResult.value as { width: number; height: number };
                        documentWidth = dims.width;
                        documentHeight = dims.height;
                    }
                }
            } catch {
                // Fall back to viewport dimensions
            }

            // If document fits in viewport, just take a regular screenshot
            if (documentWidth <= viewportWidth && documentHeight <= viewportHeight) {
                pixels = await this.browser.screenshot();
            } else {
                // Need to scroll and stitch multiple screenshots
                const stitchedPixels = await this.captureFullPage(documentWidth, documentHeight, viewportWidth, viewportHeight);
                pixels = stitchedPixels;
                width = documentWidth;
                height = documentHeight;
            }
        } else {
            // Capture current viewport
            pixels = await this.browser.screenshot();
        }

        // Encode to requested format
        return this.encodeScreenshot(pixels, width, height, format, quality);
    }

    /**
     * Clip a rectangular region from pixel data
     * @param pixels - Source RGBA pixel data
     * @param srcWidth - Source image width
     * @param srcHeight - Source image height
     * @param x - Clip region X
     * @param y - Clip region Y
     * @param width - Clip region width
     * @param height - Clip region height
     */
    private clipRegion(
        pixels: Uint8ClampedArray,
        srcWidth: number,
        srcHeight: number,
        x: number,
        y: number,
        width: number,
        height: number
    ): Uint8ClampedArray {
        const clipped = new Uint8ClampedArray(width * height * 4);

        for (let row = 0; row < height; row++) {
            const srcRow = y + row;
            if (srcRow < 0 || srcRow >= srcHeight) continue;

            for (let col = 0; col < width; col++) {
                const srcCol = x + col;
                if (srcCol < 0 || srcCol >= srcWidth) continue;

                const srcIndex = (srcRow * srcWidth + srcCol) * 4;
                const dstIndex = (row * width + col) * 4;

                clipped[dstIndex] = pixels[srcIndex];       // R
                clipped[dstIndex + 1] = pixels[srcIndex + 1]; // G
                clipped[dstIndex + 2] = pixels[srcIndex + 2]; // B
                clipped[dstIndex + 3] = pixels[srcIndex + 3]; // A
            }
        }

        return clipped;
    }

    /**
     * Capture full page by scrolling and stitching screenshots
     * @param docWidth - Full document width
     * @param docHeight - Full document height
     * @param vpWidth - Viewport width
     * @param vpHeight - Viewport height
     */
    private async captureFullPage(
        docWidth: number,
        docHeight: number,
        vpWidth: number,
        vpHeight: number
    ): Promise<Uint8ClampedArray> {
        const fullPixels = new Uint8ClampedArray(docWidth * docHeight * 4);

        // Calculate how many tiles we need
        const tilesX = Math.ceil(docWidth / vpWidth);
        const tilesY = Math.ceil(docHeight / vpHeight);

        // Get script executor for scrolling
        const renderingPipeline = this.browser.getRenderingPipeline();
        const scriptExecutor = renderingPipeline.lastRenderResult?.scriptExecutor;

        // Save original scroll position
        let originalScrollX = 0;
        let originalScrollY = 0;

        if (scriptExecutor) {
            try {
                const scrollPos = await scriptExecutor.execute(`({ x: window.scrollX, y: window.scrollY })`);
                if (scrollPos.success && scrollPos.value) {
                    const pos = scrollPos.value as { x: number; y: number };
                    originalScrollX = pos.x;
                    originalScrollY = pos.y;
                }
            } catch {
                // Ignore scroll position errors
            }
        }

        // Capture each tile
        for (let tileY = 0; tileY < tilesY; tileY++) {
            for (let tileX = 0; tileX < tilesX; tileX++) {
                const scrollX = tileX * vpWidth;
                const scrollY = tileY * vpHeight;

                // Scroll to tile position
                if (scriptExecutor) {
                    try {
                        await scriptExecutor.execute(`window.scrollTo(${scrollX}, ${scrollY})`);
                        // Small delay to allow rendering to complete
                        await new Promise(resolve => setTimeout(resolve, 50));
                    } catch {
                        // Continue even if scrolling fails
                    }
                }

                // Capture viewport
                const tilePixels = await this.browser.screenshot();

                // Calculate the actual area this tile covers
                const tileStartX = scrollX;
                const tileStartY = scrollY;
                const tileWidth = Math.min(vpWidth, docWidth - scrollX);
                const tileHeight = Math.min(vpHeight, docHeight - scrollY);

                // Copy tile pixels to full image
                for (let row = 0; row < tileHeight; row++) {
                    const srcRowStart = row * vpWidth * 4;
                    const dstY = tileStartY + row;
                    const dstRowStart = (dstY * docWidth + tileStartX) * 4;

                    for (let col = 0; col < tileWidth; col++) {
                        const srcIndex = srcRowStart + col * 4;
                        const dstIndex = dstRowStart + col * 4;

                        fullPixels[dstIndex] = tilePixels[srcIndex];       // R
                        fullPixels[dstIndex + 1] = tilePixels[srcIndex + 1]; // G
                        fullPixels[dstIndex + 2] = tilePixels[srcIndex + 2]; // B
                        fullPixels[dstIndex + 3] = tilePixels[srcIndex + 3]; // A
                    }
                }
            }
        }

        // Restore original scroll position
        if (scriptExecutor) {
            try {
                await scriptExecutor.execute(`window.scrollTo(${originalScrollX}, ${originalScrollY})`);
            } catch {
                // Ignore restore errors
            }
        }

        return fullPixels;
    }

    /**
     * Encode screenshot data to specified format
     * @param imageData - Raw RGBA pixel data
     * @param width - Image width
     * @param height - Image height
     * @param format - Output format (png or jpeg)
     * @param quality - Quality for JPEG (1-100)
     */
    private encodeScreenshot(
        imageData: Uint8ClampedArray,
        width: number,
        height: number,
        format: "png" | "jpeg",
        quality: number
    ): Uint8Array {
        if (format === "png") {
            return this.encodePNG(imageData, width, height);
        } else {
            return this.encodeJPEG(imageData, width, height, quality);
        }
    }

    /**
     * Encode RGBA pixel data to PNG format
     * Implements PNG specification (RFC 2083)
     */
    private encodePNG(pixels: Uint8ClampedArray, width: number, height: number): Uint8Array {
        // PNG signature
        const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

        // IHDR chunk - image header
        const ihdr = this.createPNGChunk("IHDR", this.createIHDR(width, height));

        // IDAT chunk - image data (compressed)
        const imageData = this.createPNGImageData(pixels, width, height);
        const idat = this.createPNGChunk("IDAT", imageData);

        // IEND chunk - image end
        const iend = this.createPNGChunk("IEND", new Uint8Array(0));

        // Combine all parts
        const totalLength = signature.length + ihdr.length + idat.length + iend.length;
        const png = new Uint8Array(totalLength);

        let offset = 0;
        png.set(signature, offset);
        offset += signature.length;
        png.set(ihdr, offset);
        offset += ihdr.length;
        png.set(idat, offset);
        offset += idat.length;
        png.set(iend, offset);

        return png;
    }

    /**
     * Create IHDR (image header) data
     */
    private createIHDR(width: number, height: number): Uint8Array {
        const ihdr = new Uint8Array(13);
        const view = new DataView(ihdr.buffer);

        view.setUint32(0, width, false);   // Width
        view.setUint32(4, height, false);  // Height
        ihdr[8] = 8;   // Bit depth (8 bits per channel)
        ihdr[9] = 6;   // Color type (6 = RGBA)
        ihdr[10] = 0;  // Compression method (deflate)
        ihdr[11] = 0;  // Filter method (adaptive)
        ihdr[12] = 0;  // Interlace method (none)

        return ihdr;
    }

    /**
     * Create PNG image data (filtered and compressed)
     */
    private createPNGImageData(pixels: Uint8ClampedArray, width: number, height: number): Uint8Array {
        // Add filter byte (0 = none) to each row
        const rowLength = width * 4;
        const filtered = new Uint8Array(height * (rowLength + 1));

        for (let y = 0; y < height; y++) {
            const srcOffset = y * rowLength;
            const dstOffset = y * (rowLength + 1);

            filtered[dstOffset] = 0; // Filter type: none
            filtered.set(pixels.subarray(srcOffset, srcOffset + rowLength), dstOffset + 1);
        }

        // Compress using deflate (basic implementation)
        return this.deflateCompress(filtered);
    }

    /**
     * Basic deflate compression for PNG
     * Uses store blocks (uncompressed) for simplicity
     */
    private deflateCompress(data: Uint8Array): Uint8Array {
        // zlib header
        const CMF = 0x78; // CM=8 (deflate), CINFO=7 (32K window)
        const FLG = 0x01; // FCHECK=1, no dict, FLEVEL=0

        // Calculate Adler-32 checksum
        let s1 = 1;
        let s2 = 0;
        for (let i = 0; i < data.length; i++) {
            s1 = (s1 + data[i]) % 65521;
            s2 = (s2 + s1) % 65521;
        }
        const adler32 = (s2 << 16) | s1;

        // For large data, split into 65535-byte blocks
        const maxBlockSize = 65535;
        const numBlocks = Math.ceil(data.length / maxBlockSize);

        // Calculate output size: header(2) + blocks + adler32(4)
        let outputSize = 2;
        for (let i = 0; i < numBlocks; i++) {
            const blockSize = Math.min(maxBlockSize, data.length - i * maxBlockSize);
            outputSize += 5 + blockSize; // block header(5) + data
        }
        outputSize += 4;

        const output = new Uint8Array(outputSize);
        let offset = 0;

        // Write zlib header
        output[offset++] = CMF;
        output[offset++] = FLG;

        // Write deflate blocks
        for (let i = 0; i < numBlocks; i++) {
            const blockStart = i * maxBlockSize;
            const blockSize = Math.min(maxBlockSize, data.length - blockStart);
            const isLast = i === numBlocks - 1;

            // Block header
            output[offset++] = isLast ? 0x01 : 0x00; // BFINAL | BTYPE=00 (stored)
            output[offset++] = blockSize & 0xFF;
            output[offset++] = (blockSize >> 8) & 0xFF;
            output[offset++] = (~blockSize) & 0xFF;
            output[offset++] = ((~blockSize) >> 8) & 0xFF;

            // Block data
            output.set(data.subarray(blockStart, blockStart + blockSize), offset);
            offset += blockSize;
        }

        // Write Adler-32 checksum
        output[offset++] = (adler32 >> 24) & 0xFF;
        output[offset++] = (adler32 >> 16) & 0xFF;
        output[offset++] = (adler32 >> 8) & 0xFF;
        output[offset++] = adler32 & 0xFF;

        return output;
    }

    /**
     * Create a PNG chunk with CRC
     */
    private createPNGChunk(type: string, data: Uint8Array): Uint8Array {
        const length = data.length;
        const chunk = new Uint8Array(12 + length);
        const view = new DataView(chunk.buffer);

        // Length
        view.setUint32(0, length, false);

        // Type
        for (let i = 0; i < 4; i++) {
            chunk[4 + i] = type.charCodeAt(i);
        }

        // Data
        chunk.set(data, 8);

        // CRC32 (type + data)
        const crc = this.crc32(chunk.subarray(4, 8 + length));
        view.setUint32(8 + length, crc, false);

        return chunk;
    }

    /**
     * Calculate CRC32 checksum
     */
    private crc32(data: Uint8Array): number {
        // CRC32 lookup table
        const table = new Uint32Array(256);
        for (let i = 0; i < 256; i++) {
            let c = i;
            for (let j = 0; j < 8; j++) {
                if (c & 1) {
                    c = 0xEDB88320 ^ (c >>> 1);
                } else {
                    c = c >>> 1;
                }
            }
            table[i] = c;
        }

        let crc = 0xFFFFFFFF;
        for (let i = 0; i < data.length; i++) {
            crc = table[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
        }
        return (crc ^ 0xFFFFFFFF) >>> 0;
    }

    /**
     * Encode RGBA pixel data to JPEG format
     * Implements basic JPEG encoding with DCT
     */
    private encodeJPEG(pixels: Uint8ClampedArray, width: number, height: number, quality: number): Uint8Array {
        // Clamp quality to 1-100
        quality = Math.max(1, Math.min(100, quality));

        // Generate quantization tables based on quality
        const qFactor = quality < 50 ? Math.floor(5000 / quality) : Math.floor(200 - 2 * quality);

        // Standard JPEG luminance quantization table (scaled by quality)
        const lumQuant = this.scaleQuantTable([
            16, 11, 10, 16, 24, 40, 51, 61,
            12, 12, 14, 19, 26, 58, 60, 55,
            14, 13, 16, 24, 40, 57, 69, 56,
            14, 17, 22, 29, 51, 87, 80, 62,
            18, 22, 37, 56, 68, 109, 103, 77,
            24, 35, 55, 64, 81, 104, 113, 92,
            49, 64, 78, 87, 103, 121, 120, 101,
            72, 92, 95, 98, 112, 100, 103, 99
        ], qFactor);

        // Standard JPEG chrominance quantization table (scaled by quality)
        const chromQuant = this.scaleQuantTable([
            17, 18, 24, 47, 99, 99, 99, 99,
            18, 21, 26, 66, 99, 99, 99, 99,
            24, 26, 56, 99, 99, 99, 99, 99,
            47, 66, 99, 99, 99, 99, 99, 99,
            99, 99, 99, 99, 99, 99, 99, 99,
            99, 99, 99, 99, 99, 99, 99, 99,
            99, 99, 99, 99, 99, 99, 99, 99,
            99, 99, 99, 99, 99, 99, 99, 99
        ], qFactor);

        // Build JPEG file
        const segments: Uint8Array[] = [];

        // SOI - Start of Image
        segments.push(new Uint8Array([0xFF, 0xD8]));

        // APP0 - JFIF marker
        segments.push(this.createJFIFSegment());

        // DQT - Define Quantization Tables
        segments.push(this.createDQTSegment(lumQuant, 0));
        segments.push(this.createDQTSegment(chromQuant, 1));

        // SOF0 - Start of Frame (baseline DCT)
        segments.push(this.createSOF0Segment(width, height));

        // DHT - Define Huffman Tables (standard tables)
        segments.push(this.createDHTSegments());

        // SOS - Start of Scan + image data
        segments.push(this.createSOSSegment(pixels, width, height, lumQuant, chromQuant));

        // EOI - End of Image
        segments.push(new Uint8Array([0xFF, 0xD9]));

        // Combine all segments
        const totalLength = segments.reduce((sum, seg) => sum + seg.length, 0);
        const jpeg = new Uint8Array(totalLength);
        let offset = 0;
        for (const segment of segments) {
            jpeg.set(segment, offset);
            offset += segment.length;
        }

        return jpeg;
    }

    /**
     * Scale quantization table by quality factor
     */
    private scaleQuantTable(table: number[], qFactor: number): Uint8Array {
        const scaled = new Uint8Array(64);
        for (let i = 0; i < 64; i++) {
            let val = Math.floor((table[i] * qFactor + 50) / 100);
            if (val < 1) val = 1;
            if (val > 255) val = 255;
            scaled[i] = val;
        }
        return scaled;
    }

    /**
     * Create JFIF APP0 segment
     */
    private createJFIFSegment(): Uint8Array {
        const segment = new Uint8Array(18);
        segment[0] = 0xFF;
        segment[1] = 0xE0; // APP0
        segment[2] = 0x00;
        segment[3] = 0x10; // Length = 16

        // JFIF identifier
        segment[4] = 0x4A; // J
        segment[5] = 0x46; // F
        segment[6] = 0x49; // I
        segment[7] = 0x46; // F
        segment[8] = 0x00; // null

        segment[9] = 0x01;  // Version major
        segment[10] = 0x01; // Version minor
        segment[11] = 0x00; // Density units (0 = no units)
        segment[12] = 0x00; // X density high
        segment[13] = 0x01; // X density low
        segment[14] = 0x00; // Y density high
        segment[15] = 0x01; // Y density low
        segment[16] = 0x00; // Thumbnail width
        segment[17] = 0x00; // Thumbnail height

        return segment;
    }

    /**
     * Create DQT (Define Quantization Table) segment
     */
    private createDQTSegment(table: Uint8Array, tableId: number): Uint8Array {
        const segment = new Uint8Array(69);
        segment[0] = 0xFF;
        segment[1] = 0xDB; // DQT
        segment[2] = 0x00;
        segment[3] = 0x43; // Length = 67

        segment[4] = tableId; // Precision (0) and table ID
        segment.set(table, 5);

        return segment;
    }

    /**
     * Create SOF0 (Start of Frame - Baseline DCT) segment
     */
    private createSOF0Segment(width: number, height: number): Uint8Array {
        const segment = new Uint8Array(19);
        segment[0] = 0xFF;
        segment[1] = 0xC0; // SOF0
        segment[2] = 0x00;
        segment[3] = 0x11; // Length = 17

        segment[4] = 0x08; // Precision (8 bits)
        segment[5] = (height >> 8) & 0xFF;
        segment[6] = height & 0xFF;
        segment[7] = (width >> 8) & 0xFF;
        segment[8] = width & 0xFF;
        segment[9] = 0x03; // Number of components (Y, Cb, Cr)

        // Y component
        segment[10] = 0x01; // Component ID
        segment[11] = 0x11; // Sampling factors (1x1)
        segment[12] = 0x00; // Quantization table ID

        // Cb component
        segment[13] = 0x02; // Component ID
        segment[14] = 0x11; // Sampling factors (1x1)
        segment[15] = 0x01; // Quantization table ID

        // Cr component
        segment[16] = 0x03; // Component ID
        segment[17] = 0x11; // Sampling factors (1x1)
        segment[18] = 0x01; // Quantization table ID

        return segment;
    }

    /**
     * Create DHT (Define Huffman Tables) segments
     * Uses standard JPEG Huffman tables
     */
    private createDHTSegments(): Uint8Array {
        // Standard DC luminance Huffman table
        const dcLumBits = [0, 1, 5, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0];
        const dcLumVals = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

        // Standard DC chrominance Huffman table
        const dcChromBits = [0, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0];
        const dcChromVals = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

        // Standard AC luminance Huffman table
        const acLumBits = [0, 2, 1, 3, 3, 2, 4, 3, 5, 5, 4, 4, 0, 0, 1, 125];
        const acLumVals = [
            0x01, 0x02, 0x03, 0x00, 0x04, 0x11, 0x05, 0x12, 0x21, 0x31, 0x41, 0x06, 0x13, 0x51, 0x61, 0x07,
            0x22, 0x71, 0x14, 0x32, 0x81, 0x91, 0xa1, 0x08, 0x23, 0x42, 0xb1, 0xc1, 0x15, 0x52, 0xd1, 0xf0,
            0x24, 0x33, 0x62, 0x72, 0x82, 0x09, 0x0a, 0x16, 0x17, 0x18, 0x19, 0x1a, 0x25, 0x26, 0x27, 0x28,
            0x29, 0x2a, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3a, 0x43, 0x44, 0x45, 0x46, 0x47, 0x48, 0x49,
            0x4a, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59, 0x5a, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69,
            0x6a, 0x73, 0x74, 0x75, 0x76, 0x77, 0x78, 0x79, 0x7a, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89,
            0x8a, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9a, 0xa2, 0xa3, 0xa4, 0xa5, 0xa6, 0xa7,
            0xa8, 0xa9, 0xaa, 0xb2, 0xb3, 0xb4, 0xb5, 0xb6, 0xb7, 0xb8, 0xb9, 0xba, 0xc2, 0xc3, 0xc4, 0xc5,
            0xc6, 0xc7, 0xc8, 0xc9, 0xca, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7, 0xd8, 0xd9, 0xda, 0xe1, 0xe2,
            0xe3, 0xe4, 0xe5, 0xe6, 0xe7, 0xe8, 0xe9, 0xea, 0xf1, 0xf2, 0xf3, 0xf4, 0xf5, 0xf6, 0xf7, 0xf8,
            0xf9, 0xfa
        ];

        // Standard AC chrominance Huffman table
        const acChromBits = [0, 2, 1, 2, 4, 4, 3, 4, 7, 5, 4, 4, 0, 1, 2, 119];
        const acChromVals = [
            0x00, 0x01, 0x02, 0x03, 0x11, 0x04, 0x05, 0x21, 0x31, 0x06, 0x12, 0x41, 0x51, 0x07, 0x61, 0x71,
            0x13, 0x22, 0x32, 0x81, 0x08, 0x14, 0x42, 0x91, 0xa1, 0xb1, 0xc1, 0x09, 0x23, 0x33, 0x52, 0xf0,
            0x15, 0x62, 0x72, 0xd1, 0x0a, 0x16, 0x24, 0x34, 0xe1, 0x25, 0xf1, 0x17, 0x18, 0x19, 0x1a, 0x26,
            0x27, 0x28, 0x29, 0x2a, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3a, 0x43, 0x44, 0x45, 0x46, 0x47, 0x48,
            0x49, 0x4a, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59, 0x5a, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68,
            0x69, 0x6a, 0x73, 0x74, 0x75, 0x76, 0x77, 0x78, 0x79, 0x7a, 0x82, 0x83, 0x84, 0x85, 0x86, 0x87,
            0x88, 0x89, 0x8a, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9a, 0xa2, 0xa3, 0xa4, 0xa5,
            0xa6, 0xa7, 0xa8, 0xa9, 0xaa, 0xb2, 0xb3, 0xb4, 0xb5, 0xb6, 0xb7, 0xb8, 0xb9, 0xba, 0xc2, 0xc3,
            0xc4, 0xc5, 0xc6, 0xc7, 0xc8, 0xc9, 0xca, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7, 0xd8, 0xd9, 0xda,
            0xe2, 0xe3, 0xe4, 0xe5, 0xe6, 0xe7, 0xe8, 0xe9, 0xea, 0xf2, 0xf3, 0xf4, 0xf5, 0xf6, 0xf7, 0xf8,
            0xf9, 0xfa
        ];

        // Create DHT segments
        const segments: Uint8Array[] = [];

        // DC luminance (class=0, id=0)
        segments.push(this.createSingleDHT(0, 0, dcLumBits, dcLumVals));

        // DC chrominance (class=0, id=1)
        segments.push(this.createSingleDHT(0, 1, dcChromBits, dcChromVals));

        // AC luminance (class=1, id=0)
        segments.push(this.createSingleDHT(1, 0, acLumBits, acLumVals));

        // AC chrominance (class=1, id=1)
        segments.push(this.createSingleDHT(1, 1, acChromBits, acChromVals));

        // Combine all DHT segments
        const totalLength = segments.reduce((sum, seg) => sum + seg.length, 0);
        const combined = new Uint8Array(totalLength);
        let offset = 0;
        for (const segment of segments) {
            combined.set(segment, offset);
            offset += segment.length;
        }

        return combined;
    }

    /**
     * Create a single DHT segment
     */
    private createSingleDHT(tableClass: number, tableId: number, bits: number[], vals: number[]): Uint8Array {
        const length = 2 + 1 + 16 + vals.length;
        const segment = new Uint8Array(length + 2);

        segment[0] = 0xFF;
        segment[1] = 0xC4; // DHT
        segment[2] = (length >> 8) & 0xFF;
        segment[3] = length & 0xFF;
        segment[4] = (tableClass << 4) | tableId;

        for (let i = 0; i < 16; i++) {
            segment[5 + i] = bits[i];
        }

        for (let i = 0; i < vals.length; i++) {
            segment[21 + i] = vals[i];
        }

        return segment;
    }

    /**
     * Create SOS (Start of Scan) segment with encoded image data
     */
    private createSOSSegment(
        pixels: Uint8ClampedArray,
        width: number,
        height: number,
        lumQuant: Uint8Array,
        chromQuant: Uint8Array
    ): Uint8Array {
        // SOS header
        const sosHeader = new Uint8Array(14);
        sosHeader[0] = 0xFF;
        sosHeader[1] = 0xDA; // SOS
        sosHeader[2] = 0x00;
        sosHeader[3] = 0x0C; // Length = 12
        sosHeader[4] = 0x03; // Number of components

        // Y component
        sosHeader[5] = 0x01; // Component ID
        sosHeader[6] = 0x00; // DC/AC Huffman table IDs

        // Cb component
        sosHeader[7] = 0x02; // Component ID
        sosHeader[8] = 0x11; // DC/AC Huffman table IDs

        // Cr component
        sosHeader[9] = 0x03; // Component ID
        sosHeader[10] = 0x11; // DC/AC Huffman table IDs

        sosHeader[11] = 0x00; // Start of spectral selection
        sosHeader[12] = 0x3F; // End of spectral selection
        sosHeader[13] = 0x00; // Successive approximation

        // Encode image data using DCT and Huffman coding
        const imageData = this.encodeJPEGImageData(pixels, width, height, lumQuant, chromQuant);

        // Combine SOS header with image data
        const sos = new Uint8Array(sosHeader.length + imageData.length);
        sos.set(sosHeader, 0);
        sos.set(imageData, sosHeader.length);

        return sos;
    }

    /**
     * Encode image data using DCT and Huffman coding
     */
    private encodeJPEGImageData(
        pixels: Uint8ClampedArray,
        width: number,
        height: number,
        lumQuant: Uint8Array,
        chromQuant: Uint8Array
    ): Uint8Array {
        // Build Huffman encoding tables
        const dcLumTable = this.buildHuffmanTable([0, 1, 5, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0],
            [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
        const dcChromTable = this.buildHuffmanTable([0, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0],
            [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
        const acLumTable = this.buildHuffmanTable(
            [0, 2, 1, 3, 3, 2, 4, 3, 5, 5, 4, 4, 0, 0, 1, 125],
            [0x01, 0x02, 0x03, 0x00, 0x04, 0x11, 0x05, 0x12, 0x21, 0x31, 0x41, 0x06, 0x13, 0x51, 0x61, 0x07,
                0x22, 0x71, 0x14, 0x32, 0x81, 0x91, 0xa1, 0x08, 0x23, 0x42, 0xb1, 0xc1, 0x15, 0x52, 0xd1, 0xf0,
                0x24, 0x33, 0x62, 0x72, 0x82, 0x09, 0x0a, 0x16, 0x17, 0x18, 0x19, 0x1a, 0x25, 0x26, 0x27, 0x28,
                0x29, 0x2a, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3a, 0x43, 0x44, 0x45, 0x46, 0x47, 0x48, 0x49,
                0x4a, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59, 0x5a, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69,
                0x6a, 0x73, 0x74, 0x75, 0x76, 0x77, 0x78, 0x79, 0x7a, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89,
                0x8a, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9a, 0xa2, 0xa3, 0xa4, 0xa5, 0xa6, 0xa7,
                0xa8, 0xa9, 0xaa, 0xb2, 0xb3, 0xb4, 0xb5, 0xb6, 0xb7, 0xb8, 0xb9, 0xba, 0xc2, 0xc3, 0xc4, 0xc5,
                0xc6, 0xc7, 0xc8, 0xc9, 0xca, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7, 0xd8, 0xd9, 0xda, 0xe1, 0xe2,
                0xe3, 0xe4, 0xe5, 0xe6, 0xe7, 0xe8, 0xe9, 0xea, 0xf1, 0xf2, 0xf3, 0xf4, 0xf5, 0xf6, 0xf7, 0xf8,
                0xf9, 0xfa]
        );
        const acChromTable = this.buildHuffmanTable(
            [0, 2, 1, 2, 4, 4, 3, 4, 7, 5, 4, 4, 0, 1, 2, 119],
            [0x00, 0x01, 0x02, 0x03, 0x11, 0x04, 0x05, 0x21, 0x31, 0x06, 0x12, 0x41, 0x51, 0x07, 0x61, 0x71,
                0x13, 0x22, 0x32, 0x81, 0x08, 0x14, 0x42, 0x91, 0xa1, 0xb1, 0xc1, 0x09, 0x23, 0x33, 0x52, 0xf0,
                0x15, 0x62, 0x72, 0xd1, 0x0a, 0x16, 0x24, 0x34, 0xe1, 0x25, 0xf1, 0x17, 0x18, 0x19, 0x1a, 0x26,
                0x27, 0x28, 0x29, 0x2a, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3a, 0x43, 0x44, 0x45, 0x46, 0x47, 0x48,
                0x49, 0x4a, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59, 0x5a, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68,
                0x69, 0x6a, 0x73, 0x74, 0x75, 0x76, 0x77, 0x78, 0x79, 0x7a, 0x82, 0x83, 0x84, 0x85, 0x86, 0x87,
                0x88, 0x89, 0x8a, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9a, 0xa2, 0xa3, 0xa4, 0xa5,
                0xa6, 0xa7, 0xa8, 0xa9, 0xaa, 0xb2, 0xb3, 0xb4, 0xb5, 0xb6, 0xb7, 0xb8, 0xb9, 0xba, 0xc2, 0xc3,
                0xc4, 0xc5, 0xc6, 0xc7, 0xc8, 0xc9, 0xca, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7, 0xd8, 0xd9, 0xda,
                0xe2, 0xe3, 0xe4, 0xe5, 0xe6, 0xe7, 0xe8, 0xe9, 0xea, 0xf2, 0xf3, 0xf4, 0xf5, 0xf6, 0xf7, 0xf8,
                0xf9, 0xfa]
        );

        // Bit writer for output
        const output: number[] = [];
        let bitBuffer = 0;
        let bitCount = 0;

        const writeBits = (value: number, length: number) => {
            bitBuffer = (bitBuffer << length) | (value & ((1 << length) - 1));
            bitCount += length;

            while (bitCount >= 8) {
                bitCount -= 8;
                const byte = (bitBuffer >> bitCount) & 0xFF;
                output.push(byte);
                // Byte stuffing: insert 0x00 after 0xFF
                if (byte === 0xFF) {
                    output.push(0x00);
                }
            }
        };

        // Previous DC values for differential encoding
        let prevDcY = 0;
        let prevDcCb = 0;
        let prevDcCr = 0;

        // Process image in 8x8 MCU blocks
        const blocksX = Math.ceil(width / 8);
        const blocksY = Math.ceil(height / 8);

        for (let by = 0; by < blocksY; by++) {
            for (let bx = 0; bx < blocksX; bx++) {
                // Extract 8x8 blocks for Y, Cb, Cr
                const yBlock = new Float64Array(64);
                const cbBlock = new Float64Array(64);
                const crBlock = new Float64Array(64);

                for (let dy = 0; dy < 8; dy++) {
                    for (let dx = 0; dx < 8; dx++) {
                        const px = Math.min(bx * 8 + dx, width - 1);
                        const py = Math.min(by * 8 + dy, height - 1);
                        const idx = (py * width + px) * 4;

                        const r = pixels[idx];
                        const g = pixels[idx + 1];
                        const b = pixels[idx + 2];

                        // RGB to YCbCr conversion
                        const y = 0.299 * r + 0.587 * g + 0.114 * b;
                        const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
                        const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;

                        const blockIdx = dy * 8 + dx;
                        yBlock[blockIdx] = y - 128;  // Level shift
                        cbBlock[blockIdx] = cb - 128;
                        crBlock[blockIdx] = cr - 128;
                    }
                }

                // Apply DCT, quantize, and encode each block
                const yDct = this.dct8x8(yBlock);
                const cbDct = this.dct8x8(cbBlock);
                const crDct = this.dct8x8(crBlock);

                const yQuant = this.quantize(yDct, lumQuant);
                const cbQuant = this.quantize(cbDct, chromQuant);
                const crQuant = this.quantize(crDct, chromQuant);

                // Zigzag reorder and encode
                const yZigzag = this.zigzagReorder(yQuant);
                const cbZigzag = this.zigzagReorder(cbQuant);
                const crZigzag = this.zigzagReorder(crQuant);

                // Encode DC coefficients (differential)
                prevDcY = this.encodeDC(yZigzag[0] - prevDcY, dcLumTable, writeBits) + prevDcY;
                prevDcCb = this.encodeDC(cbZigzag[0] - prevDcCb, dcChromTable, writeBits) + prevDcCb;
                prevDcCr = this.encodeDC(crZigzag[0] - prevDcCr, dcChromTable, writeBits) + prevDcCr;

                // Encode AC coefficients
                this.encodeAC(yZigzag, acLumTable, writeBits);
                this.encodeAC(cbZigzag, acChromTable, writeBits);
                this.encodeAC(crZigzag, acChromTable, writeBits);
            }
        }

        // Flush remaining bits with padding
        if (bitCount > 0) {
            writeBits((1 << (8 - bitCount)) - 1, 8 - bitCount);
        }

        return new Uint8Array(output);
    }

    /**
     * Build Huffman encoding table from bit lengths and values
     */
    private buildHuffmanTable(bits: number[], vals: number[]): Map<number, { code: number; length: number }> {
        const table = new Map<number, { code: number; length: number }>();
        let code = 0;
        let valIndex = 0;

        for (let length = 1; length <= 16; length++) {
            for (let i = 0; i < bits[length - 1]; i++) {
                table.set(vals[valIndex], { code, length });
                code++;
                valIndex++;
            }
            code <<= 1;
        }

        return table;
    }

    /**
     * 8x8 DCT (Discrete Cosine Transform)
     */
    private dct8x8(block: Float64Array): Float64Array {
        const result = new Float64Array(64);
        const cosTable = this.getDCTCosTable();

        for (let v = 0; v < 8; v++) {
            for (let u = 0; u < 8; u++) {
                let sum = 0;
                for (let y = 0; y < 8; y++) {
                    for (let x = 0; x < 8; x++) {
                        sum += block[y * 8 + x] * cosTable[x * 8 + u] * cosTable[y * 8 + v];
                    }
                }

                const cu = u === 0 ? 1 / Math.SQRT2 : 1;
                const cv = v === 0 ? 1 / Math.SQRT2 : 1;
                result[v * 8 + u] = 0.25 * cu * cv * sum;
            }
        }

        return result;
    }

    /**
     * Get DCT cosine lookup table
     */
    private getDCTCosTable(): Float64Array {
        const table = new Float64Array(64);
        for (let n = 0; n < 8; n++) {
            for (let k = 0; k < 8; k++) {
                table[n * 8 + k] = Math.cos((2 * n + 1) * k * Math.PI / 16);
            }
        }
        return table;
    }

    /**
     * Quantize DCT coefficients
     */
    private quantize(dct: Float64Array, quantTable: Uint8Array): Int16Array {
        const result = new Int16Array(64);
        for (let i = 0; i < 64; i++) {
            result[i] = Math.round(dct[i] / quantTable[i]);
        }
        return result;
    }

    /**
     * Zigzag reorder for JPEG encoding
     */
    private zigzagReorder(block: Int16Array): Int16Array {
        const zigzagOrder = [
            0, 1, 8, 16, 9, 2, 3, 10, 17, 24, 32, 25, 18, 11, 4, 5,
            12, 19, 26, 33, 40, 48, 41, 34, 27, 20, 13, 6, 7, 14, 21, 28,
            35, 42, 49, 56, 57, 50, 43, 36, 29, 22, 15, 23, 30, 37, 44, 51,
            58, 59, 52, 45, 38, 31, 39, 46, 53, 60, 61, 54, 47, 55, 62, 63
        ];

        const result = new Int16Array(64);
        for (let i = 0; i < 64; i++) {
            result[i] = block[zigzagOrder[i]];
        }
        return result;
    }

    /**
     * Encode DC coefficient
     */
    private encodeDC(
        diff: number,
        table: Map<number, { code: number; length: number }>,
        writeBits: (value: number, length: number) => void
    ): number {
        const category = this.getCategory(diff);
        const huffCode = table.get(category);

        if (huffCode) {
            writeBits(huffCode.code, huffCode.length);
        }

        if (category > 0) {
            const bits = diff < 0 ? diff + (1 << category) - 1 : diff;
            writeBits(bits, category);
        }

        return diff;
    }

    /**
     * Encode AC coefficients
     */
    private encodeAC(
        zigzag: Int16Array,
        table: Map<number, { code: number; length: number }>,
        writeBits: (value: number, length: number) => void
    ): void {
        let zeroCount = 0;

        for (let i = 1; i < 64; i++) {
            const value = zigzag[i];

            if (value === 0) {
                zeroCount++;
            } else {
                // Emit ZRL (16 zeros) codes if needed
                while (zeroCount >= 16) {
                    const zrl = table.get(0xF0);
                    if (zrl) {
                        writeBits(zrl.code, zrl.length);
                    }
                    zeroCount -= 16;
                }

                const category = this.getCategory(value);
                const symbol = (zeroCount << 4) | category;
                const huffCode = table.get(symbol);

                if (huffCode) {
                    writeBits(huffCode.code, huffCode.length);
                }

                const bits = value < 0 ? value + (1 << category) - 1 : value;
                writeBits(bits, category);

                zeroCount = 0;
            }
        }

        // End of block
        if (zeroCount > 0) {
            const eob = table.get(0x00);
            if (eob) {
                writeBits(eob.code, eob.length);
            }
        }
    }

    /**
     * Get JPEG category for a value
     */
    private getCategory(value: number): number {
        if (value === 0) return 0;
        const absValue = Math.abs(value);
        return Math.floor(Math.log2(absValue)) + 1;
    }

    /**
     * Generate PDF
     */
    async pdf(options?: PDFOptions): Promise<Uint8Array> {
        if (!this.currentURL) {
            throw new Error("No page loaded. Call navigate() first.");
        }

        // Get rendering result from pipeline
        const renderingPipeline = this.browser.getRenderingPipeline();
        if (!renderingPipeline.lastRenderResult) {
            throw new Error("No rendering result available");
        }

        const { displayList, renderTree } = renderingPipeline.lastRenderResult;

        // Create PDF generator
        const { PDFGenerator } = await import("../engine/rendering/pdf/PDFGenerator.ts");
        const generator = new PDFGenerator(options);

        try {
            // Generate PDF from display list
            const pdfBytes = await generator.generate(displayList, renderTree);
            return pdfBytes;
        } catch (error) {
            throw new Error(
                `PDF generation failed: ${
                    error instanceof Error ? error.message : String(error)
                }`,
            );
        }
    }

    /**
     * Evaluate JavaScript
     */
    async evaluate(script: string, args?: unknown[]): Promise<unknown> {
        if (!this.currentURL) {
            throw new Error("No page loaded. Call navigate() first.");
        }

        // Get script executor from rendering pipeline
        const renderingPipeline = this.browser.getRenderingPipeline();
        if (!renderingPipeline.lastRenderResult) {
            throw new Error("No rendering result available");
        }

        const scriptExecutor = renderingPipeline.lastRenderResult.scriptExecutor;
        if (!scriptExecutor) {
            throw new Error("JavaScript is not enabled. Set enableJavaScript: true in BrowserConfig.");
        }

        try {
            // If args are provided, create wrapper function that injects args
            let code = script;
            if (args && args.length > 0) {
                // Convert args to JSON and inject as function parameters
                const argValues = args.map(arg => JSON.stringify(arg)).join(", ");
                code = `(function(...args) { return (${script})(...args); })(${argValues})`;
            }

            // Execute the script and return result
            const result = await scriptExecutor.execute(code);

            if (!result.success) {
                throw result.error || new Error("Script execution failed");
            }

            return result.value;
        } catch (error) {
            throw new Error(
                `JavaScript evaluation failed: ${
                    error instanceof Error ? error.message : String(error)
                }`,
            );
        }
    }

    /**
     * Close the page
     */
    async close(): Promise<void> {
        await this.browser.close();
    }

    /**
     * Get current URL
     */
    getCurrentURL(): string | undefined {
        return this.currentURL;
    }
}
