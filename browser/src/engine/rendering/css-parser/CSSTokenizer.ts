/**
 * CSS Tokenizer
 * Tokenizes CSS into IDENT, FUNCTION, AT_KEYWORD, HASH, etc.
 * Based on CSS Syntax Module Level 3 specification.
 */

export enum CSSTokenType {
    IDENT,
    FUNCTION,
    AT_KEYWORD,
    HASH,
    STRING,
    NUMBER,
    PERCENTAGE,
    DIMENSION,
    DELIM,
    WHITESPACE,
    COLON,
    SEMICOLON,
    COMMA,
    LEFT_BRACE,
    RIGHT_BRACE,
    LEFT_BRACKET,
    RIGHT_BRACKET,
    LEFT_PAREN,
    RIGHT_PAREN,
    COMMENT,
    EOF,
}

export interface CSSToken {
    type: CSSTokenType;
    value: string;
    unit?: string; // For DIMENSION and PERCENTAGE
}

export class CSSTokenizer {
    private input: string = "";
    private position: number = 0;
    private tokens: CSSToken[] = [];

    /**
     * Tokenize CSS string
     */
    tokenize(css: string): CSSToken[] {
        this.input = css;
        this.position = 0;
        this.tokens = [];

        while (this.position < this.input.length) {
            this.consumeToken();
        }

        this.tokens.push({ type: CSSTokenType.EOF, value: "" });
        return this.tokens;
    }

    /**
     * Consume next token
     */
    private consumeToken(): void {
        this.consumeWhitespace();

        if (this.position >= this.input.length) {
            return;
        }

        const char = this.input[this.position];

        // Comments
        if (char === "/" && this.peek(1) === "*") {
            this.consumeComment();
            return;
        }

        // Strings
        if (char === '"' || char === "'") {
            this.consumeString(char);
            return;
        }

        // Numbers
        if (this.isDigit(char) || (char === "." && this.isDigit(this.peek(1) || ""))) {
            this.consumeNumeric();
            return;
        }

        // Identifiers and keywords
        if (this.isIdentStart(char) || char === "-") {
            this.consumeIdentLike();
            return;
        }

        // Hash
        if (char === "#") {
            this.position++;
            const value = this.consumeIdentSequence();
            this.tokens.push({
                type: CSSTokenType.HASH,
                value: "#" + value,
            });
            return;
        }

        // At-keyword
        if (char === "@") {
            this.position++;
            const value = this.consumeIdentSequence();
            this.tokens.push({
                type: CSSTokenType.AT_KEYWORD,
                value: "@" + value,
            });
            return;
        }

        // Punctuation
        switch (char) {
            case ":":
                this.tokens.push({ type: CSSTokenType.COLON, value: ":" });
                this.position++;
                return;
            case ";":
                this.tokens.push({ type: CSSTokenType.SEMICOLON, value: ";" });
                this.position++;
                return;
            case ",":
                this.tokens.push({ type: CSSTokenType.COMMA, value: "," });
                this.position++;
                return;
            case "{":
                this.tokens.push({ type: CSSTokenType.LEFT_BRACE, value: "{" });
                this.position++;
                return;
            case "}":
                this.tokens.push({ type: CSSTokenType.RIGHT_BRACE, value: "}" });
                this.position++;
                return;
            case "[":
                this.tokens.push({ type: CSSTokenType.LEFT_BRACKET, value: "[" });
                this.position++;
                return;
            case "]":
                this.tokens.push({ type: CSSTokenType.RIGHT_BRACKET, value: "]" });
                this.position++;
                return;
            case "(":
                this.tokens.push({ type: CSSTokenType.LEFT_PAREN, value: "(" });
                this.position++;
                return;
            case ")":
                this.tokens.push({ type: CSSTokenType.RIGHT_PAREN, value: ")" });
                this.position++;
                return;
        }

        // Delimiter
        this.tokens.push({ type: CSSTokenType.DELIM, value: char });
        this.position++;
    }

    /**
     * Consume whitespace
     */
    private consumeWhitespace(): void {
        const start = this.position;

        while (this.position < this.input.length && this.isWhitespace(this.input[this.position])) {
            this.position++;
        }

        if (this.position > start) {
            this.tokens.push({
                type: CSSTokenType.WHITESPACE,
                value: this.input.substring(start, this.position),
            });
        }
    }

    /**
     * Consume comment
     */
    private consumeComment(): void {
        const start = this.position;
        this.position += 2; // Skip /*

        while (this.position < this.input.length) {
            if (this.input[this.position] === "*" && this.peek(1) === "/") {
                this.position += 2;
                break;
            }
            this.position++;
        }

        this.tokens.push({
            type: CSSTokenType.COMMENT,
            value: this.input.substring(start, this.position),
        });
    }

    /**
     * Consume string
     */
    private consumeString(quote: string): void {
        const start = this.position;
        this.position++; // Skip opening quote

        let value = "";

        while (this.position < this.input.length) {
            const char = this.input[this.position];

            if (char === quote) {
                this.position++;
                break;
            }

            if (char === "\\") {
                this.position++;
                if (this.position < this.input.length) {
                    value += this.input[this.position];
                    this.position++;
                }
            } else {
                value += char;
                this.position++;
            }
        }

        this.tokens.push({
            type: CSSTokenType.STRING,
            value,
        });
    }

    /**
     * Consume numeric token (number, percentage, dimension)
     */
    private consumeNumeric(): void {
        const start = this.position;
        let value = "";

        // Consume digits before decimal
        while (this.position < this.input.length && this.isDigit(this.input[this.position])) {
            value += this.input[this.position];
            this.position++;
        }

        // Consume decimal point and digits after
        if (this.position < this.input.length && this.input[this.position] === ".") {
            value += ".";
            this.position++;

            while (this.position < this.input.length && this.isDigit(this.input[this.position])) {
                value += this.input[this.position];
                this.position++;
            }
        }

        // Check for percentage
        if (this.position < this.input.length && this.input[this.position] === "%") {
            this.position++;
            this.tokens.push({
                type: CSSTokenType.PERCENTAGE,
                value,
                unit: "%",
            });
            return;
        }

        // Check for dimension (e.g., px, em, rem)
        if (this.position < this.input.length && this.isIdentStart(this.input[this.position])) {
            const unit = this.consumeIdentSequence();
            this.tokens.push({
                type: CSSTokenType.DIMENSION,
                value,
                unit,
            });
            return;
        }

        // Just a number
        this.tokens.push({
            type: CSSTokenType.NUMBER,
            value,
        });
    }

    /**
     * Consume identifier-like token (ident or function)
     */
    private consumeIdentLike(): void {
        const value = this.consumeIdentSequence();

        // Check if it's a function
        if (this.position < this.input.length && this.input[this.position] === "(") {
            this.position++;
            this.tokens.push({
                type: CSSTokenType.FUNCTION,
                value,
            });
            this.tokens.push({
                type: CSSTokenType.LEFT_PAREN,
                value: "(",
            });
            return;
        }

        // Just an identifier
        this.tokens.push({
            type: CSSTokenType.IDENT,
            value,
        });
    }

    /**
     * Consume identifier sequence
     */
    private consumeIdentSequence(): string {
        let value = "";

        while (this.position < this.input.length) {
            const char = this.input[this.position];

            if (this.isIdentChar(char)) {
                value += char;
                this.position++;
            } else if (char === "\\") {
                this.position++;
                if (this.position < this.input.length) {
                    value += this.input[this.position];
                    this.position++;
                }
            } else {
                break;
            }
        }

        return value;
    }

    /**
     * Peek ahead n characters
     */
    private peek(n: number): string {
        return this.input[this.position + n] || "";
    }

    /**
     * Check if character is whitespace
     */
    private isWhitespace(char: string): boolean {
        return char === " " || char === "\t" || char === "\n" || char === "\r" || char === "\f";
    }

    /**
     * Check if character is digit
     */
    private isDigit(char: string): boolean {
        return char >= "0" && char <= "9";
    }

    /**
     * Check if character can start an identifier
     */
    private isIdentStart(char: string): boolean {
        return (char >= "a" && char <= "z") ||
            (char >= "A" && char <= "Z") ||
            char === "_" ||
            char === "-" ||
            char.charCodeAt(0) > 127; // Non-ASCII
    }

    /**
     * Check if character can be part of an identifier
     */
    private isIdentChar(char: string): boolean {
        return this.isIdentStart(char) || this.isDigit(char);
    }
}
