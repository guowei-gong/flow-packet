import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable'
import { cn } from '@/lib/utils'

interface MainLayoutProps {
  toolbar: React.ReactNode
  left: React.ReactNode
  center: React.ReactNode
  bottom: React.ReactNode
  showController?: boolean
}

export function MainLayout({
  toolbar,
  left,
  center,
  bottom,
  showController = true,
}: MainLayoutProps) {
  const [bottomCollapsed, setBottomCollapsed] = useState(false)

  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
      {/* 顶部工具栏 */}
      <div className="flex items-center h-10 px-3 shrink-0 border-b border-border">
        {toolbar}
      </div>

      {/* 中间两面板 */}
      <div className="flex-1 min-h-0">
        <ResizablePanelGroup direction="horizontal" className="h-full">
          {/* 左侧控制器 */}
          <ResizablePanel
            defaultSize={25}
            minSize={20}
            maxSize={showController ? 50 : 0}
            className={cn(
              'transition-[flex-grow] duration-500 bg-card',
              { 'min-w-[280px]': showController }
            )}
          >
            <div className="h-full overflow-auto">
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

          {/* 右侧画布 */}
          <ResizablePanel defaultSize={75}>
            <div className="w-full h-full relative overflow-hidden bg-background">
              {center}
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* 底部执行日志 */}
      <div
        className="shrink-0 flex flex-col border-t border-border bg-background"
        style={{
          height: bottomCollapsed ? 28 : 200,
          transition: 'height 0.15s ease',
        }}
      >
        <div
          className="flex items-center justify-between px-3 h-7 shrink-0 cursor-pointer select-none border-b border-border"
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
  )
}
