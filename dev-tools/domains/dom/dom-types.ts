/**
 * DOM Domain Types
 *
 * Types for DOM tree inspection and manipulation protocol.
 */

import type { NodeID } from "../../../browser/src/types/identifiers.ts";

/**
 * Serialized DOM node for protocol transport
 */
export interface DOMNodeDescription {
    nodeId: NodeID;
    backendNodeId: NodeID;
    nodeType: number;
    nodeName: string;
    localName: string;
    nodeValue: string;
    childNodeCount?: number;
    children?: DOMNodeDescription[];
    attributes?: string[];
    documentURL?: string;
    baseURL?: string;
}

/**
 * Box model representation
 */
export interface BoxModel {
    content: number[];
    padding: number[];
    border: number[];
    margin: number[];
    width: number;
    height: number;
}

export interface GetDocumentParams {
    depth?: number;
    pierce?: boolean;
}

export interface GetDocumentResult {
    root: DOMNodeDescription;
}

export interface QuerySelectorParams {
    nodeId: NodeID;
    selector: string;
}

export interface QuerySelectorResult {
    nodeId: NodeID;
}

export interface QuerySelectorAllParams {
    nodeId: NodeID;
    selector: string;
}

export interface QuerySelectorAllResult {
    nodeIds: NodeID[];
}

export interface GetOuterHTMLParams {
    nodeId: NodeID;
}

export interface GetOuterHTMLResult {
    outerHTML: string;
}

export interface SetAttributeValueParams {
    nodeId: NodeID;
    name: string;
    value: string;
}

export interface RemoveAttributeParams {
    nodeId: NodeID;
    name: string;
}

export interface RemoveNodeParams {
    nodeId: NodeID;
}

export interface GetBoxModelParams {
    nodeId: NodeID;
}

export interface GetBoxModelResult {
    model: BoxModel;
}

export interface RequestChildNodesParams {
    nodeId: NodeID;
    depth?: number;
}

export interface PerformSearchParams {
    query: string;
    includeUserAgentShadowDOM?: boolean;
}

export interface PerformSearchResult {
    searchId: string;
    resultCount: number;
}

export interface GetSearchResultsParams {
    searchId: string;
    fromIndex: number;
    toIndex: number;
}

export interface GetSearchResultsResult {
    nodeIds: NodeID[];
}
