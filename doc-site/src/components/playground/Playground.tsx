import React, { useEffect, useRef, useState } from 'react';
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

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function csvQuote(val: string): string {
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

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

  const abortControllerRef = useRef<AbortController | null>(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveNameInput, setSaveNameInput] = useState('');

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get('q');
    if (q) usePlaygroundStore.getState().setQuery(q);
  }, []);

  const handleExecute = async () => {
    const query = usePlaygroundStore.getState().currentQuery;
    const executionId = `exec_${Date.now()}`;
    const startTime = Date.now();

    clearResults();
    resetPipeline();
    usePlaygroundStore.setState({ activeExecution: { id: executionId, status: 'running' } });
    addConsoleLog({ level: 'info', message: `Starting execution: ${executionId}`, timestamp: Date.now() });

    const controller = new AbortController();
    abortControllerRef.current = controller;

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
        body: JSON.stringify({ query, options: { timeout: 60000, captureScreenshots: true } }),
        signal: controller.signal,
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
        addScreenshot(results.screenshot ?? `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==`);
        addToHistory({
          id: executionId,
          query,
          timestamp: startTime,
          status: 'success',
          duration: Date.now() - startTime,
        });
      } else {
        const errData = await response.json().catch(() => ({ error: { message: 'Request failed' } }));
        throw new Error(errData.error?.message ?? `HTTP ${response.status}`);
      }

      usePlaygroundStore.setState({ activeExecution: null });
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
        query,
        timestamp: startTime,
        status: 'error',
        duration: Date.now() - startTime,
      });
      usePlaygroundStore.setState({ activeExecution: null });
    }
  };

  const handleCancel = () => {
    if (abortControllerRef.current) { abortControllerRef.current.abort(); abortControllerRef.current = null; }
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
        content  = [cols.join(','), ...rows.map((r) => cols.map((c) => csvQuote(String(r[c] ?? ''))).join(','))].join('\n');
        mimeType = 'text/csv';
        filename = 'results.csv';
        break;
      }
      case 'html': {
        const hc = currentResults.columns ?? [];
        const hr = currentResults.rows ?? [];
        content  = `<!DOCTYPE html><html><head><title>Query Results</title></head><body><table border="1"><thead><tr>${hc.map((c) => `<th>${escapeHtml(c)}</th>`).join('')}</tr></thead><tbody>${hr.map((r) => `<tr>${hc.map((c) => `<td>${escapeHtml(String(r[c] ?? ''))}</td>`).join('')}</tr>`).join('')}</tbody></table></body></html>`;
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
    setShowSaveModal(true);
    setSaveNameInput('');
  };
  const handleSaveConfirm = () => {
    if (saveNameInput.trim()) {
      saveQuery(saveNameInput.trim());
      addConsoleLog({ level: 'info', message: `Query saved as "${saveNameInput.trim()}"`, timestamp: Date.now() });
    }
    setShowSaveModal(false);
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
      {showSaveModal && (
        <div className="save-modal" style={{ padding: '8px 14px', background: 'var(--bx-overlay)', borderBottom: '1px solid var(--bx-border)', display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input
            type="text"
            value={saveNameInput}
            onChange={(e) => setSaveNameInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSaveConfirm()}
            placeholder="Query name…"
            autoFocus
            style={{ flex: 1, background: 'var(--bx-raised)', border: '1px solid var(--bx-border)', borderRadius: '2px', color: 'var(--bx-white)', padding: '4px 8px', fontSize: '0.8125rem' }}
          />
          <button onClick={handleSaveConfirm} className="btn btn-primary" style={{ padding: '4px 12px' }}>Save</button>
          <button onClick={() => setShowSaveModal(false)} className="btn btn-secondary" style={{ padding: '4px 12px' }}>Cancel</button>
        </div>
      )}
      <div className="playground-content">
        {showHistory   && <HistoryPanel />}
        {showTemplates && <TemplatesPanel />}

        {/* Panel 1: Editor */}
        <div className="editor-panel">
          <div className="editor-mode-tabs" role="tablist">
            <button
              className={`editor-mode-tab${editorMode === 'code'      ? ' editor-mode-tab--active' : ''}`}
              onClick={() => setEditorMode('code')}
              role="tab"
              aria-selected={editorMode === 'code'}
            >Code</button>
            <button
              className={`editor-mode-tab${editorMode === 'blocks'    ? ' editor-mode-tab--active' : ''}`}
              onClick={() => setEditorMode('blocks')}
              role="tab"
              aria-selected={editorMode === 'blocks'}
            >Builder</button>
            <button
              className={`editor-mode-tab${editorMode === 'generator' ? ' editor-mode-tab--active' : ''}`}
              onClick={() => setEditorMode('generator')}
              role="tab"
              aria-selected={editorMode === 'generator'}
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
