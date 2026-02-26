# GraphX Overview

**`@browserx/graphx`** is a TypeScript/Deno graph theory library built for BrowserX. It provides generic graph data structures, classic graph algorithms, automatic layout engines, and SVG rendering — all composable and type-safe.

---

## Architecture

```
@browserx/graphx v0.1.0
│
├── graph/          Data structures
│   ├── GraphNode<T>      Node with id, data, label, metadata
│   ├── GraphEdge<T>      Edge with source, target, weight, data
│   ├── Graph<N,E>        Undirected graph (adjacency sets)
│   ├── DiGraph<N,E>      Directed graph (in/out adjacency)
│   └── DAG<N,E>          Directed acyclic graph (cycle-guarded)
│
├── algorithms/     Graph algorithms
│   ├── bfs               Breadth-first search
│   ├── dfs / dfsAll      Depth-first search (single / all components)
│   ├── dijkstra          Shortest path (weighted)
│   ├── topologicalSort   Kahn's algorithm
│   ├── hasCycle          Three-color DFS cycle detection
│   └── connectedComponents  Union-Find
│
├── layout/         Automatic node positioning
│   ├── forceDirected     Fruchterman-Reingold simulation
│   ├── hierarchical      Sugiyama-style layered layout
│   ├── radial            Circular placement
│   └── grid              Row-major rectangular grid
│
├── svg/            Visualization
│   ├── SVGRenderer       Builds complete SVG strings
│   ├── Theme             Light and dark themes
│   └── markers           Arrow markers (open/filled/circle)
│
├── canvas/         Interactive process trace web component
│   ├── GraphXCanvas      <graphx-canvas> Shadow DOM component
│   ├── CanvasRenderer    Canvas2D drawing engine
│   ├── ProcessTraceModel Stage graph builder (backed by DiGraph)
│   ├── DetailPanel       Type-aware data inspector
│   ├── InteractionManager Pan, zoom, hit-test
│   ├── AnimationController rAF render loop
│   └── adapters/         Pipeline → ProcessTrace converters
│       ├── RenderingPipelineAdapter  (9 stages)
│       ├── RequestPipelineAdapter    (6 stages)
│       ├── QueryExecutorAdapter      (N stages)
│       └── ProxyMiddlewareAdapter    (variable)
│
├── types.ts        Primitives: Point, Rect, NodeId, EdgeId, Metadata
└── main.ts         Scaffold entry point (not part of public API)
```

### Data Flow

```
Build graph          →  Run algorithms    →  Compute layout    →  Render SVG
(Graph/DiGraph/DAG)     (BFS, Dijkstra…)    (force, grid…)       (SVGRenderer)

Pipeline result      →  Adapter           →  ProcessTrace       →  <graphx-canvas>
(Rendering/Request/     (converts to          (DiGraph +            (Canvas2D +
 Query/Proxy)            StageNodes)           StageNodes)           DetailPanel)
```

Each layer is independent — you can use graphs without layout, algorithms without rendering, etc. The canvas module builds on all layers: adapters produce a `ProcessTrace` backed by `DiGraph`, laid out with `hierarchical()`, and optionally exported via `SVGRenderer`.

---

## Graph Data Structures

### Class Hierarchy

```
Graph<N, E>              Undirected graph
  │  _nodes: Map<NodeId, GraphNode<N>>
  │  _edges: Map<EdgeId, GraphEdge<E>>
  │  _adj:   Map<NodeId, Set<EdgeId>>        ← symmetric adjacency
  │
  └── DiGraph<N, E>      Directed graph (extends Graph)
        │  _outAdj: Map<NodeId, Set<EdgeId>>  ← outgoing edges per node
        │  _inAdj:  Map<NodeId, Set<EdgeId>>  ← incoming edges per node
        │
        └── DAG<N, E>    Directed acyclic graph (extends DiGraph)
              │  addEdge() runs hasCycle() — throws CycleError on violation
```

### GraphNode\<T\>

A generic node holding arbitrary typed data.

| Property | Type | Description |
|----------|------|-------------|
| `id` | `readonly NodeId` | Unique identifier |
| `data` | `T` | Arbitrary payload |
| `label` | `string` | Display label (defaults to `id`) |
| `metadata` | `Metadata` | Key-value bag (`Record<string, unknown>`) |

**Methods:** `clone()` (deep-copies metadata), `toJSON()`

### GraphEdge\<T\>

A generic edge connecting two nodes.

| Property | Type | Description |
|----------|------|-------------|
| `id` | `readonly EdgeId` | Unique identifier |
| `source` | `readonly NodeId` | Source node |
| `target` | `readonly NodeId` | Target node |
| `weight` | `number` | Edge weight (default: `1`) |
| `data` | `T \| undefined` | Arbitrary payload |
| `label` | `string` | Display label (default: `"source->target"`) |
| `metadata` | `Metadata` | Key-value bag |

**Methods:** `reversed()` (swaps source/target), `toJSON()`

### Graph\<N, E\> — Undirected

Core undirected graph. Stores nodes and edges in Maps, with a symmetric adjacency index (`_adj`).

| Method | Description |
|--------|-------------|
| `addNode(node)` | Add node (throws if id exists) |
| `removeNode(id)` | Remove node + all incident edges |
| `addEdge(edge)` | Add edge (throws if endpoints missing or id exists) |
| `removeEdge(id)` | Remove edge by id |
| `neighbors(id)` | Adjacent nodes |
| `incidentEdges(id)` | All edges touching a node |
| `degree(id)` | Number of incident edges |
| `nodes()` / `edges()` | All nodes/edges as arrays |
| `hasNode(id)` / `hasEdge(id)` | Existence checks |
| `clear()` | Remove everything |
| `toJSON()` | Serialize to `{ nodes, edges }` |
| `nodeCount` / `edgeCount` | Getters |

### DiGraph\<N, E\> — Directed (extends Graph)

Adds directional tracking via `_outAdj` and `_inAdj` alongside the inherited `_adj`.

| Method | Description |
|--------|-------------|
| `successors(id)` | Nodes reachable via outgoing edges |
| `predecessors(id)` | Nodes with edges pointing to this node |
| `outEdges(id)` / `inEdges(id)` | Outgoing / incoming edges |
| `outDegree(id)` / `inDegree(id)` | Out / in degree |
| `transpose()` | New DiGraph with all edges reversed |
| `neighbors(id)` | Overridden — returns `successors(id)` |

### DAG\<N, E\> — Directed Acyclic (extends DiGraph)

Identical to DiGraph except `addEdge()` validates acyclicity:

1. Calls `super.addEdge(edge)` to add the edge
2. Runs `hasCycle(this)` — if cycle detected, rolls back via `_removeEdgeById()` and throws `CycleError`

```typescript
class CycleError extends Error {
  name = "CycleError";
  // Default message: "Adding this edge would create a cycle"
}
```

---

## Algorithms

### BFS — Breadth-First Search

```typescript
function bfs<N, E>(graph: Graph<N, E>, start: NodeId): BFSResult
```

| Detail | Value |
|--------|-------|
| **Approach** | Iterative FIFO queue |
| **Result** | `{ order: NodeId[], parent: Map, depth: Map }` |
| **Time** | O(V + E) |
| **Space** | O(V) |
| **Throws** | If start node doesn't exist |

### DFS — Depth-First Search

```typescript
function dfs<N, E>(graph: Graph<N, E>, start: NodeId): DFSResult
function dfsAll<N, E>(graph: Graph<N, E>): DFSResult
```

| Detail | Value |
|--------|-------|
| **Approach** | Recursive with discovery/finish timestamps (CLRS-style) |
| **Result** | `{ order, parent, depth, discovery, finish }` |
| **`dfs`** | Single start node |
| **`dfsAll`** | Visits all components (disconnected graph safe) |
| **Time** | O(V + E) |
| **Space** | O(V) |

### Dijkstra — Shortest Path

```typescript
function dijkstra<N, E>(graph: Graph<N, E>, start: NodeId): ShortestPathResult
```

| Detail | Value |
|--------|-------|
| **Approach** | Dijkstra with linear-scan minimum (no priority queue) |
| **Result** | `{ distance: Map, previous: Map, path(target): NodeId[], cost(target): number }` |
| **Time** | O(V²) |
| **Space** | O(V) |
| **Note** | Uses `edge.weight`; no negative weights |

The result object includes `path(target)` and `cost(target)` closure methods for convenient path reconstruction.

### Topological Sort

```typescript
function topologicalSort<N, E>(graph: DiGraph<N, E>): TopologicalSortResult
```

| Detail | Value |
|--------|-------|
| **Approach** | Kahn's algorithm (BFS-based, in-degree tracking) |
| **Input** | `DiGraph` only (not undirected `Graph`) |
| **Result** | `{ order: NodeId[], hasCycle: boolean }` |
| **Time** | O(V + E) |
| **Cycle detection** | `hasCycle = order.length !== graph.nodeCount` |

### Cycle Detection

```typescript
function hasCycle<N, E>(graph: Graph<N, E>): boolean
```

| Detail | Value |
|--------|-------|
| **Approach** | Three-color DFS (WHITE → GRAY → BLACK) |
| **Works on** | Both `Graph` and `DiGraph` (duck-types `successors()`) |
| **Time** | O(V + E) |
| **Used by** | `DAG.addEdge()` for acyclicity enforcement |

### Connected Components

```typescript
function connectedComponents<N, E>(graph: Graph<N, E>): ConnectedComponentsResult
```

| Detail | Value |
|--------|-------|
| **Approach** | Union-Find with path compression + union by rank |
| **Result** | `{ componentOf: Map<NodeId,number>, components: Set<NodeId>[], count: number }` |
| **Time** | O((V + E) · α(V)) ≈ O(V + E) |
| **On DiGraph** | Finds weakly connected components (ignores edge direction) |

---

## Layout Engines

All layouts accept a graph and options, returning `LayoutResult`:

```typescript
interface LayoutResult {
  nodes: LayoutNode[];  // { id, x, y }
  width: number;
  height: number;
}
```

### Force-Directed (Fruchterman-Reingold)

```typescript
forceDirected<N, E>(graph: Graph<N, E>, options?: ForceDirectedOptions): LayoutResult
```

Physics-based simulation with repulsive node forces and attractive edge forces.

| Option | Default | Description |
|--------|---------|-------------|
| `width` | 800 | Bounding box width |
| `height` | 600 | Bounding box height |
| `iterations` | 50 | Simulation steps |
| `springConstant` | 2.0 | Edge attraction strength |
| `repulsionConstant` | 1.0 | Node repulsion strength |
| `springLength` | √(w×h/n) | Ideal edge length |
| `seed` | `Date.now()` | RNG seed for reproducibility |

**How it works:**
1. Positions nodes randomly (seeded LCG RNG: `state = (state * 1664525 + 1013904223) >>> 0`)
2. Each iteration: compute pairwise repulsion (`C² × k² / dist`), edge attraction (`C₁ × dist² / k`), apply with temperature cooling (`temp = w/10 × (1 - iter/maxIter)`)
3. Clamp positions to bounding box

### Hierarchical (Sugiyama-style)

```typescript
hierarchical<N, E>(graph: DiGraph<N, E>, options?: HierarchicalOptions): LayoutResult
```

Layered layout for DAGs. Throws on cyclic graphs.

| Option | Default | Description |
|--------|---------|-------------|
| `direction` | `"TB"` | Flow direction: `TB`, `LR`, `BT`, `RL` |
| `horizontalSpacing` | 100 | Space between nodes in same layer |
| `verticalSpacing` | 100 | Space between layers |

**How it works:**
1. Run `topologicalSort()` — reject cycles
2. Assign layers via longest-path: `layer[node] = max(predecessors' layers) + 1`
3. Position nodes within each layer, centered
4. Apply direction transform (TB=top-down, LR=left-right, etc.)
5. Normalize coordinates to positive space

### Radial (Circular)

```typescript
radial<N, E>(graph: Graph<N, E>, options?: RadialOptions): LayoutResult
```

Evenly spaces nodes around a circle.

| Option | Default | Description |
|--------|---------|-------------|
| `center` | `{x:0, y:0}` | Circle center |
| `radius` | 200 | Circle radius |
| `startAngle` | 0 | Starting angle (radians) |

**Placement:** Node `i` at angle `startAngle + i × (2π / nodeCount)`.

### Grid (Rectangular)

```typescript
grid<N, E>(graph: Graph<N, E>, options?: GridOptions): LayoutResult
```

Places nodes in a row-major rectangular grid.

| Option | Default | Description |
|--------|---------|-------------|
| `columns` | `⌈√n⌉` | Column count (auto-calculated) |
| `cellWidth` | 100 | Cell width |
| `cellHeight` | 100 | Cell height |
| `padding` | 10 | Inter-cell padding |

---

## SVG Rendering

### SVGRenderer

```typescript
class SVGRenderer<N, E> {
  constructor(graph: Graph<N, E>, layout: LayoutResult, options?: SVGRenderOptions)
  render(): string  // Returns complete SVG markup
}

// Convenience function:
function render<N, E>(graph: Graph<N, E>, layout: LayoutResult, options?: SVGRenderOptions): string
```

**Options:**

| Option | Default | Description |
|--------|---------|-------------|
| `theme` | Light theme | Color/style theme |
| `showLabels` | `true` | Show node labels |
| `showEdgeLabels` | `false` | Show edge labels |
| `directed` | `false` | Render arrow markers |

**Rendering pipeline:**
1. SVG header with `width`, `height`, `viewBox` from layout
2. Background `<rect>` from theme
3. If directed: `<defs>` with arrow `<marker>` definition
4. `<g id="edges">`: `<line>` per edge, optional midpoint `<text>` label
5. `<g id="nodes">`: `<circle>` per node, optional `<text>` label

### Themes

Two built-in themes with full node and edge styling:

| Property | Light | Dark |
|----------|-------|------|
| Node fill | `#ffffff` | `#1e1e1e` |
| Node stroke | `#333333` | `#ffffff` |
| Edge stroke | `#666666` | `#cccccc` |
| Background | `#ffffff` | `#1e1e1e` |
| Arrow type | `open` | `filled` |

Both themes: strokeWidth=2, radius=20, fontSize=12, fontFamily="sans-serif", arrowSize=8.

### Arrow Markers

`buildArrowMarker(style: EdgeStyle)` generates SVG `<marker>` definitions:

| Type | Shape | Fill |
|------|-------|------|
| `"open"` | Polyline chevron | None (stroked) |
| `"filled"` | Polygon triangle | Solid (edge color) |
| `"circle"` | Circle | Solid (edge color) |

---

## Complete API Reference

### Types

| Export | Source |
|--------|--------|
| `NodeId` | `string` alias |
| `EdgeId` | `string` alias |
| `Metadata` | `Record<string, unknown>` |
| `Point` | `{ x, y }` |
| `Rect` | `{ x, y, width, height }` |

### Classes

| Export | Description |
|--------|-------------|
| `GraphNode<T>` | Node with id, data, label, metadata |
| `GraphEdge<T>` | Edge with source, target, weight, data |
| `Graph<N,E>` | Undirected graph |
| `DiGraph<N,E>` | Directed graph |
| `DAG<N,E>` | Directed acyclic graph |
| `CycleError` | Error thrown when DAG cycle detected |
| `SVGRenderer<N,E>` | SVG output builder |

### Algorithm Functions

| Export | Signature |
|--------|-----------|
| `bfs` | `(graph, start) → BFSResult` |
| `dfs` | `(graph, start) → DFSResult` |
| `dfsAll` | `(graph) → DFSResult` |
| `dijkstra` | `(graph, start) → ShortestPathResult` |
| `topologicalSort` | `(digraph) → TopologicalSortResult` |
| `hasCycle` | `(graph) → boolean` |
| `connectedComponents` | `(graph) → ConnectedComponentsResult` |

### Layout Functions

| Export | Signature |
|--------|-----------|
| `forceDirected` | `(graph, options?) → LayoutResult` |
| `hierarchical` | `(digraph, options?) → LayoutResult` |
| `radial` | `(graph, options?) → LayoutResult` |
| `grid` | `(graph, options?) → LayoutResult` |

### SVG Exports

| Export | Description |
|--------|-------------|
| `render` | Convenience function for SVG output |
| `SVGRenderer` | Class for SVG rendering |
| `buildArrowMarker` | Generates SVG marker definitions |
| `DEFAULT_LIGHT_THEME` | Light color theme |
| `DEFAULT_DARK_THEME` | Dark color theme |

---

## Canvas Module — Live Process Trace Web Component

The canvas module (`src/canvas/`) provides `<graphx-canvas>`, an interactive web component that visualizes BrowserX pipeline execution as a live process trace. Each node represents a **pipeline stage** containing the actual intermediate data — DOM trees, HTTP headers, CSSOM rules, layout boxes, query step results — not just status indicators.

### Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│  <graphx-canvas>  Web Component (Shadow DOM)                        │
│                                                                     │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────────────────┐  │
│  │ Process      │  │ Canvas       │  │ Interaction Layer         │  │
│  │ Trace        │←─│ Renderer     │←─│ (pan, zoom, hit-test,     │  │
│  │ Model        │  │ (2D context) │  │  select → show stage data)│  │
│  └──────┬──────┘  └──────────────┘  └───────────────────────────┘  │
│         │                                        ↓                  │
│  ┌──────┴──────┐  ┌──────────────┐  ┌───────────────────────────┐  │
│  │ Pipeline     │  │ Animation    │  │ Detail Panel              │  │
│  │ Adapters     │  │ Loop (rAF)   │  │ (DOM tree, HTTP headers,  │  │
│  │ (4 pipelines)│  │              │  │  CSSOM, layout boxes,     │  │
│  └─────────────┘  └──────────────┘  │  timing, step results)    │  │
│                                      └───────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### Supported Pipelines

| Pipeline | Adapter | Stages | Data Shown |
|----------|---------|--------|------------|
| **Rendering** | `RenderingPipelineAdapter` | 9 (HTML Fetch → Composite) | DOM tree, CSSOM rules, LayoutBox tree, DisplayList, timing |
| **Request** | `RequestPipelineAdapter` | 6 (Cache → Response) or 2 (cache hit) | HTTP headers, status, body size, DNS/TCP/TLS timing |
| **Query** | `QueryExecutorAdapter` | N (one per step) | Step results, extracted data, cache stats |
| **Proxy** | `ProxyMiddlewareAdapter` | Variable (middleware chain) | Request context, middleware results, upstream response |

### StageNode — What Each Node Contains

```typescript
interface StageNode {
  id: NodeId;
  stage: string;              // "DNS Resolution", "HTML Parse", "Layout", etc.
  pipeline: PipelineType;     // "rendering" | "request" | "query" | "proxy"
  status: StageStatus;        // "pending" | "running" | "completed" | "error"
  timing: StageTiming;        // { startTime, endTime, duration }
  inputSummary: string;       // "GET https://example.com"
  outputData: unknown;        // The ACTUAL stage artifact (DOMNode, CSSOM, LayoutBox, etc.)
  outputSummary: string;      // "document with 47 nodes"
  metrics: Record<string, number | string | boolean>;
  error?: Error;
}
```

When you **click a node**, the `DetailPanel` renders the actual `outputData` using type-aware formatters:
- **DOM nodes** → expandable tree with tag names and attributes
- **HTTP request/response** → header table, status, body size
- **Layout boxes** → tree with dimensions (width × height)
- **CSSOM** → rule list with properties
- **Query step results** → JSON tree with expand/collapse
- **Arrays/objects** → formatted key-value display

### Usage

```typescript
import { GraphXCanvas } from "@browserx/graphx/canvas";

// In HTML
// <graphx-canvas theme="dark" layout="hierarchical" layout-direction="LR"
//   show-timing show-panel auto-fit></graphx-canvas>

const canvas = document.querySelector("graphx-canvas");

// Trace a page render — click "HTML Parse" to see the DOM tree
canvas.traceRendering(renderingResult);

// Trace a network request — click "Response Receive" to see headers
canvas.traceRequest(requestResult);

// Trace a query execution — click any step to see extracted data
canvas.traceQuery(executionResult);

// Trace proxy middleware chain
canvas.traceProxy(proxyTraceInput);

// Live update a stage
canvas.updateStage(stageId, { status: "completed", timing: { ... } });

// Export
const svg = canvas.toSVG();   // Delegates to GraphX SVGRenderer
const png = canvas.toDataURL();
```

### Canvas File Structure

```
src/canvas/
├── types.ts                    StageNode, StageEdge, ProcessTrace, CanvasTheme, etc.
├── themes.ts                   CANVAS_LIGHT_THEME, CANVAS_DARK_THEME, resolveTheme()
├── ProcessTraceModel.ts        Builds ProcessTrace with DiGraph from adapter output
├── CanvasRenderer.ts           Canvas2D drawing (rounded rects, arrows, timing bars)
├── InteractionManager.ts       Pan, zoom, hit-test, selection
├── AnimationController.ts      rAF loop with dirty-flag optimization
├── DetailPanel.ts              Type-aware data inspector (DOM trees, headers, etc.)
├── GraphXCanvas.ts             <graphx-canvas> web component (Shadow DOM)
├── mod.ts                      Barrel exports
└── adapters/
    ├── RenderingPipelineAdapter.ts   9-stage rendering trace
    ├── RequestPipelineAdapter.ts     6-stage (or 2-stage cache hit) request trace
    ├── QueryExecutorAdapter.ts       N-stage query execution trace
    ├── ProxyMiddlewareAdapter.ts     Variable-length proxy middleware trace
    └── mod.ts                        Adapter barrel
```

### Canvas Exports

| Export | Type | Description |
|--------|------|-------------|
| `GraphXCanvas` | Class | `<graphx-canvas>` web component |
| `CanvasRenderer` | Class | Canvas2D drawing engine |
| `InteractionManager` | Class | Pan, zoom, hit-test |
| `AnimationController` | Class | rAF render loop |
| `DetailPanel` | Class | Stage data inspector panel |
| `ProcessTraceModel` | Class | Trace graph builder |
| `RenderingPipelineAdapter` | Class | Rendering pipeline → trace |
| `RequestPipelineAdapter` | Class | Request pipeline → trace |
| `QueryExecutorAdapter` | Class | Query executor → trace |
| `ProxyMiddlewareAdapter` | Class | Proxy middleware → trace |
| `CANVAS_LIGHT_THEME` / `CANVAS_DARK_THEME` | Object | Built-in themes |
| `resolveTheme` | Function | Resolve `"light"` / `"dark"` / custom to `CanvasTheme` |

---

## Not Yet Implemented

- **`src/query-trace/`** — Query execution trace visualization (partially superseded by canvas adapters)

---

## Test Coverage

**250+ tests total**, organized by module:

| Module | Tests | Coverage |
|--------|-------|----------|
| Graph structures | 61 | Graph, DiGraph, DAG creation/mutation/serialization |
| Algorithms | 57 | BFS, DFS, Dijkstra, topo sort, cycles, components |
| Layout | 26 | Force-directed, hierarchical, radial, grid |
| SVG rendering | 20 | Renderer output, themes, styles |
| Canvas: adapters | 42 | All 4 pipeline adapters (10-11 tests each) |
| Canvas: model | 12 | ProcessTraceModel build/update/query |
| Canvas: renderer | 9 | Node drawing, edges, timing bars, selection |
| Canvas: interaction | 6 | Hit-test, pan, zoom, fit-to-content |
| Canvas: animation | 3 | Start/stop, dirty flag |
| Canvas: detail panel | 6 | DOM tree, headers, layout box, JSON rendering |
| Canvas: integration | 8 | Full adapter→trace→layout→SVG pipeline |

```bash
# Run all tests
deno test --allow-all graphx/tests/

# Run only canvas tests
deno test --allow-all graphx/tests/canvas/

# Run specific test file
deno test --allow-all graphx/tests/graph/Graph.test.ts
```
