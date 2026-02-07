import React, { useState, useEffect, useRef } from 'react';
import { supabase, authHelpers, dbHelpers } from './supabaseClient';

// ═══════════════════════════════════════════════════════════════════════
// CONFIGURACIÓN
// ═══════════════════════════════════════════════════════════════════════
const DEBUG = false; // Cambiar a true para ver console.logs
const MVP_MODE = false; // false = Usar Supabase auth real

// ═══════════════════════════════════════════════════════════════════════
// SISTEMA DE TOAST NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════════
const ToastContainer = ({ toasts, removeToast }) => (
  <div className="fixed top-4 right-4 z-[100] space-y-2 pointer-events-none">
    {toasts.map(toast => (
      <div
        key={toast.id}
        className={`pointer-events-auto transform transition-all duration-300 ease-out ${
          toast.removing ? 'translate-x-96 opacity-0' : 'translate-x-0 opacity-100'
        }`}
      >
        <div className={`rounded-xl shadow-2xl px-4 py-3 flex items-center gap-3 min-w-[280px] max-w-md backdrop-blur-xl border ${
          toast.type === 'success' ? 'bg-green-500/95 text-white border-green-400' :
          toast.type === 'error' ? 'bg-red-500/95 text-white border-red-400' :
          toast.type === 'warning' ? 'bg-yellow-500/95 text-white border-yellow-400' :
          'bg-blue-500/95 text-white border-blue-400'
        }`}>
          <span className="text-xl flex-shrink-0">
            {toast.type === 'success' ? '✅' :
             toast.type === 'error' ? '❌' :
             toast.type === 'warning' ? '⚠️' : 'ℹ️'}
          </span>
          <p className="flex-1 font-medium text-sm">{toast.message}</p>
          <button
            onClick={() => removeToast(toast.id)}
            className="text-white/80 hover:text-white transition-colors flex-shrink-0"
            aria-label="Cerrar"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    ))}
  </div>
);

// Hook para manejar toasts
const useToast = () => {
  const [toasts, setToasts] = useState([]);

  const showToast = (message, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type, removing: false }]);
    
    setTimeout(() => {
      setToasts(prev => prev.map(t => t.id === id ? { ...t, removing: true } : t));
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, 300);
    }, 3000);
  };

  const removeToast = (id) => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, removing: true } : t));
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 300);
  };

  return { toasts, showToast, removeToast };
};
