import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useStore } from '../../store'
import GraphView from '../GraphView'
import { mockProgressTree, mockGraphData, mockGaps } from '../../test/mockData'

// Mock react-force-graph-2d since it requires Canvas (not in jsdom)
vi.mock('react-force-graph-2d', () => ({
  default: vi.fn().mockImplementation(() => null),
}))

// Mock framer-motion for AnimatePresence
vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: any) => <>{children}</>,
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
}))

describe('GraphView', () => {
  beforeEach(() => {
    useStore.setState({
      graphData: mockGraphData,
      progressTree: mockProgressTree,
      gaps: mockGaps,
      visibleModules: ['Math & CS Foundations', 'Programming Languages'],
      focusGapsOnly: false,
      searchQuery: '',
      selectedNodeId: null,
      sidePanelOpen: false,
      sidePanelContent: null,
    })
  })

  it('renders toolbar with search input', () => {
    render(<GraphView />)
    const searchInput = screen.getByPlaceholderText(/search topics/i)
    expect(searchInput).toBeInTheDocument()
  })

  it('renders focus gaps toggle button', () => {
    render(<GraphView />)
    const focusButton = screen.getByText(/focus gaps/i)
    expect(focusButton).toBeInTheDocument()
  })

  it('renders module filter chips', () => {
    render(<GraphView />)
    expect(screen.getByText('Math & CS Foundations')).toBeInTheDocument()
    expect(screen.getByText('Programming Languages')).toBeInTheDocument()
  })

  it('toggles focusGapsOnly when button clicked', () => {
    render(<GraphView />)
    const focusButton = screen.getByText(/focus gaps/i)
    fireEvent.click(focusButton)
    expect(useStore.getState().focusGapsOnly).toBe(true)
    fireEvent.click(focusButton)
    expect(useStore.getState().focusGapsOnly).toBe(false)
  })

  it('updates search query on input change', () => {
    render(<GraphView />)
    const searchInput = screen.getByPlaceholderText(/search topics/i)
    fireEvent.change(searchInput, { target: { value: 'pushdown' } })
    expect(useStore.getState().searchQuery).toBe('pushdown')
  })

  it('renders fit button', () => {
    render(<GraphView />)
    const fitButton = screen.getByText('⊞ Fit')
    expect(fitButton).toBeInTheDocument()
  })
})
