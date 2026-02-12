import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { useConnectionStore } from '@/stores/connectionStore'
import { connectTCP, disconnectTCP } from '@/services/api'

export function ConnectionForm() {
  const config = useConnectionStore((s) => s.config)
  const setConfig = useConnectionStore((s) => s.setConfig)
  const connState = useConnectionStore((s) => s.state)
  const setState = useConnectionStore((s) => s.setState)
  const setTargetAddr = useConnectionStore((s) => s.setTargetAddr)

  const isConnected = connState === 'connected'
  const isConnecting = connState === 'connecting' || connState === 'reconnecting'

  const handleConnect = async () => {
    setState('connecting')
    setTargetAddr(`${config.host}:${config.port}`)
    try {
      await connectTCP(config.host, config.port, {
        timeout: config.timeout,
        reconnect: config.reconnect,
        heartbeat: config.heartbeat,
      })
    } catch {
      setState('disconnected')
    }
  }

  const handleDisconnect = async () => {
    try {
      await disconnectTCP()
      setState('disconnected')
    } catch {
      // ignore
    }
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">协议</Label>
        <Input value="TCP" disabled className="h-7 text-xs" />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">地址</Label>
        <Input
          value={config.host}
          onChange={(e) => setConfig({ host: e.target.value })}
          disabled={isConnected}
          className="h-7 text-xs"
          placeholder="127.0.0.1"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">端口</Label>
        <Input
          type="number"
          min={1}
          max={65535}
          value={config.port}
          onChange={(e) => setConfig({ port: parseInt(e.target.value) || 0 })}
          disabled={isConnected}
          className="h-7 text-xs"
          placeholder="9001"
        />
      </div>

      <div className="flex items-center justify-between">
        <Label className="text-xs text-muted-foreground">自动重连</Label>
        <Switch
          checked={config.reconnect}
          onCheckedChange={(v) => setConfig({ reconnect: v })}
          disabled={isConnected}
        />
      </div>

      <div className="flex items-center justify-between">
        <Label className="text-xs text-muted-foreground">心跳</Label>
        <Switch
          checked={config.heartbeat}
          onCheckedChange={(v) => setConfig({ heartbeat: v })}
          disabled={isConnected}
        />
      </div>

      <Button
        className="w-full h-7 text-xs"
        variant={isConnected ? 'destructive' : 'default'}
        disabled={isConnecting}
        onClick={isConnected ? handleDisconnect : handleConnect}
      >
        {isConnecting ? '连接中...' : isConnected ? '断开连接' : '连接'}
      </Button>
    </div>
  )
}
