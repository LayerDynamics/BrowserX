/**
 * Authentication Controller
 *
 * Bridges the query engine with browser authentication capabilities.
 * Provides session management and authentication for query execution.
 */

import type { BrowserPage } from "@browserx/browser";
import {
  AuthenticationManager,
  createAuthenticationManager,
  type AuthCredentials,
  type AuthenticationResult,
  type AuthSession,
  type AuthStateChangeEvent,
  type AuthenticationType,
  type BasicAuthCredentials,
  type BearerAuthCredentials,
  type ApiKeyCredentials,
  type CookieAuthCredentials,
  type CookieConfig,
  type FormLoginCredentials,
  type OAuth2Credentials,
  type CustomAuthCredentials,
} from "@browserx/browser";
import { getCurrentBrowserController } from "./browser-context.ts";

/**
 * Authentication state for the query engine
 */
export interface AuthState {
  /** Whether currently authenticated */
  authenticated: boolean;
  /** Session type */
  type: AuthenticationType | null;
  /** Session creation time */
  createdAt: Date | null;
  /** Session expiration time */
  expiresAt: Date | null;
}

/**
 * Authentication Controller for query engine integration
 */
export class AuthController {
  private authManager: AuthenticationManager | null = null;
  private onStateChange?: (event: AuthStateChangeEvent) => void;

  /**
   * Get or create AuthenticationManager instance
   */
  private async getAuthManager(): Promise<AuthenticationManager> {
    if (this.authManager) {
      return this.authManager;
    }

    const browserController = getCurrentBrowserController();
    if (!browserController) {
      throw new Error("Browser context not initialized. Navigate to a page first.");
    }

    const page = browserController.getCurrentPage();
    if (!page) {
      throw new Error("No page available in browser context.");
    }

    this.authManager = createAuthenticationManager(page as unknown as BrowserPage);

    // Wire up state change handler if set
    if (this.onStateChange) {
      this.authManager.setOnStateChange(this.onStateChange);
    }

    return this.authManager;
  }

  /**
   * Set authentication state change callback
   */
  setOnStateChange(callback: (event: AuthStateChangeEvent) => void): void {
    this.onStateChange = callback;
    if (this.authManager) {
      this.authManager.setOnStateChange(callback);
    }
  }

  /**
   * Authenticate with the provided credentials
   */
  async authenticate(credentials: AuthCredentials): Promise<AuthenticationResult> {
    const manager = await this.getAuthManager();
    return manager.authenticate(credentials);
  }

  /**
   * Authenticate with basic auth (username/password)
   */
  async authenticateBasic(username: string, password: string): Promise<AuthenticationResult> {
    return this.authenticate({
      type: "basic",
      username,
      password,
    });
  }

  /**
   * Authenticate with bearer token
   */
  async authenticateBearer(token: string): Promise<AuthenticationResult> {
    return this.authenticate({
      type: "bearer",
      token,
    });
  }

  /**
   * Authenticate with API key
   */
  async authenticateApiKey(
    key: string,
    name: string,
    location: "header" | "query" = "header"
  ): Promise<AuthenticationResult> {
    return this.authenticate({
      type: "api-key",
      key,
      name,
      in: location,
    });
  }

  /**
   * Authenticate with cookies
   */
  async authenticateCookies(cookies: CookieConfig[]): Promise<AuthenticationResult> {
    return this.authenticate({
      type: "cookie",
      cookies,
    });
  }

  /**
   * Authenticate via form login
   */
  async authenticateForm(
    loginUrl: string,
    formData: Record<string, string>,
    options: {
      formSelector?: string;
      submitSelector?: string;
      successUrl?: string;
      successSelector?: string;
      errorSelector?: string;
      timeout?: number;
    } = {}
  ): Promise<AuthenticationResult> {
    const credentials: FormLoginCredentials = {
      type: "form",
      loginUrl,
      formData,
      formSelector: options.formSelector,
      submitSelector: options.submitSelector,
      errorSelector: options.errorSelector,
      timeout: options.timeout,
    };

    if (options.successUrl) {
      credentials.successIndicator = {
        type: "url",
        pattern: options.successUrl,
      };
    } else if (options.successSelector) {
      credentials.successIndicator = {
        type: "selector",
        pattern: options.successSelector,
      };
    }

    return this.authenticate(credentials);
  }

  /**
   * Authenticate with OAuth2
   */
  async authenticateOAuth2(
    config: Omit<OAuth2Credentials, "type">
  ): Promise<AuthenticationResult> {
    return this.authenticate({
      type: "oauth2",
      ...config,
    });
  }

  /**
   * Check if currently authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    try {
      const manager = await this.getAuthManager();
      return manager.isAuthenticated();
    } catch {
      return false;
    }
  }

  /**
   * Get current authentication state
   */
  async getState(): Promise<AuthState> {
    try {
      const manager = await this.getAuthManager();
      const session = manager.getSession();

      if (!session) {
        return {
          authenticated: false,
          type: null,
          createdAt: null,
          expiresAt: null,
        };
      }

      return {
        authenticated: session.authenticated,
        type: session.type,
        createdAt: session.createdAt,
        expiresAt: session.expiresAt || null,
      };
    } catch {
      return {
        authenticated: false,
        type: null,
        createdAt: null,
        expiresAt: null,
      };
    }
  }

  /**
   * Get current session (full details)
   */
  async getSession(): Promise<AuthSession | null> {
    try {
      const manager = await this.getAuthManager();
      return manager.getSession();
    } catch {
      return null;
    }
  }

  /**
   * Refresh the current authentication session
   */
  async refresh(): Promise<AuthenticationResult> {
    const manager = await this.getAuthManager();
    return manager.refresh();
  }

  /**
   * Log out and clear the current session
   */
  async logout(): Promise<void> {
    try {
      const manager = await this.getAuthManager();
      await manager.logout();
    } catch {
      // Ignore errors during logout
    }
  }

  /**
   * Get authentication headers for the current session
   */
  async getAuthHeaders(): Promise<Record<string, string>> {
    try {
      const manager = await this.getAuthManager();
      return manager.getAuthHeaders();
    } catch {
      return {};
    }
  }

  /**
   * Get authentication cookies for the current session
   */
  async getAuthCookies(): Promise<CookieConfig[]> {
    try {
      const manager = await this.getAuthManager();
      return manager.getAuthCookies();
    } catch {
      return [];
    }
  }

  /**
   * Clear the auth manager instance (for cleanup)
   */
  clear(): void {
    this.authManager = null;
  }
}

// Singleton instance
let authControllerInstance: AuthController | null = null;

/**
 * Get the auth controller instance
 */
export function getAuthController(): AuthController {
  if (!authControllerInstance) {
    authControllerInstance = new AuthController();
  }
  return authControllerInstance;
}

/**
 * Clear the auth controller instance
 */
export function clearAuthController(): void {
  if (authControllerInstance) {
    authControllerInstance.clear();
    authControllerInstance = null;
  }
}

// Re-export types for convenience
export type {
  AuthCredentials,
  AuthenticationResult,
  AuthSession,
  AuthStateChangeEvent,
  AuthenticationType,
  BasicAuthCredentials,
  BearerAuthCredentials,
  ApiKeyCredentials,
  CookieAuthCredentials,
  CookieConfig,
  FormLoginCredentials,
  OAuth2Credentials,
  CustomAuthCredentials,
};
