import type { ProgressTree, GraphData, Gap } from './types'

export const mockProgressTree: ProgressTree = {
  domain: 'placement_mastery',
  total_topics: 47,
  covered: 8,
  in_progress: 3,
  locked: 12,
  available: 24,
  modules: [
    {
      name: 'Math & CS Foundations',
      topics: [
        { id: 1, topic_id: 'discrete_math', title: 'Discrete Mathematics', module: 'Math & CS Foundations', status: 'covered', prerequisites: [], prerequisite_titles: [], subtopics: [
          { id: 1, title: 'Set theory & functions', status: 'covered' },
          { id: 2, title: 'Propositional & predicate logic', status: 'covered' },
          { id: 3, title: 'Graph theory basics', status: 'covered' },
        ]},
        { id: 2, topic_id: 'probability_stats', title: 'Probability & Statistics', module: 'Math & CS Foundations', status: 'covered', prerequisites: [], prerequisite_titles: [], subtopics: [
          { id: 4, title: 'Probability axioms', status: 'covered' },
          { id: 5, title: 'Bayes theorem', status: 'covered' },
        ]},
        { id: 3, topic_id: 'linear_algebra', title: 'Linear Algebra', module: 'Math & CS Foundations', status: 'in_progress', prerequisites: [], prerequisite_titles: [], subtopics: [
          { id: 6, title: 'Vectors & vector spaces', status: 'covered' },
          { id: 7, title: 'Matrix operations', status: 'in_progress' },
          { id: 8, title: 'Eigenvalues & eigenvectors', status: 'available' },
        ]},
        { id: 4, topic_id: 'toc_automata', title: 'Theory of Computation', module: 'Math & CS Foundations', status: 'locked', prerequisites: ['discrete_math'], prerequisite_titles: ['Discrete Mathematics'], subtopics: [
          { id: 9, title: 'Finite automata', status: 'locked' },
          { id: 10, title: 'Regular expressions', status: 'locked' },
        ]},
      ],
    },
    {
      name: 'Programming Languages',
      topics: [
        { id: 5, topic_id: 'cpp_fundamentals', title: 'C++ Fundamentals', module: 'Programming Languages', status: 'covered', prerequisites: [], prerequisite_titles: [], subtopics: [
          { id: 11, title: 'Pointers & references', status: 'covered' },
          { id: 12, title: 'STL containers', status: 'covered' },
        ]},
        { id: 6, topic_id: 'python_fundamentals', title: 'Python Fundamentals', module: 'Programming Languages', status: 'available', prerequisites: [], prerequisite_titles: [], subtopics: [
          { id: 13, title: 'Data structures', status: 'available' },
        ]},
        { id: 7, topic_id: 'oop_design', title: 'OOP & SOLID Design', module: 'Programming Languages', status: 'locked', prerequisites: ['cpp_fundamentals'], prerequisite_titles: ['C++ Fundamentals'], subtopics: []},
      ],
    },
    {
      name: 'Data Structures & Algorithms',
      topics: [
        { id: 8, topic_id: 'complexity_bigo', title: 'Complexity Analysis', module: 'Data Structures & Algorithms', status: 'available', prerequisites: ['cpp_fundamentals'], prerequisite_titles: ['C++ Fundamentals'], subtopics: [
          { id: 14, title: 'Big-O, Big-Theta, Big-Omega', status: 'available' },
        ]},
        { id: 9, topic_id: 'arrays_strings', title: 'Arrays & Strings', module: 'Data Structures & Algorithms', status: 'available', prerequisites: ['complexity_bigo'], prerequisite_titles: ['Complexity Analysis'], subtopics: []},
      ],
    },
    {
      name: 'Backend & Scalable Systems',
      topics: [
        { id: 10, topic_id: 'rest_api_design', title: 'REST API Design', module: 'Backend & Scalable Systems', status: 'available', prerequisites: ['oop_design', 'cn_fundamentals'], prerequisite_titles: ['OOP & SOLID Design'], subtopics: []},
      ],
    },
    {
      name: 'System Design',
      topics: [
        { id: 11, topic_id: 'system_design_fundamentals', title: 'System Design Fundamentals', module: 'System Design', status: 'available', prerequisites: ['rest_api_design'], prerequisite_titles: ['REST API Design'], subtopics: []},
      ],
    },
    {
      name: 'AI, LLMs & Agents',
      topics: [
        { id: 12, topic_id: 'ml_fundamentals', title: 'ML Fundamentals', module: 'AI, LLMs & Agents', status: 'available', prerequisites: ['linear_algebra', 'probability_stats'], prerequisite_titles: ['Linear Algebra', 'Probability & Statistics'], subtopics: []},
      ],
    },
    {
      name: 'Interview & Career Prep',
      topics: [
        { id: 13, topic_id: 'resume_crafting', title: 'Resume Crafting', module: 'Interview & Career Prep', status: 'available', prerequisites: [], prerequisite_titles: [], subtopics: []},
      ],
    },
    {
      name: 'Developer Tools & Infrastructure',
      topics: [
        { id: 14, topic_id: 'git_version_control', title: 'Git & Version Control', module: 'Developer Tools & Infrastructure', status: 'available', prerequisites: [], prerequisite_titles: [], subtopics: []},
      ],
    },
    {
      name: 'Core CS Systems',
      topics: [
        { id: 15, topic_id: 'cn_fundamentals', title: 'Computer Networks', module: 'Core CS Systems', status: 'available', prerequisites: [], prerequisite_titles: [], subtopics: []},
        { id: 16, topic_id: 'os_fundamentals', title: 'Operating Systems', module: 'Core CS Systems', status: 'available', prerequisites: ['cpp_fundamentals'], prerequisite_titles: ['C++ Fundamentals'], subtopics: []},
      ],
    },
  ],
}

export const mockGraphData: GraphData = {
  domain: 'placement_mastery',
  roadmap: 'Placement & Software Engineering Mastery',
  nodes: mockProgressTree.modules.flatMap(mod =>
    mod.topics.map(t => ({
      id: String(t.id),
      name: t.title,
      topic_id: t.topic_id,
      module: t.module,
      description: '',
      dependency_count: mod.topics.filter(other => other.prerequisites.includes(t.topic_id)).length,
    }))
  ),
  edges: mockProgressTree.modules.flatMap(mod =>
    mod.topics.flatMap(t =>
      t.prerequisites.map(prereqId => {
        const prereq = mockProgressTree.modules.flatMap(m => m.topics).find(pt => pt.topic_id === prereqId)
        return {
          id: `${prereqId}-${t.topic_id}`,
          from_node: String(prereq?.id ?? ''),
          to: String(t.id),
        }
      }).filter(e => e.from_node)
    )
  ),
}

export const mockGaps: Gap[] = [
  {
    topic: { id: '3', name: 'Linear Algebra', description: 'Vectors, matrices, eigenvalues', module: 'Math & CS Foundations' },
    prerequisite_for: ['ML Fundamentals'],
    explanation: 'Linear Algebra is a core prerequisite for ML Fundamentals. Without understanding vector spaces, matrix operations, and eigenvalues, you will struggle with gradient descent, neural network math, and embedding concepts.',
    suggested_order: 1,
  },
  {
    topic: { id: '14', name: 'Git & Version Control', description: 'Commits, branching, merging', module: 'Developer Tools & Infrastructure' },
    prerequisite_for: ['C++ Fundamentals', 'Python Fundamentals'],
    explanation: 'While not a strict prerequisite, version control is expected knowledge for all programming work. Get comfortable with basic Git workflows before diving deep into coding practice.',
    suggested_order: 2,
  },
]
