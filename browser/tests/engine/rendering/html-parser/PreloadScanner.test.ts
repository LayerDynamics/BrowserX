/**
 * Tests for Preload Scanner
 * Tests speculative resource discovery for early fetching.
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import {
    PreloadScanner,
    type PreloadResource,
} from "../../../../src/engine/rendering/html-parser/PreloadScanner.ts";

// PreloadResource interface tests

Deno.test({
    name: "PreloadResource - interface structure for stylesheet",
    fn() {
        const resource: PreloadResource = {
            url: "/styles.css",
            type: "stylesheet",
        };
        assertEquals(resource.url, "/styles.css");
        assertEquals(resource.type, "stylesheet");
    },
});

Deno.test({
    name: "PreloadResource - interface structure with as attribute",
    fn() {
        const resource: PreloadResource = {
            url: "/font.woff2",
            type: "font",
            as: "font",
        };
        assertEquals(resource.as, "font");
    },
});

Deno.test({
    name: "PreloadResource - all resource types",
    fn() {
        const types: PreloadResource['type'][] = ['stylesheet', 'script', 'image', 'font', 'fetch'];
        for (const type of types) {
            const resource: PreloadResource = { url: "/test", type };
            assertEquals(resource.type, type);
        }
    },
});

// PreloadScanner constructor tests

Deno.test({
    name: "PreloadScanner - constructor creates scanner",
    fn() {
        const scanner = new PreloadScanner();
        assertExists(scanner);
    },
});

// PreloadScanner.scan tests - stylesheets

Deno.test({
    name: "PreloadScanner - scan finds stylesheet link",
    fn() {
        const scanner = new PreloadScanner();
        const html = '<link rel="stylesheet" href="/styles.css">';
        const resources = scanner.scan(html);

        assertEquals(resources.length, 1);
        assertEquals(resources[0].url, "/styles.css");
        assertEquals(resources[0].type, "stylesheet");
    },
});

Deno.test({
    name: "PreloadScanner - scan finds multiple stylesheets",
    fn() {
        const scanner = new PreloadScanner();
        const html = `
            <link rel="stylesheet" href="/main.css">
            <link rel="stylesheet" href="/theme.css">
            <link rel="stylesheet" href="/print.css">
        `;
        const resources = scanner.scan(html);

        const stylesheets = resources.filter(r => r.type === 'stylesheet');
        assertEquals(stylesheets.length, 3);
        assertEquals(stylesheets[0].url, "/main.css");
        assertEquals(stylesheets[1].url, "/theme.css");
        assertEquals(stylesheets[2].url, "/print.css");
    },
});

Deno.test({
    name: "PreloadScanner - scan handles stylesheet with single quotes",
    fn() {
        const scanner = new PreloadScanner();
        const html = "<link rel='stylesheet' href='/styles.css'>";
        const resources = scanner.scan(html);

        assertEquals(resources.length, 1);
        assertEquals(resources[0].url, "/styles.css");
    },
});

Deno.test({
    name: "PreloadScanner - scan handles stylesheet with extra attributes",
    fn() {
        const scanner = new PreloadScanner();
        const html = '<link rel="stylesheet" type="text/css" media="screen" href="/styles.css">';
        const resources = scanner.scan(html);

        assertEquals(resources.length, 1);
        assertEquals(resources[0].url, "/styles.css");
    },
});

// PreloadScanner.scan tests - preload links

Deno.test({
    name: "PreloadScanner - scan finds preload link with as=font",
    fn() {
        const scanner = new PreloadScanner();
        const html = '<link rel="preload" href="/font.woff2" as="font">';
        const resources = scanner.scan(html);

        assertEquals(resources.length, 1);
        assertEquals(resources[0].url, "/font.woff2");
        assertEquals(resources[0].type, "font");
        assertEquals(resources[0].as, "font");
    },
});

Deno.test({
    name: "PreloadScanner - scan finds preload link with as=script",
    fn() {
        const scanner = new PreloadScanner();
        const html = '<link rel="preload" href="/app.js" as="script">';
        const resources = scanner.scan(html);

        assertEquals(resources.length, 1);
        assertEquals(resources[0].url, "/app.js");
        assertEquals(resources[0].type, "script");
    },
});

Deno.test({
    name: "PreloadScanner - scan finds preload link with as=image",
    fn() {
        const scanner = new PreloadScanner();
        const html = '<link rel="preload" href="/hero.jpg" as="image">';
        const resources = scanner.scan(html);

        assertEquals(resources.length, 1);
        assertEquals(resources[0].type, "image");
    },
});

Deno.test({
    name: "PreloadScanner - scan finds preload link with as=style",
    fn() {
        const scanner = new PreloadScanner();
        const html = '<link rel="preload" href="/style.css" as="style">';
        const resources = scanner.scan(html);

        assertEquals(resources.length, 1);
        assertEquals(resources[0].type, "stylesheet");
    },
});

Deno.test({
    name: "PreloadScanner - scan finds preload link with as=fetch",
    fn() {
        const scanner = new PreloadScanner();
        const html = '<link rel="preload" href="/data.json" as="fetch">';
        const resources = scanner.scan(html);

        assertEquals(resources.length, 1);
        assertEquals(resources[0].type, "fetch");
    },
});

Deno.test({
    name: "PreloadScanner - scan handles unknown as attribute",
    fn() {
        const scanner = new PreloadScanner();
        const html = '<link rel="preload" href="/unknown" as="unknown">';
        const resources = scanner.scan(html);

        assertEquals(resources.length, 1);
        assertEquals(resources[0].type, "fetch"); // defaults to fetch
    },
});

Deno.test({
    name: "PreloadScanner - scan ignores preload without as attribute",
    fn() {
        const scanner = new PreloadScanner();
        const html = '<link rel="preload" href="/test">';
        const resources = scanner.scan(html);

        assertEquals(resources.length, 0);
    },
});

// PreloadScanner.scan tests - scripts

Deno.test({
    name: "PreloadScanner - scan finds script tag",
    fn() {
        const scanner = new PreloadScanner();
        const html = '<script src="/app.js"></script>';
        const resources = scanner.scan(html);

        assertEquals(resources.length, 1);
        assertEquals(resources[0].url, "/app.js");
        assertEquals(resources[0].type, "script");
    },
});

Deno.test({
    name: "PreloadScanner - scan finds multiple scripts",
    fn() {
        const scanner = new PreloadScanner();
        const html = `
            <script src="/vendor.js"></script>
            <script src="/app.js"></script>
            <script src="/analytics.js"></script>
        `;
        const resources = scanner.scan(html);

        const scripts = resources.filter(r => r.type === 'script');
        assertEquals(scripts.length, 3);
    },
});

Deno.test({
    name: "PreloadScanner - scan ignores inline javascript: script",
    fn() {
        const scanner = new PreloadScanner();
        const html = '<script src="javascript:alert(1)"></script>';
        const resources = scanner.scan(html);

        assertEquals(resources.length, 0);
    },
});

Deno.test({
    name: "PreloadScanner - scan ignores data: URL script",
    fn() {
        const scanner = new PreloadScanner();
        const html = '<script src="data:text/javascript,alert(1)"></script>';
        const resources = scanner.scan(html);

        assertEquals(resources.length, 0);
    },
});

Deno.test({
    name: "PreloadScanner - scan handles script with attributes",
    fn() {
        const scanner = new PreloadScanner();
        const html = '<script src="/app.js" defer async></script>';
        const resources = scanner.scan(html);

        assertEquals(resources.length, 1);
        assertEquals(resources[0].url, "/app.js");
    },
});

// PreloadScanner.scan tests - images

Deno.test({
    name: "PreloadScanner - scan finds img tag",
    fn() {
        const scanner = new PreloadScanner();
        const html = '<img src="/photo.jpg">';
        const resources = scanner.scan(html);

        assertEquals(resources.length, 1);
        assertEquals(resources[0].url, "/photo.jpg");
        assertEquals(resources[0].type, "image");
    },
});

Deno.test({
    name: "PreloadScanner - scan finds multiple images",
    fn() {
        const scanner = new PreloadScanner();
        const html = `
            <img src="/hero.jpg">
            <img src="/logo.png">
            <img src="/icon.svg">
        `;
        const resources = scanner.scan(html);

        const images = resources.filter(r => r.type === 'image');
        assertEquals(images.length, 3);
    },
});

Deno.test({
    name: "PreloadScanner - scan ignores data URL image",
    fn() {
        const scanner = new PreloadScanner();
        const html = '<img src="data:image/png;base64,iVBORw0KGgo=">';
        const resources = scanner.scan(html);

        assertEquals(resources.length, 0);
    },
});

Deno.test({
    name: "PreloadScanner - scan handles img with attributes",
    fn() {
        const scanner = new PreloadScanner();
        const html = '<img src="/photo.jpg" alt="Photo" width="100" height="100">';
        const resources = scanner.scan(html);

        assertEquals(resources.length, 1);
        assertEquals(resources[0].url, "/photo.jpg");
    },
});

// PreloadScanner.scan tests - mixed content

Deno.test({
    name: "PreloadScanner - scan finds mixed resources",
    fn() {
        const scanner = new PreloadScanner();
        const html = `
            <link rel="stylesheet" href="/styles.css">
            <script src="/app.js"></script>
            <img src="/logo.png">
        `;
        const resources = scanner.scan(html);

        assertEquals(resources.length, 3);

        const stylesheet = resources.find(r => r.type === 'stylesheet');
        const script = resources.find(r => r.type === 'script');
        const image = resources.find(r => r.type === 'image');

        assertExists(stylesheet);
        assertExists(script);
        assertExists(image);
    },
});

Deno.test({
    name: "PreloadScanner - scan handles empty HTML",
    fn() {
        const scanner = new PreloadScanner();
        const resources = scanner.scan("");

        assertEquals(resources.length, 0);
    },
});

Deno.test({
    name: "PreloadScanner - scan handles HTML with no resources",
    fn() {
        const scanner = new PreloadScanner();
        const html = "<p>Hello world</p><div>Content</div>";
        const resources = scanner.scan(html);

        assertEquals(resources.length, 0);
    },
});

Deno.test({
    name: "PreloadScanner - scan handles real-world HTML",
    fn() {
        const scanner = new PreloadScanner();
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <link rel="stylesheet" href="/main.css">
                <link rel="preload" href="/font.woff2" as="font">
                <script src="/vendor.js"></script>
            </head>
            <body>
                <img src="/logo.png" alt="Logo">
                <script src="/app.js"></script>
            </body>
            </html>
        `;
        const resources = scanner.scan(html);

        assertEquals(resources.length, 5);
    },
});

// PreloadScanner.scanUrls tests

Deno.test({
    name: "PreloadScanner - scanUrls returns URL array",
    fn() {
        const scanner = new PreloadScanner();
        const html = `
            <link rel="stylesheet" href="/styles.css">
            <script src="/app.js"></script>
            <img src="/logo.png">
        `;
        const urls = scanner.scanUrls(html);

        assertEquals(urls.length, 3);
        assert(urls.includes("/styles.css"));
        assert(urls.includes("/app.js"));
        assert(urls.includes("/logo.png"));
    },
});

Deno.test({
    name: "PreloadScanner - scanUrls handles empty HTML",
    fn() {
        const scanner = new PreloadScanner();
        const urls = scanner.scanUrls("");

        assertEquals(urls.length, 0);
    },
});

Deno.test({
    name: "PreloadScanner - scanUrls extracts only URLs",
    fn() {
        const scanner = new PreloadScanner();
        const html = '<link rel="stylesheet" href="/test.css">';
        const urls = scanner.scanUrls(html);

        assertEquals(urls.length, 1);
        assertEquals(urls[0], "/test.css");
    },
});

// Case sensitivity tests

Deno.test({
    name: "PreloadScanner - scan handles uppercase tags",
    fn() {
        const scanner = new PreloadScanner();
        const html = '<LINK REL="stylesheet" HREF="/styles.css">';
        const resources = scanner.scan(html);

        assertEquals(resources.length, 1);
    },
});

Deno.test({
    name: "PreloadScanner - scan handles mixed case",
    fn() {
        const scanner = new PreloadScanner();
        const html = '<Link Rel="Stylesheet" Href="/styles.css">';
        const resources = scanner.scan(html);

        assertEquals(resources.length, 1);
    },
});

// URL formats tests

Deno.test({
    name: "PreloadScanner - scan handles absolute URLs",
    fn() {
        const scanner = new PreloadScanner();
        const html = '<script src="https://cdn.example.com/app.js"></script>';
        const resources = scanner.scan(html);

        assertEquals(resources.length, 1);
        assertEquals(resources[0].url, "https://cdn.example.com/app.js");
    },
});

Deno.test({
    name: "PreloadScanner - scan handles relative URLs",
    fn() {
        const scanner = new PreloadScanner();
        const html = '<img src="../images/photo.jpg">';
        const resources = scanner.scan(html);

        assertEquals(resources.length, 1);
        assertEquals(resources[0].url, "../images/photo.jpg");
    },
});

Deno.test({
    name: "PreloadScanner - scan handles root-relative URLs",
    fn() {
        const scanner = new PreloadScanner();
        const html = '<link rel="stylesheet" href="/assets/styles.css">';
        const resources = scanner.scan(html);

        assertEquals(resources.length, 1);
        assertEquals(resources[0].url, "/assets/styles.css");
    },
});
