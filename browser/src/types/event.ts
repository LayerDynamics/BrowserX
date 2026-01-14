// ============================================================================
// EVENT TYPES
// ============================================================================

import type { Pixels, Timestamp } from "./identifiers.ts";

/**
 * Event type
 */
export type EventType = string;

/**
 * Event phase
 */
export enum EventPhase {
    NONE = 0,
    CAPTURING_PHASE = 1,
    AT_TARGET = 2,
    BUBBLING_PHASE = 3,
}

/**
 * Event
 */
export interface Event {
    type: EventType;
    target: EventTarget | null;
    currentTarget: EventTarget | null;
    eventPhase: EventPhase;
    bubbles: boolean;
    cancelable: boolean;
    defaultPrevented: boolean;
    timeStamp: Timestamp;

    /**
     * Stop propagation to other listeners
     */
    stopPropagation(): void;

    /**
     * Stop immediate propagation (including current target)
     */
    stopImmediatePropagation(): void;

    /**
     * Prevent default action
     */
    preventDefault(): void;
}

/**
 * Event listener
 */
export type EventListener = (event: Event) => void;

/**
 * Event listener options
 */
export interface EventListenerOptions {
    capture?: boolean;
    once?: boolean;
    passive?: boolean;
    signal?: AbortSignal;
}

/**
 * Event target (base for DOM nodes)
 */
export interface EventTarget {
    /**
     * Add event listener
     */
    addEventListener(
        type: EventType,
        listener: EventListener,
        options?: EventListenerOptions | boolean,
    ): void;

    /**
     * Remove event listener
     */
    removeEventListener(
        type: EventType,
        listener: EventListener,
        options?: EventListenerOptions | boolean,
    ): void;

    /**
     * Dispatch event
     */
    dispatchEvent(event: Event): boolean;
}

/**
 * Mouse event
 */
export interface MouseEvent extends Event {
    clientX: Pixels;
    clientY: Pixels;
    screenX: Pixels;
    screenY: Pixels;
    button: number;
    buttons: number;
    ctrlKey: boolean;
    shiftKey: boolean;
    altKey: boolean;
    metaKey: boolean;
}

/**
 * Keyboard event
 */
export interface KeyboardEvent extends Event {
    key: string;
    code: string;
    keyCode: number;
    ctrlKey: boolean;
    shiftKey: boolean;
    altKey: boolean;
    metaKey: boolean;
    repeat: boolean;
}
