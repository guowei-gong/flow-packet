import { useRef } from 'react'
import { Upload } from 'lucide-react'
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

    try {
      const result = await uploadProtoFiles(files)
      setFiles(result.files || [])
      setMessages(result.messages || [])
    } catch (err) {
      console.error('Proto upload failed:', err)
    }

    // reset input
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".proto"
        multiple
        className="hidden"
        onChange={handleUpload}
      />
      <Button
        variant="default"
        size="sm"
        className="w-full gap-2 h-7 text-xs"
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="w-3.5 h-3.5" />
        导入 Proto 文件
      </Button>
    </>
  )
}
