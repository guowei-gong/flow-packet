import { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  useSavedConnectionStore,
  TAG_OPTIONS,
  COLOR_OPTIONS,
  type SavedConnection,
} from '@/stores/savedConnectionStore'
import { connectTCP, disconnectTCP } from '@/services/api'
import { cn } from '@/lib/utils'

interface CreateConnectionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editConnection?: SavedConnection | null
}

export function CreateConnectionDialog({
  open,
  onOpenChange,
  editConnection,
}: CreateConnectionDialogProps) {
  const addConnection = useSavedConnectionStore((s) => s.addConnection)
  const updateConnection = useSavedConnectionStore((s) => s.updateConnection)

  const [name, setName] = useState('')
  const [tag, setTag] = useState('本地')
  const [host, setHost] = useState('127.0.0.1')
  const [port, setPort] = useState(9001)
  const [color, setColor] = useState(COLOR_OPTIONS[0])
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    if (open) {
      if (editConnection) {
        setName(editConnection.name)
        setTag(editConnection.tag)
        setHost(editConnection.host)
        setPort(editConnection.port)
        setColor(editConnection.color)
      } else {
        setName('')
        setTag('本地')
        setHost('127.0.0.1')
        setPort(9001)
        setColor(COLOR_OPTIONS[0])
      }
      setTesting(false)
    }
  }, [open, editConnection])

  const handleTest = async () => {
    if (!host || !port) {
      toast.error('请填写地址和端口')
      return
    }
    setTesting(true)
    try {
      await connectTCP(host, port, {
        timeout: 5000,
        reconnect: false,
        heartbeat: false,
      })
      toast.message('连接成功', {
        description: `成功连接到 ${host}:${port}`,
      })
      await disconnectTCP()
    } catch {
      toast.error('连接失败', {
        description: `无法连接到 ${host}:${port}`,
      })
    } finally {
      setTesting(false)
    }
  }

  const handleSave = () => {
    if (!name.trim()) {
      toast.error('请输入连接名称')
      return
    }
    if (!host.trim()) {
      toast.error('请输入地址')
      return
    }
    if (!port || port < 1 || port > 65535) {
      toast.error('请输入有效端口 (1-65535)')
      return
    }

    if (editConnection) {
      updateConnection(editConnection.id, {
        name: name.trim(),
        tag,
        host: host.trim(),
        port,
        color,
      })
      toast.message('连接已更新')
    } else {
      addConnection({
        name: name.trim(),
        tag,
        host: host.trim(),
        port,
        protocol: 'tcp',
        color,
      })
      toast.message('连接已保存')
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md p-0 border-0 bg-transparent shadow-none gap-0"
        showCloseButton={false}
      >
        <Card>
          <CardHeader>
            <CardTitle>{editConnection ? '编辑连接' : '新建连接'}</CardTitle>
            <CardDescription>
              配置目标服务器的连接信息，保存后可在首页快速访问
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => { e.preventDefault(); handleSave() }}>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="conn-name">连接名称</FieldLabel>
                  <Input
                    id="conn-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="我的游戏服务器"
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="conn-host">Host / IP</FieldLabel>
                  <Input
                    id="conn-host"
                    type="text"
                    value={host}
                    onChange={(e) => setHost(e.target.value)}
                    placeholder="127.0.0.1"
                    required
                  />
                  <FieldDescription>
                    目标服务器的 IP 地址或域名
                  </FieldDescription>
                </Field>
                <div className="flex gap-4">
                  <Field className="flex-1">
                    <FieldLabel htmlFor="conn-port">端口</FieldLabel>
                    <Input
                      id="conn-port"
                      type="number"
                      min={1}
                      max={65535}
                      value={port}
                      onChange={(e) => setPort(parseInt(e.target.value) || 0)}
                      placeholder="9001"
                      required
                    />
                  </Field>
                  <Field className="flex-1">
                    <FieldLabel htmlFor="conn-tag">标签</FieldLabel>
                    <Select value={tag} onValueChange={setTag}>
                      <SelectTrigger id="conn-tag" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TAG_OPTIONS.map((t) => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
                <Field>
                  <FieldLabel>标识颜色</FieldLabel>
                  <div className="flex items-center gap-2">
                    {COLOR_OPTIONS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        className={cn(
                          'w-6 h-6 rounded-full transition-all',
                          color === c
                            ? 'ring-2 ring-ring ring-offset-2 ring-offset-background scale-110'
                            : 'opacity-60 hover:opacity-100 hover:scale-105'
                        )}
                        style={{ backgroundColor: c }}
                        onClick={() => setColor(c)}
                      />
                    ))}
                  </div>
                  <FieldDescription>
                    用于在连接列表中快速区分不同服务器
                  </FieldDescription>
                </Field>
                <FieldGroup>
                  <Field>
                    <Button type="submit" className="w-full">
                      保存连接
                    </Button>
                    <Button
                      variant="outline"
                      type="button"
                      className="w-full"
                      disabled={testing}
                      onClick={handleTest}
                    >
                      {testing && <Loader2 className="w-4 h-4 animate-spin" />}
                      {testing ? '测试中...' : '测试连接'}
                    </Button>
                    <FieldDescription className="px-6 text-center">
                      测试将尝试与目标服务器建立 TCP 连接
                    </FieldDescription>
                  </Field>
                </FieldGroup>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  )
}
