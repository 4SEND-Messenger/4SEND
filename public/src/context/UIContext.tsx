import { createContext, useContext, useState, useCallback } from 'react';
import type { ReactNode } from 'react';

type ToastType = 'info' | 'success' | 'error';

interface Toast {
  id: string;
  text: string;
  isError: boolean;
  type: ToastType;
}

interface ModalState {
  isOpen: boolean;
  content: ReactNode;
  onClose?: () => void;
}

interface UIContextType {
  toasts: Toast[];
  showToast: (text: string, type?: ToastType | boolean) => void;
  hideToast: (id: string) => void;
  modal: ModalState | null;
  openModal: (content: ReactNode, onClose?: () => void) => void;
  closeModal: () => void;
  isLoading: boolean;
  setLoading: (loading: boolean) => void;
}

const UIContext = createContext<UIContextType | null>(null);

const MAX_VISIBLE_TOASTS = 3;

export const UIProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [modal, setModal] = useState<ModalState | null>(null);
  const [isLoading, setLoading] = useState(false);

  const showToast = useCallback((text: string, typeOrError?: ToastType | boolean) => {
    let type: ToastType = 'info';
    if (typeof typeOrError === 'boolean') {
      type = typeOrError ? 'error' : 'success';
    } else if (typeOrError) {
      type = typeOrError;
    }
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => {
      if (prev.some(t => t.text === text && t.type === type)) return prev;
      const next = [...prev, { id, text, isError: type === 'error', type }];
      return next.length > MAX_VISIBLE_TOASTS ? next.slice(next.length - MAX_VISIBLE_TOASTS) : next;
    });
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  }, []);

  const hideToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const openModal = useCallback((content: ReactNode, onClose?: () => void) => {
    setModal({ isOpen: true, content, onClose });
  }, []);

  const closeModal = useCallback(() => {
    setModal(prev => prev ? { ...prev, isOpen: false } : null);
    setTimeout(() => setModal(null), 300);
  }, []);

  return (
    <UIContext.Provider value={{ toasts, showToast, hideToast, modal, openModal, closeModal, isLoading, setLoading }}>
      {children}
    </UIContext.Provider>
  );
};

export const useUI = (): UIContextType => {
  const context = useContext(UIContext);
  if (!context) throw new Error('useUI must be used within UIProvider');
  return context;
};