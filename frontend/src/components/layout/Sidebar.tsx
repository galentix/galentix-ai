import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  MessageSquare, 
  FileText, 
  Settings, 
  Plus, 
  Trash2,
  Archive,
  ChevronLeft
} from 'lucide-react';
import { useChatStore } from '../../stores/chatStore';
import { useSettingsStore } from '../../stores/settingsStore';

export default function Sidebar() {
  const location = useLocation();
  const { sidebarOpen, toggleSidebar } = useSettingsStore();
  const { 
    conversations, 
    currentConversation, 
    loadConversations, 
    selectConversation, 
    createConversation,
    deleteConversation 
  } = useChatStore();

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  const navItems = [
    { path: '/', icon: MessageSquare, label: 'Chat' },
    { path: '/documents', icon: FileText, label: 'Documents' },
    { path: '/settings', icon: Settings, label: 'Settings' },
  ];

  if (!sidebarOpen) {
    return null;
  }

  return (
    <aside className="fixed left-0 top-0 h-full w-72 bg-white dark:bg-slate-800 border-r border-gray-200 dark:border-slate-700 flex flex-col z-20">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-galentix-300 flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2a9 9 0 0 1 9 9c0 3.6-2.4 6.6-5.5 8.1-.3.1-.5.4-.5.7V22h-6v-2.2c0-.3-.2-.6-.5-.7C5.4 17.6 3 14.6 3 11a9 9 0 0 1 9-9z" />
              <circle cx="12" cy="11" r="3" />
            </svg>
          </div>
          <div>
            <h1 className="font-semibold text-lg">Galentix AI</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">Local AI Assistant</p>
          </div>
        </div>
        <button 
          onClick={toggleSidebar}
          className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="p-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                isActive 
                  ? 'bg-galentix-100 dark:bg-galentix-900/30 text-galentix-700 dark:text-galentix-300' 
                  : 'hover:bg-gray-100 dark:hover:bg-slate-700'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Conversations */}
      {location.pathname === '/' && (
        <div className="flex-1 flex flex-col overflow-hidden border-t border-gray-200 dark:border-slate-700 mt-2">
          <div className="p-3 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Conversations</span>
            <button
              onClick={() => createConversation()}
              className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              title="New conversation"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-2 pb-4">
            {conversations.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">
                No conversations yet
              </p>
            ) : (
              conversations.map((conv) => (
                <div
                  key={conv.id}
                  className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors mb-1 ${
                    currentConversation?.id === conv.id
                      ? 'bg-galentix-100 dark:bg-galentix-900/30'
                      : 'hover:bg-gray-100 dark:hover:bg-slate-700'
                  }`}
                  onClick={() => selectConversation(conv.id)}
                >
                  <MessageSquare className="w-4 h-4 flex-shrink-0 text-gray-400" />
                  <span className="flex-1 text-sm truncate">{conv.title}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteConversation(conv.id);
                    }}
                    className="p-1 opacity-0 group-hover:opacity-100 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-all"
                    title="Delete conversation"
                  >
                    <Trash2 className="w-3 h-3 text-red-500" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="p-4 border-t border-gray-200 dark:border-slate-700">
        <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
          100% Local - Your data stays on device
        </p>
      </div>
    </aside>
  );
}
