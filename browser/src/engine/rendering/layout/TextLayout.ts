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
     * Measure text width
     * Simplified implementation - real browsers use font metrics
     */
    private measureText(text: string): Pixels {
        // Estimate based on font size
        const avgCharWidth = this.options.fontSize * 0.6;
        return (text.length * avgCharWidth) as Pixels;
    }

    /**
     * Create line box from text runs
     */
    private createLineBox(runs: TextRun[], width: Pixels): LineBox {
        return {
            runs,
            width,
            height: this.options.lineHeight,
            baseline: (this.options.lineHeight * 0.8) as Pixels, // Approximate baseline
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
