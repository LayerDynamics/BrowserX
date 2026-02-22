import { assertEquals } from "jsr:@std/assert";
import { ImageDecoder } from "../../../src/engine/rendering/ImageDecoder.ts";

Deno.test("ImageDecoder - PNG dimensions", () => {
    // Valid PNG header: signature + IHDR with 800x600
    const data = new Uint8Array(24);
    // PNG signature
    data[0] = 0x89; data[1] = 0x50; data[2] = 0x4E; data[3] = 0x47;
    data[4] = 0x0D; data[5] = 0x0A; data[6] = 0x1A; data[7] = 0x0A;
    // IHDR chunk length
    data[8] = 0; data[9] = 0; data[10] = 0; data[11] = 13;
    // IHDR type
    data[12] = 0x49; data[13] = 0x48; data[14] = 0x44; data[15] = 0x52;
    // Width: 800 (big-endian at offset 16)
    const view = new DataView(data.buffer);
    view.setUint32(16, 800, false);
    // Height: 600 (big-endian at offset 20)
    view.setUint32(20, 600, false);

    const dims = ImageDecoder.parseImageDimensions(data);
    assertEquals(dims.width, 800);
    assertEquals(dims.height, 600);
});

Deno.test("ImageDecoder - JPEG dimensions", () => {
    // Minimal JPEG with SOF0 marker
    const data = new Uint8Array(20);
    data[0] = 0xFF; data[1] = 0xD8; // SOI
    data[2] = 0xFF; data[3] = 0xC0; // SOF0
    data[4] = 0x00; data[5] = 0x11; // segment length
    data[6] = 0x08; // precision
    // Height: 480 at offset 7 (big-endian)
    const view = new DataView(data.buffer);
    view.setUint16(7, 480, false);
    // Width: 640 at offset 9 (big-endian)
    view.setUint16(9, 640, false);

    const dims = ImageDecoder.parseImageDimensions(data);
    assertEquals(dims.width, 640);
    assertEquals(dims.height, 480);
});

Deno.test("ImageDecoder - GIF dimensions", () => {
    const data = new Uint8Array(10);
    // GIF89a
    data[0] = 0x47; data[1] = 0x49; data[2] = 0x46;
    data[3] = 0x38; data[4] = 0x39; data[5] = 0x61;
    // Width: 320, Height: 240 (little-endian)
    const view = new DataView(data.buffer);
    view.setUint16(6, 320, true);
    view.setUint16(8, 240, true);

    const dims = ImageDecoder.parseImageDimensions(data);
    assertEquals(dims.width, 320);
    assertEquals(dims.height, 240);
});

Deno.test("ImageDecoder - BMP dimensions", () => {
    const data = new Uint8Array(26);
    data[0] = 0x42; data[1] = 0x4D; // "BM"
    const view = new DataView(data.buffer);
    view.setInt32(18, 1024, true);
    view.setInt32(22, -768, true); // negative height (top-down)

    const dims = ImageDecoder.parseImageDimensions(data);
    assertEquals(dims.width, 1024);
    assertEquals(dims.height, 768);
});

Deno.test("ImageDecoder - WebP VP8 lossy dimensions", () => {
    const data = new Uint8Array(30);
    // RIFF header
    data[0] = 0x52; data[1] = 0x49; data[2] = 0x46; data[3] = 0x46;
    // WEBP
    data[8] = 0x57; data[9] = 0x45; data[10] = 0x42; data[11] = 0x50;
    // VP8 (lossy)
    data[12] = 0x56; data[13] = 0x50; data[14] = 0x38; data[15] = 0x20;
    const view = new DataView(data.buffer);
    view.setUint16(26, 400, true);
    view.setUint16(28, 300, true);

    const dims = ImageDecoder.parseImageDimensions(data);
    assertEquals(dims.width, 400);
    assertEquals(dims.height, 300);
});

Deno.test("ImageDecoder - too short data returns zero", () => {
    const dims = ImageDecoder.parseImageDimensions(new Uint8Array(4));
    assertEquals(dims.width, 0);
    assertEquals(dims.height, 0);
});

Deno.test("ImageDecoder - unrecognized format returns zero", () => {
    const data = new Uint8Array(32);
    data[0] = 0xAA; data[1] = 0xBB;
    const dims = ImageDecoder.parseImageDimensions(data);
    assertEquals(dims.width, 0);
    assertEquals(dims.height, 0);
});

Deno.test("ImageDecoder - PNG too short for IHDR returns zero", () => {
    const data = new Uint8Array(20);
    data[0] = 0x89; data[1] = 0x50; data[2] = 0x4E; data[3] = 0x47;
    const dims = ImageDecoder.parseImageDimensions(data);
    assertEquals(dims.width, 0);
    assertEquals(dims.height, 0);
});

Deno.test("ImageDecoder - GIF87a dimensions", () => {
    const data = new Uint8Array(10);
    data[0] = 0x47; data[1] = 0x49; data[2] = 0x46;
    data[3] = 0x38; data[4] = 0x37; data[5] = 0x61; // GIF87a
    const view = new DataView(data.buffer);
    view.setUint16(6, 100, true);
    view.setUint16(8, 50, true);

    const dims = ImageDecoder.parseImageDimensions(data);
    assertEquals(dims.width, 100);
    assertEquals(dims.height, 50);
});
