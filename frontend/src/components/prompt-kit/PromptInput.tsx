import * as React from 'react'
import TextareaAutosize from 'react-textarea-autosize'
import { Send, Loader2, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PromptInputProps {
  value?: string
  onValueChange?: (value: string) => void
  onSubmit?: () => void
  isLoading?: boolean
  maxHeight?: number
  placeholder?: string
  disabled?: boolean
  className?: string
  children?: React.ReactNode
}

export function PromptInput({
  value = '',
  onValueChange,
  onSubmit,
  isLoading = false,
  maxHeight = 240,
  placeholder = 'Ask anything...',
  disabled = false,
  className,
  children,
}: PromptInputProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSubmit?.()
    }
  }

  return (
    <div className={cn('flex flex-col gap-2 w-full', className)}>
      <div className="flex items-end gap-2 rounded-xl border border-input bg-background p-2">
        <TextareaAutosize
          value={value}
          onChange={(e) => onValueChange?.(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || isLoading}
          maxRows={Math.floor(maxHeight / 24)}
          className="flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-muted-foreground disabled:opacity-50"
        />
        <button
          onClick={onSubmit}
          disabled={disabled || isLoading || !value.trim()}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </button>
      </div>
      {children}
    </div>
  )
}

export function PromptInputTextarea({
  className,
  onKeyDown,
  ...props
}: React.ComponentProps<typeof TextareaAutosize>) {
  return (
    <TextareaAutosize
      onKeyDown={onKeyDown}
      className={cn(
        'flex w-full resize-none rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  )
}

interface PromptInputActionsProps {
  children: React.ReactNode
  className?: string
}

export function PromptInputActions({ children, className }: PromptInputActionsProps) {
  return (
    <div className={cn('flex items-center gap-1 px-2 pb-2', className)}>
      {children}
    </div>
  )
}

interface PromptInputActionProps {
  onClick?: () => void
  children: React.ReactNode
  className?: string
  disabled?: boolean
}

export function PromptInputAction({ onClick, children, className, disabled }: PromptInputActionProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50',
        className
      )}
    >
      {children}
    </button>
  )
}

interface PromptInputClearProps {
  onClick?: () => void
  className?: string
}

export function PromptInputClear({ onClick, className }: PromptInputClearProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors',
        className
      )}
    >
      <X className="h-3 w-3" />
    </button>
  )
}
