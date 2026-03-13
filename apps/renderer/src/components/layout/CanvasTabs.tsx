import { useRef, useState, useEffect, useCallback } from 'react'
import { LayoutDashboard, Plus, X, ChevronLeft, ChevronRight } from 'lucide-react'
import { useTabStore, type CanvasTab } from '@/stores/tabStore'
import { useCanvasStore } from '@/stores/canvasStore'
import { useCollectionStore } from '@/stores/collectionStore'
import { useConnectionStore } from '@/stores/connectionStore'
import { SaveCollectionDialog } from '@/components/collection/SaveCollectionDialog'
import { cn } from '@/lib/utils'

export function CanvasTabs() {
  const tabs = useTabStore((s) => s.tabs)
  const activeTabId = useTabStore((s) => s.activeTabId)
  const addTab = useTabStore((s) => s.addTab)
  const switchTab = useTabStore((s) => s.switchTab)
  const closeTab = useTabStore((s) => s.closeTab)
  const markClean = useTabStore((s) => s.markClean)
  const setCollectionId = useTabStore((s) => s.setCollectionId)

  const activeConnectionId = useConnectionStore((s) => s.activeConnectionId)

  const [closingTab, setClosingTab] = useState<CanvasTab | null>(null)
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)
  const [showLeft, setShowLeft] = useState(false)
  const [showRight, setShowRight] = useState(false)

  const checkOverflow = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setShowLeft(el.scrollLeft > 0)
    setShowRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1)
  }, [])

  useEffect(() => {
    checkOverflow()
  }, [tabs, checkOverflow])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.addEventListener('scroll', checkOverflow)
    const ro = new ResizeObserver(checkOverflow)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', checkOverflow)
      ro.disconnect()
    }
  }, [checkOverflow])

  const scroll = (dir: 'left' | 'right') => {
    const el = scrollRef.current
    if (!el) return
    el.scrollBy({ left: dir === 'left' ? -160 : 160, behavior: 'smooth' })
  }

  const handleCloseClick = (tab: CanvasTab) => {
    if (tab.dirty) {
      setClosingTab(tab)
      if (tab.collectionId) {
        // 已保存过的集合, 直接覆盖保存并关闭
        const canvas = useCanvasStore.getState()
        useCollectionStore.getState().updateCollection(activeConnectionId!, tab.collectionId, canvas.nodes, canvas.edges)
        markClean(tab.id)
        closeTab(tab.id)
      } else {
        // 新画布, 打开保存对话框
        setSaveDialogOpen(true)
      }
    } else {
      closeTab(tab.id)
    }
  }

  const handleSaveDialogConfirm = async (name: string, folderId: string) => {
    if (!closingTab) return
    const canvas = useCanvasStore.getState()
    const collectionId = await useCollectionStore.getState().saveCollection(
      activeConnectionId!, name, folderId, canvas.nodes, canvas.edges
    )
    setCollectionId(closingTab.id, collectionId)
    markClean(closingTab.id)
    closeTab(closingTab.id)
    setClosingTab(null)
    setSaveDialogOpen(false)
  }

  const handleSaveDialogCancel = () => {
    setSaveDialogOpen(false)
    setClosingTab(null)
  }

  return (
    <>
      <div className="flex items-center h-9 border-b border-border shrink-0" style={{ background: 'var(--bg-panel)' }}>
        {/* Left scroll arrow */}
        {showLeft && (
          <button
            onClick={() => scroll('left')}
            className="flex items-center justify-center w-6 h-full shrink-0 hover:bg-accent text-muted-foreground"
          >
            <ChevronLeft className="size-3.5" />
          </button>
        )}

        {/* Scrollable tab container */}
        <div
          ref={scrollRef}
          className="flex-1 flex items-center h-full overflow-hidden min-w-0"
        >
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId
            const isDirty = tab.dirty

            return (
              <div
                key={tab.id}
                onClick={() => switchTab(tab.id)}
                className={cn(
                  'group flex items-center gap-2 h-full pl-3 pr-1 pt-1 shrink-0 cursor-pointer border-r border-border select-none min-w-[120px] border-t-2',
                  'text-xs',
                  isActive ? 'bg-background text-foreground border-t-primary' : 'border-t-transparent text-muted-foreground/50'
                )}
              >
                <LayoutDashboard className="size-3.5 shrink-0" />
                <span className="truncate">{tab.name}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleCloseClick(tab)
                  }}
                  className={cn(
                    'flex items-center justify-center size-4 rounded-sm ml-auto shrink-0 hover:bg-muted-foreground/20',
                    isActive || isDirty ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                  )}
                >
                  {isDirty ? (
                    <>
                      <span className="w-2 h-2 rounded-full bg-foreground group-hover:hidden" />
                      <X className="size-3 hidden group-hover:block" />
                    </>
                  ) : (
                    <X className="size-3" />
                  )}
                </button>
              </div>
            )
          })}

          {/* New tab button — inside scrollable area, right after last tab */}
          <button
            onClick={addTab}
            className="flex items-center justify-center size-7 mx-1 shrink-0 rounded-sm hover:bg-accent text-muted-foreground"
          >
            <Plus className="size-3.5" />
          </button>
        </div>

        {/* Right scroll arrow */}
        {showRight && (
          <button
            onClick={() => scroll('right')}
            className="flex items-center justify-center w-6 h-full shrink-0 hover:bg-accent text-muted-foreground"
          >
            <ChevronRight className="size-3.5" />
          </button>
        )}
      </div>

      <SaveCollectionDialog
        open={saveDialogOpen}
        defaultName={closingTab?.name === '未命名' ? '' : (closingTab?.name ?? '')}
        onOpenChange={(open) => {
          if (!open) handleSaveDialogCancel()
        }}
        onSave={handleSaveDialogConfirm}
      />
    </>
  )
}
