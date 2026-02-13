import { useEffect, useState, useCallback } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import type { Node } from '@xyflow/react'
import { SidebarProvider } from '@/components/ui/sidebar'
import { AppSidebar, type SidebarTab } from '@/components/layout/AppSidebar'
import { MainLayout } from '@/components/layout/MainLayout'
import { CanvasTabs } from '@/components/layout/CanvasTabs'
import { Toolbar } from '@/components/layout/Toolbar'
import { ProtoBrowser } from '@/components/proto/ProtoBrowser'
import { CollectionBrowser } from '@/components/collection/CollectionBrowser'
import { RouteMapping } from '@/components/proto/RouteMapping'
import { FlowCanvas } from '@/components/canvas/FlowCanvas'
import { PropertySheet } from '@/components/editor/PropertySheet'
import { LogPanel } from '@/components/execution/LogPanel'
import { initEventBindings } from '@/services/eventBindings'
import { connect as wsConnect, setConnectionStatusCallback } from '@/services/ws'
import { useTabStore } from '@/stores/tabStore'
import { useCanvasStore, type RequestNodeData } from '@/stores/canvasStore'
import { useProtoStore } from '@/stores/protoStore'

function App() {
  const [activeTab, setActiveTab] = useState<SidebarTab>('画布')
  const activeTabId = useTabStore((s) => s.activeTabId)
  const addTab = useTabStore((s) => s.addTab)
  const addNode = useCanvasStore((s) => s.addNode)
  const routeMappings = useProtoStore((s) => s.routeMappings)

  const onEmptyDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }, [])

  const onEmptyDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const data = e.dataTransfer.getData('application/flow-packet-message')
    if (!data) return
    try {
      const message = JSON.parse(data)
      const mapping = routeMappings.find((m) => m.requestMsg === message.Name)
      addTab()
      const newNode: Node<RequestNodeData> = {
        id: `node_${Date.now()}`,
        type: 'requestNode',
        position: { x: 200, y: 150 },
        data: {
          messageName: message.Name,
          route: mapping?.route ?? 0,
          fields: {},
          responseFields: message.Fields?.map((f: { name: string; type: string }) => ({
            name: f.name,
            type: f.type,
          })),
        },
      }
      addNode(newNode)
    } catch {
      // ignore
    }
  }, [addTab, addNode, routeMappings])

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
            <AppSidebar activeTab={activeTab} onTabChange={setActiveTab} />
            <div className="flex-1 min-w-0">
              <MainLayout
                left={
                  <div className="flex flex-col h-full overflow-hidden">
                    <div className="flex-1 min-h-0 overflow-auto">
                      {activeTab === '集合' ? <CollectionBrowser /> : <ProtoBrowser />}
                    </div>
                    <div className="shrink-0 max-h-[40%] overflow-auto border-t border-border" style={{ paddingLeft: 10 }}>
                      <div className="flex items-center px-2 h-7 shrink-0">
                        <span className="text-xs font-medium text-muted-foreground">
                          Route 映射
                        </span>
                      </div>
                      <RouteMapping />
                    </div>
                  </div>
                }
                tabs={<CanvasTabs />}
                center={
                  activeTabId ? (
                    <FlowCanvas />
                  ) : (
                    <div
                      className="flex items-center justify-center h-full text-muted-foreground text-sm"
                      onDragOver={onEmptyDragOver}
                      onDrop={onEmptyDrop}
                    >
                      点击 + 新建页签，或拖入消息
                    </div>
                  )
                }
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
