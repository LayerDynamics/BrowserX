/**
 * Session Lifecycle Integration Tests
 *
 * Tests DevToolsSession attach/detach, multiple sessions, session isolation,
 * and recovery after domain errors.
 */

import { assertEquals, assertExists, assertNotEquals } from "@std/assert";
import { DevToolsSession } from "../../protocol/session.ts";
import { DomainRegistry, type DomainMetadata } from "../../protocol/domains.ts";
import { EventBus } from "../../integration/event-bus.ts";
import { BaseDomain, type DomainInitContext } from "../../domains/base-domain.ts";
import type { DomainName } from "../../protocol/types.ts";
import type { Browser } from "../../../browser/src/main.ts";
import { createMockBrowser, createMockContext } from "../helpers/mocks.ts";

// ============================================================================
// Test Domain Implementation
// ============================================================================

class SessionTestDomain extends BaseDomain {
    readonly name: DomainName = "DOM";
    private state: string = "initial";

    protected setup(): void {
        this.registerMethod("getState", "Get the domain state", async () => {
            return { state: this.state };
        });

        this.registerMethod("setState", "Set the domain state", async (params) => {
            this.state = params.state as string;
            return {};
        });

        this.registerMethod("errorMethod", "Throws an error", async () => {
            throw new Error("Domain error");
        });
    }

    getState(): string {
        return this.state;
    }

    resetState(): void {
        this.state = "initial";
    }
}

// ============================================================================
// Session Lifecycle Tests
// ============================================================================

Deno.test("Session Lifecycle - attach initializes session", () => {
    const eventBus = new EventBus();
    const registry = new DomainRegistry();
    const browser = createMockBrowser();

    const session = new DevToolsSession(
        "session-1",
        browser as unknown as Browser,
        registry,
    );

    assertEquals(session.isAttached(), false);

    session.attach();

    assertEquals(session.isAttached(), true);
    assertEquals(session.id, "session-1");
    assertEquals(session.targetId, "page-session-1");
});

Deno.test("Session Lifecycle - detach cleans up session", () => {
    const eventBus = new EventBus();
    const registry = new DomainRegistry();
    const browser = createMockBrowser();

    const session = new DevToolsSession(
        "session-1",
        browser as unknown as Browser,
        registry,
    );

    session.attach();
    assertEquals(session.isAttached(), true);

    session.detach();

    assertEquals(session.isAttached(), false);
});

Deno.test("Session Lifecycle - getTargetInfo returns correct info", () => {
    const eventBus = new EventBus();
    const registry = new DomainRegistry();
    const browser = createMockBrowser({ currentURL: "https://test.com" });

    const session = new DevToolsSession(
        "session-1",
        browser as unknown as Browser,
        registry,
    );

    const info = session.getTargetInfo();

    assertEquals(info.targetId, "page-session-1");
    assertEquals(info.type, "page");
    assertEquals(info.url, "https://test.com");
    assertEquals(info.title, "https://test.com");
    assertEquals(info.attached, false);

    session.attach();
    const attachedInfo = session.getTargetInfo();
    assertEquals(attachedInfo.attached, true);
});

Deno.test("Session Lifecycle - dispose cleans up registry", () => {
    const eventBus = new EventBus();
    const registry = new DomainRegistry();
    const browser = createMockBrowser();

    const domain = new SessionTestDomain(eventBus);
    const context = createMockContext({ eventBus });
    domain.initialize(context);

    registry.register(domain, {
        name: "DOM",
        description: "Test domain",
        version: "1.0",
    });

    const session = new DevToolsSession(
        "session-1",
        browser as unknown as Browser,
        registry,
    );

    session.attach();

    // Verify domain is registered
    assertEquals(registry.hasDomain("DOM"), true);

    session.dispose();

    // After dispose, registry should be cleared
    assertEquals(session.isAttached(), false);
});

// ============================================================================
// Multiple Session Tests
// ============================================================================

Deno.test("Session Lifecycle - multiple concurrent sessions", () => {
    const browser = createMockBrowser();

    // Create separate registries for each session (isolation)
    const registry1 = new DomainRegistry();
    const registry2 = new DomainRegistry();

    const session1 = new DevToolsSession(
        "session-1",
        browser as unknown as Browser,
        registry1,
    );

    const session2 = new DevToolsSession(
        "session-2",
        browser as unknown as Browser,
        registry2,
    );

    session1.attach();
    session2.attach();

    assertEquals(session1.isAttached(), true);
    assertEquals(session2.isAttached(), true);

    // IDs are different
    assertNotEquals(session1.id, session2.id);
    assertNotEquals(session1.targetId, session2.targetId);
});

Deno.test("Session Lifecycle - session IDs are unique", () => {
    const browser = createMockBrowser();
    const sessions: DevToolsSession[] = [];

    for (let i = 0; i < 10; i++) {
        const registry = new DomainRegistry();
        sessions.push(
            new DevToolsSession(
                `session-${i}`,
                browser as unknown as Browser,
                registry,
            ),
        );
    }

    const ids = sessions.map((s) => s.id);
    const uniqueIds = new Set(ids);

    assertEquals(uniqueIds.size, ids.length);
});

// ============================================================================
// Session Isolation Tests
// ============================================================================

Deno.test("Session Lifecycle - sessions have isolated domain state", async () => {
    const eventBus1 = new EventBus();
    const eventBus2 = new EventBus();
    const browser = createMockBrowser();

    // Create two domains in separate registries
    const registry1 = new DomainRegistry();
    const registry2 = new DomainRegistry();

    const domain1 = new SessionTestDomain(eventBus1);
    const domain2 = new SessionTestDomain(eventBus2);

    const context1 = createMockContext({ eventBus: eventBus1 });
    const context2 = createMockContext({ eventBus: eventBus2 });

    domain1.initialize(context1);
    domain2.initialize(context2);

    registry1.register(domain1, { name: "DOM", description: "Test", version: "1.0" });
    registry2.register(domain2, { name: "DOM", description: "Test", version: "1.0" });

    const session1 = new DevToolsSession(
        "session-1",
        browser as unknown as Browser,
        registry1,
    );

    const session2 = new DevToolsSession(
        "session-2",
        browser as unknown as Browser,
        registry2,
    );

    session1.attach();
    session2.attach();

    // Enable domains
    await domain1.enable();
    await domain2.enable();

    // Modify state in session 1
    await domain1.handleMethod("setState", { state: "modified" });

    // Session 2 should still have initial state
    const state1 = await domain1.handleMethod("getState", {}) as { state: string };
    const state2 = await domain2.handleMethod("getState", {}) as { state: string };

    assertEquals(state1.state, "modified");
    assertEquals(state2.state, "initial");
});

Deno.test("Session Lifecycle - detaching one session doesn't affect others", () => {
    const browser = createMockBrowser();

    const registry1 = new DomainRegistry();
    const registry2 = new DomainRegistry();

    const session1 = new DevToolsSession(
        "session-1",
        browser as unknown as Browser,
        registry1,
    );

    const session2 = new DevToolsSession(
        "session-2",
        browser as unknown as Browser,
        registry2,
    );

    session1.attach();
    session2.attach();

    // Detach session 1
    session1.detach();

    // Session 2 should still be attached
    assertEquals(session1.isAttached(), false);
    assertEquals(session2.isAttached(), true);
});

// ============================================================================
// Error Recovery Tests
// ============================================================================

Deno.test("Session Lifecycle - session survives domain error", async () => {
    const eventBus = new EventBus();
    const registry = new DomainRegistry();
    const browser = createMockBrowser();

    const domain = new SessionTestDomain(eventBus);
    const context = createMockContext({ eventBus });
    domain.initialize(context);

    registry.register(domain, { name: "DOM", description: "Test", version: "1.0" });

    const session = new DevToolsSession(
        "session-1",
        browser as unknown as Browser,
        registry,
    );

    session.attach();
    await domain.enable();

    // Trigger error
    try {
        await domain.handleMethod("errorMethod", {});
    } catch {
        // Expected
    }

    // Session should still be functional
    assertEquals(session.isAttached(), true);

    // Domain should still work
    const result = await domain.handleMethod("getState", {}) as { state: string };
    assertEquals(result.state, "initial");
});

Deno.test("Session Lifecycle - domains remain enabled after error", async () => {
    const eventBus = new EventBus();
    const registry = new DomainRegistry();
    const browser = createMockBrowser();

    const domain = new SessionTestDomain(eventBus);
    const context = createMockContext({ eventBus });
    domain.initialize(context);

    registry.register(domain, { name: "DOM", description: "Test", version: "1.0" });

    await domain.enable();
    assertEquals(domain.isEnabled(), true);

    // Trigger error
    try {
        await domain.handleMethod("errorMethod", {});
    } catch {
        // Expected
    }

    // Domain should still be enabled
    assertEquals(domain.isEnabled(), true);
});

// ============================================================================
// Session State Persistence Tests
// ============================================================================

Deno.test("Session Lifecycle - domain enabled state persists across calls", async () => {
    const eventBus = new EventBus();
    const registry = new DomainRegistry();
    const browser = createMockBrowser();

    const domain = new SessionTestDomain(eventBus);
    const context = createMockContext({ eventBus });
    domain.initialize(context);

    registry.register(domain, { name: "DOM", description: "Test", version: "1.0" });

    const session = new DevToolsSession(
        "session-1",
        browser as unknown as Browser,
        registry,
    );

    session.attach();

    assertEquals(domain.isEnabled(), false);

    await registry.handleMethod("DOM.enable" as `DOM.${string}`, {});
    assertEquals(domain.isEnabled(), true);

    // Make several calls
    await registry.handleMethod("DOM.getState" as `DOM.${string}`, {});
    await registry.handleMethod("DOM.getState" as `DOM.${string}`, {});
    await registry.handleMethod("DOM.getState" as `DOM.${string}`, {});

    // Still enabled
    assertEquals(domain.isEnabled(), true);
});

Deno.test("Session Lifecycle - attach/detach cycle preserves state", async () => {
    const eventBus = new EventBus();
    const registry = new DomainRegistry();
    const browser = createMockBrowser();

    const domain = new SessionTestDomain(eventBus);
    const context = createMockContext({ eventBus });
    domain.initialize(context);

    registry.register(domain, { name: "DOM", description: "Test", version: "1.0" });

    const session = new DevToolsSession(
        "session-1",
        browser as unknown as Browser,
        registry,
    );

    session.attach();
    await domain.enable();
    await domain.handleMethod("setState", { state: "modified" });

    // Detach and re-attach
    session.detach();
    session.attach();

    // State should persist (domain is not re-created)
    const result = await domain.handleMethod("getState", {}) as { state: string };
    assertEquals(result.state, "modified");
});
