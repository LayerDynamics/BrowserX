/**
 * Authentication Manager API
 *
 * Provides high-level authentication capabilities for browser automation.
 * Supports various authentication methods including Basic Auth, Bearer tokens,
 * API keys, cookies, form-based login, and OAuth flows.
 */

import { BrowserPage } from "./BrowserPage.ts";
import { createFormAutomation, FormAutomation, FormFillData } from "./FormAutomation.ts";

/**
 * Supported authentication types
 */
export type AuthenticationType =
  | "basic"
  | "bearer"
  | "api-key"
  | "cookie"
  | "form"
  | "oauth2"
  | "custom";

/**
 * Basic authentication credentials
 */
export interface BasicAuthCredentials {
  type: "basic";
  username: string;
  password: string;
}

/**
 * Bearer token authentication
 */
export interface BearerAuthCredentials {
  type: "bearer";
  token: string;
}

/**
 * API key authentication
 */
export interface ApiKeyCredentials {
  type: "api-key";
  key: string;
  /** Header name or query parameter name */
  name: string;
  /** Where to send the API key */
  in: "header" | "query";
}

/**
 * Cookie-based authentication
 */
export interface CookieAuthCredentials {
  type: "cookie";
  cookies: CookieConfig[];
}

/**
 * Cookie configuration
 */
export interface CookieConfig {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: "Strict" | "Lax" | "None";
  expires?: Date;
}

/**
 * Form-based login credentials
 */
export interface FormLoginCredentials {
  type: "form";
  /** URL of the login page */
  loginUrl: string;
  /** Form data to fill */
  formData: FormFillData;
  /** Form selector (optional, auto-detects primary form) */
  formSelector?: string;
  /** Submit button selector (optional) */
  submitSelector?: string;
  /** Success indicator - URL pattern or selector */
  successIndicator?: {
    type: "url" | "selector";
    pattern: string;
  };
  /** Error indicator - selector for error messages */
  errorSelector?: string;
  /** Timeout for login process */
  timeout?: number;
}

/**
 * OAuth2 authentication configuration
 */
export interface OAuth2Credentials {
  type: "oauth2";
  /** OAuth2 grant type */
  grantType: "authorization_code" | "client_credentials" | "password" | "refresh_token";
  /** Client ID */
  clientId: string;
  /** Client secret (if applicable) */
  clientSecret?: string;
  /** Authorization endpoint */
  authorizationUrl?: string;
  /** Token endpoint */
  tokenUrl: string;
  /** Redirect URI */
  redirectUri?: string;
  /** Scopes */
  scopes?: string[];
  /** Username (for password grant) */
  username?: string;
  /** Password (for password grant) */
  password?: string;
  /** Refresh token (for refresh_token grant) */
  refreshToken?: string;
  /** Access token (if already obtained) */
  accessToken?: string;
  /** Token expiration */
  expiresAt?: Date;
}

/**
 * Custom authentication handler
 */
export interface CustomAuthCredentials {
  type: "custom";
  /** Custom authentication handler */
  handler: (page: BrowserPage) => Promise<AuthenticationResult>;
}

/**
 * Union type of all credential types
 */
export type AuthCredentials =
  | BasicAuthCredentials
  | BearerAuthCredentials
  | ApiKeyCredentials
  | CookieAuthCredentials
  | FormLoginCredentials
  | OAuth2Credentials
  | CustomAuthCredentials;

/**
 * Authentication result
 */
export interface AuthenticationResult {
  /** Whether authentication was successful */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** Session data (tokens, cookies, etc.) */
  session?: AuthSession;
}

/**
 * Authentication session data
 */
export interface AuthSession {
  /** Session type */
  type: AuthenticationType;
  /** Access token (for token-based auth) */
  accessToken?: string;
  /** Refresh token (for OAuth) */
  refreshToken?: string;
  /** Token expiration */
  expiresAt?: Date;
  /** Cookies to maintain session */
  cookies?: CookieConfig[];
  /** Additional headers to include in requests */
  headers?: Record<string, string>;
  /** Whether the session is authenticated */
  authenticated: boolean;
  /** When the session was created */
  createdAt: Date;
}

/**
 * Authentication state change event
 */
export interface AuthStateChangeEvent {
  type: "authenticated" | "expired" | "logged_out" | "refreshed";
  session: AuthSession | null;
  timestamp: Date;
}

/**
 * Authentication Manager class
 */
export class AuthenticationManager {
  private page: BrowserPage;
  private formAutomation: FormAutomation;
  private currentSession: AuthSession | null = null;
  private onStateChange?: (event: AuthStateChangeEvent) => void;

  constructor(page: BrowserPage) {
    this.page = page;
    this.formAutomation = createFormAutomation(page);
  }

  /**
   * Set state change callback
   */
  setOnStateChange(callback: (event: AuthStateChangeEvent) => void): void {
    this.onStateChange = callback;
  }

  /**
   * Get current session
   */
  getSession(): AuthSession | null {
    return this.currentSession;
  }

  /**
   * Check if currently authenticated
   */
  isAuthenticated(): boolean {
    if (!this.currentSession) return false;

    // Check if session has expired
    if (this.currentSession.expiresAt && new Date() > this.currentSession.expiresAt) {
      return false;
    }

    return this.currentSession.authenticated;
  }

  /**
   * Authenticate using the provided credentials
   */
  async authenticate(credentials: AuthCredentials): Promise<AuthenticationResult> {
    switch (credentials.type) {
      case "basic":
        return this.authenticateBasic(credentials);
      case "bearer":
        return this.authenticateBearer(credentials);
      case "api-key":
        return this.authenticateApiKey(credentials);
      case "cookie":
        return this.authenticateCookie(credentials);
      case "form":
        return this.authenticateForm(credentials);
      case "oauth2":
        return this.authenticateOAuth2(credentials);
      case "custom":
        return this.authenticateCustom(credentials);
      default:
        return {
          success: false,
          error: `Unknown authentication type: ${(credentials as AuthCredentials).type}`,
        };
    }
  }

  /**
   * Basic authentication
   */
  private async authenticateBasic(
    credentials: BasicAuthCredentials,
  ): Promise<AuthenticationResult> {
    try {
      const token = btoa(`${credentials.username}:${credentials.password}`);
      const session: AuthSession = {
        type: "basic",
        authenticated: true,
        createdAt: new Date(),
        headers: {
          "Authorization": `Basic ${token}`,
        },
      };

      this.currentSession = session;
      this.emitStateChange("authenticated", session);

      return { success: true, session };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Bearer token authentication
   */
  private async authenticateBearer(
    credentials: BearerAuthCredentials,
  ): Promise<AuthenticationResult> {
    try {
      const session: AuthSession = {
        type: "bearer",
        accessToken: credentials.token,
        authenticated: true,
        createdAt: new Date(),
        headers: {
          "Authorization": `Bearer ${credentials.token}`,
        },
      };

      this.currentSession = session;
      this.emitStateChange("authenticated", session);

      return { success: true, session };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * API key authentication
   */
  private async authenticateApiKey(credentials: ApiKeyCredentials): Promise<AuthenticationResult> {
    try {
      const session: AuthSession = {
        type: "api-key",
        authenticated: true,
        createdAt: new Date(),
        headers: credentials.in === "header" ? { [credentials.name]: credentials.key } : {},
      };

      this.currentSession = session;
      this.emitStateChange("authenticated", session);

      return { success: true, session };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Cookie-based authentication
   */
  private async authenticateCookie(
    credentials: CookieAuthCredentials,
  ): Promise<AuthenticationResult> {
    try {
      // In a full implementation, this would set cookies via the browser's cookie API
      // For now, we store the cookie configuration in the session
      const session: AuthSession = {
        type: "cookie",
        cookies: credentials.cookies,
        authenticated: true,
        createdAt: new Date(),
      };

      this.currentSession = session;
      this.emitStateChange("authenticated", session);

      return { success: true, session };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Form-based login authentication
   */
  private async authenticateForm(credentials: FormLoginCredentials): Promise<AuthenticationResult> {
    try {
      // Navigate to login page
      await this.page.navigate(credentials.loginUrl, {
        waitFor: "load",
        timeout: credentials.timeout || 30000,
      });

      // Fill and submit the login form
      await this.formAutomation.fillForm(
        credentials.formSelector || "form",
        credentials.formData,
        { clearFirst: true, validate: false },
      );

      // Find and click submit button if specified
      if (credentials.submitSelector) {
        await this.page.click(credentials.submitSelector);
      } else {
        // Use form automation to submit
        await this.formAutomation.submitForm(credentials.formSelector || "form", {
          waitForNavigation: true,
          timeout: credentials.timeout || 30000,
        });
      }

      // Wait a bit for the page to settle
      await this.page.wait({ type: "time", duration: 1000 });

      // Check for success
      if (credentials.successIndicator) {
        const isSuccess = await this.checkSuccessIndicator(credentials.successIndicator);
        if (!isSuccess) {
          // Check for error message
          if (credentials.errorSelector) {
            const errorMessage = await this.getErrorMessage(credentials.errorSelector);
            return {
              success: false,
              error: errorMessage || "Login failed - success indicator not found",
            };
          }
          return {
            success: false,
            error: "Login failed - success indicator not found",
          };
        }
      }

      // Create session
      const session: AuthSession = {
        type: "form",
        authenticated: true,
        createdAt: new Date(),
      };

      this.currentSession = session;
      this.emitStateChange("authenticated", session);

      return { success: true, session };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * OAuth2 authentication
   */
  private async authenticateOAuth2(credentials: OAuth2Credentials): Promise<AuthenticationResult> {
    try {
      switch (credentials.grantType) {
        case "client_credentials":
          return this.oauth2ClientCredentials(credentials);
        case "password":
          return this.oauth2Password(credentials);
        case "refresh_token":
          return this.oauth2RefreshToken(credentials);
        case "authorization_code":
          return this.oauth2AuthorizationCode(credentials);
        default:
          return {
            success: false,
            error: `Unsupported OAuth2 grant type: ${credentials.grantType}`,
          };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * OAuth2 Client Credentials grant
   */
  private async oauth2ClientCredentials(
    credentials: OAuth2Credentials,
  ): Promise<AuthenticationResult> {
    // In a real implementation, this would make an HTTP request to the token endpoint
    // For now, we simulate the flow
    console.log(`OAuth2 Client Credentials: POST ${credentials.tokenUrl}`);

    const session: AuthSession = {
      type: "oauth2",
      accessToken: credentials.accessToken || "simulated_access_token",
      expiresAt: new Date(Date.now() + 3600 * 1000), // 1 hour
      authenticated: true,
      createdAt: new Date(),
      headers: {
        "Authorization": `Bearer ${credentials.accessToken || "simulated_access_token"}`,
      },
    };

    this.currentSession = session;
    this.emitStateChange("authenticated", session);

    return { success: true, session };
  }

  /**
   * OAuth2 Password grant
   */
  private async oauth2Password(credentials: OAuth2Credentials): Promise<AuthenticationResult> {
    if (!credentials.username || !credentials.password) {
      return {
        success: false,
        error: "Username and password required for password grant",
      };
    }

    console.log(`OAuth2 Password Grant: POST ${credentials.tokenUrl}`);

    const session: AuthSession = {
      type: "oauth2",
      accessToken: credentials.accessToken || "simulated_access_token",
      refreshToken: "simulated_refresh_token",
      expiresAt: new Date(Date.now() + 3600 * 1000),
      authenticated: true,
      createdAt: new Date(),
      headers: {
        "Authorization": `Bearer ${credentials.accessToken || "simulated_access_token"}`,
      },
    };

    this.currentSession = session;
    this.emitStateChange("authenticated", session);

    return { success: true, session };
  }

  /**
   * OAuth2 Refresh Token grant
   */
  private async oauth2RefreshToken(credentials: OAuth2Credentials): Promise<AuthenticationResult> {
    if (!credentials.refreshToken) {
      return {
        success: false,
        error: "Refresh token required for refresh_token grant",
      };
    }

    console.log(`OAuth2 Refresh Token: POST ${credentials.tokenUrl}`);

    const session: AuthSession = {
      type: "oauth2",
      accessToken: "new_simulated_access_token",
      refreshToken: credentials.refreshToken,
      expiresAt: new Date(Date.now() + 3600 * 1000),
      authenticated: true,
      createdAt: new Date(),
      headers: {
        "Authorization": "Bearer new_simulated_access_token",
      },
    };

    this.currentSession = session;
    this.emitStateChange("refreshed", session);

    return { success: true, session };
  }

  /**
   * OAuth2 Authorization Code grant
   */
  private async oauth2AuthorizationCode(
    credentials: OAuth2Credentials,
  ): Promise<AuthenticationResult> {
    if (!credentials.authorizationUrl || !credentials.redirectUri) {
      return {
        success: false,
        error: "Authorization URL and redirect URI required for authorization_code grant",
      };
    }

    // Build authorization URL
    const authUrl = new URL(credentials.authorizationUrl);
    authUrl.searchParams.set("client_id", credentials.clientId);
    authUrl.searchParams.set("redirect_uri", credentials.redirectUri);
    authUrl.searchParams.set("response_type", "code");
    if (credentials.scopes) {
      authUrl.searchParams.set("scope", credentials.scopes.join(" "));
    }

    console.log(`OAuth2 Authorization Code: Navigate to ${authUrl.toString()}`);

    // Navigate to authorization page
    await this.page.navigate(authUrl.toString());

    // In a real implementation, this would:
    // 1. Wait for user to authenticate and authorize
    // 2. Capture the redirect with authorization code
    // 3. Exchange code for tokens
    // For now, we simulate success

    const session: AuthSession = {
      type: "oauth2",
      accessToken: "simulated_access_token_from_code",
      refreshToken: "simulated_refresh_token_from_code",
      expiresAt: new Date(Date.now() + 3600 * 1000),
      authenticated: true,
      createdAt: new Date(),
      headers: {
        "Authorization": "Bearer simulated_access_token_from_code",
      },
    };

    this.currentSession = session;
    this.emitStateChange("authenticated", session);

    return { success: true, session };
  }

  /**
   * Custom authentication
   */
  private async authenticateCustom(
    credentials: CustomAuthCredentials,
  ): Promise<AuthenticationResult> {
    try {
      const result = await credentials.handler(this.page);

      if (result.success && result.session) {
        this.currentSession = result.session;
        this.emitStateChange("authenticated", result.session);
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Check success indicator after form login
   */
  private async checkSuccessIndicator(
    indicator: { type: "url" | "selector"; pattern: string },
  ): Promise<boolean> {
    if (indicator.type === "url") {
      const currentUrl = this.page.getCurrentURL() || "";
      const pattern = new RegExp(indicator.pattern);
      return pattern.test(currentUrl);
    } else {
      try {
        const elements = await this.page.query(indicator.pattern);
        return elements.length > 0;
      } catch {
        return false;
      }
    }
  }

  /**
   * Get error message from error selector
   */
  private async getErrorMessage(selector: string): Promise<string | null> {
    try {
      const elements = await this.page.query(selector);
      if (elements.length > 0) {
        return await elements[0].getText();
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Emit state change event
   */
  private emitStateChange(type: AuthStateChangeEvent["type"], session: AuthSession | null): void {
    if (this.onStateChange) {
      this.onStateChange({
        type,
        session,
        timestamp: new Date(),
      });
    }
  }

  /**
   * Refresh the current session (for token-based auth)
   */
  async refresh(): Promise<AuthenticationResult> {
    if (!this.currentSession) {
      return {
        success: false,
        error: "No active session to refresh",
      };
    }

    if (this.currentSession.type !== "oauth2" || !this.currentSession.refreshToken) {
      return {
        success: false,
        error: "Session refresh only supported for OAuth2 with refresh token",
      };
    }

    return this.oauth2RefreshToken({
      type: "oauth2",
      grantType: "refresh_token",
      clientId: "",
      tokenUrl: "",
      refreshToken: this.currentSession.refreshToken,
    });
  }

  /**
   * Log out and clear the current session
   */
  async logout(): Promise<void> {
    this.currentSession = null;
    this.emitStateChange("logged_out", null);
  }

  /**
   * Get authentication headers for requests
   */
  getAuthHeaders(): Record<string, string> {
    if (!this.currentSession || !this.currentSession.authenticated) {
      return {};
    }
    return this.currentSession.headers || {};
  }

  /**
   * Get cookies for requests
   */
  getAuthCookies(): CookieConfig[] {
    if (!this.currentSession || !this.currentSession.authenticated) {
      return [];
    }
    return this.currentSession.cookies || [];
  }
}

/**
 * Create an AuthenticationManager instance for a page
 */
export function createAuthenticationManager(page: BrowserPage): AuthenticationManager {
  return new AuthenticationManager(page);
}
