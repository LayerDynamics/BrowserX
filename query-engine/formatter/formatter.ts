/**
 * Result Formatter
 * Formats query results to various output formats
 */

import { OutputFormat } from "../types/mod.ts";

/**
 * Formatting options
 */
export interface FormatterOptions {
  pretty?: boolean;
  indent?: number;
  maxDepth?: number;
  includeHeaders?: boolean;
  delimiter?: string;
  quote?: string;
  escape?: string;
}

/**
 * Result formatter class
 */
export class ResultFormatter {
  /**
   * Format data to specified output format
   */
  format(data: unknown, format: OutputFormat, options: FormatterOptions = {}): string | Uint8Array {
    switch (format) {
      case "JSON":
        return this.formatJSON(data, options);

      case "TABLE":
        return this.formatTable(data, options);

      case "CSV":
        return this.formatCSV(data, options);

      case "HTML":
        return this.formatHTML(data, options);

      case "XML":
        return this.formatXML(data, options);

      case "YAML":
        return this.formatYAML(data, options);

      case "STREAM":
        return this.formatStream(data, options);

      default:
        throw new Error(`Unsupported output format: ${format}`);
    }
  }

  /**
   * Format as JSON
   */
  private formatJSON(data: unknown, options: FormatterOptions): string {
    const indent = options.pretty ? (options.indent ?? 2) : undefined;
    return JSON.stringify(data, this.createJSONReplacer(options), indent);
  }

  /**
   * Create JSON replacer function with depth limit
   */
  private createJSONReplacer(options: FormatterOptions): (key: string, value: unknown) => unknown {
    const maxDepth = options.maxDepth ?? Infinity;
    const seen = new WeakSet();

    return function (this: unknown, key: string, value: unknown): unknown {
      if (typeof value === "object" && value !== null) {
        // Circular reference detection
        if (seen.has(value)) {
          return "[Circular]";
        }
        seen.add(value);

        // Depth limit
        const depth = this ? JSON.stringify(this).split("{").length - 1 : 0;
        if (depth > maxDepth) {
          return "[Max Depth]";
        }
      }

      return value;
    };
  }

  /**
   * Format as ASCII table
   */
  private formatTable(data: unknown, options: FormatterOptions): string {
    if (!Array.isArray(data) || data.length === 0) {
      return "";
    }

    // Extract headers from first row
    const firstRow = data[0];
    if (typeof firstRow !== "object" || firstRow === null) {
      return String(data);
    }

    const headers = Object.keys(firstRow);
    const rows = data.map((row) =>
      headers.map((header) => {
        const value = (row as Record<string, unknown>)[header];
        return this.stringifyValue(value);
      })
    );

    // Calculate column widths
    const widths = headers.map((header, i) => {
      const headerWidth = header.length;
      const maxRowWidth = Math.max(...rows.map((row) => row[i].length));
      return Math.max(headerWidth, maxRowWidth);
    });

    // Build table
    const lines: string[] = [];

    // Header separator
    const separator = "+" + widths.map((w) => "-".repeat(w + 2)).join("+") + "+";
    lines.push(separator);

    // Headers
    if (options.includeHeaders !== false) {
      const headerLine = "| " +
        headers.map((header, i) => header.padEnd(widths[i])).join(" | ") +
        " |";
      lines.push(headerLine);
      lines.push(separator);
    }

    // Rows
    for (const row of rows) {
      const rowLine = "| " + row.map((cell, i) => cell.padEnd(widths[i])).join(" | ") + " |";
      lines.push(rowLine);
    }

    lines.push(separator);

    return lines.join("\n");
  }

  /**
   * Format as CSV
   */
  private formatCSV(data: unknown, options: FormatterOptions): string {
    if (!Array.isArray(data) || data.length === 0) {
      return "";
    }

    const delimiter = options.delimiter ?? ",";
    const quote = options.quote ?? '"';
    const escape = options.escape ?? quote;

    const firstRow = data[0];
    if (typeof firstRow !== "object" || firstRow === null) {
      return data.map((item) => this.escapeCsvValue(String(item), delimiter, quote, escape)).join(
        "\n",
      );
    }

    const headers = Object.keys(firstRow);
    const lines: string[] = [];

    // Add headers
    if (options.includeHeaders !== false) {
      lines.push(
        headers.map((h) => this.escapeCsvValue(h, delimiter, quote, escape)).join(delimiter),
      );
    }

    // Add rows
    for (const row of data) {
      const values = headers.map((header) => {
        const value = (row as Record<string, unknown>)[header];
        return this.escapeCsvValue(this.stringifyValue(value), delimiter, quote, escape);
      });
      lines.push(values.join(delimiter));
    }

    return lines.join("\n");
  }

  /**
   * Escape CSV value
   */
  private escapeCsvValue(value: string, delimiter: string, quote: string, escape: string): string {
    // If value contains delimiter, quote, newline, or carriage return, quote it
    if (
      value.includes(delimiter) ||
      value.includes(quote) ||
      value.includes("\n") ||
      value.includes("\r")
    ) {
      // Escape quotes
      value = value.replace(new RegExp(quote, "g"), escape + quote);
      return quote + value + quote;
    }

    return value;
  }

  /**
   * Format as HTML table
   */
  private formatHTML(data: unknown, options: FormatterOptions): string {
    if (!Array.isArray(data) || data.length === 0) {
      return "<p>No data</p>";
    }

    const firstRow = data[0];
    if (typeof firstRow !== "object" || firstRow === null) {
      return "<pre>" + this.escapeHtml(JSON.stringify(data, null, 2)) + "</pre>";
    }

    const headers = Object.keys(firstRow);
    const lines: string[] = [];

    lines.push("<table>");

    // Headers
    if (options.includeHeaders !== false) {
      lines.push("  <thead>");
      lines.push("    <tr>");
      for (const header of headers) {
        lines.push(`      <th>${this.escapeHtml(header)}</th>`);
      }
      lines.push("    </tr>");
      lines.push("  </thead>");
    }

    // Body
    lines.push("  <tbody>");
    for (const row of data) {
      lines.push("    <tr>");
      for (const header of headers) {
        const value = (row as Record<string, unknown>)[header];
        lines.push(`      <td>${this.escapeHtml(this.stringifyValue(value))}</td>`);
      }
      lines.push("    </tr>");
    }
    lines.push("  </tbody>");

    lines.push("</table>");

    return lines.join("\n");
  }

  /**
   * Escape HTML special characters
   */
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  /**
   * Format as XML
   */
  private formatXML(data: unknown, options: FormatterOptions): string {
    const indent = options.pretty ? (options.indent ?? 2) : 0;
    const lines: string[] = [];

    lines.push('<?xml version="1.0" encoding="UTF-8"?>');
    lines.push(this.valueToXML(data, "result", 0, indent));

    return lines.join("\n");
  }

  /**
   * Convert value to XML element
   */
  private valueToXML(value: unknown, tagName: string, depth: number, indent: number): string {
    const indentation = " ".repeat(depth * indent);

    if (value === null || value === undefined) {
      return `${indentation}<${tagName} />`;
    }

    if (Array.isArray(value)) {
      const lines: string[] = [];
      lines.push(`${indentation}<${tagName}>`);
      for (let i = 0; i < value.length; i++) {
        lines.push(this.valueToXML(value[i], "item", depth + 1, indent));
      }
      lines.push(`${indentation}</${tagName}>`);
      return lines.join("\n");
    }

    if (typeof value === "object") {
      const lines: string[] = [];
      lines.push(`${indentation}<${tagName}>`);
      for (const [key, val] of Object.entries(value)) {
        lines.push(this.valueToXML(val, key, depth + 1, indent));
      }
      lines.push(`${indentation}</${tagName}>`);
      return lines.join("\n");
    }

    const escaped = this.escapeXml(String(value));
    return `${indentation}<${tagName}>${escaped}</${tagName}>`;
  }

  /**
   * Escape XML special characters
   */
  private escapeXml(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  /**
   * Format as YAML
   */
  private formatYAML(data: unknown, options: FormatterOptions): string {
    const indent = options.indent ?? 2;
    return this.valueToYAML(data, 0, indent);
  }

  /**
   * Convert value to YAML
   */
  private valueToYAML(value: unknown, depth: number, indent: number): string {
    const indentation = " ".repeat(depth * indent);

    if (value === null || value === undefined) {
      return "null";
    }

    if (typeof value === "boolean") {
      return value ? "true" : "false";
    }

    if (typeof value === "number") {
      return String(value);
    }

    if (typeof value === "string") {
      // Check if string needs quoting
      if (
        value.includes("\n") ||
        value.includes(":") ||
        value.includes("#") ||
        value.includes("[") ||
        value.includes("]") ||
        value.includes("{") ||
        value.includes("}")
      ) {
        return JSON.stringify(value);
      }
      return value;
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        return "[]";
      }
      const lines: string[] = [];
      for (const item of value) {
        const itemYaml = this.valueToYAML(item, depth + 1, indent);
        if (itemYaml.includes("\n")) {
          lines.push(`${indentation}- `);
          lines.push(itemYaml.split("\n").map((line) => `${indentation}  ${line}`).join("\n"));
        } else {
          lines.push(`${indentation}- ${itemYaml}`);
        }
      }
      return lines.join("\n");
    }

    if (typeof value === "object") {
      const entries = Object.entries(value);
      if (entries.length === 0) {
        return "{}";
      }
      const lines: string[] = [];
      for (const [key, val] of entries) {
        const valYaml = this.valueToYAML(val, depth + 1, indent);
        if (valYaml.includes("\n")) {
          lines.push(`${indentation}${key}:`);
          lines.push(valYaml.split("\n").map((line) => `${" ".repeat(indent)}${line}`).join("\n"));
        } else {
          lines.push(`${indentation}${key}: ${valYaml}`);
        }
      }
      return lines.join("\n");
    }

    return String(value);
  }

  /**
   * Format as newline-delimited JSON stream
   */
  private formatStream(data: unknown, _options: FormatterOptions): string {
    if (!Array.isArray(data)) {
      return JSON.stringify(data);
    }

    return data.map((item) => JSON.stringify(item)).join("\n");
  }

  /**
   * Convert value to string representation
   */
  private stringifyValue(value: unknown): string {
    if (value === null) return "NULL";
    if (value === undefined) return "undefined";
    if (typeof value === "string") return value;
    if (typeof value === "number") return String(value);
    if (typeof value === "boolean") return value ? "true" : "false";
    if (Array.isArray(value)) return `[${value.length} items]`;
    if (typeof value === "object") return `{${Object.keys(value).length} keys}`;
    return String(value);
  }

  /**
   * Get supported output formats
   */
  getSupportedFormats(): OutputFormat[] {
    return ["JSON", "TABLE", "CSV", "HTML", "XML", "YAML", "STREAM"];
  }
}
