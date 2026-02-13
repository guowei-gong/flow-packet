import { useCallback, useState } from 'react'
import { useReactFlow, useOnViewportChange } from '@xyflow/react'
import { ZoomIn, ZoomOut, Scan, LayoutGrid, Undo, Redo } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip'
import { useCanvasStore, type AnyNodeData } from '@/stores/canvasStore'
import type { Node } from '@xyflow/react'

const ZOOM_DURATION = 100

export function CanvasControls() {
  const { zoomIn, zoomOut, fitView, getZoom } = useReactFlow()
  const nodes = useCanvasStore((s) => s.nodes)
  const edges = useCanvasStore((s) => s.edges)
  const past = useCanvasStore((s) => s.past)
  const future = useCanvasStore((s) => s.future)
  const updateNodes = useCanvasStore((s) => s.updateNodes)
  const takeSnapshot = useCanvasStore((s) => s.takeSnapshot)
  const undo = useCanvasStore((s) => s.undo)
  const redo = useCanvasStore((s) => s.redo)

  const [zoom, setZoom] = useState<string>(
    `${Math.round(getZoom() * 100)}%`
  )

  useOnViewportChange({
    onChange: ({ zoom }) => {
      setZoom(`${Math.round(zoom * 100)}%`)
    },
  })

  const onZoomIn = useCallback(() => {
    zoomIn({ duration: ZOOM_DURATION })
  }, [zoomIn])

  const onZoomOut = useCallback(() => {
    zoomOut({ duration: ZOOM_DURATION })
  }, [zoomOut])

  const onFitView = useCallback(() => {
    fitView({
      duration: 500,
      padding: 0.1,
      maxZoom: 0.9,
    })
  }, [fitView])

  const resetZoom = useCallback(() => {
    fitView({
      duration: 500,
      minZoom: 1,
      maxZoom: 1,
    })
  }, [fitView])

  const adjustPositions = useCallback(() => {
    if (nodes.length === 0) return
    takeSnapshot()

    // 分离备注框和业务节点
    const commentNodes = nodes.filter((n) => n.type === 'commentNode')
    const bizNodes = nodes.filter((n) => n.type !== 'commentNode')

    if (bizNodes.length === 0) return

    // 记录每个备注框在整理前包含了哪些业务节点（按几何包含判断）
    const commentChildren = new Map<string, string[]>()
    for (const c of commentNodes) {
      const cx = c.position.x
      const cy = c.position.y
      const cw = (c.style?.width as number) ?? c.measured?.width ?? 200
      const ch = (c.style?.height as number) ?? c.measured?.height ?? 80
      const contained: string[] = []
      for (const b of bizNodes) {
        if (
          b.position.x >= cx &&
          b.position.y >= cy &&
          b.position.x + (b.measured?.width ?? 220) <= cx + cw &&
          b.position.y + (b.measured?.height ?? 80) <= cy + ch
        ) {
          contained.push(b.id)
        }
      }
      commentChildren.set(c.id, contained)
    }

    // 仅对业务节点做拓扑排序布局
    const outgoing = new Map<string, string[]>()
    const inDegree = new Map<string, number>()
    for (const node of bizNodes) inDegree.set(node.id, 0)
    for (const edge of edges) {
      if (!inDegree.has(edge.source) || !inDegree.has(edge.target)) continue
      if (!outgoing.has(edge.source)) outgoing.set(edge.source, [])
      outgoing.get(edge.source)!.push(edge.target)
      inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1)
    }

    // BFS topological sort to assign layers
    const layers = new Map<string, number>()
    const queue: string[] = []
    for (const [id, deg] of inDegree) {
      if (deg === 0) {
        queue.push(id)
        layers.set(id, 0)
      }
    }

    let i = 0
    while (i < queue.length) {
      const current = queue[i++]
      const currentLayer = layers.get(current)!
      for (const child of outgoing.get(current) || []) {
        const newLayer = currentLayer + 1
        if ((layers.get(child) ?? -1) < newLayer) {
          layers.set(child, newLayer)
        }
        const newDeg = (inDegree.get(child) ?? 1) - 1
        inDegree.set(child, newDeg)
        if (newDeg === 0) queue.push(child)
      }
    }

    for (const node of bizNodes) {
      if (!layers.has(node.id)) layers.set(node.id, 0)
    }

    // Group by layer
    const layerGroups = new Map<number, string[]>()
    for (const [id, layer] of layers) {
      if (!layerGroups.has(layer)) layerGroups.set(layer, [])
      layerGroups.get(layer)!.push(id)
    }

    const GAP_X = 80
    const GAP_Y = 40

    const nodeMap = new Map(nodes.map((n) => [n.id, n]))

    const maxLayers = Math.max(...layerGroups.keys(), 0)
    const layerX = new Map<number, number>()
    let currentX = 0
    for (let l = 0; l <= maxLayers; l++) {
      layerX.set(l, currentX)
      const ids = layerGroups.get(l) || []
      const maxW = Math.max(...ids.map((id) => nodeMap.get(id)?.measured?.width ?? 220), 220)
      currentX += maxW + GAP_X
    }

    const nodePositions = new Map<string, { x: number; y: number }>()
    for (let l = 0; l <= maxLayers; l++) {
      const ids = layerGroups.get(l) || []
      let currentY = 0
      for (const id of ids) {
        nodePositions.set(id, { x: layerX.get(l)!, y: currentY })
        const h = nodeMap.get(id)?.measured?.height ?? 80
        currentY += h + GAP_Y
      }
    }

    // 根据布局后的业务节点位置，重新计算每个备注框的位置和大小
    const COMMENT_PAD = 20
    const commentUpdates = new Map<string, { x: number; y: number; w: number; h: number }>()
    for (const c of commentNodes) {
      const children = commentChildren.get(c.id) || []
      if (children.length === 0) continue
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
      for (const childId of children) {
        const pos = nodePositions.get(childId)
        if (!pos) continue
        const bNode = nodeMap.get(childId)
        const bw = bNode?.measured?.width ?? 220
        const bh = bNode?.measured?.height ?? 80
        minX = Math.min(minX, pos.x)
        minY = Math.min(minY, pos.y)
        maxX = Math.max(maxX, pos.x + bw)
        maxY = Math.max(maxY, pos.y + bh)
      }
      if (minX === Infinity) continue
      commentUpdates.set(c.id, {
        x: minX - COMMENT_PAD,
        y: minY - COMMENT_PAD - 28, // 留出标题栏高度
        w: maxX - minX + COMMENT_PAD * 2,
        h: maxY - minY + COMMENT_PAD * 2 + 28,
      })
    }

    updateNodes((nds) =>
      nds.map((n) => {
        // 业务节点：应用布局位置
        const pos = nodePositions.get(n.id)
        if (pos) {
          return { ...n, position: pos } as Node<AnyNodeData>
        }
        // 备注框：应用包裹位置
        const cu = commentUpdates.get(n.id)
        if (cu) {
          return {
            ...n,
            position: { x: cu.x, y: cu.y },
            style: { ...n.style, width: cu.w, height: cu.h },
          } as Node<AnyNodeData>
        }
        return n
      })
    )

    setTimeout(() => {
      fitView({ duration: 500, maxZoom: 1 })
    }, 300)
  }, [nodes, edges, updateNodes, fitView, takeSnapshot])

  return (
    <TooltipProvider delayDuration={0}>
      <div
        style={{
          position: 'absolute',
          bottom: 12,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 5,
        }}
        className="flex items-center rounded-md p-1.5 border border-border overflow-hidden bg-background/20 text-muted-foreground shadow-md backdrop-blur-sm"
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button size="icon-sm" variant="ghost" onClick={undo} disabled={past.length === 0}>
                <Undo className="size-4" />
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>撤销 <span className="ml-1 opacity-60">Ctrl+Z</span></TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button size="icon-sm" variant="ghost" onClick={adjustPositions}>
                <LayoutGrid className="size-4" />
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>整理节点</TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="mx-1 h-5" />

        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button size="icon-sm" variant="ghost" onClick={onZoomOut}>
                <ZoomOut className="size-4" />
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>缩小</TooltipContent>
        </Tooltip>

        <Button
          size="icon-sm"
          variant="ghost"
          onClick={resetZoom}
          className="w-[52px] text-xs"
        >
          {zoom}
        </Button>

        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button size="icon-sm" variant="ghost" onClick={onZoomIn}>
                <ZoomIn className="size-4" />
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>放大</TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="mx-1 h-5" />

        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button size="icon-sm" variant="ghost" onClick={onFitView}>
                <Scan className="size-4" />
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>适应画布</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button size="icon-sm" variant="ghost" onClick={redo} disabled={future.length === 0}>
                <Redo className="size-4" />
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>重做 <span className="ml-1 opacity-60">Ctrl+Shift+Z</span></TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  )
}
