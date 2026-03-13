import React from 'react';
import { useTheme } from '../../context/ThemeContext';

/**
 * Dialog de confirmación reutilizable.
 * Props: show, title, message, detail, onConfirm, onCancel, confirmLabel, danger
 */
export default function ConfirmDialog({
  show,
  title = '⚠️ Confirmar',
  message,
  detail,
  onConfirm,
  onCancel,
  confirmLabel = 'Confirmar',
  danger = true,
}) {
  const { dm } = useTheme();
  if (!show) return null;

  return (
    <div
      className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <div
        className={`rounded-2xl max-w-md w-full p-6 shadow-2xl border-2 ${
          danger ? 'border-red-500/50' : dm ? 'border-white/20' : 'border-slate-200'
        } ${dm ? 'bg-[#0F172A]' : 'bg-white'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className={`font-bold text-xl mb-3 ${dm ? 'text-white' : 'text-slate-800'}`}>{title}</h3>
        {message && <p className={`mb-2 text-sm ${dm ? 'text-gray-300' : 'text-slate-600'}`}>{message}</p>}
        {detail && <p className={`font-semibold mb-2 text-sm ${dm ? 'text-blue-400' : 'text-blue-600'}`}>{detail}</p>}
        <p className={`text-sm mb-6 ${dm ? 'text-red-400' : 'text-red-500'}`}>Esta acción NO se puede deshacer.</p>
        <div className="flex gap-3">
          <button
            onClick={onConfirm}
            className={`flex-1 font-bold py-3 rounded-xl transition-colors text-white text-sm ${danger ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-500 hover:bg-blue-600'}`}
          >
            {confirmLabel}
          </button>
          <button
            onClick={onCancel}
            className={`flex-1 font-semibold py-3 rounded-xl transition-colors text-sm ${dm ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
