import { useCanvasStore } from '@/stores/canvasStore'
import { useProtoStore, type FieldInfo, type MessageInfo } from '@/stores/protoStore'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { EnumSelector } from './inputs/EnumSelector'
import { NestedEditor } from './inputs/NestedEditor'
import { RepeatedEditor } from './inputs/RepeatedEditor'
import { OneofEditor } from './inputs/OneofEditor'
import { MapEditor } from './inputs/MapEditor'

interface FieldEditorProps {
  nodeId: string
}

export function FieldEditor({ nodeId }: FieldEditorProps) {
  const node = useCanvasStore((s) => s.nodes.find((n) => n.id === nodeId))
  const updateNodeData = useCanvasStore((s) => s.updateNodeData)
  const getMessageByName = useProtoStore((s) => s.getMessageByName)

  if (!node) return null

  const message = getMessageByName(node.data.messageName)
  if (!message) {
    return (
      <div className="text-xs text-muted-foreground">
        未找到 Message 定义: {node.data.messageName}
      </div>
    )
  }

  const setFieldValue = (name: string, value: unknown) => {
    updateNodeData(nodeId, {
      fields: { ...node.data.fields, [name]: value },
    })
  }

  return (
    <div className="grid gap-3">
      <div className="grid gap-2">
        <Label htmlFor={`route-${nodeId}`}>路由</Label>
        <Input
          id={`route-${nodeId}`}
          value={node.data.route ?? 0}
          onChange={(e) => updateNodeData(nodeId, { route: Number(e.target.value) })}
        />
      </div>

      <Separator />

      {message.Fields?.map((field) => (
        <FieldInput
          key={field.name}
          field={field}
          value={node.data.fields[field.name]}
          onChange={(v) => setFieldValue(field.name, v)}
          getMessage={getMessageByName}
        />
      ))}
    </div>
  )
}

interface FieldInputProps {
  field: FieldInfo
  value: unknown
  onChange: (value: unknown) => void
  getMessage: (name: string) => MessageInfo | undefined
}

function FieldInput({ field, value, onChange, getMessage }: FieldInputProps) {
  // Oneof 字段由 OneofEditor 处理
  if (field.oneofName) return null

  // Map 类型
  if (field.isMap) {
    return (
      <div className="grid gap-2">
        <Label>
          {field.name} <span className="text-xs text-muted-foreground">map&lt;{field.mapKey}, {field.mapValue}&gt;</span>
        </Label>
        <MapEditor
          value={(value as Record<string, unknown>) || {}}
          onChange={onChange}
          keyType={field.mapKey || 'string'}
          valueType={field.mapValue || 'string'}
        />
      </div>
    )
  }

  // Repeated 类型
  if (field.isRepeated) {
    return (
      <div className="grid gap-2">
        <Label>
          {field.name} <span className="text-xs text-muted-foreground">repeated {field.type}</span>
        </Label>
        <RepeatedEditor
          value={(value as unknown[]) || []}
          onChange={onChange}
          field={field}
          getMessage={getMessage}
        />
      </div>
    )
  }

  // 嵌套 message
  if (field.kind === 'message') {
    const msgDef = getMessage(field.type)
    return (
      <div className="grid gap-2">
        <Label>
          {field.name} <span className="text-xs text-muted-foreground">{field.type.split('.').pop()}</span>
        </Label>
        <NestedEditor
          value={(value as Record<string, unknown>) || {}}
          onChange={onChange}
          message={msgDef}
          getMessage={getMessage}
        />
      </div>
    )
  }

  // Enum
  if (field.kind === 'enum') {
    return (
      <div className="grid gap-2">
        <Label>
          {field.name}
        </Label>
        <EnumSelector
          value={(value as number) ?? 0}
          onChange={onChange}
          enumType={field.type}
        />
      </div>
    )
  }

  // 标量类型
  return (
    <div className="grid gap-2">
      <Label>
        {field.name} <span className="text-xs text-muted-foreground">{field.type}</span>
      </Label>
      <ScalarInput type={field.type} value={value} onChange={onChange} />
    </div>
  )
}

function ScalarInput({
  type,
  value,
  onChange,
}: {
  type: string
  value: unknown
  onChange: (v: unknown) => void
}) {
  switch (type) {
    case 'bool':
      return (
        <Switch
          checked={!!value}
          onCheckedChange={(v) => onChange(v)}
        />
      )
    case 'string':
      return (
        <Input
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
        />
      )
    case 'bytes':
      return (
        <Input
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          className="font-mono"
          placeholder="十六进制"
        />
      )
    case 'float':
    case 'double':
      return (
        <Input
          value={(value as number) ?? ''}
          onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
        />
      )
    default:
      // int32, int64, uint32, uint64, sint32, sint64, fixed32, fixed64, sfixed32, sfixed64
      return (
        <Input
          value={(value as number) ?? ''}
          onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
        />
      )
  }
}
