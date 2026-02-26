/**
 * Session Manager for browser session pooling
 * Manages browser instances and their lifecycle
 *
 * When a BrowserPool is provided (via Runtime integration), instances are
 * acquired from and released back to the pool instead of being created/destroyed
 * directly. This enables unified lifecycle management, health checking, and metrics
 * through the Runtime.
 */

import { BrowserEngine, BrowserPage } from "@browserx/browser";
import { Permission } from "@browserx/query-engine";
import type { BrowserPool, BrowserInstance, RuntimeEvent } from "@browserx/runtime";

/**
 * Browser session state
 */
export interface BrowserSession {
  readonly id: string;
  readonly browserEngine: BrowserEngine;
  readonly poolInstanceId?: string;
  readonly createdAt: number;
  lastUsedAt: number;
  readonly permissions: Permission[];
  currentUrl?: string;
  currentPage?: BrowserPage;
}

/**
 * Session pool statistics
 */
export interface SessionPoolStats {
  activeSessions: number;
  maxSessions: number;
  totalCreated: number;
  totalClosed: number;
  sessions: Array<{
    id: string;
    age: number;
    lastUsed: number;
    currentUrl?: string;
  }>;
}

/**
 * Session manager configuration
 */
export interface SessionManagerConfig {
  maxSessions?: number;
  sessionTimeout?: number; // in milliseconds
  defaultViewport?: { width: number; height: number };
  /** BrowserPool from Runtime for unified instance lifecycle */
  browserPool?: BrowserPool;
  /** Event emitter for forwarding session events through Runtime */
  eventEmitter?: (event: RuntimeEvent) => void;
}

/**
 * Manages browser sessions with pooling and lifecycle management
 *
 * When browserPool is provided, delegates browser instance lifecycle to the pool:
 * - createSession() acquires an instance via pool.acquire()
 * - closeSession() releases the instance via pool.release()
 * - The pool handles idle timeout, max lifetime, and cleanup
 *
 * When browserPool is absent (legacy mode), creates BrowserEngine instances directly.
 */
export class SessionManager {
  private sessions: Map<string, BrowserSession> = new Map();
  private readonly maxSessions: number;
  private readonly sessionTimeout: number;
  private readonly defaultViewport: { width: number; height: number };
  private readonly browserPool?: BrowserPool;
  private readonly eventEmitter?: (event: RuntimeEvent) => void;
  private cleanupInterval: number | null = null;
  private totalCreated = 0;
  private totalClosed = 0;

  constructor(config: SessionManagerConfig = {}) {
    this.maxSessions = config.maxSessions ?? 10;
    this.sessionTimeout = config.sessionTimeout ?? 30 * 60 * 1000; // 30 minutes
    this.defaultViewport = config.defaultViewport ?? { width: 1280, height: 720 };
    this.browserPool = config.browserPool;
    this.eventEmitter = config.eventEmitter;

    // Start cleanup interval for session-level idle timeout
    this.startCleanupInterval();
  }

  /**
   * Create a new browser session
   */
  async createSession(permissions: Permission[] = []): Promise<string> {
    // Enforce session limit
    if (this.sessions.size >= this.maxSessions) {
      // Try to cleanup idle sessions first
      await this.cleanupIdleSessions();

      // If still at limit, close the oldest session
      if (this.sessions.size >= this.maxSessions) {
        await this.closeOldestSession();
      }
    }

    const sessionId = this.generateSessionId();

    let browserEngine: BrowserEngine;
    let poolInstanceId: string | undefined;

    if (this.browserPool) {
      // Integrated path: acquire from BrowserPool
      let instance: BrowserInstance;
      try {
        instance = await this.browserPool.acquire({ timeout: 30000 });
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        if (msg.includes("pool exhausted")) {
          throw new Error(
            `Cannot create session: all browser pool slots are in use. ` +
            `Close an existing session first.`
          );
        }
        throw error;
      }

      poolInstanceId = instance.id;

      if (!instance.browserEngine) {
        this.browserPool.release(instance.id);
        throw new Error("Pool returned instance without browser engine");
      }

      browserEngine = instance.browserEngine as BrowserEngine;
    } else {
      // Legacy path: create BrowserEngine directly
      browserEngine = new BrowserEngine({
        width: this.defaultViewport.width,
        height: this.defaultViewport.height,
      });
    }

    const session: BrowserSession = {
      id: sessionId,
      browserEngine,
      poolInstanceId,
      createdAt: Date.now(),
      lastUsedAt: Date.now(),
      permissions,
    };

    this.sessions.set(sessionId, session);
    this.totalCreated++;

    // Emit session_created event
    if (this.eventEmitter && poolInstanceId) {
      this.eventEmitter({
        type: "session_created",
        sessionId,
        instanceId: poolInstanceId,
      });
    }

    return sessionId;
  }

  /**
   * Get a session by ID
   */
  getSession(sessionId: string): BrowserSession {
    const session = this.sessions.get(sessionId);

    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // Update last used timestamp
    session.lastUsedAt = Date.now();

    return session;
  }

  /**
   * Check if session exists
   */
  hasSession(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }

  /**
   * Close a session
   */
  async closeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);

    if (session) {
      // Close page first if it exists
      if (session.currentPage) {
        try {
          await session.currentPage.close();
        } catch (error) {
          console.error(`Error closing page for session ${sessionId}:`, error);
        }
        session.currentPage = undefined;
      }

      if (this.browserPool && session.poolInstanceId) {
        // Integrated path: release instance back to pool
        try {
          this.browserPool.release(session.poolInstanceId);
        } catch (error) {
          console.error(`Error releasing pool instance for session ${sessionId}:`, error);
          // If release fails (e.g., instance already closed), try explicit close
          try {
            await this.browserPool.closeInstance(session.poolInstanceId, "session_close_error");
          } catch {
            // Ignore secondary errors
          }
        }
      } else {
        // Legacy path: close browser engine directly
        try {
          await session.browserEngine.close();
        } catch (error) {
          console.error(`Error closing browser engine for session ${sessionId}:`, error);
        }
      }

      this.sessions.delete(sessionId);
      this.totalClosed++;

      // Emit session_closed event
      if (this.eventEmitter && session.poolInstanceId) {
        this.eventEmitter({
          type: "session_closed",
          sessionId,
          instanceId: session.poolInstanceId,
          reason: "manual",
        });
      }
    }
  }

  /**
   * Get session pool statistics
   */
  getPoolStats(): SessionPoolStats {
    const now = Date.now();

    return {
      activeSessions: this.sessions.size,
      maxSessions: this.maxSessions,
      totalCreated: this.totalCreated,
      totalClosed: this.totalClosed,
      sessions: Array.from(this.sessions.values()).map((s) => ({
        id: s.id,
        age: now - s.createdAt,
        lastUsed: now - s.lastUsedAt,
        currentUrl: s.currentUrl,
      })),
    };
  }

  /**
   * Get all active session IDs
   */
  getSessionIds(): string[] {
    return Array.from(this.sessions.keys());
  }

  /**
   * Update session URL
   */
  updateSessionUrl(sessionId: string, url: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.currentUrl = url;
      session.lastUsedAt = Date.now();
    }
  }

  /**
   * Set the current page for a session
   */
  setSessionPage(sessionId: string, page: BrowserPage): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.currentPage = page;
      session.lastUsedAt = Date.now();
    }
  }

  /**
   * Get the current page for a session, creating one if needed
   */
  async getSessionPage(sessionId: string): Promise<BrowserPage> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    if (!session.currentPage) {
      session.currentPage = await session.browserEngine.newPage();
    }

    session.lastUsedAt = Date.now();
    return session.currentPage;
  }

  /**
   * Close all sessions
   */
  async closeAll(): Promise<void> {
    const sessionIds = Array.from(this.sessions.keys());

    for (const sessionId of sessionIds) {
      await this.closeSession(sessionId);
    }
  }

  /**
   * Shutdown the session manager
   *
   * Closes all sessions (releasing pool instances) but does NOT stop the
   * BrowserPool itself — the Runtime handles pool shutdown in its own
   * shutdown sequence, which runs after SessionManager.shutdown().
   */
  async shutdown(): Promise<void> {
    // Stop cleanup interval
    if (this.cleanupInterval !== null) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // Close all sessions (releases instances back to pool)
    await this.closeAll();
  }

  /**
   * Cleanup idle sessions that have exceeded the session timeout
   */
  private async cleanupIdleSessions(): Promise<void> {
    const now = Date.now();
    const idleSessions: string[] = [];

    for (const [sessionId, session] of this.sessions.entries()) {
      if (now - session.lastUsedAt > this.sessionTimeout) {
        idleSessions.push(sessionId);
      }
    }

    for (const sessionId of idleSessions) {
      const session = this.sessions.get(sessionId);

      // Emit session_expired event for idle timeout cleanup
      if (this.eventEmitter && session?.poolInstanceId) {
        this.eventEmitter({
          type: "session_expired",
          sessionId,
          instanceId: session.poolInstanceId,
        });
      }

      await this.closeSession(sessionId);
    }
  }

  /**
   * Close the oldest session
   */
  private async closeOldestSession(): Promise<void> {
    let oldestSession: BrowserSession | null = null;
    let oldestSessionId: string | null = null;

    for (const [sessionId, session] of this.sessions.entries()) {
      if (!oldestSession || session.createdAt < oldestSession.createdAt) {
        oldestSession = session;
        oldestSessionId = sessionId;
      }
    }

    if (oldestSessionId) {
      await this.closeSession(oldestSessionId);
    }
  }

  /**
   * Start the cleanup interval
   */
  private startCleanupInterval(): void {
    // Run cleanup every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanupIdleSessions().catch((error) => {
        console.error("Error during session cleanup:", error);
      });
    }, 60 * 1000);
  }

  /**
   * Generate a unique session ID
   */
  private generateSessionId(): string {
    return `session_${crypto.randomUUID()}`;
  }
}
