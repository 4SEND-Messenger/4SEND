import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import { AuthProvider } from './context/AuthContext';
import { UIProvider } from './context/UIContext';
import { ChatProvider } from './context/ChatContext';
import { ChatMessagesProvider } from './context/ChatMessagesContext';
import { SettingsProvider } from './context/SettingsContext';
import { EncryptionProvider } from './context/EncryptionContext';
import './styles/index.css';

const apiUrl = import.meta.env.VITE_API_URL;
if (apiUrl) {
  const link = document.createElement('link');
  link.rel = 'preconnect';
  link.href = apiUrl;
  document.head.appendChild(link);
}

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <BrowserRouter>
      <AuthProvider>
        <UIProvider>
          <ChatProvider>
            <ChatMessagesProvider>
              <SettingsProvider>
                <EncryptionProvider>
                  <App />
                </EncryptionProvider>
              </SettingsProvider>
            </ChatMessagesProvider>
          </ChatProvider>
        </UIProvider>
      </AuthProvider>
    </BrowserRouter>
  </ErrorBoundary>
);