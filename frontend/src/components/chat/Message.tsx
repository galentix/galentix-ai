import { memo } from 'react';
import { FileText, Globe } from 'lucide-react';
import type { Message as MessageType } from '../../types';

interface MessageProps {
  message: MessageType;
  isStreaming?: boolean;
}

function MessageComponent({ message, isStreaming }: MessageProps) {
  const isUser = message.role === 'user';
  const hasSources = message.sources && message.sources.length > 0;
  const timeStr = new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className={`flex gap-4 animate-slide-up ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className={`flex-1 ${isUser ? 'bg-blue-100 dark:bg-blue-900/30 rounded-lg p-3' : ''}`}>
        {isUser ? (
          <p className="whitespace-pre-wrap text-sm">{message.content}</p>
        ) : (
          <div className="prose dark:prose-invert max-w-none text-sm">
            {message.content || (isStreaming ? '...' : '')}
          </div>
        )}
      </div>

      {hasSources && (
        <div className={`mt-2 flex flex-wrap gap-2 ${isUser ? 'justify-end' : ''}`}>
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

      <p className={`text-xs text-gray-400 dark:text-gray-500 mt-1 ${isUser ? 'text-right' : ''}`}>
        {timeStr}
      </p>
    </div>
  );
}

export default memo(MessageComponent);