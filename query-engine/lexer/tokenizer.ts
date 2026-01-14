/**
 * Lexer (Tokenizer) implementation
 * Converts query strings into token streams
 */

import { createToken, getKeywordType, isKeyword, Token, TokenType } from "./token.ts";

/**
 * Lexer class for tokenizing query strings
 */
export class Lexer {
  private input: string;
  private position: number;
  private line: number;
  private column: number;
  private tokens: Token[];

  constructor(input: string) {
    this.input = input;
    this.position = 0;
    this.line = 1;
    this.column = 1;
    this.tokens = [];
  }

  /**
   * Tokenize the entire input string
   */
  tokenize(): Token[] {
    while (!this.isAtEnd()) {
      const token = this.nextToken();

      // Skip whitespace and comments
      if (token.type !== TokenType.WHITESPACE && token.type !== TokenType.COMMENT) {
        this.tokens.push(token);
      }
    }

    // Add EOF token
    this.tokens.push(this.makeToken(TokenType.EOF, ""));

    return this.tokens;
  }

  /**
   * Get the next token from input
   */
  private nextToken(): Token {
    this.skipWhitespace();

    if (this.isAtEnd()) {
      return this.makeToken(TokenType.EOF, "");
    }

    const char = this.peek();

    // Comments (-- or //)
    if (char === "-" && this.peekNext() === "-") {
      return this.scanComment();
    }
    if (char === "/" && this.peekNext() === "/") {
      return this.scanComment();
    }

    // Multi-line comments (/* ... */)
    if (char === "/" && this.peekNext() === "*") {
      return this.scanMultiLineComment();
    }

    // String literals
    if (char === '"' || char === "'") {
      return this.scanString();
    }

    // Numbers
    if (this.isDigit(char)) {
      return this.scanNumber();
    }

    // Identifiers and keywords
    if (this.isAlpha(char) || char === "_") {
      return this.scanIdentifier();
    }

    // Operators and punctuation
    return this.scanOperator();
  }

  /**
   * Scan a string literal
   */
  private scanString(): Token {
    const quote = this.advance();
    const startLine = this.line;
    const startColumn = this.column - 1;
    const startOffset = this.position - 1;
    let value = "";

    while (!this.isAtEnd() && this.peek() !== quote) {
      if (this.peek() === "\\") {
        this.advance();
        value += this.scanEscapeSequence();
      } else if (this.peek() === "\n") {
        this.line++;
        this.column = 0;
        value += this.advance();
      } else {
        value += this.advance();
      }
    }

    if (this.isAtEnd()) {
      throw new Error(`Unterminated string at line ${startLine}, column ${startColumn}`);
    }

    this.advance(); // Closing quote

    return createToken(TokenType.STRING, value, startLine, startColumn, startOffset);
  }

  /**
   * Scan escape sequences in strings
   */
  private scanEscapeSequence(): string {
    if (this.isAtEnd()) {
      throw new Error("Unexpected end of input in escape sequence");
    }

    const char = this.advance();

    switch (char) {
      case "n":
        return "\n";
      case "t":
        return "\t";
      case "r":
        return "\r";
      case "\\":
        return "\\";
      case '"':
        return '"';
      case "'":
        return "'";
      case "0":
        return "\0";
      case "b":
        return "\b";
      case "f":
        return "\f";
      case "v":
        return "\v";
      case "u":
        return this.scanUnicodeEscape();
      default:
        return char;
    }
  }

  /**
   * Scan Unicode escape sequence (\uXXXX)
   */
  private scanUnicodeEscape(): string {
    let code = "";
    for (let i = 0; i < 4; i++) {
      if (this.isHexDigit(this.peek())) {
        code += this.advance();
      } else {
        throw new Error("Invalid Unicode escape sequence");
      }
    }
    return String.fromCharCode(parseInt(code, 16));
  }

  /**
   * Scan a number literal
   */
  private scanNumber(): Token {
    const startLine = this.line;
    const startColumn = this.column;
    const startOffset = this.position;
    let value = "";

    // Integer part
    while (this.isDigit(this.peek())) {
      value += this.advance();
    }

    // Decimal part
    if (this.peek() === "." && this.isDigit(this.peekNext())) {
      value += this.advance(); // .
      while (this.isDigit(this.peek())) {
        value += this.advance();
      }
    }

    // Scientific notation
    if (this.peek() === "e" || this.peek() === "E") {
      value += this.advance();
      if (this.peek() === "+" || this.peek() === "-") {
        value += this.advance();
      }
      while (this.isDigit(this.peek())) {
        value += this.advance();
      }
    }

    // Check for duration suffix (ms, s, m, h)
    if (this.peek() === "m" && this.peekNext() === "s") {
      value += this.advance(); // m
      value += this.advance(); // s
      return createToken(TokenType.DURATION, value, startLine, startColumn, startOffset);
    }
    if (this.peek() === "s" || this.peek() === "m" || this.peek() === "h") {
      const suffix = this.advance();
      if (!this.isAlphaNumeric(this.peek())) {
        value += suffix;
        return createToken(TokenType.DURATION, value, startLine, startColumn, startOffset);
      }
      // Put it back if it's part of an identifier
      this.position--;
      this.column--;
    }

    // Check for byte suffix (KB, MB, GB)
    if (this.peek() === "K" || this.peek() === "M" || this.peek() === "G") {
      const prefix = this.peek();
      if (this.peekNext() === "B") {
        value += this.advance(); // K/M/G
        value += this.advance(); // B
        return createToken(TokenType.BYTES, value, startLine, startColumn, startOffset);
      }
    }

    return createToken(TokenType.NUMBER, value, startLine, startColumn, startOffset);
  }

  /**
   * Scan an identifier or keyword
   */
  private scanIdentifier(): Token {
    const startLine = this.line;
    const startColumn = this.column;
    const startOffset = this.position;
    let value = "";

    while (!this.isAtEnd() && (this.isAlphaNumeric(this.peek()) || this.peek() === "_")) {
      value += this.advance();
    }

    // Check if it's a keyword
    const type = isKeyword(value) ? getKeywordType(value) : TokenType.IDENTIFIER;

    return createToken(type, value, startLine, startColumn, startOffset);
  }

  /**
   * Scan operators and punctuation
   */
  private scanOperator(): Token {
    const startLine = this.line;
    const startColumn = this.column;
    const startOffset = this.position;
    const char = this.advance();

    switch (char) {
      case "(":
        return this.makeToken(TokenType.LEFT_PAREN, char);
      case ")":
        return this.makeToken(TokenType.RIGHT_PAREN, char);
      case "{":
        return this.makeToken(TokenType.LEFT_BRACE, char);
      case "}":
        return this.makeToken(TokenType.RIGHT_BRACE, char);
      case "[":
        return this.makeToken(TokenType.LEFT_BRACKET, char);
      case "]":
        return this.makeToken(TokenType.RIGHT_BRACKET, char);
      case ",":
        return this.makeToken(TokenType.COMMA, char);
      case ".":
        return this.makeToken(TokenType.DOT, char);
      case ":":
        return this.makeToken(TokenType.COLON, char);
      case ";":
        return this.makeToken(TokenType.SEMICOLON, char);
      case "+":
        return this.makeToken(TokenType.PLUS, char);
      case "*":
        return this.makeToken(TokenType.STAR, char);
      case "/":
        return this.makeToken(TokenType.SLASH, char);
      case "%":
        return this.makeToken(TokenType.PERCENT, char);
      case "=":
        return this.makeToken(TokenType.EQUALS, char);
      case ">":
        if (this.peek() === "=") {
          this.advance();
          return createToken(TokenType.GREATER_EQ, ">=", startLine, startColumn, startOffset);
        }
        return this.makeToken(TokenType.GREATER, char);
      case "<":
        if (this.peek() === "=") {
          this.advance();
          return createToken(TokenType.LESS_EQ, "<=", startLine, startColumn, startOffset);
        }
        return this.makeToken(TokenType.LESS, char);
      case "!":
        if (this.peek() === "=") {
          this.advance();
          return createToken(TokenType.NOT_EQUALS, "!=", startLine, startColumn, startOffset);
        }
        return this.makeToken(TokenType.UNKNOWN, char);
      case "-":
        if (this.peek() === ">") {
          this.advance();
          return createToken(TokenType.ARROW, "->", startLine, startColumn, startOffset);
        }
        return this.makeToken(TokenType.MINUS, char);
      case "|":
        if (this.peek() === "|") {
          this.advance();
          return createToken(TokenType.CONCAT, "||", startLine, startColumn, startOffset);
        }
        return this.makeToken(TokenType.UNKNOWN, char);
      default:
        return this.makeToken(TokenType.UNKNOWN, char);
    }
  }

  /**
   * Scan single-line comment
   */
  private scanComment(): Token {
    const startLine = this.line;
    const startColumn = this.column;
    const startOffset = this.position;
    let value = "";

    // Skip -- or //
    this.advance();
    this.advance();

    while (!this.isAtEnd() && this.peek() !== "\n") {
      value += this.advance();
    }

    return createToken(TokenType.COMMENT, value, startLine, startColumn, startOffset);
  }

  /**
   * Scan multi-line comment
   */
  private scanMultiLineComment(): Token {
    const startLine = this.line;
    const startColumn = this.column;
    const startOffset = this.position;
    let value = "";

    // Skip /*
    this.advance();
    this.advance();

    while (!this.isAtEnd()) {
      if (this.peek() === "*" && this.peekNext() === "/") {
        this.advance(); // *
        this.advance(); // /
        break;
      }
      if (this.peek() === "\n") {
        this.line++;
        this.column = 0;
      }
      value += this.advance();
    }

    return createToken(TokenType.COMMENT, value, startLine, startColumn, startOffset);
  }

  /**
   * Skip whitespace
   */
  private skipWhitespace(): void {
    while (!this.isAtEnd() && this.isWhitespace(this.peek())) {
      if (this.peek() === "\n") {
        this.line++;
        this.column = 0;
      }
      this.advance();
    }
  }

  /**
   * Helper methods
   */
  private isAtEnd(): boolean {
    return this.position >= this.input.length;
  }

  private peek(): string {
    if (this.isAtEnd()) return "\0";
    return this.input[this.position];
  }

  private peekNext(): string {
    if (this.position + 1 >= this.input.length) return "\0";
    return this.input[this.position + 1];
  }

  private advance(): string {
    const char = this.input[this.position];
    this.position++;
    this.column++;
    return char;
  }

  private isDigit(char: string): boolean {
    return char >= "0" && char <= "9";
  }

  private isHexDigit(char: string): boolean {
    return this.isDigit(char) || (char >= "a" && char <= "f") || (char >= "A" && char <= "F");
  }

  private isAlpha(char: string): boolean {
    return (char >= "a" && char <= "z") || (char >= "A" && char <= "Z");
  }

  private isAlphaNumeric(char: string): boolean {
    return this.isAlpha(char) || this.isDigit(char);
  }

  private isWhitespace(char: string): boolean {
    return char === " " || char === "\t" || char === "\n" || char === "\r";
  }

  private makeToken(type: TokenType, value: string): Token {
    return createToken(
      type,
      value,
      this.line,
      this.column - value.length,
      this.position - value.length,
    );
  }

  /**
   * Get the source input string
   */
  getSource(): string {
    return this.input;
  }

  /**
   * Get all tokens (returns copy)
   */
  getTokens(): Token[] {
    return [...this.tokens];
  }

  /**
   * Get current position in input
   */
  getPosition(): number {
    return this.position;
  }

  /**
   * Get current character at position
   */
  getCurrentChar(): string {
    return this.peek();
  }

  /**
   * Get current line number
   */
  getLine(): number {
    return this.line;
  }

  /**
   * Get current column number
   */
  getColumn(): number {
    return this.column;
  }
}
