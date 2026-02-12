import { Handle, Position, type NodeProps, type Node } from '@xyflow/react'
import { Box } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
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

  const isRunning = nodeStatus?.status === 'running'
  const isSuccess = nodeStatus?.status === 'success'
  const isError = nodeStatus?.status === 'error'

  let statusColor = ''
  if (isRunning) statusColor = 'var(--status-warning)'
  else if (isSuccess) statusColor = 'var(--status-success)'
  else if (isError) statusColor = 'var(--status-error)'

  return (
    <Card
      className={cn(
        'rounded-[12px] p-0.5 gap-0 transition-all duration-200',
        isRunning && 'node-pulse',
        selected && !statusColor && 'ring-1 ring-primary',
      )}
      style={{
        minWidth: 220,
        ...(statusColor ? { boxShadow: `0 0 0 1px ${statusColor}` } : {}),
      }}
    >
      {/* 标题栏 — UE5 蓝图风格 */}
      <div
        className="group rounded-t rounded-t-md bg-primary/10"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 10px',
          marginBottom: 0,
        }}
      >
        {/* Exec In — 标题栏左侧的视觉圆点 */}
        <div style={{
          width: 10,
          height: 10,
          borderRadius: '50%',
          background: 'var(--edge-exec)',
          border: '2px solid var(--card)',
          flexShrink: 0,
        }} />

        <Box className="size-3.5 shrink-0 text-primary" />
        <span className="w-full truncate text-sm font-bold text-primary" style={{ padding: '2px 0' }}>
          {shortName}
        </span>

        {/* Exec Out — 标题栏右侧的视觉圆点 */}
        <div style={{
          width: 10,
          height: 10,
          borderRadius: '50%',
          background: 'var(--edge-exec)',
          border: '2px solid var(--card)',
          flexShrink: 0,
        }} />
      </div>

      {/* 字段列表 */}
      <CardContent className="p-0 mt-0">
        {data.responseFields?.slice(0, 10).map((field) => (
          <div
            key={field.name}
            className="group relative hover:bg-secondary transition-all duration-200 ease-in-out"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 4,
              padding: '0 6px',
              height: 32,
              fontSize: 14,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
              <div
                className="shrink-0"
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: getPinColor(field.type),
                }}
              />
              <span className="truncate text-xs text-foreground">{field.name}</span>
            </div>
            <span className="text-xs text-muted-foreground shrink-0">{field.type}</span>
          </div>
        ))}
        {(!data.responseFields || data.responseFields.length === 0) && (
          <div style={{ display: 'flex', alignItems: 'center', height: 32, padding: '0 6px' }}>
            <span className="text-xs text-muted-foreground">无字段定义</span>
          </div>
        )}
        {data.responseFields && data.responseFields.length > 10 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 32 }}>
            <span className="text-xs text-muted-foreground">
              +{data.responseFields.length - 10} 更多字段
            </span>
          </div>
        )}
      </CardContent>

      {/*
        真正的 ReactFlow Handle — 绝对定位，覆盖在视觉圆点上方
        top = Card p-0.5(2px) + 标题栏 padding-top(6px) + 内容半高(~10px) = 18px
        left/right = Card p-0.5(2px) + 标题栏 padding-x(10px) 中心 ≈ 7px
      */}
      <Handle
        type="target"
        position={Position.Left}
        id="exec-in"
        style={{
          top: 18,
          left: 10,
          width: 16,
          height: 16,
          background: 'transparent',
          border: 'none',
          borderRadius: '50%',
        }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="exec-out"
        style={{
          top: 18,
          right: 10,
          width: 16,
          height: 16,
          background: 'transparent',
          border: 'none',
          borderRadius: '50%',
        }}
      />
    </Card>
  )
}
