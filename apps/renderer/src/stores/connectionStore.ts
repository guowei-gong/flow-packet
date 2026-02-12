import { create } from 'zustand'

export type ConnState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting'

export interface ConnectionConfig {
  protocol: 'tcp'
  host: string
  port: number
  timeout: number
  reconnect: boolean
  heartbeat: boolean
}

interface ConnectionStore {
  state: ConnState
  config: ConnectionConfig
  targetAddr: string

  setState: (state: ConnState) => void
  setConfig: (config: Partial<ConnectionConfig>) => void
  setTargetAddr: (addr: string) => void
}

export const useConnectionStore = create<ConnectionStore>((set) => ({
  state: 'disconnected',
  config: {
    protocol: 'tcp',
    host: '127.0.0.1',
    port: 9001,
    timeout: 5000,
    reconnect: true,
    heartbeat: true,
  },
  targetAddr: '',

  setState: (state) => set({ state }),
  setConfig: (config) =>
    set((s) => ({ config: { ...s.config, ...config } })),
  setTargetAddr: (addr) => set({ targetAddr: addr }),
}))
