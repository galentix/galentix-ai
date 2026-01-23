import ReactMarkdown from 'react-markdown';
import { User, Bot, FileText, Globe } from 'lucide-react';
import type { Message as MessageType } from '../../types';

interface MessageProps {
  message: MessageType;
  isStreaming?: boolean;
}

export default function Message({ message, isStreaming }: MessageProps) {
  const isUser = message.role === 'user';
  const hasSources = message.sources && message.sources.length > 0;

  return (
    <div className={`flex gap-4 ${isUser ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
        isUser 
          ? 'bg-galentix-300 text-white' 
          : 'bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-gray-300'
      }`}>
        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </div>

      {/* Content */}
      <div className={`flex-1 max-w-[80%] ${isUser ? 'text-right' : ''}`}>
        <div className={`inline-block rounded-2xl px-4 py-3 ${
          isUser 
            ? 'bg-galentix-300 text-white rounded-tr-none' 
            : 'bg-gray-100 dark:bg-slate-800 rounded-tl-none'
        }`}>
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className={`prose prose-sm dark:prose-invert max-w-none ${isStreaming ? 'cursor-blink' : ''}`}>
              <ReactMarkdown
                components={{
                  // Custom code block styling
                  code({ node, inline, className, children, ...props }) {
                    return inline ? (
                      <code className="bg-gray-200 dark:bg-slate-700 px-1.5 py-0.5 rounded text-sm" {...props}>
                        {children}
                      </code>
                    ) : (
                      <pre className="bg-slate-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
                        <code className={className} {...props}>
                          {children}
                        </code>
                      </pre>
                    );
                  },
                  // Custom link styling
                  a({ href, children }) {
                    return (
                      <a 
                        href={href} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-galentix-400 hover:text-galentix-300 underline"
                      >
                        {children}
                      </a>
                    );
                  }
                }}
              >
                {message.content || (isStreaming ? '...' : '')}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {/* Sources */}
        {hasSources && (
          <div className="mt-2 flex flex-wrap gap-2">
            {message.sources!.map((source, index) => (
              <div
                key={index}
                className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300"
              >
                {source.type === 'document' ? (
                  <>
                    <FileText className="w-3 h-3" />
                    <span>{source.filename}</span>
                  </>
                ) : (
                  <>
                    <Globe className="w-3 h-3" />
                    <span>{source.title || source.url}</span>
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Timestamp */}
        <p className={`text-xs text-gray-400 dark:text-gray-500 mt-1 ${isUser ? 'text-right' : ''}`}>
          {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  );
}
