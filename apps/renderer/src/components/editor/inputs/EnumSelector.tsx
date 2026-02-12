import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useProtoStore } from '@/stores/protoStore'

interface EnumSelectorProps {
  value: number
  onChange: (value: unknown) => void
  enumType: string
}

export function EnumSelector({ value, onChange, enumType }: EnumSelectorProps) {
  const files = useProtoStore((s) => s.files)

  // 查找 enum 定义
  let enumValues: { name: string; number: number }[] = []
  for (const file of files) {
    // 检查顶层 enum
    const found = file.Enums?.find((e) => e.name === enumType)
    if (found) {
      enumValues = found.values
      break
    }
    // 检查嵌套 enum（简化：只检查顶层 message 内的 enum）
    for (const msg of file.Messages || []) {
      const nested = msg.NestedEnums?.find((e) => e.name === enumType)
      if (nested) {
        enumValues = nested.values
        break
      }
    }
    if (enumValues.length > 0) break
  }

  return (
    <Select
      value={String(value)}
      onValueChange={(v) => onChange(parseInt(v))}
    >
      <SelectTrigger className="h-7 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {enumValues.map((ev) => (
          <SelectItem key={ev.number} value={String(ev.number)} className="text-xs">
            {ev.name} ({ev.number})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
