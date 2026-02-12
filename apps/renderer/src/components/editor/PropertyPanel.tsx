import { useCanvasStore } from '@/stores/canvasStore'
import { ConnectionForm } from '@/components/connection/ConnectionForm'
import { FieldEditor } from './FieldEditor'

export function PropertyPanel() {
  const selectedNodeId = useCanvasStore((s) => s.selectedNodeId)

  return (
    <div className="flex flex-col h-full">
      <div
        className="flex items-center px-3 h-8 shrink-0 border-b border-border"
      >
        <span className="text-xs font-medium text-muted-foreground">
          {selectedNodeId ? '节点属性' : '连接配置'}
        </span>
      </div>
      <div className="flex-1 overflow-auto p-3">
        {selectedNodeId ? <FieldEditor nodeId={selectedNodeId} /> : <ConnectionForm />}
      </div>
    </div>
  )
}
