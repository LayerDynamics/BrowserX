import React from 'react';
import { usePlaygroundStore } from '../store';
import type { PipelineStage } from '../store';

interface StageRowProps {
  stage: PipelineStage;
  index: number;
}

const StageRow: React.FC<StageRowProps> = ({ stage, index }) => {
  const statusLabel =
    stage.status === 'idle'    ? 'Waiting'    :
    stage.status === 'running' ? 'Running…'   :
    stage.status === 'done'    ? 'Done'       :
                                 'Error';

  return (
    <div
      className={`pipeline-stage pipeline-stage--${stage.status}`}
      style={{ animationDelay: `${index * 0.05}s` }}
    >
      <span className="pipeline-stage-num">{index + 1}</span>
      <span className="pipeline-stage-name">{stage.name}</span>
      {stage.status === 'running' && (
        <span className="pipeline-stage-bar" aria-label="running" />
      )}
      <span className="pipeline-stage-status">{statusLabel}</span>
      {stage.durationMs !== null && (
        <span className="pipeline-stage-duration">{stage.durationMs.toFixed(1)}ms</span>
      )}
    </div>
  );
};

/**
 * PipelineView — shows 7 execution stages with live status and timing.
 * Driven by pipelineStages in the store; Playground.tsx animates them during execution.
 */
export const PipelineView: React.FC = () => {
  const { pipelineStages, activeExecution } = usePlaygroundStore();

  const allIdle = pipelineStages.every((s) => s.status === 'idle');
  const allDone = pipelineStages.every((s) => s.status === 'done' || s.status === 'error');
  const totalMs = pipelineStages.reduce((acc, s) => acc + (s.durationMs ?? 0), 0);

  return (
    <div className="pipeline-view">
      <div className="pipeline-header">
        <span className="pipeline-header-label">Execution Pipeline</span>
        {activeExecution && (
          <span className="pipeline-running-badge">Live</span>
        )}
        {allDone && !activeExecution && totalMs > 0 && (
          <span className="pipeline-total">{totalMs.toFixed(1)}ms total</span>
        )}
      </div>
      <div className="pipeline-stages">
        {pipelineStages.map((stage, i) => (
          <StageRow key={stage.name} stage={stage} index={i} />
        ))}
      </div>
      {allIdle && (
        <div className="visualizer-empty">
          Execute a query to see the pipeline in action.
        </div>
      )}
    </div>
  );
};
