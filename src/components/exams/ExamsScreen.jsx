import React, { useState } from 'react';
import Icons from '../common/Icons';
import { useTheme } from '../../context/ThemeContext';

function ExamsScreen({
  tests = [],
  activeTestId,
  themes = [],
  onSwitchTest,
  onCreateTest,
  onRenameTest,
  onDeleteTest,
  onNavigate,
  currentUser,
  showToast,
}) {
  const { dm, cx } = useTheme();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [deletingId, setDeletingId] = useState(null);

  const activeThemeCount = themes.filter(t => t.questions?.length > 0).length;
  const activeQuestionCount = themes.reduce((acc, t) => acc + (t.questions?.length || 0), 0);

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    await onCreateTest(name);
    setNewName('');
    setCreating(false);
  };

  const handleRename = async (testId) => {
    const name = renameValue.trim();
    if (!name) return;
    await onRenameTest(testId, name);
    setRenamingId(null);
  };

  const handleDelete = async (testId) => {
    if (tests.length <= 1) {
      showToast('No puedes eliminar el único examen.', 'error');
      return;
    }
    await onDeleteTest(testId);
    setDeletingId(null);
  };

  const handleSelect = (testId) => {
    if (testId === activeTestId) {
      onNavigate('themes');
    } else {
      onSwitchTest(testId);
      onNavigate('themes');
    }
  };

  return (
    <div className={`min-h-full ${cx.screen} transition-colors`}
      style={{ paddingBottom: 'var(--pb-screen)' }}>

      {/* HEADER */}
      <div className={`sticky top-0 z-10 px-4 pb-3 ${cx.screen}`} style={{ paddingTop: 'var(--pt-header)' }}>
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <h1 className={`font-bold text-2xl ${cx.heading}`} style={{ fontFamily: 'Sora, system-ui' }}>
            Mis Exámenes
          </h1>
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold bg-blue-500 hover:bg-blue-600 text-white transition-colors shadow-sm"
          >
            <Icons.Plus />
            <span>Nuevo</span>
          </button>
        </div>
      </div>

      <div className="px-4 max-w-lg mx-auto space-y-3">

        {/* Formulario crear */}
        {creating && (
          <div className={`rounded-2xl p-4 space-y-3 ${cx.cardAlt}`}>
            <p className={`text-sm font-semibold ${cx.heading}`}>Nuevo examen</p>
            <input
              autoFocus
              type="text"
              placeholder="Ej: Guardia Civil 2025"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setCreating(false); }}
              className={`w-full rounded-xl px-4 py-3 text-sm outline-none ${cx.input}`}
            />
            <div className="flex gap-2">
              <button
                onClick={() => setCreating(false)}
                className={`flex-1 py-2 rounded-xl text-sm font-medium ${dm ? 'bg-white/5 text-gray-400' : 'bg-slate-100 text-slate-600'}`}
              >Cancelar</button>
              <button
                onClick={handleCreate}
                disabled={!newName.trim()}
                className="flex-1 py-2 rounded-xl text-sm font-semibold bg-blue-500 text-white disabled:opacity-40"
              >Crear</button>
            </div>
          </div>
        )}

        {/* Lista de exámenes */}
        {tests.map(test => {
          const isActive = test.id === activeTestId;
          const isRenaming = renamingId === test.id;
          const isDeleting = deletingId === test.id;

          return (
            <div
              key={test.id}
              className={`rounded-2xl p-4 transition-all ${
                isActive
                  ? dm
                    ? 'bg-blue-500/15 border border-blue-500/40'
                    : 'bg-blue-50 border border-blue-300 shadow-sm'
                  : dm
                    ? 'bg-white/5 border border-white/10'
                    : 'bg-white border border-slate-200 shadow-sm'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0 ${
                    isActive
                      ? 'bg-blue-500 text-white'
                      : dm ? 'bg-white/10 text-gray-300' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {test.cover_emoji || '📋'}
                </div>

                <div className="flex-1 min-w-0">
                  {isRenaming ? (
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={e => setRenameValue(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleRename(test.id); if (e.key === 'Escape') setRenamingId(null); }}
                      onBlur={() => handleRename(test.id)}
                      onClick={e => e.stopPropagation()}
                      className={`w-full rounded-lg px-2 py-1 text-sm outline-none border border-blue-500/50 ${dm ? 'bg-white/10 text-white' : 'bg-blue-50 text-slate-800'}`}
                    />
                  ) : (
                    <p className={`font-semibold text-sm truncate ${isActive ? (dm ? 'text-blue-300' : 'text-blue-700') : cx.heading}`}>
                      {test.name}
                    </p>
                  )}
                  {isActive && !isRenaming && (
                    <p className={`text-xs mt-0.5 ${dm ? 'text-blue-400/70' : 'text-blue-500'}`}>
                      {activeThemeCount} temas · {activeQuestionCount} preguntas
                    </p>
                  )}
                  {isDeleting && (
                    <div className="flex gap-2 mt-2">
                      <span className={`text-xs ${dm ? 'text-red-400' : 'text-red-600'}`}>¿Eliminar?</span>
                      <button onClick={() => handleDelete(test.id)} className="text-xs text-red-500 font-semibold">Sí</button>
                      <button onClick={() => setDeletingId(null)} className={`text-xs ${cx.muted}`}>No</button>
                    </div>
                  )}
                </div>

                {/* Acciones */}
                {!isRenaming && !isDeleting && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={e => { e.stopPropagation(); setRenamingId(test.id); setRenameValue(test.name); }}
                      className={`p-2 rounded-lg text-sm transition-colors ${dm ? 'text-gray-600 hover:text-blue-400' : 'text-slate-300 hover:text-blue-500'}`}
                      title="Renombrar"
                    >✏</button>
                    {tests.length > 1 && (
                      <button
                        onClick={e => { e.stopPropagation(); setDeletingId(test.id); }}
                        className={`p-2 rounded-lg text-sm transition-colors ${dm ? 'text-gray-600 hover:text-red-400' : 'text-slate-300 hover:text-red-500'}`}
                        title="Eliminar"
                      >🗑</button>
                    )}
                    <button
                      onClick={() => handleSelect(test.id)}
                      className={`ml-1 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                        isActive
                          ? 'bg-blue-500 text-white'
                          : dm ? 'bg-white/10 text-gray-300 hover:bg-white/20' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {isActive ? 'Ver temas →' : 'Seleccionar'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {tests.length === 0 && (
          <div className={`text-center py-16 rounded-2xl ${cx.card}`}>
            <div className="text-4xl mb-3">📋</div>
            <p className={`font-semibold ${dm ? 'text-gray-400' : 'text-slate-500'}`}>
              No tienes ningún examen todavía
            </p>
            <p className={`text-xs mt-1 ${dm ? 'text-gray-600' : 'text-slate-400'}`}>
              Crea tu primer examen con el botón de arriba
            </p>
          </div>
        )}

      </div>
    </div>
  );
}

export default ExamsScreen;
