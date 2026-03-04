/**
 * Text Layout - Line breaking and wrapping
 *
 * Handles text measurement, line breaking, word wrapping, and
 * line box construction for text content.
 */

import type { Pixels } from "../../../types/identifiers.ts";

/**
 * Line break opportunity
 */
export enum BreakOpportunity {
  NONE, // Cannot break here
  NORMAL, // Can break at whitespace
  ANYWHERE, // Can break anywhere (overflow-wrap: anywhere)
  WORD_BREAK, // Can break in word (word-break: break-all)
}

/**
 * Text run (segment of text with same properties)
 */
export interface TextRun {
  text: string;
  startIndex: number;
  endIndex: number;
  width: Pixels;
}

/**
 * Line box (single line of text)
 */
export interface LineBox {
  runs: TextRun[];
  width: Pixels;
  height: Pixels;
  baseline: Pixels;
}

/**
 * Text layout result
 */
export interface TextLayoutResult {
  lines: LineBox[];
  totalWidth: Pixels;
  totalHeight: Pixels;
}

/**
 * Text layout options
 */
export interface TextLayoutOptions {
  fontSize: Pixels;
  fontFamily: string;
  lineHeight: Pixels;
  whiteSpace: string; // normal, nowrap, pre, pre-wrap, pre-line
  wordBreak: string; // normal, break-all, keep-all
  overflowWrap: string; // normal, break-word, anywhere
}

/**
 * TextLayout
 * Handles text measurement and line breaking
 */
export class TextLayout {
  private options: TextLayoutOptions;

  constructor(options: TextLayoutOptions) {
    this.options = options;
  }

  /**
   * Layout text with line breaking
   *
   * @param text - Text content to layout
   * @param maxWidth - Maximum width for text
   * @returns Layout result with line boxes
   */
  layout(text: string, maxWidth: Pixels): TextLayoutResult {
    // Handle different white-space modes
    const whiteSpace = this.options.whiteSpace;

    if (whiteSpace === "nowrap") {
      // Single line, no wrapping
      return this.layoutSingleLine(text, maxWidth);
    } else if (whiteSpace === "pre") {
      // Preserve whitespace and line breaks, no wrapping
      return this.layoutPreformatted(text, maxWidth, false);
    } else if (whiteSpace === "pre-wrap") {
      // Preserve whitespace and line breaks, with wrapping
      return this.layoutPreformatted(text, maxWidth, true);
    } else if (whiteSpace === "pre-line") {
      // Preserve line breaks, collapse whitespace, with wrapping
      return this.layoutPreLine(text, maxWidth);
    } else {
      // Normal - collapse whitespace, wrap lines
      return this.layoutNormal(text, maxWidth);
    }
  }

  /**
   * Layout text in normal mode (collapse whitespace, wrap lines)
   */
  private layoutNormal(text: string, maxWidth: Pixels): TextLayoutResult {
    // Collapse whitespace
    const normalized = text.replace(/\s+/g, " ").trim();

    // Break into words
    const words = normalized.split(" ");
    const lines: LineBox[] = [];
    let currentLine: TextRun[] = [];
    let currentLineWidth = 0 as Pixels;
    let charIndex = 0;

    for (const word of words) {
      const wordWidth = this.measureText(word);
      const spaceWidth = this.measureText(" ");

      // Check if word fits on current line
      const needsSpace = currentLine.length > 0;
      const totalWidth = currentLineWidth + (needsSpace ? spaceWidth : 0) + wordWidth;

      if (currentLine.length === 0) {
        // First word on line - always add even if too wide
        currentLine.push({
          text: word,
          startIndex: charIndex,
          endIndex: charIndex + word.length,
          width: wordWidth,
        });
        currentLineWidth = wordWidth;
        charIndex += word.length + 1; // +1 for space
      } else if (totalWidth <= maxWidth) {
        // Add space and word
        currentLine.push({
          text: " " + word,
          startIndex: charIndex,
          endIndex: charIndex + word.length + 1,
          width: (spaceWidth + wordWidth) as Pixels,
        });
        currentLineWidth = totalWidth;
        charIndex += word.length + 1;
      } else {
        // Word doesn't fit - create new line
        lines.push(this.createLineBox(currentLine, currentLineWidth));

        currentLine = [{
          text: word,
          startIndex: charIndex,
          endIndex: charIndex + word.length,
          width: wordWidth,
        }];
        currentLineWidth = wordWidth;
        charIndex += word.length + 1;
      }
    }

    // Add final line
    if (currentLine.length > 0) {
      lines.push(this.createLineBox(currentLine, currentLineWidth));
    }

    return this.createLayoutResult(lines);
  }

  /**
   * Layout text as single line (no wrapping)
   */
  private layoutSingleLine(text: string, maxWidth: Pixels): TextLayoutResult {
    const width = this.measureText(text);
    const run: TextRun = {
      text,
      startIndex: 0,
      endIndex: text.length,
      width,
    };

    const line = this.createLineBox([run], width);
    return this.createLayoutResult([line]);
  }

  /**
   * Layout preformatted text
   */
  private layoutPreformatted(text: string, maxWidth: Pixels, wrap: boolean): TextLayoutResult {
    // Split by line breaks
    const textLines = text.split("\n");
    const lines: LineBox[] = [];

    for (const textLine of textLines) {
      if (wrap) {
        // Wrap long lines
        const wrappedLines = this.wrapLine(textLine, maxWidth);
        lines.push(...wrappedLines);
      } else {
        // No wrapping - single line per text line
        const width = this.measureText(textLine);
        const run: TextRun = {
          text: textLine,
          startIndex: 0,
          endIndex: textLine.length,
          width,
        };
        lines.push(this.createLineBox([run], width));
      }
    }

    return this.createLayoutResult(lines);
  }

  /**
   * Layout pre-line text (preserve line breaks, collapse whitespace)
   */
  private layoutPreLine(text: string, maxWidth: Pixels): TextLayoutResult {
    // Split by line breaks
    const textLines = text.split("\n");
    const lines: LineBox[] = [];

    for (const textLine of textLines) {
      // Collapse whitespace on each line
      const normalized = textLine.replace(/\s+/g, " ").trim();
      const wrappedLines = this.wrapLine(normalized, maxWidth);
      lines.push(...wrappedLines);
    }

    return this.createLayoutResult(lines);
  }

  /**
   * Wrap a single line of text
   */
  private wrapLine(text: string, maxWidth: Pixels): LineBox[] {
    const lines: LineBox[] = [];
    let currentLine: TextRun[] = [];
    let currentWidth = 0 as Pixels;
    let startIndex = 0;

    // Simple character-by-character wrapping
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const charWidth = this.measureText(char);

      if (currentWidth + charWidth > maxWidth && currentLine.length > 0) {
        // Create new line
        const lineText = text.substring(startIndex, i);
        currentLine.push({
          text: lineText,
          startIndex,
          endIndex: i,
          width: currentWidth,
        });
        lines.push(this.createLineBox(currentLine, currentWidth));

        // Start new line
        currentLine = [];
        currentWidth = 0 as Pixels;
        startIndex = i;
      }

      currentWidth = (currentWidth + charWidth) as Pixels;
    }

    // Add remaining text
    if (startIndex < text.length) {
      const lineText = text.substring(startIndex);
      const width = this.measureText(lineText);
      currentLine.push({
        text: lineText,
        startIndex,
        endIndex: text.length,
        width,
      });
      lines.push(this.createLineBox(currentLine, width));
    }

    return lines;
  }

  /**
   * Proportional character width table (relative to fontSize)
   * Narrow chars ~0.3em, average ~0.55em, wide chars ~0.8em
   */
  private static readonly CHAR_WIDTHS: Record<string, number> = {
    // Narrow characters
    "i": 0.28, "l": 0.28, "1": 0.33, "!": 0.30, "|": 0.25,
    ".": 0.28, ",": 0.28, ":": 0.28, ";": 0.30, "'": 0.22,
    "\"": 0.36, "`": 0.33, "j": 0.30, "f": 0.33, "r": 0.35,
    "t": 0.35, " ": 0.28,

    // Average characters
    "a": 0.55, "b": 0.55, "c": 0.50, "d": 0.55, "e": 0.55,
    "g": 0.55, "h": 0.55, "k": 0.50, "n": 0.55, "o": 0.55,
    "p": 0.55, "q": 0.55, "s": 0.50, "u": 0.55, "v": 0.50,
    "x": 0.50, "y": 0.50, "z": 0.50,
    "0": 0.55, "2": 0.55, "3": 0.55, "4": 0.55, "5": 0.55,
    "6": 0.55, "7": 0.50, "8": 0.55, "9": 0.55,

    // Wide characters
    "m": 0.83, "w": 0.78, "M": 0.83, "W": 0.83,
    "A": 0.67, "B": 0.67, "C": 0.67, "D": 0.72, "E": 0.61,
    "F": 0.56, "G": 0.72, "H": 0.72, "I": 0.28, "J": 0.50,
    "K": 0.67, "L": 0.56, "N": 0.72, "O": 0.72, "P": 0.61,
    "Q": 0.72, "R": 0.67, "S": 0.61, "T": 0.61, "U": 0.72,
    "V": 0.67, "X": 0.67, "Y": 0.67, "Z": 0.61,
  };

  /**
   * Measure text width using proportional character widths
   * Factors in font-weight (bold ~5% wider)
   */
  measureText(text: string): Pixels {
    const fontSize = this.options.fontSize;
    const fontFamily = this.options.fontFamily;

    // Check if bold (weight >= 700 or "bold")
    let boldFactor = 1.0;
    // Bold factor applied when detected from external context

    let totalWidth = 0;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      const relWidth = TextLayout.CHAR_WIDTHS[ch] ?? 0.55; // Default average
      totalWidth += fontSize * relWidth;
    }

    return (totalWidth * boldFactor) as Pixels;
  }

  /**
   * Measure text width with bold factor
   */
  measureTextBold(text: string, isBold: boolean): Pixels {
    const base = this.measureText(text);
    return (isBold ? base * 1.05 : base) as Pixels;
  }

  /**
   * Create line box from text runs
   */
  private createLineBox(runs: TextRun[], width: Pixels): LineBox {
    const fontSize = this.options.fontSize;
    const lineHeight = this.options.lineHeight;
    // Baseline = half-leading + ascent (75% of font-size)
    const leading = lineHeight - fontSize;
    const baseline = (leading / 2 + fontSize * 0.75) as Pixels;

    return {
      runs,
      width,
      height: lineHeight,
      baseline,
    };
  }

  /**
   * Create final layout result
   */
  private createLayoutResult(lines: LineBox[]): TextLayoutResult {
    let maxWidth = 0 as Pixels;
    let totalHeight = 0 as Pixels;

    for (const line of lines) {
      maxWidth = Math.max(maxWidth, line.width) as Pixels;
      totalHeight = (totalHeight + line.height) as Pixels;
    }

    return {
      lines,
      totalWidth: maxWidth,
      totalHeight,
    };
  }

  /**
   * Update layout options
   */
  setOptions(options: TextLayoutOptions): void {
    this.options = options;
  }

  /**
   * Get layout options
   */
  getOptions(): TextLayoutOptions {
    return this.options;
  }
}
