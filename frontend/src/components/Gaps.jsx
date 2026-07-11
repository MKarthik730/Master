import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api.js';

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export default function Gaps({ getDomain }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  const loadGaps = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.getGaps(getDomain());
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [getDomain]);

  useEffect(() => {
    loadGaps();
  }, [loadGaps]);

  if (loading) {
    return (
      <div id="gaps-tab" className="tab-content active">
        <div className="gap-empty">
          <div className="empty-icon loading-pulse" style={{ fontSize: '3rem', marginBottom: 12 }}>📚</div>
          <p>Loading gaps...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div id="gaps-tab" className="tab-content active">
        <div className="gap-empty">
          <div className="empty-icon" style={{ fontSize: '3rem', marginBottom: 12 }}>⚠️</div>
          <p>Error loading gaps: {error}</p>
        </div>
      </div>
    );
  }

  if (!data?.gaps || data.gaps.length === 0) {
    return (
      <div id="gaps-tab" className="tab-content active">
        <div className="gap-empty">
          <div className="empty-icon" style={{ fontSize: '3rem', marginBottom: 12 }}>🎉</div>
          <p>No gaps detected! Great job!</p>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 8 }}>
            Add more covered topics to see gap analysis.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div id="gaps-tab" className="tab-content active">
      <div className="gaps-summary">
        <div className="gap-stat">
          <div className="stat-value gaps">{data.total_gaps}</div>
          <div className="stat-label">Gaps</div>
        </div>
        <div className="gap-stat">
          <div className="stat-value covered">{data.total_gaps === 0 ? '✓' : '-'}</div>
          <div className="stat-label">Covered</div>
        </div>
        <div className="gap-stat">
          <div className="stat-value in-progress">{data.total_gaps === 0 ? '✓' : '-'}</div>
          <div className="stat-label">Status</div>
        </div>
      </div>

      {data.gaps.map((gap, index) => (
        <div
          key={gap.topic.id}
          className="gap-item"
          style={{ animationDelay: `${index * 0.05}s` }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
            <h3>{escapeHtml(gap.topic.name)}</h3>
            <span
              style={{
                fontSize: '0.7rem',
                color: 'var(--text-muted)',
                background: 'var(--bg-secondary)',
                padding: '2px 8px',
                borderRadius: 99,
              }}
            >
              #{gap.suggested_order}
            </span>
          </div>
          <div className="gap-desc">{escapeHtml(gap.topic.description || '')}</div>
          <div className="gap-prereq">
            ⚠️ Prerequisite for: {gap.prerequisite_for.map(escapeHtml).join(', ')}
          </div>
          {gap.explanation && (
            <div className="gap-explanation">
              {escapeHtml(gap.explanation)}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
