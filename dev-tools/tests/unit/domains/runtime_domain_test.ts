/**
 * Runtime Domain Agent Tests
 *
 * Tests for JavaScript evaluation, object serialization,
 * remote object management, console calls, and exception handling.
 */

import { assertEquals, assertExists } from "@std/assert";
import { EventBus } from "../../../integration/event-bus.ts";
import { RuntimeDomain } from "../../../domains/runtime/runtime-domain.ts";
import {
    createMockContext,
    createMockBrowser,
    createMockRenderingPipeline,
    createMockRenderResult,
    resetNodeIdCounter,
} from "../../helpers/mocks.ts";
import type { ProtocolEvent } from "../../../protocol/types.ts";

/**
 * Helper: create a rendering pipeline whose getStats() exposes a scriptExecutor
 * in lastRenderResult so that RuntimeDomain.evaluate() can use it.
 */
function createPipelineWithExecutor(executeFn: (code: string) => unknown) {
    const renderResult = createMockRenderResult();
    // Attach scriptExecutor to the render result via unknown cast
    (renderResult as unknown as Record<string, unknown>).scriptExecutor = {
        execute: executeFn,
    };
    const basePipeline = createMockRenderingPipeline(renderResult);
    return {
        ...basePipeline,
        getStats: () => ({
            ...basePipeline.getStats(),
            lastRenderResult: renderResult,
        }),
    } as unknown as ReturnType<typeof createMockRenderingPipeline>;
}

// ---- Tests ----

Deno.test("RuntimeDomain - enable() emits executionContextCreated", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new RuntimeDomain(eventBus);
    const context = createMockContext({ eventBus });
    domain.initialize(context);

    const events: ProtocolEvent[] = [];
    domain.addEventListener((event) => events.push(event));

    await domain.enable();

    const ctxEvent = events.find((e) => e.method === "Runtime.executionContextCreated");
    assertExists(ctxEvent);

    const ctx = ctxEvent.params?.context as Record<string, unknown>;
    assertExists(ctx);
    assertEquals(ctx.name, "default");
    assertExists(ctx.id);
    assertExists(ctx.uniqueId);
});

Deno.test("RuntimeDomain - evaluate() returns serialized result with exceptionDetails (no executor fallback)", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new RuntimeDomain(eventBus);

    // Use a pipeline with no scriptExecutor so evaluate falls back to undefined + exceptionDetails
    const renderResult = createMockRenderResult();
    const pipeline = createMockRenderingPipeline(renderResult);
    const context = createMockContext({ eventBus, renderingPipeline: pipeline });
    domain.initialize(context);
    await domain.enable();

    const result = await domain.handleMethod("evaluate", { expression: "1 + 1" });
    const res = result as Record<string, unknown>;
    const remoteObj = res.result as Record<string, unknown>;

    assertExists(remoteObj);
    // Without scriptExecutor, value will be undefined
    assertEquals(remoteObj.type, "undefined");
    // Should also include exceptionDetails
    const exceptionDetails = res.exceptionDetails as Record<string, unknown>;
    assertExists(exceptionDetails);
    assertEquals((exceptionDetails.text as string).includes("unavailable"), true);
});

Deno.test("RuntimeDomain - evaluate() uses scriptExecutor when available", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new RuntimeDomain(eventBus);

    const pipeline = createPipelineWithExecutor((code: string) => {
        if (code === "2 + 3") return 5;
        return undefined;
    });

    const context = createMockContext({ eventBus, renderingPipeline: pipeline });
    domain.initialize(context);
    await domain.enable();

    const result = await domain.handleMethod("evaluate", { expression: "2 + 3" });
    const remoteObj = (result as Record<string, unknown>).result as Record<string, unknown>;

    assertEquals(remoteObj.type, "number");
    assertEquals(remoteObj.value, 5);
});

Deno.test("RuntimeDomain - evaluate() with error returns exceptionDetails", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new RuntimeDomain(eventBus);

    const pipeline = createPipelineWithExecutor((_code: string) => {
        throw new Error("ReferenceError: x is not defined");
    });

    const context = createMockContext({ eventBus, renderingPipeline: pipeline });
    domain.initialize(context);
    await domain.enable();

    const result = await domain.handleMethod("evaluate", { expression: "x" });
    const exceptionDetails = (result as Record<string, unknown>).exceptionDetails as Record<
        string,
        unknown
    >;

    assertExists(exceptionDetails);
    assertEquals(typeof exceptionDetails.exceptionId, "number");
    assertEquals(typeof exceptionDetails.text, "string");
});

Deno.test("RuntimeDomain - getProperties() returns object properties", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new RuntimeDomain(eventBus);

    const pipeline = createPipelineWithExecutor((_code: string) => ({ name: "Alice", age: 30 }));

    const context = createMockContext({ eventBus, renderingPipeline: pipeline });
    domain.initialize(context);
    await domain.enable();

    // Evaluate to store a remote object
    const evalResult = await domain.handleMethod("evaluate", { expression: "obj" });
    const remoteObj = (evalResult as Record<string, unknown>).result as Record<string, unknown>;
    const objectId = remoteObj.objectId as string;
    assertExists(objectId);

    // Get properties of the stored object
    const propsResult = await domain.handleMethod("getProperties", { objectId });
    const properties = (propsResult as Record<string, unknown>).result as Array<
        Record<string, unknown>
    >;

    assertExists(properties);
    assertEquals(properties.length, 2);

    const nameProp = properties.find((p) => p.name === "name");
    assertExists(nameProp);
    assertEquals(nameProp.isOwn, true);
    assertEquals(nameProp.enumerable, true);

    const ageProp = properties.find((p) => p.name === "age");
    assertExists(ageProp);
});

Deno.test("RuntimeDomain - getProperties() returns empty for non-existent objectId", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new RuntimeDomain(eventBus);
    const context = createMockContext({ eventBus });
    domain.initialize(context);
    await domain.enable();

    const result = await domain.handleMethod("getProperties", { objectId: "nonexistent" });
    const properties = (result as Record<string, unknown>).result as unknown[];
    assertEquals(properties, []);
});

Deno.test("RuntimeDomain - releaseObject() removes from store", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new RuntimeDomain(eventBus);

    const pipeline = createPipelineWithExecutor(() => ({ x: 1 }));

    const context = createMockContext({ eventBus, renderingPipeline: pipeline });
    domain.initialize(context);
    await domain.enable();

    const evalResult = await domain.handleMethod("evaluate", { expression: "obj" });
    const objectId = ((evalResult as Record<string, unknown>).result as Record<string, unknown>)
        .objectId as string;

    // Release the object
    await domain.handleMethod("releaseObject", { objectId });

    // Verify it's gone (getProperties should return empty)
    const props = await domain.handleMethod("getProperties", { objectId });
    assertEquals((props as Record<string, unknown>).result, []);
});

Deno.test("RuntimeDomain - releaseObjectGroup() removes all objects in group", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new RuntimeDomain(eventBus);

    let callCount = 0;
    const pipeline = createPipelineWithExecutor(() => {
        callCount++;
        return { value: callCount };
    });

    const context = createMockContext({ eventBus, renderingPipeline: pipeline });
    domain.initialize(context);
    await domain.enable();

    // Evaluate two objects in the same group
    const eval1 = await domain.handleMethod("evaluate", {
        expression: "a",
        objectGroup: "test-group",
    });
    const id1 = ((eval1 as Record<string, unknown>).result as Record<string, unknown>)
        .objectId as string;

    const eval2 = await domain.handleMethod("evaluate", {
        expression: "b",
        objectGroup: "test-group",
    });
    const id2 = ((eval2 as Record<string, unknown>).result as Record<string, unknown>)
        .objectId as string;

    // Both should have properties
    const props1Before = await domain.handleMethod("getProperties", { objectId: id1 });
    assertEquals(
        ((props1Before as Record<string, unknown>).result as unknown[]).length > 0,
        true,
    );

    // Release the group
    await domain.handleMethod("releaseObjectGroup", { objectGroup: "test-group" });

    // Both should now be empty
    const props1After = await domain.handleMethod("getProperties", { objectId: id1 });
    assertEquals((props1After as Record<string, unknown>).result, []);

    const props2After = await domain.handleMethod("getProperties", { objectId: id2 });
    assertEquals((props2After as Record<string, unknown>).result, []);
});

Deno.test("RuntimeDomain - getHeapUsage() returns usage", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new RuntimeDomain(eventBus);
    const context = createMockContext({ eventBus });
    domain.initialize(context);
    await domain.enable();

    const result = await domain.handleMethod("getHeapUsage", {});
    assertExists((result as Record<string, unknown>).usedSize);
    assertExists((result as Record<string, unknown>).totalSize);
    assertEquals(typeof (result as Record<string, unknown>).usedSize, "number");
    assertEquals(typeof (result as Record<string, unknown>).totalSize, "number");
});

Deno.test("RuntimeDomain - getExecutionContexts() returns contexts", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new RuntimeDomain(eventBus);
    const browser = createMockBrowser({ currentURL: "https://example.com" });
    const context = createMockContext({ eventBus, browser });
    domain.initialize(context);
    await domain.enable();

    const result = await domain.handleMethod("getExecutionContexts", {});
    const contexts = (result as Record<string, unknown>).contexts as Array<
        Record<string, unknown>
    >;

    assertExists(contexts);
    assertEquals(contexts.length, 1);
    assertEquals(contexts[0].name, "default");
    assertEquals(contexts[0].origin, "https://example.com");
});

Deno.test("RuntimeDomain - emitConsoleCall() emits consoleAPICalled event when enabled", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new RuntimeDomain(eventBus);
    const context = createMockContext({ eventBus });
    domain.initialize(context);
    await domain.enable();

    const events: ProtocolEvent[] = [];
    domain.addEventListener((event) => events.push(event));

    domain.emitConsoleCall("log", ["Hello", 42]);

    const consoleEvent = events.find((e) => e.method === "Runtime.consoleAPICalled");
    assertExists(consoleEvent);
    assertEquals(consoleEvent.params?.type, "log");

    const args = consoleEvent.params?.args as Array<Record<string, unknown>>;
    assertExists(args);
    assertEquals(args.length, 2);
    assertEquals(args[0].type, "string");
    assertEquals(args[0].value, "Hello");
    assertEquals(args[1].type, "number");
    assertEquals(args[1].value, 42);
});

Deno.test("RuntimeDomain - emitConsoleCall() does nothing when disabled", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new RuntimeDomain(eventBus);
    const context = createMockContext({ eventBus });
    domain.initialize(context);
    // Do NOT enable the domain

    const events: ProtocolEvent[] = [];
    domain.addEventListener((event) => events.push(event));

    domain.emitConsoleCall("log", ["should not appear"]);

    const consoleEvent = events.find((e) => e.method === "Runtime.consoleAPICalled");
    assertEquals(consoleEvent, undefined);
});

Deno.test("RuntimeDomain - emitException() emits exceptionThrown event", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new RuntimeDomain(eventBus);
    const context = createMockContext({ eventBus });
    domain.initialize(context);
    await domain.enable();

    const events: ProtocolEvent[] = [];
    domain.addEventListener((event) => events.push(event));

    const error = new TypeError("Cannot read property 'x' of undefined");
    domain.emitException(error, "script-1");

    const exEvent = events.find((e) => e.method === "Runtime.exceptionThrown");
    assertExists(exEvent);

    const details = exEvent.params?.exceptionDetails as Record<string, unknown>;
    assertExists(details);
    assertEquals(details.text, "Cannot read property 'x' of undefined");
    assertEquals(details.scriptId, "script-1");
    assertEquals(typeof details.exceptionId, "number");
});

// ---- Serialization Tests ----

Deno.test("RuntimeDomain - serialization: undefined", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new RuntimeDomain(eventBus);
    const context = createMockContext({ eventBus });
    domain.initialize(context);
    await domain.enable();

    // emitConsoleCall serializes args, so we can check via events
    const events: ProtocolEvent[] = [];
    domain.addEventListener((event) => events.push(event));

    domain.emitConsoleCall("log", [undefined]);

    const args = (events[0]?.params?.args as Array<Record<string, unknown>>) ?? [];
    assertEquals(args[0]?.type, "undefined");
});

Deno.test("RuntimeDomain - serialization: null", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new RuntimeDomain(eventBus);
    const context = createMockContext({ eventBus });
    domain.initialize(context);
    await domain.enable();

    const events: ProtocolEvent[] = [];
    domain.addEventListener((event) => events.push(event));

    domain.emitConsoleCall("log", [null]);

    const args = (events[0]?.params?.args as Array<Record<string, unknown>>) ?? [];
    assertEquals(args[0]?.type, "object");
    assertEquals(args[0]?.subtype, "null");
    assertEquals(args[0]?.value, null);
});

Deno.test("RuntimeDomain - serialization: string", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new RuntimeDomain(eventBus);
    const context = createMockContext({ eventBus });
    domain.initialize(context);
    await domain.enable();

    const events: ProtocolEvent[] = [];
    domain.addEventListener((event) => events.push(event));

    domain.emitConsoleCall("log", ["hello"]);

    const args = (events[0]?.params?.args as Array<Record<string, unknown>>) ?? [];
    assertEquals(args[0]?.type, "string");
    assertEquals(args[0]?.value, "hello");
});

Deno.test("RuntimeDomain - serialization: number", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new RuntimeDomain(eventBus);
    const context = createMockContext({ eventBus });
    domain.initialize(context);
    await domain.enable();

    const events: ProtocolEvent[] = [];
    domain.addEventListener((event) => events.push(event));

    domain.emitConsoleCall("log", [42]);

    const args = (events[0]?.params?.args as Array<Record<string, unknown>>) ?? [];
    assertEquals(args[0]?.type, "number");
    assertEquals(args[0]?.value, 42);
    assertEquals(args[0]?.description, "42");
});

Deno.test("RuntimeDomain - serialization: boolean", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new RuntimeDomain(eventBus);
    const context = createMockContext({ eventBus });
    domain.initialize(context);
    await domain.enable();

    const events: ProtocolEvent[] = [];
    domain.addEventListener((event) => events.push(event));

    domain.emitConsoleCall("log", [true]);

    const args = (events[0]?.params?.args as Array<Record<string, unknown>>) ?? [];
    assertEquals(args[0]?.type, "boolean");
    assertEquals(args[0]?.value, true);
});

Deno.test("RuntimeDomain - serialization: array", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new RuntimeDomain(eventBus);
    const context = createMockContext({ eventBus });
    domain.initialize(context);
    await domain.enable();

    const events: ProtocolEvent[] = [];
    domain.addEventListener((event) => events.push(event));

    domain.emitConsoleCall("log", [[1, 2, 3]]);

    const args = (events[0]?.params?.args as Array<Record<string, unknown>>) ?? [];
    assertEquals(args[0]?.type, "object");
    assertEquals(args[0]?.subtype, "array");
    assertEquals(args[0]?.className, "Array");
    assertEquals(args[0]?.description, "Array(3)");
});

Deno.test("RuntimeDomain - serialization: object", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new RuntimeDomain(eventBus);
    const context = createMockContext({ eventBus });
    domain.initialize(context);
    await domain.enable();

    const events: ProtocolEvent[] = [];
    domain.addEventListener((event) => events.push(event));

    domain.emitConsoleCall("log", [{ key: "value" }]);

    const args = (events[0]?.params?.args as Array<Record<string, unknown>>) ?? [];
    assertEquals(args[0]?.type, "object");
    assertEquals(args[0]?.className, "Object");
});

Deno.test("RuntimeDomain - serialization: error", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new RuntimeDomain(eventBus);
    const context = createMockContext({ eventBus });
    domain.initialize(context);
    await domain.enable();

    const events: ProtocolEvent[] = [];
    domain.addEventListener((event) => events.push(event));

    domain.emitConsoleCall("error", [new Error("test error")]);

    const args = (events[0]?.params?.args as Array<Record<string, unknown>>) ?? [];
    assertEquals(args[0]?.type, "object");
    assertEquals(args[0]?.subtype, "error");
    assertEquals(args[0]?.className, "Error");
});

Deno.test("RuntimeDomain - serialization: date", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new RuntimeDomain(eventBus);
    const context = createMockContext({ eventBus });
    domain.initialize(context);
    await domain.enable();

    const events: ProtocolEvent[] = [];
    domain.addEventListener((event) => events.push(event));

    const date = new Date("2025-01-15T12:00:00Z");
    domain.emitConsoleCall("log", [date]);

    const args = (events[0]?.params?.args as Array<Record<string, unknown>>) ?? [];
    assertEquals(args[0]?.type, "object");
    assertEquals(args[0]?.subtype, "date");
    assertEquals(args[0]?.className, "Date");
    assertEquals(args[0]?.description, "2025-01-15T12:00:00.000Z");
});

Deno.test("RuntimeDomain - serialization: regexp", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new RuntimeDomain(eventBus);
    const context = createMockContext({ eventBus });
    domain.initialize(context);
    await domain.enable();

    const events: ProtocolEvent[] = [];
    domain.addEventListener((event) => events.push(event));

    domain.emitConsoleCall("log", [/test-pattern/gi]);

    const args = (events[0]?.params?.args as Array<Record<string, unknown>>) ?? [];
    assertEquals(args[0]?.type, "object");
    assertEquals(args[0]?.subtype, "regexp");
    assertEquals(args[0]?.className, "RegExp");
    assertEquals(args[0]?.description, "/test-pattern/gi");
});

Deno.test("RuntimeDomain - serialization: map", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new RuntimeDomain(eventBus);
    const context = createMockContext({ eventBus });
    domain.initialize(context);
    await domain.enable();

    const events: ProtocolEvent[] = [];
    domain.addEventListener((event) => events.push(event));

    const map = new Map([["a", 1], ["b", 2]]);
    domain.emitConsoleCall("log", [map]);

    const args = (events[0]?.params?.args as Array<Record<string, unknown>>) ?? [];
    assertEquals(args[0]?.type, "object");
    assertEquals(args[0]?.subtype, "map");
    assertEquals(args[0]?.className, "Map");
    assertEquals(args[0]?.description, "Map(2)");
});

Deno.test("RuntimeDomain - serialization: set", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new RuntimeDomain(eventBus);
    const context = createMockContext({ eventBus });
    domain.initialize(context);
    await domain.enable();

    const events: ProtocolEvent[] = [];
    domain.addEventListener((event) => events.push(event));

    const set = new Set([1, 2, 3]);
    domain.emitConsoleCall("log", [set]);

    const args = (events[0]?.params?.args as Array<Record<string, unknown>>) ?? [];
    assertEquals(args[0]?.type, "object");
    assertEquals(args[0]?.subtype, "set");
    assertEquals(args[0]?.className, "Set");
    assertEquals(args[0]?.description, "Set(3)");
});

Deno.test("RuntimeDomain - serialization: promise", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new RuntimeDomain(eventBus);
    const context = createMockContext({ eventBus });
    domain.initialize(context);
    await domain.enable();

    const events: ProtocolEvent[] = [];
    domain.addEventListener((event) => events.push(event));

    const promise = Promise.resolve(42);
    domain.emitConsoleCall("log", [promise]);

    const args = (events[0]?.params?.args as Array<Record<string, unknown>>) ?? [];
    assertEquals(args[0]?.type, "object");
    assertEquals(args[0]?.subtype, "promise");
    assertEquals(args[0]?.className, "Promise");
    assertEquals(args[0]?.description, "Promise");
});

Deno.test("RuntimeDomain - serialization: bigint", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new RuntimeDomain(eventBus);
    const context = createMockContext({ eventBus });
    domain.initialize(context);
    await domain.enable();

    const events: ProtocolEvent[] = [];
    domain.addEventListener((event) => events.push(event));

    domain.emitConsoleCall("log", [BigInt(9007199254740991)]);

    const args = (events[0]?.params?.args as Array<Record<string, unknown>>) ?? [];
    assertEquals(args[0]?.type, "bigint");
    assertEquals(args[0]?.unserializableValue, "9007199254740991n");
    assertEquals(args[0]?.description, "9007199254740991n");
});

Deno.test("RuntimeDomain - serialization: symbol", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new RuntimeDomain(eventBus);
    const context = createMockContext({ eventBus });
    domain.initialize(context);
    await domain.enable();

    const events: ProtocolEvent[] = [];
    domain.addEventListener((event) => events.push(event));

    domain.emitConsoleCall("log", [Symbol("test")]);

    const args = (events[0]?.params?.args as Array<Record<string, unknown>>) ?? [];
    assertEquals(args[0]?.type, "symbol");
    assertEquals(args[0]?.description, "Symbol(test)");
});

Deno.test("RuntimeDomain - serialization: function", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new RuntimeDomain(eventBus);
    const context = createMockContext({ eventBus });
    domain.initialize(context);
    await domain.enable();

    const events: ProtocolEvent[] = [];
    domain.addEventListener((event) => events.push(event));

    const fn = function myFunc() {};
    domain.emitConsoleCall("log", [fn]);

    const args = (events[0]?.params?.args as Array<Record<string, unknown>>) ?? [];
    assertEquals(args[0]?.type, "function");
    assertEquals(args[0]?.className, "Function");
});

Deno.test("RuntimeDomain - evaluate uses lastRenderResult.scriptExecutor directly", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new RuntimeDomain(eventBus);

    // Attach scriptExecutor to lastRenderResult directly on the pipeline (not via getStats)
    const mockExecutor = { execute: (code: string) => code === "1+1" ? 2 : undefined };
    const renderResult = createMockRenderResult();
    const pipeline = createMockRenderingPipeline(renderResult);
    (pipeline as unknown as Record<string, unknown>).lastRenderResult = {
        ...renderResult,
        scriptExecutor: mockExecutor,
    };

    const context = createMockContext({ eventBus, renderingPipeline: pipeline });
    domain.initialize(context);
    await domain.enable();

    const result = await domain.handleMethod("evaluate", { expression: "1+1" });
    const remoteObj = (result as Record<string, unknown>).result as Record<string, unknown>;
    assertEquals(remoteObj.type, "number");
    assertEquals(remoteObj.value, 2);
});

Deno.test("RuntimeDomain - serialization: NaN", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new RuntimeDomain(eventBus);
    const context = createMockContext({ eventBus });
    domain.initialize(context);
    await domain.enable();

    const events: ProtocolEvent[] = [];
    domain.addEventListener((event) => events.push(event));

    domain.emitConsoleCall("log", [NaN]);

    const args = (events[0]?.params?.args as Array<Record<string, unknown>>) ?? [];
    assertEquals(args[0]?.type, "number");
    assertEquals(args[0]?.unserializableValue, "NaN");
    assertEquals(args[0]?.description, "NaN");
});

Deno.test("RuntimeDomain - evaluate() returns exceptionDetails when no scriptExecutor", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new RuntimeDomain(eventBus);

    // Use a pipeline with no scriptExecutor
    const renderResult = createMockRenderResult();
    const pipeline = createMockRenderingPipeline(renderResult);
    const context = createMockContext({ eventBus, renderingPipeline: pipeline });
    domain.initialize(context);
    await domain.enable();

    const result = await domain.handleMethod("evaluate", { expression: "1 + 1" });
    const res = result as Record<string, unknown>;

    // Should return exceptionDetails indicating no executor
    const exceptionDetails = res.exceptionDetails as Record<string, unknown>;
    assertExists(exceptionDetails);
    assertEquals(typeof exceptionDetails.text, "string");
    assertEquals((exceptionDetails.text as string).includes("unavailable"), true);
    assertEquals((res.result as Record<string, unknown>).type, "undefined");
});

Deno.test("RuntimeDomain - getHeapUsage() returns non-zero when executor present", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new RuntimeDomain(eventBus);

    // Create mock with scriptExecutor that has getIsolate().getHeapStatistics()
    const renderResult = createMockRenderResult();
    (renderResult as unknown as Record<string, unknown>).scriptExecutor = {
        execute: (code: string) => code,
        getIsolate: () => ({
            getHeapStatistics: () => ({
                totalSize: 1048576,
                totalAllocated: 524288,
                youngGenerationSize: 262144,
                oldGenerationSize: 262144,
                objectCount: 100,
                youngObjectCount: 60,
                oldObjectCount: 40,
                gcStats: { collections: 0, totalPauseTime: 0, lastPauseTime: 0, lastCollectionType: "" },
            }),
        }),
    };
    const pipeline = createMockRenderingPipeline(renderResult);
    const context = createMockContext({ eventBus, renderingPipeline: pipeline });
    domain.initialize(context);
    await domain.enable();

    const result = await domain.handleMethod("getHeapUsage", {});
    const usage = result as Record<string, unknown>;
    assertEquals(usage.usedSize, 524288);
    assertEquals(usage.totalSize, 1048576);
});

Deno.test("RuntimeDomain - serialization: Infinity", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new RuntimeDomain(eventBus);
    const context = createMockContext({ eventBus });
    domain.initialize(context);
    await domain.enable();

    const events: ProtocolEvent[] = [];
    domain.addEventListener((event) => events.push(event));

    domain.emitConsoleCall("log", [Infinity]);

    const args = (events[0]?.params?.args as Array<Record<string, unknown>>) ?? [];
    assertEquals(args[0]?.type, "number");
    assertEquals(args[0]?.unserializableValue, "Infinity");
    assertEquals(args[0]?.description, "Infinity");
});
