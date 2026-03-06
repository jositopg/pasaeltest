import React from 'react';

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
  if (!show) return null;

  return (
    <div
      className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <div
        className={`bg-slate-800 border-2 rounded-2xl max-w-md w-full p-6 ${danger ? 'border-red-500/50' : 'border-white/20'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-white font-bold text-xl mb-3">{title}</h3>
        {message && <p className="text-gray-300 mb-2">{message}</p>}
        {detail && <p className="text-blue-400 font-semibold mb-2">{detail}</p>}
        <p className="text-red-400 text-sm mb-6">Esta acción NO se puede deshacer.</p>
        <div className="flex gap-3">
          <button
            onClick={onConfirm}
            className={`flex-1 font-bold py-3 rounded-xl transition-colors text-white ${danger ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-500 hover:bg-blue-600'}`}
          >
            {confirmLabel}
          </button>
          <button
            onClick={onCancel}
            className="flex-1 bg-white/10 hover:bg-white/20 text-white font-semibold py-3 rounded-xl transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
