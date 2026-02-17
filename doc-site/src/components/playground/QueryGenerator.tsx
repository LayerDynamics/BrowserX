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
