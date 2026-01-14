/**
 * Style Resolver
 * Resolves styles for elements by applying CSS cascade, specificity,
 * and inheritance rules to produce final computed styles.
 */

import type { ComputedStyle, CSSDeclaration, CSSRule, CSSStyleSheet } from "../../../types/css.ts";
import type { DOMElement } from "../../../types/dom.ts";
import { CSSOM, StyleSheetOrigin } from "./CSSOM.ts";
import { computeProperties } from "./CSSPropertyCompute.ts";

/**
 * Declaration with metadata for cascade sorting
 */
interface DeclarationEntry {
    declaration: CSSDeclaration;
    specificity: [number, number, number, number];
    origin: StyleSheetOrigin;
    sourceIndex: number;
}

/**
 * Style Resolver
 * Main entry point for computing element styles
 */
export class StyleResolver {
    private cssom: CSSOM;

    constructor(cssom?: CSSOM) {
        this.cssom = cssom || new CSSOM();
    }

    /**
     * Set the CSSOM instance
     *
     * @param cssom - CSSOM instance
     */
    setCSSOM(cssom: CSSOM): void {
        this.cssom = cssom;
    }

    /**
     * Add stylesheet to resolver
     *
     * @param stylesheet - Stylesheet to add
     * @param origin - Stylesheet origin
     */
    addStyleSheet(
        stylesheet: CSSStyleSheet,
        origin: StyleSheetOrigin = StyleSheetOrigin.AUTHOR,
    ): void {
        this.cssom.addStyleSheet(stylesheet, origin);
    }

    /**
     * Resolve styles for element
     * Applies cascade, specificity, and inheritance to compute final styles
     *
     * @param element - DOM element to resolve styles for
     * @param stylesheets - Optional stylesheets (if not using CSSOM)
     * @returns Computed style for element
     */
    resolve(element: DOMElement, stylesheets?: CSSStyleSheet[]): ComputedStyle {
        // If stylesheets provided, use them directly instead of CSSOM
        let matchingRules: CSSRule[];

        if (stylesheets) {
            // Collect matching rules from provided stylesheets
            matchingRules = [];
            for (const stylesheet of stylesheets) {
                if (!stylesheet.disabled) {
                    matchingRules.push(...stylesheet.getMatchingRules(element));
                }
            }
        } else {
            // Use CSSOM to get matching rules
            matchingRules = this.cssom.getMatchingRules(element);
        }

        // Get parent's computed style for inheritance
        let parentStyle: ComputedStyle | null = null;
        if (element.parentElement) {
            // Recursively resolve parent style
            parentStyle = this.resolve(element.parentElement, stylesheets);
        }

        // Collect all declarations from matching rules
        const declarationEntries: DeclarationEntry[] = [];
        let sourceIndex = 0;

        for (const rule of matchingRules) {
            for (const declaration of rule.declarations) {
                declarationEntries.push({
                    declaration,
                    specificity: rule.specificity,
                    origin: StyleSheetOrigin.AUTHOR, // Default to author origin
                    sourceIndex: sourceIndex++,
                });
            }
        }

        // Add inline styles (highest specificity)
        const inlineStyle = this.getInlineStyles(element);
        for (const [property, value] of inlineStyle.entries()) {
            declarationEntries.push({
                declaration: {
                    property,
                    value,
                    important: false,
                },
                specificity: [1, 0, 0, 0], // Inline style has highest specificity
                origin: StyleSheetOrigin.AUTHOR,
                sourceIndex: sourceIndex++,
            });
        }

        // Apply cascade to get winning declarations
        const declaredProperties = this.applyCascade(declarationEntries);

        // Compute properties with inheritance
        return computeProperties(declaredProperties, parentStyle);
    }

    /**
     * Apply CSS cascade to determine winning declarations
     * Cascade order:
     * 1. !important declarations sorted by origin/specificity/source
     * 2. Normal declarations sorted by origin/specificity/source
     *
     * @param entries - Declaration entries to cascade
     * @returns Map of property names to winning values
     */
    private applyCascade(entries: DeclarationEntry[]): Map<string, string> {
        // Separate important and normal declarations
        const importantDecls = entries.filter((e) => e.declaration.important);
        const normalDecls = entries.filter((e) => !e.declaration.important);

        // Sort by cascade rules
        const sortedImportant = this.sortByCascade(importantDecls);
        const sortedNormal = this.sortByCascade(normalDecls);

        // Build property map - important declarations override normal
        const propertyMap = new Map<string, string>();

        // Apply normal declarations first
        for (const entry of sortedNormal) {
            propertyMap.set(entry.declaration.property, entry.declaration.value);
        }

        // Apply important declarations (override normal)
        for (const entry of sortedImportant) {
            propertyMap.set(entry.declaration.property, entry.declaration.value);
        }

        return propertyMap;
    }

    /**
     * Sort declarations by cascade order
     * Order: origin > specificity > source order
     *
     * @param entries - Declaration entries to sort
     * @returns Sorted declaration entries
     */
    private sortByCascade(entries: DeclarationEntry[]): DeclarationEntry[] {
        return entries.sort((a, b) => {
            // Compare origin (user-agent < user < author)
            if (a.origin !== b.origin) {
                return a.origin - b.origin;
            }

            // Compare specificity
            const specificityCompare = this.compareSpecificity(a.specificity, b.specificity);
            if (specificityCompare !== 0) {
                return specificityCompare;
            }

            // Compare source order (later wins)
            return a.sourceIndex - b.sourceIndex;
        });
    }

    /**
     * Compare two specificity values
     * Returns: 1 if a > b, -1 if a < b, 0 if equal
     *
     * @param a - First specificity
     * @param b - Second specificity
     * @returns Comparison result
     */
    private compareSpecificity(
        a: [number, number, number, number],
        b: [number, number, number, number],
    ): number {
        for (let i = 0; i < 4; i++) {
            if (a[i] > b[i]) return 1;
            if (a[i] < b[i]) return -1;
        }
        return 0;
    }

    /**
     * Get inline styles from element's style attribute
     *
     * @param element - DOM element
     * @returns Map of inline style properties
     */
    private getInlineStyles(element: DOMElement): Map<string, string> {
        const inlineStyles = new Map<string, string>();
        const styleAttr = element.attributes?.get("style");

        if (!styleAttr) {
            return inlineStyles;
        }

        // Parse inline style declarations
        // Format: "property: value; property: value;"
        const declarations = styleAttr.split(";");

        for (const decl of declarations) {
            const colonIndex = decl.indexOf(":");
            if (colonIndex === -1) continue;

            const property = decl.substring(0, colonIndex).trim();
            const value = decl.substring(colonIndex + 1).trim();

            if (property && value) {
                inlineStyles.set(property, value);
            }
        }

        return inlineStyles;
    }

    /**
     * Calculate selector specificity
     * Returns specificity as [inline, id, class, element]
     *
     * Note: This is a simplified implementation. The actual specificity
     * is calculated during selector parsing in CSSParser.
     *
     * @param selector - CSS selector string
     * @returns Specificity tuple
     */
    calculateSpecificity(selector: string): { a: number; b: number; c: number } {
        let idCount = 0;
        let classCount = 0;
        let elementCount = 0;

        // Simple regex-based specificity calculation
        // (Real implementation is in CSSParser selector parsing)

        // Count IDs (#id)
        const idMatches = selector.match(/#[a-zA-Z][\w-]*/g);
        if (idMatches) {
            idCount = idMatches.length;
        }

        // Count classes (.class), attributes ([attr]), pseudo-classes (:hover)
        const classMatches = selector.match(/\.[a-zA-Z][\w-]*/g);
        const attrMatches = selector.match(/\[[^\]]+\]/g);
        const pseudoClassMatches = selector.match(/:[a-zA-Z][\w-]*/g);

        classCount = (classMatches?.length || 0) +
            (attrMatches?.length || 0) +
            (pseudoClassMatches?.length || 0);

        // Count elements (div, span, etc.) and pseudo-elements (::before)
        const elementMatches = selector.match(/\b[a-z][\w-]*\b/gi);
        const pseudoElementMatches = selector.match(/::[a-zA-Z][\w-]*/g);

        elementCount = (elementMatches?.length || 0) +
            (pseudoElementMatches?.length || 0);

        return {
            a: idCount,
            b: classCount,
            c: elementCount,
        };
    }

    /**
     * Get computed style for element without resolving parent
     * Useful for getting just the element's declared styles
     *
     * @param element - DOM element
     * @param parentStyle - Optional parent computed style
     * @returns Computed style
     */
    resolveWithParent(element: DOMElement, parentStyle: ComputedStyle | null): ComputedStyle {
        // Get matching rules from CSSOM
        const matchingRules = this.cssom.getMatchingRules(element);

        // Collect declarations
        const declarationEntries: DeclarationEntry[] = [];
        let sourceIndex = 0;

        for (const rule of matchingRules) {
            for (const declaration of rule.declarations) {
                declarationEntries.push({
                    declaration,
                    specificity: rule.specificity,
                    origin: StyleSheetOrigin.AUTHOR,
                    sourceIndex: sourceIndex++,
                });
            }
        }

        // Add inline styles
        const inlineStyle = this.getInlineStyles(element);
        for (const [property, value] of inlineStyle.entries()) {
            declarationEntries.push({
                declaration: {
                    property,
                    value,
                    important: false,
                },
                specificity: [1, 0, 0, 0],
                origin: StyleSheetOrigin.AUTHOR,
                sourceIndex: sourceIndex++,
            });
        }

        // Apply cascade
        const declaredProperties = this.applyCascade(declarationEntries);

        // Compute properties
        return computeProperties(declaredProperties, parentStyle);
    }

    /**
     * Get CSSOM instance
     *
     * @returns CSSOM instance
     */
    getCSSOM(): CSSOM {
        return this.cssom;
    }

    /**
     * Clear all stylesheets
     */
    clear(): void {
        this.cssom.clear();
    }

    /**
     * Get stylesheet count
     *
     * @returns Number of stylesheets
     */
    getStyleSheetCount(): number {
        return this.cssom.getStyleSheetCount();
    }

    /**
     * Get all matching rules for element (for debugging)
     *
     * @param element - DOM element
     * @returns Array of matching CSS rules
     */
    getMatchingRules(element: DOMElement): CSSRule[] {
        return this.cssom.getMatchingRules(element);
    }
}
