import { useState, useEffect } from 'react'
import { ChevronRight, FolderPlus, Pencil, Folder, FolderOpen } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useCollectionStore, type CollectionFolder } from '@/stores/collectionStore'
import { useConnectionStore } from '@/stores/connectionStore'
import { cn } from '@/lib/utils'

interface SaveCollectionDialogProps {
  open: boolean
  defaultName: string
  onOpenChange: (open: boolean) => void
  onSave: (name: string, folderId: string) => void
}

export function SaveCollectionDialog({ open, defaultName, onOpenChange, onSave }: SaveCollectionDialogProps) {
  const activeConnectionId = useConnectionStore((s) => s.activeConnectionId)
  const folders = useCollectionStore((s) => s.folders)
  const createFolder = useCollectionStore((s) => s.createFolder)
  const renameFolder = useCollectionStore((s) => s.renameFolder)

  const [name, setName] = useState('')
  const [selectedFolderId, setSelectedFolderId] = useState('')
  const [creatingInFolderId, setCreatingInFolderId] = useState<string | null>(null)
  const [newFolderName, setNewFolderName] = useState('')
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null)
  const [renameFolderName, setRenameFolderName] = useState('')

  useEffect(() => {
    if (open) {
      setName(defaultName)
      setSelectedFolderId('')
      setCreatingInFolderId(null)
      setNewFolderName('')
      setRenamingFolderId(null)
      setRenameFolderName('')
    }
  }, [open, defaultName])

  const handleOpenChange = (v: boolean) => {
    onOpenChange(v)
  }

  const handleCreateFolder = async (parentId: string) => {
    const trimmed = newFolderName.trim()
    if (!trimmed || !activeConnectionId) return
    const folder = await createFolder(activeConnectionId, trimmed, parentId)
    setSelectedFolderId(folder.id)
    setCreatingInFolderId(null)
    setNewFolderName('')
  }

  const handleStartCreate = (parentId: string) => {
    setCreatingInFolderId(parentId)
    setNewFolderName('')
  }

  const handleStartRename = (folderId: string) => {
    const folder = folders.find((f) => f.id === folderId)
    if (!folder) return
    setRenamingFolderId(folderId)
    setRenameFolderName(folder.name)
  }

  const handleRenameConfirm = async () => {
    const trimmed = renameFolderName.trim()
    if (!trimmed || !renamingFolderId || !activeConnectionId) return
    await renameFolder(activeConnectionId, renamingFolderId, trimmed)
    setRenamingFolderId(null)
    setRenameFolderName('')
  }

  const handleSave = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    onSave(trimmed, selectedFolderId)
  }

  const rootFolders = folders.filter((f) => !f.parentId)

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>保存 API</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              名称 <span className="text-destructive">*</span>
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              placeholder="输入画布名称"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">保存位置</span>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={() => handleStartCreate(selectedFolderId)}
              >
                <FolderPlus className="size-3.5" />
              </Button>
            </div>

            <ScrollArea className="h-[240px] rounded-md border">
              <div className="p-1">
                {/* 根节点 */}
                <ContextMenu>
                  <ContextMenuTrigger asChild>
                    <button
                      onClick={() => setSelectedFolderId('')}
                      className={cn(
                        'flex items-center gap-2 w-full px-2 py-1.5 rounded-sm text-sm text-left',
                        selectedFolderId === '' ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'
                      )}
                    >
                      <FolderOpen className="size-4 shrink-0 text-muted-foreground" />
                      <span>本地</span>
                    </button>
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    <ContextMenuItem onClick={() => handleStartCreate('')}>
                      <FolderPlus />
                      <span>新建文件夹</span>
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>

                {creatingInFolderId === '' && (
                  <CreateFolderInput
                    depth={1}
                    value={newFolderName}
                    onChange={setNewFolderName}
                    onCreate={() => handleCreateFolder('')}
                    onCancel={() => setCreatingInFolderId(null)}
                  />
                )}

                {rootFolders.map((f) => (
                  <FolderTreeNode
                    key={f.id}
                    folder={f}
                    folders={folders}
                    selectedFolderId={selectedFolderId}
                    onSelect={setSelectedFolderId}
                    depth={1}
                    creatingInFolderId={creatingInFolderId}
                    newFolderName={newFolderName}
                    onNewFolderNameChange={setNewFolderName}
                    onCreateFolder={handleCreateFolder}
                    onCancelCreate={() => setCreatingInFolderId(null)}
                    onStartCreate={handleStartCreate}
                    renamingFolderId={renamingFolderId}
                    renameFolderName={renameFolderName}
                    onRenameFolderNameChange={setRenameFolderName}
                    onStartRename={handleStartRename}
                    onRenameConfirm={handleRenameConfirm}
                    onCancelRename={() => setRenamingFolderId(null)}
                  />
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSave} disabled={!name.trim()}>
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function FolderTreeNode({
  folder,
  folders,
  selectedFolderId,
  onSelect,
  depth,
  creatingInFolderId,
  newFolderName,
  onNewFolderNameChange,
  onCreateFolder,
  onCancelCreate,
  onStartCreate,
  renamingFolderId,
  renameFolderName,
  onRenameFolderNameChange,
  onStartRename,
  onRenameConfirm,
  onCancelRename,
}: {
  folder: CollectionFolder
  folders: CollectionFolder[]
  selectedFolderId: string
  onSelect: (id: string) => void
  depth: number
  creatingInFolderId: string | null
  newFolderName: string
  onNewFolderNameChange: (v: string) => void
  onCreateFolder: (parentId: string) => void
  onCancelCreate: () => void
  onStartCreate: (parentId: string) => void
  renamingFolderId: string | null
  renameFolderName: string
  onRenameFolderNameChange: (v: string) => void
  onStartRename: (folderId: string) => void
  onRenameConfirm: () => void
  onCancelRename: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const isSelected = selectedFolderId === folder.id
  const isRenaming = renamingFolderId === folder.id
  const children = folders.filter((f) => f.parentId === folder.id)
  const hasChildren = children.length > 0 || creatingInFolderId === folder.id

  const handleClick = () => {
    onSelect(folder.id)
    setExpanded((v) => !v)
  }

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          {isRenaming ? (
            <div
              className="flex items-center gap-1 py-1"
              style={{ paddingLeft: depth * 16 }}
            >
              <ChevronRight className="size-3.5 shrink-0 invisible" />
              <Folder className="size-4 shrink-0 text-muted-foreground" />
              <Input
                className="h-7 text-sm flex-1"
                value={renameFolderName}
                onChange={(e) => onRenameFolderNameChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onRenameConfirm()
                  if (e.key === 'Escape') onCancelRename()
                }}
                onBlur={() => {
                  if (renameFolderName.trim()) {
                    onRenameConfirm()
                  } else {
                    onCancelRename()
                  }
                }}
                autoFocus
              />
            </div>
          ) : (
            <button
              onClick={handleClick}
              className={cn(
                'flex items-center gap-1 w-full py-1.5 rounded-sm text-sm text-left',
                isSelected ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'
              )}
              style={{ paddingLeft: depth * 16 }}
            >
              <ChevronRight
                className={cn(
                  'size-3.5 shrink-0 transition-transform text-muted-foreground',
                  hasChildren ? '' : 'invisible',
                  expanded ? 'rotate-90' : ''
                )}
              />
              {isSelected ? (
                <FolderOpen className="size-4 shrink-0 text-muted-foreground" />
              ) : (
                <Folder className="size-4 shrink-0 text-muted-foreground" />
              )}
              <span className="truncate">{folder.name}</span>
            </button>
          )}
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={() => { setExpanded(true); onStartCreate(folder.id) }}>
            <FolderPlus />
            <span>新建文件夹</span>
          </ContextMenuItem>
          <ContextMenuItem onClick={() => onStartRename(folder.id)}>
            <Pencil />
            <span>重命名</span>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {expanded && (
        <>
          {creatingInFolderId === folder.id && (
            <CreateFolderInput
              depth={depth + 1}
              value={newFolderName}
              onChange={onNewFolderNameChange}
              onCreate={() => onCreateFolder(folder.id)}
              onCancel={onCancelCreate}
            />
          )}
          {children.map((child) => (
            <FolderTreeNode
              key={child.id}
              folder={child}
              folders={folders}
              selectedFolderId={selectedFolderId}
              onSelect={onSelect}
              depth={depth + 1}
              creatingInFolderId={creatingInFolderId}
              newFolderName={newFolderName}
              onNewFolderNameChange={onNewFolderNameChange}
              onCreateFolder={onCreateFolder}
              onCancelCreate={onCancelCreate}
              onStartCreate={onStartCreate}
              renamingFolderId={renamingFolderId}
              renameFolderName={renameFolderName}
              onRenameFolderNameChange={onRenameFolderNameChange}
              onStartRename={onStartRename}
              onRenameConfirm={onRenameConfirm}
              onCancelRename={onCancelRename}
            />
          ))}
        </>
      )}
    </>
  )
}

function CreateFolderInput({
  depth,
  value,
  onChange,
  onCreate,
  onCancel,
}: {
  depth: number
  value: string
  onChange: (v: string) => void
  onCreate: () => void
  onCancel: () => void
}) {
  return (
    <div
      className="flex items-center gap-2 py-1"
      style={{ paddingLeft: depth * 16 + 4 }}
    >
      <Folder className="size-4 shrink-0 text-muted-foreground" />
      <Input
        className="h-7 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onCreate()
          if (e.key === 'Escape') onCancel()
        }}
        onBlur={() => {
          if (value.trim()) {
            onCreate()
          } else {
            onCancel()
          }
        }}
        placeholder="文件夹名称"
        autoFocus
      />
    </div>
  )
}
