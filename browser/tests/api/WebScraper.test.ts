/**
 * WebScraper Unit Tests
 *
 * Tests for the WebScraper API including extraction rules,
 * table/list extraction, link/image extraction, and pagination.
 */

import { assert, assertEquals, assertExists } from "@std/assert";
import {
  ExtractedImage,
  ExtractedLink,
  ExtractionRule,
  ListConfig,
  PaginationConfig,
  ScrapeConfig,
  TableConfig,
  WebScraper,
} from "../../src/api/WebScraper.ts";
import { BrowserPage, DOMElement } from "../../src/api/BrowserPage.ts";

// ============================================================================
// TEST UTILITIES
// ============================================================================

/**
 * Create a mock BrowserPage for testing
 */
function createMockPage(overrides: Partial<BrowserPage> = {}): BrowserPage {
  return {
    query: async (_selector: string, _type?: string) => [],
    click: async (_selector: string, _type?: string) => {},
    type: async (_selector: string, _text: string, _options?: { delay?: number }) => {},
    evaluate: async (_script: string) => ({}),
    getCurrentURL: () => "https://example.com",
    wait: async (
      _options: { type: string; selector?: string; timeout?: number; duration?: number },
    ) => {},
    navigate: async (_url: string, _options?: { waitFor?: string; timeout?: number }) => {},
    ...overrides,
  } as BrowserPage;
}

/**
 * Mock internal element for containment checking
 */
interface MockInternalElement {
  children: MockInternalElement[];
  contains(other: MockInternalElement): boolean;
}

/**
 * Create a mock internal element that supports containment checking
 */
function createMockInternalElement(children: MockInternalElement[] = []): MockInternalElement {
  const element: MockInternalElement = {
    children,
    contains(other: MockInternalElement): boolean {
      if (other === element) return true;
      for (const child of element.children) {
        if (child === other || child.contains(other)) return true;
      }
      return false;
    },
  };
  return element;
}

/**
 * Create a mock DOMElement with text and attributes
 */
function createMockElement(
  textContent: string = "",
  attributes: Record<string, string | null> = {},
  properties: Record<string, unknown> = {},
  internalElement?: MockInternalElement,
): DOMElement {
  const internal = internalElement ?? createMockInternalElement();
  return {
    element: internal,
    getAttribute: async (name: string) => attributes[name] ?? null,
    getProperty: async (name: string) => {
      if (name === "textContent") return textContent;
      if (name === "innerHTML") return properties.innerHTML ?? textContent;
      if (name === "tagName") return properties.tagName ?? "DIV";
      return properties[name] ?? null;
    },
    getText: async () => textContent,
    click: async () => {},
    type: async (_text: string) => {},
    getInternalElement: () => internal,
  } as unknown as DOMElement;
}

// ============================================================================
// Constructor Tests
// ============================================================================

Deno.test({
  name: "WebScraper - constructor creates instance",
  fn() {
    const page = createMockPage();
    const scraper = new WebScraper(page);
    assertExists(scraper);
  },
});

Deno.test({
  name: "WebScraper - getCurrentUrl returns page URL",
  fn() {
    const page = createMockPage({
      getCurrentURL: () => "https://example.com/page",
    });
    const scraper = new WebScraper(page);
    assertEquals(scraper.getCurrentUrl(), "https://example.com/page");
  },
});

// ============================================================================
// extractByRule Tests (via scrape())
// ============================================================================

Deno.test({
  name: "WebScraper - extracts text content from elements",
  async fn() {
    const mockElement = createMockElement("Hello World");
    const rootElement = createMockElement("", {}, { tagName: "HTML" });
    const page = createMockPage({
      query: async (selector: string) => {
        if (selector === "html") return [rootElement];
        if (selector === ".content") return [mockElement];
        return [];
      },
    });

    const scraper = new WebScraper(page);
    const result = await scraper.scrape({
      rules: [
        { name: "text", selector: ".content", extract: "text" },
      ],
    });

    assert(result.success);
    assertEquals((result.data as Record<string, unknown>).text, "Hello World");
  },
});

Deno.test({
  name: "WebScraper - extracts HTML content from elements",
  async fn() {
    const mockElement = createMockElement("", {}, { innerHTML: "<b>Bold</b> text" });
    const rootElement = createMockElement("", {}, { tagName: "HTML" });
    const page = createMockPage({
      query: async (selector: string) => {
        if (selector === "html") return [rootElement];
        if (selector === ".content") return [mockElement];
        return [];
      },
    });

    const scraper = new WebScraper(page);
    const result = await scraper.scrape({
      rules: [
        { name: "html", selector: ".content", extract: "html" },
      ],
    });

    assert(result.success);
    assertEquals((result.data as Record<string, unknown>).html, "<b>Bold</b> text");
  },
});

Deno.test({
  name: "WebScraper - extracts attribute from elements",
  async fn() {
    const mockElement = createMockElement("", { href: "https://example.com" });
    const rootElement = createMockElement("", {}, { tagName: "HTML" });
    const page = createMockPage({
      query: async (selector: string) => {
        if (selector === "html") return [rootElement];
        if (selector === "a.link") return [mockElement];
        return [];
      },
    });

    const scraper = new WebScraper(page);
    const result = await scraper.scrape({
      rules: [
        { name: "link", selector: "a.link", extract: "attribute", attribute: "href" },
      ],
    });

    assert(result.success);
    assertEquals((result.data as Record<string, unknown>).link, "https://example.com");
  },
});

Deno.test({
  name: "WebScraper - extracts property from elements",
  async fn() {
    const mockElement = createMockElement("", {}, { value: "input value" });
    const rootElement = createMockElement("", {}, { tagName: "HTML" });
    const page = createMockPage({
      query: async (selector: string) => {
        if (selector === "html") return [rootElement];
        if (selector === "input") return [mockElement];
        return [];
      },
    });

    const scraper = new WebScraper(page);
    const result = await scraper.scrape({
      rules: [
        { name: "inputValue", selector: "input", extract: "property", property: "value" },
      ],
    });

    assert(result.success);
    assertEquals((result.data as Record<string, unknown>).inputValue, "input value");
  },
});

Deno.test({
  name: "WebScraper - extracts count of elements",
  async fn() {
    const mockElements = [
      createMockElement("Item 1"),
      createMockElement("Item 2"),
      createMockElement("Item 3"),
    ];
    const rootElement = createMockElement("", {}, { tagName: "HTML" });
    const page = createMockPage({
      query: async (selector: string) => {
        if (selector === "html") return [rootElement];
        if (selector === ".item") return mockElements;
        return [];
      },
    });

    const scraper = new WebScraper(page);
    const result = await scraper.scrape({
      rules: [
        { name: "itemCount", selector: ".item", extract: "count" },
      ],
    });

    assert(result.success);
    assertEquals((result.data as Record<string, unknown>).itemCount, "3");
  },
});

Deno.test({
  name: "WebScraper - extracts multiple values when multiple is true",
  async fn() {
    const mockElements = [
      createMockElement("First"),
      createMockElement("Second"),
      createMockElement("Third"),
    ];
    const rootElement = createMockElement("", {}, { tagName: "HTML" });
    const page = createMockPage({
      query: async (selector: string) => {
        if (selector === "html") return [rootElement];
        if (selector === ".item") return mockElements;
        return [];
      },
    });

    const scraper = new WebScraper(page);
    const result = await scraper.scrape({
      rules: [
        { name: "items", selector: ".item", extract: "text", multiple: true },
      ],
    });

    assert(result.success);
    const items = (result.data as Record<string, unknown>).items as string[];
    assertEquals(items.length, 3);
    assertEquals(items[0], "First");
    assertEquals(items[1], "Second");
    assertEquals(items[2], "Third");
  },
});

Deno.test({
  name: "WebScraper - handles required fields that are missing",
  async fn() {
    const page = createMockPage({
      query: async (selector: string) => {
        if (selector === "html") return [createMockElement()];
        return [];
      },
    });

    const scraper = new WebScraper(page);
    const result = await scraper.scrape({
      rules: [
        { name: "required", selector: ".missing", extract: "text", required: true },
      ],
    });

    assertEquals(result.success, false);
    assertExists(result.error);
  },
});

Deno.test({
  name: "WebScraper - uses default value when element not found",
  async fn() {
    const page = createMockPage({
      query: async (selector: string) => {
        if (selector === "html") return [createMockElement()];
        return [];
      },
    });

    const scraper = new WebScraper(page);
    const result = await scraper.scrape({
      rules: [
        { name: "optional", selector: ".missing", extract: "text", defaultValue: "default" },
      ],
    });

    assert(result.success);
    assertEquals((result.data as Record<string, unknown>).optional, "default");
  },
});

Deno.test({
  name: "WebScraper - applies transform function to extracted value",
  async fn() {
    const mockElement = createMockElement("  hello world  ");
    const rootElement = createMockElement("", {}, { tagName: "HTML" });
    const page = createMockPage({
      query: async (selector: string) => {
        if (selector === "html") return [rootElement];
        if (selector === ".content") return [mockElement];
        return [];
      },
    });

    const scraper = new WebScraper(page);
    const result = await scraper.scrape({
      rules: [
        {
          name: "transformed",
          selector: ".content",
          extract: "text",
          transform: (value) => (value as string).trim().toUpperCase(),
        },
      ],
    });

    assert(result.success);
    assertEquals((result.data as Record<string, unknown>).transformed, "HELLO WORLD");
  },
});

// ============================================================================
// Nested Rules Tests
// ============================================================================

Deno.test({
  name: "WebScraper - extracts nested child rules",
  async fn() {
    // Create internal elements with proper parent-child relationships
    const titleInternal = createMockInternalElement();
    const descInternal = createMockInternalElement();
    const cardInternal = createMockInternalElement([titleInternal, descInternal]);

    const childElements = [
      createMockElement("Title", {}, {}, titleInternal),
      createMockElement("Description", {}, {}, descInternal),
    ];
    const cardElement = createMockElement("", {}, { tagName: "DIV" }, cardInternal);
    const rootElement = createMockElement("", {}, { tagName: "HTML" });
    const page = createMockPage({
      query: async (selector: string) => {
        if (selector === "html") return [rootElement];
        if (selector === ".card") return [cardElement];
        if (selector === ".card .title") return [childElements[0]];
        if (selector === ".card .desc") return [childElements[1]];
        return [];
      },
    });

    const scraper = new WebScraper(page);
    const result = await scraper.scrape({
      rules: [
        {
          name: "card",
          selector: ".card",
          extract: "text",
          children: [
            { name: "title", selector: ".card .title", extract: "text" },
            { name: "description", selector: ".card .desc", extract: "text" },
          ],
        },
      ],
    });

    assert(result.success);
    const cardData = (result.data as Record<string, unknown>).card as Record<string, unknown>;
    assertExists(cardData);
    assertEquals(cardData.title, "Title");
    assertEquals(cardData.description, "Description");
  },
});

// ============================================================================
// extractTable Tests
// ============================================================================

Deno.test({
  name: "WebScraper - extracts table with custom headers",
  async fn() {
    const rows = [
      createMockElement("", {}, { tagName: "TR" }),
      createMockElement("", {}, { tagName: "TR" }),
    ];
    const cells = [
      createMockElement("John"),
      createMockElement("30"),
      createMockElement("Jane"),
      createMockElement("25"),
    ];

    const page = createMockPage({
      query: async (selector: string) => {
        if (selector === "table") return [createMockElement("", {}, { tagName: "TABLE" })];
        if (selector === "table tr") return rows;
        if (selector.includes("nth-child(1) td")) return [cells[0], cells[1]];
        if (selector.includes("nth-child(2) td")) return [cells[2], cells[3]];
        return [];
      },
    });

    const scraper = new WebScraper(page);
    const result = await scraper.extractTable({
      selector: "table",
      headers: ["Name", "Age"],
    });

    assert(result.success);
    const tableData = result.data as Record<string, string>[];
    assertEquals(tableData.length, 2);
    assertEquals(tableData[0].Name, "John");
    assertEquals(tableData[0].Age, "30");
  },
});

Deno.test({
  name: "WebScraper - extracts table with firstRowAsHeaders",
  async fn() {
    const rows = [
      createMockElement("", {}, { tagName: "TR" }),
      createMockElement("", {}, { tagName: "TR" }),
    ];
    const headerCells = [createMockElement("Name"), createMockElement("Age")];
    const dataCells = [createMockElement("John"), createMockElement("30")];

    const page = createMockPage({
      query: async (selector: string) => {
        if (selector === "table") return [createMockElement("", {}, { tagName: "TABLE" })];
        if (selector === "table tr") return rows;
        if (selector.includes("first-child")) return headerCells;
        if (selector.includes("nth-child(2) td")) return dataCells;
        return [];
      },
    });

    const scraper = new WebScraper(page);
    const result = await scraper.extractTable({
      selector: "table",
      firstRowAsHeaders: true,
    });

    assert(result.success);
    // First row is headers, so data should start from second row
  },
});

Deno.test({
  name: "WebScraper - extractTable with skipRows",
  async fn() {
    const rows = [
      createMockElement("", {}, { tagName: "TR" }),
      createMockElement("", {}, { tagName: "TR" }),
      createMockElement("", {}, { tagName: "TR" }),
    ];
    const cells = [createMockElement("Skipped"), createMockElement("Data")];

    const page = createMockPage({
      query: async (selector: string) => {
        if (selector === "table") return [createMockElement("", {}, { tagName: "TABLE" })];
        if (selector === "table tr") return rows;
        if (selector.includes("nth-child")) return cells;
        return [];
      },
    });

    const scraper = new WebScraper(page);
    const result = await scraper.extractTable({
      selector: "table",
      skipRows: 2,
      headers: ["Column"],
    });

    assert(result.success);
    assertEquals(result.data.length, 1); // Only one row after skipping 2
  },
});

Deno.test({
  name: "WebScraper - extractTable with maxRows limit",
  async fn() {
    const rows = [
      createMockElement("", {}, { tagName: "TR" }),
      createMockElement("", {}, { tagName: "TR" }),
      createMockElement("", {}, { tagName: "TR" }),
      createMockElement("", {}, { tagName: "TR" }),
      createMockElement("", {}, { tagName: "TR" }),
    ];

    const page = createMockPage({
      query: async (selector: string) => {
        if (selector === "table") return [createMockElement("", {}, { tagName: "TABLE" })];
        if (selector === "table tr") return rows;
        if (selector.includes("nth-child")) return [createMockElement("Data")];
        return [];
      },
    });

    const scraper = new WebScraper(page);
    const result = await scraper.extractTable({
      selector: "table",
      maxRows: 3,
      headers: ["Column"],
    });

    assert(result.success);
    assertEquals(result.data.length, 3);
  },
});

Deno.test({
  name: "WebScraper - extractTable returns error when table not found",
  async fn() {
    const page = createMockPage({
      query: async (_selector: string) => [],
    });

    const scraper = new WebScraper(page);
    const result = await scraper.extractTable({
      selector: "table",
    });

    assertEquals(result.success, false);
    assertExists(result.error);
    assert(result.error!.includes("Table not found"));
  },
});

// ============================================================================
// extractList Tests
// ============================================================================

Deno.test({
  name: "WebScraper - extracts list items as text",
  async fn() {
    const listItems = [
      createMockElement("Item 1"),
      createMockElement("Item 2"),
      createMockElement("Item 3"),
    ];

    const page = createMockPage({
      query: async (selector: string) => {
        if (selector === "ul") return [createMockElement()];
        if (selector === "ul li") return listItems;
        return [];
      },
    });

    const scraper = new WebScraper(page);
    const result = await scraper.extractList({
      selector: "ul",
    });

    assert(result.success);
    assertEquals(result.data.length, 3);
    assertEquals((result.data[0] as { text: string }).text, "Item 1");
  },
});

Deno.test({
  name: "WebScraper - extracts list with custom item rules",
  async fn() {
    const listItems = [
      createMockElement("", { "data-id": "1" }),
      createMockElement("", { "data-id": "2" }),
    ];

    const page = createMockPage({
      query: async (selector: string) => {
        if (selector === "ul") return [createMockElement()];
        if (selector === "ul li") return listItems;
        if (selector === ".title") return [createMockElement("Title")];
        return [];
      },
    });

    const scraper = new WebScraper(page);
    const result = await scraper.extractList({
      selector: "ul",
      itemRules: [
        { name: "id", selector: "ul li", extract: "attribute", attribute: "data-id" },
        { name: "title", selector: ".title", extract: "text" },
      ],
    });

    assert(result.success);
    assertEquals(result.data.length, 2);
  },
});

Deno.test({
  name: "WebScraper - extractList with maxItems limit",
  async fn() {
    const listItems = [
      createMockElement("Item 1"),
      createMockElement("Item 2"),
      createMockElement("Item 3"),
      createMockElement("Item 4"),
      createMockElement("Item 5"),
    ];

    const page = createMockPage({
      query: async (selector: string) => {
        if (selector === "ul") return [createMockElement()];
        if (selector === "ul li") return listItems;
        return [];
      },
    });

    const scraper = new WebScraper(page);
    const result = await scraper.extractList({
      selector: "ul",
      maxItems: 3,
    });

    assert(result.success);
    assertEquals(result.data.length, 3);
  },
});

Deno.test({
  name: "WebScraper - extractList returns error when container not found",
  async fn() {
    const page = createMockPage({
      query: async (_selector: string) => [],
    });

    const scraper = new WebScraper(page);
    const result = await scraper.extractList({
      selector: "ul",
    });

    assertEquals(result.success, false);
    assertExists(result.error);
    assert(result.error!.includes("container not found"));
  },
});

// ============================================================================
// extractLinks Tests
// ============================================================================

Deno.test({
  name: "WebScraper - extracts link href, text, and attributes",
  async fn() {
    const links = [
      createMockElement("Link Text", {
        href: "https://example.com/page",
        title: "Link Title",
        target: "_blank",
        rel: "noopener",
      }),
    ];

    const page = createMockPage({
      getCurrentURL: () => "https://example.com",
      query: async (_selector: string) => links,
    });

    const scraper = new WebScraper(page);
    const result = await scraper.extractLinks();

    assert(result.success);
    const linkData = result.data as ExtractedLink[];
    assertEquals(linkData.length, 1);
    assertEquals(linkData[0].text, "Link Text");
    assertEquals(linkData[0].href, "https://example.com/page");
    assertEquals(linkData[0].title, "Link Title");
    assertEquals(linkData[0].target, "_blank");
    assertEquals(linkData[0].rel, "noopener");
  },
});

Deno.test({
  name: "WebScraper - detects external links correctly",
  async fn() {
    const links = [
      createMockElement("Internal", { href: "/internal" }),
      createMockElement("External", { href: "https://other.com/page" }),
    ];

    const page = createMockPage({
      getCurrentURL: () => "https://example.com",
      query: async (_selector: string) => links,
    });

    const scraper = new WebScraper(page);
    const result = await scraper.extractLinks();

    assert(result.success);
    const linkData = result.data as ExtractedLink[];
    assertEquals(linkData.length, 2);
    assertEquals(linkData[0].isExternal, false);
    assertEquals(linkData[1].isExternal, true);
  },
});

Deno.test({
  name: "WebScraper - extractLinks with custom selector",
  async fn() {
    const links = [createMockElement("Nav Link", { href: "/nav" })];

    const page = createMockPage({
      getCurrentURL: () => "https://example.com",
      query: async (selector: string) => {
        if (selector === "nav a") return links;
        return [];
      },
    });

    const scraper = new WebScraper(page);
    const result = await scraper.extractLinks("nav a");

    assert(result.success);
    const linkData = result.data as ExtractedLink[];
    assertEquals(linkData.length, 1);
    assertEquals(linkData[0].text, "Nav Link");
  },
});

Deno.test({
  name: "WebScraper - extractLinks handles invalid URLs gracefully",
  async fn() {
    const links = [
      createMockElement("JavaScript", { href: "javascript:void(0)" }),
      createMockElement("Mailto", { href: "mailto:test@example.com" }),
    ];

    const page = createMockPage({
      getCurrentURL: () => "https://example.com",
      query: async (_selector: string) => links,
    });

    const scraper = new WebScraper(page);
    const result = await scraper.extractLinks();

    assert(result.success);
    assertEquals(result.data.length, 2);
  },
});

// ============================================================================
// extractImages Tests
// ============================================================================

Deno.test({
  name: "WebScraper - extracts image src, alt, and attributes",
  async fn() {
    const images = [
      createMockElement("", {
        src: "https://example.com/image.jpg",
        alt: "Image Alt Text",
        title: "Image Title",
        width: "800",
        height: "600",
        loading: "lazy",
      }),
    ];

    const page = createMockPage({
      query: async (_selector: string) => images,
    });

    const scraper = new WebScraper(page);
    const result = await scraper.extractImages();

    assert(result.success);
    const imageData = result.data as ExtractedImage[];
    assertEquals(imageData.length, 1);
    assertEquals(imageData[0].src, "https://example.com/image.jpg");
    assertEquals(imageData[0].alt, "Image Alt Text");
    assertEquals(imageData[0].title, "Image Title");
    assertEquals(imageData[0].width, "800");
    assertEquals(imageData[0].height, "600");
    assertEquals(imageData[0].loading, "lazy");
  },
});

Deno.test({
  name: "WebScraper - extractImages with custom selector",
  async fn() {
    const images = [createMockElement("", { src: "/gallery/photo.png" })];

    const page = createMockPage({
      query: async (selector: string) => {
        if (selector === ".gallery img") return images;
        return [];
      },
    });

    const scraper = new WebScraper(page);
    const result = await scraper.extractImages(".gallery img");

    assert(result.success);
    const imageData = result.data as ExtractedImage[];
    assertEquals(imageData.length, 1);
    assertEquals(imageData[0].src, "/gallery/photo.png");
  },
});

Deno.test({
  name: "WebScraper - extractImages handles missing attributes",
  async fn() {
    const images = [createMockElement("", { src: "/image.jpg" })];

    const page = createMockPage({
      query: async (_selector: string) => images,
    });

    const scraper = new WebScraper(page);
    const result = await scraper.extractImages();

    assert(result.success);
    const imageData = result.data as ExtractedImage[];
    assertEquals(imageData[0].src, "/image.jpg");
    assertEquals(imageData[0].alt, null);
    assertEquals(imageData[0].title, null);
    assertEquals(imageData[0].width, null);
    assertEquals(imageData[0].height, null);
  },
});

// ============================================================================
// extractText Tests
// ============================================================================

Deno.test({
  name: "WebScraper - extractText returns body text by default",
  async fn() {
    const page = createMockPage({
      query: async (selector: string) => {
        if (selector === "body") {
          return [createMockElement("Page content here")];
        }
        return [];
      },
    });

    const scraper = new WebScraper(page);
    const result = await scraper.extractText();

    assert(result.success);
    assertEquals(result.data, "Page content here");
  },
});

Deno.test({
  name: "WebScraper - extractText with custom selector",
  async fn() {
    const page = createMockPage({
      query: async (selector: string) => {
        if (selector === ".main-content") {
          return [createMockElement("Main content")];
        }
        return [];
      },
    });

    const scraper = new WebScraper(page);
    const result = await scraper.extractText(".main-content");

    assert(result.success);
    assertEquals(result.data, "Main content");
  },
});

Deno.test({
  name: "WebScraper - extractText returns error when element not found",
  async fn() {
    const page = createMockPage({
      query: async (_selector: string) => [],
    });

    const scraper = new WebScraper(page);
    const result = await scraper.extractText(".missing");

    assertEquals(result.success, false);
    assertExists(result.error);
    assert(result.error!.includes("not found"));
  },
});

// ============================================================================
// scrapePaginated Tests
// ============================================================================

Deno.test({
  name: "WebScraper - scrapes single page when no next button",
  async fn() {
    const page = createMockPage({
      getCurrentURL: () => "https://example.com/page1",
      query: async (selector: string) => {
        if (selector === "html") return [createMockElement()];
        if (selector === ".item") return [createMockElement("Item 1")];
        if (selector === ".next") return []; // No next button
        return [];
      },
    });

    const scraper = new WebScraper(page);
    const result = await scraper.scrapePaginated(
      { rules: [{ name: "text", selector: ".item", extract: "text" }] },
      { nextSelector: ".next" },
    );

    assert(result.success);
    assertEquals(result.pageCount, 1);
    assertEquals(result.urls.length, 1);
  },
});

Deno.test({
  name: "WebScraper - respects maxPages limit",
  async fn() {
    let pageNum = 1;
    const page = createMockPage({
      getCurrentURL: () => `https://example.com/page${pageNum}`,
      query: async (selector: string) => {
        if (selector === "html") return [createMockElement()];
        if (selector === ".item") return [createMockElement(`Item ${pageNum}`)];
        if (selector === ".next") return [createMockElement("Next")];
        return [];
      },
      click: async (_selector: string) => {
        pageNum++;
      },
      wait: async (_options: { type: string }) => {},
    });

    const scraper = new WebScraper(page);
    const result = await scraper.scrapePaginated(
      { rules: [{ name: "text", selector: ".item", extract: "text" }] },
      { nextSelector: ".next", maxPages: 3 },
    );

    assert(result.success);
    assertEquals(result.pageCount, 3);
  },
});

Deno.test({
  name: "WebScraper - stops on stopSelector",
  async fn() {
    let pageNum = 1;
    const page = createMockPage({
      getCurrentURL: () => `https://example.com/page${pageNum}`,
      query: async (selector: string) => {
        if (selector === "html") return [createMockElement()];
        if (selector === ".item") return [createMockElement(`Item ${pageNum}`)];
        if (selector === ".next") return [createMockElement("Next")];
        if (selector === ".last-page" && pageNum === 2) return [createMockElement("Last")];
        return [];
      },
      click: async (_selector: string) => {
        pageNum++;
      },
      wait: async (_options: { type: string }) => {},
    });

    const scraper = new WebScraper(page);
    const result = await scraper.scrapePaginated(
      { rules: [{ name: "text", selector: ".item", extract: "text" }] },
      { nextSelector: ".next", stopSelector: ".last-page", maxPages: 10 },
    );

    assertEquals(result.pageCount, 2);
  },
});

Deno.test({
  name: "WebScraper - stops on stopUrlPattern",
  async fn() {
    let pageNum = 1;
    const page = createMockPage({
      getCurrentURL: () =>
        pageNum === 3 ? "https://example.com/last" : `https://example.com/page${pageNum}`,
      query: async (selector: string) => {
        if (selector === "html") return [createMockElement()];
        if (selector === ".item") return [createMockElement(`Item ${pageNum}`)];
        if (selector === ".next") return [createMockElement("Next")];
        return [];
      },
      click: async (_selector: string) => {
        pageNum++;
      },
      wait: async (_options: { type: string }) => {},
    });

    const scraper = new WebScraper(page);
    const result = await scraper.scrapePaginated(
      { rules: [{ name: "text", selector: ".item", extract: "text" }] },
      { nextSelector: ".next", stopUrlPattern: /\/last$/, maxPages: 10 },
    );

    assertEquals(result.pageCount, 3);
  },
});

Deno.test({
  name: "WebScraper - tracks errors per page",
  async fn() {
    let pageNum = 1;
    const page = createMockPage({
      getCurrentURL: () => `https://example.com/page${pageNum}`,
      query: async (selector: string) => {
        if (selector === "html") return [createMockElement("", {}, { tagName: "HTML" })];
        if (selector === ".item" && pageNum === 2) {
          throw new Error("Scrape error");
        }
        if (selector === ".item") return [createMockElement(`Item ${pageNum}`)];
        if (selector === ".next" && pageNum < 3) return [createMockElement("Next")];
        return [];
      },
      click: async (_selector: string) => {
        pageNum++;
      },
      wait: async (_options: { type: string }) => {},
    });

    const scraper = new WebScraper(page);
    const result = await scraper.scrapePaginated(
      { rules: [{ name: "text", selector: ".item", extract: "text", required: true }] },
      { nextSelector: ".next", maxPages: 3 },
    );

    assertEquals(result.success, false); // Has errors
    assertEquals(result.errors.size, 1);
    assert(result.errors.has(2)); // Error on page 2
  },
});

// ============================================================================
// waitForContent Tests
// ============================================================================

Deno.test({
  name: "WebScraper - waitForContent returns true when element found",
  async fn() {
    const page = createMockPage({
      wait: async (_options: { type: string; selector?: string; timeout?: number }) => {
        // Simulates success
      },
    });

    const scraper = new WebScraper(page);
    const result = await scraper.waitForContent(".content");

    assertEquals(result, true);
  },
});

Deno.test({
  name: "WebScraper - waitForContent returns false on timeout",
  async fn() {
    const page = createMockPage({
      wait: async (_options: { type: string; selector?: string; timeout?: number }) => {
        throw new Error("Timeout");
      },
    });

    const scraper = new WebScraper(page);
    const result = await scraper.waitForContent(".missing", 1000);

    assertEquals(result, false);
  },
});

// ============================================================================
// scrape() Configuration Tests
// ============================================================================

Deno.test({
  name: "WebScraper - scrape with root selector extracts from specific element",
  async fn() {
    const rootElement = createMockElement("Root", {}, { tagName: "ARTICLE" });
    const childElement = createMockElement("Child Text");

    const page = createMockPage({
      query: async (selector: string) => {
        if (selector === "article") return [rootElement];
        if (selector === ".title") return [childElement];
        return [];
      },
    });

    const scraper = new WebScraper(page);
    const result = await scraper.scrape({
      rootSelector: "article",
      rules: [
        { name: "title", selector: ".title", extract: "text" },
      ],
    });

    assert(result.success);
  },
});

Deno.test({
  name: "WebScraper - scrape with multiple root elements",
  async fn() {
    const rootElements = [
      createMockElement("", {}, { tagName: "ARTICLE" }),
      createMockElement("", {}, { tagName: "ARTICLE" }),
    ];
    const childElements = [
      createMockElement("Title 1"),
      createMockElement("Title 2"),
    ];
    let titleQueryCount = 0;

    const page = createMockPage({
      query: async (selector: string) => {
        if (selector === "article") return rootElements;
        if (selector === ".title") {
          const el = childElements[titleQueryCount % childElements.length];
          titleQueryCount++;
          return [el];
        }
        return [];
      },
    });

    const scraper = new WebScraper(page);
    const result = await scraper.scrape({
      rootSelector: "article",
      multiple: true,
      rules: [
        { name: "title", selector: ".title", extract: "text" },
      ],
    });

    assert(result.success);
    assertEquals(result.itemCount, 2);
    assert(Array.isArray(result.data));
  },
});

Deno.test({
  name: "WebScraper - scrape returns error when no root elements found",
  async fn() {
    const page = createMockPage({
      query: async (_selector: string) => [],
    });

    const scraper = new WebScraper(page);
    const result = await scraper.scrape({
      rootSelector: ".missing",
      rules: [
        { name: "text", selector: ".content", extract: "text" },
      ],
    });

    assertEquals(result.success, false);
    assertExists(result.error);
    assert(result.error!.includes("No root elements"));
  },
});

Deno.test({
  name: "WebScraper - scrape includes URL and timestamp in result",
  async fn() {
    const page = createMockPage({
      getCurrentURL: () => "https://example.com/page",
      query: async (selector: string) => {
        if (selector === "html") return [createMockElement()];
        return [];
      },
    });

    const scraper = new WebScraper(page);
    const before = new Date();
    const result = await scraper.scrape({
      rules: [],
    });
    const after = new Date();

    assertEquals(result.url, "https://example.com/page");
    assert(result.timestamp >= before);
    assert(result.timestamp <= after);
  },
});

// ============================================================================
// Edge Cases
// ============================================================================

Deno.test({
  name: "WebScraper - handles empty rules array",
  async fn() {
    const page = createMockPage({
      query: async (selector: string) => {
        if (selector === "html") return [createMockElement()];
        return [];
      },
    });

    const scraper = new WebScraper(page);
    const result = await scraper.scrape({
      rules: [],
    });

    assert(result.success);
    assertEquals(result.data, {});
  },
});

Deno.test({
  name: "WebScraper - handles query exception gracefully",
  async fn() {
    const page = createMockPage({
      query: async (_selector: string) => {
        throw new Error("Query failed");
      },
    });

    const scraper = new WebScraper(page);
    const result = await scraper.scrape({
      rules: [{ name: "text", selector: ".content", extract: "text" }],
    });

    assertEquals(result.success, false);
    assertExists(result.error);
    assert(result.error!.includes("Query failed"));
  },
});
