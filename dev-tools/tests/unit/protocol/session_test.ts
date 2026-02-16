/**
 * Tests for DevToolsSession
 *
 * Covers constructor, attach/detach, isAttached, getTargetInfo, and dispose.
 */

import { assertEquals } from "@std/assert";
import { DevToolsSession } from "../../../protocol/session.ts";
import { DomainRegistry } from "../../../protocol/domains.ts";
import { createMockBrowser, createMockContext } from "../../helpers/mocks.ts";
import { EventBus } from "../../../integration/event-bus.ts";
import { BaseDomain } from "../../../domains/base-domain.ts";
import type { DomainName } from "../../../protocol/types.ts";
import type { Browser } from "../../../../browser/src/main.ts";

// ---------------------------------------------------------------------------
// Concrete domain used for dispose test
// ---------------------------------------------------------------------------

class DisposeTestDomain extends BaseDomain {
    readonly name: DomainName = "DOM";
    protected setup(): void {
        this.registerMethod("test", "test method", async () => ({}));
    }
}

// ---------------------------------------------------------------------------
// Helper to create a session with mock dependencies
// ---------------------------------------------------------------------------

function createSession(options?: {
    id?: string;
    currentURL?: string;
}): {
    session: DevToolsSession;
    browser: ReturnType<typeof createMockBrowser>;
    domains: DomainRegistry;
} {
    const browser = createMockBrowser({
        currentURL: options?.currentURL ?? "https://example.com",
    });
    const domains = new DomainRegistry();
    const session = new DevToolsSession(
        options?.id ?? "session-1",
        browser as unknown as Browser,
        domains,
    );
    return { session, browser, domains };
}

// ---------------------------------------------------------------------------
// Constructor
// ---------------------------------------------------------------------------

Deno.test("constructor sets id correctly", () => {
    const { session } = createSession({ id: "my-session" });
    assertEquals(session.id, "my-session");
});

Deno.test("constructor sets targetId to page-{id}", () => {
    const { session } = createSession({ id: "abc-123" });
    assertEquals(session.targetId, "page-abc-123");
});

Deno.test("constructor assigns browser reference", () => {
    const { session, browser } = createSession();
    assertEquals(session.browser, browser as unknown as Browser);
});

Deno.test("constructor assigns domains registry", () => {
    const { session, domains } = createSession();
    assertEquals(session.domains, domains);
});

Deno.test("session starts in detached state", () => {
    const { session } = createSession();
    assertEquals(session.isAttached(), false);
});

// ---------------------------------------------------------------------------
// attach() and detach()
// ---------------------------------------------------------------------------

Deno.test("attach sets session to attached state", () => {
    const { session } = createSession();
    session.attach();
    assertEquals(session.isAttached(), true);
});

Deno.test("detach sets session to detached state", () => {
    const { session } = createSession();
    session.attach();
    assertEquals(session.isAttached(), true);

    session.detach();
    assertEquals(session.isAttached(), false);
});

Deno.test("multiple attach calls keep session attached", () => {
    const { session } = createSession();
    session.attach();
    session.attach();
    assertEquals(session.isAttached(), true);
});

Deno.test("detach without prior attach keeps detached state", () => {
    const { session } = createSession();
    session.detach();
    assertEquals(session.isAttached(), false);
});

Deno.test("attach after detach reattaches", () => {
    const { session } = createSession();
    session.attach();
    session.detach();
    session.attach();
    assertEquals(session.isAttached(), true);
});

// ---------------------------------------------------------------------------
// isAttached()
// ---------------------------------------------------------------------------

Deno.test("isAttached returns false initially", () => {
    const { session } = createSession();
    assertEquals(session.isAttached(), false);
});

Deno.test("isAttached returns true after attach", () => {
    const { session } = createSession();
    session.attach();
    assertEquals(session.isAttached(), true);
});

Deno.test("isAttached returns false after attach then detach", () => {
    const { session } = createSession();
    session.attach();
    session.detach();
    assertEquals(session.isAttached(), false);
});

// ---------------------------------------------------------------------------
// getTargetInfo()
// ---------------------------------------------------------------------------

Deno.test("getTargetInfo returns correct targetId", () => {
    const { session } = createSession({ id: "test-42" });
    const info = session.getTargetInfo();
    assertEquals(info.targetId, "page-test-42");
});

Deno.test("getTargetInfo returns type 'page'", () => {
    const { session } = createSession();
    const info = session.getTargetInfo();
    assertEquals(info.type, "page");
});

Deno.test("getTargetInfo uses browser getCurrentURL for title and url", () => {
    const { session } = createSession({ currentURL: "https://test.dev/page" });
    const info = session.getTargetInfo();
    assertEquals(info.title, "https://test.dev/page");
    assertEquals(info.url, "https://test.dev/page");
});

Deno.test("getTargetInfo returns about:blank when browser URL is null", () => {
    const browser = createMockBrowser();
    // Override getCurrentURL to return null
    const browserWithNull = {
        ...browser,
        getCurrentURL: () => null,
    };
    const domains = new DomainRegistry();
    const session = new DevToolsSession(
        "session-null",
        browserWithNull as unknown as Browser,
        domains,
    );

    const info = session.getTargetInfo();
    assertEquals(info.title, "about:blank");
    assertEquals(info.url, "about:blank");
});

Deno.test("getTargetInfo reflects attached state as false initially", () => {
    const { session } = createSession();
    const info = session.getTargetInfo();
    assertEquals(info.attached, false);
});

Deno.test("getTargetInfo reflects attached state as true after attach", () => {
    const { session } = createSession();
    session.attach();
    const info = session.getTargetInfo();
    assertEquals(info.attached, true);
});

Deno.test("getTargetInfo reflects detached state after detach", () => {
    const { session } = createSession();
    session.attach();
    session.detach();
    const info = session.getTargetInfo();
    assertEquals(info.attached, false);
});

// ---------------------------------------------------------------------------
// dispose()
// ---------------------------------------------------------------------------

Deno.test("dispose sets session to detached", () => {
    const { session } = createSession();
    session.attach();
    assertEquals(session.isAttached(), true);

    session.dispose();
    assertEquals(session.isAttached(), false);
});

Deno.test("dispose calls domains.dispose to clean up registry", () => {
    const { session, domains } = createSession();
    // Register a domain to verify it gets cleaned up
    const eventBus = new EventBus();
    const domain = new DisposeTestDomain(eventBus);
    domain.initialize(createMockContext({ eventBus }));
    domains.register(domain, {
        name: "DOM",
        description: "test",
        version: "1.0",
    });

    assertEquals(domains.hasDomain("DOM"), true);

    session.dispose();

    // After dispose, the registry should be cleared
    assertEquals(domains.hasDomain("DOM"), false);
    assertEquals(domains.listDomains().length, 0);
});

Deno.test("dispose on already detached session works without error", () => {
    const { session } = createSession();
    // Already detached by default
    session.dispose();
    assertEquals(session.isAttached(), false);
});

// ---------------------------------------------------------------------------
// Session with different IDs
// ---------------------------------------------------------------------------

Deno.test("sessions with different IDs have different targetIds", () => {
    const { session: s1 } = createSession({ id: "alpha" });
    const { session: s2 } = createSession({ id: "beta" });
    assertEquals(s1.targetId, "page-alpha");
    assertEquals(s2.targetId, "page-beta");
    assertEquals(s1.targetId !== s2.targetId, true);
});
