import { useCanvasStore } from '@/stores/canvasStore'
import { useProtoStore, type FieldInfo, type MessageInfo } from '@/stores/protoStore'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { NumberInput } from './inputs/NumberInput'
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
    <div className="space-y-3">
      <div className="text-xs font-medium text-foreground">
        {message.ShortName}
        <span className="ml-1 text-[10px] text-muted-foreground">
          Route: {node.data.route}
        </span>
      </div>

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
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">
          {field.name} <span className="text-[10px]">map&lt;{field.mapKey}, {field.mapValue}&gt;</span>
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
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">
          {field.name} <span className="text-[10px]">repeated {field.type}</span>
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
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">
          {field.name} <span className="text-[10px]">{field.type.split('.').pop()}</span>
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
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">
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
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">
        {field.name} <span className="text-[10px]">{field.type}</span>
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
          className="h-7 text-xs"
        />
      )
    case 'bytes':
      return (
        <Input
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          className="h-7 text-xs font-mono"
          placeholder="十六进制"
        />
      )
    case 'float':
    case 'double':
      return (
        <NumberInput
          value={value as number}
          onChange={onChange}
          isFloat
        />
      )
    default:
      // int32, int64, uint32, uint64, sint32, sint64, fixed32, fixed64, sfixed32, sfixed64
      return (
        <NumberInput
          value={value as number}
          onChange={onChange}
        />
      )
  }
}
