import * as React from 'react'
import { User, Bot } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Markdown } from './Markdown'

interface MessageProps extends React.HTMLProps<HTMLDivElement> {
  role?: 'user' | 'assistant' | 'system'
  children?: React.ReactNode
  isStreaming?: boolean
}

export function Message({ 
  role = 'assistant', 
  children, 
  className, 
  isStreaming,
  ...props 
}: MessageProps) {
  const isUser = role === 'user'

  return (
    <div
      className={cn(
        'flex w-full gap-4',
        isUser ? 'flex-row-reverse' : '',
        className
      )}
      {...props}
    >
      <div
        className={cn(
          'flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-full border border-border',
          isUser 
            ? 'bg-primary text-primary-foreground' 
            : 'bg-muted text-muted-foreground'
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>
      <div
        className={cn(
          'flex max-w-[80%] flex-col gap-2',
          isUser ? 'items-end' : 'items-start'
        )}
      >
        <div
          className={cn(
            'rounded-2xl px-4 py-3',
            isUser 
              ? 'bg-primary text-primary-foreground rounded-tr-none' 
              : 'bg-muted rounded-tl-none'
          )}
        >
          {children}
        </div>
      </div>
    </div>
  )
}

interface MessageContentProps {
  children: React.ReactNode
  className?: string
}

export function MessageContent({ children, className }: MessageContentProps) {
  return (
    <div className={cn('text-sm', className)}>
      {children}
    </div>
  )
}

interface MessageMarkdownProps {
  children: string
  className?: string
}

export function MessageMarkdown({ children, className }: MessageMarkdownProps) {
  return <Markdown className={className}>{children}</Markdown>
}

export function MessageActions({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-center gap-1 mt-2', className)}>
      {children}
    </div>
  )
}

export function MessageAction({ 
  children, 
  onClick,
  className 
}: { 
  children: React.ReactNode
  onClick?: () => void
  className?: string 
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground rounded-md hover:bg-muted transition-colors',
        className
      )}
    >
      {children}
    </button>
  )
}
