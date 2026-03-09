import { getTemplateList, saveTemplate } from '@/services/api'

export interface FrameField {
  name: string
  bytes: number
  isRoute?: boolean
  isSeq?: boolean
}

export type ByteOrder = 'big' | 'little'

export interface FrameConfig {
  type: 'template' | 'custom'
  templateId?: string
  fields: FrameField[]
  byteOrder: ByteOrder
}

export interface FrameTemplate {
  id: string
  name: string
  github: string
  fields: FrameField[]
  byteOrder?: ByteOrder
}

export async function loadCustomTemplates(): Promise<FrameTemplate[]> {
  try {
    const res = await getTemplateList() as { templates: FrameTemplate[] }
    return res.templates ?? []
  } catch {
    return []
  }
}

export async function saveCustomTemplate(name: string, fields: FrameField[], byteOrder?: ByteOrder): Promise<FrameTemplate> {
  const res = await saveTemplate(name, fields, byteOrder) as { template: FrameTemplate }
  return res.template
}

export function formatFramePreview(fields: FrameField[]) {
  return fields.map((f) => {
    const prefix = f.isRoute ? '*' : f.isSeq ? '^' : ''
    return `${prefix}${f.name}(${f.bytes}B)`
  }).join(' + ')
}

/**
 * 多个路由字段值 → 单一 uint32（按字段顺序大端拼接）
 * 如 cmd=1(1B) + act=2(1B) → (1 << 8) | 2 = 258
 */
export function combineRoute(values: Record<string, number>, fields: FrameField[]): number {
  const routeFields = fields.filter((f) => f.isRoute)
  let result = 0
  for (const f of routeFields) {
    result = (result << (f.bytes * 8)) | ((values[f.name] ?? 0) & ((1 << (f.bytes * 8)) - 1))
  }
  return result >>> 0
}

/**
 * 单一 uint32 → 各字段值
 * 如 258 → { cmd: 1, act: 2 }（对于 cmd(1B) + act(1B) 的路由定义）
 */
export function splitRoute(combined: number, fields: FrameField[]): Record<string, number> {
  const routeFields = fields.filter((f) => f.isRoute)
  const result: Record<string, number> = {}
  let value = combined >>> 0
  for (let i = routeFields.length - 1; i >= 0; i--) {
    const f = routeFields[i]
    const mask = (1 << (f.bytes * 8)) - 1
    result[f.name] = value & mask
    value = value >>> (f.bytes * 8)
  }
  return result
}

export const FRAME_TEMPLATES: FrameTemplate[] = [
  {
    id: 'due',
    name: 'Due',
    github: 'https://github.com/dobyte/due',
    fields: [
      { name: 'size', bytes: 4 },
      { name: 'header', bytes: 1 },
      { name: 'route', bytes: 2, isRoute: true },
      { name: 'seq', bytes: 2, isSeq: true },
    ],
  },
  {
    id: 'skynet',
    name: 'Skynet',
    github: 'https://github.com/cloudwu/skynet',
    fields: [
      { name: 'size', bytes: 2 },
    ],
  },
  {
    id: 'tgf',
    name: 'TGF',
    github: 'https://github.com/thkhxm/tgf',
    fields: [
      { name: 'magic', bytes: 1 },
      { name: 'type', bytes: 1 },
      { name: 'methodSize', bytes: 2 },
      { name: 'dataSize', bytes: 2 },
    ],
  },
  {
    id: 'cherry',
    name: 'Cherry',
    github: 'https://github.com/cherry-game/cherry',
    fields: [
      { name: 'mid', bytes: 4 },
      { name: 'len', bytes: 4 },
    ],
  },
  {
    id: 'antnet',
    name: 'Antnet',
    github: 'https://github.com/magiclvzs/antnet',
    fields: [
      { name: 'len', bytes: 4 },
      { name: 'error', bytes: 2 },
      { name: 'cmd', bytes: 1, isRoute: true },
      { name: 'act', bytes: 1, isRoute: true },
      { name: 'index', bytes: 2, isSeq: true },
      { name: 'flags', bytes: 2 },
    ],
  },
]
