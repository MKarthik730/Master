import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useStore } from '../../store'
import ProgressView from '../ProgressView'
import { mockProgressTree } from '../../test/mockData'

// Mock api to avoid actual HTTP calls
vi.mock('../../api', () => ({
  api: {
    updateSubtopic: vi.fn().mockResolvedValue({
      subtopic_id: 10,
      status: 'covered',
      topic_status: 'in_progress',
      topic_progress: 0.5,
    }),
  },
}))

// Mock framer-motion
vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: any) => <>{children}</>,
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
}))

describe('ProgressView', () => {
  beforeEach(() => {
    useStore.setState({
      progressTree: mockProgressTree,
    })
  })

  it('renders progress tracker heading', () => {
    render(<ProgressView />)
    expect(screen.getByText('Progress Tracker')).toBeInTheDocument()
  })

  it('displays summary stats', () => {
    render(<ProgressView />)
    expect(screen.getByText(/mastered/)).toBeInTheDocument()
    expect(screen.getByText(/in progress/)).toBeInTheDocument()
    expect(screen.getByText(/locked/)).toBeInTheDocument()
    expect(screen.getByText(/available/)).toBeInTheDocument()
  })

  it('renders module sections', () => {
    render(<ProgressView />)
    expect(screen.getByText('Math & CS Foundations')).toBeInTheDocument()
    expect(screen.getByText('Programming Languages')).toBeInTheDocument()
  })

  it('shows filter buttons', () => {
    render(<ProgressView />)
    expect(screen.getByText('All')).toBeInTheDocument()
    expect(screen.getByText('🔒 Gaps')).toBeInTheDocument()
    expect(screen.getByText('🔄 In progress')).toBeInTheDocument()
    expect(screen.getByText('✓ Mastered')).toBeInTheDocument()
  })

  it('can expand a module to see topics', async () => {
    render(<ProgressView />)
    // Click on Math & CS Foundations to expand
    fireEvent.click(screen.getByText('Math & CS Foundations'))
    expect(screen.getByText('Discrete Mathematics')).toBeInTheDocument()
    expect(screen.getByText('Probability & Statistics')).toBeInTheDocument()
  })

  it('shows subtopics when module is expanded', async () => {
    render(<ProgressView />)
    fireEvent.click(screen.getByText('Math & CS Foundations'))
    expect(screen.getByText('Sets & Relations')).toBeInTheDocument()
    expect(screen.getByText('Graph Theory')).toBeInTheDocument()
  })

  it('shows locked status indicator', () => {
    render(<ProgressView />)
    // Python Basics is locked
    fireEvent.click(screen.getByText('Programming Languages'))
    // The locked button should be there as part of Python Basics
    const lockedElements = screen.getAllByText(/🔒/)
    expect(lockedElements.length).toBeGreaterThan(0)
  })

  it('shows loading state when no progress tree', () => {
    useStore.setState({ progressTree: null })
    render(<ProgressView />)
    expect(screen.getByText(/loading progress/i)).toBeInTheDocument()
  })
})
