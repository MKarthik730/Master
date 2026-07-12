import React, { useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { useStore } from '../store'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '../api'

const STATUS_LABELS: Record<string, string> = {
  queued: 'Queued', chunking: 'Chunking...', embedding: 'Embedding...', ready: 'Ready', error: 'Error',
}

export default function UploadView() {
  const { uploads, addUpload, updateUpload } = useStore()
  const [category, setCategory] = useState<'textbook' | 'personal'>('textbook')
  const [expandedDoc, setExpandedDoc] = useState<string | null>(null)

  const onDrop = async (accepted: File[]) => {
    for (const file of accepted) await handleFile(file)
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    multiple: true,
  })

  const handleFile = async (file: File) => {
    const uploadId = Date.now().toString()
    addUpload({ id: uploadId, title: file.name, category, status: 'queued', progress: 0 })
    updateUpload(uploadId, { status: 'chunking', progress: 30 })
    await new Promise(r => setTimeout(r, 800))
    updateUpload(uploadId, { status: 'embedding', progress: 60 })
    await new Promise(r => setTimeout(r, 600))
    try {
      await api.ingest(file, 'placement_mastery', category)
      updateUpload(uploadId, { status: 'ready', progress: 100, topics: ['related_topic_1', 'related_topic_2'] })
    } catch {
      updateUpload(uploadId, { status: 'error', progress: 0 })
    }
  }

  return (
    <div className="h-full flex flex-col bg-base-900 p-4">
      <h2 className="text-sm font-semibold text-white mb-4">Upload Documents</h2>

      {/* Category toggle */}
      <div className="flex gap-2 mb-3">
        {(['textbook', 'personal'] as const).map(c => (
          <button key={c} onClick={() => setCategory(c)}
            className={`flex-1 py-2.5 rounded-xl text-xs font-medium transition-all ${
              category === c ? 'bg-accent/20 text-accent border border-accent/30' : 'bg-base-800 text-base-300 border border-base-600'
            }`}>
            {c === 'textbook' ? '📖 Textbook' : '📄 Personal notes'}
          </button>
        ))}
      </div>

      {/* Dropzone using react-dropzone */}
      <div {...getRootProps()} className={`flex-1 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed cursor-pointer transition-all duration-200 mb-4 ${
        isDragActive ? 'border-accent bg-accent/5' : 'border-base-600 hover:border-base-400 bg-base-800/30'
      }`}>
        <input {...getInputProps()} />
        <div className="text-3xl mb-3 opacity-40">⊞</div>
        {isDragActive ? (
          <p className="text-sm text-accent font-medium">Drop files here...</p>
        ) : (
          <>
            <p className="text-sm text-base-300 font-medium">Drop PDF here or click to browse</p>
            <p className="text-[11px] text-base-400 mt-1">Accepts PDF files only</p>
          </>
        )}
      </div>

      {/* Upload list */}
      <div className="flex-shrink-0 max-h-[300px] overflow-y-auto space-y-2">
        <AnimatePresence>
          {uploads.map(u => (
            <motion.div key={u.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }}>
              <div className="card !p-3 cursor-pointer" onClick={() => setExpandedDoc(expandedDoc === u.id ? null : u.id)}>
                <div className="flex items-center gap-3">
                  <span className="text-lg opacity-40">{u.category === 'textbook' ? '📖' : '📄'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-white truncate">{u.title}</div>
                    <div className="text-[10px] text-base-400">{STATUS_LABELS[u.status]}</div>
                  </div>
                  {u.status === 'ready' && <span className="text-green-500 text-xs">✓</span>}
                  {u.status === 'error' && <span className="text-red-400 text-xs">✗</span>}
                  {(u.status !== 'ready' && u.status !== 'error') && (
                    <div className="w-5 h-5 rounded-full border-2 border-accent border-t-transparent animate-spin" />
                  )}
                </div>
                {'ready error'.includes(u.status) && (
                  <div className="mt-2 w-full h-1 bg-base-600 rounded-full overflow-hidden">
                    <div className="h-full bg-accent rounded-full transition-all duration-500" style={{ width: `${u.progress}%` }} />
                  </div>
                )}
                {u.status === 'ready' && expandedDoc === u.id && u.topics && (
                  <div className="mt-2 pt-2 border-t border-base-600">
                    <div className="text-[10px] text-base-400 mb-1">Linked topics:</div>
                    <div className="flex flex-wrap gap-1">
                      {u.topics.map(t => <span key={t} className="chip text-[9px]">{t}</span>)}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}
