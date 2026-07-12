const BASE = (() => {
  if (window.location.port === '8000' || window.location.port === '') {
    return `${window.location.protocol}//${window.location.hostname}:8000`
  }
  return ''
})()

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${BASE}${path}`
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  })
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`)
  return res.json()
}

export const api = {
  health: () => request<{ status: string; domain: string }>('/health'),

  getProgressTree: (domain = 'placement_mastery') =>
    request<import('./types').ProgressTree>(`/progress/tree?domain=${encodeURIComponent(domain)}`),

  updateSubtopic: (domain: string, subtopicId: number, status: string) =>
    request<{ subtopic_id: number; status: string; topic_status: string; topic_progress: number }>(
      `/progress/${encodeURIComponent(domain)}/subtopic`,
      { method: 'POST', body: JSON.stringify({ subtopic_id: subtopicId, status }) }
    ),

  getGraph: (domain = 'placement_mastery') =>
    request<import('./types').GraphData>(`/graph/${encodeURIComponent(domain)}`),

  getGaps: (domain = 'placement_mastery') =>
    request<{ domain: string; total_gaps: number; gaps: import('./types').Gap[] }>(
      `/gaps/${encodeURIComponent(domain)}`
    ),

  query: (question: string, domain = 'placement_mastery') =>
    request<{ answer: string; citations: import('./types').Citation[]; response_meta: any }>(
      '/query',
      { method: 'POST', body: JSON.stringify({ query: question, domain }) }
    ),

  ingest: (file: File, domain = 'placement_mastery', category: 'textbook' | 'personal' = 'textbook') => {
    const form = new FormData()
    form.append('file', file)
    form.append('domain', domain)
    form.append('category', category)
    return fetch(`${BASE}/ingest`, { method: 'POST', body: form }).then(r => r.json())
  },
}
