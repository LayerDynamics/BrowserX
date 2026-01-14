/**
 * PDF Generator
 *
 * Generates PDF documents from rendered browser content.
 * Implements PDF 1.7 specification for document structure, fonts, images, and vector graphics.
 */

import type { DisplayList } from "../paint/DisplayList.ts";
import type { RenderTree } from "../rendering/RenderTree.ts";
import type { LayoutBox } from "../../../types/rendering.ts";
import { PaintCommandType } from "../../../types/rendering.ts";
import type { ByteBuffer } from "../../../types/identifiers.ts";

/**
 * PDF generation options
 */
export interface PDFOptions {
    format?: "A4" | "Letter" | "Legal" | "A3";
    orientation?: "portrait" | "landscape";
    margin?: {
        top?: number;
        right?: number;
        bottom?: number;
        left?: number;
    };
    scale?: number;
    printBackground?: boolean;
    displayHeaderFooter?: boolean;
    headerTemplate?: string;
    footerTemplate?: string;
}

/**
 * PDF page dimensions (in points, 1 point = 1/72 inch)
 */
const PAGE_FORMATS = {
    A4: { width: 595.28, height: 841.89 }, // 210mm x 297mm
    Letter: { width: 612, height: 792 }, // 8.5" x 11"
    Legal: { width: 612, height: 1008 }, // 8.5" x 14"
    A3: { width: 841.89, height: 1190.55 }, // 297mm x 420mm
};

/**
 * PDF object reference
 */
interface PDFObjectRef {
    id: number;
    generation: number;
}

/**
 * PDF document structure
 */
class PDFDocument {
    private objects: Map<number, string> = new Map();
    private nextObjectId = 1;
    private pages: number[] = [];
    private fonts: Map<string, number> = new Map();
    private images: Map<string, number> = new Map();
    private graphicsStates: Map<string, number> = new Map();

    constructor(private options: Required<PDFOptions>) {}

    /**
     * Add object to PDF and return reference
     */
    addObject(content: string): PDFObjectRef {
        const id = this.nextObjectId++;
        this.objects.set(id, content);
        return { id, generation: 0 };
    }

    /**
     * Add page to document
     */
    addPage(pageRef: PDFObjectRef): void {
        this.pages.push(pageRef.id);
    }

    /**
     * Add font to document
     */
    addFont(name: string): PDFObjectRef {
        if (this.fonts.has(name)) {
            return { id: this.fonts.get(name)!, generation: 0 };
        }

        // Create font dictionary
        const fontContent = `<<
  /Type /Font
  /Subtype /Type1
  /BaseFont /${name}
>>`;

        const ref = this.addObject(fontContent);
        this.fonts.set(name, ref.id);
        return ref;
    }

    /**
     * Add image to document
     */
    async addImage(src: string, imageData: Uint8Array, width: number, height: number): Promise<PDFObjectRef> {
        if (this.images.has(src)) {
            return { id: this.images.get(src)!, generation: 0 };
        }

        // Determine image format and create appropriate XObject
        const isPNG = imageData[0] === 0x89 && imageData[1] === 0x50 && imageData[2] === 0x4E && imageData[3] === 0x47;
        const isJPEG = imageData[0] === 0xFF && imageData[1] === 0xD8;

        let imageContent: string;

        if (isJPEG) {
            // JPEG can be embedded directly with DCTDecode filter
            imageContent = `<<
  /Type /XObject
  /Subtype /Image
  /Width ${width}
  /Height ${height}
  /ColorSpace /DeviceRGB
  /BitsPerComponent 8
  /Filter /DCTDecode
  /Length ${imageData.length}
>>
stream
${new TextDecoder("latin1").decode(imageData)}
endstream`;
        } else if (isPNG) {
            // PNG requires decoding to raw RGB data
            const rawData = await this.decodePNG(imageData);
            imageContent = `<<
  /Type /XObject
  /Subtype /Image
  /Width ${width}
  /Height ${height}
  /ColorSpace /DeviceRGB
  /BitsPerComponent 8
  /Filter /FlateDecode
  /Length ${rawData.length}
>>
stream
${new TextDecoder("latin1").decode(rawData)}
endstream`;
        } else {
            // Assume raw RGB data
            imageContent = `<<
  /Type /XObject
  /Subtype /Image
  /Width ${width}
  /Height ${height}
  /ColorSpace /DeviceRGB
  /BitsPerComponent 8
  /Length ${imageData.length}
>>
stream
${new TextDecoder("latin1").decode(imageData)}
endstream`;
        }

        const ref = this.addObject(imageContent);
        this.images.set(src, ref.id);
        return ref;
    }

    /**
     * Decode PNG to raw RGB data (simplified)
     */
    private async decodePNG(pngData: Uint8Array): Promise<Uint8Array> {
        // For a full implementation, this would parse PNG chunks and decompress IDAT
        // For now, return the data as-is (would need zlib decompression in production)
        // In a real implementation, use a PNG decoder library
        return pngData;
    }

    /**
     * Add extended graphics state (for opacity, blend modes, etc.)
     */
    addGraphicsState(opacity: number, strokeOpacity?: number): PDFObjectRef {
        const key = `GS_${opacity}_${strokeOpacity ?? opacity}`;

        if (this.graphicsStates.has(key)) {
            return { id: this.graphicsStates.get(key)!, generation: 0 };
        }

        // Create extended graphics state dictionary
        const gsContent = `<<
  /Type /ExtGState
  /ca ${opacity.toFixed(3)}
  /CA ${(strokeOpacity ?? opacity).toFixed(3)}
>>`;

        const ref = this.addObject(gsContent);
        this.graphicsStates.set(key, ref.id);
        return ref;
    }

    /**
     * Get all graphics states
     */
    getGraphicsStates(): Map<string, number> {
        return this.graphicsStates;
    }

    /**
     * Get all images
     */
    getImages(): Map<string, number> {
        return this.images;
    }

    /**
     * Generate complete PDF document
     */
    generate(): Uint8Array {
        const lines: string[] = [];

        // PDF header
        lines.push("%PDF-1.7");
        lines.push("%âãÏÓ"); // Binary marker

        // Track byte offsets for xref table
        const offsets: number[] = [0]; // Object 0 is always free
        let currentOffset = lines.join("\n").length + 1;

        // Write all objects
        for (let id = 1; id < this.nextObjectId; id++) {
            offsets.push(currentOffset);
            const content = this.objects.get(id) || "";
            const objectStr = `${id} 0 obj\n${content}\nendobj\n`;
            lines.push(objectStr);
            currentOffset += objectStr.length;
        }

        // Cross-reference table
        const xrefOffset = currentOffset;
        lines.push("xref");
        lines.push(`0 ${this.nextObjectId}`);
        lines.push("0000000000 65535 f ");

        for (let i = 1; i < offsets.length; i++) {
            const offset = offsets[i].toString().padStart(10, "0");
            lines.push(`${offset} 00000 n `);
        }

        // Trailer
        const catalogRef = 1; // Catalog is always object 1
        lines.push("trailer");
        lines.push(`<<
  /Size ${this.nextObjectId}
  /Root ${catalogRef} 0 R
>>`);
        lines.push("startxref");
        lines.push(xrefOffset.toString());
        lines.push("%%EOF");

        // Convert to bytes
        const pdfString = lines.join("\n");
        return new TextEncoder().encode(pdfString);
    }

    /**
     * Create catalog object
     */
    createCatalog(pagesRef: PDFObjectRef): PDFObjectRef {
        const content = `<<
  /Type /Catalog
  /Pages ${pagesRef.id} 0 R
>>`;
        return this.addObject(content);
    }

    /**
     * Create pages object
     */
    createPages(pageRefs: PDFObjectRef[]): PDFObjectRef {
        const kids = pageRefs.map((ref) => `${ref.id} 0 R`).join(" ");
        const content = `<<
  /Type /Pages
  /Kids [${kids}]
  /Count ${pageRefs.length}
>>`;
        return this.addObject(content);
    }

    /**
     * Create page object
     */
    createPage(
        parentRef: PDFObjectRef,
        contentRef: PDFObjectRef,
        width: number,
        height: number,
        resources: string,
    ): PDFObjectRef {
        const content = `<<
  /Type /Page
  /Parent ${parentRef.id} 0 R
  /MediaBox [0 0 ${width.toFixed(2)} ${height.toFixed(2)}]
  /Contents ${contentRef.id} 0 R
  /Resources ${resources}
>>`;
        return this.addObject(content);
    }

    /**
     * Create content stream
     */
    createContentStream(commands: string): PDFObjectRef {
        const content = `<<
  /Length ${commands.length}
>>
stream
${commands}
endstream`;
        return this.addObject(content);
    }

    getOptions(): Required<PDFOptions> {
        return this.options;
    }
}

/**
 * PDF Content Stream Builder
 */
class PDFContentStream {
    private commands: string[] = [];
    private currentFont: string | null = null;
    private currentFontSize: number | null = null;

    /**
     * Set graphics state
     */
    setLineWidth(width: number): void {
        this.commands.push(`${width.toFixed(2)} w`);
    }

    setRGBColor(r: number, g: number, b: number, stroke = false): void {
        const op = stroke ? "RG" : "rg";
        this.commands.push(`${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} ${op}`);
    }

    /**
     * Path construction
     */
    moveTo(x: number, y: number): void {
        this.commands.push(`${x.toFixed(2)} ${y.toFixed(2)} m`);
    }

    lineTo(x: number, y: number): void {
        this.commands.push(`${x.toFixed(2)} ${y.toFixed(2)} l`);
    }

    rectangle(x: number, y: number, width: number, height: number): void {
        this.commands.push(
            `${x.toFixed(2)} ${y.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re`,
        );
    }

    /**
     * Path painting
     */
    stroke(): void {
        this.commands.push("S");
    }

    fill(): void {
        this.commands.push("f");
    }

    fillAndStroke(): void {
        this.commands.push("B");
    }

    /**
     * Text operations
     */
    beginText(): void {
        this.commands.push("BT");
    }

    endText(): void {
        this.commands.push("ET");
    }

    setFont(fontName: string, size: number): void {
        this.currentFont = fontName;
        this.currentFontSize = size;
        this.commands.push(`/${fontName} ${size.toFixed(2)} Tf`);
    }

    setTextPosition(x: number, y: number): void {
        this.commands.push(`${x.toFixed(2)} ${y.toFixed(2)} Td`);
    }

    showText(text: string): void {
        // Escape special characters
        const escaped = text
            .replace(/\\/g, "\\\\")
            .replace(/\(/g, "\\(")
            .replace(/\)/g, "\\)")
            .replace(/\r/g, "\\r")
            .replace(/\n/g, "\\n");

        this.commands.push(`(${escaped}) Tj`);
    }

    /**
     * Graphics state
     */
    saveState(): void {
        this.commands.push("q");
    }

    restoreState(): void {
        this.commands.push("Q");
    }

    /**
     * Transformations
     */
    transform(a: number, b: number, c: number, d: number, e: number, f: number): void {
        this.commands.push(
            `${a.toFixed(3)} ${b.toFixed(3)} ${c.toFixed(3)} ${d.toFixed(3)} ${e.toFixed(2)} ${f.toFixed(2)} cm`,
        );
    }

    translate(x: number, y: number): void {
        this.transform(1, 0, 0, 1, x, y);
    }

    scale(sx: number, sy: number): void {
        this.transform(sx, 0, 0, sy, 0, 0);
    }

    /**
     * Extended graphics state
     */
    setGraphicsState(name: string): void {
        this.commands.push(`/${name} gs`);
    }

    /**
     * Draw XObject (image)
     */
    drawXObject(name: string): void {
        this.commands.push(`/${name} Do`);
    }

    /**
     * Get command string
     */
    getCommands(): string {
        return this.commands.join("\n") + "\n";
    }
}

/**
 * PDF Generator
 */
export class PDFGenerator {
    private options: Required<PDFOptions>;
    private currentShadow: {
        offsetX: number;
        offsetY: number;
        blur: number;
        color: string;
    } | null = null;
    private currentDocument: PDFDocument | null = null;

    constructor(options: PDFOptions = {}) {
        // Set defaults
        this.options = {
            format: options.format || "A4",
            orientation: options.orientation || "portrait",
            margin: {
                top: options.margin?.top ?? 72, // 1 inch
                right: options.margin?.right ?? 72,
                bottom: options.margin?.bottom ?? 72,
                left: options.margin?.left ?? 72,
            },
            scale: options.scale ?? 1.0,
            printBackground: options.printBackground ?? true,
            displayHeaderFooter: options.displayHeaderFooter ?? false,
            headerTemplate: options.headerTemplate ?? "",
            footerTemplate: options.footerTemplate ?? "",
        };
    }

    /**
     * Generate PDF from display list
     */
    async generate(displayList: DisplayList, renderTree: RenderTree): Promise<Uint8Array> {
        const doc = new PDFDocument(this.options);
        this.currentDocument = doc;

        // Get page dimensions
        const format = PAGE_FORMATS[this.options.format];
        let pageWidth = format.width;
        let pageHeight = format.height;

        // Swap for landscape
        if (this.options.orientation === "landscape") {
            [pageWidth, pageHeight] = [pageHeight, pageWidth];
        }

        // Calculate content area (page minus margins)
        const contentWidth = pageWidth - this.options.margin.left! - this.options.margin.right!;
        const contentHeight = pageHeight - this.options.margin.top! - this.options.margin.bottom!;

        // Add standard fonts
        const helveticaRef = doc.addFont("Helvetica");
        const helveticaBoldRef = doc.addFont("Helvetica-Bold");
        const courierRef = doc.addFont("Courier");
        const timesRef = doc.addFont("Times-Roman");

        // Process display list to collect images and create necessary resources
        await this.collectResources(doc, displayList);

        // Build resources dictionary
        let resources = `<<
  /Font <<
    /F1 ${helveticaRef.id} 0 R
    /F2 ${helveticaBoldRef.id} 0 R
    /F3 ${courierRef.id} 0 R
    /F4 ${timesRef.id} 0 R
  >>`;

        // Add graphics states if any
        const graphicsStates = doc.getGraphicsStates();
        if (graphicsStates.size > 0) {
            resources += `\n  /ExtGState <<`;
            let gsIndex = 1;
            for (const [key, objId] of graphicsStates) {
                resources += `\n    /GS${gsIndex} ${objId} 0 R`;
                gsIndex++;
            }
            resources += `\n  >>`;
        }

        // Add images if any
        const images = doc.getImages();
        if (images.size > 0) {
            resources += `\n  /XObject <<`;
            let imgIndex = 1;
            for (const [src, objId] of images) {
                resources += `\n    /Im${imgIndex} ${objId} 0 R`;
                imgIndex++;
            }
            resources += `\n  >>`;
        }

        resources += `\n>>`;

        // Create content stream
        const stream = new PDFContentStream();

        // Apply margin offset
        stream.saveState();
        stream.translate(this.options.margin.left!, this.options.margin.bottom!);

        // Apply scale if specified
        if (this.options.scale !== 1.0) {
            stream.scale(this.options.scale, this.options.scale);
        }

        // Convert display list commands to PDF
        await this.renderDisplayList(stream, displayList, renderTree, contentWidth, contentHeight);

        stream.restoreState();

        // Create page content
        const contentRef = doc.createContentStream(stream.getCommands());

        // Create pages tree (we'll create placeholder first)
        const pagesRef = doc.addObject(""); // Placeholder

        // Create page
        const pageRef = doc.createPage(pagesRef, contentRef, pageWidth, pageHeight, resources);

        // Update pages object with actual page reference
        const pagesContent = `<<
  /Type /Pages
  /Kids [${pageRef.id} 0 R]
  /Count 1
>>`;
        doc["objects"].set(pagesRef.id, pagesContent);

        // Create catalog
        const catalogRef = doc.createCatalog(pagesRef);

        // Ensure catalog is object 1
        if (catalogRef.id !== 1) {
            // Swap objects
            const catalogContent = doc["objects"].get(catalogRef.id)!;
            const firstContent = doc["objects"].get(1);
            doc["objects"].set(1, catalogContent);
            if (firstContent) {
                doc["objects"].set(catalogRef.id, firstContent);
            }
        }

        // Generate final PDF
        return doc.generate();
    }

    /**
     * Collect resources (images, graphics states) from display list
     */
    private async collectResources(doc: PDFDocument, displayList: DisplayList): Promise<void> {
        const commands = displayList.getCommands();
        const imageCache = new Map<string, { data: Uint8Array; width: number; height: number }>();

        for (const command of commands) {
            // Collect images
            if (command.type === PaintCommandType.DRAW_IMAGE) {
                const src = command.src;
                if (!imageCache.has(src)) {
                    try {
                        // Fetch image data
                        const imageData = await this.fetchImage(src);
                        if (imageData) {
                            await doc.addImage(src, imageData.data, imageData.width, imageData.height);
                            imageCache.set(src, imageData);
                        }
                    } catch (error) {
                        console.error(`Failed to load image ${src}:`, error);
                    }
                }
            }

            // Collect graphics states for opacity
            if (command.type === PaintCommandType.SET_GLOBAL_ALPHA) {
                doc.addGraphicsState(command.alpha);
            }
        }
    }

    /**
     * Fetch image data from URL or data URI
     */
    private async fetchImage(src: string): Promise<{ data: Uint8Array; width: number; height: number } | null> {
        try {
            if (src.startsWith("data:")) {
                // Parse data URI
                const match = src.match(/^data:([^;]+);base64,(.+)$/);
                if (match) {
                    const base64Data = match[2];
                    const binaryString = atob(base64Data);
                    const bytes = new Uint8Array(binaryString.length);
                    for (let i = 0; i < binaryString.length; i++) {
                        bytes[i] = binaryString.charCodeAt(i);
                    }

                    // Get image dimensions (simplified - would need proper image decoder)
                    const { width, height } = this.getImageDimensions(bytes);
                    return { data: bytes, width, height };
                }
            } else {
                // Fetch from URL
                const response = await fetch(src);
                const arrayBuffer = await response.arrayBuffer();
                const bytes = new Uint8Array(arrayBuffer);

                const { width, height } = this.getImageDimensions(bytes);
                return { data: bytes, width, height };
            }
        } catch (error) {
            console.error(`Error fetching image ${src}:`, error);
        }

        return null;
    }

    /**
     * Get image dimensions from image data
     */
    private getImageDimensions(imageData: Uint8Array): { width: number; height: number } {
        // PNG dimensions at bytes 16-23
        if (imageData[0] === 0x89 && imageData[1] === 0x50 && imageData[2] === 0x4E && imageData[3] === 0x47) {
            const width = (imageData[16] << 24) | (imageData[17] << 16) | (imageData[18] << 8) | imageData[19];
            const height = (imageData[20] << 24) | (imageData[21] << 16) | (imageData[22] << 8) | imageData[23];
            return { width, height };
        }

        // JPEG dimensions (simplified - scan for SOF markers)
        if (imageData[0] === 0xFF && imageData[1] === 0xD8) {
            let offset = 2;
            while (offset < imageData.length - 8) {
                if (imageData[offset] === 0xFF) {
                    const marker = imageData[offset + 1];
                    // SOF0, SOF1, SOF2 markers
                    if (marker === 0xC0 || marker === 0xC1 || marker === 0xC2) {
                        const height = (imageData[offset + 5] << 8) | imageData[offset + 6];
                        const width = (imageData[offset + 7] << 8) | imageData[offset + 8];
                        return { width, height };
                    }
                    // Skip this segment
                    const segmentLength = (imageData[offset + 2] << 8) | imageData[offset + 3];
                    offset += segmentLength + 2;
                } else {
                    offset++;
                }
            }
        }

        // Default dimensions if unable to detect
        return { width: 100, height: 100 };
    }

    /**
     * Render display list to PDF content stream
     */
    private async renderDisplayList(
        stream: PDFContentStream,
        displayList: DisplayList,
        renderTree: RenderTree,
        pageWidth: number,
        pageHeight: number,
    ): Promise<void> {
        const commands = displayList.getCommands();

        for (const command of commands) {
            switch (command.type) {
                case PaintCommandType.FILL_RECT:
                    this.renderFillRect(stream, command, pageHeight);
                    break;

                case PaintCommandType.STROKE_RECT:
                    this.renderStrokeRect(stream, command, pageHeight);
                    break;

                case PaintCommandType.FILL_TEXT:
                    this.renderFillText(stream, command, pageHeight);
                    break;

                case PaintCommandType.STROKE_TEXT:
                    this.renderStrokeText(stream, command, pageHeight);
                    break;

                case PaintCommandType.DRAW_IMAGE:
                    this.renderImage(stream, command, pageHeight, displayList);
                    break;

                case PaintCommandType.CLIP_RECT:
                    // Clipping path
                    stream.rectangle(
                        command.x,
                        pageHeight - command.y - command.height,
                        command.width,
                        command.height,
                    );
                    stream["commands"].push("W n"); // Clip and end path
                    break;

                case PaintCommandType.SAVE:
                    stream.saveState();
                    break;

                case PaintCommandType.RESTORE:
                    stream.restoreState();
                    break;

                case PaintCommandType.TRANSLATE:
                    stream.translate(command.x, pageHeight - command.y);
                    break;

                case PaintCommandType.SCALE:
                    stream.scale(command.x, command.y);
                    break;

                case PaintCommandType.ROTATE:
                    // Rotation in PDF (radians)
                    const cos = Math.cos(command.angle);
                    const sin = Math.sin(command.angle);
                    stream.transform(cos, sin, -sin, cos, 0, 0);
                    break;

                case PaintCommandType.SET_FILL_STYLE:
                    // Parse and set fill color
                    const fillColor = this.parseColor(command.style);
                    stream.setRGBColor(fillColor.r, fillColor.g, fillColor.b, false);
                    break;

                case PaintCommandType.SET_STROKE_STYLE:
                    // Parse and set stroke color
                    const strokeColor = this.parseColor(command.style);
                    stream.setRGBColor(strokeColor.r, strokeColor.g, strokeColor.b, true);
                    break;

                case PaintCommandType.SET_LINE_WIDTH:
                    stream.setLineWidth(command.width);
                    break;

                case PaintCommandType.SET_GLOBAL_ALPHA:
                    // Set opacity using extended graphics state
                    const gsIndex = this.getGraphicsStateIndex(command.alpha);
                    if (gsIndex !== null) {
                        stream.setGraphicsState(`GS${gsIndex}`);
                    }
                    break;

                case PaintCommandType.SET_FONT:
                    // Font is handled per text command
                    break;

                case PaintCommandType.SET_SHADOW:
                    // Store shadow state for subsequent rendering operations
                    // Shadows are rendered by drawing the shape/text twice with offset
                    this.currentShadow = {
                        offsetX: command.offsetX,
                        offsetY: command.offsetY,
                        blur: command.blur,
                        color: command.color,
                    };
                    break;
            }
        }
    }

    /**
     * Render filled rectangle
     */
    private renderFillRect(
        stream: PDFContentStream,
        command: any,
        pageHeight: number,
    ): void {
        // Parse color from command.color (e.g., "rgb(255, 0, 0)" or "#ff0000")
        const color = this.parseColor(command.color || "#000000");

        stream.saveState();
        stream.setRGBColor(color.r, color.g, color.b, false);

        // Flip Y coordinate (PDF origin is bottom-left)
        const y = pageHeight - command.y - command.height;

        stream.rectangle(command.x, y, command.width, command.height);
        stream.fill();
        stream.restoreState();
    }

    /**
     * Render stroked rectangle
     */
    private renderStrokeRect(
        stream: PDFContentStream,
        command: any,
        pageHeight: number,
    ): void {
        const color = this.parseColor(command.color || "#000000");

        stream.saveState();
        stream.setRGBColor(color.r, color.g, color.b, true);
        stream.setLineWidth(command.lineWidth || 1);

        const y = pageHeight - command.y - command.height;

        stream.rectangle(command.x, y, command.width, command.height);
        stream.stroke();
        stream.restoreState();
    }

    /**
     * Render filled text
     */
    private renderFillText(
        stream: PDFContentStream,
        command: any,
        pageHeight: number,
    ): void {
        const color = this.parseColor(command.color || "#000000");

        stream.saveState();
        stream.setRGBColor(color.r, color.g, color.b, false);

        // Parse font string (e.g., "16px Arial" or "bold 16px Arial")
        const { fontName, fontSize } = this.parseFont(command.font);

        stream.beginText();
        stream.setFont(fontName, fontSize);

        // Flip Y coordinate and adjust for text baseline
        const y = pageHeight - command.y;
        stream.setTextPosition(command.x, y);

        stream.showText(command.text);
        stream.endText();
        stream.restoreState();
    }

    /**
     * Render stroked text
     */
    private renderStrokeText(
        stream: PDFContentStream,
        command: any,
        pageHeight: number,
    ): void {
        const color = this.parseColor(command.color || "#000000");

        stream.saveState();
        stream.setRGBColor(color.r, color.g, color.b, true);
        stream.setLineWidth(command.lineWidth || 1);

        // Parse font string
        const { fontName, fontSize } = this.parseFont(command.font);

        stream.beginText();
        stream.setFont(fontName, fontSize);

        // Flip Y coordinate and adjust for text baseline
        const y = pageHeight - command.y;
        stream.setTextPosition(command.x, y);

        // Set text rendering mode to stroke (2 = stroke only)
        stream["commands"].push("2 Tr");

        stream.showText(command.text);
        stream.endText();
        stream.restoreState();
    }

    /**
     * Parse CSS color to RGB
     */
    private parseColor(color: string): { r: number; g: number; b: number } {
        // Handle hex colors
        if (color.startsWith("#")) {
            const hex = color.slice(1);
            const r = parseInt(hex.slice(0, 2), 16) / 255;
            const g = parseInt(hex.slice(2, 4), 16) / 255;
            const b = parseInt(hex.slice(4, 6), 16) / 255;
            return { r, g, b };
        }

        // Handle rgb() colors
        const rgbMatch = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (rgbMatch) {
            return {
                r: parseInt(rgbMatch[1]) / 255,
                g: parseInt(rgbMatch[2]) / 255,
                b: parseInt(rgbMatch[3]) / 255,
            };
        }

        // Handle rgba() colors
        const rgbaMatch = color.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*[\d.]+\)/);
        if (rgbaMatch) {
            return {
                r: parseInt(rgbaMatch[1]) / 255,
                g: parseInt(rgbaMatch[2]) / 255,
                b: parseInt(rgbaMatch[3]) / 255,
            };
        }

        // Default to black
        return { r: 0, g: 0, b: 0 };
    }

    /**
     * Map CSS font family to PDF standard font
     */
    private mapFontFamily(family: string): string {
        const lowerFamily = family.toLowerCase();

        if (lowerFamily.includes("courier") || lowerFamily.includes("monospace")) {
            return "F3"; // Courier
        }

        if (lowerFamily.includes("times") || lowerFamily.includes("serif")) {
            return "F4"; // Times-Roman
        }

        if (lowerFamily.includes("bold")) {
            return "F2"; // Helvetica-Bold
        }

        // Default to Helvetica (sans-serif)
        return "F1";
    }

    /**
     * Parse CSS font string to extract font name and size
     */
    private parseFont(fontString: string): { fontName: string; fontSize: number } {
        // Font format: "[style] [weight] size[/lineHeight] family"
        // Examples: "16px Arial", "bold 16px Arial", "italic bold 16px/1.5 Arial"

        const parts = fontString.trim().split(/\s+/);
        let fontSize = 12;
        let fontFamily = "sans-serif";

        for (const part of parts) {
            // Check if this part contains a size (ends with px, pt, em, etc.)
            if (/\d+(px|pt|em|rem|%)/.test(part)) {
                // Extract numeric value
                const sizeMatch = part.match(/(\d+(?:\.\d+)?)/);
                if (sizeMatch) {
                    fontSize = parseFloat(sizeMatch[1]);
                }
            } else if (
                !["italic", "oblique", "normal", "bold", "bolder", "lighter", "100", "200", "300", "400", "500", "600", "700", "800", "900"].includes(part.toLowerCase())
            ) {
                // This is likely the font family
                fontFamily = part;
            }
        }

        const fontName = this.mapFontFamily(fontFamily);
        return { fontName, fontSize };
    }

    /**
     * Get graphics state index for opacity
     */
    private getGraphicsStateIndex(opacity: number): number | null {
        if (!this.currentDocument) return null;

        const graphicsStates = this.currentDocument.getGraphicsStates();
        let index = 1;

        for (const [key, objId] of graphicsStates) {
            if (key.startsWith(`GS_${opacity}_`)) {
                return index;
            }
            index++;
        }

        return null;
    }

    /**
     * Get image index for rendering
     */
    private getImageIndex(src: string): number | null {
        if (!this.currentDocument) return null;

        const images = this.currentDocument.getImages();
        let index = 1;

        for (const [imageSrc, objId] of images) {
            if (imageSrc === src) {
                return index;
            }
            index++;
        }

        return null;
    }

    /**
     * Render image
     */
    private renderImage(
        stream: PDFContentStream,
        command: any,
        pageHeight: number,
        displayList: DisplayList,
    ): void {
        const imageIndex = this.getImageIndex(command.src);
        if (imageIndex === null) {
            return; // Image not found
        }

        stream.saveState();

        // Position and scale the image
        // PDF images are 1x1 unit squares that need to be transformed to the desired size
        const y = pageHeight - command.y - command.height;

        // Transform: translate to position, then scale to size
        stream.translate(command.x, y);
        stream.scale(command.width, command.height);

        // Draw the image XObject
        stream.drawXObject(`Im${imageIndex}`);

        stream.restoreState();
    }

    /**
     * Render shadow if active
     */
    private renderShadow(
        stream: PDFContentStream,
        renderFunc: () => void,
    ): void {
        if (!this.currentShadow) {
            // No shadow, just render normally
            renderFunc();
            return;
        }

        // Render shadow first (with offset and shadow color)
        stream.saveState();

        // Parse shadow color and apply
        const shadowColor = this.parseColor(this.currentShadow.color);

        // Apply shadow offset
        stream.translate(this.currentShadow.offsetX, -this.currentShadow.offsetY);

        // Set shadow color with reduced opacity for blur effect
        const blurOpacity = Math.max(0.1, 1 - (this.currentShadow.blur / 20));
        stream.setRGBColor(shadowColor.r, shadowColor.g, shadowColor.b, false);

        // If blur is significant, render multiple times with slight offsets for blur effect
        if (this.currentShadow.blur > 0) {
            const blurSteps = Math.min(5, Math.ceil(this.currentShadow.blur / 2));
            for (let i = 0; i < blurSteps; i++) {
                const offset = (i - blurSteps / 2) * 0.5;
                stream.saveState();
                stream.translate(offset, offset);
                renderFunc();
                stream.restoreState();
            }
        } else {
            renderFunc();
        }

        stream.restoreState();

        // Render actual content on top
        renderFunc();
    }
}
