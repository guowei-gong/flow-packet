import { useCanvasStore, type CommentNodeData } from '@/stores/canvasStore'
import { FieldEditor } from './FieldEditor'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetClose,
} from '@/components/ui/sheet'
import { toast } from 'sonner'

function CommentEditor({ nodeId }: { nodeId: string }) {
  const node = useCanvasStore((s) => s.nodes.find((n) => n.id === nodeId))
  const updateNodeData = useCanvasStore((s) => s.updateNodeData)

  if (!node || node.type !== 'commentNode') return null
  const data = node.data as CommentNodeData

  return (
    <div className="grid gap-3">
      <div className="grid gap-2">
        <Label htmlFor={`comment-title-${nodeId}`}>标题</Label>
        <Input
          id={`comment-title-${nodeId}`}
          value={data.label}
          onChange={(e) => updateNodeData(nodeId, { label: e.target.value })}
        />
      </div>
      <div className="grid gap-2">
        <Label>颜色</Label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={data.color || '#9B8E7B'}
            onChange={(e) => updateNodeData(nodeId, { color: e.target.value })}
            className="w-8 h-8 rounded cursor-pointer border border-border"
          />
          <span className="text-xs text-muted-foreground">{data.color || '#9B8E7B'}</span>
        </div>
      </div>
    </div>
  )
}

export function PropertySheet() {
  const editingNodeId = useCanvasStore((s) => s.editingNodeId)
  const setEditingNodeId = useCanvasStore((s) => s.setEditingNodeId)
  const editingNode = useCanvasStore((s) =>
    s.editingNodeId ? s.nodes.find((n) => n.id === s.editingNodeId) : null
  )
  const isComment = editingNode?.type === 'commentNode'

  return (
    <Sheet
      open={!!editingNodeId}
      onOpenChange={(open) => {
        if (!open) setEditingNodeId(null)
      }}
    >
      <SheetContent side="right" className="w-[400px] sm:max-w-[400px]" showCloseButton={false}>
        <SheetHeader>
          <SheetTitle className="text-sm">
            {isComment ? '备注属性' : '节点属性'}
          </SheetTitle>
          <SheetDescription className="text-xs">
            {isComment ? '编辑备注框的标题与颜色' : '编辑画布中，选中节点的字段值'}
          </SheetDescription>
        </SheetHeader>
        <div className="grid flex-1 auto-rows-min gap-6 px-4 overflow-y-auto">
          {editingNodeId && (
            isComment
              ? <CommentEditor nodeId={editingNodeId} />
              : <FieldEditor nodeId={editingNodeId} />
          )}
        </div>
        <SheetFooter>
          <Button
            type="button"
            onClick={() => {
              toast.message('保存成功')
              setEditingNodeId(null)
            }}
          >
            保存
          </Button>
          <SheetClose asChild>
            <Button variant="outline">关闭</Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
