import { Brain } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Loader } from './Loader'

interface ReasoningProps {
  content: string
  isLoading?: boolean
  className?: string
}

export function Reasoning({ content, isLoading, className }: ReasoningProps) {
  return (
    <div className={cn('flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-sm', className)}>
      <Brain className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {isLoading && <Loader variant="dots" className="h-3 w-3" />}
          <span>Reasoning</span>
        </div>
        <p className="text-muted-foreground whitespace-pre-wrap">{content}</p>
      </div>
    </div>
  )
}

interface ThinkingBarProps {
  isThinking?: boolean
  className?: string
}

export function ThinkingBar({ isThinking = true, className }: ThinkingBarProps) {
  if (!isThinking) return null

  return (
    <div className={cn('flex items-center gap-2 text-xs text-muted-foreground', className)}>
      <Loader variant="dots" className="h-3 w-3" />
      <span>Thinking...</span>
    </div>
  )
}
