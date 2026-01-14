/**
 * Parser Tests
 * Tests for recursive descent parser and AST generation
 */

import { assertEquals, assertExists, assert, assertThrows } from "@std/assert";
import { parseQuery, parseExpression } from "../helpers/test-utils.ts";
import type {
  SelectStatement,
  NavigateStatement,
  SetStatement,
  ForStatement,
  IfStatement,
  WithStatement,
  InsertStatement,
  UpdateStatement,
  DeleteStatement,
  BinaryExpression,
  UnaryExpression,
  CallExpression,
  MemberExpression,
  Literal,
  Identifier,
  ArrayExpression,
  ObjectExpression,
} from "../../types/ast.ts";

// ============================================================================
// SELECT Statement Tests
// ============================================================================

Deno.test({
  name: "Parser - parseQuery simple SELECT",
  fn() {
    const ast = parseQuery("SELECT * FROM 'http://example.com'") as SelectStatement;

    assertEquals(ast.type, "SELECT");
    assertEquals(ast.fields.length, 1);
    assertEquals(ast.fields[0].name, "*");
    assertEquals(ast.source.type, "URL");
    assertEquals(ast.source.value, "http://example.com");
  },
});

Deno.test({
  name: "Parser - parseQuery SELECT with multiple fields",
  fn() {
    const ast = parseQuery("SELECT name, age, email FROM users") as SelectStatement;

    assertEquals(ast.type, "SELECT");
    assertEquals(ast.fields.length, 3);
    assertEquals(ast.fields[0].name, "name");
    assertEquals(ast.fields[1].name, "age");
    assertEquals(ast.fields[2].name, "email");
  },
});

Deno.test({
  name: "Parser - parseQuery SELECT with field aliases",
  fn() {
    const ast = parseQuery("SELECT name AS fullName, age AS years FROM users") as SelectStatement;

    assertEquals(ast.type, "SELECT");
    assertEquals(ast.fields[0].alias, "fullName");
    assertEquals(ast.fields[1].alias, "years");
  },
});

Deno.test({
  name: "Parser - parseQuery SELECT with WHERE clause",
  fn() {
    const ast = parseQuery("SELECT * FROM users WHERE age > 18") as SelectStatement;

    assertEquals(ast.type, "SELECT");
    assertExists(ast.where);
    if (ast.where) {
      const whereExpr = ast.where as BinaryExpression;
      assertEquals(whereExpr.type, "BINARY");
      assertEquals(whereExpr.operator, ">");
    }
  },
});

Deno.test({
  name: "Parser - parseQuery SELECT with ORDER BY",
  fn() {
    const ast = parseQuery("SELECT * FROM users ORDER BY age DESC") as SelectStatement;

    assertEquals(ast.type, "SELECT");
    assertExists(ast.orderBy);
    assertEquals(ast.orderBy.length, 1);
    assertEquals(ast.orderBy[0].field, "age");
    assertEquals(ast.orderBy[0].direction, "DESC");
  },
});

Deno.test({
  name: "Parser - parseQuery SELECT with ORDER BY ASC",
  fn() {
    const ast = parseQuery("SELECT * FROM users ORDER BY name ASC") as SelectStatement;

    assertEquals(ast.type, "SELECT");
    assertExists(ast.orderBy);
    assertEquals(ast.orderBy[0].direction, "ASC");
  },
});

Deno.test({
  name: "Parser - parseQuery SELECT with multiple ORDER BY",
  fn() {
    const ast = parseQuery("SELECT * FROM users ORDER BY age DESC, name ASC") as SelectStatement;

    assertEquals(ast.type, "SELECT");
    assertExists(ast.orderBy);
    assertEquals(ast.orderBy.length, 2);
    assertEquals(ast.orderBy[0].field, "age");
    assertEquals(ast.orderBy[0].direction, "DESC");
    assertEquals(ast.orderBy[1].field, "name");
    assertEquals(ast.orderBy[1].direction, "ASC");
  },
});

Deno.test({
  name: "Parser - parseQuery SELECT with LIMIT",
  fn() {
    const ast = parseQuery("SELECT * FROM users LIMIT 10") as SelectStatement;

    assertEquals(ast.type, "SELECT");
    assertExists(ast.limit);
    assertEquals(ast.limit.limit, 10);
    assertEquals(ast.limit.offset, undefined);
  },
});

Deno.test({
  name: "Parser - parseQuery SELECT with LIMIT and OFFSET",
  fn() {
    const ast = parseQuery("SELECT * FROM users LIMIT 10 OFFSET 20") as SelectStatement;

    assertEquals(ast.type, "SELECT");
    assertExists(ast.limit);
    assertEquals(ast.limit.limit, 10);
    assertEquals(ast.limit.offset, 20);
  },
});

Deno.test({
  name: "Parser - parseQuery SELECT with subquery source",
  fn() {
    const ast = parseQuery("SELECT * FROM (SELECT * FROM users WHERE active = true)") as SelectStatement;

    assertEquals(ast.type, "SELECT");
    assertEquals(ast.source.type, "SUBQUERY");
    assertExists(ast.source.value);
    assertEquals((ast.source.value as SelectStatement).type, "SELECT");
  },
});

Deno.test({
  name: "Parser - parseQuery SELECT with variable source",
  fn() {
    const ast = parseQuery("SELECT * FROM myData") as SelectStatement;

    assertEquals(ast.type, "SELECT");
    assertEquals(ast.source.type, "VARIABLE");
    assertEquals(ast.source.value, "myData");
  },
});

Deno.test({
  name: "Parser - parseQuery complex SELECT",
  fn() {
    const ast = parseQuery(
      "SELECT name, age AS years FROM users WHERE age > 18 ORDER BY age DESC LIMIT 5"
    ) as SelectStatement;

    assertEquals(ast.type, "SELECT");
    assertEquals(ast.fields.length, 2);
    assertExists(ast.where);
    assertExists(ast.orderBy);
    assertExists(ast.limit);
  },
});

// ============================================================================
// NAVIGATE Statement Tests
// ============================================================================

Deno.test({
  name: "Parser - parseQuery NAVIGATE TO string",
  fn() {
    const ast = parseQuery("NAVIGATE TO 'http://example.com'") as NavigateStatement;

    assertEquals(ast.type, "NAVIGATE");
    const urlExpr = ast.url as Literal;
    assertEquals(urlExpr.type, "LITERAL");
    assertEquals(urlExpr.value, "http://example.com");
  },
});

Deno.test({
  name: "Parser - parseQuery NAVIGATE TO variable",
  fn() {
    const ast = parseQuery("NAVIGATE TO myUrl") as NavigateStatement;

    assertEquals(ast.type, "NAVIGATE");
    const urlExpr = ast.url as Identifier;
    assertEquals(urlExpr.type, "IDENTIFIER");
    assertEquals(urlExpr.name, "myUrl");
  },
});

Deno.test({
  name: "Parser - parseQuery NAVIGATE with WITH options",
  fn() {
    const ast = parseQuery("NAVIGATE TO 'http://example.com' WITH { timeout: 5000 }") as NavigateStatement;

    assertEquals(ast.type, "NAVIGATE");
    assertExists(ast.options);
    const optionsExpr = ast.options as unknown as ObjectExpression;
    assertEquals(optionsExpr.type, "OBJECT");
  },
});

Deno.test({
  name: "Parser - parseQuery NAVIGATE with CAPTURE",
  fn() {
    const ast = parseQuery("NAVIGATE TO 'http://example.com' CAPTURE title") as NavigateStatement;

    assertEquals(ast.type, "NAVIGATE");
    assertExists(ast.capture);
    assertEquals(ast.capture.fields.length, 1);
    assertEquals(ast.capture.fields[0].name, "title");
  },
});

Deno.test({
  name: "Parser - parseQuery NAVIGATE with WITH and CAPTURE",
  fn() {
    const ast = parseQuery(
      "NAVIGATE TO 'http://example.com' WITH { timeout: 5000 } CAPTURE title, links"
    ) as NavigateStatement;

    assertEquals(ast.type, "NAVIGATE");
    assertExists(ast.options);
    assertExists(ast.capture);
    assertEquals(ast.capture.fields.length, 2);
  },
});

// ============================================================================
// SET Statement Tests
// ============================================================================

Deno.test({
  name: "Parser - parseQuery SET variable",
  fn() {
    const ast = parseQuery("SET result = 42") as SetStatement;

    assertEquals(ast.type, "SET");
    assertEquals(ast.path.length, 1);
    assertEquals(ast.path[0], "result");
    assertEquals(ast.value.type, "LITERAL");
  },
});

Deno.test({
  name: "Parser - parseQuery SET with member path",
  fn() {
    const ast = parseQuery("SET config.timeout = 5000") as SetStatement;

    assertEquals(ast.type, "SET");
    assertEquals(ast.path.length, 2);
    assertEquals(ast.path[0], "config");
    assertEquals(ast.path[1], "timeout");
  },
});

Deno.test({
  name: "Parser - parseQuery SET with deep path",
  fn() {
    const ast = parseQuery("SET app.settings.theme.color = 'dark'") as SetStatement;

    assertEquals(ast.type, "SET");
    assertEquals(ast.path.length, 4);
    assertEquals(ast.path[0], "app");
    assertEquals(ast.path[1], "settings");
    assertEquals(ast.path[2], "theme");
    assertEquals(ast.path[3], "color");
  },
});

Deno.test({
  name: "Parser - parseQuery SET with expression",
  fn() {
    const ast = parseQuery("SET total = price * quantity") as SetStatement;

    assertEquals(ast.type, "SET");
    assertEquals(ast.value.type, "BINARY");
  },
});

// ============================================================================
// FOR Statement Tests
// ============================================================================

Deno.test({
  name: "Parser - parseQuery FOR EACH loop",
  fn() {
    const ast = parseQuery("FOR EACH item IN items { SHOW item }") as ForStatement;

    assertEquals(ast.type, "FOR");
    assertEquals(ast.variable, "item");
    const collectionExpr = ast.collection as Identifier;
    assertEquals(collectionExpr.type, "IDENTIFIER");
    assertEquals(collectionExpr.name, "items");
    assertEquals(ast.body.type, "SHOW");
  },
});

Deno.test({
  name: "Parser - parseQuery FOR EACH with expression collection",
  fn() {
    const ast = parseQuery("FOR EACH num IN [1, 2, 3] { SHOW num }") as ForStatement;

    assertEquals(ast.type, "FOR");
    assertEquals(ast.collection.type, "ARRAY");
  },
});

// ============================================================================
// IF Statement Tests
// ============================================================================

Deno.test({
  name: "Parser - parseQuery IF THEN",
  fn() {
    const ast = parseQuery("IF x > 10 THEN { SHOW 'large' }") as IfStatement;

    assertEquals(ast.type, "IF");
    assertEquals(ast.condition.type, "BINARY");
    assertEquals(ast.thenBranch.type, "SHOW");
    assertEquals(ast.elseBranch, undefined);
  },
});

Deno.test({
  name: "Parser - parseQuery IF THEN ELSE",
  fn() {
    const ast = parseQuery("IF x > 10 THEN { SHOW 'large' } ELSE { SHOW 'small' }") as IfStatement;

    assertEquals(ast.type, "IF");
    assertExists(ast.thenBranch);
    assertExists(ast.elseBranch);
    assertEquals(ast.elseBranch.type, "SHOW");
  },
});

Deno.test({
  name: "Parser - parseQuery nested IF",
  fn() {
    const ast = parseQuery("IF x > 10 THEN { IF y > 5 THEN { SHOW 'both' } }") as IfStatement;

    assertEquals(ast.type, "IF");
    assertEquals(ast.thenBranch.type, "IF");
  },
});

// ============================================================================
// WITH Statement (CTE) Tests
// ============================================================================

Deno.test({
  name: "Parser - parseQuery WITH single CTE",
  fn() {
    const ast = parseQuery("WITH users AS (SELECT * FROM 'http://api.com/users') SELECT * FROM users") as WithStatement;

    assertEquals(ast.type, "WITH");
    assertEquals(ast.ctes.length, 1);
    assertEquals(ast.ctes[0].name, "users");
    assertEquals(ast.ctes[0].query.type, "SELECT");
    assertEquals(ast.query.type, "SELECT");
  },
});

Deno.test({
  name: "Parser - parseQuery WITH multiple CTEs",
  fn() {
    const ast = parseQuery(
      "WITH a AS (SELECT * FROM x), b AS (SELECT * FROM y) SELECT * FROM a"
    ) as WithStatement;

    assertEquals(ast.type, "WITH");
    assertEquals(ast.ctes.length, 2);
    assertEquals(ast.ctes[0].name, "a");
    assertEquals(ast.ctes[1].name, "b");
  },
});

// ============================================================================
// INSERT/UPDATE/DELETE Statement Tests
// ============================================================================

Deno.test({
  name: "Parser - parseQuery INSERT",
  fn() {
    const ast = parseQuery("INSERT { name: 'Alice' } INTO users") as InsertStatement;

    assertEquals(ast.type, "INSERT");
    assertEquals(ast.value.type, "OBJECT");
    assertEquals(ast.target.type, "IDENTIFIER");
  },
});

Deno.test({
  name: "Parser - parseQuery UPDATE",
  fn() {
    const ast = parseQuery("UPDATE user SET name = 'Bob', age = 30") as UpdateStatement;

    assertEquals(ast.type, "UPDATE");
    assertEquals(ast.target.type, "IDENTIFIER");
    assertEquals(ast.assignments.length, 2);
    assertEquals(ast.assignments[0].property, "name");
    assertEquals(ast.assignments[1].property, "age");
  },
});

Deno.test({
  name: "Parser - parseQuery DELETE",
  fn() {
    const ast = parseQuery("DELETE user") as DeleteStatement;

    assertEquals(ast.type, "DELETE");
    assertEquals(ast.target.type, "IDENTIFIER");
  },
});

// ============================================================================
// Binary Expression Tests
// ============================================================================

Deno.test({
  name: "Parser - parseExpression arithmetic addition",
  fn() {
    const expr = parseExpression("10 + 20") as BinaryExpression;

    assertEquals(expr.type, "BINARY");
    assertEquals(expr.operator, "+");
    assertEquals((expr.left as Literal).value, 10);
    assertEquals((expr.right as Literal).value, 20);
  },
});

Deno.test({
  name: "Parser - parseExpression arithmetic subtraction",
  fn() {
    const expr = parseExpression("100 - 42") as BinaryExpression;

    assertEquals(expr.type, "BINARY");
    assertEquals(expr.operator, "-");
  },
});

Deno.test({
  name: "Parser - parseExpression arithmetic multiplication",
  fn() {
    const expr = parseExpression("5 * 3") as BinaryExpression;

    assertEquals(expr.type, "BINARY");
    assertEquals(expr.operator, "*");
  },
});

Deno.test({
  name: "Parser - parseExpression arithmetic division",
  fn() {
    const expr = parseExpression("20 / 4") as BinaryExpression;

    assertEquals(expr.type, "BINARY");
    assertEquals(expr.operator, "/");
  },
});

Deno.test({
  name: "Parser - parseExpression modulo",
  fn() {
    const expr = parseExpression("10 % 3") as BinaryExpression;

    assertEquals(expr.type, "BINARY");
    assertEquals(expr.operator, "%");
  },
});

Deno.test({
  name: "Parser - parseExpression string concatenation",
  fn() {
    const expr = parseExpression("'Hello' || ' ' || 'World'") as BinaryExpression;

    assertEquals(expr.type, "BINARY");
    assertEquals(expr.operator, "||");
  },
});

Deno.test({
  name: "Parser - parseExpression comparison greater than",
  fn() {
    const expr = parseExpression("age > 18") as BinaryExpression;

    assertEquals(expr.type, "BINARY");
    assertEquals(expr.operator, ">");
  },
});

Deno.test({
  name: "Parser - parseExpression comparison greater than or equal",
  fn() {
    const expr = parseExpression("score >= 100") as BinaryExpression;

    assertEquals(expr.type, "BINARY");
    assertEquals(expr.operator, ">=");
  },
});

Deno.test({
  name: "Parser - parseExpression comparison less than",
  fn() {
    const expr = parseExpression("price < 50") as BinaryExpression;

    assertEquals(expr.type, "BINARY");
    assertEquals(expr.operator, "<");
  },
});

Deno.test({
  name: "Parser - parseExpression comparison less than or equal",
  fn() {
    const expr = parseExpression("count <= 10") as BinaryExpression;

    assertEquals(expr.type, "BINARY");
    assertEquals(expr.operator, "<=");
  },
});

Deno.test({
  name: "Parser - parseExpression equality",
  fn() {
    const expr = parseExpression("status = 'active'") as BinaryExpression;

    assertEquals(expr.type, "BINARY");
    assertEquals(expr.operator, "=");
  },
});

Deno.test({
  name: "Parser - parseExpression not equals",
  fn() {
    const expr = parseExpression("status != 'inactive'") as BinaryExpression;

    assertEquals(expr.type, "BINARY");
    assertEquals(expr.operator, "!=");
  },
});

Deno.test({
  name: "Parser - parseExpression logical AND",
  fn() {
    const expr = parseExpression("age > 18 AND active = true") as BinaryExpression;

    assertEquals(expr.type, "BINARY");
    assertEquals(expr.operator, "AND");
  },
});

Deno.test({
  name: "Parser - parseExpression logical OR",
  fn() {
    const expr = parseExpression("status = 'active' OR status = 'pending'") as BinaryExpression;

    assertEquals(expr.type, "BINARY");
    assertEquals(expr.operator, "OR");
  },
});

Deno.test({
  name: "Parser - parseExpression IN operator",
  fn() {
    const expr = parseExpression("status IN ['active', 'pending']") as BinaryExpression;

    assertEquals(expr.type, "BINARY");
    assertEquals(expr.operator, "IN");
  },
});

Deno.test({
  name: "Parser - parseExpression LIKE operator",
  fn() {
    const expr = parseExpression("name LIKE '%John%'") as BinaryExpression;

    assertEquals(expr.type, "BINARY");
    assertEquals(expr.operator, "LIKE");
  },
});

// ============================================================================
// Operator Precedence Tests
// ============================================================================

Deno.test({
  name: "Parser - operator precedence multiplication before addition",
  fn() {
    const expr = parseExpression("2 + 3 * 4") as BinaryExpression;

    assertEquals(expr.type, "BINARY");
    assertEquals(expr.operator, "+");
    assertEquals((expr.left as Literal).value, 2);
    assertEquals((expr.right as BinaryExpression).operator, "*");
  },
});

Deno.test({
  name: "Parser - operator precedence division before subtraction",
  fn() {
    const expr = parseExpression("10 - 6 / 2") as BinaryExpression;

    assertEquals(expr.type, "BINARY");
    assertEquals(expr.operator, "-");
    assertEquals((expr.right as BinaryExpression).operator, "/");
  },
});

Deno.test({
  name: "Parser - operator precedence AND before OR",
  fn() {
    const expr = parseExpression("a = 1 OR b = 2 AND c = 3") as BinaryExpression;

    assertEquals(expr.type, "BINARY");
    assertEquals(expr.operator, "OR");
    assertEquals((expr.right as BinaryExpression).operator, "AND");
  },
});

Deno.test({
  name: "Parser - operator precedence parentheses override",
  fn() {
    const expr = parseExpression("(2 + 3) * 4") as BinaryExpression;

    assertEquals(expr.type, "BINARY");
    assertEquals(expr.operator, "*");
    assertEquals((expr.left as BinaryExpression).operator, "+");
  },
});

Deno.test({
  name: "Parser - operator precedence comparison before AND",
  fn() {
    const expr = parseExpression("age > 18 AND active = true") as BinaryExpression;

    assertEquals(expr.type, "BINARY");
    assertEquals(expr.operator, "AND");
    assertEquals((expr.left as BinaryExpression).operator, ">");
    assertEquals((expr.right as BinaryExpression).operator, "=");
  },
});

// ============================================================================
// Unary Expression Tests
// ============================================================================

Deno.test({
  name: "Parser - parseExpression unary NOT",
  fn() {
    const expr = parseExpression("NOT active") as UnaryExpression;

    assertEquals(expr.type, "UNARY");
    assertEquals(expr.operator, "NOT");
  },
});

Deno.test({
  name: "Parser - parseExpression unary minus",
  fn() {
    const expr = parseExpression("-42") as UnaryExpression;

    assertEquals(expr.type, "UNARY");
    assertEquals(expr.operator, "-");
    assertEquals((expr.operand as Literal).value, 42);
  },
});

Deno.test({
  name: "Parser - parseExpression nested unary",
  fn() {
    const expr = parseExpression("NOT NOT active") as UnaryExpression;

    assertEquals(expr.type, "UNARY");
    assertEquals(expr.operator, "NOT");
    assertEquals(expr.operand.type, "UNARY");
    assertEquals((expr.operand as UnaryExpression).operator, "NOT");
  },
});

// ============================================================================
// Function Call Tests
// ============================================================================

Deno.test({
  name: "Parser - parseExpression function call no args",
  fn() {
    const expr = parseExpression("NOW()") as CallExpression;

    assertEquals(expr.type, "CALL");
    assertEquals(expr.callee, "NOW");
    assertEquals(expr.arguments.length, 0);
  },
});

Deno.test({
  name: "Parser - parseExpression function call single arg",
  fn() {
    const expr = parseExpression("UPPER(name)") as CallExpression;

    assertEquals(expr.type, "CALL");
    assertEquals(expr.callee, "UPPER");
    assertEquals(expr.arguments.length, 1);
  },
});

Deno.test({
  name: "Parser - parseExpression function call multiple args",
  fn() {
    const expr = parseExpression("SUBSTRING(text, 0, 10)") as CallExpression;

    assertEquals(expr.type, "CALL");
    assertEquals(expr.callee, "SUBSTRING");
    assertEquals(expr.arguments.length, 3);
  },
});

Deno.test({
  name: "Parser - parseExpression nested function calls",
  fn() {
    const expr = parseExpression("UPPER(TRIM(name))") as CallExpression;

    assertEquals(expr.type, "CALL");
    assertEquals(expr.callee, "UPPER");
    assertEquals(expr.arguments[0].type, "CALL");
    assertEquals((expr.arguments[0] as CallExpression).callee, "TRIM");
  },
});

// ============================================================================
// Member Expression Tests
// ============================================================================

Deno.test({
  name: "Parser - parseExpression member access",
  fn() {
    const expr = parseExpression("user.name") as MemberExpression;

    assertEquals(expr.type, "MEMBER");
    assertEquals((expr.object as Identifier).name, "user");
    assertEquals(expr.property, "name");
    assertEquals(expr.computed, false);
  },
});

Deno.test({
  name: "Parser - parseExpression nested member access",
  fn() {
    const expr = parseExpression("user.address.city") as MemberExpression;

    assertEquals(expr.type, "MEMBER");
    assertEquals(expr.property, "city");
    assertEquals(expr.object.type, "MEMBER");
    assertEquals((expr.object as MemberExpression).property, "address");
  },
});

Deno.test({
  name: "Parser - parseExpression computed member access",
  fn() {
    const expr = parseExpression("user['name']") as MemberExpression;

    assertEquals(expr.type, "MEMBER");
    assertEquals(expr.computed, true);
  },
});

// ============================================================================
// Literal Tests
// ============================================================================

Deno.test({
  name: "Parser - parseExpression string literal",
  fn() {
    const expr = parseExpression("'hello world'") as Literal;

    assertEquals(expr.type, "LITERAL");
    assertEquals(expr.dataType, "STRING");
    assertEquals(expr.value, "hello world");
  },
});

Deno.test({
  name: "Parser - parseExpression number literal",
  fn() {
    const expr = parseExpression("42") as Literal;

    assertEquals(expr.type, "LITERAL");
    assertEquals(expr.dataType, "NUMBER");
    assertEquals(expr.value, 42);
  },
});

Deno.test({
  name: "Parser - parseExpression float literal",
  fn() {
    const expr = parseExpression("3.14") as Literal;

    assertEquals(expr.type, "LITERAL");
    assertEquals(expr.value, 3.14);
  },
});

Deno.test({
  name: "Parser - parseExpression boolean true",
  fn() {
    const expr = parseExpression("true") as Literal;

    assertEquals(expr.type, "LITERAL");
    assertEquals(expr.dataType, "BOOLEAN");
    assertEquals(expr.value, true);
  },
});

Deno.test({
  name: "Parser - parseExpression boolean false",
  fn() {
    const expr = parseExpression("false") as Literal;

    assertEquals(expr.type, "LITERAL");
    assertEquals(expr.dataType, "BOOLEAN");
    assertEquals(expr.value, false);
  },
});

Deno.test({
  name: "Parser - parseExpression null",
  fn() {
    const expr = parseExpression("null") as Literal;

    assertEquals(expr.type, "LITERAL");
    assertEquals(expr.dataType, "NULL");
    assertEquals(expr.value, null);
  },
});

Deno.test({
  name: "Parser - parseExpression array empty",
  fn() {
    const expr = parseExpression("[]") as ArrayExpression;

    assertEquals(expr.type, "ARRAY");
    assertEquals(expr.elements.length, 0);
  },
});

Deno.test({
  name: "Parser - parseExpression array with values",
  fn() {
    const expr = parseExpression("[1, 2, 3]") as ArrayExpression;

    assertEquals(expr.type, "ARRAY");
    assertEquals(expr.elements.length, 3);
  },
});

Deno.test({
  name: "Parser - parseExpression array nested",
  fn() {
    const expr = parseExpression("[[1, 2], [3, 4]]") as ArrayExpression;

    assertEquals(expr.type, "ARRAY");
    assertEquals(expr.elements[0].type, "ARRAY");
  },
});

Deno.test({
  name: "Parser - parseExpression object empty",
  fn() {
    const expr = parseExpression("{}") as ObjectExpression;

    assertEquals(expr.type, "OBJECT");
    assertEquals(expr.properties.length, 0);
  },
});

Deno.test({
  name: "Parser - parseExpression object with properties",
  fn() {
    const expr = parseExpression("{ name: 'Alice', age: 25 }") as ObjectExpression;

    assertEquals(expr.type, "OBJECT");
    assertEquals(expr.properties.length, 2);
    assertEquals(expr.properties[0].key, "name");
    assertEquals(expr.properties[1].key, "age");
  },
});

Deno.test({
  name: "Parser - parseExpression object nested",
  fn() {
    const expr = parseExpression("{ user: { name: 'Alice' } }") as ObjectExpression;

    assertEquals(expr.type, "OBJECT");
    assertEquals(expr.properties[0].value.type, "OBJECT");
  },
});

Deno.test({
  name: "Parser - parseExpression identifier",
  fn() {
    const expr = parseExpression("myVariable") as Identifier;

    assertEquals(expr.type, "IDENTIFIER");
    assertEquals(expr.name, "myVariable");
  },
});

// ============================================================================
// Error Handling Tests
// ============================================================================

Deno.test({
  name: "Parser - throws on unexpected token",
  fn() {
    assertThrows(
      () => parseQuery("SELECT FROM users"),
      Error,
      "Parse error"
    );
  },
});

Deno.test({
  name: "Parser - throws on missing FROM",
  fn() {
    assertThrows(
      () => parseQuery("SELECT * WHERE age > 18"),
      Error
    );
  },
});

Deno.test({
  name: "Parser - throws on missing closing paren",
  fn() {
    assertThrows(
      () => parseExpression("(1 + 2"),
      Error
    );
  },
});

Deno.test({
  name: "Parser - throws on missing closing bracket",
  fn() {
    assertThrows(
      () => parseExpression("[1, 2, 3"),
      Error
    );
  },
});

Deno.test({
  name: "Parser - throws on missing closing brace",
  fn() {
    assertThrows(
      () => parseExpression("{ name: 'Alice'"),
      Error
    );
  },
});

// ============================================================================
// Integration Tests
// ============================================================================

Deno.test({
  name: "Parser - complete complex query",
  fn() {
    const ast = parseQuery(
      "SELECT user.name AS fullName, user.age " +
      "FROM 'http://api.com/users' " +
      "WHERE user.age > 18 AND user.active = true " +
      "ORDER BY user.age DESC " +
      "LIMIT 10 OFFSET 5"
    ) as SelectStatement;

    assertEquals(ast.type, "SELECT");
    assertEquals(ast.fields.length, 2);
    assertExists(ast.where);
    assertExists(ast.orderBy);
    assertExists(ast.limit);
    assertEquals(ast.limit.limit, 10);
    assertEquals(ast.limit.offset, 5);
  },
});

Deno.test({
  name: "Parser - complex expression with all operators",
  fn() {
    const expr = parseExpression("(a + b) * c > 100 AND status = 'active' OR NOT flag") as BinaryExpression;

    assertEquals(expr.type, "BINARY");
    // Complex nested structure verified by not throwing
    assertExists(expr.left);
    assertExists(expr.right);
  },
});
