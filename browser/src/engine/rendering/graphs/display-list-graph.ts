/**
 * DisplayList → GraphX DiGraph converter (linear command chain)
 */
import { DiGraph, GraphEdge, GraphNode } from "@browserx/graphx/graph";
import { hierarchical } from "@browserx/graphx/layout";
import type { LayoutResult } from "@browserx/graphx/layout";
import { DEFAULT_LIGHT_THEME, render } from "@browserx/graphx/svg";

export interface DisplayListGraphNodeData {
  commandType: string;
  index: number;
  params: Record<string, unknown>;
}

function summarizeCommand(cmd: Record<string, unknown>): string {
  const type = (cmd.type as string) ?? "UNKNOWN";
  switch (type) {
    case "FILL_RECT":
    case "fillRect":
      return `FILL_RECT ${cmd.color ?? ""} ${Math.round((cmd.width as number) ?? 0)}x${
        Math.round((cmd.height as number) ?? 0)
      }`;
    case "STROKE_RECT":
    case "strokeRect":
      return `STROKE ${cmd.color ?? ""} ${Math.round((cmd.width as number) ?? 0)}x${
        Math.round((cmd.height as number) ?? 0)
      }`;
    case "FILL_TEXT":
    case "fillText": {
      const text = (cmd.text as string) ?? "";
      const truncated = text.length > 12 ? text.slice(0, 9) + "..." : text;
      return `TEXT "${truncated}"`;
    }
    case "DRAW_IMAGE":
    case "drawImage": {
      const src = (cmd.src as string) ?? "";
      const name = src.split("/").pop()?.slice(0, 15) ?? src.slice(0, 15);
      return `IMG ${name}`;
    }
    case "SAVE":
    case "save":
      return "SAVE";
    case "RESTORE":
    case "restore":
      return "RESTORE";
    case "TRANSFORM":
    case "transform":
      return "TRANSFORM";
    case "SET_GLOBAL_ALPHA":
    case "setGlobalAlpha":
      return `ALPHA ${cmd.alpha ?? cmd.opacity ?? ""}`;
    default:
      return type;
  }
}

export function displayListToGraph(
  displayList: unknown,
): DiGraph<DisplayListGraphNodeData> {
  const graph = new DiGraph<DisplayListGraphNodeData>();
  let edgeCounter = 0;

  const dl = displayList as Record<string, unknown>;
  const commands = (
    typeof dl.getCommands === "function" ? dl.getCommands() : (dl.commands ?? [])
  ) as Record<string, unknown>[];

  let prevId: string | null = null;
  for (let i = 0; i < commands.length; i++) {
    const cmd = commands[i];
    const id = `cmd_${i}`;
    const commandType = (cmd.type as string) ?? "UNKNOWN";
    const label = summarizeCommand(cmd);

    const { type: _type, ...params } = cmd;
    const data: DisplayListGraphNodeData = {
      commandType,
      index: i,
      params: params as Record<string, unknown>,
    };
    graph.addNode(new GraphNode<DisplayListGraphNodeData>(id, data, label));

    if (prevId) {
      graph.addEdge(new GraphEdge(`e${edgeCounter++}`, prevId, id));
    }
    prevId = id;
  }

  return graph;
}

export function displayListAsSvg(
  displayList: unknown,
  direction: "TB" | "LR" = "TB",
): string {
  const graph = displayListToGraph(displayList);
  const layout: LayoutResult = hierarchical(graph, { direction });
  return render(graph, layout, {
    directed: true,
    showLabels: true,
    theme: DEFAULT_LIGHT_THEME,
  });
}
