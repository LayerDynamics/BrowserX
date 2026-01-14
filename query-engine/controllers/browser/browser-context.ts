/**
 * Browser Context Management
 *
 * Provides a global context for accessing the current browser controller
 * from within function implementations.
 */

import { BrowserController } from "./browser-controller.ts";

/**
 * Global browser context holder
 */
class BrowserContextHolder {
  private static instance: BrowserContextHolder;
  private currentController?: BrowserController;
  private contextStack: BrowserController[] = [];

  private constructor() {}

  static getInstance(): BrowserContextHolder {
    if (!BrowserContextHolder.instance) {
      BrowserContextHolder.instance = new BrowserContextHolder();
    }
    return BrowserContextHolder.instance;
  }

  /**
   * Set the current browser controller
   */
  setController(controller: BrowserController): void {
    this.currentController = controller;
  }

  /**
   * Get the current browser controller
   */
  getController(): BrowserController | undefined {
    return this.currentController;
  }

  /**
   * Push a browser controller onto the stack (for nested contexts)
   */
  pushController(controller: BrowserController): void {
    if (this.currentController) {
      this.contextStack.push(this.currentController);
    }
    this.currentController = controller;
  }

  /**
   * Pop a browser controller from the stack
   */
  popController(): BrowserController | undefined {
    const popped = this.currentController;
    this.currentController = this.contextStack.pop();
    return popped;
  }

  /**
   * Clear the current controller
   */
  clear(): void {
    this.currentController = undefined;
    this.contextStack = [];
  }

  /**
   * Check if a controller is available
   */
  hasController(): boolean {
    return this.currentController !== undefined;
  }
}

/**
 * Set the current browser controller for function execution
 */
export function setCurrentBrowserController(controller: BrowserController): void {
  BrowserContextHolder.getInstance().setController(controller);
}

/**
 * Get the current browser controller
 */
export function getCurrentBrowserController(): BrowserController | undefined {
  return BrowserContextHolder.getInstance().getController();
}

/**
 * Push a browser controller onto the context stack
 */
export function pushBrowserController(controller: BrowserController): void {
  BrowserContextHolder.getInstance().pushController(controller);
}

/**
 * Pop a browser controller from the context stack
 */
export function popBrowserController(): BrowserController | undefined {
  return BrowserContextHolder.getInstance().popController();
}

/**
 * Clear the browser context
 */
export function clearBrowserContext(): void {
  BrowserContextHolder.getInstance().clear();
}

/**
 * Check if a browser controller is available
 */
export function hasBrowserContext(): boolean {
  return BrowserContextHolder.getInstance().hasController();
}

/**
 * Execute a function with a specific browser controller context
 */
export async function withBrowserContext<T>(
  controller: BrowserController,
  fn: () => Promise<T>,
): Promise<T> {
  pushBrowserController(controller);
  try {
    return await fn();
  } finally {
    popBrowserController();
  }
}

/**
 * Require a browser controller to be available, throw if not
 */
export function requireBrowserController(): BrowserController {
  const controller = getCurrentBrowserController();
  if (!controller) {
    throw new Error(
      "Browser context not available. Ensure a browser controller is set before calling browser-dependent functions.",
    );
  }
  return controller;
}
