/**
 * CSS Object Model (CSSOM)
 * Represents CSS rules and stylesheets in memory.
 * Manages multiple stylesheets and provides unified access to CSS rules.
 */

import type { CSSRule, CSSStyleSheet } from "../../../types/css.ts";
import type { DOMElement } from "../../../types/dom.ts";

/**
 * Stylesheet origin type
 * Used for cascade ordering: user-agent < user < author
 */
export enum StyleSheetOrigin {
    USER_AGENT, // Browser default styles
    USER, // User preferences
    AUTHOR, // Document styles
}

/**
 * Stylesheet entry with metadata
 */
interface StyleSheetEntry {
    stylesheet: CSSStyleSheet;
    origin: StyleSheetOrigin;
    media?: string; // Media query (e.g., "screen", "print")
}

/**
 * CSS Object Model
 * Central registry for all stylesheets in the document
 */
export class CSSOM {
    private sheets: StyleSheetEntry[] = [];

    /**
     * Add stylesheet to CSSOM
     *
     * @param stylesheet - The stylesheet to add
     * @param origin - Stylesheet origin (user-agent, user, or author)
     * @param media - Optional media type
     */
    addStyleSheet(
        stylesheet: CSSStyleSheet,
        origin: StyleSheetOrigin = StyleSheetOrigin.AUTHOR,
        media?: string,
    ): void {
        this.sheets.push({
            stylesheet,
            origin,
            media,
        });
    }

    /**
     * Remove stylesheet from CSSOM
     *
     * @param stylesheet - The stylesheet to remove
     * @returns True if removed, false if not found
     */
    removeStyleSheet(stylesheet: CSSStyleSheet): boolean {
        const index = this.sheets.findIndex((entry) => entry.stylesheet === stylesheet);
        if (index >= 0) {
            this.sheets.splice(index, 1);
            return true;
        }
        return false;
    }

    /**
     * Get all stylesheets
     *
     * @returns Array of stylesheet entries
     */
    getStyleSheetEntries(): StyleSheetEntry[] {
        return [...this.sheets];
    }

    /**
     * Get all stylesheets (without metadata)
     *
     * @returns Array of stylesheets
     */
    getStyleSheets(): CSSStyleSheet[] {
        return this.sheets.map((entry) => entry.stylesheet);
    }

    /**
     * Get stylesheets by origin
     *
     * @param origin - Stylesheet origin to filter by
     * @returns Array of stylesheets matching origin
     */
    getStyleSheetsByOrigin(origin: StyleSheetOrigin): CSSStyleSheet[] {
        return this.sheets
            .filter((entry) => entry.origin === origin)
            .map((entry) => entry.stylesheet);
    }

    /**
     * Get all matching rules for element across all stylesheets
     * Returns rules sorted by specificity and origin (cascade order)
     *
     * @param element - DOM element to match
     * @returns Array of matching CSS rules in cascade order
     */
    getMatchingRules(element: DOMElement): CSSRule[] {
        const matchingRules: Array<{ rule: CSSRule; origin: StyleSheetOrigin }> = [];

        // Collect matching rules from all stylesheets
        for (const entry of this.sheets) {
            if (entry.stylesheet.disabled) {
                continue;
            }

            // TODO: Check media query match
            // if (entry.media && !this.matchesMediaQuery(entry.media)) {
            //     continue;
            // }

            const rules = entry.stylesheet.getMatchingRules(element);
            for (const rule of rules) {
                matchingRules.push({
                    rule,
                    origin: entry.origin,
                });
            }
        }

        // Sort by cascade order:
        // 1. Origin (user-agent < user < author)
        // 2. Specificity
        // 3. Source order (later rules win)
        matchingRules.sort((a, b) => {
            // Compare origin
            if (a.origin !== b.origin) {
                return a.origin - b.origin;
            }

            // Compare specificity
            const specificity = this.compareSpecificity(
                a.rule.specificity,
                b.rule.specificity,
            );
            if (specificity !== 0) {
                return specificity;
            }

            // Source order preserved by stable sort
            return 0;
        });

        return matchingRules.map((entry) => entry.rule);
    }

    /**
     * Get all rules across all stylesheets
     *
     * @returns Array of all CSS rules
     */
    getAllRules(): CSSRule[] {
        const allRules: CSSRule[] = [];

        for (const entry of this.sheets) {
            if (!entry.stylesheet.disabled) {
                allRules.push(...entry.stylesheet.rules);
            }
        }

        return allRules;
    }

    /**
     * Find stylesheet by href
     *
     * @param href - Stylesheet URL
     * @returns Matching stylesheet or null
     */
    findStyleSheetByHref(href: string): CSSStyleSheet | null {
        const entry = this.sheets.find((e) => e.stylesheet.href === href);
        return entry ? entry.stylesheet : null;
    }

    /**
     * Find stylesheet by owner node
     *
     * @param node - DOM element that owns the stylesheet
     * @returns Matching stylesheet or null
     */
    findStyleSheetByOwner(node: DOMElement): CSSStyleSheet | null {
        const entry = this.sheets.find((e) => e.stylesheet.ownerNode === node);
        return entry ? entry.stylesheet : null;
    }

    /**
     * Clear all stylesheets
     */
    clear(): void {
        this.sheets = [];
    }

    /**
     * Get stylesheet count
     *
     * @returns Number of stylesheets in CSSOM
     */
    getStyleSheetCount(): number {
        return this.sheets.length;
    }

    /**
     * Get stylesheet count by origin
     *
     * @param origin - Stylesheet origin
     * @returns Number of stylesheets with given origin
     */
    getStyleSheetCountByOrigin(origin: StyleSheetOrigin): number {
        return this.sheets.filter((entry) => entry.origin === origin).length;
    }

    /**
     * Enable/disable stylesheet
     *
     * @param stylesheet - Stylesheet to modify
     * @param disabled - Whether to disable
     */
    setStyleSheetDisabled(stylesheet: CSSStyleSheet, disabled: boolean): void {
        stylesheet.disabled = disabled;
    }

    /**
     * Get rule count across all stylesheets
     *
     * @returns Total number of CSS rules
     */
    getRuleCount(): number {
        let count = 0;
        for (const entry of this.sheets) {
            if (!entry.stylesheet.disabled) {
                count += entry.stylesheet.rules.length;
            }
        }
        return count;
    }

    /**
     * Compare specificity values
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
     * Check if media query matches current environment
     * TODO: Implement media query matching
     *
     * @param media - Media query string
     * @returns Whether media query matches
     */
    private matchesMediaQuery(media: string): boolean {
        // For now, always match
        // Real implementation would parse media queries and evaluate them
        return true;
    }

    /**
     * Get stylesheets sorted by cascade order
     *
     * @returns Stylesheets sorted by origin and source order
     */
    getStyleSheetsCascadeOrder(): CSSStyleSheet[] {
        const sorted = [...this.sheets].sort((a, b) => a.origin - b.origin);
        return sorted.map((entry) => entry.stylesheet);
    }

    /**
     * Insert rule into first author stylesheet
     * Creates a new stylesheet if none exists
     *
     * @param ruleText - CSS rule text
     * @param index - Optional index to insert at
     * @returns Index where rule was inserted
     */
    insertRule(ruleText: string, index?: number): number {
        // Find first author stylesheet
        const authorSheet = this.sheets.find(
            (entry) => entry.origin === StyleSheetOrigin.AUTHOR && !entry.stylesheet.disabled,
        );

        if (!authorSheet) {
            throw new Error("No author stylesheet available");
        }

        const actualIndex = index ?? authorSheet.stylesheet.rules.length;
        return authorSheet.stylesheet.insertRule(ruleText, actualIndex);
    }

    /**
     * Delete rule from first author stylesheet
     *
     * @param index - Rule index to delete
     */
    deleteRule(index: number): void {
        // Find first author stylesheet
        const authorSheet = this.sheets.find(
            (entry) => entry.origin === StyleSheetOrigin.AUTHOR && !entry.stylesheet.disabled,
        );

        if (!authorSheet) {
            throw new Error("No author stylesheet available");
        }

        authorSheet.stylesheet.deleteRule(index);
    }
}
