/**
 * CSS Parser
 * Parses CSS tokens into stylesheet with rules, selectors, and declarations.
 * Implements CSS selector specificity calculation and matching.
 */

import { CSSToken, CSSTokenizer, CSSTokenType } from "./CSSTokenizer.ts";
import type {
  CSSDeclaration,
  CSSRule,
  CSSSelector,
  CSSStyleSheet,
  Specificity,
} from "../../../types/css.ts";
import type { DOMElement, DOMNode } from "../../../types/dom.ts";

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

    // Match pseudo-classes
    for (const pseudo of part.pseudoClasses) {
      if (!this.matchesPseudoClass(pseudo, element)) {
        return false;
      }
    }

    // Pseudo-elements (::before, ::after) are handled separately in rendering
    // They don't affect element matching but create additional render boxes

    return true;
  }

  /**
   * Check if element matches a pseudo-class
   */
  private matchesPseudoClass(pseudo: string, element: DOMElement): boolean {
    // Handle functional pseudo-classes with arguments
    const funcMatch = pseudo.match(/^(\w+)\((.+)\)$/);
    if (funcMatch) {
      return this.matchesFunctionalPseudoClass(funcMatch[1], funcMatch[2], element);
    }

    // Simple pseudo-classes
    switch (pseudo.toLowerCase()) {
      // Structural pseudo-classes
      case "root":
        return element.tagName?.toLowerCase() === "html";

      case "empty":
        return this.isElementEmpty(element);

      case "first-child":
        return this.isFirstChild(element);

      case "last-child":
        return this.isLastChild(element);

      case "only-child":
        return this.isOnlyChild(element);

      case "first-of-type":
        return this.isFirstOfType(element);

      case "last-of-type":
        return this.isLastOfType(element);

      case "only-of-type":
        return this.isOnlyOfType(element);

      // Link pseudo-classes
      case "link":
        return element.tagName?.toLowerCase() === "a" &&
          element.attributes?.has("href");

      case "visited":
        // Always false for privacy reasons
        return false;

      // User action pseudo-classes (require state tracking)
      case "hover":
      case "active":
      case "focus":
      case "focus-within":
      case "focus-visible":
        // These require runtime state - always false during static matching
        return element.attributes?.get(`data-${pseudo}`) === "true";

      // Input pseudo-classes
      case "enabled":
        return !element.attributes?.has("disabled");

      case "disabled":
        return element.attributes?.has("disabled");

      case "checked":
        return element.attributes?.has("checked");

      case "indeterminate":
        return element.attributes?.get("data-indeterminate") === "true";

      case "required":
        return element.attributes?.has("required");

      case "optional":
        return !element.attributes?.has("required");

      case "read-only":
        return element.attributes?.has("readonly") ||
          element.attributes?.get("contenteditable") === "false";

      case "read-write":
        return !element.attributes?.has("readonly") &&
          element.attributes?.get("contenteditable") !== "false";

      case "valid":
      case "invalid":
      case "in-range":
      case "out-of-range":
        // Form validation - would need form state
        return false;

      case "target":
        // URL fragment target - would need current URL
        return element.attributes?.get("id") ===
          element.attributes?.get("data-target-fragment");

      default:
        // Unknown pseudo-class - don't match
        return false;
    }
  }

  /**
   * Handle functional pseudo-classes like :nth-child(2n+1)
   */
  private matchesFunctionalPseudoClass(
    func: string,
    arg: string,
    element: DOMElement,
  ): boolean {
    switch (func.toLowerCase()) {
      case "nth-child":
        return this.matchesNthChild(arg, element, false);

      case "nth-last-child":
        return this.matchesNthChild(arg, element, true);

      case "nth-of-type":
        return this.matchesNthOfType(arg, element, false);

      case "nth-last-of-type":
        return this.matchesNthOfType(arg, element, true);

      case "not":
        return !this.matchesNestedSelector(arg, element);

      case "is":
      case "where":
      case "matches":
        return this.matchesNestedSelector(arg, element);

      case "has":
        return this.matchesHas(arg, element);

      case "lang":
        return this.matchesLang(arg, element);

      default:
        return false;
    }
  }

  /**
   * Check if element is empty (no children or text content)
   */
  private isElementEmpty(element: DOMElement): boolean {
    if (!element.childNodes) return true;
    for (const child of element.childNodes) {
      if (child.nodeType === 1) return false; // Element node
      if (child.nodeType === 3 && child.nodeValue?.trim()) {
        return false; // Non-empty text node
      }
    }
    return true;
  }

  /**
   * Get siblings of element
   */
  private getSiblings(element: DOMElement): DOMElement[] {
    const parent = element.parentElement;
    if (!parent?.childNodes) return [];
    return parent.childNodes.filter((c: DOMNode) => c.nodeType === 1) as DOMElement[];
  }

  /**
   * Check if element is first child
   */
  private isFirstChild(element: DOMElement): boolean {
    const siblings = this.getSiblings(element);
    return siblings[0] === element;
  }

  /**
   * Check if element is last child
   */
  private isLastChild(element: DOMElement): boolean {
    const siblings = this.getSiblings(element);
    return siblings[siblings.length - 1] === element;
  }

  /**
   * Check if element is only child
   */
  private isOnlyChild(element: DOMElement): boolean {
    const siblings = this.getSiblings(element);
    return siblings.length === 1 && siblings[0] === element;
  }

  /**
   * Get same-type siblings
   */
  private getSameTypeSiblings(element: DOMElement): DOMElement[] {
    const siblings = this.getSiblings(element);
    return siblings.filter(
      (s) => s.tagName?.toLowerCase() === element.tagName?.toLowerCase(),
    );
  }

  /**
   * Check if element is first of its type
   */
  private isFirstOfType(element: DOMElement): boolean {
    const sameType = this.getSameTypeSiblings(element);
    return sameType[0] === element;
  }

  /**
   * Check if element is last of its type
   */
  private isLastOfType(element: DOMElement): boolean {
    const sameType = this.getSameTypeSiblings(element);
    return sameType[sameType.length - 1] === element;
  }

  /**
   * Check if element is only of its type
   */
  private isOnlyOfType(element: DOMElement): boolean {
    const sameType = this.getSameTypeSiblings(element);
    return sameType.length === 1 && sameType[0] === element;
  }

  /**
   * Parse nth-child formula (e.g., "2n+1", "odd", "even", "3")
   * Returns [a, b] for an+b formula
   */
  private parseNthFormula(formula: string): [number, number] {
    const f = formula.trim().toLowerCase();

    if (f === "odd") return [2, 1];
    if (f === "even") return [2, 0];

    // Simple number
    if (/^-?\d+$/.test(f)) {
      return [0, parseInt(f, 10)];
    }

    // an+b or an-b format
    const match = f.match(/^(-?\d*)n([+-]\d+)?$/);
    if (match) {
      let a = match[1] === "" || match[1] === "+"
        ? 1
        : match[1] === "-"
        ? -1
        : parseInt(match[1], 10);
      const b = match[2] ? parseInt(match[2], 10) : 0;
      return [a, b];
    }

    // n+b format
    const simpleMatch = f.match(/^n([+-]\d+)?$/);
    if (simpleMatch) {
      return [1, simpleMatch[1] ? parseInt(simpleMatch[1], 10) : 0];
    }

    return [0, 0];
  }

  /**
   * Check if element matches :nth-child() formula
   */
  private matchesNthChild(formula: string, element: DOMElement, fromEnd: boolean): boolean {
    const siblings = this.getSiblings(element);
    let index = siblings.indexOf(element);
    if (index === -1) return false;

    if (fromEnd) {
      index = siblings.length - 1 - index;
    }
    index++; // nth-child is 1-indexed

    const [a, b] = this.parseNthFormula(formula);

    if (a === 0) {
      return index === b;
    }

    // Check if index = an + b for some non-negative integer n
    const diff = index - b;
    if (a > 0) {
      return diff >= 0 && diff % a === 0;
    } else {
      return diff <= 0 && diff % a === 0;
    }
  }

  /**
   * Check if element matches :nth-of-type() formula
   */
  private matchesNthOfType(formula: string, element: DOMElement, fromEnd: boolean): boolean {
    const sameType = this.getSameTypeSiblings(element);
    let index = sameType.indexOf(element);
    if (index === -1) return false;

    if (fromEnd) {
      index = sameType.length - 1 - index;
    }
    index++; // 1-indexed

    const [a, b] = this.parseNthFormula(formula);

    if (a === 0) {
      return index === b;
    }

    const diff = index - b;
    if (a > 0) {
      return diff >= 0 && diff % a === 0;
    } else {
      return diff <= 0 && diff % a === 0;
    }
  }

  /**
   * Check if element matches nested selector (for :not, :is, etc.)
   */
  private matchesNestedSelector(selectorStr: string, element: DOMElement): boolean {
    // Parse selector list (comma-separated)
    const selectors = selectorStr.split(",").map((s) => s.trim());
    for (const sel of selectors) {
      // Create a simple selector matcher for the nested selector
      const parts = this.parseSimpleSelector(sel);
      if (parts && this.matchesPart(parts, element)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Parse a simple selector into a SelectorPart
   */
  private parseSimpleSelector(selector: string): SelectorPart | null {
    const part: SelectorPart = {
      type: undefined,
      id: undefined,
      classes: [],
      attributes: [],
      pseudoClasses: [],
      pseudoElements: [],
    };

    let remaining = selector.trim();
    if (!remaining) return null;

    // Parse type
    const typeMatch = remaining.match(/^([a-zA-Z_][a-zA-Z0-9_-]*|\*)/);
    if (typeMatch) {
      part.type = typeMatch[1];
      remaining = remaining.slice(typeMatch[0].length);
    }

    // Parse ID, classes
    while (remaining) {
      if (remaining.startsWith("#")) {
        const idMatch = remaining.match(/^#([a-zA-Z_][a-zA-Z0-9_-]*)/);
        if (idMatch) {
          part.id = idMatch[1];
          remaining = remaining.slice(idMatch[0].length);
        } else break;
      } else if (remaining.startsWith(".")) {
        const classMatch = remaining.match(/^\.([a-zA-Z_][a-zA-Z0-9_-]*)/);
        if (classMatch) {
          part.classes.push(classMatch[1]);
          remaining = remaining.slice(classMatch[0].length);
        } else break;
      } else if (remaining.startsWith("[")) {
        const attrMatch = remaining.match(/^\[([^\]]+)\]/);
        if (attrMatch) {
          const attrPart = this.parseAttribute(attrMatch[1]);
          if (attrPart) part.attributes.push(attrPart);
          remaining = remaining.slice(attrMatch[0].length);
        } else break;
      } else {
        break;
      }
    }

    return part;
  }

  /**
   * Parse attribute selector like "attr=value"
   */
  private parseAttribute(attrStr: string): AttributeSelector | null {
    const match = attrStr.match(/^([a-zA-Z_][a-zA-Z0-9_-]*)(?:([~|^$*]?=)["']?([^"']*)["']?)?/);
    if (!match) return null;
    return {
      name: match[1],
      operator: match[2],
      value: match[3],
    };
  }

  /**
   * Check if element matches :has() selector
   */
  private matchesHas(selectorStr: string, element: DOMElement): boolean {
    // :has() checks if element has descendants matching selector
    if (!element.childNodes) return false;

    const checkDescendants = (el: DOMElement): boolean => {
      for (const child of el.childNodes || []) {
        if (child.nodeType !== 1) continue;
        const childEl = child as DOMElement;
        if (this.matchesNestedSelector(selectorStr, childEl)) {
          return true;
        }
        if (checkDescendants(childEl)) {
          return true;
        }
      }
      return false;
    };

    return checkDescendants(element);
  }

  /**
   * Check if element matches :lang() pseudo-class
   */
  private matchesLang(lang: string, element: DOMElement): boolean {
    const targetLang = lang.toLowerCase().replace(/["']/g, "");
    let el: DOMElement | null = element;

    while (el) {
      const elLang = el.attributes?.get("lang")?.toLowerCase();
      if (elLang) {
        return elLang === targetLang || elLang.startsWith(targetLang + "-");
      }
      el = el.parentElement || null;
    }

    return false;
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
  mediaRules: import("../../../types/css.ts").CSSMediaRule[] = [];
  disabled: boolean = false;

  insertRule(ruleText: string, index: number = this.rules.length): number {
    // Validate index
    if (index < 0 || index > this.rules.length) {
      throw new DOMException(
        `Failed to execute 'insertRule': The index provided (${index}) is larger than the maximum index (${this.rules.length}).`,
        "IndexSizeError",
      );
    }

    // Parse the rule using CSSParser
    const rule = CSSParser.parseRule(ruleText);
    if (!rule) {
      throw new DOMException(
        `Failed to execute 'insertRule': Failed to parse the rule '${ruleText}'.`,
        "SyntaxError",
      );
    }

    // Insert the rule at the specified index
    this.rules.splice(index, 0, rule);
    return index;
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

  // At-rule storage
  private mediaRules: Array<{ condition: string; rules: CSSRule[] }> = [];
  private keyframeRules: Map<string, Array<{ selector: string; declarations: CSSDeclaration[] }>> =
    new Map();
  private fontFaceRules: Array<CSSDeclaration[]> = [];
  private importUrls: string[] = [];

  /**
   * Parse a single CSS rule from a string
   * Used by StyleSheet.insertRule()
   */
  static parseRule(ruleText: string): CSSRule | null {
    const tokenizer = new CSSTokenizer();
    const tokens = tokenizer.tokenize(ruleText);
    const parser = new CSSParser();
    parser.tokens = tokens;
    parser.position = 0;
    parser.consumeWhitespace();
    return parser.parseRule();
  }

  getMediaRules(): Array<{ condition: string; rules: CSSRule[] }> {
    return this.mediaRules;
  }
  getKeyframeRules(): Map<string, Array<{ selector: string; declarations: CSSDeclaration[] }>> {
    return this.keyframeRules;
  }
  getFontFaceRules(): Array<CSSDeclaration[]> {
    return this.fontFaceRules;
  }
  getImportUrls(): string[] {
    return this.importUrls;
  }

  /**
   * Parse CSS tokens into stylesheet
   */
  parse(tokens: CSSToken[]): CSSStyleSheet {
    this.tokens = tokens;
    this.position = 0;
    this.mediaRules = [];
    this.keyframeRules = new Map();
    this.fontFaceRules = [];
    this.importUrls = [];

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

    // Copy parsed @media rules to the stylesheet so CSSOM can evaluate them
    stylesheet.mediaRules = [...this.mediaRules];

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
    // AT_KEYWORD value includes "@" prefix — strip it for dispatch
    const keyword = this.current().value.slice(1).toLowerCase();
    this.advance();

    switch (keyword) {
      case "import":
        this.parseImportRule();
        break;
      case "media":
        this.parseMediaRule();
        break;
      case "keyframes":
      case "-webkit-keyframes":
      case "-moz-keyframes":
        this.parseKeyframesRule();
        break;
      case "font-face":
        this.parseFontFaceRule();
        break;
      default:
        this.skipAtRuleBody();
        break;
    }
  }

  private parseImportRule(): void {
    this.consumeWhitespace();
    let url = "";
    const token = this.current();
    if (token.type === CSSTokenType.STRING) {
      url = token.value;
      this.advance();
    } else if (token.type === CSSTokenType.FUNCTION && token.value.toLowerCase() === "url") {
      this.advance(); // past FUNCTION
      if (this.current().type === CSSTokenType.LEFT_PAREN) this.advance(); // past (
      this.consumeWhitespace();
      const inner = this.current();
      if (inner.type === CSSTokenType.STRING || inner.type === CSSTokenType.IDENT) {
        url = inner.value;
        this.advance();
      }
      this.consumeWhitespace();
      if (this.current().type === CSSTokenType.RIGHT_PAREN) this.advance();
    }
    if (url) this.importUrls.push(url);
    this.consumeWhitespace();
    if (this.current().type === CSSTokenType.SEMICOLON) this.advance();
  }

  private parseMediaRule(): void {
    const conditionParts: string[] = [];
    while (!this.isAtEnd()) {
      this.consumeWhitespace();
      const token = this.current();
      if (token.type === CSSTokenType.LEFT_BRACE) break;
      if (token.type === CSSTokenType.EOF || token.type === CSSTokenType.SEMICOLON) return;
      conditionParts.push(this.getTokenValue(token));
      this.advance();
    }
    const condition = conditionParts.join(" ").trim();
    if (!this.match(CSSTokenType.LEFT_BRACE)) return;
    const rules: CSSRule[] = [];
    while (!this.isAtEnd()) {
      this.consumeWhitespace();
      const token = this.current();
      if (token.type === CSSTokenType.RIGHT_BRACE || token.type === CSSTokenType.EOF) break;
      if (token.type === CSSTokenType.COMMENT) {
        this.advance();
        continue;
      }
      if (token.type === CSSTokenType.AT_KEYWORD) {
        this.skipAtRuleBody();
        continue;
      }
      const rule = this.parseRule();
      if (rule) rules.push(rule);
    }
    if (this.current().type === CSSTokenType.RIGHT_BRACE) this.advance();
    this.mediaRules.push({ condition, rules });
  }

  private parseKeyframesRule(): void {
    this.consumeWhitespace();
    const nameToken = this.current();
    if (nameToken.type !== CSSTokenType.IDENT && nameToken.type !== CSSTokenType.STRING) {
      this.skipAtRuleBody();
      return;
    }
    const name = nameToken.value;
    this.advance();
    this.consumeWhitespace();
    if (!this.match(CSSTokenType.LEFT_BRACE)) {
      this.skipAtRuleBody();
      return;
    }
    const frames: Array<{ selector: string; declarations: CSSDeclaration[] }> = [];
    while (!this.isAtEnd()) {
      this.consumeWhitespace();
      const token = this.current();
      if (token.type === CSSTokenType.RIGHT_BRACE || token.type === CSSTokenType.EOF) break;
      if (token.type === CSSTokenType.COMMENT) {
        this.advance();
        continue;
      }
      let selector = "";
      if (token.type === CSSTokenType.IDENT) {
        selector = token.value;
        this.advance();
      } else if (token.type === CSSTokenType.PERCENTAGE) {
        selector = token.value + "%";
        this.advance();
      } else {
        this.advance();
        continue;
      }
      this.consumeWhitespace();
      if (!this.match(CSSTokenType.LEFT_BRACE)) continue;
      const declarations = this.parseDeclarations();
      if (this.current().type === CSSTokenType.RIGHT_BRACE) this.advance();
      frames.push({ selector, declarations });
    }
    if (this.current().type === CSSTokenType.RIGHT_BRACE) this.advance();
    this.keyframeRules.set(name, frames);
  }

  private parseFontFaceRule(): void {
    this.consumeWhitespace();
    if (!this.match(CSSTokenType.LEFT_BRACE)) {
      this.skipAtRuleBody();
      return;
    }
    const declarations = this.parseDeclarations();
    if (this.current().type === CSSTokenType.RIGHT_BRACE) this.advance();
    this.fontFaceRules.push(declarations);
  }

  private skipAtRuleBody(): void {
    while (!this.isAtEnd()) {
      const token = this.current();
      if (token.type === CSSTokenType.SEMICOLON) {
        this.advance();
        return;
      }
      if (token.type === CSSTokenType.LEFT_BRACE) {
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
