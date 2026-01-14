/**
 * Event Target
 *
 * Implements DOM event system with event dispatching, bubbling, and capturing.
 * Provides EventTarget interface for DOM nodes.
 */

/**
 * Event phase constants
 */
export enum EventPhase {
    NONE = 0,
    CAPTURING_PHASE = 1,
    AT_TARGET = 2,
    BUBBLING_PHASE = 3,
}

/**
 * Event interface
 */
export interface DOMEvent {
    type: string;
    target: EventTarget | null;
    currentTarget: EventTarget | null;
    eventPhase: EventPhase;
    bubbles: boolean;
    cancelable: boolean;
    defaultPrevented: boolean;
    composed: boolean;
    isTrusted: boolean;
    timeStamp: number;

    // Methods
    preventDefault(): void;
    stopPropagation(): void;
    stopImmediatePropagation(): void;
}

/**
 * Event init options
 */
export interface EventInit {
    bubbles?: boolean;
    cancelable?: boolean;
    composed?: boolean;
}

/**
 * Event listener entry
 */
interface EventListenerEntry {
    listener: EventListenerOrEventListenerObject;
    options: AddEventListenerOptions;
}

/**
 * Event listener or object
 */
export type EventListenerOrEventListenerObject =
    | ((event: DOMEvent) => void)
    | { handleEvent(event: DOMEvent): void };

/**
 * Add event listener options
 */
export interface AddEventListenerOptions {
    capture?: boolean;
    once?: boolean;
    passive?: boolean;
    signal?: AbortSignal;
}

/**
 * Event Target implementation
 */
export class EventTarget {
    private listeners: Map<string, EventListenerEntry[]> = new Map();
    private parent: EventTarget | null = null;

    /**
     * Add event listener
     */
    addEventListener(
        type: string,
        listener: EventListenerOrEventListenerObject | null,
        options?: boolean | AddEventListenerOptions,
    ): void {
        if (!listener) {
            return;
        }

        // Normalize options
        const normalizedOptions: AddEventListenerOptions = typeof options === "boolean"
            ? { capture: options }
            : options ?? {};

        // Get or create listener list for this event type
        if (!this.listeners.has(type)) {
            this.listeners.set(type, []);
        }

        const entries = this.listeners.get(type)!;

        // Check if listener already exists
        const existing = entries.find((entry) =>
            entry.listener === listener &&
            entry.options.capture === normalizedOptions.capture
        );

        if (existing) {
            return; // Already registered
        }

        // Add listener
        entries.push({
            listener,
            options: normalizedOptions,
        });
    }

    /**
     * Remove event listener
     */
    removeEventListener(
        type: string,
        listener: EventListenerOrEventListenerObject | null,
        options?: boolean | AddEventListenerOptions,
    ): void {
        if (!listener) {
            return;
        }

        const entries = this.listeners.get(type);
        if (!entries) {
            return;
        }

        // Normalize options
        const normalizedOptions: AddEventListenerOptions = typeof options === "boolean"
            ? { capture: options }
            : options ?? {};

        // Find and remove listener
        const index = entries.findIndex((entry) =>
            entry.listener === listener &&
            entry.options.capture === normalizedOptions.capture
        );

        if (index !== -1) {
            entries.splice(index, 1);
        }

        // Clean up empty list
        if (entries.length === 0) {
            this.listeners.delete(type);
        }
    }

    /**
     * Dispatch event
     */
    dispatchEvent(event: DOMEvent): boolean {
        // Set initial event properties
        if (event.target === null) {
            (event as { target: EventTarget }).target = this;
        }
        (event as { isTrusted: boolean }).isTrusted = true;
        (event as { timeStamp: number }).timeStamp = Date.now();

        // Build event path (capture and bubble phases)
        const path = this.buildEventPath();

        // Capture phase
        (event as { eventPhase: EventPhase }).eventPhase = EventPhase.CAPTURING_PHASE;
        for (let i = path.length - 1; i > 0; i--) {
            const target = path[i];
            (event as { currentTarget: EventTarget }).currentTarget = target;
            target.invokeListeners(event, true);

            if ((event as { propagationStopped?: boolean }).propagationStopped) {
                break;
            }
        }

        // Target phase
        if (!(event as { propagationStopped?: boolean }).propagationStopped) {
            (event as { eventPhase: EventPhase }).eventPhase = EventPhase.AT_TARGET;
            (event as { currentTarget: EventTarget }).currentTarget = this;
            this.invokeListeners(event, false);
        }

        // Bubble phase
        if (event.bubbles && !(event as { propagationStopped?: boolean }).propagationStopped) {
            (event as { eventPhase: EventPhase }).eventPhase = EventPhase.BUBBLING_PHASE;
            for (let i = 1; i < path.length; i++) {
                const target = path[i];
                (event as { currentTarget: EventTarget }).currentTarget = target;
                target.invokeListeners(event, false);

                if ((event as { propagationStopped?: boolean }).propagationStopped) {
                    break;
                }
            }
        }

        // Reset event phase
        (event as { eventPhase: EventPhase }).eventPhase = EventPhase.NONE;
        (event as { currentTarget: EventTarget | null }).currentTarget = null;

        return !event.defaultPrevented;
    }

    /**
     * Invoke listeners for event
     */
    private invokeListeners(event: DOMEvent, capture: boolean): void {
        const entries = this.listeners.get(event.type);
        if (!entries) {
            return;
        }

        // Filter listeners by capture phase
        const matchingEntries = entries.filter((entry) => !!entry.options.capture === capture);

        for (const entry of matchingEntries) {
            // Check for abort signal
            if (entry.options.signal?.aborted) {
                continue;
            }

            // Check immediate propagation stopped
            if ((event as { immediatePropagationStopped?: boolean }).immediatePropagationStopped) {
                break;
            }

            try {
                // Invoke listener
                if (typeof entry.listener === "function") {
                    entry.listener(event);
                } else {
                    entry.listener.handleEvent(event);
                }
            } catch (error) {
                console.error("Event listener error:", error);
            }

            // Remove if once
            if (entry.options.once) {
                this.removeEventListener(event.type, entry.listener, entry.options);
            }
        }
    }

    /**
     * Build event path from this target to root
     */
    private buildEventPath(): EventTarget[] {
        const path: EventTarget[] = [this];
        let current = this.parent;

        while (current) {
            path.push(current);
            current = current.parent;
        }

        return path;
    }

    /**
     * Set parent for event bubbling
     */
    setParent(parent: EventTarget | null): void {
        this.parent = parent;
    }

    /**
     * Get parent
     */
    getParent(): EventTarget | null {
        return this.parent;
    }

    /**
     * Check if has listeners for event type
     */
    hasEventListener(type: string): boolean {
        const entries = this.listeners.get(type);
        return entries !== undefined && entries.length > 0;
    }

    /**
     * Get listener count for event type
     */
    getListenerCount(type: string): number {
        const entries = this.listeners.get(type);
        return entries ? entries.length : 0;
    }

    /**
     * Remove all listeners
     */
    removeAllListeners(): void {
        this.listeners.clear();
    }
}

/**
 * Event implementation
 */
export class Event implements DOMEvent {
    type: string;
    target: EventTarget | null = null;
    currentTarget: EventTarget | null = null;
    eventPhase: EventPhase = EventPhase.NONE;
    bubbles: boolean;
    cancelable: boolean;
    defaultPrevented: boolean = false;
    composed: boolean;
    isTrusted: boolean = false;
    timeStamp: number = 0;

    private propagationStopped: boolean = false;
    private immediatePropagationStopped: boolean = false;

    constructor(type: string, init?: EventInit) {
        this.type = type;
        this.bubbles = init?.bubbles ?? false;
        this.cancelable = init?.cancelable ?? false;
        this.composed = init?.composed ?? false;
    }

    preventDefault(): void {
        if (this.cancelable) {
            this.defaultPrevented = true;
        }
    }

    stopPropagation(): void {
        this.propagationStopped = true;
    }

    stopImmediatePropagation(): void {
        this.propagationStopped = true;
        this.immediatePropagationStopped = true;
    }
}

/**
 * Custom Event
 */
export class CustomEvent<T = unknown> extends Event {
    detail: T;

    constructor(type: string, init?: EventInit & { detail?: T }) {
        super(type, init);
        this.detail = init?.detail as T;
    }
}

/**
 * Mouse Event
 */
export class MouseEvent extends Event {
    clientX: number;
    clientY: number;
    screenX: number;
    screenY: number;
    button: number;
    buttons: number;
    ctrlKey: boolean;
    shiftKey: boolean;
    altKey: boolean;
    metaKey: boolean;

    constructor(type: string, init?: EventInit & Partial<MouseEvent>) {
        super(type, init);
        this.clientX = init?.clientX ?? 0;
        this.clientY = init?.clientY ?? 0;
        this.screenX = init?.screenX ?? 0;
        this.screenY = init?.screenY ?? 0;
        this.button = init?.button ?? 0;
        this.buttons = init?.buttons ?? 0;
        this.ctrlKey = init?.ctrlKey ?? false;
        this.shiftKey = init?.shiftKey ?? false;
        this.altKey = init?.altKey ?? false;
        this.metaKey = init?.metaKey ?? false;
    }
}

/**
 * Keyboard Event
 */
export class KeyboardEvent extends Event {
    key: string;
    code: string;
    location: number;
    ctrlKey: boolean;
    shiftKey: boolean;
    altKey: boolean;
    metaKey: boolean;
    repeat: boolean;

    constructor(type: string, init?: EventInit & Partial<KeyboardEvent>) {
        super(type, init);
        this.key = init?.key ?? "";
        this.code = init?.code ?? "";
        this.location = init?.location ?? 0;
        this.ctrlKey = init?.ctrlKey ?? false;
        this.shiftKey = init?.shiftKey ?? false;
        this.altKey = init?.altKey ?? false;
        this.metaKey = init?.metaKey ?? false;
        this.repeat = init?.repeat ?? false;
    }
}
