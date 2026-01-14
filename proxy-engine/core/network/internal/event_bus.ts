/**
 * Network Event Bus
 *
 * Internal event distribution for network layer
 */

/**
 * Network event types
 */
export type NetworkEventType =
  | "connection:opened"
  | "connection:closed"
  | "connection:error"
  | "connection:timeout"
  | "connection:idle"
  | "request:received"
  | "request:sent"
  | "request:completed"
  | "request:failed"
  | "response:received"
  | "response:sent"
  | "data:read"
  | "data:written"
  | "pool:exhausted"
  | "pool:drained"
  | "health:check:passed"
  | "health:check:failed"
  | "circuit:opened"
  | "circuit:closed"
  | "resource:exhausted"
  | "resource:released";

/**
 * Base network event
 */
export interface NetworkEvent {
  type: NetworkEventType;
  timestamp: number;
  connectionId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Connection events
 */
export interface ConnectionOpenedEvent extends NetworkEvent {
  type: "connection:opened";
  connectionId: string;
  host: string;
  port: number;
  protocol: string;
}

export interface ConnectionClosedEvent extends NetworkEvent {
  type: "connection:closed";
  connectionId: string;
  reason?: string;
}

export interface ConnectionErrorEvent extends NetworkEvent {
  type: "connection:error";
  connectionId: string;
  error: Error;
}

/**
 * Request events
 */
export interface RequestReceivedEvent extends NetworkEvent {
  type: "request:received";
  requestId: string;
  method: string;
  url: string;
}

export interface RequestCompletedEvent extends NetworkEvent {
  type: "request:completed";
  requestId: string;
  statusCode: number;
  duration: number;
}

/**
 * Data events
 */
export interface DataReadEvent extends NetworkEvent {
  type: "data:read";
  connectionId: string;
  bytes: number;
}

export interface DataWrittenEvent extends NetworkEvent {
  type: "data:written";
  connectionId: string;
  bytes: number;
}

/**
 * Event handler function
 */
export type EventHandler<T extends NetworkEvent = NetworkEvent> = (
  event: T,
) => void | Promise<void>;

/**
 * Event listener
 */
interface EventListener {
  handler: EventHandler;
  once: boolean;
}

/**
 * Network Event Bus
 */
export class NetworkEventBus {
  private listeners: Map<NetworkEventType, EventListener[]> = new Map();
  private wildcardListeners: EventListener[] = [];
  private eventQueue: NetworkEvent[] = [];
  private isProcessing = false;

  /**
   * Subscribe to event type
   */
  on<T extends NetworkEvent>(
    type: T["type"],
    handler: EventHandler<T>,
  ): () => void {
    const listeners = this.listeners.get(type) || [];
    listeners.push({ handler: handler as EventHandler, once: false });
    this.listeners.set(type, listeners);

    // Return unsubscribe function
    return () => this.off(type, handler);
  }

  /**
   * Subscribe to event type (one-time)
   */
  once<T extends NetworkEvent>(
    type: T["type"],
    handler: EventHandler<T>,
  ): () => void {
    const listeners = this.listeners.get(type) || [];
    listeners.push({ handler: handler as EventHandler, once: true });
    this.listeners.set(type, listeners);

    // Return unsubscribe function
    return () => this.off(type, handler);
  }

  /**
   * Unsubscribe from event type
   */
  off<T extends NetworkEvent>(
    type: T["type"],
    handler: EventHandler<T>,
  ): void {
    const listeners = this.listeners.get(type);
    if (!listeners) return;

    const index = listeners.findIndex((l) => l.handler === handler);
    if (index !== -1) {
      listeners.splice(index, 1);
    }

    if (listeners.length === 0) {
      this.listeners.delete(type);
    }
  }

  /**
   * Subscribe to all events
   */
  onAll(handler: EventHandler): () => void {
    this.wildcardListeners.push({ handler, once: false });
    return () => this.offAll(handler);
  }

  /**
   * Unsubscribe from all events
   */
  offAll(handler: EventHandler): void {
    const index = this.wildcardListeners.findIndex((l) => l.handler === handler);
    if (index !== -1) {
      this.wildcardListeners.splice(index, 1);
    }
  }

  /**
   * Emit event
   */
  emit(event: NetworkEvent): void {
    // Add to queue
    this.eventQueue.push(event);

    // Process queue if not already processing
    if (!this.isProcessing) {
      this.processQueue();
    }
  }

  /**
   * Process event queue
   */
  private async processQueue(): Promise<void> {
    this.isProcessing = true;

    while (this.eventQueue.length > 0) {
      const event = this.eventQueue.shift()!;

      // Call type-specific listeners
      const listeners = this.listeners.get(event.type) || [];
      const toRemove: EventListener[] = [];

      for (const listener of listeners) {
        try {
          await listener.handler(event);

          if (listener.once) {
            toRemove.push(listener);
          }
        } catch (error) {
          console.error(`Error in event handler for ${event.type}:`, error);
        }
      }

      // Remove one-time listeners
      if (toRemove.length > 0) {
        const remaining = listeners.filter((l) => !toRemove.includes(l));
        if (remaining.length > 0) {
          this.listeners.set(event.type, remaining);
        } else {
          this.listeners.delete(event.type);
        }
      }

      // Call wildcard listeners
      for (const listener of this.wildcardListeners) {
        try {
          await listener.handler(event);
        } catch (error) {
          console.error(`Error in wildcard event handler:`, error);
        }
      }
    }

    this.isProcessing = false;
  }

  /**
   * Wait for specific event
   */
  waitFor<T extends NetworkEvent>(
    type: T["type"],
    timeout?: number,
    predicate?: (event: T) => boolean,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      let timeoutId: number | undefined;

      const handler = (event: T) => {
        if (!predicate || predicate(event)) {
          if (timeoutId !== undefined) {
            clearTimeout(timeoutId);
          }
          resolve(event);
        }
      };

      this.once(type, handler);

      if (timeout !== undefined) {
        timeoutId = setTimeout(() => {
          this.off(type, handler);
          reject(new Error(`Timeout waiting for event: ${type}`));
        }, timeout);
      }
    });
  }

  /**
   * Get listener count for event type
   */
  listenerCount(type: NetworkEventType): number {
    return (this.listeners.get(type)?.length || 0) +
      this.wildcardListeners.length;
  }

  /**
   * Remove all listeners
   */
  removeAllListeners(type?: NetworkEventType): void {
    if (type) {
      this.listeners.delete(type);
    } else {
      this.listeners.clear();
      this.wildcardListeners = [];
    }
  }

  /**
   * Get all event types with listeners
   */
  eventTypes(): NetworkEventType[] {
    return Array.from(this.listeners.keys());
  }
}

/**
 * Global event bus instance
 */
export const globalEventBus = new NetworkEventBus();

/**
 * Helper function to emit event
 */
export function emitNetworkEvent(event: NetworkEvent): void {
  globalEventBus.emit(event);
}

/**
 * Helper function to subscribe to events
 */
export function onNetworkEvent<T extends NetworkEvent>(
  type: T["type"],
  handler: EventHandler<T>,
): () => void {
  return globalEventBus.on(type, handler);
}
