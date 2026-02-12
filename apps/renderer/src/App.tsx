import { useEffect } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { SidebarProvider } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/layout/AppSidebar'
import { MainLayout } from '@/components/layout/MainLayout'
import { Toolbar } from '@/components/layout/Toolbar'
import { ProtoBrowser } from '@/components/proto/ProtoBrowser'
import { RouteMapping } from '@/components/proto/RouteMapping'
import { FlowCanvas } from '@/components/canvas/FlowCanvas'
import { PropertySheet } from '@/components/editor/PropertySheet'
import { LogPanel } from '@/components/execution/LogPanel'
import { initEventBindings } from '@/services/eventBindings'
import { connect as wsConnect, setConnectionStatusCallback } from '@/services/ws'

function App() {
  useEffect(() => {
    const cleanup = initEventBindings()

    const initBackend = async () => {
      let port = 58996
      const fp = (window as { flowPacket?: { getBackendPort: () => Promise<number> } }).flowPacket
      if (fp) {
        try {
          port = await fp.getBackendPort()
        } catch {
          // fallback to default
        }
      }

      setConnectionStatusCallback((connected) => {
        if (connected) {
          console.log('[ws] connected to backend')
        }
      })

      ;(window as { __BACKEND_PORT__?: number }).__BACKEND_PORT__ = port
      wsConnect(port)
    }

    initBackend()

    return cleanup
  }, [])

  return (
    <ReactFlowProvider>
      <SidebarProvider open={false} onOpenChange={() => {}}>
        <div className="flex h-svh flex-col w-full">
          {/* 顶部工具栏 - 全宽最高层级 */}
          <div className="flex items-center h-10 px-3 shrink-0 border-b border-border" style={{ background: 'var(--bg-toolbar)' }}>
            <Toolbar />
          </div>

          {/* 下方区域：导航栏 + 内容 */}
          <div className="flex flex-1 min-h-0">
            <AppSidebar />
            <div className="flex-1 min-w-0">
              <MainLayout
                left={
                  <div className="flex flex-col h-full overflow-hidden">
                    <div className="flex-1 min-h-0 overflow-auto">
                      <ProtoBrowser />
                    </div>
                    <div className="shrink-0 max-h-[40%] overflow-auto border-t border-border" style={{ paddingLeft: 10 }}>
                      <div className="flex items-center px-2 h-7 shrink-0 border-b border-border">
                        <span className="text-xs font-medium text-muted-foreground">
                          Route 映射
                        </span>
                      </div>
                      <RouteMapping />
                    </div>
                  </div>
                }
                center={<FlowCanvas />}
                bottom={<LogPanel />}
              />
            </div>
          </div>
        </div>
        <PropertySheet />
      </SidebarProvider>
    </ReactFlowProvider>
  )
}

export default App
