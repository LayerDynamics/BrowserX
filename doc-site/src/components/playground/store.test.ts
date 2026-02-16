import { describe, it, expect, beforeEach } from 'vitest';
import { usePlaygroundStore } from './store';

describe('PlaygroundStore', () => {
  beforeEach(() => {
    // Reset store before each test
    const store = usePlaygroundStore.getState();
    store.clearResults();
    usePlaygroundStore.setState({
      currentQuery: '',
      editorMode: 'code',
      activeExecution: null,
      executionHistory: [],
      savedQueries: [],
      showHistory: false,
      showTemplates: false,
    });
  });

  it('should have correct initial state', () => {
    const state = usePlaygroundStore.getState();
    expect(state.currentQuery).toBe('');
    expect(state.editorMode).toBe('code');
    expect(state.activeExecution).toBeNull();
    expect(state.executionHistory).toEqual([]);
    expect(state.currentResults).toBeNull();
    expect(state.screenshots).toEqual([]);
    expect(state.consoleLogs).toEqual([]);
    expect(state.savedQueries).toHaveLength(0);
    expect(state.queryTemplates.length).toBeGreaterThan(0);
    expect(state.previewMode).toBe('screenshot');
    expect(state.showHistory).toBe(false);
    expect(state.showTemplates).toBe(false);
  });

  it('should update currentQuery with setQuery', () => {
    const store = usePlaygroundStore.getState();
    store.setQuery('SELECT * FROM "https://example.com"');
    expect(usePlaygroundStore.getState().currentQuery).toBe('SELECT * FROM "https://example.com"');
  });

  it('should switch editor mode with setEditorMode', () => {
    const store = usePlaygroundStore.getState();
    expect(usePlaygroundStore.getState().editorMode).toBe('code');

    store.setEditorMode('blocks');
    expect(usePlaygroundStore.getState().editorMode).toBe('blocks');

    store.setEditorMode('code');
    expect(usePlaygroundStore.getState().editorMode).toBe('code');
  });

  it('should add entries to history with addToHistory', () => {
    const store = usePlaygroundStore.getState();
    const entry1 = {
      id: '1',
      query: 'SELECT title FROM "https://example.com"',
      timestamp: Date.now(),
      status: 'success' as const,
      duration: 1000,
    };
    const entry2 = {
      id: '2',
      query: 'NAVIGATE TO "https://example.org"',
      timestamp: Date.now(),
      status: 'error' as const,
    };

    store.addToHistory(entry1);
    expect(usePlaygroundStore.getState().executionHistory).toHaveLength(1);
    expect(usePlaygroundStore.getState().executionHistory[0]).toEqual(entry1);

    store.addToHistory(entry2);
    expect(usePlaygroundStore.getState().executionHistory).toHaveLength(2);
  });

  it('should enforce 50-item limit on executionHistory', () => {
    const store = usePlaygroundStore.getState();

    // Add 55 entries
    for (let i = 0; i < 55; i++) {
      store.addToHistory({
        id: `${i}`,
        query: `Query ${i}`,
        timestamp: Date.now(),
        status: 'success',
        duration: 100,
      });
    }

    const history = usePlaygroundStore.getState().executionHistory;
    expect(history).toHaveLength(50);
    // Should keep the most recent 50 (FIFO - first in, first out)
    expect(history[0].id).toBe('5'); // First 5 removed
    expect(history[49].id).toBe('54');
  });

  it('should add screenshots with addScreenshot', () => {
    const store = usePlaygroundStore.getState();
    const data1 = 'data:image/png;base64,abc123';
    const data2 = 'data:image/png;base64,def456';

    store.addScreenshot(data1);
    expect(usePlaygroundStore.getState().screenshots).toHaveLength(1);
    expect(usePlaygroundStore.getState().screenshots[0].data).toBe(data1);

    store.addScreenshot(data2);
    expect(usePlaygroundStore.getState().screenshots).toHaveLength(2);
  });

  it('should enforce 20-item limit on screenshots', () => {
    const store = usePlaygroundStore.getState();

    // Add 25 screenshots
    for (let i = 0; i < 25; i++) {
      store.addScreenshot(`data:image/png;base64,${i}`);
    }

    const screenshots = usePlaygroundStore.getState().screenshots;
    expect(screenshots).toHaveLength(20);
    // Should keep the most recent 20
    expect(screenshots[0].data).toBe('data:image/png;base64,5');
    expect(screenshots[19].data).toBe('data:image/png;base64,24');
  });

  it('should add console logs with addConsoleLog', () => {
    const store = usePlaygroundStore.getState();
    const log1 = { level: 'info' as const, message: 'Info message', timestamp: Date.now() };
    const log2 = { level: 'error' as const, message: 'Error message', timestamp: Date.now() };

    store.addConsoleLog(log1);
    expect(usePlaygroundStore.getState().consoleLogs).toHaveLength(1);
    expect(usePlaygroundStore.getState().consoleLogs[0]).toEqual(log1);

    store.addConsoleLog(log2);
    expect(usePlaygroundStore.getState().consoleLogs).toHaveLength(2);
  });

  it('should enforce 100-item limit on consoleLogs', () => {
    const store = usePlaygroundStore.getState();

    // Add 110 logs
    for (let i = 0; i < 110; i++) {
      store.addConsoleLog({
        level: 'info',
        message: `Log ${i}`,
        timestamp: Date.now(),
      });
    }

    const logs = usePlaygroundStore.getState().consoleLogs;
    expect(logs).toHaveLength(100);
    // Should keep the most recent 100
    expect(logs[0].message).toBe('Log 10');
    expect(logs[99].message).toBe('Log 109');
  });

  it('should save a query with saveQuery', () => {
    const store = usePlaygroundStore.getState();
    store.setQuery('SELECT title FROM "https://example.com"');

    store.saveQuery('My Test Query');

    const saved = usePlaygroundStore.getState().savedQueries;
    expect(saved).toHaveLength(1);
    expect(saved[0].name).toBe('My Test Query');
    expect(saved[0].query).toBe('SELECT title FROM "https://example.com"');
    expect(saved[0].id).toBeDefined();
    expect(saved[0].createdAt).toBeDefined();
  });

  it('should delete a query with deleteQuery', () => {
    const store = usePlaygroundStore.getState();
    store.setQuery('SELECT title FROM "https://example.com"');
    store.saveQuery('Query to Delete');

    const queryId = usePlaygroundStore.getState().savedQueries[0].id;
    expect(usePlaygroundStore.getState().savedQueries).toHaveLength(1);

    store.deleteQuery(queryId);
    expect(usePlaygroundStore.getState().savedQueries).toHaveLength(0);
  });

  it('should load a query with loadQuery', () => {
    const store = usePlaygroundStore.getState();
    store.setQuery('SELECT title FROM "https://example.com"');
    store.saveQuery('Saved Query');

    const queryId = usePlaygroundStore.getState().savedQueries[0].id;
    store.setQuery(''); // Clear current query

    store.loadQuery(queryId);
    expect(usePlaygroundStore.getState().currentQuery).toBe('SELECT title FROM "https://example.com"');
  });

  it('should set activeExecution when executing query', async () => {
    const store = usePlaygroundStore.getState();
    store.setQuery('SELECT * FROM "https://example.com"');

    const executePromise = store.executeQuery('SELECT * FROM "https://example.com"');

    // Should be active immediately
    const active = usePlaygroundStore.getState().activeExecution;
    expect(active).not.toBeNull();
    expect(active?.status).toBe('running');
    expect(active?.id).toBeDefined();

    await executePromise;

    // Should be null after completion
    expect(usePlaygroundStore.getState().activeExecution).toBeNull();
  });

  it('should clear results with clearResults', () => {
    const store = usePlaygroundStore.getState();

    // Add some data
    store.setResults({
      columns: ['title'],
      rows: [{ title: 'Test' }],
      timing: { total: 1000 },
    });
    store.addScreenshot('data:image/png;base64,test');
    store.addConsoleLog({ level: 'info', message: 'test', timestamp: Date.now() });

    expect(usePlaygroundStore.getState().currentResults).not.toBeNull();
    expect(usePlaygroundStore.getState().screenshots).toHaveLength(1);
    expect(usePlaygroundStore.getState().consoleLogs).toHaveLength(1);

    store.clearResults();

    expect(usePlaygroundStore.getState().currentResults).toBeNull();
    expect(usePlaygroundStore.getState().screenshots).toEqual([]);
    expect(usePlaygroundStore.getState().consoleLogs).toEqual([]);
  });

  it('should toggle preview modes', () => {
    const store = usePlaygroundStore.getState();
    expect(usePlaygroundStore.getState().previewMode).toBe('screenshot');

    store.setPreviewMode('console');
    expect(usePlaygroundStore.getState().previewMode).toBe('console');

    store.setPreviewMode('network');
    expect(usePlaygroundStore.getState().previewMode).toBe('network');
  });

  it('should toggle history visibility', () => {
    const store = usePlaygroundStore.getState();
    expect(usePlaygroundStore.getState().showHistory).toBe(false);

    store.toggleHistory();
    expect(usePlaygroundStore.getState().showHistory).toBe(true);

    store.toggleHistory();
    expect(usePlaygroundStore.getState().showHistory).toBe(false);
  });

  it('should toggle templates visibility', () => {
    const store = usePlaygroundStore.getState();
    expect(usePlaygroundStore.getState().showTemplates).toBe(false);

    store.toggleTemplates();
    expect(usePlaygroundStore.getState().showTemplates).toBe(true);

    store.toggleTemplates();
    expect(usePlaygroundStore.getState().showTemplates).toBe(false);
  });
});
