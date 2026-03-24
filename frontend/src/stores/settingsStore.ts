// Galentix AI - Settings Store (Zustand)

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import i18n from '../i18n';

export type Language = 'en' | 'ar';

interface SettingsState {
  // UI Settings
  theme: 'light' | 'dark';
  sidebarOpen: boolean;
  language: Language;

  // Actions
  toggleTheme: () => void;
  setTheme: (theme: 'light' | 'dark') => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setLanguage: (language: Language) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      // Initial state
      theme: 'dark',
      sidebarOpen: typeof window !== 'undefined' ? window.innerWidth >= 768 : true,
      language: 'en',

      // Actions
      toggleTheme: () => set((state) => ({
        theme: state.theme === 'dark' ? 'light' : 'dark'
      })),

      setTheme: (theme) => set({ theme }),

      toggleSidebar: () => set((state) => ({
        sidebarOpen: !state.sidebarOpen
      })),

      setSidebarOpen: (open) => set({ sidebarOpen: open }),

      setLanguage: (language) => {
        i18n.changeLanguage(language);
        // Update document direction for RTL support
        document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
        document.documentElement.lang = language;
        set({ language });
      }
    }),
    {
      name: 'galentix-settings',
      onRehydrateStorage: () => (state) => {
        // Sync i18n language with persisted store value on rehydration
        if (state?.language) {
          i18n.changeLanguage(state.language);
          document.documentElement.dir = state.language === 'ar' ? 'rtl' : 'ltr';
          document.documentElement.lang = state.language;
        }
      }
    }
  )
);
