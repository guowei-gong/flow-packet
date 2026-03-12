import { ScrollArea } from '@/components/ui/scroll-area'
import { useExecutionStore, type LogEntry } from '@/stores/executionStore'

const typeColors: Record<string, string> = {
  request: 'var(--pin-int)',
  response: 'var(--status-success)',
  error: 'var(--status-error)',
  info: 'hsl(var(--muted-foreground))',
}

const typeLabels: Record<string, string> = {
  request: 'REQ',
  response: 'RES',
  error: 'ERR',
  info: 'INF',
}

export function LogPanel() {
  const logs = useExecutionStore((s) => s.logs)

  return (
    <ScrollArea className="h-full">
      <div className="font-mono text-[11px]" style={{ padding: '8px 8px 8px 22px' }}>
        {logs.length === 0 && (
          <div className="text-muted-foreground">
            等待执行...
          </div>
        )}
        {logs.map((log) => (
          <LogRow key={log.id} log={log} />
        ))}
      </div>
    </ScrollArea>
  )
}

function LogRow({ log }: { log: LogEntry }) {
  const time = new Date(log.timestamp).toLocaleTimeString('zh-CN', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
  })

  const hasData = Object.keys(log.data).length > 0
  const formatted = hasData ? formatData(log.data) : ''

  return (
    <div className="py-0.5">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">{time}</span>
        <span
          className="w-8 shrink-0 text-center font-bold"
          style={{ color: typeColors[log.type] }}
        >
          {typeLabels[log.type]}
        </span>
        <span className="text-muted-foreground">[{log.nodeId}]</span>
        {log.messageName && (
          <span className="text-blue-400">{shortName(log.messageName)}</span>
        )}
        {log.duration !== undefined && (
          <span className="text-muted-foreground">{log.duration}ms</span>
        )}
      </div>
      {formatted && (
        <pre className="text-foreground whitespace-pre-wrap break-all mt-0.5" style={{ paddingLeft: 80 }}>
          {formatted}
        </pre>
      )}
    </div>
  )
}

function shortName(fullName: string): string {
  const parts = fullName.split('.')
  return parts[parts.length - 1]
}

function formatData(data: Record<string, unknown>): string {
  try {
    return JSON.stringify(data, null, 2)
  } catch {
    return String(data)
  }
}
