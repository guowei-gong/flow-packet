import { sendRequest } from './ws'

const API_BASE = () => {
  const port = (window as { __BACKEND_PORT__?: number }).__BACKEND_PORT__ || 3001
  return `http://127.0.0.1:${port}`
}

// TCP 连接管理
export async function connectTCP(host: string, port: number, options?: {
  timeout?: number
  reconnect?: boolean
  heartbeat?: boolean
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
export async function uploadProtoFiles(files: File[]) {
  const formData = new FormData()
  files.forEach((f) => formData.append('files', f))

  const resp = await fetch(`${API_BASE()}/api/proto/upload`, {
    method: 'POST',
    body: formData,
  })

  if (!resp.ok) {
    const err = await resp.json()
    throw new Error(err.error || 'Upload failed')
  }

  return resp.json()
}

export async function getProtoList() {
  return sendRequest('proto.list')
}

// Route 映射
export async function getRouteList() {
  return sendRequest('route.list')
}

export async function setRouteMapping(route: number, requestMsg: string, responseMsg: string) {
  return sendRequest('route.set', { route, requestMsg, responseMsg })
}

export async function deleteRouteMapping(route: number) {
  return sendRequest('route.delete', { route })
}

// 流程执行
export async function executeFlow(nodes: unknown[], edges: unknown[]) {
  return sendRequest('flow.execute', { nodes, edges })
}

export async function stopFlow() {
  return sendRequest('flow.stop')
}
