import React, { useState } from 'react';
import Icons from '../common/Icons';
import { useTheme } from '../../context/ThemeContext';

/**
 * Modal de importación masiva de nombres de temas + panel de repositorios IA.
 * Props: show, onClose, onImport, importedThemesPanel, onCreateRepo, onDismissPanel
 */
export default function BulkImportModal({ show, onClose, onImport, importedThemesPanel, onCreateRepo, onDismissPanel }) {
  const { dm, cx } = useTheme();
  const [bulkText, setBulkText] = useState('');

  if (!show && !importedThemesPanel) return null;

  const handleImport = () => {
    onImport(bulkText);
    setBulkText('');
  };

  // Panel post-import: generar preguntas por tema
  if (importedThemesPanel) {
    const doneCount = importedThemesPanel.filter(t => t.status === 'done').length;
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-slate-800 border border-white/10 rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col">
          <div className="p-4 border-b border-white/10 flex items-center justify-between shrink-0">
            <div>
              <h3 className="text-white font-bold">Temas importados</h3>
              <p className="text-gray-400 text-xs mt-0.5">Genera preguntas con IA para cada tema</p>
            </div>
            <button onClick={onDismissPanel} className="bg-white/5 hover:bg-white/10 p-2 rounded-xl transition-colors text-white">
              <Icons.X />
            </button>
          </div>

          <div className="overflow-y-auto flex-1 p-4 space-y-2">
            {importedThemesPanel.map(t => (
              <div key={t.number} className="flex items-center gap-3 bg-white/5 rounded-xl px-3 py-2.5">
                <span className="text-gray-400 text-xs w-8 shrink-0">#{t.number}</span>
                <span className="text-white text-sm flex-1 truncate">{t.name}</span>
                {t.status === 'idle' && (
                  <button
                    onClick={() => onCreateRepo(t.number)}
                    className="shrink-0 bg-green-500 hover:bg-green-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                  >
                    ⚡ Generar
                  </button>
                )}
                {t.status === 'loading' && (
                  <div className="shrink-0 w-5 h-5 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
                )}
                {t.status === 'done' && (
                  <span className="shrink-0 text-green-400 text-xs font-semibold">✓ Listo</span>
                )}
                {t.status === 'error' && (
                  <button
                    onClick={() => onCreateRepo(t.number)}
                    className="shrink-0 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 text-xs px-3 py-1.5 rounded-lg transition-colors"
                  >
                    ↻ Reintentar
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="p-4 border-t border-white/10 shrink-0">
            <p className="text-gray-500 text-xs text-center">
              {doneCount}/{importedThemesPanel.length} temas procesados
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className={`border rounded-3xl w-full max-w-3xl max-h-[85vh] overflow-y-auto ${
        dm ? 'bg-slate-800 border-white/10' : 'bg-white border-slate-200'
      }`}>
        <div className={`sticky top-0 p-4 border-b flex items-center justify-between ${
          dm ? 'bg-slate-800 border-white/10' : 'bg-white border-slate-200'
        }`}>
          <div>
            <h2 className={`font-bold text-xl ${cx.heading}`}>Importar Nombres de Temas</h2>
            <p className={`text-sm mt-1 ${cx.muted}`}>Pega la lista completa de tus temas</p>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-xl ${dm ? 'bg-white/5 hover:bg-white/10 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'}`}
          >
            <Icons.X />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className={`border rounded-xl p-4 ${dm ? 'bg-blue-500/10 border-blue-500/30' : 'bg-blue-50 border-blue-200'}`}>
            <h3 className="text-blue-600 dark:text-blue-400 font-semibold text-sm mb-2">📝 Formatos aceptados:</h3>
            <div className={`text-xs space-y-1 font-mono ${dm ? 'text-gray-300' : 'text-slate-600'}`}>
              <div>1. Constitución Española</div>
              <div>Tema 2: Derechos Fundamentales</div>
              <div>3, Organización Territorial</div>
              <div>4 | Estatuto de Autonomía</div>
            </div>
          </div>

          <div>
            <label className={`text-sm mb-2 block font-semibold ${dm ? 'text-gray-300' : 'text-slate-700'}`}>
              Pega aquí tu lista (un tema por línea):
            </label>
            <textarea
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder="1. Constitución Española&#10;2. Derechos Fundamentales&#10;3. Organización Territorial&#10;..."
              className={`w-full rounded-xl px-4 py-3 font-mono text-sm min-h-[160px] sm:min-h-[300px] resize-vertical ${
                dm
                  ? 'bg-white/5 text-white border border-white/10'
                  : 'bg-slate-50 text-slate-800 border border-slate-200'
              }`}
            />
            <p className={`text-xs mt-2 ${dm ? 'text-gray-500' : 'text-slate-400'}`}>
              {bulkText.split('\n').filter(l => l.trim()).length} líneas detectadas
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className={`flex-1 font-semibold py-3 rounded-xl ${
                dm ? 'bg-white/5 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Cancelar
            </button>
            <button
              onClick={handleImport}
              disabled={!bulkText.trim()}
              className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 rounded-xl disabled:opacity-50 transition-colors"
            >
              Importar Nombres
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
