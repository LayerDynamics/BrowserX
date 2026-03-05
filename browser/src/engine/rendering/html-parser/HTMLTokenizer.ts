/**
 * HTML Tokenizer
 *
 * Implements HTML5 tokenization state machine.
 * Converts raw HTML text into tokens for tree construction.
 *
 * Performance: Uses index-based slicing instead of per-character string
 * concatenation (+=) in hot paths. Tag names, attribute names, and attribute
 * values track start positions and use substring() when complete, avoiding
 * thousands of intermediate string allocations.
 */

/**
 * Common HTML named character entities.
 */
const NAMED_ENTITIES: Record<string, string> = {
  nbsp: "\u00A0", lt: "<", gt: ">", amp: "&", quot: '"', apos: "'",
  copy: "\u00A9", reg: "\u00AE", trade: "\u2122", euro: "\u20AC",
  pound: "\u00A3", yen: "\u00A5", cent: "\u00A2", sect: "\u00A7",
  deg: "\u00B0", plusmn: "\u00B1", micro: "\u00B5", para: "\u00B6",
  middot: "\u00B7", frac12: "\u00BD", frac14: "\u00BC", frac34: "\u00BE",
  times: "\u00D7", divide: "\u00F7", laquo: "\u00AB", raquo: "\u00BB",
  ndash: "\u2013", mdash: "\u2014", lsquo: "\u2018", rsquo: "\u2019",
  ldquo: "\u201C", rdquo: "\u201D", bull: "\u2022", hellip: "\u2026",
  prime: "\u2032", Prime: "\u2033", larr: "\u2190", rarr: "\u2192",
  uarr: "\u2191", darr: "\u2193", harr: "\u2194", crarr: "\u21B5",
  loz: "\u25CA", spades: "\u2660", clubs: "\u2663", hearts: "\u2665",
  diams: "\u2666", ensp: "\u2002", emsp: "\u2003", thinsp: "\u2009",
  zwnj: "\u200C", zwj: "\u200D", lrm: "\u200E", rlm: "\u200F",
  iexcl: "\u00A1", brvbar: "\u00A6", uml: "\u00A8", ordf: "\u00AA",
  not: "\u00AC", shy: "\u00AD", macr: "\u00AF", sup1: "\u00B9",
  sup2: "\u00B2", sup3: "\u00B3", acute: "\u00B4", cedil: "\u00B8",
  ordm: "\u00BA", iquest: "\u00BF",
  Agrave: "\u00C0", Aacute: "\u00C1", Acirc: "\u00C2", Atilde: "\u00C3",
  Auml: "\u00C4", Aring: "\u00C5", AElig: "\u00C6", Ccedil: "\u00C7",
  Egrave: "\u00C8", Eacute: "\u00C9", Ecirc: "\u00CA", Euml: "\u00CB",
  Igrave: "\u00CC", Iacute: "\u00CD", Icirc: "\u00CE", Iuml: "\u00CF",
  ETH: "\u00D0", Ntilde: "\u00D1", Ograve: "\u00D2", Oacute: "\u00D3",
  Ocirc: "\u00D4", Otilde: "\u00D5", Ouml: "\u00D6", Oslash: "\u00D8",
  Ugrave: "\u00D9", Uacute: "\u00DA", Ucirc: "\u00DB", Uuml: "\u00DC",
  Yacute: "\u00DD", THORN: "\u00DE", szlig: "\u00DF",
  agrave: "\u00E0", aacute: "\u00E1", acirc: "\u00E2", atilde: "\u00E3",
  auml: "\u00E4", aring: "\u00E5", aelig: "\u00E6", ccedil: "\u00E7",
  egrave: "\u00E8", eacute: "\u00E9", ecirc: "\u00EA", euml: "\u00EB",
  igrave: "\u00EC", iacute: "\u00ED", icirc: "\u00EE", iuml: "\u00EF",
  eth: "\u00F0", ntilde: "\u00F1", ograve: "\u00F2", oacute: "\u00F3",
  ocirc: "\u00F4", otilde: "\u00F5", ouml: "\u00F6", oslash: "\u00F8",
  ugrave: "\u00F9", uacute: "\u00FA", ucirc: "\u00FB", uuml: "\u00FC",
  yacute: "\u00FD", thorn: "\u00FE", yuml: "\u00FF",
  Alpha: "\u0391", Beta: "\u0392", Gamma: "\u0393", Delta: "\u0394",
  Epsilon: "\u0395", Zeta: "\u0396", Eta: "\u0397", Theta: "\u0398",
  Iota: "\u0399", Kappa: "\u039A", Lambda: "\u039B", Mu: "\u039C",
  Nu: "\u039D", Xi: "\u039E", Omicron: "\u039F", Pi: "\u03A0",
  Rho: "\u03A1", Sigma: "\u03A3", Tau: "\u03A4", Upsilon: "\u03A5",
  Phi: "\u03A6", Chi: "\u03A7", Psi: "\u03A8", Omega: "\u03A9",
  alpha: "\u03B1", beta: "\u03B2", gamma: "\u03B3", delta: "\u03B4",
  epsilon: "\u03B5", zeta: "\u03B6", eta: "\u03B7", theta: "\u03B8",
  iota: "\u03B9", kappa: "\u03BA", lambda: "\u03BB", mu: "\u03BC",
  nu: "\u03BD", xi: "\u03BE", omicron: "\u03BF", pi: "\u03C0",
  rho: "\u03C1", sigmaf: "\u03C2", sigma: "\u03C3", tau: "\u03C4",
  upsilon: "\u03C5", phi: "\u03C6", chi: "\u03C7", psi: "\u03C8",
  omega: "\u03C9",
};

export enum HTMLTokenType {
  DOCTYPE,
  START_TAG,
  END_TAG,
  COMMENT,
  CHARACTER,
  EOF,
}

export interface HTMLToken {
  type: HTMLTokenType;
  data?: string;
  tagName?: string;
  attributes?: Map<string, string>;
  selfClosing?: boolean;
}

export enum HTMLTokenizerState {
  DATA,
  TAG_OPEN,
  END_TAG_OPEN,
  TAG_NAME,
  BEFORE_ATTRIBUTE_NAME,
  ATTRIBUTE_NAME,
  AFTER_ATTRIBUTE_NAME,
  BEFORE_ATTRIBUTE_VALUE,
  ATTRIBUTE_VALUE_DOUBLE_QUOTED,
  ATTRIBUTE_VALUE_SINGLE_QUOTED,
  ATTRIBUTE_VALUE_UNQUOTED,
  AFTER_ATTRIBUTE_VALUE_QUOTED,
  SELF_CLOSING_START_TAG,
  COMMENT_START,
  COMMENT_START_DASH,
  COMMENT,
  COMMENT_END_DASH,
  COMMENT_END,
  DOCTYPE,
  BEFORE_DOCTYPE_NAME,
  DOCTYPE_NAME,
  AFTER_DOCTYPE_NAME,
  SCRIPT_DATA,
  SCRIPT_DATA_LESS_THAN_SIGN,
  SCRIPT_DATA_END_TAG_OPEN,
  SCRIPT_DATA_END_TAG_NAME,
  RCDATA,
  RCDATA_LESS_THAN_SIGN,
  RCDATA_END_TAG_OPEN,
  RCDATA_END_TAG_NAME,
  RAWTEXT,
  RAWTEXT_LESS_THAN_SIGN,
  RAWTEXT_END_TAG_OPEN,
  RAWTEXT_END_TAG_NAME,
  BOGUS_COMMENT,
}

export class HTMLTokenizer {
  private state: HTMLTokenizerState = HTMLTokenizerState.DATA;
  private input: string = "";
  private position: number = 0;
  private tokens: HTMLToken[] = [];

  // Current token being constructed
  private currentToken: HTMLToken | null = null;
  private currentAttributeName: string = "";
  private currentAttributeValue: string = "";

  // Index-based slicing for hot-path string accumulation.
  // Instead of per-character += (creating thousands of intermediate strings),
  // we track start positions and use substring() when the token is complete.
  private tagNameStart: number = -1;
  private attrNameStart: number = -1;
  private attrValueStart: number = -1;

  // Temporary buffer
  private temporaryBuffer: string = "";

  // Last emitted start tag name — used for RCDATA/RAWTEXT end tag matching
  private lastStartTagName: string = "";

  /**
   * Tokenize HTML string
   */
  tokenize(html: string): HTMLToken[] {
    this.input = html;
    this.position = 0;
    this.tokens = [];
    this.state = HTMLTokenizerState.DATA;
    this.currentToken = null;
    this.tagNameStart = -1;
    this.attrNameStart = -1;
    this.attrValueStart = -1;

    while (this.position < this.input.length) {
      this.consumeNextCharacter();
    }

    // Emit EOF token
    this.tokens.push({ type: HTMLTokenType.EOF });

    return this.tokens;
  }

  /**
   * Flush the tag name from the index-based slice into currentToken.tagName
   */
  private flushTagName(): void {
    if (this.tagNameStart >= 0) {
      this.currentToken!.tagName = this.input.substring(this.tagNameStart, this.position).toLowerCase();
      this.tagNameStart = -1;
    }
  }

  /**
   * Flush the attribute name from the index-based slice into currentAttributeName
   */
  private flushAttrName(): void {
    if (this.attrNameStart >= 0) {
      this.currentAttributeName = this.input.substring(this.attrNameStart, this.position).toLowerCase();
      this.attrNameStart = -1;
    }
  }

  /**
   * Flush the attribute value from the index-based slice into currentAttributeValue
   */
  private flushAttrValue(): void {
    if (this.attrValueStart >= 0) {
      this.currentAttributeValue = this.input.substring(this.attrValueStart, this.position);
      this.attrValueStart = -1;
    }
  }

  /**
   * Consume next character and process based on state
   */
  private consumeNextCharacter(): void {
    const char = this.input[this.position];

    switch (this.state) {
      case HTMLTokenizerState.DATA:
        this.handleDataState(char);
        break;
      case HTMLTokenizerState.TAG_OPEN:
        this.handleTagOpenState(char);
        break;
      case HTMLTokenizerState.END_TAG_OPEN:
        this.handleEndTagOpenState(char);
        break;
      case HTMLTokenizerState.TAG_NAME:
        this.handleTagNameState(char);
        break;
      case HTMLTokenizerState.BEFORE_ATTRIBUTE_NAME:
        this.handleBeforeAttributeNameState(char);
        break;
      case HTMLTokenizerState.ATTRIBUTE_NAME:
        this.handleAttributeNameState(char);
        break;
      case HTMLTokenizerState.AFTER_ATTRIBUTE_NAME:
        this.handleAfterAttributeNameState(char);
        break;
      case HTMLTokenizerState.BEFORE_ATTRIBUTE_VALUE:
        this.handleBeforeAttributeValueState(char);
        break;
      case HTMLTokenizerState.ATTRIBUTE_VALUE_DOUBLE_QUOTED:
        this.handleAttributeValueDoubleQuotedState(char);
        break;
      case HTMLTokenizerState.ATTRIBUTE_VALUE_SINGLE_QUOTED:
        this.handleAttributeValueSingleQuotedState(char);
        break;
      case HTMLTokenizerState.ATTRIBUTE_VALUE_UNQUOTED:
        this.handleAttributeValueUnquotedState(char);
        break;
      case HTMLTokenizerState.AFTER_ATTRIBUTE_VALUE_QUOTED:
        this.handleAfterAttributeValueQuotedState(char);
        break;
      case HTMLTokenizerState.SELF_CLOSING_START_TAG:
        this.handleSelfClosingStartTagState(char);
        break;
      case HTMLTokenizerState.COMMENT_START:
        this.handleCommentStartState(char);
        break;
      case HTMLTokenizerState.COMMENT_START_DASH:
        this.handleCommentStartDashState(char);
        break;
      case HTMLTokenizerState.COMMENT:
        this.handleCommentState(char);
        break;
      case HTMLTokenizerState.COMMENT_END_DASH:
        this.handleCommentEndDashState(char);
        break;
      case HTMLTokenizerState.COMMENT_END:
        this.handleCommentEndState(char);
        break;
      case HTMLTokenizerState.DOCTYPE:
        this.handleDoctypeState(char);
        break;
      case HTMLTokenizerState.BEFORE_DOCTYPE_NAME:
        this.handleBeforeDoctypeNameState(char);
        break;
      case HTMLTokenizerState.DOCTYPE_NAME:
        this.handleDoctypeNameState(char);
        break;
      case HTMLTokenizerState.AFTER_DOCTYPE_NAME:
        this.handleAfterDoctypeNameState(char);
        break;
      case HTMLTokenizerState.SCRIPT_DATA:
        this.handleScriptDataState(char);
        break;
      case HTMLTokenizerState.SCRIPT_DATA_LESS_THAN_SIGN:
        this.handleScriptDataLessThanSignState(char);
        break;
      case HTMLTokenizerState.SCRIPT_DATA_END_TAG_OPEN:
        this.handleScriptDataEndTagOpenState(char);
        break;
      case HTMLTokenizerState.SCRIPT_DATA_END_TAG_NAME:
        this.handleScriptDataEndTagNameState(char);
        break;
      case HTMLTokenizerState.BOGUS_COMMENT:
        this.handleBogusCommentState(char);
        break;
      case HTMLTokenizerState.RCDATA:
        this.handleRcdataState(char);
        break;
      case HTMLTokenizerState.RCDATA_LESS_THAN_SIGN:
        this.handleRcdataLessThanSignState(char);
        break;
      case HTMLTokenizerState.RCDATA_END_TAG_OPEN:
        this.handleRcdataEndTagOpenState(char);
        break;
      case HTMLTokenizerState.RCDATA_END_TAG_NAME:
        this.handleRcdataEndTagNameState(char);
        break;
      case HTMLTokenizerState.RAWTEXT:
        this.handleRawtextState(char);
        break;
      case HTMLTokenizerState.RAWTEXT_LESS_THAN_SIGN:
        this.handleRawtextLessThanSignState(char);
        break;
      case HTMLTokenizerState.RAWTEXT_END_TAG_OPEN:
        this.handleRawtextEndTagOpenState(char);
        break;
      case HTMLTokenizerState.RAWTEXT_END_TAG_NAME:
        this.handleRawtextEndTagNameState(char);
        break;
      default:
        this.position++;
    }
  }

  /**
   * DATA state - default state
   */
  private handleDataState(char: string): void {
    if (char === "<") {
      this.state = HTMLTokenizerState.TAG_OPEN;
      this.position++;
    } else if (char === "&") {
      this.consumeCharacterReference();
    } else {
      this.emitCharacterToken(char);
      this.position++;
    }
  }

  /**
   * TAG_OPEN state - after '<'
   */
  private handleTagOpenState(char: string): void {
    if (char === "!") {
      // Per HTML5 spec, check for DOCTYPE before comment
      const upcoming = this.input.substring(this.position + 1, this.position + 8);
      if (upcoming.toUpperCase() === "DOCTYPE") {
        this.position += 8; // skip "!DOCTYPE"
        this.state = HTMLTokenizerState.DOCTYPE;
      } else {
        this.state = HTMLTokenizerState.COMMENT_START;
        this.position++;
      }
    } else if (char === "/") {
      this.state = HTMLTokenizerState.END_TAG_OPEN;
      this.position++;
    } else if (this.isAlpha(char)) {
      this.currentToken = {
        type: HTMLTokenType.START_TAG,
        tagName: "",
        attributes: new Map(),
      };
      this.tagNameStart = this.position;
      this.state = HTMLTokenizerState.TAG_NAME;
      // Don't advance position - reprocess in TAG_NAME state
    } else if (char === "?") {
      this.state = HTMLTokenizerState.BOGUS_COMMENT;
      this.currentToken = { type: HTMLTokenType.COMMENT, data: "" };
      this.position++;
    } else {
      this.emitCharacterToken("<");
      // Reprocess character in DATA state
      this.state = HTMLTokenizerState.DATA;
    }
  }

  /**
   * END_TAG_OPEN state - after '</'
   */
  private handleEndTagOpenState(char: string): void {
    if (this.isAlpha(char)) {
      this.currentToken = {
        type: HTMLTokenType.END_TAG,
        tagName: "",
      };
      this.tagNameStart = this.position;
      this.state = HTMLTokenizerState.TAG_NAME;
    } else if (char === ">") {
      this.state = HTMLTokenizerState.DATA;
      this.position++;
    } else {
      this.state = HTMLTokenizerState.BOGUS_COMMENT;
      this.currentToken = { type: HTMLTokenType.COMMENT, data: "" };
    }
  }

  /**
   * TAG_NAME state
   * Uses index-based slicing: tagNameStart tracks where the name began,
   * flushTagName() extracts it via substring when leaving this state.
   */
  private handleTagNameState(char: string): void {
    if (this.isWhitespace(char)) {
      this.flushTagName();
      this.state = HTMLTokenizerState.BEFORE_ATTRIBUTE_NAME;
      this.position++;
    } else if (char === "/") {
      this.flushTagName();
      this.state = HTMLTokenizerState.SELF_CLOSING_START_TAG;
      this.position++;
    } else if (char === ">") {
      this.flushTagName();
      this.emitCurrentToken();
      this.position++;
    } else {
      // Just advance - tag name will be extracted via substring when we leave this state
      this.position++;
    }
  }

  /**
   * BEFORE_ATTRIBUTE_NAME state
   */
  private handleBeforeAttributeNameState(char: string): void {
    if (this.isWhitespace(char)) {
      this.position++;
    } else if (char === "/" || char === ">") {
      this.state = HTMLTokenizerState.AFTER_ATTRIBUTE_NAME;
    } else if (char === "=") {
      this.currentAttributeName = char;
      this.currentAttributeValue = "";
      this.attrNameStart = -1;
      this.state = HTMLTokenizerState.ATTRIBUTE_NAME;
      this.position++;
    } else {
      this.currentAttributeName = "";
      this.currentAttributeValue = "";
      this.attrNameStart = this.position;
      this.state = HTMLTokenizerState.ATTRIBUTE_NAME;
    }
  }

  /**
   * ATTRIBUTE_NAME state
   * Uses index-based slicing: attrNameStart tracks where the name began.
   */
  private handleAttributeNameState(char: string): void {
    if (this.isWhitespace(char) || char === "/" || char === ">") {
      this.flushAttrName();
      this.state = HTMLTokenizerState.AFTER_ATTRIBUTE_NAME;
    } else if (char === "=") {
      this.flushAttrName();
      this.state = HTMLTokenizerState.BEFORE_ATTRIBUTE_VALUE;
      this.position++;
    } else {
      // Just advance - attr name will be extracted via substring when we leave this state
      this.position++;
    }
  }

  /**
   * AFTER_ATTRIBUTE_NAME state
   */
  private handleAfterAttributeNameState(char: string): void {
    if (this.isWhitespace(char)) {
      this.position++;
    } else if (char === "/") {
      this.addCurrentAttribute();
      this.state = HTMLTokenizerState.SELF_CLOSING_START_TAG;
      this.position++;
    } else if (char === "=") {
      this.state = HTMLTokenizerState.BEFORE_ATTRIBUTE_VALUE;
      this.position++;
    } else if (char === ">") {
      this.addCurrentAttribute();
      this.emitCurrentToken();
      this.position++;
    } else {
      this.addCurrentAttribute();
      this.currentAttributeName = "";
      this.currentAttributeValue = "";
      this.attrNameStart = this.position;
      this.state = HTMLTokenizerState.ATTRIBUTE_NAME;
    }
  }

  /**
   * BEFORE_ATTRIBUTE_VALUE state
   */
  private handleBeforeAttributeValueState(char: string): void {
    if (this.isWhitespace(char)) {
      this.position++;
    } else if (char === '"') {
      this.attrValueStart = this.position + 1;
      this.state = HTMLTokenizerState.ATTRIBUTE_VALUE_DOUBLE_QUOTED;
      this.position++;
    } else if (char === "'") {
      this.attrValueStart = this.position + 1;
      this.state = HTMLTokenizerState.ATTRIBUTE_VALUE_SINGLE_QUOTED;
      this.position++;
    } else if (char === ">") {
      this.addCurrentAttribute();
      this.emitCurrentToken();
      this.position++;
    } else {
      this.attrValueStart = this.position;
      this.state = HTMLTokenizerState.ATTRIBUTE_VALUE_UNQUOTED;
    }
  }

  /**
   * ATTRIBUTE_VALUE_DOUBLE_QUOTED state
   * Uses index-based slicing: attrValueStart tracks where the value began.
   */
  private handleAttributeValueDoubleQuotedState(char: string): void {
    if (char === '"') {
      this.flushAttrValue();
      this.state = HTMLTokenizerState.AFTER_ATTRIBUTE_VALUE_QUOTED;
      this.position++;
    } else {
      // Just advance - attr value will be extracted via substring when we leave this state
      this.position++;
    }
  }

  /**
   * ATTRIBUTE_VALUE_SINGLE_QUOTED state
   * Uses index-based slicing: attrValueStart tracks where the value began.
   */
  private handleAttributeValueSingleQuotedState(char: string): void {
    if (char === "'") {
      this.flushAttrValue();
      this.state = HTMLTokenizerState.AFTER_ATTRIBUTE_VALUE_QUOTED;
      this.position++;
    } else {
      // Just advance - attr value will be extracted via substring when we leave this state
      this.position++;
    }
  }

  /**
   * ATTRIBUTE_VALUE_UNQUOTED state
   * Uses index-based slicing: attrValueStart tracks where the value began.
   */
  private handleAttributeValueUnquotedState(char: string): void {
    if (this.isWhitespace(char)) {
      this.flushAttrValue();
      this.addCurrentAttribute();
      this.state = HTMLTokenizerState.BEFORE_ATTRIBUTE_NAME;
      this.position++;
    } else if (char === ">") {
      this.flushAttrValue();
      this.addCurrentAttribute();
      this.emitCurrentToken();
      this.position++;
    } else {
      // Just advance - attr value will be extracted via substring when we leave this state
      this.position++;
    }
  }

  /**
   * AFTER_ATTRIBUTE_VALUE_QUOTED state
   */
  private handleAfterAttributeValueQuotedState(char: string): void {
    this.addCurrentAttribute();

    if (this.isWhitespace(char)) {
      this.state = HTMLTokenizerState.BEFORE_ATTRIBUTE_NAME;
      this.position++;
    } else if (char === "/") {
      this.state = HTMLTokenizerState.SELF_CLOSING_START_TAG;
      this.position++;
    } else if (char === ">") {
      this.emitCurrentToken();
      this.position++;
    } else {
      this.state = HTMLTokenizerState.BEFORE_ATTRIBUTE_NAME;
    }
  }

  /**
   * SELF_CLOSING_START_TAG state
   */
  private handleSelfClosingStartTagState(char: string): void {
    if (char === ">") {
      this.currentToken!.selfClosing = true;
      this.emitCurrentToken();
      this.position++;
    } else {
      this.state = HTMLTokenizerState.BEFORE_ATTRIBUTE_NAME;
    }
  }

  /**
   * COMMENT_START state - after '<!-'
   */
  private handleCommentStartState(char: string): void {
    if (char === "-") {
      this.state = HTMLTokenizerState.COMMENT_START_DASH;
      this.position++;
    } else if (char === ">") {
      this.emitCharacterToken("<");
      this.emitCharacterToken("!");
      this.state = HTMLTokenizerState.DATA;
      this.position++;
    } else {
      // Check for DOCTYPE
      const remaining = this.input.substring(this.position, this.position + 7);
      if (remaining.toUpperCase() === "DOCTYPE") {
        this.state = HTMLTokenizerState.DOCTYPE;
        this.position += 7;
      } else {
        this.state = HTMLTokenizerState.BOGUS_COMMENT;
        this.currentToken = { type: HTMLTokenType.COMMENT, data: "" };
      }
    }
  }

  /**
   * COMMENT_START_DASH state
   */
  private handleCommentStartDashState(char: string): void {
    if (char === "-") {
      this.currentToken = { type: HTMLTokenType.COMMENT, data: "" };
      this.state = HTMLTokenizerState.COMMENT;
      this.position++;
    } else {
      this.state = HTMLTokenizerState.BOGUS_COMMENT;
      this.currentToken = { type: HTMLTokenType.COMMENT, data: "" };
    }
  }

  /**
   * COMMENT state
   */
  private handleCommentState(char: string): void {
    if (char === "-") {
      this.state = HTMLTokenizerState.COMMENT_END_DASH;
      this.position++;
    } else {
      this.currentToken!.data! += char;
      this.position++;
    }
  }

  /**
   * COMMENT_END_DASH state
   */
  private handleCommentEndDashState(char: string): void {
    if (char === "-") {
      this.state = HTMLTokenizerState.COMMENT_END;
      this.position++;
    } else {
      this.currentToken!.data! += "-" + char;
      this.state = HTMLTokenizerState.COMMENT;
      this.position++;
    }
  }

  /**
   * COMMENT_END state
   */
  private handleCommentEndState(char: string): void {
    if (char === ">") {
      this.emitCurrentToken();
      this.position++;
    } else if (char === "-") {
      this.currentToken!.data! += "-";
      this.position++;
    } else {
      this.currentToken!.data! += "--" + char;
      this.state = HTMLTokenizerState.COMMENT;
      this.position++;
    }
  }

  /**
   * DOCTYPE state
   */
  private handleDoctypeState(char: string): void {
    if (this.isWhitespace(char)) {
      this.state = HTMLTokenizerState.BEFORE_DOCTYPE_NAME;
      this.position++;
    } else {
      this.state = HTMLTokenizerState.BEFORE_DOCTYPE_NAME;
    }
  }

  /**
   * BEFORE_DOCTYPE_NAME state
   */
  private handleBeforeDoctypeNameState(char: string): void {
    if (this.isWhitespace(char)) {
      this.position++;
    } else if (char === ">") {
      this.currentToken = { type: HTMLTokenType.DOCTYPE, data: "" };
      this.emitCurrentToken();
      this.position++;
    } else {
      this.currentToken = { type: HTMLTokenType.DOCTYPE, data: "" };
      this.state = HTMLTokenizerState.DOCTYPE_NAME;
    }
  }

  /**
   * DOCTYPE_NAME state
   */
  private handleDoctypeNameState(char: string): void {
    if (this.isWhitespace(char)) {
      this.state = HTMLTokenizerState.AFTER_DOCTYPE_NAME;
      this.position++;
    } else if (char === ">") {
      this.emitCurrentToken();
      this.position++;
    } else {
      this.currentToken!.data! += char;
      this.position++;
    }
  }

  /**
   * AFTER_DOCTYPE_NAME state
   */
  private handleAfterDoctypeNameState(char: string): void {
    if (this.isWhitespace(char)) {
      this.position++;
    } else if (char === ">") {
      this.emitCurrentToken();
      this.position++;
    } else {
      // Skip remaining doctype tokens
      this.position++;
    }
  }

  /**
   * SCRIPT_DATA state - inside <script> tag
   */
  private handleScriptDataState(char: string): void {
    if (char === "<") {
      this.state = HTMLTokenizerState.SCRIPT_DATA_LESS_THAN_SIGN;
      this.position++;
    } else {
      this.emitCharacterToken(char);
      this.position++;
    }
  }

  /**
   * SCRIPT_DATA_LESS_THAN_SIGN state
   */
  private handleScriptDataLessThanSignState(char: string): void {
    if (char === "/") {
      this.temporaryBuffer = "";
      this.state = HTMLTokenizerState.SCRIPT_DATA_END_TAG_OPEN;
      this.position++;
    } else {
      this.emitCharacterToken("<");
      this.state = HTMLTokenizerState.SCRIPT_DATA;
    }
  }

  /**
   * SCRIPT_DATA_END_TAG_OPEN state
   */
  private handleScriptDataEndTagOpenState(char: string): void {
    if (this.isAlpha(char)) {
      this.currentToken = { type: HTMLTokenType.END_TAG, tagName: "" };
      this.tagNameStart = this.position;
      this.state = HTMLTokenizerState.SCRIPT_DATA_END_TAG_NAME;
    } else {
      this.emitCharacterToken("<");
      this.emitCharacterToken("/");
      this.state = HTMLTokenizerState.SCRIPT_DATA;
    }
  }

  /**
   * SCRIPT_DATA_END_TAG_NAME state
   * Note: temporaryBuffer still uses += here because it stores the raw
   * (non-lowercased) characters and is only a few chars long ("script").
   */
  private handleScriptDataEndTagNameState(char: string): void {
    if (this.isWhitespace(char) || char === "/" || char === ">") {
      this.flushTagName();
      if (this.currentToken!.tagName === "script") {
        this.state = char === ">"
          ? HTMLTokenizerState.DATA
          : HTMLTokenizerState.BEFORE_ATTRIBUTE_NAME;
        if (char === ">") {
          this.emitCurrentToken();
          this.position++;
        }
      } else {
        this.emitCharacterToken("<");
        this.emitCharacterToken("/");
        for (const c of this.currentToken!.tagName!) {
          this.emitCharacterToken(c);
        }
        this.state = HTMLTokenizerState.SCRIPT_DATA;
      }
    } else if (this.isAlpha(char)) {
      this.temporaryBuffer += char;
      this.position++;
    } else {
      this.flushTagName();
      this.emitCharacterToken("<");
      this.emitCharacterToken("/");
      for (const c of this.temporaryBuffer) {
        this.emitCharacterToken(c);
      }
      this.state = HTMLTokenizerState.SCRIPT_DATA;
    }
  }

  /**
   * BOGUS_COMMENT state
   */
  private handleBogusCommentState(char: string): void {
    if (char === ">") {
      this.emitCurrentToken();
      this.position++;
    } else {
      this.currentToken!.data! += char;
      this.position++;
    }
  }

  // ── RCDATA states (textarea, title) ──

  private handleRcdataState(char: string): void {
    if (char === "<") {
      this.state = HTMLTokenizerState.RCDATA_LESS_THAN_SIGN;
      this.position++;
    } else if (char === "&") {
      this.consumeCharacterReference();
    } else {
      this.emitCharacterToken(char);
      this.position++;
    }
  }

  private handleRcdataLessThanSignState(char: string): void {
    if (char === "/") {
      this.temporaryBuffer = "";
      this.state = HTMLTokenizerState.RCDATA_END_TAG_OPEN;
      this.position++;
    } else {
      this.emitCharacterToken("<");
      this.state = HTMLTokenizerState.RCDATA;
    }
  }

  private handleRcdataEndTagOpenState(char: string): void {
    if (this.isAlpha(char)) {
      this.currentToken = { type: HTMLTokenType.END_TAG, tagName: "" };
      this.temporaryBuffer = "";
      this.state = HTMLTokenizerState.RCDATA_END_TAG_NAME;
    } else {
      this.emitCharacterToken("<");
      this.emitCharacterToken("/");
      this.state = HTMLTokenizerState.RCDATA;
    }
  }

  private handleRcdataEndTagNameState(char: string): void {
    if (this.isWhitespace(char) || char === "/" || char === ">") {
      const candidateName = this.temporaryBuffer.toLowerCase();
      if (candidateName === this.lastStartTagName) {
        this.currentToken!.tagName = candidateName;
        if (char === ">") {
          this.emitCurrentToken();
          this.position++;
        } else {
          this.state = char === "/" ? HTMLTokenizerState.SELF_CLOSING_START_TAG : HTMLTokenizerState.BEFORE_ATTRIBUTE_NAME;
          this.position++;
        }
      } else {
        // Not matching end tag — emit buffered chars and return to RCDATA
        this.emitCharacterToken("<");
        this.emitCharacterToken("/");
        for (const c of this.temporaryBuffer) {
          this.emitCharacterToken(c);
        }
        this.state = HTMLTokenizerState.RCDATA;
      }
    } else if (this.isAlpha(char)) {
      this.temporaryBuffer += char;
      this.position++;
    } else {
      this.emitCharacterToken("<");
      this.emitCharacterToken("/");
      for (const c of this.temporaryBuffer) {
        this.emitCharacterToken(c);
      }
      this.state = HTMLTokenizerState.RCDATA;
    }
  }

  // ── RAWTEXT states (style, xmp, iframe, etc.) ──

  private handleRawtextState(char: string): void {
    if (char === "<") {
      this.state = HTMLTokenizerState.RAWTEXT_LESS_THAN_SIGN;
      this.position++;
    } else {
      this.emitCharacterToken(char);
      this.position++;
    }
  }

  private handleRawtextLessThanSignState(char: string): void {
    if (char === "/") {
      this.temporaryBuffer = "";
      this.state = HTMLTokenizerState.RAWTEXT_END_TAG_OPEN;
      this.position++;
    } else {
      this.emitCharacterToken("<");
      this.state = HTMLTokenizerState.RAWTEXT;
    }
  }

  private handleRawtextEndTagOpenState(char: string): void {
    if (this.isAlpha(char)) {
      this.currentToken = { type: HTMLTokenType.END_TAG, tagName: "" };
      this.temporaryBuffer = "";
      this.state = HTMLTokenizerState.RAWTEXT_END_TAG_NAME;
    } else {
      this.emitCharacterToken("<");
      this.emitCharacterToken("/");
      this.state = HTMLTokenizerState.RAWTEXT;
    }
  }

  private handleRawtextEndTagNameState(char: string): void {
    if (this.isWhitespace(char) || char === "/" || char === ">") {
      const candidateName = this.temporaryBuffer.toLowerCase();
      if (candidateName === this.lastStartTagName) {
        this.currentToken!.tagName = candidateName;
        if (char === ">") {
          this.emitCurrentToken();
          this.position++;
        } else {
          this.state = char === "/" ? HTMLTokenizerState.SELF_CLOSING_START_TAG : HTMLTokenizerState.BEFORE_ATTRIBUTE_NAME;
          this.position++;
        }
      } else {
        this.emitCharacterToken("<");
        this.emitCharacterToken("/");
        for (const c of this.temporaryBuffer) {
          this.emitCharacterToken(c);
        }
        this.state = HTMLTokenizerState.RAWTEXT;
      }
    } else if (this.isAlpha(char)) {
      this.temporaryBuffer += char;
      this.position++;
    } else {
      this.emitCharacterToken("<");
      this.emitCharacterToken("/");
      for (const c of this.temporaryBuffer) {
        this.emitCharacterToken(c);
      }
      this.state = HTMLTokenizerState.RAWTEXT;
    }
  }

  /**
   * Emit character token
   */
  private emitCharacterToken(char: string): void {
    this.tokens.push({
      type: HTMLTokenType.CHARACTER,
      data: char,
    });
  }

  /**
   * Emit current token
   */
  private emitCurrentToken(): void {
    if (this.currentToken) {
      this.tokens.push(this.currentToken as HTMLToken);
      const emitted = this.currentToken;
      this.currentToken = null;

      // Default next state is DATA
      this.state = HTMLTokenizerState.DATA;

      // Switch to appropriate content state based on start tag name
      if (emitted.type === HTMLTokenType.START_TAG) {
        const tagName = emitted.tagName!;
        this.lastStartTagName = tagName;

        if (tagName === "script") {
          this.state = HTMLTokenizerState.SCRIPT_DATA;
        } else if (tagName === "textarea" || tagName === "title") {
          this.state = HTMLTokenizerState.RCDATA;
        } else if (tagName === "style" || tagName === "xmp" || tagName === "iframe" || tagName === "noembed" || tagName === "noframes" || tagName === "noscript") {
          this.state = HTMLTokenizerState.RAWTEXT;
        }
      }
    }
  }

  /**
   * Add current attribute to current token
   */
  private addCurrentAttribute(): void {
    if (this.currentToken && this.currentAttributeName) {
      if (!this.currentToken.attributes) {
        this.currentToken.attributes = new Map();
      }
      this.currentToken.attributes.set(
        this.currentAttributeName,
        this.currentAttributeValue,
      );
      this.currentAttributeName = "";
      this.currentAttributeValue = "";
    }
  }

  /**
   * Consume a character reference (&#NNN; or &#xHHH; or &name;)
   * Handles numeric character references with overflow protection per HTML5 spec.
   */
  private consumeCharacterReference(): void {
    // Skip the '&'
    this.position++;

    if (this.position >= this.input.length) {
      this.emitCharacterToken("&");
      return;
    }

    const next = this.input[this.position];

    if (next === "#") {
      // Numeric character reference
      this.position++;

      if (this.position >= this.input.length) {
        this.emitCharacterToken("&");
        this.emitCharacterToken("#");
        return;
      }

      let isHex = false;
      if (this.input[this.position] === "x" || this.input[this.position] === "X") {
        isHex = true;
        this.position++;
      }

      let numStr = "";
      while (this.position < this.input.length) {
        const c = this.input[this.position];
        if (c === ";") {
          this.position++;
          break;
        }
        if (isHex && /[0-9a-fA-F]/.test(c)) {
          numStr += c;
          this.position++;
        } else if (!isHex && /[0-9]/.test(c)) {
          numStr += c;
          this.position++;
        } else {
          break;
        }
      }

      if (numStr.length === 0) {
        // Not a valid numeric ref, emit the consumed characters literally
        this.emitCharacterToken("&");
        this.emitCharacterToken("#");
        if (isHex) this.emitCharacterToken("x");
        return;
      }

      const codePoint = parseInt(numStr, isHex ? 16 : 10);

      // If codePoint exceeds Unicode max (0x10FFFF), use replacement character U+FFFD
      if (codePoint > 0x10FFFF || codePoint === 0) {
        this.emitCharacterToken("\uFFFD");
      } else {
        this.emitCharacterToken(String.fromCodePoint(codePoint));
      }
    } else {
      // Named character reference
      let name = "";
      const startPos = this.position;
      while (this.position < this.input.length) {
        const c = this.input[this.position];
        if (c === ";") {
          this.position++;
          break;
        }
        if (!this.isAlpha(c) && !(c >= "0" && c <= "9")) break;
        name += c;
        this.position++;
      }

      const decoded = NAMED_ENTITIES[name] ?? NAMED_ENTITIES[name.toLowerCase()];
      if (decoded !== undefined) {
        this.emitCharacterToken(decoded);
      } else {
        // Not a known entity — emit literally
        this.emitCharacterToken("&");
        this.position = startPos; // re-parse the name chars normally
      }
    }
  }

  /**
   * Check if character is whitespace
   */
  private isWhitespace(char: string): boolean {
    return char === " " || char === "\t" || char === "\n" || char === "\r" || char === "\f";
  }

  /**
   * Check if character is alphabetic
   */
  private isAlpha(char: string): boolean {
    return (char >= "a" && char <= "z") || (char >= "A" && char <= "Z");
  }
}
