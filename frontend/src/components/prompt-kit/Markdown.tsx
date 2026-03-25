import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '@/lib/utils'
import { CodeBlockCode } from './CodeBlock'

interface MarkdownProps {
  children: string
  className?: string
  components?: Record<string, React.ComponentType<any>>
}

export function Markdown({ children, className, components }: MarkdownProps) {
  const defaultComponents = {
    code({ className, children, ...props }: any) {
      const isInline = !className
      const match = /language-(\w+)/.exec(className || '')
      const language = match ? match[1] : 'text'
      const code = String(children).replace(/\n$/, '')

      if (!isInline && match) {
        return (
          <CodeBlockCode
            code={code}
            language={language}
            className="not-prose"
          />
        )
      }

      return (
        <code
          className={cn(
            'bg-muted px-1.5 py-0.5 rounded text-sm font-mono',
            className
          )}
          {...props}
        >
          {children}
        </code>
      )
    },
    a({ href, children, ...props }: any) {
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
          {...props}
        >
          {children}
        </a>
      )
    }
  }

  return (
    <div className={cn('prose prose-sm dark:prose-invert max-w-none', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{ ...defaultComponents, ...components }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
