export interface FrameField {
  name: string
  bytes: number
}

export interface FrameConfig {
  type: 'template' | 'custom'
  templateId?: string
  fields: FrameField[]
}

export interface FrameTemplate {
  id: string
  name: string
  github: string
  fields: FrameField[]
}

const CUSTOM_TEMPLATES_KEY = 'flow-packet-custom-templates'

export function loadCustomTemplates(): FrameTemplate[] {
  try {
    const raw = localStorage.getItem(CUSTOM_TEMPLATES_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveCustomTemplate(name: string, fields: FrameField[]): FrameTemplate {
  const template: FrameTemplate = {
    id: `custom_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name,
    github: '',
    fields,
  }
  const existing = loadCustomTemplates()
  existing.push(template)
  localStorage.setItem(CUSTOM_TEMPLATES_KEY, JSON.stringify(existing))
  return template
}

export const FRAME_TEMPLATES: FrameTemplate[] = [
  {
    id: 'due',
    name: 'Due',
    github: 'https://github.com/dobyte/due',
    fields: [
      { name: 'size', bytes: 4 },
      { name: 'header', bytes: 1 },
      { name: 'route', bytes: 2 },
      { name: 'seq', bytes: 2 },
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
      { name: 'cmd', bytes: 1 },
      { name: 'act', bytes: 1 },
      { name: 'index', bytes: 2 },
      { name: 'flags', bytes: 2 },
    ],
  },
]
