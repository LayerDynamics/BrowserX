/**
 * AuthenticationManager Unit Tests
 *
 * Tests for the AuthenticationManager API including Basic Auth, Bearer tokens,
 * API keys, cookies, OAuth2 flows, and session management.
 */

import { assert, assertEquals, assertExists } from "@std/assert";
import {
  ApiKeyCredentials,
  AuthenticationManager,
  AuthSession,
  AuthStateChangeEvent,
  BasicAuthCredentials,
  BearerAuthCredentials,
  CookieAuthCredentials,
  OAuth2Credentials,
} from "../../src/api/AuthenticationManager.ts";
import { BrowserPage, DOMElement } from "../../src/api/BrowserPage.ts";

// ============================================================================
// TEST UTILITIES
// ============================================================================

/** Helper to install a mock fetch that returns token responses */
function installMockFetch(responseBody: Record<string, unknown> = {}, status = 200): void {
  const defaultBody = {
    access_token: "real_access_token",
    refresh_token: "real_refresh_token",
    expires_in: 3600,
    token_type: "Bearer",
    ...responseBody,
  };
  (globalThis as Record<string, unknown>)._originalFetch = globalThis.fetch;
  globalThis.fetch = ((_input: string | URL | Request, _init?: RequestInit) => {
    return Promise.resolve(new Response(JSON.stringify(defaultBody), {
      status,
      headers: { "Content-Type": "application/json" },
    }));
  }) as typeof fetch;
}

/** Restore original fetch */
function restoreFetch(): void {
  const orig = (globalThis as Record<string, unknown>)._originalFetch;
  if (orig) {
    globalThis.fetch = orig as typeof fetch;
    delete (globalThis as Record<string, unknown>)._originalFetch;
  }
}

/**
 * Create a mock BrowserPage for testing
 */
function createMockPage(overrides: Partial<BrowserPage> = {}): BrowserPage {
  return {
    query: async (_selector: string) => [],
    click: async (_selector: string) => {},
    type: async (_selector: string, _text: string, _options?: { delay?: number }) => {},
    evaluate: async (_script: string) => ({}),
    getCurrentURL: () => "https://example.com",
    wait: async (
      _options: { type: string; selector?: string; timeout?: number; duration?: number },
    ) => {},
    navigate: async (_url: string, _options?: { waitFor?: string; timeout?: number }) => {},
    ...overrides,
  } as BrowserPage;
}

/**
 * Create a mock DOMElement
 */
function createMockElement(properties: Record<string, unknown> = {}): DOMElement {
  return {
    getAttribute: async (name: string) => properties[name] as string | null ?? null,
    getProperty: async (name: string) => properties[name] ?? null,
    getText: async () => properties.textContent as string || "",
  } as DOMElement;
}

// ============================================================================
// Constructor Tests
// ============================================================================

Deno.test({
  name: "AuthenticationManager - constructor creates instance",
  fn() {
    const page = createMockPage();
    const authManager = new AuthenticationManager(page);
    assertExists(authManager);
  },
});

Deno.test({
  name: "AuthenticationManager - getSession returns null initially",
  fn() {
    const page = createMockPage();
    const authManager = new AuthenticationManager(page);
    assertEquals(authManager.getSession(), null);
  },
});

Deno.test({
  name: "AuthenticationManager - isAuthenticated returns false initially",
  fn() {
    const page = createMockPage();
    const authManager = new AuthenticationManager(page);
    assertEquals(authManager.isAuthenticated(), false);
  },
});

// ============================================================================
// Basic Authentication Tests
// ============================================================================

Deno.test({
  name: "AuthenticationManager - authenticateBasic creates Base64 encoded header",
  async fn() {
    const page = createMockPage();
    const authManager = new AuthenticationManager(page);

    const credentials: BasicAuthCredentials = {
      type: "basic",
      username: "user",
      password: "pass",
    };

    const result = await authManager.authenticate(credentials);

    assert(result.success);
    assertExists(result.session);
    assertEquals(result.session.type, "basic");
    assertEquals(result.session.authenticated, true);

    // Check Base64 encoding: "user:pass" -> "dXNlcjpwYXNz"
    const expectedToken = btoa("user:pass");
    assertEquals(result.session.headers?.["Authorization"], `Basic ${expectedToken}`);
  },
});

Deno.test({
  name: "AuthenticationManager - authenticateBasic handles special characters",
  async fn() {
    const page = createMockPage();
    const authManager = new AuthenticationManager(page);

    const credentials: BasicAuthCredentials = {
      type: "basic",
      username: "user@email.com",
      password: "p@ss:word!",
    };

    const result = await authManager.authenticate(credentials);

    assert(result.success);
    const expectedToken = btoa("user@email.com:p@ss:word!");
    assertEquals(result.session?.headers?.["Authorization"], `Basic ${expectedToken}`);
  },
});

Deno.test({
  name: "AuthenticationManager - authenticateBasic sets session correctly",
  async fn() {
    const page = createMockPage();
    const authManager = new AuthenticationManager(page);

    const credentials: BasicAuthCredentials = {
      type: "basic",
      username: "user",
      password: "pass",
    };

    await authManager.authenticate(credentials);

    assert(authManager.isAuthenticated());
    const session = authManager.getSession();
    assertExists(session);
    assertEquals(session.type, "basic");
    assertExists(session.createdAt);
  },
});

// ============================================================================
// Bearer Token Authentication Tests
// ============================================================================

Deno.test({
  name: "AuthenticationManager - authenticateBearer creates Bearer header",
  async fn() {
    const page = createMockPage();
    const authManager = new AuthenticationManager(page);

    const credentials: BearerAuthCredentials = {
      type: "bearer",
      token: "my-jwt-token-12345",
    };

    const result = await authManager.authenticate(credentials);

    assert(result.success);
    assertExists(result.session);
    assertEquals(result.session.type, "bearer");
    assertEquals(result.session.accessToken, "my-jwt-token-12345");
    assertEquals(result.session.headers?.["Authorization"], "Bearer my-jwt-token-12345");
  },
});

Deno.test({
  name: "AuthenticationManager - authenticateBearer handles long tokens",
  async fn() {
    const page = createMockPage();
    const authManager = new AuthenticationManager(page);

    const longToken =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";

    const credentials: BearerAuthCredentials = {
      type: "bearer",
      token: longToken,
    };

    const result = await authManager.authenticate(credentials);

    assert(result.success);
    assertEquals(result.session?.accessToken, longToken);
    assertEquals(result.session?.headers?.["Authorization"], `Bearer ${longToken}`);
  },
});

// ============================================================================
// API Key Authentication Tests
// ============================================================================

Deno.test({
  name: "AuthenticationManager - authenticateApiKey with header placement",
  async fn() {
    const page = createMockPage();
    const authManager = new AuthenticationManager(page);

    const credentials: ApiKeyCredentials = {
      type: "api-key",
      key: "api-key-12345",
      name: "X-API-Key",
      in: "header",
    };

    const result = await authManager.authenticate(credentials);

    assert(result.success);
    assertExists(result.session);
    assertEquals(result.session.type, "api-key");
    assertEquals(result.session.headers?.["X-API-Key"], "api-key-12345");
  },
});

Deno.test({
  name: "AuthenticationManager - authenticateApiKey with query placement",
  async fn() {
    const page = createMockPage();
    const authManager = new AuthenticationManager(page);

    const credentials: ApiKeyCredentials = {
      type: "api-key",
      key: "api-key-12345",
      name: "apikey",
      in: "query",
    };

    const result = await authManager.authenticate(credentials);

    assert(result.success);
    assertExists(result.session);
    assertEquals(result.session.type, "api-key");
    // Query placement doesn't set headers
    assertEquals(result.session.headers, {});
  },
});

Deno.test({
  name: "AuthenticationManager - authenticateApiKey with custom header name",
  async fn() {
    const page = createMockPage();
    const authManager = new AuthenticationManager(page);

    const credentials: ApiKeyCredentials = {
      type: "api-key",
      key: "my-secret-key",
      name: "Authorization",
      in: "header",
    };

    const result = await authManager.authenticate(credentials);

    assert(result.success);
    assertEquals(result.session?.headers?.["Authorization"], "my-secret-key");
  },
});

// ============================================================================
// Cookie Authentication Tests
// ============================================================================

Deno.test({
  name: "AuthenticationManager - authenticateCookie stores cookies",
  async fn() {
    const page = createMockPage();
    const authManager = new AuthenticationManager(page);

    const credentials: CookieAuthCredentials = {
      type: "cookie",
      cookies: [
        {
          name: "session_id",
          value: "abc123",
          domain: "example.com",
          path: "/",
          secure: true,
          httpOnly: true,
        },
      ],
    };

    const result = await authManager.authenticate(credentials);

    assert(result.success);
    assertExists(result.session);
    assertEquals(result.session.type, "cookie");
    assertEquals(result.session.cookies?.length, 1);
    assertEquals(result.session.cookies?.[0].name, "session_id");
    assertEquals(result.session.cookies?.[0].value, "abc123");
  },
});

Deno.test({
  name: "AuthenticationManager - authenticateCookie with multiple cookies",
  async fn() {
    const page = createMockPage();
    const authManager = new AuthenticationManager(page);

    const credentials: CookieAuthCredentials = {
      type: "cookie",
      cookies: [
        { name: "session_id", value: "abc123" },
        { name: "user_pref", value: "dark_mode" },
        { name: "csrf_token", value: "xyz789" },
      ],
    };

    const result = await authManager.authenticate(credentials);

    assert(result.success);
    assertEquals(result.session?.cookies?.length, 3);
  },
});

Deno.test({
  name: "AuthenticationManager - authenticateCookie with sameSite attribute",
  async fn() {
    const page = createMockPage();
    const authManager = new AuthenticationManager(page);

    const credentials: CookieAuthCredentials = {
      type: "cookie",
      cookies: [
        {
          name: "secure_cookie",
          value: "value",
          secure: true,
          sameSite: "Strict",
        },
      ],
    };

    const result = await authManager.authenticate(credentials);

    assert(result.success);
    assertEquals(result.session?.cookies?.[0].sameSite, "Strict");
  },
});

Deno.test({
  name: "AuthenticationManager - authenticateCookie with expires date",
  async fn() {
    const page = createMockPage();
    const authManager = new AuthenticationManager(page);

    const expiresDate = new Date(Date.now() + 3600 * 1000);

    const credentials: CookieAuthCredentials = {
      type: "cookie",
      cookies: [
        {
          name: "temp_cookie",
          value: "value",
          expires: expiresDate,
        },
      ],
    };

    const result = await authManager.authenticate(credentials);

    assert(result.success);
    assertEquals(result.session?.cookies?.[0].expires, expiresDate);
  },
});

// ============================================================================
// OAuth2 Client Credentials Tests
// ============================================================================

Deno.test({
  name: "AuthenticationManager - oauth2ClientCredentials creates session",
  async fn() {
    installMockFetch({ access_token: "real_access_token" });
    try {
      const page = createMockPage();
      const authManager = new AuthenticationManager(page);

      const credentials: OAuth2Credentials = {
        type: "oauth2",
        grantType: "client_credentials",
        clientId: "my-client-id",
        clientSecret: "my-client-secret",
        tokenUrl: "https://auth.example.com/oauth/token",
      };

      const result = await authManager.authenticate(credentials);

      assert(result.success);
      assertExists(result.session);
      assertEquals(result.session.type, "oauth2");
      assertEquals(result.session.accessToken, "real_access_token");
      assertExists(result.session.expiresAt);
      assertEquals(result.session.headers?.["Authorization"], "Bearer real_access_token");
    } finally {
      restoreFetch();
    }
  },
});

Deno.test({
  name: "AuthenticationManager - oauth2ClientCredentials sets expiration",
  async fn() {
    installMockFetch({ expires_in: 3600 });
    try {
      const page = createMockPage();
      const authManager = new AuthenticationManager(page);

      const before = Date.now();

      const credentials: OAuth2Credentials = {
        type: "oauth2",
        grantType: "client_credentials",
        clientId: "client-id",
        tokenUrl: "https://auth.example.com/token",
      };

      const result = await authManager.authenticate(credentials);

      const after = Date.now();

      assert(result.success);
      assertExists(result.session?.expiresAt);
      // Should expire in ~1 hour
      const expiresAtTime = result.session!.expiresAt!.getTime();
      assert(expiresAtTime > before + 3500 * 1000);
      assert(expiresAtTime < after + 3700 * 1000);
    } finally {
      restoreFetch();
    }
  },
});

// ============================================================================
// OAuth2 Password Grant Tests
// ============================================================================

Deno.test({
  name: "AuthenticationManager - oauth2Password requires username and password",
  async fn() {
    const page = createMockPage();
    const authManager = new AuthenticationManager(page);

    const credentials: OAuth2Credentials = {
      type: "oauth2",
      grantType: "password",
      clientId: "my-client-id",
      tokenUrl: "https://auth.example.com/token",
      // Missing username and password
    };

    const result = await authManager.authenticate(credentials);

    assertEquals(result.success, false);
    assertExists(result.error);
    assert(result.error.includes("Username and password required"));
  },
});

Deno.test({
  name: "AuthenticationManager - oauth2Password creates session with refresh token",
  async fn() {
    installMockFetch();
    try {
      const page = createMockPage();
      const authManager = new AuthenticationManager(page);

      const credentials: OAuth2Credentials = {
        type: "oauth2",
        grantType: "password",
        clientId: "my-client-id",
        tokenUrl: "https://auth.example.com/token",
        username: "user@example.com",
        password: "secret123",
      };

      const result = await authManager.authenticate(credentials);

      assert(result.success);
      assertExists(result.session);
      assertEquals(result.session.type, "oauth2");
      assertExists(result.session.accessToken);
      assertExists(result.session.refreshToken);
      assertExists(result.session.expiresAt);
    } finally {
      restoreFetch();
    }
  },
});

// ============================================================================
// OAuth2 Refresh Token Grant Tests
// ============================================================================

Deno.test({
  name: "AuthenticationManager - oauth2RefreshToken requires refresh token",
  async fn() {
    const page = createMockPage();
    const authManager = new AuthenticationManager(page);

    const credentials: OAuth2Credentials = {
      type: "oauth2",
      grantType: "refresh_token",
      clientId: "my-client-id",
      tokenUrl: "https://auth.example.com/token",
      // Missing refreshToken
    };

    const result = await authManager.authenticate(credentials);

    assertEquals(result.success, false);
    assertExists(result.error);
    assert(result.error.includes("Refresh token required"));
  },
});

Deno.test({
  name: "AuthenticationManager - oauth2RefreshToken generates new access token",
  async fn() {
    installMockFetch({ access_token: "new_real_access_token" });
    try {
      const page = createMockPage();
      const authManager = new AuthenticationManager(page);

      const credentials: OAuth2Credentials = {
        type: "oauth2",
        grantType: "refresh_token",
        clientId: "my-client-id",
        tokenUrl: "https://auth.example.com/token",
        refreshToken: "my-refresh-token",
      };

      const result = await authManager.authenticate(credentials);

      assert(result.success);
      assertExists(result.session);
      assertEquals(result.session.accessToken, "new_real_access_token");
      // refresh_token from mock response is used; falls back to original if not present
      assertExists(result.session.refreshToken);
    } finally {
      restoreFetch();
    }
  },
});

// ============================================================================
// OAuth2 Authorization Code Grant Tests
// ============================================================================

Deno.test({
  name: "AuthenticationManager - oauth2AuthorizationCode requires URL and redirectUri",
  async fn() {
    const page = createMockPage();
    const authManager = new AuthenticationManager(page);

    const credentials: OAuth2Credentials = {
      type: "oauth2",
      grantType: "authorization_code",
      clientId: "my-client-id",
      tokenUrl: "https://auth.example.com/token",
      // Missing authorizationUrl and redirectUri
    };

    const result = await authManager.authenticate(credentials);

    assertEquals(result.success, false);
    assertExists(result.error);
    assert(result.error.includes("Authorization URL and redirect URI required"));
  },
});

Deno.test({
  name: "AuthenticationManager - oauth2AuthorizationCode navigates to auth URL",
  async fn() {
    installMockFetch();
    try {
      let navigatedUrl = "";
      let callCount = 0;
      const page = createMockPage({
        navigate: async (url: string, _options?: { waitFor?: string; timeout?: number }) => {
          navigatedUrl = url;
        },
        getCurrentURL: () => {
          callCount++;
          // After first poll, simulate redirect back with code
          if (callCount >= 2) {
            return "https://myapp.com/callback?code=auth_code_123";
          }
          return "https://auth.example.com/authorize";
        },
      });
      const authManager = new AuthenticationManager(page);

      const credentials: OAuth2Credentials = {
        type: "oauth2",
        grantType: "authorization_code",
        clientId: "my-client-id",
        tokenUrl: "https://auth.example.com/token",
        authorizationUrl: "https://auth.example.com/authorize",
        redirectUri: "https://myapp.com/callback",
        scopes: ["read", "write"],
      };

      const result = await authManager.authenticate(credentials);

      assert(result.success);
      const parsed = new URL(navigatedUrl);
      assertEquals(parsed.origin, "https://auth.example.com");
      assertEquals(parsed.pathname, "/authorize");
      assertEquals(parsed.searchParams.get("client_id"), "my-client-id");
      assert(parsed.searchParams.has("redirect_uri"));
      assertEquals(parsed.searchParams.get("response_type"), "code");
      assertEquals(parsed.searchParams.get("scope"), "read write");
    } finally {
      restoreFetch();
    }
  },
});

Deno.test({
  name: "AuthenticationManager - oauth2AuthorizationCode creates session with tokens",
  async fn() {
    installMockFetch();
    try {
      let callCount = 0;
      const page = createMockPage({
        getCurrentURL: () => {
          callCount++;
          if (callCount >= 2) {
            return "https://myapp.com/callback?code=auth_code_456";
          }
          return "https://auth.example.com/authorize";
        },
      });
      const authManager = new AuthenticationManager(page);

      const credentials: OAuth2Credentials = {
        type: "oauth2",
        grantType: "authorization_code",
        clientId: "my-client-id",
        tokenUrl: "https://auth.example.com/token",
        authorizationUrl: "https://auth.example.com/authorize",
        redirectUri: "https://myapp.com/callback",
      };

      const result = await authManager.authenticate(credentials);

      assert(result.success);
      assertExists(result.session);
      assertExists(result.session.accessToken);
      assertExists(result.session.refreshToken);
      assertExists(result.session.expiresAt);
    } finally {
      restoreFetch();
    }
  },
});

// ============================================================================
// isAuthenticated() Tests
// ============================================================================

Deno.test({
  name: "AuthenticationManager - isAuthenticated returns true for valid session",
  async fn() {
    const page = createMockPage();
    const authManager = new AuthenticationManager(page);

    await authManager.authenticate({
      type: "bearer",
      token: "valid-token",
    });

    assertEquals(authManager.isAuthenticated(), true);
  },
});

Deno.test({
  name: "AuthenticationManager - isAuthenticated returns false for expired session",
  async fn() {
    installMockFetch();
    try {
      const page = createMockPage();
      const authManager = new AuthenticationManager(page);

      // Create a session that's already expired
      await authManager.authenticate({
        type: "oauth2",
        grantType: "client_credentials",
        clientId: "client-id",
        tokenUrl: "https://auth.example.com/token",
      });

      // Manually set expiration to past
      const session = authManager.getSession();
      if (session) {
        session.expiresAt = new Date(Date.now() - 1000);
      }

      assertEquals(authManager.isAuthenticated(), false);
    } finally {
      restoreFetch();
    }
  },
});

Deno.test({
  name: "AuthenticationManager - isAuthenticated returns false after logout",
  async fn() {
    const page = createMockPage();
    const authManager = new AuthenticationManager(page);

    await authManager.authenticate({
      type: "bearer",
      token: "valid-token",
    });

    assertEquals(authManager.isAuthenticated(), true);

    await authManager.logout();

    assertEquals(authManager.isAuthenticated(), false);
  },
});

// ============================================================================
// State Change Event Tests
// ============================================================================

Deno.test({
  name: "AuthenticationManager - emits authenticated event on login",
  async fn() {
    const page = createMockPage();
    const authManager = new AuthenticationManager(page);

    const events: AuthStateChangeEvent[] = [];
    authManager.setOnStateChange((event) => events.push(event));

    await authManager.authenticate({
      type: "bearer",
      token: "test-token",
    });

    assertEquals(events.length, 1);
    assertEquals(events[0].type, "authenticated");
    assertExists(events[0].session);
    assertExists(events[0].timestamp);
  },
});

Deno.test({
  name: "AuthenticationManager - emits logged_out event on logout",
  async fn() {
    const page = createMockPage();
    const authManager = new AuthenticationManager(page);

    const events: AuthStateChangeEvent[] = [];
    authManager.setOnStateChange((event) => events.push(event));

    await authManager.authenticate({
      type: "bearer",
      token: "test-token",
    });

    await authManager.logout();

    assertEquals(events.length, 2);
    assertEquals(events[1].type, "logged_out");
    assertEquals(events[1].session, null);
  },
});

Deno.test({
  name: "AuthenticationManager - emits refreshed event on token refresh",
  async fn() {
    installMockFetch();
    try {
      const page = createMockPage();
      const authManager = new AuthenticationManager(page);

      const events: AuthStateChangeEvent[] = [];
      authManager.setOnStateChange((event) => events.push(event));

      await authManager.authenticate({
        type: "oauth2",
        grantType: "refresh_token",
        clientId: "client-id",
        tokenUrl: "https://auth.example.com/token",
        refreshToken: "my-refresh-token",
      });

      assertEquals(events.length, 1);
      assertEquals(events[0].type, "refreshed");
    } finally {
      restoreFetch();
    }
  },
});

// ============================================================================
// refresh() Method Tests
// ============================================================================

Deno.test({
  name: "AuthenticationManager - refresh returns error when no session",
  async fn() {
    const page = createMockPage();
    const authManager = new AuthenticationManager(page);

    const result = await authManager.refresh();

    assertEquals(result.success, false);
    assertExists(result.error);
    assert(result.error.includes("No active session"));
  },
});

Deno.test({
  name: "AuthenticationManager - refresh returns error for non-oauth2 session",
  async fn() {
    const page = createMockPage();
    const authManager = new AuthenticationManager(page);

    await authManager.authenticate({
      type: "bearer",
      token: "test-token",
    });

    const result = await authManager.refresh();

    assertEquals(result.success, false);
    assertExists(result.error);
    assert(result.error.includes("only supported for OAuth2"));
  },
});

Deno.test({
  name: "AuthenticationManager - refresh works for oauth2 with refresh token",
  async fn() {
    installMockFetch();
    try {
      const page = createMockPage();
      const authManager = new AuthenticationManager(page);

      // First authenticate with password grant (gets refresh token)
      await authManager.authenticate({
        type: "oauth2",
        grantType: "password",
        clientId: "client-id",
        tokenUrl: "https://auth.example.com/token",
        username: "user",
        password: "pass",
      });

      const result = await authManager.refresh();

      assert(result.success);
      assertExists(result.session);
      assertExists(result.session.accessToken);
    } finally {
      restoreFetch();
    }
  },
});

// ============================================================================
// getAuthHeaders() Tests
// ============================================================================

Deno.test({
  name: "AuthenticationManager - getAuthHeaders returns empty when not authenticated",
  fn() {
    const page = createMockPage();
    const authManager = new AuthenticationManager(page);

    const headers = authManager.getAuthHeaders();
    assertEquals(headers, {});
  },
});

Deno.test({
  name: "AuthenticationManager - getAuthHeaders returns headers when authenticated",
  async fn() {
    const page = createMockPage();
    const authManager = new AuthenticationManager(page);

    await authManager.authenticate({
      type: "bearer",
      token: "my-token",
    });

    const headers = authManager.getAuthHeaders();
    assertEquals(headers["Authorization"], "Bearer my-token");
  },
});

// ============================================================================
// getAuthCookies() Tests
// ============================================================================

Deno.test({
  name: "AuthenticationManager - getAuthCookies returns empty when not authenticated",
  fn() {
    const page = createMockPage();
    const authManager = new AuthenticationManager(page);

    const cookies = authManager.getAuthCookies();
    assertEquals(cookies, []);
  },
});

Deno.test({
  name: "AuthenticationManager - getAuthCookies returns cookies when authenticated",
  async fn() {
    const page = createMockPage();
    const authManager = new AuthenticationManager(page);

    await authManager.authenticate({
      type: "cookie",
      cookies: [
        { name: "session", value: "abc123" },
      ],
    });

    const cookies = authManager.getAuthCookies();
    assertEquals(cookies.length, 1);
    assertEquals(cookies[0].name, "session");
    assertEquals(cookies[0].value, "abc123");
  },
});

// ============================================================================
// Custom Authentication Tests
// ============================================================================

Deno.test({
  name: "AuthenticationManager - custom auth handler success",
  async fn() {
    const page = createMockPage();
    const authManager = new AuthenticationManager(page);

    const customSession: AuthSession = {
      type: "custom",
      authenticated: true,
      createdAt: new Date(),
      headers: { "X-Custom-Auth": "custom-token" },
    };

    const result = await authManager.authenticate({
      type: "custom",
      handler: async (_page) => ({
        success: true,
        session: customSession,
      }),
    });

    assert(result.success);
    assertEquals(result.session?.type, "custom");
    assertEquals(result.session?.headers?.["X-Custom-Auth"], "custom-token");
  },
});

Deno.test({
  name: "AuthenticationManager - custom auth handler failure",
  async fn() {
    const page = createMockPage();
    const authManager = new AuthenticationManager(page);

    const result = await authManager.authenticate({
      type: "custom",
      handler: async (_page) => ({
        success: false,
        error: "Custom authentication failed",
      }),
    });

    assertEquals(result.success, false);
    assertEquals(result.error, "Custom authentication failed");
  },
});

Deno.test({
  name: "AuthenticationManager - custom auth handler exception",
  async fn() {
    const page = createMockPage();
    const authManager = new AuthenticationManager(page);

    const result = await authManager.authenticate({
      type: "custom",
      handler: async (_page) => {
        throw new Error("Handler crashed");
      },
    });

    assertEquals(result.success, false);
    assertExists(result.error);
    assert(result.error.includes("Handler crashed"));
  },
});

// ============================================================================
// Form Authentication Tests (Basic)
// ============================================================================

Deno.test({
  name: "AuthenticationManager - form authentication navigates to login URL",
  async fn() {
    let navigatedUrl = "";
    const page = createMockPage({
      navigate: async (url: string, _options?: { waitFor?: string; timeout?: number }) => {
        navigatedUrl = url;
      },
      query: async (_selector: string) => [],
    });
    const authManager = new AuthenticationManager(page);

    await authManager.authenticate({
      type: "form",
      loginUrl: "https://example.com/login",
      formData: {
        username: "testuser",
        password: "testpass",
      },
    });

    assertEquals(navigatedUrl, "https://example.com/login");
  },
});

// ============================================================================
// Edge Cases and Error Handling
// ============================================================================

Deno.test({
  name: "AuthenticationManager - handles unknown authentication type gracefully",
  async fn() {
    const page = createMockPage();
    const authManager = new AuthenticationManager(page);

    // Force unknown type through type assertion using unknown as intermediate
    // deno-lint-ignore no-explicit-any
    const credentials = { type: "unknown" } as any as BasicAuthCredentials;

    const result = await authManager.authenticate(credentials);

    assertEquals(result.success, false);
    assertExists(result.error);
    assert(result.error.includes("Unknown authentication type"));
  },
});

Deno.test({
  name: "AuthenticationManager - session createdAt is set correctly",
  async fn() {
    const page = createMockPage();
    const authManager = new AuthenticationManager(page);

    const before = new Date();

    await authManager.authenticate({
      type: "bearer",
      token: "test-token",
    });

    const after = new Date();

    const session = authManager.getSession();
    assertExists(session);
    assert(session.createdAt >= before);
    assert(session.createdAt <= after);
  },
});

Deno.test({
  name: "AuthenticationManager - multiple authentications replace previous session",
  async fn() {
    const page = createMockPage();
    const authManager = new AuthenticationManager(page);

    await authManager.authenticate({
      type: "bearer",
      token: "token1",
    });

    assertEquals(authManager.getSession()?.accessToken, "token1");

    await authManager.authenticate({
      type: "bearer",
      token: "token2",
    });

    assertEquals(authManager.getSession()?.accessToken, "token2");
  },
});
