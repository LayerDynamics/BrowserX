/**
 * HTML Tokenizer
 *
 * Implements HTML5 tokenization state machine.
 * Converts raw HTML text into tokens for tree construction.
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

    // Temporary buffer
    private temporaryBuffer: string = "";

    /**
     * Tokenize HTML string
     */
    tokenize(html: string): HTMLToken[] {
        this.input = html;
        this.position = 0;
        this.tokens = [];
        this.state = HTMLTokenizerState.DATA;
        this.currentToken = null;

        while (this.position < this.input.length) {
            this.consumeNextCharacter();
        }

        // Emit EOF token
        this.tokens.push({ type: HTMLTokenType.EOF });

        return this.tokens;
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
            this.state = HTMLTokenizerState.COMMENT_START;
            this.position++;
        } else if (char === "/") {
            this.state = HTMLTokenizerState.END_TAG_OPEN;
            this.position++;
        } else if (this.isAlpha(char)) {
            this.currentToken = {
                type: HTMLTokenType.START_TAG,
                tagName: "",
                attributes: new Map(),
            };
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
     */
    private handleTagNameState(char: string): void {
        if (this.isWhitespace(char)) {
            this.state = HTMLTokenizerState.BEFORE_ATTRIBUTE_NAME;
            this.position++;
        } else if (char === "/") {
            this.state = HTMLTokenizerState.SELF_CLOSING_START_TAG;
            this.position++;
        } else if (char === ">") {
            this.emitCurrentToken();
            this.state = HTMLTokenizerState.DATA;
            this.position++;
        } else {
            this.currentToken!.tagName! += char.toLowerCase();
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
            this.state = HTMLTokenizerState.ATTRIBUTE_NAME;
            this.position++;
        } else {
            this.currentAttributeName = "";
            this.currentAttributeValue = "";
            this.state = HTMLTokenizerState.ATTRIBUTE_NAME;
        }
    }

    /**
     * ATTRIBUTE_NAME state
     */
    private handleAttributeNameState(char: string): void {
        if (this.isWhitespace(char) || char === "/" || char === ">") {
            this.state = HTMLTokenizerState.AFTER_ATTRIBUTE_NAME;
        } else if (char === "=") {
            this.state = HTMLTokenizerState.BEFORE_ATTRIBUTE_VALUE;
            this.position++;
        } else {
            this.currentAttributeName += char.toLowerCase();
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
            this.state = HTMLTokenizerState.DATA;
            this.position++;
        } else {
            this.addCurrentAttribute();
            this.currentAttributeName = "";
            this.currentAttributeValue = "";
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
            this.state = HTMLTokenizerState.ATTRIBUTE_VALUE_DOUBLE_QUOTED;
            this.position++;
        } else if (char === "'") {
            this.state = HTMLTokenizerState.ATTRIBUTE_VALUE_SINGLE_QUOTED;
            this.position++;
        } else if (char === ">") {
            this.addCurrentAttribute();
            this.emitCurrentToken();
            this.state = HTMLTokenizerState.DATA;
            this.position++;
        } else {
            this.state = HTMLTokenizerState.ATTRIBUTE_VALUE_UNQUOTED;
        }
    }

    /**
     * ATTRIBUTE_VALUE_DOUBLE_QUOTED state
     */
    private handleAttributeValueDoubleQuotedState(char: string): void {
        if (char === '"') {
            this.state = HTMLTokenizerState.AFTER_ATTRIBUTE_VALUE_QUOTED;
            this.position++;
        } else {
            this.currentAttributeValue += char;
            this.position++;
        }
    }

    /**
     * ATTRIBUTE_VALUE_SINGLE_QUOTED state
     */
    private handleAttributeValueSingleQuotedState(char: string): void {
        if (char === "'") {
            this.state = HTMLTokenizerState.AFTER_ATTRIBUTE_VALUE_QUOTED;
            this.position++;
        } else {
            this.currentAttributeValue += char;
            this.position++;
        }
    }

    /**
     * ATTRIBUTE_VALUE_UNQUOTED state
     */
    private handleAttributeValueUnquotedState(char: string): void {
        if (this.isWhitespace(char)) {
            this.addCurrentAttribute();
            this.state = HTMLTokenizerState.BEFORE_ATTRIBUTE_NAME;
            this.position++;
        } else if (char === ">") {
            this.addCurrentAttribute();
            this.emitCurrentToken();
            this.state = HTMLTokenizerState.DATA;
            this.position++;
        } else {
            this.currentAttributeValue += char;
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
            this.state = HTMLTokenizerState.DATA;
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
            this.state = HTMLTokenizerState.DATA;
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
            this.state = HTMLTokenizerState.DATA;
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
            this.state = HTMLTokenizerState.DATA;
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
            this.state = HTMLTokenizerState.DATA;
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
            this.state = HTMLTokenizerState.DATA;
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
            this.state = HTMLTokenizerState.SCRIPT_DATA_END_TAG_NAME;
        } else {
            this.emitCharacterToken("<");
            this.emitCharacterToken("/");
            this.state = HTMLTokenizerState.SCRIPT_DATA;
        }
    }

    /**
     * SCRIPT_DATA_END_TAG_NAME state
     */
    private handleScriptDataEndTagNameState(char: string): void {
        if (this.isWhitespace(char) || char === "/" || char === ">") {
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
            this.currentToken!.tagName! += char.toLowerCase();
            this.temporaryBuffer += char;
            this.position++;
        } else {
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
            this.state = HTMLTokenizerState.DATA;
            this.position++;
        } else {
            this.currentToken!.data! += char;
            this.position++;
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
            this.currentToken = null;

            // Switch to script data state if script tag
            if (
                this.tokens[this.tokens.length - 1].type === HTMLTokenType.START_TAG &&
                this.tokens[this.tokens.length - 1].tagName === "script"
            ) {
                this.state = HTMLTokenizerState.SCRIPT_DATA;
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
