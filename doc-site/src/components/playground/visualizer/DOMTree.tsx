import React, { useState } from 'react';
import { usePlaygroundStore } from '../store';

export interface DOMNodeData {
  tag: string;
  id?: string;
  classes?: string[];
  children?: DOMNodeData[];
  text?: string;
}

interface DOMNodeProps {
  node: DOMNodeData;
  depth: number;
}

const DOMNode: React.FC<DOMNodeProps> = ({ node, depth }) => {
  const [expanded, setExpanded] = useState(depth < 3);
  const hasChildren = Boolean(node.children && node.children.length > 0);
  const hasText = Boolean(node.text && node.text.trim().length > 0);

  const idPart = node.id ? `#${node.id}` : '';
  const classPart = node.classes && node.classes.length > 0 ? '.' + node.classes.join('.') : '';
  const label = `${node.tag}${idPart}${classPart}`;

  return (
    <div className="dom-node" style={{ '--dom-depth': depth } as React.CSSProperties}>
      {hasChildren ? (
        <>
          <button
            className={`dom-toggle${expanded ? ' dom-toggle--open' : ''}`}
            onClick={() => setExpanded(!expanded)}
            aria-expanded={expanded}
          >
            <span className="dom-chevron">{expanded ? '▾' : '▸'}</span>
            <span className="dom-tag">{label}</span>
            {!expanded && (
              <span className="dom-child-count">({node.children!.length})</span>
            )}
          </button>
          {expanded && (
            <div className="dom-children">
              {hasText && <div className="dom-text-node">"{node.text}"</div>}
              {node.children!.map((child, i) => (
                <DOMNode key={`${child.tag}-${child.id ?? i}`} node={child} depth={depth + 1} />
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="dom-leaf">
          <span className="dom-tag">{label}</span>
          {hasText && <span className="dom-text-inline">"{node.text}"</span>}
        </div>
      )}
    </div>
  );
};

/**
 * DOMTree — renders a DOM snapshot synthesized from currentResults.
 * With a real backend this would receive an actual DOM snapshot;
 * for now it builds a representative tree from query result columns and rows.
 */
export const DOMTree: React.FC = () => {
  const { currentResults } = usePlaygroundStore();

  if (!currentResults) {
    return <div className="visualizer-empty">Execute a query to see the DOM snapshot.</div>;
  }

  const { columns, rows } = currentResults;

  if (!columns || columns.length === 0) {
    return <div className="visualizer-empty">No DOM data available for this result set.</div>;
  }

  const rootNode: DOMNodeData = {
    tag: 'document',
    children: [{
      tag: 'html',
      children: [{
        tag: 'body',
        children: (rows ?? []).map((row, i) => ({
          tag: 'div',
          id: `result-${i}`,
          classes: ['result-row'],
          children: columns.map((col) => ({
            tag: 'span',
            classes: [col],
            text: String(row[col] ?? ''),
          })),
        })),
      }],
    }],
  };

  return (
    <div className="dom-tree">
      <DOMNode node={rootNode} depth={0} />
    </div>
  );
};
