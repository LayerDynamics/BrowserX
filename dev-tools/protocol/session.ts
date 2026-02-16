/**
 * DevTools Session
 *
 * Manages a debugging session associating a DevTools connection
 * with a specific Browser target. Each session has its own domain registry.
 */

import type { SessionID, TargetID } from "./types.ts";
import type { Browser } from "../../browser/src/main.ts";
import { DomainRegistry } from "./domains.ts";

/**
 * Target info (what can be debugged)
 */
export interface TargetInfo {
    targetId: TargetID;
    type: "page" | "browser" | "service_worker";
    title: string;
    url: string;
    attached: boolean;
}

/**
 * DevTools session - connects a client to a browser target
 */
export class DevToolsSession {
    readonly id: SessionID;
    readonly targetId: TargetID;
    readonly browser: Browser;
    readonly domains: DomainRegistry;
    private attached: boolean = false;

    constructor(id: SessionID, browser: Browser, domains: DomainRegistry) {
        this.id = id;
        this.targetId = `page-${id}`;
        this.browser = browser;
        this.domains = domains;
    }

    /**
     * Attach to the target
     */
    attach(): void {
        this.attached = true;
    }

    /**
     * Detach from the target
     */
    detach(): void {
        this.attached = false;
    }

    /**
     * Check if session is attached
     */
    isAttached(): boolean {
        return this.attached;
    }

    /**
     * Get target info
     */
    getTargetInfo(): TargetInfo {
        return {
            targetId: this.targetId,
            type: "page",
            title: this.browser.getCurrentURL() || "about:blank",
            url: this.browser.getCurrentURL() || "about:blank",
            attached: this.attached,
        };
    }

    /**
     * Dispose session and cleanup
     */
    dispose(): void {
        this.attached = false;
        this.domains.dispose();
    }
}
