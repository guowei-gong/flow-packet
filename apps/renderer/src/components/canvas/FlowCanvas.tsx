import { useCallback, useRef } from 'react'
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  type Connection,
  type NodeTypes,
  type EdgeTypes,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useCanvasStore, type RequestNodeData } from '@/stores/canvasStore'
import { useProtoStore, type MessageInfo } from '@/stores/protoStore'
import { RequestNode } from './nodes/RequestNode'
import { ExecEdge } from './edges/ExecEdge'
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

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null)
  }, [setSelectedNodeId])

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

      const wrapper = reactFlowWrapper.current
      if (!wrapper) return
      const bounds = wrapper.getBoundingClientRect()

      const newNode: Node<RequestNodeData> = {
        id: `node_${Date.now()}`,
        type: 'requestNode',
        position: {
          x: e.clientX - bounds.left - 100,
          y: e.clientY - bounds.top - 20,
        },
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
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onDragOver={onDragOver}
        onDrop={onDrop}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        minZoom={0.25}
        maxZoom={2.0}
        defaultEdgeOptions={{ type: 'execEdge' }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="hsl(var(--border))"
        />
      </ReactFlow>
    </div>
  )
}
