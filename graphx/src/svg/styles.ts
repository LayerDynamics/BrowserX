/** Node styling */
export interface NodeStyle {
  fill: string;
  stroke: string;
  strokeWidth: number;
  radius: number;
  fontSize: number;
  fontFamily: string;
  labelColor: string;
}

/** Edge styling */
export interface EdgeStyle {
  stroke: string;
  strokeWidth: number;
  arrowSize: number;
  arrowType: "open" | "filled" | "circle";
  fontSize: number;
  fontFamily: string;
  labelColor: string;
}

/** Theme (collection of styles) */
export interface Theme {
  node: NodeStyle;
  edge: EdgeStyle;
  background: string;
}

export const DEFAULT_LIGHT_THEME: Theme = {
  node: {
    fill: "#ffffff",
    stroke: "#333333",
    strokeWidth: 2,
    radius: 20,
    fontSize: 12,
    fontFamily: "sans-serif",
    labelColor: "#333333",
  },
  edge: {
    stroke: "#666666",
    strokeWidth: 1.5,
    arrowSize: 8,
    arrowType: "open",
    fontSize: 10,
    fontFamily: "sans-serif",
    labelColor: "#666666",
  },
  background: "#ffffff",
};

export const DEFAULT_DARK_THEME: Theme = {
  node: {
    fill: "#1e1e1e",
    stroke: "#ffffff",
    strokeWidth: 2,
    radius: 20,
    fontSize: 12,
    fontFamily: "sans-serif",
    labelColor: "#ffffff",
  },
  edge: {
    stroke: "#cccccc",
    strokeWidth: 1.5,
    arrowSize: 8,
    arrowType: "filled",
    fontSize: 10,
    fontFamily: "sans-serif",
    labelColor: "#cccccc",
  },
  background: "#1e1e1e",
};
