import { Handle, Position, type NodeProps, type Node } from '@xyflow/react'
import type { RequestNodeData } from '@/stores/canvasStore'
import { useExecutionStore } from '@/stores/executionStore'

const pinColors: Record<string, string> = {
  string: 'var(--pin-string)',
  int32: 'var(--pin-int)',
  int64: 'var(--pin-int)',
  uint32: 'var(--pin-int)',
  uint64: 'var(--pin-int)',
  float: 'var(--pin-int)',
  double: 'var(--pin-int)',
  bool: 'var(--pin-bool)',
}

function getPinColor(type: string): string {
  return pinColors[type] || 'var(--pin-message)'
}

export function RequestNode({ id, data, selected }: NodeProps<Node<RequestNodeData>>) {
  const nodeStatus = useExecutionStore((s) => s.nodeStatuses[id])

  const shortName = data.messageName.split('.').pop() || data.messageName

  let borderColor = 'transparent'
  if (selected) borderColor = '#1B6EF3'
  if (nodeStatus?.status === 'running') borderColor = 'var(--status-warning)'
  if (nodeStatus?.status === 'success') borderColor = 'var(--status-success)'
  if (nodeStatus?.status === 'error') borderColor = 'var(--status-error)'

  return (
    <div
      className="rounded-lg overflow-hidden min-w-[180px]"
      style={{
        background: 'var(--node-bg)',
        border: `2px solid ${borderColor}`,
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
      }}
    >
      {/* 标题栏 */}
      <div
        className="px-3 py-1.5 flex items-center gap-2"
        style={{ background: 'var(--node-title-request)' }}
      >
        <span className="text-xs font-semibold text-white truncate">{shortName}</span>
        <span className="text-[10px] text-white/60 ml-auto">R:{data.route}</span>
      </div>

      {/* 内容区 */}
      <div className="relative px-3 py-2">
        {/* Exec In Handle (左侧) */}
        <Handle
          type="target"
          position={Position.Left}
          id="exec-in"
          style={{
            background: 'var(--edge-exec)',
            width: 10,
            height: 10,
            border: '2px solid var(--node-bg)',
            left: -6,
            top: '50%',
          }}
        />

        {/* Exec Out Handle (右侧) */}
        <Handle
          type="source"
          position={Position.Right}
          id="exec-out"
          style={{
            background: 'var(--edge-exec)',
            width: 10,
            height: 10,
            border: '2px solid var(--node-bg)',
            right: -6,
            top: '50%',
          }}
        />

        {/* 字段预览 */}
        <div className="space-y-0.5">
          {data.responseFields?.slice(0, 5).map((field) => (
            <div key={field.name} className="flex items-center gap-1.5">
              <div
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ background: getPinColor(field.type) }}
              />
              <span className="text-[10px] text-muted-foreground">
                {field.name}
              </span>
              <span className="text-[10px] ml-auto text-muted-foreground">
                {fieldPreview(data.fields[field.name])}
              </span>
            </div>
          ))}
          {!data.responseFields?.length && (
            <span className="text-[10px] text-muted-foreground">
              无字段定义
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

function fieldPreview(value: unknown): string {
  if (value === undefined || value === null) return '—'
  if (typeof value === 'string') {
    return value.length > 12 ? value.slice(0, 12) + '...' : value
  }
  if (typeof value === 'object') return '{...}'
  return String(value)
}
