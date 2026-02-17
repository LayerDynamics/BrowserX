import React from 'react';
import { usePlaygroundStore, type HistoryEntry } from './store';

function formatDuration(ms?: number): string {
  if (ms === undefined) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function truncateQuery(query: string, maxLen = 80): string {
  const oneLine = query.replace(/\s+/g, ' ').trim();
  return oneLine.length > maxLen ? oneLine.slice(0, maxLen) + '…' : oneLine;
}

export const HistoryPanel: React.FC = () => {
  const { executionHistory, toggleHistory, setQuery } = usePlaygroundStore();

  const handleLoad = (entry: HistoryEntry) => {
    setQuery(entry.query);
    toggleHistory();
  };

  const handleClear = () => {
    usePlaygroundStore.setState({ executionHistory: [] });
  };

  return (
    <div className="side-panel history-panel">
      <div className="side-panel-header">
        <span className="side-panel-title">History</span>
        <div className="side-panel-actions">
          {executionHistory.length > 0 && (
            <button className="side-panel-clear" onClick={handleClear} aria-label="Clear history">
              Clear
            </button>
          )}
          <button className="side-panel-close" onClick={toggleHistory} aria-label="Close history">
            ✕
          </button>
        </div>
      </div>

      <div className="side-panel-body">
        {executionHistory.length === 0 ? (
          <div className="side-panel-empty">No queries executed yet.</div>
        ) : (
          [...executionHistory].reverse().map((entry) => (
            <button
              key={entry.id}
              className="history-entry"
              onClick={() => handleLoad(entry)}
              title="Load this query"
            >
              <div className="history-entry-meta">
                <span className={`history-status history-status--${entry.status}`}>
                  {entry.status === 'success' ? '✓' : '✗'}
                </span>
                <span className="history-time">{formatTime(entry.timestamp)}</span>
                <span className="history-duration">{formatDuration(entry.duration)}</span>
              </div>
              <div className="history-query">{truncateQuery(entry.query)}</div>
            </button>
          ))
        )}
      </div>
    </div>
  );
};
