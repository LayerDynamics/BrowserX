# GraphX

Comprehensive graph library for BrowserX with data structures, algorithms, layout engines, and SVG rendering.

## Features

- **Graph Data Structures**: `Graph` (undirected), `DiGraph` (directed), `DAG` (directed acyclic)
- **Graph Algorithms**: BFS, DFS, shortest path (Dijkstra), topological sort, cycle detection, connected components
- **Layout Algorithms**: Force-directed (Fruchterman-Reingold), hierarchical (Sugiyama), radial, grid
- **SVG Rendering**: Headless SVG generation with themes, labels, and arrowheads
- **TypeScript-First**: Fully typed with generic support
- **Zero Dependencies**: Pure Deno implementation

## Installation

```typescript
import { Graph, GraphNode, GraphEdge, bfs, forceDirected, render } from "@browserx/graphx";
```

## Quick Start

```typescript
import { Graph, GraphNode, GraphEdge, forceDirected, render } from "@browserx/graphx";

// Create a graph
const graph = new Graph<string, string>();

// Add nodes
graph.addNode(new GraphNode("A", "Node A"));
graph.addNode(new GraphNode("B", "Node B"));
graph.addNode(new GraphNode("C", "Node C"));

// Add edges
graph.addEdge(new GraphEdge("e1", "A", "B"));
graph.addEdge(new GraphEdge("e2", "B", "C"));

// Compute layout
const layout = forceDirected(graph, { width: 800, height: 600 });

// Render to SVG
const svg = render(graph, layout);
console.log(svg); // SVG string ready to save or display
```

## Graph Data Structures

### Graph (Undirected)

```typescript
const g = new Graph<NodeData, EdgeData>();

g.addNode(new GraphNode("A", { value: 1 }));
g.addNode(new GraphNode("B", { value: 2 }));
g.addEdge(new GraphEdge("e1", "A", "B", 1.0)); // weight = 1.0

console.log(g.neighbors("A")); // [GraphNode(B)]
console.log(g.degree("A")); // 1
```

### DiGraph (Directed)

```typescript
const g = new DiGraph<string, string>();

g.addNode(new GraphNode("A", "data"));
g.addNode(new GraphNode("B", "data"));
g.addEdge(new GraphEdge("e1", "A", "B"));

console.log(g.successors("A")); // [GraphNode(B)]
console.log(g.predecessors("B")); // [GraphNode(A)]
console.log(g.outDegree("A")); // 1
console.log(g.inDegree("B")); // 1

// Transpose (reverse all edges)
const reversed = g.transpose();
```

### DAG (Directed Acyclic Graph)

```typescript
import { DAG, CycleError } from "@browserx/graphx";

const dag = new DAG();

dag.addNode(new GraphNode("A", null));
dag.addNode(new GraphNode("B", null));
dag.addEdge(new GraphEdge("e1", "A", "B")); // OK

try {
  dag.addEdge(new GraphEdge("e2", "B", "A")); // Creates cycle!
} catch (e) {
  if (e instanceof CycleError) {
    console.log("Cycle detected!");
  }
}
```

## Algorithms

### BFS (Breadth-First Search)

```typescript
import { bfs } from "@browserx/graphx";

const result = bfs(graph, "A");
console.log(result.order); // ["A", "B", "C", ...]
console.log(result.depth.get("C")); // 2
console.log(result.parent.get("C")); // "B"
```

### DFS (Depth-First Search)

```typescript
import { dfs, dfsAll } from "@browserx/graphx";

// From single start node
const result = dfs(graph, "A");
console.log(result.order); // DFS traversal order
console.log(result.discovery.get("B")); // Discovery time
console.log(result.finish.get("B")); // Finish time

// Visit all connected components
const allResult = dfsAll(graph);
```

### Shortest Path (Dijkstra)

```typescript
import { dijkstra } from "@browserx/graphx";

const result = dijkstra(graph, "A");
console.log(result.distance.get("D")); // 3.5
console.log(result.path("D")); // ["A", "B", "C", "D"]
console.log(result.cost("D")); // 3.5
```

### Topological Sort

```typescript
import { topologicalSort } from "@browserx/graphx";

const result = topologicalSort(diGraph);
if (!result.hasCycle) {
  console.log(result.order); // Valid topological ordering
} else {
  console.log("Graph has a cycle!");
}
```

### Cycle Detection

```typescript
import { hasCycle } from "@browserx/graphx";

if (hasCycle(diGraph)) {
  console.log("Graph contains a cycle");
}
```

### Connected Components

```typescript
import { connectedComponents } from "@browserx/graphx";

const result = connectedComponents(graph);
console.log(result.count); // Number of components
console.log(result.componentOf.get("A")); // Component ID of node A
console.log(result.components); // Array of component sets
```

## Layout Algorithms

### Force-Directed Layout

```typescript
import { forceDirected } from "@browserx/graphx";

const layout = forceDirected(graph, {
  width: 800,
  height: 600,
  iterations: 50,
  springConstant: 2.0,
  repulsionConstant: 1.0,
  springLength: 100,
  seed: 42, // For reproducible layouts
});

console.log(layout.nodes); // [{ id: "A", x: 123, y: 456 }, ...]
```

### Hierarchical Layout

```typescript
import { hierarchical } from "@browserx/graphx";

const layout = hierarchical(diGraph, {
  direction: "TB", // "TB" | "LR" | "BT" | "RL"
  horizontalSpacing: 100,
  verticalSpacing: 100,
});
```

### Radial Layout

```typescript
import { radial } from "@browserx/graphx";

const layout = radial(graph, {
  center: { x: 400, y: 300 },
  radius: 200,
  startAngle: 0,
});
```

### Grid Layout

```typescript
import { grid } from "@browserx/graphx";

const layout = grid(graph, {
  columns: 5, // Auto-calculated if omitted
  cellWidth: 100,
  cellHeight: 100,
  padding: 10,
});
```

## SVG Rendering

### Basic Rendering

```typescript
import { render, DEFAULT_LIGHT_THEME } from "@browserx/graphx";

const svg = render(graph, layout, {
  theme: DEFAULT_LIGHT_THEME,
  showLabels: true,
  showEdgeLabels: false,
  directed: false,
});

// Save to file
await Deno.writeTextFile("graph.svg", svg);
```

### Custom Theme

```typescript
import { render, type Theme } from "@browserx/graphx";

const customTheme: Theme = {
  node: {
    fill: "#ff6b6b",
    stroke: "#c92a2a",
    strokeWidth: 2,
    radius: 25,
    fontSize: 14,
    fontFamily: "monospace",
    labelColor: "#ffffff",
  },
  edge: {
    stroke: "#868e96",
    strokeWidth: 2,
    arrowSize: 10,
    arrowType: "filled",
    fontSize: 12,
    fontFamily: "monospace",
    labelColor: "#495057",
  },
  background: "#f8f9fa",
};

const svg = render(graph, layout, { theme: customTheme });
```

### SVG Renderer Class

```typescript
import { SVGRenderer } from "@browserx/graphx";

const renderer = new SVGRenderer(graph, layout, {
  theme: customTheme,
  showLabels: true,
  directed: true,
});

const svg = renderer.render();
```

## API Reference

### Graph Classes

- `Graph<N, E>` - Undirected graph
- `DiGraph<N, E>` - Directed graph
- `DAG<N, E>` - Directed acyclic graph
- `GraphNode<T>` - Node with id, data, label, metadata
- `GraphEdge<T>` - Edge with id, source, target, weight, data

### Algorithms

- `bfs(graph, start)` → `BFSResult`
- `dfs(graph, start)` → `DFSResult`
- `dfsAll(graph)` → `DFSResult`
- `dijkstra(graph, start)` → `ShortestPathResult`
- `topologicalSort(diGraph)` → `TopologicalSortResult`
- `hasCycle(graph)` → `boolean`
- `connectedComponents(graph)` → `ConnectedComponentsResult`

### Layout Algorithms

- `forceDirected(graph, options?)` → `LayoutResult`
- `hierarchical(diGraph, options?)` → `LayoutResult`
- `radial(graph, options?)` → `LayoutResult`
- `grid(graph, options?)` → `LayoutResult`

### SVG Rendering

- `render(graph, layout, options?)` → `string`
- `SVGRenderer` - Class for programmatic SVG generation
- `DEFAULT_LIGHT_THEME` - Built-in light theme
- `DEFAULT_DARK_THEME` - Built-in dark theme

## BrowserX Integration

GraphX is integrated across the BrowserX codebase as a cross-cutting dependency:

- **Runtime PluginManager**: Uses `DAG` + `topologicalSort()` + `CycleError` for plugin activation ordering
- **Query Engine DependencyGraphBuilder**: Backed by `DiGraph` via `WeakMap` store for topo sort and cycle detection
- **Query Engine DependencyResolver**: `resolve()` uses `topologicalSort()`
- **Visualization modules**: DOM tree, render tree, execution plan, route topology → SVG via GraphX layouts
- **MCP tools**: `browserx_visualize_dom`, `browserx_dependency_graph`, `browserx_plugin_graph`

## Development

```bash
# Type check
deno task check

# Run tests
deno task test

# Run tests in watch mode
deno task test:watch

# Lint
deno task lint

# Format
deno task fmt
```

## Testing

164 comprehensive tests covering:
- Graph data structures (61 tests)
- Algorithms (57 tests)
- Layout algorithms (26 tests)
- SVG rendering (20 tests)

```bash
deno test --allow-all tests/
```

## License

Part of the BrowserX project.
