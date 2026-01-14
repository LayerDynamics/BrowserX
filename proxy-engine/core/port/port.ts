/**
 * Port Management
 *
 * Types and utilities for managing network ports
 */

/**
 * Port number type (1-65535)
 */
export type PortNumber = number;

/**
 * Port state
 */
export enum PortState {
  FREE = "free",
  RESERVED = "reserved",
  BOUND = "bound",
  LISTENING = "listening",
  ERROR = "error",
}

/**
 * Port binding information
 */
export interface PortBinding {
  port: PortNumber;
  host: string;
  state: PortState;
  boundAt: Date;
  listener?: Deno.Listener;
  metadata?: Record<string, unknown>;
}

/**
 * Port range for allocation
 */
export interface PortRange {
  start: PortNumber;
  end: PortNumber;
}

/**
 * Well-known port ranges
 */
export const PORT_RANGES = {
  SYSTEM: { start: 1, end: 1023 } as PortRange,
  USER: { start: 1024, end: 49151 } as PortRange,
  DYNAMIC: { start: 49152, end: 65535 } as PortRange,
  EPHEMERAL: { start: 32768, end: 60999 } as PortRange, // Linux default
} as const;

/**
 * Validate port number
 */
export function isValidPort(port: number): boolean {
  return Number.isInteger(port) && port >= 1 && port <= 65535;
}

/**
 * Check if port is in system range (requires root/admin)
 */
export function isSystemPort(port: number): boolean {
  return port >= PORT_RANGES.SYSTEM.start && port <= PORT_RANGES.SYSTEM.end;
}

/**
 * Check if port is in user range
 */
export function isUserPort(port: number): boolean {
  return port >= PORT_RANGES.USER.start && port <= PORT_RANGES.USER.end;
}

/**
 * Check if port is in dynamic range
 */
export function isDynamicPort(port: number): boolean {
  return port >= PORT_RANGES.DYNAMIC.start && port <= PORT_RANGES.DYNAMIC.end;
}

/**
 * Check if port is in ephemeral range
 */
export function isEphemeralPort(port: number): boolean {
  return port >= PORT_RANGES.EPHEMERAL.start && port <= PORT_RANGES.EPHEMERAL.end;
}

/**
 * Check if port is available by attempting to bind
 */
export async function isPortAvailable(
  port: PortNumber,
  hostname = "127.0.0.1",
): Promise<boolean> {
  if (!isValidPort(port)) {
    return false;
  }

  try {
    const listener = Deno.listen({ port, hostname });
    listener.close();
    return true;
  } catch (_error) {
    return false;
  }
}

/**
 * Find next available port starting from given port
 */
export async function findAvailablePort(
  startPort: PortNumber,
  maxPort: PortNumber = 65535,
  hostname = "127.0.0.1",
): Promise<PortNumber | null> {
  for (let port = startPort; port <= maxPort; port++) {
    if (await isPortAvailable(port, hostname)) {
      return port;
    }
  }
  return null;
}

/**
 * Find available port in range
 */
export async function findPortInRange(
  range: PortRange,
  hostname = "127.0.0.1",
): Promise<PortNumber | null> {
  return await findAvailablePort(range.start, range.end, hostname);
}

/**
 * Get random port in range
 */
export function getRandomPort(range: PortRange): PortNumber {
  const min = range.start;
  const max = range.end;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Find random available port in range
 */
export async function findRandomPortInRange(
  range: PortRange,
  hostname = "127.0.0.1",
  maxAttempts = 100,
): Promise<PortNumber | null> {
  for (let i = 0; i < maxAttempts; i++) {
    const port = getRandomPort(range);
    if (await isPortAvailable(port, hostname)) {
      return port;
    }
  }

  // Fall back to sequential search
  return await findPortInRange(range, hostname);
}

/**
 * Parse port from string
 */
export function parsePort(portString: string): PortNumber | null {
  const port = parseInt(portString, 10);
  return isValidPort(port) ? port : null;
}

/**
 * Format port with hostname
 */
export function formatAddress(hostname: string, port: PortNumber): string {
  // Handle IPv6 addresses
  if (hostname.includes(":")) {
    return `[${hostname}]:${port}`;
  }
  return `${hostname}:${port}`;
}

/**
 * Parse address into hostname and port
 */
export function parseAddress(address: string): { hostname: string; port: PortNumber } | null {
  // Handle IPv6 [::1]:8080
  const ipv6Match = address.match(/^\[([^\]]+)\]:(\d+)$/);
  if (ipv6Match) {
    const port = parsePort(ipv6Match[2]);
    if (port === null) return null;
    return { hostname: ipv6Match[1], port };
  }

  // Handle IPv4 127.0.0.1:8080 or hostname:8080
  const parts = address.split(":");
  if (parts.length !== 2) {
    return null;
  }

  const port = parsePort(parts[1]);
  if (port === null) return null;

  return { hostname: parts[0], port };
}

/**
 * Common service ports
 */
export const COMMON_PORTS = {
  HTTP: 80,
  HTTPS: 443,
  FTP: 21,
  SSH: 22,
  TELNET: 23,
  SMTP: 25,
  DNS: 53,
  POP3: 110,
  IMAP: 143,
  LDAP: 389,
  MYSQL: 3306,
  POSTGRESQL: 5432,
  MONGODB: 27017,
  REDIS: 6379,
  ELASTICSEARCH: 9200,
  PROXY: 8080,
  SOCKS: 1080,
} as const;
