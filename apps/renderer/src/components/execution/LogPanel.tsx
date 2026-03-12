import { useState, useMemo, useCallback } from 'react'
import { ChevronRight, Copy, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
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

const COLLAPSE_THRESHOLD = 200

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
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)

  const time = new Date(log.timestamp).toLocaleTimeString('zh-CN', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
  })

  const hasData = Object.keys(log.data).length > 0
  const formatted = useMemo(() => hasData ? formatData(log.data) : '', [log.data, hasData])
  const isLong = formatted.length > COLLAPSE_THRESHOLD
  const preview = useMemo(
    () => isLong ? formatCompact(log.data) : '',
    [log.data, isLong],
  )

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(formatted).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }, [formatted])

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
        {isLong && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="inline-flex items-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronRight className={cn('size-3 transition-transform', expanded && 'rotate-90')} />
          </button>
        )}
        {formatted && (
          <button
            onClick={handleCopy}
            className="inline-flex items-center text-muted-foreground hover:text-foreground transition-colors"
            title="复制"
          >
            {copied
              ? <Check className="size-3 text-green-500" />
              : <Copy className="size-3" />}
          </button>
        )}
        {log.duration !== undefined && (
          <span className="text-muted-foreground ml-auto">{log.duration}ms</span>
        )}
      </div>
      {formatted && (
        isLong ? (
          expanded ? (
            <pre className="text-foreground whitespace-pre-wrap break-all mt-0.5" style={{ paddingLeft: 80 }}>
              {formatted}
            </pre>
          ) : (
            <div className="text-foreground truncate mt-0.5" style={{ paddingLeft: 80 }}>
              {preview}
            </div>
          )
        ) : (
          <pre className="text-foreground whitespace-pre-wrap break-all mt-0.5" style={{ paddingLeft: 80 }}>
            {formatted}
          </pre>
        )
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

function formatCompact(data: Record<string, unknown>): string {
  try {
    return JSON.stringify(data)
  } catch {
    return String(data)
  }
}
