import { assertEquals, assertExists } from "jsr:@std/assert";
import { ResourceFetcher } from "../../../src/engine/rendering/ResourceFetcher.ts";
import { RequestPipeline } from "../../../src/engine/RequestPipeline.ts";

const testOpts = { sanitizeOps: false, sanitizeResources: false };

Deno.test({
  name: "ResourceFetcher - handleSpecialURL about:blank",
  ...testOpts,
  fn() {
    const rp = new RequestPipeline();
    const fetcher = new ResourceFetcher(rp);
    const result = fetcher.handleSpecialURL("about:blank");
    assertExists(result);
    assertEquals(result.response.statusCode, 200);
    const html = new TextDecoder().decode(result.response.body);
    assertEquals(html.includes("<html>"), true);
    assertEquals(html.includes("<body>"), true);
  },
});

Deno.test({
  name: "ResourceFetcher - handleSpecialURL about:anything",
  ...testOpts,
  fn() {
    const rp = new RequestPipeline();
    const fetcher = new ResourceFetcher(rp);
    const result = fetcher.handleSpecialURL("about:config");
    assertExists(result);
    assertEquals(result.response.statusCode, 200);
  },
});

Deno.test({
  name: "ResourceFetcher - handleSpecialURL data: text",
  ...testOpts,
  fn() {
    const rp = new RequestPipeline();
    const fetcher = new ResourceFetcher(rp);
    const result = fetcher.handleSpecialURL("data:text/html,<h1>Hello</h1>");
    assertExists(result);
    assertEquals(result.response.statusCode, 200);
    const text = new TextDecoder().decode(result.response.body);
    assertEquals(text, "<h1>Hello</h1>");
  },
});

Deno.test({
  name: "ResourceFetcher - handleSpecialURL data: base64",
  ...testOpts,
  fn() {
    const rp = new RequestPipeline();
    const fetcher = new ResourceFetcher(rp);
    const encoded = btoa("Hello World");
    const result = fetcher.handleSpecialURL(`data:text/plain;base64,${encoded}`);
    assertExists(result);
    const text = new TextDecoder().decode(result.response.body);
    assertEquals(text, "Hello World");
  },
});

Deno.test({
  name: "ResourceFetcher - handleSpecialURL invalid data: URL returns undefined",
  ...testOpts,
  fn() {
    const rp = new RequestPipeline();
    const fetcher = new ResourceFetcher(rp);
    const result = fetcher.handleSpecialURL("data:no-comma-here");
    assertEquals(result, undefined);
  },
});

Deno.test({
  name: "ResourceFetcher - handleSpecialURL normal URL returns undefined",
  ...testOpts,
  fn() {
    const rp = new RequestPipeline();
    const fetcher = new ResourceFetcher(rp);
    const result = fetcher.handleSpecialURL("https://example.com");
    assertEquals(result, undefined);
  },
});

Deno.test({
  name: "ResourceFetcher - clearResources",
  ...testOpts,
  fn() {
    const rp = new RequestPipeline();
    const fetcher = new ResourceFetcher(rp);
    fetcher.clearResources();
    assertEquals(fetcher.getResources().length, 0);
  },
});

Deno.test({
  name: "ResourceFetcher - parseHTML basic document",
  ...testOpts,
  async fn() {
    const rp = new RequestPipeline();
    const fetcher = new ResourceFetcher(rp);
    const html = new TextEncoder().encode("<html><body><p>Test</p></body></html>");
    const dom = await fetcher.parseHTML(html as any);
    assertExists(dom);
    assertEquals(dom.nodeType, 9);
  },
});

Deno.test({
  name: "ResourceFetcher - getDocumentElement from document node",
  ...testOpts,
  async fn() {
    const rp = new RequestPipeline();
    const fetcher = new ResourceFetcher(rp);
    const html = new TextEncoder().encode("<html><body></body></html>");
    const dom = await fetcher.parseHTML(html as any);
    const docEl = fetcher.getDocumentElement(dom);
    assertExists(docEl);
    assertEquals(docEl.nodeType, 1);
  },
});

Deno.test({
  name: "ResourceFetcher - findStyleElements",
  ...testOpts,
  async fn() {
    const rp = new RequestPipeline();
    const fetcher = new ResourceFetcher(rp);
    const html = new TextEncoder().encode(
      "<html><head><style>body{color:red}</style></head><body></body></html>",
    );
    const dom = await fetcher.parseHTML(html as any);
    const styles = fetcher.findStyleElements(dom);
    assertEquals(styles.length >= 1, true);
  },
});

Deno.test({
  name: "ResourceFetcher - getTextContent",
  ...testOpts,
  async fn() {
    const rp = new RequestPipeline();
    const fetcher = new ResourceFetcher(rp);
    const html = new TextEncoder().encode("<html><body>Hello World</body></html>");
    const dom = await fetcher.parseHTML(html as any);
    const text = fetcher.getTextContent(dom);
    assertEquals(text.includes("Hello World"), true);
  },
});

Deno.test({
  name: "ResourceFetcher - parseCSS",
  ...testOpts,
  async fn() {
    const rp = new RequestPipeline();
    const fetcher = new ResourceFetcher(rp);
    const cssom = await fetcher.parseCSS(["body { color: red; }", "p { margin: 0; }"]);
    assertExists(cssom);
  },
});

Deno.test({
  name: "ResourceFetcher - CSP set/get",
  ...testOpts,
  fn() {
    const rp = new RequestPipeline();
    const fetcher = new ResourceFetcher(rp);
    assertEquals(fetcher.getCSP(), undefined);
    fetcher.setCSP(undefined);
    assertEquals(fetcher.getCSP(), undefined);
  },
});
