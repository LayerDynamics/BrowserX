/**
 * Graph Visualization Tools for MCP Server
 * Provides visual graph representations of DOM trees, query execution plans, and plugin dependencies.
 *
 * Uses @browserx/graphx for graph construction, layout, and SVG rendering.
 */

import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { MCPServerContext } from "../server/mcp-server.ts";
import {
  DiGraph,
  GraphNode,
  GraphEdge,
  hierarchical,
  render,
  DEFAULT_LIGHT_THEME,
  DEFAULT_DARK_THEME,
  LiveTraceBridge,
} from "@browserx/graphx";
import { domTreeAsSvg, cssomAsSvg, layoutTreeAsSvg, displayListAsSvg } from "../../browser/src/engine/rendering/graphs/mod.ts";
import { astAsSvg } from "../../query-engine/planner/ast-graph.ts";

/**
 * Build a DiGraph from nodes/edges arrays and render to SVG string.
 */
function renderGraphToSVG(
  nodes: { id: string; label: string }[],
  edges: { source: string; target: string; label?: string }[],
  options: { theme?: "light" | "dark"; direction?: "TB" | "LR" } = {},
): string {
  const graph = new DiGraph<{ label: string }, { label: string }>();

  for (const node of nodes) {
    graph.addNode(new GraphNode(node.id, { label: node.label }));
  }
  for (const edge of edges) {
    const edgeId = `${edge.source}->${edge.target}`;
    graph.addEdge(new GraphEdge(edgeId, edge.source, edge.target, 1, { label: edge.label ?? "" }));
  }

  const layout = hierarchical(graph, {
    direction: options.direction ?? "TB",
    horizontalSpacing: 120,
    verticalSpacing: 80,
  });

  const theme = options.theme === "dark" ? DEFAULT_DARK_THEME : DEFAULT_LIGHT_THEME;
  return render(graph, layout, { theme, directed: true, showLabels: true });
}

/**
 * Convert nodes/edges to JSON format.
 */
function renderGraphToJSON(
  nodes: { id: string; label: string }[],
  edges: { source: string; target: string; label?: string }[],
): { nodes: { id: string; label: string }[]; edges: { source: string; target: string; label?: string }[] } {
  return { nodes, edges };
}

/**
 * Register graph visualization tools with the MCP server
 */
export function registerGraphTools(
  server: McpServer,
  context: MCPServerContext,
): void {
  // Tool 1: Visualize DOM tree
  server.tool(
    "browserx_visualize_dom",
    "Visualize the current page's DOM tree as an SVG graph. Requires an active browser session for live DOM; returns a sample DOM tree if no session is available.",
    {
      sessionId: z.string().optional().describe(
        "Session ID of an active browser session. If omitted, returns a sample DOM tree visualization.",
      ),
      theme: z.enum(["light", "dark"]).optional().describe(
        "Color theme for the SVG output. Default: 'light'.",
      ),
      direction: z.enum(["TB", "LR"]).optional().describe(
        "Layout direction: 'TB' (top-to-bottom) or 'LR' (left-to-right). Default: 'TB'.",
      ),
    },
    async ({ sessionId, theme, direction }) => {
      context.permissionGuard.checkToolPermission("browserx_visualize_dom");

      // Attempt to get live DOM from session
      let nodes: { id: string; label: string }[] = [];
      let edges: { source: string; target: string; label?: string }[] = [];
      let fromLiveSession = false;

      if (sessionId) {
        try {
          const sessionManager = await context.getSessionManager();
          if (sessionManager.hasSession(sessionId as string)) {
            const session = sessionManager.getSession(sessionId as string);
            if (session && session.browserEngine) {
              const browser = session.browserEngine;
              // Try to get DOM tree from browser engine
              const domTree = browser.getDOMTree?.();
              if (domTree) {
                fromLiveSession = true;
                let nodeCounter = 0;
                const walkDOM = (node: { tagName?: string; nodeName?: string; childNodes?: unknown[]; children?: unknown[] }, parentId?: string) => {
                  const id = `node_${nodeCounter++}`;
                  const label = node.tagName ?? node.nodeName ?? "node";
                  nodes.push({ id, label });
                  if (parentId) {
                    edges.push({ source: parentId, target: id });
                  }
                  const children = (node.children ?? node.childNodes ?? []) as { tagName?: string; nodeName?: string; childNodes?: unknown[]; children?: unknown[] }[];
                  for (const child of children) {
                    walkDOM(child, id);
                  }
                };
                walkDOM(domTree);
              }
            }
          }
        } catch {
          // Fall through to sample DOM
        }
      }

      // If no live DOM, build sample DOM tree
      if (!fromLiveSession) {
        nodes = [
          { id: "html", label: "html" },
          { id: "head", label: "head" },
          { id: "body", label: "body" },
          { id: "meta", label: "meta" },
          { id: "title", label: "title" },
          { id: "header", label: "header" },
          { id: "main", label: "main" },
          { id: "footer", label: "footer" },
          { id: "nav", label: "nav" },
          { id: "h1", label: "h1" },
          { id: "section", label: "section" },
          { id: "p", label: "p" },
        ];
        edges = [
          { source: "html", target: "head" },
          { source: "html", target: "body" },
          { source: "head", target: "meta" },
          { source: "head", target: "title" },
          { source: "body", target: "header" },
          { source: "body", target: "main" },
          { source: "body", target: "footer" },
          { source: "header", target: "nav" },
          { source: "main", target: "h1" },
          { source: "main", target: "section" },
          { source: "section", target: "p" },
        ];
      }

      const svg = renderGraphToSVG(nodes, edges, {
        theme: (theme as "light" | "dark") ?? "light",
        direction: (direction as "TB" | "LR") ?? "TB",
      });

      const note = fromLiveSession
        ? `Live DOM tree from session ${sessionId}`
        : "Sample DOM tree (no active session). Pass a sessionId for live DOM visualization.";

      return {
        content: [
          { type: "text" as const, text: note },
          { type: "text" as const, text: svg },
        ],
      };
    },
  );

  // Tool 2: Visualize query execution plan
  server.tool(
    "browserx_dependency_graph",
    "Visualize a BrowserX query's execution plan as a dependency graph. Returns SVG or JSON representation of the query plan stages.",
    {
      query: z.string().describe(
        "BrowserX query in SQL-like syntax. Example: \"SELECT title FROM 'https://example.com'\"",
      ),
      format: z.enum(["svg", "json"]).optional().describe(
        "Output format: 'svg' for visual graph, 'json' for node/edge data. Default: 'svg'.",
      ),
    },
    async ({ query, format }) => {
      context.permissionGuard.checkToolPermission("browserx_dependency_graph");

      const outputFormat = (format as "svg" | "json") ?? "svg";

      // Build execution plan stages from the query
      const nodes: { id: string; label: string }[] = [];
      const edges: { source: string; target: string; label?: string }[] = [];

      try {
        const queryEngine = await context.getQueryEngine();

        // Use the query engine to parse and plan
        const plan = queryEngine.explain?.(query as string);
        if (plan && plan.stages) {
          for (const stage of plan.stages) {
            nodes.push({ id: stage.id, label: stage.name ?? stage.id });
            for (const dep of stage.dependencies ?? []) {
              edges.push({ source: dep, target: stage.id });
            }
          }
        } else {
          // Fall back to a basic plan derived from query analysis
          buildQueryPlanGraph(query as string, nodes, edges);
        }
      } catch {
        // If query engine not available, derive a basic plan from the query string
        buildQueryPlanGraph(query as string, nodes, edges);
      }

      if (outputFormat === "json") {
        const json = renderGraphToJSON(nodes, edges);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(json, null, 2) },
          ],
        };
      }

      const svg = renderGraphToSVG(nodes, edges, { direction: "TB" });
      return {
        content: [
          { type: "text" as const, text: `Execution plan for: ${query}` },
          { type: "text" as const, text: svg },
        ],
      };
    },
  );

  // Tool 3: Visualize plugin dependency graph
  server.tool(
    "browserx_plugin_graph",
    "Visualize the runtime plugin dependency graph. Shows registered plugins and their dependency relationships.",
    {
      format: z.enum(["svg", "json"]).optional().describe(
        "Output format: 'svg' for visual graph, 'json' for node/edge data. Default: 'svg'.",
      ),
    },
    async ({ format }) => {
      context.permissionGuard.checkToolPermission("browserx_plugin_graph");

      const outputFormat = (format as "svg" | "json") ?? "svg";
      const nodes: { id: string; label: string }[] = [];
      const edges: { source: string; target: string; label?: string }[] = [];

      try {
        const runtime = await context.getRuntime();
        const pluginManager = runtime.pluginManager;

        if (pluginManager) {
          const plugins = pluginManager.getRegisteredPlugins?.() ?? [];
          for (const plugin of plugins) {
            const pluginId = plugin.id ?? plugin.name ?? String(plugin);
            const pluginLabel = plugin.name ?? plugin.id ?? String(plugin);
            nodes.push({ id: pluginId, label: pluginLabel });
            const deps = plugin.dependencies ?? [];
            for (const dep of deps) {
              edges.push({ source: dep, target: pluginId, label: "depends on" });
            }
          }
        }
      } catch {
        // Runtime not available - show a sample plugin graph
      }

      // If no plugins found, show sample
      if (nodes.length === 0) {
        nodes.push(
          { id: "core", label: "core" },
          { id: "network", label: "network" },
          { id: "rendering", label: "rendering" },
          { id: "storage", label: "storage" },
          { id: "devtools", label: "devtools" },
        );
        edges.push(
          { source: "core", target: "network", label: "depends on" },
          { source: "core", target: "rendering", label: "depends on" },
          { source: "core", target: "storage", label: "depends on" },
          { source: "network", target: "devtools", label: "depends on" },
          { source: "rendering", target: "devtools", label: "depends on" },
        );
      }

      if (outputFormat === "json") {
        const json = renderGraphToJSON(nodes, edges);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(json, null, 2) },
          ],
        };
      }

      const svg = renderGraphToSVG(nodes, edges, { direction: "TB" });
      return {
        content: [
          { type: "text" as const, text: "Plugin dependency graph" },
          { type: "text" as const, text: svg },
        ],
      };
    },
  );

  // Tool 4: Pipeline trace
  server.tool(
    "browserx_pipeline_trace",
    "Trace a rendering or request pipeline execution and return the stage waterfall as SVG. Attaches a LiveTraceBridge observer to capture real-time stage progression.",
    {
      url: z.string().describe("URL to render/request and trace"),
      pipeline: z.enum(["rendering", "request"]).optional().describe("Pipeline to trace. Default: rendering"),
      sessionId: z.string().optional().describe("Session ID for an active browser session"),
      theme: z.enum(["light", "dark"]).optional().describe("Color theme. Default: light"),
    },
    async ({ url, pipeline: pipelineType, sessionId, theme }) => {
      context.permissionGuard.checkToolPermission("browserx_pipeline_trace");
      const kind = (pipelineType as string) ?? "rendering";
      const bridge = kind === "request" ? LiveTraceBridge.forRequest() : LiveTraceBridge.forRendering();

      let executed = false;
      if (sessionId) {
        try {
          const sessionManager = await context.getSessionManager();
          if (sessionManager.hasSession(sessionId as string)) {
            const session = sessionManager.getSession(sessionId as string);
            if (session?.browserEngine) {
              if (kind === "rendering") {
                const rp = session.browserEngine.getRenderingPipeline?.();
                if (rp) {
                  rp.setObserver(bridge);
                  await rp.render(url as string);
                  executed = true;
                }
              } else {
                const reqP = session.browserEngine.getRequestPipeline?.();
                if (reqP) {
                  reqP.setObserver(bridge);
                  await reqP.request?.({ url: url as string, method: "GET" });
                  executed = true;
                }
              }
            }
          }
        } catch { /* fall through to sample */ }
      }

      if (!executed) {
        const trace = bridge.getTrace();
        for (const stage of trace.stages) {
          const now = Date.now();
          bridge.onStage({ stageId: stage.id, status: "running", startTime: now });
          bridge.onStage({ stageId: stage.id, status: "completed", startTime: now, endTime: now + 10, duration: 10 });
        }
      }

      const trace = bridge.getTrace();
      const nodes = trace.stages.map((s: any) => ({ id: s.id, label: `${s.stage}\n[${s.status}]` }));
      const edges = trace.edges.map((e: any) => ({ source: e.sourceStage, target: e.targetStage, label: e.dataFlowLabel }));
      const svg = renderGraphToSVG(nodes, edges, { theme: (theme as "light" | "dark") ?? "light" });

      return {
        content: [
          { type: "text" as const, text: executed ? `Live ${kind} pipeline trace for ${url}` : `Sample ${kind} pipeline waterfall (no active session)` },
          { type: "text" as const, text: svg },
        ],
      };
    },
  );

  // Tool 5: Rendering trees
  server.tool(
    "browserx_rendering_trees",
    "Visualize intermediate rendering artifacts (DOM tree, CSSOM, layout boxes, display list, render tree) as SVG graphs.",
    {
      tree: z.enum(["dom", "cssom", "render", "layout", "paint", "all"]).describe("Which tree to visualize"),
      sessionId: z.string().optional().describe("Session ID"),
      theme: z.enum(["light", "dark"]).optional().describe("Color theme. Default: light"),
      direction: z.enum(["TB", "LR"]).optional().describe("Layout direction. Default: TB"),
    },
    async ({ tree, sessionId, theme, direction }) => {
      context.permissionGuard.checkToolPermission("browserx_rendering_trees");
      const dir = (direction as "TB" | "LR") ?? "TB";
      const _theme = (theme as "light" | "dark") ?? "light";
      const _astAsSvg = astAsSvg;
      const contents: { type: "text"; text: string }[] = [];

      let artifacts: { dom?: unknown; cssom?: unknown; renderTree?: unknown; layoutTree?: unknown; displayList?: unknown } | undefined;

      if (sessionId) {
        try {
          const sessionManager = await context.getSessionManager();
          if (sessionManager.hasSession(sessionId as string)) {
            const session = sessionManager.getSession(sessionId as string);
            if (session?.browserEngine) {
              const rp = session.browserEngine.getRenderingPipeline?.();
              artifacts = rp?.getLastRenderArtifacts?.();
            }
          }
        } catch { /* no artifacts */ }
      }

      if (!artifacts) {
        return { content: [{ type: "text" as const, text: "No render artifacts available. Render a page first using browserx_pipeline_trace, then call this tool with the same sessionId." }] };
      }

      const treeType = tree as string;
      const addSvg = (label: string, svg: string): void => {
        contents.push({ type: "text" as const, text: `--- ${label} ---` });
        contents.push({ type: "text" as const, text: svg });
      };

      if (treeType === "dom" || treeType === "all") {
        if (artifacts.dom) addSvg("DOM Tree", domTreeAsSvg(artifacts.dom, dir));
      }
      if (treeType === "cssom" || treeType === "all") {
        if (artifacts.cssom) addSvg("CSSOM", cssomAsSvg(artifacts.cssom, dir));
      }
      if (treeType === "render" || treeType === "all") {
        if (artifacts.renderTree) {
          const nodes: { id: string; label: string }[] = [];
          const edges: { source: string; target: string }[] = [];
          let counter = 0;
          const walk = (node: any, parentId?: string): void => {
            const id = `rt_${counter++}`;
            nodes.push({ id, label: node.type ?? node.tagName ?? "node" });
            if (parentId) edges.push({ source: parentId, target: id });
            for (const child of (node.children ?? [])) walk(child, id);
          };
          walk(artifacts.renderTree);
          addSvg("Render Tree", renderGraphToSVG(nodes, edges, { direction: dir }));
        }
      }
      if (treeType === "layout" || treeType === "all") {
        if (artifacts.layoutTree) addSvg("Layout Tree", layoutTreeAsSvg(artifacts.layoutTree, dir));
      }
      if (treeType === "paint" || treeType === "all") {
        if (artifacts.displayList) addSvg("Display List", displayListAsSvg(artifacts.displayList, dir));
      }

      if (contents.length === 0) {
        contents.push({ type: "text" as const, text: `No '${tree}' artifact found in last render.` });
      }

      return { content: contents };
    },
  );

  // Tool 6: Query trace
  server.tool(
    "browserx_query_trace",
    "Execute a BrowserX query and return the 7-stage query pipeline waterfall as SVG.",
    {
      query: z.string().describe("BrowserX query to execute and trace"),
      theme: z.enum(["light", "dark"]).optional().describe("Color theme. Default: light"),
    },
    async ({ query, theme }) => {
      context.permissionGuard.checkToolPermission("browserx_query_trace");
      const bridge = LiveTraceBridge.forQuery();

      let executed = false;
      try {
        const queryEngine = await context.getQueryEngine();
        if (queryEngine.setObserver) {
          queryEngine.setObserver(bridge);
          await queryEngine.execute(query as string);
          executed = true;
        }
      } catch { /* fall through */ }

      if (!executed) {
        const trace = bridge.getTrace();
        for (const stage of trace.stages) {
          const now = Date.now();
          bridge.onStage({ stageId: stage.id, status: "running", startTime: now });
          bridge.onStage({ stageId: stage.id, status: "completed", startTime: now, endTime: now + 5, duration: 5 });
        }
      }

      const trace = bridge.getTrace();
      const nodes = trace.stages.map((s: any) => ({ id: s.id, label: `${s.stage}\n[${s.status}]` }));
      const edges = trace.edges.map((e: any) => ({ source: e.sourceStage, target: e.targetStage, label: e.dataFlowLabel }));
      const svg = renderGraphToSVG(nodes, edges, { theme: (theme as "light" | "dark") ?? "light" });

      return {
        content: [
          { type: "text" as const, text: executed ? `Query pipeline trace for: ${query}` : `Sample query pipeline waterfall` },
          { type: "text" as const, text: svg },
        ],
      };
    },
  );
}

/**
 * Build a query plan graph from a query string by analyzing its structure.
 * This is a fallback when the query engine's explain() is not available.
 */
function buildQueryPlanGraph(
  query: string,
  nodes: { id: string; label: string }[],
  edges: { source: string; target: string; label?: string }[],
): void {
  const upperQuery = query.toUpperCase().trim();
  let stepIndex = 0;

  const addStep = (label: string): string => {
    const id = `step_${stepIndex++}`;
    nodes.push({ id, label });
    return id;
  };

  // Parse stage: always first
  const parseId = addStep("Parse Query");

  // Analyze stage
  const analyzeId = addStep("Semantic Analysis");
  edges.push({ source: parseId, target: analyzeId });

  // Optimize stage
  const optimizeId = addStep("Optimize");
  edges.push({ source: analyzeId, target: optimizeId });

  let lastId = optimizeId;

  // Add execution stages based on query keywords
  if (upperQuery.startsWith("SELECT") || upperQuery.includes("FROM")) {
    if (upperQuery.includes("FROM") && (upperQuery.includes("HTTP://") || upperQuery.includes("HTTPS://"))) {
      const navId = addStep("Navigate to URL");
      edges.push({ source: lastId, target: navId });
      lastId = navId;
    }
    const extractId = addStep("Extract Data");
    edges.push({ source: lastId, target: extractId });
    lastId = extractId;
  } else if (upperQuery.startsWith("NAVIGATE")) {
    const navId = addStep("Navigate");
    edges.push({ source: lastId, target: navId });
    lastId = navId;

    if (upperQuery.includes("CAPTURE")) {
      const captureId = addStep("Capture Results");
      edges.push({ source: navId, target: captureId });
      lastId = captureId;
    }
  } else if (upperQuery.startsWith("INSERT") || upperQuery.startsWith("CLICK")) {
    const actionId = addStep("DOM Action");
    edges.push({ source: lastId, target: actionId });
    lastId = actionId;
  } else {
    const execId = addStep("Execute");
    edges.push({ source: lastId, target: execId });
    lastId = execId;
  }

  // Format stage: always last
  const formatId = addStep("Format Output");
  edges.push({ source: lastId, target: formatId });
}
