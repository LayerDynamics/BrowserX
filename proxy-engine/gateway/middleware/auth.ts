/**
 * Authentication Middleware
 *
 * Supports Basic, Bearer token, and OAuth authentication
 */

import type {
  AuthenticatedUser,
  MiddlewareResult,
  RequestContext,
  RequestMiddleware,
} from "./types.ts";
import type { HTTPRequest } from "../../core/network/transport/http/http.ts";

/**
 * Authentication method
 */
export type AuthMethod = "basic" | "bearer" | "oauth";

/**
 * Authentication error
 */
export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthenticationError";
  }
}

/**
 * User validator interface
 */
export interface UserValidator {
  /**
   * Validate credentials and return user
   */
  validate(credentials: string): Promise<AuthenticatedUser | null>;
}

/**
 * Basic authentication validator
 */
export interface BasicAuthValidator {
  /**
   * Validate username and password
   */
  validate(username: string, password: string): Promise<AuthenticatedUser | null>;
}

/**
 * Token validator interface
 */
export interface TokenValidator {
  /**
   * Validate token and return user
   */
  validate(token: string): Promise<AuthenticatedUser | null>;
}

/**
 * Authentication middleware configuration
 */
export interface AuthMiddlewareConfig {
  /**
   * Authentication method
   */
  method: AuthMethod;

  /**
   * Realm for Basic auth
   */
  realm?: string;

  /**
   * Validator for credentials
   */
  validator: BasicAuthValidator | TokenValidator;

  /**
   * Paths that don't require authentication
   */
  publicPaths?: string[];

  /**
   * Required roles (if any)
   */
  requiredRoles?: string[];
}

/**
 * Authentication middleware
 */
export class AuthMiddleware implements RequestMiddleware {
  readonly name = "auth";

  constructor(private config: AuthMiddlewareConfig) {}

  async processRequest(
    request: HTTPRequest,
    context: RequestContext,
  ): Promise<MiddlewareResult> {
    // Check if path is public
    if (this.isPublicPath(request.uri)) {
      return { type: "continue" };
    }

    // Extract authorization header
    const authHeader = request.headers["authorization"];
    if (!authHeader) {
      return {
        type: "error",
        error: new AuthenticationError("Missing authorization header"),
      };
    }

    try {
      // Authenticate based on method
      const user = await this.authenticate(authHeader);

      if (!user) {
        return {
          type: "error",
          error: new AuthenticationError("Invalid credentials"),
        };
      }

      // Check required roles
      if (this.config.requiredRoles && this.config.requiredRoles.length > 0) {
        const hasRole = this.config.requiredRoles.some((role) => user.roles.includes(role));

        if (!hasRole) {
          return {
            type: "error",
            error: new AuthenticationError("Insufficient permissions"),
          };
        }
      }

      // Attach user to context
      context.user = user;

      return { type: "continue" };
    } catch (error) {
      return {
        type: "error",
        error: error instanceof Error ? error : new AuthenticationError("Authentication failed"),
      };
    }
  }

  /**
   * Check if path is public
   */
  private isPublicPath(path: string): boolean {
    if (!this.config.publicPaths) {
      return false;
    }

    for (const publicPath of this.config.publicPaths) {
      if (path === publicPath || path.startsWith(publicPath + "/")) {
        return true;
      }
    }

    return false;
  }

  /**
   * Authenticate request based on method
   */
  private async authenticate(
    authHeader: string,
  ): Promise<AuthenticatedUser | null> {
    switch (this.config.method) {
      case "basic":
        return await this.authenticateBasic(authHeader);

      case "bearer":
        return await this.authenticateBearer(authHeader);

      case "oauth":
        return await this.authenticateOAuth(authHeader);

      default:
        throw new AuthenticationError(
          `Unknown auth method: ${this.config.method}`,
        );
    }
  }

  /**
   * Authenticate using Basic auth
   */
  private async authenticateBasic(
    authHeader: string,
  ): Promise<AuthenticatedUser | null> {
    // Parse "Basic base64(username:password)"
    const parts = authHeader.split(" ");
    if (parts.length !== 2 || parts[0] !== "Basic") {
      throw new AuthenticationError("Invalid Basic auth header");
    }

    // Decode base64
    const decoded = atob(parts[1]);
    const colonIndex = decoded.indexOf(":");

    if (colonIndex === -1) {
      throw new AuthenticationError("Invalid Basic auth format");
    }

    const username = decoded.slice(0, colonIndex);
    const password = decoded.slice(colonIndex + 1);

    // Validate credentials
    const validator = this.config.validator as BasicAuthValidator;
    return await validator.validate(username, password);
  }

  /**
   * Authenticate using Bearer token
   */
  private async authenticateBearer(
    authHeader: string,
  ): Promise<AuthenticatedUser | null> {
    // Parse "Bearer token"
    const parts = authHeader.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer") {
      throw new AuthenticationError("Invalid Bearer token header");
    }

    const token = parts[1];

    // Validate token
    const validator = this.config.validator as TokenValidator;
    return await validator.validate(token);
  }

  /**
   * Authenticate using OAuth
   */
  private async authenticateOAuth(
    authHeader: string,
  ): Promise<AuthenticatedUser | null> {
    // OAuth can use Bearer tokens
    // Parse "Bearer access_token"
    const parts = authHeader.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer") {
      throw new AuthenticationError("Invalid OAuth token header");
    }

    const accessToken = parts[1];

    // Validate access token
    const validator = this.config.validator as TokenValidator;
    return await validator.validate(accessToken);
  }

  /**
   * Get configuration
   */
  getConfig(): Readonly<AuthMiddlewareConfig> {
    return { ...this.config };
  }
}

/**
 * Simple in-memory user validator for testing
 */
export class InMemoryUserValidator implements BasicAuthValidator {
  private users: Map<string, { password: string; user: AuthenticatedUser }> = new Map();

  /**
   * Add user
   */
  addUser(username: string, password: string, user: AuthenticatedUser): void {
    this.users.set(username, { password, user });
  }

  /**
   * Validate credentials
   */
  async validate(username: string, password: string): Promise<AuthenticatedUser | null> {
    const entry = this.users.get(username);

    if (!entry || entry.password !== password) {
      return null;
    }

    return entry.user;
  }
}

/**
 * Simple token validator for testing
 */
export class InMemoryTokenValidator implements TokenValidator {
  private tokens: Map<string, AuthenticatedUser> = new Map();

  /**
   * Add token
   */
  addToken(token: string, user: AuthenticatedUser): void {
    this.tokens.set(token, user);
  }

  /**
   * Validate token
   */
  async validate(token: string): Promise<AuthenticatedUser | null> {
    return this.tokens.get(token) || null;
  }
}
