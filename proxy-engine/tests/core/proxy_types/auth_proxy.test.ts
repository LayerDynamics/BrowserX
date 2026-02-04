/**
 * AuthProxy Tests
 * Comprehensive tests for authentication and authorization proxy
 */

import { assertEquals, assertExists, assert, assertRejects } from "@std/assert";
import {
  AuthProxy,
  InMemoryUserValidator,
  type AuthMethod,
  type User,
  type AccessRule,
  type UserValidator,
  type AuthProxyConfig,
  type AuthProxyStats,
  type AuditLogEntry,
} from "../../../core/proxy_types/auth_proxy.ts";
import type { Route } from "../../../gateway/router/request_router.ts";

// ============================================================================
// AuthMethod Type Tests
// ============================================================================

Deno.test({
  name: "AuthMethod - includes api-key",
  fn() {
    const method: AuthMethod = "api-key";
    assertEquals(method, "api-key");
  },
});

Deno.test({
  name: "AuthMethod - includes basic",
  fn() {
    const method: AuthMethod = "basic";
    assertEquals(method, "basic");
  },
});

Deno.test({
  name: "AuthMethod - includes bearer",
  fn() {
    const method: AuthMethod = "bearer";
    assertEquals(method, "bearer");
  },
});

Deno.test({
  name: "AuthMethod - includes jwt",
  fn() {
    const method: AuthMethod = "jwt";
    assertEquals(method, "jwt");
  },
});

// ============================================================================
// User Interface Tests
// ============================================================================

Deno.test({
  name: "User - contains required id field",
  fn() {
    const user: User = {
      id: "user-123",
      username: "testuser",
      roles: [],
    };

    assertEquals(user.id, "user-123");
  },
});

Deno.test({
  name: "User - contains required username field",
  fn() {
    const user: User = {
      id: "user-123",
      username: "alice",
      roles: [],
    };

    assertEquals(user.username, "alice");
  },
});

Deno.test({
  name: "User - contains required roles array",
  fn() {
    const user: User = {
      id: "user-123",
      username: "alice",
      roles: ["admin", "user"],
    };

    assertEquals(user.roles.length, 2);
    assertEquals(user.roles[0], "admin");
    assertEquals(user.roles[1], "user");
  },
});

Deno.test({
  name: "User - supports empty roles array",
  fn() {
    const user: User = {
      id: "user-123",
      username: "guest",
      roles: [],
    };

    assertEquals(user.roles.length, 0);
  },
});

Deno.test({
  name: "User - supports optional metadata",
  fn() {
    const user: User = {
      id: "user-123",
      username: "alice",
      roles: ["user"],
      metadata: {
        email: "alice@example.com",
        department: "Engineering",
        active: true,
      },
    };

    assertExists(user.metadata);
    assertEquals(user.metadata!.email, "alice@example.com");
    assertEquals(user.metadata!.department, "Engineering");
    assertEquals(user.metadata!.active, true);
  },
});

Deno.test({
  name: "User - metadata is optional",
  fn() {
    const user: User = {
      id: "user-123",
      username: "alice",
      roles: ["user"],
    };

    assertEquals(user.metadata, undefined);
  },
});

// ============================================================================
// AccessRule Interface Tests
// ============================================================================

Deno.test({
  name: "AccessRule - contains pathPattern regex",
  fn() {
    const rule: AccessRule = {
      pathPattern: /^\/api\/.*/,
      methods: ["GET"],
      requiredRoles: ["user"],
    };

    assertEquals(rule.pathPattern.test("/api/users"), true);
    assertEquals(rule.pathPattern.test("/api/products"), true);
    assertEquals(rule.pathPattern.test("/web/page"), false);
  },
});

Deno.test({
  name: "AccessRule - contains methods array",
  fn() {
    const rule: AccessRule = {
      pathPattern: /^\/api\/.*/,
      methods: ["GET", "POST", "PUT"],
      requiredRoles: ["user"],
    };

    assertEquals(rule.methods.length, 3);
    assert(rule.methods.includes("GET"));
    assert(rule.methods.includes("POST"));
    assert(rule.methods.includes("PUT"));
  },
});

Deno.test({
  name: "AccessRule - supports wildcard method",
  fn() {
    const rule: AccessRule = {
      pathPattern: /^\/api\/.*/,
      methods: ["*"],
      requiredRoles: ["admin"],
    };

    assert(rule.methods.includes("*"));
  },
});

Deno.test({
  name: "AccessRule - contains requiredRoles array",
  fn() {
    const rule: AccessRule = {
      pathPattern: /^\/admin\/.*/,
      methods: ["*"],
      requiredRoles: ["admin", "superuser"],
    };

    assertEquals(rule.requiredRoles.length, 2);
    assert(rule.requiredRoles.includes("admin"));
    assert(rule.requiredRoles.includes("superuser"));
  },
});

Deno.test({
  name: "AccessRule - supports public flag",
  fn() {
    const rule: AccessRule = {
      pathPattern: /^\/public\/.*/,
      methods: ["GET"],
      requiredRoles: [],
      public: true,
    };

    assertEquals(rule.public, true);
  },
});

Deno.test({
  name: "AccessRule - public flag defaults to undefined",
  fn() {
    const rule: AccessRule = {
      pathPattern: /^\/api\/.*/,
      methods: ["GET"],
      requiredRoles: ["user"],
    };

    assertEquals(rule.public, undefined);
  },
});

// ============================================================================
// UserValidator Interface Tests
// ============================================================================

Deno.test({
  name: "UserValidator - supports validateApiKey method",
  fn() {
    const validator: UserValidator = {
      async validateApiKey(apiKey: string): Promise<User | null> {
        if (apiKey === "valid-key") {
          return { id: "1", username: "user", roles: [] };
        }
        return null;
      },
    };

    assertExists(validator.validateApiKey);
  },
});

Deno.test({
  name: "UserValidator - supports validateBasicAuth method",
  fn() {
    const validator: UserValidator = {
      async validateBasicAuth(username: string, password: string): Promise<User | null> {
        if (username === "admin" && password === "secret") {
          return { id: "1", username: "admin", roles: ["admin"] };
        }
        return null;
      },
    };

    assertExists(validator.validateBasicAuth);
  },
});

Deno.test({
  name: "UserValidator - supports validateBearerToken method",
  fn() {
    const validator: UserValidator = {
      async validateBearerToken(token: string): Promise<User | null> {
        if (token === "valid-token") {
          return { id: "1", username: "user", roles: [] };
        }
        return null;
      },
    };

    assertExists(validator.validateBearerToken);
  },
});

Deno.test({
  name: "UserValidator - supports validateJWT method",
  fn() {
    const validator: UserValidator = {
      async validateJWT(token: string): Promise<User | null> {
        // Simplified JWT validation
        if (token.startsWith("eyJ")) {
          return { id: "1", username: "user", roles: [] };
        }
        return null;
      },
    };

    assertExists(validator.validateJWT);
  },
});

Deno.test({
  name: "UserValidator - all methods are optional",
  fn() {
    const emptyValidator: UserValidator = {};

    assertEquals(emptyValidator.validateApiKey, undefined);
    assertEquals(emptyValidator.validateBasicAuth, undefined);
    assertEquals(emptyValidator.validateBearerToken, undefined);
    assertEquals(emptyValidator.validateJWT, undefined);
  },
});

// ============================================================================
// AuthProxyConfig Interface Tests
// ============================================================================

Deno.test({
  name: "AuthProxyConfig - requires userValidator",
  fn() {
    const config: AuthProxyConfig = {
      userValidator: new InMemoryUserValidator(),
      accessRules: [],
    };

    assertExists(config.userValidator);
  },
});

Deno.test({
  name: "AuthProxyConfig - requires accessRules",
  fn() {
    const config: AuthProxyConfig = {
      userValidator: new InMemoryUserValidator(),
      accessRules: [
        {
          pathPattern: /^\/api\/.*/,
          methods: ["GET"],
          requiredRoles: ["user"],
        },
      ],
    };

    assertEquals(config.accessRules.length, 1);
  },
});

Deno.test({
  name: "AuthProxyConfig - supports authMethods option",
  fn() {
    const config: AuthProxyConfig = {
      userValidator: new InMemoryUserValidator(),
      accessRules: [],
      authMethods: ["api-key", "bearer", "jwt"],
    };

    assertEquals(config.authMethods!.length, 3);
  },
});

Deno.test({
  name: "AuthProxyConfig - supports enableAuditLog option",
  fn() {
    const config: AuthProxyConfig = {
      userValidator: new InMemoryUserValidator(),
      accessRules: [],
      enableAuditLog: true,
    };

    assertEquals(config.enableAuditLog, true);
  },
});

Deno.test({
  name: "AuthProxyConfig - supports addUserHeaders option",
  fn() {
    const config: AuthProxyConfig = {
      userValidator: new InMemoryUserValidator(),
      accessRules: [],
      addUserHeaders: true,
    };

    assertEquals(config.addUserHeaders, true);
  },
});

Deno.test({
  name: "AuthProxyConfig - supports timeout option",
  fn() {
    const config: AuthProxyConfig = {
      userValidator: new InMemoryUserValidator(),
      accessRules: [],
      timeout: 60000,
    };

    assertEquals(config.timeout, 60000);
  },
});

Deno.test({
  name: "AuthProxyConfig - supports maxRetries option",
  fn() {
    const config: AuthProxyConfig = {
      userValidator: new InMemoryUserValidator(),
      accessRules: [],
      maxRetries: 5,
    };

    assertEquals(config.maxRetries, 5);
  },
});

Deno.test({
  name: "AuthProxyConfig - supports retryDelay option",
  fn() {
    const config: AuthProxyConfig = {
      userValidator: new InMemoryUserValidator(),
      accessRules: [],
      retryDelay: 2000,
    };

    assertEquals(config.retryDelay, 2000);
  },
});

// ============================================================================
// AuthProxyStats Interface Tests
// ============================================================================

Deno.test({
  name: "AuthProxyStats - contains totalRequests",
  fn() {
    const stats: AuthProxyStats = {
      totalRequests: 100,
      authenticatedRequests: 80,
      authenticationFailures: 10,
      authorizationDenials: 5,
      successfulForwards: 75,
      errors: 5,
    };

    assertEquals(stats.totalRequests, 100);
  },
});

Deno.test({
  name: "AuthProxyStats - contains authenticatedRequests",
  fn() {
    const stats: AuthProxyStats = {
      totalRequests: 100,
      authenticatedRequests: 80,
      authenticationFailures: 10,
      authorizationDenials: 5,
      successfulForwards: 75,
      errors: 5,
    };

    assertEquals(stats.authenticatedRequests, 80);
  },
});

Deno.test({
  name: "AuthProxyStats - contains authenticationFailures",
  fn() {
    const stats: AuthProxyStats = {
      totalRequests: 100,
      authenticatedRequests: 80,
      authenticationFailures: 10,
      authorizationDenials: 5,
      successfulForwards: 75,
      errors: 5,
    };

    assertEquals(stats.authenticationFailures, 10);
  },
});

Deno.test({
  name: "AuthProxyStats - contains authorizationDenials",
  fn() {
    const stats: AuthProxyStats = {
      totalRequests: 100,
      authenticatedRequests: 80,
      authenticationFailures: 10,
      authorizationDenials: 5,
      successfulForwards: 75,
      errors: 5,
    };

    assertEquals(stats.authorizationDenials, 5);
  },
});

Deno.test({
  name: "AuthProxyStats - contains successfulForwards",
  fn() {
    const stats: AuthProxyStats = {
      totalRequests: 100,
      authenticatedRequests: 80,
      authenticationFailures: 10,
      authorizationDenials: 5,
      successfulForwards: 75,
      errors: 5,
    };

    assertEquals(stats.successfulForwards, 75);
  },
});

Deno.test({
  name: "AuthProxyStats - contains errors",
  fn() {
    const stats: AuthProxyStats = {
      totalRequests: 100,
      authenticatedRequests: 80,
      authenticationFailures: 10,
      authorizationDenials: 5,
      successfulForwards: 75,
      errors: 5,
    };

    assertEquals(stats.errors, 5);
  },
});

Deno.test({
  name: "AuthProxyStats - zeroed stats",
  fn() {
    const stats: AuthProxyStats = {
      totalRequests: 0,
      authenticatedRequests: 0,
      authenticationFailures: 0,
      authorizationDenials: 0,
      successfulForwards: 0,
      errors: 0,
    };

    assertEquals(stats.totalRequests, 0);
    assertEquals(stats.authenticatedRequests, 0);
    assertEquals(stats.authenticationFailures, 0);
    assertEquals(stats.authorizationDenials, 0);
    assertEquals(stats.successfulForwards, 0);
    assertEquals(stats.errors, 0);
  },
});

// ============================================================================
// AuditLogEntry Interface Tests
// ============================================================================

Deno.test({
  name: "AuditLogEntry - contains timestamp",
  fn() {
    const now = Date.now();
    const entry: AuditLogEntry = {
      timestamp: now,
      clientIP: "192.168.1.1",
      method: "GET",
      path: "/api/users",
      authenticated: true,
      authorized: true,
      statusCode: 200,
    };

    assertEquals(entry.timestamp, now);
  },
});

Deno.test({
  name: "AuditLogEntry - contains clientIP",
  fn() {
    const entry: AuditLogEntry = {
      timestamp: Date.now(),
      clientIP: "10.0.0.1",
      method: "GET",
      path: "/api/users",
      authenticated: true,
      authorized: true,
      statusCode: 200,
    };

    assertEquals(entry.clientIP, "10.0.0.1");
  },
});

Deno.test({
  name: "AuditLogEntry - contains method",
  fn() {
    const entry: AuditLogEntry = {
      timestamp: Date.now(),
      clientIP: "192.168.1.1",
      method: "POST",
      path: "/api/users",
      authenticated: true,
      authorized: true,
      statusCode: 201,
    };

    assertEquals(entry.method, "POST");
  },
});

Deno.test({
  name: "AuditLogEntry - contains path",
  fn() {
    const entry: AuditLogEntry = {
      timestamp: Date.now(),
      clientIP: "192.168.1.1",
      method: "GET",
      path: "/api/products/123",
      authenticated: true,
      authorized: true,
      statusCode: 200,
    };

    assertEquals(entry.path, "/api/products/123");
  },
});

Deno.test({
  name: "AuditLogEntry - supports optional user",
  fn() {
    const user: User = {
      id: "user-123",
      username: "alice",
      roles: ["admin"],
    };

    const entry: AuditLogEntry = {
      timestamp: Date.now(),
      clientIP: "192.168.1.1",
      method: "GET",
      path: "/api/users",
      user,
      authenticated: true,
      authorized: true,
      statusCode: 200,
    };

    assertExists(entry.user);
    assertEquals(entry.user!.username, "alice");
  },
});

Deno.test({
  name: "AuditLogEntry - user is optional",
  fn() {
    const entry: AuditLogEntry = {
      timestamp: Date.now(),
      clientIP: "192.168.1.1",
      method: "GET",
      path: "/public/page",
      authenticated: false,
      authorized: true,
      statusCode: 200,
    };

    assertEquals(entry.user, undefined);
  },
});

Deno.test({
  name: "AuditLogEntry - contains authenticated flag",
  fn() {
    const entry: AuditLogEntry = {
      timestamp: Date.now(),
      clientIP: "192.168.1.1",
      method: "GET",
      path: "/api/users",
      authenticated: true,
      authorized: true,
      statusCode: 200,
    };

    assertEquals(entry.authenticated, true);
  },
});

Deno.test({
  name: "AuditLogEntry - contains authorized flag",
  fn() {
    const entry: AuditLogEntry = {
      timestamp: Date.now(),
      clientIP: "192.168.1.1",
      method: "GET",
      path: "/admin/users",
      authenticated: true,
      authorized: false,
      statusCode: 403,
    };

    assertEquals(entry.authorized, false);
  },
});

Deno.test({
  name: "AuditLogEntry - contains statusCode",
  fn() {
    const entry: AuditLogEntry = {
      timestamp: Date.now(),
      clientIP: "192.168.1.1",
      method: "GET",
      path: "/api/secret",
      authenticated: false,
      authorized: false,
      statusCode: 401,
    };

    assertEquals(entry.statusCode, 401);
  },
});

// ============================================================================
// InMemoryUserValidator Tests
// ============================================================================

Deno.test({
  name: "InMemoryUserValidator - constructor creates instance",
  fn() {
    const validator = new InMemoryUserValidator();
    assertExists(validator);
  },
});

Deno.test({
  name: "InMemoryUserValidator - addUser adds user",
  fn() {
    const validator = new InMemoryUserValidator();
    const user: User = {
      id: "user-1",
      username: "alice",
      roles: ["user"],
    };

    validator.addUser(user);
    // User is added but we can only validate through API key, password, or token
    assertExists(validator);
  },
});

Deno.test({
  name: "InMemoryUserValidator - validateApiKey returns user for valid key",
  async fn() {
    const validator = new InMemoryUserValidator();
    const user: User = {
      id: "user-1",
      username: "alice",
      roles: ["user"],
    };

    validator.addUser(user, "api-key-123");

    const result = await validator.validateApiKey("api-key-123");
    assertExists(result);
    assertEquals(result!.id, "user-1");
    assertEquals(result!.username, "alice");
  },
});

Deno.test({
  name: "InMemoryUserValidator - validateApiKey returns null for invalid key",
  async fn() {
    const validator = new InMemoryUserValidator();
    const user: User = {
      id: "user-1",
      username: "alice",
      roles: ["user"],
    };

    validator.addUser(user, "api-key-123");

    const result = await validator.validateApiKey("wrong-key");
    assertEquals(result, null);
  },
});

Deno.test({
  name: "InMemoryUserValidator - validateBasicAuth returns user for valid credentials",
  async fn() {
    const validator = new InMemoryUserValidator();
    const user: User = {
      id: "user-1",
      username: "alice",
      roles: ["user"],
    };

    validator.addUser(user, undefined, "password123");

    const result = await validator.validateBasicAuth("alice", "password123");
    assertExists(result);
    assertEquals(result!.id, "user-1");
  },
});

Deno.test({
  name: "InMemoryUserValidator - validateBasicAuth returns null for wrong password",
  async fn() {
    const validator = new InMemoryUserValidator();
    const user: User = {
      id: "user-1",
      username: "alice",
      roles: ["user"],
    };

    validator.addUser(user, undefined, "password123");

    const result = await validator.validateBasicAuth("alice", "wrongpassword");
    assertEquals(result, null);
  },
});

Deno.test({
  name: "InMemoryUserValidator - validateBasicAuth returns null for unknown user",
  async fn() {
    const validator = new InMemoryUserValidator();
    const user: User = {
      id: "user-1",
      username: "alice",
      roles: ["user"],
    };

    validator.addUser(user, undefined, "password123");

    const result = await validator.validateBasicAuth("bob", "password123");
    assertEquals(result, null);
  },
});

Deno.test({
  name: "InMemoryUserValidator - validateBearerToken returns user for valid token",
  async fn() {
    const validator = new InMemoryUserValidator();
    const user: User = {
      id: "user-1",
      username: "alice",
      roles: ["admin"],
    };

    validator.addUser(user, undefined, undefined, "token-abc123");

    const result = await validator.validateBearerToken("token-abc123");
    assertExists(result);
    assertEquals(result!.id, "user-1");
    assertEquals(result!.roles[0], "admin");
  },
});

Deno.test({
  name: "InMemoryUserValidator - validateBearerToken returns null for invalid token",
  async fn() {
    const validator = new InMemoryUserValidator();
    const user: User = {
      id: "user-1",
      username: "alice",
      roles: ["admin"],
    };

    validator.addUser(user, undefined, undefined, "token-abc123");

    const result = await validator.validateBearerToken("invalid-token");
    assertEquals(result, null);
  },
});

Deno.test({
  name: "InMemoryUserValidator - validateJWT uses bearer token validation",
  async fn() {
    const validator = new InMemoryUserValidator();
    const user: User = {
      id: "user-1",
      username: "alice",
      roles: ["user"],
    };

    validator.addUser(user, undefined, undefined, "jwt-token");

    const result = await validator.validateJWT("jwt-token");
    assertExists(result);
    assertEquals(result!.username, "alice");
  },
});

Deno.test({
  name: "InMemoryUserValidator - user can have multiple auth methods",
  async fn() {
    const validator = new InMemoryUserValidator();
    const user: User = {
      id: "user-1",
      username: "alice",
      roles: ["user"],
    };

    validator.addUser(user, "api-key-1", "password123", "token-1");

    const byApiKey = await validator.validateApiKey("api-key-1");
    const byPassword = await validator.validateBasicAuth("alice", "password123");
    const byToken = await validator.validateBearerToken("token-1");

    assertExists(byApiKey);
    assertExists(byPassword);
    assertExists(byToken);

    assertEquals(byApiKey!.id, "user-1");
    assertEquals(byPassword!.id, "user-1");
    assertEquals(byToken!.id, "user-1");
  },
});

Deno.test({
  name: "InMemoryUserValidator - supports multiple users",
  async fn() {
    const validator = new InMemoryUserValidator();

    validator.addUser(
      { id: "user-1", username: "alice", roles: ["admin"] },
      "alice-key"
    );
    validator.addUser(
      { id: "user-2", username: "bob", roles: ["user"] },
      "bob-key"
    );

    const alice = await validator.validateApiKey("alice-key");
    const bob = await validator.validateApiKey("bob-key");

    assertExists(alice);
    assertExists(bob);
    assertEquals(alice!.username, "alice");
    assertEquals(bob!.username, "bob");
  },
});

// ============================================================================
// AuthProxy Constructor Tests
// ============================================================================

Deno.test({
  name: "AuthProxy - constructor accepts route and config",
  fn() {
    const route = createTestRoute();
    const config: AuthProxyConfig = {
      userValidator: new InMemoryUserValidator(),
      accessRules: [],
    };

    const proxy = new AuthProxy(route, config);
    assertExists(proxy);
  },
});

Deno.test({
  name: "AuthProxy - getStats returns initial zeroed stats",
  fn() {
    const route = createTestRoute();
    const proxy = new AuthProxy(route, {
      userValidator: new InMemoryUserValidator(),
      accessRules: [],
    });

    const stats = proxy.getStats();

    assertEquals(stats.totalRequests, 0);
    assertEquals(stats.authenticatedRequests, 0);
    assertEquals(stats.authenticationFailures, 0);
    assertEquals(stats.authorizationDenials, 0);
    assertEquals(stats.successfulForwards, 0);
    assertEquals(stats.errors, 0);
  },
});

Deno.test({
  name: "AuthProxy - getAuditLog returns empty array initially",
  fn() {
    const route = createTestRoute();
    const proxy = new AuthProxy(route, {
      userValidator: new InMemoryUserValidator(),
      accessRules: [],
    });

    const log = proxy.getAuditLog();

    assertEquals(log.length, 0);
  },
});

Deno.test({
  name: "AuthProxy - getLoadBalancer returns load balancer",
  fn() {
    const route = createTestRoute();
    const proxy = new AuthProxy(route, {
      userValidator: new InMemoryUserValidator(),
      accessRules: [],
    });

    const lb = proxy.getLoadBalancer();
    assertExists(lb);
  },
});

Deno.test({
  name: "AuthProxy - getConnectionManager returns manager",
  fn() {
    const route = createTestRoute();
    const proxy = new AuthProxy(route, {
      userValidator: new InMemoryUserValidator(),
      accessRules: [],
    });

    const manager = proxy.getConnectionManager();
    assertExists(manager);
  },
});

Deno.test({
  name: "AuthProxy - getRoute returns route",
  fn() {
    const route = createTestRoute();
    const proxy = new AuthProxy(route, {
      userValidator: new InMemoryUserValidator(),
      accessRules: [],
    });

    const retrievedRoute = proxy.getRoute();
    assertEquals(retrievedRoute, route);
  },
});

Deno.test({
  name: "AuthProxy - getUserValidator returns validator",
  fn() {
    const validator = new InMemoryUserValidator();
    const route = createTestRoute();
    const proxy = new AuthProxy(route, {
      userValidator: validator,
      accessRules: [],
    });

    assertEquals(proxy.getUserValidator(), validator);
  },
});

Deno.test({
  name: "AuthProxy - getAccessRules returns access rules",
  fn() {
    const route = createTestRoute();
    const rules: AccessRule[] = [
      { pathPattern: /^\/api\/.*/, methods: ["GET"], requiredRoles: ["user"] },
      { pathPattern: /^\/admin\/.*/, methods: ["*"], requiredRoles: ["admin"] },
    ];

    const proxy = new AuthProxy(route, {
      userValidator: new InMemoryUserValidator(),
      accessRules: rules,
    });

    const retrievedRules = proxy.getAccessRules();
    assertEquals(retrievedRules.length, 2);
  },
});

Deno.test({
  name: "AuthProxy - getConfig returns configuration",
  fn() {
    const route = createTestRoute();
    const proxy = new AuthProxy(route, {
      userValidator: new InMemoryUserValidator(),
      accessRules: [],
      timeout: 60000,
      maxRetries: 5,
    });

    const config = proxy.getConfig();
    assertEquals(config.timeout, 60000);
    assertEquals(config.maxRetries, 5);
  },
});

Deno.test({
  name: "AuthProxy - defaults authMethods to api-key and bearer",
  fn() {
    const route = createTestRoute();
    const proxy = new AuthProxy(route, {
      userValidator: new InMemoryUserValidator(),
      accessRules: [],
    });

    const config = proxy.getConfig();
    assertExists(config.authMethods);
    assert(config.authMethods!.includes("api-key"));
    assert(config.authMethods!.includes("bearer"));
  },
});

Deno.test({
  name: "AuthProxy - defaults enableAuditLog to true",
  fn() {
    const route = createTestRoute();
    const proxy = new AuthProxy(route, {
      userValidator: new InMemoryUserValidator(),
      accessRules: [],
    });

    const config = proxy.getConfig();
    assertEquals(config.enableAuditLog, true);
  },
});

Deno.test({
  name: "AuthProxy - defaults addUserHeaders to true",
  fn() {
    const route = createTestRoute();
    const proxy = new AuthProxy(route, {
      userValidator: new InMemoryUserValidator(),
      accessRules: [],
    });

    const config = proxy.getConfig();
    assertEquals(config.addUserHeaders, true);
  },
});

Deno.test({
  name: "AuthProxy - defaults timeout to 30000",
  fn() {
    const route = createTestRoute();
    const proxy = new AuthProxy(route, {
      userValidator: new InMemoryUserValidator(),
      accessRules: [],
    });

    const config = proxy.getConfig();
    assertEquals(config.timeout, 30000);
  },
});

Deno.test({
  name: "AuthProxy - defaults maxRetries to 3",
  fn() {
    const route = createTestRoute();
    const proxy = new AuthProxy(route, {
      userValidator: new InMemoryUserValidator(),
      accessRules: [],
    });

    const config = proxy.getConfig();
    assertEquals(config.maxRetries, 3);
  },
});

Deno.test({
  name: "AuthProxy - defaults retryDelay to 1000",
  fn() {
    const route = createTestRoute();
    const proxy = new AuthProxy(route, {
      userValidator: new InMemoryUserValidator(),
      accessRules: [],
    });

    const config = proxy.getConfig();
    assertEquals(config.retryDelay, 1000);
  },
});

// ============================================================================
// AuthProxy close Tests
// ============================================================================

Deno.test({
  name: "AuthProxy - close does not throw",
  async fn() {
    const route = createTestRoute();
    const proxy = new AuthProxy(route, {
      userValidator: new InMemoryUserValidator(),
      accessRules: [],
    });

    // Should not throw
    await proxy.close();
  },
});

Deno.test({
  name: "AuthProxy - close can be called multiple times",
  async fn() {
    const route = createTestRoute();
    const proxy = new AuthProxy(route, {
      userValidator: new InMemoryUserValidator(),
      accessRules: [],
    });

    await proxy.close();
    await proxy.close();
    await proxy.close();
  },
});

// ============================================================================
// AccessRule Pattern Tests
// ============================================================================

Deno.test({
  name: "AccessRule - exact path pattern",
  fn() {
    const rule: AccessRule = {
      pathPattern: /^\/api\/users$/,
      methods: ["GET"],
      requiredRoles: ["user"],
    };

    assertEquals(rule.pathPattern.test("/api/users"), true);
    assertEquals(rule.pathPattern.test("/api/users/"), false);
    assertEquals(rule.pathPattern.test("/api/users/123"), false);
  },
});

Deno.test({
  name: "AccessRule - prefix pattern",
  fn() {
    const rule: AccessRule = {
      pathPattern: /^\/api\//,
      methods: ["*"],
      requiredRoles: ["user"],
    };

    assertEquals(rule.pathPattern.test("/api/users"), true);
    assertEquals(rule.pathPattern.test("/api/products"), true);
    assertEquals(rule.pathPattern.test("/api/"), true);
    assertEquals(rule.pathPattern.test("/web/page"), false);
  },
});

Deno.test({
  name: "AccessRule - path with parameter placeholder",
  fn() {
    const rule: AccessRule = {
      pathPattern: /^\/api\/users\/[^/]+$/,
      methods: ["GET", "PUT", "DELETE"],
      requiredRoles: ["user"],
    };

    assertEquals(rule.pathPattern.test("/api/users/123"), true);
    assertEquals(rule.pathPattern.test("/api/users/abc"), true);
    assertEquals(rule.pathPattern.test("/api/users"), false);
    assertEquals(rule.pathPattern.test("/api/users/123/posts"), false);
  },
});

Deno.test({
  name: "AccessRule - nested path pattern",
  fn() {
    const rule: AccessRule = {
      pathPattern: /^\/api\/users\/[^/]+\/posts\/[^/]+$/,
      methods: ["GET"],
      requiredRoles: ["user"],
    };

    assertEquals(rule.pathPattern.test("/api/users/123/posts/456"), true);
    assertEquals(rule.pathPattern.test("/api/users/123/posts"), false);
    assertEquals(rule.pathPattern.test("/api/users/123"), false);
  },
});

Deno.test({
  name: "AccessRule - case sensitive path",
  fn() {
    const rule: AccessRule = {
      pathPattern: /^\/API\/users$/,
      methods: ["GET"],
      requiredRoles: ["user"],
    };

    assertEquals(rule.pathPattern.test("/API/users"), true);
    assertEquals(rule.pathPattern.test("/api/users"), false);
  },
});

Deno.test({
  name: "AccessRule - case insensitive path",
  fn() {
    const rule: AccessRule = {
      pathPattern: /^\/api\/users$/i,
      methods: ["GET"],
      requiredRoles: ["user"],
    };

    assertEquals(rule.pathPattern.test("/API/users"), true);
    assertEquals(rule.pathPattern.test("/api/USERS"), true);
    assertEquals(rule.pathPattern.test("/Api/Users"), true);
  },
});

// ============================================================================
// Typical Configuration Tests
// ============================================================================

Deno.test({
  name: "AuthProxy - typical REST API configuration",
  fn() {
    const route = createTestRoute();
    const validator = new InMemoryUserValidator();

    // Add users
    validator.addUser(
      { id: "admin-1", username: "admin", roles: ["admin", "user"] },
      "admin-api-key"
    );
    validator.addUser(
      { id: "user-1", username: "alice", roles: ["user"] },
      "alice-api-key"
    );

    const accessRules: AccessRule[] = [
      // Public endpoints
      { pathPattern: /^\/api\/health$/, methods: ["GET"], requiredRoles: [], public: true },
      { pathPattern: /^\/api\/docs\//, methods: ["GET"], requiredRoles: [], public: true },

      // User endpoints (any authenticated user)
      { pathPattern: /^\/api\/users\/me$/, methods: ["GET", "PUT"], requiredRoles: ["user"] },

      // Admin endpoints
      { pathPattern: /^\/api\/admin\//, methods: ["*"], requiredRoles: ["admin"] },

      // General API access
      { pathPattern: /^\/api\//, methods: ["GET"], requiredRoles: ["user"] },
    ];

    const proxy = new AuthProxy(route, {
      userValidator: validator,
      accessRules,
      authMethods: ["api-key", "bearer"],
      enableAuditLog: true,
    });

    assertExists(proxy);
    assertEquals(proxy.getAccessRules().length, 5);
  },
});

Deno.test({
  name: "AuthProxy - microservice gateway configuration",
  fn() {
    const route = createTestRoute();
    const validator = new InMemoryUserValidator();

    validator.addUser(
      { id: "service-1", username: "order-service", roles: ["service", "orders"] },
      undefined,
      undefined,
      "service-token-orders"
    );
    validator.addUser(
      { id: "service-2", username: "inventory-service", roles: ["service", "inventory"] },
      undefined,
      undefined,
      "service-token-inventory"
    );

    const accessRules: AccessRule[] = [
      { pathPattern: /^\/orders\//, methods: ["*"], requiredRoles: ["orders"] },
      { pathPattern: /^\/inventory\//, methods: ["*"], requiredRoles: ["inventory"] },
      { pathPattern: /^\/common\//, methods: ["GET"], requiredRoles: ["service"] },
    ];

    const proxy = new AuthProxy(route, {
      userValidator: validator,
      accessRules,
      authMethods: ["bearer"],
      addUserHeaders: true,
    });

    assertExists(proxy);
  },
});

// ============================================================================
// Helper Functions
// ============================================================================

function createTestRoute(): Route {
  return {
    id: "test-route",
    pattern: "/api/*",
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"],
    priority: 0,
    enabled: true,
    upstream: {
      servers: [
        {
          id: "backend-1",
          host: "localhost",
          port: 8080,
          weight: 1,
          protocol: "http",
          enabled: true,
        },
      ],
      loadBalancingStrategy: "round-robin",
      timeout: 30000,
    },
  };
}
