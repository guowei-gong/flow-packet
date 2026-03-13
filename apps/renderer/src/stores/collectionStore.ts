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

  loadCollections: (connectionId: string) => Promise<void>
  saveCollection: (connectionId: string, name: string, folderId: string, nodes: Node<RequestNodeData>[], edges: Edge[]) => Promise<string>
  updateCollection: (connectionId: string, id: string, nodes: Node<RequestNodeData>[], edges: Edge[]) => Promise<void>
  renameCollection: (connectionId: string, id: string, name: string) => Promise<void>
  deleteCollection: (connectionId: string, id: string) => Promise<void>
  createFolder: (connectionId: string, name: string, parentId: string) => Promise<CollectionFolder>
  renameFolder: (connectionId: string, id: string, name: string) => Promise<void>
  deleteFolder: (connectionId: string, id: string) => Promise<void>
  moveFolder: (connectionId: string, id: string, parentId: string) => Promise<void>
  moveCollection: (connectionId: string, id: string, folderId: string) => Promise<void>
  clearCollections: () => void
}

export const useCollectionStore = create<CollectionStore>((set) => ({
  folders: [],
  collections: [],

  loadCollections: async (connectionId) => {
    const data = await api.listCollections(connectionId)
    set({
      folders: data.folders as CollectionFolder[],
      collections: data.items as Collection[],
    })
  },

  saveCollection: async (connectionId, name, folderId, nodes, edges) => {
    const { item } = await api.saveCollection(connectionId, name, folderId, nodes, edges)
    set((s) => ({ collections: [...s.collections, item as Collection] }))
    return item.id
  },

  updateCollection: async (connectionId, id, nodes, edges) => {
    await api.updateCollection(connectionId, id, nodes, edges)
    set((s) => ({
      collections: s.collections.map((c) =>
        c.id === id ? { ...c, nodes, edges, updatedAt: Date.now() } : c
      ),
    }))
  },

  renameCollection: async (connectionId, id, name) => {
    await api.renameCollection(connectionId, id, name)
    set((s) => ({
      collections: s.collections.map((c) =>
        c.id === id ? { ...c, name, updatedAt: Date.now() } : c
      ),
    }))
  },

  deleteCollection: async (connectionId, id) => {
    await api.deleteCollection(connectionId, id)
    set((s) => ({
      collections: s.collections.filter((c) => c.id !== id),
    }))
  },

  createFolder: async (connectionId, name, parentId) => {
    const { folder } = await api.createCollectionFolder(connectionId, name, parentId)
    const f = folder as CollectionFolder
    set((s) => ({ folders: [...s.folders, f] }))
    return f
  },

  renameFolder: async (connectionId, id, name) => {
    await api.renameCollectionFolder(connectionId, id, name)
    set((s) => ({
      folders: s.folders.map((f) =>
        f.id === id ? { ...f, name } : f
      ),
    }))
  },

  moveFolder: async (connectionId, id, parentId) => {
    await api.moveCollectionFolder(connectionId, id, parentId)
    set((s) => ({
      folders: s.folders.map((f) =>
        f.id === id ? { ...f, parentId } : f
      ),
    }))
  },

  moveCollection: async (connectionId, id, folderId) => {
    await api.moveCollection(connectionId, id, folderId)
    set((s) => ({
      collections: s.collections.map((c) =>
        c.id === id ? { ...c, folderId } : c
      ),
    }))
  },

  deleteFolder: async (connectionId, id) => {
    await api.deleteCollectionFolder(connectionId, id)
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

  clearCollections: () => {
    set({ folders: [], collections: [] })
  },
}))
