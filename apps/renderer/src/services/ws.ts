type MessageHandler = (data: ServerMessage) => void
type EventCallback = (payload: unknown) => void

export interface ClientMessage {
  id: string
  action: string
  payload?: unknown
}

export interface ServerMessage {
  id?: string
  event: string
  payload?: unknown
}

let ws: WebSocket | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let reconnectAttempts = 0
const MAX_RECONNECT = 30
const RECONNECT_INTERVAL = 1000

const pendingRequests = new Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }>()
const eventSubscribers = new Map<string, Set<EventCallback>>()
let connectionStatusCallback: ((connected: boolean) => void) | null = null

export function setConnectionStatusCallback(cb: (connected: boolean) => void) {
  connectionStatusCallback = cb
}

export function connect(port: number) {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    return
  }

  const url = `ws://127.0.0.1:${port}/ws`
  ws = new WebSocket(url)

  ws.onopen = () => {
    reconnectAttempts = 0
    connectionStatusCallback?.(true)
  }

  ws.onclose = () => {
    connectionStatusCallback?.(false)
    scheduleReconnect(port)
  }

  ws.onerror = () => {
    // onclose will fire after onerror
  }

  ws.onmessage = (event) => {
    try {
      const msg: ServerMessage = JSON.parse(event.data)
      handleMessage(msg)
    } catch {
      // ignore parse errors
    }
  }
}

export function disconnect() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
  reconnectAttempts = MAX_RECONNECT // prevent reconnect
  if (ws) {
    ws.close()
    ws = null
  }
}

export function isConnected(): boolean {
  return ws?.readyState === WebSocket.OPEN
}

export function sendRequest(action: string, payload?: unknown): Promise<unknown> {
  return new Promise((resolve, reject) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      reject(new Error('WebSocket not connected'))
      return
    }

    const id = crypto.randomUUID()
    const timer = setTimeout(() => {
      pendingRequests.delete(id)
      reject(new Error('Request timeout'))
    }, 30000)

    pendingRequests.set(id, { resolve, reject, timer })

    const msg: ClientMessage = { id, action, payload }
    ws.send(JSON.stringify(msg))
  })
}

export function subscribe(event: string, callback: EventCallback): () => void {
  if (!eventSubscribers.has(event)) {
    eventSubscribers.set(event, new Set())
  }
  eventSubscribers.get(event)!.add(callback)

  return () => {
    eventSubscribers.get(event)?.delete(callback)
  }
}

function handleMessage(msg: ServerMessage) {
  // Request-response matching
  if (msg.id && pendingRequests.has(msg.id)) {
    const pending = pendingRequests.get(msg.id)!
    pendingRequests.delete(msg.id)
    clearTimeout(pending.timer)

    if (msg.event === 'error') {
      pending.reject(new Error((msg.payload as { message?: string })?.message || 'Unknown error'))
    } else {
      pending.resolve(msg.payload)
    }
    return
  }

  // Event dispatch (push messages without id)
  const subscribers = eventSubscribers.get(msg.event)
  if (subscribers) {
    subscribers.forEach((cb) => cb(msg.payload))
  }
}

function scheduleReconnect(port: number) {
  if (reconnectAttempts >= MAX_RECONNECT) return
  reconnectAttempts++

  reconnectTimer = setTimeout(() => {
    connect(port)
  }, RECONNECT_INTERVAL)
}
