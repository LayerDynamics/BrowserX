import React, { useEffect, useRef } from 'react';
import { QueryEditor } from './QueryEditor';
import { QueryBuilder } from './QueryBuilder';
import { QueryGenerator } from './QueryGenerator';
import { BrowserPreview } from './BrowserPreview';
import { ControlBar } from './ControlBar';
import { HistoryPanel } from './HistoryPanel';
import { TemplatesPanel } from './TemplatesPanel';
import { VisualizerPanel } from './VisualizerPanel';
import { usePlaygroundStore } from './store';
import './Playground.css';
import './ControlBar.css';

const STAGE_NAMES = ['Lex', 'Parse', 'Analyze', 'Optimize', 'Plan', 'Execute', 'Format'] as const;
const MOCK_DELAYS = [60, 80, 50, 70, 40, 300, 30]; // ms per stage for simulation

/**
 * Main Playground component — 3-panel layout: Editor | Visualizer | Preview.
 */
export const Playground: React.FC = () => {
  const {
    currentQuery,
    editorMode,
    setEditorMode,
    showHistory,
    showTemplates,
    executeQuery,
    cancelExecution,
    addToHistory,
    addScreenshot,
    addConsoleLog,
    addNetworkRequest,
    setResults,
    clearResults,
    saveQuery,
    resetPipeline,
    setPipelineStages,
  } = usePlaygroundStore();

  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  const handleExecute = async () => {
    const executionId = `exec_${Date.now()}`;
    const startTime = Date.now();

    clearResults();
    resetPipeline();
    addConsoleLog({ level: 'info', message: `Starting execution: ${executionId}`, timestamp: Date.now() });

    // Animate pipeline stages while the real fetch is in-flight
    const stageTimers: ReturnType<typeof setTimeout>[] = [];
    let accDelay = 0;
    for (let i = 0; i < STAGE_NAMES.length; i++) {
      const idx = i;
      const delay = accDelay;
      stageTimers.push(
        setTimeout(() => {
          setPipelineStages(
            STAGE_NAMES.map((name, j) => ({
              name,
              status: j < idx ? 'done' : j === idx ? 'running' : 'idle',
              durationMs: j < idx ? MOCK_DELAYS[j] : null,
            })),
          );
        }, delay),
      );
      accDelay += MOCK_DELAYS[i];
    }

    try {
      const response = await fetch('/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: currentQuery, options: { timeout: 60000, captureScreenshots: true } }),
      });

      // Real response arrived — stop simulation
      stageTimers.forEach(clearTimeout);

      if (response.ok) {
        const data = await response.json();
        const results = data.results;

        // Populate pipeline with actual API timing
        if (results?.timing) {
          const t = results.timing;
          setPipelineStages([
            { name: 'Lex',      status: 'done', durationMs: t.lexerTime             ?? null },
            { name: 'Parse',    status: 'done', durationMs: t.parserTime            ?? null },
            { name: 'Analyze',  status: 'done', durationMs: t.semanticAnalysisTime  ?? null },
            { name: 'Optimize', status: 'done', durationMs: t.optimizationTime      ?? null },
            { name: 'Plan',     status: 'done', durationMs: t.planningTime          ?? null },
            { name: 'Execute',  status: 'done', durationMs: t.executionTime         ?? null },
            { name: 'Format',   status: 'done', durationMs: t.formattingTime        ?? null },
          ]);
        } else {
          setPipelineStages(
            STAGE_NAMES.map((name, i) => ({ name, status: 'done', durationMs: MOCK_DELAYS[i] })),
          );
        }

        if (results) {
          setResults({
            columns: Array.isArray(results.data) && results.data.length > 0
              ? Object.keys(results.data[0] as Record<string, unknown>)
              : [],
            rows: Array.isArray(results.data) ? results.data : [],
            timing: {
              total:      results.timing?.totalTime      ?? (Date.now() - startTime),
              network:    results.timing?.executionTime,
              parsing:    results.timing?.parserTime,
              extraction: results.timing?.formattingTime,
            },
          });
          if (Array.isArray(results.networkRequests)) {
            for (const req of results.networkRequests) addNetworkRequest(req);
          }
        }
        addScreenshot(`data:text/plain;base64,${btoa(`Query executed at ${new Date().toISOString()}`)}`);
      }

      await executeQuery(currentQuery);
    } catch (error: unknown) {
      stageTimers.forEach(clearTimeout);

      // Mark the currently-running stage as error
      const currentStages = usePlaygroundStore.getState().pipelineStages;
      const runningIdx = currentStages.findIndex((s) => s.status === 'running');
      if (runningIdx >= 0) {
        setPipelineStages(
          currentStages.map((s, i) => (i === runningIdx ? { ...s, status: 'error' } : s)),
        );
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      addConsoleLog({ level: 'error', message: errorMessage, timestamp: Date.now() });
      addToHistory({
        id: executionId,
        query: currentQuery,
        timestamp: startTime,
        status: 'error',
        duration: Date.now() - startTime,
      });
    }
  };

  const handleCancel = () => {
    if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
    cancelExecution();
    addConsoleLog({ level: 'info', message: 'Execution cancelled', timestamp: Date.now() });
  };

  const handleExport = (format: 'json' | 'csv' | 'html') => {
    addConsoleLog({ level: 'info', message: `Exporting as ${format.toUpperCase()}…`, timestamp: Date.now() });
    const { currentResults } = usePlaygroundStore.getState();
    if (!currentResults) {
      addConsoleLog({ level: 'warn', message: 'No results to export', timestamp: Date.now() });
      return;
    }
    let content: string;
    let mimeType: string;
    let filename: string;
    switch (format) {
      case 'json':
        content  = JSON.stringify(currentResults, null, 2);
        mimeType = 'application/json';
        filename = 'results.json';
        break;
      case 'csv': {
        const cols = currentResults.columns ?? [];
        const rows = currentResults.rows ?? [];
        content  = [cols.join(','), ...rows.map((r) => cols.map((c) => JSON.stringify(r[c] ?? '')).join(','))].join('\n');
        mimeType = 'text/csv';
        filename = 'results.csv';
        break;
      }
      case 'html': {
        const hc = currentResults.columns ?? [];
        const hr = currentResults.rows ?? [];
        content  = `<!DOCTYPE html><html><head><title>Query Results</title></head><body><table border="1"><thead><tr>${hc.map((c) => `<th>${c}</th>`).join('')}</tr></thead><tbody>${hr.map((r) => `<tr>${hc.map((c) => `<td>${r[c] ?? ''}</td>`).join('')}</tr>`).join('')}</tbody></table></body></html>`;
        mimeType = 'text/html';
        filename = 'results.html';
        break;
      }
    }
    const blob = new Blob([content!], { type: mimeType! });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = filename!;
    a.click();
    URL.revokeObjectURL(url);
    addConsoleLog({ level: 'info', message: `Exported as ${filename}`, timestamp: Date.now() });
  };

  const handleSave = () => {
    const name = prompt('Enter a name for this query:');
    if (name) {
      saveQuery(name);
      addConsoleLog({ level: 'info', message: `Query saved as "${name}"`, timestamp: Date.now() });
    }
  };

  const handleShare = () => {
    const shareUrl = `${window.location.origin}/playground?q=${encodeURIComponent(currentQuery)}`;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(shareUrl)
        .then(() => addConsoleLog({ level: 'info', message: 'Share link copied to clipboard', timestamp: Date.now() }))
        .catch(() => addConsoleLog({ level: 'warn', message: `Share link: ${shareUrl}`, timestamp: Date.now() }));
    } else {
      addConsoleLog({ level: 'warn', message: `Share link: ${shareUrl}`, timestamp: Date.now() });
    }
  };

  return (
    <div className="playground">
      <ControlBar
        onExecute={handleExecute}
        onCancel={handleCancel}
        onExport={handleExport}
        onSave={handleSave}
        onShare={handleShare}
      />
      <div className="playground-content">
        {showHistory   && <HistoryPanel />}
        {showTemplates && <TemplatesPanel />}

        {/* Panel 1: Editor */}
        <div className="editor-panel">
          <div className="editor-mode-tabs">
            <button
              className={`editor-mode-tab${editorMode === 'code'      ? ' editor-mode-tab--active' : ''}`}
              onClick={() => setEditorMode('code')}
            >Code</button>
            <button
              className={`editor-mode-tab${editorMode === 'blocks'    ? ' editor-mode-tab--active' : ''}`}
              onClick={() => setEditorMode('blocks')}
            >Builder</button>
            <button
              className={`editor-mode-tab${editorMode === 'generator' ? ' editor-mode-tab--active' : ''}`}
              onClick={() => setEditorMode('generator')}
            >Generator</button>
          </div>
          <div className="editor-mode-content">
            {editorMode === 'code'      && <QueryEditor />}
            {editorMode === 'blocks'    && <QueryBuilder />}
            {editorMode === 'generator' && <QueryGenerator />}
          </div>
        </div>

        {/* Panel 2: Visualizer */}
        <div className="visualizer-panel-wrapper">
          <VisualizerPanel />
        </div>

        {/* Panel 3: Preview */}
        <div className="preview-panel">
          <BrowserPreview />
        </div>
      </div>
    </div>
  );
};
