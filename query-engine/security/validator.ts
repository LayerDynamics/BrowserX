/**
 * Security validator for query engine
 */

import { NavigateStatement, SelectStatement, Statement } from "../types/ast.ts";
import { DataType } from "../types/primitives.ts";
import { PermissionError, SecurityError } from "../errors/types.ts";

/**
 * Permission enum
 */
export enum Permission {
  NAVIGATE_PUBLIC = "NAVIGATE_PUBLIC",
  NAVIGATE_PRIVATE = "NAVIGATE_PRIVATE",
  READ_COOKIES = "READ_COOKIES",
  WRITE_COOKIES = "WRITE_COOKIES",
  READ_STORAGE = "READ_STORAGE",
  WRITE_STORAGE = "WRITE_STORAGE",
  EXECUTE_JS = "EXECUTE_JS",
  INTERCEPT_TRAFFIC = "INTERCEPT_TRAFFIC",
  MODIFY_REQUESTS = "MODIFY_REQUESTS",
  SCREENSHOT = "SCREENSHOT",
  FILE_DOWNLOAD = "FILE_DOWNLOAD",
  FILE_UPLOAD = "FILE_UPLOAD",
}

/**
 * Security policy
 */
export interface SecurityPolicy {
  allowedPermissions: Permission[];
  allowedProtocols: string[];
  allowedDomains?: string[];
  blockedDomains?: string[];
  blockPrivateIPs: boolean;
  maxQueryDepth: number;
  maxExecutionTime: number; // milliseconds
  rateLimit?: {
    queriesPerSecond: number;
    queriesPerMinute: number;
    queriesPerHour: number;
  };
}

/**
 * Default security policy
 */
const DEFAULT_POLICY: SecurityPolicy = {
  allowedPermissions: [
    Permission.NAVIGATE_PUBLIC,
    Permission.READ_COOKIES,
    Permission.READ_STORAGE,
  ],
  allowedProtocols: ["http:", "https:"],
  blockPrivateIPs: true,
  maxQueryDepth: 10,
  maxExecutionTime: 60000, // 1 minute
};

/**
 * Security validator
 */
export class SecurityValidator {
  private policy: SecurityPolicy;
  private queryDepth: number;

  constructor(policy?: Partial<SecurityPolicy>) {
    this.policy = {
      ...DEFAULT_POLICY,
      ...policy,
    };
    this.queryDepth = 0;
  }

  /**
   * Validate a statement
   */
  validate(stmt: Statement): void {
    this.queryDepth = 0;
    this.validateStatement(stmt);
  }

  /**
   * Validate statement recursively
   */
  private validateStatement(stmt: Statement): void {
    this.queryDepth++;

    if (this.queryDepth > this.policy.maxQueryDepth) {
      throw new SecurityError(
        `Maximum query depth of ${this.policy.maxQueryDepth} exceeded`,
        "MAX_DEPTH_EXCEEDED",
      );
    }

    switch (stmt.type) {
      case "NAVIGATE":
        this.validateNavigate(stmt as NavigateStatement);
        break;

      case "SELECT":
        this.validateSelect(stmt as SelectStatement);
        break;

      case "FOR":
        this.validateStatement(stmt.body);
        break;

      case "IF":
        this.validateStatement(stmt.thenBranch);
        if (stmt.elseBranch) {
          this.validateStatement(stmt.elseBranch);
        }
        break;

      case "WITH":
        stmt.ctes.forEach((cte) => this.validateStatement(cte.query));
        this.validateStatement(stmt.query);
        break;
    }

    this.queryDepth--;
  }

  /**
   * Validate NAVIGATE statement
   */
  private validateNavigate(stmt: NavigateStatement): void {
    // Extract URL
    let url = "";
    if (stmt.url.type === "LITERAL") {
      url = stmt.url.value as string;
    } else {
      // Dynamic URL - requires special permission
      this.checkPermission(Permission.NAVIGATE_PRIVATE);
      return;
    }

    // Validate URL
    try {
      const parsed = new URL(url);

      // Check protocol
      if (!this.policy.allowedProtocols.includes(parsed.protocol)) {
        throw new SecurityError(
          `Protocol ${parsed.protocol} not allowed. Allowed protocols: ${
            this.policy.allowedProtocols.join(", ")
          }`,
          "PROTOCOL_NOT_ALLOWED",
        );
      }

      // Check private IPs
      if (this.policy.blockPrivateIPs && this.isPrivateIP(parsed.hostname)) {
        this.checkPermission(Permission.NAVIGATE_PRIVATE);
      }

      // Check allowed/blocked domains
      if (this.policy.allowedDomains && !this.isDomainAllowed(parsed.hostname)) {
        throw new SecurityError(
          `Domain ${parsed.hostname} not in allowed list`,
          "DOMAIN_NOT_ALLOWED",
        );
      }

      if (this.policy.blockedDomains && this.isDomainBlocked(parsed.hostname)) {
        throw new SecurityError(
          `Domain ${parsed.hostname} is blocked`,
          "DOMAIN_BLOCKED",
        );
      }
    } catch (error) {
      if (error instanceof SecurityError) {
        throw error;
      }
      throw new SecurityError(`Invalid URL: ${url}`, "INVALID_URL");
    }

    // Note: screenshot permission would be checked at execution time
    // NavigateOptions doesn't currently have a screenshot field
  }

  /**
   * Validate SELECT statement
   */
  private validateSelect(stmt: SelectStatement): void {
    // Check source
    if (stmt.source.type === "SUBQUERY") {
      this.validateStatement(stmt.source.value as Statement);
    } else if (stmt.source.type === "URL") {
      // Treat as navigation
      const navStmt: NavigateStatement = {
        type: "NAVIGATE",
        url: {
          type: "LITERAL",
          dataType: DataType.URL,
          value: stmt.source.value as string,
        },
      };
      this.validateNavigate(navStmt);
    }
  }

  /**
   * Check if a permission is granted
   */
  private checkPermission(permission: Permission): void {
    if (!this.policy.allowedPermissions.includes(permission)) {
      throw new PermissionError(
        `Permission ${permission} not granted`,
        permission,
      );
    }
  }

  /**
   * Check if hostname is a private IP
   */
  private isPrivateIP(hostname: string): boolean {
    // Check for localhost
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return true;
    }

    // Check for private IPv4 ranges
    const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    const match = hostname.match(ipv4Regex);

    if (match) {
      const [, a, b] = match.map(Number);

      // 10.0.0.0/8
      if (a === 10) return true;

      // 172.16.0.0/12
      if (a === 172 && b >= 16 && b <= 31) return true;

      // 192.168.0.0/16
      if (a === 192 && b === 168) return true;

      // 169.254.0.0/16 (link-local)
      if (a === 169 && b === 254) return true;
    }

    return false;
  }

  /**
   * Check if domain is in allowed list
   */
  private isDomainAllowed(domain: string): boolean {
    if (!this.policy.allowedDomains) {
      return true;
    }

    return this.policy.allowedDomains.some((allowed) => {
      if (allowed.startsWith("*.")) {
        // Wildcard domain
        const suffix = allowed.substring(2);
        return domain.endsWith(suffix);
      }
      return domain === allowed;
    });
  }

  /**
   * Check if domain is in blocked list
   */
  private isDomainBlocked(domain: string): boolean {
    if (!this.policy.blockedDomains) {
      return false;
    }

    return this.policy.blockedDomains.some((blocked) => {
      if (blocked.startsWith("*.")) {
        // Wildcard domain
        const suffix = blocked.substring(2);
        return domain.endsWith(suffix);
      }
      return domain === blocked;
    });
  }

  /**
   * Get current security policy
   */
  getPolicy(): SecurityPolicy {
    return { ...this.policy };
  }

  /**
   * Update security policy
   */
  updatePolicy(policy: Partial<SecurityPolicy>): void {
    this.policy = {
      ...this.policy,
      ...policy,
    };
  }

  /**
   * Get current query depth
   */
  getQueryDepth(): number {
    return this.queryDepth;
  }

  /**
   * Get maximum allowed query depth
   */
  getMaxQueryDepth(): number {
    return this.policy.maxQueryDepth;
  }

  /**
   * Get allowed permissions
   */
  getAllowedPermissions(): Permission[] {
    return [...this.policy.allowedPermissions];
  }

  /**
   * Get allowed protocols
   */
  getAllowedProtocols(): string[] {
    return [...this.policy.allowedProtocols];
  }

  /**
   * Check if a permission is allowed
   */
  hasPermission(permission: Permission): boolean {
    return this.policy.allowedPermissions.includes(permission);
  }
}
