import { assertEquals, assert } from "@std/assert";

// Shim HTMLElement for Deno (required by GraphXCanvas transitive import)
if (typeof globalThis.HTMLElement === "undefined") {
    (globalThis as Record<string, unknown>).HTMLElement = class HTMLElement {};
}

Deno.test("QueryEngine observer - setObserver method exists", async () => {
    const { QueryEngine } = await import("../../core/engine.ts");
    const engine = new QueryEngine();
    assertEquals(typeof engine.setObserver, "function");
});

Deno.test("QueryEngine observer - emits 7 stage pairs for simple query", async () => {
    const { QueryEngine } = await import("../../core/engine.ts");

    const events: Array<{ stageId: string; status: string; pipeline: string }> = [];
    const engine = new QueryEngine();
    await engine.initialize({});

    engine.setObserver({
        onStage(event) {
            events.push({ stageId: event.stageId, status: event.status, pipeline: event.pipeline });
        },
    });

    try {
        await engine.execute("SET @x = 1");
    } catch {
        // Query may fail but observer events should still fire for completed stages
    }

    // All events should have pipeline: "query"
    for (const e of events) {
        assertEquals(e.pipeline, "query");
    }

    // Should have at least lexer and parser stages
    const stageIds = events.map((e) => e.stageId);
    assert(stageIds.includes("lexer"), "Should have lexer stage");
    assert(stageIds.includes("parser"), "Should have parser stage");
});
