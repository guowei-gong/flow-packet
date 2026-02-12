import { useState } from 'react'
import { ChevronRight, ChevronDown, FileText, Box } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useProtoStore, type FileInfo, type MessageInfo } from '@/stores/protoStore'
import { ProtoImport } from './ProtoImport'

export function ProtoBrowser() {
  const files = useProtoStore((s) => s.files)

  return (
    <div className="flex flex-col h-full">
      <div
        className="flex items-center justify-between px-3 h-8 shrink-0 border-b border-border"
      >
        <span className="text-xs font-medium text-muted-foreground">
          协议浏览器
        </span>
      </div>

      <div className="px-2 py-1.5">
        <ProtoImport />
      </div>

      <ScrollArea className="flex-1">
        <div className="px-1 pb-2">
          {files.map((file) => (
            <FileNode key={file.Path} file={file} />
          ))}
          {files.length === 0 && (
            <div className="px-3 py-4 text-center">
              <span className="text-xs text-muted-foreground">
                尚未导入 Proto 文件
              </span>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

function FileNode({ file }: { file: FileInfo }) {
  const [expanded, setExpanded] = useState(true)

  return (
    <div>
      <div
        className="flex items-center gap-1 px-2 py-1 cursor-pointer rounded hover:bg-white/5"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? (
          <ChevronDown className="w-3 h-3 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="w-3 h-3 shrink-0 text-muted-foreground" />
        )}
        <FileText className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
        <span className="text-xs truncate text-foreground">
          {file.Path}
        </span>
        {file.Package && (
          <span className="text-[10px] ml-auto shrink-0 text-muted-foreground">
            {file.Package}
          </span>
        )}
      </div>

      {expanded && file.Messages?.map((msg) => (
        <MessageNode key={msg.Name} message={msg} depth={1} />
      ))}
    </div>
  )
}

function MessageNode({ message, depth }: { message: MessageInfo; depth: number }) {
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('application/flow-packet-message', JSON.stringify(message))
    e.dataTransfer.effectAllowed = 'copy'
  }

  return (
    <div
      className="flex items-center gap-1 px-2 py-0.5 cursor-grab rounded hover:bg-white/5"
      style={{ paddingLeft: `${depth * 16 + 8}px` }}
      draggable
      onDragStart={handleDragStart}
      title={message.Fields?.map((f) => `${f.name}: ${f.type}`).join('\n')}
    >
      <Box className="w-3.5 h-3.5 shrink-0" style={{ color: '#1B6EF3' }} />
      <span className="text-xs truncate text-foreground">
        {message.ShortName}
      </span>
    </div>
  )
}
