import React from 'react';
import { usePlaygroundStore } from '../store';
import type { NetworkRequest } from '../store';

interface WaterfallRowProps {
  request: NetworkRequest;
  startOffsetMs: number;
  totalSpan: number;
}

const WaterfallRow: React.FC<WaterfallRowProps> = ({ request, startOffsetMs, totalSpan }) => {
  const barWidthPct = totalSpan > 0 ? Math.max(1, (request.duration / totalSpan) * 100) : 5;
  const barLeftPct  = totalSpan > 0 ? (startOffsetMs / totalSpan) * 100 : 0;

  const statusClass =
    request.status >= 200 && request.status < 300 ? 'nw-bar--ok'       :
    request.status >= 300 && request.status < 400 ? 'nw-bar--redirect'  :
    request.status >= 400 && request.status < 500 ? 'nw-bar--err4xx'    :
                                                    'nw-bar--err5xx';

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  const shortUrl = (() => {
    try {
      const u = new URL(request.url);
      return u.pathname + u.search;
    } catch {
      return request.url;
    }
  })();

  return (
    <div className="nw-row" title={request.url}>
      <div className="nw-label">
        <span className="nw-method">{request.method}</span>
        <span className="nw-url">{shortUrl}</span>
      </div>
      <div className="nw-bar-track">
        <div
          className={`nw-bar ${statusClass}`}
          style={{ left: `${barLeftPct}%`, width: `${barWidthPct}%` }}
          title={`${request.duration}ms`}
        />
      </div>
      <div className="nw-meta">
        <span className="nw-status">{request.status}</span>
        <span className="nw-duration">{request.duration}ms</span>
        <span className="nw-size">{formatSize(request.size)}</span>
      </div>
    </div>
  );
};

/**
 * NetworkTimeline — waterfall Gantt chart of captured network requests.
 * Each request bar is proportionally sized and offset to simulate sequential timing.
 */
export const NetworkTimeline: React.FC = () => {
  const { networkRequests } = usePlaygroundStore();

  if (networkRequests.length === 0) {
    return (
      <div className="visualizer-empty">
        No network requests captured. Execute a query with a URL to see the waterfall.
      </div>
    );
  }

  const offsets: number[] = [];
  let runningOffset = 0;
  for (const req of networkRequests) {
    offsets.push(runningOffset);
    runningOffset += req.duration;
  }
  const totalSpan = runningOffset;

  const totalBytes = networkRequests.reduce((a, r) => a + r.size, 0);

  return (
    <div className="nw-timeline">
      <div className="nw-header-row">
        <span className="nw-header-label">Request</span>
        <span className="nw-header-waterfall">Timeline</span>
        <span className="nw-header-meta">Status / Time / Size</span>
      </div>
      <div className="nw-rows">
        {networkRequests.map((req: NetworkRequest, i: number) => (
          <WaterfallRow
            key={req.id}
            request={req}
            startOffsetMs={offsets[i]}
            totalSpan={totalSpan}
          />
        ))}
      </div>
      <div className="nw-summary">
        {networkRequests.length} request{networkRequests.length !== 1 ? 's' : ''}
        {' · '}
        {totalSpan}ms total
        {' · '}
        {totalBytes.toLocaleString()}B transferred
      </div>
    </div>
  );
};
