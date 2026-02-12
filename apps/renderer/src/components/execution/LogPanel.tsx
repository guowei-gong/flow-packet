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
      <div className="font-mono text-[11px] p-2 space-y-0.5">
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

  return (
    <div className="flex items-start gap-2">
      <span className="text-muted-foreground">{time}</span>
      <span
        className="w-8 shrink-0 text-center font-bold"
        style={{ color: typeColors[log.type] }}
      >
        {typeLabels[log.type]}
      </span>
      <span className="text-muted-foreground">[{log.nodeId}]</span>
      <span className="flex-1 text-foreground">
        {formatData(log.data)}
      </span>
      {log.duration !== undefined && (
        <span className="text-muted-foreground">{log.duration}ms</span>
      )}
    </div>
  )
}

function formatData(data: Record<string, unknown>): string {
  try {
    return JSON.stringify(data)
  } catch {
    return String(data)
  }
}
