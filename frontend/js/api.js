/** API client for the Study Gap Detector backend. */

const API_BASE = (() => {
  // In production/PWA, the backend is at the same host on port 8000
  if (window.location.port === '8000' || window.location.port === '') {
    return `${window.location.protocol}//${window.location.hostname}:8000`;
  }
  // In dev, we proxy or use the configured backend URL
  return 'http://localhost:8000';
})();

async function request(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const config = {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  };
  const response = await fetch(url, config);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API error ${response.status}: ${text}`);
  }
  return response.json();
}

export const api = {
  /** Ask a RAG-grounded question */
  async query(question, domain = 'theory_of_computation') {
    return request('/query', {
      method: 'POST',
      body: JSON.stringify({ query: question, domain }),
    });
  },

  /** Get progress for a domain */
  async getProgress(domain = 'theory_of_computation') {
    return request(`/progress/${encodeURIComponent(domain)}`);
  },

  /** Update progress for a topic */
  async updateProgress(domain, topicId, status) {
    return request(`/progress/${encodeURIComponent(domain)}/update`, {
      method: 'POST',
      body: JSON.stringify({ topic_id: topicId, status }),
    });
  },

  /** Get computed gaps with explanations */
  async getGaps(domain = 'theory_of_computation') {
    return request(`/gaps/${encodeURIComponent(domain)}`);
  },

  /** Get graph data for visualization */
  async getGraph(domain = 'theory_of_computation') {
    return request(`/graph/${encodeURIComponent(domain)}`);
  },

  /** Health check */
  async health() {
    return request('/health');
  },
};
