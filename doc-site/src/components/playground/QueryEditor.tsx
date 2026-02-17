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

    // Define custom theme — pure black/white palette
    monaco.editor.defineTheme('browserx-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'keyword', foreground: 'ffffff', fontStyle: 'bold' },
        { token: 'string', foreground: '888888' },
        { token: 'number', foreground: 'c8c8c8' },
        { token: 'comment', foreground: '444444', fontStyle: 'italic' },
        { token: 'operator', foreground: '666666' },
        { token: 'bracket', foreground: 'c8c8c8' },
        { token: 'delimiter', foreground: '555555' },
      ],
      colors: {
        'editor.background': '#000000',
        'editor.foreground': '#c8c8c8',
        'editorLineNumber.foreground': '#444444',
        'editorCursor.foreground': '#ffffff',
        'editor.selectionBackground': '#222222',
        'editor.lineHighlightBackground': '#0f0f0f',
        'editorIndentGuide.background': '#1a1a1a',
        'editorIndentGuide.activeBackground': '#333333',
        'editorBracketMatch.background': '#222222',
        'editorBracketMatch.border': '#555555',
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
