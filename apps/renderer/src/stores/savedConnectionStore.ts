import { create } from 'zustand'

export interface SavedConnection {
  id: string
  name: string
  tag: string
  host: string
  port: number
  protocol: 'tcp'
  color: string
  createdAt: number
  updatedAt: number
}

export const TAG_OPTIONS = ['本地', '测试服', '正式服', '预发布'] as const

export const COLOR_OPTIONS = [
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#3b82f6', // blue
  '#22c55e', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#ec4899', // pink
  '#06b6d4', // cyan
] as const

const STORAGE_KEY = 'flow-packet-connections'

function loadConnections(): SavedConnection[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function persistConnections(connections: SavedConnection[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(connections))
}

interface SavedConnectionStore {
  connections: SavedConnection[]

  addConnection: (conn: Omit<SavedConnection, 'id' | 'createdAt' | 'updatedAt'>) => SavedConnection
  updateConnection: (id: string, updates: Partial<Omit<SavedConnection, 'id' | 'createdAt'>>) => void
  deleteConnection: (id: string) => void
  getConnection: (id: string) => SavedConnection | undefined
}

export const useSavedConnectionStore = create<SavedConnectionStore>((set, get) => ({
  connections: loadConnections(),

  addConnection: (conn) => {
    const now = Date.now()
    const newConn: SavedConnection = {
      ...conn,
      id: `conn_${now}_${Math.random().toString(36).slice(2, 8)}`,
      createdAt: now,
      updatedAt: now,
    }
    set((s) => {
      const next = [newConn, ...s.connections]
      persistConnections(next)
      return { connections: next }
    })
    return newConn
  },

  updateConnection: (id, updates) => {
    set((s) => {
      const next = s.connections.map((c) =>
        c.id === id ? { ...c, ...updates, updatedAt: Date.now() } : c
      )
      persistConnections(next)
      return { connections: next }
    })
  },

  deleteConnection: (id) => {
    set((s) => {
      const next = s.connections.filter((c) => c.id !== id)
      persistConnections(next)
      return { connections: next }
    })
  },

  getConnection: (id) => {
    return get().connections.find((c) => c.id === id)
  },
}))
