import { create } from 'zustand'
import type { ProgressTree, GraphData, Topic, Module, Subtopic, Message, StudyBlock, UploadDoc, Gap } from './types'

interface AppState {
  // Domain
  domain: string
  setDomain: (d: string) => void

  // UI
  activeView: 'graph' | 'chat' | 'progress' | 'scheduler' | 'upload'
  setActiveView: (v: AppState['activeView']) => void
  sidePanelOpen: boolean
  sidePanelContent: 'node' | 'chat' | 'progress' | 'scheduler' | 'upload' | null
  openSidePanel: (content: AppState['sidePanelContent']) => void
  closeSidePanel: () => void
  selectedNodeId: string | null
  setSelectedNode: (id: string | null) => void
  isMobile: boolean
  setIsMobile: (v: boolean) => void
  focusGapsOnly: boolean
  setFocusGapsOnly: (v: boolean) => void
  searchQuery: string
  setSearchQuery: (v: string) => void
  visibleModules: string[]
  setVisibleModules: (v: string[]) => void

  // Data
  progressTree: ProgressTree | null
  setProgressTree: (t: ProgressTree) => void
  graphData: GraphData | null
  setGraphData: (g: GraphData) => void
  gaps: Gap[]
  setGaps: (g: Gap[]) => void

  // Chat
  messages: Message[]
  addMessage: (m: Message) => void
  updateLastMessage: (content: string) => void
  chatFilter: 'all' | 'textbooks' | 'personal'
  setChatFilter: (f: AppState['chatFilter']) => void
  isStreaming: boolean
  setIsStreaming: (v: boolean) => void

  // Scheduler
  studyBlocks: StudyBlock[]
  addBlock: (b: StudyBlock) => void
  updateBlock: (id: string, data: Partial<StudyBlock>) => void
  removeBlock: (id: string) => void

  // Upload
  uploads: UploadDoc[]
  addUpload: (u: UploadDoc) => void
  updateUpload: (id: string, data: Partial<UploadDoc>) => void

  // Topic progress
  updateSubtopic: (topicId: number, subtopicId: number, status: string) => void
}

export const useStore = create<AppState>((set, get) => ({
  // Domain
  domain: 'placement_mastery',
  setDomain: (domain) => set({ domain }),

  // UI
  activeView: 'graph',
  setActiveView: (activeView) => set({ activeView, sidePanelOpen: false, selectedNodeId: null }),
  sidePanelOpen: false,
  sidePanelContent: null,
  openSidePanel: (content) => set({ sidePanelOpen: true, sidePanelContent: content }),
  closeSidePanel: () => set({ sidePanelOpen: false, sidePanelContent: null, selectedNodeId: null }),
  selectedNodeId: null,
  setSelectedNode: (id) => set({ selectedNodeId: id, sidePanelOpen: !!id, sidePanelContent: id ? 'node' : null }),
  isMobile: window.innerWidth < 768,
  setIsMobile: (isMobile) => set({ isMobile }),
  focusGapsOnly: false,
  setFocusGapsOnly: (v) => set({ focusGapsOnly: v }),
  searchQuery: '',
  setSearchQuery: (v) => set({ searchQuery: v }),
  visibleModules: [],
  setVisibleModules: (v) => set({ visibleModules: v }),

  // Data
  progressTree: null,
  setProgressTree: (t) => set({
    progressTree: t,
    visibleModules: t.modules.map(m => m.name),
  }),
  graphData: null,
  setGraphData: (g) => set({ graphData: g }),
  gaps: [],
  setGaps: (g) => set({ gaps: g }),

  // Chat
  messages: [],
  addMessage: (m) => set((s) => ({ messages: [...s.messages, m] })),
  updateLastMessage: (content) => set((s) => {
    const msgs = [...s.messages]
    if (msgs.length > 0) {
      msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], content }
    }
    return { messages: msgs }
  }),
  chatFilter: 'all',
  setChatFilter: (f) => set({ chatFilter: f }),
  isStreaming: false,
  setIsStreaming: (v) => set({ isStreaming: v }),

  // Scheduler
  studyBlocks: [],
  addBlock: (b) => set((s) => ({ studyBlocks: [...s.studyBlocks, b] })),
  updateBlock: (id, data) => set((s) => ({
    studyBlocks: s.studyBlocks.map(b => b.id === id ? { ...b, ...data } : b),
  })),
  removeBlock: (id) => set((s) => ({
    studyBlocks: s.studyBlocks.filter(b => b.id !== id),
  })),

  // Upload
  uploads: [],
  addUpload: (u) => set((s) => ({ uploads: [...s.uploads, u] })),
  updateUpload: (id, data) => set((s) => ({
    uploads: s.uploads.map(u => u.id === id ? { ...u, ...data } : u),
  })),

  // Progress
  updateSubtopic: (topicId, subtopicId, status) => set((s) => {
    if (!s.progressTree) return s
    return {
      progressTree: {
        ...s.progressTree,
        modules: s.progressTree.modules.map((mod) => ({
          ...mod,
          topics: mod.topics.map((t) => {
            if (t.id !== topicId) return t
            return {
              ...t,
              subtopics: t.subtopics.map((st) =>
                st.id === subtopicId ? { ...st, status: status as Subtopic['status'] } : st
              ),
            }
          }),
        })),
      },
    }
  }),
}))
