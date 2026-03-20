import { useState, useCallback, useRef } from 'react';

const useToast = () => {
  const [toasts, setToasts] = useState([]);
  const timers = useRef({});

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, removing: true } : t));
    timers.current[id] = setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
      delete timers.current[id];
    }, 300);
  }, []);

  const showToast = useCallback((message, type = 'info') => {
    const id = crypto.randomUUID();
    setToasts(prev => [...prev, { id, message, type, removing: false }]);
    timers.current[id] = setTimeout(() => removeToast(id), 3000);
  }, [removeToast]);

  return { toasts, showToast, removeToast };
};

export default useToast;
