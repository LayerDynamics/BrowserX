import { TDomNode } from "./TDomNode.ts";

export interface TDomRenderOptions {
  maxWidth?: number;
  color?: boolean;
}

export class TDomRenderer {
  render(root: TDomNode, options?: TDomRenderOptions): string {
    const lines = root.render(options?.maxWidth);
    let result = lines.join("\n");
    if (options?.color === false) {
      result = result.replace(/\x1b\[[0-9;]*m/g, "");
    }
    return result;
  }
}
