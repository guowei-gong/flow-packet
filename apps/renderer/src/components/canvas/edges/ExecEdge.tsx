import { getSmoothStepPath, type EdgeProps } from '@xyflow/react'
import { cn } from '@/lib/utils'

export function ExecEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
  selected,
}: EdgeProps) {
  const [edgePath] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 6,
  })

  return (
    <>
      {/* 不可见的宽命中区域，方便点击选中 */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={14}
        className="react-flow__edge-interaction"
      />
      <path
        id={id}
        className={cn(
          'react-flow__edge-path',
          selected
            ? '!stroke-ring dark:!stroke-primary-foreground'
            : 'stroke-ring/60 dark:!stroke-muted-foreground',
        )}
        d={edgePath}
        markerEnd={markerEnd}
        fill="none"
        style={{
          ...style,
          strokeWidth: selected ? 2.5 : 2,
          strokeDasharray: selected ? '5, 5' : '0',
          animation: selected ? 'edge-dash 0.5s linear infinite' : 'none',
        }}
      />
    </>
  )
}
