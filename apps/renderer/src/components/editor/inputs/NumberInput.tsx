import { Input } from '@/components/ui/input'

interface NumberInputProps {
  value: number | undefined
  onChange: (value: unknown) => void
  isFloat?: boolean
}

export function NumberInput({ value, onChange, isFloat }: NumberInputProps) {
  return (
    <Input
      type="number"
      value={value ?? ''}
      onChange={(e) => {
        const v = e.target.value
        if (v === '') {
          onChange(undefined)
        } else {
          onChange(isFloat ? parseFloat(v) : parseInt(v))
        }
      }}
      step={isFloat ? 'any' : '1'}
      className="h-7 text-xs font-mono"
    />
  )
}
