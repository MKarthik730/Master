import React, { useMemo } from 'react'
import { useStore } from '../store'
import { api } from '../api'

export default function NodePanel({ onClose }: { onClose: () => void }) {
  const { selectedNodeId, progressTree, setSelectedNode, updateSubtopic } = useStore()

  const topic = useMemo(() => {
    if (!selectedNodeId || !progressTree) return null
    const allTopics = progressTree.modules.flatMap(m => m.topics)
    return allTopics.find(t => String(t.id) === selectedNodeId) ?? null
  }, [selectedNodeId, progressTree])

  const dependencyChain = useMemo(() => {
    if (!topic || !progressTree) return []
    const allTopics = progressTree.modules.flatMap(m => m.topics)
    return topic.prerequisites
      .map(pId => allTopics.find(t => t.topic_id === pId))
      .filter(Boolean)
  }, [topic, progressTree])

  const dependents = useMemo(() => {
    if (!topic || !progressTree) return []
    const allTopics = progressTree.modules.flatMap(m => m.topics)
    return allTopics.filter(t => t.prerequisites.includes(topic.topic_id))
  }, [topic, progressTree])

  const handleSubtopicToggle = async (subtopicId: number, currentStatus: string) => {
    if (!topic) return
    const newStatus = currentStatus === 'covered' ? 'in_progress' : 'covered'
    try {
      await api.updateSubtopic('placement_mastery', subtopicId, newStatus)
      updateSubtopic(topic.id, subtopicId, newStatus)
    } catch {}
  }

  if (!topic) {
    return (
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-white">Topic Details</h3>
          <button onClick={onClose} className="text-base-300 hover:text-white text-lg">×</button>
        </div>
        <p className="text-xs text-base-400">Select a topic to see details</p>
      </div>
    )
  }

  const statusColors = { covered: '#22C55E', in_progress: '#F5A623', available: '#6C7A96', locked: '#3B4252' }
  const statusLabels = { covered: 'Mastered', in_progress: 'In Progress', available: 'Available', locked: 'Locked' }
  const progress = topic.subtopics.length > 0
    ? Math.round((topic.subtopics.filter(s => s.status === 'covered').length / topic.subtopics.length) * 100)
    : topic.status === 'covered' ? 100 : 0

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-start justify-between p-4 border-b border-base-600">
        <div>
          <div className="text-[10px] text-base-400 mb-1">{topic.module}</div>
          <h3 className="text-sm font-semibold text-white">{topic.title}</h3>
          <div className="flex items-center gap-2 mt-1">
            <span
              className="chip text-[10px]"
              style={{ background: `${statusColors[topic.status]}20`, color: statusColors[topic.status], borderColor: `${statusColors[topic.status]}40` }}
            >
              {statusLabels[topic.status]}
            </span>
            {progress > 0 && <span className="text-[10px] text-base-300">{progress}% complete</span>}
          </div>
        </div>
        <button onClick={onClose} className="text-base-300 hover:text-white text-lg">×</button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Progress Ring */}
        <div className="flex justify-center">
          <div className="relative w-20 h-20">
            <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
              <circle cx="40" cy="40" r="34" fill="none" stroke="#242830" strokeWidth="4" />
              <circle
                cx="40" cy="40" r="34"
                fill="none"
                stroke={statusColors[topic.status]}
                strokeWidth="4"
                strokeDasharray={`${progress * 2.14} 214`}
                strokeLinecap="round"
                className="progress-ring"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-lg font-bold text-white">
              {progress}%
            </span>
          </div>
        </div>

        {/* Prerequisites */}
        {dependencyChain.length > 0 && (
          <div>
            <h4 className="text-[11px] font-medium text-base-300 uppercase tracking-wider mb-2">Prerequisites</h4>
            <div className="flex flex-wrap gap-1.5">
              {dependencyChain.map(pt => (
                <button
                  key={(pt as any).id}
                  onClick={() => setSelectedNode(String((pt as any).id))}
                  className="chip cursor-pointer hover:border-accent/50 hover:text-accent text-[10px]"
                >
                  {(pt as any).title}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Dependents */}
        {dependents.length > 0 && (
          <div>
            <h4 className="text-[11px] font-medium text-base-300 uppercase tracking-wider mb-2">Leads to</h4>
            <div className="flex flex-wrap gap-1.5">
              {dependents.map(d => (
                <button
                  key={d.id}
                  onClick={() => setSelectedNode(String(d.id))}
                  className="chip cursor-pointer hover:border-accent/50 hover:text-accent text-[10px]"
                >
                  {d.title}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Subtopics */}
        {topic.subtopics.length > 0 && (
          <div>
            <h4 className="text-[11px] font-medium text-base-300 uppercase tracking-wider mb-2">
              Subtopics ({topic.subtopics.filter(s => s.status === 'covered').length}/{topic.subtopics.length})
            </h4>
            <div className="space-y-1">
              {topic.subtopics.map(st => (
                <button
                  key={st.id}
                  onClick={() => handleSubtopicToggle(st.id, st.status)}
                  disabled={topic.status === 'locked'}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-left transition-colors
                    ${st.status === 'covered' ? 'text-green-400 bg-green-500/5' : 'text-base-300'}
                    ${topic.status !== 'locked' ? 'hover:bg-base-700 cursor-pointer' : 'cursor-not-allowed opacity-50'}`}
                >
                  <span className={`w-4 h-4 rounded-full border flex items-center justify-center text-[8px] flex-shrink-0
                    ${st.status === 'covered' ? 'bg-green-500 border-green-500 text-white' : 'border-base-400'}`}>
                    {st.status === 'covered' ? '✓' : ''}
                  </span>
                  {st.title}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Ask button */}
        <button
          onClick={() => {
            useStore.getState().setActiveView('chat')
            useStore.getState().addMessage({
              id: Date.now().toString(),
              role: 'user',
              content: `Tell me about ${topic.title}`,
              timestamp: Date.now(),
            })
          }}
          className="btn-primary w-full text-xs"
        >
          Ask about {topic.title}
        </button>
      </div>
    </div>
  )
}
