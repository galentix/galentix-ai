import { useState, useEffect } from 'react';
import { Menu, Sun, Moon, Cpu, HardDrive, Wifi, WifiOff } from 'lucide-react';
import { useSettingsStore } from '../../stores/settingsStore';
import * as api from '../../services/api';
import type { HealthStatus } from '../../types';

export default function Header() {
  const { theme, toggleTheme, sidebarOpen, toggleSidebar } = useSettingsStore();
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

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
    const interval = setInterval(fetchHealth, 30000);
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

  const getStatusDot = (status: string) => {
    switch (status) {
      case 'online':
      case 'available':
      case 'healthy':
        return 'bg-green-500';
      case 'offline':
      case 'unavailable':
      case 'degraded':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-400';
    }
  };

  return (
    <header 
      className="h-14 border-b border-gray-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 backdrop-blur-lg flex items-center justify-between px-4 sticky top-0 z-10"
      role="banner"
    >
      <div className="flex items-center gap-4">
        {(!sidebarOpen || isMobile) && (
          <button
            onClick={toggleSidebar}
            className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors focus:ring-2 focus:ring-galentix-300 focus:ring-offset-2 dark:focus:ring-offset-slate-800"
            aria-label={sidebarOpen ? 'Close menu' : 'Open menu'}
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        {health && !isMobile && (
          <div className="flex items-center gap-4 text-sm" role="status" aria-live="polite">
            <div className="flex items-center gap-2" title={`LLM: ${health.llm_status}`}>
              <Cpu className={`w-4 h-4 ${getStatusColor(health.llm_status)}`} />
              <span className="text-gray-600 dark:text-gray-300 hidden sm:inline">{health.llm_model}</span>
              <span className={`w-1.5 h-1.5 rounded-full ${getStatusDot(health.llm_status)} animate-pulse`} />
            </div>

            <div className="hidden md:flex items-center gap-2" title={`RAG: ${health.rag_status}`}>
              <HardDrive className={`w-4 h-4 ${getStatusColor(health.rag_status)}`} />
              <span className="text-gray-500 dark:text-gray-400 text-xs">RAG</span>
            </div>

            <div className="hidden md:flex items-center gap-2" title={`Search: ${health.search_status}`}>
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

      <div className="flex items-center gap-2">
        <button
          onClick={toggleTheme}
          className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-all duration-200 focus:ring-2 focus:ring-galentix-300 focus:ring-offset-2 dark:focus:ring-offset-slate-800"
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? (
            <Sun className="w-5 h-5 transition-transform hover:rotate-12" />
          ) : (
            <Moon className="w-5 h-5 transition-transform hover:-rotate-12" />
          )}
        </button>

        {health && (
          <span 
            className="text-xs text-gray-400 dark:text-gray-500 px-2 py-1 bg-gray-100 dark:bg-slate-700 rounded hidden sm:inline-block"
            aria-label={`Version ${health.version}`}
          >
            v{health.version}
          </span>
        )}
      </div>
    </header>
  );
}
