/** Gap dashboard module — renders detected study gaps with explanations. */

import { api } from './api.js';

export function initGaps(getDomain) {
  const container = document.getElementById('gaps-container');

  async function loadGaps() {
    container.innerHTML = '<div class="gap-empty"><div class="empty-icon loading-pulse">📚</div><p>Loading gaps...</p></div>';
    try {
      const data = await api.getGaps(getDomain());
      renderGaps(data);
    } catch (err) {
      container.innerHTML = `<div class="gap-empty"><div class="empty-icon">⚠️</div><p>Error loading gaps: ${err.message}</p></div>`;
    }
  }

  function renderGaps(data) {
    if (!data.gaps || data.gaps.length === 0) {
      container.innerHTML = `
        <div class="gap-empty">
          <div class="empty-icon">🎉</div>
          <p>No gaps detected! Great job!</p>
          <p style="font-size:0.8rem;color:var(--text-muted);margin-top:8px;">
            Add more covered topics to see gap analysis.
          </p>
        </div>
      `;
      return;
    }

    // Summary stats
    const stats = document.createElement('div');
    stats.className = 'gaps-summary';
    stats.innerHTML = `
      <div class="gap-stat">
        <div class="stat-value gaps">${data.total_gaps}</div>
        <div class="stat-label">Gaps</div>
      </div>
      <div class="gap-stat">
        <div class="stat-value covered">${data.total_gaps === 0 ? '✓' : '-'}</div>
        <div class="stat-label">Covered</div>
      </div>
      <div class="gap-stat">
        <div class="stat-value in-progress">${data.total_gaps === 0 ? '✓' : '-'}</div>
        <div class="stat-label">Status</div>
      </div>
    `;
    container.innerHTML = '';
    container.appendChild(stats);

    // Gap items
    data.gaps.forEach((gap, index) => {
      const el = document.createElement('div');
      el.className = 'gap-item';
      el.style.animationDelay = `${index * 0.05}s`;

      el.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:start;">
          <h3>${escapeHtml(gap.topic.name)}</h3>
          <span style="font-size:0.7rem;color:var(--text-muted);background:var(--bg-secondary);padding:2px 8px;border-radius:99px;">
            #${gap.suggested_order}
          </span>
        </div>
        <div class="gap-desc">${escapeHtml(gap.topic.description || '')}</div>
        <div class="gap-prereq">
          ⚠️ Prerequisite for: ${gap.prerequisite_for.map(escapeHtml).join(', ')}
        </div>
        ${gap.explanation ? `
          <div class="gap-explanation">
            ${escapeHtml(gap.explanation)}
          </div>
        ` : ''}
      `;
      container.appendChild(el);
    });
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Load on init
  loadGaps();

  return { loadGaps };
}
