import React from 'react';
import Icons from './Icons';
import { useTheme } from '../../context/ThemeContext';

/**
 * Wrapper estándar para modales. Elimina el boilerplate repetido.
 * Props: show, onClose, title, children, maxWidth (default 'max-w-3xl')
 */
export default function Modal({ show, onClose, title, subtitle, children, maxWidth = 'max-w-3xl' }) {
  const { darkMode: dm } = useTheme();

  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className={`border rounded-3xl w-full ${maxWidth} max-h-[85vh] overflow-y-auto ${
        dm ? 'bg-slate-800 border-white/10' : 'bg-white border-slate-200'
      }`}>
        <div className={`sticky top-0 p-6 border-b flex items-center justify-between ${
          dm ? 'bg-slate-800 border-white/10' : 'bg-white border-slate-200'
        }`}>
          <div>
            <h2 className={`font-bold text-xl ${dm ? 'text-white' : 'text-slate-800'}`}>{title}</h2>
            {subtitle && <p className={`text-sm mt-1 ${dm ? 'text-gray-400' : 'text-slate-500'}`}>{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-xl ${dm ? 'bg-white/5 hover:bg-white/10 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'}`}
          >
            <Icons.X />
          </button>
        </div>
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
}
