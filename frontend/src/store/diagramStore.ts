import { create } from 'zustand';
import { Node as RFNode, Edge, Connection, addEdge, applyNodeChanges, applyEdgeChanges } from '@xyflow/react';

interface DiagramState {
  nodes: RFNode[];
  edges: Edge[];
  selectedNode: RFNode | null;
  onNodesChange: (changes: unknown) => void;
  onEdgesChange: (changes: unknown) => void;
  onConnect: (connection: Connection) => void;
  addNode: (node: RFNode) => void;
  addNodesFromArchitecture: (nodes: RFNode[], connections: { from: string; to: string; label?: string }[]) => void;
  clearDiagram: () => void;
  setSelectedNode: (node: RFNode | null) => void;
  updateNodeData: (nodeId: string, data: Record<string, unknown>) => void;
  removeEdge: (edgeId: string) => void;
  updateEdgeLabel: (edgeId: string, label?: string, data?: Record<string, unknown>) => void;
}

export const useDiagramStore = create<DiagramState>((set, get) => ({
  nodes: [],
  edges: [],
  selectedNode: null,

  onNodesChange: (changes) => {
    set({
      nodes: applyNodeChanges(changes, get().nodes),
    });
  },

  onEdgesChange: (changes) => {
    set({
      edges: applyEdgeChanges(changes, get().edges),
    });
  },

  onConnect: (connection) => {
    set({
      edges: addEdge(
        {
          ...connection,
          type: 'animated',
          data: { animated: true },
        },
        get().edges
      ),
    });
  },

  addNode: (node) => {
    set({
      nodes: [...get().nodes, node],
    });
  },

  addNodesFromArchitecture: (nodes: RFNode[], connections: { from: string; to: string; label?: string }[]) => {
    // Clear existing nodes or add to existing ones based on user preference
    const existingNodes = get().nodes;
    const newNodes = [...existingNodes, ...nodes];
    
    // Create edges from connections
    const newEdges = connections.map((conn, index) => ({
      id: `ai-edge-${index}`,
      source: conn.from,
      target: conn.to,
      type: 'animated',
      label: conn.label,
      data: { animated: true },
    }));
    
    set({
      nodes: newNodes,
      edges: [...get().edges, ...newEdges],
    });
  },

  clearDiagram: () => {
    set({
      nodes: [],
      edges: [],
      selectedNode: null,
    });
  },

  setSelectedNode: (node) => {
    set({ selectedNode: node });
  },

  updateNodeData: (nodeId, data) => {
    const newNodes = get().nodes.map((node) =>
      node.id === nodeId ? { ...node, data: { ...node.data, ...data } } : node
    );
    // If the currently selected node is the one we updated, keep selectedNode in sync
    const currentSelected = get().selectedNode;
    const newSelected = currentSelected && currentSelected.id === nodeId
      ? newNodes.find((n) => n.id === nodeId) || currentSelected
      : currentSelected;
    set({
      nodes: newNodes,
      selectedNode: newSelected,
    });
  },
  // Remove an edge by id
  removeEdge: (edgeId: string) => {
    set({
      edges: get().edges.filter((e) => e.id !== edgeId),
    });
  },

  // Update an edge's label or data
  updateEdgeLabel: (edgeId: string, label?: string, data?: Record<string, unknown> | undefined) => {
    const newEdges = get().edges.map((edge) =>
      edge.id === edgeId ? { ...edge, label: label ?? edge.label, data: { ...(edge.data || {}), ...(data || {}) } } : edge
    );
    set({ edges: newEdges });
  },
}));
