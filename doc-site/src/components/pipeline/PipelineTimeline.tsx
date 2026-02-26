import React from 'react';
import { StageCard } from './StageCard';
import type { StageEvent } from './StageCard';
import type { PipelineStatus } from './PipelineVisualizer';

interface PipelineTimelineProps {
  events: StageEvent[];
  status: PipelineStatus;
}

export const PipelineTimeline: React.FC<PipelineTimelineProps> = ({ events, status }) => {
  return (
    <div className="pipeline-timeline">
      <div className="pipeline-timeline__header">
        <span className="pipeline-timeline__label">EXECUTION LOG</span>
        <span className={`pipeline-timeline__status pipeline-timeline__status--${status}`}>
          {status === 'idle' && 'IDLE'}
          {status === 'running' && (
            <>
              <span className="pipeline-timeline__blink" />
              LIVE
            </>
          )}
          {status === 'complete' && '✓ DONE'}
          {status === 'error' && '✕ ERROR'}
        </span>
      </div>

      <div className="pipeline-timeline__body">
        {events.length === 0 ? (
          <div className="pipeline-timeline__empty">
            <div className="pipeline-timeline__empty-grid" aria-hidden="true">
              {Array.from({ length: 24 }).map((_, i) => (
                <div key={i} className="pipeline-timeline__empty-dot" />
              ))}
            </div>
            <p className="pipeline-timeline__hint">
              Select a preset or write a query, then click{' '}
              <strong>RUN QUERY</strong> to watch the pipeline execute
            </p>
          </div>
        ) : (
          <div className="pipeline-timeline__cards">
            {events.map((event, i) => (
              <StageCard
                key={`stage-${event.stage}`}
                event={event}
                animationIndex={i}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
