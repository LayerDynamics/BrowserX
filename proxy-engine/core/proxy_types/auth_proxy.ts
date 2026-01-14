/**
 * Authentication & Authorization Proxy
 *
 * Provides centralized authentication and authorization with support for:
 * - Multiple authentication methods (API key, Basic Auth, Bearer token, JWT)
 * - Role-based access control (RBAC)
 * - Path-based authorization rules
 * - Request forwarding to upstream after auth
 * - Audit logging
 */

import type { HTTPRequest, HTTPResponse } from "../network/transport/http/http.ts";
import type { Route, UpstreamServer } from "../../gateway/router/request_router.ts";
import type { LoadBalancer } from "../../gateway/router/load_balancer/types.ts";
import { createLoadBalancer } from "../../gateway/router/load_balancer/factory.ts";
import { HealthMonitor } from "../connection/health_check.ts";
import {
  DEFAULT_CONNECTION_POOL_CONFIG,
  UpstreamConnectionManager,
} from "../connection/connection_manager.ts";
import { HTTP11Client } from "../network/transport/http/http.ts";

/**
 * Authentication method
 */
export type AuthMethod = "api-key" | "basic" | "bearer" | "jwt";

/**
 * User information
 */
export interface User {
  /**
   * User ID
   */
  id: string;

  /**
   * Username
   */
  username: string;

  /**
   * User roles
   */
  roles: string[];

  /**
   * Additional metadata
   */
  metadata?: Record<string, unknown>;
}

/**
 * Access rule
 */
export interface AccessRule {
  /**
   * Path pattern (RegExp)
   */
  pathPattern: RegExp;

  /**
   * Allowed HTTP methods
   */
  methods: string[];

  /**
   * Required roles (user must have at least one)
   */
  requiredRoles: string[];

  /**
   * Allow public access (no authentication required)
   */
  public?: boolean;
}

/**
 * User validator interface
 */
export interface UserValidator {
  /**
   * Validate API key and return user
   */
  validateApiKey?(apiKey: string): Promise<User | null>;

  /**
   * Validate basic auth credentials and return user
   */
  validateBasicAuth?(username: string, password: string): Promise<User | null>;

  /**
   * Validate bearer token and return user
   */
  validateBearerToken?(token: string): Promise<User | null>;

  /**
   * Validate JWT and return user
   */
  validateJWT?(token: string): Promise<User | null>;
}

/**
 * Auth proxy configuration
 */
export interface AuthProxyConfig {
  /**
   * Authentication methods to enable
   */
  authMethods?: AuthMethod[];

  /**
   * User validator
   */
  userValidator: UserValidator;

  /**
   * Access rules
   */
  accessRules: AccessRule[];

  /**
   * Enable audit logging
   */
  enableAuditLog?: boolean;

  /**
   * Add authenticated user info to request headers
   */
  addUserHeaders?: boolean;

  /**
   * Connection timeout (ms)
   */
  timeout?: number;

  /**
   * Max retries on failure
   */
  maxRetries?: number;

  /**
   * Retry delay (ms)
   */
  retryDelay?: number;
}

/**
 * Auth proxy statistics
 */
export interface AuthProxyStats {
  /**
   * Total requests
   */
  totalRequests: number;

  /**
   * Authenticated requests
   */
  authenticatedRequests: number;

  /**
   * Failed authentication attempts
   */
  authenticationFailures: number;

  /**
   * Authorization denials
   */
  authorizationDenials: number;

  /**
   * Successful forwarded requests
   */
  successfulForwards: number;

  /**
   * Errors
   */
  errors: number;
}

/**
 * Audit log entry
 */
export interface AuditLogEntry {
  timestamp: number;
  clientIP: string;
  method: string;
  path: string;
  user?: User;
  authenticated: boolean;
  authorized: boolean;
  statusCode: number;
}

/**
 * Request context
 */
interface RequestContext {
  clientIP: string;
  clientPort: number;
  protocol: string;
  startTime: number;
}

/**
 * Auth proxy implementation
 */
export class AuthProxy {
  private loadBalancer: LoadBalancer;
  private healthMonitor?: HealthMonitor;
  private connectionManager: UpstreamConnectionManager;
  private config: Required<Omit<AuthProxyConfig, "userValidator" | "accessRules">> & {
    userValidator: UserValidator;
    accessRules: AccessRule[];
  };
  private auditLog: AuditLogEntry[] = [];

  // Statistics
  private stats: AuthProxyStats = {
    totalRequests: 0,
    authenticatedRequests: 0,
    authenticationFailures: 0,
    authorizationDenials: 0,
    successfulForwards: 0,
    errors: 0,
  };

  constructor(
    private route: Route,
    config: AuthProxyConfig,
  ) {
    this.config = {
      authMethods: config.authMethods ?? ["api-key", "bearer"],
      userValidator: config.userValidator,
      accessRules: config.accessRules,
      enableAuditLog: config.enableAuditLog ?? true,
      addUserHeaders: config.addUserHeaders ?? true,
      timeout: config.timeout ?? 30000,
      maxRetries: config.maxRetries ?? 3,
      retryDelay: config.retryDelay ?? 1000,
    };

    // Create load balancer
    this.loadBalancer = createLoadBalancer(route.upstream.loadBalancingStrategy);

    // Create connection manager
    this.connectionManager = new UpstreamConnectionManager(DEFAULT_CONNECTION_POOL_CONFIG);

    // Create health monitor if health check config provided
    if (route.upstream.healthCheck) {
      this.healthMonitor = new HealthMonitor(route.upstream.healthCheck);
      this.healthMonitor.start(route.upstream.servers);
    }
  }

  /**
   * Handle request with authentication and authorization
   */
  async handleRequest(
    request: HTTPRequest,
    context: RequestContext,
  ): Promise<HTTPResponse> {
    this.stats.totalRequests++;

    try {
      // Step 1: Authenticate user
      const user = await this.authenticate(request);

      // Step 2: Authorize request
      const authorized = this.authorize(user, request);

      // Log audit entry
      if (this.config.enableAuditLog) {
        this.logAudit({
          timestamp: Date.now(),
          clientIP: context.clientIP,
          method: request.method,
          path: new URL(request.uri).pathname,
          user: user ?? undefined,
          authenticated: !!user,
          authorized,
          statusCode: authorized ? 200 : (user ? 403 : 401),
        });
      }

      // Check authorization
      if (!authorized) {
        if (!user) {
          this.stats.authenticationFailures++;
          return this.createUnauthorizedResponse();
        } else {
          this.stats.authorizationDenials++;
          return this.createForbiddenResponse();
        }
      }

      if (user) {
        this.stats.authenticatedRequests++;
      }

      // Step 3: Forward request to upstream
      const response = await this.forwardToUpstream(request, context, user);
      this.stats.successfulForwards++;

      return response;
    } catch (error) {
      console.error("[Auth Proxy] Request handling error:", error);
      this.stats.errors++;
      return this.createErrorResponse(502, "Bad Gateway");
    }
  }

  /**
   * Authenticate user from request
   */
  private async authenticate(request: HTTPRequest): Promise<User | null> {
    // Try each enabled authentication method
    for (const method of this.config.authMethods) {
      let user: User | null = null;

      switch (method) {
        case "api-key":
          user = await this.authenticateApiKey(request);
          break;
        case "basic":
          user = await this.authenticateBasic(request);
          break;
        case "bearer":
        case "jwt":
          user = await this.authenticateBearer(request);
          break;
      }

      if (user) {
        return user;
      }
    }

    return null;
  }

  /**
   * Authenticate using API key
   */
  private async authenticateApiKey(request: HTTPRequest): Promise<User | null> {
    const apiKey = request.headers["x-api-key"];
    if (!apiKey || !this.config.userValidator.validateApiKey) {
      return null;
    }

    return await this.config.userValidator.validateApiKey(apiKey);
  }

  /**
   * Authenticate using Basic Auth
   */
  private async authenticateBasic(request: HTTPRequest): Promise<User | null> {
    const authHeader = request.headers["authorization"];
    if (
      !authHeader || !authHeader.startsWith("Basic ") ||
      !this.config.userValidator.validateBasicAuth
    ) {
      return null;
    }

    try {
      const credentials = atob(authHeader.substring(6));
      const [username, password] = credentials.split(":");

      return await this.config.userValidator.validateBasicAuth(username, password);
    } catch (error) {
      console.error("[Auth Proxy] Basic auth parsing error:", error);
      return null;
    }
  }

  /**
   * Authenticate using Bearer token or JWT
   */
  private async authenticateBearer(request: HTTPRequest): Promise<User | null> {
    const authHeader = request.headers["authorization"];
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return null;
    }

    const token = authHeader.substring(7);

    // Try JWT validation first
    if (this.config.authMethods.includes("jwt") && this.config.userValidator.validateJWT) {
      const user = await this.config.userValidator.validateJWT(token);
      if (user) return user;
    }

    // Try bearer token validation
    if (
      this.config.authMethods.includes("bearer") && this.config.userValidator.validateBearerToken
    ) {
      return await this.config.userValidator.validateBearerToken(token);
    }

    return null;
  }

  /**
   * Authorize request based on access rules
   */
  private authorize(user: User | null, request: HTTPRequest): boolean {
    const url = new URL(request.uri);
    const path = url.pathname;
    const method = request.method;

    // Check each access rule
    for (const rule of this.config.accessRules) {
      // Check if path matches
      if (!rule.pathPattern.test(path)) {
        continue;
      }

      // Check if method is allowed
      if (!rule.methods.includes(method) && !rule.methods.includes("*")) {
        continue;
      }

      // Check if public access is allowed
      if (rule.public) {
        return true;
      }

      // Check if user is authenticated
      if (!user) {
        return false;
      }

      // Check if user has required role
      const hasRequiredRole = rule.requiredRoles.some((role) =>
        user.roles.includes(role) || role === "*"
      );

      if (hasRequiredRole) {
        return true;
      }
    }

    // No matching rule or insufficient permissions
    return false;
  }

  /**
   * Forward request to upstream server
   */
  private async forwardToUpstream(
    request: HTTPRequest,
    context: RequestContext,
    user: User | null,
  ): Promise<HTTPResponse> {
    // Select upstream server
    const server = this.selectUpstreamServer(request, context);
    if (!server) {
      return this.createErrorResponse(503, "No healthy upstream servers available");
    }

    // Build upstream request
    const upstreamRequest = this.buildUpstreamRequest(request, server, context, user);

    // Forward request with retries
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        const client = new HTTP11Client({
          host: server.host,
          port: server.port,
          timeout: this.config.timeout,
        });

        await client.connect();
        const response = await client.sendRequest(upstreamRequest);
        await client.close();

        return response;
      } catch (error) {
        lastError = error as Error;
        console.error(`[Auth Proxy] Forward attempt ${attempt + 1} failed:`, error);

        if (attempt < this.config.maxRetries - 1) {
          await new Promise((resolve) => setTimeout(resolve, this.config.retryDelay));
        }
      }
    }

    throw lastError || new Error("Failed to forward request to upstream");
  }

  /**
   * Select upstream server using load balancer
   */
  private selectUpstreamServer(
    request: HTTPRequest,
    context: RequestContext,
  ): UpstreamServer | null {
    // Filter healthy servers
    const servers = this.route.upstream.servers.filter((server) => {
      if (this.healthMonitor) {
        return this.healthMonitor.isHealthy(server);
      }
      return true;
    });

    if (servers.length === 0) {
      return null;
    }

    // Select server using load balancer
    return this.loadBalancer.selectServer(servers, request, context.clientIP);
  }

  /**
   * Build upstream request
   */
  private buildUpstreamRequest(
    request: HTTPRequest,
    server: UpstreamServer,
    context: RequestContext,
    user: User | null,
  ): HTTPRequest {
    const url = new URL(request.uri);
    const upstreamUrl =
      `${server.protocol}://${server.host}:${server.port}${url.pathname}${url.search}`;

    const headers = { ...request.headers };

    // Remove auth headers (don't forward to upstream)
    delete headers["authorization"];
    delete headers["x-api-key"];

    // Add user info headers if enabled
    if (this.config.addUserHeaders && user) {
      headers["x-authenticated-user-id"] = user.id;
      headers["x-authenticated-user"] = user.username;
      headers["x-authenticated-roles"] = user.roles.join(",");
    }

    // Add forwarded headers
    headers["x-forwarded-for"] = context.clientIP;
    headers["x-forwarded-proto"] = context.protocol;

    return {
      method: request.method,
      uri: upstreamUrl,
      version: request.version || "1.1",
      headers,
      body: request.body,
    };
  }

  /**
   * Create 401 Unauthorized response
   */
  private createUnauthorizedResponse(): HTTPResponse {
    return {
      statusCode: 401,
      statusText: "Unauthorized",
      version: "1.1",
      headers: {
        "content-type": "text/plain",
        "www-authenticate": "Bearer",
      },
      body: new TextEncoder().encode("Authentication required"),
    };
  }

  /**
   * Create 403 Forbidden response
   */
  private createForbiddenResponse(): HTTPResponse {
    return {
      statusCode: 403,
      statusText: "Forbidden",
      version: "1.1",
      headers: {
        "content-type": "text/plain",
      },
      body: new TextEncoder().encode("Insufficient permissions"),
    };
  }

  /**
   * Create error response
   */
  private createErrorResponse(statusCode: number, message: string): HTTPResponse {
    return {
      statusCode,
      statusText: message,
      version: "1.1",
      headers: {
        "content-type": "text/plain",
      },
      body: new TextEncoder().encode(message),
    };
  }

  /**
   * Log audit entry
   */
  private logAudit(entry: AuditLogEntry): void {
    this.auditLog.push(entry);

    // Keep only last 10000 entries
    if (this.auditLog.length > 10000) {
      this.auditLog.shift();
    }

    // Also log to console
    const userInfo = entry.user
      ? `${entry.user.username} (${entry.user.roles.join(",")})`
      : "anonymous";
    console.log(
      `[Audit] ${
        new Date(entry.timestamp).toISOString()
      } ${entry.clientIP} ${userInfo} ${entry.method} ${entry.path} → ${entry.statusCode}`,
    );
  }

  /**
   * Get audit log
   */
  getAuditLog(): AuditLogEntry[] {
    return [...this.auditLog];
  }

  /**
   * Get proxy statistics
   */
  getStats(): AuthProxyStats {
    return { ...this.stats };
  }

  /**
   * Get load balancer
   */
  getLoadBalancer(): LoadBalancer {
    return this.loadBalancer;
  }

  /**
   * Get health monitor
   */
  getHealthMonitor(): HealthMonitor | undefined {
    return this.healthMonitor;
  }

  /**
   * Get connection manager
   */
  getConnectionManager(): UpstreamConnectionManager {
    return this.connectionManager;
  }

  /**
   * Get configuration
   */
  getConfig(): Readonly<AuthProxyConfig> {
    return {
      ...this.config,
      accessRules: [...this.config.accessRules],
      authMethods: [...this.config.authMethods],
    };
  }

  /**
   * Get route
   */
  getRoute(): Route {
    return this.route;
  }

  /**
   * Get user validator
   */
  getUserValidator(): UserValidator {
    return this.config.userValidator;
  }

  /**
   * Get access rules
   */
  getAccessRules(): AccessRule[] {
    return [...this.config.accessRules];
  }

  /**
   * Close proxy and clean up resources
   */
  async close(): Promise<void> {
    if (this.healthMonitor) {
      this.healthMonitor.stop();
    }

    await this.connectionManager.closeAll();
  }
}

/**
 * In-memory user validator (for testing/demo)
 */
export class InMemoryUserValidator implements UserValidator {
  private users = new Map<string, User>();
  private apiKeys = new Map<string, string>(); // apiKey -> userId
  private credentials = new Map<string, string>(); // username -> password
  private tokens = new Map<string, string>(); // token -> userId

  addUser(user: User, apiKey?: string, password?: string, token?: string): void {
    this.users.set(user.id, user);

    if (apiKey) {
      this.apiKeys.set(apiKey, user.id);
    }

    if (password) {
      this.credentials.set(user.username, password);
    }

    if (token) {
      this.tokens.set(token, user.id);
    }
  }

  async validateApiKey(apiKey: string): Promise<User | null> {
    const userId = this.apiKeys.get(apiKey);
    if (!userId) return null;
    return this.users.get(userId) ?? null;
  }

  async validateBasicAuth(username: string, password: string): Promise<User | null> {
    const storedPassword = this.credentials.get(username);
    if (!storedPassword || storedPassword !== password) return null;

    // Find user by username
    for (const user of this.users.values()) {
      if (user.username === username) {
        return user;
      }
    }

    return null;
  }

  async validateBearerToken(token: string): Promise<User | null> {
    const userId = this.tokens.get(token);
    if (!userId) return null;
    return this.users.get(userId) ?? null;
  }

  async validateJWT(token: string): Promise<User | null> {
    // Simple JWT validation (in production, use a proper JWT library)
    // For now, treat it like a bearer token
    return this.validateBearerToken(token);
  }
}
