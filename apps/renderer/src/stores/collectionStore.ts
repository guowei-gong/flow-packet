import { create } from 'zustand'
import type { Node, Edge } from '@xyflow/react'
import type { RequestNodeData } from './canvasStore'

export interface Collection {
  id: string
  name: string
  nodes: Node<RequestNodeData>[]
  edges: Edge[]
  createdAt: number
  updatedAt: number
}

const STORAGE_KEY = 'flow-packet-collections'

function loadCollections(): Collection[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function persistCollections(collections: Collection[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(collections))
}

interface CollectionStore {
  collections: Collection[]

  saveCollection: (name: string, nodes: Node<RequestNodeData>[], edges: Edge[]) => void
  updateCollection: (id: string, nodes: Node<RequestNodeData>[], edges: Edge[]) => void
  renameCollection: (id: string, name: string) => void
  deleteCollection: (id: string) => void
}

export const useCollectionStore = create<CollectionStore>((set, get) => ({
  collections: loadCollections(),

  saveCollection: (name, nodes, edges) => {
    const now = Date.now()
    const collection: Collection = {
      id: crypto.randomUUID(),
      name,
      nodes,
      edges,
      createdAt: now,
      updatedAt: now,
    }
    const collections = [collection, ...get().collections]
    persistCollections(collections)
    set({ collections })
  },

  updateCollection: (id, nodes, edges) => {
    const collections = get().collections.map((c) =>
      c.id === id ? { ...c, nodes, edges, updatedAt: Date.now() } : c
    )
    persistCollections(collections)
    set({ collections })
  },

  renameCollection: (id, name) => {
    const collections = get().collections.map((c) =>
      c.id === id ? { ...c, name, updatedAt: Date.now() } : c
    )
    persistCollections(collections)
    set({ collections })
  },

  deleteCollection: (id) => {
    const collections = get().collections.filter((c) => c.id !== id)
    persistCollections(collections)
    set({ collections })
  },
}))
