/**
 * CSS Parser
 * Parses CSS tokens into stylesheet with rules, selectors, and declarations.
 * Implements CSS selector specificity calculation and matching.
 */

import { CSSToken, CSSTokenType } from "./CSSTokenizer.ts";
import type {
    CSSDeclaration,
    CSSRule,
    CSSSelector,
    CSSStyleSheet,
    Specificity,
} from "../../../types/css.ts";
import type { DOMElement } from "../../../types/dom.ts";

/**
 * CSS Selector implementation
 */
class Selector implements CSSSelector {
    text: string;
    specificity: Specificity;
    private parts: SelectorPart[];

    constructor(text: string, parts: SelectorPart[]) {
        this.text = text;
        this.parts = parts;
        this.specificity = this.calculateSpecificity();
    }

    /**
     * Check if selector matches element
     */
    matches(element: DOMElement): boolean {
        // Start from rightmost part (most specific)
        let currentElement: DOMElement | null = element;
        let partIndex = this.parts.length - 1;

        while (partIndex >= 0 && currentElement) {
            const part = this.parts[partIndex];

            if (!this.matchesPart(part, currentElement)) {
                return false;
            }

            // Move to next part based on combinator
            if (partIndex > 0) {
                const combinator = this.parts[partIndex - 1].combinator;
                currentElement = this.findMatchingAncestor(currentElement, combinator);
                partIndex--;
            } else {
                partIndex--;
            }
        }

        return partIndex < 0;
    }

    /**
     * Check if single selector part matches element
     */
    private matchesPart(part: SelectorPart, element: DOMElement): boolean {
        // Match type selector
        if (part.type && part.type !== "*") {
            if (element.tagName?.toLowerCase() !== part.type.toLowerCase()) {
                return false;
            }
        }

        // Match ID
        if (part.id) {
            const id = element.attributes?.get("id");
            if (id !== part.id) {
                return false;
            }
        }

        // Match classes
        if (part.classes.length > 0) {
            const classList = element.attributes?.get("class")?.split(/\s+/) || [];
            for (const className of part.classes) {
                if (!classList.includes(className)) {
                    return false;
                }
            }
        }

        // Match attributes
        for (const attr of part.attributes) {
            const attrValue = element.attributes?.get(attr.name);

            if (!attr.operator) {
                // [attr] - just check existence
                if (attrValue === undefined) {
                    return false;
                }
            } else if (attr.operator === "=") {
                // [attr=value]
                if (attrValue !== attr.value) {
                    return false;
                }
            } else if (attr.operator === "~=") {
                // [attr~=value] - word match
                const words = attrValue?.split(/\s+/) || [];
                if (!words.includes(attr.value || "")) {
                    return false;
                }
            } else if (attr.operator === "|=") {
                // [attr|=value] - starts with value-
                if (!attrValue?.startsWith(attr.value + "-") && attrValue !== attr.value) {
                    return false;
                }
            } else if (attr.operator === "^=") {
                // [attr^=value] - starts with
                if (!attrValue?.startsWith(attr.value || "")) {
                    return false;
                }
            } else if (attr.operator === "$=") {
                // [attr$=value] - ends with
                if (!attrValue?.endsWith(attr.value || "")) {
                    return false;
                }
            } else if (attr.operator === "*=") {
                // [attr*=value] - contains
                if (!attrValue?.includes(attr.value || "")) {
                    return false;
                }
            }
        }

        // TODO: Match pseudo-classes (:hover, :first-child, etc.)
        // TODO: Match pseudo-elements (::before, ::after, etc.)

        return true;
    }

    /**
     * Find matching ancestor based on combinator
     */
    private findMatchingAncestor(element: DOMElement, combinator?: string): DOMElement | null {
        if (!combinator || combinator === " ") {
            // Descendant combinator - any ancestor
            return element.parentElement || null;
        } else if (combinator === ">") {
            // Child combinator - direct parent only
            return element.parentElement || null;
        } else if (combinator === "+") {
            // Adjacent sibling combinator
            return element.previousElementSibling || null;
        } else if (combinator === "~") {
            // General sibling combinator
            return element.previousElementSibling || null;
        }
        return null;
    }

    /**
     * Calculate selector specificity [inline, id, class, element]
     */
    private calculateSpecificity(): Specificity {
        let idCount = 0;
        let classCount = 0;
        let elementCount = 0;

        for (const part of this.parts) {
            if (part.id) {
                idCount++;
            }
            classCount += part.classes.length;
            classCount += part.attributes.length;
            classCount += part.pseudoClasses.length;

            if (part.type && part.type !== "*") {
                elementCount++;
            }
            elementCount += part.pseudoElements.length;
        }

        return [0, idCount, classCount, elementCount]; // inline is 0 (not from stylesheet)
    }
}

/**
 * Selector part (simple selector)
 */
interface SelectorPart {
    type?: string; // Element type (div, span, etc.) or * for universal
    id?: string; // ID selector (#foo)
    classes: string[]; // Class selectors (.foo .bar)
    attributes: AttributeSelector[]; // Attribute selectors ([attr=value])
    pseudoClasses: string[]; // Pseudo-classes (:hover, :first-child)
    pseudoElements: string[]; // Pseudo-elements (::before, ::after)
    combinator?: string; // Combinator to previous part (space, >, +, ~)
}

/**
 * Attribute selector
 */
interface AttributeSelector {
    name: string;
    operator?: string; // =, ~=, |=, ^=, $=, *=
    value?: string;
}

/**
 * CSS StyleSheet implementation
 */
class StyleSheet implements CSSStyleSheet {
    href: string | null = null;
    ownerNode: DOMElement | null = null;
    rules: CSSRule[] = [];
    disabled: boolean = false;

    insertRule(rule: string, index: number): number {
        // TODO: Parse rule string and insert
        throw new Error("insertRule not implemented");
    }

    deleteRule(index: number): void {
        this.rules.splice(index, 1);
    }

    getMatchingRules(element: DOMElement): CSSRule[] {
        if (this.disabled) {
            return [];
        }

        const matchingRules: CSSRule[] = [];

        for (const rule of this.rules) {
            for (const selector of rule.selectorList) {
                if (selector.matches(element)) {
                    matchingRules.push(rule);
                    break; // Only add rule once even if multiple selectors match
                }
            }
        }

        return matchingRules;
    }
}

export class CSSParser {
    private tokens: CSSToken[] = [];
    private position: number = 0;

    /**
     * Parse CSS tokens into stylesheet
     */
    parse(tokens: CSSToken[]): CSSStyleSheet {
        this.tokens = tokens;
        this.position = 0;

        const stylesheet = new StyleSheet();

        while (!this.isAtEnd()) {
            this.consumeWhitespace();

            if (this.isAtEnd()) {
                break;
            }

            const token = this.current();

            // Handle at-rules
            if (token.type === CSSTokenType.AT_KEYWORD) {
                this.parseAtRule();
                continue;
            }

            // Handle comments
            if (token.type === CSSTokenType.COMMENT) {
                this.advance();
                continue;
            }

            // Parse style rule
            const rule = this.parseRule();
            if (rule) {
                stylesheet.rules.push(rule);
            }
        }

        return stylesheet;
    }

    /**
     * Parse a CSS rule (selector list + declarations)
     */
    private parseRule(): CSSRule | null {
        // Parse selector list
        const selectorList = this.parseSelectorList();
        if (selectorList.length === 0) {
            return null;
        }

        // Expect opening brace
        this.consumeWhitespace();
        if (!this.match(CSSTokenType.LEFT_BRACE)) {
            this.skipToNextRule();
            return null;
        }

        // Parse declarations
        const declarations = this.parseDeclarations();

        // Expect closing brace
        this.consumeWhitespace();
        if (!this.match(CSSTokenType.RIGHT_BRACE)) {
            this.skipToNextRule();
            return null;
        }

        // Calculate maximum specificity
        let maxSpecificity: Specificity = [0, 0, 0, 0];
        for (const selector of selectorList) {
            if (this.compareSpecificity(selector.specificity, maxSpecificity) > 0) {
                maxSpecificity = selector.specificity;
            }
        }

        return {
            selectorList,
            declarations,
            specificity: maxSpecificity,
        };
    }

    /**
     * Parse selector list (comma-separated selectors)
     */
    private parseSelectorList(): CSSSelector[] {
        const selectors: CSSSelector[] = [];

        while (!this.isAtEnd()) {
            const selector = this.parseSelector();
            if (selector) {
                selectors.push(selector);
            }

            this.consumeWhitespace();

            if (this.match(CSSTokenType.COMMA)) {
                this.consumeWhitespace();
                continue;
            }

            break;
        }

        return selectors;
    }

    /**
     * Parse single selector (compound selector with combinators)
     */
    private parseSelector(): CSSSelector | null {
        const parts: SelectorPart[] = [];
        let selectorText = "";

        while (!this.isAtEnd()) {
            this.consumeWhitespace();
            const token = this.current();

            // Stop at comma, brace, or EOF
            if (
                token.type === CSSTokenType.COMMA ||
                token.type === CSSTokenType.LEFT_BRACE ||
                token.type === CSSTokenType.EOF
            ) {
                break;
            }

            const part = this.parseSelectorPart();
            if (part) {
                parts.push(part);
                selectorText += this.getPartText(part);
            }
        }

        if (parts.length === 0) {
            return null;
        }

        return new Selector(selectorText.trim(), parts);
    }

    /**
     * Parse single selector part (simple selector)
     */
    private parseSelectorPart(): SelectorPart | null {
        const part: SelectorPart = {
            classes: [],
            attributes: [],
            pseudoClasses: [],
            pseudoElements: [],
        };

        let hasContent = false;

        while (!this.isAtEnd()) {
            const token = this.current();

            // Type selector or universal selector
            if (token.type === CSSTokenType.IDENT) {
                if (!part.type) {
                    part.type = token.value;
                    this.advance();
                    hasContent = true;
                } else {
                    break; // Start of next part
                }
            } // Universal selector
            else if (token.type === CSSTokenType.DELIM && token.value === "*") {
                if (!part.type) {
                    part.type = "*";
                    this.advance();
                    hasContent = true;
                } else {
                    break;
                }
            } // ID selector
            else if (token.type === CSSTokenType.HASH) {
                part.id = token.value.substring(1); // Remove #
                this.advance();
                hasContent = true;
            } // Class selector
            else if (token.type === CSSTokenType.DELIM && token.value === ".") {
                this.advance();
                if (this.current().type === CSSTokenType.IDENT) {
                    part.classes.push(this.current().value);
                    this.advance();
                    hasContent = true;
                }
            } // Attribute selector
            else if (token.type === CSSTokenType.LEFT_BRACKET) {
                const attr = this.parseAttributeSelector();
                if (attr) {
                    part.attributes.push(attr);
                    hasContent = true;
                }
            } // Pseudo-class or pseudo-element
            else if (token.type === CSSTokenType.COLON) {
                this.advance();

                // Check for :: (pseudo-element)
                if (this.current().type === CSSTokenType.COLON) {
                    this.advance();
                    if (this.current().type === CSSTokenType.IDENT) {
                        part.pseudoElements.push(this.current().value);
                        this.advance();
                        hasContent = true;
                    }
                } else if (this.current().type === CSSTokenType.IDENT) {
                    // Pseudo-class
                    part.pseudoClasses.push(this.current().value);
                    this.advance();
                    hasContent = true;
                } else if (this.current().type === CSSTokenType.FUNCTION) {
                    // Functional pseudo-class like :nth-child(2n)
                    part.pseudoClasses.push(this.current().value);
                    this.advance();
                    // Skip function arguments
                    this.skipUntil(CSSTokenType.RIGHT_PAREN);
                    this.advance();
                    hasContent = true;
                }
            } // Combinator
            else if (
                token.type === CSSTokenType.DELIM &&
                (token.value === ">" || token.value === "+" || token.value === "~")
            ) {
                part.combinator = token.value;
                this.advance();
                break;
            } // Whitespace can be descendant combinator
            else if (token.type === CSSTokenType.WHITESPACE) {
                this.advance();
                // Check if followed by another selector part
                const next = this.current();
                if (
                    next.type !== CSSTokenType.COMMA &&
                    next.type !== CSSTokenType.LEFT_BRACE &&
                    next.type !== CSSTokenType.EOF
                ) {
                    part.combinator = " "; // Descendant combinator
                }
                break;
            } else {
                break;
            }
        }

        return hasContent ? part : null;
    }

    /**
     * Parse attribute selector
     */
    private parseAttributeSelector(): AttributeSelector | null {
        // Skip [
        this.advance();
        this.consumeWhitespace();

        // Get attribute name
        if (this.current().type !== CSSTokenType.IDENT) {
            this.skipUntil(CSSTokenType.RIGHT_BRACKET);
            this.advance();
            return null;
        }

        const name = this.current().value;
        this.advance();
        this.consumeWhitespace();

        // Check for operator
        const token = this.current();
        let operator: string | undefined;
        let value: string | undefined;

        if (
            token.type === CSSTokenType.DELIM &&
            ["=", "~", "|", "^", "$", "*"].includes(token.value)
        ) {
            operator = token.value;
            this.advance();

            // Check for compound operators like ~=, |=, etc.
            if (this.current().type === CSSTokenType.DELIM && this.current().value === "=") {
                operator += "=";
                this.advance();
            }

            this.consumeWhitespace();

            // Get value
            if (this.current().type === CSSTokenType.STRING) {
                value = this.current().value;
                this.advance();
            } else if (this.current().type === CSSTokenType.IDENT) {
                value = this.current().value;
                this.advance();
            }
        }

        // Skip to ]
        this.consumeWhitespace();
        if (this.current().type === CSSTokenType.RIGHT_BRACKET) {
            this.advance();
        }

        return { name, operator, value };
    }

    /**
     * Parse declaration block
     */
    private parseDeclarations(): CSSDeclaration[] {
        const declarations: CSSDeclaration[] = [];

        while (!this.isAtEnd()) {
            this.consumeWhitespace();

            const token = this.current();

            // Stop at closing brace
            if (token.type === CSSTokenType.RIGHT_BRACE || token.type === CSSTokenType.EOF) {
                break;
            }

            // Handle comments
            if (token.type === CSSTokenType.COMMENT) {
                this.advance();
                continue;
            }

            // Parse declaration
            const declaration = this.parseDeclaration();
            if (declaration) {
                declarations.push(declaration);
            }

            // Skip semicolon
            if (this.current().type === CSSTokenType.SEMICOLON) {
                this.advance();
            }
        }

        return declarations;
    }

    /**
     * Parse single declaration (property: value)
     */
    private parseDeclaration(): CSSDeclaration | null {
        this.consumeWhitespace();

        // Get property name
        if (this.current().type !== CSSTokenType.IDENT) {
            return null;
        }

        const property = this.current().value;
        this.advance();
        this.consumeWhitespace();

        // Expect colon
        if (!this.match(CSSTokenType.COLON)) {
            this.skipToNextDeclaration();
            return null;
        }

        this.consumeWhitespace();

        // Get value tokens until semicolon or closing brace
        const valueTokens: string[] = [];
        let important = false;

        while (!this.isAtEnd()) {
            const token = this.current();

            if (
                token.type === CSSTokenType.SEMICOLON ||
                token.type === CSSTokenType.RIGHT_BRACE ||
                token.type === CSSTokenType.EOF
            ) {
                break;
            }

            // Check for !important
            if (token.type === CSSTokenType.DELIM && token.value === "!") {
                this.advance();
                this.consumeWhitespace();
                if (
                    this.current().type === CSSTokenType.IDENT &&
                    this.current().value === "important"
                ) {
                    important = true;
                    this.advance();
                    break;
                }
            }

            // Add token to value
            if (token.type !== CSSTokenType.WHITESPACE) {
                valueTokens.push(this.getTokenValue(token));
            } else {
                // Preserve single space
                if (valueTokens.length > 0) {
                    valueTokens.push(" ");
                }
            }

            this.advance();
        }

        const value = valueTokens.join("").trim();

        if (!value) {
            return null;
        }

        return {
            property,
            value,
            important,
        };
    }

    /**
     * Parse at-rule (@media, @import, @keyframes, etc.)
     */
    private parseAtRule(): void {
        // For now, skip at-rules
        // TODO: Implement @media, @import, @keyframes, @font-face, etc.

        const atKeyword = this.current().value;
        this.advance();

        // Skip until we find opening brace or semicolon
        while (!this.isAtEnd()) {
            const token = this.current();

            if (token.type === CSSTokenType.SEMICOLON) {
                this.advance();
                return;
            }

            if (token.type === CSSTokenType.LEFT_BRACE) {
                // Skip entire block
                this.skipBlock();
                return;
            }

            this.advance();
        }
    }

    /**
     * Skip to next rule
     */
    private skipToNextRule(): void {
        while (!this.isAtEnd()) {
            const token = this.current();

            if (token.type === CSSTokenType.RIGHT_BRACE) {
                this.advance();
                return;
            }

            if (token.type === CSSTokenType.SEMICOLON) {
                this.advance();
                return;
            }

            this.advance();
        }
    }

    /**
     * Skip to next declaration
     */
    private skipToNextDeclaration(): void {
        while (!this.isAtEnd()) {
            const token = this.current();

            if (token.type === CSSTokenType.SEMICOLON) {
                this.advance();
                return;
            }

            if (token.type === CSSTokenType.RIGHT_BRACE) {
                return;
            }

            this.advance();
        }
    }

    /**
     * Skip until token type
     */
    private skipUntil(type: CSSTokenType): void {
        while (!this.isAtEnd() && this.current().type !== type) {
            this.advance();
        }
    }

    /**
     * Skip block (everything between { and })
     */
    private skipBlock(): void {
        let depth = 0;

        while (!this.isAtEnd()) {
            const token = this.current();

            if (token.type === CSSTokenType.LEFT_BRACE) {
                depth++;
            } else if (token.type === CSSTokenType.RIGHT_BRACE) {
                depth--;
                if (depth === 0) {
                    this.advance();
                    return;
                }
            }

            this.advance();
        }
    }

    /**
     * Consume whitespace tokens
     */
    private consumeWhitespace(): void {
        while (!this.isAtEnd() && this.current().type === CSSTokenType.WHITESPACE) {
            this.advance();
        }
    }

    /**
     * Check if current token matches type
     */
    private match(type: CSSTokenType): boolean {
        if (this.current().type === type) {
            this.advance();
            return true;
        }
        return false;
    }

    /**
     * Get current token
     */
    private current(): CSSToken {
        return this.tokens[this.position];
    }

    /**
     * Advance to next token
     */
    private advance(): void {
        if (!this.isAtEnd()) {
            this.position++;
        }
    }

    /**
     * Check if at end of tokens
     */
    private isAtEnd(): boolean {
        return this.position >= this.tokens.length ||
            this.current().type === CSSTokenType.EOF;
    }

    /**
     * Get token value as string
     */
    private getTokenValue(token: CSSToken): string {
        if (token.unit) {
            return token.value + token.unit;
        }
        return token.value;
    }

    /**
     * Get text representation of selector part
     */
    private getPartText(part: SelectorPart): string {
        let text = "";

        if (part.type) {
            text += part.type;
        }

        if (part.id) {
            text += "#" + part.id;
        }

        for (const className of part.classes) {
            text += "." + className;
        }

        for (const attr of part.attributes) {
            text += "[" + attr.name;
            if (attr.operator) {
                text += attr.operator + (attr.value || "");
            }
            text += "]";
        }

        for (const pseudo of part.pseudoClasses) {
            text += ":" + pseudo;
        }

        for (const pseudo of part.pseudoElements) {
            text += "::" + pseudo;
        }

        if (part.combinator) {
            text += " " + part.combinator + " ";
        }

        return text;
    }

    /**
     * Compare specificity values
     * Returns: 1 if a > b, -1 if a < b, 0 if equal
     */
    private compareSpecificity(a: Specificity, b: Specificity): number {
        for (let i = 0; i < 4; i++) {
            if (a[i] > b[i]) return 1;
            if (a[i] < b[i]) return -1;
        }
        return 0;
    }
}
