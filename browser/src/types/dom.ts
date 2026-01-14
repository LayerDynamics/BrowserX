// ============================================================================
// DOM TYPES
// ============================================================================

import type { NodeID } from "./identifiers.ts";

/**
 * DOM node type
 */
export enum DOMNodeType {
    ELEMENT = 1,
    ATTRIBUTE = 2,
    TEXT = 3,
    CDATA_SECTION = 4,
    ENTITY_REFERENCE = 5,
    ENTITY = 6,
    PROCESSING_INSTRUCTION = 7,
    COMMENT = 8,
    DOCUMENT = 9,
    DOCUMENT_TYPE = 10,
    DOCUMENT_FRAGMENT = 11,
    NOTATION = 12,
}

/**
 * Base DOM node
 */
export interface DOMNode {
    readonly nodeId: NodeID;
    readonly nodeType: DOMNodeType;
    nodeName: string;
    nodeValue: string | null;

    // Tree structure
    parentNode: DOMNode | null;
    childNodes: DOMNode[];
    firstChild: DOMNode | null;
    lastChild: DOMNode | null;
    previousSibling: DOMNode | null;
    nextSibling: DOMNode | null;

    // Document
    ownerDocument: DOMDocument | null;

    /**
     * Clone node (shallow or deep)
     */
    cloneNode(deep: boolean): DOMNode;

    /**
     * Append child node
     */
    appendChild(child: DOMNode): DOMNode;

    /**
     * Remove child node
     */
    removeChild(child: DOMNode): DOMNode;

    /**
     * Insert before reference node
     */
    insertBefore(newNode: DOMNode, referenceNode: DOMNode | null): DOMNode;

    /**
     * Replace child node
     */
    replaceChild(newNode: DOMNode, oldNode: DOMNode): DOMNode;

    /**
     * Check if contains node
     */
    contains(node: DOMNode): boolean;

    /**
     * Compare document position
     */
    compareDocumentPosition(node: DOMNode): number;
}

/**
 * DOM element node
 */
export interface DOMElement extends DOMNode {
    readonly nodeType: DOMNodeType.ELEMENT;
    tagName: string;
    parentElement: DOMElement | null;
    previousElementSibling: DOMElement | null;
    nextElementSibling: DOMElement | null;

    // Attributes
    attributes: Map<string, string>;
    id: string;
    className: string;
    classList: DOMTokenList;

    /**
     * Get attribute value
     */
    getAttribute(name: string): string | null;

    /**
     * Set attribute value
     */
    setAttribute(name: string, value: string): void;

    /**
     * Remove attribute
     */
    removeAttribute(name: string): void;

    /**
     * Has attribute
     */
    hasAttribute(name: string): boolean;

    /**
     * Query selector (CSS selector)
     */
    querySelector(selector: string): DOMElement | null;

    /**
     * Query all matching elements
     */
    querySelectorAll(selector: string): DOMElement[];

    /**
     * Get elements by tag name
     */
    getElementsByTagName(name: string): DOMElement[];

    /**
     * Get elements by class name
     */
    getElementsByClassName(name: string): DOMElement[];

    /**
     * Matches CSS selector
     */
    matches(selector: string): boolean;

    /**
     * Closest ancestor matching selector
     */
    closest(selector: string): DOMElement | null;

    // Computed style (set by rendering engine)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    __computedStyle?: any; // ComputedStyle from css.ts

    // Render object (set by rendering engine)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    __renderObject?: any; // RenderObject from rendering.ts
}

/**
 * DOM text node
 */
export interface DOMText extends DOMNode {
    readonly nodeType: DOMNodeType.TEXT;
    textContent: string;
    data: string;
    length: number;

    /**
     * Substring data
     */
    substringData(offset: number, count: number): string;

    /**
     * Append data
     */
    appendData(data: string): void;

    /**
     * Insert data
     */
    insertData(offset: number, data: string): void;

    /**
     * Delete data
     */
    deleteData(offset: number, count: number): void;

    /**
     * Replace data
     */
    replaceData(offset: number, count: number, data: string): void;
}

/**
 * DOM comment node
 */
export interface DOMComment extends DOMNode {
    readonly nodeType: DOMNodeType.COMMENT;
    data: string;
}

/**
 * DOM document node
 */
export interface DOMDocument extends DOMNode {
    readonly nodeType: DOMNodeType.DOCUMENT;

    // Document structure
    documentElement: DOMElement | null; // <html>
    head: DOMElement | null; // <head>
    body: DOMElement | null; // <body>

    // Document properties
    URL: string;
    documentURI: string;
    origin: string;
    title: string;
    characterSet: string;

    // Readiness
    readyState: "loading" | "interactive" | "complete";

    /**
     * Create element
     */
    createElement(tagName: string): DOMElement;

    /**
     * Create text node
     */
    createTextNode(text: string): DOMText;

    /**
     * Create comment
     */
    createComment(data: string): DOMComment;

    /**
     * Create document fragment
     */
    createDocumentFragment(): DOMDocumentFragment;

    /**
     * Get element by ID
     */
    getElementById(id: string): DOMElement | null;

    /**
     * Query selector
     */
    querySelector(selector: string): DOMElement | null;

    /**
     * Query all
     */
    querySelectorAll(selector: string): DOMElement[];

    // Stylesheets
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    styleSheets: any[]; // CSSStyleSheet[] from css.ts
}

/**
 * DOM token list (classList)
 */
export interface DOMTokenList {
    length: number;
    value: string;

    /**
     * Get item at index
     */
    item(index: number): string | null;

    /**
     * Contains token
     */
    contains(token: string): boolean;

    /**
     * Add token(s)
     */
    add(...tokens: string[]): void;

    /**
     * Remove token(s)
     */
    remove(...tokens: string[]): void;

    /**
     * Toggle token
     */
    toggle(token: string, force?: boolean): boolean;

    /**
     * Replace token
     */
    replace(oldToken: string, newToken: string): boolean;
}

/**
 * DOM document fragment
 */
export interface DOMDocumentFragment extends DOMNode {
    readonly nodeType: DOMNodeType.DOCUMENT_FRAGMENT;
}

// ============================================================================
// BROWSER API TYPES
// ============================================================================

/**
 * HTML Canvas Element
 */
export interface HTMLCanvasElement extends DOMElement {
    width: number;
    height: number;
    getContext(contextId: "2d", options?: unknown): CanvasRenderingContext2D | null;
    getContext(contextId: "webgl" | "webgl2", options?: unknown): WebGLRenderingContext | null;
    getContext(contextId: string, options?: unknown): RenderingContext | null;
    toDataURL(type?: string, quality?: number): string;
    toBlob(callback: (blob: Blob | null) => void, type?: string, quality?: number): void;
}

/**
 * Canvas 2D Rendering Context
 */
export interface CanvasRenderingContext2D {
    canvas: HTMLCanvasElement;
    fillStyle: string | CanvasGradient | CanvasPattern;
    strokeStyle: string | CanvasGradient | CanvasPattern;
    lineWidth: number;
    font: string;
    textAlign: string;
    textBaseline: string;
    globalAlpha: number;
    shadowOffsetX: number;
    shadowOffsetY: number;
    shadowBlur: number;
    shadowColor: string;
    globalCompositeOperation: string;

    fillRect(x: number, y: number, width: number, height: number): void;
    strokeRect(x: number, y: number, width: number, height: number): void;
    clearRect(x: number, y: number, width: number, height: number): void;
    fillText(text: string, x: number, y: number, maxWidth?: number): void;
    strokeText(text: string, x: number, y: number, maxWidth?: number): void;
    measureText(text: string): TextMetrics;
    drawImage(image: CanvasImageSource, dx: number, dy: number): void;
    drawImage(image: CanvasImageSource, dx: number, dy: number, dw: number, dh: number): void;
    save(): void;
    restore(): void;
    scale(x: number, y: number): void;
    rotate(angle: number): void;
    translate(x: number, y: number): void;
    transform(a: number, b: number, c: number, d: number, e: number, f: number): void;
    setTransform(a: number, b: number, c: number, d: number, e: number, f: number): void;
    getImageData(sx: number, sy: number, sw: number, sh: number): ImageData;
    putImageData(imageData: ImageData, dx: number, dy: number): void;
    rect(x: number, y: number, width: number, height: number): void;
    clip(): void;
    beginPath(): void;
    closePath(): void;
    moveTo(x: number, y: number): void;
    lineTo(x: number, y: number): void;
    stroke(): void;
    fill(): void;
}

/**
 * WebGL Rendering Context
 */
export interface WebGLRenderingContext {
    canvas: HTMLCanvasElement;
    drawingBufferWidth: number;
    drawingBufferHeight: number;

    // WebGL constants
    ARRAY_BUFFER: number;
    ELEMENT_ARRAY_BUFFER: number;
    STATIC_DRAW: number;
    DYNAMIC_DRAW: number;
    VERTEX_SHADER: number;
    FRAGMENT_SHADER: number;
    COMPILE_STATUS: number;
    LINK_STATUS: number;
    COLOR_BUFFER_BIT: number;
    DEPTH_BUFFER_BIT: number;
    TRIANGLES: number;
    TRIANGLE_STRIP: number;
    FLOAT: number;
    UNSIGNED_BYTE: number;
    RGBA: number;
    TEXTURE_2D: number;
    TEXTURE_WRAP_S: number;
    TEXTURE_WRAP_T: number;
    TEXTURE_MIN_FILTER: number;
    TEXTURE_MAG_FILTER: number;
    CLAMP_TO_EDGE: number;
    LINEAR: number;
    NEAREST: number;
    TEXTURE0: number;
    ONE: number;
    ONE_MINUS_SRC_ALPHA: number;
    CURRENT_PROGRAM: number;
    BLEND: number;

    createBuffer(): WebGLBuffer | null;
    bindBuffer(target: number, buffer: WebGLBuffer | null): void;
    bufferData(target: number, data: ArrayBufferView | ArrayBuffer | number, usage: number): void;
    createShader(type: number): WebGLShader | null;
    shaderSource(shader: WebGLShader, source: string): void;
    compileShader(shader: WebGLShader): void;
    getShaderParameter(shader: WebGLShader, pname: number): unknown;
    getShaderInfoLog(shader: WebGLShader): string | null;
    createProgram(): WebGLProgram | null;
    attachShader(program: WebGLProgram, shader: WebGLShader): void;
    linkProgram(program: WebGLProgram): void;
    getProgramParameter(program: WebGLProgram, pname: number): unknown;
    getProgramInfoLog(program: WebGLProgram): string | null;
    useProgram(program: WebGLProgram | null): void;
    getAttribLocation(program: WebGLProgram, name: string): number;
    getUniformLocation(program: WebGLProgram, name: string): WebGLUniformLocation | null;
    enableVertexAttribArray(index: number): void;
    vertexAttribPointer(
        index: number,
        size: number,
        type: number,
        normalized: boolean,
        stride: number,
        offset: number,
    ): void;
    uniform1f(location: WebGLUniformLocation | null, x: number): void;
    uniform2f(location: WebGLUniformLocation | null, x: number, y: number): void;
    uniform3f(location: WebGLUniformLocation | null, x: number, y: number, z: number): void;
    uniform4f(
        location: WebGLUniformLocation | null,
        x: number,
        y: number,
        z: number,
        w: number,
    ): void;
    uniformMatrix4fv(
        location: WebGLUniformLocation | null,
        transpose: boolean,
        value: Float32Array,
    ): void;
    createTexture(): WebGLTexture | null;
    bindTexture(target: number, texture: WebGLTexture | null): void;
    texImage2D(
        target: number,
        level: number,
        internalformat: number,
        width: number,
        height: number,
        border: number,
        format: number,
        type: number,
        pixels: ArrayBufferView | null,
    ): void;
    texImage2D(
        target: number,
        level: number,
        internalformat: number,
        format: number,
        type: number,
        source: HTMLCanvasElement | ImageBitmap,
    ): void;
    texParameteri(target: number, pname: number, param: number): void;
    viewport(x: number, y: number, width: number, height: number): void;
    clearColor(r: number, g: number, b: number, a: number): void;
    clear(mask: number): void;
    drawArrays(mode: number, first: number, count: number): void;
    drawElements(mode: number, count: number, type: number, offset: number): void;
    deleteShader(shader: WebGLShader | null): void;
    deleteProgram(program: WebGLProgram | null): void;
    deleteBuffer(buffer: WebGLBuffer | null): void;
    deleteTexture(texture: WebGLTexture | null): void;
    readPixels(
        x: number,
        y: number,
        width: number,
        height: number,
        format: number,
        type: number,
        pixels: ArrayBufferView | null,
    ): void;
    activeTexture(texture: number): void;
    enable(cap: number): void;
    blendFunc(sfactor: number, dfactor: number): void;
    getParameter(pname: number): unknown;
    uniform1i(location: WebGLUniformLocation | null, x: number): void;
}

/**
 * WebGL Program
 */
export interface WebGLProgram {
    readonly __brand: "WebGLProgram";
}

/**
 * WebGL Shader
 */
export interface WebGLShader {
    readonly __brand: "WebGLShader";
}

/**
 * WebGL Texture
 */
export interface WebGLTexture {
    readonly __brand: "WebGLTexture";
}

/**
 * WebGL Buffer
 */
export interface WebGLBuffer {
    readonly __brand: "WebGLBuffer";
}

/**
 * WebGL Uniform Location
 */
export interface WebGLUniformLocation {
    readonly __brand: "WebGLUniformLocation";
}

/**
 * Image Bitmap
 */
export interface ImageBitmap {
    readonly width: number;
    readonly height: number;
    close(): void;
}

/**
 * Image Data
 */
export interface ImageData {
    readonly width: number;
    readonly height: number;
    readonly data: Uint8ClampedArray;
}

/**
 * Text Metrics
 */
export interface TextMetrics {
    readonly width: number;
}

/**
 * Canvas Gradient
 */
export interface CanvasGradient {
    addColorStop(offset: number, color: string): void;
}

/**
 * Canvas Pattern
 */
export interface CanvasPattern {
    readonly __brand: "CanvasPattern";
}

/**
 * Blob
 */
export interface Blob {
    readonly size: number;
    readonly type: string;
    arrayBuffer(): Promise<ArrayBuffer>;
    text(): Promise<string>;
}

/**
 * Canvas image source types
 */
export type CanvasImageSource = HTMLCanvasElement | ImageBitmap;

/**
 * Rendering context types
 */
export type RenderingContext = CanvasRenderingContext2D | WebGLRenderingContext;

/**
 * Create element function with overloads
 */
function createElementFn(tagName: "canvas"): HTMLCanvasElement;
function createElementFn(tagName: string): DOMElement;
function createElementFn(tagName: string): DOMElement | HTMLCanvasElement {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const element: any = {
        nodeType: DOMNodeType.ELEMENT as const,
        tagName: tagName.toUpperCase(),
        parentElement: null,
        previousElementSibling: null,
        nextElementSibling: null,
        attributes: new Map<string, string>(),
        id: "",
        className: "",
        classList: {
            length: 0,
            value: "",
            item: () => null,
            add: () => {},
            remove: () => {},
            contains: () => false,
            toggle: () => false,
            replace: () => false,
        } as unknown as DOMTokenList,
        getAttribute: function (name: string) {
            return this.attributes.get(name) || null;
        },
        setAttribute: function (name: string, value: string) {
            this.attributes.set(name, value);
        },
        removeAttribute: function (name: string) {
            this.attributes.delete(name);
        },
        hasAttribute: function (name: string) {
            return this.attributes.has(name);
        },
    };

    // Special handling for canvas elements
    if (tagName.toLowerCase() === "canvas") {
        element.width = 300;
        element.height = 150;
        element.getContext = (contextId: string) => {
            if (contextId === "2d") {
                // Return minimal 2D context stub
                return {
                    canvas: element,
                    fillStyle: "#000",
                    strokeStyle: "#000",
                    lineWidth: 1,
                    font: "10px sans-serif",
                    textAlign: "start",
                    textBaseline: "alphabetic",
                    globalAlpha: 1,
                    shadowOffsetX: 0,
                    shadowOffsetY: 0,
                    shadowBlur: 0,
                    shadowColor: "rgba(0,0,0,0)",
                    globalCompositeOperation: "source-over",
                    fillRect: () => {},
                    strokeRect: () => {},
                    clearRect: () => {},
                    beginPath: () => {},
                    closePath: () => {},
                    moveTo: () => {},
                    lineTo: () => {},
                    arc: () => {},
                    arcTo: () => {},
                    quadraticCurveTo: () => {},
                    bezierCurveTo: () => {},
                    rect: () => {},
                    fill: () => {},
                    stroke: () => {},
                    clip: () => {},
                    save: () => {},
                    restore: () => {},
                    scale: () => {},
                    rotate: () => {},
                    translate: () => {},
                    transform: () => {},
                    setTransform: () => {},
                    resetTransform: () => {},
                    fillText: () => {},
                    strokeText: () => {},
                    measureText: () => ({ width: 0 }),
                    drawImage: () => {},
                    createImageData: () => ({ width: 0, height: 0, data: new Uint8ClampedArray() }),
                    getImageData: () => ({ width: 0, height: 0, data: new Uint8ClampedArray() }),
                    putImageData: () => {},
                } as unknown as CanvasRenderingContext2D;
            }
            return null;
        };
        element.toDataURL = () => "data:,";
        element.toBlob = (callback: (blob: Blob | null) => void) => callback(null);
        return element as HTMLCanvasElement;
    }

    return element as DOMElement;
}

/**
 * Global document object
 */
export const document = {
    createElement: createElementFn,
};

/**
 * Request animation frame
 */
let rafIdCounter = 0;
const rafCallbacks = new Map<number, (timestamp: number) => void>();

export function requestAnimationFrame(callback: (timestamp: number) => void): number {
    const id = ++rafIdCounter;
    rafCallbacks.set(id, callback);
    // Schedule callback on next tick
    queueMicrotask(() => {
        const cb = rafCallbacks.get(id);
        if (cb) {
            rafCallbacks.delete(id);
            cb(Date.now());
        }
    });
    return id;
}

/**
 * Cancel animation frame
 */
export function cancelAnimationFrame(id: number): void {
    rafCallbacks.delete(id);
}
