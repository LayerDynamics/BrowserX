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
 * Check if hostname is a private IP address
 */
export function isPrivateIP(hostname: string): boolean {
  // Localhost
  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1"
  ) {
    return true;
  }

  // IPv4 private ranges
  const ipv4Match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const [, a, b] = ipv4Match.map(Number);

    // 10.0.0.0/8
    if (a === 10) return true;

    // 172.16.0.0/12
    if (a === 172 && b >= 16 && b <= 31) return true;

    // 192.168.0.0/16
    if (a === 192 && b === 168) return true;

    // 169.254.0.0/16 (link-local)
    if (a === 169 && b === 254) return true;

    // 127.0.0.0/8 (loopback)
    if (a === 127) return true;

    // 0.0.0.0/8
    if (a === 0) return true;
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
