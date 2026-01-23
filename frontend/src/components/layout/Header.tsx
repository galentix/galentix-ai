import { useState, useEffect } from 'react';
import { Menu, Sun, Moon, Cpu, HardDrive, Wifi, WifiOff } from 'lucide-react';
import { useSettingsStore } from '../../stores/settingsStore';
import * as api from '../../services/api';
import type { HealthStatus } from '../../types';

export default function Header() {
  const { theme, toggleTheme, sidebarOpen, toggleSidebar } = useSettingsStore();
  const [health, setHealth] = useState<HealthStatus | null>(null);

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
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
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
