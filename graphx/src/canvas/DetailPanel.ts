import type { CanvasTheme, StageNode } from "./types.ts";

export class DetailPanel {
  private container: HTMLElement;
  private theme: CanvasTheme;
  private currentStageId: string | null = null;

  constructor(container: HTMLElement, theme: CanvasTheme) {
    this.container = container;
    this.theme = theme;
  }

  setTheme(theme: CanvasTheme): void {
    this.theme = theme;
  }

  showStage(stage: StageNode): void {
    this.currentStageId = stage.id;
    this.container.innerHTML = "";
    this.container.classList.add("visible");
    this.applyPanelStyles();

    // Header: status dot + stage name + duration
    const header = this.createHeader(stage);
    this.container.appendChild(header);

    // Separator
    this.container.appendChild(this.createSeparator());

    // Output summary
    const summary = this.createSection("Output", stage.outputSummary);
    this.container.appendChild(summary);

    // Output data (the actual stage artifact)
    if (stage.outputData !== null && stage.outputData !== undefined) {
      const dataSection = this.createDataSection(stage);
      this.container.appendChild(dataSection);
    }

    // Separator
    this.container.appendChild(this.createSeparator());

    // Metrics
    if (Object.keys(stage.metrics).length > 0) {
      const metrics = this.createMetricsSection(stage.metrics);
      this.container.appendChild(metrics);
    }

    // Error (if any)
    if (stage.error) {
      const errorSection = this.createErrorSection(stage.error);
      this.container.appendChild(errorSection);
    }
  }

  hide(): void {
    this.currentStageId = null;
    this.container.innerHTML = "";
    this.container.classList.remove("visible");
  }

  get selectedStageId(): string | null {
    return this.currentStageId;
  }

  private applyPanelStyles(): void {
    // Apply theme colors to container
    this.container.style.backgroundColor = this.theme.panel.background;
    this.container.style.borderColor = this.theme.panel.border;
    this.container.style.color = this.theme.panel.text;
    this.container.style.border = `1px solid ${this.theme.panel.border}`;
    this.container.style.borderRadius = "8px";
    this.container.style.padding = "12px";
    this.container.style.fontFamily = this.theme.panel.codeFont;
    this.container.style.fontSize = "12px";
    this.container.style.overflowY = "auto";
  }

  private createHeader(stage: StageNode): HTMLElement {
    const header = document.createElement("div");
    header.style.display = "flex";
    header.style.alignItems = "center";
    header.style.justifyContent = "space-between";
    header.style.marginBottom = "8px";

    // Status dot + name
    const left = document.createElement("span");
    const dotColor = this.getStatusColor(stage.status);
    left.innerHTML =
      `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${this.escapeHtml(dotColor)};margin-right:6px;vertical-align:middle"></span><strong>${this.escapeHtml(stage.stage)}</strong>`;

    // Duration
    const right = document.createElement("span");
    right.style.color = this.theme.timing.textColor;
    right.textContent = `${stage.timing.duration}ms`;

    header.appendChild(left);
    header.appendChild(right);
    return header;
  }

  private createSeparator(): HTMLElement {
    const hr = document.createElement("hr");
    hr.style.border = "none";
    hr.style.borderTop = `1px solid ${this.theme.panel.border}`;
    hr.style.margin = "8px 0";
    return hr;
  }

  private createSection(title: string, content: string): HTMLElement {
    const div = document.createElement("div");
    div.style.marginBottom = "8px";
    div.innerHTML = `<div style="font-weight:bold;margin-bottom:4px">${this.escapeHtml(title)}</div><div>${this.escapeHtml(content)}</div>`;
    return div;
  }

  private createDataSection(stage: StageNode): HTMLElement {
    const div = document.createElement("div");
    div.style.marginBottom = "8px";

    const data = stage.outputData;

    // Type-aware rendering based on stage pipeline and name
    if (this.isDOMNode(data)) {
      div.appendChild(this.renderDOMTree(data));
    } else if (this.isHTTPLike(data)) {
      div.appendChild(this.renderHTTPData(data));
    } else if (this.isLayoutBox(data)) {
      div.appendChild(this.renderLayoutTree(data));
    } else if (Array.isArray(data)) {
      div.appendChild(this.renderArrayData(data));
    } else if (typeof data === "object" && data !== null) {
      div.appendChild(this.renderObjectTree(data as Record<string, unknown>));
    } else {
      const pre = document.createElement("pre");
      pre.style.margin = "0";
      pre.style.whiteSpace = "pre-wrap";
      pre.style.wordBreak = "break-all";
      pre.textContent = String(data);
      div.appendChild(pre);
    }

    return div;
  }

  // DOM tree rendering (DOMNode with childNodes)
  private isDOMNode(data: unknown): data is { nodeName: string; childNodes?: unknown[] } {
    return typeof data === "object" && data !== null && "nodeName" in data;
  }

  private renderDOMTree(
    node: {
      nodeName: string;
      nodeType?: number;
      nodeValue?: string;
      childNodes?: unknown[];
      attributes?: unknown;
    },
    depth = 0,
    maxDepth = 15,
  ): HTMLElement {
    const div = document.createElement("div");
    div.style.paddingLeft = `${depth * 16}px`;
    if (depth >= maxDepth) {
      div.textContent = "...";
      return div;
    }
    div.style.cursor = "pointer";

    const hasChildren = Array.isArray(node.childNodes) && node.childNodes.length > 0;
    const arrow = hasChildren ? "\u25bc " : "\u25b6 ";
    const name = this.escapeHtml(node.nodeName || "unknown");
    const value = node.nodeValue
      ? ` "${this.escapeHtml(this.truncate(node.nodeValue, 40))}"`
      : "";

    div.innerHTML = `<span style="color:${this.theme.panel.text}">${arrow}${name}${value}</span>`;

    if (hasChildren) {
      const childContainer = document.createElement("div");
      for (const child of node.childNodes!) {
        if (this.isDOMNode(child)) {
          childContainer.appendChild(this.renderDOMTree(child, depth + 1));
        }
      }
      div.appendChild(childContainer);
    }

    return div;
  }

  // HTTP data rendering (headers table)
  private isHTTPLike(
    data: unknown,
  ): data is {
    headers: Record<string, string> | Map<string, string>;
    statusCode?: number;
    method?: string;
  } {
    return typeof data === "object" && data !== null && "headers" in data;
  }

  private renderHTTPData(data: {
    headers: Record<string, string> | Map<string, string>;
    statusCode?: number;
    statusText?: string;
    method?: string;
    url?: string;
  }): HTMLElement {
    const div = document.createElement("div");

    if (data.statusCode !== undefined) {
      const status = document.createElement("div");
      status.style.fontWeight = "bold";
      status.style.marginBottom = "4px";
      status.textContent = `${data.statusCode} ${data.statusText || ""}`;
      div.appendChild(status);
    }

    if (data.method && data.url) {
      const req = document.createElement("div");
      req.style.fontWeight = "bold";
      req.style.marginBottom = "4px";
      req.textContent = `${data.method} ${data.url}`;
      div.appendChild(req);
    }

    const headersTitle = document.createElement("div");
    headersTitle.style.fontWeight = "bold";
    headersTitle.style.marginTop = "8px";
    headersTitle.style.marginBottom = "4px";
    headersTitle.textContent = "Headers:";
    div.appendChild(headersTitle);

    const headers = data.headers instanceof Map
      ? Object.fromEntries(data.headers)
      : data.headers;

    for (const [key, val] of Object.entries(headers)) {
      const row = document.createElement("div");
      row.style.paddingLeft = "12px";
      row.textContent = `${key}: ${val}`;
      div.appendChild(row);
    }

    return div;
  }

  // Layout box tree rendering
  private isLayoutBox(
    data: unknown,
  ): data is { type: string; width: number; height: number; children?: unknown[] } {
    return (
      typeof data === "object" &&
      data !== null &&
      "width" in data &&
      "height" in data &&
      "type" in data
    );
  }

  private renderLayoutTree(
    box: {
      type: string;
      width: number;
      height: number;
      x?: number;
      y?: number;
      text?: string;
      children?: unknown[];
    },
    depth = 0,
    maxDepth = 15,
  ): HTMLElement {
    const div = document.createElement("div");
    div.style.paddingLeft = `${depth * 16}px`;
    if (depth >= maxDepth) {
      div.textContent = "...";
      return div;
    }

    const hasChildren = Array.isArray(box.children) && box.children.length > 0;
    const arrow = hasChildren ? "\u25bc " : "\u25b6 ";
    const dims = `${Math.round(box.width)}\u00d7${Math.round(box.height)}`;
    const text = box.text ? ` "${this.escapeHtml(this.truncate(box.text, 30))}"` : "";

    div.innerHTML = `<span>${arrow}${this.escapeHtml(box.type)} ${dims}${text}</span>`;

    if (hasChildren) {
      const childContainer = document.createElement("div");
      for (const child of box.children!) {
        if (this.isLayoutBox(child)) {
          childContainer.appendChild(this.renderLayoutTree(child, depth + 1));
        }
      }
      div.appendChild(childContainer);
    }

    return div;
  }

  // Array data rendering (for query results, display lists, etc.)
  private renderArrayData(data: unknown[]): HTMLElement {
    const div = document.createElement("div");
    const title = document.createElement("div");
    title.style.fontWeight = "bold";
    title.style.marginBottom = "4px";
    title.textContent = `Array (${data.length} items)`;
    div.appendChild(title);

    const maxShow = 10;
    for (let i = 0; i < Math.min(data.length, maxShow); i++) {
      const item = document.createElement("div");
      item.style.paddingLeft = "12px";
      item.style.marginBottom = "2px";
      const val = typeof data[i] === "object" ? JSON.stringify(data[i]) : String(data[i]);
      item.textContent = `[${i}] ${this.truncate(val, 60)}`;
      div.appendChild(item);
    }

    if (data.length > maxShow) {
      const more = document.createElement("div");
      more.style.paddingLeft = "12px";
      more.style.fontStyle = "italic";
      more.textContent = `...${data.length - maxShow} more`;
      div.appendChild(more);
    }

    return div;
  }

  // Generic object tree rendering (for CSSOM, misc data)
  private renderObjectTree(obj: Record<string, unknown>, depth = 0, maxDepth = 15): HTMLElement {
    const div = document.createElement("div");
    div.style.paddingLeft = `${depth * 16}px`;
    if (depth >= maxDepth) {
      div.textContent = "...";
      return div;
    }

    for (const [key, val] of Object.entries(obj)) {
      const row = document.createElement("div");
      row.style.marginBottom = "2px";

      if (typeof val === "object" && val !== null && !Array.isArray(val)) {
        row.innerHTML = `<span style="font-weight:bold">\u25bc ${this.escapeHtml(key)}:</span>`;
        row.appendChild(this.renderObjectTree(val as Record<string, unknown>, depth + 1));
      } else if (Array.isArray(val)) {
        row.innerHTML =
          `<span style="font-weight:bold">${this.escapeHtml(key)}:</span> [${val.length} items]`;
      } else {
        row.textContent = `${key}: ${this.truncate(String(val), 50)}`;
      }

      div.appendChild(row);
    }

    return div;
  }

  private createMetricsSection(
    metrics: Record<string, number | string | boolean>,
  ): HTMLElement {
    const div = document.createElement("div");
    const title = document.createElement("div");
    title.style.fontWeight = "bold";
    title.style.marginBottom = "4px";
    title.textContent = "Metrics";
    div.appendChild(title);

    for (const [key, val] of Object.entries(metrics)) {
      const row = document.createElement("div");
      row.style.paddingLeft = "12px";
      row.textContent = `${key}: ${val}`;
      div.appendChild(row);
    }

    return div;
  }

  private createErrorSection(error: Error): HTMLElement {
    const div = document.createElement("div");
    div.style.color = "#ef4444";
    div.style.marginTop = "8px";
    div.innerHTML = `<div style="font-weight:bold">Error</div><pre style="margin:4px 0;white-space:pre-wrap">${this.escapeHtml(error.message)}</pre>`;
    if (error.stack) {
      const stack = document.createElement("pre");
      stack.style.margin = "0";
      stack.style.fontSize = "10px";
      stack.style.whiteSpace = "pre-wrap";
      stack.style.opacity = "0.7";
      stack.textContent = error.stack;
      div.appendChild(stack);
    }
    return div;
  }

  private getStatusColor(status: string): string {
    switch (status) {
      case "running":
        return this.theme.stage.running.border;
      case "completed":
        return this.theme.stage.completed.border;
      case "error":
        return this.theme.stage.error.border;
      default:
        return this.theme.stage.pending.border;
    }
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  private truncate(str: string, maxLen: number): string {
    return str.length > maxLen ? str.substring(0, maxLen - 1) + "\u2026" : str;
  }
}
