import { ReactNode } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import { useSettingsStore } from '../../stores/settingsStore';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { sidebarOpen } = useSettingsStore();

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-slate-900 text-gray-900 dark:text-gray-100">
      {/* Skip to content link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-2 focus:start-2 focus:px-4 focus:py-2 focus:bg-galentix-500 focus:text-white focus:rounded-lg focus:outline-none focus:ring-2 focus:ring-galentix-500 focus:ring-offset-2"
      >
        Skip to main content
      </a>

      {/* Sidebar */}
      <Sidebar />

      {/* Main content */}
      <div className={`flex-1 flex flex-col transition-all duration-300 ${sidebarOpen ? 'md:ms-72' : 'ms-0'}`}>
        <Header />
        <main id="main-content" className="flex-1 overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
