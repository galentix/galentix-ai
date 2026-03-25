import { useEffect, useCallback, useState, useRef, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  MessageSquare,
  FileText,
  Settings,
  Shield,
  Plus,
  Trash2,
  ChevronLeft,
  Search,
  Check,
  X,
  Download
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useChatStore } from '../../stores/chatStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useAuthStore } from '../../stores/authStore';
import { exportConversation } from '../../services/api';
import GalentixLogo from '../ui/GalentixLogo';

export default function Sidebar() {
  const { t } = useTranslation();
  const location = useLocation();
  const { sidebarOpen, toggleSidebar, setSidebarOpen } = useSettingsStore();
  const {
    conversations,
    currentConversation,
    loadConversations,
    selectConversation,
    startNewConversation,
    deleteConversation,
    renameConversation
  } = useChatStore();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [exportMenuId, setExportMenuId] = useState<string | null>(null);
  const confirmDeleteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // Clear auto-cancel timer on unmount
  useEffect(() => {
    return () => {
      if (confirmDeleteTimer.current) {
        clearTimeout(confirmDeleteTimer.current);
      }
    };
  }, []);

  // Close export menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setExportMenuId(null);
      }
    };
    if (exportMenuId) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [exportMenuId]);

  const handleExport = async (convId: string, format: string) => {
    setExportMenuId(null);
    try {
      await exportConversation(convId, format);
    } catch {
      // Export errors are non-critical, silently ignore
    }
  };

  const requestDelete = (convId: string) => {
    // Clear any existing timer
    if (confirmDeleteTimer.current) {
      clearTimeout(confirmDeleteTimer.current);
    }
    setConfirmDeleteId(convId);
    // Auto-cancel after 3 seconds
    confirmDeleteTimer.current = setTimeout(() => {
      setConfirmDeleteId(null);
    }, 3000);
  };

  const confirmDelete = (convId: string) => {
    if (confirmDeleteTimer.current) {
      clearTimeout(confirmDeleteTimer.current);
    }
    setConfirmDeleteId(null);
    deleteConversation(convId);
  };

  const cancelDelete = () => {
    if (confirmDeleteTimer.current) {
      clearTimeout(confirmDeleteTimer.current);
    }
    setConfirmDeleteId(null);
  };

  const { isAuthenticated } = useAuthStore();
  useEffect(() => {
    if (isAuthenticated) loadConversations();
  }, [isAuthenticated, loadConversations]);

  // Auto-collapse sidebar on mobile
  useEffect(() => {
    const mql = window.matchMedia('(max-width: 768px)');
    const handler = (e: MediaQueryListEvent) => {
      if (e.matches) setSidebarOpen(false);
    };
    mql.addEventListener('change', handler);
    if (mql.matches) setSidebarOpen(false);
    return () => mql.removeEventListener('change', handler);
  }, []);

  const isMobile = () => typeof window !== 'undefined' && window.innerWidth < 768;

  const closeSidebarOnMobile = useCallback(() => {
    if (isMobile()) {
      setSidebarOpen(false);
    }
  }, [setSidebarOpen]);

  const handleNavClick = () => {
    closeSidebarOnMobile();
  };

  const handleConversationClick = (convId: string) => {
    if (editingId) return;
    selectConversation(convId);
    closeSidebarOnMobile();
  };

  const startRename = (convId: string, currentTitle: string) => {
    setEditingId(convId);
    setEditTitle(currentTitle);
    // Focus the input on next render
    setTimeout(() => renameInputRef.current?.focus(), 0);
  };

  const confirmRename = async () => {
    if (editingId && editTitle.trim()) {
      await renameConversation(editingId, editTitle.trim());
    }
    setEditingId(null);
    setEditTitle('');
  };

  const cancelRename = () => {
    setEditingId(null);
    setEditTitle('');
  };

  const filteredConversations = useMemo(
    () =>
      searchQuery.trim()
        ? conversations.filter((c) =>
            c.title.toLowerCase().includes(searchQuery.trim().toLowerCase())
          )
        : conversations,
    [conversations, searchQuery]
  );

  const navItems = [
    { path: '/', icon: MessageSquare, label: t('nav.chat') },
    { path: '/documents', icon: FileText, label: t('nav.documents') },
    { path: '/settings', icon: Settings, label: t('nav.settings') },
    { path: '/compliance', icon: Shield, label: t('nav.compliance') },
  ];

  if (!sidebarOpen) {
    return null;
  }

  return (
    <>
      {/* Mobile backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-30 md:hidden"
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
      />

      {/* Sidebar */}
      <aside className="fixed start-0 top-0 h-full w-72 bg-white dark:bg-slate-800 border-e border-gray-200 dark:border-slate-700 flex flex-col z-40 transition-transform duration-300 md:z-20">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <GalentixLogo size="md" />
            <div>
              <span className="font-semibold text-lg">Galentix AI</span>
              <p className="text-xs text-gray-500 dark:text-gray-400">{t('common.localAssistant')}</p>
            </div>
          </div>
          <button
            onClick={toggleSidebar}
            aria-label="Close sidebar"
            className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-galentix-500 focus-visible:ring-offset-2"
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
                onClick={handleNavClick}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-galentix-500 focus-visible:ring-offset-2 ${
                  isActive
                    ? 'bg-galentix-100 dark:bg-galentix-900/30 text-galentix-700 dark:text-galentix-500'
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
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('chat.conversations')}</span>
              <button
                onClick={() => startNewConversation()}
                aria-label={t('chat.newConversation')}
                className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-galentix-500 focus-visible:ring-offset-2"
                title={t('chat.newConversation')}
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* Search - only visible when > 5 conversations */}
            {conversations.length > 5 && (
              <div className="px-3 pb-2">
                <div className="relative">
                  <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t('chat.searchConversations')}
                    className="w-full ps-8 pe-3 py-1.5 text-sm bg-gray-100 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-galentix-500 focus:border-transparent"
                  />
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto px-2 pb-4">
              {conversations.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                  {t('chat.noConversations')}
                </p>
              ) : filteredConversations.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                  {t('chat.noMatchingConversations')}
                </p>
              ) : (
                filteredConversations.map((conv) => (
                  <div
                    key={conv.id}
                    role="button"
                    tabIndex={0}
                    className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors mb-1 focus-visible:ring-2 focus-visible:ring-galentix-500 focus-visible:ring-offset-2 ${
                      currentConversation?.id === conv.id
                        ? 'bg-galentix-100 dark:bg-galentix-900/30'
                        : 'hover:bg-gray-100 dark:hover:bg-slate-700'
                    }`}
                    onClick={() => handleConversationClick(conv.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleConversationClick(conv.id);
                      }
                    }}
                  >
                    <MessageSquare className="w-4 h-4 flex-shrink-0 text-gray-400" />
                    {editingId === conv.id ? (
                      <>
                        <input
                          ref={renameInputRef}
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          onKeyDown={(e) => {
                            e.stopPropagation();
                            if (e.key === 'Enter') {
                              confirmRename();
                            } else if (e.key === 'Escape') {
                              cancelRename();
                            }
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="flex-1 text-sm bg-white dark:bg-slate-700 border border-galentix-500 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-galentix-500 min-w-0"
                          autoFocus
                        />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            confirmRename();
                          }}
                          aria-label="Confirm rename"
                          className="p-1 hover:bg-green-100 dark:hover:bg-green-900/30 rounded transition-all"
                          title={t('common.save')}
                        >
                          <Check className="w-3 h-3 text-green-500" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            cancelRename();
                          }}
                          aria-label="Cancel rename"
                          className="p-1 hover:bg-gray-200 dark:hover:bg-slate-600 rounded transition-all"
                          title={t('common.cancel')}
                        >
                          <X className="w-3 h-3 text-gray-400" />
                        </button>
                      </>
                    ) : (
                      <>
                        <span
                          className="flex-1 text-sm truncate"
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            startRename(conv.id, conv.title);
                          }}
                        >
                          {conv.title}
                        </span>
                        {confirmDeleteId === conv.id ? (
                          <span className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                            <span className="text-xs text-red-500 font-medium">{t('common.delete')}?</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                confirmDelete(conv.id);
                              }}
                              aria-label="Confirm delete"
                              className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-all"
                            >
                              <Check className="w-3 h-3 text-red-500" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                cancelDelete();
                              }}
                              aria-label="Cancel delete"
                              className="p-1 hover:bg-gray-200 dark:hover:bg-slate-600 rounded transition-all"
                            >
                              <X className="w-3 h-3 text-gray-500" />
                            </button>
                          </span>
                        ) : (
                          <span className="flex items-center gap-0.5 flex-shrink-0">
                            {/* Export dropdown */}
                            <div className="relative" ref={exportMenuId === conv.id ? exportMenuRef : undefined}>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExportMenuId(exportMenuId === conv.id ? null : conv.id);
                                }}
                                aria-label="Export conversation"
                                className="p-1 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:bg-galentix-100 dark:hover:bg-galentix-900/30 rounded transition-all focus-visible:ring-2 focus-visible:ring-galentix-500 focus-visible:ring-offset-2"
                                title="Export conversation"
                              >
                                <Download className="w-3 h-3 text-galentix-600 dark:text-galentix-400" />
                              </button>
                              {exportMenuId === conv.id && (
                                <div className="absolute end-0 top-full mt-1 w-40 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg shadow-lg z-50 py-1">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleExport(conv.id, 'text');
                                    }}
                                    className="w-full text-start px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors"
                                  >
                                    Export as Text
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleExport(conv.id, 'markdown');
                                    }}
                                    className="w-full text-start px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors"
                                  >
                                    Export as Markdown
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleExport(conv.id, 'json');
                                    }}
                                    className="w-full text-start px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors"
                                  >
                                    Export as JSON
                                  </button>
                                </div>
                              )}
                            </div>
                            {/* Delete button */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                requestDelete(conv.id);
                              }}
                              aria-label="Delete conversation"
                              className="p-1 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-all focus-visible:ring-2 focus-visible:ring-galentix-500 focus-visible:ring-offset-2"
                              title="Delete conversation"
                            >
                              <Trash2 className="w-3 h-3 text-red-500" />
                            </button>
                          </span>
                        )}
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-slate-700">
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
            {t('system.privacyFooter')}
          </p>
        </div>
      </aside>
    </>
  );
}
