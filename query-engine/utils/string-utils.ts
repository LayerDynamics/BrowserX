/**
 * String utility functions
 * Comprehensive string manipulation, escaping, and pattern matching
 */

import { isString } from "./type-guards.ts";

/**
 * Escape special characters in string for use in quotes
 */
export function escapeString(str: string, quote: '"' | "'" = '"'): string {
  return str
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t")
    .replace(/\f/g, "\\f")
    .replace(/\v/g, "\\v")
    .replace(/\0/g, "\\0")
    .replace(new RegExp(quote, "g"), `\\${quote}`);
}

/**
 * Unescape string (reverse of escapeString)
 */
export function unescapeString(str: string): string {
  return str
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\f/g, "\f")
    .replace(/\\v/g, "\v")
    .replace(/\\0/g, "\0")
    .replace(/\\'/g, "'")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\");
}

/**
 * Escape special characters for use in regular expressions
 */
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Escape HTML special characters
 */
export function escapeHTML(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Unescape HTML entities
 */
export function unescapeHTML(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9A-Fa-f]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)));
}

/**
 * Convert string to slug (URL-safe lowercase string)
 */
export function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Convert string to camelCase
 */
export function toCamelCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, char) => char.toUpperCase());
}

/**
 * Convert string to PascalCase
 */
export function toPascalCase(str: string): string {
  const camel = toCamelCase(str);
  return camel.charAt(0).toUpperCase() + camel.slice(1);
}

/**
 * Convert string to snake_case
 */
export function toSnakeCase(str: string): string {
  return str
    .replace(/([A-Z])/g, "_$1")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * Convert string to kebab-case
 */
export function toKebabCase(str: string): string {
  return str
    .replace(/([A-Z])/g, "-$1")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Capitalize first letter of string
 */
export function capitalize(str: string): string {
  if (str.length === 0) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Capitalize first letter of each word
 */
export function capitalizeWords(str: string): string {
  return str.replace(/\b\w/g, (char) => char.toUpperCase());
}

/**
 * Truncate string to max length with ellipsis
 */
export function truncate(str: string, maxLength: number, ellipsis: string = "..."): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - ellipsis.length) + ellipsis;
}

/**
 * Truncate string at word boundary
 */
export function truncateWords(str: string, maxLength: number, ellipsis: string = "..."): string {
  if (str.length <= maxLength) return str;

  const truncated = str.slice(0, maxLength - ellipsis.length);
  const lastSpace = truncated.lastIndexOf(" ");

  if (lastSpace > 0) {
    return truncated.slice(0, lastSpace) + ellipsis;
  }

  return truncated + ellipsis;
}

/**
 * Pad string to length with character
 */
export function padLeft(str: string, length: number, char: string = " "): string {
  return str.padStart(length, char);
}

/**
 * Pad string to length on right
 */
export function padRight(str: string, length: number, char: string = " "): string {
  return str.padEnd(length, char);
}

/**
 * Repeat string n times
 */
export function repeat(str: string, count: number): string {
  return str.repeat(count);
}

/**
 * Reverse string
 */
export function reverse(str: string): string {
  return str.split("").reverse().join("");
}

/**
 * Count occurrences of substring
 */
export function countOccurrences(str: string, substr: string): number {
  if (substr.length === 0) return 0;
  let count = 0;
  let pos = 0;
  while ((pos = str.indexOf(substr, pos)) !== -1) {
    count++;
    pos += substr.length;
  }
  return count;
}

/**
 * Check if string matches pattern (supports wildcards and regex)
 */
export function matchesPattern(
  text: string,
  pattern: string,
  type: "wildcard" | "regex" | "exact" = "wildcard",
): boolean {
  switch (type) {
    case "exact":
      return text === pattern;

    case "wildcard":
      // Convert wildcard pattern to regex (* = .*, ? = .)
      const regexPattern = pattern
        .split("*")
        .map(escapeRegex)
        .join(".*")
        .replace(/\\\?/g, ".");
      return new RegExp(`^${regexPattern}$`).test(text);

    case "regex":
      return new RegExp(pattern).test(text);

    default:
      return false;
  }
}

/**
 * SQL LIKE pattern matching
 */
export function matchesLike(
  text: string,
  pattern: string,
  caseInsensitive: boolean = false,
): boolean {
  // Convert SQL LIKE pattern to regex
  // % = .* (any characters)
  // _ = . (single character)
  const regexPattern = pattern
    .split("%")
    .map(escapeRegex)
    .join(".*")
    .replace(/\\_/g, ".")
    .replace(/_/g, ".");

  const flags = caseInsensitive ? "i" : "";
  return new RegExp(`^${regexPattern}$`, flags).test(text);
}

/**
 * String interpolation with template
 */
export function interpolate(template: string, values: Record<string, unknown>): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    const value = values[key];
    return value !== undefined ? String(value) : match;
  });
}

/**
 * Remove ANSI escape codes from string
 */
export function stripAnsi(str: string): string {
  return str.replace(/\x1B\[[0-9;]*[mGKHF]/g, "");
}

/**
 * Wrap text to specified width
 */
export function wrapText(text: string, width: number): string {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    if (currentLine.length + word.length + 1 <= width) {
      currentLine += (currentLine.length > 0 ? " " : "") + word;
    } else {
      if (currentLine.length > 0) {
        lines.push(currentLine);
      }
      currentLine = word;
    }
  }

  if (currentLine.length > 0) {
    lines.push(currentLine);
  }

  return lines.join("\n");
}

/**
 * Indent each line with specified string
 */
export function indent(text: string, indentation: string = "  "): string {
  return text.split("\n").map((line) => indentation + line).join("\n");
}

/**
 * Remove indentation from text (dedent)
 */
export function dedent(text: string): string {
  const lines = text.split("\n");

  // Find minimum indentation (ignoring empty lines)
  let minIndent = Infinity;
  for (const line of lines) {
    if (line.trim().length === 0) continue;
    const indent = line.match(/^\s*/)?.[0].length || 0;
    minIndent = Math.min(minIndent, indent);
  }

  if (minIndent === Infinity) return text;

  // Remove minimum indentation from all lines
  return lines.map((line) => line.slice(minIndent)).join("\n");
}

/**
 * Extract substring between delimiters
 */
export function extractBetween(
  str: string,
  start: string,
  end: string,
  greedy: boolean = false,
): string | null {
  const startIdx = str.indexOf(start);
  if (startIdx === -1) return null;

  const searchStart = startIdx + start.length;
  const endIdx = greedy ? str.lastIndexOf(end) : str.indexOf(end, searchStart);
  if (endIdx === -1) return null;

  return str.slice(searchStart, endIdx);
}

/**
 * Split string by delimiter, respecting quoted sections
 */
export function smartSplit(str: string, delimiter: string, quote: string = '"'): string[] {
  const result: string[] = [];
  let current = "";
  let inQuote = false;
  let i = 0;

  while (i < str.length) {
    const char = str[i];

    if (char === quote) {
      inQuote = !inQuote;
      current += char;
      i++;
    } else if (!inQuote && str.slice(i, i + delimiter.length) === delimiter) {
      result.push(current);
      current = "";
      i += delimiter.length;
    } else {
      current += char;
      i++;
    }
  }

  if (current.length > 0 || str.endsWith(delimiter)) {
    result.push(current);
  }

  return result;
}

/**
 * Compare strings with locale awareness
 */
export function localeCompare(a: string, b: string, locale?: string): number {
  return a.localeCompare(b, locale);
}

/**
 * Levenshtein distance (edit distance) between two strings
 */
export function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1, // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Calculate string similarity (0-1 based on Levenshtein distance)
 */
export function stringSimilarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1.0;
  const distance = levenshteinDistance(a, b);
  return 1 - distance / maxLen;
}

/**
 * Convert value to string safely
 */
export function toString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (isString(value)) return value;
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}
