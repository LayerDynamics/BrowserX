/**
 * Signal Handler
 *
 * Centralized signal handling for the BrowserX Runtime.
 * Manages SIGINT, SIGTERM, and SIGHUP signals.
 */

import type {
  RuntimeEvent,
  RuntimeEventListener,
  SignalCallback,
  SignalType,
} from "../types.ts";
import type { SignalConfig } from "../config/RuntimeConfig.ts";

/**
 * Signal Handler
 *
 * Provides centralized signal handling across the runtime.
 */
export class SignalHandler {
  private config: SignalConfig;
  private eventListeners: RuntimeEventListener[] = [];
  private signalCallbacks: Map<SignalType, SignalCallback[]> = new Map();
  private registered = false;
  private signalListeners: Map<SignalType, () => void> = new Map();

  constructor(config: SignalConfig) {
    this.config = config;

    // Initialize callback maps
    this.signalCallbacks.set("SIGINT", []);
    this.signalCallbacks.set("SIGTERM", []);
    this.signalCallbacks.set("SIGHUP", []);
  }

  /**
   * Register signal handlers
   */
  register(): void {
    if (this.registered) {
      return;
    }

    if (this.config.handleSIGINT) {
      this.registerSignal("SIGINT");
    }

    if (this.config.handleSIGTERM) {
      this.registerSignal("SIGTERM");
    }

    if (this.config.handleSIGHUP) {
      this.registerSignal("SIGHUP");
    }

    this.registered = true;
  }

  /**
   * Register a signal handler
   */
  private registerSignal(signal: SignalType): void {
    const handler = () => {
      this.handleSignal(signal);
    };

    try {
      Deno.addSignalListener(signal, handler);
      this.signalListeners.set(signal, handler);
    } catch (error) {
      console.warn(`[SignalHandler] Failed to register ${signal} handler:`, error);
    }
  }

  /**
   * Handle a signal
   */
  private handleSignal(signal: SignalType): void {
    // Emit event
    this.emitEvent({
      type: "signal_received",
      signal,
    });

    // Call registered callbacks
    const callbacks = this.signalCallbacks.get(signal) ?? [];
    for (const callback of callbacks) {
      try {
        callback(signal);
      } catch (error) {
        console.error(`[SignalHandler] Error in ${signal} callback:`, error);
      }
    }
  }

  /**
   * Unregister signal handlers
   */
  unregister(): void {
    if (!this.registered) {
      return;
    }

    for (const [signal, handler] of this.signalListeners.entries()) {
      try {
        Deno.removeSignalListener(signal, handler);
      } catch (error) {
        console.warn(
          `[SignalHandler] Failed to unregister ${signal} handler:`,
          error,
        );
      }
    }

    this.signalListeners.clear();
    this.registered = false;
  }

  /**
   * Add a callback for a specific signal
   */
  onSignal(signal: SignalType, callback: SignalCallback): void {
    const callbacks = this.signalCallbacks.get(signal);
    if (callbacks) {
      callbacks.push(callback);
    }
  }

  /**
   * Remove a callback for a specific signal
   */
  offSignal(signal: SignalType, callback: SignalCallback): void {
    const callbacks = this.signalCallbacks.get(signal);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index !== -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  /**
   * Add callback for shutdown signals (SIGINT, SIGTERM)
   */
  onShutdown(callback: SignalCallback): void {
    this.onSignal("SIGINT", callback);
    this.onSignal("SIGTERM", callback);
  }

  /**
   * Add callback for reload signal (SIGHUP)
   */
  onReload(callback: SignalCallback): void {
    this.onSignal("SIGHUP", callback);
  }

  /**
   * Check if signal handlers are registered
   */
  isRegistered(): boolean {
    return this.registered;
  }

  /**
   * Get configuration
   */
  getConfig(): SignalConfig {
    return { ...this.config };
  }

  /**
   * Add event listener
   */
  addEventListener(listener: RuntimeEventListener): void {
    this.eventListeners.push(listener);
  }

  /**
   * Remove event listener
   */
  removeEventListener(listener: RuntimeEventListener): void {
    const index = this.eventListeners.indexOf(listener);
    if (index !== -1) {
      this.eventListeners.splice(index, 1);
    }
  }

  /**
   * Emit event to all listeners
   */
  private emitEvent(event: RuntimeEvent): void {
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch {
        // Ignore listener errors
      }
    }
  }
}
