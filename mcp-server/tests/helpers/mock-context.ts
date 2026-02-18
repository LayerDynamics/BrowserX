/**
 * Mock Context Helper for MCP Server Testing
 * Provides mock implementations of MCPServerContext for tool testing
 */

import type { BrowserEngine, BrowserPage } from "@browserx/browser";
import type { BrowserXRuntime } from "@browserx/runtime";
import type { IQueryEngine } from "@browserx/query-engine";
import type { SessionManager, BrowserSession } from "../../session/session-manager.ts";
import type { MCPServerContext, MCPServerConfig } from "../../server/mcp-server.ts";
import { PermissionGuard } from "../../security/permission-guard.ts";
import { createVisibilityService } from "../../visibility/mod.ts";
import { resolveTimeoutConfig } from "../../timeout/mod.ts";
import { createActivityLogger, initActivityTracker } from "../../activity/mod.ts";

/**
 * Mock BrowserPage for testing
 */
export interface MockBrowserPage extends BrowserPage {
  _mockUrl?: string;
  _mockNavigationDelay?: number;
  _mockNavigationError?: Error;
  _mockRedirectUrl?: string;
}

/**
 * Configuration for mock behavior
 */
export interface MockContextConfig {
  /** Whether session already exists */
  sessionExists?: boolean;
  /** Session ID to use */
  sessionId?: string;
  /** Navigation delay in ms (for timeout testing) */
  navigationDelay?: number;
  /** Error to throw during navigation */
  navigationError?: Error;
  /** URL to redirect to (different from requested) */
  redirectUrl?: string;
  /** Whether to throw on session creation */
  sessionCreationError?: Error;
  /** Max sessions allowed */
  maxSessions?: number;
  /** Current session count */
  currentSessionCount?: number;
}

/**
 * Create a mock BrowserPage
 */
export function createMockBrowserPage(config: MockContextConfig = {}): MockBrowserPage {
  const page = {
    _mockUrl: "about:blank",
    _mockNavigationDelay: config.navigationDelay ?? 0,
    _mockNavigationError: config.navigationError,
    _mockRedirectUrl: config.redirectUrl,

    async navigate(url: string, options?: { waitFor?: string; timeout?: number; signal?: AbortSignal }) {
      // Simulate delay
      if (this._mockNavigationDelay && this._mockNavigationDelay > 0) {
        await new Promise((resolve, reject) => {
          const timeoutId = setTimeout(resolve, this._mockNavigationDelay);

          if (options?.signal) {
            options.signal.addEventListener("abort", () => {
              clearTimeout(timeoutId);
              reject(new Error("Navigation aborted"));
            });
          }
        });
      }

      // Throw error if configured
      if (this._mockNavigationError) {
        throw this._mockNavigationError;
      }

      // Set URL (with redirect if configured)
      this._mockUrl = this._mockRedirectUrl ?? url;
    },

    getCurrentURL(): string {
      return this._mockUrl ?? "about:blank";
    },

    async click(_selector: string, _selectorType?: "css" | "xpath", _options?: { signal?: AbortSignal }) {
      // Mock click
    },

    async type(
      _selector: string,
      _text: string,
      _options?: { clear?: boolean; delay?: number; signal?: AbortSignal },
    ) {
      // Mock type
    },

    async screenshot(_options?: {
      fullPage?: boolean;
      selector?: string;
      format?: "png" | "jpeg";
      quality?: number;
      signal?: AbortSignal;
    }): Promise<Uint8Array> {
      // Return a minimal 1x1 PNG
      return new Uint8Array([
        137, 80, 78, 71, 13, 10, 26, 10, // PNG signature
        0, 0, 0, 13, 73, 72, 68, 82, // IHDR chunk
        0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0, // 1x1 RGB
        144, 119, 83, 222, // IHDR CRC
        0, 0, 0, 12, 73, 68, 65, 84, // IDAT chunk
        8, 215, 99, 248, 207, 192, 0, 0, 3, 1, 1, 0, // minimal data
        24, 221, 141, 176, // IDAT CRC
        0, 0, 0, 0, 73, 69, 78, 68, // IEND chunk
        174, 66, 96, 130, // IEND CRC
      ]);
    },

    async pdf(_options?: {
      format?: "A4" | "Letter" | "Legal" | "A3";
      orientation?: "portrait" | "landscape";
      signal?: AbortSignal;
    }): Promise<Uint8Array> {
      // Return minimal PDF
      return new TextEncoder().encode("%PDF-1.4\n%%EOF");
    },

    async evaluate(_script: string, _args?: unknown[], _options?: { signal?: AbortSignal }): Promise<unknown> {
      return null;
    },

    async query(
      _selector: string,
      _selectorType?: "css" | "xpath",
      _options?: { signal?: AbortSignal },
    ): Promise<MockElement[]> {
      return [];
    },

    async wait(_options: {
      type: "time" | "selector" | "function";
      duration?: number;
      selector?: string;
      condition?: string;
      timeout?: number;
      signal?: AbortSignal;
    }): Promise<void> {
      // Mock wait
    },
  } as MockBrowserPage;

  return page;
}

/**
 * Mock DOM element
 */
export interface MockElement {
  getAttribute(name: string): Promise<string | null>;
  getProperty(name: string): Promise<unknown>;
  getText(): Promise<string>;
}

/**
 * Create a mock BrowserEngine
 */
export function createMockBrowserEngine(config: MockContextConfig = {}): BrowserEngine {
  const page = createMockBrowserPage(config);

  return {
    createPage: async () => page,
    close: async () => {},
  } as unknown as BrowserEngine;
}

/**
 * Create a mock SessionManager
 */
export function createMockSessionManager(config: MockContextConfig = {}): SessionManager {
  const sessionMap = new Map<string, BrowserSession>();
  const sessionId = config.sessionId ?? "test-session-123";
  let sessionCounter = config.currentSessionCount ?? 0;
  const maxSessions = config.maxSessions ?? 10;

  // Pre-populate session if configured
  if (config.sessionExists) {
    sessionMap.set(sessionId, {
      id: sessionId,
      browserEngine: createMockBrowserEngine(config),
      createdAt: Date.now(),
      lastUsedAt: Date.now(),
      permissions: [],
      currentUrl: "about:blank",
    });
    sessionCounter = 1;
  }

  const page = createMockBrowserPage(config);

  return {
    async createSession() {
      if (config.sessionCreationError) {
        throw config.sessionCreationError;
      }

      if (sessionCounter >= maxSessions) {
        throw new Error("Cannot create session: all browser pool slots are in use. Close an existing session first.");
      }

      const newSessionId = `test-session-${Date.now()}`;
      sessionCounter++;

      sessionMap.set(newSessionId, {
        id: newSessionId,
        browserEngine: createMockBrowserEngine(config),
        createdAt: Date.now(),
        lastUsedAt: Date.now(),
        permissions: [],
      });

      return newSessionId;
    },

    getSession(id: string) {
      const session = sessionMap.get(id);
      if (!session) {
        throw new Error(`Session not found: ${id}`);
      }
      return session;
    },

    hasSession(id: string) {
      return sessionMap.has(id);
    },

    async closeSession(id: string) {
      const session = sessionMap.get(id);
      if (!session) {
        throw new Error(`Session not found: ${id}`);
      }
      sessionMap.delete(id);
      sessionCounter--;
    },

    updateSessionUrl(id: string, url: string) {
      const session = sessionMap.get(id);
      if (session) {
        session.currentUrl = url;
      }
    },

    async getSessionPage(_sessionId: string) {
      return page;
    },

    getPoolStats() {
      return {
        activeSessions: sessionCounter,
        maxSessions,
        totalCreated: sessionCounter,
        totalClosed: 0,
        sessions: Array.from(sessionMap.values()).map((s) => ({
          id: s.id,
          age: Date.now() - s.createdAt,
          lastUsed: Date.now() - s.lastUsedAt,
          currentUrl: s.currentUrl,
        })),
      };
    },

    async shutdown() {
      sessionMap.clear();
      sessionCounter = 0;
    },
  } as unknown as SessionManager;
}

/**
 * Create a mock MCPServerContext
 */
export function createMockContext(config: MockContextConfig = {}): MCPServerContext {
  const sessionManager = createMockSessionManager(config);
  const serverConfig: MCPServerConfig = {
    name: "test-server",
    version: "1.0.0",
    maxSessions: config.maxSessions ?? 10,
    sessionConfig: {
      maxSessions: config.maxSessions ?? 10,
      sessionTimeout: 30 * 60 * 1000,
      defaultViewport: { width: 1280, height: 720 },
    },
  };

  const permissionGuard = new PermissionGuard("FULL");

  const visibilityService = createVisibilityService();
  const timeoutConfig = resolveTimeoutConfig(serverConfig.timeoutConfig);
  const activityLogger = createActivityLogger();
  const activityTracker = initActivityTracker(".browserx-test"); // Use test directory

  let sessionManagerReady = config.sessionExists ?? false;

  return {
    permissionGuard,
    visibilityService,
    activityLogger,
    activityTracker,
    timeoutConfig,
    config: serverConfig,

    serviceInitializer: {
      async getSessionManager() {
        sessionManagerReady = true;
        return sessionManager;
      },
      async getRuntime() {
        return {} as BrowserXRuntime;
      },
      async getQueryEngine() {
        return {} as IQueryEngine;
      },
      isSessionManagerReady() {
        return sessionManagerReady;
      },
      async shutdown() {
        await sessionManager.shutdown();
      },
    } as any,

    async getSessionManager() {
      sessionManagerReady = true;
      return sessionManager;
    },

    async getRuntime() {
      return {} as BrowserXRuntime;
    },

    async getQueryEngine() {
      return {} as IQueryEngine;
    },
  };
}

/**
 * Create a mock context with navigation delay (for timeout testing)
 */
export function createMockContextWithSlowNav(delayMs: number = 5000): MCPServerContext {
  return createMockContext({ navigationDelay: delayMs });
}

/**
 * Create a mock context with navigation error
 */
export function createMockContextWithNavError(error: Error): MCPServerContext {
  return createMockContext({ navigationError: error });
}

/**
 * Create a mock context with URL redirect
 */
export function createMockContextWithRedirect(redirectUrl: string): MCPServerContext {
  return createMockContext({ redirectUrl });
}

/**
 * Create a mock context with existing session
 */
export function createMockContextWithSession(sessionId: string = "existing-session"): MCPServerContext {
  return createMockContext({ sessionExists: true, sessionId });
}

/**
 * Create a mock context at max capacity
 */
export function createMockContextAtCapacity(): MCPServerContext {
  return createMockContext({
    maxSessions: 2,
    currentSessionCount: 2,
  });
}
