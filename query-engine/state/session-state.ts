/**
 * Session state manager
 * Manages cookies, authentication, and storage across queries
 */

import type { DurationMs, SessionID, Timestamp } from "../types/primitives.ts";
import type { AuthCredentials, CookieData, SessionData } from "./types.ts";

/**
 * Session state manager
 *
 * Maintains persistent state across multiple query executions:
 * - Cookies with domain/path matching
 * - Authentication credentials per domain
 * - localStorage and sessionStorage
 * - Session timeout handling
 */
export class SessionStateManager {
  private readonly sessions: Map<SessionID, SessionData>;
  private readonly sessionTimeout: DurationMs;
  private cleanupTimer: number | null = null;

  constructor(sessionTimeout: DurationMs = 30 * 60 * 1000) { // 30 minutes default
    this.sessions = new Map();
    this.sessionTimeout = sessionTimeout;
    this.startCleanup();
  }

  /**
   * Create a new session
   */
  createSession(): SessionID {
    const sessionId = crypto.randomUUID();
    const now = Date.now();

    const sessionData: SessionData = {
      sessionId,
      cookies: new Map(),
      localStorage: new Map(),
      sessionStorage: new Map(),
      auth: new Map(),
      createdAt: now,
      lastAccessedAt: now,
    };

    this.sessions.set(sessionId, sessionData);
    return sessionId;
  }

  /**
   * Get session data
   */
  getSession(sessionId: SessionID): SessionData | undefined {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastAccessedAt = Date.now();
    }
    return session;
  }

  /**
   * Check if session exists and is valid
   */
  hasSession(sessionId: SessionID): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    // Check if expired
    if (this.isSessionExpired(session)) {
      this.deleteSession(sessionId);
      return false;
    }

    return true;
  }

  /**
   * Delete session
   */
  deleteSession(sessionId: SessionID): boolean {
    return this.sessions.delete(sessionId);
  }

  /**
   * Set cookie for session
   */
  setCookie(sessionId: SessionID, cookie: CookieData): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const cookieKey = this.getCookieKey(cookie.name, cookie.domain, cookie.path);
    session.cookies.set(cookieKey, cookie);
    session.lastAccessedAt = Date.now();
  }

  /**
   * Get cookies matching domain and path
   */
  getCookies(sessionId: SessionID, domain?: string, path?: string): CookieData[] {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return [];
    }

    session.lastAccessedAt = Date.now();

    const cookies: CookieData[] = [];
    const now = Date.now();

    for (const cookie of session.cookies.values()) {
      // Check expiration
      if (cookie.expires && cookie.expires < now) {
        continue;
      }

      // Check domain match
      if (domain && !this.matchesDomain(domain, cookie.domain)) {
        continue;
      }

      // Check path match
      if (path && !this.matchesPath(path, cookie.path)) {
        continue;
      }

      cookies.push(cookie);
    }

    return cookies;
  }

  /**
   * Delete cookie
   */
  deleteCookie(sessionId: SessionID, name: string, domain: string, path: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    const cookieKey = this.getCookieKey(name, domain, path);
    const deleted = session.cookies.delete(cookieKey);
    session.lastAccessedAt = Date.now();
    return deleted;
  }

  /**
   * Set localStorage value
   */
  setLocalStorage(sessionId: SessionID, key: string, value: unknown): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    session.localStorage.set(key, value);
    session.lastAccessedAt = Date.now();
  }

  /**
   * Get localStorage value
   */
  getLocalStorage(sessionId: SessionID, key: string): unknown {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return undefined;
    }

    session.lastAccessedAt = Date.now();
    return session.localStorage.get(key);
  }

  /**
   * Delete localStorage value
   */
  deleteLocalStorage(sessionId: SessionID, key: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    const deleted = session.localStorage.delete(key);
    session.lastAccessedAt = Date.now();
    return deleted;
  }

  /**
   * Set sessionStorage value
   */
  setSessionStorage(sessionId: SessionID, key: string, value: unknown): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    session.sessionStorage.set(key, value);
    session.lastAccessedAt = Date.now();
  }

  /**
   * Get sessionStorage value
   */
  getSessionStorage(sessionId: SessionID, key: string): unknown {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return undefined;
    }

    session.lastAccessedAt = Date.now();
    return session.sessionStorage.get(key);
  }

  /**
   * Delete sessionStorage value
   */
  deleteSessionStorage(sessionId: SessionID, key: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    const deleted = session.sessionStorage.delete(key);
    session.lastAccessedAt = Date.now();
    return deleted;
  }

  /**
   * Set authentication credentials for domain
   */
  setAuth(sessionId: SessionID, domain: string, auth: AuthCredentials): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    session.auth.set(domain, auth);
    session.lastAccessedAt = Date.now();
  }

  /**
   * Get authentication credentials for domain
   */
  getAuth(sessionId: SessionID, domain: string): AuthCredentials | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return undefined;
    }

    session.lastAccessedAt = Date.now();
    return session.auth.get(domain);
  }

  /**
   * Delete authentication credentials for domain
   */
  deleteAuth(sessionId: SessionID, domain: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    const deleted = session.auth.delete(domain);
    session.lastAccessedAt = Date.now();
    return deleted;
  }

  /**
   * Clear all cookies in session
   */
  clearCookies(sessionId: SessionID): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.cookies.clear();
      session.lastAccessedAt = Date.now();
    }
  }

  /**
   * Clear localStorage in session
   */
  clearLocalStorage(sessionId: SessionID): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.localStorage.clear();
      session.lastAccessedAt = Date.now();
    }
  }

  /**
   * Clear sessionStorage in session
   */
  clearSessionStorage(sessionId: SessionID): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.sessionStorage.clear();
      session.lastAccessedAt = Date.now();
    }
  }

  /**
   * Clear all auth credentials in session
   */
  clearAuth(sessionId: SessionID): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.auth.clear();
      session.lastAccessedAt = Date.now();
    }
  }

  /**
   * Get number of active sessions
   */
  getSessionCount(): number {
    return this.sessions.size;
  }

  /**
   * Cleanup expired sessions
   */
  cleanup(): number {
    let removed = 0;
    for (const [sessionId, session] of this.sessions) {
      if (this.isSessionExpired(session)) {
        this.sessions.delete(sessionId);
        removed++;
      }
    }
    return removed;
  }

  /**
   * Stop cleanup timer
   */
  destroy(): void {
    if (this.cleanupTimer !== null) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * Check if session is expired
   */
  private isSessionExpired(session: SessionData): boolean {
    const now = Date.now();
    return (now - session.lastAccessedAt) > this.sessionTimeout;
  }

  /**
   * Generate cookie key for storage
   */
  private getCookieKey(name: string, domain: string, path: string): string {
    return `${name}|${domain}|${path}`;
  }

  /**
   * Check if request domain matches cookie domain
   * Handles subdomain matching (.example.com matches www.example.com)
   */
  private matchesDomain(requestDomain: string, cookieDomain: string): boolean {
    // Exact match
    if (requestDomain === cookieDomain) {
      return true;
    }

    // Subdomain match (cookie domain starts with .)
    if (cookieDomain.startsWith(".")) {
      return requestDomain.endsWith(cookieDomain) ||
        requestDomain === cookieDomain.slice(1);
    }

    return false;
  }

  /**
   * Check if request path matches cookie path
   * Cookie path must be a prefix of request path
   */
  private matchesPath(requestPath: string, cookiePath: string): boolean {
    // Root path matches all
    if (cookiePath === "/") {
      return true;
    }

    // Exact match
    if (requestPath === cookiePath) {
      return true;
    }

    // Prefix match (with trailing slash)
    if (requestPath.startsWith(cookiePath + "/")) {
      return true;
    }

    return false;
  }

  /**
   * Start automatic cleanup of expired sessions
   */
  private startCleanup(): void {
    // Run cleanup every 5 minutes
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  /**
   * Get session timeout duration
   */
  getSessionTimeout(): DurationMs {
    return this.sessionTimeout;
  }

  /**
   * Get all session IDs
   */
  getAllSessionIds(): SessionID[] {
    return Array.from(this.sessions.keys());
  }

  /**
   * Get all sessions (returns copy)
   */
  getAllSessions(): Map<SessionID, SessionData> {
    return new Map(this.sessions);
  }

  /**
   * Check if cleanup timer is running
   */
  isCleanupRunning(): boolean {
    return this.cleanupTimer !== null;
  }
}
