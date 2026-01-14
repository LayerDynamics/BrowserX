/**
 * Network Address Utilities
 *
 * IP address, CIDR, and subnet utilities
 */

/**
 * Parse IPv4 address to number
 */
export function ipv4ToNumber(ip: string): number {
  const parts = ip.split(".").map((p) => parseInt(p, 10));
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    throw new Error(`Invalid IPv4 address: ${ip}`);
  }
  return (
    (parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]
  ) >>> 0;
}

/**
 * Convert number to IPv4 address
 */
export function numberToIpv4(num: number): string {
  return [
    (num >>> 24) & 0xff,
    (num >>> 16) & 0xff,
    (num >>> 8) & 0xff,
    num & 0xff,
  ].join(".");
}

/**
 * Parse CIDR notation
 */
export interface CIDR {
  address: string;
  prefix: number;
  netmask: string;
  network: string;
  broadcast: string;
  firstHost: string;
  lastHost: string;
  totalHosts: number;
}

export function parseCIDR(cidr: string): CIDR {
  const [address, prefixStr] = cidr.split("/");
  const prefix = parseInt(prefixStr, 10);

  if (isNaN(prefix) || prefix < 0 || prefix > 32) {
    throw new Error(`Invalid CIDR prefix: ${prefixStr}`);
  }

  const addressNum = ipv4ToNumber(address);
  const netmaskNum = (~0 << (32 - prefix)) >>> 0;
  const networkNum = (addressNum & netmaskNum) >>> 0;
  const broadcastNum = (networkNum | ~netmaskNum) >>> 0;

  const totalHosts = Math.pow(2, 32 - prefix);
  const firstHostNum = prefix === 32 ? networkNum : networkNum + 1;
  const lastHostNum = prefix === 32 ? broadcastNum : broadcastNum - 1;

  return {
    address,
    prefix,
    netmask: numberToIpv4(netmaskNum),
    network: numberToIpv4(networkNum),
    broadcast: numberToIpv4(broadcastNum),
    firstHost: numberToIpv4(firstHostNum),
    lastHost: numberToIpv4(lastHostNum),
    totalHosts: prefix === 32 ? 1 : totalHosts - 2,
  };
}

/**
 * Check if IP is in CIDR range
 */
export function ipInCIDR(ip: string, cidr: string): boolean {
  const parsed = parseCIDR(cidr);
  const ipNum = ipv4ToNumber(ip);
  const networkNum = ipv4ToNumber(parsed.network);
  const broadcastNum = ipv4ToNumber(parsed.broadcast);

  return ipNum >= networkNum && ipNum <= broadcastNum;
}

/**
 * Check if IP is private (RFC 1918)
 */
export function isPrivateIP(ip: string): boolean {
  return (
    ipInCIDR(ip, "10.0.0.0/8") ||
    ipInCIDR(ip, "172.16.0.0/12") ||
    ipInCIDR(ip, "192.168.0.0/16")
  );
}

/**
 * Check if IP is loopback
 */
export function isLoopbackIP(ip: string): boolean {
  return ipInCIDR(ip, "127.0.0.0/8");
}

/**
 * Check if IP is link-local
 */
export function isLinkLocalIP(ip: string): boolean {
  return ipInCIDR(ip, "169.254.0.0/16");
}

/**
 * Check if IP is multicast
 */
export function isMulticastIP(ip: string): boolean {
  return ipInCIDR(ip, "224.0.0.0/4");
}

/**
 * Check if IP is valid IPv4
 */
export function isValidIPv4(ip: string): boolean {
  try {
    ipv4ToNumber(ip);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if IP is valid IPv6 (basic check)
 */
export function isValidIPv6(ip: string): boolean {
  const parts = ip.split(":");
  if (parts.length < 3 || parts.length > 8) {
    return false;
  }

  let hasDoubleColon = false;
  for (const part of parts) {
    if (part === "") {
      if (hasDoubleColon) {
        return false; // Only one :: allowed
      }
      hasDoubleColon = true;
    } else if (!/^[0-9a-fA-F]{1,4}$/.test(part)) {
      return false;
    }
  }

  return true;
}

/**
 * Normalize IPv6 address
 */
export function normalizeIPv6(ip: string): string {
  // Expand :: to full form
  const parts = ip.split(":");
  const emptyIndex = parts.indexOf("");

  if (emptyIndex !== -1) {
    const missing = 8 - parts.filter((p) => p !== "").length;
    const zeros = Array(missing + 1).fill("0");
    parts.splice(emptyIndex, 1, ...zeros);
  }

  // Pad each part to 4 digits
  return parts
    .filter((p) => p !== "")
    .map((p) => p.padStart(4, "0"))
    .join(":");
}

/**
 * Parse host:port string
 */
export interface HostPort {
  host: string;
  port: number;
}

export function parseHostPort(
  hostPort: string,
  defaultPort = 80,
): HostPort {
  // Handle IPv6 with port: [::1]:8080
  if (hostPort.startsWith("[")) {
    const closeBracket = hostPort.indexOf("]");
    if (closeBracket === -1) {
      throw new Error(`Invalid IPv6 address: ${hostPort}`);
    }

    const host = hostPort.slice(1, closeBracket);
    const portPart = hostPort.slice(closeBracket + 1);
    const port = portPart.startsWith(":")
      ? parseInt(portPart.slice(1), 10)
      : defaultPort;

    return { host, port };
  }

  // Handle IPv4 with port or hostname with port
  const colonIndex = hostPort.lastIndexOf(":");
  if (colonIndex === -1) {
    return { host: hostPort, port: defaultPort };
  }

  const host = hostPort.slice(0, colonIndex);
  const port = parseInt(hostPort.slice(colonIndex + 1), 10);

  if (isNaN(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid port: ${hostPort.slice(colonIndex + 1)}`);
  }

  return { host, port };
}

/**
 * Format host:port string
 */
export function formatHostPort(host: string, port: number): string {
  // IPv6 addresses need brackets
  if (isValidIPv6(host)) {
    return `[${host}]:${port}`;
  }

  return `${host}:${port}`;
}

/**
 * Get subnet mask from prefix length
 */
export function prefixToNetmask(prefix: number): string {
  if (prefix < 0 || prefix > 32) {
    throw new Error(`Invalid prefix: ${prefix}`);
  }

  const netmaskNum = (~0 << (32 - prefix)) >>> 0;
  return numberToIpv4(netmaskNum);
}

/**
 * Get prefix length from subnet mask
 */
export function netmaskToPrefix(netmask: string): number {
  const netmaskNum = ipv4ToNumber(netmask);
  let prefix = 0;

  for (let i = 31; i >= 0; i--) {
    if ((netmaskNum & (1 << i)) !== 0) {
      prefix++;
    } else {
      break;
    }
  }

  return prefix;
}

/**
 * Calculate network address
 */
export function getNetworkAddress(ip: string, netmask: string): string {
  const ipNum = ipv4ToNumber(ip);
  const netmaskNum = ipv4ToNumber(netmask);
  const networkNum = (ipNum & netmaskNum) >>> 0;
  return numberToIpv4(networkNum);
}

/**
 * Calculate broadcast address
 */
export function getBroadcastAddress(ip: string, netmask: string): string {
  const ipNum = ipv4ToNumber(ip);
  const netmaskNum = ipv4ToNumber(netmask);
  const broadcastNum = (ipNum | ~netmaskNum) >>> 0;
  return numberToIpv4(broadcastNum);
}

/**
 * Check if two IPs are in same subnet
 */
export function inSameSubnet(
  ip1: string,
  ip2: string,
  netmask: string,
): boolean {
  const network1 = getNetworkAddress(ip1, netmask);
  const network2 = getNetworkAddress(ip2, netmask);
  return network1 === network2;
}

/**
 * Generate random IP in CIDR range
 */
export function randomIPInCIDR(cidr: string): string {
  const parsed = parseCIDR(cidr);
  const networkNum = ipv4ToNumber(parsed.network);
  const totalHosts = parsed.totalHosts;

  if (totalHosts === 1) {
    return parsed.network;
  }

  const randomOffset = Math.floor(Math.random() * totalHosts) + 1;
  const randomNum = networkNum + randomOffset;

  return numberToIpv4(randomNum);
}
