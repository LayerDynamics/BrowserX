/**
 * Test Fixtures for Query Engine Tests
 * Provides sample queries, AST nodes, and test data
 */

/**
 * Sample query strings for testing
 */
export const SAMPLE_QUERIES = {
  // SELECT statements
  simple_select: "SELECT * FROM http://example.com",
  select_with_fields: "SELECT title, price, description FROM products",
  select_with_where: "SELECT * FROM users WHERE age > 18",
  select_with_order: "SELECT * FROM posts ORDER BY created_at DESC",
  select_with_limit: "SELECT * FROM items LIMIT 10",
  select_with_offset: "SELECT * FROM data LIMIT 10 OFFSET 20",
  select_with_alias: "SELECT name AS user_name, email AS contact FROM users",

  // NAVIGATE statements
  simple_navigate: "NAVIGATE TO 'http://example.com'",
  navigate_with_options: "NAVIGATE TO 'http://example.com' WITH { timeout: 5000, waitFor: 'load' }",
  navigate_with_capture: "NAVIGATE TO url CAPTURE { title: TEXT('h1'), links: COUNT('a') }",

  // Control flow
  for_each_loop: "FOR EACH item IN items { SHOW item.name }",
  if_statement: "IF x > 10 THEN { SHOW 'large' } ELSE { SHOW 'small' }",
  nested_if: "IF x > 10 THEN { IF y > 5 THEN { SHOW 'both' } }",

  // WITH statements (CTEs)
  simple_with: "WITH users AS (SELECT * FROM http://api.com/users) SELECT * FROM users",
  multiple_ctes: "WITH a AS (SELECT * FROM x), b AS (SELECT * FROM y) SELECT * FROM a",

  // Complex queries
  subquery: "SELECT * FROM (SELECT * FROM users WHERE active = true) WHERE age > 18",
  join_like: "SELECT * FROM users WHERE id IN (SELECT user_id FROM orders)",

  // Functions
  with_functions: "SELECT UPPER(name), LENGTH(description) FROM products",
  nested_functions: "SELECT SUBSTRING(TRIM(title), 0, 10) FROM articles",

  // Binary expressions
  arithmetic: "SELECT price * quantity AS total FROM items",
  logical: "SELECT * FROM users WHERE age > 18 AND status = 'active'",
  comparison: "SELECT * FROM products WHERE price >= 100 AND price <= 500",
  string_ops: "SELECT * FROM articles WHERE title LIKE '%tutorial%'",

  // SET statements
  set_variable: "SET result = SELECT * FROM users",
  set_scalar: "SET count = 42",
  set_object: "SET config = { timeout: 5000, retries: 3 }",
  set_array: "SET items = [1, 2, 3, 4, 5]",
};

/**
 * Sample tokens for testing
 */
export const SAMPLE_TOKENS = {
  keywords: ["SELECT", "FROM", "WHERE", "ORDER", "BY", "LIMIT", "NAVIGATE", "TO", "FOR", "EACH"],
  operators: ["=", "!=", ">", "<", ">=", "<=", "+", "-", "*", "/", "%"],
  punctuation: ["(", ")", "{", "}", "[", "]", ",", ".", ";"],
  identifiers: ["name", "age", "user_id", "created_at", "isActive"],
  strings: ["'hello'", '"world"', "'test string'", '"escaped \\"quotes\\""'],
  numbers: ["0", "42", "3.14", "-10", "1e5", "1.5e-3"],
  booleans: ["true", "false"],
  null: ["null"],
};

/**
 * Sample URLs for testing
 */
export const SAMPLE_URLS = {
  simple: "http://example.com",
  with_path: "http://api.example.com/v1/users",
  with_query: "http://example.com/search?q=test&page=1",
  with_fragment: "http://example.com/docs#section-2",
  https: "https://secure.example.com",
  localhost: "http://localhost:3000",
  with_port: "http://example.com:8080",
};

/**
 * Sample CSS selectors for testing
 */
export const SAMPLE_SELECTORS = {
  element: "div",
  class: ".container",
  id: "#main",
  attribute: "[data-id='123']",
  pseudo: "a:hover",
  descendant: "div p",
  child: "ul > li",
  adjacent: "h1 + p",
  complex: "div.container > ul.items > li:first-child",
};

/**
 * Sample XPath expressions for testing
 */
export const SAMPLE_XPATHS = {
  simple: "//div",
  with_attribute: "//div[@class='container']",
  with_text: "//a[text()='Click here']",
  descendant: "//div//p",
  position: "//li[1]",
  complex: "//div[@id='main']//ul[@class='items']/li[position() <= 3]",
};

/**
 * Sample DOM structures for testing
 */
export const SAMPLE_DOM = {
  simple: {
    tagName: "div",
    attributes: { id: "container", class: "main" },
    children: [
      { tagName: "h1", text: "Title" },
      { tagName: "p", text: "Paragraph" },
    ],
  },

  nested: {
    tagName: "html",
    children: [
      {
        tagName: "body",
        children: [
          {
            tagName: "div",
            attributes: { class: "container" },
            children: [
              { tagName: "h1", text: "Welcome" },
              {
                tagName: "ul",
                children: [
                  { tagName: "li", text: "Item 1" },
                  { tagName: "li", text: "Item 2" },
                  { tagName: "li", text: "Item 3" },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
};

/**
 * Sample data for testing execution
 */
export const SAMPLE_DATA = {
  users: [
    { id: 1, name: "Alice", age: 25, active: true },
    { id: 2, name: "Bob", age: 30, active: true },
    { id: 3, name: "Charlie", age: 35, active: false },
    { id: 4, name: "Diana", age: 28, active: true },
  ],

  products: [
    { id: 1, name: "Laptop", price: 999, category: "electronics" },
    { id: 2, name: "Mouse", price: 25, category: "electronics" },
    { id: 3, name: "Desk", price: 299, category: "furniture" },
    { id: 4, name: "Chair", price: 199, category: "furniture" },
  ],

  posts: [
    { id: 1, title: "First Post", author: "Alice", views: 100 },
    { id: 2, title: "Second Post", author: "Bob", views: 250 },
    { id: 3, title: "Third Post", author: "Alice", views: 180 },
  ],
};

/**
 * Sample expressions for testing
 */
export const SAMPLE_EXPRESSIONS = {
  literals: {
    string: "'hello world'",
    number: "42",
    boolean: "true",
    null: "null",
  },

  identifiers: {
    simple: "name",
    with_underscore: "user_id",
    camelCase: "firstName",
  },

  binary: {
    arithmetic: "10 + 20",
    comparison: "age > 18",
    logical: "active AND verified",
    string_concat: "first_name || ' ' || last_name",
  },

  unary: {
    negation: "-42",
    not: "NOT active",
  },

  member: {
    dot: "user.name",
    nested: "user.address.city",
  },

  call: {
    no_args: "NOW()",
    one_arg: "UPPER(name)",
    multiple_args: "SUBSTRING(text, 0, 10)",
  },

  array: {
    empty: "[]",
    simple: "[1, 2, 3]",
    mixed: "[1, 'two', true, null]",
    nested: "[[1, 2], [3, 4]]",
  },

  object: {
    empty: "{}",
    simple: "{ name: 'Alice', age: 25 }",
    nested: "{ user: { name: 'Alice' }, settings: { theme: 'dark' } }",
  },
};

/**
 * Sample function names and signatures
 */
export const SAMPLE_FUNCTIONS = {
  string: ["UPPER", "LOWER", "TRIM", "SUBSTRING", "LENGTH", "CONCAT"],
  numeric: ["ABS", "ROUND", "CEIL", "FLOOR", "MOD", "POW"],
  date: ["NOW", "DATE", "TIMESTAMP", "YEAR", "MONTH", "DAY"],
  aggregate: ["COUNT", "SUM", "AVG", "MIN", "MAX"],
  dom: ["TEXT", "HTML", "ATTR", "EXISTS"],
  utility: ["SCREENSHOT", "PDF", "WAIT"],
};

/**
 * Sample error messages for testing
 */
export const ERROR_MESSAGES = {
  syntax: "Unexpected token",
  semantic: "Undefined variable",
  type: "Type mismatch",
  runtime: "Division by zero",
  network: "Failed to fetch",
  timeout: "Request timeout",
};

/**
 * Sample optimization scenarios
 */
export const OPTIMIZATION_SCENARIOS = {
  constant_folding: {
    before: "SELECT 1 + 2 + 3 FROM users",
    after: "SELECT 6 FROM users",
  },

  predicate_pushdown: {
    before: "SELECT * FROM (SELECT * FROM users) WHERE age > 18",
    after: "SELECT * FROM users WHERE age > 18",
  },

  dead_code: {
    before: "IF false THEN { SELECT * FROM users }",
    after: "-- removed",
  },
};

/**
 * Sample execution plans for testing
 */
export const SAMPLE_PLANS = {
  simple_navigate: {
    steps: [
      { id: "step-1", type: "navigate", url: "http://example.com" },
    ],
  },

  navigate_and_query: {
    steps: [
      { id: "step-1", type: "navigate", url: "http://example.com" },
      { id: "step-2", type: "dom_query", selector: "h1", dependencies: ["step-1"] },
    ],
  },

  with_filter: {
    steps: [
      { id: "step-1", type: "fetch", url: "http://api.example.com/users" },
      { id: "step-2", type: "filter", condition: "age > 18", dependencies: ["step-1"] },
      { id: "step-3", type: "sort", field: "name", dependencies: ["step-2"] },
    ],
  },
};

/**
 * Helper to create test data
 */
export function createTestUser(overrides?: Partial<any>) {
  return {
    id: Math.floor(Math.random() * 10000),
    name: "Test User",
    email: "test@example.com",
    age: 25,
    active: true,
    ...overrides,
  };
}

/**
 * Helper to create test product
 */
export function createTestProduct(overrides?: Partial<any>) {
  return {
    id: Math.floor(Math.random() * 10000),
    name: "Test Product",
    price: 99.99,
    category: "test",
    inStock: true,
    ...overrides,
  };
}

/**
 * Helper to generate random data
 */
export function generateUsers(count: number): any[] {
  return Array.from({ length: count }, (_, i) =>
    createTestUser({ id: i + 1, name: `User ${i + 1}`, age: 20 + (i % 30) })
  );
}

/**
 * Helper to generate random products
 */
export function generateProducts(count: number): any[] {
  return Array.from({ length: count }, (_, i) =>
    createTestProduct({
      id: i + 1,
      name: `Product ${i + 1}`,
      price: (i + 1) * 10,
    })
  );
}
