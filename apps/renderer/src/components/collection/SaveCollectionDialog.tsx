import { useState, useMemo } from 'react'
import { ArrowLeft, FolderPlus, Folder, FolderOpen } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useCollectionStore, type CollectionFolder, type Collection } from '@/stores/collectionStore'
import { useConnectionStore } from '@/stores/connectionStore'

interface SaveCollectionDialogProps {
  open: boolean
  defaultName: string
  onOpenChange: (open: boolean) => void
  onSave: (name: string, folderId: string) => void
}

export function SaveCollectionDialog({ open, defaultName, onOpenChange, onSave }: SaveCollectionDialogProps) {
  const activeConnectionId = useConnectionStore((s) => s.activeConnectionId)
  const folders = useCollectionStore((s) => s.folders)
  const collections = useCollectionStore((s) => s.collections)
  const createFolder = useCollectionStore((s) => s.createFolder)

  const [name, setName] = useState(defaultName)
  const [currentFolderId, setCurrentFolderId] = useState('')
  const [creatingFolder, setCreatingFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')

  // 当 dialog 打开时重置状态
  const handleOpenChange = (v: boolean) => {
    if (v) {
      setName(defaultName)
      setCurrentFolderId('')
      setCreatingFolder(false)
      setNewFolderName('')
    }
    onOpenChange(v)
  }

  const currentFolderName = useMemo(() => {
    if (!currentFolderId) return '本地'
    return folders.find((f) => f.id === currentFolderId)?.name ?? '本地'
  }, [currentFolderId, folders])

  const parentFolderId = useMemo(() => {
    if (!currentFolderId) return null
    const folder = folders.find((f) => f.id === currentFolderId)
    return folder ? folder.parentId : null
  }, [currentFolderId, folders])

  const childFolders = useMemo(
    () => folders.filter((f) => f.parentId === currentFolderId),
    [folders, currentFolderId]
  )

  const childCollections = useMemo(
    () => collections.filter((c) => c.folderId === currentFolderId),
    [collections, currentFolderId]
  )

  const handleGoBack = () => {
    if (parentFolderId !== null) {
      setCurrentFolderId(parentFolderId)
    }
  }

  const handleCreateFolder = async () => {
    const trimmed = newFolderName.trim()
    if (!trimmed) return
    await createFolder(activeConnectionId!, trimmed, currentFolderId)
    setCreatingFolder(false)
    setNewFolderName('')
  }

  const handleSave = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    onSave(trimmed, currentFolderId)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>保存 API</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* 名称输入 */}
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

          {/* 保存至 */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-sm">
                保存至 <span className="font-semibold">{currentFolderName}</span>
              </span>
              <div className="flex items-center gap-1">
                {parentFolderId !== null && (
                  <Button variant="ghost" size="icon" className="size-7" onClick={handleGoBack}>
                    <ArrowLeft className="size-3.5" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={() => {
                    setCreatingFolder(true)
                    setNewFolderName('')
                  }}
                >
                  <FolderPlus className="size-3.5" />
                </Button>
              </div>
            </div>

            <ScrollArea className="h-[200px] rounded-md border">
              <div className="p-2 space-y-0.5">
                {/* 新建文件夹输入 */}
                {creatingFolder && (
                  <div className="flex items-center gap-2 px-2 py-1">
                    <Folder className="size-4 shrink-0 text-muted-foreground" />
                    <Input
                      className="h-7 text-sm"
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleCreateFolder()
                        if (e.key === 'Escape') setCreatingFolder(false)
                      }}
                      onBlur={() => {
                        if (!newFolderName.trim()) setCreatingFolder(false)
                      }}
                      placeholder="文件夹名称"
                      autoFocus
                    />
                  </div>
                )}

                {/* 子文件夹 */}
                {childFolders.map((f) => (
                  <FolderRow key={f.id} folder={f} onNavigate={setCurrentFolderId} />
                ))}

                {/* 已保存的集合 */}
                {childCollections.map((c) => (
                  <CollectionRow key={c.id} collection={c} />
                ))}

                {!creatingFolder && childFolders.length === 0 && childCollections.length === 0 && (
                  <div className="flex items-center justify-center h-20 text-xs text-muted-foreground">
                    此文件夹为空
                  </div>
                )}
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

function FolderRow({ folder, onNavigate }: { folder: CollectionFolder; onNavigate: (id: string) => void }) {
  return (
    <button
      onClick={() => onNavigate(folder.id)}
      className="flex items-center gap-2 w-full px-2 py-1.5 rounded-sm text-sm hover:bg-accent text-left"
    >
      <FolderOpen className="size-4 shrink-0 text-muted-foreground" />
      <span className="truncate">{folder.name}</span>
    </button>
  )
}

function CollectionRow({ collection }: { collection: Collection }) {
  return (
    <div className="flex items-center gap-2 px-2 py-1.5 text-sm text-muted-foreground">
      <span className="truncate">{collection.name}</span>
    </div>
  )
}
