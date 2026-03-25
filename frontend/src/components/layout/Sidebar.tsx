import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  MessageSquare, 
  FileText, 
  Settings, 
  Plus, 
  Trash2,
  ChevronLeft,
  X
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
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      toggleSidebar();
      setIsClosing(false);
    }, 200);
  };

  const navItems = [
    { path: '/', icon: MessageSquare, label: 'Chat' },
    { path: '/documents', icon: FileText, label: 'Documents' },
    { path: '/settings', icon: Settings, label: 'Settings' },
  ];

  if (!sidebarOpen) {
    return null;
  }

  return (
    <>
      {/* Overlay for mobile */}
      <div 
        className="fixed inset-0 bg-black/50 z-30 lg:hidden animate-fade-in"
        onClick={handleClose}
        aria-hidden="true"
      />
      
      <aside 
        className={`fixed left-0 top-0 h-full w-72 bg-white dark:bg-slate-800 border-r border-gray-200 dark:border-slate-700 flex flex-col z-40 transition-transform duration-300 ease-out ${
          isClosing ? '-translate-x-full' : 'translate-x-0'
        }`}
        role="navigation"
        aria-label="Main navigation"
      >
        <div className="p-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-galentix-300 to-galentix-500 flex items-center justify-center shadow-lg shadow-galentix-300/30 animate-pulse-glow">
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
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors lg:hidden"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" />
          </button>
          <button 
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors hidden lg:flex"
            aria-label="Collapse sidebar"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        </div>

        <nav className="p-2 space-y-1" role="menubar">
          {navItems.map((item, index) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                role="menuitem"
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                  isActive 
                    ? 'bg-galentix-100 dark:bg-galentix-900/30 text-galentix-700 dark:text-galentix-300 shadow-sm' 
                    : 'hover:bg-gray-100 dark:hover:bg-slate-700 hover:translate-x-1'
                }`}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
                {isActive && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-galentix-300 animate-pulse" />
                )}
              </Link>
            );
          })}
        </nav>

        {location.pathname === '/' && (
          <div className="flex-1 flex flex-col overflow-hidden border-t border-gray-200 dark:border-slate-700 mt-2">
            <div className="p-3 flex items-center justify-between">
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Conversations</span>
              <button
                onClick={() => createConversation()}
                className="p-2 hover:bg-galentix-100 dark:hover:bg-galentix-900/30 hover:text-galentix-600 dark:hover:text-galentix-300 rounded-lg transition-all group"
                title="New conversation"
                aria-label="Start new conversation"
              >
                <Plus className="w-4 h-4 group-hover:scale-110 transition-transform" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-1">
              {conversations.length === 0 ? (
                <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">
                  No conversations yet
                </p>
              ) : (
                conversations.map((conv, index) => (
                  <div
                    key={conv.id}
                    role="menuitem"
                    tabIndex={0}
                    className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all duration-200 mb-1 ${
                      currentConversation?.id === conv.id
                        ? 'bg-galentix-100 dark:bg-galentix-900/30'
                        : 'hover:bg-gray-100 dark:hover:bg-slate-700'
                    }`}
                    onClick={() => selectConversation(conv.id)}
                    onKeyDown={(e) => e.key === 'Enter' && selectConversation(conv.id)}
                    style={{ animationDelay: `${index * 30}ms` }}
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
                      aria-label={`Delete conversation ${conv.title}`}
                    >
                      <Trash2 className="w-3 h-3 text-red-500" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        <div className="p-4 border-t border-gray-200 dark:border-slate-700">
          <div className="flex items-center justify-center gap-2 text-xs text-gray-400 dark:text-gray-500">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            100% Local - Your data stays on device
          </div>
        </div>
      </aside>
    </>
  );
}
