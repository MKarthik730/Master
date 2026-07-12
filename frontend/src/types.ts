export interface Subtopic {
  id: number
  title: string
  status: 'locked' | 'available' | 'in_progress' | 'covered'
}

export interface Topic {
  id: number
  topic_id: string
  title: string
  module: string
  status: 'locked' | 'available' | 'in_progress' | 'covered'
  subtopics: Subtopic[]
  prerequisites: string[]
  prerequisite_titles: string[]
}

export interface Module {
  name: string
  topics: Topic[]
}

export interface ProgressTree {
  domain: string
  modules: Module[]
  total_topics: number
  covered: number
  in_progress: number
  locked: number
  available: number
}

export interface GraphNode {
  id: string
  name: string
  topic_id: string
  module: string
  description: string
  dependency_count: number
}

export interface GraphEdge {
  id: string
  from_node: string
  to: string
}

export interface GraphData {
  domain: string
  roadmap: string
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export interface Gap {
  topic: { id: string; name: string; description: string; module: string }
  prerequisite_for: string[]
  explanation: string
  suggested_order: number
}

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  citations?: Citation[]
  meta?: { model?: string; confidence?: number; from_fallback?: boolean }
  timestamp: number
}

export interface Citation {
  source: string
  section?: string
  page?: number
  content_preview?: string
}

export interface StudyBlock {
  id: string
  day: number // 0-6
  hour: number // 0-23
  duration: number // hours
  topicId?: string
  topicTitle?: string
  status: 'upcoming' | 'done' | 'missed'
}

export interface UploadDoc {
  id: string
  title: string
  category: 'textbook' | 'personal'
  status: 'queued' | 'chunking' | 'embedding' | 'ready' | 'error'
  progress: number
  topics?: string[]
}
