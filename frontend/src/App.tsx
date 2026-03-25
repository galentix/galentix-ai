import React, { Suspense, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom';
import { useSettingsStore } from './stores/settingsStore';
import { useAuthStore } from './stores/authStore';
import Layout from './components/layout/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import ChatPage from './pages/ChatPage';
import LoginPage from './pages/LoginPage';
import SetupPage from './pages/SetupPage';
import ToastContainer from './components/ui/Toast';

// Lazy-load secondary pages for code splitting
const DocumentsPage = React.lazy(() => import('./pages/DocumentsPage'));
const SettingsPage = React.lazy(() => import('./pages/SettingsPage'));
const CompliancePage = React.lazy(() => import('./pages/CompliancePage'));
const NotFoundPage = React.lazy(() => import('./pages/NotFoundPage'));

function PageLoader() {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-gray-200 dark:border-slate-700 border-t-galentix-500 rounded-full animate-spin" />
    </div>
  );
}

function LayoutWrapper() {
  return (
    <Layout>
      <Outlet />
    </Layout>
  );
}

function App() {
  const { theme, language } = useSettingsStore();
  const { checkAuth } = useAuthStore();

  // Apply theme to document
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Apply language direction (RTL/LTR) to document
  useEffect(() => {
    const dir = language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.dir = dir;
    document.documentElement.lang = language;
  }, [language]);

  // Check authentication on app mount (guard against StrictMode double-invocation)
  const authCheckedRef = useRef(false);
  useEffect(() => {
    if (authCheckedRef.current) return;
    authCheckedRef.current = true;
    checkAuth();
  }, [checkAuth]);

  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <div className="min-h-screen">
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/setup" element={<SetupPage />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<LayoutWrapper />}>
              <Route path="/" element={<ChatPage />} />
              <Route path="/documents" element={
                <Suspense fallback={<PageLoader />}>
                  <DocumentsPage />
                </Suspense>
              } />
              <Route path="/settings" element={
                <Suspense fallback={<PageLoader />}>
                  <SettingsPage />
                </Suspense>
              } />
              <Route path="/compliance" element={
                <Suspense fallback={<PageLoader />}>
                  <CompliancePage />
                </Suspense>
              } />
              <Route path="*" element={
                <Suspense fallback={<PageLoader />}>
                  <NotFoundPage />
                </Suspense>
              } />
            </Route>
          </Route>
        </Routes>
        <ToastContainer />
      </div>
    </BrowserRouter>
  );
}

export default App;
