/**
 * MIME Type Utilities
 *
 * Detect and handle MIME types
 */

/**
 * Common MIME types by extension
 */
const MIME_TYPES: Record<string, string> = {
  // Text
  txt: "text/plain",
  html: "text/html",
  htm: "text/html",
  css: "text/css",
  js: "application/javascript",
  mjs: "application/javascript",
  json: "application/json",
  xml: "application/xml",
  csv: "text/csv",
  md: "text/markdown",

  // Images
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  svg: "image/svg+xml",
  webp: "image/webp",
  ico: "image/x-icon",
  bmp: "image/bmp",
  tiff: "image/tiff",

  // Audio
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  m4a: "audio/mp4",
  flac: "audio/flac",

  // Video
  mp4: "video/mp4",
  webm: "video/webm",
  avi: "video/x-msvideo",
  mov: "video/quicktime",
  mkv: "video/x-matroska",

  // Fonts
  woff: "font/woff",
  woff2: "font/woff2",
  ttf: "font/ttf",
  otf: "font/otf",
  eot: "application/vnd.ms-fontobject",

  // Documents
  pdf: "application/pdf",
  doc: "application/msword",
  docx:
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx:
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",

  // Archives
  zip: "application/zip",
  tar: "application/x-tar",
  gz: "application/gzip",
  rar: "application/vnd.rar",
  "7z": "application/x-7z-compressed",

  // Application
  wasm: "application/wasm",
  bin: "application/octet-stream",
};

/**
 * Get MIME type from file extension
 */
export function getMimeType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  return ext ? MIME_TYPES[ext] || "application/octet-stream" : "application/octet-stream";
}

/**
 * Get extension from MIME type
 */
export function getExtension(mimeType: string): string | undefined {
  const normalized = mimeType.toLowerCase().split(";")[0].trim();

  for (const [ext, mime] of Object.entries(MIME_TYPES)) {
    if (mime === normalized) {
      return ext;
    }
  }

  return undefined;
}

/**
 * Check if MIME type is text-based
 */
export function isTextMimeType(mimeType: string): boolean {
  const normalized = mimeType.toLowerCase().split(";")[0].trim();

  return (
    normalized.startsWith("text/") ||
    normalized === "application/json" ||
    normalized === "application/xml" ||
    normalized === "application/javascript" ||
    normalized.endsWith("+xml") ||
    normalized.endsWith("+json")
  );
}

/**
 * Check if MIME type is binary
 */
export function isBinaryMimeType(mimeType: string): boolean {
  return !isTextMimeType(mimeType);
}

/**
 * Check if MIME type is image
 */
export function isImageMimeType(mimeType: string): boolean {
  const normalized = mimeType.toLowerCase().split(";")[0].trim();
  return normalized.startsWith("image/");
}

/**
 * Check if MIME type is video
 */
export function isVideoMimeType(mimeType: string): boolean {
  const normalized = mimeType.toLowerCase().split(";")[0].trim();
  return normalized.startsWith("video/");
}

/**
 * Check if MIME type is audio
 */
export function isAudioMimeType(mimeType: string): boolean {
  const normalized = mimeType.toLowerCase().split(";")[0].trim();
  return normalized.startsWith("audio/");
}

/**
 * Check if MIME type is font
 */
export function isFontMimeType(mimeType: string): boolean {
  const normalized = mimeType.toLowerCase().split(";")[0].trim();
  return normalized.startsWith("font/") ||
    normalized === "application/vnd.ms-fontobject";
}

/**
 * Check if MIME type is archive
 */
export function isArchiveMimeType(mimeType: string): boolean {
  const normalized = mimeType.toLowerCase().split(";")[0].trim();
  const archiveTypes = [
    "application/zip",
    "application/x-tar",
    "application/gzip",
    "application/vnd.rar",
    "application/x-7z-compressed",
  ];
  return archiveTypes.includes(normalized);
}

/**
 * Detect MIME type from content (magic numbers)
 */
export function detectMimeType(content: Uint8Array): string | undefined {
  if (content.length < 4) {
    return undefined;
  }

  // PNG
  if (
    content[0] === 0x89 && content[1] === 0x50 && content[2] === 0x4e &&
    content[3] === 0x47
  ) {
    return "image/png";
  }

  // JPEG
  if (content[0] === 0xff && content[1] === 0xd8 && content[2] === 0xff) {
    return "image/jpeg";
  }

  // GIF
  if (
    content[0] === 0x47 && content[1] === 0x49 && content[2] === 0x46 &&
    content[3] === 0x38
  ) {
    return "image/gif";
  }

  // PDF
  if (
    content[0] === 0x25 && content[1] === 0x50 && content[2] === 0x44 &&
    content[3] === 0x46
  ) {
    return "application/pdf";
  }

  // ZIP
  if (content[0] === 0x50 && content[1] === 0x4b) {
    return "application/zip";
  }

  // GZIP
  if (content[0] === 0x1f && content[1] === 0x8b) {
    return "application/gzip";
  }

  // WebP
  if (
    content[0] === 0x52 && content[1] === 0x49 && content[2] === 0x46 &&
    content[3] === 0x46 &&
    content[8] === 0x57 && content[9] === 0x45 && content[10] === 0x42 &&
    content[11] === 0x50
  ) {
    return "image/webp";
  }

  // BMP
  if (content[0] === 0x42 && content[1] === 0x4d) {
    return "image/bmp";
  }

  // WASM
  if (
    content[0] === 0x00 && content[1] === 0x61 && content[2] === 0x73 &&
    content[3] === 0x6d
  ) {
    return "application/wasm";
  }

  return undefined;
}

/**
 * Parse MIME type into components
 */
export interface ParsedMimeType {
  type: string;
  subtype: string;
  parameters: Record<string, string>;
}

export function parseMimeType(mimeType: string): ParsedMimeType {
  const [typeSubtype, ...paramParts] = mimeType.split(";");
  const [type, subtype] = typeSubtype.trim().split("/");

  const parameters: Record<string, string> = {};
  for (const part of paramParts) {
    const [key, value] = part.trim().split("=");
    if (key && value) {
      parameters[key.toLowerCase()] = value.replace(/^["']|["']$/g, "");
    }
  }

  return {
    type: type?.trim() || "",
    subtype: subtype?.trim() || "",
    parameters,
  };
}

/**
 * Format MIME type from components
 */
export function formatMimeType(parsed: ParsedMimeType): string {
  let result = `${parsed.type}/${parsed.subtype}`;

  for (const [key, value] of Object.entries(parsed.parameters)) {
    const quotedValue = /[,;=\s]/.test(value) ? `"${value}"` : value;
    result += `; ${key}=${quotedValue}`;
  }

  return result;
}

/**
 * Get charset from MIME type
 */
export function getCharset(mimeType: string): string | undefined {
  const parsed = parseMimeType(mimeType);
  return parsed.parameters.charset;
}

/**
 * Set charset in MIME type
 */
export function setCharset(mimeType: string, charset: string): string {
  const parsed = parseMimeType(mimeType);
  parsed.parameters.charset = charset;
  return formatMimeType(parsed);
}

/**
 * Check if MIME types match (ignoring parameters)
 */
export function mimeTypeMatches(
  mimeType1: string,
  mimeType2: string,
): boolean {
  const parsed1 = parseMimeType(mimeType1);
  const parsed2 = parseMimeType(mimeType2);

  return parsed1.type === parsed2.type && parsed1.subtype === parsed2.subtype;
}
