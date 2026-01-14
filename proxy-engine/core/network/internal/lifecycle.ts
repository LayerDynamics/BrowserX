/**
 * Connection Lifecycle Manager
 *
 * Manage connection lifecycle events and hooks
 */

import type { ConnectionID } from "./connection_registry.ts";
import type { NetworkEvent } from "./event_bus.ts";

/**
 * Lifecycle phase
 */
export type LifecyclePhase =
  | "beforeConnect"
  | "afterConnect"
  | "beforeRequest"
  | "afterRequest"
  | "beforeResponse"
  | "afterResponse"
  | "beforeClose"
  | "afterClose"
  | "onError"
  | "onTimeout"
  | "onIdle";

/**
 * Lifecycle context
 */
export interface LifecycleContext {
  connectionId: ConnectionID;
  phase: LifecyclePhase;
  timestamp: number;
  metadata: Record<string, unknown>;
}

/**
 * Lifecycle hook function
 */
export type LifecycleHook = (
  context: LifecycleContext,
) => void | Promise<void>;

/**
 * Hook registration
 */
interface HookRegistration {
  hook: LifecycleHook;
  priority: number;
}

/**
 * Connection Lifecycle Manager
 */
export class LifecycleManager {
  private hooks: Map<LifecyclePhase, HookRegistration[]> = new Map();

  /**
   * Register lifecycle hook
   */
  registerHook(
    phase: LifecyclePhase,
    hook: LifecycleHook,
    priority: number = 0,
  ): () => void {
    const hooks = this.hooks.get(phase) || [];
    hooks.push({ hook, priority });

    // Sort by priority (higher first)
    hooks.sort((a, b) => b.priority - a.priority);

    this.hooks.set(phase, hooks);

    // Return unregister function
    return () => this.unregisterHook(phase, hook);
  }

  /**
   * Unregister lifecycle hook
   */
  unregisterHook(phase: LifecyclePhase, hook: LifecycleHook): void {
    const hooks = this.hooks.get(phase);
    if (!hooks) return;

    const index = hooks.findIndex((h) => h.hook === hook);
    if (index !== -1) {
      hooks.splice(index, 1);
    }

    if (hooks.length === 0) {
      this.hooks.delete(phase);
    }
  }

  /**
   * Execute lifecycle phase hooks
   */
  async executePhase(
    connectionId: ConnectionID,
    phase: LifecyclePhase,
    metadata: Record<string, unknown> = {},
  ): Promise<void> {
    const hooks = this.hooks.get(phase);
    if (!hooks || hooks.length === 0) return;

    const context: LifecycleContext = {
      connectionId,
      phase,
      timestamp: Date.now(),
      metadata,
    };

    for (const { hook } of hooks) {
      try {
        await hook(context);
      } catch (error) {
        console.error(`Error in lifecycle hook for ${phase}:`, error);
        // Continue executing other hooks
      }
    }
  }

  /**
   * Get hook count for phase
   */
  getHookCount(phase: LifecyclePhase): number {
    return this.hooks.get(phase)?.length || 0;
  }

  /**
   * Remove all hooks for phase
   */
  removeHooks(phase?: LifecyclePhase): void {
    if (phase) {
      this.hooks.delete(phase);
    } else {
      this.hooks.clear();
    }
  }

  /**
   * Get all registered phases
   */
  getPhases(): LifecyclePhase[] {
    return Array.from(this.hooks.keys());
  }
}

/**
 * Global lifecycle manager instance
 */
export const globalLifecycle = new LifecycleManager();

/**
 * Helper functions for common lifecycle phases
 */

export function onBeforeConnect(
  hook: LifecycleHook,
  priority?: number,
): () => void {
  return globalLifecycle.registerHook("beforeConnect", hook, priority);
}

export function onAfterConnect(
  hook: LifecycleHook,
  priority?: number,
): () => void {
  return globalLifecycle.registerHook("afterConnect", hook, priority);
}

export function onBeforeRequest(
  hook: LifecycleHook,
  priority?: number,
): () => void {
  return globalLifecycle.registerHook("beforeRequest", hook, priority);
}

export function onAfterRequest(
  hook: LifecycleHook,
  priority?: number,
): () => void {
  return globalLifecycle.registerHook("afterRequest", hook, priority);
}

export function onBeforeResponse(
  hook: LifecycleHook,
  priority?: number,
): () => void {
  return globalLifecycle.registerHook("beforeResponse", hook, priority);
}

export function onAfterResponse(
  hook: LifecycleHook,
  priority?: number,
): () => void {
  return globalLifecycle.registerHook("afterResponse", hook, priority);
}

export function onBeforeClose(
  hook: LifecycleHook,
  priority?: number,
): () => void {
  return globalLifecycle.registerHook("beforeClose", hook, priority);
}

export function onAfterClose(
  hook: LifecycleHook,
  priority?: number,
): () => void {
  return globalLifecycle.registerHook("afterClose", hook, priority);
}

export function onError(hook: LifecycleHook, priority?: number): () => void {
  return globalLifecycle.registerHook("onError", hook, priority);
}

export function onTimeout(hook: LifecycleHook, priority?: number): () => void {
  return globalLifecycle.registerHook("onTimeout", hook, priority);
}

export function onIdle(hook: LifecycleHook, priority?: number): () => void {
  return globalLifecycle.registerHook("onIdle", hook, priority);
}
