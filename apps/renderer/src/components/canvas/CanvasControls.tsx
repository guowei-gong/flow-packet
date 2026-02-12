import { useReactFlow } from '@xyflow/react'
import { ZoomIn, ZoomOut, Maximize } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function CanvasControls() {
  const { zoomIn, zoomOut, fitView } = useReactFlow()

  return (
    <div
      className="flex items-center gap-1 rounded-md border border-border"
      style={{
        position: 'absolute',
        left: 12,
        bottom: 12,
        zIndex: 5,
        background: 'var(--bg-panel)',
        padding: 2,
      }}
    >
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => zoomIn()}>
        <ZoomIn className="h-3.5 w-3.5" />
      </Button>
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => zoomOut()}>
        <ZoomOut className="h-3.5 w-3.5" />
      </Button>
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => fitView({ padding: 0.2 })}>
        <Maximize className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}
