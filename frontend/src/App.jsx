import React, { useState, useEffect, useCallback } from 'react';
import { api } from './services/api.js';
import Chat from './components/Chat.jsx';
import Gaps from './components/Gaps.jsx';
import Graph from './components/Graph.jsx';
import LoadingScreen from './components/LoadingScreen.jsx';
import Toast from './components/Toast.jsx';

const TABS = [
  { id: 'chat', label: 'Chat', icon: '💬' },
  { id: 'gaps', label: 'Gaps', icon: '🔍' },
  { id: 'graph', label: 'Graph', icon: '🔗' },
];

export default function App() {
  const [loading, setLoading] = useState(true);
  const [currentDomain, setCurrentDomain] = useState('theory_of_computation');
  const [activeTab, setActiveTab] = useState('chat');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [statusText, setStatusText] = useState('Initializing...');
  const [toastMessage, setToastMessage] = useState('');
  const [toastShow, setToastShow] = useState(false);

  const getDomain = useCallback(() => currentDomain, [currentDomain]);

  const showToast = useCallback((message, duration = 3000) => {
    setToastMessage(message);
    setToastShow(true);
  }, []);

  const hideToast = useCallback(() => {
    setToastShow(false);
  }, []);

  useEffect(() => {
    async function init() {
      try {
        const health = await api.health();
        console.log('Backend status:', health);
        setStatusText('Connected');
      } catch {
        setStatusText('Backend unavailable — start docker-compose');
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setStatusText('Connected');
    };
    const handleOffline = () => {
      setIsOnline(false);
      setStatusText('Offline');
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then(() => console.log('Service worker registered'))
        .catch((e) => console.log('Service worker registration failed:', e));
    }
  }, []);

  const handleDomainChange = (e) => {
    const newDomain = e.target.value;
    setCurrentDomain(newDomain);
    showToast(`Switched to ${newDomain.replace(/_/g, ' ')}`);
  };

  const TAB_COMPONENTS = {
    chat: Chat,
    gaps: Gaps,
    graph: Graph,
  };
  const TabComponent = TAB_COMPONENTS[activeTab];

  return (
    <>
      <LoadingScreen hidden={!loading} />

      <div id="app-root" className="visible">
        {/* Header */}
        <header className="app-header">
          <div className="app-title">
            📚 GapDetector
            <span className="badge">v0.1</span>
          </div>
        </header>

        {/* Domain Picker */}
        <div className="domain-picker">
          <label htmlFor="domain-select">Domain</label>
          <select
            id="domain-select"
            value={currentDomain}
            onChange={handleDomainChange}
          >
            <option value="theory_of_computation">Theory of Computation</option>
            <option value="dbms" disabled>DBMS (coming soon)</option>
            <option value="os" disabled>OS (coming soon)</option>
          </select>
        </div>

        {/* Tab Navigation */}
        <nav className="tab-bar">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className="tab-icon">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Dynamic Tab Content */}
        {TabComponent && <TabComponent getDomain={getDomain} />}

        {/* Status Bar */}
        <div className="status-bar">
          <span>
            <span className={`status-dot ${isOnline ? 'online' : 'offline'}`} />
            <span
              id="status-text"
              className={statusText.includes('unavailable') ? 'status-error' : ''}
            >
              {statusText}
            </span>
          </span>
          <span>Domain: TOC</span>
        </div>

        {/* Toast */}
        <Toast message={toastMessage} show={toastShow} onHide={hideToast} />
      </div>
    </>
  );
}
