import Message from './Message';
import type { Message as MessageType } from '../../types';

interface MessageListProps {
  messages: MessageType[];
  streamingContent?: string;
}

export default function MessageList({ messages, streamingContent }: MessageListProps) {
  return (
    <div className="space-y-4 max-w-3xl mx-auto" role="log" aria-live="polite" aria-label="Chat messages">
      {messages.map((message) => (
        <Message key={message.id} message={message} />
      ))}
      
      {/* Streaming message */}
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
  );
}
