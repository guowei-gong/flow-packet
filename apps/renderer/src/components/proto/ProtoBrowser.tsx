import { ChevronRight, Folder, Box } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { useProtoStore, type FileInfo, type MessageInfo } from '@/stores/protoStore'
import { ProtoImport } from './ProtoImport'

export function ProtoBrowser() {
  const files = useProtoStore((s) => s.files)

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 h-8 shrink-0 border-b border-border">
        <span className="text-xs font-medium text-muted-foreground">
          协议浏览器
        </span>
      </div>

      <div className="px-2 py-1.5">
        <ProtoImport />
      </div>

      <ScrollArea className="flex-1">
        <SidebarGroup>
          <SidebarGroupLabel>Proto 文件</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {files.map((file) => (
                <FileNode key={file.Path} file={file} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {files.length === 0 && (
          <div className="px-3 py-4 text-center">
            <span className="text-xs text-muted-foreground">
              尚未导入 Proto 文件
            </span>
          </div>
        )}
      </ScrollArea>
    </div>
  )
}

function FileNode({ file }: { file: FileInfo }) {
  return (
    <SidebarMenuItem>
      <Collapsible
        defaultOpen
        className="group/collapsible [&[data-state=open]>button>svg:first-child]:rotate-90"
      >
        <CollapsibleTrigger asChild>
          <SidebarMenuButton>
            <ChevronRight className="transition-transform" />
            <Folder />
            {file.Path}
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div
            className="flex flex-col gap-1 border-l border-border py-0.5"
            style={{ marginLeft: 28, paddingLeft: 16 }}
          >
            {file.Messages?.map((msg) => (
              <MessageNode key={msg.Name} message={msg} />
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </SidebarMenuItem>
  )
}

function MessageNode({ message }: { message: MessageInfo }) {
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('application/flow-packet-message', JSON.stringify(message))
    e.dataTransfer.effectAllowed = 'copy'
  }

  return (
    <SidebarMenuButton
      className="cursor-grab"
      draggable
      onDragStart={handleDragStart}
      title={message.Fields?.map((f) => `${f.name}: ${f.type}`).join('\n')}
    >
      <Box className="text-blue-500" />
      {message.ShortName}
    </SidebarMenuButton>
  )
}
