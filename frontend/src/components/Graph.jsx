import React, { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../services/api.js';

const STATUS_COLORS = {
  covered: { background: '#22c55e', border: '#16a34a', shape: 'dot' },
  in_progress: { background: '#eab308', border: '#ca8a04', shape: 'star' },
  gap: { background: '#ef4444', border: '#dc2626', shape: 'square' },
};
const DEFAULT_COLOR = { background: '#64748b', border: '#475569', shape: 'dot' };

export default function Graph({ getDomain }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const canvasRef = useRef(null);
  const networkRef = useRef(null);
  const visLoadingRef = useRef(false);

  const loadGraph = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [graphData, progressData] = await Promise.all([
        api.getGraph(getDomain()),
        api.getProgress(getDomain()),
      ]);
      return { graph: graphData, progress: progressData };
    } catch (err) {
      setError(err.message);
      setLoading(false);
      return null;
    }
  }, [getDomain]);

  useEffect(() => {
    let mounted = true;

    async function init() {
      const data = await loadGraph();
      if (!mounted || !data) return;

      const { graph: graphData, progress: progressData } = data;

      if (!graphData.nodes || graphData.nodes.length === 0) {
        if (mounted) {
          setError('No graph data available. Seed your knowledge graph first.');
          setLoading(false);
        }
        return;
      }

      // Build progress lookup
      const progressMap = {};
      if (progressData?.topics) {
        progressData.topics.forEach((p) => {
          progressMap[p.topic_id] = p.status;
        });
      }

      // Prepare vis nodes
      const nodes = graphData.nodes.map((n) => {
        const progress = progressMap[n.id];
        const color = progress ? STATUS_COLORS[progress] || DEFAULT_COLOR : DEFAULT_COLOR;
        return {
          id: n.id,
          label: n.name
            .replace(/_/g, ' ')
            .replace(/\b\w/g, (l) => l.toUpperCase()),
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

      // Prepare vis edges
      const edges = graphData.edges.map((e) => ({
        from: e.from_node || e.from,
        to: e.to,
        arrows: { to: { enabled: true, scaleFactor: 0.7 } },
        color: { color: '#475569', highlight: '#3b82f6' },
        width: 1.5,
        smooth: { type: 'curvedCW', roundness: 0.1 },
      }));

      if (mounted) {
        setLoading(false);
        drawNetwork(nodes, edges);
      }
    }

    function drawNetwork(nodes, edges) {
      if (!canvasRef.current) return;

      // Double-check mounted after potential async CDN load
      if (!mounted) return;

      if (typeof vis === 'undefined') {
        if (!visLoadingRef.current) {
          visLoadingRef.current = true;
          const script = document.createElement('script');
          script.src = 'https://cdn.jsdelivr.net/npm/vis-network@9.1.9/dist/vis-network.min.js';
          script.onload = () => {
            if (mounted) drawNetwork(nodes, edges);
          };
          document.head.appendChild(script);
          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = 'https://cdn.jsdelivr.net/npm/vis-network@9.1.9/dist/dist/vis-network.min.css';
          document.head.appendChild(link);
        }
        return;
      }

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

      networkRef.current = new vis.Network(
        canvasRef.current,
        {
          nodes: new vis.DataSet(nodes),
          edges: new vis.DataSet(edges),
        },
        options
      );

      networkRef.current.on('click', (params) => {
        if (params.nodes.length > 0) {
          const nodeId = params.nodes[0];
          const node = nodes.find((n) => n.id === nodeId);
          if (node) {
            window.dispatchEvent(
              new CustomEvent('graph-node-click', {
                detail: { id: nodeId, label: node.label, title: node.title },
              })
            );
          }
        }
      });

      networkRef.current.once('stabilized', () => {
        if (mounted) {
          networkRef.current?.fit({ animation: true });
        }
      });
    }

    init();

    return () => {
      mounted = false;
      if (networkRef.current) {
        networkRef.current.destroy();
        networkRef.current = null;
      }
    };
  }, [loadGraph]);

  // Trigger fit on resize
  useEffect(() => {
    const handleResize = () => {
      networkRef.current?.fit({ animation: true });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (loading) {
    return (
      <div id="graph-tab" className="tab-content active">
        <div className="graph-empty-state">
          <div className="loading-pulse graph-loading-icon">🔗</div>
          <p>Loading graph...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div id="graph-tab" className="tab-content active">
        <div className="graph-empty-state">
          <p>⚠️ Error loading graph: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div id="graph-tab" className="tab-content active">
      <div className="graph-container">
        <div
          ref={canvasRef}
          className="graph-canvas-inner"
        />
      </div>
      <div className="graph-legend">
        <div className="legend-item"><span className="legend-dot covered"></span> Covered</div>
        <div className="legend-item"><span className="legend-dot in-progress"></span> In Progress</div>
        <div className="legend-item"><span className="legend-dot gap"></span> Gap</div>
        <div className="legend-item"><span className="legend-dot unmapped"></span> Not Started</div>
      </div>
    </div>
  );
}
