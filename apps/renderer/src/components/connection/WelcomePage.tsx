import { useState } from 'react'
import { toast } from 'sonner'
import { Plus, Search, Plug, Pencil, Trash2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
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
  useSavedConnectionStore,
  type SavedConnection,
} from '@/stores/savedConnectionStore'
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

export function WelcomePage({ onEnterConnection }: WelcomePageProps) {
  const connections = useSavedConnectionStore((s) => s.connections)
  const deleteConnection = useSavedConnectionStore((s) => s.deleteConnection)

  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingConn, setEditingConn] = useState<SavedConnection | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<SavedConnection | null>(null)

  const filteredConnections = connections.filter((c) => {
    const q = search.toLowerCase()
    return (
      c.name.toLowerCase().includes(q) ||
      c.host.toLowerCase().includes(q) ||
      c.tag.toLowerCase().includes(q)
    )
  })

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
    <div className="flex h-full w-full">
      {/* 左侧品牌区域 */}
      <div
        className="flex flex-col w-[280px] shrink-0 border-r border-border p-6"
        style={{ background: 'var(--bg-controller)' }}
      >
        <div className="flex-1">
          {/* Logo & 品牌 */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-2">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
                <Plug className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-foreground">flow-packet</h1>
                <p className="text-[11px] text-muted-foreground">v0.1.0</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-3 leading-relaxed">
              可视化游戏服务器协议测试平台
            </p>
          </div>

          {/* 操作按钮 */}
          <div className="space-y-2">
            <Button
              variant="outline"
              className="w-full justify-start h-9 px-3 text-sm gap-2 bg-transparent hover:bg-accent active:bg-accent/80"
              onClick={() => {
                setEditingConn(null)
                setDialogOpen(true)
              }}
            >
              <Plug className="w-4 h-4" />
              创建连接
            </Button>
          </div>
        </div>
      </div>

      {/* 右侧连接列表 */}
      <div className="flex-1 flex flex-col min-w-0" style={{ background: 'var(--bg-panel)' }}>
        {/* 搜索栏 */}
        <div className="flex items-center h-11 px-3 border-b border-border gap-2 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={() => {
              setEditingConn(null)
              setDialogOpen(true)
            }}
          >
            <Plus className="w-4 h-4" />
          </Button>
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索连接... (Ctrl F)"
              className="h-7 pl-7 text-xs bg-transparent border-0 shadow-none focus-visible:ring-0"
            />
          </div>
        </div>

        {/* 连接列表 */}
        <ScrollArea className="flex-1">
          {filteredConnections.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-20 text-muted-foreground">
              <Plug className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-sm">
                {connections.length === 0
                  ? '暂无连接，点击"创建连接"开始'
                  : '没有匹配的连接'}
              </p>
            </div>
          ) : (
            <div className="p-1">
              {filteredConnections.map((conn) => (
                <div
                  key={conn.id}
                  className="group flex items-center gap-3 px-3 py-2.5 rounded-md cursor-pointer hover:bg-accent/50 transition-colors"
                  onDoubleClick={() => onEnterConnection(conn)}
                >
                  {/* 颜色标识 + 首字母 */}
                  <div
                    className="flex items-center justify-center w-9 h-9 rounded-md text-white text-sm font-bold shrink-0"
                    style={{ backgroundColor: conn.color }}
                  >
                    {conn.name.charAt(0).toUpperCase()}
                  </div>

                  {/* 连接信息 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground truncate">
                        {conn.name}
                      </span>
                      <Badge
                        variant="secondary"
                        className={`text-[10px] px-1.5 py-0 h-4 border-0 ${tagColors[conn.tag] ?? ''}`}
                      >
                        {conn.tag}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {conn.host}:{conn.port}
                    </p>
                  </div>

                  {/* 操作按钮（hover 显示） */}
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={(e) => handleEdit(e, conn)}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={(e) => handleDelete(e, conn)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* 创建/编辑连接弹窗 */}
      <CreateConnectionDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        editConnection={editingConn}
      />

      {/* 删除确认弹窗 */}
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
    </div>
  )
}
