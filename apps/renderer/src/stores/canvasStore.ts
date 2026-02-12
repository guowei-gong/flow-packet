import { create } from 'zustand'
import type { Node, Edge } from '@xyflow/react'

export interface RequestNodeData {
  messageName: string
  route: number
  fields: Record<string, unknown>
  responseFields?: { name: string; type: string }[]
  [key: string]: unknown
}

interface CanvasStore {
  nodes: Node<RequestNodeData>[]
  edges: Edge[]
  selectedNodeId: string | null
  editingNodeId: string | null

  setNodes: (nodes: Node<RequestNodeData>[]) => void
  setEdges: (edges: Edge[]) => void
  updateNodes: (updater: (nodes: Node<RequestNodeData>[]) => Node<RequestNodeData>[]) => void
  updateEdges: (updater: (edges: Edge[]) => Edge[]) => void
  setSelectedNodeId: (id: string | null) => void
  setEditingNodeId: (id: string | null) => void
  updateNodeData: (nodeId: string, data: Partial<RequestNodeData>) => void
  addNode: (node: Node<RequestNodeData>) => void
  removeNode: (nodeId: string) => void
}

export const useCanvasStore = create<CanvasStore>((set) => ({
  nodes: [],
  edges: [],
  selectedNodeId: null,
  editingNodeId: null,

  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),
  updateNodes: (updater) => set((s) => ({ nodes: updater(s.nodes) })),
  updateEdges: (updater) => set((s) => ({ edges: updater(s.edges) })),
  setSelectedNodeId: (id) => set({ selectedNodeId: id }),
  setEditingNodeId: (id) => set({ editingNodeId: id }),
  updateNodeData: (nodeId, data) =>
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n
      ),
    })),
  addNode: (node) => set((s) => ({ nodes: [...s.nodes, node] })),
  removeNode: (nodeId) =>
    set((s) => ({
      nodes: s.nodes.filter((n) => n.id !== nodeId),
      edges: s.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
      selectedNodeId: s.selectedNodeId === nodeId ? null : s.selectedNodeId,
    })),
}))
