import { memo, useCallback } from 'react';
import Message from './Message'
import type { Message as MessageType } from '../../types'

interface MessageListProps {
  messages: MessageType[]
  streamingContent?: string
}

function MessageListComponent({ messages, streamingContent }: MessageListProps) {
  return (
    <div className="space-y-4 max-w-3xl mx-auto" role="log" aria-label="Chat messages" aria-live="polite">
      {messages.map((message, index) => (
        <div 
          key={message.id} 
          className="animate-slide-up"
          style={{ animationDelay: `${index * 50}ms` }}
        >
          <Message message={message} />
        </div>
      ))}
      
      {streamingContent !== undefined && (
        <Message
          message={{
            id: 'streaming',
            conversation_id: '',
            role: 'assistant',
            content: streamingContent,
            created_at: new Date().toISOString()
          }}
          isStreaming
        />
      )}
    </div>
  )
}

export default memo(MessageListComponent)