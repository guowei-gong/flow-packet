import { useState } from 'react'
import { Plus, MoreHorizontal, Pencil, Save, Trash2, FolderOpen } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useCollectionStore, type Collection } from '@/stores/collectionStore'
import { useCanvasStore } from '@/stores/canvasStore'
import { useTabStore } from '@/stores/tabStore'

export function CollectionBrowser() {
  const collections = useCollectionStore((s) => s.collections)
  const saveCollection = useCollectionStore((s) => s.saveCollection)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogName, setDialogName] = useState('')

  const nodes = useCanvasStore((s) => s.nodes)
  const edges = useCanvasStore((s) => s.edges)

  const handleCreate = () => {
    setDialogName('')
    setDialogOpen(true)
  }

  const handleConfirmCreate = () => {
    const name = dialogName.trim()
    if (!name) return
    saveCollection(name, nodes, edges)
    setDialogOpen(false)
  }

  return (
    <div className="flex flex-col h-full" style={{ paddingLeft: 10 }}>
      <div className="flex items-center justify-between px-2 h-8 shrink-0">
        <span className="text-xs font-medium text-muted-foreground">集合</span>
        <button
          onClick={handleCreate}
          className="flex items-center justify-center size-5 rounded hover:bg-sidebar-accent text-muted-foreground hover:text-sidebar-accent-foreground"
        >
          <Plus className="size-3.5" />
        </button>
      </div>

      <ScrollArea className="flex-1">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {collections.map((col) => (
                <CollectionNode key={col.id} collection={col} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {collections.length === 0 && (
          <div className="px-3 py-4 text-center">
            <span className="text-xs text-muted-foreground">尚未保存任何集合</span>
          </div>
        )}
      </ScrollArea>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle>新建集合</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="集合名称"
            value={dialogName}
            onChange={(e) => setDialogName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleConfirmCreate()}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleConfirmCreate} disabled={!dialogName.trim()}>
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function CollectionNode({ collection }: { collection: Collection }) {
  const nodes = useCanvasStore((s) => s.nodes)
  const edges = useCanvasStore((s) => s.edges)
  const updateCollection = useCollectionStore((s) => s.updateCollection)
  const renameCollection = useCollectionStore((s) => s.renameCollection)
  const deleteCollection = useCollectionStore((s) => s.deleteCollection)
  const openTab = useTabStore((s) => s.openTab)

  const [renameOpen, setRenameOpen] = useState(false)
  const [renameName, setRenameName] = useState('')

  const handleLoad = () => {
    openTab(collection.name, collection.id, collection.nodes, collection.edges)
  }

  const handleOverwrite = () => {
    updateCollection(collection.id, nodes, edges)
  }

  const handleRenameStart = () => {
    setRenameName(collection.name)
    setRenameOpen(true)
  }

  const handleRenameConfirm = () => {
    const name = renameName.trim()
    if (!name) return
    renameCollection(collection.id, name)
    setRenameOpen(false)
  }

  const handleDelete = () => {
    deleteCollection(collection.id)
  }

  return (
    <>
      <SidebarMenuItem>
        <SidebarMenuButton
          onClick={handleLoad}
          className="active:bg-sidebar-accent active:text-sidebar-accent-foreground"
        >
          <FolderOpen />
          <span className="truncate">{collection.name}</span>
        </SidebarMenuButton>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuAction showOnHover>
              <MoreHorizontal />
            </SidebarMenuAction>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="start">
            <DropdownMenuItem onClick={handleRenameStart}>
              <Pencil />
              <span>重命名</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleOverwrite}>
              <Save />
              <span>覆盖保存</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={handleDelete}>
              <Trash2 />
              <span>删除</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle>重命名集合</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="集合名称"
            value={renameName}
            onChange={(e) => setRenameName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleRenameConfirm()}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameOpen(false)}>
              取消
            </Button>
            <Button onClick={handleRenameConfirm} disabled={!renameName.trim()}>
              确认
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
