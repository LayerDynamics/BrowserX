import { create } from 'zustand';

/**
 * Query execution result data structure.
 */
export interface QueryResult {
  /** Column names from the query */
  columns?: string[];
  /** Result rows as array of objects */
  rows?: Record<string, unknown>[];
  /** Query execution timing metadata */
  timing?: {
    total: number;
    network?: number;
    parsing?: number;
    extraction?: number;
  };
}

/**
 * History entry for executed queries.
 */
export interface HistoryEntry {
  /** Unique execution ID */
  id: string;
  /** The query that was executed */
  query: string;
  /** Timestamp in milliseconds */
  timestamp: number;
  /** Execution status */
  status: 'success' | 'error';
  /** Execution duration in milliseconds */
  duration?: number;
}

/**
 * Console log entry.
 */
export interface ConsoleLog {
  /** Log level */
  level: 'info' | 'warn' | 'error';
  /** Log message */
  message: string;
  /** Timestamp in milliseconds */
  timestamp: number;
}

/**
 * Screenshot entry.
 */
export interface Screenshot {
  /** Timestamp in milliseconds */
  timestamp: number;
  /** Base64 encoded image data */
  data: string;
}

/**
 * Saved query entry.
 */
export interface SavedQuery {
  /** Unique query ID */
  id: string;
  /** User-provided query name */
  name: string;
  /** The saved query text */
  query: string;
  /** Creation timestamp in milliseconds */
  createdAt: number;
}

/**
 * Query template entry.
 */
export interface QueryTemplate {
  /** Unique template ID */
  id: string;
  /** Template name */
  name: string;
  /** Template query text */
  query: string;
  /** Template description */
  description: string;
}

/**
 * Active execution state.
 */
export interface ActiveExecution {
  /** Execution ID */
  id: string;
  /** Execution status */
  status: 'running' | 'cancelling';
}

/**
 * Main Playground store using Zustand.
 * Manages all state for the playground including editor, execution, results, and UI.
 */
export interface PlaygroundStore {
  // ===== Editor State =====
  /** Current query text in the editor */
  currentQuery: string;
  /** Editor mode: code or visual blocks */
  editorMode: 'code' | 'blocks';

  // ===== Execution State =====
  /** Currently active execution, if any */
  activeExecution: ActiveExecution | null;
  /** History of executed queries (max 50 entries, FIFO) */
  executionHistory: HistoryEntry[];

  // ===== Results State =====
  /** Current query results */
  currentResults: QueryResult | null;
  /** Screenshots from browser (max 20 entries, FIFO) */
  screenshots: Screenshot[];
  /** Console logs from browser (max 100 entries, FIFO) */
  consoleLogs: ConsoleLog[];

  // ===== Saved Queries =====
  /** User-saved queries */
  savedQueries: SavedQuery[];
  /** Pre-defined query templates */
  queryTemplates: QueryTemplate[];

  // ===== UI State =====
  /** Current preview tab mode */
  previewMode: 'screenshot' | 'console' | 'network';
  /** Show history panel */
  showHistory: boolean;
  /** Show templates panel */
  showTemplates: boolean;

  // ===== Actions =====
  /** Set the current query text */
  setQuery: (query: string) => void;
  /** Switch between code and blocks editor mode */
  setEditorMode: (mode: 'code' | 'blocks') => void;
  /** Execute a query (async operation) */
  executeQuery: (query: string) => Promise<void>;
  /** Cancel the currently running execution */
  cancelExecution: () => void;
  /** Add an entry to execution history */
  addToHistory: (entry: HistoryEntry) => void;
  /** Set the current query results */
  setResults: (results: QueryResult) => void;
  /** Add a screenshot */
  addScreenshot: (data: string) => void;
  /** Add a console log */
  addConsoleLog: (log: ConsoleLog) => void;
  /** Clear all results (screenshots, logs, current results) */
  clearResults: () => void;
  /** Save the current query with a name */
  saveQuery: (name: string) => void;
  /** Delete a saved query by ID */
  deleteQuery: (id: string) => void;
  /** Load a saved query into the editor */
  loadQuery: (id: string) => void;
  /** Set the preview mode */
  setPreviewMode: (mode: 'screenshot' | 'console' | 'network') => void;
  /** Toggle history panel visibility */
  toggleHistory: () => void;
  /** Toggle templates panel visibility */
  toggleTemplates: () => void;
}

/**
 * Default query templates.
 */
const DEFAULT_TEMPLATES: QueryTemplate[] = [
  {
    id: 'select-basic',
    name: 'Basic SELECT',
    query: 'SELECT title, description FROM "https://example.com"',
    description: 'Extract specific fields from a webpage',
  },
  {
    id: 'navigate-with-options',
    name: 'Navigate with Options',
    query: `NAVIGATE TO "https://api.example.com"
  WITH {
    proxy: { cache: true },
    headers: { "User-Agent": "BrowserX" }
  }
  CAPTURE response.body, dom.title`,
    description: 'Navigate with custom headers and proxy settings',
  },
  {
    id: 'insert-form',
    name: 'Fill Form',
    query: `INSERT "user@example.com" INTO "#email"
INSERT "password123" INTO "#password"
CLICK "#submit"`,
    description: 'Fill and submit a form',
  },
  {
    id: 'conditional-flow',
    name: 'Conditional Flow',
    query: `IF EXISTS("#login-form") THEN
  INSERT "user@example.com" INTO "#email"
  CLICK "#submit"
END`,
    description: 'Execute conditional actions based on page state',
  },
  {
    id: 'loop-pagination',
    name: 'Loop Through Pages',
    query: `FOR page IN RANGE(1, 10) DO
  NAVIGATE TO "https://example.com/page/" || page
  SELECT title, content FROM "current"
END`,
    description: 'Iterate through paginated results',
  },
];

/**
 * Create the Playground store.
 */
export const usePlaygroundStore = create<PlaygroundStore>((set, get) => ({
  // ===== Initial State =====
  currentQuery: '',
  editorMode: 'code',
  activeExecution: null,
  executionHistory: [],
  currentResults: null,
  screenshots: [],
  consoleLogs: [],
  savedQueries: [],
  queryTemplates: DEFAULT_TEMPLATES,
  previewMode: 'screenshot',
  showHistory: false,
  showTemplates: false,

  // ===== Actions =====
  setQuery: (query: string) => {
    set({ currentQuery: query });
  },

  setEditorMode: (mode: 'code' | 'blocks') => {
    set({ editorMode: mode });
  },

  executeQuery: async (query: string) => {
    // Create execution ID
    const executionId = `exec-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    const startTime = Date.now();

    // Set active execution
    set({
      activeExecution: {
        id: executionId,
        status: 'running',
      },
    });

    try {
      // Call execute API
      const response = await fetch('/api/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          options: {
            timeout: 30000,
            captureScreenshots: true,
            captureConsole: true,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle error response
        throw new Error(data.error?.message || 'Query execution failed');
      }

      // Extract results from API response
      const duration = Date.now() - startTime;

      // Add to history
      get().addToHistory({
        id: executionId,
        query,
        timestamp: startTime,
        status: 'success',
        duration,
      });

      // Set results
      if (data.results) {
        // Transform API response to match store's QueryResult format
        const results: QueryResult = {
          columns: Array.isArray(data.results.data) && data.results.data.length > 0
            ? Object.keys(data.results.data[0])
            : [],
          rows: Array.isArray(data.results.data) ? data.results.data : [],
          timing: {
            total: data.results.timing?.totalTime ?? duration,
            network: data.results.timing?.executionTime,
            parsing: data.results.timing?.parserTime,
            extraction: data.results.timing?.formattingTime,
          },
        };
        get().setResults(results);
      }

      // Clear active execution on success
      set({ activeExecution: null });
    } catch (error) {
      // Add error to history
      const duration = Date.now() - startTime;
      get().addToHistory({
        id: executionId,
        query,
        timestamp: startTime,
        status: 'error',
        duration,
      });

      // Clear active execution on error
      set({ activeExecution: null });
      throw error;
    }
  },

  cancelExecution: () => {
    const { activeExecution } = get();
    if (activeExecution) {
      set({
        activeExecution: {
          ...activeExecution,
          status: 'cancelling',
        },
      });
      // TODO: Implement actual cancellation when API is ready
    }
  },

  addToHistory: (entry: HistoryEntry) => {
    set((state) => {
      const newHistory = [...state.executionHistory, entry];
      // Enforce 50-item limit (FIFO)
      if (newHistory.length > 50) {
        newHistory.splice(0, newHistory.length - 50);
      }
      return { executionHistory: newHistory };
    });
  },

  setResults: (results: QueryResult) => {
    set({ currentResults: results });
  },

  addScreenshot: (data: string) => {
    set((state) => {
      const newScreenshots = [
        ...state.screenshots,
        { timestamp: Date.now(), data },
      ];
      // Enforce 20-item limit (FIFO)
      if (newScreenshots.length > 20) {
        newScreenshots.splice(0, newScreenshots.length - 20);
      }
      return { screenshots: newScreenshots };
    });
  },

  addConsoleLog: (log: ConsoleLog) => {
    set((state) => {
      const newLogs = [...state.consoleLogs, log];
      // Enforce 100-item limit (FIFO)
      if (newLogs.length > 100) {
        newLogs.splice(0, newLogs.length - 100);
      }
      return { consoleLogs: newLogs };
    });
  },

  clearResults: () => {
    set({
      currentResults: null,
      screenshots: [],
      consoleLogs: [],
    });
  },

  saveQuery: (name: string) => {
    const { currentQuery } = get();
    const savedQuery: SavedQuery = {
      id: `query-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      name,
      query: currentQuery,
      createdAt: Date.now(),
    };
    set((state) => ({
      savedQueries: [...state.savedQueries, savedQuery],
    }));
  },

  deleteQuery: (id: string) => {
    set((state) => ({
      savedQueries: state.savedQueries.filter((q) => q.id !== id),
    }));
  },

  loadQuery: (id: string) => {
    const { savedQueries } = get();
    const query = savedQueries.find((q) => q.id === id);
    if (query) {
      set({ currentQuery: query.query });
    }
  },

  setPreviewMode: (mode: 'screenshot' | 'console' | 'network') => {
    set({ previewMode: mode });
  },

  toggleHistory: () => {
    set((state) => ({ showHistory: !state.showHistory }));
  },

  toggleTemplates: () => {
    set((state) => ({ showTemplates: !state.showTemplates }));
  },
}));
