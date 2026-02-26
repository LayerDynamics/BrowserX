import React, { useRef, useCallback, useEffect } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import { usePlaygroundStore } from './store';
import type { ValidationError } from './store';
import type * as Monaco from 'monaco-editor';

/**
 * Monaco Editor for BrowserX query language.
 * Provides syntax highlighting, inline validation errors (red squiggles),
 * and live AST data via debounced calls to /api/validate.
 */
export const QueryEditor: React.FC = () => {
  const { currentQuery, setQuery, setASTData } = usePlaygroundStore();
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof Monaco | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current !== null) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  /**
   * Call /api/validate, dispatch AST data to store, and set Monaco markers.
   */
  const validateQuery = useCallback(async (query: string) => {
    try {
      const res = await fetch('/api/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      const data = await res.json();

      if (data.valid) {
        setASTData(data.ast ?? null, []);
        if (editorRef.current && monacoRef.current) {
          const model = editorRef.current.getModel();
          if (model) {
            monacoRef.current.editor.setModelMarkers(model, 'browserx-validate', []);
          }
        }
      } else {
        const errors: ValidationError[] = data.errors ?? [];
        setASTData(null, errors);
        if (editorRef.current && monacoRef.current) {
          const model = editorRef.current.getModel();
          if (model) {
            monacoRef.current.editor.setModelMarkers(
              model,
              'browserx-validate',
              errors.map((e) => ({
                severity: monacoRef.current!.MarkerSeverity.Error,
                startLineNumber: e.line,
                startColumn: e.column,
                endLineNumber: e.line,
                endColumn: e.column + 1,
                message: e.message,
                source: 'BrowserX',
              })),
            );
          }
        }
      }
    } catch {
      // Network error — clear markers silently
      if (editorRef.current && monacoRef.current) {
        const model = editorRef.current.getModel();
        if (model) {
          monacoRef.current.editor.setModelMarkers(model, 'browserx-validate', []);
        }
      }
    }
  }, [setASTData]);

  /**
   * Register BrowserX query language and theme on editor mount.
   */
  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    if (!monaco.languages.getLanguages().find((l: { id: string }) => l.id === 'browserx-query')) {
      monaco.languages.register({ id: 'browserx-query' });

      monaco.languages.setMonarchTokensProvider('browserx-query', {
        tokenizer: {
          root: [
            [
              /\b(SELECT|FROM|WHERE|NAVIGATE|TO|CLICK|INSERT|INTO|IF|THEN|ELSE|FOR|EACH|IN|WITH|CAPTURE|SET|SHOW|EXISTS|COUNT|TEXT|HTML|ATTR|UPDATE|DELETE|END|DO|RANGE|OR|AND)\b/,
              'keyword',
            ],
            [/[=!<>]+/, 'operator'],
            [/\d+/, 'number'],
            [/"([^"\\]|\\.)*"/, 'string'],
            [/'([^'\\]|\\.)*'/, 'string'],
            [/--.*$/, 'comment'],
            [/[{}[\]()]/, 'bracket'],
          [/[,;]/, 'delimiter'],
        ],
      },
      });
    }

    monaco.editor.defineTheme('browserx-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'keyword',   foreground: 'ffffff', fontStyle: 'bold' },
        { token: 'string',    foreground: '888888' },
        { token: 'number',    foreground: 'c8c8c8' },
        { token: 'comment',   foreground: '5c5c5c', fontStyle: 'italic' },
        { token: 'operator',  foreground: '666666' },
        { token: 'bracket',   foreground: 'c8c8c8' },
        { token: 'delimiter', foreground: '555555' },
      ],
      colors: {
        'editor.background':                '#000000',
        'editor.foreground':                '#c8c8c8',
        'editorLineNumber.foreground':      '#444444',
        'editorCursor.foreground':          '#ffffff',
        'editor.selectionBackground':       '#222222',
        'editor.lineHighlightBackground':   '#0f0f0f',
        'editorIndentGuide.background':     '#1a1a1a',
        'editorIndentGuide.activeBackground':'#333333',
        'editorBracketMatch.background':    '#222222',
        'editorBracketMatch.border':        '#555555',
      },
    });

    monaco.editor.setTheme('browserx-dark');
    editor.focus();

    if (currentQuery.trim()) {
      validateQuery(currentQuery);
    }
  };

  /**
   * Update store and schedule debounced validation (300ms).
   */
  const handleEditorChange = (value: string | undefined) => {
    const newValue = value ?? '';
    setQuery(newValue);
    if (debounceTimerRef.current !== null) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      validateQuery(newValue);
    }, 300);
  };

  return (
    <Editor
      height="100%"
      language="browserx-query"
      theme="browserx-dark"
      value={currentQuery}
      onChange={handleEditorChange}
      onMount={handleEditorMount}
      options={{
        minimap: { enabled: false },
        fontSize: 14,
        lineNumbers: 'on',
        scrollBeyondLastLine: false,
        automaticLayout: true,
        tabSize: 2,
        wordWrap: 'on',
        renderLineHighlight: 'all',
        cursorBlinking: 'smooth',
        cursorSmoothCaretAnimation: 'on',
        smoothScrolling: true,
        folding: true,
        bracketPairColorization: { enabled: true },
        guides: { bracketPairs: true, indentation: true },
      }}
    />
  );
};
