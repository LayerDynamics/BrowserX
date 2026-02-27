/**
 * DOM Domain Agent
 *
 * Provides DOM tree inspection and manipulation.
 * Hooks into RenderingPipeline.lastRenderResult.dom for live DOM access.
 */

import type { DomainName } from "../../protocol/types.ts";
import { BaseDomain } from "../base-domain.ts";
import { validateParams, validateQuerySelectorParams } from "../../protocol/validate-params.ts";
import { domToGraph } from "./dom-graph.ts";
import { type DOMNode, type DOMElement, DOMNodeType } from "../../../browser/src/types/dom.ts";
import type { NodeID } from "../../../browser/src/types/identifiers.ts";
import type { LayoutBox } from "../../../browser/src/types/rendering.ts";
import type {
    DOMNodeDescription,
    BoxModel,
    GetDocumentParams,
    GetDocumentResult,
    QuerySelectorParams,
    QuerySelectorResult,
    QuerySelectorAllParams,
    QuerySelectorAllResult,
    GetOuterHTMLParams,
    GetOuterHTMLResult,
    SetAttributeValueParams,
    RemoveAttributeParams,
    RemoveNodeParams,
    GetBoxModelParams,
    GetBoxModelResult,
    RequestChildNodesParams,
    PerformSearchParams,
    PerformSearchResult,
    GetSearchResultsParams,
    GetSearchResultsResult,
} from "./dom-types.ts";

const MAX_SERIALIZE_DEPTH = 100;

/**
 * DOM Domain - inspects and manipulates the DOM tree
 */
export class DOMDomain extends BaseDomain {
    readonly name: DomainName = "DOM";

    /** Node map for fast lookups by nodeId */
    private nodeMap: Map<NodeID, DOMNode> = new Map();

    /** Dirty flag — when true, nodeMap must be rebuilt before use */
    private nodeMapDirty: boolean = true;

    /** Search results cache (searchId -> nodeIds) */
    private searchResults: Map<string, NodeID[]> = new Map();
    private searchIdCounter: number = 0;

    /** Query-keyed search cache (query -> nodeIds). Invalidated on DOM mutations via nodeMapDirty. */
    private querySearchCache: Map<string, NodeID[]> = new Map();
    /** Tracks whether the query search cache is valid (reset when nodeMapDirty is set) */
    private querySearchCacheDirty: boolean = true;

    protected setup(): void {
        // Register methods
        this.registerMethod("getDocument", "Returns the root DOM node", async (params) => {
            return await this.getDocument(params as unknown as GetDocumentParams);
        });

        this.registerMethod("querySelector", "Execute querySelector on a node", async (params) => {
            return await this.querySelector(validateParams(params, validateQuerySelectorParams) as QuerySelectorParams);
        });

        this.registerMethod("querySelectorAll", "Execute querySelectorAll on a node", async (params) => {
            return await this.querySelectorAll(params as unknown as QuerySelectorAllParams);
        });

        this.registerMethod("getOuterHTML", "Get outer HTML of a node", async (params) => {
            return await this.getOuterHTML(params as unknown as GetOuterHTMLParams);
        });

        this.registerMethod("setAttributeValue", "Set an attribute on an element", async (params) => {
            return await this.setAttributeValue(params as unknown as SetAttributeValueParams);
        });

        this.registerMethod("removeAttribute", "Remove an attribute from an element", async (params) => {
            return await this.removeAttribute(params as unknown as RemoveAttributeParams);
        });

        this.registerMethod("removeNode", "Remove a node from the DOM", async (params) => {
            return await this.removeNode(params as unknown as RemoveNodeParams);
        });

        this.registerMethod("getBoxModel", "Get box model for a node", async (params) => {
            return await this.getBoxModel(params as unknown as GetBoxModelParams);
        });

        this.registerMethod("requestChildNodes", "Request children for a node", async (params) => {
            return await this.requestChildNodes(params as unknown as RequestChildNodesParams);
        });

        this.registerMethod("performSearch", "Search the DOM tree", async (params) => {
            return await this.performSearch(params as unknown as PerformSearchParams);
        });

        this.registerMethod("getSearchResults", "Get search results by range", async (params) => {
            return await this.getSearchResults(params as unknown as GetSearchResultsParams);
        });

        this.registerMethod("getGraphVisualization", "Get DOM tree as GraphX visualization", async (_params) => {
            const lastResult = this.getLastRenderResult();
            if (!lastResult?.dom) return { svg: "" };
            const graph = domToGraph(lastResult.dom);
            return { graph: { nodes: graph.getNodes().length, edges: graph.getEdges().length } };
        });

        // Register events
        this.registerEvent("documentUpdated", "DOM tree structure changed");
        this.registerEvent("setChildNodes", "Children fetched for a node");
        this.registerEvent("attributeModified", "Attribute changed on a node");
        this.registerEvent("attributeRemoved", "Attribute removed from a node");
        this.registerEvent("childNodeRemoved", "Child node removed");
        this.registerEvent("childNodeInserted", "Child node inserted");
        this.registerEvent("characterDataModified", "Text content changed");

    }

    /**
     * Get the current DOM tree from the rendering pipeline
     */
    private getCurrentDOM(): DOMNode | null {
        const lastResult = this.getLastRenderResult();
        if (lastResult) {
            return lastResult.dom;
        }
        return null;
    }

    /**
     * Build the node map from a DOM tree
     */
    private buildNodeMap(node: DOMNode): void {
        this.nodeMap.set(node.nodeId, node);
        if (node.childNodes) {
            for (const child of node.childNodes) {
                this.buildNodeMap(child);
            }
        }
    }

    /**
     * Serialize a DOMNode to protocol format
     */
    private serializeNode(node: DOMNode, depth: number = 1, _currentDepth: number = 0): DOMNodeDescription {
        if (_currentDepth > MAX_SERIALIZE_DEPTH) {
            return {
                nodeId: node.nodeId,
                backendNodeId: node.nodeId,
                nodeType: node.nodeType,
                nodeName: node.nodeName,
                localName: node.nodeType === DOMNodeType.ELEMENT ? (node.nodeName || "").toLowerCase() : "",
                nodeValue: node.nodeValue || "",
                childNodeCount: node.childNodes?.length ?? 0,
            };
        }

        const desc: DOMNodeDescription = {
            nodeId: node.nodeId,
            backendNodeId: node.nodeId,
            nodeType: node.nodeType,
            nodeName: node.nodeName,
            localName: node.nodeType === DOMNodeType.ELEMENT ? (node.nodeName || "").toLowerCase() : "",
            nodeValue: node.nodeValue || "",
        };

        // Add attributes for element nodes
        if (node.nodeType === DOMNodeType.ELEMENT) {
            const element = node as unknown as DOMElement;
            if (element.attributes) {
                const attrs: string[] = [];
                if (element.attributes instanceof Map) {
                    for (const [key, value] of element.attributes) {
                        attrs.push(key, value);
                    }
                }
                desc.attributes = attrs;
            }
        }

        // Add children if depth allows
        if (node.childNodes && node.childNodes.length > 0) {
            desc.childNodeCount = node.childNodes.length;
            if (depth > 0) {
                desc.children = node.childNodes.map((child) =>
                    this.serializeNode(child, depth - 1, _currentDepth + 1)
                );
            }
        }

        // Add document URL for document nodes
        if (node.nodeType === DOMNodeType.DOCUMENT) {
            const doc = node as unknown as { URL?: string };
            desc.documentURL = doc.URL || "";
        }

        return desc;
    }

    /**
     * Serialize a node subtree to HTML string
     */
    /**
     * Escape a string for safe use in an HTML attribute value
     */
    private escapeHtmlAttribute(value: string): string {
        return value
            .replace(/&/g, "&amp;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
    }

    private serializeToHTML(node: DOMNode): string {
        if (node.nodeType === DOMNodeType.TEXT) {
            return (node.nodeValue || "")
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;");
        }
        if (node.nodeType === DOMNodeType.COMMENT) {
            const safe = (node.nodeValue ?? "").replace(/-->/g, "--&gt;");
            return `<!--${safe}-->`;
        }
        if (node.nodeType === DOMNodeType.ELEMENT) {
            const element = node as unknown as DOMElement;
            const tag = element.tagName.toLowerCase();
            let attrs = "";
            if (element.attributes instanceof Map) {
                for (const [key, value] of element.attributes) {
                    const safeName = key.replace(/[^a-zA-Z0-9\-_:.]/g, "");
                    if (!safeName) continue;
                    attrs += ` ${safeName}="${this.escapeHtmlAttribute(String(value))}"`;
                }
            }
            const children = (node.childNodes || [])
                .map((child) => this.serializeToHTML(child))
                .join("");
            return `<${tag}${attrs}>${children}</${tag}>`;
        }
        if (node.nodeType === DOMNodeType.DOCUMENT) {
            return (node.childNodes || [])
                .map((child) => this.serializeToHTML(child))
                .join("");
        }
        return "";
    }

    /**
     * Search the DOM tree for matching text content or attributes
     */
    private searchDOM(node: DOMNode, query: string, seen?: Set<NodeID>): NodeID[] {
        const results: NodeID[] = [];
        const dedup = seen ?? new Set<NodeID>();
        const lowerQuery = query.toLowerCase();

        const addResult = (id: NodeID) => {
            if (!dedup.has(id)) {
                dedup.add(id);
                results.push(id);
            }
        };

        // Check node name
        if (node.nodeName.toLowerCase().includes(lowerQuery)) {
            addResult(node.nodeId);
        }

        // Check text content
        if (node.nodeValue && node.nodeValue.toLowerCase().includes(lowerQuery)) {
            addResult(node.nodeId);
        }

        // Check attributes for elements
        if (node.nodeType === DOMNodeType.ELEMENT) {
            const element = node as unknown as DOMElement;
            if (element.attributes instanceof Map) {
                for (const [key, value] of element.attributes) {
                    if (
                        key.toLowerCase().includes(lowerQuery) ||
                        value.toLowerCase().includes(lowerQuery)
                    ) {
                        addResult(node.nodeId);
                        break;
                    }
                }
            }
        }

        // Recurse into children
        if (node.childNodes) {
            for (const child of node.childNodes) {
                results.push(...this.searchDOM(child, query, dedup));
            }
        }

        return results;
    }

    // ---- Method implementations ----

    /**
     * Ensure the nodeMap is up-to-date by rebuilding from the DOM if dirty.
     * Must be called before any nodeMap read operation.
     */
    private ensureNodeMapFresh(): void {
        if (this.nodeMapDirty) {
            const dom = this.getCurrentDOM();
            if (dom) {
                this.nodeMap.clear();
                this.buildNodeMap(dom);
                this.nodeMapDirty = false;
            }
        }
    }

    async getDocument(params: GetDocumentParams): Promise<GetDocumentResult> {
        const dom = this.getCurrentDOM();
        if (!dom) {
            return {
                root: {
                    nodeId: 0,
                    backendNodeId: 0,
                    nodeType: DOMNodeType.DOCUMENT,
                    nodeName: "#document",
                    localName: "",
                    nodeValue: "",
                    childNodeCount: 0,
                    children: [],
                },
            };
        }

        // Rebuild node map only when dirty
        this.ensureNodeMapFresh();

        const depth = params.depth ?? 2;
        return { root: this.serializeNode(dom, depth) };
    }

    async querySelector(params: QuerySelectorParams): Promise<QuerySelectorResult> {
        this.ensureNodeMapFresh();
        const node = this.nodeMap.get(params.nodeId);
        if (!node) {
            throw new Error(`Node ${params.nodeId} not found`);
        }
        if (node.nodeType === DOMNodeType.ELEMENT || node.nodeType === DOMNodeType.DOCUMENT) {
            const element = node as unknown as DOMElement;
            const result = element.querySelector(params.selector);
            if (result) {
                return { nodeId: result.nodeId };
            }
        }
        return { nodeId: 0 };
    }

    async querySelectorAll(params: QuerySelectorAllParams): Promise<QuerySelectorAllResult> {
        this.ensureNodeMapFresh();
        const node = this.nodeMap.get(params.nodeId);
        if (!node) {
            throw new Error(`Node ${params.nodeId} not found`);
        }
        if (node.nodeType === DOMNodeType.ELEMENT || node.nodeType === DOMNodeType.DOCUMENT) {
            const element = node as unknown as DOMElement;
            const results = element.querySelectorAll(params.selector);
            return { nodeIds: results.map((el) => el.nodeId) };
        }
        return { nodeIds: [] };
    }

    async getOuterHTML(params: GetOuterHTMLParams): Promise<GetOuterHTMLResult> {
        this.ensureNodeMapFresh();
        const node = this.nodeMap.get(params.nodeId);
        if (!node) {
            throw new Error(`Node ${params.nodeId} not found`);
        }
        return { outerHTML: this.serializeToHTML(node) };
    }

    async setAttributeValue(params: SetAttributeValueParams): Promise<Record<string, unknown>> {
        this.ensureNodeMapFresh();
        const node = this.nodeMap.get(params.nodeId);
        if (!node || node.nodeType !== DOMNodeType.ELEMENT) {
            throw new Error(`Element ${params.nodeId} not found`);
        }
        const element = node as unknown as DOMElement;
        element.setAttribute(params.name, params.value);
        this.nodeMapDirty = true;
        this.querySearchCacheDirty = true;
        if (this.enabled) {
            this.emitEvent("attributeModified", {
                nodeId: params.nodeId,
                name: params.name,
                value: params.value,
            });
        }
        return {};
    }

    async removeAttribute(params: RemoveAttributeParams): Promise<Record<string, unknown>> {
        this.ensureNodeMapFresh();
        const node = this.nodeMap.get(params.nodeId);
        if (!node || node.nodeType !== DOMNodeType.ELEMENT) {
            throw new Error(`Element ${params.nodeId} not found`);
        }
        const element = node as unknown as DOMElement;
        element.removeAttribute(params.name);
        this.nodeMapDirty = true;
        this.querySearchCacheDirty = true;
        if (this.enabled) {
            this.emitEvent("attributeRemoved", {
                nodeId: params.nodeId,
                name: params.name,
            });
        }
        return {};
    }

    async removeNode(params: RemoveNodeParams): Promise<Record<string, unknown>> {
        const node = this.nodeMap.get(params.nodeId);
        if (!node || !node.parentNode) {
            throw new Error(`Node ${params.nodeId} not found or has no parent`);
        }
        const parentId = node.parentNode.nodeId;
        node.parentNode.removeChild(node);
        this.nodeMap.delete(params.nodeId);
        this.nodeMapDirty = true;
        this.querySearchCacheDirty = true;
        this.emitEvent("childNodeRemoved", {
            parentNodeId: parentId,
            nodeId: params.nodeId,
        });
        return {};
    }

    async getBoxModel(params: GetBoxModelParams): Promise<GetBoxModelResult> {
        this.ensureNodeMapFresh();
        const node = this.nodeMap.get(params.nodeId);
        if (!node || node.nodeType !== DOMNodeType.ELEMENT) {
            throw new Error(`Element ${params.nodeId} not found`);
        }
        const element = node as unknown as DOMElement;
        const renderObj = element.__renderObject;
        const layout: LayoutBox | null = renderObj?.layout ?? null;

        if (!layout) {
            return {
                model: {
                    content: [0, 0, 0, 0, 0, 0, 0, 0],
                    padding: [0, 0, 0, 0, 0, 0, 0, 0],
                    border: [0, 0, 0, 0, 0, 0, 0, 0],
                    margin: [0, 0, 0, 0, 0, 0, 0, 0],
                    width: 0,
                    height: 0,
                },
            };
        }

        const cx = layout.x + layout.borderLeftWidth + layout.paddingLeft;
        const cy = layout.y + layout.borderTopWidth + layout.paddingTop;
        const cw = layout.width;
        const ch = layout.height;

        const px = layout.x + layout.borderLeftWidth;
        const py = layout.y + layout.borderTopWidth;
        const pw = cw + layout.paddingLeft + layout.paddingRight;
        const ph = ch + layout.paddingTop + layout.paddingBottom;

        const bx = layout.x;
        const by = layout.y;
        const bw = pw + layout.borderLeftWidth + layout.borderRightWidth;
        const bh = ph + layout.borderTopWidth + layout.borderBottomWidth;

        const mx = bx - layout.marginLeft;
        const my = by - layout.marginTop;
        const mw = bw + layout.marginLeft + layout.marginRight;
        const mh = bh + layout.marginTop + layout.marginBottom;

        const model: BoxModel = {
            content: [cx, cy, cx + cw, cy, cx + cw, cy + ch, cx, cy + ch],
            padding: [px, py, px + pw, py, px + pw, py + ph, px, py + ph],
            border: [bx, by, bx + bw, by, bx + bw, by + bh, bx, by + bh],
            margin: [mx, my, mx + mw, my, mx + mw, my + mh, mx, my + mh],
            width: cw,
            height: ch,
        };

        return { model };
    }

    async requestChildNodes(params: RequestChildNodesParams): Promise<Record<string, unknown>> {
        this.ensureNodeMapFresh();
        const node = this.nodeMap.get(params.nodeId);
        if (!node) {
            throw new Error(`Node ${params.nodeId} not found`);
        }
        const depth = params.depth ?? 1;
        if (node.childNodes && node.childNodes.length > 0) {
            const children = node.childNodes.map((child) => this.serializeNode(child, depth - 1));
            this.emitEvent("setChildNodes", {
                parentId: params.nodeId,
                nodes: children,
            });
        }
        return {};
    }

    async performSearch(params: PerformSearchParams): Promise<PerformSearchResult> {
        // Cap query length to prevent excessive processing
        if (params.query && params.query.length > 1000) {
            return { searchId: "error", resultCount: 0 };
        }

        const dom = this.getCurrentDOM();
        if (!dom) {
            return { searchId: "0", resultCount: 0 };
        }

        // Invalidate query search cache on DOM mutations
        if (this.querySearchCacheDirty) {
            this.querySearchCache.clear();
            this.querySearchCacheDirty = false;
        }

        // Use cached results if available for this query
        let results = this.querySearchCache.get(params.query);
        if (!results) {
            results = this.searchDOM(dom, params.query);
            this.querySearchCache.set(params.query, results);
        }

        const searchId = String(++this.searchIdCounter);

        // Cap search results cache to prevent unbounded growth
        if (this.searchResults.size >= 100) {
            const oldest = this.searchResults.keys().next().value;
            if (oldest !== undefined) this.searchResults.delete(oldest);
        }
        this.searchResults.set(searchId, results);

        return { searchId, resultCount: results.length };
    }

    async getSearchResults(params: GetSearchResultsParams): Promise<GetSearchResultsResult> {
        const results = this.searchResults.get(params.searchId);
        if (!results) {
            return { nodeIds: [] };
        }
        return { nodeIds: results.slice(params.fromIndex, params.toIndex) };
    }

    /**
     * Look up a DOM node by its nodeId.
     * Used by sibling domains (CSS, Overlay) for explicit cross-domain resolution.
     */
    getNodeById(nodeId: NodeID): DOMNode | null {
        this.ensureNodeMapFresh();
        return this.nodeMap.get(nodeId) ?? null;
    }

    /**
     * Get the node map (for use by other domains like CSS, Overlay)
     */
    getNodeMap(): Map<NodeID, DOMNode> {
        this.ensureNodeMapFresh();
        return this.nodeMap;
    }

    override dispose(): void {
        this.nodeMap.clear();
        this.searchResults.clear();
        this.querySearchCache.clear();
        super.dispose();
    }
}
