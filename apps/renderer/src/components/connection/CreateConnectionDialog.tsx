import { useState, useEffect } from 'react'
import { Loader2, Plus, Trash2, Github, ChevronRight, ChevronLeft, Box } from 'lucide-react'
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
  CardFooter,
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
import { Badge } from '@/components/ui/badge'
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
import {
  FRAME_TEMPLATES,
  loadCustomTemplates,
  saveCustomTemplate,
  type FrameField,
  type FrameConfig,
} from '@/types/frame'

interface CreateConnectionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editConnection?: SavedConnection | null
}

function StepIndicator({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-1.5 mb-4">
      {[1, 2, 3].map((s) => (
        <div
          key={s}
          className={cn(
            'h-1 rounded-full transition-all',
            s === step
              ? 'w-6 bg-primary'
              : s < step
                ? 'w-3 bg-primary/40'
                : 'w-3 bg-muted'
          )}
        />
      ))}
    </div>
  )
}

function formatFramePreview(fields: FrameField[]) {
  return fields.map((f) => `${f.name}(${f.bytes}B)`).join(' + ')
}

export function CreateConnectionDialog({
  open,
  onOpenChange,
  editConnection,
}: CreateConnectionDialogProps) {
  const addConnection = useSavedConnectionStore((s) => s.addConnection)
  const updateConnection = useSavedConnectionStore((s) => s.updateConnection)

  // wizard state
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [frameType, setFrameType] = useState<'template' | 'custom'>('template')
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [customFields, setCustomFields] = useState<FrameField[]>([
    { name: '', bytes: 4 },
  ])

  // form state
  const [name, setName] = useState('')
  const [tag, setTag] = useState('本地')
  const [host, setHost] = useState('127.0.0.1')
  const [port, setPort] = useState(9001)
  const [color, setColor] = useState(COLOR_OPTIONS[0])
  const [testing, setTesting] = useState(false)
  const [showSaveTemplate, setShowSaveTemplate] = useState(false)
  const [templateName, setTemplateName] = useState('')

  const isEdit = !!editConnection

  useEffect(() => {
    if (open) {
      if (editConnection) {
        setName(editConnection.name)
        setTag(editConnection.tag)
        setHost(editConnection.host)
        setPort(editConnection.port)
        setColor(editConnection.color)
        setStep(3)
      } else {
        setName('')
        setTag('本地')
        setHost('127.0.0.1')
        setPort(9001)
        setColor(COLOR_OPTIONS[0])
        setStep(1)
        setFrameType('template')
        setSelectedTemplateId(null)
        setCustomFields([{ name: '', bytes: 4 }])
      }
      setTesting(false)
      setShowSaveTemplate(false)
      setTemplateName('')
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

  const buildFrameConfig = (): FrameConfig => {
    if (frameType === 'template') {
      const allTemplates = [...FRAME_TEMPLATES, ...loadCustomTemplates()]
      const tpl = allTemplates.find((t) => t.id === selectedTemplateId)!
      return { type: 'template', templateId: tpl.id, fields: tpl.fields }
    }
    return { type: 'custom', fields: customFields }
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
      onOpenChange(false)
    } else {
      addConnection({
        name: name.trim(),
        tag,
        host: host.trim(),
        port,
        protocol: 'tcp',
        color,
        frameConfig: buildFrameConfig(),
      })
      toast.message('连接已保存')
      if (frameType === 'custom') {
        setShowSaveTemplate(true)
      } else {
        onOpenChange(false)
      }
    }
  }

  const canProceedStep2 = () => {
    if (frameType === 'template') {
      return selectedTemplateId !== null
    }
    return customFields.length > 0 && customFields.every((f) => f.name.trim() && f.bytes > 0)
  }

  const handleAddField = () => {
    setCustomFields([...customFields, { name: '', bytes: 1 }])
  }

  const handleRemoveField = (index: number) => {
    setCustomFields(customFields.filter((_, i) => i !== index))
  }

  const handleFieldChange = (index: number, key: keyof FrameField, value: string | number) => {
    setCustomFields(customFields.map((f, i) =>
      i === index ? { ...f, [key]: value } : f
    ))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'p-0 border-0 bg-transparent shadow-none gap-0',
          step === 3 || showSaveTemplate ? 'sm:max-w-md' : 'sm:max-w-lg'
        )}
        showCloseButton={false}
      >
        {/* Save template confirmation */}
        {showSaveTemplate && (
          <Card>
            <CardHeader>
              <CardTitle>保存为模板？</CardTitle>
              <CardDescription>
                将当前自定义协议帧结构保存为模板，方便下次创建连接时直接使用
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3">
                <Field>
                  <FieldLabel htmlFor="template-name">模板名称</FieldLabel>
                  <Input
                    id="template-name"
                    type="text"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    placeholder="输入模板名称"
                  />
                </Field>
                <div className="text-xs text-muted-foreground px-1">
                  帧结构：{formatFramePreview(customFields.filter((f) => f.name.trim() && f.bytes > 0))}
                </div>
              </div>
            </CardContent>
            <CardFooter className="justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                取消
              </Button>
              <Button
                onClick={() => {
                  if (!templateName.trim()) {
                    toast.error('请输入模板名称')
                    return
                  }
                  saveCustomTemplate(
                    templateName.trim(),
                    customFields.filter((f) => f.name.trim() && f.bytes > 0)
                  )
                  toast.message('模板已保存')
                  onOpenChange(false)
                }}
              >
                保存
              </Button>
            </CardFooter>
          </Card>
        )}

        {/* Step 1: Choose frame format type */}
        {!showSaveTemplate && step === 1 && (
          <Card>
            <CardHeader>
              <StepIndicator step={1} />
              <CardTitle>选择协议帧格式</CardTitle>
              <CardDescription>
                选择使用已有框架的协议帧模板，或自定义协议帧结构
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  onClick={() => setFrameType('template')}
                  className={cn(
                    'flex items-start gap-3 rounded-lg border p-4 text-left transition-colors',
                    frameType === 'template'
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:bg-accent/50'
                  )}
                >
                  <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 border-current">
                    {frameType === 'template' && (
                      <div className="h-2 w-2 rounded-full bg-current" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">协议帧模板</div>
                    <div className="text-sm text-muted-foreground mt-0.5">
                      使用已有游戏服务器框架的协议帧格式，开箱即用
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setFrameType('custom')}
                  className={cn(
                    'flex items-start gap-3 rounded-lg border p-4 text-left transition-colors',
                    frameType === 'custom'
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:bg-accent/50'
                  )}
                >
                  <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 border-current">
                    {frameType === 'custom' && (
                      <div className="h-2 w-2 rounded-full bg-current" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">自定义协议帧</div>
                    <div className="text-sm text-muted-foreground mt-0.5">
                      手动定义协议帧的字段名和字节数，适配自研协议
                    </div>
                  </div>
                </button>
              </div>
            </CardContent>
            <CardFooter className="justify-end">
              <Button onClick={() => setStep(2)}>
                下一步
                <ChevronRight className="w-4 h-4" />
              </Button>
            </CardFooter>
          </Card>
        )}

        {/* Step 2a: Template selection */}
        {!showSaveTemplate && step === 2 && frameType === 'template' && (
          <Card>
            <CardHeader>
              <StepIndicator step={2} />
              <CardTitle>选择协议帧模板</CardTitle>
              <CardDescription>
                选择一个框架模板，将使用其协议帧格式进行通信
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col divide-y rounded-lg border">
                {[...FRAME_TEMPLATES, ...loadCustomTemplates()].map((tpl) => {
                  const selected = selectedTemplateId === tpl.id
                  const isCustom = !tpl.github
                  return (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => setSelectedTemplateId(tpl.id)}
                      className={cn(
                        'flex items-center gap-3 p-3 text-left transition-colors first:rounded-t-lg last:rounded-b-lg',
                        selected ? 'bg-primary/5' : 'hover:bg-accent/50'
                      )}
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
                        {isCustom ? (
                          <Box className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Github className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        {isCustom ? (
                          <span className="font-medium text-sm">{tpl.name}</span>
                        ) : (
                          <a
                            href={tpl.github}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="font-medium text-sm text-primary hover:underline"
                          >
                            {tpl.name}
                          </a>
                        )}
                        <div className="text-xs text-muted-foreground/70 mt-0.5 truncate">
                          {formatFramePreview(tpl.fields)}
                        </div>
                      </div>
                      <Badge variant={selected ? 'default' : 'outline'} className="shrink-0">
                        {selected ? '已选择' : '选择'}
                      </Badge>
                    </button>
                  )
                })}
              </div>
            </CardContent>
            <CardFooter className="justify-between">
              <Button variant="ghost" onClick={() => setStep(1)}>
                <ChevronLeft className="w-4 h-4" />
                上一步
              </Button>
              <Button onClick={() => setStep(3)} disabled={!selectedTemplateId}>
                下一步
                <ChevronRight className="w-4 h-4" />
              </Button>
            </CardFooter>
          </Card>
        )}

        {/* Step 2b: Custom frame fields */}
        {!showSaveTemplate && step === 2 && frameType === 'custom' && (
          <Card>
            <CardHeader>
              <StepIndicator step={2} />
              <CardTitle>自定义协议帧</CardTitle>
              <CardDescription>
                定义协议帧的字段结构，字段按顺序排列组成完整帧
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3">
                {customFields.map((field, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      className="flex-1"
                      placeholder="字段名"
                      value={field.name}
                      onChange={(e) => handleFieldChange(i, 'name', e.target.value)}
                    />
                    <div className="flex items-center gap-1">
                      <Input
                        className="w-20"
                        type="number"
                        min={1}
                        placeholder="字节"
                        value={field.bytes}
                        onChange={(e) => handleFieldChange(i, 'bytes', parseInt(e.target.value) || 0)}
                      />
                      <span className="text-sm text-muted-foreground w-3">B</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 h-8 w-8"
                      disabled={customFields.length <= 1}
                      onClick={() => handleRemoveField(i)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-fit"
                  onClick={handleAddField}
                >
                  <Plus className="h-3.5 w-3.5" />
                  添加字段
                </Button>
                {customFields.some((f) => f.name.trim() && f.bytes > 0) && (
                  <div className="text-xs text-muted-foreground mt-1 px-1">
                    帧结构预览：{formatFramePreview(customFields.filter((f) => f.name.trim() && f.bytes > 0))}
                  </div>
                )}
              </div>
            </CardContent>
            <CardFooter className="justify-between">
              <Button variant="ghost" onClick={() => setStep(1)}>
                <ChevronLeft className="w-4 h-4" />
                上一步
              </Button>
              <Button onClick={() => setStep(3)} disabled={!canProceedStep2()}>
                下一步
                <ChevronRight className="w-4 h-4" />
              </Button>
            </CardFooter>
          </Card>
        )}

        {/* Step 3: Connection form */}
        {!showSaveTemplate && step === 3 && (
          <Card>
            <CardHeader>
              {!isEdit && <StepIndicator step={3} />}
              <CardTitle>{isEdit ? '编辑连接' : '新建连接'}</CardTitle>
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
                      placeholder="连接名称"
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
        )}
      </DialogContent>
    </Dialog>
  )
}
