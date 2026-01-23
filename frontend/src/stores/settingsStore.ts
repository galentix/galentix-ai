// Galentix AI - Settings Store (Zustand)

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
  // UI Settings
  theme: 'light' | 'dark';
  sidebarOpen: boolean;
  
  // Actions
  toggleTheme: () => void;
  setTheme: (theme: 'light' | 'dark') => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      // Initial state
      theme: 'dark',
      sidebarOpen: true,
      
      // Actions
      toggleTheme: () => set((state) => ({ 
        theme: state.theme === 'dark' ? 'light' : 'dark' 
      })),
      
      setTheme: (theme) => set({ theme }),
      
      toggleSidebar: () => set((state) => ({ 
        sidebarOpen: !state.sidebarOpen 
      })),
      
      setSidebarOpen: (open) => set({ sidebarOpen: open })
    }),
    {
      name: 'galentix-settings'
    }
  )
);
