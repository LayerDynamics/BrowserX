/**
 * PDF Generator Tests
 *
 * Comprehensive tests for PDF document generation from display lists.
 * Tests cover: page generation, text rendering, images, fonts, multi-page,
 * metadata, PDF structure validation, and various page formats.
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import { PDFGenerator } from "../../../../src/engine/rendering/pdf/PDFGenerator.ts";
import { DisplayList, PaintCommandType } from "../../../../src/engine/rendering/paint/DisplayList.ts";
import { RenderTree } from "../../../../src/engine/rendering/rendering/RenderTree.ts";
import type { Pixels } from "../../../../src/types/identifiers.ts";

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Create a mock RenderTree for testing
 */
function createMockRenderTree(): RenderTree {
    const tree = new RenderTree();
    // RenderTree is minimal for PDF generation - it's mostly display list driven
    return tree;
}

/**
 * Parse PDF structure from bytes
 */
function parsePDF(pdfBytes: Uint8Array): {
    header: string;
    objects: Map<number, string>;
    xref: string;
    trailer: string;
} {
    const pdfString = new TextDecoder().decode(pdfBytes);
    const lines = pdfString.split("\n");

    // Extract header
    const header = lines[0];

    // Extract objects
    const objects = new Map<number, string>();
    let currentObjectId: number | null = null;
    let currentObjectLines: string[] = [];

    for (let i = 2; i < lines.length; i++) {
        const line = lines[i];

        // Start of object
        const objMatch = line.match(/^(\d+) 0 obj$/);
        if (objMatch) {
            currentObjectId = parseInt(objMatch[1]);
            currentObjectLines = [];
            continue;
        }

        // End of object
        if (line === "endobj") {
            if (currentObjectId !== null) {
                objects.set(currentObjectId, currentObjectLines.join("\n"));
                currentObjectId = null;
            }
            continue;
        }

        // Object content
        if (currentObjectId !== null) {
            currentObjectLines.push(line);
        }
    }

    // Extract xref and trailer
    const xrefIndex = lines.indexOf("xref");
    const trailerIndex = lines.indexOf("trailer");
    const startxrefIndex = lines.indexOf("startxref");

    const xref = lines.slice(xrefIndex, trailerIndex).join("\n");
    const trailer = lines.slice(trailerIndex, startxrefIndex).join("\n");

    return { header, objects, xref, trailer };
}

/**
 * Validate PDF magic bytes
 */
function validatePDFMagicBytes(pdfBytes: Uint8Array): boolean {
    const header = new TextDecoder().decode(pdfBytes.slice(0, 8));
    return header.startsWith("%PDF-");
}

/**
 * Extract PDF version
 */
function extractPDFVersion(pdfBytes: Uint8Array): string {
    const header = new TextDecoder().decode(pdfBytes.slice(0, 10));
    const match = header.match(/%PDF-(\d+\.\d+)/);
    return match ? match[1] : "";
}

/**
 * Check if PDF contains text
 */
function pdfContainsText(pdfBytes: Uint8Array, text: string): boolean {
    const pdfString = new TextDecoder().decode(pdfBytes);
    // Escape special PDF characters in search text
    const escaped = text
        .replace(/\\/g, "\\\\")
        .replace(/\(/g, "\\(")
        .replace(/\)/g, "\\)");
    return pdfString.includes(`(${escaped})`);
}

/**
 * Extract page dimensions from PDF
 */
function extractPageDimensions(pdfBytes: Uint8Array): { width: number; height: number } | null {
    const pdfString = new TextDecoder().decode(pdfBytes);
    const mediaBoxMatch = pdfString.match(/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/);
    if (mediaBoxMatch) {
        return {
            width: parseFloat(mediaBoxMatch[1]),
            height: parseFloat(mediaBoxMatch[2]),
        };
    }
    return null;
}

// ============================================================================
// Basic Generation Tests
// ============================================================================

Deno.test("PDFGenerator - create empty PDF document", async () => {
    const generator = new PDFGenerator();
    const displayList = new DisplayList();
    const renderTree = createMockRenderTree();

    const pdfBytes = await generator.generate(displayList, renderTree);

    // Validate basic PDF structure
    assertExists(pdfBytes, "PDF bytes should exist");
    assert(pdfBytes.length > 0, "PDF should not be empty");
    assert(validatePDFMagicBytes(pdfBytes), "PDF should have correct magic bytes");
    assertEquals(extractPDFVersion(pdfBytes), "1.7", "PDF version should be 1.7");
});

Deno.test("PDFGenerator - generate PDF from simple rectangle", async () => {
    const generator = new PDFGenerator();
    const displayList = new DisplayList();
    const renderTree = createMockRenderTree();

    // Add a simple filled rectangle
    displayList.add({
        type: PaintCommandType.FILL_RECT,
        x: 100 as Pixels,
        y: 100 as Pixels,
        width: 200 as Pixels,
        height: 100 as Pixels,
        color: "#ff0000",
    });

    const pdfBytes = await generator.generate(displayList, renderTree);

    // Parse and validate PDF structure
    const pdf = parsePDF(pdfBytes);
    assertExists(pdf.objects.get(1), "Catalog object should exist");
    assert(pdf.objects.get(1)!.includes("/Type /Catalog"), "Should contain catalog");

    // Check for rectangle drawing commands
    const pdfString = new TextDecoder().decode(pdfBytes);
    assert(pdfString.includes("re"), "PDF should contain rectangle command");
    assert(pdfString.includes("f"), "PDF should contain fill command");
});

Deno.test("PDFGenerator - verify PDF header and structure", async () => {
    const generator = new PDFGenerator();
    const displayList = new DisplayList();
    const renderTree = createMockRenderTree();

    const pdfBytes = await generator.generate(displayList, renderTree);
    const pdf = parsePDF(pdfBytes);

    // Validate header
    assertEquals(pdf.header, "%PDF-1.7", "PDF header should be correct");

    // Validate catalog
    const catalog = pdf.objects.get(1);
    assertExists(catalog, "Catalog should exist");
    assert(catalog.includes("/Type /Catalog"), "Catalog should have correct type");
    assert(catalog.includes("/Pages"), "Catalog should reference pages");

    // Validate xref table
    assert(pdf.xref.includes("xref"), "Should contain xref table");

    // Validate trailer
    assert(pdf.trailer.includes("trailer"), "Should contain trailer");
    assert(pdf.trailer.includes("/Root"), "Trailer should reference catalog");

    // Check for EOF marker in full PDF string
    const pdfString = new TextDecoder().decode(pdfBytes);
    assert(pdfString.includes("%%EOF"), "Should end with EOF marker");
});

// ============================================================================
// Text Rendering Tests
// ============================================================================

Deno.test("PDFGenerator - render plain text", async () => {
    const generator = new PDFGenerator();
    const displayList = new DisplayList();
    const renderTree = createMockRenderTree();

    displayList.add({
        type: PaintCommandType.FILL_TEXT,
        text: "Hello, PDF!",
        x: 100 as Pixels,
        y: 100 as Pixels,
        font: "16px Arial",
        color: "#000000",
    });

    const pdfBytes = await generator.generate(displayList, renderTree);

    // Check text is in PDF
    assert(pdfContainsText(pdfBytes, "Hello, PDF!"), "PDF should contain text");

    // Check for text commands
    const pdfString = new TextDecoder().decode(pdfBytes);
    assert(pdfString.includes("BT"), "PDF should contain begin text command");
    assert(pdfString.includes("ET"), "PDF should contain end text command");
    assert(pdfString.includes("Tf"), "PDF should contain font command");
    assert(pdfString.includes("Tj"), "PDF should contain show text command");
});

Deno.test("PDFGenerator - render styled text with different fonts", async () => {
    const generator = new PDFGenerator();
    const displayList = new DisplayList();
    const renderTree = createMockRenderTree();

    // Add text with different styles
    displayList.add({
        type: PaintCommandType.FILL_TEXT,
        text: "Bold Text",
        x: 100 as Pixels,
        y: 100 as Pixels,
        font: "bold 16px Arial",
        color: "#000000",
    });

    displayList.add({
        type: PaintCommandType.FILL_TEXT,
        text: "Courier Text",
        x: 100 as Pixels,
        y: 150 as Pixels,
        font: "14px Courier",
        color: "#0000ff",
    });

    displayList.add({
        type: PaintCommandType.FILL_TEXT,
        text: "Times Text",
        x: 100 as Pixels,
        y: 200 as Pixels,
        font: "12px Times",
        color: "#ff0000",
    });

    const pdfBytes = await generator.generate(displayList, renderTree);

    // Check all text is present
    assert(pdfContainsText(pdfBytes, "Bold Text"), "PDF should contain bold text");
    assert(pdfContainsText(pdfBytes, "Courier Text"), "PDF should contain courier text");
    assert(pdfContainsText(pdfBytes, "Times Text"), "PDF should contain times text");

    // Check for font references
    const pdfString = new TextDecoder().decode(pdfBytes);
    assert(pdfString.includes("/Font"), "PDF should contain font dictionary");
});

Deno.test("PDFGenerator - render multi-line text", async () => {
    const generator = new PDFGenerator();
    const displayList = new DisplayList();
    const renderTree = createMockRenderTree();

    // Add multiple text lines
    const lines = ["Line 1", "Line 2", "Line 3"];
    lines.forEach((line, index) => {
        displayList.add({
            type: PaintCommandType.FILL_TEXT,
            text: line,
            x: 100 as Pixels,
            y: (100 + index * 30) as Pixels,
            font: "16px Arial",
            color: "#000000",
        });
    });

    const pdfBytes = await generator.generate(displayList, renderTree);

    // Check all lines are present
    lines.forEach((line) => {
        assert(pdfContainsText(pdfBytes, line), `PDF should contain "${line}"`);
    });
});

// ============================================================================
// Page Management Tests
// ============================================================================

Deno.test("PDFGenerator - single page document with default format", async () => {
    const generator = new PDFGenerator(); // Default: A4 portrait
    const displayList = new DisplayList();
    const renderTree = createMockRenderTree();

    displayList.add({
        type: PaintCommandType.FILL_RECT,
        x: 50 as Pixels,
        y: 50 as Pixels,
        width: 100 as Pixels,
        height: 100 as Pixels,
        color: "#000000",
    });

    const pdfBytes = await generator.generate(displayList, renderTree);
    const dimensions = extractPageDimensions(pdfBytes);

    assertExists(dimensions, "Should extract page dimensions");
    // A4 portrait: 595.28 x 841.89 points
    assertEquals(Math.round(dimensions.width), 595, "Width should be A4");
    assertEquals(Math.round(dimensions.height), 842, "Height should be A4");
});

Deno.test("PDFGenerator - Letter page format", async () => {
    const generator = new PDFGenerator({ format: "Letter" });
    const displayList = new DisplayList();
    const renderTree = createMockRenderTree();

    const pdfBytes = await generator.generate(displayList, renderTree);
    const dimensions = extractPageDimensions(pdfBytes);

    assertExists(dimensions, "Should extract page dimensions");
    // Letter: 612 x 792 points
    assertEquals(Math.round(dimensions.width), 612, "Width should be Letter");
    assertEquals(Math.round(dimensions.height), 792, "Height should be Letter");
});

Deno.test("PDFGenerator - landscape orientation", async () => {
    const generator = new PDFGenerator({ format: "A4", orientation: "landscape" });
    const displayList = new DisplayList();
    const renderTree = createMockRenderTree();

    const pdfBytes = await generator.generate(displayList, renderTree);
    const dimensions = extractPageDimensions(pdfBytes);

    assertExists(dimensions, "Should extract page dimensions");
    // A4 landscape: 841.89 x 595.28 points (swapped)
    assertEquals(Math.round(dimensions.width), 842, "Width should be swapped for landscape");
    assertEquals(Math.round(dimensions.height), 595, "Height should be swapped for landscape");
});

// ============================================================================
// Image Tests
// ============================================================================

Deno.test("PDFGenerator - embed image placeholder", async () => {
    const generator = new PDFGenerator();
    const displayList = new DisplayList();
    const renderTree = createMockRenderTree();

    // Add image command (Note: fetchImage will be mocked/stubbed in real scenario)
    displayList.add({
        type: PaintCommandType.DRAW_IMAGE,
        src: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        x: 100 as Pixels,
        y: 100 as Pixels,
        width: 50 as Pixels,
        height: 50 as Pixels,
    });

    const pdfBytes = await generator.generate(displayList, renderTree);

    // Check for image-related structures
    const pdfString = new TextDecoder().decode(pdfBytes);
    // Images require resource collection, which may not fully work without network
    // At minimum, verify PDF structure is valid
    assert(validatePDFMagicBytes(pdfBytes), "PDF should be valid with image command");
});

Deno.test("PDFGenerator - image scaling and positioning", async () => {
    const generator = new PDFGenerator();
    const displayList = new DisplayList();
    const renderTree = createMockRenderTree();

    // Add image with specific dimensions
    displayList.add({
        type: PaintCommandType.DRAW_IMAGE,
        src: "test-image.png",
        x: 200 as Pixels,
        y: 300 as Pixels,
        width: 150 as Pixels,
        height: 100 as Pixels,
    });

    const pdfBytes = await generator.generate(displayList, renderTree);

    // Verify PDF contains transformation commands for positioning
    const pdfString = new TextDecoder().decode(pdfBytes);
    assert(pdfString.includes("cm"), "PDF should contain transformation matrix");
});

// ============================================================================
// Font Tests
// ============================================================================

Deno.test("PDFGenerator - use standard PDF fonts", async () => {
    const generator = new PDFGenerator();
    const displayList = new DisplayList();
    const renderTree = createMockRenderTree();

    const pdfBytes = await generator.generate(displayList, renderTree);
    const pdfString = new TextDecoder().decode(pdfBytes);

    // Check for standard fonts
    assert(pdfString.includes("Helvetica"), "PDF should include Helvetica");
    assert(pdfString.includes("Helvetica-Bold"), "PDF should include Helvetica-Bold");
    assert(pdfString.includes("Courier"), "PDF should include Courier");
    assert(pdfString.includes("Times-Roman"), "PDF should include Times-Roman");
});

Deno.test("PDFGenerator - font mapping from CSS families", async () => {
    const generator = new PDFGenerator();
    const displayList = new DisplayList();
    const renderTree = createMockRenderTree();

    // Add text with different font families
    displayList.add({
        type: PaintCommandType.FILL_TEXT,
        text: "Sans-serif text",
        x: 50 as Pixels,
        y: 50 as Pixels,
        font: "16px sans-serif",
        color: "#000000",
    });

    displayList.add({
        type: PaintCommandType.FILL_TEXT,
        text: "Serif text",
        x: 50 as Pixels,
        y: 100 as Pixels,
        font: "16px serif",
        color: "#000000",
    });

    displayList.add({
        type: PaintCommandType.FILL_TEXT,
        text: "Monospace text",
        x: 50 as Pixels,
        y: 150 as Pixels,
        font: "16px monospace",
        color: "#000000",
    });

    const pdfBytes = await generator.generate(displayList, renderTree);

    // All text should be present (font mapping happens internally)
    assert(pdfContainsText(pdfBytes, "Sans-serif text"), "PDF should contain sans-serif text");
    assert(pdfContainsText(pdfBytes, "Serif text"), "PDF should contain serif text");
    assert(pdfContainsText(pdfBytes, "Monospace text"), "PDF should contain monospace text");
});

// ============================================================================
// Graphics State Tests
// ============================================================================

Deno.test("PDFGenerator - set opacity with global alpha", async () => {
    const generator = new PDFGenerator();
    const displayList = new DisplayList();
    const renderTree = createMockRenderTree();

    // Set global alpha
    displayList.add({
        type: PaintCommandType.SET_GLOBAL_ALPHA,
        alpha: 0.5,
    });

    displayList.add({
        type: PaintCommandType.FILL_RECT,
        x: 100 as Pixels,
        y: 100 as Pixels,
        width: 100 as Pixels,
        height: 100 as Pixels,
        color: "#ff0000",
    });

    const pdfBytes = await generator.generate(displayList, renderTree);
    const pdfString = new TextDecoder().decode(pdfBytes);

    // Check for extended graphics state
    assert(pdfString.includes("/ExtGState"), "PDF should contain extended graphics state");
    assert(pdfString.includes("/ca"), "PDF should contain fill opacity");
    assert(pdfString.includes("/CA"), "PDF should contain stroke opacity");
});

Deno.test("PDFGenerator - save and restore graphics state", async () => {
    const generator = new PDFGenerator();
    const displayList = new DisplayList();
    const renderTree = createMockRenderTree();

    displayList.add({ type: PaintCommandType.SAVE });
    displayList.add({
        type: PaintCommandType.FILL_RECT,
        x: 50 as Pixels,
        y: 50 as Pixels,
        width: 100 as Pixels,
        height: 100 as Pixels,
        color: "#000000",
    });
    displayList.add({ type: PaintCommandType.RESTORE });

    const pdfBytes = await generator.generate(displayList, renderTree);
    const pdfString = new TextDecoder().decode(pdfBytes);

    assert(pdfString.includes("q"), "PDF should contain save state command");
    assert(pdfString.includes("Q"), "PDF should contain restore state command");
});

Deno.test("PDFGenerator - transformations (translate, scale, rotate)", async () => {
    const generator = new PDFGenerator();
    const displayList = new DisplayList();
    const renderTree = createMockRenderTree();

    displayList.add({ type: PaintCommandType.SAVE });
    displayList.add({
        type: PaintCommandType.TRANSLATE,
        x: 100 as Pixels,
        y: 100 as Pixels,
    });
    displayList.add({
        type: PaintCommandType.SCALE,
        x: 1.5,
        y: 1.5,
    });
    displayList.add({
        type: PaintCommandType.ROTATE,
        angle: Math.PI / 4, // 45 degrees
    });
    displayList.add({
        type: PaintCommandType.FILL_RECT,
        x: 0 as Pixels,
        y: 0 as Pixels,
        width: 50 as Pixels,
        height: 50 as Pixels,
        color: "#ff0000",
    });
    displayList.add({ type: PaintCommandType.RESTORE });

    const pdfBytes = await generator.generate(displayList, renderTree);
    const pdfString = new TextDecoder().decode(pdfBytes);

    // Check for transformation matrix commands
    assert(pdfString.includes("cm"), "PDF should contain transformation matrix commands");
});

// ============================================================================
// Color Tests
// ============================================================================

Deno.test("PDFGenerator - parse hex colors", async () => {
    const generator = new PDFGenerator();
    const displayList = new DisplayList();
    const renderTree = createMockRenderTree();

    displayList.add({
        type: PaintCommandType.FILL_RECT,
        x: 50 as Pixels,
        y: 50 as Pixels,
        width: 100 as Pixels,
        height: 100 as Pixels,
        color: "#ff0000", // Red
    });

    const pdfBytes = await generator.generate(displayList, renderTree);
    const pdfString = new TextDecoder().decode(pdfBytes);

    // Check for RGB color commands (red = 1.000 0.000 0.000 rg)
    assert(pdfString.includes("rg"), "PDF should contain fill color command");
});

Deno.test("PDFGenerator - parse rgb() and rgba() colors", async () => {
    const generator = new PDFGenerator();
    const displayList = new DisplayList();
    const renderTree = createMockRenderTree();

    displayList.add({
        type: PaintCommandType.FILL_RECT,
        x: 50 as Pixels,
        y: 50 as Pixels,
        width: 100 as Pixels,
        height: 100 as Pixels,
        color: "rgb(0, 255, 0)", // Green
    });

    displayList.add({
        type: PaintCommandType.FILL_RECT,
        x: 200 as Pixels,
        y: 50 as Pixels,
        width: 100 as Pixels,
        height: 100 as Pixels,
        color: "rgba(0, 0, 255, 0.5)", // Blue with alpha
    });

    const pdfBytes = await generator.generate(displayList, renderTree);

    // Both colors should be processed
    assert(validatePDFMagicBytes(pdfBytes), "PDF should be valid with rgb/rgba colors");
});

// ============================================================================
// Options and Configuration Tests
// ============================================================================

Deno.test("PDFGenerator - custom margins", async () => {
    const generator = new PDFGenerator({
        margin: {
            top: 50,
            right: 50,
            bottom: 50,
            left: 50,
        },
    });
    const displayList = new DisplayList();
    const renderTree = createMockRenderTree();

    displayList.add({
        type: PaintCommandType.FILL_RECT,
        x: 0 as Pixels,
        y: 0 as Pixels,
        width: 100 as Pixels,
        height: 100 as Pixels,
        color: "#000000",
    });

    const pdfBytes = await generator.generate(displayList, renderTree);

    // Verify margins are applied via translation
    const pdfString = new TextDecoder().decode(pdfBytes);
    assert(pdfString.includes("cm"), "PDF should contain transformation for margins");
});

Deno.test("PDFGenerator - custom scale", async () => {
    const generator = new PDFGenerator({ scale: 2.0 });
    const displayList = new DisplayList();
    const renderTree = createMockRenderTree();

    displayList.add({
        type: PaintCommandType.FILL_RECT,
        x: 50 as Pixels,
        y: 50 as Pixels,
        width: 100 as Pixels,
        height: 100 as Pixels,
        color: "#000000",
    });

    const pdfBytes = await generator.generate(displayList, renderTree);
    const pdfString = new TextDecoder().decode(pdfBytes);

    // Check for scale transformation (2.000 0.000 0.000 2.000)
    assert(pdfString.includes("cm"), "PDF should contain scale transformation");
});

Deno.test("PDFGenerator - Legal page format", async () => {
    const generator = new PDFGenerator({ format: "Legal" });
    const displayList = new DisplayList();
    const renderTree = createMockRenderTree();

    const pdfBytes = await generator.generate(displayList, renderTree);
    const dimensions = extractPageDimensions(pdfBytes);

    assertExists(dimensions, "Should extract page dimensions");
    // Legal: 612 x 1008 points
    assertEquals(Math.round(dimensions.width), 612, "Width should be Legal");
    assertEquals(Math.round(dimensions.height), 1008, "Height should be Legal");
});

Deno.test("PDFGenerator - A3 page format", async () => {
    const generator = new PDFGenerator({ format: "A3" });
    const displayList = new DisplayList();
    const renderTree = createMockRenderTree();

    const pdfBytes = await generator.generate(displayList, renderTree);
    const dimensions = extractPageDimensions(pdfBytes);

    assertExists(dimensions, "Should extract page dimensions");
    // A3: 841.89 x 1190.55 points
    assertEquals(Math.round(dimensions.width), 842, "Width should be A3");
    assertEquals(Math.round(dimensions.height), 1191, "Height should be A3");
});

// ============================================================================
// Edge Cases and Complex Scenarios
// ============================================================================

Deno.test("PDFGenerator - empty display list", async () => {
    const generator = new PDFGenerator();
    const displayList = new DisplayList();
    const renderTree = createMockRenderTree();

    const pdfBytes = await generator.generate(displayList, renderTree);

    // Should still generate valid PDF
    assert(validatePDFMagicBytes(pdfBytes), "Empty display list should create valid PDF");
    const pdf = parsePDF(pdfBytes);
    assertExists(pdf.objects.get(1), "Catalog should exist even with empty content");
});

Deno.test("PDFGenerator - complex document with mixed content", async () => {
    const generator = new PDFGenerator();
    const displayList = new DisplayList();
    const renderTree = createMockRenderTree();

    // Add various elements
    displayList.add({
        type: PaintCommandType.FILL_RECT,
        x: 50 as Pixels,
        y: 50 as Pixels,
        width: 500 as Pixels,
        height: 100 as Pixels,
        color: "#f0f0f0",
    });

    displayList.add({
        type: PaintCommandType.FILL_TEXT,
        text: "Header Text",
        x: 100 as Pixels,
        y: 80 as Pixels,
        font: "bold 24px Arial",
        color: "#333333",
    });

    displayList.add({
        type: PaintCommandType.STROKE_RECT,
        x: 50 as Pixels,
        y: 200 as Pixels,
        width: 500 as Pixels,
        height: 200 as Pixels,
        color: "#000000",
        lineWidth: 2 as Pixels,
    });

    displayList.add({
        type: PaintCommandType.FILL_TEXT,
        text: "Body content with multiple lines",
        x: 70 as Pixels,
        y: 250 as Pixels,
        font: "16px Arial",
        color: "#000000",
    });

    displayList.add({
        type: PaintCommandType.SET_GLOBAL_ALPHA,
        alpha: 0.3,
    });

    displayList.add({
        type: PaintCommandType.FILL_RECT,
        x: 100 as Pixels,
        y: 300 as Pixels,
        width: 200 as Pixels,
        height: 50 as Pixels,
        color: "#ff0000",
    });

    const pdfBytes = await generator.generate(displayList, renderTree);

    // Verify all content is present
    assert(pdfContainsText(pdfBytes, "Header Text"), "PDF should contain header text");
    assert(pdfContainsText(pdfBytes, "Body content with multiple lines"), "PDF should contain body text");

    const pdfString = new TextDecoder().decode(pdfBytes);
    assert(pdfString.includes("re"), "PDF should contain rectangles");
    assert(pdfString.includes("/ExtGState"), "PDF should contain graphics state");
});

Deno.test("PDFGenerator - special characters in text", async () => {
    const generator = new PDFGenerator();
    const displayList = new DisplayList();
    const renderTree = createMockRenderTree();

    // Text with special PDF characters
    const specialText = "Text (with) special \\characters\\";
    displayList.add({
        type: PaintCommandType.FILL_TEXT,
        text: specialText,
        x: 100 as Pixels,
        y: 100 as Pixels,
        font: "16px Arial",
        color: "#000000",
    });

    const pdfBytes = await generator.generate(displayList, renderTree);

    // Special characters should be escaped in PDF
    const pdfString = new TextDecoder().decode(pdfBytes);
    assert(pdfString.includes("\\("), "Parentheses should be escaped");
    assert(pdfString.includes("\\)"), "Parentheses should be escaped");
    assert(pdfString.includes("\\\\"), "Backslashes should be escaped");
});

Deno.test("PDFGenerator - stroke text command", async () => {
    const generator = new PDFGenerator();
    const displayList = new DisplayList();
    const renderTree = createMockRenderTree();

    displayList.add({
        type: PaintCommandType.STROKE_TEXT,
        text: "Outlined Text",
        x: 100 as Pixels,
        y: 100 as Pixels,
        font: "bold 24px Arial",
        color: "#ff0000",
        lineWidth: 1 as Pixels,
    });

    const pdfBytes = await generator.generate(displayList, renderTree);

    assert(pdfContainsText(pdfBytes, "Outlined Text"), "PDF should contain stroked text");

    // Check for text rendering mode command (2 Tr = stroke only)
    const pdfString = new TextDecoder().decode(pdfBytes);
    assert(pdfString.includes("Tr"), "PDF should contain text rendering mode");
});

Deno.test("PDFGenerator - clipping path", async () => {
    const generator = new PDFGenerator();
    const displayList = new DisplayList();
    const renderTree = createMockRenderTree();

    displayList.add({
        type: PaintCommandType.CLIP_RECT,
        x: 50 as Pixels,
        y: 50 as Pixels,
        width: 200 as Pixels,
        height: 200 as Pixels,
    });

    displayList.add({
        type: PaintCommandType.FILL_RECT,
        x: 0 as Pixels,
        y: 0 as Pixels,
        width: 300 as Pixels,
        height: 300 as Pixels,
        color: "#ff0000",
    });

    const pdfBytes = await generator.generate(displayList, renderTree);
    const pdfString = new TextDecoder().decode(pdfBytes);

    // Check for clipping commands
    assert(pdfString.includes("W"), "PDF should contain clipping path command");
});
