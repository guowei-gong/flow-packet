import { useRef } from 'react'
import { Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { uploadProtoFiles } from '@/services/api'
import { useProtoStore } from '@/stores/protoStore'

export function ProtoImport() {
  const inputRef = useRef<HTMLInputElement>(null)
  const setFiles = useProtoStore((s) => s.setFiles)
  const setMessages = useProtoStore((s) => s.setMessages)

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    const protoFiles = files.filter((f) => f.name.endsWith('.proto'))
    if (protoFiles.length === 0) return

    try {
      const result = await uploadProtoFiles(protoFiles)
      setFiles(result.files || [])
      setMessages(result.messages || [])
    } catch (err) {
      const missing = (err as Error & { missingImports?: string[] }).missingImports
      if (missing && missing.length > 0) {
        toast.error('Proto 文件缺少依赖', {
          description: `缺少以下文件，请导入包含这些文件的文件夹：\n${missing.join('\n')}`,
          duration: 8000,
        })
      } else {
        toast.error('Proto 导入失败', {
          description: (err as Error).message,
        })
      }
    }

    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={handleUpload}
        {...({ webkitdirectory: '', directory: '' } as React.InputHTMLAttributes<HTMLInputElement>)}
      />
      <Button
        variant="default"
        size="sm"
        className="w-full gap-1.5 h-7 text-xs"
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="w-3.5 h-3.5" />
        导入文件夹
      </Button>
    </>
  )
}
