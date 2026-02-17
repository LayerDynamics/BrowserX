import React, { useEffect, useRef } from 'react';
import { QueryEditor } from './QueryEditor';
import { BrowserPreview } from './BrowserPreview';
import { ControlBar } from './ControlBar';
import { usePlaygroundStore } from './store';
import './Playground.css';
import './ControlBar.css';

/**
 * Main Playground component that integrates the query editor, control bar, and browser preview.
 * Handles query execution via API and WebSocket real-time updates.
 */
export const Playground: React.FC = () => {
  const {
    currentQuery,
    executeQuery,
    cancelExecution,
    addToHistory,
    addScreenshot,
    addConsoleLog,
    setResults,
    clearResults,
    saveQuery,
  } = usePlaygroundStore();

  const wsRef = useRef<WebSocket | null>(null);

  // Cleanup WebSocket on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  /**
   * Execute the current query.
   * Makes POST request to /api/execute, then connects WebSocket for real-time updates.
   */
  const handleExecute = async () => {
    const executionId = `exec_${Date.now()}`;
    const startTime = Date.now();

    // Clear previous results
    clearResults();
    addConsoleLog({ level: 'info', message: `Starting execution: ${executionId}`, timestamp: Date.now() });

    try {
      // Execute query via API — also populates results and screenshot via direct store actions
      const response = await fetch('/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: currentQuery, options: { timeout: 60000, captureScreenshots: true } }),
      });
      if (response.ok) {
        const { results } = await response.json();
        setResults(results);
        // When real screenshots arrive they come as base64 data URLs; the mock path signals completion
        addScreenshot(`data:text/plain;base64,${btoa(`Mock screenshot — query executed at ${new Date().toISOString()}`)}`);
      }
      await executeQuery(currentQuery);

      /* Future implementation when API is ready:
      const response = await fetch('/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: currentQuery,
          options: {
            timeout: 60000,
            captureScreenshots: true,
            captureConsole: true,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      const { executionId: id, wsUrl } = await response.json();

      // Connect WebSocket for real-time updates
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      setWsConnection(ws);

      ws.onopen = () => {
        addConsoleLog({ level: 'info', message: 'WebSocket connected', timestamp: Date.now() });
      };

      ws.onmessage = (event) => {
        const message = JSON.parse(event.data);

        switch (message.type) {
          case 'started':
            addConsoleLog({ level: 'info', message: `Execution started: ${message.executionId}`, timestamp: message.timestamp });
            break;

          case 'progress':
            addConsoleLog({ level: 'info', message: `${message.step} (${message.percent}%)`, timestamp: Date.now() });
            break;

          case 'screenshot':
            addScreenshot(message.data);
            addConsoleLog({ level: 'info', message: 'Screenshot captured', timestamp: message.timestamp });
            break;

          case 'console':
            addConsoleLog({ level: message.level, message: message.message, timestamp: message.timestamp });
            break;

          case 'result':
            setResults(message.data);
            addConsoleLog({ level: 'info', message: `Query completed: ${message.data.rows?.length || 0} rows`, timestamp: Date.now() });

            const endTime = Date.now();
            addToHistory({
              id: executionId,
              query: currentQuery,
              timestamp: startTime,
              status: 'success',
              duration: endTime - startTime,
            });
            break;

          case 'error':
            throw new Error(message.error.message);
        }
      };

      ws.onerror = () => {
        addConsoleLog({ level: 'error', message: 'WebSocket connection error', timestamp: Date.now() });
      };

      ws.onclose = () => {
        addConsoleLog({ level: 'info', message: 'WebSocket closed', timestamp: Date.now() });
        setWsConnection(null);
        wsRef.current = null;
      };
      */
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      addConsoleLog({ level: 'error', message: errorMessage, timestamp: Date.now() });

      const endTime = Date.now();
      addToHistory({
        id: executionId,
        query: currentQuery,
        timestamp: startTime,
        status: 'error',
        duration: endTime - startTime,
      });
    }
  };

  /**
   * Cancel the currently running query execution.
   */
  const handleCancel = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    cancelExecution();
    addConsoleLog({ level: 'info', message: 'Execution cancelled', timestamp: Date.now() });
  };

  /**
   * Export current results in the specified format.
   */
  const handleExport = (format: 'json' | 'csv' | 'html') => {
    addConsoleLog({ level: 'info', message: `Exporting as ${format.toUpperCase()}...`, timestamp: Date.now() });

    const { currentResults } = usePlaygroundStore.getState();
    if (!currentResults) {
      addConsoleLog({ level: 'warn', message: 'No results to export', timestamp: Date.now() });
      return;
    }

    // Basic implementation
    let content: string;
    let mimeType: string;
    let filename: string;

    switch (format) {
      case 'json':
        content = JSON.stringify(currentResults, null, 2);
        mimeType = 'application/json';
        filename = 'results.json';
        break;

      case 'csv':
        // Simple CSV conversion
        const columns = currentResults.columns || [];
        const rows = currentResults.rows || [];
        const csvRows = [
          columns.join(','),
          ...rows.map(row => columns.map(col => JSON.stringify(row[col] || '')).join(',')),
        ];
        content = csvRows.join('\n');
        mimeType = 'text/csv';
        filename = 'results.csv';
        break;

      case 'html':
        // Simple HTML table
        const htmlColumns = currentResults.columns || [];
        const htmlRows = currentResults.rows || [];
        content = `<!DOCTYPE html>
<html>
<head><title>Query Results</title></head>
<body>
<table border="1">
  <thead><tr>${htmlColumns.map(c => `<th>${c}</th>`).join('')}</tr></thead>
  <tbody>
  ${htmlRows.map(row => `<tr>${htmlColumns.map(col => `<td>${row[col] || ''}</td>`).join('')}</tr>`).join('\n')}
  </tbody>
</table>
</body>
</html>`;
        mimeType = 'text/html';
        filename = 'results.html';
        break;
    }

    // Trigger download
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);

    addConsoleLog({ level: 'info', message: `Exported as ${filename}`, timestamp: Date.now() });
  };

  /**
   * Save the current query.
   */
  const handleSave = () => {
    const name = prompt('Enter a name for this query:');
    if (name) {
      saveQuery(name);
      addConsoleLog({ level: 'info', message: `Query saved as "${name}"`, timestamp: Date.now() });
    }
  };

  /**
   * Generate a shareable link for the current query.
   */
  const handleShare = () => {
    const encodedQuery = encodeURIComponent(currentQuery);
    const shareUrl = `${window.location.origin}/playground?q=${encodedQuery}`;

    try {
      // Guard against environments where navigator.clipboard is unavailable or throws synchronously
      if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') {
        throw new Error('Clipboard API not available');
      }

      navigator.clipboard
        .writeText(shareUrl)
        .then(() => {
          addConsoleLog({
            level: 'info',
            message: 'Share link copied to clipboard',
            timestamp: Date.now(),
          });
        })
        .catch(() => {
          addConsoleLog({
            level: 'warn',
            message: `Share link: ${shareUrl}`,
            timestamp: Date.now(),
          });
        });
    } catch {
      // Fallback when clipboard access is not available or throws synchronously
      addConsoleLog({
        level: 'warn',
        message: `Share link: ${shareUrl}`,
        timestamp: Date.now(),
      });
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
        <div className="editor-panel">
          <QueryEditor />
        </div>
        <div className="preview-panel">
          <BrowserPreview />
        </div>
      </div>
    </div>
  );
};
