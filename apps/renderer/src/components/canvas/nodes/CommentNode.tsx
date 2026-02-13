import { useState, useRef, useCallback, useEffect } from 'react'
import { NodeResizer, type NodeProps, type Node } from '@xyflow/react'
import { Palette } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { CommentNodeData } from '@/stores/canvasStore'
import { useCanvasStore } from '@/stores/canvasStore'

export function CommentNode({ id, data, selected }: NodeProps<Node<CommentNodeData>>) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(data.label)
  const inputRef = useRef<HTMLInputElement>(null)
  const updateNodeData = useCanvasStore((s) => s.updateNodeData)

  const color = data.color || '#9B8E7B'
  // 主体区域使用标题色的 10% 不透明度
  const bodyColor = `${color}1A`

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editing])

  const commitLabel = useCallback(() => {
    setEditing(false)
    const trimmed = draft.trim()
    if (trimmed && trimmed !== data.label) {
      updateNodeData(id, { label: trimmed })
    } else {
      setDraft(data.label)
    }
  }, [draft, data.label, id, updateNodeData])

  const onDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setDraft(data.label)
    setEditing(true)
  }, [data.label])

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // 阻止冒泡，避免 Backspace/Delete 等键被外层 FlowCanvas 捕获删除节点
      e.stopPropagation()
      if (e.key === 'Enter') {
        e.preventDefault()
        commitLabel()
      }
      if (e.key === 'Escape') {
        setEditing(false)
        setDraft(data.label)
      }
    },
    [commitLabel, data.label]
  )

  const onColorChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateNodeData(id, { color: e.target.value })
    },
    [id, updateNodeData]
  )

  return (
    <>
      <NodeResizer
        isVisible={selected}
        minWidth={200}
        minHeight={80}
        lineStyle={{ borderColor: color }}
        handleStyle={{ backgroundColor: color, width: 8, height: 8 }}
      />
      <Card
        className={cn(
          'rounded-[12px] p-0 gap-0 w-full h-full',
          selected && 'ring-1 ring-primary',
        )}
        style={{ background: bodyColor }}
      >
        {/* 标题栏 */}
        <div
          className="rounded-t-[12px] flex items-center gap-2 px-3 py-1.5"
          style={{ background: color }}
          onDoubleClick={onDoubleClick}
        >
          {editing ? (
            <input
              ref={inputRef}
              className="flex-1 bg-transparent text-sm font-bold text-white outline-none border-b border-white/50"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitLabel}
              onKeyDown={onKeyDown}
            />
          ) : (
            <span className="flex-1 truncate text-sm font-bold text-white select-none">
              {data.label}
            </span>
          )}
          {/* 颜色选择器 */}
          <label className="shrink-0 cursor-pointer flex items-center" onClick={(e) => e.stopPropagation()}>
            <Palette className="size-3.5 text-white/70 hover:text-white transition-colors" />
            <input
              type="color"
              value={color}
              onChange={onColorChange}
              className="sr-only"
            />
          </label>
        </div>
      </Card>
    </>
  )
}
