import { Play, Square, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ThemeToggle } from '@/components/layout/ThemeToggle'
import { useConnectionStore } from '@/stores/connectionStore'
import { useExecutionStore } from '@/stores/executionStore'
import { executeFlow, stopFlow } from '@/services/api'
import { useCanvasStore } from '@/stores/canvasStore'

const stateColors: Record<string, string> = {
  disconnected: 'hsl(var(--muted-foreground))',
  connecting: 'var(--status-warning)',
  connected: 'var(--status-success)',
  reconnecting: 'var(--status-warning)',
}

const stateLabels: Record<string, string> = {
  disconnected: '未连接',
  connecting: '连接中...',
  connected: '已连接',
  reconnecting: '重连中...',
}

interface ToolbarProps {
  onBack?: () => void
}

export function Toolbar({ onBack }: ToolbarProps) {
  const connState = useConnectionStore((s) => s.state)
  const targetAddr = useConnectionStore((s) => s.targetAddr)
  const execStatus = useExecutionStore((s) => s.status)
  const nodes = useCanvasStore((s) => s.nodes)
  const edges = useCanvasStore((s) => s.edges)

  const isRunning = execStatus === 'running'
  const isConnected = connState === 'connected'

  const handleRun = async () => {
    if (!isConnected || isRunning || nodes.length === 0) return
    try {
      const flowNodes = nodes.map((n) => ({
        id: n.id,
        messageName: n.data.messageName,
        route: n.data.route,
        fields: n.data.fields,
      }))
      const flowEdges = edges
        .filter((e) => e.type === 'execEdge')
        .map((e) => ({ source: e.source, target: e.target }))
      await executeFlow(flowNodes, flowEdges)
    } catch {
      // handled by event
    }
  }

  const handleStop = async () => {
    try {
      await stopFlow()
    } catch {
      // ignore
    }
  }

  return (
    <div className="flex items-center gap-2 w-full">
      {onBack && (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={onBack}
        >
          <ArrowLeft className="w-3.5 h-3.5" />
        </Button>
      )}
      <span className="text-sm font-semibold text-foreground">
        FlowPacket
      </span>

      <div className="flex-1" />

      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2 gap-1"
        disabled={!isConnected || isRunning || nodes.length === 0}
        onClick={handleRun}
      >
        <Play className="w-3.5 h-3.5" style={{ color: 'var(--status-success)' }} />
        <span className="text-xs">运行</span>
      </Button>

      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2 gap-1"
        disabled={!isRunning}
        onClick={handleStop}
      >
        <Square className="w-3.5 h-3.5" style={{ color: 'var(--status-error)' }} />
        <span className="text-xs">停止</span>
      </Button>

      <div className="flex items-center gap-1.5">
        <div
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: stateColors[connState] }}
        />
        <Badge variant="outline" className="h-5 text-[10px] px-1.5">
          {stateLabels[connState]}
          {isConnected && targetAddr && (
            <span className="ml-1 opacity-60">{targetAddr}</span>
          )}
        </Badge>
      </div>

      <ThemeToggle />
    </div>
  )
}
