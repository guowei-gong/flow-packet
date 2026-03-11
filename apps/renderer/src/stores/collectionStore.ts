import { create } from 'zustand'
import type { Node, Edge } from '@xyflow/react'
import type { RequestNodeData } from './canvasStore'
import * as api from '@/services/api'

export interface CollectionFolder {
  id: string
  name: string
  parentId: string
  createdAt: number
}

export interface Collection {
  id: string
  name: string
  folderId: string
  nodes: Node<RequestNodeData>[]
  edges: Edge[]
  createdAt: number
  updatedAt: number
}

interface CollectionStore {
  folders: CollectionFolder[]
  collections: Collection[]

  loadCollections: () => Promise<void>
  saveCollection: (name: string, folderId: string, nodes: Node<RequestNodeData>[], edges: Edge[]) => Promise<string>
  updateCollection: (id: string, nodes: Node<RequestNodeData>[], edges: Edge[]) => Promise<void>
  renameCollection: (id: string, name: string) => Promise<void>
  deleteCollection: (id: string) => Promise<void>
  createFolder: (name: string, parentId: string) => Promise<CollectionFolder>
  renameFolder: (id: string, name: string) => Promise<void>
  deleteFolder: (id: string) => Promise<void>
}

export const useCollectionStore = create<CollectionStore>((set) => ({
  folders: [],
  collections: [],

  loadCollections: async () => {
    const data = await api.listCollections()
    set({
      folders: data.folders as CollectionFolder[],
      collections: data.items as Collection[],
    })
  },

  saveCollection: async (name, folderId, nodes, edges) => {
    const { item } = await api.saveCollection(name, folderId, nodes, edges)
    set((s) => ({ collections: [...s.collections, item as Collection] }))
    return item.id
  },

  updateCollection: async (id, nodes, edges) => {
    await api.updateCollection(id, nodes, edges)
    set((s) => ({
      collections: s.collections.map((c) =>
        c.id === id ? { ...c, nodes, edges, updatedAt: Date.now() } : c
      ),
    }))
  },

  renameCollection: async (id, name) => {
    await api.renameCollection(id, name)
    set((s) => ({
      collections: s.collections.map((c) =>
        c.id === id ? { ...c, name, updatedAt: Date.now() } : c
      ),
    }))
  },

  deleteCollection: async (id) => {
    await api.deleteCollection(id)
    set((s) => ({
      collections: s.collections.filter((c) => c.id !== id),
    }))
  },

  createFolder: async (name, parentId) => {
    const { folder } = await api.createCollectionFolder(name, parentId)
    const f = folder as CollectionFolder
    set((s) => ({ folders: [...s.folders, f] }))
    return f
  },

  renameFolder: async (id, name) => {
    await api.renameCollectionFolder(id, name)
    set((s) => ({
      folders: s.folders.map((f) =>
        f.id === id ? { ...f, name } : f
      ),
    }))
  },

  deleteFolder: async (id) => {
    await api.deleteCollectionFolder(id)
    set((s) => {
      const deleteIDs = new Set<string>([id])
      let changed = true
      while (changed) {
        changed = false
        for (const f of s.folders) {
          if (deleteIDs.has(f.parentId) && !deleteIDs.has(f.id)) {
            deleteIDs.add(f.id)
            changed = true
          }
        }
      }
      return {
        folders: s.folders.filter((f) => !deleteIDs.has(f.id)),
        collections: s.collections.filter((c) => !deleteIDs.has(c.folderId)),
      }
    })
  },
}))
