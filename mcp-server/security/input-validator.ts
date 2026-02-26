/**
 * Input validation utilities for MCP server
 * Validates URLs, scripts, and other user inputs
 */

/**
 * URL validation configuration
 */
export interface UrlValidationConfig {
  allowedProtocols?: string[];
  blockedDomains?: string[];
  allowPrivateIPs?: boolean;
}

/**
 * Default URL validation config
 */
const DEFAULT_URL_CONFIG: UrlValidationConfig = {
  allowedProtocols: ["http:", "https:"],
  blockedDomains: [],
  allowPrivateIPs: false,
};

/**
 * Validate a URL against security rules
 */
export function validateUrl(url: string, config: UrlValidationConfig = {}): void {
  const mergedConfig = { ...DEFAULT_URL_CONFIG, ...config };

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }

  // Check protocol
  if (
    mergedConfig.allowedProtocols &&
    !mergedConfig.allowedProtocols.includes(parsed.protocol)
  ) {
    throw new Error(
      `Protocol not allowed: ${parsed.protocol}. Allowed: ${mergedConfig.allowedProtocols.join(", ")}`,
    );
  }

  // Check blocked domains
  if (mergedConfig.blockedDomains) {
    for (const domain of mergedConfig.blockedDomains) {
      if (parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`)) {
        throw new Error(`Domain blocked: ${parsed.hostname}`);
      }
    }
  }

  // Check private IPs
  if (!mergedConfig.allowPrivateIPs && isPrivateIP(parsed.hostname)) {
    throw new Error(`Private IP access not allowed: ${parsed.hostname}`);
  }
}

/**
 * Check if an IPv4 address (dotted-decimal) is private/reserved
 */
function isPrivateIPv4(a: number, b: number, _c: number, _d: number): boolean {
  if (a === 10) return true;                          // 10.0.0.0/8
  if (a === 172 && b >= 16 && b <= 31) return true;   // 172.16.0.0/12
  if (a === 192 && b === 168) return true;             // 192.168.0.0/16
  if (a === 169 && b === 254) return true;             // 169.254.0.0/16 (link-local)
  if (a === 127) return true;                          // 127.0.0.0/8 (loopback)
  if (a === 0) return true;                            // 0.0.0.0/8
  return false;
}

/**
 * Try to parse an octal/hex/decimal IP and check if it's private
 */
function isObfuscatedPrivateIP(hostname: string): boolean {
  // Decimal IP (single number like 2130706433 = 127.0.0.1)
  if (/^\d{1,10}$/.test(hostname)) {
    const num = parseInt(hostname, 10);
    if (num >= 0 && num <= 0xFFFFFFFF) {
      const a = (num >>> 24) & 0xFF;
      const b = (num >>> 16) & 0xFF;
      const c = (num >>> 8) & 0xFF;
      const d = num & 0xFF;
      return isPrivateIPv4(a, b, c, d);
    }
  }

  // Octal or hex notation (e.g., 0177.0.0.1 or 0x7f.0.0.1)
  const parts = hostname.split(".");
  if (parts.length === 4) {
    const hasOctalOrHex = parts.some((p) => /^0[0-7]+$/.test(p) || /^0x[0-9a-fA-F]+$/i.test(p));
    if (hasOctalOrHex) {
      const octets = parts.map((p) => {
        if (p.startsWith("0x") || p.startsWith("0X")) return parseInt(p, 16);
        if (p.startsWith("0") && p.length > 1) return parseInt(p, 8);
        return parseInt(p, 10);
      });
      if (octets.every((o) => o >= 0 && o <= 255)) {
        return isPrivateIPv4(octets[0], octets[1], octets[2], octets[3]);
      }
    }
  }

  return false;
}

/**
 * Expand any IPv6 address to its full 8-group hex form.
 * Handles :: expansion, IPv4-mapped suffixes (dotted and hex), and NAT64.
 */
function expandIPv6(addr: string): string {
  let working = addr.toLowerCase().trim();

  // Strip zone ID (e.g., %eth0)
  const zoneIdx = working.indexOf("%");
  if (zoneIdx !== -1) {
    working = working.substring(0, zoneIdx);
  }

  // Handle IPv4 suffix (e.g., ::ffff:127.0.0.1 or ::127.0.0.1)
  const ipv4Suffix = working.match(/:(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Suffix) {
    const [fullMatch, a, b, c, d] = ipv4Suffix;
    const hi = ((parseInt(a) << 8) | parseInt(b)).toString(16).padStart(4, "0");
    const lo = ((parseInt(c) << 8) | parseInt(d)).toString(16).padStart(4, "0");
    working = working.substring(0, working.length - fullMatch.length + 1) + hi + ":" + lo;
  }

  // Split on ::
  const halves = working.split("::");
  let groups: string[];

  if (halves.length === 2) {
    const left = halves[0] ? halves[0].split(":") : [];
    const right = halves[1] ? halves[1].split(":") : [];
    const missing = 8 - left.length - right.length;
    const middle = Array(missing).fill("0000");
    groups = [...left, ...middle, ...right];
  } else {
    groups = working.split(":");
  }

  // Pad each group to 4 hex digits
  return groups.map((g) => g.padStart(4, "0")).join(":");
}

/**
 * Check if hostname is a private IP address (IPv4, IPv6, obfuscated)
 */
export function isPrivateIP(hostname: string): boolean {
  // Strip brackets from IPv6 (e.g., [::1] → ::1)
  let host = hostname;
  if (host.startsWith("[") && host.endsWith("]")) {
    host = host.slice(1, -1);
  }

  // Localhost
  if (host === "localhost" || host === "127.0.0.1" || host === "::1") {
    return true;
  }

  // IPv6 checks
  const hostLower = host.toLowerCase();

  // IPv6 loopback
  if (hostLower === "0:0:0:0:0:0:0:1" || hostLower === "0000:0000:0000:0000:0000:0000:0000:0001") {
    return true;
  }

  // IPv6 unique-local (fc00::/7)
  if (hostLower.startsWith("fc") || hostLower.startsWith("fd")) {
    if (hostLower.length > 2 && (hostLower[2] === ":" || /^[0-9a-f]/.test(hostLower[2]))) {
      return true;
    }
  }

  // IPv6 link-local (fe80::/10)
  if (hostLower.startsWith("fe80:") || hostLower.startsWith("fe80%")) {
    return true;
  }

  // IPv4-mapped IPv6 (::ffff:x.x.x.x)
  const mappedMatch = hostLower.match(/^::ffff:(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (mappedMatch) {
    const [, a, b, c, d] = mappedMatch.map(Number);
    return isPrivateIPv4(a, b, c, d);
  }

  // Standard IPv4 private ranges
  const ipv4Match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const [, a, b, c, d] = ipv4Match.map(Number);
    return isPrivateIPv4(a, b, c, d);
  }

  // Obfuscated IPs (octal, hex, decimal)
  if (isObfuscatedPrivateIP(host)) {
    return true;
  }

  // Comprehensive IPv6 check via full expansion
  if (host.includes(":")) {
    const expanded = expandIPv6(host);

    // Loopback ::1
    if (expanded === "0000:0000:0000:0000:0000:0000:0000:0001") {
      return true;
    }

    // Link-local fe80::/10
    if (expanded.startsWith("fe80:")) {
      return true;
    }

    // Unique-local fc00::/7 (fc or fd)
    if (expanded.startsWith("fc") || expanded.startsWith("fd")) {
      return true;
    }

    // IPv4-mapped ::ffff:x.x.x.x (last 32 bits as IPv4)
    if (expanded.startsWith("0000:0000:0000:0000:0000:ffff:")) {
      const tail = expanded.substring(30); // e.g., "7f00:0001"
      const tailParts = tail.split(":");
      if (tailParts.length === 2) {
        const hi = parseInt(tailParts[0], 16);
        const lo = parseInt(tailParts[1], 16);
        const a = (hi >> 8) & 0xFF, b = hi & 0xFF;
        const c = (lo >> 8) & 0xFF, d = lo & 0xFF;
        return isPrivateIPv4(a, b, c, d);
      }
    }

    // NAT64 prefix 64:ff9b::/96
    if (expanded.startsWith("0064:ff9b:0000:0000:0000:0000:")) {
      const tail = expanded.substring(30);
      const tailParts = tail.split(":");
      if (tailParts.length === 2) {
        const hi = parseInt(tailParts[0], 16);
        const lo = parseInt(tailParts[1], 16);
        const a = (hi >> 8) & 0xFF, b = hi & 0xFF;
        const c = (lo >> 8) & 0xFF, d = lo & 0xFF;
        return isPrivateIPv4(a, b, c, d);
      }
    }
  }

  return false;
}

/**
 * Dangerous patterns to detect in JavaScript code
 */
const DANGEROUS_PATTERNS: Array<{ pattern: RegExp; description: string }> = [
  // Node.js / Deno runtime access
  { pattern: /\brequire\s*\(/, description: "Node.js require" },
  { pattern: /\bimport\s*\(/, description: "dynamic import" },
  { pattern: /\bimport\s+/, description: "ES module import" },
  { pattern: /\bprocess\./, description: "Node.js process access" },
  { pattern: /\bDeno\s*\./, description: "Deno namespace access" },
  { pattern: /\b__dirname\b/, description: "Node.js __dirname" },
  { pattern: /\b__filename\b/, description: "Node.js __filename" },
  { pattern: /\bglobalThis\s*\.\s*Deno\b/, description: "Deno via globalThis" },
  { pattern: /\bglobalThis\s*\.\s*process\b/, description: "process via globalThis" },

  // Code execution
  { pattern: /\beval\s*\(/, description: "eval function" },
  { pattern: /\bFunction\s*\(/, description: "Function constructor" },
  { pattern: /\bsetTimeout\s*\(\s*["'`]/, description: "setTimeout with string" },
  { pattern: /\bsetInterval\s*\(\s*["'`]/, description: "setInterval with string" },

  // Constructor chain exploitation
  { pattern: /\.constructor\s*\(/, description: "constructor invocation" },
  { pattern: /\[\s*['"]constructor['"]\s*\]/, description: "constructor property access" },
  { pattern: /__proto__/, description: "prototype pollution" },
  { pattern: /prototype\s*\[/, description: "prototype bracket access" },

  // Network access (prevent data exfiltration)
  { pattern: /\bfetch\s*\(/, description: "fetch API" },
  { pattern: /\bXMLHttpRequest\b/, description: "XMLHttpRequest" },
  { pattern: /\bWebSocket\b/, description: "WebSocket" },
  { pattern: /\bEventSource\b/, description: "EventSource (SSE)" },

  // Frame/window escape
  { pattern: /\btop\s*\./, description: "top frame access" },
  { pattern: /\bparent\s*\./, description: "parent frame access" },
  { pattern: /\bframes\s*\[/, description: "frames access" },
  { pattern: /\bopener\s*\./, description: "opener window access" },

  // File system (browser)
  { pattern: /\bFileReader\b/, description: "FileReader API" },
  { pattern: /\bFileSystem\w*\b/, description: "FileSystem API" },

  // Storage access (could leak/overwrite data)
  { pattern: /\blocalStorage\s*\./, description: "localStorage access" },
  { pattern: /\bsessionStorage\s*\./, description: "sessionStorage access" },
  { pattern: /\bindexedDB\s*\./, description: "IndexedDB access" },
];

/**
 * Maximum allowed script length
 */
const MAX_SCRIPT_LENGTH = 100 * 1024; // 100KB

/**
 * Normalize script by decoding unicode escapes that could bypass pattern detection
 */
function normalizeScript(script: string): string {
  // Decode unicode escapes (\uXXXX)
  let normalized = script.replace(/\\u([0-9a-fA-F]{4})/g, (_, code) =>
    String.fromCharCode(parseInt(code, 16))
  );

  // Decode hex escapes (\xXX)
  normalized = normalized.replace(/\\x([0-9a-fA-F]{2})/g, (_, code) =>
    String.fromCharCode(parseInt(code, 16))
  );

  // Decode octal escapes (\NNN)
  normalized = normalized.replace(/\\([0-7]{1,3})/g, (_, code) =>
    String.fromCharCode(parseInt(code, 8))
  );

  return normalized;
}

/**
 * Remove comments from script to prevent pattern hiding
 */
function stripComments(script: string): string {
  // Remove single-line comments
  let stripped = script.replace(/\/\/.*$/gm, "");

  // Remove multi-line comments (non-greedy)
  stripped = stripped.replace(/\/\*[\s\S]*?\*\//g, "");

  return stripped;
}

/**
 * Validate JavaScript code for dangerous patterns
 */
export function validateScript(script: string): void {
  // Check length
  if (script.length > MAX_SCRIPT_LENGTH) {
    throw new Error(
      `Script too long: ${script.length} bytes. Maximum allowed: ${MAX_SCRIPT_LENGTH} bytes`,
    );
  }

  // Check for null bytes (could be used for truncation attacks)
  if (script.includes("\0")) {
    throw new Error("Script contains null bytes");
  }

  // Normalize and strip comments to prevent bypass attempts
  const normalizedScript = normalizeScript(script);
  const strippedScript = stripComments(normalizedScript);

  // Check both original and normalized versions
  const scriptsToCheck = [script, normalizedScript, strippedScript];

  for (const scriptVersion of scriptsToCheck) {
    for (const { pattern, description } of DANGEROUS_PATTERNS) {
      if (pattern.test(scriptVersion)) {
        throw new Error(
          `Dangerous pattern detected in script: ${description}. ` +
            `Pattern: ${pattern.source}`,
        );
      }
    }
  }
}

/**
 * Sanitize a string for safe logging (remove sensitive data patterns)
 */
export function sanitizeForLogging(value: string): string {
  // Mask potential API keys, tokens, passwords
  return value
    .replace(/([Aa]pi[_-]?[Kk]ey|[Tt]oken|[Pp]assword|[Ss]ecret)\s*[:=]\s*["']?[\w\-_.]+["']?/g, "$1=***REDACTED***")
    .replace(/[Bb]earer\s+[\w\-_.]+/g, "Bearer ***REDACTED***")
    .replace(/[Bb]asic\s+[\w\-_.=]+/g, "Basic ***REDACTED***");
}

/**
 * Validate CSS selector syntax (basic validation)
 */
export function validateSelector(selector: string): void {
  if (!selector || typeof selector !== "string") {
    throw new Error("Selector must be a non-empty string");
  }

  if (selector.length > 1000) {
    throw new Error("Selector too long (max 1000 characters)");
  }

  // Check for obviously invalid selectors
  if (selector.startsWith(">") || selector.startsWith("+") || selector.startsWith("~")) {
    throw new Error("Selector cannot start with a combinator");
  }
}
