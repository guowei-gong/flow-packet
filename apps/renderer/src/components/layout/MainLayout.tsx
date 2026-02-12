import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
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
  showController?: boolean
}

export function MainLayout({
  left,
  center,
  bottom,
  showController = true,
}: MainLayoutProps) {
  const [bottomCollapsed, setBottomCollapsed] = useState(false)

  return (
    <ResizablePanelGroup direction="horizontal" className="h-full w-full">
      {/* 左侧控制器 - 全高 */}
      <ResizablePanel
        defaultSize={18}
        minSize={15}
        maxSize={showController ? 50 : 0}
        className={cn(
          'transition-[flex-grow] duration-500',
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
        <div className="flex flex-col h-full">
          <div className="flex-1 min-h-0 relative overflow-hidden" style={{ background: 'var(--bg-canvas)' }}>
            {center}
          </div>

          {/* 底部执行日志 */}
          <div
            className="shrink-0 flex flex-col border-t border-border"
            style={{
              background: 'var(--bg-panel)',
              height: bottomCollapsed ? 28 : 200,
              transition: 'height 0.15s ease',
            }}
          >
            <div
              className="flex items-center justify-between h-7 shrink-0 cursor-pointer select-none border-b border-border"
              style={{ padding: '0 12px 0 22px' }}
              onClick={() => setBottomCollapsed(!bottomCollapsed)}
            >
              <span className="text-xs font-medium text-muted-foreground">
                执行日志
              </span>
              {bottomCollapsed ? (
                <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
              )}
            </div>
            {!bottomCollapsed && (
              <div className="flex-1 overflow-auto">
                {bottom}
              </div>
            )}
          </div>
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}
