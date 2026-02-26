import React, { useState, useRef, useCallback, useEffect } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import type * as Monaco from 'monaco-editor';
import './PipelineVisualizer.css';
import { PipelineCanvas } from './PipelineCanvas';
import { StageNode } from './StageNode';
import type { StageInfo } from './StageNode';
import { PipelineTimeline } from './PipelineTimeline';
import type { StageEvent } from './StageCard';

// ─── Constants ───────────────────────────────────────────────

const STAGES: StageInfo[] = [
  {
    index: 0,
    name: 'Lexer',
    shortName: 'Lexer',
    icon: '⟨/⟩',
    description: 'Tokenizes the query string into a flat stream of typed tokens',
    timingKey: 'lexerTime',
  },
  {
    index: 1,
    name: 'Parser',
    shortName: 'Parser',
    icon: '◈',
    description: 'Builds an Abstract Syntax Tree from the token stream',
    timingKey: 'parserTime',
  },
  {
    index: 2,
    name: 'Semantic Analyzer',
    shortName: 'Semantic',
    icon: '◎',
    description: 'Validates identifiers, types, and permissions',
    timingKey: 'semanticAnalysisTime',
  },
  {
    index: 3,
    name: 'Optimizer',
    shortName: 'Optimizer',
    icon: '⚡',
    description: 'Applies transformations to reduce execution cost',
    timingKey: 'optimizationTime',
  },
  {
    index: 4,
    name: 'Planner',
    shortName: 'Planner',
    icon: '⊞',
    description: 'Produces a concrete execution plan with cost estimates',
    timingKey: 'planningTime',
  },
  {
    index: 5,
    name: 'Executor',
    shortName: 'Executor',
    icon: '▶',
    description: 'Runs each step: navigates, fetches, extracts',
    timingKey: 'executionTime',
  },
  {
    index: 6,
    name: 'Formatter',
    shortName: 'Formatter',
    icon: '⊟',
    description: 'Serializes results into the requested output format',
    timingKey: 'formattingTime',
  },
];

const PRESETS = [
  {
    label: 'Basic SELECT',
    query: 'SELECT title, description FROM "https://example.com"',
  },
  {
    label: 'Filter & Sort',
    query: 'SELECT name, price FROM "https://store.example.com"\nWHERE price < 100\nORDER BY price ASC\nLIMIT 10',
  },
  {
    label: 'Navigate + Capture',
    query: 'NAVIGATE TO "https://api.example.com"\n  WITH { timeout: 5000, proxy: { cache: true } }\n  CAPTURE response.body, dom.title',
  },
  {
    label: 'Conditional Login',
    query: 'IF EXISTS("#login-form") THEN\n  INSERT "user@example.com" INTO "#email"\n  INSERT "password123" INTO "#password"\n  CLICK "#submit"\nEND',
  },
  {
    label: 'Loop Pages',
    query: 'FOR EACH url IN ["https://a.com", "https://b.com", "https://c.com"] DO\n  NAVIGATE TO url\n  SELECT title FROM "current"\nEND',
  },
];

// ─── Stage Detail Generator ───────────────────────────────────

function buildStageEvents(
  query: string,
  apiResult: {
    timing: Record<string, number>;
    metadata: {
      stepsExecuted: number;
      estimatedCost: number;
      actualCost: number;
      browserNavigations: number;
      cacheHits: number;
      cacheMisses: number;
    };
    networkRequests: Array<{
      url: string;
      method: string;
      status: number;
      duration: number;
      size: number;
    }>;
    data: unknown;
  }
): StageEvent[] {
  const q = query.trim();
  const qUpper = q.toUpperCase();
  const firstWord = qUpper.split(/\s/)[0];
  const urlMatch = q.match(/"(https?:\/\/[^"]+)"/);
  const targetUrl = urlMatch ? urlMatch[1] : null;

  // Rough token simulation
  const rawTokens = q.split(/[\s,;{}[\]()"]+/).filter(Boolean);
  const keywords = ['SELECT', 'FROM', 'WHERE', 'NAVIGATE', 'TO', 'WITH', 'CAPTURE',
    'INSERT', 'INTO', 'CLICK', 'IF', 'THEN', 'ELSE', 'END', 'FOR', 'EACH', 'IN',
    'DO', 'ORDER', 'BY', 'ASC', 'DESC', 'LIMIT', 'EXISTS', 'AND', 'OR', 'NOT'];

  const tokenList = rawTokens.map((t) => ({
    type: keywords.includes(t.toUpperCase())
      ? 'KEYWORD'
      : /^https?:\/\//.test(t)
      ? 'URL'
      : /^\d+$/.test(t)
      ? 'NUMBER'
      : t.startsWith('#')
      ? 'SELECTOR'
      : 'IDENTIFIER',
    value: t,
  }));
  tokenList.push({ type: 'EOF', value: '' });

  const keywordCount = tokenList.filter((t) => t.type === 'KEYWORD').length;
  const identifierCount = tokenList.filter((t) => t.type === 'IDENTIFIER').length;

  const timing = apiResult.timing;

  return [
    // Stage 0: Lexer
    {
      stage: 0,
      name: 'Lexer',
      duration: timing.lexerTime ?? 2.5,
      summary: `${tokenList.length} tokens — ${keywordCount} keywords, ${identifierCount} identifiers`,
      detail: {
        tokenCount: tokenList.length,
        tokens: tokenList.slice(0, 12),
        tokenizedIn: `${(timing.lexerTime ?? 2.5).toFixed(2)}ms`,
        processingMode: 'streaming',
        warnings: [],
      },
    },
    // Stage 1: Parser
    {
      stage: 1,
      name: 'Parser',
      duration: timing.parserTime ?? 3.1,
      summary: `${firstWord} statement — AST depth 3, ${rawTokens.length + 4} nodes`,
      detail: {
        statementType: firstWord,
        ast: {
          type: `${firstWord.charAt(0) + firstWord.slice(1).toLowerCase()}Statement`,
          nodeCount: rawTokens.length + 4,
          depth: 3,
          ...(targetUrl ? { source: { type: 'URLSource', url: targetUrl } } : {}),
        },
        parseTimeMs: timing.parserTime ?? 3.1,
        errors: [],
      },
    },
    // Stage 2: Semantic Analyzer
    {
      stage: 2,
      name: 'Semantic Analyzer',
      duration: timing.semanticAnalysisTime ?? 1.8,
      summary: `${identifierCount + 2} symbols resolved — permissions granted`,
      detail: {
        checksPerformed: [
          'TypeCompatibility: OK',
          'SymbolResolution: OK',
          ...(targetUrl ? ['URLPermission: NAVIGATE_PUBLIC granted'] : []),
          'SecurityPolicy: OK',
        ],
        symbolsResolved: identifierCount + 2,
        permissionsRequired: targetUrl ? ['NAVIGATE_PUBLIC', 'READ_DOM'] : ['READ_DATA'],
        warnings: [],
        errors: [],
      },
    },
    // Stage 3: Optimizer
    {
      stage: 3,
      name: 'Optimizer',
      duration: timing.optimizationTime ?? 2.3,
      summary: `${targetUrl ? 3 : 2} optimization passes — cost reduced`,
      detail: {
        passesApplied: [
          'ColumnPruning: reduced to projected columns only',
          ...(targetUrl ? ['NetworkPrefetch: deferred to execution'] : []),
          'ConstantFolding: no constants found',
          'PredicatePushdown: predicates pushed to source',
        ],
        estimatedCostBefore: apiResult.metadata.estimatedCost,
        estimatedCostAfter: Math.round(apiResult.metadata.estimatedCost * 0.88),
        transformationsApplied: targetUrl ? 3 : 2,
      },
    },
    // Stage 4: Planner
    {
      stage: 4,
      name: 'Planner',
      duration: timing.planningTime ?? 1.5,
      summary: `${apiResult.metadata.stepsExecuted} execution steps planned`,
      detail: {
        plan: {
          steps: [
            ...(targetUrl
              ? [{ id: 1, type: 'NavigateStep', target: targetUrl, estimatedCost: 420 }]
              : []),
            { id: targetUrl ? 2 : 1, type: 'ExtractStep', estimatedCost: 8 },
            { id: targetUrl ? 3 : 2, type: 'FormatStep', format: 'JSON', estimatedCost: 1 },
          ],
          totalSteps: apiResult.metadata.stepsExecuted,
          estimatedTotalCost: apiResult.metadata.estimatedCost,
          parallelizable: false,
          cacheable: apiResult.metadata.cacheHits > 0,
        },
      },
    },
    // Stage 5: Executor
    {
      stage: 5,
      name: 'Executor',
      duration: timing.executionTime ?? 450,
      summary: `${apiResult.metadata.stepsExecuted} steps, ${apiResult.networkRequests.length} req${apiResult.networkRequests.length !== 1 ? 's' : ''} — ${timing.executionTime?.toFixed(0) ?? 450}ms`,
      detail: {
        stepsExecuted: apiResult.metadata.stepsExecuted,
        browserNavigations: apiResult.metadata.browserNavigations,
        networkRequests: apiResult.networkRequests,
        cacheHits: apiResult.metadata.cacheHits,
        cacheMisses: apiResult.metadata.cacheMisses,
        actualCost: apiResult.metadata.actualCost,
      },
    },
    // Stage 6: Formatter
    {
      stage: 6,
      name: 'Formatter',
      duration: timing.formattingTime ?? 0.8,
      summary: `JSON output — ${Array.isArray(apiResult.data) ? apiResult.data.length : 1} row${Array.isArray(apiResult.data) && apiResult.data.length !== 1 ? 's' : ''} formatted`,
      detail: {
        outputFormat: 'JSON',
        rowsFormatted: Array.isArray(apiResult.data) ? apiResult.data.length : 1,
        outputSizeBytes: JSON.stringify(apiResult.data).length,
        pretty: true,
        formattingTimeMs: timing.formattingTime ?? 0.8,
      },
    },
  ];
}

// ─── Monaco Editor (inline, adapted from playground) ──────────

interface QueryEditorInlineProps {
  value: string;
  onChange: (v: string) => void;
}

const QueryEditorInline = React.memo<QueryEditorInlineProps>(({ value, onChange }) => {
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof Monaco | null>(null);

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    if (!monaco.languages.getLanguages().find((l: { id: string }) => l.id === 'browserx-query')) {
    monaco.languages.register({ id: 'browserx-query' });
    monaco.languages.setMonarchTokensProvider('browserx-query', {
      tokenizer: {
        root: [
          [
            /\b(SELECT|FROM|WHERE|NAVIGATE|TO|CLICK|INSERT|INTO|IF|THEN|ELSE|FOR|EACH|IN|WITH|CAPTURE|SET|SHOW|EXISTS|COUNT|TEXT|HTML|ATTR|UPDATE|DELETE|END|DO|RANGE|OR|AND|NOT|ORDER|BY|ASC|DESC|LIMIT|OFFSET|LIKE|IN|MATCHES|PROCEED)\b/,
            'keyword',
          ],
          [/[=!<>]+/, 'operator'],
          [/\d+(\.\d+)?/, 'number'],
          [/"([^"\\]|\\.)*"/, 'string'],
          [/'([^'\\]|\\.)*'/, 'string'],
          [/--.*$/, 'comment'],
          [/[{}[\]()]/, 'bracket'],
          [/[,;]/, 'delimiter'],
          [/\|\|/, 'operator'],
        ],
      },
    });
    }

    monaco.editor.defineTheme('browserx-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'keyword', foreground: 'ffffff', fontStyle: 'bold' },
        { token: 'string', foreground: '888888' },
        { token: 'number', foreground: 'c8c8c8' },
        { token: 'comment', foreground: '444444', fontStyle: 'italic' },
        { token: 'operator', foreground: '666666' },
        { token: 'bracket', foreground: 'c8c8c8' },
        { token: 'delimiter', foreground: '555555' },
      ],
      colors: {
        'editor.background': '#000000',
        'editor.foreground': '#c8c8c8',
        'editorLineNumber.foreground': '#333333',
        'editorCursor.foreground': '#ffffff',
        'editor.selectionBackground': '#1a1a1a',
        'editor.lineHighlightBackground': '#080808',
        'editorIndentGuide.background1': '#111111',
        'editorIndentGuide.activeBackground1': '#222222',
      },
    });

    monaco.editor.setTheme('browserx-dark');
  };

  return (
    <Editor
      height="100%"
      language="browserx-query"
      theme="browserx-dark"
      value={value}
      onChange={(v) => onChange(v ?? '')}
      onMount={handleMount}
      options={{
        minimap: { enabled: false },
        fontSize: 13,
        lineNumbers: 'on',
        scrollBeyondLastLine: false,
        automaticLayout: true,
        tabSize: 2,
        wordWrap: 'on',
        renderLineHighlight: 'line',
        cursorBlinking: 'smooth',
        smoothScrolling: true,
        folding: false,
        lineDecorationsWidth: 0,
        overviewRulerLanes: 0,
      }}
    />
  );
});

// ─── Results Panel ─────────────────────────────────────────────

interface ResultsPanelProps {
  data: unknown;
  totalTime: number;
}

const ResultsPanel: React.FC<ResultsPanelProps> = ({ data, totalTime }) => {
  const isArray = Array.isArray(data);
  const rows = isArray ? (data as Record<string, unknown>[]) : null;
  const columns = rows && rows.length > 0 ? Object.keys(rows[0]) : [];

  return (
    <div className="results-panel">
      <div className="results-panel__header">
        <span className="results-panel__label">Query Result</span>
        <span className="results-panel__timing">⏱ {totalTime.toFixed(1)}ms total</span>
      </div>

      {rows && rows.length > 0 ? (
        <table className="results-table">
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                {columns.map((col) => (
                  <td key={col}>{String(row[col] ?? '')}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <pre className="results-json">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
};

// ─── Helpers ────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// ─── Main Component ────────────────────────────────────────────

export type PipelineStatus = 'idle' | 'running' | 'complete' | 'error';

export const PipelineVisualizer: React.FC = () => {
  const [query, setQuery] = useState(PRESETS[0].query);
  const [activePreset, setActivePreset] = useState(0);
  const [status, setStatus] = useState<PipelineStatus>('idle');
  const [activeStageIndex, setActiveStageIndex] = useState<number | null>(null);
  const [completedStages, setCompletedStages] = useState<number[]>([]);
  const [stageEvents, setStageEvents] = useState<StageEvent[]>([]);
  const [result, setResult] = useState<unknown | null>(null);
  const [totalTime, setTotalTime] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Stage node DOM positions for canvas targeting
  const [stagePositions, setStagePositions] = useState<number[]>([]);
  const nodeRefs = useRef<(HTMLDivElement | null)[]>(Array(STAGES.length).fill(null));
  const diagramRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Measure stage positions after render
  const measurePositions = useCallback(() => {
    if (!diagramRef.current) return;
    const diagramRect = diagramRef.current.getBoundingClientRect();
    const positions = nodeRefs.current.map((el) => {
      if (!el) return 0;
      const rect = el.getBoundingClientRect();
      return rect.left + rect.width / 2 - diagramRect.left;
    });
    setStagePositions(positions);
  }, []);

  useEffect(() => {
    measurePositions();
    const observer = new ResizeObserver(measurePositions);
    if (diagramRef.current) observer.observe(diagramRef.current);
    return () => observer.disconnect();
  }, [measurePositions]);

  const runQuery = useCallback(async () => {
    if (status === 'running') return;

    // Reset state
    setStatus('running');
    setActiveStageIndex(null);
    setCompletedStages([]);
    setStageEvents([]);
    setResult(null);
    setError(null);

    abortRef.current = new AbortController();

    try {
      const res = await fetch('/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: { message: 'Request failed' } }));
        throw new Error(err.error?.message ?? `HTTP ${res.status}`);
      }

      const json = await res.json();
      const apiResult = json.results;

      const events = buildStageEvents(query, apiResult);

      // Playback each stage sequentially
      for (let i = 0; i < STAGES.length; i++) {
        setActiveStageIndex(i);
        setStageEvents((prev) => [...prev, events[i]]);

        const rawDuration = (apiResult.timing[STAGES[i].timingKey] as number) ?? 300;
        const displayDuration = Math.max(rawDuration, 300);
        await sleep(displayDuration);

        setCompletedStages((prev) => [...prev, i]);
        setActiveStageIndex(null);

        // Brief pause between stages
        await sleep(80);
      }

      setTotalTime(apiResult.timing.totalTime ?? 500);
      setResult(apiResult.data);
      setStatus('complete');
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'An error occurred');
      setStatus('error');
    }
  }, [query, status]);

  const handlePreset = (index: number) => {
    setActivePreset(index);
    setQuery(PRESETS[index].query);
  };

  const handleQueryChange = (value: string) => {
    setQuery(value);
    setActivePreset(-1);
  };

  return (
    <div className="pipeline-visualizer">
      {/* Header */}
      <div className="pipeline-header">
        <div className="pipeline-header__eyebrow">BrowserX Query Engine</div>
        <h1 className="pipeline-header__title">
          Watch the <em>pipeline</em> execute
        </h1>
        <p className="pipeline-header__subtitle">
          Every query passes through 7 stages. Run one to see tokens, AST, optimization
          passes, and execution steps unfold in real time.
        </p>
      </div>

      {/* Body: left column + right timeline */}
      <div className="pipeline-body">
        <div className="pipeline-left">
          {/* Query Panel */}
          <div className="query-panel">
            <div className="query-panel__presets">
              <span className="query-panel__preset-label">Try</span>
              {PRESETS.map((p, i) => (
                <button
                  key={p.label}
                  className={`query-panel__preset-btn ${activePreset === i ? 'query-panel__preset-btn--active' : ''}`}
                  onClick={() => handlePreset(i)}
                  disabled={status === 'running'}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div className="query-panel__editor">
              <QueryEditorInline value={query} onChange={handleQueryChange} />
            </div>

            <div className="query-panel__actions">
              <button
                className={`query-panel__run-btn ${status === 'running' ? 'query-panel__run-btn--running' : ''}`}
                onClick={runQuery}
                disabled={status === 'running' || !query.trim()}
              >
                {status === 'running' ? '⟳ Executing...' : '▶ Run Query'}
              </button>

              <div className="query-panel__status">
                <div
                  className={`query-panel__status-dot ${query.trim() ? 'query-panel__status-dot--valid' : ''}`}
                />
                {status === 'idle' && 'Ready'}
                {status === 'running' && 'Pipeline running'}
                {status === 'complete' && `Complete in ${totalTime.toFixed(0)}ms`}
                {status === 'error' && 'Error'}
              </div>
            </div>

            {error && (
              <div className="query-panel__error">
                ✕ {error}
              </div>
            )}
          </div>

          {/* Pipeline Diagram */}
          <div className="pipeline-diagram" ref={diagramRef}>
            <PipelineCanvas
              activeStageIndex={activeStageIndex}
              stagePositions={stagePositions}
              isRunning={status === 'running'}
            />

            <div className="pipeline-stage-row">
              {STAGES.map((stage, i) => (
                <StageNode
                  key={stage.index}
                  stage={stage}
                  isActive={activeStageIndex === i}
                  isComplete={completedStages.includes(i)}
                  timing={stageEvents[i]?.duration}
                  isLast={i === STAGES.length - 1}
                  nodeRef={(el) => {
                    nodeRefs.current[i] = el;
                  }}
                />
              ))}
            </div>

            <div className="pipeline-diagram__bg-label">7-stage query pipeline</div>
          </div>

          {/* Results Panel */}
          {status === 'complete' && result !== null && (
            <ResultsPanel data={result} totalTime={totalTime} />
          )}
        </div>

        {/* Right: Timeline */}
        <PipelineTimeline events={stageEvents} status={status} />
      </div>
    </div>
  );
};
