import React, { useEffect, useRef, useMemo, useCallback, useState } from 'react'
import { useStore } from '../store'
import ForceGraph2D from 'react-force-graph-2d'

const MODULE_COLORS: Record<string, string> = {
  'Math & CS Foundations': '#6C63FF',
  'Programming Languages': '#F5A623',
  'Developer Tools & Infrastructure': '#22C55E',
  'Core CS Systems': '#EC4899',
  'Data Structures & Algorithms': '#14B8A6',
  'Backend & Scalable Systems': '#F97316',
  'System Design': '#8B5CF6',
  'AI, LLMs & Agents': '#06B6D4',
  'Interview & Career Prep': '#84CC16',
}
const DEFAULT_COLOR = '#6C63FF'

export default function GraphView() {
  const fgRef = useRef<any>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 })
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null)

  const {
    graphData, progressTree, gaps, setSelectedNode, selectedNodeId,
    focusGapsOnly, setFocusGapsOnly, searchQuery, setSearchQuery,
    visibleModules, setVisibleModules, isMobile, openSidePanel,
  } = useStore()

  useEffect(() => {
    const update = () => {
      if (containerRef.current) setDimensions({
        width: containerRef.current.clientWidth,
        height: containerRef.current.clientHeight,
      })
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])    // Build status map, subtopicCount map, and gap IDs
  const { statusMap, subtopicCountMap, gapTopicIds } = useMemo(() => {
    const stMap: Record<string, number> = {}
    const gapIds = new Set<string>()
    const statusMap: Record<string, string> = {}
    const tree = progressTree
    if (!tree) return { statusMap, subtopicCountMap: stMap, gapTopicIds: gapIds }

    const allTopics = tree.modules.flatMap(m => m.topics)
    allTopics.forEach(t => {
      stMap[String(t.id)] = t.subtopics.length
      statusMap[String(t.id)] = t.status
    })
    allTopics.forEach(t => {
      if (t.status === 'locked') {
        t.prerequisites.forEach(p => {
          const prereq = allTopics.find(pt => pt.topic_id === p)
          if (prereq && prereq.status !== 'covered') gapIds.add(String(prereq.id))
        })
      }
    })
    return { statusMap, subtopicCountMap: stMap, gapTopicIds: gapIds }
  }, [progressTree, gaps])

  // Filter
  const { filteredNodes, filteredEdges } = useMemo(() => {
    let nodes = graphData?.nodes ?? []
    let edges = graphData?.edges ?? []
    if (focusGapsOnly) {
      const chainIds = new Set(gapTopicIds)
      edges.forEach(e => { if (gapTopicIds.has(e.to)) chainIds.add(e.from_node) })
      nodes = nodes.filter(n => chainIds.has(n.id))
      edges = edges.filter(e => chainIds.has(e.from_node) && chainIds.has(e.to))
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      const matched = new Set(nodes.filter(n => n.name.toLowerCase().includes(q)).map(n => n.id))
      nodes = nodes.filter(n => matched.has(n.id))
      edges = edges.filter(e => matched.has(e.from_node) && matched.has(e.to))
    }
    if (visibleModules.length > 0) {
      const modSet = new Set(visibleModules)
      const modIds = new Set(nodes.filter(n => modSet.has(n.module)).map(n => n.id))
      nodes = nodes.filter(n => modIds.has(n.id))
      edges = edges.filter(e => modIds.has(e.from_node) && modIds.has(e.to))
    }
    return { filteredNodes: nodes, filteredEdges: edges }
  }, [graphData, focusGapsOnly, searchQuery, visibleModules, gapTopicIds])

  const moduleNames = useMemo(() => [...new Set(graphData?.nodes.map(n => n.module) ?? [])], [graphData])

  const paintFn = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const isDimmed = focusGapsOnly || searchQuery || (visibleModules.length > 0 && !visibleModules.includes(node.module))
    const isSelected = selectedNodeId === node.id
    const isGap = gapTopicIds.has(node.id)
    const topicStatus = statusMap[node.id] || 'available'
    const moduleColor = MODULE_COLORS[node.module] || DEFAULT_COLOR

    // Size by subtopic count
    const subCount = subtopicCountMap[node.id] || 0
    const size = Math.max(4, Math.min(14, 5 + subCount * 1.2))

    // Visual state based on topic status (spec: not-started / in-progress / mastered / gap)
    let bg: string, border: string
    if (isSelected) {
      bg = '#6C63FF'; border = '#8B85FF'
    } else if (isGap) {
      bg = '#1A1E26'; border = '#F5A623'  // amber border for gap
    } else if (topicStatus === 'covered') {
      bg = moduleColor; border = moduleColor  // filled = mastered
    } else if (topicStatus === 'in_progress') {
      bg = '#1A1E26'; border = moduleColor  // accent stroke, dim fill = in progress
    } else if (topicStatus === 'locked') {
      bg = '#14171C'; border = '#3B4252'  // dim = locked
    } else {
      bg = '#14171C'; border = '#3B4252'  // dim outline, no fill = available/not started
    }

    if (isDimmed && !isGap) { bg = '#14171C'; border = '#242830' }

    // Gap glow
    if (isGap && !focusGapsOnly) {
      ctx.beginPath()
      ctx.arc(node.x!, node.y!, size + 8, 0, 2 * Math.PI)
      ctx.fillStyle = 'rgba(245, 166, 35, 0.12)'
      ctx.fill()
    }

    // Mastered glow
    if (topicStatus === 'covered' && !isDimmed) {
      ctx.beginPath()
      ctx.arc(node.x!, node.y!, size + 4, 0, 2 * Math.PI)
      ctx.fillStyle = `${moduleColor}15`
      ctx.fill()
    }

    // Main circle
    ctx.beginPath()
    ctx.arc(node.x!, node.y!, size, 0, 2 * Math.PI)
    ctx.fillStyle = bg
    ctx.fill()
    ctx.strokeStyle = border
    ctx.lineWidth = isSelected ? 3 : (topicStatus === 'in_progress' ? 2.5 : 1.5)
    ctx.stroke()

    // Label
    if (globalScale > 0.5) {
      ctx.font = `${isSelected ? 'bold ' : ''}9px Inter, sans-serif`
      ctx.fillStyle = (topicStatus === 'covered' && !isDimmed) ? '#D8DEE9' : isDimmed ? '#4C566A' : '#8F9BB3'
      ctx.textAlign = 'center'
      ctx.fillText(node.name, node.x!, node.y! + size + 14)
    }
  }, [focusGapsOnly, searchQuery, visibleModules, selectedNodeId, gapTopicIds, subtopicCountMap, statusMap])

  const handleNodeHover = useCallback((node: any | null) => {
    if (!node) { setTooltip(null); return }
    const allTopics = progressTree?.modules.flatMap(m => m.topics) ?? []
    const topic = allTopics.find(t => String(t.id) === node.id)
    const mastery = topic ? `${topic.subtopics.filter(s => s.status === 'covered').length}/${topic.subtopics.length}` : '-'
    const prereqCount = graphData?.edges.filter(e => e.from_node === node.id).length ?? 0
    setTooltip({
      x: node.x! + 12,
      y: node.y! - 12,
      text: `${node.name} · ${prereqCount} prerequisites · ${mastery} subtopics`,
    })
  }, [progressTree, graphData])

  return (
    <div className="h-full flex flex-col relative">
      {/* Toolbar */}
      <div className="flex-shrink-0 flex items-center gap-3 px-4 py-2.5 border-b border-base-600 bg-base-800/50 z-10">
        <div className="flex-1 relative">
          <input id="graph-search" type="text" placeholder="Search topics... (press /)" value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)} className="input-base pl-9 py-2 text-sm" />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base-300 text-sm">⌕</span>
        </div>
        <button onClick={() => setFocusGapsOnly(!focusGapsOnly)}
          className={`chip cursor-pointer transition-colors ${focusGapsOnly ? 'bg-amber/20 text-amber border-amber/30' : ''}`}>
          {focusGapsOnly ? '●' : '○'} Focus gaps
        </button>
        <button onClick={() => fgRef.current?.zoomToFit(400)} className="btn-ghost text-xs">⊞ Fit</button>
      </div>

      {/* Module filters */}
      <div className="flex-shrink-0 flex items-center gap-1.5 px-4 py-1.5 border-b border-base-600/50 overflow-x-auto scrollbar-hide z-10">
        {moduleNames.map(mod => (
          <button key={mod} onClick={() => {
            const next = visibleModules.includes(mod) ? visibleModules.filter(m => m !== mod) : [...visibleModules, mod]
            setVisibleModules(next.length === 0 ? moduleNames : next)
          }} className={`chip cursor-pointer text-[10px] ${visibleModules.includes(mod) ? 'opacity-100' : 'opacity-40'}`}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: MODULE_COLORS[mod] || DEFAULT_COLOR }} />
            {mod}
          </button>
        ))}
      </div>

      {/* Graph */}
      <div ref={containerRef} className="flex-1 relative">
        {tooltip && (
          <div className="absolute pointer-events-none z-50 px-3 py-1.5 bg-base-800 border border-base-500 rounded-lg text-[10px] text-white shadow-xl whitespace-nowrap"
            style={{ left: tooltip.x, top: tooltip.y, transform: 'translateY(-100%)' }}>
            {tooltip.text}
          </div>
        )}
        <ForceGraph2D
          ref={fgRef}
          width={dimensions.width} height={dimensions.height}
          graphData={{ nodes: filteredNodes, links: filteredEdges.map(e => ({ source: e.from_node, target: e.to })) }}
          nodeCanvasObject={paintFn}
          linkColor={() => '#3B4252'} linkWidth={0.8}
          linkDirectionalArrowLength={4} linkDirectionalArrowRelPos={0.9}
          onNodeClick={(node: any) => setSelectedNode(node.id)}
          onBackgroundClick={() => { setSelectedNode(null); setTooltip(null) }}
          onNodeHover={handleNodeHover}
          d3AlphaDecay={0.02} d3VelocityDecay={0.3} cooldownTicks={100}
          onEngineStop={() => fgRef.current?.zoomToFit(400)}
          nodeRelSize={6}
          enableNodeDrag={true}
          enableZoomInteraction={true}
        />
      </div>
    </div>
  )
}
