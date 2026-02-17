import React from 'react';
import { usePlaygroundStore } from './store';
import { ASTTree } from './visualizer/ASTTree';
import { PipelineView } from './visualizer/PipelineView';
import { DOMTree } from './visualizer/DOMTree';
import { NetworkTimeline } from './visualizer/NetworkTimeline';

/**
 * VisualizerPanel — center panel in the 3-panel playground layout.
 *
 * Four tabs:
 *   AST      — live parse tree, updates 300ms after each keystroke
 *   Pipeline — animated 7-stage execution pipeline with per-stage timing
 *   DOM      — hierarchical DOM snapshot from the loaded page
 *   Network  — waterfall chart of captured network requests
 */
export const VisualizerPanel: React.FC = () => {
  const { visualizerTab, setVisualizerTab } = usePlaygroundStore();

  const tabs: Array<{ id: typeof visualizerTab; label: string }> = [
    { id: 'ast',      label: 'AST' },
    { id: 'pipeline', label: 'Pipeline' },
    { id: 'dom',      label: 'DOM' },
    { id: 'network',  label: 'Network' },
  ];

  return (
    <div className="visualizer-panel">
      <div className="visualizer-tabs">
        {tabs.map((t) => (
          <button
            key={t.id}
            className={`visualizer-tab${visualizerTab === t.id ? ' visualizer-tab--active' : ''}`}
            onClick={() => setVisualizerTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="visualizer-content">
        {visualizerTab === 'ast'      && <ASTTree />}
        {visualizerTab === 'pipeline' && <PipelineView />}
        {visualizerTab === 'dom'      && <DOMTree />}
        {visualizerTab === 'network'  && <NetworkTimeline />}
      </div>
    </div>
  );
};
