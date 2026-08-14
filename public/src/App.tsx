import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthContext } from './context/AuthContext';
import { useEffect, useRef, lazy, Suspense } from 'react';
import AuthPage from './pages/AuthPage';
import ShareTarget from './pages/ShareTarget';
import Toast from './components/Toast';
import LoadingScreen from './components/LoadingScreen';
import { useUI } from './context/UIContext';
import { loadTranslations } from './hooks/useI18n';
import { useSettings } from './context/SettingsContext';
import { useEncryption } from './context/EncryptionContext';
import EncryptionUnlockScreen from './components/settings/EncryptionUnlockScreen';

const MessengerPage = lazy(() => import('./pages/MessengerPage'));

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const auth = useAuthContext();
  const { isEncrypted, isUnlocked } = useEncryption();
  const hasStoredSession = !!localStorage.getItem('4send_user') && !!localStorage.getItem('4send_token');
  if (isEncrypted && !isUnlocked && hasStoredSession) {
    return <>{children}</>;
  }
  return auth.isAuthenticated ? <>{children}</> : <Navigate to={'/auth' + window.location.search} replace />;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const auth = useAuthContext();
  const { isEncrypted, isUnlocked } = useEncryption();
  const hasStoredSession = !!localStorage.getItem('4send_user') && !!localStorage.getItem('4send_token');
  if (isEncrypted && !isUnlocked && hasStoredSession) {
    return <Navigate to="/" replace />;
  }
  return auth.isAuthenticated ? <Navigate to="/" replace /> : <>{children}</>;
}

export default function App() {
  const auth = useAuthContext();
  const { lockApp, pin } = useSettings();
  const { isEncrypted, isUnlocked } = useEncryption();
  const hasLoadedRef = useRef(false);
  useUI();

  useEffect(() => {
    loadTranslations().catch(() => {});
  }, []);

  useEffect(() => {
    if (!isUnlocked) return;
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    auth.loadAuth();
  }, [isUnlocked, auth.loadAuth]);

  useEffect(() => {
    const handler = (e: MouseEvent) => e.preventDefault();
    document.addEventListener('contextmenu', handler);
    return () => document.removeEventListener('contextmenu', handler);
  }, []);

  useEffect(() => {
    if (!pin) return;
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        lockApp();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [pin, lockApp]);

  return (
    <>
      <Toast />
      {isEncrypted && !isUnlocked && <EncryptionUnlockScreen />}
      {auth.isAuthenticated && <LoadingScreen />}
      <Suspense fallback={null}>
        <Routes>
        <Route path="/auth" element={<PublicRoute><AuthPage /></PublicRoute>} />
        <Route path="/share" element={<ShareTarget />} />
        <Route path="/" element={<PrivateRoute><MessengerPage /></PrivateRoute>} />
        <Route path="/terms" element={<Navigate to="/terms.html" replace />} />
        <Route path="/privacy" element={<Navigate to="/privacy.html" replace />} />
        <Route path="/changelog" element={<Navigate to="/changelog.html" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </>
  );
}