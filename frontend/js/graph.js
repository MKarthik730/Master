/** Graph visualization module — renders interactive topic prerequisite graph. */

import { api } from './api.js';

let network = null;
let currentData = null;

export function initGraph(getDomain, getProgress) {
  const container = document.getElementById('graph-canvas');
  const legendEl = document.getElementById('graph-legend');
  if (!container) return;

  async function loadGraph() {
    container.innerHTML = '<div style="text-align:center;padding:60px 20px;color:var(--text-muted);"><div class="loading-pulse" style="font-size:2rem;margin-bottom:12px;">🔗</div><p>Loading graph...</p></div>';
    try {
      const [graphData, progressData] = await Promise.all([
        api.getGraph(getDomain()),
        api.getProgress(getDomain()),
      ]);
      currentData = { graph: graphData, progress: progressData };
      renderGraph(graphData, progressData);
    } catch (err) {
      container.innerHTML = `<div style="text-align:center;padding:60px 20px;color:var(--text-muted);"><p>⚠️ Error loading graph: ${err.message}</p></div>`;
    }
  }

  function renderGraph(graphData, progressData) {
    if (!graphData.nodes || graphData.nodes.length === 0) {
      container.innerHTML = '<div style="text-align:center;padding:60px 20px;color:var(--text-muted);"><p>No graph data available. Seed your knowledge graph first.</p></div>';
      return;
    }

    // Build progress lookup
    const progressMap = {};
    if (progressData && progressData.topics) {
      progressData.topics.forEach(p => {
        progressMap[p.topic_id] = p.status;
      });
    }

    // Build node color map
    const statusColors = {
      covered: { background: '#22c55e', border: '#16a34a', shape: 'dot' },
      in_progress: { background: '#eab308', border: '#ca8a04', shape: 'star' },
      gap: { background: '#ef4444', border: '#dc2626', shape: 'square' },
    };
    const defaultColor = { background: '#64748b', border: '#475569', shape: 'dot' };

    // Prepare nodes
    const nodes = graphData.nodes.map(n => {
      const progress = progressMap[n.id];
      const color = progress ? (statusColors[progress] || defaultColor) : defaultColor;
      return {
        id: n.id,
        label: n.name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        title: n.description || n.name,
        color: {
          background: color.background,
          border: color.border,
          highlight: { background: '#3b82f6', border: '#2563eb' },
        },
        shape: color.shape,
        size: color.shape === 'star' ? 22 : 18,
        font: { color: '#f1f5f9', size: 12, face: 'system-ui' },
      };
    });

    // Prepare edges
    const edges = graphData.edges.map(e => ({
      from: e.from_node || e.from,
      to: e.to,
      arrows: { to: { enabled: true, scaleFactor: 0.7 } },
      color: { color: '#475569', highlight: '#3b82f6' },
      width: 1.5,
      smooth: { type: 'curvedCW', roundness: 0.1 },
    }));

    // Get or create a legend
    if (legendEl) {
      legendEl.innerHTML = `
        <div class="legend-item"><span class="legend-dot covered"></span> Covered</div>
        <div class="legend-item"><span class="legend-dot in-progress"></span> In Progress</div>
        <div class="legend-item"><span class="legend-dot gap"></span> Gap</div>
        <div class="legend-item"><span class="legend-dot unmapped"></span> Not Started</div>
      `;
    }

    // Render network
    container.innerHTML = '';
    const canvas = document.createElement('div');
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.minHeight = 'calc(100dvh - 320px)';
    container.appendChild(canvas);

    // Load vis-network from CDN if not loaded
    if (typeof vis === 'undefined') {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/vis-network@9.1.9/dist/vis-network.min.js';
      script.onload = () => drawNetwork(canvas, nodes, edges);
      document.head.appendChild(script);
      // Also load the CSS
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://cdn.jsdelivr.net/npm/vis-network@9.1.9/dist/dist/vis-network.min.css';
      document.head.appendChild(link);
    } else {
      drawNetwork(canvas, nodes, edges);
    }
  }

  function drawNetwork(container, nodes, edges) {
    const options = {
      physics: {
        solver: 'forceAtlas2Based',
        forceAtlas2Based: {
          gravitationalConstant: -30,
          centralGravity: 0.005,
          springLength: 150,
          springConstant: 0.08,
          damping: 0.4,
        },
        stabilization: { iterations: 100 },
      },
      interaction: {
        hover: true,
        tooltipDelay: 100,
        navigationButtons: false,
        zoomView: true,
      },
      edges: {
        smooth: { type: 'curvedCW', roundness: 0.1 },
      },
      nodes: {
        borderWidth: 2,
        shadow: { enabled: true, size: 4 },
      },
      layout: {
        improvedLayout: true,
      },
    };

    network = new vis.Network(container, { nodes: new vis.DataSet(nodes), edges: new vis.DataSet(edges) }, options);

    // Click handler
    network.on('click', (params) => {
      if (params.nodes.length > 0) {
        const nodeId = params.nodes[0];
        const node = nodes.find(n => n.id === nodeId);
        if (node) {
          // Emit a custom event that other modules can listen to
          window.dispatchEvent(new CustomEvent('graph-node-click', {
            detail: { id: nodeId, label: node.label, title: node.title },
          }));
        }
      }
    });

    // Fit view after stabilization
    network.once('stabilized', () => {
      network.fit({ animation: true });
    });
  }

  loadGraph();
  return { loadGraph, network: () => network };
}
