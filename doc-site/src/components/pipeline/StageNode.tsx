import React from 'react';

export interface StageInfo {
  index: number;
  name: string;
  shortName: string;
  icon: string;
  description: string;
  timingKey: string;
}

interface StageNodeProps {
  stage: StageInfo;
  isActive: boolean;
  isComplete: boolean;
  timing?: number;
  isLast?: boolean;
  nodeRef?: (el: HTMLDivElement | null) => void;
}

export const StageNode: React.FC<StageNodeProps> = ({
  stage,
  isActive,
  isComplete,
  timing,
  isLast,
  nodeRef,
}) => {
  return (
    <div className="stage-node-wrapper">
      <div
        ref={nodeRef}
        className={[
          'stage-node',
          isActive ? 'stage-node--active' : '',
          isComplete ? 'stage-node--complete' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        title={stage.description}
      >
        {isActive && <div className="stage-node__pulse-ring" />}
        {isActive && <div className="stage-node__pulse-ring stage-node__pulse-ring--delay" />}

        <div className="stage-node__number">{stage.index + 1}</div>
        <div className="stage-node__icon">{stage.icon}</div>
        <div className="stage-node__name">{stage.shortName}</div>

        {isComplete && timing !== undefined && (
          <div className="stage-node__timing">{timing.toFixed(1)}ms</div>
        )}

        {isComplete && (
          <div className="stage-node__check">✓</div>
        )}
      </div>

      {!isLast && (
        <div className={[
          'stage-connector',
          isActive ? 'stage-connector--active' : '',
          isComplete ? 'stage-connector--complete' : '',
        ].filter(Boolean).join(' ')}>
          <div className="stage-connector__track">
            <div className="stage-connector__pulse" />
          </div>
          <span className="stage-connector__arrow">›</span>
        </div>
      )}
    </div>
  );
};
