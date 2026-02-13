import { create } from 'zustand'
import type { Node, Edge } from '@xyflow/react'
import type { RequestNodeData } from './canvasStore'
import { useCanvasStore } from './canvasStore'

export interface CanvasTab {
  id: string
  name: string
  collectionId?: string
  nodes: Node<RequestNodeData>[]
  edges: Edge[]
  dirty: boolean
}

interface TabStore {
  tabs: CanvasTab[]
  activeTabId: string | null

  addTab: () => void
  openTab: (name: string, collectionId: string, nodes: Node<RequestNodeData>[], edges: Edge[]) => void
  switchTab: (tabId: string) => void
  closeTab: (tabId: string) => void
  markClean: (tabId: string) => void
  /** Sync current canvas state back into active tab (called before switch/close) */
  _saveActiveTab: () => void
}

function createDefaultTab(): CanvasTab {
  return {
    id: crypto.randomUUID(),
    name: '未命名',
    nodes: [],
    edges: [],
    dirty: false,
  }
}

// Module-level flag to suppress dirty marking during tab switches
let _switching = false

const defaultTab = createDefaultTab()

export const useTabStore = create<TabStore>((set, get) => ({
  tabs: [defaultTab],
  activeTabId: defaultTab.id,

  _saveActiveTab: () => {
    const { activeTabId, tabs } = get()
    if (!activeTabId) return
    const canvas = useCanvasStore.getState()
    set({
      tabs: tabs.map((t) =>
        t.id === activeTabId
          ? { ...t, nodes: canvas.nodes, edges: canvas.edges }
          : t
      ),
    })
  },

  markClean: (tabId) => {
    set((s) => ({
      tabs: s.tabs.map((t) => (t.id === tabId ? { ...t, dirty: false } : t)),
    }))
  },

  addTab: () => {
    const { _saveActiveTab } = get()
    _saveActiveTab()
    const tab = createDefaultTab()
    _switching = true
    set((s) => ({ tabs: [...s.tabs, tab], activeTabId: tab.id }))
    useCanvasStore.getState().setNodes([])
    useCanvasStore.getState().setEdges([])
    _switching = false
  },

  openTab: (name, collectionId, nodes, edges) => {
    const { tabs, _saveActiveTab } = get()
    const existing = tabs.find((t) => t.collectionId === collectionId)
    if (existing) {
      get().switchTab(existing.id)
      return
    }
    _saveActiveTab()
    const tab: CanvasTab = {
      id: crypto.randomUUID(),
      name,
      collectionId,
      nodes,
      edges,
      dirty: false,
    }
    _switching = true
    set((s) => ({ tabs: [...s.tabs, tab], activeTabId: tab.id }))
    useCanvasStore.getState().setNodes(nodes)
    useCanvasStore.getState().setEdges(edges)
    _switching = false
  },

  switchTab: (tabId) => {
    const { activeTabId, tabs, _saveActiveTab } = get()
    if (tabId === activeTabId) return
    _saveActiveTab()
    const target = tabs.find((t) => t.id === tabId)
    if (!target) return
    _switching = true
    set({ activeTabId: tabId })
    useCanvasStore.getState().setNodes(target.nodes)
    useCanvasStore.getState().setEdges(target.edges)
    _switching = false
  },

  closeTab: (tabId) => {
    const { tabs, activeTabId, _saveActiveTab } = get()
    if (activeTabId && activeTabId !== tabId) {
      _saveActiveTab()
    }
    const idx = tabs.findIndex((t) => t.id === tabId)
    if (idx === -1) return
    const newTabs = tabs.filter((t) => t.id !== tabId)

    if (tabId === activeTabId) {
      let nextId: string | null = null
      if (newTabs.length > 0) {
        const nextIdx = Math.min(idx, newTabs.length - 1)
        nextId = newTabs[nextIdx].id
      }
      _switching = true
      set({ tabs: newTabs, activeTabId: nextId })
      if (nextId) {
        const next = newTabs.find((t) => t.id === nextId)!
        useCanvasStore.getState().setNodes(next.nodes)
        useCanvasStore.getState().setEdges(next.edges)
      } else {
        useCanvasStore.getState().setNodes([])
        useCanvasStore.getState().setEdges([])
      }
      _switching = false
    } else {
      set({ tabs: newTabs })
    }
  },
}))

// Subscribe to canvas changes for dirty tracking
useCanvasStore.subscribe((state, prev) => {
  if (_switching) return
  if (state.nodes === prev.nodes && state.edges === prev.edges) return
  const { activeTabId } = useTabStore.getState()
  if (!activeTabId) return
  useTabStore.setState((s) => ({
    tabs: s.tabs.map((t) =>
      t.id === activeTabId ? { ...t, dirty: true } : t
    ),
  }))
})
