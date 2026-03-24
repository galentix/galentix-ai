import { useState, useEffect, useRef } from 'react';
import {
  Menu, Sun, Moon, Cpu, HardDrive, Wifi, WifiOff,
  HelpCircle, FileText, Search, Shield, RotateCcw, Download,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '../../stores/settingsStore';
import { useChatStore } from '../../stores/chatStore';
import * as api from '../../services/api';
import { exportConversation } from '../../services/api';
import type { HealthStatus } from '../../types';
import LanguageSelector from '../ui/LanguageSelector';

export default function Header() {
  const { t } = useTranslation();
  const { theme, toggleTheme, sidebarOpen, toggleSidebar } = useSettingsStore();
  const startNewConversation = useChatStore((s) => s.startNewConversation);
  const currentConversation = useChatStore((s) => s.currentConversation);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const helpRef = useRef<HTMLDivElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);

  // Close the help popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (helpRef.current && !helpRef.current.contains(e.target as Node)) {
        setHelpOpen(false);
      }
    };
    if (helpOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [helpOpen]);

  // Close the export popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setExportOpen(false);
      }
    };
    if (exportOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [exportOpen]);

  const handleExport = async (format: string) => {
    if (!currentConversation) return;
    setExportOpen(false);
    try {
      await exportConversation(currentConversation.id, format);
    } catch {
      // Export errors are non-critical
    }
  };

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const data = await api.getHealth();
        setHealth(data);
      } catch {
        setHealth(null);
      }
    };

    fetchHealth();
    const interval = setInterval(fetchHealth, 30000); // Every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
      case 'available':
      case 'healthy':
        return 'text-green-500';
      case 'offline':
      case 'unavailable':
      case 'degraded':
        return 'text-yellow-500';
      default:
        return 'text-gray-400';
    }
  };

  return (
    <header className="h-14 border-b border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-between px-4">
      {/* Left side */}
      <div className="flex items-center gap-4">
        {!sidebarOpen && (
          <button
            onClick={toggleSidebar}
            aria-label="Toggle sidebar"
            className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        {/* Status indicators */}
        {health && (
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2" title={`LLM: ${health.llm_status}`}>
              <Cpu className={`w-4 h-4 ${getStatusColor(health.llm_status)}`} />
              <span className="text-gray-600 dark:text-gray-300">{health.llm_model}</span>
            </div>

            <div className="flex items-center gap-2" title={`RAG: ${health.rag_status}`}>
              <HardDrive className={`w-4 h-4 ${getStatusColor(health.rag_status)}`} />
              <span className="text-gray-500 dark:text-gray-400 text-xs">RAG</span>
            </div>

            <div className="flex items-center gap-2" title={`Search: ${health.search_status}`}>
              {health.search_status === 'online' ? (
                <Wifi className="w-4 h-4 text-green-500" />
              ) : (
                <WifiOff className="w-4 h-4 text-gray-400" />
              )}
              <span className="text-gray-500 dark:text-gray-400 text-xs">Search</span>
            </div>
          </div>
        )}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2">
        {/* Export current conversation */}
        {currentConversation && (
          <div className="relative" ref={exportRef}>
            <button
              onClick={() => setExportOpen((v) => !v)}
              aria-label="Export conversation"
              className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              title="Export conversation"
            >
              <Download className="w-5 h-5" />
            </button>

            {exportOpen && (
              <div className="absolute end-0 top-full mt-2 w-44 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg shadow-lg z-50 py-1">
                <button
                  onClick={() => handleExport('text')}
                  className="w-full text-start px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                >
                  Export as Text
                </button>
                <button
                  onClick={() => handleExport('markdown')}
                  className="w-full text-start px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                >
                  Export as Markdown
                </button>
                <button
                  onClick={() => handleExport('json')}
                  className="w-full text-start px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                >
                  Export as JSON
                </button>
              </div>
            )}
          </div>
        )}

        {/* Help / info button */}
        <div className="relative" ref={helpRef}>
          <button
            onClick={() => setHelpOpen((v) => !v)}
            aria-label="Help and tips"
            className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            title="Help & tips"
          >
            <HelpCircle className="w-5 h-5" />
          </button>

          {helpOpen && (
            <div className="absolute end-0 top-full mt-2 w-72 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl shadow-lg z-50 p-4 space-y-3">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">{t('help.tipsTitle')}</h3>

              <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                <li className="flex items-start gap-2">
                  <FileText className="w-4 h-4 mt-0.5 flex-shrink-0 text-galentix-500" />
                  <span>{t('help.tipDocuments')}</span>
                </li>
                <li className="flex items-start gap-2">
                  <Search className="w-4 h-4 mt-0.5 flex-shrink-0 text-galentix-500" />
                  <span>{t('help.tipWebSearch')}</span>
                </li>
                <li className="flex items-start gap-2">
                  <Shield className="w-4 h-4 mt-0.5 flex-shrink-0 text-galentix-500" />
                  <span>{t('system.privacyNote')}</span>
                </li>
              </ul>

              <hr className="border-gray-200 dark:border-slate-600" />

              <button
                onClick={() => {
                  startNewConversation();
                  setHelpOpen(false);
                }}
                className="flex items-center gap-2 text-sm text-galentix-600 dark:text-galentix-400 hover:underline"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                {t('help.showWelcome')}
              </button>
            </div>
          )}
        </div>

        {/* Language selector */}
        <LanguageSelector />

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          aria-label="Toggle dark mode"
          className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? (
            <Sun className="w-5 h-5" />
          ) : (
            <Moon className="w-5 h-5" />
          )}
        </button>

        {/* Version badge */}
        {health && (
          <span className="text-xs text-gray-400 dark:text-gray-500 px-2 py-1 bg-gray-100 dark:bg-slate-700 rounded">
            v{health.version}
          </span>
        )}
      </div>
    </header>
  );
}
