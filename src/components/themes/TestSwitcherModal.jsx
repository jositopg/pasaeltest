import React, { useState } from 'react';
import Icons from '../common/Icons';
import { useTheme } from '../../context/ThemeContext';

/**
 * Modal de gestión de tests (cambiar, renombrar, crear, eliminar).
 * Props: show, tests, activeTestId, onClose, onSwitch, onCreate, onRename, onDelete
 */
export default function TestSwitcherModal({ show, tests, activeTestId, onClose, onSwitch, onCreate, onRename, onDelete }) {
  const { darkMode: dm } = useTheme();
  const [renamingTestId, setRenamingTestId] = useState(null);
  const [renamingTestName, setRenamingTestName] = useState('');
  const [showNewTestInput, setShowNewTestInput] = useState(false);
  const [newTestName, setNewTestName] = useState('');
  const [deletingTestId, setDeletingTestId] = useState(null);

  if (!show) return null;

  const handleClose = () => {
    setShowNewTestInput(false);
    setRenamingTestId(null);
    setDeletingTestId(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-800 border border-white/10 rounded-2xl w-full max-w-sm max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between shrink-0">
          <h3 className="text-white font-bold">Mis Tests</h3>
          <button
            onClick={handleClose}
            className="bg-white/5 hover:bg-white/10 p-2 rounded-xl transition-colors text-white"
          >
            <Icons.X />
          </button>
        </div>

        {/* Lista de tests */}
        <div className="overflow-y-auto flex-1 p-4 space-y-2">
          {tests.map(t => (
            <div
              key={t.id}
              className={`rounded-xl px-3 py-2.5 ${t.id === activeTestId ? 'bg-blue-500/20 border border-blue-500/40' : 'bg-white/5 border border-white/10'}`}
            >
              {renamingTestId === t.id ? (
                <input
                  autoFocus
                  value={renamingTestName}
                  onChange={(e) => setRenamingTestName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && renamingTestName.trim()) {
                      onRename(t.id, renamingTestName.trim());
                      setRenamingTestId(null);
                    }
                    if (e.key === 'Escape') setRenamingTestId(null);
                  }}
                  onBlur={() => {
                    if (renamingTestName.trim()) onRename(t.id, renamingTestName.trim());
                    setRenamingTestId(null);
                  }}
                  className="w-full bg-white/10 text-white text-sm rounded-lg px-2 py-1 border border-blue-500/50 outline-none"
                />
              ) : deletingTestId === t.id ? (
                <div className="space-y-2">
                  <p className="text-white text-xs">¿Eliminar este test? Se borrarán todos sus temas y preguntas.</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { onDelete(t.id); setDeletingTestId(null); handleClose(); }}
                      className="flex-1 bg-red-500 text-white text-xs font-semibold py-1.5 rounded-lg"
                    >
                      Eliminar
                    </button>
                    <button
                      onClick={() => setDeletingTestId(null)}
                      className="flex-1 bg-white/10 text-white text-xs py-1.5 rounded-lg"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { onSwitch(t.id); handleClose(); }}
                    className="flex-1 text-left"
                  >
                    <span className={`text-sm font-medium ${t.id === activeTestId ? 'text-blue-300' : 'text-white'}`}>
                      {t.id === activeTestId && <span className="mr-1.5">✓</span>}
                      {t.name}
                    </span>
                  </button>
                  <button
                    onClick={() => { setRenamingTestId(t.id); setRenamingTestName(t.name); }}
                    className="p-1 text-gray-500 hover:text-blue-400 transition-colors text-sm"
                    title="Renombrar"
                  >
                    ✏
                  </button>
                  <button
                    onClick={() => setDeletingTestId(t.id)}
                    disabled={tests.length <= 1}
                    className="p-1 text-gray-500 hover:text-red-400 transition-colors text-sm disabled:opacity-30"
                    title="Eliminar"
                  >
                    🗑
                  </button>
                </div>
              )}
            </div>
          ))}

          {/* Crear nuevo test */}
          {showNewTestInput ? (
            <div className="flex gap-2 mt-2">
              <input
                autoFocus
                value={newTestName}
                onChange={(e) => setNewTestName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newTestName.trim()) {
                    onCreate(newTestName.trim());
                    setNewTestName('');
                    setShowNewTestInput(false);
                    handleClose();
                  }
                  if (e.key === 'Escape') { setShowNewTestInput(false); setNewTestName(''); }
                }}
                placeholder="Nombre del test..."
                className="flex-1 bg-white/5 text-white text-sm rounded-xl px-3 py-2 border border-white/10 outline-none focus:border-blue-500/50"
              />
              <button
                onClick={() => {
                  if (newTestName.trim()) {
                    onCreate(newTestName.trim());
                    setNewTestName('');
                    setShowNewTestInput(false);
                    handleClose();
                  }
                }}
                className="bg-blue-500 text-white text-sm font-semibold px-3 py-2 rounded-xl"
              >
                Crear
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowNewTestInput(true)}
              className="w-full mt-1 py-2.5 rounded-xl border border-dashed border-white/20 text-gray-400 text-sm hover:border-blue-500/40 hover:text-blue-400 transition-colors"
            >
              + Nuevo test
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
