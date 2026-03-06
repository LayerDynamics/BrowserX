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

  /** Viewport width in pixels for media query evaluation */
  viewportWidth = 1280;
  /** Viewport height in pixels for media query evaluation */
  viewportHeight = 720;

  /**
   * Set viewport dimensions for media query evaluation
   */
  setViewport(width: number, height: number): void {
    this.viewportWidth = width;
    this.viewportHeight = height;
  }

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

      // Check media query match
      if (entry.media && !this.matchesMediaQuery(entry.media)) {
        continue;
      }

      const rules = entry.stylesheet.getMatchingRules(element);
      for (const rule of rules) {
        matchingRules.push({
          rule,
          origin: entry.origin,
        });
      }

      // Evaluate inline @media rules from the stylesheet
      if (entry.stylesheet.mediaRules) {
        for (const mediaRule of entry.stylesheet.mediaRules) {
          if (this.matchesMediaQuery(mediaRule.condition)) {
            for (const rule of mediaRule.rules) {
              // Check if rule matches this element
              for (const selector of rule.selectorList) {
                if (selector.matches(element)) {
                  matchingRules.push({
                    rule,
                    origin: entry.origin,
                  });
                  break;
                }
              }
            }
          }
        }
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
   *
   * Supports media types (screen, print, all), dimension features
   * (min-width, max-width, min-height, max-height with px/em/rem),
   * orientation, and comma-separated lists (OR logic).
   * Unknown queries default to true (progressive enhancement).
   *
   * @param media - Media query string
   * @returns Whether media query matches
   */
  matchesMediaQuery(media: string): boolean {
    // Comma-separated queries are OR'd together
    const queries = media.split(",").map((q) => q.trim());
    return queries.some((query) => this.matchesSingleMediaQuery(query));
  }

  /**
   * Evaluate a single media query (no commas)
   */
  private matchesSingleMediaQuery(query: string): boolean {
    if (!query) return true;

    const parts = query.trim().split(/\s+and\s+/i);
    return parts.every((part) => this.matchesMediaPart(part.trim()));
  }

  /**
   * Evaluate one part of a media query (either a type or a feature expression)
   */
  private matchesMediaPart(part: string): boolean {
    // Media type check
    const lower = part.toLowerCase();
    if (lower === "all" || lower === "screen") return true;
    if (lower === "print" || lower === "speech") return false;

    // Parenthesized feature expression: (feature: value)
    const featureMatch = part.match(/^\((.+)\)$/);
    if (!featureMatch) {
      // Unknown bare token — progressive enhancement, default true
      return true;
    }

    const inner = featureMatch[1].trim();
    const colonIdx = inner.indexOf(":");
    if (colonIdx === -1) {
      // Boolean feature like (color) — default true
      return true;
    }

    const feature = inner.substring(0, colonIdx).trim().toLowerCase();
    const rawValue = inner.substring(colonIdx + 1).trim().toLowerCase();

    // Parse numeric value with unit support
    const parsePx = (val: string): number | null => {
      const m = val.match(/^([\d.]+)(px|em|rem)?$/);
      if (!m) return null;
      const num = parseFloat(m[1]);
      const unit = m[2] || "px";
      if (unit === "em" || unit === "rem") return num * 16;
      return num;
    };

    switch (feature) {
      case "min-width": {
        const px = parsePx(rawValue);
        return px !== null ? this.viewportWidth >= px : true;
      }
      case "max-width": {
        const px = parsePx(rawValue);
        return px !== null ? this.viewportWidth <= px : true;
      }
      case "min-height": {
        const px = parsePx(rawValue);
        return px !== null ? this.viewportHeight >= px : true;
      }
      case "max-height": {
        const px = parsePx(rawValue);
        return px !== null ? this.viewportHeight <= px : true;
      }
      case "orientation": {
        if (rawValue === "landscape") return this.viewportWidth > this.viewportHeight;
        if (rawValue === "portrait") return this.viewportHeight >= this.viewportWidth;
        return true;
      }
      default:
        // Unknown feature — progressive enhancement
        return true;
    }
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
