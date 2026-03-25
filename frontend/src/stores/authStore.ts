// Galentix AI - Auth Store (Zustand)

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const API_BASE = '/api';
const REFRESH_INTERVAL_MS = 25 * 60 * 1000; // 25 minutes
let refreshTimer: ReturnType<typeof setInterval> | null = null;

function startRefreshTimer() {
  stopRefreshTimer();
  refreshTimer = setInterval(async () => {
    try {
      await useAuthStore.getState().refreshToken();
    } catch {
      // Refresh failed — user will be redirected on next API call via 401 interceptor
    }
  }, REFRESH_INTERVAL_MS);
}

function stopRefreshTimer() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
}

interface AuthUser {
  id: string;
  username: string;
  email: string | null;
  role: string;
}

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  refreshToken: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      // Initial state
      user: null,
      isAuthenticated: false,
      isLoading: true,
      error: null,

      // Actions
      login: async (username: string, password: string) => {
        set({ isLoading: true, error: null });
        try {
          const response = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ username, password }),
          });

          if (!response.ok) {
            const data = await response.json().catch(() => ({ detail: 'Login failed' }));
            throw new Error(data.detail || 'Invalid credentials');
          }

          const data = await response.json();
          set({
            user: data.user,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
          startRefreshTimer();
        } catch (err) {
          let errorMessage = (err as Error).message;
          if (err instanceof TypeError && err.message.includes('fetch')) {
            errorMessage = 'Server unreachable. Please check that Galentix AI is running.';
          }
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: errorMessage,
          });
          throw err;
        }
      },

      logout: async () => {
        try {
          await fetch(`${API_BASE}/auth/logout`, {
            method: 'POST',
            credentials: 'include',
          });
        } catch {
          // Proceed with local logout even if request fails
        }
        stopRefreshTimer();
        set({
          user: null,
          isAuthenticated: false,
          isLoading: false,
          error: null,
        });
      },

      checkAuth: async () => {
        set({ isLoading: true });
        try {
          const response = await fetch(`${API_BASE}/auth/me`, {
            credentials: 'include',
          });

          if (!response.ok) {
            set({ user: null, isAuthenticated: false, isLoading: false });
            return;
          }

          const data = await response.json();
          set({
            user: data,
            isAuthenticated: true,
            isLoading: false,
          });
          startRefreshTimer();
        } catch {
          set({ user: null, isAuthenticated: false, isLoading: false });
        }
      },

      refreshToken: async () => {
        try {
          const response = await fetch(`${API_BASE}/auth/refresh`, {
            method: 'POST',
            credentials: 'include',
          });

          if (!response.ok) {
            set({ user: null, isAuthenticated: false });
            throw new Error('Token refresh failed');
          }
        } catch (err) {
          set({ user: null, isAuthenticated: false });
          throw err;
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'galentix-auth',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
