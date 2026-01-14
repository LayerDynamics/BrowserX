/**
 * V8 Compiler
 *
 * Compiles JavaScript to Ignition bytecode.
 * Implements:
 * - Lexical analysis (tokenization)
 * - Syntax analysis (AST generation)
 * - Bytecode generation for Ignition interpreter
 * - Register allocation
 * - Basic optimizations
 */

/**
 * JSToken types
 */
export enum JSJSTokenType {
    // Literals
    NUMBER = "number",
    STRING = "string",
    TRUE = "true",
    FALSE = "false",
    NULL = "null",
    UNDEFINED = "undefined",

    // Identifiers and keywords
    IDENTIFIER = "identifier",
    VAR = "var",
    LET = "let",
    CONST = "const",
    FUNCTION = "function",
    RETURN = "return",
    IF = "if",
    ELSE = "else",
    WHILE = "while",
    FOR = "for",
    BREAK = "break",
    CONTINUE = "continue",
    THIS = "this",
    NEW = "new",

    // Operators
    PLUS = "+",
    MINUS = "-",
    MULTIPLY = "*",
    DIVIDE = "/",
    MODULO = "%",
    ASSIGN = "=",
    EQUAL = "==",
    NOT_EQUAL = "!=",
    STRICT_EQUAL = "===",
    STRICT_NOT_EQUAL = "!==",
    LESS_THAN = "<",
    GREATER_THAN = ">",
    LESS_EQUAL = "<=",
    GREATER_EQUAL = ">=",
    LOGICAL_AND = "&&",
    LOGICAL_OR = "||",
    LOGICAL_NOT = "!",

    // Punctuation
    LPAREN = "(",
    RPAREN = ")",
    LBRACE = "{",
    RBRACE = "}",
    LBRACKET = "[",
    RBRACKET = "]",
    SEMICOLON = ";",
    COMMA = ",",
    DOT = ".",
    COLON = ":",
    QUESTION = "?",
    ARROW = "=>",

    // Special
    EOF = "eof",
    NEWLINE = "newline",
}

/**
 * JSToken
 */
export interface JSToken {
    type: JSJSTokenType;
    value: string;
    line: number;
    column: number;
}

/**
 * AST Node types
 */
export enum ASTNodeType {
    PROGRAM = "Program",
    LITERAL = "Literal",
    IDENTIFIER = "Identifier",
    BINARY_EXPRESSION = "BinaryExpression",
    UNARY_EXPRESSION = "UnaryExpression",
    ASSIGNMENT_EXPRESSION = "AssignmentExpression",
    CALL_EXPRESSION = "CallExpression",
    MEMBER_EXPRESSION = "MemberExpression",
    CONDITIONAL_EXPRESSION = "ConditionalExpression",
    FUNCTION_EXPRESSION = "FunctionExpression",
    ARROW_FUNCTION_EXPRESSION = "ArrowFunctionExpression",
    OBJECT_EXPRESSION = "ObjectExpression",
    ARRAY_EXPRESSION = "ArrayExpression",
    THIS_EXPRESSION = "ThisExpression",
    NEW_EXPRESSION = "NewExpression",

    EXPRESSION_STATEMENT = "ExpressionStatement",
    VARIABLE_DECLARATION = "VariableDeclaration",
    FUNCTION_DECLARATION = "FunctionDeclaration",
    RETURN_STATEMENT = "ReturnStatement",
    IF_STATEMENT = "IfStatement",
    WHILE_STATEMENT = "WhileStatement",
    FOR_STATEMENT = "ForStatement",
    BLOCK_STATEMENT = "BlockStatement",
    BREAK_STATEMENT = "BreakStatement",
    CONTINUE_STATEMENT = "ContinueStatement",
}

/**
 * AST Node base
 */
export interface ASTNode {
    type: ASTNodeType;
    loc?: SourceLocation;
}

/**
 * Source location
 */
export interface SourceLocation {
    start: { line: number; column: number };
    end: { line: number; column: number };
}

/**
 * Literal node
 */
export interface LiteralNode extends ASTNode {
    type: ASTNodeType.LITERAL;
    value: string | number | boolean | null;
    raw: string;
}

/**
 * Identifier node
 */
export interface IdentifierNode extends ASTNode {
    type: ASTNodeType.IDENTIFIER;
    name: string;
}

/**
 * Binary expression node
 */
export interface BinaryExpressionNode extends ASTNode {
    type: ASTNodeType.BINARY_EXPRESSION;
    operator: string;
    left: ASTNode;
    right: ASTNode;
}

/**
 * Expression statement node
 */
export interface ExpressionStatementNode extends ASTNode {
    type: ASTNodeType.EXPRESSION_STATEMENT;
    expression: ASTNode;
}

/**
 * Return statement node
 */
export interface ReturnStatementNode extends ASTNode {
    type: ASTNodeType.RETURN_STATEMENT;
    argument: ASTNode | null;
}

/**
 * Function declaration node
 */
export interface FunctionDeclarationNode extends ASTNode {
    type: ASTNodeType.FUNCTION_DECLARATION;
    id: IdentifierNode;
    params: IdentifierNode[];
    body: BlockStatementNode;
}

/**
 * Block statement node
 */
export interface BlockStatementNode extends ASTNode {
    type: ASTNodeType.BLOCK_STATEMENT;
    body: ASTNode[];
}

/**
 * Variable declaration node
 */
export interface VariableDeclarationNode extends ASTNode {
    type: ASTNodeType.VARIABLE_DECLARATION;
    kind: "var" | "let" | "const";
    declarations: VariableDeclaratorNode[];
}

/**
 * Variable declarator node
 */
export interface VariableDeclaratorNode {
    id: IdentifierNode;
    init: ASTNode | null;
}

/**
 * Program node (root)
 */
export interface ProgramNode extends ASTNode {
    type: ASTNodeType.PROGRAM;
    body: ASTNode[];
}

/**
 * Ignition bytecode opcodes
 */
export enum Opcode {
    // Load/Store
    LDA = 0x01, // Load Accumulator
    LDAR = 0x02, // Load Accumulator from Register
    STAR = 0x03, // Store Accumulator to Register
    LDA_ZERO = 0x04, // Load zero to Accumulator
    LDA_UNDEFINED = 0x05, // Load undefined to Accumulator
    LDA_NULL = 0x06, // Load null to Accumulator
    LDA_TRUE = 0x07, // Load true to Accumulator
    LDA_FALSE = 0x08, // Load false to Accumulator
    LDA_CONSTANT = 0x09, // Load constant to Accumulator

    // Arithmetic
    ADD = 0x10, // Add
    SUB = 0x11, // Subtract
    MUL = 0x12, // Multiply
    DIV = 0x13, // Divide
    MOD = 0x14, // Modulo
    INC = 0x15, // Increment
    DEC = 0x16, // Decrement
    NEGATE = 0x17, // Negate

    // Comparison
    TEST_EQUAL = 0x20, // Test equal
    TEST_NOT_EQUAL = 0x21, // Test not equal
    TEST_STRICT_EQUAL = 0x22, // Test strict equal
    TEST_LESS_THAN = 0x23, // Test less than
    TEST_GREATER_THAN = 0x24, // Test greater than
    TEST_LESS_EQUAL = 0x25, // Test less than or equal
    TEST_GREATER_EQUAL = 0x26, // Test greater than or equal

    // Logical
    LOGICAL_NOT = 0x30, // Logical NOT
    TO_BOOLEAN = 0x31, // Convert to boolean

    // Control flow
    JUMP = 0x40, // Unconditional jump
    JUMP_IF_TRUE = 0x41, // Jump if accumulator is true
    JUMP_IF_FALSE = 0x42, // Jump if accumulator is false
    RETURN = 0x43, // Return from function

    // Function calls
    CALL = 0x50, // Call function
    CONSTRUCT = 0x51, // Construct object with new

    // Property access
    GET_PROPERTY = 0x60, // Get property
    SET_PROPERTY = 0x61, // Set property
    GET_KEYED = 0x62, // Get property by key (bracket notation)
    SET_KEYED = 0x63, // Set property by key

    // Variable access
    LDA_GLOBAL = 0x70, // Load global variable
    STA_GLOBAL = 0x71, // Store global variable
    LDA_CONTEXT_SLOT = 0x72, // Load from context
    STA_CONTEXT_SLOT = 0x73, // Store to context

    // Object creation
    CREATE_OBJECT = 0x80, // Create object literal
    CREATE_ARRAY = 0x81, // Create array literal
    CREATE_CLOSURE = 0x82, // Create function closure

    // Special
    NOP = 0x00, // No operation
    DEBUGGER = 0xFF, // Debugger statement
}

/**
 * Bytecode instruction
 */
export interface BytecodeInstruction {
    opcode: Opcode;
    operands: number[];
}

/**
 * Compiled function
 */
export interface CompiledFunction {
    name: string;
    parameterCount: number;
    registerCount: number;
    bytecode: Uint8Array;
    constantPool: unknown[];
    sourceMap?: SourceMap;
}

/**
 * Source map
 */
export interface SourceMap {
    mappings: Array<{ offset: number; line: number; column: number }>;
}

/**
 * Lexer
 * JSTokenizes JavaScript source code
 */
export class Lexer {
    private source: string;
    private position: number = 0;
    private line: number = 1;
    private column: number = 1;

    constructor(source: string) {
        this.source = source;
    }

    /**
     * JSTokenize source code
     */
    tokenize(): JSToken[] {
        const tokens: JSToken[] = [];

        while (this.position < this.source.length) {
            const token = this.nextJSToken();
            if (token.type !== JSJSTokenType.NEWLINE) {
                tokens.push(token);
            }
        }

        // Add EOF token only if not already present
        if (tokens.length === 0 || tokens[tokens.length - 1].type !== JSJSTokenType.EOF) {
            tokens.push({
                type: JSJSTokenType.EOF,
                value: "",
                line: this.line,
                column: this.column,
            });
        }

        return tokens;
    }

    /**
     * Get next token
     */
    private nextJSToken(): JSToken {
        this.skipWhitespace();

        if (this.position >= this.source.length) {
            return this.createJSToken(JSJSTokenType.EOF, "");
        }

        const char = this.source[this.position];

        // Numbers
        if (this.isDigit(char)) {
            return this.scanNumber();
        }

        // Strings
        if (char === '"' || char === "'") {
            return this.scanString();
        }

        // Identifiers and keywords
        if (this.isIdentifierStart(char)) {
            return this.scanIdentifier();
        }

        // Operators and punctuation
        return this.scanOperator();
    }

    /**
     * Scan number
     */
    private scanNumber(): JSToken {
        const start = this.position;
        while (this.position < this.source.length && this.isDigit(this.source[this.position])) {
            this.advance();
        }

        // Handle decimal point
        if (this.source[this.position] === ".") {
            this.advance();
            while (this.position < this.source.length && this.isDigit(this.source[this.position])) {
                this.advance();
            }
        }

        const value = this.source.slice(start, this.position);
        return this.createJSToken(JSJSTokenType.NUMBER, value);
    }

    /**
     * Scan string
     */
    private scanString(): JSToken {
        const quote = this.source[this.position];
        this.advance(); // Skip opening quote

        const start = this.position;
        while (this.position < this.source.length && this.source[this.position] !== quote) {
            if (this.source[this.position] === "\\") {
                this.advance(); // Skip escape char
            }
            this.advance();
        }

        const value = this.source.slice(start, this.position);
        this.advance(); // Skip closing quote

        return this.createJSToken(JSJSTokenType.STRING, value);
    }

    /**
     * Scan identifier or keyword
     */
    private scanIdentifier(): JSToken {
        const start = this.position;
        while (
            this.position < this.source.length && this.isIdentifierPart(this.source[this.position])
        ) {
            this.advance();
        }

        const value = this.source.slice(start, this.position);
        const type = this.getKeywordType(value);

        return this.createJSToken(type, value);
    }

    /**
     * Scan operator or punctuation
     */
    private scanOperator(): JSToken {
        const char = this.source[this.position];
        const nextChar = this.source[this.position + 1];

        // Three-character operators
        if (char === "=" && nextChar === "=" && this.source[this.position + 2] === "=") {
            this.advance(3);
            return this.createJSToken(JSJSTokenType.STRICT_EQUAL, "===");
        }
        if (char === "!" && nextChar === "=" && this.source[this.position + 2] === "=") {
            this.advance(3);
            return this.createJSToken(JSJSTokenType.STRICT_NOT_EQUAL, "!==");
        }

        // Two-character operators
        if (char === "=" && nextChar === ">") {
            this.advance(2);
            return this.createJSToken(JSJSTokenType.ARROW, "=>");
        }
        if (char === "=" && nextChar === "=") {
            this.advance(2);
            return this.createJSToken(JSJSTokenType.EQUAL, "==");
        }
        if (char === "!" && nextChar === "=") {
            this.advance(2);
            return this.createJSToken(JSJSTokenType.NOT_EQUAL, "!=");
        }
        if (char === "<" && nextChar === "=") {
            this.advance(2);
            return this.createJSToken(JSJSTokenType.LESS_EQUAL, "<=");
        }
        if (char === ">" && nextChar === "=") {
            this.advance(2);
            return this.createJSToken(JSJSTokenType.GREATER_EQUAL, ">=");
        }
        if (char === "&" && nextChar === "&") {
            this.advance(2);
            return this.createJSToken(JSJSTokenType.LOGICAL_AND, "&&");
        }
        if (char === "|" && nextChar === "|") {
            this.advance(2);
            return this.createJSToken(JSJSTokenType.LOGICAL_OR, "||");
        }

        // Single-character operators
        const singleCharMap: Record<string, JSJSTokenType> = {
            "+": JSJSTokenType.PLUS,
            "-": JSJSTokenType.MINUS,
            "*": JSJSTokenType.MULTIPLY,
            "/": JSJSTokenType.DIVIDE,
            "%": JSJSTokenType.MODULO,
            "=": JSJSTokenType.ASSIGN,
            "<": JSJSTokenType.LESS_THAN,
            ">": JSJSTokenType.GREATER_THAN,
            "!": JSJSTokenType.LOGICAL_NOT,
            "(": JSJSTokenType.LPAREN,
            ")": JSJSTokenType.RPAREN,
            "{": JSJSTokenType.LBRACE,
            "}": JSJSTokenType.RBRACE,
            "[": JSJSTokenType.LBRACKET,
            "]": JSJSTokenType.RBRACKET,
            ";": JSJSTokenType.SEMICOLON,
            ",": JSJSTokenType.COMMA,
            ".": JSJSTokenType.DOT,
            ":": JSJSTokenType.COLON,
            "?": JSJSTokenType.QUESTION,
        };

        if (char in singleCharMap) {
            this.advance();
            return this.createJSToken(singleCharMap[char], char);
        }

        throw new Error(`Unexpected character: ${char}`);
    }

    /**
     * Skip whitespace
     */
    private skipWhitespace(): void {
        while (this.position < this.source.length) {
            const char = this.source[this.position];
            if (char === " " || char === "\t" || char === "\r" || char === "\n") {
                if (char === "\n") {
                    this.line++;
                    this.column = 1;
                } else {
                    this.column++;
                }
                this.position++;
            } else if (char === "/" && this.source[this.position + 1] === "/") {
                // Skip line comment
                while (this.position < this.source.length && this.source[this.position] !== "\n") {
                    this.position++;
                }
            } else {
                break;
            }
        }
    }

    /**
     * Get keyword type
     */
    private getKeywordType(value: string): JSJSTokenType {
        const keywords: Record<string, JSJSTokenType> = {
            "var": JSJSTokenType.VAR,
            "let": JSJSTokenType.LET,
            "const": JSJSTokenType.CONST,
            "function": JSJSTokenType.FUNCTION,
            "return": JSJSTokenType.RETURN,
            "if": JSJSTokenType.IF,
            "else": JSJSTokenType.ELSE,
            "while": JSJSTokenType.WHILE,
            "for": JSJSTokenType.FOR,
            "break": JSJSTokenType.BREAK,
            "continue": JSJSTokenType.CONTINUE,
            "true": JSJSTokenType.TRUE,
            "false": JSJSTokenType.FALSE,
            "null": JSJSTokenType.NULL,
            "undefined": JSJSTokenType.UNDEFINED,
            "this": JSJSTokenType.THIS,
            "new": JSJSTokenType.NEW,
        };

        return keywords[value] || JSJSTokenType.IDENTIFIER;
    }

    /**
     * Advance position
     */
    private advance(count: number = 1): void {
        this.position += count;
        this.column += count;
    }

    /**
     * Create token
     */
    private createJSToken(type: JSJSTokenType, value: string): JSToken {
        return {
            type,
            value,
            line: this.line,
            column: this.column,
        };
    }

    /**
     * Check if character is digit
     */
    private isDigit(char: string): boolean {
        return char >= "0" && char <= "9";
    }

    /**
     * Check if character can start identifier
     */
    private isIdentifierStart(char: string): boolean {
        return (char >= "a" && char <= "z") ||
            (char >= "A" && char <= "Z") ||
            char === "_" || char === "$";
    }

    /**
     * Check if character can be part of identifier
     */
    private isIdentifierPart(char: string): boolean {
        return this.isIdentifierStart(char) || this.isDigit(char);
    }
}

/**
 * Parser
 * Parses tokens into AST
 */
export class Parser {
    private tokens: JSToken[];
    private position: number = 0;

    constructor(tokens: JSToken[]) {
        this.tokens = tokens;
    }

    /**
     * Parse tokens into AST
     */
    parse(): ProgramNode {
        const body: ASTNode[] = [];

        while (!this.isAtEnd()) {
            body.push(this.parseStatement());
        }

        return {
            type: ASTNodeType.PROGRAM,
            body,
        };
    }

    /**
     * Parse statement
     */
    private parseStatement(): ASTNode {
        const token = this.peek();

        switch (token.type) {
            case JSJSTokenType.VAR:
            case JSJSTokenType.LET:
            case JSJSTokenType.CONST:
                return this.parseVariableDeclaration();
            case JSJSTokenType.FUNCTION:
                return this.parseFunctionDeclaration();
            case JSJSTokenType.RETURN:
                return this.parseReturnStatement();
            case JSJSTokenType.LBRACE:
                return this.parseBlockStatement();
            default:
                return this.parseExpressionStatement();
        }
    }

    /**
     * Parse variable declaration
     */
    private parseVariableDeclaration(): VariableDeclarationNode {
        const kind = this.advance().value as "var" | "let" | "const";
        const declarations: VariableDeclaratorNode[] = [];

        do {
            const id = this.parseIdentifier();
            let init: ASTNode | null = null;

            if (this.match(JSJSTokenType.ASSIGN)) {
                this.advance();
                init = this.parseExpression();
            }

            declarations.push({ id, init });
        } while (this.match(JSJSTokenType.COMMA) && this.advance());

        // Semicolons are optional in JavaScript (ASI - Automatic Semicolon Insertion)
        if (this.match(JSJSTokenType.SEMICOLON)) {
            this.advance();
        }

        return {
            type: ASTNodeType.VARIABLE_DECLARATION,
            kind,
            declarations,
        };
    }

    /**
     * Parse function declaration
     */
    private parseFunctionDeclaration(): FunctionDeclarationNode {
        this.consume(JSJSTokenType.FUNCTION);
        const id = this.parseIdentifier();

        this.consume(JSJSTokenType.LPAREN);
        const params: IdentifierNode[] = [];

        while (!this.match(JSJSTokenType.RPAREN)) {
            params.push(this.parseIdentifier());
            if (!this.match(JSJSTokenType.RPAREN)) {
                this.consume(JSJSTokenType.COMMA);
            }
        }

        this.consume(JSJSTokenType.RPAREN);
        const body = this.parseBlockStatement();

        return {
            type: ASTNodeType.FUNCTION_DECLARATION,
            id,
            params,
            body,
        };
    }

    /**
     * Parse return statement
     */
    private parseReturnStatement(): ASTNode {
        this.consume(JSJSTokenType.RETURN);
        const argument = this.match(JSJSTokenType.SEMICOLON) ? null : this.parseExpression();

        // Semicolons are optional in JavaScript (ASI - Automatic Semicolon Insertion)
        if (this.match(JSJSTokenType.SEMICOLON)) {
            this.advance();
        }

        return {
            type: ASTNodeType.RETURN_STATEMENT,
            argument,
        } as ReturnStatementNode;
    }

    /**
     * Parse block statement
     */
    private parseBlockStatement(): BlockStatementNode {
        this.consume(JSJSTokenType.LBRACE);
        const body: ASTNode[] = [];

        while (!this.match(JSJSTokenType.RBRACE)) {
            body.push(this.parseStatement());
        }

        this.consume(JSJSTokenType.RBRACE);

        return {
            type: ASTNodeType.BLOCK_STATEMENT,
            body,
        };
    }

    /**
     * Parse expression statement
     */
    private parseExpressionStatement(): ASTNode {
        const expression = this.parseExpression();

        // Semicolons are optional in JavaScript (ASI - Automatic Semicolon Insertion)
        if (this.match(JSJSTokenType.SEMICOLON)) {
            this.advance();
        }

        return {
            type: ASTNodeType.EXPRESSION_STATEMENT,
            expression,
        } as ExpressionStatementNode;
    }

    /**
     * Parse expression
     */
    private parseExpression(): ASTNode {
        return this.parseBinaryExpression();
    }

    /**
     * Parse binary expression
     */
    private parseBinaryExpression(): ASTNode {
        let left = this.parsePrimaryExpression();

        while (this.isBinaryOperator()) {
            const operator = this.advance().value;
            const right = this.parsePrimaryExpression();

            left = {
                type: ASTNodeType.BINARY_EXPRESSION,
                operator,
                left,
                right,
            } as BinaryExpressionNode;
        }

        return left;
    }

    /**
     * Parse primary expression
     */
    private parsePrimaryExpression(): ASTNode {
        const token = this.peek();

        switch (token.type) {
            case JSJSTokenType.NUMBER:
            case JSJSTokenType.STRING:
            case JSJSTokenType.TRUE:
            case JSJSTokenType.FALSE:
            case JSJSTokenType.NULL:
            case JSJSTokenType.UNDEFINED:
                return this.parseLiteral();
            case JSJSTokenType.IDENTIFIER:
                return this.parseIdentifier();
            case JSJSTokenType.LPAREN:
                this.advance();
                const expr = this.parseExpression();
                this.consume(JSJSTokenType.RPAREN);
                return expr;
            default:
                throw new Error(`Unexpected token: ${token.type}`);
        }
    }

    /**
     * Parse literal
     */
    private parseLiteral(): LiteralNode {
        const token = this.advance();
        let value: string | number | boolean | null;

        switch (token.type) {
            case JSJSTokenType.NUMBER:
                value = parseFloat(token.value);
                break;
            case JSJSTokenType.STRING:
                value = token.value;
                break;
            case JSJSTokenType.TRUE:
                value = true;
                break;
            case JSJSTokenType.FALSE:
                value = false;
                break;
            case JSJSTokenType.NULL:
                value = null;
                break;
            default:
                value = null;
        }

        return {
            type: ASTNodeType.LITERAL,
            value,
            raw: token.value,
        };
    }

    /**
     * Parse identifier
     */
    private parseIdentifier(): IdentifierNode {
        const token = this.consume(JSJSTokenType.IDENTIFIER);
        return {
            type: ASTNodeType.IDENTIFIER,
            name: token.value,
        };
    }

    /**
     * Check if current token is binary operator
     */
    private isBinaryOperator(): boolean {
        const token = this.peek();
        return [
            JSJSTokenType.PLUS,
            JSJSTokenType.MINUS,
            JSJSTokenType.MULTIPLY,
            JSJSTokenType.DIVIDE,
            JSJSTokenType.EQUAL,
            JSJSTokenType.NOT_EQUAL,
            JSJSTokenType.LESS_THAN,
            JSJSTokenType.GREATER_THAN,
        ].includes(token.type);
    }

    /**
     * Peek at current token
     */
    private peek(): JSToken {
        return this.tokens[this.position];
    }

    /**
     * Advance to next token
     */
    private advance(): JSToken {
        return this.tokens[this.position++];
    }

    /**
     * Match current token type
     */
    private match(type: JSJSTokenType): boolean {
        return this.peek().type === type;
    }

    /**
     * Consume token of expected type
     */
    private consume(type: JSJSTokenType): JSToken {
        const token = this.peek();
        if (token.type !== type) {
            throw new Error(`Expected ${type} but got ${token.type}`);
        }
        return this.advance();
    }

    /**
     * Check if at end
     */
    private isAtEnd(): boolean {
        return this.peek().type === JSJSTokenType.EOF;
    }
}

/**
 * Bytecode generator
 * Generates Ignition bytecode from AST
 */
export class BytecodeGenerator {
    private instructions: BytecodeInstruction[] = [];
    private constantPool: unknown[] = [];
    private registerCount: number = 0;

    /**
     * Generate bytecode from AST
     */
    generate(ast: ProgramNode): CompiledFunction {
        // Generate bytecode for program body
        for (const node of ast.body) {
            this.generateNode(node);
        }

        // Return undefined at end of program
        this.emit(Opcode.LDA_UNDEFINED);
        this.emit(Opcode.RETURN);

        return {
            name: "<main>",
            parameterCount: 0,
            registerCount: this.registerCount,
            bytecode: this.serializeBytecode(),
            constantPool: this.constantPool,
        };
    }

    /**
     * Generate bytecode for node
     */
    private generateNode(node: ASTNode): void {
        switch (node.type) {
            case ASTNodeType.VARIABLE_DECLARATION:
                this.generateVariableDeclaration(node as VariableDeclarationNode);
                break;
            case ASTNodeType.FUNCTION_DECLARATION:
                this.generateFunctionDeclaration(node as FunctionDeclarationNode);
                break;
            case ASTNodeType.EXPRESSION_STATEMENT:
                this.generateExpression((node as ExpressionStatementNode).expression);
                break;
            case ASTNodeType.RETURN_STATEMENT:
                this.generateReturnStatement(node as ReturnStatementNode);
                break;
            case ASTNodeType.BINARY_EXPRESSION:
                this.generateBinaryExpression(node as BinaryExpressionNode);
                break;
            case ASTNodeType.LITERAL:
                this.generateLiteral(node as LiteralNode);
                break;
            case ASTNodeType.IDENTIFIER:
                this.generateIdentifier(node as IdentifierNode);
                break;
        }
    }

    /**
     * Generate variable declaration
     */
    private generateVariableDeclaration(node: VariableDeclarationNode): void {
        for (const declarator of node.declarations) {
            if (declarator.init) {
                this.generateExpression(declarator.init);
                // Store to variable (simplified)
                const varIndex = this.getVariableIndex(declarator.id.name);
                this.emit(Opcode.STA_GLOBAL, varIndex);
            }
        }
    }

    /**
     * Generate function declaration
     */
    private generateFunctionDeclaration(node: FunctionDeclarationNode): void {
        // Create closure for function
        const funcIndex = this.addConstant(node);
        this.emit(Opcode.CREATE_CLOSURE, funcIndex);

        // Store function to variable
        const varIndex = this.getVariableIndex(node.id.name);
        this.emit(Opcode.STA_GLOBAL, varIndex);
    }

    /**
     * Generate return statement
     */
    private generateReturnStatement(node: ReturnStatementNode): void {
        if (node.argument) {
            this.generateExpression(node.argument);
        } else {
            this.emit(Opcode.LDA_UNDEFINED);
        }
        this.emit(Opcode.RETURN);
    }

    /**
     * Generate expression
     */
    private generateExpression(node: ASTNode): void {
        this.generateNode(node);
    }

    /**
     * Generate binary expression
     */
    private generateBinaryExpression(node: BinaryExpressionNode): void {
        // Generate left operand
        this.generateExpression(node.left);

        // Save to register
        const reg = this.allocateRegister();
        this.emit(Opcode.STAR, reg);

        // Generate right operand
        this.generateExpression(node.right);

        // Perform operation
        switch (node.operator) {
            case "+":
                this.emit(Opcode.ADD, reg);
                break;
            case "-":
                this.emit(Opcode.SUB, reg);
                break;
            case "*":
                this.emit(Opcode.MUL, reg);
                break;
            case "/":
                this.emit(Opcode.DIV, reg);
                break;
            case "==":
                this.emit(Opcode.TEST_EQUAL, reg);
                break;
            case "<":
                this.emit(Opcode.TEST_LESS_THAN, reg);
                break;
            case ">":
                this.emit(Opcode.TEST_GREATER_THAN, reg);
                break;
        }
    }

    /**
     * Generate literal
     */
    private generateLiteral(node: LiteralNode): void {
        if (node.value === null) {
            this.emit(Opcode.LDA_NULL);
        } else if (node.value === undefined) {
            this.emit(Opcode.LDA_UNDEFINED);
        } else if (node.value === true) {
            this.emit(Opcode.LDA_TRUE);
        } else if (node.value === false) {
            this.emit(Opcode.LDA_FALSE);
        } else if (node.value === 0) {
            this.emit(Opcode.LDA_ZERO);
        } else {
            const constantIndex = this.addConstant(node.value);
            this.emit(Opcode.LDA_CONSTANT, constantIndex);
        }
    }

    /**
     * Generate identifier
     */
    private generateIdentifier(node: IdentifierNode): void {
        const varIndex = this.getVariableIndex(node.name);
        this.emit(Opcode.LDA_GLOBAL, varIndex);
    }

    /**
     * Emit bytecode instruction
     */
    private emit(opcode: Opcode, ...operands: number[]): void {
        this.instructions.push({ opcode, operands });
    }

    /**
     * Add constant to pool
     */
    private addConstant(value: unknown): number {
        const index = this.constantPool.indexOf(value);
        if (index !== -1) {
            return index;
        }
        this.constantPool.push(value);
        return this.constantPool.length - 1;
    }

    /**
     * Get variable index (simplified)
     */
    private getVariableIndex(name: string): number {
        return this.addConstant(name);
    }

    /**
     * Allocate register
     */
    private allocateRegister(): number {
        return this.registerCount++;
    }

    /**
     * Serialize bytecode to Uint8Array
     */
    private serializeBytecode(): Uint8Array {
        const bytes: number[] = [];

        for (const instr of this.instructions) {
            bytes.push(instr.opcode);
            for (const operand of instr.operands) {
                bytes.push(operand);
            }
        }

        return new Uint8Array(bytes);
    }
}

/**
 * V8Compiler
 * Main compiler coordinating lexing, parsing, and bytecode generation
 */
export class V8Compiler {
    /**
     * Compile JavaScript to bytecode
     */
    compile(source: string): CompiledFunction {
        // Lex
        const lexer = new Lexer(source);
        const tokens = lexer.tokenize();

        // Parse
        const parser = new Parser(tokens);
        const ast = parser.parse();

        // Generate bytecode
        const generator = new BytecodeGenerator();
        const compiled = generator.generate(ast);

        return compiled;
    }

    /**
     * Parse JavaScript to AST
     */
    parse(source: string): ProgramNode {
        const lexer = new Lexer(source);
        const tokens = lexer.tokenize();
        const parser = new Parser(tokens);
        return parser.parse();
    }

    /**
     * JSTokenize JavaScript
     */
    tokenize(source: string): JSToken[] {
        const lexer = new Lexer(source);
        return lexer.tokenize();
    }
}
