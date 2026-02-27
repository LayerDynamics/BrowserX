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
        this.validateStatement(stmt.then);
        if (stmt.else) {
          this.validateStatement(stmt.else);
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

      // Check protocol (normalize: parsed.protocol has trailing colon, config may not)
      const normalizedProtocol = parsed.protocol.replace(/:$/, "");
      if (!this.policy.allowedProtocols.some((p) => p.replace(/:$/, "") === normalizedProtocol)) {
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
      if (error instanceof SecurityError || error instanceof PermissionError) {
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
   * Expand any IPv6 address to its full 8-group hex form.
   */
  private expandIPv6(addr: string): string {
    let working = addr.toLowerCase().trim();

    // Strip zone ID
    const zoneIdx = working.indexOf("%");
    if (zoneIdx !== -1) {
      working = working.substring(0, zoneIdx);
    }

    // Handle IPv4 suffix (e.g., ::ffff:127.0.0.1)
    const ipv4Suffix = working.match(/:(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (ipv4Suffix) {
      const [fullMatch, a, b, c, d] = ipv4Suffix;
      const hi = ((parseInt(a) << 8) | parseInt(b)).toString(16).padStart(4, "0");
      const lo = ((parseInt(c) << 8) | parseInt(d)).toString(16).padStart(4, "0");
      working = working.substring(0, working.length - fullMatch.length + 1) + hi + ":" + lo;
    }

    const halves = working.split("::");
    let groups: string[];

    if (halves.length === 2) {
      const left = halves[0] ? halves[0].split(":") : [];
      const right = halves[1] ? halves[1].split(":") : [];
      const missing = 8 - left.length - right.length;
      const middle = Array(missing).fill("0000");
      groups = [...left, ...middle, ...right];
    } else {
      groups = working.split(":");
    }

    return groups.map((g) => g.padStart(4, "0")).join(":");
  }

  /**
   * Check if an IPv4 address is private/reserved
   */
  private isPrivateIPv4(a: number, b: number, _c: number, _d: number): boolean {
    if (a === 10) return true;                          // 10.0.0.0/8
    if (a === 172 && b >= 16 && b <= 31) return true;   // 172.16.0.0/12
    if (a === 192 && b === 168) return true;             // 192.168.0.0/16
    if (a === 169 && b === 254) return true;             // 169.254.0.0/16 (link-local)
    if (a === 127) return true;                          // 127.0.0.0/8 (loopback)
    if (a === 0) return true;                            // 0.0.0.0/8
    return false;
  }

  /**
   * Check if hostname is a private IP (IPv4, IPv6, obfuscated)
   */
  private isPrivateIP(hostname: string): boolean {
    // Strip brackets from IPv6
    let host = hostname;
    if (host.startsWith("[") && host.endsWith("]")) {
      host = host.slice(1, -1);
    }

    // Localhost
    if (host === "localhost" || host === "127.0.0.1" || host === "::1") {
      return true;
    }

    const hostLower = host.toLowerCase();

    // IPv6 loopback (expanded forms)
    if (hostLower === "0:0:0:0:0:0:0:1" || hostLower === "0000:0000:0000:0000:0000:0000:0000:0001") {
      return true;
    }

    // IPv6 unique-local (fc00::/7)
    if (hostLower.startsWith("fc") || hostLower.startsWith("fd")) {
      if (hostLower.length > 2 && (hostLower[2] === ":" || /^[0-9a-f]/.test(hostLower[2]))) {
        return true;
      }
    }

    // IPv6 link-local (fe80::/10)
    if (hostLower.startsWith("fe80:") || hostLower.startsWith("fe80%")) {
      return true;
    }

    // IPv4-mapped IPv6 (::ffff:x.x.x.x)
    const mappedMatch = hostLower.match(/^::ffff:(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (mappedMatch) {
      const [, a, b, c, d] = mappedMatch.map(Number);
      return this.isPrivateIPv4(a, b, c, d);
    }

    // Standard IPv4
    const ipv4Match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (ipv4Match) {
      const [, a, b, c, d] = ipv4Match.map(Number);
      return this.isPrivateIPv4(a, b, c, d);
    }

    // Decimal IP (e.g., 2130706433 = 127.0.0.1)
    if (/^\d{1,10}$/.test(host)) {
      const num = parseInt(host, 10);
      if (num >= 0 && num <= 0xFFFFFFFF) {
        return this.isPrivateIPv4((num >>> 24) & 0xFF, (num >>> 16) & 0xFF, (num >>> 8) & 0xFF, num & 0xFF);
      }
    }

    // Octal/hex notation (e.g., 0177.0.0.1 or 0x7f.0.0.1)
    const parts = host.split(".");
    if (parts.length === 4) {
      const hasOctalOrHex = parts.some((p) => /^0[0-7]+$/.test(p) || /^0x[0-9a-fA-F]+$/i.test(p));
      if (hasOctalOrHex) {
        const octets = parts.map((p) => {
          if (p.startsWith("0x") || p.startsWith("0X")) return parseInt(p, 16);
          if (p.startsWith("0") && p.length > 1) return parseInt(p, 8);
          return parseInt(p, 10);
        });
        if (octets.every((o) => o >= 0 && o <= 255)) {
          return this.isPrivateIPv4(octets[0], octets[1], octets[2], octets[3]);
        }
      }
    }

    // Comprehensive IPv6 check via full expansion
    if (host.includes(":")) {
      const expanded = this.expandIPv6(host);

      // Loopback ::1
      if (expanded === "0000:0000:0000:0000:0000:0000:0000:0001") {
        return true;
      }

      // Link-local fe80::/10
      if (expanded.startsWith("fe80:")) {
        return true;
      }

      // Unique-local fc00::/7
      if (expanded.startsWith("fc") || expanded.startsWith("fd")) {
        return true;
      }

      // IPv4-mapped ::ffff:x.x.x.x
      if (expanded.startsWith("0000:0000:0000:0000:0000:ffff:")) {
        const tail = expanded.substring(30);
        const tailParts = tail.split(":");
        if (tailParts.length === 2) {
          const hi = parseInt(tailParts[0], 16);
          const lo = parseInt(tailParts[1], 16);
          const a = (hi >> 8) & 0xFF, b = hi & 0xFF;
          const c = (lo >> 8) & 0xFF, d = lo & 0xFF;
          return this.isPrivateIPv4(a, b, c, d);
        }
      }

      // NAT64 prefix 64:ff9b::/96
      if (expanded.startsWith("0064:ff9b:0000:0000:0000:0000:")) {
        const tail = expanded.substring(30);
        const tailParts = tail.split(":");
        if (tailParts.length === 2) {
          const hi = parseInt(tailParts[0], 16);
          const lo = parseInt(tailParts[1], 16);
          const a = (hi >> 8) & 0xFF, b = hi & 0xFF;
          const c = (lo >> 8) & 0xFF, d = lo & 0xFF;
          return this.isPrivateIPv4(a, b, c, d);
        }
      }
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
        // Wildcard domain — require dot boundary to prevent notexample.com matching *.example.com
        const suffix = allowed.substring(2);
        return domain === suffix || domain.endsWith("." + suffix);
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
        // Wildcard domain — require dot boundary
        const suffix = blocked.substring(2);
        return domain === suffix || domain.endsWith("." + suffix);
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
