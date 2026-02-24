/**
 * Domain Registry
 *
 * Central registry for all DevTools domains. Manages domain lifecycle,
 * method routing, and event dispatching.
 */

import type { DomainName, ProtocolMethod } from "./types.ts";
import { ProtocolErrorCode } from "./types.ts";
import type { BaseDomain } from "../domains/base-domain.ts";

/**
 * Error class for domain-level protocol errors.
 * Extends Error so that `instanceof Error` checks work and stack traces are preserved.
 */
export class DomainError extends Error {
    readonly code: number;

    constructor(code: number, message: string) {
        super(message);
        this.name = "DomainError";
        this.code = code;
    }
}

/**
 * Domain metadata
 */
export interface DomainMetadata {
    name: DomainName;
    description: string;
    version: string;
    dependencies?: DomainName[];
    experimental?: boolean;
}

/**
 * Domain registry - manages all registered domain agents
 */
export class DomainRegistry {
    private domains: Map<DomainName, BaseDomain> = new Map();
    private metadata: Map<DomainName, DomainMetadata> = new Map();
    private disposed = false;

    /**
     * Register a domain agent with metadata
     */
    register(domain: BaseDomain, meta: DomainMetadata): void {
        this.domains.set(domain.name, domain);
        this.metadata.set(domain.name, meta);
    }

    /**
     * Get a domain agent by name
     */
    getDomain<T extends BaseDomain>(name: DomainName): T | undefined {
        return this.domains.get(name) as T | undefined;
    }

    /**
     * Check if a domain is registered
     */
    hasDomain(name: DomainName): boolean {
        return this.domains.has(name);
    }

    /**
     * Route a method call to the appropriate domain
     */
    async handleMethod(
        method: ProtocolMethod,
        params: Record<string, unknown>,
    ): Promise<Record<string, unknown>> {
        const [domainName, methodName] = this.parseMethod(method);

        const domain = this.domains.get(domainName as DomainName);
        if (!domain) {
            throw new DomainError(
                ProtocolErrorCode.METHOD_NOT_FOUND,
                `Domain "${domainName}" not found`,
            );
        }

        // enable/disable don't require the domain to already be enabled
        if (methodName !== "enable" && methodName !== "disable" && !domain.isEnabled()) {
            throw new DomainError(
                ProtocolErrorCode.DOMAIN_NOT_ENABLED,
                `Domain "${domainName}" is not enabled. Call ${domainName}.enable first.`,
            );
        }

        return await domain.handleMethod(methodName, params);
    }

    /**
     * Get all registered domain metadata
     */
    listDomains(): DomainMetadata[] {
        return Array.from(this.metadata.values());
    }

    /**
     * Get all registered domain names
     */
    getDomainNames(): DomainName[] {
        return Array.from(this.domains.keys());
    }

    /**
     * Unregister a domain by name, disposing it first
     */
    unregister(name: DomainName): boolean {
        const domain = this.domains.get(name);
        if (!domain) return false;
        domain.dispose();
        this.domains.delete(name);
        this.metadata.delete(name);
        return true;
    }

    /**
     * Dispose all domains
     */
    dispose(): void {
        if (this.disposed) return;
        this.disposed = true;
        for (const domain of this.domains.values()) {
            domain.dispose();
        }
        this.domains.clear();
        this.metadata.clear();
    }

    /**
     * Validate that all domain dependencies are registered.
     * Returns an array of error messages (empty if all dependencies are satisfied).
     */
    validateDependencies(): string[] {
        const errors: string[] = [];
        for (const [domain, meta] of this.metadata) {
            for (const dep of meta.dependencies ?? []) {
                if (!this.domains.has(dep)) {
                    errors.push(`Domain "${domain}" depends on "${dep}" which is not registered`);
                }
            }
        }
        return errors;
    }

    /**
     * Parse "Domain.methodName" into [domainName, methodName]
     */
    private parseMethod(method: ProtocolMethod): [string, string] {
        const dotIndex = method.indexOf(".");
        if (dotIndex === -1) {
            throw new DomainError(
                ProtocolErrorCode.INVALID_REQUEST,
                `Invalid method format: "${method}". Expected "Domain.method".`,
            );
        }
        return [method.substring(0, dotIndex), method.substring(dotIndex + 1)];
    }
}
