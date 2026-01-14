/**
 * Storage Events
 *
 * Implements storage event emission for cross-tab communication.
 * Notifies listeners when localStorage or sessionStorage changes.
 */

/**
 * Storage event interface
 */
export interface StorageEvent {
    key: string;
    oldValue: string | null;
    newValue: string | null;
    url: string;
    storageArea: "localStorage" | "sessionStorage";
}

/**
 * Storage event listener type
 */
export type StorageEventListener = (event: StorageEvent) => void;

/**
 * Storage event emitter
 * Manages event listeners and broadcasts storage changes
 */
export class StorageEventEmitter {
    private listeners: Set<StorageEventListener> = new Set();
    private enabled: boolean = true;

    /**
     * Add event listener
     */
    addEventListener(listener: StorageEventListener): void {
        this.listeners.add(listener);
    }

    /**
     * Remove event listener
     */
    removeEventListener(listener: StorageEventListener): void {
        this.listeners.delete(listener);
    }

    /**
     * Remove all listeners
     */
    removeAllListeners(): void {
        this.listeners.clear();
    }

    /**
     * Emit storage event to all listeners
     */
    emit(event: StorageEvent): void {
        if (!this.enabled) {
            return;
        }

        // Create immutable event copy
        const immutableEvent: StorageEvent = {
            key: event.key,
            oldValue: event.oldValue,
            newValue: event.newValue,
            url: event.url,
            storageArea: event.storageArea,
        };

        // Notify all listeners asynchronously
        queueMicrotask(() => {
            for (const listener of this.listeners) {
                try {
                    listener(immutableEvent);
                } catch (error) {
                    // Log error but don't stop other listeners
                    console.error("Storage event listener error:", error);
                }
            }
        });
    }

    /**
     * Get listener count
     */
    getListenerCount(): number {
        return this.listeners.size;
    }

    /**
     * Enable/disable event emission
     */
    setEnabled(enabled: boolean): void {
        this.enabled = enabled;
    }

    /**
     * Check if events are enabled
     */
    isEnabled(): boolean {
        return this.enabled;
    }
}

/**
 * Global storage event coordinator
 * Manages storage events across all origins
 */
export class StorageEventCoordinator {
    private emitters: Map<string, StorageEventEmitter> = new Map();

    /**
     * Get emitter for origin
     */
    getEmitter(origin: string): StorageEventEmitter {
        if (!this.emitters.has(origin)) {
            this.emitters.set(origin, new StorageEventEmitter());
        }
        return this.emitters.get(origin)!;
    }

    /**
     * Broadcast event to all origins except the source
     */
    broadcast(event: StorageEvent, sourceOrigin: string): void {
        for (const [origin, emitter] of this.emitters.entries()) {
            // Don't broadcast to the origin that triggered the event
            if (origin !== sourceOrigin) {
                emitter.emit(event);
            }
        }
    }

    /**
     * Remove emitter for origin
     */
    removeEmitter(origin: string): void {
        const emitter = this.emitters.get(origin);
        if (emitter) {
            emitter.removeAllListeners();
            this.emitters.delete(origin);
        }
    }

    /**
     * Get all origins with listeners
     */
    getOrigins(): string[] {
        return Array.from(this.emitters.keys());
    }

    /**
     * Clear all emitters
     */
    clearAll(): void {
        for (const emitter of this.emitters.values()) {
            emitter.removeAllListeners();
        }
        this.emitters.clear();
    }
}

// Export singleton coordinator
export const storageEventCoordinator = new StorageEventCoordinator();
