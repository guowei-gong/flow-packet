import { useRef, useState, useEffect, useCallback } from 'react'
import { LayoutDashboard, Plus, X, ChevronLeft, ChevronRight } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog'
import { useTabStore, type CanvasTab } from '@/stores/tabStore'
import { useCanvasStore } from '@/stores/canvasStore'
import { useCollectionStore } from '@/stores/collectionStore'
import { cn } from '@/lib/utils'

export function CanvasTabs() {
  const tabs = useTabStore((s) => s.tabs)
  const activeTabId = useTabStore((s) => s.activeTabId)
  const addTab = useTabStore((s) => s.addTab)
  const switchTab = useTabStore((s) => s.switchTab)
  const closeTab = useTabStore((s) => s.closeTab)
  const markClean = useTabStore((s) => s.markClean)

  const [closingTab, setClosingTab] = useState<CanvasTab | null>(null)

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
    } else {
      closeTab(tab.id)
    }
  }

  const handleSave = () => {
    if (!closingTab) return
    if (closingTab.collectionId) {
      const canvas = useCanvasStore.getState()
      useCollectionStore.getState().updateCollection(closingTab.collectionId, canvas.nodes, canvas.edges)
      markClean(closingTab.id)
    }
    closeTab(closingTab.id)
    setClosingTab(null)
  }

  const handleDiscard = () => {
    if (!closingTab) return
    closeTab(closingTab.id)
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

      {/* Unsaved changes confirmation */}
      <AlertDialog open={!!closingTab} onOpenChange={(open) => !open && setClosingTab(null)}>
        <AlertDialogContent className="sm:max-w-[360px]">
          <AlertDialogHeader>
            <AlertDialogTitle>保存更改</AlertDialogTitle>
            <AlertDialogDescription>
              {closingTab?.name} 的修改内容尚未保存，是否保存？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setClosingTab(null)}>
              取消
            </AlertDialogCancel>
            <AlertDialogAction variant="outline" onClick={handleDiscard}>
              不保存
            </AlertDialogAction>
            <AlertDialogAction onClick={handleSave}>
              保存
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
