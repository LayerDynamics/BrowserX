/**
 * Tests for CSS Tokenizer
 * Tests CSS tokenization based on CSS Syntax Module Level 3.
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import {
    CSSTokenizer,
    CSSTokenType,
    type CSSToken,
} from "../../../../src/engine/rendering/css-parser/CSSTokenizer.ts";

// CSSTokenType enum tests

Deno.test({
    name: "CSSTokenType - IDENT value",
    fn() {
        assertEquals(CSSTokenType.IDENT, 0);
    },
});

Deno.test({
    name: "CSSTokenType - FUNCTION value",
    fn() {
        assertEquals(CSSTokenType.FUNCTION, 1);
    },
});

Deno.test({
    name: "CSSTokenType - AT_KEYWORD value",
    fn() {
        assertEquals(CSSTokenType.AT_KEYWORD, 2);
    },
});

Deno.test({
    name: "CSSTokenType - HASH value",
    fn() {
        assertEquals(CSSTokenType.HASH, 3);
    },
});

Deno.test({
    name: "CSSTokenType - STRING value",
    fn() {
        assertEquals(CSSTokenType.STRING, 4);
    },
});

Deno.test({
    name: "CSSTokenType - NUMBER value",
    fn() {
        assertEquals(CSSTokenType.NUMBER, 5);
    },
});

Deno.test({
    name: "CSSTokenType - PERCENTAGE value",
    fn() {
        assertEquals(CSSTokenType.PERCENTAGE, 6);
    },
});

Deno.test({
    name: "CSSTokenType - DIMENSION value",
    fn() {
        assertEquals(CSSTokenType.DIMENSION, 7);
    },
});

Deno.test({
    name: "CSSTokenType - DELIM value",
    fn() {
        assertEquals(CSSTokenType.DELIM, 8);
    },
});

Deno.test({
    name: "CSSTokenType - WHITESPACE value",
    fn() {
        assertEquals(CSSTokenType.WHITESPACE, 9);
    },
});

Deno.test({
    name: "CSSTokenType - COLON value",
    fn() {
        assertEquals(CSSTokenType.COLON, 10);
    },
});

Deno.test({
    name: "CSSTokenType - SEMICOLON value",
    fn() {
        assertEquals(CSSTokenType.SEMICOLON, 11);
    },
});

Deno.test({
    name: "CSSTokenType - COMMA value",
    fn() {
        assertEquals(CSSTokenType.COMMA, 12);
    },
});

Deno.test({
    name: "CSSTokenType - LEFT_BRACE value",
    fn() {
        assertEquals(CSSTokenType.LEFT_BRACE, 13);
    },
});

Deno.test({
    name: "CSSTokenType - RIGHT_BRACE value",
    fn() {
        assertEquals(CSSTokenType.RIGHT_BRACE, 14);
    },
});

Deno.test({
    name: "CSSTokenType - LEFT_BRACKET value",
    fn() {
        assertEquals(CSSTokenType.LEFT_BRACKET, 15);
    },
});

Deno.test({
    name: "CSSTokenType - RIGHT_BRACKET value",
    fn() {
        assertEquals(CSSTokenType.RIGHT_BRACKET, 16);
    },
});

Deno.test({
    name: "CSSTokenType - LEFT_PAREN value",
    fn() {
        assertEquals(CSSTokenType.LEFT_PAREN, 17);
    },
});

Deno.test({
    name: "CSSTokenType - RIGHT_PAREN value",
    fn() {
        assertEquals(CSSTokenType.RIGHT_PAREN, 18);
    },
});

Deno.test({
    name: "CSSTokenType - COMMENT value",
    fn() {
        assertEquals(CSSTokenType.COMMENT, 19);
    },
});

Deno.test({
    name: "CSSTokenType - EOF value",
    fn() {
        assertEquals(CSSTokenType.EOF, 20);
    },
});

// CSSTokenizer constructor tests

Deno.test({
    name: "CSSTokenizer - constructor creates tokenizer",
    fn() {
        const tokenizer = new CSSTokenizer();
        assertExists(tokenizer);
    },
});

// CSSTokenizer.tokenize tests - identifiers

Deno.test({
    name: "CSSTokenizer - tokenize identifier",
    fn() {
        const tokenizer = new CSSTokenizer();
        const tokens = tokenizer.tokenize("color");

        assertEquals(tokens.length, 2); // IDENT + EOF
        assertEquals(tokens[0].type, CSSTokenType.IDENT);
        assertEquals(tokens[0].value, "color");
    },
});

Deno.test({
    name: "CSSTokenizer - tokenize identifier with hyphen",
    fn() {
        const tokenizer = new CSSTokenizer();
        const tokens = tokenizer.tokenize("background-color");

        assertEquals(tokens[0].type, CSSTokenType.IDENT);
        assertEquals(tokens[0].value, "background-color");
    },
});

Deno.test({
    name: "CSSTokenizer - tokenize identifier with underscore",
    fn() {
        const tokenizer = new CSSTokenizer();
        const tokens = tokenizer.tokenize("_private");

        assertEquals(tokens[0].type, CSSTokenType.IDENT);
        assertEquals(tokens[0].value, "_private");
    },
});

Deno.test({
    name: "CSSTokenizer - tokenize identifier with digits",
    fn() {
        const tokenizer = new CSSTokenizer();
        const tokens = tokenizer.tokenize("col2or");

        assertEquals(tokens[0].type, CSSTokenType.IDENT);
        assertEquals(tokens[0].value, "col2or");
    },
});

// CSSTokenizer.tokenize tests - functions

Deno.test({
    name: "CSSTokenizer - tokenize function",
    fn() {
        const tokenizer = new CSSTokenizer();
        const tokens = tokenizer.tokenize("rgb(");

        assertEquals(tokens[0].type, CSSTokenType.FUNCTION);
        assertEquals(tokens[0].value, "rgb");
        assertEquals(tokens[1].type, CSSTokenType.LEFT_PAREN);
    },
});

Deno.test({
    name: "CSSTokenizer - tokenize url function",
    fn() {
        const tokenizer = new CSSTokenizer();
        const tokens = tokenizer.tokenize("url(");

        assertEquals(tokens[0].type, CSSTokenType.FUNCTION);
        assertEquals(tokens[0].value, "url");
    },
});

Deno.test({
    name: "CSSTokenizer - tokenize calc function",
    fn() {
        const tokenizer = new CSSTokenizer();
        const tokens = tokenizer.tokenize("calc(");

        assertEquals(tokens[0].type, CSSTokenType.FUNCTION);
        assertEquals(tokens[0].value, "calc");
    },
});

// CSSTokenizer.tokenize tests - at-keywords

Deno.test({
    name: "CSSTokenizer - tokenize @media",
    fn() {
        const tokenizer = new CSSTokenizer();
        const tokens = tokenizer.tokenize("@media");

        assertEquals(tokens[0].type, CSSTokenType.AT_KEYWORD);
        assertEquals(tokens[0].value, "@media");
    },
});

Deno.test({
    name: "CSSTokenizer - tokenize @import",
    fn() {
        const tokenizer = new CSSTokenizer();
        const tokens = tokenizer.tokenize("@import");

        assertEquals(tokens[0].type, CSSTokenType.AT_KEYWORD);
        assertEquals(tokens[0].value, "@import");
    },
});

Deno.test({
    name: "CSSTokenizer - tokenize @keyframes",
    fn() {
        const tokenizer = new CSSTokenizer();
        const tokens = tokenizer.tokenize("@keyframes");

        assertEquals(tokens[0].type, CSSTokenType.AT_KEYWORD);
        assertEquals(tokens[0].value, "@keyframes");
    },
});

// CSSTokenizer.tokenize tests - hash

Deno.test({
    name: "CSSTokenizer - tokenize hash color",
    fn() {
        const tokenizer = new CSSTokenizer();
        const tokens = tokenizer.tokenize("#ff0000");

        assertEquals(tokens[0].type, CSSTokenType.HASH);
        assertEquals(tokens[0].value, "#ff0000");
    },
});

Deno.test({
    name: "CSSTokenizer - tokenize short hash color",
    fn() {
        const tokenizer = new CSSTokenizer();
        const tokens = tokenizer.tokenize("#f00");

        assertEquals(tokens[0].type, CSSTokenType.HASH);
        assertEquals(tokens[0].value, "#f00");
    },
});

Deno.test({
    name: "CSSTokenizer - tokenize hash id",
    fn() {
        const tokenizer = new CSSTokenizer();
        const tokens = tokenizer.tokenize("#myId");

        assertEquals(tokens[0].type, CSSTokenType.HASH);
        assertEquals(tokens[0].value, "#myId");
    },
});

// CSSTokenizer.tokenize tests - strings

Deno.test({
    name: "CSSTokenizer - tokenize double-quoted string",
    fn() {
        const tokenizer = new CSSTokenizer();
        const tokens = tokenizer.tokenize('"hello"');

        assertEquals(tokens[0].type, CSSTokenType.STRING);
        assertEquals(tokens[0].value, "hello");
    },
});

Deno.test({
    name: "CSSTokenizer - tokenize single-quoted string",
    fn() {
        const tokenizer = new CSSTokenizer();
        const tokens = tokenizer.tokenize("'hello'");

        assertEquals(tokens[0].type, CSSTokenType.STRING);
        assertEquals(tokens[0].value, "hello");
    },
});

Deno.test({
    name: "CSSTokenizer - tokenize string with escaped quote",
    fn() {
        const tokenizer = new CSSTokenizer();
        const tokens = tokenizer.tokenize('"hello\\"world"');

        assertEquals(tokens[0].type, CSSTokenType.STRING);
        assert(tokens[0].value.includes("world"));
    },
});

Deno.test({
    name: "CSSTokenizer - tokenize empty string",
    fn() {
        const tokenizer = new CSSTokenizer();
        const tokens = tokenizer.tokenize('""');

        assertEquals(tokens[0].type, CSSTokenType.STRING);
        assertEquals(tokens[0].value, "");
    },
});

// CSSTokenizer.tokenize tests - numbers

Deno.test({
    name: "CSSTokenizer - tokenize integer",
    fn() {
        const tokenizer = new CSSTokenizer();
        const tokens = tokenizer.tokenize("42");

        assertEquals(tokens[0].type, CSSTokenType.NUMBER);
        assertEquals(tokens[0].value, "42");
    },
});

Deno.test({
    name: "CSSTokenizer - tokenize decimal",
    fn() {
        const tokenizer = new CSSTokenizer();
        const tokens = tokenizer.tokenize("3.14");

        assertEquals(tokens[0].type, CSSTokenType.NUMBER);
        assertEquals(tokens[0].value, "3.14");
    },
});

Deno.test({
    name: "CSSTokenizer - tokenize zero",
    fn() {
        const tokenizer = new CSSTokenizer();
        const tokens = tokenizer.tokenize("0");

        assertEquals(tokens[0].type, CSSTokenType.NUMBER);
        assertEquals(tokens[0].value, "0");
    },
});

Deno.test({
    name: "CSSTokenizer - tokenize decimal starting with dot",
    fn() {
        const tokenizer = new CSSTokenizer();
        const tokens = tokenizer.tokenize(".5");

        assertEquals(tokens[0].type, CSSTokenType.NUMBER);
        assertEquals(tokens[0].value, ".5");
    },
});

// CSSTokenizer.tokenize tests - percentages

Deno.test({
    name: "CSSTokenizer - tokenize percentage",
    fn() {
        const tokenizer = new CSSTokenizer();
        const tokens = tokenizer.tokenize("50%");

        assertEquals(tokens[0].type, CSSTokenType.PERCENTAGE);
        assertEquals(tokens[0].value, "50");
        assertEquals(tokens[0].unit, "%");
    },
});

Deno.test({
    name: "CSSTokenizer - tokenize decimal percentage",
    fn() {
        const tokenizer = new CSSTokenizer();
        const tokens = tokenizer.tokenize("33.33%");

        assertEquals(tokens[0].type, CSSTokenType.PERCENTAGE);
        assertEquals(tokens[0].value, "33.33");
        assertEquals(tokens[0].unit, "%");
    },
});

Deno.test({
    name: "CSSTokenizer - tokenize 100%",
    fn() {
        const tokenizer = new CSSTokenizer();
        const tokens = tokenizer.tokenize("100%");

        assertEquals(tokens[0].type, CSSTokenType.PERCENTAGE);
        assertEquals(tokens[0].value, "100");
    },
});

// CSSTokenizer.tokenize tests - dimensions

Deno.test({
    name: "CSSTokenizer - tokenize pixel dimension",
    fn() {
        const tokenizer = new CSSTokenizer();
        const tokens = tokenizer.tokenize("10px");

        assertEquals(tokens[0].type, CSSTokenType.DIMENSION);
        assertEquals(tokens[0].value, "10");
        assertEquals(tokens[0].unit, "px");
    },
});

Deno.test({
    name: "CSSTokenizer - tokenize em dimension",
    fn() {
        const tokenizer = new CSSTokenizer();
        const tokens = tokenizer.tokenize("1.5em");

        assertEquals(tokens[0].type, CSSTokenType.DIMENSION);
        assertEquals(tokens[0].value, "1.5");
        assertEquals(tokens[0].unit, "em");
    },
});

Deno.test({
    name: "CSSTokenizer - tokenize rem dimension",
    fn() {
        const tokenizer = new CSSTokenizer();
        const tokens = tokenizer.tokenize("2rem");

        assertEquals(tokens[0].type, CSSTokenType.DIMENSION);
        assertEquals(tokens[0].unit, "rem");
    },
});

Deno.test({
    name: "CSSTokenizer - tokenize vh dimension",
    fn() {
        const tokenizer = new CSSTokenizer();
        const tokens = tokenizer.tokenize("100vh");

        assertEquals(tokens[0].type, CSSTokenType.DIMENSION);
        assertEquals(tokens[0].unit, "vh");
    },
});

Deno.test({
    name: "CSSTokenizer - tokenize vw dimension",
    fn() {
        const tokenizer = new CSSTokenizer();
        const tokens = tokenizer.tokenize("50vw");

        assertEquals(tokens[0].type, CSSTokenType.DIMENSION);
        assertEquals(tokens[0].unit, "vw");
    },
});

Deno.test({
    name: "CSSTokenizer - tokenize pt dimension",
    fn() {
        const tokenizer = new CSSTokenizer();
        const tokens = tokenizer.tokenize("12pt");

        assertEquals(tokens[0].type, CSSTokenType.DIMENSION);
        assertEquals(tokens[0].unit, "pt");
    },
});

Deno.test({
    name: "CSSTokenizer - tokenize zero with unit",
    fn() {
        const tokenizer = new CSSTokenizer();
        const tokens = tokenizer.tokenize("0px");

        assertEquals(tokens[0].type, CSSTokenType.DIMENSION);
        assertEquals(tokens[0].value, "0");
        assertEquals(tokens[0].unit, "px");
    },
});

// CSSTokenizer.tokenize tests - punctuation

Deno.test({
    name: "CSSTokenizer - tokenize colon",
    fn() {
        const tokenizer = new CSSTokenizer();
        const tokens = tokenizer.tokenize(":");

        assertEquals(tokens[0].type, CSSTokenType.COLON);
        assertEquals(tokens[0].value, ":");
    },
});

Deno.test({
    name: "CSSTokenizer - tokenize semicolon",
    fn() {
        const tokenizer = new CSSTokenizer();
        const tokens = tokenizer.tokenize(";");

        assertEquals(tokens[0].type, CSSTokenType.SEMICOLON);
        assertEquals(tokens[0].value, ";");
    },
});

Deno.test({
    name: "CSSTokenizer - tokenize comma",
    fn() {
        const tokenizer = new CSSTokenizer();
        const tokens = tokenizer.tokenize(",");

        assertEquals(tokens[0].type, CSSTokenType.COMMA);
        assertEquals(tokens[0].value, ",");
    },
});

Deno.test({
    name: "CSSTokenizer - tokenize left brace",
    fn() {
        const tokenizer = new CSSTokenizer();
        const tokens = tokenizer.tokenize("{");

        assertEquals(tokens[0].type, CSSTokenType.LEFT_BRACE);
        assertEquals(tokens[0].value, "{");
    },
});

Deno.test({
    name: "CSSTokenizer - tokenize right brace",
    fn() {
        const tokenizer = new CSSTokenizer();
        const tokens = tokenizer.tokenize("}");

        assertEquals(tokens[0].type, CSSTokenType.RIGHT_BRACE);
        assertEquals(tokens[0].value, "}");
    },
});

Deno.test({
    name: "CSSTokenizer - tokenize left bracket",
    fn() {
        const tokenizer = new CSSTokenizer();
        const tokens = tokenizer.tokenize("[");

        assertEquals(tokens[0].type, CSSTokenType.LEFT_BRACKET);
        assertEquals(tokens[0].value, "[");
    },
});

Deno.test({
    name: "CSSTokenizer - tokenize right bracket",
    fn() {
        const tokenizer = new CSSTokenizer();
        const tokens = tokenizer.tokenize("]");

        assertEquals(tokens[0].type, CSSTokenType.RIGHT_BRACKET);
        assertEquals(tokens[0].value, "]");
    },
});

Deno.test({
    name: "CSSTokenizer - tokenize left paren",
    fn() {
        const tokenizer = new CSSTokenizer();
        const tokens = tokenizer.tokenize("(");

        assertEquals(tokens[0].type, CSSTokenType.LEFT_PAREN);
        assertEquals(tokens[0].value, "(");
    },
});

Deno.test({
    name: "CSSTokenizer - tokenize right paren",
    fn() {
        const tokenizer = new CSSTokenizer();
        const tokens = tokenizer.tokenize(")");

        assertEquals(tokens[0].type, CSSTokenType.RIGHT_PAREN);
        assertEquals(tokens[0].value, ")");
    },
});

// CSSTokenizer.tokenize tests - whitespace

Deno.test({
    name: "CSSTokenizer - tokenize space",
    fn() {
        const tokenizer = new CSSTokenizer();
        const tokens = tokenizer.tokenize(" ");

        assertEquals(tokens[0].type, CSSTokenType.WHITESPACE);
    },
});

Deno.test({
    name: "CSSTokenizer - tokenize tab",
    fn() {
        const tokenizer = new CSSTokenizer();
        const tokens = tokenizer.tokenize("\t");

        assertEquals(tokens[0].type, CSSTokenType.WHITESPACE);
    },
});

Deno.test({
    name: "CSSTokenizer - tokenize newline",
    fn() {
        const tokenizer = new CSSTokenizer();
        const tokens = tokenizer.tokenize("\n");

        assertEquals(tokens[0].type, CSSTokenType.WHITESPACE);
    },
});

Deno.test({
    name: "CSSTokenizer - tokenize multiple spaces",
    fn() {
        const tokenizer = new CSSTokenizer();
        const tokens = tokenizer.tokenize("   ");

        assertEquals(tokens[0].type, CSSTokenType.WHITESPACE);
    },
});

// CSSTokenizer.tokenize tests - comments

Deno.test({
    name: "CSSTokenizer - tokenize comment",
    fn() {
        const tokenizer = new CSSTokenizer();
        const tokens = tokenizer.tokenize("/* comment */");

        assertEquals(tokens[0].type, CSSTokenType.COMMENT);
        assertEquals(tokens[0].value, "/* comment */");
    },
});

Deno.test({
    name: "CSSTokenizer - tokenize multiline comment",
    fn() {
        const tokenizer = new CSSTokenizer();
        const tokens = tokenizer.tokenize("/* line1\nline2 */");

        assertEquals(tokens[0].type, CSSTokenType.COMMENT);
    },
});

Deno.test({
    name: "CSSTokenizer - tokenize empty comment",
    fn() {
        const tokenizer = new CSSTokenizer();
        const tokens = tokenizer.tokenize("/**/");

        assertEquals(tokens[0].type, CSSTokenType.COMMENT);
    },
});

// CSSTokenizer.tokenize tests - delimiter

Deno.test({
    name: "CSSTokenizer - tokenize delimiter",
    fn() {
        const tokenizer = new CSSTokenizer();
        const tokens = tokenizer.tokenize(">");

        assertEquals(tokens[0].type, CSSTokenType.DELIM);
        assertEquals(tokens[0].value, ">");
    },
});

Deno.test({
    name: "CSSTokenizer - tokenize plus delimiter",
    fn() {
        const tokenizer = new CSSTokenizer();
        const tokens = tokenizer.tokenize("+");

        assertEquals(tokens[0].type, CSSTokenType.DELIM);
        assertEquals(tokens[0].value, "+");
    },
});

Deno.test({
    name: "CSSTokenizer - tokenize tilde delimiter",
    fn() {
        const tokenizer = new CSSTokenizer();
        const tokens = tokenizer.tokenize("~");

        assertEquals(tokens[0].type, CSSTokenType.DELIM);
        assertEquals(tokens[0].value, "~");
    },
});

// CSSTokenizer.tokenize tests - EOF

Deno.test({
    name: "CSSTokenizer - always emits EOF token",
    fn() {
        const tokenizer = new CSSTokenizer();
        const tokens = tokenizer.tokenize("color");

        const eofToken = tokens[tokens.length - 1];
        assertEquals(eofToken.type, CSSTokenType.EOF);
    },
});

Deno.test({
    name: "CSSTokenizer - emits EOF for empty input",
    fn() {
        const tokenizer = new CSSTokenizer();
        const tokens = tokenizer.tokenize("");

        assertEquals(tokens.length, 1);
        assertEquals(tokens[0].type, CSSTokenType.EOF);
    },
});

// CSSTokenizer.tokenize tests - complex CSS

Deno.test({
    name: "CSSTokenizer - tokenize CSS rule",
    fn() {
        const tokenizer = new CSSTokenizer();
        const tokens = tokenizer.tokenize("color: red;");

        const ident = tokens.find(t => t.type === CSSTokenType.IDENT);
        const colon = tokens.find(t => t.type === CSSTokenType.COLON);
        const semicolon = tokens.find(t => t.type === CSSTokenType.SEMICOLON);

        assertExists(ident);
        assertExists(colon);
        assertExists(semicolon);
    },
});

Deno.test({
    name: "CSSTokenizer - tokenize selector with class",
    fn() {
        const tokenizer = new CSSTokenizer();
        const tokens = tokenizer.tokenize(".class");

        assertEquals(tokens[0].type, CSSTokenType.DELIM);
        assertEquals(tokens[0].value, ".");
        assertEquals(tokens[1].type, CSSTokenType.IDENT);
        assertEquals(tokens[1].value, "class");
    },
});

Deno.test({
    name: "CSSTokenizer - tokenize RGB function",
    fn() {
        const tokenizer = new CSSTokenizer();
        const tokens = tokenizer.tokenize("rgb(255, 0, 0)");

        const func = tokens.find(t => t.type === CSSTokenType.FUNCTION);
        const numbers = tokens.filter(t => t.type === CSSTokenType.NUMBER);

        assertExists(func);
        assertEquals(func.value, "rgb");
        assertEquals(numbers.length, 3);
    },
});

Deno.test({
    name: "CSSTokenizer - tokenize multiple properties",
    fn() {
        const tokenizer = new CSSTokenizer();
        const tokens = tokenizer.tokenize("width: 100px; height: 50px;");

        const idents = tokens.filter(t => t.type === CSSTokenType.IDENT);
        const dimensions = tokens.filter(t => t.type === CSSTokenType.DIMENSION);

        assertEquals(idents.length, 2);
        assertEquals(dimensions.length, 2);
    },
});

Deno.test({
    name: "CSSTokenizer - tokenize media query",
    fn() {
        const tokenizer = new CSSTokenizer();
        const tokens = tokenizer.tokenize("@media (max-width: 768px)");

        const atKeyword = tokens.find(t => t.type === CSSTokenType.AT_KEYWORD);
        assertExists(atKeyword);
        assertEquals(atKeyword.value, "@media");
    },
});

Deno.test({
    name: "CSSTokenizer - tokenize calc function",
    fn() {
        const tokenizer = new CSSTokenizer();
        const tokens = tokenizer.tokenize("calc(100% - 20px)");

        const func = tokens.find(t => t.type === CSSTokenType.FUNCTION);
        assertExists(func);
        assertEquals(func.value, "calc");
    },
});

Deno.test({
    name: "CSSTokenizer - tokenize CSS with comments",
    fn() {
        const tokenizer = new CSSTokenizer();
        const tokens = tokenizer.tokenize("color: red; /* comment */");

        const comment = tokens.find(t => t.type === CSSTokenType.COMMENT);
        assertExists(comment);
    },
});

Deno.test({
    name: "CSSTokenizer - tokenize attribute selector",
    fn() {
        const tokenizer = new CSSTokenizer();
        const tokens = tokenizer.tokenize("[href]");

        const leftBracket = tokens.find(t => t.type === CSSTokenType.LEFT_BRACKET);
        const rightBracket = tokens.find(t => t.type === CSSTokenType.RIGHT_BRACKET);

        assertExists(leftBracket);
        assertExists(rightBracket);
    },
});

// CSSToken interface tests

Deno.test({
    name: "CSSToken - IDENT structure",
    fn() {
        const token: CSSToken = {
            type: CSSTokenType.IDENT,
            value: "color",
        };

        assertEquals(token.type, CSSTokenType.IDENT);
        assertEquals(token.value, "color");
    },
});

Deno.test({
    name: "CSSToken - DIMENSION structure with unit",
    fn() {
        const token: CSSToken = {
            type: CSSTokenType.DIMENSION,
            value: "10",
            unit: "px",
        };

        assertEquals(token.unit, "px");
    },
});

Deno.test({
    name: "CSSToken - PERCENTAGE structure with unit",
    fn() {
        const token: CSSToken = {
            type: CSSTokenType.PERCENTAGE,
            value: "50",
            unit: "%",
        };

        assertEquals(token.unit, "%");
    },
});
