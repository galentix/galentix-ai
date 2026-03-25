import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, X, File } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FileUploadProps {
  onFilesSelected?: (files: File[]) => void
  accept?: Record<string, string[]>
  maxFiles?: number
  className?: string
}

export function FileUpload({
  onFilesSelected,
  accept = { 'application/pdf': ['.pdf'], 'text/plain': ['.txt'] },
  maxFiles = 5,
  className
}: FileUploadProps) {
  const [files, setFiles] = useState<File[]>([])

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setFiles((prev) => [...prev, ...acceptedFiles].slice(0, maxFiles))
    onFilesSelected?.(acceptedFiles)
  }, [maxFiles, onFilesSelected])

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept,
    maxFiles
  })

  return (
    <div className={cn('space-y-3', className)}>
      <div
        {...getRootProps()}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors',
          isDragActive ? 'border-primary bg-muted' : 'border-border hover:border-muted-foreground'
        )}
      >
        <input {...getInputProps()} />
        <Upload className="h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">
          {isDragActive ? 'Drop files here' : 'Drag & drop files or click to browse'}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          PDF, TXT up to {maxFiles} files
        </p>
      </div>

      {files.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {files.map((file, index) => (
            <div
              key={index}
              className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2"
            >
              <File className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm truncate max-w-[150px]">{file.name}</span>
              <button
                onClick={() => removeFile(index)}
                className="flex h-4 w-4 items-center justify-center rounded hover:bg-muted"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
