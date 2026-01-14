/**
 * DOM Schema
 * Maps field names to DOM selectors for common page elements
 */

import type { DOMSchemaEntry, SchemaResolutionResult } from "./types.ts";

/**
 * Built-in DOM schema mappings
 * Field name → CSS selector or XPath
 */
const DOM_SCHEMA = new Map<string, DOMSchemaEntry>([
  // Document metadata
  ["title", {
    field: "title",
    selector: "title",
    type: "css",
    extract: "text",
    description: "Document title",
  }],

  ["description", {
    field: "description",
    selector: 'meta[name="description"]',
    type: "css",
    extract: "attr",
    attribute: "content",
    description: "Meta description",
  }],

  ["keywords", {
    field: "keywords",
    selector: 'meta[name="keywords"]',
    type: "css",
    extract: "attr",
    attribute: "content",
    description: "Meta keywords",
  }],

  ["author", {
    field: "author",
    selector: 'meta[name="author"]',
    type: "css",
    extract: "attr",
    attribute: "content",
    description: "Page author",
  }],

  ["canonical", {
    field: "canonical",
    selector: 'link[rel="canonical"]',
    type: "css",
    extract: "attr",
    attribute: "href",
    description: "Canonical URL",
  }],

  // Open Graph metadata
  ["og:title", {
    field: "og:title",
    selector: 'meta[property="og:title"]',
    type: "css",
    extract: "attr",
    attribute: "content",
    description: "Open Graph title",
  }],

  ["og:description", {
    field: "og:description",
    selector: 'meta[property="og:description"]',
    type: "css",
    extract: "attr",
    attribute: "content",
    description: "Open Graph description",
  }],

  ["og:image", {
    field: "og:image",
    selector: 'meta[property="og:image"]',
    type: "css",
    extract: "attr",
    attribute: "content",
    description: "Open Graph image URL",
  }],

  ["og:url", {
    field: "og:url",
    selector: 'meta[property="og:url"]',
    type: "css",
    extract: "attr",
    attribute: "content",
    description: "Open Graph URL",
  }],

  ["og:type", {
    field: "og:type",
    selector: 'meta[property="og:type"]',
    type: "css",
    extract: "attr",
    attribute: "content",
    description: "Open Graph type",
  }],

  ["og:site_name", {
    field: "og:site_name",
    selector: 'meta[property="og:site_name"]',
    type: "css",
    extract: "attr",
    attribute: "content",
    description: "Open Graph site name",
  }],

  // Twitter Card metadata
  ["twitter:card", {
    field: "twitter:card",
    selector: 'meta[name="twitter:card"]',
    type: "css",
    extract: "attr",
    attribute: "content",
    description: "Twitter Card type",
  }],

  ["twitter:title", {
    field: "twitter:title",
    selector: 'meta[name="twitter:title"]',
    type: "css",
    extract: "attr",
    attribute: "content",
    description: "Twitter Card title",
  }],

  ["twitter:description", {
    field: "twitter:description",
    selector: 'meta[name="twitter:description"]',
    type: "css",
    extract: "attr",
    attribute: "content",
    description: "Twitter Card description",
  }],

  ["twitter:image", {
    field: "twitter:image",
    selector: 'meta[name="twitter:image"]',
    type: "css",
    extract: "attr",
    attribute: "content",
    description: "Twitter Card image",
  }],

  // Structured data
  ["schema.org", {
    field: "schema.org",
    selector: 'script[type="application/ld+json"]',
    type: "css",
    extract: "text",
    description: "JSON-LD structured data",
    multiple: true,
  }],

  // Common page elements
  ["h1", {
    field: "h1",
    selector: "h1",
    type: "css",
    extract: "text",
    description: "First h1 heading",
  }],

  ["h2", {
    field: "h2",
    selector: "h2",
    type: "css",
    extract: "text",
    description: "All h2 headings",
    multiple: true,
  }],

  ["links", {
    field: "links",
    selector: "a[href]",
    type: "css",
    extract: "attr",
    attribute: "href",
    description: "All links",
    multiple: true,
  }],

  ["images", {
    field: "images",
    selector: "img[src]",
    type: "css",
    extract: "attr",
    attribute: "src",
    description: "All images",
    multiple: true,
  }],

  ["scripts", {
    field: "scripts",
    selector: "script[src]",
    type: "css",
    extract: "attr",
    attribute: "src",
    description: "External script URLs",
    multiple: true,
  }],

  ["stylesheets", {
    field: "stylesheets",
    selector: 'link[rel="stylesheet"]',
    type: "css",
    extract: "attr",
    attribute: "href",
    description: "Stylesheet URLs",
    multiple: true,
  }],

  // Language and locale
  ["lang", {
    field: "lang",
    selector: "html",
    type: "css",
    extract: "attr",
    attribute: "lang",
    description: "Document language",
  }],

  // Viewport
  ["viewport", {
    field: "viewport",
    selector: 'meta[name="viewport"]',
    type: "css",
    extract: "attr",
    attribute: "content",
    description: "Viewport settings",
  }],

  // Favicon
  ["favicon", {
    field: "favicon",
    selector: 'link[rel="icon"], link[rel="shortcut icon"]',
    type: "css",
    extract: "attr",
    attribute: "href",
    description: "Favicon URL",
  }],
]);

/**
 * Resolve field name to DOM schema entry
 */
export function resolveDOMField(field: string): SchemaResolutionResult {
  const entry = DOM_SCHEMA.get(field.toLowerCase());

  if (!entry) {
    return {
      found: false,
      error: `Unknown DOM field: ${field}`,
    };
  }

  return {
    found: true,
    entry,
  };
}

/**
 * Register custom DOM field
 */
export function registerDOMField(entry: DOMSchemaEntry): void {
  const field = entry.field.toLowerCase();

  if (DOM_SCHEMA.has(field)) {
    throw new Error(`DOM field ${field} is already registered`);
  }

  DOM_SCHEMA.set(field, entry);
}

/**
 * Get all registered DOM fields
 */
export function getAllDOMFields(): string[] {
  return Array.from(DOM_SCHEMA.keys());
}

/**
 * Check if field is registered
 */
export function hasDOMField(field: string): boolean {
  return DOM_SCHEMA.has(field.toLowerCase());
}

/**
 * Get DOM schema entry
 */
export function getDOMSchemaEntry(field: string): DOMSchemaEntry | undefined {
  return DOM_SCHEMA.get(field.toLowerCase());
}

/**
 * Clear all custom DOM fields (keeps built-in fields)
 */
export function clearCustomDOMFields(): void {
  // Store built-in fields
  const builtinFields = new Map(DOM_SCHEMA);

  // Clear all
  DOM_SCHEMA.clear();

  // Restore built-in fields
  for (const [key, value] of builtinFields) {
    DOM_SCHEMA.set(key, value);
  }
}
