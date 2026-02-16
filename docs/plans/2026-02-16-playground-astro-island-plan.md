# Browser Playground (Astro Island) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a fully-featured browser playground with visual query builder, integrated into the Astro doc-site using island architecture.

**Architecture:** Astro SSR with React islands for interactive components. Monaco Editor for code editing, custom block builder for visual queries, Astro API routes for backend, WebSocket for real-time updates, Zustand for state, IndexedDB for persistence.

**Tech Stack:** Astro 5.6, React 18, Monaco Editor 0.55, Zustand, IndexedDB, WebSocket, BrowserX Runtime

---

## Phase 1: Foundation Setup

### Task 1: Install Dependencies

**Files:**
- Modify: `doc-site/package.json`

**Step 1: Add React and dependencies**

```bash
cd doc-site
npm install react react-dom @types/react @types/react-dom zustand idb
```

Expected: All packages installed successfully

**Step 2: Add Monaco types**

```bash
npm install --save-dev @monaco-editor/react
```

Expected: Monaco React wrapper installed

**Step 3: Verify installation**

```bash
npm list react zustand @monaco-editor/react idb
```

Expected: All packages listed with versions

**Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat(playground): add React, Zustand, Monaco, and IndexedDB dependencies"
```

---

### Task 2: Configure Astro for React Islands

**Files:**
- Modify: `doc-site/astro.config.mjs`

**Step 1: Add React integration**

```javascript
// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
	site: 'https://browserx.dev',
	integrations: [
		react(),  // Add React integration
		starlight({
			// ... existing config
		}),
	],
});
```

**Step 2: Install React integration**

```bash
npx astro add react
```

Expected: React integration added successfully

**Step 3: Test build**

```bash
npm run build
```

Expected: Build succeeds without errors

**Step 4: Commit**

```bash
git add astro.config.mjs package.json
git commit -m "feat(playground): configure Astro for React islands"
```

---

### Task 3: Create Playground Page Structure

**Files:**
- Create: `doc-site/src/pages/playground.astro`

**Step 1: Create playground page**

```astro
---
import { Playground } from '../components/playground/Playground';
import StarlightPage from '@astrojs/starlight/components/StarlightPage.astro';
---

<StarlightPage frontmatter={{
  title: 'Browser Playground',
  description: 'Interactive BrowserX query editor and browser sandbox',
  template: 'splash'
}}>
  <div class="playground-container">
    <Playground client:only="react" />
  </div>
</StarlightPage>

<style>
  .playground-container {
    width: 100%;
    height: calc(100vh - 200px);
    min-height: 600px;
  }
</style>
```

**Step 2: Create component directory**

```bash
mkdir -p doc-site/src/components/playground
```

**Step 3: Commit**

```bash
git add src/pages/playground.astro
git commit -m "feat(playground): create playground page structure"
```

---

## Phase 2: State Management

### Task 4: Create Zustand Store

**Files:**
- Create: `doc-site/src/components/playground/store.ts`

**Step 1: Write the store**

```typescript
import { create } from 'zustand';

export interface QueryExecution {
  id: string;
  query: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  startTime: number;
  endTime?: number;
  results?: any;
  error?: Error;
  logs: Array<{ level: string; message: string; timestamp: number }>;
  screenshots: Array<{ data: string; timestamp: number }>;
}

export interface HistoryEntry {
  id: string;
  query: string;
  timestamp: number;
  duration: number;
  success: boolean;
  resultCount?: number;
}

export interface SavedQuery {
  id: string;
  name: string;
  description: string;
  query: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
  isTemplate: boolean;
}

interface PlaygroundStore {
  // Editor state
  currentQuery: string;
  editorMode: 'code' | 'blocks';

  // Execution state
  activeExecution: QueryExecution | null;
  executionHistory: HistoryEntry[];

  // Results state
  currentResults: any | null;
  screenshots: Array<{ data: string; timestamp: number }>;
  consoleLogs: Array<{ level: string; message: string; timestamp: number }>;

  // Saved queries
  savedQueries: SavedQuery[];
  templates: SavedQuery[];

  // UI state
  previewMode: 'screenshot' | 'console' | 'network';
  showHistory: boolean;
  showTemplates: boolean;
  showSchema: boolean;

  // Actions
  setQuery: (query: string) => void;
  setEditorMode: (mode: 'code' | 'blocks') => void;
  setPreviewMode: (mode: 'screenshot' | 'console' | 'network') => void;
  setActiveExecution: (execution: QueryExecution | null) => void;
  addToHistory: (entry: HistoryEntry) => void;
  addScreenshot: (data: string) => void;
  addConsoleLog: (level: string, message: string) => void;
  clearConsole: () => void;
  setResults: (results: any) => void;
  saveQuery: (query: SavedQuery) => void;
  deleteQuery: (id: string) => void;
  toggleHistory: () => void;
  toggleTemplates: () => void;
  toggleSchema: () => void;
}

export const usePlaygroundStore = create<PlaygroundStore>((set) => ({
  // Initial state
  currentQuery: 'SELECT title FROM "https://example.com"',
  editorMode: 'code',
  activeExecution: null,
  executionHistory: [],
  currentResults: null,
  screenshots: [],
  consoleLogs: [],
  savedQueries: [],
  templates: [],
  previewMode: 'screenshot',
  showHistory: false,
  showTemplates: false,
  showSchema: false,

  // Actions
  setQuery: (query) => set({ currentQuery: query }),

  setEditorMode: (mode) => set({ editorMode: mode }),

  setPreviewMode: (mode) => set({ previewMode: mode }),

  setActiveExecution: (execution) => set({ activeExecution: execution }),

  addToHistory: (entry) => set((state) => ({
    executionHistory: [entry, ...state.executionHistory].slice(0, 50), // Keep last 50
  })),

  addScreenshot: (data) => set((state) => ({
    screenshots: [...state.screenshots, { data, timestamp: Date.now() }],
  })),

  addConsoleLog: (level, message) => set((state) => ({
    consoleLogs: [...state.consoleLogs, { level, message, timestamp: Date.now() }],
  })),

  clearConsole: () => set({ consoleLogs: [] }),

  setResults: (results) => set({ currentResults: results }),

  saveQuery: (query) => set((state) => ({
    savedQueries: [...state.savedQueries, query],
  })),

  deleteQuery: (id) => set((state) => ({
    savedQueries: state.savedQueries.filter((q) => q.id !== id),
  })),

  toggleHistory: () => set((state) => ({ showHistory: !state.showHistory })),

  toggleTemplates: () => set((state) => ({ showTemplates: !state.showTemplates })),

  toggleSchema: () => set((state) => ({ showSchema: !state.showSchema })),
}));
```

**Step 2: Create test**

Create: `doc-site/src/components/playground/store.test.ts`

```typescript
import { describe, test, expect, beforeEach } from 'vitest';
import { usePlaygroundStore } from './store';

describe('PlaygroundStore', () => {
  beforeEach(() => {
    usePlaygroundStore.setState({
      currentQuery: '',
      executionHistory: [],
      consoleLogs: [],
    });
  });

  test('setQuery updates current query', () => {
    const { setQuery, currentQuery } = usePlaygroundStore.getState();
    setQuery('SELECT * FROM "https://test.com"');
    expect(usePlaygroundStore.getState().currentQuery).toBe('SELECT * FROM "https://test.com"');
  });

  test('addToHistory adds entry', () => {
    const { addToHistory } = usePlaygroundStore.getState();
    addToHistory({
      id: '1',
      query: 'test',
      timestamp: Date.now(),
      duration: 100,
      success: true,
    });
    expect(usePlaygroundStore.getState().executionHistory).toHaveLength(1);
  });

  test('addConsoleLog adds log', () => {
    const { addConsoleLog } = usePlaygroundStore.getState();
    addConsoleLog('info', 'test message');
    expect(usePlaygroundStore.getState().consoleLogs).toHaveLength(1);
    expect(usePlaygroundStore.getState().consoleLogs[0].message).toBe('test message');
  });

  test('history limited to 50 entries', () => {
    const { addToHistory } = usePlaygroundStore.getState();
    for (let i = 0; i < 60; i++) {
      addToHistory({
        id: `${i}`,
        query: `query${i}`,
        timestamp: Date.now(),
        duration: 100,
        success: true,
      });
    }
    expect(usePlaygroundStore.getState().executionHistory).toHaveLength(50);
  });
});
```

**Step 3: Install Vitest**

```bash
npm install --save-dev vitest
```

**Step 4: Add test script to package.json**

```json
{
  "scripts": {
    "test": "vitest"
  }
}
```

**Step 5: Run tests**

```bash
npm test
```

Expected: All tests pass

**Step 6: Commit**

```bash
git add src/components/playground/store.ts src/components/playground/store.test.ts package.json
git commit -m "feat(playground): add Zustand store for state management"
```

---

## Phase 3: Query Editor Component

### Task 5: Create Monaco Editor Component

**Files:**
- Create: `doc-site/src/components/playground/QueryEditor.tsx`

**Step 1: Write editor component**

```typescript
import React, { useRef, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { usePlaygroundStore } from './store';

export const QueryEditor: React.FC = () => {
  const { currentQuery, setQuery } = usePlaygroundStore();
  const editorRef = useRef<any>(null);

  const handleEditorDidMount = (editor: any, monaco: any) => {
    editorRef.current = editor;

    // Register BrowserX query language
    monaco.languages.register({ id: 'browserx-query' });

    // Define syntax highlighting
    monaco.languages.setMonarchTokensProvider('browserx-query', {
      keywords: [
        'SELECT', 'FROM', 'WHERE', 'NAVIGATE', 'TO', 'CLICK', 'INSERT',
        'INTO', 'IF', 'THEN', 'ELSE', 'FOR', 'EACH', 'IN', 'WITH',
        'CAPTURE', 'SET', 'SHOW', 'EXISTS', 'COUNT', 'TEXT', 'HTML',
        'ATTR', 'UPDATE', 'DELETE'
      ],
      operators: ['=', '>', '<', '!', '==', '!=', '<=', '>=', 'AND', 'OR'],
      tokenizer: {
        root: [
          [/\b(SELECT|FROM|WHERE|NAVIGATE|TO|CLICK|INSERT|INTO|IF|THEN|ELSE|FOR|EACH|IN|WITH|CAPTURE|SET|SHOW|EXISTS|COUNT|TEXT|HTML|ATTR|UPDATE|DELETE)\b/, 'keyword'],
          [/"([^"\\]|\\.)*"/, 'string'],
          [/'([^'\\]|\\.)*'/, 'string'],
          [/\d+/, 'number'],
          [/[{}()\[\]]/, '@brackets'],
          [/--.*$/, 'comment'],
        ],
      },
    });

    // Define theme
    monaco.editor.defineTheme('browserx-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'keyword', foreground: 'C586C0', fontStyle: 'bold' },
        { token: 'string', foreground: 'CE9178' },
        { token: 'number', foreground: 'B5CEA8' },
        { token: 'comment', foreground: '6A9955', fontStyle: 'italic' },
      ],
      colors: {
        'editor.background': '#1E1E1E',
      },
    });

    monaco.editor.setTheme('browserx-dark');
  };

  return (
    <div style={{ height: '100%', width: '100%' }}>
      <Editor
        height="100%"
        language="browserx-query"
        value={currentQuery}
        onChange={(value) => setQuery(value || '')}
        onMount={handleEditorDidMount}
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          lineNumbers: 'on',
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 2,
        }}
      />
    </div>
  );
};
```

**Step 2: Commit**

```bash
git add src/components/playground/QueryEditor.tsx
git commit -m "feat(playground): add Monaco-based query editor with syntax highlighting"
```

---

### Task 6: Create Control Bar Component

**Files:**
- Create: `doc-site/src/components/playground/ControlBar.tsx`

**Step 1: Write control bar**

```typescript
import React from 'react';
import { usePlaygroundStore } from './store';

export const ControlBar: React.FC<{
  onExecute: () => void;
  onCancel: () => void;
  onExport: (format: 'json' | 'csv' | 'html') => void;
  onSave: () => void;
  onShare: () => void;
}> = ({ onExecute, onCancel, onExport, onSave, onShare }) => {
  const { activeExecution, toggleHistory, toggleTemplates, toggleSchema } = usePlaygroundStore();
  const isRunning = activeExecution?.status === 'running';

  return (
    <div className="control-bar">
      <div className="control-group">
        {!isRunning ? (
          <button onClick={onExecute} className="btn btn-primary">
            ▶ Execute
          </button>
        ) : (
          <button onClick={onCancel} className="btn btn-danger">
            ⏹ Cancel
          </button>
        )}
      </div>

      <div className="control-group">
        <button onClick={onSave} className="btn btn-secondary">
          💾 Save
        </button>
        <button onClick={onShare} className="btn btn-secondary">
          🔗 Share
        </button>
        <div className="dropdown">
          <button className="btn btn-secondary">
            📥 Export ▼
          </button>
          <div className="dropdown-menu">
            <button onClick={() => onExport('json')}>JSON</button>
            <button onClick={() => onExport('csv')}>CSV</button>
            <button onClick={() => onExport('html')}>HTML</button>
          </div>
        </div>
      </div>

      <div className="control-group">
        <button onClick={toggleHistory} className="btn btn-secondary">
          📜 History
        </button>
        <button onClick={toggleTemplates} className="btn btn-secondary">
          📝 Templates
        </button>
        <button onClick={toggleSchema} className="btn btn-secondary">
          📚 Schema
        </button>
      </div>
    </div>
  );
};
```

**Step 2: Add styles**

Create: `doc-site/src/components/playground/ControlBar.css`

```css
.control-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #2d2d2d;
  border-bottom: 1px solid #3d3d3d;
}

.control-group {
  display: flex;
  gap: 8px;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.btn-primary {
  background: #007acc;
  color: white;
}

.btn-primary:hover {
  background: #005a9e;
}

.btn-secondary {
  background: #3d3d3d;
  color: #cccccc;
}

.btn-secondary:hover {
  background: #4d4d4d;
}

.btn-danger {
  background: #c5000b;
  color: white;
}

.btn-danger:hover {
  background: #9c0008;
}

.dropdown {
  position: relative;
}

.dropdown-menu {
  display: none;
  position: absolute;
  top: 100%;
  left: 0;
  background: #2d2d2d;
  border: 1px solid #3d3d3d;
  border-radius: 4px;
  margin-top: 4px;
  z-index: 1000;
}

.dropdown:hover .dropdown-menu {
  display: flex;
  flex-direction: column;
}

.dropdown-menu button {
  padding: 8px 16px;
  background: none;
  border: none;
  color: #cccccc;
  text-align: left;
  cursor: pointer;
}

.dropdown-menu button:hover {
  background: #3d3d3d;
}
```

**Step 3: Commit**

```bash
git add src/components/playground/ControlBar.tsx src/components/playground/ControlBar.css
git commit -m "feat(playground): add control bar with execute, save, export, and share buttons"
```

---

## Phase 4: Browser Preview Component

### Task 7: Create Browser Preview Panel

**Files:**
- Create: `doc-site/src/components/playground/BrowserPreview.tsx`

**Step 1: Write preview component**

```typescript
import React from 'react';
import { usePlaygroundStore } from './store';

export const BrowserPreview: React.FC = () => {
  const { screenshots, consoleLogs, previewMode, setPreviewMode } = usePlaygroundStore();

  const latestScreenshot = screenshots[screenshots.length - 1];

  return (
    <div className="browser-preview">
      <div className="preview-tabs">
        <button
          className={previewMode === 'screenshot' ? 'tab active' : 'tab'}
          onClick={() => setPreviewMode('screenshot')}
        >
          🖼️ Screenshot
        </button>
        <button
          className={previewMode === 'console' ? 'tab active' : 'tab'}
          onClick={() => setPreviewMode('console')}
        >
          📝 Console
        </button>
        <button
          className={previewMode === 'network' ? 'tab active' : 'tab'}
          onClick={() => setPreviewMode('network')}
        >
          🌐 Network
        </button>
      </div>

      <div className="preview-content">
        {previewMode === 'screenshot' && (
          <div className="screenshot-view">
            {latestScreenshot ? (
              <img src={latestScreenshot.data} alt="Browser screenshot" />
            ) : (
              <div className="empty-state">
                <p>No screenshot available</p>
                <p className="hint">Execute a query to see browser preview</p>
              </div>
            )}
          </div>
        )}

        {previewMode === 'console' && (
          <div className="console-view">
            {consoleLogs.length > 0 ? (
              consoleLogs.map((log, i) => (
                <div key={i} className={`console-log console-${log.level}`}>
                  <span className="timestamp">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  <span className="level">[{log.level}]</span>
                  <span className="message">{log.message}</span>
                </div>
              ))
            ) : (
              <div className="empty-state">
                <p>No console logs</p>
              </div>
            )}
          </div>
        )}

        {previewMode === 'network' && (
          <div className="network-view">
            <div className="empty-state">
              <p>Network activity viewer</p>
              <p className="hint">Coming soon</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
```

**Step 2: Add styles**

Create: `doc-site/src/components/playground/BrowserPreview.css`

```css
.browser-preview {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #1e1e1e;
}

.preview-tabs {
  display: flex;
  background: #2d2d2d;
  border-bottom: 1px solid #3d3d3d;
}

.tab {
  padding: 12px 20px;
  background: none;
  border: none;
  color: #888;
  cursor: pointer;
  font-size: 14px;
  border-bottom: 2px solid transparent;
  transition: all 0.2s;
}

.tab:hover {
  color: #ccc;
}

.tab.active {
  color: #007acc;
  border-bottom-color: #007acc;
}

.preview-content {
  flex: 1;
  overflow: auto;
  padding: 16px;
}

.screenshot-view {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.screenshot-view img {
  max-width: 100%;
  max-height: 100%;
  border: 1px solid #3d3d3d;
  border-radius: 4px;
}

.console-view {
  font-family: 'Monaco', 'Courier New', monospace;
  font-size: 13px;
}

.console-log {
  padding: 4px 8px;
  display: flex;
  gap: 8px;
  border-bottom: 1px solid #2d2d2d;
}

.console-log .timestamp {
  color: #888;
  min-width: 80px;
}

.console-log .level {
  min-width: 60px;
  font-weight: bold;
}

.console-log.console-info .level {
  color: #4fc3f7;
}

.console-log.console-warn .level {
  color: #ffb74d;
}

.console-log.console-error .level {
  color: #e57373;
}

.console-log .message {
  color: #ccc;
  word-break: break-word;
}

.empty-state {
  text-align: center;
  color: #888;
  padding: 48px 24px;
}

.empty-state p {
  margin: 8px 0;
}

.empty-state .hint {
  font-size: 13px;
  color: #666;
}
```

**Step 3: Commit**

```bash
git add src/components/playground/BrowserPreview.tsx src/components/playground/BrowserPreview.css
git commit -m "feat(playground): add browser preview panel with screenshot, console, and network tabs"
```

---

## Phase 5: Main Playground Component

### Task 8: Create Main Playground Layout

**Files:**
- Create: `doc-site/src/components/playground/Playground.tsx`

**Step 1: Write main component**

```typescript
import React, { useState } from 'react';
import { QueryEditor } from './QueryEditor';
import { BrowserPreview } from './BrowserPreview';
import { ControlBar } from './ControlBar';
import { usePlaygroundStore } from './store';
import './Playground.css';
import './ControlBar.css';
import './BrowserPreview.css';

export const Playground: React.FC = () => {
  const {
    currentQuery,
    setActiveExecution,
    addToHistory,
    addScreenshot,
    addConsoleLog,
    setResults,
    clearConsole,
  } = usePlaygroundStore();

  const [wsConnection, setWsConnection] = useState<WebSocket | null>(null);

  const handleExecute = async () => {
    const executionId = `exec_${Date.now()}`;
    const startTime = Date.now();

    clearConsole();

    // Create execution record
    setActiveExecution({
      id: executionId,
      query: currentQuery,
      status: 'running',
      startTime,
      logs: [],
      screenshots: [],
    });

    addConsoleLog('info', `Starting query execution: ${executionId}`);

    try {
      // POST to API
      const response = await fetch('/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: currentQuery,
          options: {
            timeout: 60000,
            captureScreenshots: true,
            captureConsole: true,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      const { executionId: id, wsUrl } = await response.json();

      // Connect WebSocket
      const ws = new WebSocket(wsUrl);
      setWsConnection(ws);

      ws.onopen = () => {
        addConsoleLog('info', 'WebSocket connected');
      };

      ws.onmessage = (event) => {
        const message = JSON.parse(event.data);

        switch (message.type) {
          case 'progress':
            addConsoleLog('info', `Progress: ${message.step} (${message.percent}%)`);
            break;

          case 'screenshot':
            addScreenshot(message.data);
            addConsoleLog('info', 'Screenshot captured');
            break;

          case 'console':
            addConsoleLog(message.level, message.message);
            break;

          case 'result':
            setResults(message.data);
            addConsoleLog('info', `Query completed: ${message.data.rows.length} rows`);

            const endTime = Date.now();
            setActiveExecution({
              id: executionId,
              query: currentQuery,
              status: 'completed',
              startTime,
              endTime,
              results: message.data,
              logs: [],
              screenshots: [],
            });

            addToHistory({
              id: executionId,
              query: currentQuery,
              timestamp: startTime,
              duration: endTime - startTime,
              success: true,
              resultCount: message.data.rows.length,
            });
            break;

          case 'error':
            throw new Error(message.error.message);
        }
      };

      ws.onerror = (error) => {
        addConsoleLog('error', `WebSocket error: ${error}`);
      };

      ws.onclose = () => {
        addConsoleLog('info', 'WebSocket closed');
        setWsConnection(null);
      };
    } catch (error: any) {
      addConsoleLog('error', error.message);
      setActiveExecution({
        id: executionId,
        query: currentQuery,
        status: 'error',
        startTime,
        endTime: Date.now(),
        error,
        logs: [],
        screenshots: [],
      });

      addToHistory({
        id: executionId,
        query: currentQuery,
        timestamp: startTime,
        duration: Date.now() - startTime,
        success: false,
      });
    }
  };

  const handleCancel = () => {
    if (wsConnection) {
      wsConnection.close();
      setWsConnection(null);
      addConsoleLog('info', 'Query execution cancelled');
      setActiveExecution(null);
    }
  };

  const handleExport = (format: 'json' | 'csv' | 'html') => {
    addConsoleLog('info', `Exporting as ${format.toUpperCase()}...`);
    // TODO: Implement export logic
  };

  const handleSave = () => {
    addConsoleLog('info', 'Saving query...');
    // TODO: Implement save logic
  };

  const handleShare = () => {
    addConsoleLog('info', 'Generating share link...');
    // TODO: Implement share logic
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
        <div className="editor-panel">
          <QueryEditor />
        </div>
        <div className="preview-panel">
          <BrowserPreview />
        </div>
      </div>
    </div>
  );
};
```

**Step 2: Add styles**

Create: `doc-site/src/components/playground/Playground.css`

```css
.playground {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #1e1e1e;
  color: #cccccc;
}

.playground-content {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1px;
  background: #3d3d3d;
  overflow: hidden;
}

.editor-panel,
.preview-panel {
  background: #1e1e1e;
  overflow: hidden;
}

@media (max-width: 768px) {
  .playground-content {
    grid-template-columns: 1fr;
    grid-template-rows: 1fr 1fr;
  }
}
```

**Step 3: Commit**

```bash
git add src/components/playground/Playground.tsx src/components/playground/Playground.css
git commit -m "feat(playground): add main playground layout with split view"
```

---

## Phase 6: Backend API Routes

### Task 9: Create Execute API Route

**Files:**
- Create: `doc-site/src/pages/api/execute.ts`

**Step 1: Write API endpoint**

```typescript
import type { APIRoute } from 'astro';
import { QueryEngine } from '@browserx/query-engine';
import { BrowserEngine } from '@browserx/browser';

// Simple in-memory rate limiter
const rateLimits = new Map<string, { tokens: number; lastRefill: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const limit = rateLimits.get(ip) || { tokens: 3, lastRefill: now };

  // Refill tokens (10 per minute)
  const elapsed = now - limit.lastRefill;
  const tokensToAdd = Math.floor(elapsed / 6000); // 6 seconds per token

  if (tokensToAdd > 0) {
    limit.tokens = Math.min(10, limit.tokens + tokensToAdd);
    limit.lastRefill = now;
  }

  if (limit.tokens > 0) {
    limit.tokens -= 1;
    rateLimits.set(ip, limit);
    return true;
  }

  return false;
}

export const POST: APIRoute = async ({ request }) => {
  try {
    // Get client IP
    const ip = request.headers.get('x-forwarded-for') || 'unknown';

    // Rate limit check
    if (!checkRateLimit(ip)) {
      return new Response(
        JSON.stringify({
          error: 'Rate limit exceeded',
          message: 'Too many requests. Please wait and try again.',
          retryAfter: 60,
        }),
        { status: 429, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { query, options } = await request.json();

    if (!query) {
      return new Response(
        JSON.stringify({
          error: 'Invalid request',
          message: 'Query is required',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Generate execution ID
    const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // TODO: In production, execute in background and stream via WebSocket
    // For now, return execution ID and mock WebSocket URL

    const wsUrl = `ws://${request.headers.get('host')}/api/ws/${executionId}`;

    return new Response(
      JSON.stringify({
        executionId,
        wsUrl,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error.message,
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
```

**Step 2: Commit**

```bash
git add src/pages/api/execute.ts
git commit -m "feat(playground): add execute API endpoint with rate limiting"
```

---

### Task 10: Create Validate API Route

**Files:**
- Create: `doc-site/src/pages/api/validate.ts`

**Step 1: Write validation endpoint**

```typescript
import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request }) => {
  try {
    const { query } = await request.json();

    if (!query) {
      return new Response(
        JSON.stringify({
          valid: false,
          errors: [{ message: 'Query is required', line: 0, column: 0 }],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Basic syntax validation
    const errors: Array<{ message: string; line: number; column: number }> = [];

    // Check for basic keywords
    const keywords = ['SELECT', 'NAVIGATE', 'CLICK', 'INSERT', 'IF', 'FOR'];
    const hasKeyword = keywords.some((kw) => query.toUpperCase().includes(kw));

    if (!hasKeyword) {
      errors.push({
        message: 'Query must start with a valid keyword (SELECT, NAVIGATE, etc.)',
        line: 1,
        column: 1,
      });
    }

    // Check for SELECT without FROM
    if (query.toUpperCase().includes('SELECT') && !query.toUpperCase().includes('FROM')) {
      errors.push({
        message: 'SELECT queries must include FROM clause',
        line: 1,
        column: query.toUpperCase().indexOf('SELECT') + 6,
      });
    }

    return new Response(
      JSON.stringify({
        valid: errors.length === 0,
        errors,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error.message,
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
```

**Step 2: Commit**

```bash
git add src/pages/api/validate.ts
git commit -m "feat(playground): add query validation API endpoint"
```

---

## Phase 7: Testing and Polish

### Task 11: Add Integration Test

**Files:**
- Create: `doc-site/src/components/playground/__tests__/integration.test.tsx`

**Step 1: Write integration test**

```typescript
import { describe, test, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Playground } from '../Playground';

describe('Playground Integration', () => {
  beforeEach(() => {
    // Reset store
  });

  test('renders editor and preview', () => {
    render(<Playground />);
    expect(screen.getByText(/Execute/i)).toBeInTheDocument();
  });

  test('execute button triggers query', async () => {
    render(<Playground />);
    const executeBtn = screen.getByText(/Execute/i);

    await userEvent.click(executeBtn);

    await waitFor(() => {
      expect(screen.getByText(/Starting query execution/i)).toBeInTheDocument();
    });
  });
});
```

**Step 2: Install testing dependencies**

```bash
npm install --save-dev @testing-library/react @testing-library/user-event @testing-library/jest-dom
```

**Step 3: Run tests**

```bash
npm test
```

Expected: Tests pass

**Step 4: Commit**

```bash
git add src/components/playground/__tests__/ package.json
git commit -m "test(playground): add integration tests for playground components"
```

---

### Task 12: Update Sidebar Navigation

**Files:**
- Modify: `doc-site/astro.config.mjs`

**Step 1: Update sidebar to link to new playground**

```javascript
sidebar: [
  // ... existing items ...
  {
    label: 'Playground',
    items: [
      { label: 'Query Editor', link: '/playground' },  // Changed from slug to link
    ],
  },
  // ... rest of config ...
]
```

**Step 2: Remove old placeholder page**

```bash
rm doc-site/src/content/docs/playground/index.md
rmdir doc-site/src/content/docs/playground
```

**Step 3: Test navigation**

```bash
npm run dev
```

Expected: Can navigate to /playground and see new editor

**Step 4: Commit**

```bash
git add astro.config.mjs
git commit -m "feat(playground): update navigation to new playground page"
```

---

## Phase 8: Documentation

### Task 13: Add Playground Documentation

**Files:**
- Create: `doc-site/src/content/docs/guides/playground/getting-started.md`

**Step 1: Write getting started guide**

```markdown
---
title: Playground Getting Started
description: Learn how to use the BrowserX playground
---

# Playground Getting Started

The BrowserX playground is an interactive environment for writing, testing, and debugging BrowserX queries.

## Interface Overview

The playground consists of three main areas:

### Query Editor (Left Panel)

Write your BrowserX queries with syntax highlighting, auto-completion, and real-time validation.

**Example query:**

\`\`\`sql
SELECT title, description FROM "https://example.com"
\`\`\`

### Browser Preview (Right Panel)

See live browser execution with three tabs:

- **Screenshot**: Real-time screenshots of the browser
- **Console**: Browser console output
- **Network**: Network activity timeline

### Control Bar (Top)

Execute queries, save them, export results, and access history.

## Your First Query

1. Type this query in the editor:

\`\`\`sql
SELECT title FROM "https://example.com"
\`\`\`

2. Click **Execute** (▶)
3. Watch the browser preview update in real-time
4. See the extracted data in the results panel

## Rate Limits

The playground has rate limits to prevent abuse:

- **10 queries per minute**
- **Burst of 3 queries**
- **60 second timeout per query**

## Next Steps

- [Query Syntax Guide](/guides/query/sql-syntax/)
- [Query Templates](/playground/templates/)
- [Advanced Features](/playground/advanced/)
```

**Step 2: Commit**

```bash
git add src/content/docs/guides/playground/
git commit -m "docs(playground): add getting started guide"
```

---

## Summary

This plan implements a fully functional playground using Astro island architecture with:

- ✅ Monaco-based query editor with BrowserX syntax highlighting
- ✅ Split view layout (editor + preview)
- ✅ Browser preview with screenshots and console logs
- ✅ Zustand state management
- ✅ API routes for query execution and validation
- ✅ Rate limiting (10 queries/min)
- ✅ Integration tests
- ✅ Documentation

## Next Steps (Future Enhancements)

1. **WebSocket Implementation** - Replace mock WebSocket with real streaming
2. **Block Builder** - Add visual drag-and-drop query builder
3. **IndexedDB Persistence** - Save query history and saved queries locally
4. **Query Templates** - Pre-built query patterns
5. **Schema Explorer** - Interactive documentation browser
6. **Share Feature** - Generate shareable query links
7. **Export Feature** - Download results as JSON/CSV/HTML
8. **Advanced Preview** - DOM inspector and network timeline

## Testing Commands

```bash
# Run all tests
npm test

# Run in watch mode
npm test -- --watch

# Type checking
npm run build

# Dev server
npm run dev
```

## Deployment

Build and deploy the doc-site:

```bash
cd doc-site
npm run build
npm run preview
```

Deploy to Digital Ocean droplet using the existing deployment process.
