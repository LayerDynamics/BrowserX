/**
 * Lexer module exports
 */

// Export from token.ts (exclude Position which is in types/)
export { createToken, getKeywordType, isKeyword, type Token, TokenType } from "./token.ts";

// Export from tokenizer.ts
export * from "./tokenizer.ts";
