import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NumberInput } from './NumberInput'

interface MapEditorProps {
  value: Record<string, unknown>
  onChange: (value: unknown) => void
  keyType: string
  valueType: string
}

export function MapEditor({ value, onChange, keyType, valueType }: MapEditorProps) {
  const entries = Object.entries(value)

  const addEntry = () => {
    const key = `key${entries.length}`
    const defaultValue = valueType === 'string' ? '' : 0
    onChange({ ...value, [key]: defaultValue })
  }

  const removeEntry = (key: string) => {
    const updated = { ...value }
    delete updated[key]
    onChange(updated)
  }

  const updateKey = (oldKey: string, newKey: string) => {
    if (newKey === oldKey) return
    const updated: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) {
      updated[k === oldKey ? newKey : k] = v
    }
    onChange(updated)
  }

  const updateValue = (key: string, v: unknown) => {
    onChange({ ...value, [key]: v })
  }

  return (
    <div className="rounded border p-1.5 space-y-1 border-border">
      {entries.map(([key, val]) => (
        <div key={key} className="flex items-center gap-1">
          <Input
            value={key}
            onChange={(e) => updateKey(key, e.target.value)}
            className="h-6 text-[10px] w-20"
            placeholder={keyType}
          />
          <span className="text-[10px] text-muted-foreground">:</span>
          {valueType === 'string' ? (
            <Input
              value={(val as string) ?? ''}
              onChange={(e) => updateValue(key, e.target.value)}
              className="h-6 text-[10px] flex-1"
            />
          ) : (
            <div className="flex-1">
              <NumberInput
                value={val as number}
                onChange={(v) => updateValue(key, v)}
              />
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-5 w-5 p-0"
            onClick={() => removeEntry(key)}
          >
            <Trash2 className="w-3 h-3" style={{ color: 'var(--status-error)' }} />
          </Button>
        </div>
      ))}

      <Button variant="ghost" size="sm" className="h-6 w-full text-[10px]" onClick={addEntry}>
        <Plus className="w-3 h-3 mr-1" /> 添加
      </Button>
    </div>
  )
}
