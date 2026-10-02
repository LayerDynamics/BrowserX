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
  CLASS = "class",
  EXTENDS = "extends",
  SUPER = "super",
  STATIC = "static",
  ASYNC = "async",
  AWAIT = "await",
  TRY = "try",
  CATCH = "catch",
  FINALLY = "finally",
  THROW = "throw",
  IMPORT = "import",
  EXPORT = "export",
  FROM = "from",
  TYPEOF = "typeof",
  INSTANCEOF = "instanceof",
  IN = "in",
  DELETE = "delete",
  VOID = "void",
  YIELD = "yield",
  SWITCH = "switch",
  CASE = "case",
  DEFAULT = "default",
  DO = "do",
  TEMPLATE_LITERAL = "template_literal",
  SPREAD = "...",

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
  CLASS_DECLARATION = "ClassDeclaration",
  CLASS_EXPRESSION = "ClassExpression",
  METHOD_DEFINITION = "MethodDefinition",
  TRY_STATEMENT = "TryStatement",
  CATCH_CLAUSE = "CatchClause",
  THROW_STATEMENT = "ThrowStatement",
  AWAIT_EXPRESSION = "AwaitExpression",
  IMPORT_DECLARATION = "ImportDeclaration",
  EXPORT_DECLARATION = "ExportDeclaration",
  SWITCH_STATEMENT = "SwitchStatement",
  SWITCH_CASE = "SwitchCase",
  DO_WHILE_STATEMENT = "DoWhileStatement",
  TEMPLATE_LITERAL = "TemplateLiteral",
  SPREAD_ELEMENT = "SpreadElement",
  TYPEOF_EXPRESSION = "TypeofExpression",
  INSTANCEOF_EXPRESSION = "InstanceofExpression",
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
 * Call expression node
 */
export interface CallExpressionNode extends ASTNode {
  type: ASTNodeType.CALL_EXPRESSION;
  callee: ASTNode;
  arguments: ASTNode[];
}

/**
 * Member expression node
 */
export interface MemberExpressionNode extends ASTNode {
  type: ASTNodeType.MEMBER_EXPRESSION;
  object: ASTNode;
  property: ASTNode;
  computed: boolean;
}

/**
 * Object expression node
 */
export interface ObjectExpressionNode extends ASTNode {
  type: ASTNodeType.OBJECT_EXPRESSION;
  properties: PropertyNode[];
}

/**
 * Property node (for object literals)
 */
export interface PropertyNode extends ASTNode {
  key: ASTNode;
  value: ASTNode;
}

/**
 * Array expression node
 */
export interface ArrayExpressionNode extends ASTNode {
  type: ASTNodeType.ARRAY_EXPRESSION;
  elements: (ASTNode | null)[];
}

/**
 * New expression node
 */
export interface NewExpressionNode extends ASTNode {
  type: ASTNodeType.NEW_EXPRESSION;
  callee: ASTNode;
  arguments: ASTNode[];
}

/**
 * This expression node
 */
export interface ThisExpressionNode extends ASTNode {
  type: ASTNodeType.THIS_EXPRESSION;
}

/**
 * Assignment expression node
 */
export interface AssignmentExpressionNode extends ASTNode {
  type: ASTNodeType.ASSIGNMENT_EXPRESSION;
  operator: string;
  left: ASTNode;
  right: ASTNode;
}

/**
 * Function expression node
 */
export interface FunctionExpressionNode extends ASTNode {
  type: ASTNodeType.FUNCTION_EXPRESSION;
  id: IdentifierNode | null;
  params: IdentifierNode[];
  body: BlockStatementNode;
}

/**
 * If statement node
 */
export interface IfStatementNode extends ASTNode {
  type: ASTNodeType.IF_STATEMENT;
  test: ASTNode;
  consequent: ASTNode;
  alternate: ASTNode | null;
}

/**
 * While statement node
 */
export interface WhileStatementNode extends ASTNode {
  type: ASTNodeType.WHILE_STATEMENT;
  test: ASTNode;
  body: ASTNode;
}

/**
 * For statement node
 */
export interface ForStatementNode extends ASTNode {
  type: ASTNodeType.FOR_STATEMENT;
  init: ASTNode | null;
  test: ASTNode | null;
  update: ASTNode | null;
  body: ASTNode;
}

/**
 * Program node (root)
 */
export interface ProgramNode extends ASTNode {
  type: ASTNodeType.PROGRAM;
  body: ASTNode[];
}

/**
 * Class declaration node
 */
export interface ClassDeclarationNode extends ASTNode {
  type: ASTNodeType.CLASS_DECLARATION;
  id: IdentifierNode;
  superClass: ASTNode | null;
  body: MethodDefinitionNode[];
}

/**
 * Method definition node (class method)
 */
export interface MethodDefinitionNode extends ASTNode {
  type: ASTNodeType.METHOD_DEFINITION;
  key: ASTNode;
  value: FunctionExpressionNode;
  kind: "constructor" | "method" | "get" | "set";
  isStatic: boolean;
}

/**
 * Try statement node
 */
export interface TryStatementNode extends ASTNode {
  type: ASTNodeType.TRY_STATEMENT;
  block: BlockStatementNode;
  handler: CatchClauseNode | null;
  finalizer: BlockStatementNode | null;
}

/**
 * Catch clause node
 */
export interface CatchClauseNode extends ASTNode {
  type: ASTNodeType.CATCH_CLAUSE;
  param: IdentifierNode | null;
  body: BlockStatementNode;
}

/**
 * Throw statement node
 */
export interface ThrowStatementNode extends ASTNode {
  type: ASTNodeType.THROW_STATEMENT;
  argument: ASTNode;
}

/**
 * Await expression node
 */
export interface AwaitExpressionNode extends ASTNode {
  type: ASTNodeType.AWAIT_EXPRESSION;
  argument: ASTNode;
}

/**
 * Switch statement node
 */
export interface SwitchStatementNode extends ASTNode {
  type: ASTNodeType.SWITCH_STATEMENT;
  discriminant: ASTNode;
  cases: SwitchCaseNode[];
}

/**
 * Switch case node
 */
export interface SwitchCaseNode extends ASTNode {
  type: ASTNodeType.SWITCH_CASE;
  test: ASTNode | null; // null for default
  consequent: ASTNode[];
}

/**
 * Do-while statement node
 */
export interface DoWhileStatementNode extends ASTNode {
  type: ASTNodeType.DO_WHILE_STATEMENT;
  body: ASTNode;
  test: ASTNode;
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

  // Exception handling
  TRY_START = 0x90, // Start try block (operand: catch handler offset)
  TRY_END = 0x91, // End try block
  THROW = 0x92, // Throw exception from accumulator
  SET_CATCH_PARAM = 0x93, // Store caught exception to variable

  // Typeof
  TYPEOF = 0xA0, // typeof accumulator → string in accumulator
  INSTANCEOF = 0xA1, // accumulator instanceof register → boolean

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

    // Template literals
    if (char === '`') {
      return this.scanTemplateLiteral();
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
    if (char === "." && nextChar === "." && this.source[this.position + 2] === ".") {
      this.advance(3);
      return this.createJSToken(JSJSTokenType.SPREAD, "...");
    }
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
      "class": JSJSTokenType.CLASS,
      "extends": JSJSTokenType.EXTENDS,
      "super": JSJSTokenType.SUPER,
      "static": JSJSTokenType.STATIC,
      "async": JSJSTokenType.ASYNC,
      "await": JSJSTokenType.AWAIT,
      "try": JSJSTokenType.TRY,
      "catch": JSJSTokenType.CATCH,
      "finally": JSJSTokenType.FINALLY,
      "throw": JSJSTokenType.THROW,
      "import": JSJSTokenType.IMPORT,
      "export": JSJSTokenType.EXPORT,
      "from": JSJSTokenType.FROM,
      "typeof": JSJSTokenType.TYPEOF,
      "instanceof": JSJSTokenType.INSTANCEOF,
      "in": JSJSTokenType.IN,
      "delete": JSJSTokenType.DELETE,
      "void": JSJSTokenType.VOID,
      "yield": JSJSTokenType.YIELD,
      "switch": JSJSTokenType.SWITCH,
      "case": JSJSTokenType.CASE,
      "default": JSJSTokenType.DEFAULT,
      "do": JSJSTokenType.DO,
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
   * Scan template literal (backtick strings)
   * Simplified: treats as a plain string (no interpolation expressions)
   */
  private scanTemplateLiteral(): JSToken {
    this.advance(); // Skip opening backtick
    const start = this.position;
    while (this.position < this.source.length && this.source[this.position] !== '`') {
      if (this.source[this.position] === "\\") {
        this.advance(); // Skip escape char
      }
      if (this.source[this.position] === "\n") {
        this.line++;
        this.column = 0;
      }
      this.advance();
    }
    const value = this.source.slice(start, this.position);
    this.advance(); // Skip closing backtick
    return this.createJSToken(JSJSTokenType.TEMPLATE_LITERAL, value);
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
      case JSJSTokenType.IF:
        return this.parseIfStatement();
      case JSJSTokenType.WHILE:
        return this.parseWhileStatement();
      case JSJSTokenType.FOR:
        return this.parseForStatement();
      case JSJSTokenType.BREAK:
        this.advance();
        if (this.match(JSJSTokenType.SEMICOLON)) this.advance();
        return { type: ASTNodeType.BREAK_STATEMENT } as ASTNode;
      case JSJSTokenType.CONTINUE:
        this.advance();
        if (this.match(JSJSTokenType.SEMICOLON)) this.advance();
        return { type: ASTNodeType.CONTINUE_STATEMENT } as ASTNode;
      case JSJSTokenType.CLASS:
        return this.parseClassDeclaration();
      case JSJSTokenType.TRY:
        return this.parseTryStatement();
      case JSJSTokenType.THROW:
        return this.parseThrowStatement();
      case JSJSTokenType.SWITCH:
        return this.parseSwitchStatement();
      case JSJSTokenType.DO:
        return this.parseDoWhileStatement();
      case JSJSTokenType.ASYNC:
        // async function declaration
        if (this.tokens[this.position + 1]?.type === JSJSTokenType.FUNCTION) {
          return this.parseAsyncFunctionDeclaration();
        }
        return this.parseExpressionStatement();
      case JSJSTokenType.LBRACE:
        return this.parseBlockStatement();
      default:
        return this.parseExpressionStatement();
    }
  }

  /**
   * Parse if statement
   */
  private parseIfStatement(): IfStatementNode {
    this.consume(JSJSTokenType.IF);
    this.consume(JSJSTokenType.LPAREN);
    const test = this.parseExpression();
    this.consume(JSJSTokenType.RPAREN);
    const consequent = this.parseStatement();
    let alternate: ASTNode | null = null;
    if (this.match(JSJSTokenType.ELSE)) {
      this.advance();
      alternate = this.parseStatement();
    }
    return {
      type: ASTNodeType.IF_STATEMENT,
      test,
      consequent,
      alternate,
    };
  }

  /**
   * Parse while statement
   */
  private parseWhileStatement(): WhileStatementNode {
    this.consume(JSJSTokenType.WHILE);
    this.consume(JSJSTokenType.LPAREN);
    const test = this.parseExpression();
    this.consume(JSJSTokenType.RPAREN);
    const body = this.parseStatement();
    return { type: ASTNodeType.WHILE_STATEMENT, test, body };
  }

  /**
   * Parse for statement
   */
  private parseForStatement(): ForStatementNode {
    this.consume(JSJSTokenType.FOR);
    this.consume(JSJSTokenType.LPAREN);

    let init: ASTNode | null = null;
    if (!this.match(JSJSTokenType.SEMICOLON)) {
      if (
        this.match(JSJSTokenType.VAR) || this.match(JSJSTokenType.LET) ||
        this.match(JSJSTokenType.CONST)
      ) {
        init = this.parseVariableDeclaration();
      } else {
        init = this.parseExpression();
        this.consume(JSJSTokenType.SEMICOLON);
      }
    } else {
      this.advance();
    }

    let test: ASTNode | null = null;
    if (!this.match(JSJSTokenType.SEMICOLON)) {
      test = this.parseExpression();
    }
    this.consume(JSJSTokenType.SEMICOLON);

    let update: ASTNode | null = null;
    if (!this.match(JSJSTokenType.RPAREN)) {
      update = this.parseExpression();
    }
    this.consume(JSJSTokenType.RPAREN);

    const body = this.parseStatement();
    return { type: ASTNodeType.FOR_STATEMENT, init, test, update, body };
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
   * Parse expression (handles assignment)
   */
  private parseExpression(): ASTNode {
    const left = this.parseBinaryExpression();

    if (this.match(JSJSTokenType.ASSIGN)) {
      this.advance();
      const right = this.parseExpression();
      return {
        type: ASTNodeType.ASSIGNMENT_EXPRESSION,
        operator: "=",
        left,
        right,
      } as AssignmentExpressionNode;
    }

    return left;
  }

  /**
   * Parse binary expression
   */
  private parseBinaryExpression(): ASTNode {
    let left = this.parsePostfixExpression();

    while (this.isBinaryOperator()) {
      const operator = this.advance().value;
      const right = this.parsePostfixExpression();

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
   * Parse postfix expression (member access, call, index)
   */
  private parsePostfixExpression(): ASTNode {
    let expr = this.parsePrimaryExpression();

    while (true) {
      if (this.match(JSJSTokenType.DOT)) {
        this.advance();
        const property = this.parseIdentifier();
        expr = {
          type: ASTNodeType.MEMBER_EXPRESSION,
          object: expr,
          property,
          computed: false,
        } as MemberExpressionNode;
      } else if (this.match(JSJSTokenType.LBRACKET)) {
        this.advance();
        const property = this.parseExpression();
        this.consume(JSJSTokenType.RBRACKET);
        expr = {
          type: ASTNodeType.MEMBER_EXPRESSION,
          object: expr,
          property,
          computed: true,
        } as MemberExpressionNode;
      } else if (this.match(JSJSTokenType.LPAREN)) {
        const args = this.parseArgumentList();
        expr = {
          type: ASTNodeType.CALL_EXPRESSION,
          callee: expr,
          arguments: args,
        } as CallExpressionNode;
      } else {
        break;
      }
    }

    return expr;
  }

  /**
   * Parse argument list: (arg1, arg2, ...)
   */
  private parseArgumentList(): ASTNode[] {
    this.consume(JSJSTokenType.LPAREN);
    const args: ASTNode[] = [];

    while (!this.match(JSJSTokenType.RPAREN)) {
      args.push(this.parseExpression());
      if (!this.match(JSJSTokenType.RPAREN)) {
        this.consume(JSJSTokenType.COMMA);
      }
    }

    this.consume(JSJSTokenType.RPAREN);
    return args;
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
      case JSJSTokenType.THIS:
        this.advance();
        return { type: ASTNodeType.THIS_EXPRESSION } as ThisExpressionNode;
      case JSJSTokenType.NEW:
        return this.parseNewExpression();
      case JSJSTokenType.FUNCTION:
        return this.parseFunctionExpression();
      case JSJSTokenType.ASYNC:
        // async function expression
        if (this.tokens[this.position + 1]?.type === JSJSTokenType.FUNCTION) {
          this.advance(); // skip async
          const fe = this.parseFunctionExpression();
          (fe as unknown as { async: boolean }).async = true;
          return fe;
        }
        return this.parseIdentifier();
      case JSJSTokenType.SUPER:
        this.advance();
        return { type: ASTNodeType.IDENTIFIER, name: "super" } as IdentifierNode;
      case JSJSTokenType.AWAIT: {
        this.advance();
        const awaitArg = this.parsePostfixExpression();
        return { type: ASTNodeType.AWAIT_EXPRESSION, argument: awaitArg } as AwaitExpressionNode;
      }
      case JSJSTokenType.TYPEOF: {
        this.advance();
        const typeofArg = this.parsePostfixExpression();
        return { type: ASTNodeType.UNARY_EXPRESSION, operator: "typeof", left: typeofArg, right: typeofArg } as unknown as ASTNode;
      }
      case JSJSTokenType.VOID: {
        this.advance();
        this.parsePostfixExpression(); // evaluate and discard
        return { type: ASTNodeType.LITERAL, value: null, raw: "undefined" } as LiteralNode;
      }
      case JSJSTokenType.DELETE: {
        this.advance();
        const deleteTarget = this.parsePostfixExpression();
        return { type: ASTNodeType.UNARY_EXPRESSION, operator: "delete", left: deleteTarget, right: deleteTarget } as unknown as ASTNode;
      }
      case JSJSTokenType.TEMPLATE_LITERAL: {
        const tmpl = this.advance();
        return { type: ASTNodeType.LITERAL, value: tmpl.value, raw: tmpl.value } as LiteralNode;
      }
      case JSJSTokenType.CLASS:
        // Class expression
        return this.parseClassExpression();
      case JSJSTokenType.MINUS:
      case JSJSTokenType.PLUS:
      case JSJSTokenType.LOGICAL_NOT: {
        const op = this.advance();
        const operand = this.parsePostfixExpression();
        const opStr = op.type === JSJSTokenType.MINUS ? "-"
          : op.type === JSJSTokenType.PLUS ? "+"
          : "!";
        return { type: ASTNodeType.UNARY_EXPRESSION, operator: opStr, left: operand, right: operand } as unknown as ASTNode;
      }
      case JSJSTokenType.LBRACE:
        return this.parseObjectExpression();
      case JSJSTokenType.LBRACKET:
        return this.parseArrayExpression();
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
   * Parse new expression: new Callee(args)
   */
  private parseNewExpression(): NewExpressionNode {
    this.consume(JSJSTokenType.NEW);
    // Parse callee as primary + member access only (not call expressions)
    let callee: ASTNode = this.parsePrimaryExpression();
    // Allow member access chains: new Foo.Bar.Baz(...)
    while (this.match(JSJSTokenType.DOT)) {
      this.advance();
      const property = this.parseIdentifier();
      callee = {
        type: ASTNodeType.MEMBER_EXPRESSION,
        object: callee,
        property,
        computed: false,
      } as MemberExpressionNode;
    }
    let args: ASTNode[] = [];
    if (this.match(JSJSTokenType.LPAREN)) {
      args = this.parseArgumentList();
    }
    return {
      type: ASTNodeType.NEW_EXPRESSION,
      callee,
      arguments: args,
    };
  }

  /**
   * Parse function expression: function(params) { body }
   */
  private parseFunctionExpression(): FunctionExpressionNode {
    this.consume(JSJSTokenType.FUNCTION);
    let id: IdentifierNode | null = null;
    if (this.match(JSJSTokenType.IDENTIFIER)) {
      id = this.parseIdentifier();
    }
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
      type: ASTNodeType.FUNCTION_EXPRESSION,
      id,
      params,
      body,
    };
  }

  /**
   * Parse object expression: { key: value, ... }
   */
  private parseObjectExpression(): ObjectExpressionNode {
    this.consume(JSJSTokenType.LBRACE);
    const properties: PropertyNode[] = [];

    while (!this.match(JSJSTokenType.RBRACE)) {
      let key: ASTNode;
      if (this.match(JSJSTokenType.STRING)) {
        key = this.parseLiteral();
      } else if (this.match(JSJSTokenType.NUMBER)) {
        key = this.parseLiteral();
      } else {
        key = this.parseIdentifier();
      }
      this.consume(JSJSTokenType.COLON);
      const value = this.parseExpression();
      properties.push({ type: ASTNodeType.LITERAL, key, value } as unknown as PropertyNode);
      if (!this.match(JSJSTokenType.RBRACE)) {
        this.consume(JSJSTokenType.COMMA);
      }
    }

    this.consume(JSJSTokenType.RBRACE);
    return { type: ASTNodeType.OBJECT_EXPRESSION, properties };
  }

  /**
   * Parse array expression: [elem, ...]
   */
  private parseArrayExpression(): ArrayExpressionNode {
    this.consume(JSJSTokenType.LBRACKET);
    const elements: (ASTNode | null)[] = [];

    while (!this.match(JSJSTokenType.RBRACKET)) {
      if (this.match(JSJSTokenType.COMMA)) {
        elements.push(null);
      } else {
        elements.push(this.parseExpression());
      }
      if (!this.match(JSJSTokenType.RBRACKET)) {
        this.consume(JSJSTokenType.COMMA);
      }
    }

    this.consume(JSJSTokenType.RBRACKET);
    return { type: ASTNodeType.ARRAY_EXPRESSION, elements };
  }

  /**
   * Parse class declaration: class Name [extends Super] { ... }
   */
  private parseClassDeclaration(): ClassDeclarationNode {
    this.consume(JSJSTokenType.CLASS);
    const id = this.parseIdentifier();

    let superClass: ASTNode | null = null;
    if (this.match(JSJSTokenType.EXTENDS)) {
      this.advance();
      superClass = this.parsePostfixExpression();
    }

    const body = this.parseClassBody();

    return {
      type: ASTNodeType.CLASS_DECLARATION,
      id,
      superClass,
      body,
    };
  }

  /**
   * Parse class body: { method() {}, static method() {}, ... }
   */
  private parseClassBody(): MethodDefinitionNode[] {
    this.consume(JSJSTokenType.LBRACE);
    const methods: MethodDefinitionNode[] = [];

    while (!this.match(JSJSTokenType.RBRACE)) {
      let isStatic = false;
      let kind: "constructor" | "method" | "get" | "set" = "method";

      // Check for static keyword
      if (this.match(JSJSTokenType.STATIC)) {
        isStatic = true;
        this.advance();
      }

      // Check for get/set
      if (this.match(JSJSTokenType.IDENTIFIER)) {
        const val = this.peek().value;
        if ((val === "get" || val === "set") && this.tokens[this.position + 1]?.type === JSJSTokenType.IDENTIFIER) {
          kind = val as "get" | "set";
          this.advance();
        }
      }

      // Method name
      let key: ASTNode;
      if (this.match(JSJSTokenType.LBRACKET)) {
        // Computed property: [expr]()
        this.advance();
        key = this.parseExpression();
        this.consume(JSJSTokenType.RBRACKET);
      } else if (this.match(JSJSTokenType.IDENTIFIER) || this.match(JSJSTokenType.STRING) || this.match(JSJSTokenType.NUMBER)) {
        key = this.match(JSJSTokenType.IDENTIFIER) ? this.parseIdentifier() : this.parseLiteral();
      } else {
        // Could be constructor keyword as identifier
        const token = this.advance();
        key = { type: ASTNodeType.IDENTIFIER, name: token.value } as IdentifierNode;
      }

      // Check if this is the constructor
      if (!isStatic && key.type === ASTNodeType.IDENTIFIER && (key as IdentifierNode).name === "constructor") {
        kind = "constructor";
      }

      // Parse method parameters and body
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

      methods.push({
        type: ASTNodeType.METHOD_DEFINITION,
        key,
        value: {
          type: ASTNodeType.FUNCTION_EXPRESSION,
          id: null,
          params,
          body,
        },
        kind,
        isStatic,
      });

      // Optional semicolons between methods
      if (this.match(JSJSTokenType.SEMICOLON)) this.advance();
    }

    this.consume(JSJSTokenType.RBRACE);
    return methods;
  }

  /**
   * Parse try statement: try { ... } catch (e) { ... } finally { ... }
   */
  private parseTryStatement(): TryStatementNode {
    this.consume(JSJSTokenType.TRY);
    const block = this.parseBlockStatement();

    let handler: CatchClauseNode | null = null;
    if (this.match(JSJSTokenType.CATCH)) {
      this.advance();
      let param: IdentifierNode | null = null;
      if (this.match(JSJSTokenType.LPAREN)) {
        this.advance();
        param = this.parseIdentifier();
        this.consume(JSJSTokenType.RPAREN);
      }
      const body = this.parseBlockStatement();
      handler = { type: ASTNodeType.CATCH_CLAUSE, param, body };
    }

    let finalizer: BlockStatementNode | null = null;
    if (this.match(JSJSTokenType.FINALLY)) {
      this.advance();
      finalizer = this.parseBlockStatement();
    }

    return { type: ASTNodeType.TRY_STATEMENT, block, handler, finalizer };
  }

  /**
   * Parse throw statement: throw expr;
   */
  private parseThrowStatement(): ThrowStatementNode {
    this.consume(JSJSTokenType.THROW);
    const argument = this.parseExpression();
    if (this.match(JSJSTokenType.SEMICOLON)) this.advance();
    return { type: ASTNodeType.THROW_STATEMENT, argument };
  }

  /**
   * Parse switch statement: switch (expr) { case val: ... default: ... }
   */
  private parseSwitchStatement(): SwitchStatementNode {
    this.consume(JSJSTokenType.SWITCH);
    this.consume(JSJSTokenType.LPAREN);
    const discriminant = this.parseExpression();
    this.consume(JSJSTokenType.RPAREN);
    this.consume(JSJSTokenType.LBRACE);

    const cases: SwitchCaseNode[] = [];
    while (!this.match(JSJSTokenType.RBRACE)) {
      let test: ASTNode | null = null;
      if (this.match(JSJSTokenType.CASE)) {
        this.advance();
        test = this.parseExpression();
      } else if (this.match(JSJSTokenType.DEFAULT)) {
        this.advance();
      }
      this.consume(JSJSTokenType.COLON);

      const consequent: ASTNode[] = [];
      while (!this.match(JSJSTokenType.CASE) && !this.match(JSJSTokenType.DEFAULT) && !this.match(JSJSTokenType.RBRACE)) {
        consequent.push(this.parseStatement());
      }
      cases.push({ type: ASTNodeType.SWITCH_CASE, test, consequent });
    }

    this.consume(JSJSTokenType.RBRACE);
    return { type: ASTNodeType.SWITCH_STATEMENT, discriminant, cases };
  }

  /**
   * Parse do-while statement: do { ... } while (expr);
   */
  private parseDoWhileStatement(): DoWhileStatementNode {
    this.consume(JSJSTokenType.DO);
    const body = this.parseStatement();
    this.consume(JSJSTokenType.WHILE);
    this.consume(JSJSTokenType.LPAREN);
    const test = this.parseExpression();
    this.consume(JSJSTokenType.RPAREN);
    if (this.match(JSJSTokenType.SEMICOLON)) this.advance();
    return { type: ASTNodeType.DO_WHILE_STATEMENT, body, test };
  }

  /**
   * Parse async function declaration: async function name() { ... }
   */
  private parseAsyncFunctionDeclaration(): FunctionDeclarationNode {
    this.consume(JSJSTokenType.ASYNC);
    const decl = this.parseFunctionDeclaration();
    // Mark as async by adding metadata property
    (decl as unknown as { async: boolean }).async = true;
    return decl;
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
      case JSJSTokenType.UNDEFINED:
        // Use raw="undefined" to distinguish from null in code generation
        return { type: ASTNodeType.LITERAL, value: null, raw: "undefined" };
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
   * Parse class expression: class [Name] [extends Super] { ... }
   */
  private parseClassExpression(): ASTNode {
    this.consume(JSJSTokenType.CLASS);
    let id: IdentifierNode | null = null;
    if (this.match(JSJSTokenType.IDENTIFIER)) {
      id = this.parseIdentifier();
    }
    let superClass: ASTNode | null = null;
    if (this.match(JSJSTokenType.EXTENDS)) {
      this.advance();
      superClass = this.parsePostfixExpression();
    }
    const body = this.parseClassBody();
    return {
      type: ASTNodeType.CLASS_DECLARATION,
      id: id || { type: ASTNodeType.IDENTIFIER, name: "<anonymous>" } as IdentifierNode,
      superClass,
      body,
    } as ClassDeclarationNode;
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
      JSJSTokenType.MODULO,
      JSJSTokenType.EQUAL,
      JSJSTokenType.NOT_EQUAL,
      JSJSTokenType.STRICT_EQUAL,
      JSJSTokenType.STRICT_NOT_EQUAL,
      JSJSTokenType.LESS_THAN,
      JSJSTokenType.GREATER_THAN,
      JSJSTokenType.LESS_EQUAL,
      JSJSTokenType.GREATER_EQUAL,
      JSJSTokenType.LOGICAL_AND,
      JSJSTokenType.LOGICAL_OR,
      JSJSTokenType.INSTANCEOF,
      JSJSTokenType.IN,
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
  private breakTargets: number[][] = [];
  private continueTargets: number[][] = [];

  /**
   * Generate bytecode from AST
   */
  generate(ast: ProgramNode): CompiledFunction {
    // Generate bytecode for program body
    for (const node of ast.body) {
      this.generateNode(node);
    }

    // Return: if last statement is an expression, return its value (REPL/eval semantics)
    // Otherwise return undefined (script semantics)
    const lastNode = ast.body.length > 0 ? ast.body[ast.body.length - 1] : null;
    const isLastExpr = lastNode && (
      lastNode.type === ASTNodeType.EXPRESSION_STATEMENT ||
      lastNode.type === ASTNodeType.CALL_EXPRESSION ||
      lastNode.type === ASTNodeType.MEMBER_EXPRESSION ||
      lastNode.type === ASTNodeType.ASSIGNMENT_EXPRESSION
    );
    if (!isLastExpr) {
      this.emit(Opcode.LDA_UNDEFINED);
    }
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
      case ASTNodeType.CALL_EXPRESSION:
        this.generateCallExpression(node as CallExpressionNode);
        break;
      case ASTNodeType.MEMBER_EXPRESSION:
        this.generateMemberExpression(node as MemberExpressionNode);
        break;
      case ASTNodeType.OBJECT_EXPRESSION:
        this.generateObjectExpression(node as ObjectExpressionNode);
        break;
      case ASTNodeType.ARRAY_EXPRESSION:
        this.generateArrayExpression(node as ArrayExpressionNode);
        break;
      case ASTNodeType.NEW_EXPRESSION:
        this.generateNewExpression(node as NewExpressionNode);
        break;
      case ASTNodeType.THIS_EXPRESSION: {
        const thisIdx = this.addConstant("this");
        this.emit(Opcode.LDA_CONTEXT_SLOT, thisIdx);
        break;
      }
      case ASTNodeType.ASSIGNMENT_EXPRESSION:
        this.generateAssignmentExpression(node as AssignmentExpressionNode);
        break;
      case ASTNodeType.FUNCTION_EXPRESSION: {
        const funcIdx = this.addConstant(node);
        this.emit(Opcode.CREATE_CLOSURE, funcIdx);
        break;
      }
      case ASTNodeType.IF_STATEMENT:
        this.generateIfStatement(node as IfStatementNode);
        break;
      case ASTNodeType.WHILE_STATEMENT:
        this.generateWhileStatement(node as WhileStatementNode);
        break;
      case ASTNodeType.FOR_STATEMENT:
        this.generateForStatement(node as ForStatementNode);
        break;
      case ASTNodeType.BLOCK_STATEMENT:
        for (const stmt of (node as BlockStatementNode).body) {
          this.generateNode(stmt);
        }
        break;
      case ASTNodeType.BREAK_STATEMENT:
        if (this.breakTargets.length > 0) {
          const breakRef = this.instructions.length;
          this.emit(Opcode.JUMP, 0);
          this.breakTargets[this.breakTargets.length - 1].push(breakRef);
        }
        break;
      case ASTNodeType.CONTINUE_STATEMENT:
        if (this.continueTargets.length > 0) {
          const continueRef = this.instructions.length;
          this.emit(Opcode.JUMP, 0);
          this.continueTargets[this.continueTargets.length - 1].push(continueRef);
        }
        break;
      case ASTNodeType.CLASS_DECLARATION:
        this.generateClassDeclaration(node as ClassDeclarationNode);
        break;
      case ASTNodeType.TRY_STATEMENT:
        this.generateTryStatement(node as TryStatementNode);
        break;
      case ASTNodeType.THROW_STATEMENT:
        this.generateThrowStatement(node as ThrowStatementNode);
        break;
      case ASTNodeType.SWITCH_STATEMENT:
        this.generateSwitchStatement(node as SwitchStatementNode);
        break;
      case ASTNodeType.DO_WHILE_STATEMENT:
        this.generateDoWhileStatement(node as DoWhileStatementNode);
        break;
      case ASTNodeType.AWAIT_EXPRESSION:
        // Evaluate the argument (await is transparent in sync engine)
        this.generateExpression((node as AwaitExpressionNode).argument);
        break;
      case ASTNodeType.UNARY_EXPRESSION:
        this.generateUnaryExpression(node as { type: ASTNodeType; operator: string; left: ASTNode; right: ASTNode });
        break;
    }
  }

  /**
   * Generate unary expression (typeof, delete, void, -, !, ~)
   */
  private generateUnaryExpression(node: { operator: string; left: ASTNode }): void {
    this.generateExpression(node.left);
    switch (node.operator) {
      case "typeof":
        this.emit(Opcode.TYPEOF);
        break;
      case "-":
        this.emit(Opcode.NEGATE);
        break;
      case "!":
        this.emit(Opcode.LOGICAL_NOT);
        break;
      case "+":
        // Unary + converts to number - no-op if already number
        break;
      case "delete":
        // delete is a no-op in our engine for now, result is true
        this.emit(Opcode.LDA_TRUE);
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
      case "%":
        this.emit(Opcode.MOD, reg);
        break;
      case "==":
        this.emit(Opcode.TEST_EQUAL, reg);
        break;
      case "!=":
        this.emit(Opcode.TEST_NOT_EQUAL, reg);
        break;
      case "===":
        this.emit(Opcode.TEST_STRICT_EQUAL, reg);
        break;
      case "!==":
        // Emit strict equal then NOT
        this.emit(Opcode.TEST_STRICT_EQUAL, reg);
        this.emit(Opcode.LOGICAL_NOT);
        break;
      case "<":
        this.emit(Opcode.TEST_LESS_THAN, reg);
        break;
      case ">":
        this.emit(Opcode.TEST_GREATER_THAN, reg);
        break;
      case "<=":
        this.emit(Opcode.TEST_LESS_EQUAL, reg);
        break;
      case ">=":
        this.emit(Opcode.TEST_GREATER_EQUAL, reg);
        break;
      case "&&":
        this.emit(Opcode.LOGICAL_NOT);
        this.emit(Opcode.LOGICAL_NOT);
        // Simplified: evaluate both, AND result
        this.emit(Opcode.TEST_EQUAL, reg);
        break;
      case "||":
        // Simplified: if left is truthy use left, else use right
        this.emit(Opcode.TO_BOOLEAN);
        break;
      case "instanceof":
        this.emit(Opcode.INSTANCEOF, reg);
        break;
      case "in":
        // Simplified: check if property exists
        this.emit(Opcode.TEST_EQUAL, reg);
        break;
      case "typeof":
        this.emit(Opcode.TYPEOF);
        break;
    }
  }

  /**
   * Generate literal
   */
  private generateLiteral(node: LiteralNode): void {
    if (node.value === null && node.raw === "undefined") {
      this.emit(Opcode.LDA_UNDEFINED);
    } else if (node.value === null) {
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
   * Generate call expression bytecode
   * Calling convention: function in accumulator, args in consecutive registers
   */
  private generateCallExpression(node: CallExpressionNode): void {
    let receiverReg = -1;

    // If callee is a member expression, we need the object for 'this'
    if (node.callee.type === ASTNodeType.MEMBER_EXPRESSION) {
      const member = node.callee as MemberExpressionNode;
      // Compile object
      this.generateExpression(member.object);
      const objReg = this.allocateRegister();
      this.emit(Opcode.STAR, objReg);
      receiverReg = objReg;

      // Get method from object
      if (member.computed) {
        this.generateExpression(member.property);
        const keyReg = this.allocateRegister();
        this.emit(Opcode.STAR, keyReg);
        this.emit(Opcode.LDAR, objReg);
        this.emit(Opcode.GET_KEYED, keyReg);
      } else {
        this.emit(Opcode.LDAR, objReg);
        const nameIdx = this.addConstant((member.property as IdentifierNode).name);
        this.emit(Opcode.GET_PROPERTY, nameIdx);
      }

      // Set 'this' to the receiver object for method calls
      const savedAcc = this.allocateRegister();
      this.emit(Opcode.STAR, savedAcc);
      this.emit(Opcode.LDAR, objReg);
      const thisIdx = this.addConstant("this");
      this.emit(Opcode.STA_CONTEXT_SLOT, thisIdx);
      this.emit(Opcode.LDAR, savedAcc);
    } else {
      this.generateExpression(node.callee);
    }

    // Save function to register
    const funcReg = this.allocateRegister();
    this.emit(Opcode.STAR, funcReg);

    // Compile arguments: first evaluate all into temp registers, then copy
    // into consecutive arg registers so the interpreter can find them reliably.
    if (node.arguments.length > 0) {
      // Phase 1: evaluate each arg expression (may allocate intermediate temps)
      const tempRegs: number[] = [];
      for (const arg of node.arguments) {
        this.generateExpression(arg);
        const tempReg = this.allocateRegister();
        this.emit(Opcode.STAR, tempReg);
        tempRegs.push(tempReg);
      }

      // Phase 2: allocate consecutive arg registers and copy values
      const firstArgReg = this.allocateRegister();
      this.emit(Opcode.LDAR, tempRegs[0]);
      this.emit(Opcode.STAR, firstArgReg);
      for (let i = 1; i < tempRegs.length; i++) {
        const argReg = this.allocateRegister();
        this.emit(Opcode.LDAR, tempRegs[i]);
        this.emit(Opcode.STAR, argReg);
      }

      // Load function and call — firstArgReg tells interpreter where args start
      this.emit(Opcode.LDAR, funcReg);
      this.emit(Opcode.CALL, node.arguments.length, firstArgReg);
    } else {
      this.emit(Opcode.LDAR, funcReg);
      this.emit(Opcode.CALL, 0, funcReg);
    }
  }

  /**
   * Generate member expression bytecode
   */
  private generateMemberExpression(node: MemberExpressionNode): void {
    this.generateExpression(node.object);

    if (node.computed) {
      const objReg = this.allocateRegister();
      this.emit(Opcode.STAR, objReg);
      this.generateExpression(node.property);
      const keyReg = this.allocateRegister();
      this.emit(Opcode.STAR, keyReg);
      this.emit(Opcode.LDAR, objReg);
      this.emit(Opcode.GET_KEYED, keyReg);
    } else {
      const nameIdx = this.addConstant((node.property as IdentifierNode).name);
      this.emit(Opcode.GET_PROPERTY, nameIdx);
    }
  }

  /**
   * Generate object expression bytecode
   */
  private generateObjectExpression(node: ObjectExpressionNode): void {
    this.emit(Opcode.CREATE_OBJECT);
    const objReg = this.allocateRegister();
    this.emit(Opcode.STAR, objReg);

    for (const prop of node.properties) {
      // Compile value
      this.generateExpression(prop.value);
      // Set property on object
      const key = prop.key;
      let nameIdx: number;
      if (key.type === ASTNodeType.IDENTIFIER) {
        nameIdx = this.addConstant((key as IdentifierNode).name);
      } else {
        nameIdx = this.addConstant((key as LiteralNode).value);
      }
      this.emit(Opcode.SET_PROPERTY, nameIdx, objReg);
    }

    // Load object back to accumulator
    this.emit(Opcode.LDAR, objReg);
  }

  /**
   * Generate array expression bytecode
   */
  private generateArrayExpression(node: ArrayExpressionNode): void {
    this.emit(Opcode.CREATE_ARRAY, node.elements.length);
    const arrReg = this.allocateRegister();
    this.emit(Opcode.STAR, arrReg);

    for (let i = 0; i < node.elements.length; i++) {
      const elem = node.elements[i];
      if (elem !== null) {
        this.generateExpression(elem);
        // Use SET_KEYED with index
        const idxConst = this.addConstant(i);
        this.emit(Opcode.LDA_CONSTANT, idxConst);
        const keyReg = this.allocateRegister();
        this.emit(Opcode.STAR, keyReg);
        // We need value in accumulator and array in register
        // Re-generate element value (or save it)
        this.generateExpression(elem);
        this.emit(Opcode.SET_KEYED, keyReg, arrReg);
      }
    }

    this.emit(Opcode.LDAR, arrReg);
  }

  /**
   * Generate new expression bytecode
   */
  private generateNewExpression(node: NewExpressionNode): void {
    this.generateExpression(node.callee);
    const ctorReg = this.allocateRegister();
    this.emit(Opcode.STAR, ctorReg);

    if (node.arguments.length > 0) {
      // Phase 1: evaluate each arg expression (may allocate intermediate temps)
      const tempRegs: number[] = [];
      for (const arg of node.arguments) {
        this.generateExpression(arg);
        const tempReg = this.allocateRegister();
        this.emit(Opcode.STAR, tempReg);
        tempRegs.push(tempReg);
      }

      // Phase 2: copy into consecutive arg registers
      const firstArgReg = this.allocateRegister();
      this.emit(Opcode.LDAR, tempRegs[0]);
      this.emit(Opcode.STAR, firstArgReg);
      for (let i = 1; i < tempRegs.length; i++) {
        const argReg = this.allocateRegister();
        this.emit(Opcode.LDAR, tempRegs[i]);
        this.emit(Opcode.STAR, argReg);
      }

      this.emit(Opcode.LDAR, ctorReg);
      this.emit(Opcode.CONSTRUCT, node.arguments.length, firstArgReg);
    } else {
      this.emit(Opcode.LDAR, ctorReg);
      this.emit(Opcode.CONSTRUCT, 0, ctorReg);
    }
  }

  /**
   * Generate assignment expression bytecode
   */
  private generateAssignmentExpression(node: AssignmentExpressionNode): void {
    if (node.left.type === ASTNodeType.IDENTIFIER) {
      this.generateExpression(node.right);
      const varIdx = this.getVariableIndex((node.left as IdentifierNode).name);
      this.emit(Opcode.STA_GLOBAL, varIdx);
    } else if (node.left.type === ASTNodeType.MEMBER_EXPRESSION) {
      const member = node.left as MemberExpressionNode;
      // Compile object
      this.generateExpression(member.object);
      const objReg = this.allocateRegister();
      this.emit(Opcode.STAR, objReg);

      if (member.computed) {
        // Compile key
        this.generateExpression(member.property);
        const keyReg = this.allocateRegister();
        this.emit(Opcode.STAR, keyReg);
        // Compile value
        this.generateExpression(node.right);
        this.emit(Opcode.SET_KEYED, keyReg, objReg);
      } else {
        // Compile value
        this.generateExpression(node.right);
        const nameIdx = this.addConstant((member.property as IdentifierNode).name);
        this.emit(Opcode.SET_PROPERTY, nameIdx, objReg);
      }
    }
  }

  /**
   * Generate if statement bytecode
   */
  private generateIfStatement(node: IfStatementNode): void {
    this.generateExpression(node.test);
    const jumpFalseRef = this.instructions.length;
    this.emit(Opcode.JUMP_IF_FALSE, 0); // placeholder

    this.generateNode(node.consequent);

    if (node.alternate) {
      const jumpEndRef = this.instructions.length;
      this.emit(Opcode.JUMP, 0); // placeholder
      // Patch false jump to here
      this.patchJump(jumpFalseRef);
      this.generateNode(node.alternate);
      this.patchJump(jumpEndRef);
    } else {
      this.patchJump(jumpFalseRef);
    }
  }

  /**
   * Generate while statement bytecode
   */
  private generateWhileStatement(node: WhileStatementNode): void {
    this.breakTargets.push([]);
    this.continueTargets.push([]);

    const loopStart = this.calculateCurrentOffset();
    this.generateExpression(node.test);
    const jumpFalseRef = this.instructions.length;
    this.emit(Opcode.JUMP_IF_FALSE, 0);

    this.generateNode(node.body);

    // Patch continue targets to loop start
    const continueRefs = this.continueTargets.pop()!;
    for (const ref of continueRefs) {
      this.instructions[ref].operands[0] = loopStart;
    }

    this.emit(Opcode.JUMP, loopStart);
    this.patchJump(jumpFalseRef);

    // Patch break targets to after loop
    const breakRefs = this.breakTargets.pop()!;
    for (const ref of breakRefs) {
      this.patchJump(ref);
    }
  }

  /**
   * Generate for statement bytecode
   */
  private generateForStatement(node: ForStatementNode): void {
    this.breakTargets.push([]);
    this.continueTargets.push([]);

    if (node.init) {
      this.generateNode(node.init);
    }

    const loopStart = this.calculateCurrentOffset();
    let jumpFalseRef = -1;
    if (node.test) {
      this.generateExpression(node.test);
      jumpFalseRef = this.instructions.length;
      this.emit(Opcode.JUMP_IF_FALSE, 0);
    }

    this.generateNode(node.body);

    const updateOffset = this.calculateCurrentOffset();
    // Patch continue targets to update
    const continueRefs = this.continueTargets.pop()!;
    for (const ref of continueRefs) {
      this.instructions[ref].operands[0] = updateOffset;
    }

    if (node.update) {
      this.generateExpression(node.update);
    }

    this.emit(Opcode.JUMP, loopStart);

    if (jumpFalseRef >= 0) {
      this.patchJump(jumpFalseRef);
    }

    const breakRefs = this.breakTargets.pop()!;
    for (const ref of breakRefs) {
      this.patchJump(ref);
    }
  }

  /**
   * Generate class declaration bytecode
   * class Foo extends Bar { constructor(x) { ... } method() { ... } static s() { ... } }
   * → Creates constructor function, sets up prototype chain, adds methods
   */
  private generateClassDeclaration(node: ClassDeclarationNode): void {
    // Find constructor method
    const ctorMethod = node.body.find(m => m.kind === "constructor");

    if (ctorMethod) {
      // Create constructor from the constructor method body
      const ctorFunc: FunctionDeclarationNode = {
        type: ASTNodeType.FUNCTION_DECLARATION,
        id: node.id,
        params: ctorMethod.value.params,
        body: ctorMethod.value.body,
      };
      const funcIndex = this.addConstant(ctorFunc);
      this.emit(Opcode.CREATE_CLOSURE, funcIndex);
    } else {
      // Default constructor: empty function
      const defaultCtor: FunctionDeclarationNode = {
        type: ASTNodeType.FUNCTION_DECLARATION,
        id: node.id,
        params: [],
        body: { type: ASTNodeType.BLOCK_STATEMENT, body: [] },
      };
      const funcIndex = this.addConstant(defaultCtor);
      this.emit(Opcode.CREATE_CLOSURE, funcIndex);
    }

    // Store constructor as class name
    const classNameIdx = this.getVariableIndex(node.id.name);
    this.emit(Opcode.STA_GLOBAL, classNameIdx);

    // Create default prototype object and set it on the constructor
    // Every constructor needs a .prototype property
    this.emit(Opcode.LDA_GLOBAL, classNameIdx);
    const ctorRegInit = this.allocateRegister();
    this.emit(Opcode.STAR, ctorRegInit);
    this.emit(Opcode.CREATE_OBJECT);
    const protoInit = this.addConstant("prototype");
    this.emit(Opcode.SET_PROPERTY, protoInit, ctorRegInit);

    // Set up prototype if extends
    if (node.superClass) {
      // Load super class
      this.generateExpression(node.superClass);
      const superReg = this.allocateRegister();
      this.emit(Opcode.STAR, superReg);

      // Get super.prototype
      const protoNameIdx = this.addConstant("prototype");
      this.emit(Opcode.GET_PROPERTY, protoNameIdx);

      // Create new object with super.prototype as __proto__
      const superProtoReg = this.allocateRegister();
      this.emit(Opcode.STAR, superProtoReg);

      // Load constructor, set its prototype
      this.emit(Opcode.LDA_GLOBAL, classNameIdx);
      const ctorReg = this.allocateRegister();
      this.emit(Opcode.STAR, ctorReg);

      // Set prototype.constructor = Foo
      this.emit(Opcode.CREATE_OBJECT);
      const newProtoReg = this.allocateRegister();
      this.emit(Opcode.STAR, newProtoReg);

      // Set Foo.prototype = newProto
      this.emit(Opcode.LDAR, newProtoReg);
      this.emit(Opcode.SET_PROPERTY, protoNameIdx, ctorReg);
    }

    // Add instance methods to prototype
    for (const method of node.body) {
      if (method.kind === "constructor") continue;
      if (method.isStatic) continue;

      // Load constructor
      this.emit(Opcode.LDA_GLOBAL, classNameIdx);
      const ctorReg2 = this.allocateRegister();
      this.emit(Opcode.STAR, ctorReg2);

      // Get prototype
      const protoNameIdx2 = this.addConstant("prototype");
      this.emit(Opcode.GET_PROPERTY, protoNameIdx2);
      const protoReg = this.allocateRegister();
      this.emit(Opcode.STAR, protoReg);

      // Create method closure
      const methodFunc = this.addConstant(method.value);
      this.emit(Opcode.CREATE_CLOSURE, methodFunc);

      // Set method on prototype
      const methodName = method.key.type === ASTNodeType.IDENTIFIER
        ? (method.key as IdentifierNode).name
        : String((method.key as LiteralNode).value);
      const methodNameIdx = this.addConstant(methodName);
      this.emit(Opcode.SET_PROPERTY, methodNameIdx, protoReg);
    }

    // Add static methods to constructor
    for (const method of node.body) {
      if (!method.isStatic) continue;

      // Load constructor
      this.emit(Opcode.LDA_GLOBAL, classNameIdx);
      const ctorReg3 = this.allocateRegister();
      this.emit(Opcode.STAR, ctorReg3);

      // Create method closure
      const methodFunc = this.addConstant(method.value);
      this.emit(Opcode.CREATE_CLOSURE, methodFunc);

      // Set method on constructor
      const methodName = method.key.type === ASTNodeType.IDENTIFIER
        ? (method.key as IdentifierNode).name
        : String((method.key as LiteralNode).value);
      const methodNameIdx = this.addConstant(methodName);
      this.emit(Opcode.SET_PROPERTY, methodNameIdx, ctorReg3);
    }
  }

  /**
   * Generate try/catch/finally bytecode
   */
  private generateTryStatement(node: TryStatementNode): void {
    // Emit TRY_START with placeholder for catch offset
    const tryStartRef = this.instructions.length;
    this.emit(Opcode.TRY_START, 0); // placeholder catch offset

    // Generate try block
    for (const stmt of node.block.body) {
      this.generateNode(stmt);
    }
    this.emit(Opcode.TRY_END);

    // Jump over catch block
    const jumpOverCatchRef = this.instructions.length;
    this.emit(Opcode.JUMP, 0); // placeholder

    // Patch TRY_START to point here (catch handler)
    this.patchJump(tryStartRef);

    // Generate catch block
    if (node.handler) {
      if (node.handler.param) {
        // Store caught exception to the parameter variable
        const paramIdx = this.getVariableIndex(node.handler.param.name);
        this.emit(Opcode.SET_CATCH_PARAM, paramIdx);
      }
      for (const stmt of node.handler.body.body) {
        this.generateNode(stmt);
      }
    }

    // Patch jump-over-catch
    this.patchJump(jumpOverCatchRef);

    // Generate finally block
    if (node.finalizer) {
      for (const stmt of node.finalizer.body) {
        this.generateNode(stmt);
      }
    }
  }

  /**
   * Generate throw statement bytecode
   */
  private generateThrowStatement(node: ThrowStatementNode): void {
    this.generateExpression(node.argument);
    this.emit(Opcode.THROW);
  }

  /**
   * Generate switch statement bytecode
   */
  private generateSwitchStatement(node: SwitchStatementNode): void {
    this.breakTargets.push([]);

    // Evaluate discriminant
    this.generateExpression(node.discriminant);
    const discReg = this.allocateRegister();
    this.emit(Opcode.STAR, discReg);

    const caseJumps: number[] = [];
    let defaultJump = -1;

    // Generate test + jump for each case
    for (let i = 0; i < node.cases.length; i++) {
      const c = node.cases[i];
      if (c.test === null) {
        // default case
        defaultJump = i;
        caseJumps.push(-1);
      } else {
        this.emit(Opcode.LDAR, discReg);
        const testReg = this.allocateRegister();
        this.emit(Opcode.STAR, testReg);
        this.generateExpression(c.test);
        this.emit(Opcode.TEST_STRICT_EQUAL, testReg);
        const jumpRef = this.instructions.length;
        this.emit(Opcode.JUMP_IF_TRUE, 0);
        caseJumps.push(jumpRef);
      }
    }

    // Jump to default or end
    const jumpToDefaultOrEnd = this.instructions.length;
    this.emit(Opcode.JUMP, 0);

    // Generate case bodies
    const bodyStarts: number[] = [];
    for (let i = 0; i < node.cases.length; i++) {
      bodyStarts.push(this.calculateCurrentOffset());
      for (const stmt of node.cases[i].consequent) {
        this.generateNode(stmt);
      }
    }

    const afterSwitch = this.calculateCurrentOffset();

    // Patch case jumps
    for (let i = 0; i < caseJumps.length; i++) {
      if (caseJumps[i] >= 0) {
        this.instructions[caseJumps[i]].operands[0] = bodyStarts[i];
      }
    }

    // Patch default/end jump
    if (defaultJump >= 0) {
      this.instructions[jumpToDefaultOrEnd].operands[0] = bodyStarts[defaultJump];
    } else {
      this.instructions[jumpToDefaultOrEnd].operands[0] = afterSwitch;
    }

    // Patch break targets
    const breakRefs = this.breakTargets.pop()!;
    for (const ref of breakRefs) {
      this.patchJump(ref);
    }
  }

  /**
   * Generate do-while statement bytecode
   */
  private generateDoWhileStatement(node: DoWhileStatementNode): void {
    this.breakTargets.push([]);
    this.continueTargets.push([]);

    const loopStart = this.calculateCurrentOffset();
    this.generateNode(node.body);

    const continueTarget = this.calculateCurrentOffset();
    const continueRefs = this.continueTargets.pop()!;
    for (const ref of continueRefs) {
      this.instructions[ref].operands[0] = continueTarget;
    }

    this.generateExpression(node.test);
    this.emit(Opcode.JUMP_IF_TRUE, loopStart);

    const breakRefs = this.breakTargets.pop()!;
    for (const ref of breakRefs) {
      this.patchJump(ref);
    }
  }

  /**
   * Calculate current bytecode offset
   */
  private calculateCurrentOffset(): number {
    let offset = 0;
    for (const instr of this.instructions) {
      offset += 1 + instr.operands.length;
    }
    return offset;
  }

  /**
   * Patch jump instruction to point to current position
   */
  private patchJump(instrIndex: number): void {
    this.instructions[instrIndex].operands[0] = this.calculateCurrentOffset();
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
/**
 * Compile options for V8Compiler
 */
export interface CompileOptions {
  /** Enable bytecodex Rust FFI optimization pass (constant folding, dead store elimination, peephole) */
  optimize?: boolean;
  /** Enable bytecodex validation pass (checks opcodes, operands, jump targets) */
  validate?: boolean;
}

const { ByteCodeX } = await import("@browserx/bytecodex");
const _bytecodex = new ByteCodeX();

export class V8Compiler {
  /**
   * Compile JavaScript to bytecode
   * @param source - JavaScript source code
   * @param options - Optional compile options (optimize, validate)
   */
  compile(source: string, options?: CompileOptions): CompiledFunction {
    // Lex
    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();

    // Parse
    const parser = new Parser(tokens);
    const ast = parser.parse();

    // Generate bytecode
    const generator = new BytecodeGenerator();
    const compiled = generator.generate(ast);

    // Optional bytecodex optimization pass (Rust FFI)
    if (options?.optimize || options?.validate) {
      const input = {
        instructions: Array.from(compiled.bytecode),
        constant_pool: compiled.constantPool.map((c: unknown) =>
          typeof c === "number" || typeof c === "string" ? c : null
        ),
      };

      if (options.validate) {
        const validation = _bytecodex.validate(input);
        if (!validation.valid) {
          const errors = validation.errors.filter(
            (e: { severity: string }) => e.severity === "Error",
          );
          if (errors.length > 0) {
            throw new Error(
              `Bytecode validation failed: ${errors[0].message} at offset ${errors[0].offset}`,
            );
          }
        }
      }

      if (options.optimize) {
        const result = _bytecodex.optimize(input);
        compiled.bytecode = new Uint8Array(result.instructions);
        for (let i = 0; i < result.constant_pool.length; i++) {
          if (result.constant_pool[i] !== null) {
            compiled.constantPool[i] = result.constant_pool[i];
          }
        }
      }
    }

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
