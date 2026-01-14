// ============================================================================
// CSS TYPES
// ============================================================================

import type { DOMElement } from "./dom.ts";

/**
 * Selector specificity [inline, id, class, element]
 */
export type Specificity = [number, number, number, number];

/**
 * CSS selector
 */
export interface CSSSelector {
    text: string;
    specificity: Specificity;

    /**
     * Check if matches element
     */
    matches(element: DOMElement): boolean;
}

/**
 * CSS declaration
 */
export interface CSSDeclaration {
    property: string;
    value: string;
    important: boolean;
}

/**
 * CSS rule
 */
export interface CSSRule {
    selectorList: CSSSelector[];
    declarations: CSSDeclaration[];
    specificity: Specificity; // Maximum specificity of selectors
}

/**
 * CSS stylesheet
 */
export interface CSSStyleSheet {
    href: string | null;
    ownerNode: DOMElement | null;
    rules: CSSRule[];
    disabled: boolean;

    /**
     * Add rule at index
     */
    insertRule(rule: string, index: number): number;

    /**
     * Delete rule at index
     */
    deleteRule(index: number): void;

    /**
     * Get matching rules for element
     */
    getMatchingRules(element: DOMElement): CSSRule[];
}

/**
 * Computed style for element
 */
export interface ComputedStyle {
    // Map of property name to computed value
    properties: Map<string, string>;

    // Common CSS properties
    backgroundColor?: string;
    color?: string;
    fontSize?: number;
    fontFamily?: string;
    borderColor?: string;
    borderWidth?: number;

    /**
     * Get property value
     */
    getPropertyValue(property: string): string;

    /**
     * Set property value
     */
    setProperty(property: string, value: string): void;

    /**
     * Remove property
     */
    removeProperty(property: string): void;

    /**
     * Get all property names
     */
    getPropertyNames(): string[];
}
