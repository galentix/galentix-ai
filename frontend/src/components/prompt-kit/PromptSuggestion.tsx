import { cn } from '@/lib/utils'
import { Sparkles } from 'lucide-react'

interface PromptSuggestionProps {
  children: React.ReactNode
  onClick?: () => void
  className?: string
}

export function PromptSuggestion({ children, onClick, className }: PromptSuggestionProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-3 text-sm text-left transition-colors hover:bg-muted',
        className
      )}
    >
      <Sparkles className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span>{children}</span>
    </button>
  )
}

interface PromptSuggestionListProps {
  suggestions: string[]
  onSelect?: (suggestion: string) => void
  className?: string
}

export function PromptSuggestionList({ suggestions, onSelect, className }: PromptSuggestionListProps) {
  if (suggestions.length === 0) return null

  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {suggestions.map((suggestion, index) => (
        <PromptSuggestion
          key={index}
          onClick={() => onSelect?.(suggestion)}
        >
          {suggestion}
        </PromptSuggestion>
      ))}
    </div>
  )
}
