import React, { useRef } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import { usePlaygroundStore } from './store';
import type * as Monaco from 'monaco-editor';

/**
 * Monaco Editor component for BrowserX query language.
 * Provides syntax highlighting and autocomplete for the BrowserX query language.
 */
export const QueryEditor: React.FC = () => {
  const { currentQuery, setQuery } = usePlaygroundStore();
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);

  /**
   * Register BrowserX query language and theme on editor mount.
   */
  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;

    // Register BrowserX query language
    monaco.languages.register({ id: 'browserx-query' });

    // Define token provider for syntax highlighting
    monaco.languages.setMonarchTokensProvider('browserx-query', {
      tokenizer: {
        root: [
          // Keywords
          [
            /\b(SELECT|FROM|WHERE|NAVIGATE|TO|CLICK|INSERT|INTO|IF|THEN|ELSE|FOR|EACH|IN|WITH|CAPTURE|SET|SHOW|EXISTS|COUNT|TEXT|HTML|ATTR|UPDATE|DELETE|END|DO|RANGE|OR|AND)\b/,
            'keyword',
          ],

          // Operators
          [/[=!<>]+/, 'operator'],

          // Numbers
          [/\d+/, 'number'],

          // Strings (double quotes)
          [/"([^"\\]|\\.)*"/, 'string'],

          // Strings (single quotes)
          [/'([^'\\]|\\.)*'/, 'string'],

          // Comments (-- style)
          [/--.*$/, 'comment'],

          // Brackets
          [/[{}[\]()]/, 'bracket'],

          // Delimiters
          [/[,;]/, 'delimiter'],
        ],
      },
    });

    // Define custom theme
    monaco.editor.defineTheme('browserx-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'keyword', foreground: 'C586C0', fontStyle: 'bold' },
        { token: 'string', foreground: 'CE9178' },
        { token: 'number', foreground: 'B5CEA8' },
        { token: 'comment', foreground: '6A9955', fontStyle: 'italic' },
        { token: 'operator', foreground: 'D4D4D4' },
        { token: 'bracket', foreground: 'FFD700' },
        { token: 'delimiter', foreground: 'D4D4D4' },
      ],
      colors: {
        'editor.background': '#1E1E1E',
        'editor.foreground': '#D4D4D4',
        'editorLineNumber.foreground': '#858585',
        'editorCursor.foreground': '#AEAFAD',
        'editor.selectionBackground': '#264F78',
        'editor.lineHighlightBackground': '#2A2A2A',
      },
    });

    // Set the theme
    monaco.editor.setTheme('browserx-dark');

    // Focus the editor
    editor.focus();
  };

  /**
   * Handle editor content changes.
   */
  const handleEditorChange = (value: string | undefined) => {
    setQuery(value || '');
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
        bracketPairColorization: {
          enabled: true,
        },
        guides: {
          bracketPairs: true,
          indentation: true,
        },
      }}
    />
  );
};
