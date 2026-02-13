import { create } from 'zustand'
import type { Node, Edge } from '@xyflow/react'

export interface RequestNodeData {
  messageName: string
  route: number
  fields: Record<string, unknown>
  responseFields?: { name: string; type: string }[]
  [key: string]: unknown
}

interface Snapshot {
  nodes: Node<RequestNodeData>[]
  edges: Edge[]
}

const MAX_HISTORY = 50

interface CanvasStore {
  nodes: Node<RequestNodeData>[]
  edges: Edge[]
  selectedNodeId: string | null
  editingNodeId: string | null

  past: Snapshot[]
  future: Snapshot[]

  setNodes: (nodes: Node<RequestNodeData>[]) => void
  setEdges: (edges: Edge[]) => void
  updateNodes: (updater: (nodes: Node<RequestNodeData>[]) => Node<RequestNodeData>[]) => void
  updateEdges: (updater: (edges: Edge[]) => Edge[]) => void
  setSelectedNodeId: (id: string | null) => void
  setEditingNodeId: (id: string | null) => void
  updateNodeData: (nodeId: string, data: Partial<RequestNodeData>) => void
  addNode: (node: Node<RequestNodeData>) => void
  removeNode: (nodeId: string) => void

  takeSnapshot: () => void
  undo: () => void
  redo: () => void
  canUndo: () => boolean
  canRedo: () => boolean
}

export const useCanvasStore = create<CanvasStore>((set, get) => ({
  nodes: [],
  edges: [],
  selectedNodeId: null,
  editingNodeId: null,
  past: [],
  future: [],

  takeSnapshot: () =>
    set((s) => ({
      past: [...s.past.slice(-(MAX_HISTORY - 1)), { nodes: s.nodes, edges: s.edges }],
      future: [],
    })),

  undo: () => {
    const { past, nodes, edges } = get()
    if (past.length === 0) return
    const prev = past[past.length - 1]
    set({
      past: past.slice(0, -1),
      future: [{ nodes, edges }, ...get().future],
      nodes: prev.nodes,
      edges: prev.edges,
    })
  },

  redo: () => {
    const { future, nodes, edges } = get()
    if (future.length === 0) return
    const next = future[0]
    set({
      future: future.slice(1),
      past: [...get().past, { nodes, edges }],
      nodes: next.nodes,
      edges: next.edges,
    })
  },

  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,

  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),
  updateNodes: (updater) => set((s) => ({ nodes: updater(s.nodes) })),
  updateEdges: (updater) => set((s) => ({ edges: updater(s.edges) })),
  setSelectedNodeId: (id) => set({ selectedNodeId: id }),
  setEditingNodeId: (id) => set({ editingNodeId: id }),
  updateNodeData: (nodeId, data) => {
    get().takeSnapshot()
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n
      ),
    }))
  },
  addNode: (node) => {
    get().takeSnapshot()
    set((s) => ({ nodes: [...s.nodes, node] }))
  },
  removeNode: (nodeId) => {
    get().takeSnapshot()
    set((s) => ({
      nodes: s.nodes.filter((n) => n.id !== nodeId),
      edges: s.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
      selectedNodeId: s.selectedNodeId === nodeId ? null : s.selectedNodeId,
    }))
  },
}))
