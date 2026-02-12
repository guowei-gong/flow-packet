import { useCallback, useRef } from 'react'
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
import { useCanvasStore, type RequestNodeData } from '@/stores/canvasStore'
import { useProtoStore, type MessageInfo } from '@/stores/protoStore'
import { RequestNode } from './nodes/RequestNode'
import { ExecEdge } from './edges/ExecEdge'
import { CanvasControls } from './CanvasControls'
import type { Node } from '@xyflow/react'

const nodeTypes: NodeTypes = {
  requestNode: RequestNode,
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
  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  const reactFlowInstance = useRef<ReactFlowInstance | null>(null)

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      updateNodes((nds) => applyNodeChanges(changes, nds) as Node<RequestNodeData>[])
    },
    [updateNodes]
  )

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      updateEdges((eds) => applyEdgeChanges(changes, eds))
    },
    [updateEdges]
  )

  const onConnect: OnConnect = useCallback(
    (connection: Connection) => {
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
    [updateEdges]
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

  return (
    <div ref={reactFlowWrapper} className="relative w-full h-full" onKeyDown={onKeyDown} tabIndex={0}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onInit={(instance) => { reactFlowInstance.current = instance }}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClick}
        onNodeDragStop={onNodeDragStop}
        onPaneClick={onPaneClick}
        onDragOver={onDragOver}
        onDrop={onDrop}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        colorMode="dark"
        fitView
        minZoom={0.25}
        maxZoom={2.0}
        defaultEdgeOptions={{ type: 'execEdge' }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          color="#62748e"
        />
        <MiniMap
          nodeStrokeWidth={4}
          maskStrokeColor="#FFFFFF1A"
          maskColor="#21262d77"
          maskStrokeWidth={1}
          nodeClassName="!fill-muted-foreground/20"
          className="!bg-background border rounded-lg overflow-hidden"
        />
        <CanvasControls />
      </ReactFlow>
    </div>
  )
}
