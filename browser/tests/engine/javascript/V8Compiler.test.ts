/**
 * V8Compiler Tests
 *
 * Comprehensive tests for the JavaScript compiler (lexing, parsing, bytecode generation).
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import {
    V8Compiler,
    Lexer,
    Parser,
    BytecodeGenerator,
    JSJSTokenType,
    ASTNodeType,
    Opcode,
    type JSToken,
    type ProgramNode,
} from "../../../src/engine/javascript/V8Compiler.ts";

// ============================================================================
// Lexer Constructor Tests
// ============================================================================

Deno.test({
    name: "Lexer - constructor creates lexer instance",
    fn() {
        const lexer = new Lexer("var x = 42");

        assertExists(lexer);
    },
});

Deno.test({
    name: "Lexer - tokenize returns tokens array",
    fn() {
        const lexer = new Lexer("42");

        const tokens = lexer.tokenize();

        assertExists(tokens);
        assert(Array.isArray(tokens));
    },
});

Deno.test({
    name: "Lexer - tokenize always ends with EOF",
    fn() {
        const lexer = new Lexer("42");

        const tokens = lexer.tokenize();

        const lastJSToken = tokens[tokens.length - 1];
        assertEquals(lastJSToken.type, JSJSTokenType.EOF);
    },
});

// ============================================================================
// Lexer Number Tests
// ============================================================================

Deno.test({
    name: "Lexer - tokenize integer",
    fn() {
        const lexer = new Lexer("42");

        const tokens = lexer.tokenize();

        assertEquals(tokens[0].type, JSJSTokenType.NUMBER);
        assertEquals(tokens[0].value, "42");
    },
});

Deno.test({
    name: "Lexer - tokenize decimal number",
    fn() {
        const lexer = new Lexer("3.14");

        const tokens = lexer.tokenize();

        assertEquals(tokens[0].type, JSJSTokenType.NUMBER);
        assertEquals(tokens[0].value, "3.14");
    },
});

Deno.test({
    name: "Lexer - tokenize multiple numbers",
    fn() {
        const lexer = new Lexer("1 2 3");

        const tokens = lexer.tokenize();

        assertEquals(tokens[0].value, "1");
        assertEquals(tokens[1].value, "2");
        assertEquals(tokens[2].value, "3");
    },
});

// ============================================================================
// Lexer String Tests
// ============================================================================

Deno.test({
    name: "Lexer - tokenize double-quoted string",
    fn() {
        const lexer = new Lexer('"hello"');

        const tokens = lexer.tokenize();

        assertEquals(tokens[0].type, JSJSTokenType.STRING);
        assertEquals(tokens[0].value, "hello");
    },
});

Deno.test({
    name: "Lexer - tokenize single-quoted string",
    fn() {
        const lexer = new Lexer("'world'");

        const tokens = lexer.tokenize();

        assertEquals(tokens[0].type, JSJSTokenType.STRING);
        assertEquals(tokens[0].value, "world");
    },
});

Deno.test({
    name: "Lexer - tokenize string with escape sequence",
    fn() {
        const lexer = new Lexer('"hello\\nworld"');

        const tokens = lexer.tokenize();

        assertEquals(tokens[0].type, JSJSTokenType.STRING);
    },
});

// ============================================================================
// Lexer Identifier and Keyword Tests
// ============================================================================

Deno.test({
    name: "Lexer - tokenize identifier",
    fn() {
        const lexer = new Lexer("myVar");

        const tokens = lexer.tokenize();

        assertEquals(tokens[0].type, JSJSTokenType.IDENTIFIER);
        assertEquals(tokens[0].value, "myVar");
    },
});

Deno.test({
    name: "Lexer - tokenize var keyword",
    fn() {
        const lexer = new Lexer("var");

        const tokens = lexer.tokenize();

        assertEquals(tokens[0].type, JSJSTokenType.VAR);
    },
});

Deno.test({
    name: "Lexer - tokenize let keyword",
    fn() {
        const lexer = new Lexer("let");

        const tokens = lexer.tokenize();

        assertEquals(tokens[0].type, JSJSTokenType.LET);
    },
});

Deno.test({
    name: "Lexer - tokenize const keyword",
    fn() {
        const lexer = new Lexer("const");

        const tokens = lexer.tokenize();

        assertEquals(tokens[0].type, JSJSTokenType.CONST);
    },
});

Deno.test({
    name: "Lexer - tokenize function keyword",
    fn() {
        const lexer = new Lexer("function");

        const tokens = lexer.tokenize();

        assertEquals(tokens[0].type, JSJSTokenType.FUNCTION);
    },
});

Deno.test({
    name: "Lexer - tokenize return keyword",
    fn() {
        const lexer = new Lexer("return");

        const tokens = lexer.tokenize();

        assertEquals(tokens[0].type, JSJSTokenType.RETURN);
    },
});

Deno.test({
    name: "Lexer - tokenize if keyword",
    fn() {
        const lexer = new Lexer("if");

        const tokens = lexer.tokenize();

        assertEquals(tokens[0].type, JSJSTokenType.IF);
    },
});

Deno.test({
    name: "Lexer - tokenize else keyword",
    fn() {
        const lexer = new Lexer("else");

        const tokens = lexer.tokenize();

        assertEquals(tokens[0].type, JSJSTokenType.ELSE);
    },
});

Deno.test({
    name: "Lexer - tokenize while keyword",
    fn() {
        const lexer = new Lexer("while");

        const tokens = lexer.tokenize();

        assertEquals(tokens[0].type, JSJSTokenType.WHILE);
    },
});

Deno.test({
    name: "Lexer - tokenize for keyword",
    fn() {
        const lexer = new Lexer("for");

        const tokens = lexer.tokenize();

        assertEquals(tokens[0].type, JSJSTokenType.FOR);
    },
});

Deno.test({
    name: "Lexer - tokenize true keyword",
    fn() {
        const lexer = new Lexer("true");

        const tokens = lexer.tokenize();

        assertEquals(tokens[0].type, JSJSTokenType.TRUE);
    },
});

Deno.test({
    name: "Lexer - tokenize false keyword",
    fn() {
        const lexer = new Lexer("false");

        const tokens = lexer.tokenize();

        assertEquals(tokens[0].type, JSJSTokenType.FALSE);
    },
});

Deno.test({
    name: "Lexer - tokenize null keyword",
    fn() {
        const lexer = new Lexer("null");

        const tokens = lexer.tokenize();

        assertEquals(tokens[0].type, JSJSTokenType.NULL);
    },
});

Deno.test({
    name: "Lexer - tokenize undefined keyword",
    fn() {
        const lexer = new Lexer("undefined");

        const tokens = lexer.tokenize();

        assertEquals(tokens[0].type, JSJSTokenType.UNDEFINED);
    },
});

Deno.test({
    name: "Lexer - tokenize this keyword",
    fn() {
        const lexer = new Lexer("this");

        const tokens = lexer.tokenize();

        assertEquals(tokens[0].type, JSJSTokenType.THIS);
    },
});

Deno.test({
    name: "Lexer - tokenize new keyword",
    fn() {
        const lexer = new Lexer("new");

        const tokens = lexer.tokenize();

        assertEquals(tokens[0].type, JSJSTokenType.NEW);
    },
});

// ============================================================================
// Lexer Operator Tests
// ============================================================================

Deno.test({
    name: "Lexer - tokenize plus operator",
    fn() {
        const lexer = new Lexer("+");

        const tokens = lexer.tokenize();

        assertEquals(tokens[0].type, JSJSTokenType.PLUS);
    },
});

Deno.test({
    name: "Lexer - tokenize minus operator",
    fn() {
        const lexer = new Lexer("-");

        const tokens = lexer.tokenize();

        assertEquals(tokens[0].type, JSJSTokenType.MINUS);
    },
});

Deno.test({
    name: "Lexer - tokenize multiply operator",
    fn() {
        const lexer = new Lexer("*");

        const tokens = lexer.tokenize();

        assertEquals(tokens[0].type, JSJSTokenType.MULTIPLY);
    },
});

Deno.test({
    name: "Lexer - tokenize divide operator",
    fn() {
        const lexer = new Lexer("/");

        const tokens = lexer.tokenize();

        assertEquals(tokens[0].type, JSJSTokenType.DIVIDE);
    },
});

Deno.test({
    name: "Lexer - tokenize assign operator",
    fn() {
        const lexer = new Lexer("=");

        const tokens = lexer.tokenize();

        assertEquals(tokens[0].type, JSJSTokenType.ASSIGN);
    },
});

Deno.test({
    name: "Lexer - tokenize equal operator",
    fn() {
        const lexer = new Lexer("==");

        const tokens = lexer.tokenize();

        assertEquals(tokens[0].type, JSJSTokenType.EQUAL);
    },
});

Deno.test({
    name: "Lexer - tokenize strict equal operator",
    fn() {
        const lexer = new Lexer("===");

        const tokens = lexer.tokenize();

        assertEquals(tokens[0].type, JSJSTokenType.STRICT_EQUAL);
    },
});

Deno.test({
    name: "Lexer - tokenize not equal operator",
    fn() {
        const lexer = new Lexer("!=");

        const tokens = lexer.tokenize();

        assertEquals(tokens[0].type, JSJSTokenType.NOT_EQUAL);
    },
});

Deno.test({
    name: "Lexer - tokenize strict not equal operator",
    fn() {
        const lexer = new Lexer("!==");

        const tokens = lexer.tokenize();

        assertEquals(tokens[0].type, JSJSTokenType.STRICT_NOT_EQUAL);
    },
});

Deno.test({
    name: "Lexer - tokenize less than operator",
    fn() {
        const lexer = new Lexer("<");

        const tokens = lexer.tokenize();

        assertEquals(tokens[0].type, JSJSTokenType.LESS_THAN);
    },
});

Deno.test({
    name: "Lexer - tokenize greater than operator",
    fn() {
        const lexer = new Lexer(">");

        const tokens = lexer.tokenize();

        assertEquals(tokens[0].type, JSJSTokenType.GREATER_THAN);
    },
});

Deno.test({
    name: "Lexer - tokenize less equal operator",
    fn() {
        const lexer = new Lexer("<=");

        const tokens = lexer.tokenize();

        assertEquals(tokens[0].type, JSJSTokenType.LESS_EQUAL);
    },
});

Deno.test({
    name: "Lexer - tokenize greater equal operator",
    fn() {
        const lexer = new Lexer(">=");

        const tokens = lexer.tokenize();

        assertEquals(tokens[0].type, JSJSTokenType.GREATER_EQUAL);
    },
});

Deno.test({
    name: "Lexer - tokenize logical and operator",
    fn() {
        const lexer = new Lexer("&&");

        const tokens = lexer.tokenize();

        assertEquals(tokens[0].type, JSJSTokenType.LOGICAL_AND);
    },
});

Deno.test({
    name: "Lexer - tokenize logical or operator",
    fn() {
        const lexer = new Lexer("||");

        const tokens = lexer.tokenize();

        assertEquals(tokens[0].type, JSJSTokenType.LOGICAL_OR);
    },
});

Deno.test({
    name: "Lexer - tokenize logical not operator",
    fn() {
        const lexer = new Lexer("!");

        const tokens = lexer.tokenize();

        assertEquals(tokens[0].type, JSJSTokenType.LOGICAL_NOT);
    },
});

Deno.test({
    name: "Lexer - tokenize arrow operator",
    fn() {
        const lexer = new Lexer("=>");

        const tokens = lexer.tokenize();

        assertEquals(tokens[0].type, JSJSTokenType.ARROW);
    },
});

// ============================================================================
// Lexer Punctuation Tests
// ============================================================================

Deno.test({
    name: "Lexer - tokenize parentheses",
    fn() {
        const lexer = new Lexer("()");

        const tokens = lexer.tokenize();

        assertEquals(tokens[0].type, JSJSTokenType.LPAREN);
        assertEquals(tokens[1].type, JSJSTokenType.RPAREN);
    },
});

Deno.test({
    name: "Lexer - tokenize braces",
    fn() {
        const lexer = new Lexer("{}");

        const tokens = lexer.tokenize();

        assertEquals(tokens[0].type, JSJSTokenType.LBRACE);
        assertEquals(tokens[1].type, JSJSTokenType.RBRACE);
    },
});

Deno.test({
    name: "Lexer - tokenize brackets",
    fn() {
        const lexer = new Lexer("[]");

        const tokens = lexer.tokenize();

        assertEquals(tokens[0].type, JSJSTokenType.LBRACKET);
        assertEquals(tokens[1].type, JSJSTokenType.RBRACKET);
    },
});

Deno.test({
    name: "Lexer - tokenize semicolon",
    fn() {
        const lexer = new Lexer(";");

        const tokens = lexer.tokenize();

        assertEquals(tokens[0].type, JSJSTokenType.SEMICOLON);
    },
});

Deno.test({
    name: "Lexer - tokenize comma",
    fn() {
        const lexer = new Lexer(",");

        const tokens = lexer.tokenize();

        assertEquals(tokens[0].type, JSJSTokenType.COMMA);
    },
});

Deno.test({
    name: "Lexer - tokenize dot",
    fn() {
        const lexer = new Lexer(".");

        const tokens = lexer.tokenize();

        assertEquals(tokens[0].type, JSJSTokenType.DOT);
    },
});

// ============================================================================
// Lexer Whitespace and Comments Tests
// ============================================================================

Deno.test({
    name: "Lexer - skips whitespace",
    fn() {
        const lexer = new Lexer("  42  ");

        const tokens = lexer.tokenize();

        assertEquals(tokens.length, 2); // number + EOF
    },
});

Deno.test({
    name: "Lexer - skips line comments",
    fn() {
        const lexer = new Lexer("42 // comment");

        const tokens = lexer.tokenize();

        assertEquals(tokens.length, 2); // number + EOF
    },
});

Deno.test({
    name: "Lexer - tracks line numbers",
    fn() {
        const lexer = new Lexer("42\n43");

        const tokens = lexer.tokenize();

        assertEquals(tokens[0].line, 1);
        assertEquals(tokens[1].line, 2);
    },
});

// ============================================================================
// Lexer Integration Tests
// ============================================================================

Deno.test({
    name: "Lexer - tokenize variable declaration",
    fn() {
        const lexer = new Lexer("var x = 42;");

        const tokens = lexer.tokenize();

        assertEquals(tokens[0].type, JSJSTokenType.VAR);
        assertEquals(tokens[1].type, JSJSTokenType.IDENTIFIER);
        assertEquals(tokens[2].type, JSJSTokenType.ASSIGN);
        assertEquals(tokens[3].type, JSJSTokenType.NUMBER);
        assertEquals(tokens[4].type, JSJSTokenType.SEMICOLON);
    },
});

Deno.test({
    name: "Lexer - tokenize binary expression",
    fn() {
        const lexer = new Lexer("1 + 2");

        const tokens = lexer.tokenize();

        assertEquals(tokens[0].type, JSJSTokenType.NUMBER);
        assertEquals(tokens[1].type, JSJSTokenType.PLUS);
        assertEquals(tokens[2].type, JSJSTokenType.NUMBER);
    },
});

Deno.test({
    name: "Lexer - tokenize function declaration",
    fn() {
        const lexer = new Lexer("function add(a, b) { return a + b; }");

        const tokens = lexer.tokenize();

        assertEquals(tokens[0].type, JSJSTokenType.FUNCTION);
        assertEquals(tokens[1].type, JSJSTokenType.IDENTIFIER);
        assertEquals(tokens[2].type, JSJSTokenType.LPAREN);
    },
});

// ============================================================================
// Parser Constructor Tests
// ============================================================================

Deno.test({
    name: "Parser - constructor creates parser instance",
    fn() {
        const tokens: JSToken[] = [
            { type: JSJSTokenType.EOF, value: "", line: 1, column: 1 },
        ];
        const parser = new Parser(tokens);

        assertExists(parser);
    },
});

Deno.test({
    name: "Parser - parse returns ProgramNode",
    fn() {
        const tokens: JSToken[] = [
            { type: JSJSTokenType.EOF, value: "", line: 1, column: 1 },
        ];
        const parser = new Parser(tokens);

        const ast = parser.parse();

        assertEquals(ast.type, ASTNodeType.PROGRAM);
        assertExists(ast.body);
    },
});

// ============================================================================
// Parser Expression Tests
// ============================================================================

Deno.test({
    name: "Parser - parse number literal",
    fn() {
        const lexer = new Lexer("42;");
        const tokens = lexer.tokenize();
        const parser = new Parser(tokens);

        const ast = parser.parse();

        assertEquals(ast.body.length, 1);
        assertEquals(ast.body[0].type, ASTNodeType.EXPRESSION_STATEMENT);
    },
});

Deno.test({
    name: "Parser - parse string literal",
    fn() {
        const lexer = new Lexer('"hello";');
        const tokens = lexer.tokenize();
        const parser = new Parser(tokens);

        const ast = parser.parse();

        assertEquals(ast.body.length, 1);
    },
});

Deno.test({
    name: "Parser - parse boolean true",
    fn() {
        const lexer = new Lexer("true;");
        const tokens = lexer.tokenize();
        const parser = new Parser(tokens);

        const ast = parser.parse();

        assertEquals(ast.body.length, 1);
    },
});

Deno.test({
    name: "Parser - parse boolean false",
    fn() {
        const lexer = new Lexer("false;");
        const tokens = lexer.tokenize();
        const parser = new Parser(tokens);

        const ast = parser.parse();

        assertEquals(ast.body.length, 1);
    },
});

Deno.test({
    name: "Parser - parse null",
    fn() {
        const lexer = new Lexer("null;");
        const tokens = lexer.tokenize();
        const parser = new Parser(tokens);

        const ast = parser.parse();

        assertEquals(ast.body.length, 1);
    },
});

Deno.test({
    name: "Parser - parse identifier",
    fn() {
        const lexer = new Lexer("x;");
        const tokens = lexer.tokenize();
        const parser = new Parser(tokens);

        const ast = parser.parse();

        assertEquals(ast.body.length, 1);
    },
});

Deno.test({
    name: "Parser - parse binary expression",
    fn() {
        const lexer = new Lexer("1 + 2;");
        const tokens = lexer.tokenize();
        const parser = new Parser(tokens);

        const ast = parser.parse();

        assertEquals(ast.body.length, 1);
        const stmt = ast.body[0] as any;
        assertEquals(stmt.expression.type, ASTNodeType.BINARY_EXPRESSION);
    },
});

Deno.test({
    name: "Parser - parse parenthesized expression",
    fn() {
        const lexer = new Lexer("(42);");
        const tokens = lexer.tokenize();
        const parser = new Parser(tokens);

        const ast = parser.parse();

        assertEquals(ast.body.length, 1);
    },
});

// ============================================================================
// Parser Statement Tests
// ============================================================================

Deno.test({
    name: "Parser - parse variable declaration with var",
    fn() {
        const lexer = new Lexer("var x = 42;");
        const tokens = lexer.tokenize();
        const parser = new Parser(tokens);

        const ast = parser.parse();

        assertEquals(ast.body.length, 1);
        assertEquals(ast.body[0].type, ASTNodeType.VARIABLE_DECLARATION);
    },
});

Deno.test({
    name: "Parser - parse variable declaration with let",
    fn() {
        const lexer = new Lexer("let y = 10;");
        const tokens = lexer.tokenize();
        const parser = new Parser(tokens);

        const ast = parser.parse();

        assertEquals(ast.body.length, 1);
        assertEquals(ast.body[0].type, ASTNodeType.VARIABLE_DECLARATION);
    },
});

Deno.test({
    name: "Parser - parse variable declaration with const",
    fn() {
        const lexer = new Lexer("const z = 5;");
        const tokens = lexer.tokenize();
        const parser = new Parser(tokens);

        const ast = parser.parse();

        assertEquals(ast.body.length, 1);
        assertEquals(ast.body[0].type, ASTNodeType.VARIABLE_DECLARATION);
    },
});

Deno.test({
    name: "Parser - parse function declaration",
    fn() {
        const lexer = new Lexer("function add(a, b) { return a + b; }");
        const tokens = lexer.tokenize();
        const parser = new Parser(tokens);

        const ast = parser.parse();

        assertEquals(ast.body.length, 1);
        assertEquals(ast.body[0].type, ASTNodeType.FUNCTION_DECLARATION);
    },
});

Deno.test({
    name: "Parser - parse return statement with value",
    fn() {
        const lexer = new Lexer("function f() { return 42; }");
        const tokens = lexer.tokenize();
        const parser = new Parser(tokens);

        const ast = parser.parse();

        assertEquals(ast.body.length, 1);
    },
});

Deno.test({
    name: "Parser - parse return statement without value",
    fn() {
        const lexer = new Lexer("function f() { return; }");
        const tokens = lexer.tokenize();
        const parser = new Parser(tokens);

        const ast = parser.parse();

        assertEquals(ast.body.length, 1);
    },
});

Deno.test({
    name: "Parser - parse block statement",
    fn() {
        const lexer = new Lexer("{ var x = 1; }");
        const tokens = lexer.tokenize();
        const parser = new Parser(tokens);

        const ast = parser.parse();

        assertEquals(ast.body.length, 1);
        assertEquals(ast.body[0].type, ASTNodeType.BLOCK_STATEMENT);
    },
});

// ============================================================================
// BytecodeGenerator Constructor Tests
// ============================================================================

Deno.test({
    name: "BytecodeGenerator - constructor creates generator instance",
    fn() {
        const generator = new BytecodeGenerator();

        assertExists(generator);
    },
});

Deno.test({
    name: "BytecodeGenerator - generate returns CompiledFunction",
    fn() {
        const generator = new BytecodeGenerator();
        const ast: ProgramNode = {
            type: ASTNodeType.PROGRAM,
            body: [],
        };

        const compiled = generator.generate(ast);

        assertExists(compiled);
        assertEquals(typeof compiled.name, "string");
        assertEquals(typeof compiled.parameterCount, "number");
        assertExists(compiled.bytecode);
    },
});

Deno.test({
    name: "BytecodeGenerator - generate creates constant pool",
    fn() {
        const generator = new BytecodeGenerator();
        const ast: ProgramNode = {
            type: ASTNodeType.PROGRAM,
            body: [],
        };

        const compiled = generator.generate(ast);

        assertExists(compiled.constantPool);
        assert(Array.isArray(compiled.constantPool));
    },
});

Deno.test({
    name: "BytecodeGenerator - generate creates bytecode array",
    fn() {
        const generator = new BytecodeGenerator();
        const ast: ProgramNode = {
            type: ASTNodeType.PROGRAM,
            body: [],
        };

        const compiled = generator.generate(ast);

        assert(compiled.bytecode instanceof Uint8Array);
    },
});

// ============================================================================
// V8Compiler Tests
// ============================================================================

Deno.test({
    name: "V8Compiler - compile compiles simple expression",
    fn() {
        const compiler = new V8Compiler();

        const compiled = compiler.compile("42");

        assertExists(compiled);
        assertExists(compiled.bytecode);
    },
});

Deno.test({
    name: "V8Compiler - compile creates bytecode",
    fn() {
        const compiler = new V8Compiler();

        const compiled = compiler.compile("1 + 2");

        assert(compiled.bytecode.length > 0);
    },
});

Deno.test({
    name: "V8Compiler - compile creates constant pool",
    fn() {
        const compiler = new V8Compiler();

        const compiled = compiler.compile("42");

        assertExists(compiled.constantPool);
    },
});

Deno.test({
    name: "V8Compiler - parse parses to AST",
    fn() {
        const compiler = new V8Compiler();

        const ast = compiler.parse("var x = 42;");

        assertEquals(ast.type, ASTNodeType.PROGRAM);
        assertEquals(ast.body.length, 1);
    },
});

Deno.test({
    name: "V8Compiler - tokenize tokenizes source",
    fn() {
        const compiler = new V8Compiler();

        const tokens = compiler.tokenize("var x = 42;");

        assert(tokens.length > 0);
        assertEquals(tokens[0].type, JSJSTokenType.VAR);
    },
});

// ============================================================================
// Integration Tests
// ============================================================================

Deno.test({
    name: "V8Compiler - compile variable declaration",
    fn() {
        const compiler = new V8Compiler();

        const compiled = compiler.compile("var x = 42;");

        assertExists(compiled);
        assert(compiled.bytecode.length > 0);
    },
});

Deno.test({
    name: "V8Compiler - compile function declaration",
    fn() {
        const compiler = new V8Compiler();

        const compiled = compiler.compile("function add(a, b) { return a + b; }");

        assertExists(compiled);
    },
});

Deno.test({
    name: "V8Compiler - compile arithmetic operations",
    fn() {
        const compiler = new V8Compiler();

        const add = compiler.compile("1 + 2");
        const sub = compiler.compile("5 - 3");
        const mul = compiler.compile("2 * 3");
        const div = compiler.compile("10 / 2");

        assertExists(add.bytecode);
        assertExists(sub.bytecode);
        assertExists(mul.bytecode);
        assertExists(div.bytecode);
    },
});

Deno.test({
    name: "V8Compiler - compile comparison operations",
    fn() {
        const compiler = new V8Compiler();

        const eq = compiler.compile("1 == 2");
        const lt = compiler.compile("1 < 2");
        const gt = compiler.compile("2 > 1");

        assertExists(eq.bytecode);
        assertExists(lt.bytecode);
        assertExists(gt.bytecode);
    },
});

Deno.test({
    name: "V8Compiler - full pipeline: source to bytecode",
    fn() {
        const compiler = new V8Compiler();
        const source = "var x = 1; var y = 2; x + y;";

        // Tokenize
        const tokens = compiler.tokenize(source);
        assert(tokens.length > 0);

        // Parse
        const ast = compiler.parse(source);
        assertEquals(ast.type, ASTNodeType.PROGRAM);

        // Compile
        const compiled = compiler.compile(source);
        assertExists(compiled.bytecode);
    },
});

Deno.test({
    name: "V8Compiler - compile multiple statements",
    fn() {
        const compiler = new V8Compiler();
        const source = `
            var a = 1;
            var b = 2;
            var c = 3;
        `;

        const compiled = compiler.compile(source);

        assertExists(compiled);
        assert(compiled.bytecode.length > 0);
    },
});

Deno.test({
    name: "V8Compiler - compile with all literal types",
    fn() {
        const compiler = new V8Compiler();

        const num = compiler.compile("42;");
        const str = compiler.compile('"hello";');
        const bool = compiler.compile("true;");
        const nil = compiler.compile("null;");

        assertExists(num.bytecode);
        assertExists(str.bytecode);
        assertExists(bool.bytecode);
        assertExists(nil.bytecode);
    },
});
