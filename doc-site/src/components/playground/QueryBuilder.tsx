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
