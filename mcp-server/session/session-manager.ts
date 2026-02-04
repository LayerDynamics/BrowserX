/**
 * Session Manager for browser session pooling
 * Manages browser instances and their lifecycle
 */

import { BrowserEngine, BrowserPage } from "@browserx/browser";
import { Permission } from "@browserx/query-engine";

/**
 * Browser session state
 */
export interface BrowserSession {
  readonly id: string;
  readonly browserEngine: BrowserEngine;
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
}

/**
 * Manages browser sessions with pooling and lifecycle management
 */
export class SessionManager {
  private sessions: Map<string, BrowserSession> = new Map();
  private readonly maxSessions: number;
  private readonly sessionTimeout: number;
  private readonly defaultViewport: { width: number; height: number };
  private cleanupInterval: number | null = null;
  private totalCreated = 0;
  private totalClosed = 0;

  constructor(config: SessionManagerConfig = {}) {
    this.maxSessions = config.maxSessions ?? 10;
    this.sessionTimeout = config.sessionTimeout ?? 30 * 60 * 1000; // 30 minutes
    this.defaultViewport = config.defaultViewport ?? { width: 1280, height: 720 };

    // Start cleanup interval
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

    // Create browser engine
    const browserEngine = new BrowserEngine({
      width: this.defaultViewport.width,
      height: this.defaultViewport.height,
    });

    const session: BrowserSession = {
      id: sessionId,
      browserEngine,
      createdAt: Date.now(),
      lastUsedAt: Date.now(),
      permissions,
    };

    this.sessions.set(sessionId, session);
    this.totalCreated++;

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

      // Then close browser engine and release resources
      try {
        await session.browserEngine.close();
      } catch (error) {
        console.error(`Error closing browser engine for session ${sessionId}:`, error);
      }

      this.sessions.delete(sessionId);
      this.totalClosed++;
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
   */
  async shutdown(): Promise<void> {
    // Stop cleanup interval
    if (this.cleanupInterval !== null) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // Close all sessions
    await this.closeAll();
  }

  /**
   * Cleanup idle sessions
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
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }
}
