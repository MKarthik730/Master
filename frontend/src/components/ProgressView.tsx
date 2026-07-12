import React, { useMemo } from 'react'
import { useStore } from '../store'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '../api'

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

const STATUS_ICONS = { covered: '✓', in_progress: '◐', available: '○', locked: '🔒' }
const STATUS_COLORS = { covered: '#22C55E', in_progress: '#F5A623', available: '#6C7A96', locked: '#3B4252' }

export default function ProgressView() {
  const { progressTree, setProgressTree } = useStore()
  const [filter, setFilter] = React.useState<'all' | 'gaps' | 'in_progress' | 'mastered'>('all')
  const [expandedModule, setExpandedModule] = React.useState<string | null>(null)

  const stats = progressTree ? {
    total: progressTree.total_topics,
    covered: progressTree.covered,
    inProgress: progressTree.in_progress,
    locked: progressTree.locked,
    available: progressTree.available,
    percent: progressTree.total_topics > 0
      ? Math.round((progressTree.covered / progressTree.total_topics) * 100)
      : 0,
  } : null

  const filteredModules = useMemo(() => {
    if (!progressTree) return []
    return progressTree.modules.map(mod => ({
      ...mod,
      topics: mod.topics.filter(t => {
        if (filter === 'gaps') return t.status === 'locked'
        if (filter === 'in_progress') return t.status === 'in_progress'
        if (filter === 'mastered') return t.status === 'covered'
        return true
      }),
    })).filter(mod => mod.topics.length > 0)
  }, [progressTree, filter])

  const handleSubtopicToggle = async (topicId: number, subtopicId: number, currentStatus: string) => {
    const newStatus = currentStatus === 'covered' ? 'in_progress' : 'covered'
    try {
      const result = await api.updateSubtopic('placement_mastery', subtopicId, newStatus)
      useStore.getState().updateSubtopic(topicId, subtopicId, newStatus)
    } catch {}
  }

  if (!progressTree) {
    return <div className="h-full flex items-center justify-center text-base-300 text-sm animate-pulse">Loading progress...</div>
  }

  return (
    <div className="h-full flex flex-col bg-base-900">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-base-600">
        <h2 className="text-sm font-semibold text-white mb-3">Progress Tracker</h2>

        {/* Mastery overview */}
        <div className="flex items-center gap-4 mb-3">
          <div className="relative w-16 h-16">
            <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
              <circle cx="32" cy="32" r="28" fill="none" stroke="#242830" strokeWidth="4" />
              <circle
                cx="32" cy="32" r="28"
                fill="none" stroke="#6C63FF"
                strokeWidth="4"
                strokeDasharray={`${stats!.percent * 1.76} 176`}
                strokeLinecap="round"
                className="progress-ring"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-white">
              {stats!.percent}%
            </span>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <div><span className="text-green-500">{stats!.covered}</span> mastered</div>
            <div><span className="text-amber">{stats!.inProgress}</span> in progress</div>
            <div><span className="text-red-400">{stats!.locked}</span> locked</div>
            <div><span className="text-base-300">{stats!.available}</span> available</div>
          </div>
        </div>

        {/* Filter buttons */}
        <div className="flex items-center gap-1.5">
          {(['all', 'gaps', 'in_progress', 'mastered'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`chip cursor-pointer text-[10px] ${filter === f ? 'bg-accent/20 text-accent border-accent/30' : ''}`}
            >
              {f === 'all' ? 'All' : f === 'gaps' ? '🔒 Gaps' : f === 'in_progress' ? '🔄 In progress' : '✓ Mastered'}
            </button>
          ))}
        </div>
      </div>

      {/* Module list */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        <AnimatePresence>
          {filteredModules.map(mod => {
            const modColor = MODULE_COLORS[mod.name] || '#6C63FF'
            const modCovered = mod.topics.filter(t => t.status === 'covered').length
            const modPercent = mod.topics.length > 0 ? Math.round((modCovered / mod.topics.length) * 100) : 0
            const isExpanded = expandedModule === mod.name

            return (
              <motion.div
                key={mod.name}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="card !p-0 overflow-hidden"
              >
                <button
                  onClick={() => setExpandedModule(isExpanded ? null : mod.name)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-base-700/50 transition-colors"
                >
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: modColor }} />
                  <div className="flex-1 text-left">
                    <div className="text-xs font-medium text-white">{mod.name}</div>
                    <div className="text-[10px] text-base-300">{modCovered}/{mod.topics.length} topics</div>
                  </div>
                  <div className="w-20 h-1.5 bg-base-600 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${modPercent}%`, background: modColor }} />
                  </div>
                  <span className="text-xs text-base-300">{modPercent}%</span>
                  <span className={`text-xs text-base-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>▼</span>
                </button>

                {isExpanded && (
                  <div className="border-t border-base-600 divide-y divide-base-600/50">
                    {mod.topics.map(t => (
                      <div key={t.id} className="px-4 py-2.5 pl-11">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm">{STATUS_ICONS[t.status]}</span>
                          <span className="text-xs font-medium text-white">{t.title}</span>
                          <span className="ml-auto text-[10px] text-base-400" style={{ color: STATUS_COLORS[t.status] }}>
                            {t.status.replace('_', ' ')}
                          </span>
                        </div>
                        {t.prerequisite_titles.length > 0 && (
                          <div className="text-[10px] text-base-400 ml-6 mb-1">
                            Requires: {t.prerequisite_titles.join(', ')}
                          </div>
                        )}
                        {t.subtopics.length > 0 && (
                          <div className="ml-6 space-y-0.5 mt-1">
                            {t.subtopics.map(st => (
                              <button
                                key={st.id}
                                onClick={() => handleSubtopicToggle(t.id, st.id, st.status)}
                                disabled={t.status === 'locked'}
                                className={`flex items-center gap-1.5 text-[11px] w-full text-left py-0.5 px-1 rounded
                                  ${st.status === 'covered' ? 'text-green-400' : st.status === 'in_progress' ? 'text-amber' : 'text-base-400'}
                                  ${t.status !== 'locked' ? 'hover:bg-base-700 cursor-pointer' : 'cursor-not-allowed'}`}
                              >
                                <span className="w-3.5 h-3.5 rounded-full border border-current flex items-center justify-center text-[7px]">
                                  {st.status === 'covered' ? '✓' : st.status === 'in_progress' ? '◐' : ''}
                                </span>
                                {st.title}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </div>
  )
}
