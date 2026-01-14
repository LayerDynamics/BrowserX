// ip_handling.ts - IP address parsing and validation

/**
 * IPv4 address class
 */
export class IPv4Address {
  private octets: number[];

  constructor(address: string) {
    this.octets = this.parse(address);
  }

  /**
   * Parse IPv4 address string
   */
  private parse(address: string): number[] {
    const parts = address.split('.');

    if (parts.length !== 4) {
      throw new Error(`Invalid IPv4 address: ${address}`);
    }

    const octets = parts.map(part => {
      const num = parseInt(part, 10);
      if (isNaN(num) || num < 0 || num > 255) {
        throw new Error(`Invalid IPv4 octet: ${part}`);
      }
      return num;
    });

    return octets;
  }

  /**
   * Convert to string representation
   */
  toString(): string {
    return this.octets.join('.');
  }

  /**
   * Convert to 32-bit integer
   */
  toInteger(): number {
    return (this.octets[0] << 24) |
           (this.octets[1] << 16) |
           (this.octets[2] << 8) |
           this.octets[3];
  }

  /**
   * Check if this is a private IP address
   * Private ranges: 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
   */
  isPrivate(): boolean {
    const first = this.octets[0];
    const second = this.octets[1];

    // 10.0.0.0/8
    if (first === 10) {
      return true;
    }

    // 172.16.0.0/12
    if (first === 172 && second >= 16 && second <= 31) {
      return true;
    }

    // 192.168.0.0/16
    if (first === 192 && second === 168) {
      return true;
    }

    return false;
  }

  /**
   * Check if this is a loopback address (127.0.0.0/8)
   */
  isLoopback(): boolean {
    return this.octets[0] === 127;
  }

  /**
   * Check if this is a multicast address (224.0.0.0/4)
   */
  isMulticast(): boolean {
    return this.octets[0] >= 224 && this.octets[0] <= 239;
  }

  /**
   * Check if this is a link-local address (169.254.0.0/16)
   */
  isLinkLocal(): boolean {
    return this.octets[0] === 169 && this.octets[1] === 254;
  }

  /**
   * Get the class of this IPv4 address (A, B, C, D, E)
   */
  getClass(): 'A' | 'B' | 'C' | 'D' | 'E' {
    const first = this.octets[0];

    if (first >= 1 && first <= 126) return 'A';
    if (first >= 128 && first <= 191) return 'B';
    if (first >= 192 && first <= 223) return 'C';
    if (first >= 224 && first <= 239) return 'D';
    return 'E';
  }
}

/**
 * IPv6 address class
 */
export class IPv6Address {
  private hextets: number[];

  constructor(address: string) {
    this.hextets = this.parse(address);
  }

  /**
   * Parse IPv6 address string
   * Supports full, compressed, and IPv4-embedded formats
   */
  private parse(address: string): number[] {
    // Handle :: compression
    if (address.includes('::')) {
      const [left, right] = address.split('::');
      const leftParts = left ? left.split(':') : [];
      const rightParts = right ? right.split(':') : [];

      const missing = 8 - leftParts.length - rightParts.length;
      const middleParts = new Array(missing).fill('0');

      const allParts = [...leftParts, ...middleParts, ...rightParts];
      return allParts.map(part => parseInt(part || '0', 16));
    }

    // Full IPv6 address
    const parts = address.split(':');
    if (parts.length !== 8) {
      throw new Error(`Invalid IPv6 address: ${address}`);
    }

    return parts.map(part => {
      const num = parseInt(part, 16);
      if (isNaN(num) || num < 0 || num > 0xFFFF) {
        throw new Error(`Invalid IPv6 hextet: ${part}`);
      }
      return num;
    });
  }

  /**
   * Convert to string representation (compressed)
   */
  toString(): string {
    // Find longest sequence of zeros to compress
    let maxZeroStart = -1;
    let maxZeroLen = 0;
    let currentZeroStart = -1;
    let currentZeroLen = 0;

    for (let i = 0; i < 8; i++) {
      if (this.hextets[i] === 0) {
        if (currentZeroStart === -1) {
          currentZeroStart = i;
          currentZeroLen = 1;
        } else {
          currentZeroLen++;
        }
      } else {
        if (currentZeroLen > maxZeroLen) {
          maxZeroStart = currentZeroStart;
          maxZeroLen = currentZeroLen;
        }
        currentZeroStart = -1;
        currentZeroLen = 0;
      }
    }

    if (currentZeroLen > maxZeroLen) {
      maxZeroStart = currentZeroStart;
      maxZeroLen = currentZeroLen;
    }

    // Build compressed string
    if (maxZeroLen > 1) {
      const before = this.hextets.slice(0, maxZeroStart).map(h => h.toString(16));
      const after = this.hextets.slice(maxZeroStart + maxZeroLen).map(h => h.toString(16));

      if (before.length === 0) {
        return '::' + after.join(':');
      } else if (after.length === 0) {
        return before.join(':') + '::';
      } else {
        return before.join(':') + '::' + after.join(':');
      }
    }

    return this.hextets.map(h => h.toString(16)).join(':');
  }

  /**
   * Check if this is a loopback address (::1)
   */
  isLoopback(): boolean {
    return this.hextets.every((h, i) => i === 7 ? h === 1 : h === 0);
  }

  /**
   * Check if this is a link-local address (fe80::/10)
   */
  isLinkLocal(): boolean {
    return (this.hextets[0] & 0xFFC0) === 0xFE80;
  }

  /**
   * Check if this is a multicast address (ff00::/8)
   */
  isMulticast(): boolean {
    return (this.hextets[0] & 0xFF00) === 0xFF00;
  }

  /**
   * Check if this is a unique local address (fc00::/7)
   */
  isUniqueLocal(): boolean {
    return (this.hextets[0] & 0xFE00) === 0xFC00;
  }
}

/**
 * Parse IP address (auto-detect IPv4 or IPv6)
 */
export function parseIPAddress(address: string): IPv4Address | IPv6Address {
  if (address.includes(':')) {
    return new IPv6Address(address);
  } else {
    return new IPv4Address(address);
  }
}

/**
 * Validate IP address format
 */
export function isValidIPAddress(address: string): boolean {
  try {
    parseIPAddress(address);
    return true;
  } catch {
    return false;
  }
}
