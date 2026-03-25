import { useEffect } from 'react';
import ChatContainer from '../components/chat/ChatContainer';

export default function ChatPage() {
  useEffect(() => { document.title = "Chat - Galentix AI"; }, []);
  return (
    <div className="h-full bg-white dark:bg-slate-900">
      <ChatContainer />
    </div>
  );
}
