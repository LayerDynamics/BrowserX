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
      // Named character reference — emit '&' literally and let the rest be parsed normally
      // (Full named entity support would require a large lookup table)
      this.emitCharacterToken("&");
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
