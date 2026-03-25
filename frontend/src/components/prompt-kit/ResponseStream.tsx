import { useEffect, useState, useRef } from 'react'
import { cn } from '@/lib/utils'
import { Markdown } from './Markdown'

interface ResponseStreamProps {
  content: string
  isStreaming?: boolean
  className?: string
}

export function ResponseStream({ content, isStreaming, className }: ResponseStreamProps) {
  const [displayedContent, setDisplayedContent] = useState(content)
  const previousContentRef = useRef(content)

  useEffect(() => {
    if (isStreaming && content !== previousContentRef.current) {
      const newText = content.slice(previousContentRef.current.length)
      if (newText) {
        setDisplayedContent((prev) => prev + newText)
      }
      previousContentRef.current = content
    } else if (!isStreaming) {
      setDisplayedContent(content)
    }
  }, [content, isStreaming])

  return (
    <div className={cn('text-sm', className)}>
      <Markdown>{displayedContent || (isStreaming ? '...' : '')}</Markdown>
      {isStreaming && (
        <span className="inline-block h-4 w-0.5 animate-pulse bg-primary ml-0.5" />
      )}
    </div>
  )
}
