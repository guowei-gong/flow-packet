import { create } from 'zustand'

export type ExecutionStatus = 'idle' | 'running' | 'completed' | 'error' | 'stopped'

export interface LogEntry {
  id: string
  timestamp: number
  nodeId: string
  type: 'request' | 'response' | 'error' | 'info'
  data: Record<string, unknown>
  duration?: number
}

export interface NodeStatus {
  nodeId: string
  status: 'pending' | 'running' | 'success' | 'error'
  error?: string
}

interface ExecutionStore {
  status: ExecutionStatus
  logs: LogEntry[]
  nodeStatuses: Record<string, NodeStatus>

  setStatus: (status: ExecutionStatus) => void
  addLog: (log: LogEntry) => void
  clearLogs: () => void
  setNodeStatus: (nodeId: string, status: NodeStatus) => void
  resetNodeStatuses: () => void
}

export const useExecutionStore = create<ExecutionStore>((set) => ({
  status: 'idle',
  logs: [],
  nodeStatuses: {},

  setStatus: (status) => set({ status }),
  addLog: (log) => set((s) => ({ logs: [...s.logs, log] })),
  clearLogs: () => set({ logs: [] }),
  setNodeStatus: (nodeId, status) =>
    set((s) => ({
      nodeStatuses: { ...s.nodeStatuses, [nodeId]: status },
    })),
  resetNodeStatuses: () => set({ nodeStatuses: {} }),
}))
