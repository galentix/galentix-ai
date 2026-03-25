import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { codeToHtml } from 'shiki'

interface CodeBlockProps {
  code: string
  language?: string
  theme?: string
  className?: string
}

export function CodeBlockCode({ code, language = 'tsx', theme = 'github-light', className }: CodeBlockProps) {
  const [highlightedCode, setHighlightedCode] = useState('')

  useEffect(() => {
    const highlight = async () => {
      try {
        const html = await codeToHtml(code, {
          lang: language,
          theme: theme === 'github-dark' ? 'github-dark' : 'github-light'
        })
        setHighlightedCode(html)
      } catch {
        setHighlightedCode(`<pre><code>${code}</code></pre>`)
      }
    }
    highlight()
  }, [code, language, theme])

  return (
    <code
      className={cn(
        'relative rounded-md bg-muted p-4 py-3 text-sm overflow-x-auto',
        className
      )}
      dangerouslySetInnerHTML={{ __html: highlightedCode || code }}
    />
  )
}

interface CodeBlockGroupProps {
  children: React.ReactNode
  className?: string
}

export function CodeBlockGroup({ children, className }: CodeBlockGroupProps) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {children}
    </div>
  )
}

export function CodeBlock({ children, className, ...props }: React.HTMLProps<HTMLDivElement> & CodeBlockProps) {
  return (
    <div className={cn('code-block my-4 overflow-hidden rounded-lg border border-border', className)} {...props}>
      {children}
    </div>
  )
}
