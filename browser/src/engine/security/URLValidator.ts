/**
 * URL Validator — SSRF Protection
 *
 * Blocks requests to private/internal IP ranges, non-HTTP protocols,
 * and dangerous data: URIs. Provides an allowlist bypass for testing.
 */

export class SSRFError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SSRFError";
  }
}

export interface URLValidatorOptions {
  /** URLs or hostname patterns that bypass validation (for testing) */
  allowlist?: string[];
}

/**
 * Private/internal IPv4 ranges to block:
 *   10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16,
 *   127.0.0.0/8, 0.0.0.0, 169.254.0.0/16 (link-local / cloud metadata)
 */
function isPrivateIPv4(hostname: string): boolean {
  // Match dotted-quad IPv4
  const parts = hostname.split(".");
  if (parts.length !== 4) return false;
  const nums = parts.map(Number);
  if (nums.some((n) => isNaN(n) || n < 0 || n > 255)) return false;

  const [a, b] = nums;

  // 0.0.0.0
  if (nums.every((n) => n === 0)) return true;
  // 127.0.0.0/8
  if (a === 127) return true;
  // 10.0.0.0/8
  if (a === 10) return true;
  // 172.16.0.0/12  (172.16.x.x – 172.31.x.x)
  if (a === 172 && b >= 16 && b <= 31) return true;
  // 192.168.0.0/16
  if (a === 192 && b === 168) return true;
  // 169.254.0.0/16 (link-local, AWS metadata endpoint etc.)
  if (a === 169 && b === 254) return true;

  return false;
}

function isPrivateIPv6(hostname: string): boolean {
  // Strip brackets if present (e.g. from URL)
  const h = hostname.replace(/^\[|\]$/g, "");
  // ::1 (loopback) — normalised forms
  if (h === "::1" || h === "0:0:0:0:0:0:0:1") return true;
  // :: (unspecified)
  if (h === "::" || h === "0:0:0:0:0:0:0:0") return true;
  // fe80:: link-local
  if (h.toLowerCase().startsWith("fe80:")) return true;
  // fc00::/7 unique-local
  const first = h.toLowerCase().split(":")[0];
  if (first.startsWith("fc") || first.startsWith("fd")) return true;
  return false;
}

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

export class URLValidator {
  private allowlist: Set<string>;

  constructor(options?: URLValidatorOptions) {
    this.allowlist = new Set(options?.allowlist ?? []);
  }

  /** Convenience static — uses default (no allowlist) */
  static validate(url: string): void {
    new URLValidator().validateUrl(url);
  }

  validateUrl(url: string): void {
    // Handle data: URIs specially
    if (url.startsWith("data:")) {
      if (/^data:image\//i.test(url)) return; // images OK
      throw new SSRFError(`Blocked non-image data: URI`);
    }

    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new SSRFError(`Invalid URL: ${url}`);
    }

    // Allowlist check (exact hostname match)
    if (this.allowlist.has(parsed.hostname)) return;

    // Protocol check
    if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
      throw new SSRFError(`Blocked protocol: ${parsed.protocol}`);
    }

    // Hostname checks
    const hostname = parsed.hostname;

    if (hostname === "localhost") {
      throw new SSRFError(`Blocked request to localhost`);
    }

    if (isPrivateIPv4(hostname)) {
      throw new SSRFError(`Blocked request to private IP: ${hostname}`);
    }

    if (isPrivateIPv6(hostname)) {
      throw new SSRFError(`Blocked request to private IPv6: ${hostname}`);
    }
  }
}
