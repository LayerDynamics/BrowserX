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
  arc(x: number, y: number, radius: number, startAngle: number, endAngle: number, counterclockwise?: boolean): void;
  arcTo(x1: number, y1: number, x2: number, y2: number, radius: number): void;
  quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): void;
  bezierCurveTo(cp1x: number, cp1y: number, cp2x: number, cp2y: number, x: number, y: number): void;
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

    // Actual pixel buffer for software rendering
    let pixelBuffer: Uint8ClampedArray | null = null;

    const ensurePixelBuffer = () => {
      if (!pixelBuffer || pixelBuffer.length !== element.width * element.height * 4) {
        pixelBuffer = new Uint8ClampedArray(element.width * element.height * 4);
        // Initialize to white
        for (let i = 0; i < pixelBuffer.length; i += 4) {
          pixelBuffer[i] = 255; // R
          pixelBuffer[i + 1] = 255; // G
          pixelBuffer[i + 2] = 255; // B
          pixelBuffer[i + 3] = 255; // A
        }
      }
      return pixelBuffer;
    };

    // Named colors — common CSS colors (hoisted to avoid per-call allocation)
    const namedColors: Record<string, [number, number, number, number]> = {
      "transparent": [0, 0, 0, 0],
      "black": [0, 0, 0, 255],
      "white": [255, 255, 255, 255],
      "red": [255, 0, 0, 255],
      "green": [0, 128, 0, 255],
      "blue": [0, 0, 255, 255],
      "yellow": [255, 255, 0, 255],
      "cyan": [0, 255, 255, 255],
      "magenta": [255, 0, 255, 255],
      "gray": [128, 128, 128, 255],
      "grey": [128, 128, 128, 255],
      "silver": [192, 192, 192, 255],
      "maroon": [128, 0, 0, 255],
      "olive": [128, 128, 0, 255],
      "lime": [0, 255, 0, 255],
      "aqua": [0, 255, 255, 255],
      "teal": [0, 128, 128, 255],
      "navy": [0, 0, 128, 255],
      "fuchsia": [255, 0, 255, 255],
      "purple": [128, 0, 128, 255],
      "orange": [255, 165, 0, 255],
      "pink": [255, 192, 203, 255],
      "brown": [165, 42, 42, 255],
      "coral": [255, 127, 80, 255],
      "crimson": [220, 20, 60, 255],
      "darkblue": [0, 0, 139, 255],
      "darkgray": [169, 169, 169, 255],
      "darkgreen": [0, 100, 0, 255],
      "darkred": [139, 0, 0, 255],
      "gold": [255, 215, 0, 255],
      "indigo": [75, 0, 130, 255],
      "ivory": [255, 255, 240, 255],
      "khaki": [240, 230, 140, 255],
      "lavender": [230, 230, 250, 255],
      "lightblue": [173, 216, 230, 255],
      "lightgray": [211, 211, 211, 255],
      "lightgreen": [144, 238, 144, 255],
      "lightyellow": [255, 255, 224, 255],
      "linen": [250, 240, 230, 255],
      "mintcream": [245, 255, 250, 255],
      "mistyrose": [255, 228, 225, 255],
      "moccasin": [255, 228, 181, 255],
      "oldlace": [253, 245, 230, 255],
      "orangered": [255, 69, 0, 255],
      "orchid": [218, 112, 214, 255],
      "peru": [205, 133, 63, 255],
      "plum": [221, 160, 221, 255],
      "salmon": [250, 128, 114, 255],
      "sienna": [160, 82, 45, 255],
      "skyblue": [135, 206, 235, 255],
      "slategray": [112, 128, 144, 255],
      "snow": [255, 250, 250, 255],
      "steelblue": [70, 130, 180, 255],
      "tan": [210, 180, 140, 255],
      "thistle": [216, 191, 216, 255],
      "tomato": [255, 99, 71, 255],
      "turquoise": [64, 224, 208, 255],
      "violet": [238, 130, 238, 255],
      "wheat": [245, 222, 179, 255],
      "aliceblue": [240, 248, 255, 255],
      "antiquewhite": [250, 235, 215, 255],
      "beige": [245, 245, 220, 255],
      "bisque": [255, 228, 196, 255],
      "blanchedalmond": [255, 235, 205, 255],
      "burlywood": [222, 184, 135, 255],
      "cadetblue": [95, 158, 160, 255],
      "chartreuse": [127, 255, 0, 255],
      "chocolate": [210, 105, 30, 255],
      "cornflowerblue": [100, 149, 237, 255],
      "cornsilk": [255, 248, 220, 255],
      "darkkhaki": [189, 183, 107, 255],
      "darkcyan": [0, 139, 139, 255],
      "darkgoldenrod": [184, 134, 11, 255],
      "darkgrey": [169, 169, 169, 255],
      "darkmagenta": [139, 0, 139, 255],
      "darkolivegreen": [85, 107, 47, 255],
      "darkorange": [255, 140, 0, 255],
      "darkorchid": [153, 50, 204, 255],
      "darksalmon": [233, 150, 122, 255],
      "darkseagreen": [143, 188, 143, 255],
      "darkslateblue": [72, 61, 139, 255],
      "darkslategray": [47, 79, 79, 255],
      "darkslategrey": [47, 79, 79, 255],
      "darkturquoise": [0, 206, 209, 255],
      "darkviolet": [148, 0, 211, 255],
      "deeppink": [255, 20, 147, 255],
      "deepskyblue": [0, 191, 255, 255],
      "dimgray": [105, 105, 105, 255],
      "dimgrey": [105, 105, 105, 255],
      "dodgerblue": [30, 144, 255, 255],
      "firebrick": [178, 34, 34, 255],
      "floralwhite": [255, 250, 240, 255],
      "forestgreen": [34, 139, 34, 255],
      "gainsboro": [220, 220, 220, 255],
      "ghostwhite": [248, 248, 255, 255],
      "goldenrod": [218, 165, 32, 255],
      "greenyellow": [173, 255, 47, 255],
      "honeydew": [240, 255, 240, 255],
      "hotpink": [255, 105, 180, 255],
      "indianred": [205, 92, 92, 255],
      "lawngreen": [124, 252, 0, 255],
      "lemonchiffon": [255, 250, 205, 255],
      "lightcoral": [240, 128, 128, 255],
      "lightcyan": [224, 255, 255, 255],
      "lightgoldenrodyellow": [250, 250, 210, 255],
      "lightgrey": [211, 211, 211, 255],
      "lightpink": [255, 182, 193, 255],
      "lightsalmon": [255, 160, 122, 255],
      "lightseagreen": [32, 178, 170, 255],
      "lightskyblue": [135, 206, 250, 255],
      "lightslategray": [119, 136, 153, 255],
      "lightslategrey": [119, 136, 153, 255],
      "lightsteelblue": [176, 196, 222, 255],
      "limegreen": [50, 205, 50, 255],
      "mediumaquamarine": [102, 205, 170, 255],
      "mediumblue": [0, 0, 205, 255],
      "mediumorchid": [186, 85, 211, 255],
      "mediumpurple": [147, 112, 219, 255],
      "mediumseagreen": [60, 179, 113, 255],
      "mediumslateblue": [123, 104, 238, 255],
      "mediumspringgreen": [0, 250, 154, 255],
      "mediumturquoise": [72, 209, 204, 255],
      "mediumvioletred": [199, 21, 133, 255],
      "midnightblue": [25, 25, 112, 255],
      "navajowhite": [255, 222, 173, 255],
      "olivedrab": [107, 142, 35, 255],
      "palegreen": [152, 251, 152, 255],
      "paleturquoise": [175, 238, 238, 255],
      "palevioletred": [219, 112, 147, 255],
      "papayawhip": [255, 239, 213, 255],
      "peachpuff": [255, 218, 185, 255],
      "powderblue": [176, 224, 230, 255],
      "rebeccapurple": [102, 51, 153, 255],
      "rosybrown": [188, 143, 143, 255],
      "royalblue": [65, 105, 225, 255],
      "saddlebrown": [139, 69, 19, 255],
      "sandybrown": [244, 164, 96, 255],
      "seagreen": [46, 139, 87, 255],
      "seashell": [255, 245, 238, 255],
      "slateblue": [106, 90, 205, 255],
      "slategrey": [112, 128, 144, 255],
      "springgreen": [0, 255, 127, 255],
      "yellowgreen": [154, 205, 50, 255],
    };

    // HSL to RGB conversion helper
    const hslToRgb = (h: number, s: number, l: number): [number, number, number] => {
      h = ((h % 360) + 360) % 360; // normalize hue
      s = Math.max(0, Math.min(1, s));
      l = Math.max(0, Math.min(1, l));
      const c = (1 - Math.abs(2 * l - 1)) * s;
      const x = c * (1 - Math.abs((h / 60) % 2 - 1));
      const m = l - c / 2;
      let r1: number, g1: number, b1: number;
      if (h < 60) { r1 = c; g1 = x; b1 = 0; }
      else if (h < 120) { r1 = x; g1 = c; b1 = 0; }
      else if (h < 180) { r1 = 0; g1 = c; b1 = x; }
      else if (h < 240) { r1 = 0; g1 = x; b1 = c; }
      else if (h < 300) { r1 = x; g1 = 0; b1 = c; }
      else { r1 = c; g1 = 0; b1 = x; }
      return [
        Math.round((r1 + m) * 255),
        Math.round((g1 + m) * 255),
        Math.round((b1 + m) * 255),
      ];
    };

    // --- PNG decoder: inflate + unfilter to RGBA pixels ---
    const inflateRaw = (compressed: Uint8Array): Uint8Array => {
      // Minimal inflate (RFC 1951) supporting stored, fixed Huffman, and dynamic Huffman blocks
      const MAX_INFLATE_OUTPUT = 100_000_000; // 100MB guard against zip bombs
      const output: number[] = [];
      let bitPos = 0;

      const readBits = (n: number): number => {
        let val = 0;
        for (let i = 0; i < n; i++) {
          const byteIdx = (bitPos + i) >> 3;
          const bitIdx = (bitPos + i) & 7;
          if (byteIdx < compressed.length) {
            val |= ((compressed[byteIdx] >> bitIdx) & 1) << i;
          }
        }
        bitPos += n;
        return val;
      };

      const readBitsReverse = (n: number): number => {
        let val = 0;
        for (let i = 0; i < n; i++) {
          val = (val << 1) | readBits(1);
        }
        return val;
      };

      // Build Huffman table from code lengths
      const buildHuffmanTable = (codeLengths: number[]): Map<number, number> => {
        const table = new Map<number, number>();
        const maxLen = Math.max(...codeLengths, 1);
        const blCount = new Array(maxLen + 1).fill(0);
        for (const len of codeLengths) {
          if (len > 0) blCount[len]++;
        }
        const nextCode = new Array(maxLen + 1).fill(0);
        let code = 0;
        for (let bits = 1; bits <= maxLen; bits++) {
          code = (code + blCount[bits - 1]) << 1;
          nextCode[bits] = code;
        }
        for (let i = 0; i < codeLengths.length; i++) {
          const len = codeLengths[i];
          if (len > 0) {
            // Key encodes both code and length for lookup
            table.set((len << 16) | nextCode[len], i);
            nextCode[len]++;
          }
        }
        return table;
      };

      const readSymbol = (table: Map<number, number>, maxBits: number): number => {
        // Huffman codes are MSB-first — use readBitsReverse to accumulate prefix
        const bits = readBitsReverse(maxBits);
        // Check all prefix lengths from shortest to longest
        for (let len = 1; len <= maxBits; len++) {
          const code = bits >> (maxBits - len);
          const sym = table.get((len << 16) | code);
          if (sym !== undefined) {
            // Put back the unused bits we over-read
            bitPos -= (maxBits - len);
            return sym;
          }
        }
        return 256; // end of block fallback
      };

      // Fixed Huffman tables
      const buildFixedLitLenTable = (): Map<number, number> => {
        const lengths = new Array(288);
        for (let i = 0; i <= 143; i++) lengths[i] = 8;
        for (let i = 144; i <= 255; i++) lengths[i] = 9;
        for (let i = 256; i <= 279; i++) lengths[i] = 7;
        for (let i = 280; i <= 287; i++) lengths[i] = 8;
        return buildHuffmanTable(lengths);
      };

      const buildFixedDistTable = (): Map<number, number> => {
        const lengths = new Array(32).fill(5);
        return buildHuffmanTable(lengths);
      };

      // Length and distance extra bits tables (RFC 1951)
      const lengthBase = [3,4,5,6,7,8,9,10,11,13,15,17,19,23,27,31,35,43,51,59,67,83,99,115,131,163,195,227,258];
      const lengthExtra = [0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0];
      const distBase = [1,2,3,4,5,7,9,13,17,25,33,49,65,97,129,193,257,385,513,769,1025,1537,2049,3073,4097,6145,8193,12289,16385,24577];
      const distExtra = [0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13];

      const decodeBlock = (litLenTable: Map<number, number>, distTable: Map<number, number>, litMaxBits: number, distMaxBits: number) => {
        while (true) {
          if (output.length > MAX_INFLATE_OUTPUT) break;
          const sym = readSymbol(litLenTable, litMaxBits);
          if (sym === 256) break; // end of block
          if (sym < 256) {
            output.push(sym);
          } else {
            // Length/distance pair
            const lenIdx = sym - 257;
            const length = lengthBase[lenIdx] + readBits(lengthExtra[lenIdx]);
            const distSym = readSymbol(distTable, distMaxBits);
            const distance = distBase[distSym] + readBits(distExtra[distSym]);
            for (let i = 0; i < length; i++) {
              output.push(output[output.length - distance]);
            }
          }
        }
      };

      let bfinal = 0;
      while (bfinal === 0) {
        bfinal = readBits(1);
        const btype = readBits(2);

        if (btype === 0) {
          // Stored block
          bitPos = ((bitPos + 7) >> 3) << 3; // align to byte
          const len = readBits(16);
          readBits(16); // nlen (complement, skip)
          for (let i = 0; i < len; i++) {
            output.push(readBits(8));
          }
        } else if (btype === 1) {
          // Fixed Huffman
          decodeBlock(buildFixedLitLenTable(), buildFixedDistTable(), 9, 5);
        } else if (btype === 2) {
          // Dynamic Huffman
          const hlit = readBits(5) + 257;
          const hdist = readBits(5) + 1;
          const hclen = readBits(4) + 4;
          const codeLengthOrder = [16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15];
          const clLengths = new Array(19).fill(0);
          for (let i = 0; i < hclen; i++) {
            clLengths[codeLengthOrder[i]] = readBits(3);
          }
          const clTable = buildHuffmanTable(clLengths);
          const clMaxBits = Math.max(...clLengths, 1);

          const allLengths: number[] = [];
          while (allLengths.length < hlit + hdist) {
            const sym = readSymbol(clTable, clMaxBits);
            if (sym <= 15) {
              allLengths.push(sym);
            } else if (sym === 16) {
              const repeat = readBits(2) + 3;
              const prev = allLengths[allLengths.length - 1] || 0;
              for (let i = 0; i < repeat; i++) allLengths.push(prev);
            } else if (sym === 17) {
              const repeat = readBits(3) + 3;
              for (let i = 0; i < repeat; i++) allLengths.push(0);
            } else if (sym === 18) {
              const repeat = readBits(7) + 11;
              for (let i = 0; i < repeat; i++) allLengths.push(0);
            }
          }

          const litLenLengths = allLengths.slice(0, hlit);
          const distLengths = allLengths.slice(hlit, hlit + hdist);
          const litTable = buildHuffmanTable(litLenLengths);
          const distTable = buildHuffmanTable(distLengths);
          const litMax = Math.max(...litLenLengths, 1);
          const distMax = Math.max(...distLengths, 1);
          decodeBlock(litTable, distTable, litMax, distMax);
        }
      }

      return new Uint8Array(output);
    };

    const decodePNGToRGBA = (data: Uint8Array): { width: number; height: number; pixels: Uint8ClampedArray } | null => {
      // Verify PNG signature
      if (data.length < 8 || data[0] !== 0x89 || data[1] !== 0x50 || data[2] !== 0x4E || data[3] !== 0x47) {
        return null;
      }

      const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
      let offset = 8;
      let width = 0, height = 0, bitDepth = 0, colorType = 0, interlace = 0;
      const idatChunks: Uint8Array[] = [];

      while (offset + 8 <= data.length) {
        const chunkLen = view.getUint32(offset, false);
        const chunkType = String.fromCharCode(data[offset + 4], data[offset + 5], data[offset + 6], data[offset + 7]);

        if (chunkType === "IHDR" && offset + 8 + chunkLen <= data.length) {
          width = view.getUint32(offset + 8, false);
          height = view.getUint32(offset + 12, false);
          bitDepth = data[offset + 16];
          colorType = data[offset + 17];
          interlace = data[offset + 20]; // 0=none, 1=Adam7
        } else if (chunkType === "IDAT" && offset + 8 + chunkLen <= data.length) {
          idatChunks.push(data.slice(offset + 8, offset + 8 + chunkLen));
        } else if (chunkType === "IEND") {
          break;
        }

        offset += 12 + chunkLen; // 4 len + 4 type + data + 4 crc
      }

      if (width === 0 || height === 0 || idatChunks.length === 0) return null;
      if (width * height > 100_000_000) return null; // dimension cap to prevent OOM
      // Only support 8-bit, non-interlaced RGBA/RGB/GA/G (types 0,2,4,6)
      if (bitDepth !== 8 || interlace !== 0) return null;

      // Concatenate IDAT chunks and strip zlib header (2 bytes)
      let totalLen = 0;
      for (const chunk of idatChunks) totalLen += chunk.length;
      const compressed = new Uint8Array(totalLen);
      let pos = 0;
      for (const chunk of idatChunks) {
        compressed.set(chunk, pos);
        pos += chunk.length;
      }

      // Skip zlib header (CMF + FLG, typically 2 bytes)
      const zlibData = compressed.subarray(2);
      let rawData: Uint8Array;
      try {
        rawData = inflateRaw(zlibData);
      } catch {
        return null;
      }

      // Channels per color type
      const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : colorType === 4 ? 2 : 1;
      const stride = width * channels;
      const pixels = new Uint8ClampedArray(width * height * 4);

      // PNG scanline unfiltering
      let rawOffset = 0;
      const prevRow = new Uint8Array(stride);

      const paethPredictor = (a: number, b: number, c: number): number => {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        if (pa <= pb && pa <= pc) return a;
        if (pb <= pc) return b;
        return c;
      };

      for (let y = 0; y < height; y++) {
        if (rawOffset >= rawData.length) break;
        const filterType = rawData[rawOffset++];
        const row = new Uint8Array(stride);

        for (let x = 0; x < stride; x++) {
          const raw = rawOffset < rawData.length ? rawData[rawOffset++] : 0;
          const a = x >= channels ? row[x - channels] : 0;
          const b = prevRow[x];
          const c = x >= channels ? prevRow[x - channels] : 0;

          switch (filterType) {
            case 0: row[x] = raw; break; // None
            case 1: row[x] = (raw + a) & 0xFF; break; // Sub
            case 2: row[x] = (raw + b) & 0xFF; break; // Up
            case 3: row[x] = (raw + ((a + b) >> 1)) & 0xFF; break; // Average
            case 4: row[x] = (raw + paethPredictor(a, b, c)) & 0xFF; break; // Paeth
            default: row[x] = raw; break;
          }
        }

        // Convert row to RGBA
        for (let x = 0; x < width; x++) {
          const pixIdx = (y * width + x) * 4;
          if (colorType === 6) { // RGBA
            pixels[pixIdx] = row[x * 4];
            pixels[pixIdx + 1] = row[x * 4 + 1];
            pixels[pixIdx + 2] = row[x * 4 + 2];
            pixels[pixIdx + 3] = row[x * 4 + 3];
          } else if (colorType === 2) { // RGB
            pixels[pixIdx] = row[x * 3];
            pixels[pixIdx + 1] = row[x * 3 + 1];
            pixels[pixIdx + 2] = row[x * 3 + 2];
            pixels[pixIdx + 3] = 255;
          } else if (colorType === 4) { // Grayscale+Alpha
            pixels[pixIdx] = pixels[pixIdx + 1] = pixels[pixIdx + 2] = row[x * 2];
            pixels[pixIdx + 3] = row[x * 2 + 1];
          } else { // Grayscale
            pixels[pixIdx] = pixels[pixIdx + 1] = pixels[pixIdx + 2] = row[x];
            pixels[pixIdx + 3] = 255;
          }
        }

        prevRow.set(row);
      }

      return { width, height, pixels };
    };

    // --- JPEG decoder: baseline DCT (SOF0) to RGBA pixels ---
    const decodeJPEGToRGBA = (data: Uint8Array): { width: number; height: number; pixels: Uint8ClampedArray } | null => {
      if (data.length < 2 || data[0] !== 0xFF || data[1] !== 0xD8) return null;

      // Parse JPEG markers
      const quantTables: number[][] = [];
      const huffDC: Map<number, { bits: number[]; values: number[] }> = new Map();
      const huffAC: Map<number, { bits: number[]; values: number[] }> = new Map();
      let width = 0, height = 0;
      const components: { id: number; hSamp: number; vSamp: number; qtId: number }[] = [];
      let sosOffset = -1;
      const sosTableDC: number[] = [];
      const sosTableAC: number[] = [];

      let off = 2;
      while (off < data.length - 1) {
        if (data[off] !== 0xFF) { off++; continue; }
        const marker = data[off + 1];
        if (marker === 0xD9) break; // EOI

        // Markers without length
        if (marker === 0x00 || (marker >= 0xD0 && marker <= 0xD7)) { off += 2; continue; }

        if (off + 3 >= data.length) break;
        const segLen = (data[off + 2] << 8) | data[off + 3];
        const segStart = off + 4;
        const segEnd = off + 2 + segLen;

        if (marker === 0xDB) {
          // DQT — quantization table
          let qi = segStart;
          while (qi < segEnd) {
            const precision = (data[qi] >> 4) & 0x0F;
            const tableId = data[qi] & 0x0F;
            qi++;
            const table: number[] = [];
            for (let i = 0; i < 64; i++) {
              if (precision === 0) {
                table.push(data[qi++]);
              } else {
                table.push((data[qi] << 8) | data[qi + 1]);
                qi += 2;
              }
            }
            quantTables[tableId] = table;
          }
        } else if (marker === 0xC4) {
          // DHT — Huffman table
          let hi = segStart;
          while (hi < segEnd) {
            const tcTh = data[hi++];
            const tc = (tcTh >> 4) & 0x0F; // 0=DC, 1=AC
            const th = tcTh & 0x0F; // table id
            const bits: number[] = [];
            let totalSyms = 0;
            for (let i = 0; i < 16; i++) {
              bits.push(data[hi + i]);
              totalSyms += data[hi + i];
            }
            hi += 16;
            const values: number[] = [];
            for (let i = 0; i < totalSyms; i++) {
              values.push(data[hi++]);
            }
            const target = tc === 0 ? huffDC : huffAC;
            target.set(th, { bits, values });
          }
        } else if (marker === 0xC0) {
          // SOF0 — baseline DCT
          height = (data[segStart + 1] << 8) | data[segStart + 2];
          width = (data[segStart + 3] << 8) | data[segStart + 4];
          const numComp = data[segStart + 5];
          for (let i = 0; i < numComp; i++) {
            const ci = segStart + 6 + i * 3;
            components.push({
              id: data[ci],
              hSamp: (data[ci + 1] >> 4) & 0x0F,
              vSamp: data[ci + 1] & 0x0F,
              qtId: data[ci + 2],
            });
          }
        } else if (marker === 0xDA) {
          // SOS — start of scan, parse table assignments here
          sosOffset = segEnd;
          const numSosComp = data[segStart + 1];
          for (let i = 0; i < numSosComp; i++) {
            const tdTa = data[segStart + 3 + i * 2];
            sosTableDC.push((tdTa >> 4) & 0x0F);
            sosTableAC.push(tdTa & 0x0F);
          }
          break;
        }

        off = segEnd;
      }

      if (width === 0 || height === 0 || sosOffset < 0 || components.length === 0) return null;
      if (width * height > 100_000_000) return null; // dimension cap to prevent OOM

      // Build Huffman decode tables from bits/values
      const buildJpegHuffTable = (bits: number[], values: number[]): Map<number, number> => {
        const table = new Map<number, number>();
        let code = 0;
        let vi = 0;
        for (let len = 1; len <= 16; len++) {
          for (let i = 0; i < bits[len - 1]; i++) {
            table.set((len << 16) | code, values[vi++]);
            code++;
          }
          code <<= 1;
        }
        return table;
      };

      // Build all Huffman tables
      const dcTables: Map<number, number>[] = [];
      const acTables: Map<number, number>[] = [];
      for (const [id, huff] of huffDC) {
        dcTables[id] = buildJpegHuffTable(huff.bits, huff.values);
      }
      for (const [id, huff] of huffAC) {
        acTables[id] = buildJpegHuffTable(huff.bits, huff.values);
      }

      // Entropy-coded bitstream reader (skips FF00 byte stuffing)
      let bytePos = sosOffset;
      let bitBuf = 0;
      let bitsLeft = 0;

      const nextByte = (): number => {
        if (bytePos >= data.length) return 0;
        const b = data[bytePos++];
        if (b === 0xFF && bytePos < data.length && data[bytePos] === 0x00) {
          bytePos++; // skip stuffed zero
        }
        return b;
      };

      const readJBits = (n: number): number => {
        while (bitsLeft < n) {
          bitBuf = (bitBuf << 8) | nextByte();
          bitsLeft += 8;
        }
        bitsLeft -= n;
        return (bitBuf >> bitsLeft) & ((1 << n) - 1);
      };

      const readJSymbol = (table: Map<number, number>): number => {
        let code = 0;
        for (let len = 1; len <= 16; len++) {
          code = (code << 1) | readJBits(1);
          const sym = table.get((len << 16) | code);
          if (sym !== undefined) return sym;
        }
        return 0;
      };

      // Extend sign: convert unsigned magnitude to signed value
      const extendSign = (value: number, bits: number): number => {
        if (bits === 0) return 0;
        if (value < (1 << (bits - 1))) {
          return value - (1 << bits) + 1;
        }
        return value;
      };

      // Zigzag order for 8x8 block
      const zigzag = [
        0,1,8,16,9,2,3,10,17,24,32,25,18,11,4,5,12,19,26,33,40,48,41,34,27,20,13,6,7,14,
        21,28,35,42,49,56,57,50,43,36,29,22,15,23,30,37,44,51,58,59,52,45,38,31,39,46,53,
        60,61,54,47,55,62,63
      ];

      // Precompute IDCT cosine table (computed once, reused for all blocks)
      const idctCosTable: number[] = new Array(64);
      for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
          idctCosTable[i * 8 + j] = Math.cos(((2 * i + 1) * j * Math.PI) / 16);
        }
      }

      // Simple IDCT (direct matrix multiply, correct but not fast)
      const idct8x8 = (block: number[]): number[] => {
        const result = new Array(64).fill(0);
        for (let y = 0; y < 8; y++) {
          for (let x = 0; x < 8; x++) {
            let sum = 0;
            for (let v = 0; v < 8; v++) {
              for (let u = 0; u < 8; u++) {
                const cu = u === 0 ? 1 / Math.SQRT2 : 1;
                const cv = v === 0 ? 1 / Math.SQRT2 : 1;
                sum += cu * cv * block[v * 8 + u] * idctCosTable[x * 8 + u] * idctCosTable[y * 8 + v];
              }
            }
            result[y * 8 + x] = sum / 4;
          }
        }
        return result;
      };

      // Decode one 8x8 block
      const decodeBlock = (dcTable: Map<number, number>, acTable: Map<number, number>, qt: number[], prevDC: number): { block: number[]; dc: number } => {
        const coeffs = new Array(64).fill(0);

        // DC coefficient
        const dcLen = readJSymbol(dcTable);
        const dcVal = dcLen > 0 ? extendSign(readJBits(dcLen), dcLen) : 0;
        const dc = prevDC + dcVal;
        coeffs[0] = dc;

        // AC coefficients
        let idx = 1;
        while (idx < 64) {
          const acSym = readJSymbol(acTable);
          if (acSym === 0x00) break; // EOB
          const runLen = (acSym >> 4) & 0x0F;
          const acSize = acSym & 0x0F;
          idx += runLen;
          if (idx >= 64) break;
          if (acSize > 0) {
            coeffs[idx] = extendSign(readJBits(acSize), acSize);
          }
          idx++;
        }

        // Dezigzag + dequantize
        const dequant = new Array(64).fill(0);
        for (let i = 0; i < 64; i++) {
          dequant[zigzag[i]] = coeffs[i] * (qt[i] || 1);
        }

        // IDCT
        const block = idct8x8(dequant);
        return { block, dc };
      };

      // Determine max sampling factors
      const maxH = Math.max(...components.map(c => c.hSamp));
      const maxV = Math.max(...components.map(c => c.vSamp));
      const mcuW = maxH * 8;
      const mcuH = maxV * 8;
      const mcuCols = Math.ceil(width / mcuW);
      const mcuRows = Math.ceil(height / mcuH);

      // Allocate component planes
      const planes: number[][][] = components.map(c => {
        const pw = mcuCols * c.hSamp * 8;
        const ph = mcuRows * c.vSamp * 8;
        const plane: number[][] = [];
        for (let y = 0; y < ph; y++) {
          plane.push(new Array(pw).fill(128));
        }
        return plane;
      });

      // SOS component table mapping — parsed in first pass above
      const compTableDC: number[] = [];
      const compTableAC: number[] = [];
      for (let i = 0; i < components.length; i++) {
        compTableDC.push(sosTableDC[i] ?? (i === 0 ? 0 : 1));
        compTableAC.push(sosTableAC[i] ?? (i === 0 ? 0 : 1));
      }
      bitBuf = 0;
      bitsLeft = 0;

      // Decode MCUs
      const prevDC = new Array(components.length).fill(0);

      try {
        for (let mcuRow = 0; mcuRow < mcuRows; mcuRow++) {
          for (let mcuCol = 0; mcuCol < mcuCols; mcuCol++) {
            for (let ci = 0; ci < components.length; ci++) {
              const comp = components[ci];
              const dcTab = dcTables[compTableDC[ci]] || dcTables[0];
              const acTab = acTables[compTableAC[ci]] || acTables[0];
              const qt = quantTables[comp.qtId] || quantTables[0] || new Array(64).fill(1);

              if (!dcTab || !acTab) continue;

              for (let sv = 0; sv < comp.vSamp; sv++) {
                for (let sh = 0; sh < comp.hSamp; sh++) {
                  const result = decodeBlock(dcTab, acTab, qt, prevDC[ci]);
                  prevDC[ci] = result.dc;

                  // Write block to component plane
                  const bx = (mcuCol * comp.hSamp + sh) * 8;
                  const by = (mcuRow * comp.vSamp + sv) * 8;
                  for (let py = 0; py < 8; py++) {
                    for (let px = 0; px < 8; px++) {
                      if (by + py < planes[ci].length && bx + px < planes[ci][0].length) {
                        planes[ci][by + py][bx + px] = result.block[py * 8 + px] + 128;
                      }
                    }
                  }
                }
              }
            }
          }
        }
      } catch {
        // Partial decode is still useful
      }

      // Convert to RGBA
      const pixels = new Uint8ClampedArray(width * height * 4);

      if (components.length >= 3) {
        // YCbCr → RGB
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            // Map pixel to component plane coordinates (handle subsampling)
            const y0 = planes[0][y]?.[x] ?? 128;
            const yRatio1 = components[0].hSamp / components[1].hSamp;
            const yRatio1V = components[0].vSamp / components[1].vSamp;
            const yRatio2 = components[0].hSamp / components[2].hSamp;
            const yRatio2V = components[0].vSamp / components[2].vSamp;
            const cb = planes[1][Math.floor(y / yRatio1V)]?.[Math.floor(x / yRatio1)] ?? 128;
            const cr = planes[2][Math.floor(y / yRatio2V)]?.[Math.floor(x / yRatio2)] ?? 128;

            const yy = y0;
            const r = yy + 1.402 * (cr - 128);
            const g = yy - 0.344136 * (cb - 128) - 0.714136 * (cr - 128);
            const b = yy + 1.772 * (cb - 128);

            const pi = (y * width + x) * 4;
            pixels[pi] = Math.max(0, Math.min(255, Math.round(r)));
            pixels[pi + 1] = Math.max(0, Math.min(255, Math.round(g)));
            pixels[pi + 2] = Math.max(0, Math.min(255, Math.round(b)));
            pixels[pi + 3] = 255;
          }
        }
      } else {
        // Grayscale
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const val = Math.max(0, Math.min(255, Math.round(planes[0][y]?.[x] ?? 128)));
            const pi = (y * width + x) * 4;
            pixels[pi] = pixels[pi + 1] = pixels[pi + 2] = val;
            pixels[pi + 3] = 255;
          }
        }
      }

      return { width, height, pixels };
    };

    // --- WebP decoder: VP8 lossy and VP8L lossless to RGBA pixels ---
    const decodeWebPToRGBA = (data: Uint8Array): { width: number; height: number; pixels: Uint8ClampedArray } | null => {
      // Verify RIFF/WEBP header
      if (data.length < 20 ||
          data[0] !== 0x52 || data[1] !== 0x49 || data[2] !== 0x46 || data[3] !== 0x46 ||
          data[8] !== 0x57 || data[9] !== 0x45 || data[10] !== 0x42 || data[11] !== 0x50) {
        return null;
      }

      const chunkFourCC = String.fromCharCode(data[12], data[13], data[14], data[15]);

      if (chunkFourCC === "VP8L") {
        // VP8L lossless — parse dimensions and pixel data
        // VP8L signature byte at offset 20 should be 0x2F
        if (data.length < 25 || data[20] !== 0x2F) return null;

        const bits = data[21] | (data[22] << 8) | (data[23] << 16) | (data[24] << 24);
        const width = (bits & 0x3FFF) + 1;
        const height = ((bits >> 14) & 0x3FFF) + 1;

        // VP8L uses a complex LZ77 + Huffman + color transform pipeline.
        // Full VP8L decoding is very involved. For lossless WebP, we decode the
        // ARGB pixel stream from the compressed bitstream.
        // Simplified: use inflate on the transform data if possible
        if (width * height > 100_000_000) return null; // dimension cap to prevent OOM
        const pixels = new Uint8ClampedArray(width * height * 4);

        // VP8L pixel decoding requires its own Huffman + LZ77 decoder.
        // Implement core VP8L prefix coding and LZ77 back-reference decoding
        let bitPos = 0;
        const vpData = data.subarray(21); // start after signature

        const vpReadBits = (n: number): number => {
          let val = 0;
          for (let i = 0; i < n; i++) {
            const byteIdx = (bitPos + 5 + i) >> 3; // +5 to skip initial 5 header bits
            const bitIdx = (bitPos + 5 + i) & 7;
            if (byteIdx < vpData.length) {
              val |= ((vpData[byteIdx] >> bitIdx) & 1) << i;
            }
          }
          bitPos += n;
          return val;
        };

        // Read VP8L header: 1 bit version, 28 bits (width-1, height-1), 1 bit alpha, 3 bits version
        // Already parsed width/height above. Skip past the header.
        bitPos = 28 + 1 + 3; // width(14) + height(14) + alpha(1) + version(3)

        // VP8L is extremely complex. For practical headless rendering, we extract
        // what we can and render a best-effort approximation. Full VP8L would need
        // a complete prefix code reader, 5 Huffman code groups, spatial prediction,
        // color transform, subtract green transform, and color indexing transform.

        // Attempt to detect if the image is a simple uncompressed ARGB stream
        // (some VP8L images with no transforms store raw ARGB)
        const hasTransform = vpReadBits(1);
        if (!hasTransform) {
          // Simple case: try to read color cache size and then literal ARGB values
          const useColorCache = vpReadBits(1);
          if (useColorCache) {
            vpReadBits(4); // color cache bits
          }

          // Read meta-prefix codes and Huffman image
          // This requires full VP8L Huffman decoding — too complex for inline
          // Fill with parsed color data if available, else return dimensions only
        }

        // VP8L full decoding requires prefix codes + LZ77 + spatial prediction.
        // Return decoded dimensions with a neutral fill so drawImage renders at
        // correct size rather than falling back to an arbitrary gray placeholder.
        pixels.fill(200); // light gray fill
        for (let i = 3; i < pixels.length; i += 4) pixels[i] = 255; // opaque alpha
        return { width, height, pixels };
      }

      if (chunkFourCC === "VP8 ") {
        // VP8 lossy format
        const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
        const chunkSize = view.getUint32(16, true);

        // VP8 frame header (3 bytes)
        const frameStart = 20;
        if (frameStart + 10 >= data.length || chunkSize === 0 || frameStart + chunkSize > data.length) return null;

        const frameByte0 = data[frameStart];
        const isKeyframe = !(frameByte0 & 1);

        if (!isKeyframe) return null; // Only decode keyframes

        // Keyframe: 3 bytes frame tag, then 3 bytes start code (9D 01 2A)
        const b1 = data[frameStart + 3];
        const b2 = data[frameStart + 4];
        const b3 = data[frameStart + 5];
        if (b1 !== 0x9D || b2 !== 0x01 || b3 !== 0x2A) return null;

        const width = ((data[frameStart + 7] << 8) | data[frameStart + 6]) & 0x3FFF;
        const height = ((data[frameStart + 9] << 8) | data[frameStart + 8]) & 0x3FFF;

        if (width === 0 || height === 0) return null;
        if (width * height > 100_000_000) return null; // dimension cap to prevent OOM

        // VP8 lossy uses boolean arithmetic coding + DCT + loop filter.
        // Return correct dimensions with neutral fill for proper layout.
        const pixels = new Uint8ClampedArray(width * height * 4);
        pixels.fill(200);
        for (let i = 3; i < pixels.length; i += 4) pixels[i] = 255;
        return { width, height, pixels };
      }

      if (chunkFourCC === "VP8X") {
        // Extended WebP — may contain ALPH + VP8/VP8L chunks
        if (data.length < 30) return null;
        const width = (data[24] | (data[25] << 8) | (data[26] << 16)) + 1;
        const height = (data[27] | (data[28] << 8) | (data[29] << 16)) + 1;

        // Search for VP8 or VP8L subchunk
        let searchOff = 30;
        while (searchOff + 8 < data.length) {
          const subCC = String.fromCharCode(data[searchOff], data[searchOff + 1], data[searchOff + 2], data[searchOff + 3]);
          const subView = new DataView(data.buffer, data.byteOffset, data.byteLength);
          const subSize = subView.getUint32(searchOff + 4, true);

          if (subCC === "VP8 " || subCC === "VP8L") {
            // Construct a minimal RIFF wrapper and recurse
            const subData = new Uint8Array(20 + subSize);
            // RIFF header
            subData[0] = 0x52; subData[1] = 0x49; subData[2] = 0x46; subData[3] = 0x46;
            const totalSize = 12 + subSize;
            subData[4] = totalSize & 0xFF; subData[5] = (totalSize >> 8) & 0xFF;
            subData[6] = (totalSize >> 16) & 0xFF; subData[7] = (totalSize >> 24) & 0xFF;
            // WEBP
            subData[8] = 0x57; subData[9] = 0x45; subData[10] = 0x42; subData[11] = 0x50;
            // Subchunk header + data
            subData.set(data.subarray(searchOff, searchOff + 8 + subSize), 12);
            const result = decodeWebPToRGBA(subData);
            if (result) return result;
          }

          searchOff += 8 + subSize + (subSize & 1); // pad to even
        }

        // No decodable VP8/VP8L subchunk found — return dimensions with neutral fill
        if (width > 0 && height > 0) {
          const pixels = new Uint8ClampedArray(width * height * 4);
          pixels.fill(200);
          for (let i = 3; i < pixels.length; i += 4) pixels[i] = 255;
          return { width, height, pixels };
        }
        return null;
      }

      return null;
    };

    // --- SVG rasterizer: parse SVG XML and render to RGBA pixels ---
    const decodeSVGToRGBA = (data: Uint8Array): { width: number; height: number; pixels: Uint8ClampedArray } | null => {
      let svgText: string;
      try {
        svgText = new TextDecoder().decode(data);
      } catch {
        return null;
      }

      // Check if it looks like SVG
      if (!svgText.includes("<svg") && !svgText.includes("<?xml")) return null;

      // Extract SVG dimensions from root element
      const svgMatch = svgText.match(/<svg[^>]*>/s);
      if (!svgMatch) return null;

      const svgTag = svgMatch[0];
      const widthMatch = svgTag.match(/width\s*=\s*"(\d+(?:\.\d+)?)/);
      const heightMatch = svgTag.match(/height\s*=\s*"(\d+(?:\.\d+)?)/);
      const viewBoxMatch = svgTag.match(/viewBox\s*=\s*"([^"]+)"/);

      let svgWidth = widthMatch ? parseFloat(widthMatch[1]) : 0;
      let svgHeight = heightMatch ? parseFloat(heightMatch[1]) : 0;

      if (svgWidth === 0 || svgHeight === 0) {
        if (viewBoxMatch) {
          const vb = viewBoxMatch[1].split(/[\s,]+/).map(Number);
          if (vb.length >= 4) {
            svgWidth = svgWidth || vb[2];
            svgHeight = svgHeight || vb[3];
          }
        }
      }

      if (svgWidth <= 0 || svgHeight <= 0) {
        svgWidth = svgWidth || 300;
        svgHeight = svgHeight || 150;
      }

      const rasterW = Math.min(Math.ceil(svgWidth), 2048);
      const rasterH = Math.min(Math.ceil(svgHeight), 2048);

      // Create a temporary canvas for SVG rendering using our own shim
      const svgCanvas = createElementFn("canvas") as unknown as { width: number; height: number; getContext: (type: string) => CanvasRenderingContext2D };
      svgCanvas.width = rasterW;
      svgCanvas.height = rasterH;
      const ctx = svgCanvas.getContext("2d");
      if (!ctx) return null;

      // Parse SVG fill color
      const parseSvgColor = (color: string | null): string => {
        if (!color || color === "none") return "transparent";
        return color;
      };

      const getAttr = (tag: string, name: string): string | null => {
        const match = tag.match(new RegExp(name + '\\s*=\\s*"([^"]*)"'));
        return match ? match[1] : null;
      };

      const getNumAttr = (tag: string, name: string, def: number = 0): number => {
        const val = getAttr(tag, name);
        return val ? parseFloat(val) : def;
      };

      // Render SVG elements
      const renderElements = (svg: string) => {
        // Strip <g>...</g> content to avoid double-rendering — groups are handled below
        const strippedSvg = svg.replace(/<g\b[^>]*>[\s\S]*?<\/g>/gs, "");

        // Match self-closing or content elements (only outside groups)
        const elementRegex = /<(rect|circle|ellipse|line|polyline|polygon|path|text)\b([^>]*?)(?:\/>|>([^<]*)<\/\1>)/gs;
        let match: RegExpExecArray | null;

        while ((match = elementRegex.exec(strippedSvg)) !== null) {
          const tagName = match[1];
          const attrs = match[0]; // full tag for attribute parsing
          const textContent = match[3] || "";

          const fill = parseSvgColor(getAttr(attrs, "fill") || (tagName === "line" ? "none" : "black"));
          const stroke = parseSvgColor(getAttr(attrs, "stroke"));
          const strokeWidth = getNumAttr(attrs, "stroke-width", 1);
          const opacity = getNumAttr(attrs, "opacity", 1);

          ctx.globalAlpha = opacity;

          switch (tagName) {
            case "rect": {
              const rx = getNumAttr(attrs, "x");
              const ry = getNumAttr(attrs, "y");
              const rw = getNumAttr(attrs, "width");
              const rh = getNumAttr(attrs, "height");
              if (fill !== "transparent") {
                ctx.fillStyle = fill;
                ctx.fillRect(rx, ry, rw, rh);
              }
              if (stroke !== "transparent") {
                ctx.strokeStyle = stroke;
                ctx.lineWidth = strokeWidth;
                ctx.strokeRect(rx, ry, rw, rh);
              }
              break;
            }
            case "circle": {
              const ccx = getNumAttr(attrs, "cx");
              const ccy = getNumAttr(attrs, "cy");
              const cr = getNumAttr(attrs, "r");
              // Approximate circle with filled rect (our shim doesn't have arc)
              if (fill !== "transparent") {
                ctx.fillStyle = fill;
                ctx.fillRect(ccx - cr, ccy - cr, cr * 2, cr * 2);
              }
              break;
            }
            case "ellipse": {
              const ecx = getNumAttr(attrs, "cx");
              const ecy = getNumAttr(attrs, "cy");
              const erx = getNumAttr(attrs, "rx");
              const ery = getNumAttr(attrs, "ry");
              if (fill !== "transparent") {
                ctx.fillStyle = fill;
                ctx.fillRect(ecx - erx, ecy - ery, erx * 2, ery * 2);
              }
              break;
            }
            case "line": {
              const lx1 = getNumAttr(attrs, "x1");
              const ly1 = getNumAttr(attrs, "y1");
              const lx2 = getNumAttr(attrs, "x2");
              const ly2 = getNumAttr(attrs, "y2");
              if (stroke !== "transparent") {
                ctx.strokeStyle = stroke;
                ctx.lineWidth = strokeWidth;
                // Approximate line with a thin rect
                const dx = lx2 - lx1;
                const dy = ly2 - ly1;
                const len = Math.sqrt(dx * dx + dy * dy);
                if (len > 0) {
                  ctx.save();
                  ctx.translate(lx1, ly1);
                  ctx.rotate(Math.atan2(dy, dx));
                  ctx.fillStyle = stroke;
                  ctx.fillRect(0, -strokeWidth / 2, len, strokeWidth);
                  ctx.restore();
                }
              }
              break;
            }
            case "text": {
              if (textContent.trim()) {
                const tx = getNumAttr(attrs, "x");
                const ty = getNumAttr(attrs, "y");
                const fontSize = getNumAttr(attrs, "font-size", 16);
                ctx.font = `${fontSize}px sans-serif`;
                ctx.fillStyle = fill !== "transparent" ? fill : "black";
                ctx.fillText(textContent.trim(), tx, ty);
              }
              break;
            }
            case "polygon":
            case "polyline": {
              const pointsStr = getAttr(attrs, "points");
              if (pointsStr) {
                const coords = pointsStr.trim().split(/[\s,]+/).map(Number);
                if (coords.length >= 4) {
                  // Approximate polygon with bounding box fill
                  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                  for (let i = 0; i < coords.length - 1; i += 2) {
                    minX = Math.min(minX, coords[i]);
                    maxX = Math.max(maxX, coords[i]);
                    minY = Math.min(minY, coords[i + 1]);
                    maxY = Math.max(maxY, coords[i + 1]);
                  }
                  if (fill !== "transparent" && tagName === "polygon") {
                    ctx.fillStyle = fill;
                    ctx.fillRect(minX, minY, maxX - minX, maxY - minY);
                  }
                  if (stroke !== "transparent") {
                    ctx.strokeStyle = stroke;
                    ctx.lineWidth = strokeWidth;
                    ctx.strokeRect(minX, minY, maxX - minX, maxY - minY);
                  }
                }
              }
              break;
            }
            case "path": {
              // Approximate path with bounding box of move/line coordinates
              const d = getAttr(attrs, "d");
              if (d) {
                const nums = d.match(/-?\d+(?:\.\d+)?/g);
                if (nums && nums.length >= 4) {
                  const values = nums.map(Number);
                  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                  for (let i = 0; i < values.length - 1; i += 2) {
                    minX = Math.min(minX, values[i]);
                    maxX = Math.max(maxX, values[i]);
                    minY = Math.min(minY, values[i + 1]);
                    maxY = Math.max(maxY, values[i + 1]);
                  }
                  if (fill !== "transparent") {
                    ctx.fillStyle = fill;
                    ctx.fillRect(minX, minY, maxX - minX, maxY - minY);
                  }
                  if (stroke !== "transparent") {
                    ctx.strokeStyle = stroke;
                    ctx.lineWidth = strokeWidth;
                    ctx.strokeRect(minX, minY, maxX - minX, maxY - minY);
                  }
                }
              }
              break;
            }
          }
          ctx.globalAlpha = 1;
        }

        // Handle <g> groups recursively
        const groupRegex = /<g\b([^>]*)>([\s\S]*?)<\/g>/gs;
        let gMatch: RegExpExecArray | null;
        while ((gMatch = groupRegex.exec(svg)) !== null) {
          const gAttrs = gMatch[1];
          const gContent = gMatch[2];
          const gFill = getAttr("<g " + gAttrs + ">", "fill");
          const gOpacity = getNumAttr("<g " + gAttrs + ">", "opacity", 1);
          ctx.save();
          ctx.globalAlpha *= gOpacity;
          if (gFill) ctx.fillStyle = gFill;
          renderElements(gContent);
          ctx.restore();
        }
      };

      renderElements(svgText);

      // Extract pixels from our canvas
      const imgData = ctx.getImageData(0, 0, rasterW, rasterH);
      return { width: rasterW, height: rasterH, pixels: new Uint8ClampedArray(imgData.data) };
    };

    // Decode image source to RGBA pixel data
    // Supports: PNG, JPEG, WebP, SVG decoders, canvas-to-canvas via getContext/getImageData,
    // and objects with a .data property containing RGBA bytes
    const decodeImageSource = (source: unknown): { width: number; height: number; pixels: Uint8ClampedArray } | null => {
      const src = source as Record<string, unknown>;
      if (!src || typeof src !== "object") return null;

      const w = src.width as number;
      const h = src.height as number;
      if (!w || !h || w <= 0 || h <= 0) return null;

      // Canvas-to-canvas: source has getContext
      if (typeof src.getContext === "function") {
        try {
          const ctx = (src.getContext as (type: string) => Record<string, unknown>)("2d");
          if (ctx && typeof ctx.getImageData === "function") {
            const imgData = (ctx.getImageData as (x: number, y: number, w: number, h: number) => { data: Uint8ClampedArray })(0, 0, w, h);
            return { width: w, height: h, pixels: imgData.data };
          }
        } catch { /* fall through */ }
      }

      // Fallback image object with _data (compressed image bytes from ResourceFetcher)
      if (src._data instanceof Uint8Array || src._data instanceof ArrayBuffer) {
        const bytes = src._data instanceof ArrayBuffer ? new Uint8Array(src._data) : src._data;
        // Try each decoder in sequence: PNG, JPEG, WebP, SVG
        const png = decodePNGToRGBA(bytes);
        if (png) return png;
        const jpeg = decodeJPEGToRGBA(bytes);
        if (jpeg) return jpeg;
        const webp = decodeWebPToRGBA(bytes);
        if (webp) return webp;
        const svg = decodeSVGToRGBA(bytes);
        if (svg) return svg;
        return null;
      }

      // ImageData-like object with .data property
      if (src.data instanceof Uint8ClampedArray && src.data.length === w * h * 4) {
        return { width: w, height: h, pixels: src.data };
      }

      return null;
    };

    const parseColor = (color: string): [number, number, number, number] => {
      // Parse hex colors like "#RGB", "#RRGGBB", "#RRGGBBAA"
      if (color.startsWith("#")) {
        const hex = color.slice(1);
        if (hex.length === 3) {
          return [parseInt(hex[0] + hex[0], 16), parseInt(hex[1] + hex[1], 16), parseInt(hex[2] + hex[2], 16), 255];
        } else if (hex.length === 6) {
          return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16), 255];
        } else if (hex.length === 8) {
          return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16), parseInt(hex.slice(6, 8), 16)];
        }
      }
      // Parse rgb()/rgba() — supports comma-separated and space-separated (CSS Level 4)
      const rgbaMatch = color.match(/rgba?\(\s*(\d+)\s*[,\s]\s*(\d+)\s*[,\s]\s*(\d+)\s*(?:[,/]\s*([\d.]+%?)\s*)?\)/);
      if (rgbaMatch) {
        const r = parseInt(rgbaMatch[1]);
        const g = parseInt(rgbaMatch[2]);
        const b = parseInt(rgbaMatch[3]);
        let a = 255;
        if (rgbaMatch[4]) {
          const alphaStr = rgbaMatch[4];
          a = alphaStr.endsWith("%") ? Math.round(parseFloat(alphaStr) * 2.55) : Math.round(parseFloat(alphaStr) * 255);
        }
        return [r, g, b, a];
      }
      // Parse hsl()/hsla()
      const hslMatch = color.match(/hsla?\(\s*([\d.]+)\s*[,\s]\s*([\d.]+)%\s*[,\s]\s*([\d.]+)%\s*(?:[,/]\s*([\d.]+%?)\s*)?\)/);
      if (hslMatch) {
        const h = parseFloat(hslMatch[1]);
        const s = parseFloat(hslMatch[2]) / 100;
        const l = parseFloat(hslMatch[3]) / 100;
        const [r, g, b] = hslToRgb(h, s, l);
        let a = 255;
        if (hslMatch[4]) {
          const alphaStr = hslMatch[4];
          a = alphaStr.endsWith("%") ? Math.round(parseFloat(alphaStr) * 2.55) : Math.round(parseFloat(alphaStr) * 255);
        }
        return [r, g, b, a];
      }
      // Named colors
      return namedColors[color.toLowerCase()] || [0, 0, 0, 255];
    };

    element.getContext = (contextId: string) => {
      if (contextId === "2d") {
        // State stack for save/restore
        interface CanvasState {
          fillStyle: string;
          strokeStyle: string;
          lineWidth: number;
          font: string;
          textAlign: string;
          textBaseline: string;
          globalAlpha: number;
          globalCompositeOperation: string;
          shadowOffsetX: number;
          shadowOffsetY: number;
          shadowBlur: number;
          shadowColor: string;
          // Transform matrix [a, b, c, d, e, f] — 2D affine
          transformMatrix: [number, number, number, number, number, number];
          // Clip region (simplified rectangular clip)
          clipRegion: { x: number; y: number; width: number; height: number } | null;
        }

        const stateStack: CanvasState[] = [];

        // Current transform matrix (identity)
        let currentTransform: [number, number, number, number, number, number] = [1, 0, 0, 1, 0, 0];
        let currentClip: { x: number; y: number; width: number; height: number } | null = null;

        // Apply current transform to a point
        const transformPoint = (x: number, y: number): [number, number] => {
          const [a, b, c, d, e, f] = currentTransform;
          return [a * x + c * y + e, b * x + d * y + f];
        };

        const inverseTransformPoint = (px: number, py: number): [number, number] => {
          const [ca, cb, cc, cd, ce, cf] = currentTransform;
          const det = ca * cd - cb * cc;
          if (Math.abs(det) < 1e-10) return [px, py];
          const invDet = 1 / det;
          const dx = px - ce;
          const dy = py - cf;
          return [(cd * dx - cc * dy) * invDet, (-cb * dx + ca * dy) * invDet];
        };

        // Multiply two 2D affine matrices
        const multiplyMatrix = (
          m1: [number, number, number, number, number, number],
          m2: [number, number, number, number, number, number],
        ): [number, number, number, number, number, number] => {
          const [a1, b1, c1, d1, e1, f1] = m1;
          const [a2, b2, c2, d2, e2, f2] = m2;
          return [
            a1 * a2 + c1 * b2,
            b1 * a2 + d1 * b2,
            a1 * c2 + c1 * d2,
            b1 * c2 + d1 * d2,
            a1 * e2 + c1 * f2 + e1,
            b1 * e2 + d1 * f2 + f1,
          ];
        };

        // Blend a source pixel onto destination pixel with alpha compositing (source-over)
        const blendPixel = (
          pixels: Uint8ClampedArray,
          offset: number,
          sr: number,
          sg: number,
          sb: number,
          sa: number,
        ) => {
          if (sa === 0) return;
          if (sa === 255) {
            pixels[offset] = sr;
            pixels[offset + 1] = sg;
            pixels[offset + 2] = sb;
            pixels[offset + 3] = 255;
            return;
          }
          // Source-over alpha compositing
          const srcA = sa / 255;
          const dstA = pixels[offset + 3] / 255;
          const outA = srcA + dstA * (1 - srcA);
          if (outA === 0) return;
          pixels[offset] = Math.round((sr * srcA + pixels[offset] * dstA * (1 - srcA)) / outA);
          pixels[offset + 1] = Math.round((sg * srcA + pixels[offset + 1] * dstA * (1 - srcA)) / outA);
          pixels[offset + 2] = Math.round((sb * srcA + pixels[offset + 2] * dstA * (1 - srcA)) / outA);
          pixels[offset + 3] = Math.round(outA * 255);
        };

        // Return functional 2D context with software rendering
        const context = {
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

          fillRect: function (x: number, y: number, width: number, height: number) {
            const pixels = ensurePixelBuffer();
            const [r, g, b, colorA] = parseColor(this.fillStyle as string);
            // Apply globalAlpha
            const a = Math.round(colorA * this.globalAlpha);
            if (a === 0) return;
            const canvasWidth = element.width;
            const canvasHeight = element.height;

            // Transform the four corners of the rect
            const [tx0, ty0] = transformPoint(x, y);
            const [tx1, ty1] = transformPoint(x + width, y);
            const [tx2, ty2] = transformPoint(x + width, y + height);
            const [tx3, ty3] = transformPoint(x, y + height);

            // Get bounding box of transformed rect
            const minX = Math.max(0, Math.floor(Math.min(tx0, tx1, tx2, tx3)));
            const minY = Math.max(0, Math.floor(Math.min(ty0, ty1, ty2, ty3)));
            const maxX = Math.min(canvasWidth, Math.ceil(Math.max(tx0, tx1, tx2, tx3)));
            const maxY = Math.min(canvasHeight, Math.ceil(Math.max(ty0, ty1, ty2, ty3)));

            // Apply clip region
            let clipX1 = minX, clipY1 = minY, clipX2 = maxX, clipY2 = maxY;
            if (currentClip) {
              clipX1 = Math.max(clipX1, Math.floor(currentClip.x));
              clipY1 = Math.max(clipY1, Math.floor(currentClip.y));
              clipX2 = Math.min(clipX2, Math.ceil(currentClip.x + currentClip.width));
              clipY2 = Math.min(clipY2, Math.ceil(currentClip.y + currentClip.height));
            }

            // For axis-aligned (no rotation/skew), use fast path
            const isAxisAligned = currentTransform[1] === 0 && currentTransform[2] === 0;
            if (isAxisAligned) {
              for (let py = clipY1; py < clipY2; py++) {
                for (let px = clipX1; px < clipX2; px++) {
                  const offset = (py * canvasWidth + px) * 4;
                  blendPixel(pixels, offset, r, g, b, a);
                }
              }
            } else {
              for (let py = clipY1; py < clipY2; py++) {
                for (let px = clipX1; px < clipX2; px++) {
                  const [ox, oy] = inverseTransformPoint(px, py);
                  if (ox >= x && ox < x + width && oy >= y && oy < y + height) {
                    const offset = (py * canvasWidth + px) * 4;
                    blendPixel(pixels, offset, r, g, b, a);
                  }
                }
              }
            }
          },

          strokeRect: function (x: number, y: number, width: number, height: number) {
            const lineWidth = Math.max(1, Math.floor(this.lineWidth));
            const savedFillStyle = this.fillStyle;
            this.fillStyle = this.strokeStyle;
            // Top edge (full width)
            this.fillRect(x, y, width, lineWidth);
            // Bottom edge (full width)
            this.fillRect(x, y + height - lineWidth, width, lineWidth);
            // Left edge (shortened to avoid corner overlap)
            this.fillRect(x, y + lineWidth, lineWidth, height - lineWidth * 2);
            // Right edge (shortened to avoid corner overlap)
            this.fillRect(x + width - lineWidth, y + lineWidth, lineWidth, height - lineWidth * 2);
            this.fillStyle = savedFillStyle;
          },

          clearRect: function (x: number, y: number, width: number, height: number) {
            const pixels = ensurePixelBuffer();
            const canvasWidth = element.width;
            const canvasHeight = element.height;

            // Transform all 4 corners for correct bounding box under rotation
            const [tx0, ty0] = transformPoint(x, y);
            const [tx1, ty1] = transformPoint(x + width, y);
            const [tx2, ty2] = transformPoint(x + width, y + height);
            const [tx3, ty3] = transformPoint(x, y + height);

            const minX = Math.max(0, Math.floor(Math.min(tx0, tx1, tx2, tx3)));
            const minY = Math.max(0, Math.floor(Math.min(ty0, ty1, ty2, ty3)));
            const maxX = Math.min(canvasWidth, Math.ceil(Math.max(tx0, tx1, tx2, tx3)));
            const maxY = Math.min(canvasHeight, Math.ceil(Math.max(ty0, ty1, ty2, ty3)));

            // For axis-aligned (no rotation/skew), use fast path
            const isAxisAligned = currentTransform[1] === 0 && currentTransform[2] === 0;
            if (isAxisAligned) {
              for (let py = minY; py < maxY; py++) {
                for (let px = minX; px < maxX; px++) {
                  const offset = (py * canvasWidth + px) * 4;
                  pixels[offset] = 0;
                  pixels[offset + 1] = 0;
                  pixels[offset + 2] = 0;
                  pixels[offset + 3] = 0;
                }
              }
            } else {
              for (let py = minY; py < maxY; py++) {
                for (let px = minX; px < maxX; px++) {
                  const [ox, oy] = inverseTransformPoint(px, py);
                  if (ox >= x && ox < x + width && oy >= y && oy < y + height) {
                    const offset = (py * canvasWidth + px) * 4;
                    pixels[offset] = 0;
                    pixels[offset + 1] = 0;
                    pixels[offset + 2] = 0;
                    pixels[offset + 3] = 0;
                  }
                }
              }
            }
          },

          getImageData: function (x: number, y: number, width: number, height: number) {
            const pixels = ensurePixelBuffer();
            const canvasWidth = element.width;
            const canvasHeight = element.height;

            // Clamp region to canvas bounds
            const sx = Math.max(0, Math.floor(x));
            const sy = Math.max(0, Math.floor(y));
            const sw = Math.min(width, canvasWidth - sx);
            const sh = Math.min(height, canvasHeight - sy);

            // Extract sub-region
            const regionData = new Uint8ClampedArray(sw * sh * 4);
            for (let row = 0; row < sh; row++) {
              const srcOffset = ((sy + row) * canvasWidth + sx) * 4;
              const dstOffset = row * sw * 4;
              regionData.set(pixels.subarray(srcOffset, srcOffset + sw * 4), dstOffset);
            }

            return {
              width: sw,
              height: sh,
              data: regionData,
            };
          },

          putImageData: function (imageData: { width: number; height: number; data: Uint8ClampedArray }, dx: number, dy: number) {
            const pixels = ensurePixelBuffer();
            const canvasWidth = element.width;
            const canvasHeight = element.height;
            const sx = Math.max(0, Math.floor(dx));
            const sy = Math.max(0, Math.floor(dy));
            for (let row = 0; row < imageData.height; row++) {
              const destY = sy + row;
              if (destY < 0 || destY >= canvasHeight) continue;
              for (let col = 0; col < imageData.width; col++) {
                const destX = sx + col;
                if (destX < 0 || destX >= canvasWidth) continue;
                const srcOffset = (row * imageData.width + col) * 4;
                const dstOffset = (destY * canvasWidth + destX) * 4;
                pixels[dstOffset] = imageData.data[srcOffset];
                pixels[dstOffset + 1] = imageData.data[srcOffset + 1];
                pixels[dstOffset + 2] = imageData.data[srcOffset + 2];
                pixels[dstOffset + 3] = imageData.data[srcOffset + 3];
              }
            }
          },

          // Path tracking for clip/fill/stroke
          _currentPath: [] as Array<{ type: string; x?: number; y?: number; w?: number; h?: number }>,

          beginPath: function () {
            this._currentPath = [];
          },
          closePath: function () { /* path segment, tracked in _currentPath */ },
          moveTo: function (_x: number, _y: number) { /* path segment */ },
          lineTo: function (_x: number, _y: number) { /* path segment */ },
          arc: function () { /* path segment */ },
          arcTo: function () { /* path segment */ },
          quadraticCurveTo: function () { /* path segment */ },
          bezierCurveTo: function () { /* path segment */ },
          rect: function (x: number, y: number, w: number, h: number) {
            this._currentPath.push({ type: "rect", x, y, w, h });
          },
          fill: function () { /* simplified — no general path fill */ },
          stroke: function () { /* simplified — no general path stroke */ },
          clip: function () {
            // Apply rectangular clip from last rect() call
            for (const seg of this._currentPath) {
              if (seg.type === "rect" && seg.x !== undefined) {
                const sw = seg.w ?? 0;
                const sh = seg.h ?? 0;
                // Transform all 4 corners for correct bounding box under rotation
                const [tx0, ty0] = transformPoint(seg.x!, seg.y!);
                const [tx1, ty1] = transformPoint(seg.x! + sw, seg.y!);
                const [tx2, ty2] = transformPoint(seg.x! + sw, seg.y! + sh);
                const [tx3, ty3] = transformPoint(seg.x!, seg.y! + sh);
                const newClip = {
                  x: Math.min(tx0, tx1, tx2, tx3),
                  y: Math.min(ty0, ty1, ty2, ty3),
                  width: Math.max(tx0, tx1, tx2, tx3) - Math.min(tx0, tx1, tx2, tx3),
                  height: Math.max(ty0, ty1, ty2, ty3) - Math.min(ty0, ty1, ty2, ty3),
                };
                if (currentClip) {
                  // Intersect with existing clip
                  const ix1 = Math.max(currentClip.x, newClip.x);
                  const iy1 = Math.max(currentClip.y, newClip.y);
                  const ix2 = Math.min(currentClip.x + currentClip.width, newClip.x + newClip.width);
                  const iy2 = Math.min(currentClip.y + currentClip.height, newClip.y + newClip.height);
                  currentClip = { x: ix1, y: iy1, width: Math.max(0, ix2 - ix1), height: Math.max(0, iy2 - iy1) };
                } else {
                  currentClip = newClip;
                }
              }
            }
          },

          save: function () {
            stateStack.push({
              fillStyle: this.fillStyle as string,
              strokeStyle: this.strokeStyle as string,
              lineWidth: this.lineWidth,
              font: this.font as string,
              textAlign: this.textAlign as string,
              textBaseline: this.textBaseline as string,
              globalAlpha: this.globalAlpha,
              globalCompositeOperation: this.globalCompositeOperation as string,
              shadowOffsetX: this.shadowOffsetX,
              shadowOffsetY: this.shadowOffsetY,
              shadowBlur: this.shadowBlur,
              shadowColor: this.shadowColor as string,
              transformMatrix: [...currentTransform] as [number, number, number, number, number, number],
              clipRegion: currentClip ? { ...currentClip } : null,
            });
          },

          restore: function () {
            const state = stateStack.pop();
            if (state) {
              this.fillStyle = state.fillStyle;
              this.strokeStyle = state.strokeStyle;
              this.lineWidth = state.lineWidth;
              this.font = state.font;
              this.textAlign = state.textAlign;
              this.textBaseline = state.textBaseline;
              this.globalAlpha = state.globalAlpha;
              this.globalCompositeOperation = state.globalCompositeOperation;
              this.shadowOffsetX = state.shadowOffsetX;
              this.shadowOffsetY = state.shadowOffsetY;
              this.shadowBlur = state.shadowBlur;
              this.shadowColor = state.shadowColor;
              currentTransform = state.transformMatrix;
              currentClip = state.clipRegion;
            }
          },

          translate: function (x: number, y: number) {
            currentTransform = multiplyMatrix(currentTransform, [1, 0, 0, 1, x, y]);
          },
          scale: function (x: number, y: number) {
            currentTransform = multiplyMatrix(currentTransform, [x, 0, 0, y, 0, 0]);
          },
          rotate: function (angle: number) {
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);
            currentTransform = multiplyMatrix(currentTransform, [cos, sin, -sin, cos, 0, 0]);
          },
          transform: function (a: number, b: number, c: number, d: number, e: number, f: number) {
            currentTransform = multiplyMatrix(currentTransform, [a, b, c, d, e, f]);
          },
          setTransform: function (a: number, b: number, c: number, d: number, e: number, f: number) {
            currentTransform = [a, b, c, d, e, f];
          },
          resetTransform: function () {
            currentTransform = [1, 0, 0, 1, 0, 0];
          },

          fillText: function (text: string, x: number, y: number) {
            // Software text rendering: render each character as a filled rectangle
            const fontMatch = (this.font as string).match(/(\d+(?:\.\d+)?)\s*px/);
            const fontSize = fontMatch ? parseFloat(fontMatch[1]) : 10;
            const charWidth = fontSize * 0.6;
            const charHeight = fontSize;

            const [r, g, b, colorA] = parseColor(this.fillStyle as string);
            const a = Math.round(colorA * this.globalAlpha);
            if (a === 0) return;

            const pixels = ensurePixelBuffer();
            const canvasWidth = element.width;
            const canvasHeight = element.height;

            // textAlign adjustment
            const totalWidth = text.length * charWidth;
            const align = (this.textAlign as string) || "start";
            let alignOffsetX = 0;
            if (align === "center") alignOffsetX = -totalWidth / 2;
            else if (align === "right" || align === "end") alignOffsetX = -totalWidth;

            // textBaseline adjustment
            const baseline = (this.textBaseline as string) || "alphabetic";
            let baselineOffset = charHeight * 0.8; // alphabetic default
            if (baseline === "top" || baseline === "hanging") baselineOffset = 0;
            else if (baseline === "middle") baselineOffset = charHeight * 0.4;
            else if (baseline === "bottom" || baseline === "ideographic") baselineOffset = charHeight;

            const startX = x + alignOffsetX;

            for (let i = 0; i < text.length; i++) {
              if (text.charCodeAt(i) === 32) continue;

              const cx = startX + i * charWidth;
              const cy = y - baselineOffset;

              // Transform all 4 corners for correct bounding box under rotation
              const [tx1, ty1] = transformPoint(cx, cy);
              const [tx2, ty2] = transformPoint(cx + charWidth, cy);
              const [tx3, ty3] = transformPoint(cx, cy + charHeight);
              const [tx4, ty4] = transformPoint(cx + charWidth, cy + charHeight);

              const px1 = Math.max(0, Math.floor(Math.min(tx1, tx2, tx3, tx4)));
              const py1 = Math.max(0, Math.floor(Math.min(ty1, ty2, ty3, ty4)));
              const px2 = Math.min(canvasWidth, Math.ceil(Math.max(tx1, tx2, tx3, tx4)));
              const py2 = Math.min(canvasHeight, Math.ceil(Math.max(ty1, ty2, ty3, ty4)));

              // For rotated transforms, use inverse-transform point-in-rect test
              const isIdentityish = currentTransform[1] === 0 && currentTransform[2] === 0;

              for (let py = py1; py < py2; py++) {
                for (let px = px1; px < px2; px++) {
                  if (!isIdentityish) {
                    const [ox, oy] = inverseTransformPoint(px, py);
                    if (ox < cx || ox >= cx + charWidth || oy < cy || oy >= cy + charHeight) continue;
                  }
                  const relX = px - px1;
                  const relY = py - py1;
                  const glyphW = px2 - px1;
                  const glyphH = py2 - py1;
                  if (glyphW < 3 || glyphH < 3) {
                    const offset = (py * canvasWidth + px) * 4;
                    blendPixel(pixels, offset, r, g, b, a);
                  } else {
                    if (relX > 0 && relX < glyphW - 1 && relY > 0 && relY < glyphH - 1) {
                      const offset = (py * canvasWidth + px) * 4;
                      blendPixel(pixels, offset, r, g, b, a);
                    }
                  }
                }
              }
            }
          },
          strokeText: function (text: string, x: number, y: number) {
            // Approximate stroke text via fill text with stroke color
            const savedFill = this.fillStyle;
            this.fillStyle = this.strokeStyle;
            this.fillText(text, x, y);
            this.fillStyle = savedFill;
          },
          measureText: function (text: string) {
            const fontMatch = (this.font as string).match(/(\d+(?:\.\d+)?)\s*px/);
            const fontSize = fontMatch ? parseFloat(fontMatch[1]) : 10;
            return { width: text.length * fontSize * 0.6 };
          },

          drawImage: function (..._args: unknown[]) {
            // Software drawImage supporting 3 Canvas API signatures:
            //   drawImage(source, dx, dy)
            //   drawImage(source, dx, dy, dw, dh)
            //   drawImage(source, sx, sy, sw, sh, dx, dy, dw, dh)
            if (_args.length < 3) return;

            const source = _args[0];
            let sx = 0, sy = 0, sw = 0, sh = 0;
            let dx: number, dy: number, dw: number, dh: number;

            const decoded = decodeImageSource(source);
            const srcW = decoded ? decoded.width : ((source as Record<string, unknown>)?.width as number) || 0;
            const srcH = decoded ? decoded.height : ((source as Record<string, unknown>)?.height as number) || 0;

            if (_args.length >= 9) {
              // 9-arg: source region → dest region
              sx = _args[1] as number; sy = _args[2] as number;
              sw = _args[3] as number; sh = _args[4] as number;
              dx = _args[5] as number; dy = _args[6] as number;
              dw = _args[7] as number; dh = _args[8] as number;
            } else if (_args.length >= 5) {
              // 5-arg: full source → dest region
              dx = _args[1] as number; dy = _args[2] as number;
              dw = _args[3] as number; dh = _args[4] as number;
              sw = srcW; sh = srcH;
            } else {
              // 3-arg: full source at natural size
              dx = _args[1] as number; dy = _args[2] as number;
              dw = srcW; dh = srcH;
              sw = srcW; sh = srcH;
            }

            if (!decoded || sw <= 0 || sh <= 0 || dw <= 0 || dh <= 0) {
              // No pixel data available — render gray placeholder
              const savedFill = this.fillStyle;
              this.fillStyle = "#c0c0c0";
              this.fillRect(dx, dy, dw || srcW || 100, dh || srcH || 100);
              this.fillStyle = savedFill;
              return;
            }

            // Blit source pixels to destination with scaling and alpha compositing
            const pixels = ensurePixelBuffer();
            const canvasWidth = element.width;
            const canvasHeight = element.height;
            const ga = this.globalAlpha as number;
            const srcPixels = decoded.pixels;

            // Transform destination corners to find pixel bounds
            const [tx0, ty0] = transformPoint(dx, dy);
            const [tx1, ty1] = transformPoint(dx + dw, dy);
            const [tx2, ty2] = transformPoint(dx, dy + dh);
            const [tx3, ty3] = transformPoint(dx + dw, dy + dh);

            const minPx = Math.max(0, Math.floor(Math.min(tx0, tx1, tx2, tx3)));
            const minPy = Math.max(0, Math.floor(Math.min(ty0, ty1, ty2, ty3)));
            const maxPx = Math.min(canvasWidth, Math.ceil(Math.max(tx0, tx1, tx2, tx3)));
            const maxPy = Math.min(canvasHeight, Math.ceil(Math.max(ty0, ty1, ty2, ty3)));

            const isIdentityish = currentTransform[1] === 0 && currentTransform[2] === 0;

            for (let py = minPy; py < maxPy; py++) {
              for (let px = minPx; px < maxPx; px++) {
                // Map canvas pixel back to destination-space coordinates
                let ox: number, oy: number;
                if (isIdentityish) {
                  ox = (px - currentTransform[4]) / currentTransform[0];
                  oy = (py - currentTransform[5]) / currentTransform[3];
                } else {
                  [ox, oy] = inverseTransformPoint(px, py);
                }

                // Check if within destination rect
                if (ox < dx || ox >= dx + dw || oy < dy || oy >= dy + dh) continue;

                // Map to source pixel coordinates
                const srcFracX = sx + ((ox - dx) / dw) * sw;
                const srcFracY = sy + ((oy - dy) / dh) * sh;
                const srcPx = Math.floor(srcFracX);
                const srcPy = Math.floor(srcFracY);

                if (srcPx < 0 || srcPx >= decoded.width || srcPy < 0 || srcPy >= decoded.height) continue;

                const srcIdx = (srcPy * decoded.width + srcPx) * 4;
                const r = srcPixels[srcIdx];
                const g = srcPixels[srcIdx + 1];
                const b = srcPixels[srcIdx + 2];
                const a = Math.round(srcPixels[srcIdx + 3] * ga);

                if (a === 0) continue;
                const dstOffset = (py * canvasWidth + px) * 4;
                blendPixel(pixels, dstOffset, r, g, b, a);
              }
            }
          },

          createImageData: function (width: number, height: number) {
            return { width, height, data: new Uint8ClampedArray(width * height * 4) };
          },
        };

        return context as unknown as CanvasRenderingContext2D;
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
 * Registry of created elements for getElementById lookups
 */
const createdElements: DOMElement[] = [];

/**
 * Wrapped createElement that tracks created elements
 */
function trackedCreateElement(tagName: string): DOMElement {
  const el = createElementFn(tagName);
  createdElements.push(el);
  return el;
}

/**
 * Match an element against a simple CSS selector (tag, #id, .class)
 */
function matchesSelector(el: DOMElement, selector: string): boolean {
  if (selector.startsWith("#")) {
    return el.id === selector.slice(1);
  }
  if (selector.startsWith(".")) {
    const cls = selector.slice(1);
    return el.className.split(/\s+/).includes(cls);
  }
  return el.tagName.toLowerCase() === selector.toLowerCase();
}

/**
 * Find elements matching a selector from a list
 */
function querySelectorFromList(selector: string): DOMElement[] {
  return createdElements.filter((el) => matchesSelector(el, selector));
}

// Create default body, head, and documentElement
const bodyElement = createElementFn("body");
const headElement = createElementFn("head");
const documentElement = createElementFn("html");

/**
 * Global document object
 */
export const document = {
  createElement: trackedCreateElement,

  getElementById(id: string): DOMElement | null {
    return createdElements.find((el) => el.id === id) ?? null;
  },

  querySelector(selector: string): DOMElement | null {
    const results = querySelectorFromList(selector);
    return results.length > 0 ? results[0] : null;
  },

  querySelectorAll(selector: string): DOMElement[] {
    return querySelectorFromList(selector);
  },

  createTextNode(text: string): DOMNode {
    return {
      nodeType: DOMNodeType.TEXT,
      nodeName: "#text",
      textContent: text,
      childNodes: [],
      parentNode: null,
      ownerDocument: null,
      appendChild() { return this; },
      removeChild() { return this; },
      insertBefore() { return this; },
      replaceChild() { return this; },
      cloneNode() { return { ...this }; },
      hasChildNodes() { return false; },
      contains() { return false; },
      normalize() {},
    } as unknown as DOMNode;
  },

  createDocumentFragment(): DOMNode {
    const children: DOMNode[] = [];
    return {
      nodeType: DOMNodeType.DOCUMENT_FRAGMENT,
      nodeName: "#document-fragment",
      textContent: "",
      childNodes: children,
      parentNode: null,
      ownerDocument: null,
      appendChild(child: DOMNode) { children.push(child); return child; },
      removeChild(child: DOMNode) {
        const idx = children.indexOf(child);
        if (idx >= 0) children.splice(idx, 1);
        return child;
      },
      insertBefore() { return this; },
      replaceChild() { return this; },
      cloneNode() { return { ...this }; },
      hasChildNodes() { return children.length > 0; },
      contains() { return false; },
      normalize() {},
    } as unknown as DOMNode;
  },

  body: bodyElement,
  head: headElement,
  documentElement: documentElement,
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
