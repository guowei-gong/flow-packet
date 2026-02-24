import { useRef } from 'react'
import { Upload, FolderUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { uploadProtoFiles } from '@/services/api'
import { useProtoStore } from '@/stores/protoStore'

export function ProtoImport() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)
  const setFiles = useProtoStore((s) => s.setFiles)
  const setMessages = useProtoStore((s) => s.setMessages)

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    // 文件夹模式：只保留 .proto 文件
    const protoFiles = files.filter((f) => f.name.endsWith('.proto'))
    if (protoFiles.length === 0) return

    try {
      const result = await uploadProtoFiles(protoFiles)
      setFiles(result.files || [])
      setMessages(result.messages || [])
    } catch (err) {
      console.error('Proto upload failed:', err)
    }

    // reset inputs
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (folderInputRef.current) folderInputRef.current.value = ''
  }

  return (
    <div className="flex gap-1">
      <input
        ref={fileInputRef}
        type="file"
        accept=".proto"
        multiple
        className="hidden"
        onChange={handleUpload}
      />
      <input
        ref={folderInputRef}
        type="file"
        className="hidden"
        onChange={handleUpload}
        {...({ webkitdirectory: '', directory: '' } as React.InputHTMLAttributes<HTMLInputElement>)}
      />
      <Button
        variant="default"
        size="sm"
        className="flex-1 gap-1.5 h-7 text-xs"
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload className="w-3.5 h-3.5" />
        导入文件
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="flex-1 gap-1.5 h-7 text-xs"
        onClick={() => folderInputRef.current?.click()}
      >
        <FolderUp className="w-3.5 h-3.5" />
        导入文件夹
      </Button>
    </div>
  )
}
