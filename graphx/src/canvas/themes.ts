import type { CanvasTheme } from "./types.ts";

/** Light theme for canvas process tracer */
export const CANVAS_LIGHT_THEME: CanvasTheme = {
  background: "#fafafa",
  stage: {
    pending: { fill: "#f1f5f9", border: "#94a3b8" },
    running: { fill: "#dbeafe", border: "#3b82f6" },
    completed: { fill: "#dcfce7", border: "#22c55e" },
    error: { fill: "#fee2e2", border: "#ef4444" },
  },
  edge: {
    stroke: "#94a3b8",
    flowStroke: "#3b82f6",
    width: 1.5,
  },
  label: {
    color: "#1e293b",
    font: "sans-serif",
    fontSize: 11,
  },
  timing: {
    barHeight: 4,
    barColor: "#3b82f6",
    textColor: "#64748b",
  },
  selection: {
    stroke: "#6366f1",
    width: 3,
  },
  panel: {
    background: "#ffffff",
    border: "#e2e8f0",
    text: "#1e293b",
    codeFont: "monospace",
  },
};

/** Dark theme for canvas process tracer */
export const CANVAS_DARK_THEME: CanvasTheme = {
  background: "#0f172a",
  stage: {
    pending: { fill: "#1e293b", border: "#475569" },
    running: { fill: "#1e3a5f", border: "#60a5fa" },
    completed: { fill: "#14532d", border: "#4ade80" },
    error: { fill: "#450a0a", border: "#f87171" },
  },
  edge: {
    stroke: "#475569",
    flowStroke: "#60a5fa",
    width: 1.5,
  },
  label: {
    color: "#e2e8f0",
    font: "sans-serif",
    fontSize: 11,
  },
  timing: {
    barHeight: 4,
    barColor: "#60a5fa",
    textColor: "#94a3b8",
  },
  selection: {
    stroke: "#818cf8",
    width: 3,
  },
  panel: {
    background: "#1e293b",
    border: "#334155",
    text: "#e2e8f0",
    codeFont: "monospace",
  },
};

/** Resolve a theme option to a concrete CanvasTheme */
export function resolveTheme(
  theme: "light" | "dark" | CanvasTheme | undefined,
): CanvasTheme {
  if (theme === "dark") return CANVAS_DARK_THEME;
  if (theme === undefined || theme === "light") return CANVAS_LIGHT_THEME;
  return theme;
}
