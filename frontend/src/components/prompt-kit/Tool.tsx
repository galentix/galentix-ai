import { Wrench, CheckCircle, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ToolProps {
  name: string
  status?: 'pending' | 'running' | 'completed' | 'error'
  output?: string
  className?: string
}

export function Tool({ name, status = 'pending', output, className }: ToolProps) {
  const statusIcons = {
    pending: <div className="h-2 w-2 rounded-full bg-muted-foreground" />,
    running: <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />,
    completed: <CheckCircle className="h-3 w-3 text-green-500" />,
    error: <XCircle className="h-3 w-3 text-destructive" />
  }

  return (
    <div className={cn('flex flex-col gap-2 rounded-lg border border-border p-3', className)}>
      <div className="flex items-center gap-2">
        <Wrench className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">{name}</span>
        {statusIcons[status]}
      </div>
      {output && (
        <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
          <code>{output}</code>
        </pre>
      )}
    </div>
  )
}

interface ToolUseProps {
  toolName: string
  args?: Record<string, any>
  result?: string
  className?: string
}

export function ToolUse({ toolName, args, result, className }: ToolUseProps) {
  return (
    <div className={cn('flex flex-col gap-2 rounded-lg border border-border bg-card p-3', className)}>
      <div className="flex items-center gap-2">
        <Wrench className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Using tool: {toolName}</span>
      </div>
      {args && (
        <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
          <code>{JSON.stringify(args, null, 2)}</code>
        </pre>
      )}
      {result && (
        <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
          <code>{result}</code>
        </pre>
      )}
    </div>
  )
}
