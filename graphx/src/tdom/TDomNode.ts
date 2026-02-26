/**
 * TDOM - Terminal DOM for GraphX
 * Box-drawing borders, ANSI colors, and row/column layout for terminal output.
 */

export type TDomLayout = "row" | "column";
export type TDomBorder = "none" | "single" | "double" | "rounded";

export interface TDomStyle {
  fg?: string;
  bg?: string;
  bold?: boolean;
  dim?: boolean;
  border?: TDomBorder;
  padding?: number;
}

const FG_COLORS: Record<string, number> = {
  black: 30, red: 31, green: 32, yellow: 33,
  blue: 34, magenta: 35, cyan: 36, white: 37,
};

const BG_COLORS: Record<string, number> = {
  black: 40, red: 41, green: 42, yellow: 43,
  blue: 44, magenta: 45, cyan: 46, white: 47,
};

const BORDER_CHARS: Record<string, { tl: string; tr: string; bl: string; br: string; h: string; v: string }> = {
  single:  { tl: "┌", tr: "┐", bl: "└", br: "┘", h: "─", v: "│" },
  double:  { tl: "╔", tr: "╗", bl: "╚", br: "╝", h: "═", v: "║" },
  rounded: { tl: "╭", tr: "╮", bl: "╰", br: "╯", h: "─", v: "│" },
};

function stripAnsi(s: string): number {
  return s.replace(/\x1b\[[0-9;]*m/g, "").length;
}

function applyAnsi(text: string, style: TDomStyle): string {
  const codes: number[] = [];
  if (style.bold) codes.push(1);
  if (style.dim) codes.push(2);
  if (style.fg && FG_COLORS[style.fg] !== undefined) codes.push(FG_COLORS[style.fg]);
  if (style.bg && BG_COLORS[style.bg] !== undefined) codes.push(BG_COLORS[style.bg]);
  if (codes.length === 0) return text;
  return `\x1b[${codes.join(";")}m${text}\x1b[0m`;
}

function padRight(line: string, targetVisual: number): string {
  const visual = stripAnsi(line);
  if (visual >= targetVisual) return line;
  return line + " ".repeat(targetVisual - visual);
}

function truncateLine(line: string, maxVisual: number): string {
  const plain = line.replace(/\x1b\[[0-9;]*m/g, "");
  if (plain.length <= maxVisual) return line;
  // Walk through keeping track of visible chars
  let visible = 0;
  let result = "";
  let i = 0;
  const raw = line;
  while (i < raw.length && visible < maxVisual) {
    if (raw[i] === "\x1b") {
      const end = raw.indexOf("m", i);
      if (end !== -1) {
        result += raw.slice(i, end + 1);
        i = end + 1;
        continue;
      }
    }
    result += raw[i];
    visible++;
    i++;
  }
  // Close any open ANSI
  if (result.includes("\x1b[") && !result.endsWith("\x1b[0m")) {
    result += "\x1b[0m";
  }
  return result;
}

export class TDomNode {
  children: TDomNode[];
  text?: string;
  layout: TDomLayout;
  style: TDomStyle;

  constructor(options: { children?: TDomNode[]; text?: string; layout?: TDomLayout; style?: TDomStyle }) {
    this.children = options.children ?? [];
    this.text = options.text;
    this.layout = options.layout ?? "column";
    this.style = options.style ?? {};
  }

  static text(content: string, style?: TDomStyle): TDomNode {
    return new TDomNode({ text: content, style });
  }

  static box(children: TDomNode[], style?: TDomStyle): TDomNode {
    return new TDomNode({ children, style });
  }

  static row(children: TDomNode[]): TDomNode {
    return new TDomNode({ children, layout: "row" });
  }

  static column(children: TDomNode[]): TDomNode {
    return new TDomNode({ children, layout: "column" });
  }

  getWidth(): number {
    let w: number;
    if (this.text !== undefined) {
      w = this.text.length;
    } else if (this.children.length === 0) {
      w = 0;
    } else if (this.layout === "row") {
      w = this.children.reduce((sum, c) => sum + c.getWidth(), 0);
    } else {
      w = Math.max(...this.children.map(c => c.getWidth()));
    }
    const pad = this.style.padding ?? 0;
    w += pad * 2;
    const border = this.style.border ?? "none";
    if (border !== "none") w += 2; // left + right border chars
    return w;
  }

  getHeight(): number {
    let h: number;
    if (this.text !== undefined) {
      h = 1;
    } else if (this.children.length === 0) {
      h = 0;
    } else if (this.layout === "row") {
      h = Math.max(...this.children.map(c => c.getHeight()));
    } else {
      h = this.children.reduce((sum, c) => sum + c.getHeight(), 0);
    }
    const pad = this.style.padding ?? 0;
    h += pad * 2;
    const border = this.style.border ?? "none";
    if (border !== "none") h += 2; // top + bottom border lines
    return h;
  }

  render(maxWidth?: number): string[] {
    let lines: string[];

    if (this.text !== undefined) {
      const styled = applyAnsi(this.text, this.style);
      lines = [styled];
    } else if (this.children.length === 0) {
      lines = [];
    } else if (this.layout === "row") {
      lines = this._renderRow(maxWidth);
    } else {
      lines = this._renderColumn(maxWidth);
    }

    // Apply padding
    const pad = this.style.padding ?? 0;
    if (pad > 0) {
      const contentWidth = lines.length > 0 ? Math.max(...lines.map(l => stripAnsi(l))) : 0;
      const padStr = " ".repeat(pad);
      const emptyLine = " ".repeat(contentWidth + pad * 2);
      const padded: string[] = [];
      for (let i = 0; i < pad; i++) padded.push(emptyLine);
      for (const line of lines) {
        padded.push(padStr + padRight(line, contentWidth) + padStr);
      }
      for (let i = 0; i < pad; i++) padded.push(emptyLine);
      lines = padded;
    }

    // Apply border
    const border = this.style.border ?? "none";
    if (border !== "none") {
      const chars = BORDER_CHARS[border];
      const innerWidth = lines.length > 0 ? Math.max(...lines.map(l => stripAnsi(l))) : 0;
      const bordered: string[] = [];
      bordered.push(chars.tl + chars.h.repeat(innerWidth) + chars.tr);
      for (const line of lines) {
        bordered.push(chars.v + padRight(line, innerWidth) + chars.v);
      }
      bordered.push(chars.bl + chars.h.repeat(innerWidth) + chars.br);
      lines = bordered;
    }

    // Apply maxWidth truncation
    if (maxWidth !== undefined) {
      lines = lines.map(l => truncateLine(l, maxWidth));
    }

    return lines;
  }

  private _renderColumn(_maxWidth?: number): string[] {
    const allLines: string[] = [];
    const maxW = this.children.length > 0 ? Math.max(...this.children.map(c => c.getWidth())) : 0;
    for (const child of this.children) {
      const childLines = child.render();
      for (const line of childLines) {
        allLines.push(padRight(line, maxW));
      }
    }
    return allLines;
  }

  private _renderRow(_maxWidth?: number): string[] {
    const rendered = this.children.map(c => {
      const lines = c.render();
      const w = c.getWidth();
      return { lines, w };
    });
    const maxH = Math.max(...rendered.map(r => r.lines.length), 0);
    const result: string[] = [];
    for (let row = 0; row < maxH; row++) {
      let line = "";
      for (const r of rendered) {
        const src = row < r.lines.length ? r.lines[row] : "";
        line += padRight(src, r.w);
      }
      result.push(line);
    }
    return result;
  }
}
