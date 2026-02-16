/**
 * CSS Domain Types
 *
 * Types for stylesheet inspection, computed styles, and rule matching.
 */

import type { NodeID } from "../../../browser/src/types/identifiers.ts";
import type { Specificity } from "../../../browser/src/types/css.ts";

/**
 * Stylesheet identifier
 */
export type StyleSheetID = string;

/**
 * CSS stylesheet header
 */
export interface CSSStyleSheetHeader {
    styleSheetId: StyleSheetID;
    frameId?: string;
    sourceURL: string;
    origin: "injected" | "user-agent" | "inspector" | "regular";
    title: string;
    disabled: boolean;
    isInline: boolean;
    length: number;
}

/**
 * Computed style property
 */
export interface CSSComputedStyleProperty {
    name: string;
    value: string;
}

/**
 * CSS rule match info
 */
export interface CSSRuleMatch {
    rule: CSSRuleDescription;
    matchingSelectors: number[];
}

/**
 * CSS rule description
 */
export interface CSSRuleDescription {
    styleSheetId?: StyleSheetID;
    selectorList: {
        selectors: Array<{ text: string; specificity?: Specificity }>;
        text: string;
    };
    origin: "injected" | "user-agent" | "inspector" | "regular";
    style: CSSStyleDescription;
}

/**
 * CSS style description
 */
export interface CSSStyleDescription {
    styleSheetId?: StyleSheetID;
    cssProperties: Array<{
        name: string;
        value: string;
        important: boolean;
        disabled?: boolean;
        text?: string;
    }>;
    shorthandEntries: Array<{
        name: string;
        value: string;
        important: boolean;
    }>;
    cssText?: string;
}

export interface GetComputedStyleParams {
    nodeId: NodeID;
}

export interface GetComputedStyleResult {
    computedStyle: CSSComputedStyleProperty[];
}

export interface GetMatchedStylesParams {
    nodeId: NodeID;
}

export interface GetMatchedStylesResult {
    matchedCSSRules: CSSRuleMatch[];
    inlineStyle?: CSSStyleDescription;
    attributesStyle?: CSSStyleDescription;
}

export interface GetStyleSheetTextParams {
    styleSheetId: StyleSheetID;
}

export interface GetStyleSheetTextResult {
    text: string;
}

export interface GetAllStyleSheetsResult {
    headers: CSSStyleSheetHeader[];
}

export interface ForcePseudoStateParams {
    nodeId: NodeID;
    forcedPseudoClasses: string[];
}
