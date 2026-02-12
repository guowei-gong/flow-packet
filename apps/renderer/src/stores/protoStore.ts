import { create } from 'zustand'

export interface FieldInfo {
  name: string
  number: number
  type: string
  kind: string
  isRepeated: boolean
  isOptional: boolean
  isMap: boolean
  mapKey?: string
  mapValue?: string
  oneofName?: string
}

export interface OneofInfo {
  name: string
  fields: string[]
}

export interface EnumInfo {
  name: string
  values: { name: string; number: number }[]
}

export interface MessageInfo {
  Name: string
  ShortName: string
  Fields: FieldInfo[]
  Oneofs: OneofInfo[] | null
  NestedMsgs: MessageInfo[] | null
  NestedEnums: EnumInfo[] | null
}

export interface FileInfo {
  Path: string
  Package: string
  Messages: MessageInfo[] | null
  Enums: EnumInfo[] | null
}

export interface RouteMapping {
  route: number
  requestMsg: string
  responseMsg: string
}

interface ProtoStore {
  files: FileInfo[]
  messages: MessageInfo[]
  routeMappings: RouteMapping[]

  setFiles: (files: FileInfo[]) => void
  setMessages: (messages: MessageInfo[]) => void
  setRouteMappings: (mappings: RouteMapping[]) => void
  addRouteMapping: (mapping: RouteMapping) => void
  removeRouteMapping: (route: number) => void
  getMessageByName: (name: string) => MessageInfo | undefined
}

export const useProtoStore = create<ProtoStore>((set, get) => ({
  files: [],
  messages: [],
  routeMappings: [],

  setFiles: (files) => set({ files }),
  setMessages: (messages) => set({ messages }),
  setRouteMappings: (mappings) => set({ routeMappings: mappings }),
  addRouteMapping: (mapping) =>
    set((s) => ({
      routeMappings: [
        ...s.routeMappings.filter((r) => r.route !== mapping.route),
        mapping,
      ],
    })),
  removeRouteMapping: (route) =>
    set((s) => ({
      routeMappings: s.routeMappings.filter((r) => r.route !== route),
    })),
  getMessageByName: (name) => get().messages.find((m) => m.Name === name),
}))
