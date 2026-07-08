/** Main application entry point. */

import { api } from './api.js';
import { initChat } from './chat.js';
import { initGaps } from './gaps.js';
import { initGraph } from './graph.js';

// State
let currentDomain = 'theory_of_computation';
let isOnline = navigator.onLine;

function getDomain() {
  return currentDomain;
}

// Tab switching
function switchTab(tabId) {
  // Update tab buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });

  // Update tab content
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.toggle('active', content.id === `${tabId}-tab`);
  });

  // Trigger graph resize if switching to graph tab
  if (tabId === 'graph') {
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 100);
  }
}

// Initialize app
async function init() {
  const loadingScreen = document.getElementById('loading-screen');
  const appRoot = document.getElementById('app-root');

  try {
    // Health check
    const health = await api.health();
    console.log('Backend status:', health);

    // Show app
    loadingScreen.classList.add('hidden');
    appRoot.classList.add('visible');
  } catch (err) {
    // Still show app even if backend is not available
    loadingScreen.classList.add('hidden');
    appRoot.classList.add('visible');

    // Show status
    const statusEl = document.getElementById('status-text');
    if (statusEl) {
      statusEl.textContent = 'Backend unavailable — start docker-compose';
      statusEl.style.color = 'var(--danger)';
    }
  }

  // Tab switching
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Domain picker
  const domainSelect = document.getElementById('domain-select');
  if (domainSelect) {
    domainSelect.addEventListener('change', (e) => {
      currentDomain = e.target.value;
      // Reload gaps and graph with new domain
      const gapsModule = initGaps(getDomain);
      const graphModule = initGraph(getDomain, getDomain);
      showToast(`Switched to ${currentDomain.replace(/_/g, ' ')}`);
    });
  }

  // Initialize modules
  initChat(getDomain);

  // Use setTimeout to let the chat init first
  setTimeout(() => {
    initGaps(getDomain);
    initGraph(getDomain, getDomain);
  }, 100);

  // Online/offline status
  window.addEventListener('online', () => {
    isOnline = true;
    updateStatus();
  });
  window.addEventListener('offline', () => {
    isOnline = false;
    updateStatus();
  });

  // Register service worker
  if ('serviceWorker' in navigator) {
    try {
      await navigator.serviceWorker.register('/sw.js');
      console.log('Service worker registered');
    } catch (e) {
      console.log('Service worker registration failed:', e);
    }
  }

  updateStatus();
}

function updateStatus() {
  const statusEl = document.getElementById('status-text');
  const dotEl = document.querySelector('.status-dot');
  if (statusEl && dotEl) {
    dotEl.className = `status-dot ${isOnline ? 'online' : 'offline'}`;
    statusEl.textContent = isOnline ? 'Connected' : 'Offline';
  }
}

function showToast(message, duration = 3000) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => toast.classList.remove('show'), duration);
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
