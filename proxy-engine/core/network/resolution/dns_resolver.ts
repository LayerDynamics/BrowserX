/**
 * DNS Resolver
 *
 * Provides DNS resolution with caching and multiple record type support
 */

/**
 * DNS record types
 */
export enum DNSRecordType {
  A = "A",
  AAAA = "AAAA",
  CNAME = "CNAME",
  MX = "MX",
  TXT = "TXT",
  NS = "NS",
  SOA = "SOA",
  PTR = "PTR",
}

/**
 * DNS record
 */
export interface DNSRecord {
  /**
   * Record type
   */
  type: DNSRecordType;

  /**
   * Record name (domain)
   */
  name: string;

  /**
   * Record value (IP address or other data)
   */
  value: string;

  /**
   * Time to live (seconds)
   */
  ttl: number;

  /**
   * Timestamp when record was cached
   */
  cachedAt: number;
}

/**
 * DNS query options
 */
export interface DNSQueryOptions {
  /**
   * Record type to query
   */
  type?: DNSRecordType;

  /**
   * Timeout for query (milliseconds)
   */
  timeout?: number;

  /**
   * Whether to use cache
   */
  useCache?: boolean;

  /**
   * Custom DNS servers
   */
  servers?: string[];
}

/**
 * DNS resolver configuration
 */
export interface DNSResolverConfig {
  /**
   * Default DNS servers
   */
  servers?: string[];

  /**
   * Enable caching
   */
  enableCache?: boolean;

  /**
   * Cache TTL override (seconds)
   */
  cacheTTL?: number;

  /**
   * Maximum cache size (number of records)
   */
  maxCacheSize?: number;

  /**
   * Query timeout (milliseconds)
   */
  timeout?: number;
}

/**
 * DNS cache entry
 */
interface CacheEntry {
  records: DNSRecord[];
  expiresAt: number;
}

/**
 * DNS Resolver
 *
 * Resolves domain names to IP addresses with caching
 */
export class DNSResolver {
  private cache = new Map<string, CacheEntry>();
  private config: Required<DNSResolverConfig>;

  constructor(config: DNSResolverConfig = {}) {
    this.config = {
      servers: config.servers ?? ["8.8.8.8", "8.8.4.4", "1.1.1.1"],
      enableCache: config.enableCache ?? true,
      cacheTTL: config.cacheTTL ?? 300,
      maxCacheSize: config.maxCacheSize ?? 10000,
      timeout: config.timeout ?? 5000,
    };
  }

  /**
   * Resolve a hostname to IP addresses
   */
  async resolve(
    hostname: string,
    options: DNSQueryOptions = {},
  ): Promise<DNSRecord[]> {
    const type = options.type ?? DNSRecordType.A;
    const useCache = options.useCache ?? this.config.enableCache;

    // Check cache first
    if (useCache) {
      const cached = this.getFromCache(hostname, type);
      if (cached) {
        return cached;
      }
    }

    // Perform DNS lookup using Deno's built-in DNS resolution
    const records = await this.performLookup(hostname, type, options);

    // Cache results
    if (useCache && records.length > 0) {
      this.addToCache(hostname, type, records);
    }

    return records;
  }

  /**
   * Resolve hostname to IPv4 addresses
   */
  async resolveA(hostname: string): Promise<string[]> {
    const records = await this.resolve(hostname, { type: DNSRecordType.A });
    return records.map((r) => r.value);
  }

  /**
   * Resolve hostname to IPv6 addresses
   */
  async resolveAAAA(hostname: string): Promise<string[]> {
    const records = await this.resolve(hostname, { type: DNSRecordType.AAAA });
    return records.map((r) => r.value);
  }

  /**
   * Resolve hostname to any available addresses (A or AAAA)
   */
  async resolveAny(hostname: string): Promise<string[]> {
    try {
      // Try A records first
      const aRecords = await this.resolveA(hostname);
      if (aRecords.length > 0) {
        return aRecords;
      }
    } catch {
      // Ignore A record errors
    }

    try {
      // Try AAAA records
      const aaaaRecords = await this.resolveAAAA(hostname);
      if (aaaaRecords.length > 0) {
        return aaaaRecords;
      }
    } catch {
      // Ignore AAAA record errors
    }

    throw new Error(`Failed to resolve ${hostname}`);
  }

  /**
   * Perform actual DNS lookup
   */
  private async performLookup(
    hostname: string,
    type: DNSRecordType,
    options: DNSQueryOptions,
  ): Promise<DNSRecord[]> {
    const timeout = options.timeout ?? this.config.timeout;

    try {
      // Use Deno's built-in DNS resolution
      const lookupPromise = this.performDenoLookup(hostname, type);

      // Apply timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("DNS query timeout")), timeout);
      });

      const addresses = await Promise.race([lookupPromise, timeoutPromise]);

      // Convert to DNS records
      const now = Date.now();
      return addresses.map((addr) => ({
        type,
        name: hostname,
        value: addr,
        ttl: this.config.cacheTTL,
        cachedAt: now,
      }));
    } catch (error) {
      throw new Error(
        `DNS lookup failed for ${hostname}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Perform DNS lookup using Deno's resolveDns
   */
  private async performDenoLookup(
    hostname: string,
    type: DNSRecordType,
  ): Promise<string[]> {
    try {
      // Use Deno's DNS resolution API
      if (type === DNSRecordType.A) {
        const result = await Deno.resolveDns(hostname, "A");
        return result;
      } else if (type === DNSRecordType.AAAA) {
        const result = await Deno.resolveDns(hostname, "AAAA");
        return result;
      } else if (type === DNSRecordType.CNAME) {
        const result = await Deno.resolveDns(hostname, "CNAME");
        return result;
      } else if (type === DNSRecordType.MX) {
        const result = await Deno.resolveDns(hostname, "MX");
        return result.map((mx) => `${mx.preference} ${mx.exchange}`);
      } else if (type === DNSRecordType.TXT) {
        const result = await Deno.resolveDns(hostname, "TXT");
        return result.flat();
      } else if (type === DNSRecordType.NS) {
        const result = await Deno.resolveDns(hostname, "NS");
        return result;
      } else if (type === DNSRecordType.PTR) {
        const result = await Deno.resolveDns(hostname, "PTR");
        return result;
      }

      throw new Error(`Unsupported DNS record type: ${type}`);
    } catch (error) {
      throw new Error(
        `Deno DNS lookup failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Get records from cache
   */
  private getFromCache(hostname: string, type: DNSRecordType): DNSRecord[] | null {
    const key = this.getCacheKey(hostname, type);
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if cache entry has expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.records;
  }

  /**
   * Add records to cache
   */
  private addToCache(hostname: string, type: DNSRecordType, records: DNSRecord[]): void {
    // Enforce cache size limit
    if (this.cache.size >= this.config.maxCacheSize) {
      // Remove oldest entries
      const entriesToRemove = this.cache.size - this.config.maxCacheSize + 1;
      const keys = Array.from(this.cache.keys());
      for (let i = 0; i < entriesToRemove; i++) {
        this.cache.delete(keys[i]);
      }
    }

    const key = this.getCacheKey(hostname, type);
    const ttl = records[0]?.ttl ?? this.config.cacheTTL;
    const expiresAt = Date.now() + ttl * 1000;

    this.cache.set(key, { records, expiresAt });
  }

  /**
   * Generate cache key
   */
  private getCacheKey(hostname: string, type: DNSRecordType): string {
    return `${type}:${hostname.toLowerCase()}`;
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Clear expired cache entries
   */
  clearExpiredCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
  } {
    return {
      size: this.cache.size,
      maxSize: this.config.maxCacheSize,
      hitRate: 0, // Would need to track hits/misses to calculate
    };
  }

  /**
   * Get resolver configuration
   */
  getConfig(): Readonly<Required<DNSResolverConfig>> {
    return { ...this.config };
  }

  /**
   * Get cache size
   */
  getCacheSize(): number {
    return this.cache.size;
  }
}
