import { useState, useCallback, useRef, useEffect } from 'react'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable'
import { cn } from '@/lib/utils'

interface MainLayoutProps {
  left: React.ReactNode
  center: React.ReactNode
  bottom: React.ReactNode
  tabs?: React.ReactNode
  showController?: boolean
}

const DEFAULT_BOTTOM_HEIGHT = 200
const MIN_DRAG_HEIGHT = 80

export function MainLayout({
  left,
  center,
  bottom,
  tabs,
  showController = true,
}: MainLayoutProps) {
  const [bottomHeight, setBottomHeight] = useState(DEFAULT_BOTTOM_HEIGHT)
  const dragging = useRef(false)
  const startY = useRef(0)
  const startHeight = useRef(0)
  const containerRef = useRef<HTMLDivElement>(null)

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragging.current = true
    startY.current = e.clientY
    startHeight.current = bottomHeight
    document.body.style.cursor = 'ns-resize'
    document.body.style.userSelect = 'none'
  }, [bottomHeight])

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return
      const delta = startY.current - e.clientY
      const maxHeight = containerRef.current.clientHeight - 60
      const newHeight = Math.min(maxHeight, Math.max(MIN_DRAG_HEIGHT, startHeight.current + delta))
      setBottomHeight(newHeight)
    }

    const onMouseUp = () => {
      if (!dragging.current) return
      dragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  return (
    <ResizablePanelGroup direction="horizontal" className="h-full w-full">
      {/* 左侧控制器 - 全高 */}
      <ResizablePanel
        defaultSize={18}
        minSize={15}
        maxSize={showController ? 50 : 0}
        className={cn(
          '',
          { 'min-w-[280px]': showController }
        )}
      >
        <div className="h-full overflow-auto" style={{ background: 'var(--bg-controller)' }}>
          {left}
        </div>
      </ResizablePanel>

      <ResizableHandle
        disabled={!showController}
        className={cn(
          'cursor-ew-resize hover:bg-primary/50 active:bg-primary transition-colors duration-200',
          !showController && 'hidden'
        )}
      />

      {/* 右侧：画布 + 底部日志 */}
      <ResizablePanel defaultSize={82}>
        <div ref={containerRef} className="flex flex-col h-full">
          {tabs}
          <div className="flex-1 min-h-0 relative overflow-hidden" style={{ background: 'var(--bg-canvas)' }}>
            {center}
          </div>

          {/* 底部执行日志 */}
          <div
            className="shrink-0 flex flex-col border-t border-border"
            style={{
              background: 'var(--bg-panel)',
              height: bottomHeight,
            }}
          >
            {/* 拖拽手柄 */}
            <div
              className="h-1 shrink-0 cursor-ns-resize hover:bg-primary/50 active:bg-primary transition-colors duration-200"
              onMouseDown={onMouseDown}
            />
            <div
              className="flex items-center h-7 shrink-0 select-none border-b border-border"
              style={{ padding: '0 12px 0 22px' }}
            >
              <span className="text-xs font-medium text-muted-foreground">
                执行日志
              </span>
            </div>
            <div className="flex-1 overflow-auto">
              {bottom}
            </div>
          </div>
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}
