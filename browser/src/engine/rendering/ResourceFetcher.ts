/**
 * ResourceFetcher
 *
 * Handles HTML/CSS/image fetching for the rendering pipeline.
 * Extracts resource fetching logic from the monolithic RenderingPipeline.
 */

import type { ByteBuffer } from "../../types/identifiers.ts";
import type { DOMElement, DOMNode } from "../../types/dom.ts";
import { BrowserConsole } from "../logging/BrowserConsole.ts";
import { RequestPipeline, type RequestResult } from "../RequestPipeline.ts";
import { HTMLTokenizer } from "./html-parser/HTMLTokenizer.ts";
import { HTMLTreeBuilder } from "./html-parser/HTMLTreeBuilder.ts";
import { PreloadScanner } from "./html-parser/PreloadScanner.ts";
import { CSSTokenizer } from "./css-parser/CSSTokenizer.ts";
import { CSSParser } from "./css-parser/CSSParser.ts";
import { CSSOM } from "./css-parser/CSSOM.ts";
import { ContentSecurityPolicy } from "../security/ContentSecurityPolicy.ts";
import { ImageDecoder } from "./ImageDecoder.ts";
import type { ResourceInfo } from "../RenderingPipeline.ts";

/**
 * RenderingPipeline Error (re-exported for internal use)
 */
export class ResourceFetchError extends Error {
  constructor(
    message: string,
    public readonly stage: string,
    public override readonly cause?: Error,
  ) {
    super(message);
    this.name = "RenderingPipelineError";
  }
}

/**
 * ResourceFetcher handles all network fetching for the rendering pipeline:
 * - HTML fetching (including special URLs like about:blank, data:)
 * - CSS stylesheet discovery and fetching
 * - Image fetching via PreloadScanner
 * - HTML and CSS parsing
 */
export class ResourceFetcher {
  private logger = new BrowserConsole("ResourceFetcher");
  private requestPipeline: RequestPipeline;
  private resources: ResourceInfo[] = [];
  private csp?: ContentSecurityPolicy;

  constructor(requestPipeline: RequestPipeline) {
    this.requestPipeline = requestPipeline;
  }

  setCSP(csp: ContentSecurityPolicy | undefined): void {
    this.csp = csp;
  }

  getCSP(): ContentSecurityPolicy | undefined {
    return this.csp;
  }

  getResources(): ResourceInfo[] {
    return this.resources;
  }

  clearResources(): void {
    this.resources = [];
  }

  getRequestPipeline(): RequestPipeline {
    return this.requestPipeline;
  }

  /**
   * Fetch HTML from URL
   */
  async fetchHTML(url: string | URL, signal?: AbortSignal): Promise<RequestResult> {
    const urlString = typeof url === "string" ? url : url.toString();

    const specialResponse = this.handleSpecialURL(urlString);
    if (specialResponse) {
      return specialResponse;
    }

    try {
      return await this.requestPipeline.get(url, {
        headers: {
          "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
        signal,
      });
    } catch (error) {
      throw new ResourceFetchError(
        `Failed to fetch HTML: ${error instanceof Error ? error.message : String(error)}`,
        "html-fetch",
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Handle special URLs that don't require network access
   */
  handleSpecialURL(urlString: string): RequestResult | undefined {
    // Handle about: URLs
    if (urlString === "about:blank" || urlString.startsWith("about:")) {
      const emptyHtml = "<!DOCTYPE html><html><head></head><body></body></html>";
      const body = new TextEncoder().encode(emptyHtml) as ByteBuffer;

      return {
        request: {
          id: `req-special-${Date.now()}` as import("../../types/identifiers.ts").RequestID,
          method: "GET",
          url: urlString as import("../../types/identifiers.ts").URLString,
          version: "1.1",
          headers: new Map(),
          createdAt: Date.now(),
        },
        response: {
          id: `req-special-${Date.now()}` as import("../../types/identifiers.ts").RequestID,
          statusCode: 200,
          statusText: "OK",
          version: "1.1",
          headers: new Map([
            ["content-type", "text/html; charset=utf-8"],
            ["content-length", String(body.byteLength)],
          ]),
          body: body,
          receivedAt: Date.now(),
          fromCache: false,
          timings: {
            dnsStart: 0,
            dnsEnd: 0,
            connectStart: 0,
            connectEnd: 0,
            requestStart: 0,
            responseStart: 0,
            responseEnd: 0,
            duration: 0,
          },
        },
        fromCache: false,
        timing: {
          dnsLookup: 0,
          tcpConnection: 0,
          tlsHandshake: 0,
          requestSent: 0,
          firstByte: 0,
          download: 0,
          total: 0,
        },
      };
    }

    // Handle data: URLs
    if (urlString.startsWith("data:")) {
      const dataUrl = urlString;
      const commaIndex = dataUrl.indexOf(",");
      if (commaIndex === -1) {
        return undefined;
      }

      const meta = dataUrl.substring(5, commaIndex);
      const data = dataUrl.substring(commaIndex + 1);

      const isBase64 = meta.endsWith(";base64");
      const mediaType = isBase64 ? meta.slice(0, -7) : meta;
      const contentType = mediaType || "text/plain;charset=US-ASCII";

      let body: ByteBuffer;
      if (isBase64) {
        const binaryString = atob(data);
        const tempBody = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          tempBody[i] = binaryString.charCodeAt(i);
        }
        body = tempBody as ByteBuffer;
      } else {
        body = new TextEncoder().encode(decodeURIComponent(data)) as ByteBuffer;
      }

      return {
        request: {
          id: `req-data-${Date.now()}` as import("../../types/identifiers.ts").RequestID,
          method: "GET",
          url: urlString as import("../../types/identifiers.ts").URLString,
          version: "1.1",
          headers: new Map(),
          createdAt: Date.now(),
        },
        response: {
          id: `req-data-${Date.now()}` as import("../../types/identifiers.ts").RequestID,
          statusCode: 200,
          statusText: "OK",
          version: "1.1",
          headers: new Map([
            ["content-type", contentType],
            ["content-length", String(body.byteLength)],
          ]),
          body: body,
          receivedAt: Date.now(),
          fromCache: false,
          timings: {
            dnsStart: 0,
            dnsEnd: 0,
            connectStart: 0,
            connectEnd: 0,
            requestStart: 0,
            responseStart: 0,
            responseEnd: 0,
            duration: 0,
          },
        },
        fromCache: false,
        timing: {
          dnsLookup: 0,
          tcpConnection: 0,
          tlsHandshake: 0,
          requestSent: 0,
          firstByte: 0,
          download: 0,
          total: 0,
        },
      };
    }

    return undefined;
  }

  /**
   * Parse HTML to DOM
   */
  async parseHTML(html: ByteBuffer): Promise<DOMNode> {
    try {
      const text = new TextDecoder().decode(html);
      const tokenizer = new HTMLTokenizer();
      const tokens = tokenizer.tokenize(text);
      const treeBuilder = new HTMLTreeBuilder();
      return treeBuilder.build(tokens);
    } catch (error) {
      throw new ResourceFetchError(
        `Failed to parse HTML: ${error instanceof Error ? error.message : String(error)}`,
        "html-parse",
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Fetch stylesheets from DOM
   */
  async fetchStylesheets(dom: DOMNode, baseUrl: string | URL): Promise<string[]> {
    const stylesheets: string[] = [];

    try {
      const styleElements = this.findStyleElements(dom);

      for (const element of styleElements) {
        if (element.tagName === "link") {
          const href = element.attributes.get("href");
          if (href) {
            const cssUrl = new URL(href, baseUrl);

            if (this.csp) {
              const pageOrigin = new URL(baseUrl.toString()).origin;
              if (!this.csp.allows("style-src", cssUrl.toString(), pageOrigin)) {
                this.logger.warn(`Blocked stylesheet by CSP: ${cssUrl}`);
                continue;
              }
            }

            const result = await this.requestPipeline.get(cssUrl);

            this.resources.push({
              url: result.request.url,
              type: "css",
              size: result.response.body.byteLength,
              fetchTime: result.timing.total,
              cached: result.fromCache,
            });

            const cssText = new TextDecoder().decode(result.response.body);
            stylesheets.push(cssText);
          }
        } else if (element.tagName === "style") {
          const textContent = this.getTextContent(element);
          if (textContent) {
            stylesheets.push(textContent);
          }
        }
      }

      return stylesheets;
    } catch (error) {
      this.logger.warn("Failed to fetch some stylesheets:", error);
      return stylesheets;
    }
  }

  /**
   * Parse CSS to CSSOM
   */
  async parseCSS(stylesheets: string[]): Promise<CSSOM> {
    try {
      const cssom = new CSSOM();

      for (const css of stylesheets) {
        const tokenizer = new CSSTokenizer();
        const tokens = tokenizer.tokenize(css);
        const parser = new CSSParser();
        const stylesheet = parser.parse(tokens);
        cssom.addStyleSheet(stylesheet);
      }

      return cssom;
    } catch (error) {
      throw new ResourceFetchError(
        `Failed to parse CSS: ${error instanceof Error ? error.message : String(error)}`,
        "css-parse",
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Fetch images discovered by PreloadScanner
   */
  async fetchImages(
    htmlResult: RequestResult,
    url: string | URL,
    signal?: AbortSignal,
  ): Promise<Map<string, import("../../types/dom.ts").CanvasImageSource>> {
    const imageMap = new Map<string, import("../../types/dom.ts").CanvasImageSource>();

    const htmlText = new TextDecoder().decode(htmlResult.response.body);
    const preloadScanner = new PreloadScanner();
    const preloadResources = preloadScanner.scan(htmlText);
    const imageResources = preloadResources.filter((r) => r.type === "image");

    for (const imgResource of imageResources) {
      try {
        const imgUrl = new URL(imgResource.url, url);

        if (this.csp) {
          const pageOrigin = new URL(url.toString()).origin;
          if (!this.csp.allows("img-src", imgUrl.toString(), pageOrigin)) {
            this.logger.warn(`Blocked image by CSP: ${imgUrl}`);
            continue;
          }
        }

        const imgResult = await this.requestPipeline.get(imgUrl, { signal });

        this.resources.push({
          url: imgResult.request.url,
          type: "image",
          size: imgResult.response.body.byteLength,
          fetchTime: imgResult.timing.total,
          cached: imgResult.fromCache,
        });

        const imgData = imgResult.response.body;
        const dims = ImageDecoder.parseImageDimensions(new Uint8Array(imgData));
        try {
          const contentType = imgResult.response.headers?.get("content-type") || "image/png";
          const blob = new Blob([imgData], { type: contentType });
          const bitmap = await createImageBitmap(blob as unknown as ImageBitmapSource);
          imageMap.set(
            imgResource.url,
            bitmap as unknown as import("../../types/dom.ts").CanvasImageSource,
          );
        } catch {
          imageMap.set(imgResource.url, {
            width: dims.width,
            height: dims.height,
            close: () => {},
            _data: imgData,
          } as any);
        }
      } catch {
        // Image fetch failed -- skip silently
      }
    }

    return imageMap;
  }

  /**
   * Get text content from a node
   */
  getTextContent(node: DOMNode): string {
    if (node.nodeType === 3) {
      return node.nodeValue || "";
    }

    let text = "";
    if (node.childNodes) {
      for (const child of node.childNodes) {
        text += this.getTextContent(child);
      }
    }
    return text;
  }

  /**
   * Find style elements in DOM
   */
  findStyleElements(node: DOMNode): DOMElement[] {
    const elements: DOMElement[] = [];

    if (node.nodeType === 1) {
      const element = node as DOMElement;
      if (element.tagName === "link" || element.tagName === "style") {
        elements.push(element);
      }
    }

    if (node.childNodes) {
      for (const child of node.childNodes) {
        elements.push(...this.findStyleElements(child));
      }
    }

    return elements;
  }

  /**
   * Get the document element (html) from a DOM node
   */
  getDocumentElement(dom: DOMNode): DOMNode | null {
    if (dom.nodeType === 1) {
      return dom;
    }

    if (dom.nodeType === 9 && dom.childNodes) {
      for (const child of dom.childNodes) {
        if (child.nodeType === 1) {
          return child;
        }
      }
    }

    return null;
  }
}
