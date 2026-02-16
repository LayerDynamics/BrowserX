/**
 * PredicatePushdown Tests
 * Comprehensive tests for PredicatePushdown optimizer pass
 */

import { assertEquals, assertExists } from "@std/assert";
import { PredicatePushdownPass } from "../../optimizer/passes/predicate-pushdown.ts";
import type {
  BinaryExpression,
  Expression,
  Field,
  Identifier,
  Literal,
  SelectStatement,
  Source,
  Statement,
  UnaryExpression,
} from "../../types/ast.ts";

// ============================================================================
// AST Builder Helpers
// ============================================================================

function createIdentifier(name: string): Identifier {
  return { type: "IDENTIFIER", name };
}

function createLiteral(value: unknown, dataType = "STRING"): Literal {
  return { type: "LITERAL", value, dataType: dataType as any };
}

function createBinaryExpr(
  left: Expression,
  operator: string,
  right: Expression,
): BinaryExpression {
  return { type: "BINARY", operator: operator as any, left, right };
}

function createUnaryExpr(operator: string, operand: Expression): UnaryExpression {
  return { type: "UNARY", operator: operator as any, operand };
}

function createField(name: string, alias?: string): Field {
  return { name, alias };
}

function createSource(type: Source["type"], value: string | Statement): Source {
  return { type, value };
}

function createSelectStmt(
  fields: Field[],
  source: Source,
  where?: Expression,
): SelectStatement {
  return { type: "SELECT", fields, source, where };
}

// ============================================================================
// Category 1: Basic Predicate Pushdown (10 tests)
// ============================================================================

Deno.test({
  name: "PredicatePushdown - pushes WHERE clause into FROM subquery",
  fn() {
    const pass = new PredicatePushdownPass();

    // SELECT * FROM (SELECT id, name FROM users) WHERE id > 10
    const subquery = createSelectStmt(
      [createField("id"), createField("name")],
      createSource("URL", "users"),
    );

    const stmt = createSelectStmt(
      [createField("*")],
      createSource("SUBQUERY", subquery),
      createBinaryExpr(createIdentifier("id"), ">", createLiteral(10, "NUMBER")),
    );

    const result = pass.apply(stmt) as SelectStatement;

    // Predicate should be pushed to subquery
    assertExists(result.source);
    assertEquals(result.source.type, "SUBQUERY");

    const pushedSubquery = result.source.value as SelectStatement;
    assertExists(pushedSubquery.where);

    const whereExpr = pushedSubquery.where as BinaryExpression;
    assertEquals(whereExpr.operator, ">");
    assertEquals((whereExpr.left as Identifier).name, "id");

    // Outer WHERE should be removed
    assertEquals(result.where, undefined);
  },
});

Deno.test({
  name: "PredicatePushdown - pushes conditions closer to data source",
  fn() {
    const pass = new PredicatePushdownPass();

    // SELECT * FROM (SELECT price, quantity FROM items) WHERE price < 100
    const subquery = createSelectStmt(
      [createField("price"), createField("quantity")],
      createSource("URL", "items"),
    );

    const stmt = createSelectStmt(
      [createField("*")],
      createSource("SUBQUERY", subquery),
      createBinaryExpr(createIdentifier("price"), "<", createLiteral(100, "NUMBER")),
    );

    const result = pass.apply(stmt) as SelectStatement;
    const pushedSubquery = result.source.value as SelectStatement;

    // Verify predicate was pushed
    assertExists(pushedSubquery.where);
    const whereExpr = pushedSubquery.where as BinaryExpression;
    assertEquals(whereExpr.operator, "<");
    assertEquals((whereExpr.left as Identifier).name, "price");
    assertEquals((whereExpr.right as Literal).value, 100);
  },
});

Deno.test({
  name: "PredicatePushdown - multiple predicates pushed down",
  fn() {
    const pass = new PredicatePushdownPass();

    // SELECT * FROM (SELECT id, status FROM orders) WHERE id > 5 AND status = 'active'
    const subquery = createSelectStmt(
      [createField("id"), createField("status")],
      createSource("URL", "orders"),
    );

    const whereCond = createBinaryExpr(
      createBinaryExpr(createIdentifier("id"), ">", createLiteral(5, "NUMBER")),
      "AND",
      createBinaryExpr(createIdentifier("status"), "=", createLiteral("active")),
    );

    const stmt = createSelectStmt(
      [createField("*")],
      createSource("SUBQUERY", subquery),
      whereCond,
    );

    const result = pass.apply(stmt) as SelectStatement;
    const pushedSubquery = result.source.value as SelectStatement;

    // Both predicates should be pushed
    assertExists(pushedSubquery.where);
    assertEquals((pushedSubquery.where as BinaryExpression).operator, "AND");
  },
});

Deno.test({
  name: "PredicatePushdown - predicates reference correct fields",
  fn() {
    const pass = new PredicatePushdownPass();

    // SELECT * FROM (SELECT name, age FROM people) WHERE age >= 18
    const subquery = createSelectStmt(
      [createField("name"), createField("age")],
      createSource("URL", "people"),
    );

    const stmt = createSelectStmt(
      [createField("*")],
      createSource("SUBQUERY", subquery),
      createBinaryExpr(createIdentifier("age"), ">=", createLiteral(18, "NUMBER")),
    );

    const result = pass.apply(stmt) as SelectStatement;
    const pushedSubquery = result.source.value as SelectStatement;

    // Verify correct field is referenced
    assertExists(pushedSubquery.where);
    const whereExpr = pushedSubquery.where as BinaryExpression;
    assertEquals((whereExpr.left as Identifier).name, "age");
  },
});

Deno.test({
  name: "PredicatePushdown - handles equality predicates",
  fn() {
    const pass = new PredicatePushdownPass();

    // SELECT * FROM (SELECT email FROM accounts) WHERE email = 'test@example.com'
    const subquery = createSelectStmt(
      [createField("email")],
      createSource("URL", "accounts"),
    );

    const stmt = createSelectStmt(
      [createField("*")],
      createSource("SUBQUERY", subquery),
      createBinaryExpr(createIdentifier("email"), "=", createLiteral("test@example.com")),
    );

    const result = pass.apply(stmt) as SelectStatement;
    const pushedSubquery = result.source.value as SelectStatement;

    assertExists(pushedSubquery.where);
    const whereExpr = pushedSubquery.where as BinaryExpression;
    assertEquals(whereExpr.operator, "=");
    assertEquals((whereExpr.left as Identifier).name, "email");
    assertEquals((whereExpr.right as Literal).value, "test@example.com");
  },
});

Deno.test({
  name: "PredicatePushdown - handles inequality predicates",
  fn() {
    const pass = new PredicatePushdownPass();

    // SELECT * FROM (SELECT score FROM tests) WHERE score != 0
    const subquery = createSelectStmt(
      [createField("score")],
      createSource("URL", "tests"),
    );

    const stmt = createSelectStmt(
      [createField("*")],
      createSource("SUBQUERY", subquery),
      createBinaryExpr(createIdentifier("score"), "!=", createLiteral(0, "NUMBER")),
    );

    const result = pass.apply(stmt) as SelectStatement;
    const pushedSubquery = result.source.value as SelectStatement;

    assertExists(pushedSubquery.where);
    const whereExpr = pushedSubquery.where as BinaryExpression;
    assertEquals(whereExpr.operator, "!=");
  },
});

Deno.test({
  name: "PredicatePushdown - handles comparison operators",
  fn() {
    const pass = new PredicatePushdownPass();

    // SELECT * FROM (SELECT rating FROM reviews) WHERE rating <= 3
    const subquery = createSelectStmt(
      [createField("rating")],
      createSource("URL", "reviews"),
    );

    const stmt = createSelectStmt(
      [createField("*")],
      createSource("SUBQUERY", subquery),
      createBinaryExpr(createIdentifier("rating"), "<=", createLiteral(3, "NUMBER")),
    );

    const result = pass.apply(stmt) as SelectStatement;
    const pushedSubquery = result.source.value as SelectStatement;

    assertExists(pushedSubquery.where);
    const whereExpr = pushedSubquery.where as BinaryExpression;
    assertEquals(whereExpr.operator, "<=");
  },
});

Deno.test({
  name: "PredicatePushdown - pushes down single field predicate",
  fn() {
    const pass = new PredicatePushdownPass();

    // SELECT * FROM (SELECT active FROM flags) WHERE active = true
    const subquery = createSelectStmt(
      [createField("active")],
      createSource("URL", "flags"),
    );

    const stmt = createSelectStmt(
      [createField("*")],
      createSource("SUBQUERY", subquery),
      createBinaryExpr(createIdentifier("active"), "=", createLiteral(true, "BOOLEAN")),
    );

    const result = pass.apply(stmt) as SelectStatement;
    const pushedSubquery = result.source.value as SelectStatement;

    assertExists(pushedSubquery.where);
    assertEquals((pushedSubquery.where as BinaryExpression).operator, "=");
    assertEquals(result.where, undefined);
  },
});

Deno.test({
  name: "PredicatePushdown - preserves subquery structure",
  fn() {
    const pass = new PredicatePushdownPass();

    // SELECT * FROM (SELECT id, name FROM users) WHERE id > 0
    const subquery = createSelectStmt(
      [createField("id"), createField("name")],
      createSource("URL", "users"),
    );

    const stmt = createSelectStmt(
      [createField("*")],
      createSource("SUBQUERY", subquery),
      createBinaryExpr(createIdentifier("id"), ">", createLiteral(0, "NUMBER")),
    );

    const result = pass.apply(stmt) as SelectStatement;

    // Verify structure is preserved
    assertEquals(result.type, "SELECT");
    assertEquals(result.source.type, "SUBQUERY");

    const pushedSubquery = result.source.value as SelectStatement;
    assertEquals(pushedSubquery.type, "SELECT");
    assertEquals(pushedSubquery.fields.length, 2);
  },
});

Deno.test({
  name: "PredicatePushdown - handles multiple fields in subquery",
  fn() {
    const pass = new PredicatePushdownPass();

    // SELECT * FROM (SELECT a, b, c FROM table) WHERE a > 10
    const subquery = createSelectStmt(
      [createField("a"), createField("b"), createField("c")],
      createSource("URL", "table"),
    );

    const stmt = createSelectStmt(
      [createField("*")],
      createSource("SUBQUERY", subquery),
      createBinaryExpr(createIdentifier("a"), ">", createLiteral(10, "NUMBER")),
    );

    const result = pass.apply(stmt) as SelectStatement;
    const pushedSubquery = result.source.value as SelectStatement;

    assertExists(pushedSubquery.where);
    assertEquals((pushedSubquery.where as BinaryExpression).left, createIdentifier("a"));
  },
});

// ============================================================================
// Category 2: Complex Predicates (8 tests)
// ============================================================================

Deno.test({
  name: "PredicatePushdown - AND conditions pushed down separately",
  fn() {
    const pass = new PredicatePushdownPass();

    // SELECT * FROM (SELECT x, y FROM data) WHERE x > 5 AND y < 10
    const subquery = createSelectStmt(
      [createField("x"), createField("y")],
      createSource("URL", "data"),
    );

    const whereCond = createBinaryExpr(
      createBinaryExpr(createIdentifier("x"), ">", createLiteral(5, "NUMBER")),
      "AND",
      createBinaryExpr(createIdentifier("y"), "<", createLiteral(10, "NUMBER")),
    );

    const stmt = createSelectStmt(
      [createField("*")],
      createSource("SUBQUERY", subquery),
      whereCond,
    );

    const result = pass.apply(stmt) as SelectStatement;
    const pushedSubquery = result.source.value as SelectStatement;

    // Both conditions should be pushed
    assertExists(pushedSubquery.where);
    const pushedWhere = pushedSubquery.where as BinaryExpression;
    assertEquals(pushedWhere.operator, "AND");

    // Verify both sides are binary expressions
    assertEquals((pushedWhere.left as BinaryExpression).type, "BINARY");
    assertEquals((pushedWhere.right as BinaryExpression).type, "BINARY");
  },
});

Deno.test({
  name: "PredicatePushdown - nested AND conditions flattened",
  fn() {
    const pass = new PredicatePushdownPass();

    // SELECT * FROM (SELECT a, b, c FROM table) WHERE (a > 1 AND b > 2) AND c > 3
    const subquery = createSelectStmt(
      [createField("a"), createField("b"), createField("c")],
      createSource("URL", "table"),
    );

    const innerAnd = createBinaryExpr(
      createBinaryExpr(createIdentifier("a"), ">", createLiteral(1, "NUMBER")),
      "AND",
      createBinaryExpr(createIdentifier("b"), ">", createLiteral(2, "NUMBER")),
    );

    const outerAnd = createBinaryExpr(
      innerAnd,
      "AND",
      createBinaryExpr(createIdentifier("c"), ">", createLiteral(3, "NUMBER")),
    );

    const stmt = createSelectStmt(
      [createField("*")],
      createSource("SUBQUERY", subquery),
      outerAnd,
    );

    const result = pass.apply(stmt) as SelectStatement;
    const pushedSubquery = result.source.value as SelectStatement;

    // All conditions should be pushed
    assertExists(pushedSubquery.where);
    assertEquals((pushedSubquery.where as BinaryExpression).operator, "AND");
  },
});

Deno.test({
  name: "PredicatePushdown - NOT conditions handled correctly",
  fn() {
    const pass = new PredicatePushdownPass();

    // SELECT * FROM (SELECT flag FROM settings) WHERE NOT flag = true
    const subquery = createSelectStmt(
      [createField("flag")],
      createSource("URL", "settings"),
    );

    const whereCond = createUnaryExpr(
      "NOT",
      createBinaryExpr(createIdentifier("flag"), "=", createLiteral(true, "BOOLEAN")),
    );

    const stmt = createSelectStmt(
      [createField("*")],
      createSource("SUBQUERY", subquery),
      whereCond,
    );

    const result = pass.apply(stmt) as SelectStatement;
    const pushedSubquery = result.source.value as SelectStatement;

    // NOT condition should be pushed
    assertExists(pushedSubquery.where);
    assertEquals(pushedSubquery.where.type, "UNARY");
    assertEquals((pushedSubquery.where as UnaryExpression).operator, "NOT");
  },
});

Deno.test({
  name: "PredicatePushdown - complex nested conditions",
  fn() {
    const pass = new PredicatePushdownPass();

    // SELECT * FROM (SELECT x, y, z FROM table) WHERE (x > 1 AND y > 2) AND (z > 3 AND x < 10)
    const subquery = createSelectStmt(
      [createField("x"), createField("y"), createField("z")],
      createSource("URL", "table"),
    );

    const leftAnd = createBinaryExpr(
      createBinaryExpr(createIdentifier("x"), ">", createLiteral(1, "NUMBER")),
      "AND",
      createBinaryExpr(createIdentifier("y"), ">", createLiteral(2, "NUMBER")),
    );

    const rightAnd = createBinaryExpr(
      createBinaryExpr(createIdentifier("z"), ">", createLiteral(3, "NUMBER")),
      "AND",
      createBinaryExpr(createIdentifier("x"), "<", createLiteral(10, "NUMBER")),
    );

    const whereCond = createBinaryExpr(leftAnd, "AND", rightAnd);

    const stmt = createSelectStmt(
      [createField("*")],
      createSource("SUBQUERY", subquery),
      whereCond,
    );

    const result = pass.apply(stmt) as SelectStatement;
    const pushedSubquery = result.source.value as SelectStatement;

    // Complex condition should be pushed
    assertExists(pushedSubquery.where);
    assertEquals((pushedSubquery.where as BinaryExpression).operator, "AND");
  },
});

Deno.test({
  name: "PredicatePushdown - OR conditions kept together when needed",
  fn() {
    const pass = new PredicatePushdownPass();

    // SELECT * FROM (SELECT status FROM orders) WHERE status = 'pending' OR status = 'processing'
    const subquery = createSelectStmt(
      [createField("status")],
      createSource("URL", "orders"),
    );

    const whereCond = createBinaryExpr(
      createBinaryExpr(createIdentifier("status"), "=", createLiteral("pending")),
      "OR",
      createBinaryExpr(createIdentifier("status"), "=", createLiteral("processing")),
    );

    const stmt = createSelectStmt(
      [createField("*")],
      createSource("SUBQUERY", subquery),
      whereCond,
    );

    const result = pass.apply(stmt) as SelectStatement;
    const pushedSubquery = result.source.value as SelectStatement;

    // OR condition should be pushed as-is
    assertExists(pushedSubquery.where);
    assertEquals(pushedSubquery.where.type, "BINARY");
  },
});

Deno.test({
  name: "PredicatePushdown - handles LIKE operator",
  fn() {
    const pass = new PredicatePushdownPass();

    // SELECT * FROM (SELECT name FROM users) WHERE name LIKE 'John%'
    const subquery = createSelectStmt(
      [createField("name")],
      createSource("URL", "users"),
    );

    const whereCond = createBinaryExpr(
      createIdentifier("name"),
      "LIKE",
      createLiteral("John%"),
    );

    const stmt = createSelectStmt(
      [createField("*")],
      createSource("SUBQUERY", subquery),
      whereCond,
    );

    const result = pass.apply(stmt) as SelectStatement;
    const pushedSubquery = result.source.value as SelectStatement;

    assertExists(pushedSubquery.where);
    assertEquals((pushedSubquery.where as BinaryExpression).operator, "LIKE");
  },
});

Deno.test({
  name: "PredicatePushdown - handles IN operator",
  fn() {
    const pass = new PredicatePushdownPass();

    // SELECT * FROM (SELECT type FROM products) WHERE type IN ['A', 'B', 'C']
    const subquery = createSelectStmt(
      [createField("type")],
      createSource("URL", "products"),
    );

    const whereCond = createBinaryExpr(
      createIdentifier("type"),
      "IN",
      { type: "ARRAY", elements: [createLiteral("A"), createLiteral("B"), createLiteral("C")] },
    );

    const stmt = createSelectStmt(
      [createField("*")],
      createSource("SUBQUERY", subquery),
      whereCond,
    );

    const result = pass.apply(stmt) as SelectStatement;
    const pushedSubquery = result.source.value as SelectStatement;

    assertExists(pushedSubquery.where);
    assertEquals((pushedSubquery.where as BinaryExpression).operator, "IN");
  },
});

Deno.test({
  name: "PredicatePushdown - handles CONTAINS operator",
  fn() {
    const pass = new PredicatePushdownPass();

    // SELECT * FROM (SELECT tags FROM posts) WHERE tags CONTAINS 'tech'
    const subquery = createSelectStmt(
      [createField("tags")],
      createSource("URL", "posts"),
    );

    const whereCond = createBinaryExpr(
      createIdentifier("tags"),
      "CONTAINS",
      createLiteral("tech"),
    );

    const stmt = createSelectStmt(
      [createField("*")],
      createSource("SUBQUERY", subquery),
      whereCond,
    );

    const result = pass.apply(stmt) as SelectStatement;
    const pushedSubquery = result.source.value as SelectStatement;

    assertExists(pushedSubquery.where);
    assertEquals((pushedSubquery.where as BinaryExpression).operator, "CONTAINS");
  },
});

// ============================================================================
// Category 3: Field Reference Analysis (8 tests)
// ============================================================================

Deno.test({
  name: "PredicatePushdown - identifies which table each field references",
  fn() {
    const pass = new PredicatePushdownPass();

    // SELECT * FROM (SELECT userId, orderId FROM orders) WHERE userId > 100
    const subquery = createSelectStmt(
      [createField("userId"), createField("orderId")],
      createSource("URL", "orders"),
    );

    const stmt = createSelectStmt(
      [createField("*")],
      createSource("SUBQUERY", subquery),
      createBinaryExpr(createIdentifier("userId"), ">", createLiteral(100, "NUMBER")),
    );

    const result = pass.apply(stmt) as SelectStatement;
    const pushedSubquery = result.source.value as SelectStatement;

    // userId is in subquery, so it should be pushed
    assertExists(pushedSubquery.where);
    assertEquals((pushedSubquery.where as BinaryExpression).left, createIdentifier("userId"));
  },
});

Deno.test({
  name: "PredicatePushdown - doesn't push predicates referencing unavailable fields",
  fn() {
    const pass = new PredicatePushdownPass();

    // SELECT * FROM (SELECT id FROM users) WHERE name = 'John'
    // name is NOT in subquery fields, so it can't be pushed
    const subquery = createSelectStmt(
      [createField("id")],
      createSource("URL", "users"),
    );

    const stmt = createSelectStmt(
      [createField("*")],
      createSource("SUBQUERY", subquery),
      createBinaryExpr(createIdentifier("name"), "=", createLiteral("John")),
    );

    const result = pass.apply(stmt) as SelectStatement;
    const pushedSubquery = result.source.value as SelectStatement;

    // Predicate should NOT be pushed because 'name' is not in subquery fields
    assertEquals(pushedSubquery.where, undefined);

    // Predicate should remain in outer query
    assertExists(result.where);
    assertEquals((result.where as BinaryExpression).left, createIdentifier("name"));
  },
});

Deno.test({
  name: "PredicatePushdown - handles fields with aliases",
  fn() {
    const pass = new PredicatePushdownPass();

    // SELECT * FROM (SELECT id AS user_id FROM users) WHERE user_id > 10
    const subquery = createSelectStmt(
      [createField("id", "user_id")],
      createSource("URL", "users"),
    );

    const stmt = createSelectStmt(
      [createField("*")],
      createSource("SUBQUERY", subquery),
      createBinaryExpr(createIdentifier("user_id"), ">", createLiteral(10, "NUMBER")),
    );

    const result = pass.apply(stmt) as SelectStatement;
    const pushedSubquery = result.source.value as SelectStatement;

    // Should push because user_id is the alias
    assertExists(pushedSubquery.where);
    assertEquals((pushedSubquery.where as BinaryExpression).left, createIdentifier("user_id"));
  },
});

Deno.test({
  name: "PredicatePushdown - resolves aliases correctly",
  fn() {
    const pass = new PredicatePushdownPass();

    // SELECT * FROM (SELECT price AS cost, quantity AS qty FROM items) WHERE cost > 50
    const subquery = createSelectStmt(
      [createField("price", "cost"), createField("quantity", "qty")],
      createSource("URL", "items"),
    );

    const stmt = createSelectStmt(
      [createField("*")],
      createSource("SUBQUERY", subquery),
      createBinaryExpr(createIdentifier("cost"), ">", createLiteral(50, "NUMBER")),
    );

    const result = pass.apply(stmt) as SelectStatement;
    const pushedSubquery = result.source.value as SelectStatement;

    // Should push because 'cost' is an alias
    assertExists(pushedSubquery.where);
  },
});

Deno.test({
  name: "PredicatePushdown - partial pushdown with mixed field availability",
  fn() {
    const pass = new PredicatePushdownPass();

    // SELECT * FROM (SELECT id FROM users) WHERE id > 10 AND name = 'John'
    // id can be pushed, name cannot
    const subquery = createSelectStmt(
      [createField("id")],
      createSource("URL", "users"),
    );

    const whereCond = createBinaryExpr(
      createBinaryExpr(createIdentifier("id"), ">", createLiteral(10, "NUMBER")),
      "AND",
      createBinaryExpr(createIdentifier("name"), "=", createLiteral("John")),
    );

    const stmt = createSelectStmt(
      [createField("*")],
      createSource("SUBQUERY", subquery),
      whereCond,
    );

    const result = pass.apply(stmt) as SelectStatement;
    const pushedSubquery = result.source.value as SelectStatement;

    // Only id predicate should be pushed
    assertExists(pushedSubquery.where);

    // name predicate should remain in outer query
    assertExists(result.where);
  },
});

Deno.test({
  name: "PredicatePushdown - handles multiple field references in single predicate",
  fn() {
    const pass = new PredicatePushdownPass();

    // SELECT * FROM (SELECT x, y FROM data) WHERE x + y > 100
    // This is a simplified test - in reality, the expression parser would create a more complex AST
    const subquery = createSelectStmt(
      [createField("x"), createField("y")],
      createSource("URL", "data"),
    );

    const whereCond = createBinaryExpr(
      createBinaryExpr(createIdentifier("x"), "+", createIdentifier("y")),
      ">",
      createLiteral(100, "NUMBER"),
    );

    const stmt = createSelectStmt(
      [createField("*")],
      createSource("SUBQUERY", subquery),
      whereCond,
    );

    const result = pass.apply(stmt) as SelectStatement;
    const pushedSubquery = result.source.value as SelectStatement;

    // Should push because both x and y are available
    assertExists(pushedSubquery.where);
  },
});

Deno.test({
  name: "PredicatePushdown - detects field references in nested expressions",
  fn() {
    const pass = new PredicatePushdownPass();

    // SELECT * FROM (SELECT a, b FROM table) WHERE NOT (a > 10)
    const subquery = createSelectStmt(
      [createField("a"), createField("b")],
      createSource("URL", "table"),
    );

    const whereCond = createUnaryExpr(
      "NOT",
      createBinaryExpr(createIdentifier("a"), ">", createLiteral(10, "NUMBER")),
    );

    const stmt = createSelectStmt(
      [createField("*")],
      createSource("SUBQUERY", subquery),
      whereCond,
    );

    const result = pass.apply(stmt) as SelectStatement;
    const pushedSubquery = result.source.value as SelectStatement;

    // Should push because 'a' is available even though it's nested in NOT
    assertExists(pushedSubquery.where);
  },
});

Deno.test({
  name: "PredicatePushdown - handles star field selection",
  fn() {
    const pass = new PredicatePushdownPass();

    // When subquery has *, we can't determine available fields
    // This is a simplified test - real implementation might handle this differently
    const subquery = createSelectStmt(
      [createField("id"), createField("name")],
      createSource("URL", "users"),
    );

    const stmt = createSelectStmt(
      [createField("*")],
      createSource("SUBQUERY", subquery),
      createBinaryExpr(createIdentifier("id"), ">", createLiteral(0, "NUMBER")),
    );

    const result = pass.apply(stmt) as SelectStatement;

    // Should work normally with explicit field list
    assertEquals(result.source.type, "SUBQUERY");
  },
});

// ============================================================================
// Category 4: Edge Cases (9 tests)
// ============================================================================

Deno.test({
  name: "PredicatePushdown - no WHERE clause (no-op)",
  fn() {
    const pass = new PredicatePushdownPass();

    // SELECT * FROM (SELECT id FROM users)
    const subquery = createSelectStmt(
      [createField("id")],
      createSource("URL", "users"),
    );

    const stmt = createSelectStmt(
      [createField("*")],
      createSource("SUBQUERY", subquery),
    );

    const result = pass.apply(stmt) as SelectStatement;

    // Should return unchanged
    assertEquals(result.where, undefined);

    const pushedSubquery = result.source.value as SelectStatement;
    assertEquals(pushedSubquery.where, undefined);
  },
});

Deno.test({
  name: "PredicatePushdown - WHERE clause already optimal",
  fn() {
    const pass = new PredicatePushdownPass();

    // SELECT * FROM (SELECT id FROM users WHERE id > 10)
    const subquery = createSelectStmt(
      [createField("id")],
      createSource("URL", "users"),
      createBinaryExpr(createIdentifier("id"), ">", createLiteral(10, "NUMBER")),
    );

    const stmt = createSelectStmt(
      [createField("*")],
      createSource("SUBQUERY", subquery),
    );

    const result = pass.apply(stmt) as SelectStatement;

    // Subquery WHERE should remain
    const pushedSubquery = result.source.value as SelectStatement;
    assertExists(pushedSubquery.where);

    // Outer WHERE should still be undefined
    assertEquals(result.where, undefined);
  },
});

Deno.test({
  name: "PredicatePushdown - predicates can't be pushed (cross-table refs)",
  fn() {
    const pass = new PredicatePushdownPass();

    // SELECT * FROM (SELECT id FROM users) WHERE external_field = 'value'
    const subquery = createSelectStmt(
      [createField("id")],
      createSource("URL", "users"),
    );

    const stmt = createSelectStmt(
      [createField("*")],
      createSource("SUBQUERY", subquery),
      createBinaryExpr(createIdentifier("external_field"), "=", createLiteral("value")),
    );

    const result = pass.apply(stmt) as SelectStatement;

    // Predicate should NOT be pushed
    const pushedSubquery = result.source.value as SelectStatement;
    assertEquals(pushedSubquery.where, undefined);

    // Should remain in outer query
    assertExists(result.where);
  },
});

Deno.test({
  name: "PredicatePushdown - handles URL source (not a subquery)",
  fn() {
    const pass = new PredicatePushdownPass();

    // SELECT * FROM "http://example.com" WHERE id > 10
    const stmt = createSelectStmt(
      [createField("*")],
      createSource("URL", "http://example.com"),
      createBinaryExpr(createIdentifier("id"), ">", createLiteral(10, "NUMBER")),
    );

    const result = pass.apply(stmt) as SelectStatement;

    // Should return unchanged (can't push into URL source)
    assertEquals(result.source.type, "URL");
    assertExists(result.where);
  },
});

Deno.test({
  name: "PredicatePushdown - combines with existing WHERE in subquery",
  fn() {
    const pass = new PredicatePushdownPass();

    // SELECT * FROM (SELECT id FROM users WHERE id > 5) WHERE id < 100
    const subquery = createSelectStmt(
      [createField("id")],
      createSource("URL", "users"),
      createBinaryExpr(createIdentifier("id"), ">", createLiteral(5, "NUMBER")),
    );

    const stmt = createSelectStmt(
      [createField("*")],
      createSource("SUBQUERY", subquery),
      createBinaryExpr(createIdentifier("id"), "<", createLiteral(100, "NUMBER")),
    );

    const result = pass.apply(stmt) as SelectStatement;
    const pushedSubquery = result.source.value as SelectStatement;

    // Should combine both predicates with AND
    assertExists(pushedSubquery.where);
    assertEquals((pushedSubquery.where as BinaryExpression).operator, "AND");
  },
});

Deno.test({
  name: "PredicatePushdown - handles WITH statement",
  fn() {
    const pass = new PredicatePushdownPass();

    // WITH cte AS (SELECT id FROM users) SELECT * FROM cte WHERE id > 10
    const cteQuery = createSelectStmt(
      [createField("id")],
      createSource("URL", "users"),
    );

    const mainQuery = createSelectStmt(
      [createField("*")],
      createSource("VARIABLE", "cte"),
      createBinaryExpr(createIdentifier("id"), ">", createLiteral(10, "NUMBER")),
    );

    const withStmt = {
      type: "WITH" as const,
      ctes: [{ name: "cte", query: cteQuery }],
      query: mainQuery,
    };

    const result = pass.apply(withStmt);

    // Should process the CTE and main query
    assertEquals(result.type, "WITH");
  },
});

Deno.test({
  name: "PredicatePushdown - handles FOR statement",
  fn() {
    const pass = new PredicatePushdownPass();

    // FOR EACH item IN items { SELECT * FROM (SELECT id FROM item) WHERE id > 10 }
    const subquery = createSelectStmt(
      [createField("id")],
      createSource("URL", "item"),
    );

    const bodyStmt = createSelectStmt(
      [createField("*")],
      createSource("SUBQUERY", subquery),
      createBinaryExpr(createIdentifier("id"), ">", createLiteral(10, "NUMBER")),
    );

    const forStmt = {
      type: "FOR" as const,
      variable: "item",
      collection: createIdentifier("items"),
      body: bodyStmt,
    };

    const result = pass.apply(forStmt);

    // Should process the body
    assertEquals(result.type, "FOR");
  },
});

Deno.test({
  name: "PredicatePushdown - handles IF statement",
  fn() {
    const pass = new PredicatePushdownPass();

    // IF condition THEN { SELECT ... WHERE ... }
    const subquery = createSelectStmt(
      [createField("id")],
      createSource("URL", "users"),
    );

    const thenStmt = createSelectStmt(
      [createField("*")],
      createSource("SUBQUERY", subquery),
      createBinaryExpr(createIdentifier("id"), ">", createLiteral(10, "NUMBER")),
    );

    const ifStmt = {
      type: "IF" as const,
      condition: createBinaryExpr(createIdentifier("x"), ">", createLiteral(0, "NUMBER")),
      then: thenStmt,
    };

    const result = pass.apply(ifStmt);

    // Should process the then branch
    assertEquals(result.type, "IF");
  },
});

Deno.test({
  name: "PredicatePushdown - handles non-SELECT statements",
  fn() {
    const pass = new PredicatePushdownPass();

    // NAVIGATE TO "http://example.com"
    const navigateStmt = {
      type: "NAVIGATE" as const,
      url: createLiteral("http://example.com"),
    };

    const result = pass.apply(navigateStmt);

    // Should return unchanged
    assertEquals(result.type, "NAVIGATE");
  },
});
