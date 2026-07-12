import React, { useState, useMemo, useCallback } from 'react'
import { useStore } from '../store'
import { motion, AnimatePresence } from 'framer-motion'
import type { StudyBlock } from '../types'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const HOURS = Array.from({ length: 14 }, (_, i) => i + 7)

const MODULE_COLORS: Record<string, string> = {
  'Math & CS Foundations': '#6C63FF', 'Programming Languages': '#F5A623',
  'Developer Tools & Infrastructure': '#22C55E', 'Core CS Systems': '#EC4899',
  'Data Structures & Algorithms': '#14B8A6', 'Backend & Scalable Systems': '#F97316',
  'System Design': '#8B5CF6', 'AI, LLMs & Agents': '#06B6D4', 'Interview & Career Prep': '#84CC16',
}

export default function SchedulerView() {
  const { studyBlocks, addBlock, updateBlock, progressTree, gaps } = useStore()
  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date(); const day = d.getDay()
    return new Date(d.setDate(d.getDate() - day + (day === 0 ? -6 : 1)))
  })
  const [showBlockPicker, setShowBlockPicker] = useState(false)
  const [newBlockDay, setNewBlockDay] = useState(0)
  const [newBlockHour, setNewBlockHour] = useState(9)
  const [dragOverDay, setDragOverDay] = useState<number | null>(null)
  const [dragOverHour, setDragOverHour] = useState<number | null>(null)

  const allTopics = useMemo(() => progressTree?.modules.flatMap(m => m.topics) ?? [], [progressTree])
  const gapTopics = useMemo(() => allTopics.filter(t => t.status === 'locked'), [allTopics])
  const suggestedBlocks = useMemo(() => gapTopics.sort((a, b) => b.prerequisites.length - a.prerequisites.length).slice(0, 5), [gapTopics])

  const handleCellClick = (day: number, hour: number) => {
    setNewBlockDay(day); setNewBlockHour(hour); setShowBlockPicker(true)
  }

  const createBlock = (topicId?: string, topicTitle?: string, day?: number, hour?: number) => {
    addBlock({
      id: Date.now().toString(),
      day: day ?? newBlockDay,
      hour: hour ?? newBlockHour,
      duration: 1,
      topicId,
      topicTitle,
      status: 'upcoming',
    })
    setShowBlockPicker(false)
  }

  // Drag from suggested blocks
  const onDragStart = (e: React.DragEvent, topicId: string, topicTitle: string) => {
    e.dataTransfer.setData('text/plain', JSON.stringify({ topicId, topicTitle }))
    e.dataTransfer.effectAllowed = 'copy'
  }

  // Drop on grid
  const onGridDragOver = (e: React.DragEvent, day: number, hour: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    setDragOverDay(day)
    setDragOverHour(hour)
  }

  const onGridDrop = (e: React.DragEvent, day: number, hour: number) => {
    e.preventDefault()
    setDragOverDay(null)
    setDragOverHour(null)
    try {
      const data = JSON.parse(e.dataTransfer.getData('text/plain'))
      createBlock(data.topicId, data.topicTitle, day, hour)
    } catch { /* ignore */ }
  }

  const toggleBlockStatus = (block: StudyBlock) => {
    const next = block.status === 'upcoming' ? 'done' as const : block.status === 'done' ? 'missed' as const : 'upcoming' as const
    updateBlock(block.id, { status: next })
  }

  return (
    <div className="h-full flex flex-col bg-base-900">
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-base-600">
        <h2 className="text-sm font-semibold text-white">Study Schedule</h2>
        <div className="flex items-center gap-2">
          <button onClick={() => setWeekStart(new Date(weekStart.getTime() - 7 * 86400000))} className="btn-ghost text-xs px-2">←</button>
          <span className="text-xs text-base-200 font-medium">{weekStart.toLocaleDateString('en', { month: 'short', day: 'numeric' })}</span>
          <button onClick={() => setWeekStart(new Date(weekStart.getTime() + 7 * 86400000))} className="btn-ghost text-xs px-2">→</button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Grid */}
        <div className="flex-1 overflow-auto">
          <div className="flex min-w-[600px]">
            <div className="w-10 flex-shrink-0">
              <div className="h-8" />
              {HOURS.map(h => (
                <div key={h} className="h-12 flex items-center justify-end pr-2 text-[10px] text-base-400">
                  {h > 12 ? `${h - 12}p` : `${h}a`}
                </div>
              ))}
            </div>
            {DAYS.map((day, di) => (
              <div key={day} className="flex-1 border-l border-base-600/50">
                <div className="h-8 flex items-center justify-center text-[10px] font-medium text-base-300 border-b border-base-600/50">
                  {day}
                </div>
                {HOURS.map(h => {
                  const blocksHere = studyBlocks.filter(b => b.day === di && b.hour === h)
                  const isDragOver = dragOverDay === di && dragOverHour === h
                  return (
                    <div key={h}
                      onClick={() => handleCellClick(di, h)}
                      onDragOver={e => onGridDragOver(e, di, h)}
                      onDragLeave={() => { setDragOverDay(null); setDragOverHour(null) }}
                      onDrop={e => onGridDrop(e, di, h)}
                      className={`h-12 border-b border-base-600/20 relative cursor-pointer transition-colors group ${isDragOver ? 'bg-accent/10 border-accent/30' : 'hover:bg-base-800/50'}`}>
                      {blocksHere.map(block => {
                        const topic = allTopics.find(t => t.topic_id === block.topicId)
                        const modColor = topic ? MODULE_COLORS[topic.module] || '#6C63FF' : '#6C63FF'
                        return (
                          <div key={block.id} onClick={e => { e.stopPropagation(); toggleBlockStatus(block) }}
                            className={`absolute inset-0.5 rounded-md flex items-center px-2 cursor-pointer text-[9px] font-medium
                              ${block.status === 'done' ? 'opacity-40 line-through' : block.status === 'missed' ? 'opacity-30' : ''}`}
                            style={{ background: `${modColor}25`, border: `1px solid ${modColor}40`, color: modColor }}
                            title={block.topicTitle || 'Study block'}>
                            {block.topicTitle?.slice(0, 15) || 'Study'}
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Sidebar */}
        <div className="w-56 flex-shrink-0 border-l border-base-600 p-3 overflow-y-auto">
          <h3 className="text-[10px] font-medium text-base-300 uppercase tracking-wider mb-3">Suggested from gaps</h3>
          <div className="space-y-2">
            {suggestedBlocks.map(t => {
              const dependents = allTopics.filter(at => at.prerequisites.includes(t.topic_id))
              return (
                <motion.div key={t.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  className="card !p-2.5 cursor-grab active:cursor-grabbing hover:border-amber/30 transition-colors"
                  draggable onDragStart={e => onDragStart(e, t.topic_id, t.title)}>
                  <div className="text-[11px] font-medium text-white mb-0.5">{t.title}</div>
                  <div className="text-[9px] text-base-400">
                    {dependents.length} dependents · {t.subtopics.filter(s => s.status === 'covered').length}/{t.subtopics.length} done
                  </div>
                  <button onClick={() => createBlock(t.topic_id, t.title, 0, 9)}
                    className="text-[9px] text-accent mt-1 hover:text-accent-light">+ Add to schedule</button>
                </motion.div>
              )
            })}
            {suggestedBlocks.length === 0 && <p className="text-[11px] text-base-400">No gaps found!</p>}
          </div>
          <div className="mt-4 pt-3 border-t border-base-600 space-y-1">
            <div className="flex items-center gap-2 text-[10px] text-base-300"><span className="w-2 h-2 rounded-full bg-green-500/50" /> Done</div>
            <div className="flex items-center gap-2 text-[10px] text-base-300"><span className="w-2 h-2 rounded-full bg-amber/50" /> Upcoming</div>
            <div className="flex items-center gap-2 text-[10px] text-base-300"><span className="w-2 h-2 rounded-full bg-red-500/30" /> Missed</div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showBlockPicker && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowBlockPicker(false)}>
            <div className="bg-base-800 border border-base-600 rounded-xl p-4 w-80" onClick={e => e.stopPropagation()}>
              <h3 className="text-sm font-semibold text-white mb-3">
                New Block: {DAYS[newBlockDay]} {newBlockHour > 12 ? `${newBlockHour - 12}p` : `${newBlockHour}a`}
              </h3>
              <div className="space-y-2 max-h-48 overflow-y-auto mb-3">
                <button onClick={() => createBlock()} className="w-full text-left text-xs text-base-300 px-3 py-2 rounded-lg hover:bg-base-700">
                  📝 General study session
                </button>
                {allTopics.map(t => (
                  <button key={t.id} onClick={() => createBlock(t.topic_id, t.title)}
                    className="w-full text-left text-xs text-base-300 px-3 py-2 rounded-lg hover:bg-base-700">{t.title}</button>
                ))}
              </div>
              <button onClick={() => setShowBlockPicker(false)} className="btn-ghost text-xs w-full">Cancel</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
