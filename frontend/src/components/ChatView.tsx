import React, { useState, useRef, useEffect } from 'react'
import { useStore } from '../store'
import { api } from '../api'
import { motion, AnimatePresence } from 'framer-motion'

export default function ChatView() {
  const {
    messages, addMessage, updateLastMessage, isStreaming, setIsStreaming,
    chatFilter, setChatFilter, gaps,
  } = useStore()
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isStreaming])

  const sendMessage = async () => {
    const text = input.trim()
    if (!text || isStreaming) return

    const userMsg = { id: Date.now().toString(), role: 'user' as const, content: text, timestamp: Date.now() }
    addMessage(userMsg)
    setInput('')
    setIsStreaming(true)

    const assistantId = (Date.now() + 1).toString()
    addMessage({ id: assistantId, role: 'assistant', content: '', timestamp: Date.now() })

    try {
      const result = await api.query(text, 'placement_mastery')
      // Progressive reveal for natural feel
      const fullText = result.answer || 'No response.'
      let idx = 0
      const words = fullText.split(' ')
      const revealNext = () => {
        idx++
        if (idx <= words.length) {
          updateLastMessage(words.slice(0, idx).join(' '))
          if (idx < words.length) {
            setTimeout(revealNext, 15 + Math.random() * 20)
          } else {
            setIsStreaming(false)
          }
        }
      }
      updateLastMessage('')
      setTimeout(revealNext, 100)
    } catch (err: any) {
      updateLastMessage(`Error: ${err.message}`)
      setIsStreaming(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  const suggestedQs = gaps.slice(0, 3).map(g =>
    `Why is "${g.topic.name}" important for ${g.prerequisite_for[0] || 'other topics'}?`
  )

  return (
    <div className="h-full flex flex-col bg-base-900">
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-base-600">
        <h2 className="text-sm font-semibold text-white">Chat</h2>
        <div className="flex items-center gap-1">
          {(['all', 'textbooks', 'personal'] as const).map(f => (
            <button key={f} onClick={() => setChatFilter(f)}
              className={`chip cursor-pointer text-[10px] ${chatFilter === f ? 'bg-accent/20 text-accent' : ''}`}>
              {f === 'all' ? 'All' : f === 'textbooks' ? '📖 Textbooks' : '📄 My uploads'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <div className="text-2xl mb-3 opacity-30">◆</div>
            <p className="text-sm text-base-300 mb-4">Ask about any topic in your syllabus</p>
            <div className="space-y-2 max-w-sm mx-auto">
              {suggestedQs.map((q, i) => (
                <button key={i} onClick={() => { setInput(q); inputRef.current?.focus() }}
                  className="block w-full text-left text-xs text-base-300 hover:text-white bg-base-800 hover:bg-base-700 rounded-lg px-3 py-2 transition-colors">
                  💡 {q}
                </button>
              ))}
            </div>
          </div>
        )}

        <AnimatePresence>
          {messages.map(msg => (
            <motion.div key={msg.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] ${msg.role === 'user' ? 'order-1' : ''}`}>
                {msg.role === 'assistant' && (
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-5 h-5 rounded-full bg-accent/20 flex items-center justify-center text-[10px] text-accent">AI</span>
                    <span className="text-[10px] text-base-300">Assistant</span>
                  </div>
                )}
                <div className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${msg.role === 'user' ? 'bg-accent text-white rounded-br-md' : 'bg-base-800 border border-base-600 rounded-bl-md'}`}>
                  {msg.content || (isStreaming ? '...' : '')}
                </div>
                {msg.citations && msg.citations.length > 0 && (
                  <details className="mt-1 group">
                    <summary className="text-[10px] text-amber cursor-pointer hover:text-amber-light">Sources ({msg.citations.length})</summary>
                    <div className="mt-1 space-y-1">
                      {msg.citations.map((c, i) => (
                        <div key={i} className="text-[10px] text-base-300 bg-base-800 rounded px-2 py-1">
                          <span className="text-accent">[{i + 1}]</span> {c.source}{c.section ? ` — ${c.section}` : ''}
                        </div>
                      ))}
                    </div>
                  </details>
                )}
                {msg.meta?.model && (
                  <div className="text-[9px] text-base-400 mt-1 flex items-center gap-2">
                    <span>via {msg.meta.model}</span>
                    {msg.meta.confidence !== undefined && (
                      <span className={msg.meta.confidence > 0.5 ? 'text-green-500' : 'text-amber'}>
                        {(msg.meta.confidence * 100).toFixed(0)}% confidence
                      </span>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {isStreaming && (
          <div className="flex items-center gap-2 text-xs text-base-300 px-4 py-2">
            <span className="animate-pulse">●</span>
            <span className="animate-pulse" style={{ animationDelay: '0.2s' }}>●</span>
            <span className="animate-pulse" style={{ animationDelay: '0.4s' }}>●</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="flex-shrink-0 border-t border-base-600 px-4 py-3">
        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
              placeholder="Ask about any topic..." rows={1}
              className="input-base resize-none pr-10 py-2.5 text-sm" style={{ minHeight: 42, maxHeight: 120 }} />
          </div>
          <button onClick={sendMessage} disabled={!input.trim() || isStreaming} className="btn-primary px-4 py-2.5 text-sm">
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
