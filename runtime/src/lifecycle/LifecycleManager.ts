/**
 * Lifecycle Manager
 *
 * Manages the runtime state machine and coordinates component lifecycles.
 * Ensures valid state transitions and tracks component states.
 */

import {
  type ComponentId,
  type ComponentState,
  RuntimeState,
} from "../types.ts";

/**
 * State transition definition
 */
interface StateTransition {
  from: RuntimeState;
  to: RuntimeState;
  allowed: boolean;
}

/**
 * Valid state transitions
 */
const STATE_TRANSITIONS: StateTransition[] = [
  // Normal flow
  { from: RuntimeState.STOPPED, to: RuntimeState.STARTING, allowed: true },
  { from: RuntimeState.STARTING, to: RuntimeState.RUNNING, allowed: true },
  { from: RuntimeState.RUNNING, to: RuntimeState.STOPPING, allowed: true },
  { from: RuntimeState.STOPPING, to: RuntimeState.STOPPED, allowed: true },

  // Error transitions
  { from: RuntimeState.STARTING, to: RuntimeState.ERROR, allowed: true },
  { from: RuntimeState.RUNNING, to: RuntimeState.ERROR, allowed: true },
  { from: RuntimeState.STOPPING, to: RuntimeState.ERROR, allowed: true },

  // Recovery from error
  { from: RuntimeState.ERROR, to: RuntimeState.STOPPED, allowed: true },
  { from: RuntimeState.ERROR, to: RuntimeState.STARTING, allowed: true },
];

/**
 * Lifecycle Manager
 *
 * Provides a state machine for the runtime and tracks component states.
 */
export class LifecycleManager {
  private state: RuntimeState = RuntimeState.STOPPED;
  private components: Map<ComponentId, ComponentState> = new Map();
  private stateHistory: Array<{ state: RuntimeState; timestamp: number }> = [];

  /**
   * Get current runtime state
   */
  getState(): RuntimeState {
    return this.state;
  }

  /**
   * Get state history
   */
  getStateHistory(): Array<{ state: RuntimeState; timestamp: number }> {
    return [...this.stateHistory];
  }

  /**
   * Check if a state transition is valid
   */
  canTransitionTo(targetState: RuntimeState): boolean {
    return STATE_TRANSITIONS.some(
      (t) => t.from === this.state && t.to === targetState && t.allowed,
    );
  }

  /**
   * Get valid transitions from current state
   */
  getValidTransitions(): RuntimeState[] {
    return STATE_TRANSITIONS
      .filter((t) => t.from === this.state && t.allowed)
      .map((t) => t.to);
  }

  /**
   * Transition to a new state
   * @throws Error if transition is invalid
   */
  transition(targetState: RuntimeState): void {
    if (!this.canTransitionTo(targetState)) {
      const valid = this.getValidTransitions().join(", ");
      throw new Error(
        `Invalid state transition: ${this.state} -> ${targetState}. ` +
          `Valid transitions from ${this.state}: [${valid}]`,
      );
    }

    const previousState = this.state;
    this.state = targetState;
    this.stateHistory.push({
      state: targetState,
      timestamp: Date.now(),
    });

    // Keep history bounded
    if (this.stateHistory.length > 100) {
      this.stateHistory.shift();
    }
  }

  /**
   * Register a component for lifecycle tracking
   */
  registerComponent(id: ComponentId): void {
    if (this.components.has(id)) {
      throw new Error(`Component already registered: ${id}`);
    }

    this.components.set(id, {
      id,
      state: RuntimeState.STOPPED,
    });
  }

  /**
   * Check if a component is registered
   */
  hasComponent(id: ComponentId): boolean {
    return this.components.has(id);
  }

  /**
   * Get a component's state
   */
  getComponentState(id: ComponentId): ComponentState | undefined {
    return this.components.get(id);
  }

  /**
   * Update a component's state
   */
  updateComponentState(
    id: ComponentId,
    state: RuntimeState,
    error?: Error,
    stats?: Record<string, unknown>,
  ): void {
    const component = this.components.get(id);
    if (!component) {
      throw new Error(`Component not registered: ${id}`);
    }

    component.state = state;

    if (state === RuntimeState.STARTING) {
      // Starting - clear previous timestamps
      component.startedAt = undefined;
      component.stoppedAt = undefined;
      component.error = undefined;
    } else if (state === RuntimeState.RUNNING) {
      component.startedAt = Date.now();
      component.stoppedAt = undefined;
      component.error = undefined;
    } else if (state === RuntimeState.STOPPED) {
      component.stoppedAt = Date.now();
    } else if (state === RuntimeState.ERROR) {
      component.stoppedAt = Date.now();
      component.error = error;
    }

    if (stats !== undefined) {
      component.stats = stats;
    }
  }

  /**
   * Get all component states
   */
  getComponentStates(): ComponentState[] {
    return Array.from(this.components.values());
  }

  /**
   * Get components in a specific state
   */
  getComponentsInState(state: RuntimeState): ComponentState[] {
    return Array.from(this.components.values()).filter(
      (c) => c.state === state,
    );
  }

  /**
   * Check if all components are in a specific state
   */
  allComponentsInState(state: RuntimeState): boolean {
    if (this.components.size === 0) {
      return true;
    }

    for (const component of this.components.values()) {
      if (component.state !== state) {
        return false;
      }
    }
    return true;
  }

  /**
   * Check if any component is in a specific state
   */
  anyComponentInState(state: RuntimeState): boolean {
    for (const component of this.components.values()) {
      if (component.state === state) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get components that have errors
   */
  getErroredComponents(): ComponentState[] {
    return Array.from(this.components.values()).filter(
      (c) => c.state === RuntimeState.ERROR || c.error !== undefined,
    );
  }

  /**
   * Check if the runtime is in a terminal state (stopped or error)
   */
  isTerminal(): boolean {
    return (
      this.state === RuntimeState.STOPPED || this.state === RuntimeState.ERROR
    );
  }

  /**
   * Check if the runtime is active (starting, running, or stopping)
   */
  isActive(): boolean {
    return (
      this.state === RuntimeState.STARTING ||
      this.state === RuntimeState.RUNNING ||
      this.state === RuntimeState.STOPPING
    );
  }

  /**
   * Reset the lifecycle manager to initial state
   */
  reset(): void {
    this.state = RuntimeState.STOPPED;
    this.stateHistory = [];

    // Reset all component states
    for (const component of this.components.values()) {
      component.state = RuntimeState.STOPPED;
      component.startedAt = undefined;
      component.stoppedAt = undefined;
      component.error = undefined;
      component.stats = undefined;
    }
  }

  /**
   * Get a summary of the lifecycle state
   */
  getSummary(): {
    state: RuntimeState;
    componentCount: number;
    runningComponents: number;
    stoppedComponents: number;
    erroredComponents: number;
  } {
    const components = Array.from(this.components.values());

    return {
      state: this.state,
      componentCount: components.length,
      runningComponents: components.filter((c) => c.state === RuntimeState.RUNNING).length,
      stoppedComponents: components.filter((c) => c.state === RuntimeState.STOPPED).length,
      erroredComponents: components.filter((c) => c.state === RuntimeState.ERROR).length,
    };
  }
}
