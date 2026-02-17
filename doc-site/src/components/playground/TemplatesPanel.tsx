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
