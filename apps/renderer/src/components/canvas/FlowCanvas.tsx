import { useCallback, useRef, useState } from 'react'
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  MiniMap,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  type Connection,
  type NodeTypes,
  type EdgeTypes,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  type ReactFlowInstance,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { ColorMode } from '@xyflow/react'
import { useCanvasStore, type RequestNodeData, type AnyNodeData } from '@/stores/canvasStore'
import { useTheme } from '@/hooks/use-theme'
import { useProtoStore, type MessageInfo } from '@/stores/protoStore'
import { RequestNode } from './nodes/RequestNode'
import { CommentNode } from './nodes/CommentNode'
import { ExecEdge } from './edges/ExecEdge'
import { CanvasControls } from './CanvasControls'
import type { Node } from '@xyflow/react'

const nodeTypes: NodeTypes = {
  requestNode: RequestNode,
  commentNode: CommentNode,
}

const edgeTypes: EdgeTypes = {
  execEdge: ExecEdge,
}

export function FlowCanvas() {
  const nodes = useCanvasStore((s) => s.nodes)
  const edges = useCanvasStore((s) => s.edges)
  const updateNodes = useCanvasStore((s) => s.updateNodes)
  const updateEdges = useCanvasStore((s) => s.updateEdges)
  const setSelectedNodeId = useCanvasStore((s) => s.setSelectedNodeId)
  const addNode = useCanvasStore((s) => s.addNode)
  const removeNode = useCanvasStore((s) => s.removeNode)
  const routeMappings = useProtoStore((s) => s.routeMappings)
  const theme = useTheme((s) => s.theme)
  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  const reactFlowInstance = useRef<ReactFlowInstance | null>(null)

  // Ctrl+drag comment box drawing state
  const [drawingComment, setDrawingComment] = useState(false)
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null)
  const [drawCurrent, setDrawCurrent] = useState<{ x: number; y: number } | null>(null)

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      updateNodes((nds) => applyNodeChanges(changes, nds) as Node<AnyNodeData>[])
    },
    [updateNodes]
  )

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      updateEdges((eds) => applyEdgeChanges(changes, eds))
    },
    [updateEdges]
  )

  const takeSnapshot = useCanvasStore((s) => s.takeSnapshot)

  const onConnect: OnConnect = useCallback(
    (connection: Connection) => {
      takeSnapshot()
      updateEdges((eds) =>
        addEdge(
          {
            ...connection,
            type: 'execEdge',
          },
          eds
        )
      )
    },
    [updateEdges, takeSnapshot]
  )

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      setSelectedNodeId(node.id)
    },
    [setSelectedNodeId]
  )

  const onNodeDoubleClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      useCanvasStore.getState().setEditingNodeId(node.id)
    },
    []
  )

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null)
    useCanvasStore.getState().setEditingNodeId(null)
  }, [setSelectedNodeId])

  const onNodeDragStart = useCallback(() => {
    takeSnapshot()
  }, [takeSnapshot])

  const onNodeDragStop = useCallback(() => {
    setSelectedNodeId(null)
    // 同时清除 ReactFlow 内部的 selected 状态
    updateNodes((nds) => nds.map((n) => ({ ...n, selected: false })))
  }, [setSelectedNodeId, updateNodes])

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const selectedId = useCanvasStore.getState().selectedNodeId
        if (selectedId) {
          removeNode(selectedId)
        }
      }
      if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        if (e.shiftKey) {
          useCanvasStore.getState().redo()
        } else {
          useCanvasStore.getState().undo()
        }
      }
    },
    [removeNode]
  )

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }, [])

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()

      const data = e.dataTransfer.getData('application/flow-packet-message')
      if (!data) return

      let message: MessageInfo
      try {
        message = JSON.parse(data)
      } catch {
        return
      }

      // 查找 route 映射（允许无映射时也能拖入画布）
      const mapping = routeMappings.find((m) => m.requestMsg === message.Name)

      const instance = reactFlowInstance.current
      if (!instance) return

      const position = instance.screenToFlowPosition({
        x: e.clientX,
        y: e.clientY,
      })

      const newNode: Node<RequestNodeData> = {
        id: `node_${Date.now()}`,
        type: 'requestNode',
        position,
        data: {
          messageName: message.Name,
          route: mapping?.route ?? 0,
          fields: {},
          responseFields: message.Fields?.map((f) => ({
            name: f.name,
            type: f.type,
          })),
        },
      }

      addNode(newNode)
    },
    [addNode, routeMappings]
  )

  const onWrapperMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.ctrlKey && e.button === 0) {
        e.stopPropagation()
        const instance = reactFlowInstance.current
        if (!instance) return
        const flowPos = instance.screenToFlowPosition({ x: e.clientX, y: e.clientY })
        setDrawStart(flowPos)
        setDrawCurrent(flowPos)
        setDrawingComment(true)
      }
    },
    []
  )

  const onWrapperMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!drawingComment) return
      const instance = reactFlowInstance.current
      if (!instance) return
      const flowPos = instance.screenToFlowPosition({ x: e.clientX, y: e.clientY })
      setDrawCurrent(flowPos)
    },
    [drawingComment]
  )

  const onWrapperMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (!drawingComment || !drawStart || !drawCurrent) return
      e.stopPropagation()

      const x = Math.min(drawStart.x, drawCurrent.x)
      const y = Math.min(drawStart.y, drawCurrent.y)
      const w = Math.max(200, Math.abs(drawCurrent.x - drawStart.x))
      const h = Math.max(80, Math.abs(drawCurrent.y - drawStart.y))

      const newNode: Node<AnyNodeData> = {
        id: `comment_${Date.now()}`,
        type: 'commentNode',
        position: { x, y },
        style: { width: w, height: h },
        zIndex: -1,
        data: {
          label: '备注',
          color: '#9B8E7B',
        },
      }

      addNode(newNode)
      setDrawingComment(false)
      setDrawStart(null)
      setDrawCurrent(null)
    },
    [drawingComment, drawStart, drawCurrent, addNode]
  )

  // Compute preview rect in screen coordinates
  let previewRect: { left: number; top: number; width: number; height: number } | null = null
  if (drawingComment && drawStart && drawCurrent) {
    const instance = reactFlowInstance.current
    if (instance) {
      const startScreen = instance.flowToScreenPosition(drawStart)
      const currentScreen = instance.flowToScreenPosition(drawCurrent)
      const wrapperBounds = reactFlowWrapper.current?.getBoundingClientRect()
      if (wrapperBounds) {
        const left = Math.min(startScreen.x, currentScreen.x) - wrapperBounds.left
        const top = Math.min(startScreen.y, currentScreen.y) - wrapperBounds.top
        const width = Math.abs(currentScreen.x - startScreen.x)
        const height = Math.abs(currentScreen.y - startScreen.y)
        previewRect = { left, top, width, height }
      }
    }
  }

  return (
    <div
      ref={reactFlowWrapper}
      className="relative w-full h-full"
      onKeyDown={onKeyDown}
      onMouseDown={onWrapperMouseDown}
      onMouseMove={onWrapperMouseMove}
      onMouseUp={onWrapperMouseUp}
      tabIndex={0}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onInit={(instance) => { reactFlowInstance.current = instance }}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClick}
        onNodeDragStart={onNodeDragStart}
        onNodeDragStop={onNodeDragStop}
        onPaneClick={onPaneClick}
        onDragOver={onDragOver}
        onDrop={onDrop}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        colorMode={theme as ColorMode}
        fitView
        fitViewOptions={{ maxZoom: 1 }}
        minZoom={0.25}
        maxZoom={2.0}
        defaultEdgeOptions={{ type: 'execEdge' }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          color="#62748e"
          className="dark:!bg-background"
        />
        <MiniMap
          nodeStrokeWidth={4}
          maskStrokeColor={theme === 'dark' ? '#FFFFFF1A' : '#e2e8f0'}
          maskColor={theme === 'dark' ? '#21262d77' : '#62748e05'}
          maskStrokeWidth={1}
          nodeClassName="!fill-muted-foreground/20"
          className="!bg-background border rounded-lg overflow-hidden"
        />
        <CanvasControls />
      </ReactFlow>
      {/* Ctrl+drag 绘制预览矩形 */}
      {previewRect && (
        <div
          className="absolute pointer-events-none border-2 border-[#9B8E7B] rounded-[12px]"
          style={{
            left: previewRect.left,
            top: previewRect.top,
            width: previewRect.width,
            height: previewRect.height,
            background: '#9B8E7B1A',
          }}
        />
      )}
    </div>
  )
}
