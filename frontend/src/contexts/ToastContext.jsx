import { createContext, useContext, useState } from 'react';

const ToastContext = createContext();

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const addToast = (message, type = 'info') => {
    const id = Date.now();
    const autoHideDuration = type === 'error' ? null : 4000;
    setToasts(prev => [...prev, { id, message, type, autoHideDuration }]);

    if (autoHideDuration !== null) {
      setTimeout(() => {
        setToasts(prev => prev.filter(toast => toast.id !== id));
      }, autoHideDuration);
    }
  };

  const removeToast = (id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  const success = (message) => addToast(message, 'success');
  const error = (message) => addToast(message, 'error');
  const info = (message) => addToast(message, 'info');

  return (
    <ToastContext.Provider value={{ success, error, info, toasts, removeToast }}>
      {children}
    </ToastContext.Provider>
  );
};
