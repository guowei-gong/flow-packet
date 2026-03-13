import { useState, useMemo } from 'react'
import { toast } from 'sonner'
import {
  Plug,
  Plus,
  Search,
  Pencil,
  Trash2,
  GripVertical,
  Github,
} from 'lucide-react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { SidebarTrigger } from '@/components/ui/sidebar'
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  SidebarProvider,
  Sidebar,
  SidebarInset,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarGroup,
  SidebarGroupContent,
} from '@/components/ui/sidebar'
import { ThemeToggle } from '@/components/layout/ThemeToggle'
import {
  useSavedConnectionStore,
  type SavedConnection,
} from '@/stores/savedConnectionStore'
import { Squares } from '@/components/ui/squares'
import { useTheme } from '@/hooks/use-theme'
import { CreateConnectionDialog } from './CreateConnectionDialog'

interface WelcomePageProps {
  onEnterConnection: (connection: SavedConnection) => void
}

const tagColors: Record<string, string> = {
  '本地': 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  '测试服': 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  '正式服': 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  '预发布': 'bg-purple-500/15 text-purple-600 dark:text-purple-400',
}

function DragHandle({ id }: { id: string }) {
  const { attributes, listeners } = useSortable({ id })
  return (
    <Button
      {...attributes}
      {...listeners}
      variant="ghost"
      size="icon"
      className="size-7 cursor-grab text-muted-foreground hover:bg-transparent active:cursor-grabbing"
    >
      <GripVertical className="size-3.5" />
    </Button>
  )
}

function SortableRow({
  conn,
  onEnter,
  onEdit,
  onDelete,
}: {
  conn: SavedConnection
  onEnter: (conn: SavedConnection) => void
  onEdit: (e: React.MouseEvent, conn: SavedConnection) => void
  onDelete: (e: React.MouseEvent, conn: SavedConnection) => void
}) {
  const { transform, transition, setNodeRef, isDragging } = useSortable({
    id: conn.id,
  })

  return (
    <TableRow
      ref={setNodeRef}
      className="group cursor-pointer data-[dragging=true]:z-10 data-[dragging=true]:opacity-80"
      data-dragging={isDragging}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      onDoubleClick={() => onEnter(conn)}
    >
      <TableCell className="w-8">
        <DragHandle id={conn.id} />
      </TableCell>
      <TableCell>
        <div
          className="flex items-center justify-center size-8 rounded-md text-white text-xs font-bold"
          style={{ backgroundColor: conn.color }}
        >
          {conn.name.charAt(0).toUpperCase()}
        </div>
      </TableCell>
      <TableCell className="font-medium">
        {conn.name}
      </TableCell>
      <TableCell>
        <Badge
          variant="secondary"
          className={`text-[10px] px-1.5 py-0 h-4 border-0 ${tagColors[conn.tag] ?? ''}`}
        >
          {conn.tag}
        </Badge>
      </TableCell>
      <TableCell className="text-muted-foreground">
        {conn.host}:{conn.port}
      </TableCell>
      <TableCell>
        <Badge variant="outline" className="uppercase text-muted-foreground">
          {conn.protocol}
        </Badge>
      </TableCell>
      <TableCell className="text-muted-foreground">
        {conn.codec}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={(e) => onEdit(e, conn)}
          >
            <Pencil className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-destructive hover:text-destructive"
            onClick={(e) => onDelete(e, conn)}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  )
}

export function WelcomePage({ onEnterConnection }: WelcomePageProps) {
  const connections = useSavedConnectionStore((s) => s.connections)
  const deleteConnection = useSavedConnectionStore((s) => s.deleteConnection)
  const reorderConnections = useSavedConnectionStore((s) => s.reorderConnections)
  const theme = useTheme((s) => s.theme)

  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingConn, setEditingConn] = useState<SavedConnection | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<SavedConnection | null>(null)

  const filteredConnections = useMemo(() => {
    const q = search.toLowerCase()
    return connections.filter((c) =>
      c.name.toLowerCase().includes(q) ||
      c.host.toLowerCase().includes(q) ||
      c.tag.toLowerCase().includes(q)
    )
  }, [connections, search])

  const isFiltering = search.length > 0
  const sortableIds = useMemo(() => filteredConnections.map((c) => c.id), [filteredConnections])

  const sensors = useSensors(
    useSensor(MouseSensor, {}),
    useSensor(TouchSensor, {}),
    useSensor(KeyboardSensor, {})
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!active || !over || active.id === over.id || isFiltering) return

    const oldIndex = connections.findIndex((c) => c.id === active.id)
    const newIndex = connections.findIndex((c) => c.id === over.id)
    if (oldIndex !== -1 && newIndex !== -1) {
      reorderConnections(oldIndex, newIndex)
    }
  }

  const handleEdit = (e: React.MouseEvent, conn: SavedConnection) => {
    e.stopPropagation()
    setEditingConn(conn)
    setDialogOpen(true)
  }

  const handleDelete = (e: React.MouseEvent, conn: SavedConnection) => {
    e.stopPropagation()
    setDeleteTarget(conn)
  }

  const confirmDelete = () => {
    if (deleteTarget) {
      const name = deleteTarget.name
      deleteConnection(deleteTarget.id)
      setDeleteTarget(null)
      toast.message('连接已删除', { description: name })
    }
  }

  const handleDialogClose = (open: boolean) => {
    setDialogOpen(open)
    if (!open) setEditingConn(null)
  }

  return (
    <SidebarProvider>
      <Sidebar collapsible="offcanvas" variant="inset">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                className="data-[slot=sidebar-menu-button]:p-1.5!"
              >
                <span className="text-base font-semibold">FlowPacket</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent className="flex flex-col gap-2">
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    className="min-w-8 bg-primary text-primary-foreground duration-200 ease-linear hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground"
                    onClick={() => {
                      setEditingConn(null)
                      setDialogOpen(true)
                    }}
                  >
                    <Plus className="size-4" />
                    <span>创建连接</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>

      <SidebarInset className="relative overflow-hidden">
        {/* Squares 动画背景 */}
        <Squares
          className="absolute inset-0 w-full h-full z-10"
          direction="diagonal"
          speed={0.25}
          borderColor={theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}
          hoverFillColor={theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)'}
          squareSize={40}
        />

        {/* Header */}
        <header className="relative z-20 flex h-12 shrink-0 items-center gap-2 border-b bg-background/80 backdrop-blur-sm">
          <div className="flex w-full items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="mx-1 data-[orientation=vertical]:h-4"
            />
            <h1 className="text-base font-medium">连接管理</h1>

            <div className="ml-auto flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="搜索连接..."
                  className="h-8 w-[200px] pl-8 text-sm"
                />
              </div>
              <ThemeToggle />
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={() => window.open('https://github.com/guowei-gong/flow-packet', '_blank')}
              >
                <Github className="size-4" />
              </Button>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="relative z-20 flex-1 overflow-auto p-4 lg:p-6">
          {connections.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full">
              <img src="/remind.png" alt="remind" className="size-32 -mb-9 object-contain" />
              <h3 className="scroll-m-20 text-2xl font-semibold tracking-tight text-muted-foreground">
                暂无连接，点击"创建连接"开始
              </h3>
            </div>
          ) : filteredConnections.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <Plug className="size-10 mb-3 opacity-30" />
              <p className="text-sm">没有匹配的连接</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border bg-background/80 backdrop-blur-sm">
              <DndContext
                collisionDetection={closestCenter}
                modifiers={[restrictToVerticalAxis]}
                onDragEnd={handleDragEnd}
                sensors={sensors}
              >
                <Table>
                  <TableBody>
                    <SortableContext
                      items={sortableIds}
                      strategy={verticalListSortingStrategy}
                    >
                      {filteredConnections.map((conn) => (
                        <SortableRow
                          key={conn.id}
                          conn={conn}
                          onEnter={onEnterConnection}
                          onEdit={handleEdit}
                          onDelete={handleDelete}
                        />
                      ))}
                    </SortableContext>
                  </TableBody>
                </Table>
              </DndContext>
            </div>
          )}
        </div>
      </SidebarInset>

      {/* Dialogs */}
      <CreateConnectionDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        editConnection={editingConn}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除连接 "{deleteTarget?.name}" 吗？此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarProvider>
  )
}
