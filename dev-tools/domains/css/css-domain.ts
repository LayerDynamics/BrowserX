/**
 * CSS Domain Agent
 *
 * Provides stylesheet inspection, computed styles, and CSS rule matching.
 * Hooks into RenderingPipeline's CSSOM and StyleResolver.
 */

import type { DomainName } from "../../protocol/types.ts";
import { BaseDomain } from "../base-domain.ts";
import type { DOMElement } from "../../../browser/src/types/dom.ts";
import type { CSSStyleSheet, CSSRule } from "../../../browser/src/types/css.ts";
import type { NodeID } from "../../../browser/src/types/identifiers.ts";
import type {
    StyleSheetID,
    CSSStyleSheetHeader,
    CSSComputedStyleProperty,
    CSSRuleMatch,
    CSSRuleDescription,
    CSSStyleDescription,
    GetComputedStyleParams,
    GetComputedStyleResult,
    GetMatchedStylesParams,
    GetMatchedStylesResult,
    GetStyleSheetTextParams,
    GetStyleSheetTextResult,
    GetAllStyleSheetsResult,
    ForcePseudoStateParams,
} from "./css-types.ts";

/**
 * CSS Domain - stylesheet and computed style inspection
 */
export class CSSDomain extends BaseDomain {
    readonly name: DomainName = "CSS";

    /** Stylesheet map for fast lookups */
    private styleSheets: Map<StyleSheetID, CSSStyleSheet> = new Map();
    private styleSheetCounter: number = 0;
    private forcedPseudoStates: Map<NodeID, string[]> = new Map();

    protected setup(): void {
        this.registerMethod("getComputedStyleForNode", "Get computed style for a node", async (params) => {
            return await this.getComputedStyleForNode(params as unknown as GetComputedStyleParams);
        });

        this.registerMethod("getMatchedStylesForNode", "Get matched CSS rules for a node", async (params) => {
            return await this.getMatchedStylesForNode(params as unknown as GetMatchedStylesParams);
        });

        this.registerMethod("getStyleSheetText", "Get stylesheet text", async (params) => {
            return await this.getStyleSheetText(params as unknown as GetStyleSheetTextParams);
        });

        this.registerMethod("getAllStyleSheets", "Get all stylesheet headers", async () => {
            return await this.getAllStyleSheets();
        });

        this.registerMethod("forcePseudoState", "Force pseudo state on element", async (params) => {
            return await this.forcePseudoState(params as unknown as ForcePseudoStateParams);
        });

        // Register events
        this.registerEvent("styleSheetAdded", "New stylesheet added");
        this.registerEvent("styleSheetRemoved", "Stylesheet removed");
        this.registerEvent("styleSheetChanged", "Stylesheet content changed");
    }

    override async enable(): Promise<Record<string, unknown>> {
        await super.enable();
        this.collectStyleSheets();

        // Emit styleSheetAdded for all existing stylesheets
        for (const [id, sheet] of this.styleSheets) {
            this.emitEvent("styleSheetAdded", {
                header: this.buildHeader(id, sheet),
            });
        }

        return {};
    }

    /**
     * Collect stylesheets from the CSSOM
     */
    private collectStyleSheets(): void {
        this.styleSheets.clear();
        this.styleSheetCounter = 0;

        const pipeline = this.context.renderingPipeline;
        const stats = pipeline.getStats();
        if (stats && typeof stats === "object" && "lastRenderResult" in stats) {
            const result = (stats as Record<string, unknown>).lastRenderResult;
            if (result && typeof result === "object" && "cssom" in result) {
                const cssom = (result as Record<string, unknown>).cssom;
                if (cssom && typeof cssom === "object" && "getStyleSheets" in cssom) {
                    const sheets = (cssom as { getStyleSheets(): CSSStyleSheet[] }).getStyleSheets();
                    for (const sheet of sheets) {
                        const id = `sheet-${++this.styleSheetCounter}`;
                        this.styleSheets.set(id, sheet);
                    }
                }
            }
        }
    }

    /**
     * Build a stylesheet header from a CSSStyleSheet
     */
    private buildHeader(id: StyleSheetID, sheet: CSSStyleSheet): CSSStyleSheetHeader {
        return {
            styleSheetId: id,
            sourceURL: sheet.href || "",
            origin: "regular",
            title: "",
            disabled: sheet.disabled,
            isInline: !sheet.href,
            length: sheet.rules.length,
        };
    }

    /**
     * Get a DOM element from the DOM domain's node map via event bus
     */
    private getElementByNodeId(nodeId: NodeID): DOMElement | null {
        // Use event bus to request node from DOM domain
        let element: DOMElement | null = null;
        this.eventBus.emit("dom:getNode", {
            nodeId,
            callback: (node: unknown) => {
                if (node && typeof node === "object" && "nodeType" in node) {
                    const domNode = node as { nodeType: number };
                    if (domNode.nodeType === 1) {
                        element = node as DOMElement;
                    }
                }
            },
        });
        return element;
    }

    /**
     * Convert a CSS rule to protocol format
     */
    private serializeRule(rule: CSSRule, sheetId?: StyleSheetID): CSSRuleDescription {
        return {
            styleSheetId: sheetId,
            selectorList: {
                selectors: rule.selectorList.map((sel) => ({
                    text: sel.text,
                    specificity: sel.specificity,
                })),
                text: rule.selectorList.map((sel) => sel.text).join(", "),
            },
            origin: "regular",
            style: {
                styleSheetId: sheetId,
                cssProperties: rule.declarations.map((decl) => ({
                    name: decl.property,
                    value: decl.value,
                    important: decl.important,
                })),
                shorthandEntries: [],
            },
        };
    }

    private async getComputedStyleForNode(
        params: GetComputedStyleParams,
    ): Promise<GetComputedStyleResult> {
        const element = this.getElementByNodeId(params.nodeId);
        const computedStyle: CSSComputedStyleProperty[] = [];

        if (element && element.__computedStyle) {
            const style = element.__computedStyle;
            if (style.properties instanceof Map) {
                for (const [name, value] of style.properties) {
                    computedStyle.push({ name, value });
                }
            } else if (typeof style.getPropertyNames === "function") {
                const names = style.getPropertyNames();
                for (const name of names) {
                    computedStyle.push({
                        name,
                        value: style.getPropertyValue(name),
                    });
                }
            }
        }

        return { computedStyle };
    }

    private async getMatchedStylesForNode(
        params: GetMatchedStylesParams,
    ): Promise<GetMatchedStylesResult> {
        const element = this.getElementByNodeId(params.nodeId);
        const matchedCSSRules: CSSRuleMatch[] = [];

        if (element) {
            for (const [sheetId, sheet] of this.styleSheets) {
                const matchingRules = sheet.getMatchingRules(element);
                for (const rule of matchingRules) {
                    const matchingSelectors: number[] = [];
                    rule.selectorList.forEach((sel, idx) => {
                        if (sel.matches(element)) {
                            matchingSelectors.push(idx);
                        }
                    });

                    matchedCSSRules.push({
                        rule: this.serializeRule(rule, sheetId),
                        matchingSelectors,
                    });
                }
            }
        }

        // Build inline style
        let inlineStyle: CSSStyleDescription | undefined;
        if (element && element.attributes instanceof Map) {
            const styleAttr = element.getAttribute("style");
            if (styleAttr) {
                const props = styleAttr.split(";").filter(Boolean).map((decl) => {
                    const [name, ...rest] = decl.split(":");
                    const value = rest.join(":").trim();
                    return {
                        name: name.trim(),
                        value: value.replace(/!important/i, "").trim(),
                        important: /!important/i.test(value),
                    };
                });
                inlineStyle = {
                    cssProperties: props,
                    shorthandEntries: [],
                    cssText: styleAttr,
                };
            }
        }

        return { matchedCSSRules, inlineStyle };
    }

    private async getStyleSheetText(params: GetStyleSheetTextParams): Promise<GetStyleSheetTextResult> {
        const sheet = this.styleSheets.get(params.styleSheetId);
        if (!sheet) {
            throw new Error(`Stylesheet ${params.styleSheetId} not found`);
        }

        // Reconstruct CSS text from rules
        const text = sheet.rules
            .map((rule) => {
                const selectors = rule.selectorList.map((s) => s.text).join(", ");
                const declarations = rule.declarations
                    .map((d) => `  ${d.property}: ${d.value}${d.important ? " !important" : ""};`)
                    .join("\n");
                return `${selectors} {\n${declarations}\n}`;
            })
            .join("\n\n");

        return { text };
    }

    private async getAllStyleSheets(): Promise<GetAllStyleSheetsResult> {
        this.collectStyleSheets();
        const headers: CSSStyleSheetHeader[] = [];
        for (const [id, sheet] of this.styleSheets) {
            headers.push(this.buildHeader(id, sheet));
        }
        return { headers };
    }

    private async forcePseudoState(params: ForcePseudoStateParams): Promise<Record<string, unknown>> {
        this.forcedPseudoStates.set(params.nodeId, params.forcedPseudoClasses);
        return {};
    }

    override dispose(): void {
        this.styleSheets.clear();
        this.forcedPseudoStates.clear();
        super.dispose();
    }
}
