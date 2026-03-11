import { sendRequest } from './ws'

const API_BASE = () => {
  const port = (window as { __BACKEND_PORT__?: number }).__BACKEND_PORT__ || 3001
  return `http://127.0.0.1:${port}`
}

// TCP 连接管理
export async function connectTCP(host: string, port: number, options?: {
  protocol?: 'tcp' | 'ws'
  timeout?: number
  reconnect?: boolean
  heartbeat?: boolean
  frameFields?: { name: string; bytes: number; isRoute?: boolean; isSeq?: boolean }[]
}) {
  return sendRequest('conn.connect', { host, port, ...options })
}

export async function disconnectTCP() {
  return sendRequest('conn.disconnect')
}

export async function getConnectionStatus() {
  return sendRequest('conn.status')
}

// Proto 管理
export async function uploadProtoFiles(files: File[], connectionId: string) {
  const formData = new FormData()
  files.forEach((f) => {
    formData.append('files', f)
    // webkitRelativePath 格式: "选择的文件夹名/子路径/file.proto"
    // 保留完整路径，因为文件夹名可能是 proto import 路径的一部分
    const relPath = (f as File & { webkitRelativePath?: string }).webkitRelativePath
    formData.append('paths', relPath ? relPath.replace(/\\/g, '/') : f.name)
  })

  const resp = await fetch(`${API_BASE()}/api/proto/upload?connectionId=${encodeURIComponent(connectionId)}`, {
    method: 'POST',
    body: formData,
  })

  if (!resp.ok) {
    const err = await resp.json()
    const error = new Error(err.error || 'Upload failed') as Error & { missingImports?: string[] }
    if (err.missingImports) {
      error.missingImports = err.missingImports
    }
    throw error
  }

  return resp.json()
}

export async function getProtoList(connectionId: string) {
  return sendRequest('proto.list', { connectionId })
}

// Route 映射
export async function getRouteList(connectionId: string) {
  return sendRequest('route.list', { connectionId })
}

export async function setRouteMapping(route: number, requestMsg: string, responseMsg: string, connectionId: string) {
  return sendRequest('route.set', { route, requestMsg, responseMsg, connectionId })
}

export async function deleteRouteMapping(route: number, connectionId: string) {
  return sendRequest('route.delete', { route, connectionId })
}

// 模板管理
export async function getTemplateList() {
  return sendRequest('template.list')
}

export async function saveTemplate(name: string, fields: { name: string; bytes: number; isRoute?: boolean; isSeq?: boolean }[], byteOrder?: string) {
  return sendRequest('template.save', { name, fields, byteOrder })
}

export async function deleteTemplate(id: string) {
  return sendRequest('template.delete', { id })
}

// 集合管理
export async function listCollections() {
  return sendRequest('collection.list') as Promise<{
    folders: { id: string; name: string; parentId: string; createdAt: number }[]
    items: { id: string; name: string; folderId: string; nodes: unknown[]; edges: unknown[]; createdAt: number; updatedAt: number }[]
  }>
}

export async function saveCollection(name: string, folderId: string, nodes: unknown[], edges: unknown[]) {
  return sendRequest('collection.save', { name, folderId, nodes, edges }) as Promise<{
    item: { id: string; name: string; folderId: string; nodes: unknown[]; edges: unknown[]; createdAt: number; updatedAt: number }
  }>
}

export async function updateCollection(id: string, nodes: unknown[], edges: unknown[]) {
  return sendRequest('collection.update', { id, nodes, edges })
}

export async function renameCollection(id: string, name: string) {
  return sendRequest('collection.rename', { id, name })
}

export async function deleteCollection(id: string) {
  return sendRequest('collection.delete', { id })
}

export async function createCollectionFolder(name: string, parentId: string) {
  return sendRequest('collection.folder.create', { name, parentId }) as Promise<{
    folder: { id: string; name: string; parentId: string; createdAt: number }
  }>
}

export async function renameCollectionFolder(id: string, name: string) {
  return sendRequest('collection.folder.rename', { id, name })
}

export async function deleteCollectionFolder(id: string) {
  return sendRequest('collection.folder.delete', { id })
}

// 流程执行
export async function executeFlow(nodes: unknown[], edges: unknown[], connectionId: string) {
  return sendRequest('flow.execute', { nodes, edges, connectionId })
}

export async function stopFlow() {
  return sendRequest('flow.stop')
}
