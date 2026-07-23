import type { ProgressTree, GraphData, Gap } from '../types'

export const mockProgressTree: ProgressTree = {
  domain: 'placement_mastery',
  modules: [
    {
      name: 'Math & CS Foundations',
      topics: [
        {
          id: 1,
          topic_id: 'discrete_math',
          title: 'Discrete Mathematics',
          module: 'Math & CS Foundations',
          status: 'covered',
          subtopics: [
            { id: 10, title: 'Sets & Relations', status: 'covered' },
            { id: 11, title: 'Graph Theory', status: 'covered' },
          ],
          prerequisites: [],
          prerequisite_titles: [],
        },
        {
          id: 2,
          topic_id: 'probability',
          title: 'Probability & Statistics',
          module: 'Math & CS Foundations',
          status: 'in_progress',
          subtopics: [
            { id: 20, title: 'Basic Probability', status: 'covered' },
            { id: 21, title: 'Distributions', status: 'in_progress' },
          ],
          prerequisites: ['discrete_math'],
          prerequisite_titles: ['Discrete Mathematics'],
        },
      ],
    },
    {
      name: 'Programming Languages',
      topics: [
        {
          id: 3,
          topic_id: 'python_basics',
          title: 'Python Basics',
          module: 'Programming Languages',
          status: 'locked',
          subtopics: [
            { id: 30, title: 'Data Types', status: 'available' },
          ],
          prerequisites: [],
          prerequisite_titles: [],
        },
      ],
    },
  ],
  total_topics: 3,
  covered: 1,
  in_progress: 1,
  locked: 1,
  available: 0,
}

export const mockGraphData: GraphData = {
  domain: 'placement_mastery',
  roadmap: 'Placement Mastery Syllabus',
  nodes: [
    { id: '1', name: 'Discrete Mathematics', topic_id: 'discrete_math', module: 'Math & CS Foundations', description: '', dependency_count: 1 },
    { id: '2', name: 'Probability & Statistics', topic_id: 'probability', module: 'Math & CS Foundations', description: '', dependency_count: 0 },
    { id: '3', name: 'Python Basics', topic_id: 'python_basics', module: 'Programming Languages', description: '', dependency_count: 0 },
  ],
  edges: [
    { id: 'e1', from_node: '1', to: '2' },
  ],
}

export const mockGaps: Gap[] = [
  {
    topic: { id: '3', name: 'Python Basics', description: '', module: 'Programming Languages' },
    prerequisite_for: ['Advanced Topics'],
    explanation: 'Python Basics is a prerequisite for advanced topics. Complete it first.',
    suggested_order: 1,
  },
]
