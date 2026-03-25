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
      <Sidebar />
      <div 
        className={`flex-1 flex flex-col transition-all duration-300 ease-out ${
          sidebarOpen ? 'ml-0 lg:ml-72' : 'ml-0'
        }`}
      >
        <Header />
        <main className="flex-1 overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
