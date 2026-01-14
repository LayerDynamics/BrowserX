/**
 * Event System
 *
 * Core event types and event emitter for the proxy engine.
 * Events are emitted throughout request lifecycle, connection management,
 * caching operations, and health monitoring.
 */

/**
 * Proxy event types
 */
export type ProxyEvent =
  | RequestReceivedEvent
  | RequestRoutedEvent
  | RequestCompletedEvent
  | ConnectionOpenedEvent
  | ConnectionClosedEvent
  | ConnectionErrorEvent
  | CacheHitEvent
  | CacheMissEvent
  | CacheEvictionEvent
  | HealthCheckPassedEvent
  | HealthCheckFailedEvent;

/**
 * Request received event
 */
export interface RequestReceivedEvent {
  type: "request_received";
  requestId: string;
  clientIP: string;
  clientPort: number;
  method: string;
  url: string;
  protocol: string;
  timestamp: number;
}

/**
 * Request routed event
 */
export interface RequestRoutedEvent {
  type: "request_routed";
  requestId: string;
  route: string;
  upstream: string;
  loadBalanceStrategy?: string;
  timestamp: number;
}

/**
 * Request completed event
 */
export interface RequestCompletedEvent {
  type: "request_completed";
  requestId: string;
  statusCode: number;
  statusText: string;
  duration: number;
  bytesIn: number;
  bytesOut: number;
  fromCache: boolean;
  timestamp: number;
}

/**
 * Connection opened event
 */
export interface ConnectionOpenedEvent {
  type: "connection_opened";
  connectionId: string;
  clientIP: string;
  clientPort: number;
  serverIP: string;
  serverPort: number;
  protocol: string;
  timestamp: number;
}

/**
 * Connection closed event
 */
export interface ConnectionClosedEvent {
  type: "connection_closed";
  connectionId: string;
  duration: number;
  requestsServed: number;
  bytesIn: number;
  bytesOut: number;
  reason: string;
  timestamp: number;
}

/**
 * Connection error event
 */
export interface ConnectionErrorEvent {
  type: "connection_error";
  connectionId: string;
  error: string;
  errorCode?: string;
  recoverable: boolean;
  timestamp: number;
}

/**
 * Cache hit event
 */
export interface CacheHitEvent {
  type: "cache_hit";
  requestId: string;
  key: string;
  age: number;
  size: number;
  timestamp: number;
}

/**
 * Cache miss event
 */
export interface CacheMissEvent {
  type: "cache_miss";
  requestId: string;
  key: string;
  reason: "not_found" | "expired" | "invalid";
  timestamp: number;
}

/**
 * Cache eviction event
 */
export interface CacheEvictionEvent {
  type: "cache_eviction";
  key: string;
  reason: "ttl_expired" | "lru_eviction" | "size_limit" | "manual";
  age: number;
  size: number;
  timestamp: number;
}

/**
 * Health check passed event
 */
export interface HealthCheckPassedEvent {
  type: "health_check_passed";
  serverId: string;
  serverHost: string;
  serverPort: number;
  responseTime: number;
  timestamp: number;
}

/**
 * Health check failed event
 */
export interface HealthCheckFailedEvent {
  type: "health_check_failed";
  serverId: string;
  serverHost: string;
  serverPort: number;
  error: string;
  attemptNumber: number;
  timestamp: number;
}

/**
 * Event listener function
 */
export type EventListener = (event: ProxyEvent) => void | Promise<void>;

/**
 * Event emitter for proxy events
 */
export class EventEmitter {
  private listeners = new Map<string, EventListener[]>();
  private wildcardListeners: EventListener[] = [];

  /**
   * Register event listener
   */
  on(eventType: string, listener: EventListener): void {
    if (eventType === "*") {
      this.wildcardListeners.push(listener);
      return;
    }

    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }

    this.listeners.get(eventType)!.push(listener);
  }

  /**
   * Register one-time event listener
   */
  once(eventType: string, listener: EventListener): void {
    const onceWrapper: EventListener = async (event) => {
      await listener(event);
      this.off(eventType, onceWrapper);
    };

    this.on(eventType, onceWrapper);
  }

  /**
   * Remove event listener
   */
  off(eventType: string, listener: EventListener): void {
    if (eventType === "*") {
      const index = this.wildcardListeners.indexOf(listener);
      if (index !== -1) {
        this.wildcardListeners.splice(index, 1);
      }
      return;
    }

    const listeners = this.listeners.get(eventType);
    if (!listeners) {
      return;
    }

    const index = listeners.indexOf(listener);
    if (index !== -1) {
      listeners.splice(index, 1);
    }

    // Clean up empty listener arrays
    if (listeners.length === 0) {
      this.listeners.delete(eventType);
    }
  }

  /**
   * Emit event to all registered listeners
   */
  async emit(event: ProxyEvent): Promise<void> {
    // Get specific event type listeners
    const listeners = this.listeners.get(event.type) || [];

    // Combine with wildcard listeners
    const allListeners = [...listeners, ...this.wildcardListeners];

    // Execute all listeners
    const promises = allListeners.map(async (listener) => {
      try {
        await listener(event);
      } catch (error) {
        console.error(`[EventEmitter] Error in listener for ${event.type}:`, error);
      }
    });

    await Promise.all(promises);
  }

  /**
   * Emit event synchronously (fire and forget)
   */
  emitSync(event: ProxyEvent): void {
    // Get specific event type listeners
    const listeners = this.listeners.get(event.type) || [];

    // Combine with wildcard listeners
    const allListeners = [...listeners, ...this.wildcardListeners];

    // Execute all listeners synchronously
    for (const listener of allListeners) {
      try {
        const result = listener(event);
        // If listener returns a promise, don't wait for it
        if (result instanceof Promise) {
          result.catch((error) => {
            console.error(`[EventEmitter] Async error in listener for ${event.type}:`, error);
          });
        }
      } catch (error) {
        console.error(`[EventEmitter] Error in listener for ${event.type}:`, error);
      }
    }
  }

  /**
   * Remove all listeners for a specific event type
   */
  removeAllListeners(eventType?: string): void {
    if (eventType === undefined) {
      // Remove all listeners
      this.listeners.clear();
      this.wildcardListeners = [];
    } else if (eventType === "*") {
      // Remove wildcard listeners
      this.wildcardListeners = [];
    } else {
      // Remove specific event listeners
      this.listeners.delete(eventType);
    }
  }

  /**
   * Get count of listeners for event type
   */
  listenerCount(eventType: string): number {
    if (eventType === "*") {
      return this.wildcardListeners.length;
    }

    const listeners = this.listeners.get(eventType);
    return listeners ? listeners.length : 0;
  }

  /**
   * Get all event types with listeners
   */
  eventTypes(): string[] {
    return Array.from(this.listeners.keys());
  }
}

/**
 * Global event emitter instance for proxy engine
 */
export const globalEventEmitter = new EventEmitter();
