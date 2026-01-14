/**
 * EventTarget Tests
 *
 * Comprehensive tests for DOM event system with event dispatching, bubbling, and capturing.
 */

import { assertEquals, assertStrictEquals } from "@std/assert";
import {
    EventPhase,
    type DOMEvent,
    EventTarget,
    Event,
    CustomEvent,
    MouseEvent,
    KeyboardEvent,
} from "../../../src/engine/javascript/EventTarget.ts";

// ============================================================================
// Event Class Tests
// ============================================================================

Deno.test({
    name: "Event - constructor creates event with default values",
    fn() {
        const event = new Event("click");

        assertEquals(event.type, "click");
        assertEquals(event.bubbles, false);
        assertEquals(event.cancelable, false);
        assertEquals(event.composed, false);
        assertEquals(event.defaultPrevented, false);
        assertEquals(event.isTrusted, false);
        assertEquals(event.eventPhase, EventPhase.NONE);
        assertEquals(event.target, null);
        assertEquals(event.currentTarget, null);
    },
});

Deno.test({
    name: "Event - constructor accepts init options",
    fn() {
        const event = new Event("click", {
            bubbles: true,
            cancelable: true,
            composed: true,
        });

        assertEquals(event.bubbles, true);
        assertEquals(event.cancelable, true);
        assertEquals(event.composed, true);
    },
});

Deno.test({
    name: "Event - preventDefault sets defaultPrevented when cancelable",
    fn() {
        const event = new Event("click", { cancelable: true });

        assertEquals(event.defaultPrevented, false);
        event.preventDefault();
        assertEquals(event.defaultPrevented, true);
    },
});

Deno.test({
    name: "Event - preventDefault does nothing when not cancelable",
    fn() {
        const event = new Event("click", { cancelable: false });

        event.preventDefault();
        assertEquals(event.defaultPrevented, false);
    },
});

Deno.test({
    name: "Event - stopPropagation stops propagation",
    fn() {
        const event = new Event("click");
        event.stopPropagation();

        // Access private property through any cast for testing
        assertEquals((event as any).propagationStopped, true);
    },
});

Deno.test({
    name: "Event - stopImmediatePropagation stops both propagations",
    fn() {
        const event = new Event("click");
        event.stopImmediatePropagation();

        assertEquals((event as any).propagationStopped, true);
        assertEquals((event as any).immediatePropagationStopped, true);
    },
});

// ============================================================================
// CustomEvent Class Tests
// ============================================================================

Deno.test({
    name: "CustomEvent - constructor creates event with detail",
    fn() {
        const detail = { foo: "bar", count: 42 };
        const event = new CustomEvent("custom", { detail });

        assertEquals(event.type, "custom");
        assertEquals(event.detail, detail);
    },
});

Deno.test({
    name: "CustomEvent - constructor creates event without detail",
    fn() {
        const event = new CustomEvent("custom");

        assertEquals(event.type, "custom");
        assertEquals(event.detail, undefined);
    },
});

// ============================================================================
// MouseEvent Class Tests
// ============================================================================

Deno.test({
    name: "MouseEvent - constructor creates event with default values",
    fn() {
        const event = new MouseEvent("click");

        assertEquals(event.type, "click");
        assertEquals(event.clientX, 0);
        assertEquals(event.clientY, 0);
        assertEquals(event.screenX, 0);
        assertEquals(event.screenY, 0);
        assertEquals(event.button, 0);
        assertEquals(event.buttons, 0);
        assertEquals(event.ctrlKey, false);
        assertEquals(event.shiftKey, false);
        assertEquals(event.altKey, false);
        assertEquals(event.metaKey, false);
    },
});

Deno.test({
    name: "MouseEvent - constructor accepts mouse properties",
    fn() {
        const event = new MouseEvent("click", {
            clientX: 100,
            clientY: 200,
            screenX: 150,
            screenY: 250,
            button: 1,
            buttons: 3,
            ctrlKey: true,
            shiftKey: true,
            altKey: false,
            metaKey: false,
        });

        assertEquals(event.clientX, 100);
        assertEquals(event.clientY, 200);
        assertEquals(event.screenX, 150);
        assertEquals(event.screenY, 250);
        assertEquals(event.button, 1);
        assertEquals(event.buttons, 3);
        assertEquals(event.ctrlKey, true);
        assertEquals(event.shiftKey, true);
        assertEquals(event.altKey, false);
        assertEquals(event.metaKey, false);
    },
});

// ============================================================================
// KeyboardEvent Class Tests
// ============================================================================

Deno.test({
    name: "KeyboardEvent - constructor creates event with default values",
    fn() {
        const event = new KeyboardEvent("keydown");

        assertEquals(event.type, "keydown");
        assertEquals(event.key, "");
        assertEquals(event.code, "");
        assertEquals(event.location, 0);
        assertEquals(event.ctrlKey, false);
        assertEquals(event.shiftKey, false);
        assertEquals(event.altKey, false);
        assertEquals(event.metaKey, false);
        assertEquals(event.repeat, false);
    },
});

Deno.test({
    name: "KeyboardEvent - constructor accepts keyboard properties",
    fn() {
        const event = new KeyboardEvent("keydown", {
            key: "A",
            code: "KeyA",
            location: 1,
            ctrlKey: true,
            shiftKey: false,
            altKey: true,
            metaKey: false,
            repeat: true,
        });

        assertEquals(event.key, "A");
        assertEquals(event.code, "KeyA");
        assertEquals(event.location, 1);
        assertEquals(event.ctrlKey, true);
        assertEquals(event.shiftKey, false);
        assertEquals(event.altKey, true);
        assertEquals(event.metaKey, false);
        assertEquals(event.repeat, true);
    },
});

// ============================================================================
// EventTarget - addEventListener Tests
// ============================================================================

Deno.test({
    name: "EventTarget - addEventListener adds listener",
    fn() {
        const target = new EventTarget();
        const listener = () => {};

        target.addEventListener("click", listener);

        assertEquals(target.hasEventListener("click"), true);
        assertEquals(target.getListenerCount("click"), 1);
    },
});

Deno.test({
    name: "EventTarget - addEventListener with null listener does nothing",
    fn() {
        const target = new EventTarget();

        target.addEventListener("click", null);

        assertEquals(target.hasEventListener("click"), false);
    },
});

Deno.test({
    name: "EventTarget - addEventListener prevents duplicate listeners",
    fn() {
        const target = new EventTarget();
        const listener = () => {};

        target.addEventListener("click", listener);
        target.addEventListener("click", listener);

        assertEquals(target.getListenerCount("click"), 1);
    },
});

Deno.test({
    name: "EventTarget - addEventListener with different capture are separate",
    fn() {
        const target = new EventTarget();
        const listener = () => {};

        target.addEventListener("click", listener, false);
        target.addEventListener("click", listener, true);

        assertEquals(target.getListenerCount("click"), 2);
    },
});

Deno.test({
    name: "EventTarget - addEventListener accepts boolean options",
    fn() {
        const target = new EventTarget();
        const listener = () => {};

        target.addEventListener("click", listener, true);

        assertEquals(target.hasEventListener("click"), true);
    },
});

Deno.test({
    name: "EventTarget - addEventListener accepts object options",
    fn() {
        const target = new EventTarget();
        const listener = () => {};

        target.addEventListener("click", listener, { capture: true, once: true });

        assertEquals(target.hasEventListener("click"), true);
    },
});

Deno.test({
    name: "EventTarget - addEventListener supports object with handleEvent",
    fn() {
        const target = new EventTarget();
        const listenerObj = {
            handleEvent: () => {},
        };

        target.addEventListener("click", listenerObj);

        assertEquals(target.hasEventListener("click"), true);
    },
});

// ============================================================================
// EventTarget - removeEventListener Tests
// ============================================================================

Deno.test({
    name: "EventTarget - removeEventListener removes listener",
    fn() {
        const target = new EventTarget();
        const listener = () => {};

        target.addEventListener("click", listener);
        assertEquals(target.hasEventListener("click"), true);

        target.removeEventListener("click", listener);
        assertEquals(target.hasEventListener("click"), false);
    },
});

Deno.test({
    name: "EventTarget - removeEventListener with null listener does nothing",
    fn() {
        const target = new EventTarget();
        const listener = () => {};

        target.addEventListener("click", listener);
        target.removeEventListener("click", null);

        assertEquals(target.hasEventListener("click"), true);
    },
});

Deno.test({
    name: "EventTarget - removeEventListener for non-existent type does nothing",
    fn() {
        const target = new EventTarget();
        const listener = () => {};

        target.removeEventListener("click", listener);

        // Should not throw
        assertEquals(target.hasEventListener("click"), false);
    },
});

Deno.test({
    name: "EventTarget - removeEventListener respects capture flag",
    fn() {
        const target = new EventTarget();
        const listener = () => {};

        target.addEventListener("click", listener, true);
        target.removeEventListener("click", listener, false);

        // Should still have the capture listener
        assertEquals(target.hasEventListener("click"), true);
    },
});

Deno.test({
    name: "EventTarget - removeEventListener cleans up empty listener list",
    fn() {
        const target = new EventTarget();
        const listener = () => {};

        target.addEventListener("click", listener);
        target.removeEventListener("click", listener);

        // Internal map should be cleaned up
        assertEquals(target.hasEventListener("click"), false);
    },
});

// ============================================================================
// EventTarget - dispatchEvent Tests
// ============================================================================

Deno.test({
    name: "EventTarget - dispatchEvent invokes listener",
    fn() {
        const target = new EventTarget();
        let called = false;

        target.addEventListener("click", () => {
            called = true;
        });

        const event = new Event("click");
        target.dispatchEvent(event);

        assertEquals(called, true);
    },
});

Deno.test({
    name: "EventTarget - dispatchEvent sets event properties",
    fn() {
        const target = new EventTarget();
        const event = new Event("click");

        target.dispatchEvent(event);

        assertEquals(event.target, target);
        assertEquals(event.isTrusted, true);
        assertEquals(event.timeStamp > 0, true);
    },
});

Deno.test({
    name: "EventTarget - dispatchEvent returns true when not prevented",
    fn() {
        const target = new EventTarget();
        const event = new Event("click");

        const result = target.dispatchEvent(event);

        assertEquals(result, true);
    },
});

Deno.test({
    name: "EventTarget - dispatchEvent returns false when prevented",
    fn() {
        const target = new EventTarget();

        target.addEventListener("click", (event) => {
            event.preventDefault();
        });

        const event = new Event("click", { cancelable: true });
        const result = target.dispatchEvent(event);

        assertEquals(result, false);
    },
});

Deno.test({
    name: "EventTarget - dispatchEvent invokes object listener",
    fn() {
        const target = new EventTarget();
        let called = false;

        const listenerObj = {
            handleEvent: () => {
                called = true;
            },
        };

        target.addEventListener("click", listenerObj);

        const event = new Event("click");
        target.dispatchEvent(event);

        assertEquals(called, true);
    },
});

Deno.test({
    name: "EventTarget - dispatchEvent with once option removes listener",
    fn() {
        const target = new EventTarget();
        let callCount = 0;

        target.addEventListener("click", () => {
            callCount++;
        }, { once: true });

        target.dispatchEvent(new Event("click"));
        target.dispatchEvent(new Event("click"));

        assertEquals(callCount, 1);
        assertEquals(target.hasEventListener("click"), false);
    },
});

Deno.test({
    name: "EventTarget - dispatchEvent stops on stopPropagation during bubbling",
    fn() {
        const parent = new EventTarget();
        const child = new EventTarget();
        child.setParent(parent);

        let parentCalled = false;

        child.addEventListener("click", (event) => {
            event.stopPropagation();
        });

        parent.addEventListener("click", () => {
            parentCalled = true;
        });

        const event = new Event("click", { bubbles: true });
        child.dispatchEvent(event);

        assertEquals(parentCalled, false);
    },
});

Deno.test({
    name: "EventTarget - dispatchEvent stops on stopImmediatePropagation",
    fn() {
        const target = new EventTarget();
        let secondCalled = false;

        target.addEventListener("click", (event) => {
            event.stopImmediatePropagation();
        });

        target.addEventListener("click", () => {
            secondCalled = true;
        });

        const event = new Event("click");
        target.dispatchEvent(event);

        assertEquals(secondCalled, false);
    },
});

Deno.test({
    name: "EventTarget - dispatchEvent handles listener errors gracefully",
    fn() {
        const target = new EventTarget();
        let secondCalled = false;

        target.addEventListener("click", () => {
            throw new Error("Test error");
        });

        target.addEventListener("click", () => {
            secondCalled = true;
        });

        const event = new Event("click");
        target.dispatchEvent(event);

        // Second listener should still be called
        assertEquals(secondCalled, true);
    },
});

// ============================================================================
// EventTarget - Event Bubbling Tests
// ============================================================================

Deno.test({
    name: "EventTarget - event bubbles through parent chain",
    fn() {
        const grandparent = new EventTarget();
        const parent = new EventTarget();
        const child = new EventTarget();

        parent.setParent(grandparent);
        child.setParent(parent);

        const callOrder: string[] = [];

        child.addEventListener("click", () => callOrder.push("child"));
        parent.addEventListener("click", () => callOrder.push("parent"));
        grandparent.addEventListener("click", () => callOrder.push("grandparent"));

        const event = new Event("click", { bubbles: true });
        child.dispatchEvent(event);

        assertEquals(callOrder, ["child", "parent", "grandparent"]);
    },
});

Deno.test({
    name: "EventTarget - non-bubbling event does not bubble",
    fn() {
        const parent = new EventTarget();
        const child = new EventTarget();
        child.setParent(parent);

        let parentCalled = false;

        parent.addEventListener("click", () => {
            parentCalled = true;
        });

        const event = new Event("click", { bubbles: false });
        child.dispatchEvent(event);

        assertEquals(parentCalled, false);
    },
});

// ============================================================================
// EventTarget - Event Capturing Tests
// ============================================================================

Deno.test({
    name: "EventTarget - event captures from parent to child",
    fn() {
        const parent = new EventTarget();
        const child = new EventTarget();
        child.setParent(parent);

        const callOrder: string[] = [];

        parent.addEventListener("click", () => callOrder.push("parent-capture"), true);
        child.addEventListener("click", () => callOrder.push("child"), false);
        parent.addEventListener("click", () => callOrder.push("parent-bubble"), false);

        const event = new Event("click", { bubbles: true });
        child.dispatchEvent(event);

        assertEquals(callOrder, ["parent-capture", "child", "parent-bubble"]);
    },
});

Deno.test({
    name: "EventTarget - capture listeners fire before target listeners",
    fn() {
        const parent = new EventTarget();
        const child = new EventTarget();
        child.setParent(parent);

        const callOrder: string[] = [];

        parent.addEventListener("click", () => callOrder.push("parent"), true);
        child.addEventListener("click", () => callOrder.push("child"));

        const event = new Event("click");
        child.dispatchEvent(event);

        assertEquals(callOrder, ["parent", "child"]);
    },
});

// ============================================================================
// EventTarget - Parent Management Tests
// ============================================================================

Deno.test({
    name: "EventTarget - setParent sets parent",
    fn() {
        const parent = new EventTarget();
        const child = new EventTarget();

        child.setParent(parent);

        assertEquals(child.getParent(), parent);
    },
});

Deno.test({
    name: "EventTarget - setParent can set null parent",
    fn() {
        const parent = new EventTarget();
        const child = new EventTarget();

        child.setParent(parent);
        child.setParent(null);

        assertEquals(child.getParent(), null);
    },
});

Deno.test({
    name: "EventTarget - getParent returns parent",
    fn() {
        const parent = new EventTarget();
        const child = new EventTarget();

        child.setParent(parent);

        assertStrictEquals(child.getParent(), parent);
    },
});

// ============================================================================
// EventTarget - Utility Methods Tests
// ============================================================================

Deno.test({
    name: "EventTarget - hasEventListener returns false for unregistered type",
    fn() {
        const target = new EventTarget();
        assertEquals(target.hasEventListener("click"), false);
    },
});

Deno.test({
    name: "EventTarget - hasEventListener returns true for registered type",
    fn() {
        const target = new EventTarget();
        target.addEventListener("click", () => {});

        assertEquals(target.hasEventListener("click"), true);
    },
});

Deno.test({
    name: "EventTarget - getListenerCount returns zero for unregistered type",
    fn() {
        const target = new EventTarget();
        assertEquals(target.getListenerCount("click"), 0);
    },
});

Deno.test({
    name: "EventTarget - getListenerCount returns correct count",
    fn() {
        const target = new EventTarget();
        target.addEventListener("click", () => {});
        target.addEventListener("click", () => {});
        target.addEventListener("click", () => {}, true);

        assertEquals(target.getListenerCount("click"), 3);
    },
});

Deno.test({
    name: "EventTarget - removeAllListeners removes all listeners",
    fn() {
        const target = new EventTarget();
        target.addEventListener("click", () => {});
        target.addEventListener("mouseover", () => {});
        target.addEventListener("keydown", () => {});

        assertEquals(target.hasEventListener("click"), true);
        assertEquals(target.hasEventListener("mouseover"), true);

        target.removeAllListeners();

        assertEquals(target.hasEventListener("click"), false);
        assertEquals(target.hasEventListener("mouseover"), false);
        assertEquals(target.hasEventListener("keydown"), false);
    },
});

// ============================================================================
// EventTarget - Event Phase Tests
// ============================================================================

Deno.test({
    name: "EventTarget - event phase is correct during dispatch",
    fn() {
        const parent = new EventTarget();
        const child = new EventTarget();
        child.setParent(parent);

        const phases: EventPhase[] = [];

        parent.addEventListener("click", (e) => phases.push(e.eventPhase), true);
        child.addEventListener("click", (e) => phases.push(e.eventPhase));
        parent.addEventListener("click", (e) => phases.push(e.eventPhase), false);

        const event = new Event("click", { bubbles: true });
        child.dispatchEvent(event);

        assertEquals(phases, [
            EventPhase.CAPTURING_PHASE,
            EventPhase.AT_TARGET,
            EventPhase.BUBBLING_PHASE,
        ]);

        // Event phase should be reset after dispatch
        assertEquals(event.eventPhase, EventPhase.NONE);
    },
});

Deno.test({
    name: "EventTarget - currentTarget is set correctly during dispatch",
    fn() {
        const parent = new EventTarget();
        const child = new EventTarget();
        child.setParent(parent);

        const currentTargets: (EventTarget | null)[] = [];

        parent.addEventListener("click", (e) => currentTargets.push(e.currentTarget), true);
        child.addEventListener("click", (e) => currentTargets.push(e.currentTarget));
        parent.addEventListener("click", (e) => currentTargets.push(e.currentTarget), false);

        const event = new Event("click", { bubbles: true });
        child.dispatchEvent(event);

        assertEquals(currentTargets, [parent, child, parent]);

        // currentTarget should be reset after dispatch
        assertEquals(event.currentTarget, null);
    },
});

// ============================================================================
// Integration Tests
// ============================================================================

Deno.test({
    name: "EventTarget - complex event flow with multiple listeners",
    fn() {
        const root = new EventTarget();
        const parent = new EventTarget();
        const child = new EventTarget();

        parent.setParent(root);
        child.setParent(parent);

        const log: string[] = [];

        // Capture phase listeners
        root.addEventListener("click", () => log.push("root-capture"), true);
        parent.addEventListener("click", () => log.push("parent-capture"), true);

        // Target phase listeners
        child.addEventListener("click", () => log.push("child-1"));
        child.addEventListener("click", () => log.push("child-2"));

        // Bubble phase listeners
        parent.addEventListener("click", () => log.push("parent-bubble"));
        root.addEventListener("click", () => log.push("root-bubble"));

        const event = new Event("click", { bubbles: true });
        child.dispatchEvent(event);

        assertEquals(log, [
            "root-capture",
            "parent-capture",
            "child-1",
            "child-2",
            "parent-bubble",
            "root-bubble",
        ]);
    },
});

Deno.test({
    name: "EventTarget - custom event with data propagates correctly",
    fn() {
        const parent = new EventTarget();
        const child = new EventTarget();
        child.setParent(parent);

        let receivedDetail: unknown = null;

        parent.addEventListener("custom", (e) => {
            receivedDetail = (e as CustomEvent).detail;
        });

        const detail = { message: "Hello", count: 42 };
        const event = new CustomEvent("custom", { bubbles: true, detail });
        child.dispatchEvent(event);

        assertEquals(receivedDetail, detail);
    },
});
