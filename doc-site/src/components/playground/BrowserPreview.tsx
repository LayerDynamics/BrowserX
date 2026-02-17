import React, { useEffect, useRef } from 'react';
import { usePlaygroundStore } from './store';

/**
 * BrowserPreview component displays query execution results in tabbed views.
 * Shows screenshots, console logs, and network activity from the browser.
 */
export const BrowserPreview: React.FC = () => {
  const {
    previewMode,
    setPreviewMode,
    screenshots,
    consoleLogs,
    currentResults,
  } = usePlaygroundStore();

  const consoleEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll console to bottom when new logs arrive
  useEffect(() => {
    if (previewMode === 'console' && consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [consoleLogs, previewMode]);

  // Format timestamp for display
  const formatTimestamp = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  };

  // Get CSS class for log level
  const getLogLevelClass = (level: 'info' | 'warn' | 'error'): string => {
    return `log-${level}`;
  };

  // Get icon for log level
  const getLogLevelIcon = (level: 'info' | 'warn' | 'error'): string => {
    switch (level) {
      case 'info':
        return 'ℹ️';
      case 'warn':
        return '⚠️';
      case 'error':
        return '❌';
    }
  };

  // Render results table
  const renderResults = () => {
    if (!currentResults) {
      return (
        <div className="results-empty">
          Execute a query to see results.
        </div>
      );
    }

    const { columns, rows, timing } = currentResults;

    return (
      <div className="results-section">
        {timing && (
          <div className="results-timing">
            <strong>Timing:</strong> Total: {timing.total}ms
            {timing.network && ` | Network: ${timing.network}ms`}
            {timing.parsing && ` | Parsing: ${timing.parsing}ms`}
            {timing.extraction && ` | Extraction: ${timing.extraction}ms`}
          </div>
        )}

        {columns && rows && rows.length > 0 ? (
          <table className="results-table">
            <thead>
              <tr>
                {columns.map((column) => (
                  <th key={column}>{column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {columns.map((column) => (
                    <td key={column}>
                      {String(row[column] ?? '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="results-empty">No data rows returned.</div>
        )}
      </div>
    );
  };

  // Render screenshot tab content
  const renderScreenshotTab = () => {
    if (screenshots.length === 0) {
      return (
        <div className="tab-empty">
          No screenshots available. Execute a query to see browser output.
        </div>
      );
    }

    // Show the most recent screenshot
    const latestScreenshot = screenshots[screenshots.length - 1];

    return (
      <div className="screenshot-container">
        <div className="screenshot-timestamp">
          Captured at: {formatTimestamp(latestScreenshot.timestamp)}
        </div>
        <img
          src={latestScreenshot.data}
          alt="Browser screenshot"
          className="screenshot-image"
        />
      </div>
    );
  };

  // Render console tab content
  const renderConsoleTab = () => {
    if (consoleLogs.length === 0) {
      return (
        <div className="tab-empty">
          No console output yet.
        </div>
      );
    }

    return (
      <div className="console-container">
        {consoleLogs.map((log, index) => (
          <div key={`${log.timestamp}-${index}`} className={`console-log ${getLogLevelClass(log.level)}`}>
            <span className="log-timestamp">{formatTimestamp(log.timestamp)}</span>
            <span className="log-icon">{getLogLevelIcon(log.level)}</span>
            <span className="log-message">{log.message}</span>
          </div>
        ))}
        <div ref={consoleEndRef} />
      </div>
    );
  };

  // Render network tab content (stub)
  const renderNetworkTab = () => {
    return (
      <div className="tab-empty">
        Network monitoring coming soon.
      </div>
    );
  };

  // Render active tab content
  const renderTabContent = () => {
    switch (previewMode) {
      case 'screenshot':
        return renderScreenshotTab();
      case 'console':
        return renderConsoleTab();
      case 'network':
        return renderNetworkTab();
    }
  };

  return (
    <div className="browser-preview">
      {/* Results Display */}
      {renderResults()}

      {/* Tab Navigation */}
      <div className="tabs">
        <button
          className={`tab ${previewMode === 'screenshot' ? 'tab-active' : ''}`}
          onClick={() => setPreviewMode('screenshot')}
        >
          Screenshot
        </button>
        <button
          className={`tab ${previewMode === 'console' ? 'tab-active' : ''}`}
          onClick={() => setPreviewMode('console')}
        >
          Console
        </button>
        <button
          className={`tab ${previewMode === 'network' ? 'tab-active' : ''}`}
          onClick={() => setPreviewMode('network')}
        >
          Network
        </button>
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {renderTabContent()}
      </div>
    </div>
  );
};
