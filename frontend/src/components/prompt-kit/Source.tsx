import { FileText, Globe, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SourceProps {
  title: string
  url?: string
  type?: 'document' | 'web'
  className?: string
}

export function Source({ title, url, type = 'web', className }: SourceProps) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'flex items-center gap-2 rounded-lg border border-border bg-card p-3 text-sm transition-colors hover:bg-muted',
        className
      )}
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
        {type === 'document' ? (
          <FileText className="h-4 w-4 text-muted-foreground" />
        ) : (
          <Globe className="h-4 w-4 text-muted-foreground" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="truncate font-medium">{title}</p>
        {url && (
          <p className="truncate text-xs text-muted-foreground">{url}</p>
        )}
      </div>
      <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" />
    </a>
  )
}

interface SourceListProps {
  sources: SourceProps[]
  className?: string
}

export function SourceList({ sources, className }: SourceListProps) {
  if (sources.length === 0) return null

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {sources.map((source, index) => (
        <Source key={index} {...source} />
      ))}
    </div>
  )
}
