import React, { useState } from 'react';
import { usePlaygroundStore } from './store';

/**
 * Props for the ControlBar component.
 */
export interface ControlBarProps {
  /** Execute the current query */
  onExecute: () => void;
  /** Cancel the running query */
  onCancel: () => void;
  /** Export results in specified format */
  onExport: (format: 'json' | 'csv' | 'html') => void;
  /** Save the current query */
  onSave: () => void;
  /** Share the current query */
  onShare: () => void;
}

/**
 * Control bar component providing execution controls and utility buttons.
 * Displays execution, management, and panel toggle buttons.
 */
export function ControlBar({
  onExecute,
  onCancel,
  onExport,
  onSave,
  onShare,
}: ControlBarProps) {
  // State from store
  const activeExecution = usePlaygroundStore((state) => state.activeExecution);
  const toggleHistory = usePlaygroundStore((state) => state.toggleHistory);
  const toggleTemplates = usePlaygroundStore((state) => state.toggleTemplates);

  // Local state for export dropdown
  const [showExportMenu, setShowExportMenu] = useState(false);

  // Determine if query is currently running
  const isRunning = activeExecution !== null;

  // Handle export option selection
  const handleExport = (format: 'json' | 'csv' | 'html') => {
    onExport(format);
    setShowExportMenu(false);
  };

  return (
    <div className="control-bar">
      {/* Group 1: Execution Controls */}
      <div className="control-group">
        {!isRunning ? (
          <button
            className="btn btn-primary"
            onClick={onExecute}
            aria-label="Execute query"
          >
            ▶ Execute
          </button>
        ) : (
          <button
            className="btn btn-danger"
            onClick={onCancel}
            aria-label="Cancel execution"
          >
            ⏹ Cancel
          </button>
        )}
      </div>

      {/* Group 2: Management Controls */}
      <div className="control-group">
        <button
          className="btn btn-secondary"
          onClick={onSave}
          aria-label="Save query"
        >
          💾 Save
        </button>
        <button
          className="btn btn-secondary"
          onClick={onShare}
          aria-label="Share query"
        >
          🔗 Share
        </button>
        <div className="dropdown">
          <button
            className="btn btn-secondary"
            onClick={() => setShowExportMenu(!showExportMenu)}
            aria-label="Export results"
            aria-expanded={showExportMenu}
          >
            📥 Export
          </button>
          {showExportMenu && (
            <div className="dropdown-menu">
              <button
                className="export-option"
                onClick={() => handleExport('json')}
              >
                JSON
              </button>
              <button
                className="export-option"
                onClick={() => handleExport('csv')}
              >
                CSV
              </button>
              <button
                className="export-option"
                onClick={() => handleExport('html')}
              >
                HTML
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Group 3: Panel Toggles */}
      <div className="control-group">
        <button
          className="btn btn-secondary"
          onClick={toggleHistory}
          aria-label="Toggle history panel"
        >
          📜 History
        </button>
        <button
          className="btn btn-secondary"
          onClick={toggleTemplates}
          aria-label="Toggle templates panel"
        >
          📝 Templates
        </button>
      </div>
    </div>
  );
}
