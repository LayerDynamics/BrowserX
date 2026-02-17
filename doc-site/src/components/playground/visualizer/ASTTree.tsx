import React, { useState } from 'react';
import { usePlaygroundStore } from '../store';
import type { ValidationError } from '../store';

interface ASTNodeProps {
  label: string;
  value: unknown;
  depth: number;
}

/**
 * Recursive tree node. Scalars are rendered inline; objects/arrays are collapsible.
 */
const ASTNode: React.FC<ASTNodeProps> = ({ label, value, depth }) => {
  const [expanded, setExpanded] = useState(depth < 2);

  const isObject = value !== null && typeof value === 'object';
  const isArray = Array.isArray(value);

  if (!isObject) {
    const scalarClass =
      typeof value === 'string'  ? 'ast-val--string'  :
      typeof value === 'number'  ? 'ast-val--number'  :
      typeof value === 'boolean' ? 'ast-val--boolean' :
                                   'ast-val--null';
    const displayValue = typeof value === 'string' ? `"${value}"` : String(value);
    return (
      <div className="ast-node ast-node--leaf" style={{ '--ast-depth': depth } as React.CSSProperties}>
        <span className="ast-key">{label}:</span>
        <span className={`ast-val ${scalarClass}`}>{displayValue}</span>
      </div>
    );
  }

  const entries = isArray
    ? (value as unknown[]).map((v, i) => [String(i), v] as [string, unknown])
    : Object.entries(value as Record<string, unknown>);
  const typeSuffix = isArray ? `[${entries.length}]` : `{${entries.length}}`;

  return (
    <div className="ast-node ast-node--branch" style={{ '--ast-depth': depth } as React.CSSProperties}>
      <button
        className={`ast-toggle${expanded ? ' ast-toggle--open' : ''}`}
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
      >
        <span className="ast-chevron">{expanded ? '▾' : '▸'}</span>
        <span className="ast-key">{label}</span>
        <span className="ast-type-hint">{typeSuffix}</span>
      </button>
      {expanded && (
        <div className="ast-children">
          {entries.map(([k, v]) => (
            <ASTNode key={k} label={k} value={v} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * ASTTree — reads astData and astErrors from the store.
 * Shows validation errors as a list when present; renders the tree when valid.
 */
export const ASTTree: React.FC = () => {
  const { astData, astErrors, currentQuery } = usePlaygroundStore();

  if (!currentQuery.trim()) {
    return <div className="visualizer-empty">Type a query to see the live parse tree.</div>;
  }

  if (astErrors.length > 0) {
    return (
      <div className="ast-error-list">
        <div className="ast-error-header">Parse Errors</div>
        {astErrors.map((err: ValidationError, i: number) => (
          <div key={i} className="ast-error-item">
            <span className="ast-error-location">{err.line}:{err.column}</span>
            <span className="ast-error-type">{err.type}</span>
            <span className="ast-error-message">{err.message}</span>
          </div>
        ))}
      </div>
    );
  }

  if (!astData) {
    return <div className="visualizer-empty">Validating…</div>;
  }

  return (
    <div className="ast-tree">
      <ASTNode label="root" value={astData} depth={0} />
    </div>
  );
};
