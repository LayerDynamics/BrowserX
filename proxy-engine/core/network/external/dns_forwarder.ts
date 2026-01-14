/**
 * DNS Forwarder
 *
 * Forward DNS queries to external DNS resolvers (8.8.8.8, 1.1.1.1, etc.)
 */

import { DNSRecord, DNSRecordType } from "../resolution/dns_resolver.ts";

/**
 * DNS query result
 */
export interface DNSQueryResult {
  question: string;
  answers: DNSRecord[];
  cached: boolean;
  resolver: string;
  duration: number;
}

/**
 * DNS cache entry
 */
interface DNSCacheEntry {
  answers: DNSRecord[];
  expiresAt: number;
}

/**
 * DNS forwarder options
 */
export interface DNSForwarderOptions {
  resolvers?: string[];
  timeout?: number;
  cache?: boolean;
  cacheTTL?: number;
  retries?: number;
}

/**
 * DNS forwarder for external resolution
 */
export class DNSForwarder {
  private resolvers: string[];
  private timeout: number;
  private cache: Map<string, DNSCacheEntry>;
  private cacheEnabled: boolean;
  private cacheTTL: number;
  private retries: number;

  constructor(options: DNSForwarderOptions = {}) {
    this.resolvers = options.resolvers || [
      "8.8.8.8", // Google DNS
      "8.8.4.4", // Google DNS secondary
      "1.1.1.1", // Cloudflare DNS
      "1.0.0.1", // Cloudflare DNS secondary
    ];
    this.timeout = options.timeout || 5000;
    this.cacheEnabled = options.cache !== false;
    this.cacheTTL = options.cacheTTL || 300; // 5 minutes
    this.retries = options.retries || 2;
    this.cache = new Map();
  }

  /**
   * Resolve hostname to IP addresses
   */
  async resolve(
    hostname: string,
    type: DNSRecordType = DNSRecordType.A,
  ): Promise<DNSQueryResult> {
    const cacheKey = `${hostname}:${type}`;

    // Check cache
    if (this.cacheEnabled) {
      const cached = this.cache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        return {
          question: hostname,
          answers: cached.answers,
          cached: true,
          resolver: "cache",
          duration: 0,
        };
      }
    }

    // Try each resolver
    const startTime = Date.now();
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.retries; attempt++) {
      for (const resolver of this.resolvers) {
        try {
          const answers = await this.queryResolver(resolver, hostname, type);
          const duration = Date.now() - startTime;

          // Cache result
          if (this.cacheEnabled && answers.length > 0) {
            const minTTL = Math.min(...answers.map((a) => a.ttl));
            this.cache.set(cacheKey, {
              answers,
              expiresAt: Date.now() + Math.min(minTTL, this.cacheTTL) * 1000,
            });
          }

          return {
            question: hostname,
            answers,
            cached: false,
            resolver,
            duration,
          };
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          // Try next resolver
          continue;
        }
      }
    }

    throw lastError || new Error("All DNS resolvers failed");
  }

  /**
   * Query specific resolver
   */
  private async queryResolver(
    resolver: string,
    hostname: string,
    type: DNSRecordType,
  ): Promise<DNSRecord[]> {
    // Use Deno's built-in DNS resolver
    // Note: This is a simplified implementation
    // A full implementation would build and parse DNS packets

    try {
      if (type === DNSRecordType.A) {
        // Resolve A record (IPv4)
        const addresses = await Deno.resolveDns(hostname, "A");
        return addresses.map((addr) => ({
          name: hostname,
          type: DNSRecordType.A,
          value: addr,
          ttl: this.cacheTTL,
          cachedAt: Date.now(),
        }));
      } else if (type === DNSRecordType.AAAA) {
        // Resolve AAAA record (IPv6)
        const addresses = await Deno.resolveDns(hostname, "AAAA");
        return addresses.map((addr) => ({
          name: hostname,
          type: DNSRecordType.AAAA,
          value: addr,
          ttl: this.cacheTTL,
          cachedAt: Date.now(),
        }));
      } else if (type === DNSRecordType.CNAME) {
        const cnames = await Deno.resolveDns(hostname, "CNAME");
        return cnames.map((cname) => ({
          name: hostname,
          type: DNSRecordType.CNAME,
          value: cname,
          ttl: this.cacheTTL,
          cachedAt: Date.now(),
        }));
      } else if (type === DNSRecordType.MX) {
        const mxRecords = await Deno.resolveDns(hostname, "MX");
        return mxRecords.map((mx) => ({
          name: hostname,
          type: DNSRecordType.MX,
          value: typeof mx === "string" ? mx : `${mx.preference} ${mx.exchange}`,
          ttl: this.cacheTTL,
          cachedAt: Date.now(),
        }));
      } else if (type === DNSRecordType.TXT) {
        const txtRecords = await Deno.resolveDns(hostname, "TXT");
        return txtRecords.map((txt) => ({
          name: hostname,
          type: DNSRecordType.TXT,
          value: Array.isArray(txt) ? txt.join("") : txt,
          ttl: this.cacheTTL,
          cachedAt: Date.now(),
        }));
      }

      throw new Error(`Unsupported DNS record type: ${type}`);
    } catch (error) {
      throw new Error(
        `DNS resolution failed for ${hostname}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /**
   * Resolve hostname to first IPv4 address
   */
  async resolveIPv4(hostname: string): Promise<string> {
    const result = await this.resolve(hostname, DNSRecordType.A);
    if (result.answers.length === 0) {
      throw new Error(`No A records found for ${hostname}`);
    }
    return result.answers[0].value;
  }

  /**
   * Resolve hostname to first IPv6 address
   */
  async resolveIPv6(hostname: string): Promise<string> {
    const result = await this.resolve(hostname, DNSRecordType.AAAA);
    if (result.answers.length === 0) {
      throw new Error(`No AAAA records found for ${hostname}`);
    }
    return result.answers[0].value;
  }

  /**
   * Clear DNS cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Clear expired cache entries
   */
  cleanCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt <= now) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get cache size
   */
  getCacheSize(): number {
    return this.cache.size;
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    entries: Array<{ key: string; expiresIn: number }>;
  } {
    const now = Date.now();
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.entries()).map(([key, entry]) => ({
        key,
        expiresIn: Math.max(0, entry.expiresAt - now),
      })),
    };
  }
}

/**
 * Global DNS forwarder instance
 */
export const globalDNSForwarder = new DNSForwarder();
