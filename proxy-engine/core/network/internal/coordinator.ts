/**
 * Network Layer Coordinator
 *
 * Coordinates between transport, pool, and gateway layers
 */

import {
  ConnectionRegistry,
  ConnectionState,
  globalRegistry,
  type ConnectionID,
  type ProtocolType,
} from "./connection_registry.ts";
import {
  emitNetworkEvent,
  globalEventBus,
  type NetworkEvent,
} from "./event_bus.ts";
import { globalLifecycle } from "./lifecycle.ts";
import { globalTracker, ResourceTracker } from "./resource_tracker.ts";

/**
 * Coordinator configuration
 */
export interface CoordinatorConfig {
  enableResourceTracking?: boolean;
  enableEventBus?: boolean;
  enableLifecycleHooks?: boolean;
  maxConnections?: number;
  idleTimeout?: number;
}

/**
 * Network Layer Coordinator
 */
export class NetworkCoordinator {
  private registry: ConnectionRegistry;
  private tracker: ResourceTracker;
  private config: CoordinatorConfig;

  constructor(
    config: CoordinatorConfig = {},
    registry: ConnectionRegistry = globalRegistry,
    tracker: ResourceTracker = globalTracker,
  ) {
    this.config = {
      enableResourceTracking: true,
      enableEventBus: true,
      enableLifecycleHooks: true,
      maxConnections: 10000,
      idleTimeout: 60000,
      ...config,
    };

    this.registry = registry;
    this.tracker = tracker;
  }

  /**
   * Coordinate connection opening
   */
  async openConnection(
    host: string,
    port: number,
    protocol: ProtocolType,
    metadata: Record<string, unknown> = {},
  ): Promise<ConnectionID | null> {
    // Check resource availability
    if (this.config.enableResourceTracking) {
      if (!this.tracker.isAvailable("connections")) {
        this.emitEvent({
          type: "resource:exhausted",
          timestamp: Date.now(),
          metadata: { resource: "connections" },
        });
        return null;
      }
    }

    // Execute before connect hooks
    if (this.config.enableLifecycleHooks) {
      const tempId = `temp_${Date.now()}`;
      await globalLifecycle.executePhase(tempId, "beforeConnect", {
        host,
        port,
        protocol,
        ...metadata,
      });
    }

    // Register connection
    const connectionId = this.registry.register(
      undefined,
      host,
      port,
      protocol,
      metadata,
    );

    // Allocate resources
    if (this.config.enableResourceTracking) {
      this.tracker.allocate("connections");
    }

    // Emit event
    this.emitEvent({
      type: "connection:opened",
      timestamp: Date.now(),
      connectionId,
      metadata: { host, port, protocol, ...metadata },
    } as NetworkEvent);

    // Execute after connect hooks
    if (this.config.enableLifecycleHooks) {
      await globalLifecycle.executePhase(connectionId, "afterConnect", {
        host,
        port,
        protocol,
      });
    }

    return connectionId;
  }

  /**
   * Coordinate connection closing
   */
  async closeConnection(
    connectionId: ConnectionID,
    reason?: string,
  ): Promise<void> {
    const conn = this.registry.get(connectionId);
    if (!conn) return;

    // Execute before close hooks
    if (this.config.enableLifecycleHooks) {
      await globalLifecycle.executePhase(connectionId, "beforeClose", {
        reason,
      });
    }

    // Update state
    this.registry.setState(connectionId, ConnectionState.CLOSING);

    // Release resources
    if (this.config.enableResourceTracking) {
      this.tracker.release("connections");
    }

    // Emit event
    this.emitEvent({
      type: "connection:closed",
      timestamp: Date.now(),
      connectionId,
      metadata: { reason },
    });

    // Unregister connection
    this.registry.unregister(connectionId);

    // Execute after close hooks
    if (this.config.enableLifecycleHooks) {
      await globalLifecycle.executePhase(connectionId, "afterClose", {
        reason,
      });
    }
  }

  /**
   * Coordinate request handling
   */
  async handleRequest(
    connectionId: ConnectionID,
    requestId: string,
    method: string,
    url: string,
  ): Promise<void> {
    // Execute before request hooks
    if (this.config.enableLifecycleHooks) {
      await globalLifecycle.executePhase(connectionId, "beforeRequest", {
        requestId,
        method,
        url,
      });
    }

    // Update connection state
    this.registry.setState(connectionId, ConnectionState.IN_USE);
    this.registry.incrementRequests(connectionId);

    // Emit event
    this.emitEvent({
      type: "request:received",
      timestamp: Date.now(),
      connectionId,
      metadata: { requestId, method, url },
    } as NetworkEvent);

    // Execute after request hooks
    if (this.config.enableLifecycleHooks) {
      await globalLifecycle.executePhase(connectionId, "afterRequest", {
        requestId,
        method,
        url,
      });
    }
  }

  /**
   * Coordinate response handling
   */
  async handleResponse(
    connectionId: ConnectionID,
    requestId: string,
    statusCode: number,
    duration: number,
  ): Promise<void> {
    // Execute before response hooks
    if (this.config.enableLifecycleHooks) {
      await globalLifecycle.executePhase(connectionId, "beforeResponse", {
        requestId,
        statusCode,
        duration,
      });
    }

    // Update connection state
    this.registry.setState(connectionId, ConnectionState.IDLE);

    // Emit event
    this.emitEvent({
      type: "request:completed",
      timestamp: Date.now(),
      connectionId,
      metadata: { requestId, statusCode, duration },
    } as NetworkEvent);

    // Execute after response hooks
    if (this.config.enableLifecycleHooks) {
      await globalLifecycle.executePhase(connectionId, "afterResponse", {
        requestId,
        statusCode,
        duration,
      });
    }
  }

  /**
   * Coordinate error handling
   */
  async handleError(
    connectionId: ConnectionID,
    error: Error,
  ): Promise<void> {
    // Update state
    this.registry.setState(connectionId, ConnectionState.ERROR);
    this.registry.incrementErrors(connectionId);

    // Emit event
    this.emitEvent({
      type: "connection:error",
      timestamp: Date.now(),
      connectionId,
      metadata: { error: error.message },
    } as NetworkEvent);

    // Execute error hooks
    if (this.config.enableLifecycleHooks) {
      await globalLifecycle.executePhase(connectionId, "onError", {
        error: error.message,
      });
    }
  }

  /**
   * Coordinate data read
   */
  recordDataRead(connectionId: ConnectionID, bytes: number): void {
    this.registry.updateActivity(connectionId, bytes, 0);

    if (this.config.enableResourceTracking) {
      this.tracker.recordBandwidth(bytes);
    }

    this.emitEvent({
      type: "data:read",
      timestamp: Date.now(),
      connectionId,
      metadata: { bytes },
    } as NetworkEvent);
  }

  /**
   * Coordinate data write
   */
  recordDataWrite(connectionId: ConnectionID, bytes: number): void {
    this.registry.updateActivity(connectionId, 0, bytes);

    if (this.config.enableResourceTracking) {
      this.tracker.recordBandwidth(bytes);
    }

    this.emitEvent({
      type: "data:written",
      timestamp: Date.now(),
      connectionId,
      metadata: { bytes },
    } as NetworkEvent);
  }

  /**
   * Emit network event
   */
  private emitEvent(event: NetworkEvent): void {
    if (this.config.enableEventBus) {
      emitNetworkEvent(event);
    }
  }

  /**
   * Get coordinator statistics
   */
  getStats(): {
    connections: ReturnType<ConnectionRegistry["getStats"]>;
    resources: ReturnType<ResourceTracker["getStats"]>;
  } {
    return {
      connections: this.registry.getStats(),
      resources: this.tracker.getStats(),
    };
  }

  /**
   * Check if system is healthy
   */
  isHealthy(): boolean {
    if (this.config.enableResourceTracking) {
      return !this.tracker.isUnderPressure();
    }
    return true;
  }
}

/**
 * Global coordinator instance
 */
export const globalCoordinator = new NetworkCoordinator();
