import { useCanvasStore } from '@/stores/canvasStore'
import { FieldEditor } from './FieldEditor'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'

export function PropertySheet() {
  const selectedNodeId = useCanvasStore((s) => s.selectedNodeId)
  const setSelectedNodeId = useCanvasStore((s) => s.setSelectedNodeId)

  return (
    <Sheet
      open={!!selectedNodeId}
      onOpenChange={(open) => {
        if (!open) setSelectedNodeId(null)
      }}
    >
      <SheetContent side="right" className="w-[400px] sm:max-w-[400px] overflow-auto">
        <SheetHeader>
          <SheetTitle className="text-sm">节点属性</SheetTitle>
          <SheetDescription className="text-xs">
            编辑选中节点的字段值
          </SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-4">
          {selectedNodeId && <FieldEditor nodeId={selectedNodeId} />}
        </div>
      </SheetContent>
    </Sheet>
  )
}
