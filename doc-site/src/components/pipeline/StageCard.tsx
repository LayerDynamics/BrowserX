import React, { useState } from 'react';

export interface StageEvent {
  stage: number;
  name: string;
  duration: number;
  summary: string;
  detail: Record<string, unknown>;
}

interface StageCardProps {
  event: StageEvent;
  animationIndex: number;
}

export const StageCard: React.FC<StageCardProps> = ({ event, animationIndex }) => {
  const [expanded, setExpanded] = useState(false);

  const STAGE_COLORS: Record<number, string> = {
    0: '#4ade80', // Lexer — green
    1: '#60a5fa', // Parser — blue
    2: '#f472b6', // Semantic — pink
    3: '#fb923c', // Optimizer — orange
    4: '#a78bfa', // Planner — purple
    5: '#facc15', // Executor — yellow
    6: '#34d399', // Formatter — emerald
  };

  const stageColor = STAGE_COLORS[event.stage] ?? '#ffffff';

  return (
    <div
      className="stage-card"
      style={{
        animationDelay: `${animationIndex * 0.06}s`,
        '--stage-color': stageColor,
      } as React.CSSProperties}
      onClick={() => setExpanded((e) => !e)}
      role="button"
      aria-expanded={expanded}
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && setExpanded((x) => !x)}
    >
      <div className="stage-card__header">
        <div className="stage-card__left">
          <span className="stage-card__badge" style={{ background: stageColor }}>
            {event.stage + 1}
          </span>
          <div className="stage-card__meta">
            <div className="stage-card__name">{event.name}</div>
            <div className="stage-card__summary">{event.summary}</div>
          </div>
        </div>

        <div className="stage-card__right">
          <span className="stage-card__timing">
            {event.duration < 1
              ? `${(event.duration * 1000).toFixed(0)}μs`
              : `${event.duration.toFixed(1)}ms`}
          </span>
          <span
            className={`stage-card__toggle ${expanded ? 'stage-card__toggle--open' : ''}`}
            aria-hidden="true"
          >
            ›
          </span>
        </div>
      </div>

      {expanded && (
        <div className="stage-card__detail" onClick={(e) => e.stopPropagation()}>
          <div className="stage-card__detail-label">STAGE DETAIL</div>
          <pre className="stage-card__json">
            <code>{JSON.stringify(event.detail, null, 2)}</code>
          </pre>
        </div>
      )}
    </div>
  );
};
