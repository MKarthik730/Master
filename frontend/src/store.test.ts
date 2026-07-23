import { describe, it, expect, beforeEach } from 'vitest'
import { useStore } from './store'
import type { Message, StudyBlock, UploadDoc } from './types'
import { mockProgressTree, mockGraphData, mockGaps } from './test/mockData'

describe('AppStore', () => {
  beforeEach(() => {
    // Reset store to initial state
    useStore.setState({
      domain: 'placement_mastery',
      activeView: 'graph',
      sidePanelOpen: false,
      sidePanelContent: null,
      selectedNodeId: null,
      isMobile: false,
      focusGapsOnly: false,
      searchQuery: '',
      visibleModules: [],
      progressTree: null,
      graphData: null,
      gaps: [],
      messages: [],
      chatFilter: 'all',
      isStreaming: false,
      studyBlocks: [],
      uploads: [],
    })
  })

  describe('domain', () => {
    it('sets domain', () => {
      useStore.getState().setDomain('theory_of_computation')
      expect(useStore.getState().domain).toBe('theory_of_computation')
    })
  })

  describe('UI state', () => {
    it('sets active view and closes side panel', () => {
      useStore.getState().openSidePanel('chat')
      useStore.getState().setActiveView('chat')
      expect(useStore.getState().activeView).toBe('chat')
      expect(useStore.getState().sidePanelOpen).toBe(false)
    })

    it('opens and closes side panel', () => {
      useStore.getState().openSidePanel('chat')
      expect(useStore.getState().sidePanelOpen).toBe(true)
      expect(useStore.getState().sidePanelContent).toBe('chat')

      useStore.getState().closeSidePanel()
      expect(useStore.getState().sidePanelOpen).toBe(false)
      expect(useStore.getState().sidePanelContent).toBeNull()
    })

    it('sets selected node and opens side panel', () => {
      useStore.getState().setSelectedNode('1')
      expect(useStore.getState().selectedNodeId).toBe('1')
      expect(useStore.getState().sidePanelOpen).toBe(true)
      expect(useStore.getState().sidePanelContent).toBe('node')
    })

    it('toggles focusGapsOnly', () => {
      expect(useStore.getState().focusGapsOnly).toBe(false)
      useStore.getState().setFocusGapsOnly(true)
      expect(useStore.getState().focusGapsOnly).toBe(true)
    })

    it('sets search query', () => {
      useStore.getState().setSearchQuery('pushdown')
      expect(useStore.getState().searchQuery).toBe('pushdown')
    })

    it('sets visible modules', () => {
      const modules = ['Math & CS Foundations']
      useStore.getState().setVisibleModules(modules)
      expect(useStore.getState().visibleModules).toEqual(modules)
    })

    it('sets isMobile', () => {
      useStore.getState().setIsMobile(true)
      expect(useStore.getState().isMobile).toBe(true)
    })
  })

  describe('data management', () => {
    it('sets progress tree and auto-populates visible modules', () => {
      useStore.getState().setProgressTree(mockProgressTree)
      expect(useStore.getState().progressTree).toEqual(mockProgressTree)
      expect(useStore.getState().visibleModules).toEqual([
        'Math & CS Foundations',
        'Programming Languages',
      ])
    })

    it('sets graph data', () => {
      useStore.getState().setGraphData(mockGraphData)
      expect(useStore.getState().graphData).toEqual(mockGraphData)
    })

    it('sets gaps', () => {
      useStore.getState().setGaps(mockGaps)
      expect(useStore.getState().gaps).toEqual(mockGaps)
    })
  })

  describe('messages / chat', () => {
    it('adds a message', () => {
      const msg: Message = { id: '1', role: 'user', content: 'Hello', timestamp: 100 }
      useStore.getState().addMessage(msg)
      expect(useStore.getState().messages).toHaveLength(1)
      expect(useStore.getState().messages[0].content).toBe('Hello')
    })

    it('updates the last message content', () => {
      useStore.getState().addMessage({ id: '1', role: 'assistant', content: 'Hi', timestamp: 100 })
      useStore.getState().updateLastMessage('Hi there!')
      expect(useStore.getState().messages[0].content).toBe('Hi there!')
    })

    it('sets and clears isStreaming', () => {
      useStore.getState().setIsStreaming(true)
      expect(useStore.getState().isStreaming).toBe(true)
      useStore.getState().setIsStreaming(false)
      expect(useStore.getState().isStreaming).toBe(false)
    })

    it('sets chat filter', () => {
      useStore.getState().setChatFilter('textbooks')
      expect(useStore.getState().chatFilter).toBe('textbooks')
    })
  })

  describe('scheduler / study blocks', () => {
    it('adds a study block', () => {
      const block: StudyBlock = {
        id: 'b1', day: 1, hour: 9, duration: 1,
        topicId: 'discrete_math', topicTitle: 'Discrete Math', status: 'upcoming',
      }
      useStore.getState().addBlock(block)
      expect(useStore.getState().studyBlocks).toHaveLength(1)
      expect(useStore.getState().studyBlocks[0].topicTitle).toBe('Discrete Math')
    })

    it('updates a study block', () => {
      useStore.getState().addBlock({
        id: 'b1', day: 1, hour: 9, duration: 1, status: 'upcoming',
      })
      useStore.getState().updateBlock('b1', { status: 'done' })
      expect(useStore.getState().studyBlocks[0].status).toBe('done')
    })

    it('removes a study block', () => {
      useStore.getState().addBlock({
        id: 'b1', day: 1, hour: 9, duration: 1, status: 'upcoming',
      })
      useStore.getState().removeBlock('b1')
      expect(useStore.getState().studyBlocks).toHaveLength(0)
    })
  })

  describe('uploads', () => {
    it('adds an upload', () => {
      const doc: UploadDoc = {
        id: 'u1', title: 'test.pdf', category: 'textbook',
        status: 'queued', progress: 0,
      }
      useStore.getState().addUpload(doc)
      expect(useStore.getState().uploads).toHaveLength(1)
    })

    it('updates an upload', () => {
      useStore.getState().addUpload({
        id: 'u1', title: 'test.pdf', category: 'textbook',
        status: 'queued', progress: 0,
      })
      useStore.getState().updateUpload('u1', { status: 'ready', progress: 100 })
      expect(useStore.getState().uploads[0].status).toBe('ready')
      expect(useStore.getState().uploads[0].progress).toBe(100)
    })
  })

  describe('subtopic progress', () => {
    it('updates subtopic status in progress tree', () => {
      useStore.getState().setProgressTree(mockProgressTree)
      useStore.getState().updateSubtopic(1, 10, 'in_progress')
      const tree = useStore.getState().progressTree!
      const subtopic = tree.modules[0].topics[0].subtopics[0]
      expect(subtopic.status).toBe('in_progress')
    })
  })
})
