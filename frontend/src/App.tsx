import React, { useEffect } from 'react'
import { useStore } from './store'
import { api } from './api'
import { mockProgressTree, mockGraphData, mockGaps } from './mockData'
import GraphView from './components/GraphView'
import ChatView from './components/ChatView'
import ProgressView from './components/ProgressView'
import SchedulerView from './components/SchedulerView'
import UploadView from './components/UploadView'
import NodePanel from './components/NodePanel'

const NAV_ITEMS = [
  { id: 'graph', label: 'Graph', icon: '◈' },
  { id: 'chat', label: 'Chat', icon: '◆' },
  { id: 'progress', label: 'Progress', icon: '⬡' },
  { id: 'scheduler', label: 'Schedule', icon: '▣' },
  { id: 'upload', label: 'Upload', icon: '⊞' },
] as const

const PANEL_WIDTH = 420
const DOMAINS = ['placement_mastery', 'theory_of_computation']

export default function App() {
  const {
    activeView, setActiveView, sidePanelOpen, closeSidePanel,
    setProgressTree, setGraphData, setGaps, isMobile, setIsMobile,
    domain, setDomain, visibleModules, setVisibleModules,
    focusGapsOnly, setFocusGapsOnly, searchQuery, setSearchQuery,
    openSidePanel, sidePanelContent, selectedNodeId, setSelectedNode,
  } = useStore()

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [setIsMobile])

  useEffect(() => {
    async function load() {
      try {
        const [tree, graph, gapsRes] = await Promise.all([
          api.getProgressTree(domain).catch(() => mockProgressTree),
          api.getGraph(domain).catch(() => mockGraphData),
          api.getGaps(domain).catch(() => ({ gaps: mockGaps })),
        ])
        setProgressTree(tree)
        setGraphData(graph)
        setGaps(gapsRes.gaps)
      } catch {
        setProgressTree(mockProgressTree)
        setGraphData(mockGraphData)
        setGaps(mockGaps)
      }
    }
    load()
  }, [domain, setProgressTree, setGraphData, setGaps])

  // Keyboard
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === '/') { e.preventDefault(); document.getElementById('graph-search')?.focus() }
      if (e.key === 'Escape') { closeSidePanel(); setSelectedNode(null) }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [closeSidePanel, setSelectedNode])

  const isPanelOpen = sidePanelOpen || activeView !== 'graph'

  // On desktop, non-graph views open as right panels. On mobile, they replace the view.
  const handleNavClick = (view: string) => {
    if (view !== 'graph') setSelectedNode(null)  // prevent stale node panel
    if (isMobile) {
      setActiveView(view as any)
    } else {
      if (view === 'graph') {
        setActiveView('graph')
        closeSidePanel()
      } else {
        setActiveView(view as any)
        openSidePanel(view as any)
      }
    }
  }

  const renderPanelContent = () => {
    if (selectedNodeId && activeView === 'graph') return <NodePanel onClose={closeSidePanel} />
    switch (activeView) {
      case 'chat': return <ChatView />
      case 'progress': return <ProgressView />
      case 'scheduler': return <SchedulerView />
      case 'upload': return <UploadView />
      default: return selectedNodeId ? <NodePanel onClose={closeSidePanel} /> : null
    }
  }

  return (
    <div className="h-dvh w-screen flex overflow-hidden bg-base-900">
      {/* Left Rail */}
      <nav className="w-14 flex-shrink-0 bg-base-800 border-r border-base-600 flex flex-col items-center py-3 gap-1 z-30">
        {/* Domain Switcher */}
        <div className="mb-2 relative group">
          <select
            value={domain}
            onChange={e => setDomain(e.target.value)}
            className="appearance-none w-10 h-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent text-lg font-bold cursor-pointer text-center text-[11px]"
            style={{ textAlign: 'center', textAlignLast: 'center' }}
          >
            {DOMAINS.map(d => (
              <option key={d} value={d}>{d === 'placement_mastery' ? 'M' : 'T'}</option>
            ))}
          </select>
          <div className="absolute left-14 top-0 tooltip opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none">
            {domain === 'placement_mastery' ? 'Master Syllabus' : 'Theory of Computation'}
          </div>
        </div>

        <div className="w-8 h-px bg-base-600 mb-2" />

        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            onClick={() => handleNavClick(item.id)}
            className={`nav-btn ${(!isMobile && activeView === item.id && item.id !== 'graph') || (isMobile && activeView === item.id) ? 'active' : ''} ${item.id === 'graph' && activeView === 'graph' && !sidePanelOpen ? 'active' : ''}`}
            title={item.label}
          >
            <span className="text-lg">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Main area: Graph is ALWAYS rendered as the base layer on desktop */}
      <main className="flex-1 flex overflow-hidden relative">
        {/* Graph (always visible on desktop) */}
        <div className="flex-1 min-w-0">
          <GraphView />
        </div>

        {/* Right Panel — slides over graph (desktop) */}
        {!isMobile && isPanelOpen && (
          <>
            {/* Overlay click to close when non-node panel */}
            {activeView !== 'graph' && (
              <div className="absolute inset-0 bg-black/20 z-10" onClick={() => handleNavClick('graph')} />
            )}
            <div
              className="absolute right-0 top-0 bottom-0 z-20 shadow-2xl animate-slide-in-right"
              style={{ width: PANEL_WIDTH }}
            >
              <div className="h-full panel bg-base-900">
                {/* Close button for panel mode */}
                <div className="absolute top-3 right-3 z-10">
                  <button
                    onClick={() => handleNavClick('graph')}
                    className="w-7 h-7 rounded-lg bg-base-800 hover:bg-base-700 flex items-center justify-center text-base-300 hover:text-white transition-colors text-sm"
                  >
                    ✕
                  </button>
                </div>
                <div className="h-full">
                  {renderPanelContent()}
                </div>
              </div>
            </div>
          </>
        )}

        {/* Mobile: full screen view replacement */}
        {isMobile && activeView !== 'graph' && (
          <div className="absolute inset-0 z-20 bg-base-900">
            <div className="h-full flex flex-col">
              <div className="flex items-center justify-between px-3 py-2 border-b border-base-600 bg-base-800">
                <button onClick={() => setActiveView('graph')} className="text-xs text-accent font-medium">
                  ← Back to Graph
                </button>
                <span className="text-xs text-base-300 font-medium capitalize">{activeView}</span>
                <div className="w-12" />
              </div>
              <div className="flex-1 overflow-hidden">
                {renderPanelContent()}
              </div>
            </div>
          </div>
        )}

        {/* Mobile node panel overlay */}
        {isMobile && selectedNodeId && activeView === 'graph' && (
          <div className="absolute inset-0 bg-black/60 z-20" onClick={() => setSelectedNode(null)}>
            <div className="absolute right-0 top-0 bottom-0 w-[85vw] max-w-sm panel" onClick={e => e.stopPropagation()}>
              <NodePanel onClose={() => setSelectedNode(null)} />
            </div>
          </div>
        )}
      </main>

      {/* Mobile bottom nav */}
      {isMobile && (
        <nav className="fixed bottom-0 left-0 right-0 h-14 bg-base-800 border-t border-base-600 flex items-center justify-around z-30">
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              className={`flex flex-col items-center gap-0.5 px-3 py-1 text-[10px] font-medium transition-colors ${activeView === item.id ? 'text-accent' : 'text-base-300'}`}
            >
              <span className="text-lg">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      )}
    </div>
  )
}
