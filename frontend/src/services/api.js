const API_BASE = (() => {
  if (window.location.port === '8000' || window.location.port === '') {
    return `${window.location.protocol}//${window.location.hostname}:8000`;
  }
  return '';
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
  async query(question, domain = 'theory_of_computation') {
    return request('/query', {
      method: 'POST',
      body: JSON.stringify({ query: question, domain }),
    });
  },

  async getProgress(domain = 'theory_of_computation') {
    return request(`/progress/${encodeURIComponent(domain)}`);
  },

  async updateProgress(domain, topicId, status) {
    return request(`/progress/${encodeURIComponent(domain)}/update`, {
      method: 'POST',
      body: JSON.stringify({ topic_id: topicId, status }),
    });
  },

  async getGaps(domain = 'theory_of_computation') {
    return request(`/gaps/${encodeURIComponent(domain)}`);
  },

  async getGraph(domain = 'theory_of_computation') {
    return request(`/graph/${encodeURIComponent(domain)}`);
  },

  async health() {
    return request('/health');
  },
};
