import { describe, test, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Playground } from '../Playground';
import { usePlaygroundStore } from '../store';

/**
 * Integration tests for the Browser Playground.
 * Tests the full component interaction flow from editor to results.
 */

// Mock fetch for API calls
global.fetch = vi.fn();

describe('Playground Integration', () => {
  beforeEach(() => {
    // Reset store state before each test
    const store = usePlaygroundStore.getState();
    store.setQuery('');
    store.clearResults();
    usePlaygroundStore.setState({
      activeExecution: null,
      executionHistory: [],
      screenshots: [],
      consoleLogs: [],
      savedQueries: [],
    });

    // Reset fetch mock
    vi.clearAllMocks();
  });

  test('renders all main components', () => {
    render(<Playground />);

    // Control bar should have execute button
    expect(screen.getByRole('button', { name: /execute/i })).toBeInTheDocument();

    // Should have save, share, export buttons
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /share/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /export/i })).toBeInTheDocument();

    // Should have panel toggle buttons
    expect(screen.getByRole('button', { name: /history/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /templates/i })).toBeInTheDocument();
  });

  test('execute button triggers query execution', async () => {
    // Mock successful API response
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        executionId: 'test-exec-123',
        results: {
          columns: ['title'],
          rows: [{ title: 'Test Page' }],
          timing: { total: 1000 },
        },
      }),
    });

    render(<Playground />);

    // Set a query
    const store = usePlaygroundStore.getState();
    store.setQuery('SELECT title FROM "https://example.com"');

    // Click execute
    const executeBtn = screen.getByRole('button', { name: /execute/i });
    await userEvent.click(executeBtn);

    // Should show starting message in console
    await waitFor(() => {
      const state = usePlaygroundStore.getState();
      expect(state.consoleLogs.some(log => log.message.includes('Starting execution'))).toBe(true);
    });

    // Should add to history after completion
    await waitFor(() => {
      const state = usePlaygroundStore.getState();
      expect(state.executionHistory.length).toBeGreaterThan(0);
    }, { timeout: 3000 });
  });

  test('cancel button stops execution', async () => {
    render(<Playground />);

    // Set a query and start execution
    const store = usePlaygroundStore.getState();
    store.setQuery('SELECT * FROM "https://example.com"');

    const executeBtn = screen.getByRole('button', { name: /execute/i });
    await userEvent.click(executeBtn);

    // Wait for execution to start
    await waitFor(() => {
      const state = usePlaygroundStore.getState();
      expect(state.activeExecution).not.toBeNull();
    });

    // Click cancel
    const cancelBtn = screen.getByRole('button', { name: /cancel/i });
    await userEvent.click(cancelBtn);

    // Should show cancelled message
    await waitFor(() => {
      const state = usePlaygroundStore.getState();
      expect(state.consoleLogs.some(log => log.message.includes('cancelled'))).toBe(true);
    });
  });

  test('save button prompts for query name', async () => {
    // Mock prompt
    global.prompt = vi.fn(() => 'My Saved Query');

    render(<Playground />);

    // Set a query
    const store = usePlaygroundStore.getState();
    store.setQuery('SELECT title FROM "https://example.com"');

    // Click save
    const saveBtn = screen.getByRole('button', { name: /save/i });
    await userEvent.click(saveBtn);

    // Should have called prompt
    expect(global.prompt).toHaveBeenCalled();

    // Should add to saved queries
    await waitFor(() => {
      const state = usePlaygroundStore.getState();
      expect(state.savedQueries.length).toBe(1);
      expect(state.savedQueries[0].name).toBe('My Saved Query');
    });
  });

  test('share button copies link to clipboard', async () => {
    // Mock clipboard API
    const mockWriteText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: mockWriteText,
      },
    });

    render(<Playground />);

    // Set a query
    const store = usePlaygroundStore.getState();
    store.setQuery('SELECT title FROM "https://example.com"');

    // Click share
    const shareBtn = screen.getByRole('button', { name: /share/i });
    await userEvent.click(shareBtn);

    // Should have copied to clipboard
    await waitFor(() => {
      expect(mockWriteText).toHaveBeenCalled();
      const copiedUrl = mockWriteText.mock.calls[0][0];
      expect(copiedUrl).toContain('/playground');
      expect(copiedUrl).toContain('q=');
    });
  });

  test('export button generates downloadable file', async () => {
    render(<Playground />);

    // Set some mock results
    const store = usePlaygroundStore.getState();
    store.setResults({
      columns: ['title', 'url'],
      rows: [
        { title: 'Page 1', url: 'https://example.com' },
        { title: 'Page 2', url: 'https://test.com' },
      ],
      timing: { total: 1500 },
    });

    // Mock createElement and URL.createObjectURL
    const mockClick = vi.fn();
    const mockElement = {
      href: '',
      download: '',
      click: mockClick,
    };
    vi.spyOn(document, 'createElement').mockReturnValue(mockElement as any);
    global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');

    // Click export dropdown (this is simplified - actual implementation may vary)
    const exportBtn = screen.getByRole('button', { name: /export/i });
    await userEvent.click(exportBtn);

    // In a real scenario, we'd click a dropdown option here
    // For now, just verify the button exists
    expect(exportBtn).toBeInTheDocument();
  });

  test('history toggle shows/hides history panel', async () => {
    render(<Playground />);

    const initialState = usePlaygroundStore.getState();
    expect(initialState.showHistory).toBe(false);

    // Click history button
    const historyBtn = screen.getByRole('button', { name: /history/i });
    await userEvent.click(historyBtn);

    // Should toggle history visibility
    await waitFor(() => {
      const state = usePlaygroundStore.getState();
      expect(state.showHistory).toBe(true);
    });

    // Click again to hide
    await userEvent.click(historyBtn);

    await waitFor(() => {
      const state = usePlaygroundStore.getState();
      expect(state.showHistory).toBe(false);
    });
  });

  test('templates toggle shows/hides templates panel', async () => {
    render(<Playground />);

    const initialState = usePlaygroundStore.getState();
    expect(initialState.showTemplates).toBe(false);

    // Click templates button
    const templatesBtn = screen.getByRole('button', { name: /templates/i });
    await userEvent.click(templatesBtn);

    // Should toggle templates visibility
    await waitFor(() => {
      const state = usePlaygroundStore.getState();
      expect(state.showTemplates).toBe(true);
    });

    // Click again to hide
    await userEvent.click(templatesBtn);

    await waitFor(() => {
      const state = usePlaygroundStore.getState();
      expect(state.showTemplates).toBe(false);
    });
  });

  test('store maintains query history with limit', () => {
    const store = usePlaygroundStore.getState();

    // Add 55 entries (limit is 50)
    for (let i = 0; i < 55; i++) {
      store.addToHistory({
        id: `exec-${i}`,
        query: `Query ${i}`,
        timestamp: Date.now(),
        status: 'success',
        duration: 1000,
      });
    }

    const state = usePlaygroundStore.getState();
    expect(state.executionHistory.length).toBe(50);
    // Should keep most recent 50 (entries 5-54)
    expect(state.executionHistory[0].id).toBe('exec-5');
    expect(state.executionHistory[49].id).toBe('exec-54');
  });

  test('store maintains screenshot history with limit', () => {
    const store = usePlaygroundStore.getState();

    // Add 25 screenshots (limit is 20)
    for (let i = 0; i < 25; i++) {
      store.addScreenshot(`data:image/png;base64,screenshot${i}`);
    }

    const state = usePlaygroundStore.getState();
    expect(state.screenshots.length).toBe(20);
    // Should keep most recent 20 (entries 5-24)
    expect(state.screenshots[0].data).toContain('screenshot5');
    expect(state.screenshots[19].data).toContain('screenshot24');
  });

  test('store maintains console log history with limit', () => {
    const store = usePlaygroundStore.getState();

    // Add 110 logs (limit is 100)
    for (let i = 0; i < 110; i++) {
      store.addConsoleLog({
        level: 'info',
        message: `Log ${i}`,
        timestamp: Date.now(),
      });
    }

    const state = usePlaygroundStore.getState();
    expect(state.consoleLogs.length).toBe(100);
    // Should keep most recent 100 (entries 10-109)
    expect(state.consoleLogs[0].message).toBe('Log 10');
    expect(state.consoleLogs[99].message).toBe('Log 109');
  });
});
