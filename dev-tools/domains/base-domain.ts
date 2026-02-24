/**
 * Base Domain Agent
 *
 * Abstract class for all DevTools domain agents.
 * Provides method registration, event emission, and lifecycle management.
 * Every domain (DOM, CSS, Network, etc.) extends this class.
 */

import type {
    DomainName,
    MethodHandler,
    ProtocolEvent,
    EventDefinition,
    MethodDefinition,
    ProtocolMethod,
} from "../protocol/types.ts";
import type { EventBus } from "../integration/event-bus.ts";
import type { DomainRegistry } from "../protocol/domains.ts";
import type { Browser } from "../../browser/src/main.ts";
import type { RequestPipeline } from "../../browser/src/engine/RequestPipeline.ts";
import type { RenderingPipeline } from "../../browser/src/engine/RenderingPipeline.ts";
import type { StorageManager } from "../../browser/src/engine/storage/StorageManager.ts";
import type { CookieManager } from "../../browser/src/engine/storage/CookieManager.ts";
import type { QuotaManager } from "../../browser/src/engine/storage/QuotaManager.ts";

/**
 * Context passed to each domain during initialization.
 * Contains references to all browser subsystems.
 */
export interface DomainInitContext {
    browser: Browser;
    requestPipeline: RequestPipeline;
    renderingPipeline: RenderingPipeline;
    storageManager: StorageManager;
    cookieManager: CookieManager;
    quotaManager: QuotaManager;
    eventBus: EventBus;
}

/**
 * Abstract base class for all domain agents
 */
export abstract class BaseDomain {
    /** Domain name (e.g., "DOM", "CSS") */
    abstract readonly name: DomainName;

    /** Whether this domain is currently enabled */
    protected enabled: boolean = false;

    /** Initialization context with browser subsystem references */
    private _context: DomainInitContext | undefined;

    /** Access the initialization context, throwing if not yet initialized */
    protected get context(): DomainInitContext {
        if (!this._context) {
            throw new Error(`Domain "${this.name}" not initialized — call initialize() before accessing context`);
        }
        return this._context;
    }

    protected set context(value: DomainInitContext) {
        this._context = value;
    }

    /** Event bus for cross-domain communication */
    protected eventBus: EventBus;

    /** Domain registry for cross-domain resolution */
    private _registry: DomainRegistry | null = null;

    /** Cached result of getMethodNames() */
    private _methodNamesCache: string[] | null = null;

    /** Registered methods: methodName -> definition */
    private methods: Map<string, MethodDefinition> = new Map();

    /** Registered event definitions */
    private events: Map<string, EventDefinition> = new Map();

    /** Event listeners waiting for events from this domain */
    private eventListeners: Array<(event: ProtocolEvent) => void> = [];

    constructor(eventBus: EventBus) {
        this.eventBus = eventBus;
    }

    /**
     * Set the domain registry for cross-domain resolution.
     * Called after all domains are registered.
     */
    setRegistry(registry: DomainRegistry): void {
        this._registry = registry;
    }

    /**
     * Resolve a sibling domain by name.
     * Returns null if registry is not set or domain not found.
     */
    protected resolveDomain(name: DomainName): BaseDomain | null {
        return this._registry?.getDomain(name) ?? null;
    }

    /**
     * Initialize the domain with browser subsystem context.
     * Called once during DevTools setup.
     */
    initialize(context: DomainInitContext): void {
        this.context = context;
        this.setup();
    }

    /**
     * Domain-specific setup - override to register methods and events.
     * Called after context is set.
     */
    protected abstract setup(): void;

    /**
     * Enable the domain - called when a client sends "Domain.enable"
     */
    async enable(): Promise<Record<string, unknown>> {
        this.enabled = true;
        return {};
    }

    /**
     * Disable the domain - called when a client sends "Domain.disable"
     */
    async disable(): Promise<Record<string, unknown>> {
        this.enabled = false;
        return {};
    }

    /**
     * Check if domain is enabled
     */
    isEnabled(): boolean {
        return this.enabled;
    }

    /**
     * Register a method handler
     */
    protected registerMethod(name: string, description: string, handler: MethodHandler): void {
        this.methods.set(name, { name, description, handler });
        this._methodNamesCache = null; // Invalidate cache
    }

    /**
     * Register an event type this domain can emit
     */
    protected registerEvent(name: string, description: string): void {
        this.events.set(name, { name, description });
    }

    /**
     * Emit an event to all listeners
     */
    protected emitEvent(eventName: string, params?: Record<string, unknown>): void {
        const method = `${this.name}.${eventName}` as ProtocolMethod;
        const event: ProtocolEvent = { method, params };

        // Notify direct listeners
        for (const listener of this.eventListeners) {
            try {
                listener(event);
            } catch (error) {
                console.error(`${this.name}: Error in event listener for "${eventName}":`, error);
            }
        }

        // Notify event bus
        this.eventBus.emit(method, params);
    }

    /**
     * Add event listener for protocol events from this domain
     */
    addEventListener(listener: (event: ProtocolEvent) => void): void {
        this.eventListeners.push(listener);
    }

    /**
     * Remove event listener
     */
    removeEventListener(listener: (event: ProtocolEvent) => void): void {
        const index = this.eventListeners.indexOf(listener);
        if (index !== -1) {
            this.eventListeners.splice(index, 1);
        }
    }

    /**
     * Handle a method call by name
     */
    async handleMethod(
        methodName: string,
        params: Record<string, unknown>,
    ): Promise<Record<string, unknown>> {
        // Handle built-in enable/disable
        if (methodName === "enable") {
            return await this.enable();
        }
        if (methodName === "disable") {
            return await this.disable();
        }

        const definition = this.methods.get(methodName);
        if (!definition) {
            throw new Error(`Method "${this.name}.${methodName}" not found`);
        }

        return await definition.handler(params);
    }

    /**
     * Get all registered method names
     */
    getMethodNames(): string[] {
        if (!this._methodNamesCache) {
            this._methodNamesCache = ["enable", "disable", ...this.methods.keys()];
        }
        return this._methodNamesCache;
    }

    /**
     * Get all registered event names
     */
    getEventNames(): string[] {
        return [...this.events.keys()];
    }

    /**
     * Get the last render result from the rendering pipeline.
     * Centralizes the cast chain so every domain uses a single access pattern.
     */
    protected getLastRenderResult(): { dom?: any; cssom?: any; renderTree?: any; layoutTree?: any; displayList?: any; timing?: any; resources?: any[]; scriptExecutor?: any } | null {
        try {
            const pipeline = this.context.renderingPipeline;
            return (pipeline as { lastRenderResult?: any }).lastRenderResult ?? null;
        } catch {
            return null;
        }
    }

    /**
     * Cleanup resources
     */
    dispose(): void {
        this.eventListeners = [];
        this.methods.clear();
        this.events.clear();
        this._methodNamesCache = null;
        this.enabled = false;
    }
}
