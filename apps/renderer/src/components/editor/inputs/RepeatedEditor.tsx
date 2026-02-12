import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { FieldInfo, MessageInfo } from '@/stores/protoStore'
import { NestedEditor } from './NestedEditor'
import { NumberInput } from './NumberInput'

interface RepeatedEditorProps {
  value: unknown[]
  onChange: (value: unknown) => void
  field: FieldInfo
  getMessage: (name: string) => MessageInfo | undefined
}

export function RepeatedEditor({ value, onChange, field, getMessage }: RepeatedEditorProps) {
  const addItem = () => {
    const defaultValue = field.kind === 'message' ? {} : field.type === 'string' ? '' : 0
    onChange([...value, defaultValue])
  }

  const removeItem = (index: number) => {
    onChange(value.filter((_, i) => i !== index))
  }

  const updateItem = (index: number, v: unknown) => {
    const updated = [...value]
    updated[index] = v
    onChange(updated)
  }

  return (
    <div
      className="rounded border p-1.5 space-y-1 border-border"
    >
      {value.map((item, i) => (
        <div key={i} className="flex items-start gap-1">
          <span className="text-[10px] shrink-0 pt-1 text-muted-foreground">
            [{i}]
          </span>
          <div className="flex-1">
            {field.kind === 'message' ? (
              <NestedEditor
                value={(item as Record<string, unknown>) || {}}
                onChange={(v) => updateItem(i, v)}
                message={getMessage(field.type)}
                getMessage={getMessage}
              />
            ) : field.type === 'string' || field.type === 'bytes' ? (
              <Input
                value={(item as string) ?? ''}
                onChange={(e) => updateItem(i, e.target.value)}
                className="h-6 text-[10px]"
              />
            ) : (
              <NumberInput
                value={item as number}
                onChange={(v) => updateItem(i, v)}
              />
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-5 w-5 p-0 shrink-0"
            onClick={() => removeItem(i)}
          >
            <Trash2 className="w-3 h-3" style={{ color: 'var(--status-error)' }} />
          </Button>
        </div>
      ))}

      <Button variant="ghost" size="sm" className="h-6 w-full text-[10px]" onClick={addItem}>
        <Plus className="w-3 h-3 mr-1" /> 添加
      </Button>
    </div>
  )
}
