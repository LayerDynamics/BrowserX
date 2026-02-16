/**
 * Event Bus
 *
 * Internal pub/sub event bus for cross-domain communication.
 * Domains use this to subscribe to events from other domains
 * without direct imports, maintaining loose coupling.
 */

export type EventHandler = (data: unknown) => void;

/**
 * EventBus - central pub/sub hub for DevTools domain agents
 */
export class EventBus {
    private listeners: Map<string, Set<EventHandler>> = new Map();

    /**
     * Subscribe to an event
     */
    on(event: string, handler: EventHandler): void {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event)!.add(handler);
    }

    /**
     * Unsubscribe from an event
     */
    off(event: string, handler: EventHandler): void {
        const handlers = this.listeners.get(event);
        if (handlers) {
            handlers.delete(handler);
            if (handlers.size === 0) {
                this.listeners.delete(event);
            }
        }
    }

    /**
     * Emit an event to all subscribers
     */
    emit(event: string, data?: unknown): void {
        const handlers = this.listeners.get(event);
        if (handlers) {
            for (const handler of handlers) {
                try {
                    handler(data);
                } catch (error) {
                    console.error(`EventBus: Error in handler for "${event}":`, error);
                }
            }
        }
    }

    /**
     * Subscribe to an event once (auto-unsubscribes after first call)
     */
    once(event: string, handler: EventHandler): void {
        const wrappedHandler: EventHandler = (data: unknown) => {
            this.off(event, wrappedHandler);
            handler(data);
        };
        this.on(event, wrappedHandler);
    }

    /**
     * Remove all listeners for all events
     */
    removeAllListeners(): void {
        this.listeners.clear();
    }

    /**
     * Get listener count for an event
     */
    listenerCount(event: string): number {
        return this.listeners.get(event)?.size ?? 0;
    }

    /**
     * Get all registered event names
     */
    eventNames(): string[] {
        return Array.from(this.listeners.keys());
    }
}
