# Playground Features Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Wire the doc-site playground to the real BrowserX API, and add visual Query Builder, Query Generator, History Panel, and Templates Panel components.

**Architecture:** Five independent components are built in parallel (Tasks 1–5) then integrated into Playground.tsx in Task 6. The Astro SSR API endpoint proxies to `browserx-api` on the Docker internal network using the `BROWSERX_API_URL` env var; it falls back to mocks when the env var is absent (local dev). The visual builder and generator live in `editorMode` state already present in the store.

**Tech Stack:** React 18, TypeScript, Zustand (already in use), Astro SSR API routes, CSS (no new CSS frameworks — extend existing Playground.css/ControlBar.css patterns)

---

## Parallel Group 1 — Tasks 1–5 can all run at the same time (different files, no conflicts)

---

### Task 1: Wire /api/execute to real BrowserX API

**Files:**
- Modify: `doc-site/src/pages/api/execute.ts`

**Context:**
`validate.ts` already proxies to `BROWSERX_API_URL` — mirror that exact pattern in `execute.ts`. The real API is at `http://browserx-api:8080/execute` (Docker internal). When `BROWSERX_API_URL` is not set (local dev), fall through to the existing `executeMockQuery` function. The real API returns `{ results: <engine result> }` which already matches the response shape `execute.ts` returns.

**Step 1: Read the file to understand what to change**

Read `doc-site/src/pages/api/execute.ts` lines 355–385 (the POST handler). Find where `executeMockQuery` is called at line 357.

**Step 2: Add proxy logic before the mock call**

In `execute.ts`, replace the "3. Execute query (mock for now)" section (lines 355–363):

```typescript
    // 3. Execute query — proxy to real BrowserX API if configured, else mock
    const timeout = body.options?.timeout ?? 30000;
    const browserxApiUrl = import.meta.env.BROWSERX_API_URL;

    if (browserxApiUrl) {
      try {
        const upstream = await fetch(`${browserxApiUrl}/execute`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: body.query, options: body.options }),
          signal: AbortSignal.timeout(timeout),
        });
        const upstreamText = await upstream.text();
        return new Response(upstreamText, {
          status: upstream.status,
          headers: { 'Content-Type': 'application/json' },
        });
      } catch {
        // Fall through to mock if upstream is unreachable
      }
    }

    const results = await executeMockQuery(body.query, timeout);
```

This replaces `const results = await executeMockQuery(body.query, timeout);` and the code below it. The `return new Response(...)` inside the `if` block short-circuits; on fallthrough the existing mock path continues unchanged.

**Step 3: Verify the edit**

Run: `grep -n "BROWSERX_API_URL\|executeMockQuery" doc-site/src/pages/api/execute.ts`

Expected: `BROWSERX_API_URL` appears in the new proxy block, `executeMockQuery` still appears at the fallback line.

**Step 4: Commit**

```bash
git add doc-site/src/pages/api/execute.ts
git commit -m "feat(api): proxy /api/execute to real BrowserX API with mock fallback"
```

---

### Task 2: QueryBuilder component (visual editor mode)

**Files:**
- Create: `doc-site/src/components/playground/QueryBuilder.tsx`

**Context:**
The store has `editorMode: 'code' | 'blocks'`. When `editorMode === 'blocks'` the Playground should render QueryBuilder instead of the Monaco editor. QueryBuilder is a form that generates a BrowserX query string and pushes it to `store.setQuery()`. There is no test file for this component — add a Playwright or simple React test only if there's an existing `__tests__` folder (there is one at `doc-site/src/components/playground/__tests__/`).

**Step 1: Create the component file**

Create `doc-site/src/components/playground/QueryBuilder.tsx`:

```tsx
import React, { useState, useCallback } from 'react';
import { usePlaygroundStore } from './store';

type Operation = 'SELECT' | 'NAVIGATE' | 'CLICK' | 'INSERT' | 'IF_EXISTS';

interface Field {
  id: string;
  value: string;
}

function generateQuery(
  operation: Operation,
  url: string,
  fields: Field[],
  selector: string,
  value: string,
  condition: string,
): string {
  const filledFields = fields.map((f) => f.value).filter(Boolean);
  switch (operation) {
    case 'SELECT': {
      const fieldList = filledFields.length > 0 ? filledFields.join(', ') : '*';
      return url
        ? `SELECT ${fieldList} FROM "${url}"`
        : `SELECT ${fieldList} FROM "https://example.com"`;
    }
    case 'NAVIGATE':
      return `NAVIGATE TO "${url || 'https://example.com'}"
  WITH { proxy: { cache: true } }
  CAPTURE response.body, dom.title`;
    case 'CLICK':
      return `CLICK "${selector || '#submit'}"`;
    case 'INSERT':
      return `INSERT "${value || 'text'}" INTO "${selector || '#input'}"`;
    case 'IF_EXISTS':
      return `IF EXISTS("${condition || '#element'}") THEN
  ${filledFields.length > 0 ? filledFields.join('\n  ') : 'CLICK "#submit"'}
END`;
    default:
      return '';
  }
}

export const QueryBuilder: React.FC = () => {
  const { setQuery } = usePlaygroundStore();

  const [operation, setOperation] = useState<Operation>('SELECT');
  const [url, setUrl] = useState('https://example.com');
  const [fields, setFields] = useState<Field[]>([{ id: '1', value: 'title' }, { id: '2', value: 'description' }]);
  const [selector, setSelector] = useState('');
  const [value, setValue] = useState('');
  const [condition, setCondition] = useState('');

  const preview = generateQuery(operation, url, fields, selector, value, condition);

  const addField = () =>
    setFields((prev) => [...prev, { id: String(Date.now()), value: '' }]);

  const updateField = (id: string, val: string) =>
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, value: val } : f)));

  const removeField = (id: string) =>
    setFields((prev) => prev.filter((f) => f.id !== id));

  const handleUseQuery = useCallback(() => {
    setQuery(preview);
  }, [preview, setQuery]);

  return (
    <div className="query-builder">
      <div className="qb-section">
        <label className="qb-label">Operation</label>
        <select
          className="qb-select"
          value={operation}
          onChange={(e) => setOperation(e.target.value as Operation)}
        >
          <option value="SELECT">SELECT — extract data from a page</option>
          <option value="NAVIGATE">NAVIGATE — load a URL with options</option>
          <option value="CLICK">CLICK — click an element</option>
          <option value="INSERT">INSERT — type into an element</option>
          <option value="IF_EXISTS">IF EXISTS — conditional action</option>
        </select>
      </div>

      {(operation === 'SELECT' || operation === 'NAVIGATE') && (
        <div className="qb-section">
          <label className="qb-label">URL</label>
          <input
            className="qb-input"
            type="url"
            placeholder="https://example.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </div>
      )}

      {operation === 'SELECT' && (
        <div className="qb-section">
          <label className="qb-label">Fields to extract</label>
          {fields.map((f) => (
            <div key={f.id} className="qb-field-row">
              <input
                className="qb-input qb-field-input"
                placeholder="e.g. title"
                value={f.value}
                onChange={(e) => updateField(f.id, e.target.value)}
              />
              <button
                className="qb-btn-remove"
                onClick={() => removeField(f.id)}
                aria-label="Remove field"
              >
                ✕
              </button>
            </div>
          ))}
          <button className="qb-btn-add" onClick={addField}>
            + Add field
          </button>
        </div>
      )}

      {(operation === 'CLICK' || operation === 'INSERT') && (
        <div className="qb-section">
          <label className="qb-label">CSS Selector</label>
          <input
            className="qb-input"
            placeholder="#submit"
            value={selector}
            onChange={(e) => setSelector(e.target.value)}
          />
        </div>
      )}

      {operation === 'INSERT' && (
        <div className="qb-section">
          <label className="qb-label">Value to insert</label>
          <input
            className="qb-input"
            placeholder="text to type"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </div>
      )}

      {operation === 'IF_EXISTS' && (
        <div className="qb-section">
          <label className="qb-label">Element selector to check</label>
          <input
            className="qb-input"
            placeholder="#login-form"
            value={condition}
            onChange={(e) => setCondition(e.target.value)}
          />
        </div>
      )}

      <div className="qb-section">
        <label className="qb-label">Preview</label>
        <pre className="qb-preview">{preview}</pre>
      </div>

      <button className="btn btn-primary qb-use-btn" onClick={handleUseQuery}>
        Use this query →
      </button>
    </div>
  );
};
```

**Step 2: Add QueryBuilder styles to Playground.css**

Append to `doc-site/src/components/playground/Playground.css`:

```css
/* ── Query Builder ─────────────────────────────────────────────────────────── */
.query-builder {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem;
  height: 100%;
  overflow-y: auto;
  background: var(--sl-color-bg, #0f1117);
  color: var(--sl-color-text, #e2e8f0);
}

.qb-section { display: flex; flex-direction: column; gap: 0.35rem; }

.qb-label {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--sl-color-text-accent, #7dd3fc);
}

.qb-select,
.qb-input {
  background: #1e2332;
  border: 1px solid #2d3748;
  border-radius: 6px;
  color: #e2e8f0;
  padding: 0.5rem 0.75rem;
  font-size: 0.875rem;
  width: 100%;
  box-sizing: border-box;
}

.qb-select:focus,
.qb-input:focus {
  outline: none;
  border-color: #4299e1;
}

.qb-field-row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.qb-field-input { flex: 1; }

.qb-btn-remove {
  background: transparent;
  border: 1px solid #4a5568;
  border-radius: 4px;
  color: #fc8181;
  cursor: pointer;
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
  flex-shrink: 0;
}

.qb-btn-add {
  background: transparent;
  border: 1px dashed #4a5568;
  border-radius: 6px;
  color: #7dd3fc;
  cursor: pointer;
  padding: 0.4rem 0.75rem;
  font-size: 0.8rem;
  text-align: left;
}

.qb-preview {
  background: #111827;
  border: 1px solid #2d3748;
  border-radius: 6px;
  padding: 0.75rem;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 0.8rem;
  color: #a3e635;
  white-space: pre-wrap;
  word-break: break-all;
  margin: 0;
}

.qb-use-btn { width: 100%; margin-top: 0.5rem; }
```

**Step 3: Verify the file is complete (no TODOs, no stubs)**

Run: `grep -n "TODO\|stub\|placeholder\|implement" doc-site/src/components/playground/QueryBuilder.tsx`
Expected: no output

**Step 4: Commit**

```bash
git add doc-site/src/components/playground/QueryBuilder.tsx doc-site/src/components/playground/Playground.css
git commit -m "feat(playground): add visual QueryBuilder component"
```

---

### Task 3: QueryGenerator component

**Files:**
- Create: `doc-site/src/components/playground/QueryGenerator.tsx`

**Context:**
QueryGenerator lets users describe their intent in plain English, suggests a matching template, lets them fill in parameters, then loads the generated query. It's keyword-matching (no LLM needed), using the same templates already in the store. It lives alongside QueryBuilder as a third editor mode accessed via a tab in the Playground header.

**Step 1: Create the component**

Create `doc-site/src/components/playground/QueryGenerator.tsx`:

```tsx
import React, { useState, useMemo } from 'react';
import { usePlaygroundStore } from './store';

interface Template {
  id: string;
  name: string;
  description: string;
  query: string;
  keywords: string[];
  params: Array<{ key: string; label: string; placeholder: string; defaultValue: string }>;
}

const GENERATOR_TEMPLATES: Template[] = [
  {
    id: 'gen-select',
    name: 'Extract data from a page',
    description: 'SELECT fields from a URL',
    query: 'SELECT {fields} FROM "{url}"',
    keywords: ['extract', 'scrape', 'get', 'select', 'read', 'fetch', 'data', 'title', 'content'],
    params: [
      { key: 'url', label: 'Page URL', placeholder: 'https://example.com', defaultValue: 'https://example.com' },
      { key: 'fields', label: 'Fields (comma-separated)', placeholder: 'title, description', defaultValue: 'title, description' },
    ],
  },
  {
    id: 'gen-navigate',
    name: 'Navigate to a URL',
    description: 'Load a page and capture content',
    query: 'NAVIGATE TO "{url}"\n  WITH { proxy: { cache: true } }\n  CAPTURE response.body, dom.title',
    keywords: ['navigate', 'go', 'visit', 'open', 'load', 'browse'],
    params: [
      { key: 'url', label: 'URL to navigate to', placeholder: 'https://example.com', defaultValue: 'https://example.com' },
    ],
  },
  {
    id: 'gen-form',
    name: 'Fill and submit a form',
    description: 'Type into inputs and click submit',
    query: 'INSERT "{email}" INTO "{emailSelector}"\nINSERT "{password}" INTO "{passwordSelector}"\nCLICK "{submitSelector}"',
    keywords: ['form', 'login', 'submit', 'fill', 'type', 'input', 'sign in', 'signup'],
    params: [
      { key: 'email', label: 'Email / username', placeholder: 'user@example.com', defaultValue: 'user@example.com' },
      { key: 'emailSelector', label: 'Email field selector', placeholder: '#email', defaultValue: '#email' },
      { key: 'password', label: 'Password', placeholder: 'password123', defaultValue: 'password123' },
      { key: 'passwordSelector', label: 'Password field selector', placeholder: '#password', defaultValue: '#password' },
      { key: 'submitSelector', label: 'Submit button selector', placeholder: '#submit', defaultValue: '#submit' },
    ],
  },
  {
    id: 'gen-click',
    name: 'Click an element',
    description: 'Find and click a button or link',
    query: 'CLICK "{selector}"',
    keywords: ['click', 'press', 'tap', 'button', 'link'],
    params: [
      { key: 'selector', label: 'CSS selector to click', placeholder: '#button', defaultValue: '#submit' },
    ],
  },
  {
    id: 'gen-paginate',
    name: 'Loop through pages',
    description: 'Scrape multiple paginated pages',
    query: 'FOR page IN RANGE(1, {pages}) DO\n  NAVIGATE TO "{baseUrl}" || page\n  SELECT {fields} FROM "current"\nEND',
    keywords: ['loop', 'paginate', 'pages', 'multiple', 'iterate', 'crawl', 'scrape all'],
    params: [
      { key: 'baseUrl', label: 'Base URL (page number appended)', placeholder: 'https://example.com/page/', defaultValue: 'https://example.com/page/' },
      { key: 'pages', label: 'Number of pages', placeholder: '10', defaultValue: '10' },
      { key: 'fields', label: 'Fields to extract', placeholder: 'title, content', defaultValue: 'title, content' },
    ],
  },
  {
    id: 'gen-conditional',
    name: 'Conditional action',
    description: 'Only act if an element exists',
    query: 'IF EXISTS("{selector}") THEN\n  CLICK "{actionSelector}"\nEND',
    keywords: ['if', 'conditional', 'exists', 'check', 'maybe', 'when', 'only if'],
    params: [
      { key: 'selector', label: 'Element to check for', placeholder: '#login-form', defaultValue: '#login-form' },
      { key: 'actionSelector', label: 'Element to click if found', placeholder: '#submit', defaultValue: '#submit' },
    ],
  },
];

function applyParams(template: string, params: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => params[key] ?? `{${key}}`);
}

function matchTemplates(description: string): Template[] {
  if (!description.trim()) return GENERATOR_TEMPLATES;
  const words = description.toLowerCase().split(/\W+/).filter(Boolean);
  return GENERATOR_TEMPLATES
    .map((t) => ({
      template: t,
      score: words.reduce((acc, w) => acc + (t.keywords.some((k) => k.includes(w) || w.includes(k)) ? 1 : 0), 0),
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ template }) => template);
}

export const QueryGenerator: React.FC = () => {
  const { setQuery } = usePlaygroundStore();
  const [description, setDescription] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [params, setParams] = useState<Record<string, string>>({});

  const matches = useMemo(() => matchTemplates(description), [description]);
  const selected = GENERATOR_TEMPLATES.find((t) => t.id === selectedId) ?? matches[0] ?? null;

  const currentParams = useMemo(() => {
    if (!selected) return {};
    const defaults: Record<string, string> = {};
    for (const p of selected.params) defaults[p.key] = p.defaultValue;
    return { ...defaults, ...params };
  }, [selected, params]);

  const preview = selected ? applyParams(selected.query, currentParams) : '';

  const handleSelectTemplate = (id: string) => {
    setSelectedId(id);
    setParams({});
  };

  const handleParam = (key: string, val: string) =>
    setParams((prev) => ({ ...prev, [key]: val }));

  return (
    <div className="query-generator">
      <div className="qg-section">
        <label className="qb-label">Describe what you want to do</label>
        <input
          className="qb-input"
          placeholder="e.g. scrape titles from multiple pages"
          value={description}
          onChange={(e) => {
            setDescription(e.target.value);
            setSelectedId(null);
            setParams({});
          }}
        />
      </div>

      {matches.length > 0 && (
        <div className="qg-section">
          <label className="qb-label">
            {description ? `${matches.length} matching pattern${matches.length !== 1 ? 's' : ''}` : 'All patterns'}
          </label>
          <div className="qg-template-list">
            {matches.map((t) => (
              <button
                key={t.id}
                className={`qg-template-btn${selected?.id === t.id ? ' qg-template-btn--active' : ''}`}
                onClick={() => handleSelectTemplate(t.id)}
              >
                <span className="qg-template-name">{t.name}</span>
                <span className="qg-template-desc">{t.description}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {selected && selected.params.length > 0 && (
        <div className="qg-section">
          <label className="qb-label">Fill in the details</label>
          {selected.params.map((p) => (
            <div key={p.key} className="qg-param-row">
              <label className="qg-param-label">{p.label}</label>
              <input
                className="qb-input"
                placeholder={p.placeholder}
                value={currentParams[p.key] ?? p.defaultValue}
                onChange={(e) => handleParam(p.key, e.target.value)}
              />
            </div>
          ))}
        </div>
      )}

      {preview && (
        <div className="qg-section">
          <label className="qb-label">Generated query</label>
          <pre className="qb-preview">{preview}</pre>
        </div>
      )}

      <button
        className="btn btn-primary qb-use-btn"
        onClick={() => preview && setQuery(preview)}
        disabled={!preview}
      >
        Load into editor →
      </button>
    </div>
  );
};
```

**Step 2: Add styles to Playground.css**

Append to `doc-site/src/components/playground/Playground.css`:

```css
/* ── Query Generator ───────────────────────────────────────────────────────── */
.query-generator {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem;
  height: 100%;
  overflow-y: auto;
  background: var(--sl-color-bg, #0f1117);
  color: var(--sl-color-text, #e2e8f0);
}

.qg-section { display: flex; flex-direction: column; gap: 0.4rem; }

.qg-template-list { display: flex; flex-direction: column; gap: 0.4rem; }

.qg-template-btn {
  background: #1e2332;
  border: 1px solid #2d3748;
  border-radius: 8px;
  color: #e2e8f0;
  cursor: pointer;
  padding: 0.6rem 0.85rem;
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  transition: border-color 0.15s;
}

.qg-template-btn:hover { border-color: #4299e1; }

.qg-template-btn--active {
  border-color: #4299e1;
  background: #1a2744;
}

.qg-template-name { font-size: 0.875rem; font-weight: 600; }

.qg-template-desc { font-size: 0.75rem; color: #718096; }

.qg-param-row { display: flex; flex-direction: column; gap: 0.2rem; }

.qg-param-label { font-size: 0.75rem; color: #a0aec0; }
```

**Step 3: Verify**

Run: `grep -n "TODO\|stub\|placeholder implementation" doc-site/src/components/playground/QueryGenerator.tsx`
Expected: no output

**Step 4: Commit**

```bash
git add doc-site/src/components/playground/QueryGenerator.tsx doc-site/src/components/playground/Playground.css
git commit -m "feat(playground): add QueryGenerator component with keyword-matching templates"
```

---

### Task 4: HistoryPanel component

**Files:**
- Create: `doc-site/src/components/playground/HistoryPanel.tsx`

**Context:**
The store has `executionHistory: HistoryEntry[]`, `showHistory: boolean`, `toggleHistory()`, `loadQuery(id)`. HistoryPanel renders when `showHistory` is true as a slide-over panel. Each entry shows the query (truncated), status, and duration. Clicking loads the query into the editor.

**Step 1: Create the component**

Create `doc-site/src/components/playground/HistoryPanel.tsx`:

```tsx
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
```

**Step 2: Add styles**

Append to `doc-site/src/components/playground/Playground.css`:

```css
/* ── Side Panels (History + Templates) ────────────────────────────────────── */
.side-panel {
  width: 320px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: #0d1117;
  border-right: 1px solid #2d3748;
  height: 100%;
  overflow: hidden;
}

.side-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #2d3748;
  flex-shrink: 0;
}

.side-panel-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: #e2e8f0;
}

.side-panel-actions { display: flex; gap: 0.5rem; align-items: center; }

.side-panel-clear,
.side-panel-close {
  background: transparent;
  border: none;
  color: #718096;
  cursor: pointer;
  font-size: 0.8rem;
  padding: 0.2rem 0.4rem;
  border-radius: 4px;
}

.side-panel-clear:hover { color: #fc8181; }
.side-panel-close:hover { color: #e2e8f0; }

.side-panel-body { flex: 1; overflow-y: auto; padding: 0.5rem; }

.side-panel-empty {
  color: #4a5568;
  font-size: 0.875rem;
  text-align: center;
  padding: 2rem 1rem;
}

/* History entries */
.history-entry {
  width: 100%;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 6px;
  color: #e2e8f0;
  cursor: pointer;
  padding: 0.6rem 0.75rem;
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin-bottom: 0.3rem;
}

.history-entry:hover { background: #1e2332; border-color: #2d3748; }

.history-entry-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
}

.history-status { font-weight: 700; }
.history-status--success { color: #68d391; }
.history-status--error { color: #fc8181; }
.history-time { color: #718096; }
.history-duration { color: #a0aec0; margin-left: auto; }

.history-query {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.75rem;
  color: #a0aec0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

**Step 3: Commit**

```bash
git add doc-site/src/components/playground/HistoryPanel.tsx doc-site/src/components/playground/Playground.css
git commit -m "feat(playground): add HistoryPanel component"
```

---

### Task 5: TemplatesPanel component

**Files:**
- Create: `doc-site/src/components/playground/TemplatesPanel.tsx`

**Context:**
The store has `queryTemplates: QueryTemplate[]` (5 defaults), `savedQueries: SavedQuery[]`, `toggleTemplates()`, `setQuery()`, `deleteQuery(id)`. TemplatesPanel renders when `showTemplates` is true. Two sections: built-in templates (cannot be deleted) and saved queries (can be deleted).

**Step 1: Create the component**

Create `doc-site/src/components/playground/TemplatesPanel.tsx`:

```tsx
import React from 'react';
import { usePlaygroundStore, type QueryTemplate, type SavedQuery } from './store';

export const TemplatesPanel: React.FC = () => {
  const { queryTemplates, savedQueries, toggleTemplates, setQuery, deleteQuery } =
    usePlaygroundStore();

  const handleLoad = (query: string) => {
    setQuery(query);
    toggleTemplates();
  };

  return (
    <div className="side-panel templates-panel">
      <div className="side-panel-header">
        <span className="side-panel-title">Templates</span>
        <button className="side-panel-close" onClick={toggleTemplates} aria-label="Close templates">
          ✕
        </button>
      </div>

      <div className="side-panel-body">
        <div className="templates-section">
          <div className="templates-section-label">Built-in</div>
          {queryTemplates.map((t: QueryTemplate) => (
            <div key={t.id} className="template-entry">
              <button className="template-load-btn" onClick={() => handleLoad(t.query)}>
                <span className="template-name">{t.name}</span>
                <span className="template-description">{t.description}</span>
              </button>
            </div>
          ))}
        </div>

        {savedQueries.length > 0 && (
          <div className="templates-section">
            <div className="templates-section-label">Saved</div>
            {savedQueries.map((q: SavedQuery) => (
              <div key={q.id} className="template-entry">
                <button className="template-load-btn" onClick={() => handleLoad(q.query)}>
                  <span className="template-name">{q.name}</span>
                  <span className="template-description">
                    Saved {new Date(q.createdAt).toLocaleDateString()}
                  </span>
                </button>
                <button
                  className="template-delete-btn"
                  onClick={() => deleteQuery(q.id)}
                  aria-label={`Delete ${q.name}`}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {savedQueries.length === 0 && (
          <div className="side-panel-empty" style={{ paddingTop: '0.5rem' }}>
            Save a query to see it here.
          </div>
        )}
      </div>
    </div>
  );
};
```

**Step 2: Add styles**

Append to `doc-site/src/components/playground/Playground.css`:

```css
/* ── Templates Panel ──────────────────────────────────────────────────────── */
.templates-section { margin-bottom: 1rem; }

.templates-section-label {
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #4a5568;
  padding: 0.25rem 0.25rem 0.5rem;
}

.template-entry {
  display: flex;
  align-items: stretch;
  border-radius: 6px;
  overflow: hidden;
  margin-bottom: 0.35rem;
  border: 1px solid transparent;
}

.template-entry:hover { border-color: #2d3748; }

.template-load-btn {
  flex: 1;
  background: transparent;
  border: none;
  color: #e2e8f0;
  cursor: pointer;
  padding: 0.6rem 0.75rem;
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.template-load-btn:hover { background: #1e2332; }

.template-name { font-size: 0.875rem; font-weight: 600; }

.template-description { font-size: 0.75rem; color: #718096; }

.template-delete-btn {
  background: transparent;
  border: none;
  border-left: 1px solid #2d3748;
  color: #4a5568;
  cursor: pointer;
  padding: 0 0.75rem;
  font-size: 0.75rem;
}

.template-delete-btn:hover { color: #fc8181; background: #2d1515; }
```

**Step 3: Commit**

```bash
git add doc-site/src/components/playground/TemplatesPanel.tsx doc-site/src/components/playground/Playground.css
git commit -m "feat(playground): add TemplatesPanel component"
```

---

## Sequential Group 2 — Task 6 runs after all of Tasks 1–5 are committed

---

### Task 6: Integrate all components into Playground.tsx + extend store editorMode

**Files:**
- Modify: `doc-site/src/components/playground/Playground.tsx`
- Modify: `doc-site/src/components/playground/store.ts` (extend `editorMode` type)
- Modify: `doc-site/src/components/playground/Playground.css`

**Context:**
The store's `editorMode` is typed `'code' | 'blocks'`. We need to add `'generator'`. `setEditorMode` already takes the type as param — just extending the union is sufficient.

Playground.tsx currently renders:
```
<ControlBar />
<div className="playground-content">
  <div className="editor-panel"><QueryEditor /></div>
  <div className="preview-panel"><BrowserPreview /></div>
</div>
```

After this task it renders:
```
<ControlBar />
<div className="playground-content">
  [HistoryPanel if showHistory]
  [TemplatesPanel if showTemplates]
  <div className="editor-panel">
    [mode tabs: Code | Builder | Generator]
    [QueryEditor if editorMode==='code']
    [QueryBuilder if editorMode==='blocks']
    [QueryGenerator if editorMode==='generator']
  </div>
  <div className="preview-panel"><BrowserPreview /></div>
</div>
```

**Step 1: Extend editorMode in store.ts**

In `doc-site/src/components/playground/store.ts`, change every occurrence of `'code' | 'blocks'` to `'code' | 'blocks' | 'generator'`:

Line ~121: `editorMode: 'code' | 'blocks';` → `editorMode: 'code' | 'blocks' | 'generator';`
Line ~159: `setEditorMode: (mode: 'code' | 'blocks') => void;` → `setEditorMode: (mode: 'code' | 'blocks' | 'generator') => void;`
Line ~263: `setEditorMode: (mode: 'code' | 'blocks') => {` → `setEditorMode: (mode: 'code' | 'blocks' | 'generator') => {`

**Step 2: Rewrite Playground.tsx**

Replace the entire content of `doc-site/src/components/playground/Playground.tsx` with:

```tsx
import React, { useEffect, useRef } from 'react';
import { QueryEditor } from './QueryEditor';
import { QueryBuilder } from './QueryBuilder';
import { QueryGenerator } from './QueryGenerator';
import { BrowserPreview } from './BrowserPreview';
import { ControlBar } from './ControlBar';
import { HistoryPanel } from './HistoryPanel';
import { TemplatesPanel } from './TemplatesPanel';
import { usePlaygroundStore } from './store';
import './Playground.css';
import './ControlBar.css';

/**
 * Main Playground component integrating editor, side panels, and preview.
 */
export const Playground: React.FC = () => {
  const {
    currentQuery,
    editorMode,
    setEditorMode,
    showHistory,
    showTemplates,
    executeQuery,
    cancelExecution,
    addToHistory,
    addScreenshot,
    addConsoleLog,
    setResults,
    clearResults,
    saveQuery,
  } = usePlaygroundStore();

  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  const handleExecute = async () => {
    const executionId = `exec_${Date.now()}`;
    const startTime = Date.now();

    clearResults();
    addConsoleLog({ level: 'info', message: `Starting execution: ${executionId}`, timestamp: Date.now() });

    try {
      const response = await fetch('/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: currentQuery, options: { timeout: 60000, captureScreenshots: true } }),
      });
      if (response.ok) {
        const { results } = await response.json();
        setResults(results);
        addScreenshot(`data:text/plain;base64,${btoa(`Query executed at ${new Date().toISOString()}`)}`);
      }
      await executeQuery(currentQuery);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      addConsoleLog({ level: 'error', message: errorMessage, timestamp: Date.now() });
      addToHistory({
        id: executionId,
        query: currentQuery,
        timestamp: startTime,
        status: 'error',
        duration: Date.now() - startTime,
      });
    }
  };

  const handleCancel = () => {
    if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
    cancelExecution();
    addConsoleLog({ level: 'info', message: 'Execution cancelled', timestamp: Date.now() });
  };

  const handleExport = (format: 'json' | 'csv' | 'html') => {
    addConsoleLog({ level: 'info', message: `Exporting as ${format.toUpperCase()}...`, timestamp: Date.now() });
    const { currentResults } = usePlaygroundStore.getState();
    if (!currentResults) {
      addConsoleLog({ level: 'warn', message: 'No results to export', timestamp: Date.now() });
      return;
    }
    let content: string;
    let mimeType: string;
    let filename: string;
    switch (format) {
      case 'json':
        content = JSON.stringify(currentResults, null, 2);
        mimeType = 'application/json';
        filename = 'results.json';
        break;
      case 'csv': {
        const cols = currentResults.columns || [];
        const rows = currentResults.rows || [];
        content = [cols.join(','), ...rows.map((r) => cols.map((c) => JSON.stringify(r[c] || '')).join(','))].join('\n');
        mimeType = 'text/csv';
        filename = 'results.csv';
        break;
      }
      case 'html': {
        const hc = currentResults.columns || [];
        const hr = currentResults.rows || [];
        content = `<!DOCTYPE html><html><head><title>Query Results</title></head><body><table border="1"><thead><tr>${hc.map((c) => `<th>${c}</th>`).join('')}</tr></thead><tbody>${hr.map((r) => `<tr>${hc.map((c) => `<td>${r[c] || ''}</td>`).join('')}</tr>`).join('')}</tbody></table></body></html>`;
        mimeType = 'text/html';
        filename = 'results.html';
        break;
      }
    }
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    addConsoleLog({ level: 'info', message: `Exported as ${filename}`, timestamp: Date.now() });
  };

  const handleSave = () => {
    const name = prompt('Enter a name for this query:');
    if (name) {
      saveQuery(name);
      addConsoleLog({ level: 'info', message: `Query saved as "${name}"`, timestamp: Date.now() });
    }
  };

  const handleShare = () => {
    const shareUrl = `${window.location.origin}/playground?q=${encodeURIComponent(currentQuery)}`;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(shareUrl)
        .then(() => addConsoleLog({ level: 'info', message: 'Share link copied to clipboard', timestamp: Date.now() }))
        .catch(() => addConsoleLog({ level: 'warn', message: `Share link: ${shareUrl}`, timestamp: Date.now() }));
    } else {
      addConsoleLog({ level: 'warn', message: `Share link: ${shareUrl}`, timestamp: Date.now() });
    }
  };

  return (
    <div className="playground">
      <ControlBar
        onExecute={handleExecute}
        onCancel={handleCancel}
        onExport={handleExport}
        onSave={handleSave}
        onShare={handleShare}
      />
      <div className="playground-content">
        {showHistory && <HistoryPanel />}
        {showTemplates && <TemplatesPanel />}
        <div className="editor-panel">
          <div className="editor-mode-tabs">
            <button
              className={`editor-mode-tab${editorMode === 'code' ? ' editor-mode-tab--active' : ''}`}
              onClick={() => setEditorMode('code')}
            >
              Code
            </button>
            <button
              className={`editor-mode-tab${editorMode === 'blocks' ? ' editor-mode-tab--active' : ''}`}
              onClick={() => setEditorMode('blocks')}
            >
              Builder
            </button>
            <button
              className={`editor-mode-tab${editorMode === 'generator' ? ' editor-mode-tab--active' : ''}`}
              onClick={() => setEditorMode('generator')}
            >
              Generator
            </button>
          </div>
          <div className="editor-mode-content">
            {editorMode === 'code' && <QueryEditor />}
            {editorMode === 'blocks' && <QueryBuilder />}
            {editorMode === 'generator' && <QueryGenerator />}
          </div>
        </div>
        <div className="preview-panel">
          <BrowserPreview />
        </div>
      </div>
    </div>
  );
};
```

**Step 3: Add integration styles to Playground.css**

Append to `doc-site/src/components/playground/Playground.css`:

```css
/* ── Editor mode tabs ─────────────────────────────────────────────────────── */
.editor-mode-tabs {
  display: flex;
  gap: 0;
  border-bottom: 1px solid #2d3748;
  background: #0d1117;
  flex-shrink: 0;
}

.editor-mode-tab {
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  color: #718096;
  cursor: pointer;
  font-size: 0.8rem;
  font-weight: 500;
  padding: 0.6rem 1.25rem;
  transition: color 0.15s, border-color 0.15s;
}

.editor-mode-tab:hover { color: #e2e8f0; }

.editor-mode-tab--active {
  color: #7dd3fc;
  border-bottom-color: #4299e1;
}

.editor-mode-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* Update editor-panel to be a flex column so tabs + content stack */
.editor-panel {
  display: flex;
  flex-direction: column;
}
```

**Step 4: Build locally to confirm no TypeScript errors**

```bash
cd doc-site && npm run build 2>&1 | tail -20
```

Expected: build succeeds with no TypeScript errors. If there are import errors, verify the four new component files exist and exports match the import names.

**Step 5: Commit**

```bash
git add doc-site/src/components/playground/Playground.tsx \
        doc-site/src/components/playground/store.ts \
        doc-site/src/components/playground/Playground.css
git commit -m "feat(playground): integrate QueryBuilder, QueryGenerator, HistoryPanel, TemplatesPanel

- Add Code/Builder/Generator mode tabs to editor panel
- Render side panels for History and Templates when toggled
- Extend store editorMode to include 'generator'"
```

**Step 6: Push and verify CI**

```bash
git push origin main
```

Watch the GitHub Actions deploy at https://github.com/LayerDynamics/BrowserX/actions
After deploy: visit https://browserx.space/playground and confirm:
- Three tabs appear: Code, Builder, Generator
- History button opens history panel on the left
- Templates button opens templates panel on the left
- Builder shows a form that generates a live query preview
- Generator shows keyword-based template matching

---

## Execution Strategy

Tasks 1–5 are fully independent (touch different files). Dispatch all five as parallel agents, then run Task 6 as a single agent after all five commits land.
