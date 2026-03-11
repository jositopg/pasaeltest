import React, { useState } from 'react';
import Icons from '../common/Icons';
import { useTheme } from '../../context/ThemeContext';
import { supabase } from '../../supabaseClient';

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
  const isSuperAdmin = currentUser?.role === 'super_admin';

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [deletingId, setDeletingId] = useState(null);

  // Share modal
  const [shareModal, setShareModal] = useState(null); // null | { loading } | { form, testId } | { published, slug } | { error }
  const [shareForm, setShareForm] = useState({ slug: '', description: '' });
  const [shareSubmitting, setShareSubmitting] = useState(false);
  const [shareError, setShareError] = useState('');

  const activeThemeCount = themes.filter(t => t.questions?.length > 0).length;
  const activeQuestionCount = themes.reduce((acc, t) => acc + (t.questions?.length || 0), 0);

  function toSlug(str) {
    return str.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

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
    const test = tests.find(t => t.id === testId);
    // Planes clonados siempre se pueden borrar; tests propios requieren al menos 2
    if (!test?.cloned_from && tests.length <= 1) {
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

  async function openShareModal(test) {
    setShareModal({ loading: true });
    setShareError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No hay sesión activa.');
      const res = await fetch('/api/manage-plans', {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      const data = await res.json();
      if (!res.ok) { setShareModal({ error: data.error || `Error ${res.status}` }); return; }
      const existing = (data.plans || []).find(p => p.id === test.id);
      if (existing) {
        setShareModal({ published: true, slug: existing.invite_slug });
      } else {
        setShareForm({ slug: toSlug(test.name || ''), description: '' });
        setShareModal({ form: true, testId: test.id });
      }
    } catch (e) {
      setShareModal({ error: e.message || 'Error desconocido' });
    }
  }

  async function handlePublish() {
    setShareError('');
    if (!shareForm.slug) { setShareError('Escribe un slug para el enlace.'); return; }
    setShareSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/manage-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ testId: shareModal.testId, cover_emoji: '📋', ...shareForm }),
      });
      const data = await res.json();
      if (!res.ok) { setShareError(data.error || `Error ${res.status}`); return; }
      setShareModal({ published: true, slug: shareForm.slug });
      navigator.clipboard.writeText(`${window.location.origin}/?join=${shareForm.slug}`).catch(() => {});
      showToast('✅ Plan publicado y enlace copiado', 'success');
    } catch (e) {
      setShareError(e.message);
    } finally {
      setShareSubmitting(false);
    }
  }

  function copyShareLink(slug) {
    navigator.clipboard.writeText(`${window.location.origin}/?join=${slug}`)
      .then(() => showToast('🔗 Enlace copiado', 'success'));
  }

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
                  ? dm ? 'bg-blue-500/15 border border-blue-500/40' : 'bg-blue-50 border border-blue-300 shadow-sm'
                  : dm ? 'bg-white/5 border border-white/10' : 'bg-white border border-slate-200 shadow-sm'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0 ${
                  isActive ? 'bg-blue-500 text-white' : dm ? 'bg-white/10 text-gray-300' : 'bg-slate-100 text-slate-600'
                }`}>
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
                      className={`p-2 rounded-lg text-sm transition-colors ${dm ? 'text-slate-400 hover:bg-blue-500/15 hover:text-blue-300' : 'text-slate-500 hover:bg-blue-50 hover:text-blue-600'}`}
                      title="Renombrar"
                    >✏</button>
                    {/* Compartir: visible para todos salvo en tests clonados de otro */}
                    {!test.cloned_from && (
                      <button
                        onClick={e => { e.stopPropagation(); openShareModal(test); }}
                        className={`p-2 rounded-lg text-sm transition-colors ${dm ? 'text-slate-400 hover:bg-green-500/15 hover:text-green-300' : 'text-slate-500 hover:bg-green-50 hover:text-green-600'}`}
                        title="Compartir este examen"
                      >🔗</button>
                    )}
                    {(test.cloned_from || tests.length > 1) && (
                      <button
                        onClick={e => { e.stopPropagation(); setDeletingId(test.id); }}
                        className={`p-2 rounded-lg text-sm transition-colors ${dm ? 'text-slate-400 hover:bg-red-500/15 hover:text-red-300' : 'text-slate-500 hover:bg-red-50 hover:text-red-500'}`}
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

      {/* Share Modal */}
      {shareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-[#0F172A] border border-white/10 rounded-3xl p-6 space-y-4">

            {shareModal.loading && (
              <div className="flex justify-center py-6">
                <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}

            {shareModal.error && (
              <>
                <h3 className="font-bold text-lg text-white">Error</h3>
                <p className="text-red-400 text-sm bg-red-500/10 rounded-xl px-3 py-2">{shareModal.error}</p>
                <button onClick={() => setShareModal(null)} className="w-full py-2 text-gray-500 text-sm">Cerrar</button>
              </>
            )}

            {shareModal.published && (
              <>
                <h3 className="font-bold text-lg text-white">Plan publicado ✅</h3>
                <p className="text-gray-400 text-sm">
                  Slug: <code className="text-green-400 bg-white/5 px-1.5 rounded">{shareModal.slug}</code>
                </p>
                <div className="bg-white/5 rounded-xl px-3 py-2 text-xs text-gray-400 break-all">
                  {window.location.origin}/?join={shareModal.slug}
                </div>
                <button
                  onClick={() => copyShareLink(shareModal.slug)}
                  className="w-full py-3 rounded-2xl bg-blue-600 text-white font-semibold"
                >🔗 Copiar enlace</button>
                <button onClick={() => setShareModal(null)} className="w-full py-2 text-gray-500 text-sm">Cerrar</button>
              </>
            )}

            {shareModal.form && (
              <>
                <h3 className="font-bold text-lg text-white">Compartir como plan oficial</h3>

                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Código del enlace (slug)</label>
                  <input
                    type="text"
                    value={shareForm.slug}
                    onChange={e => setShareForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
                    placeholder="guardia-civil-2025"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm placeholder-gray-600 focus:outline-none"
                  />
                  {shareForm.slug && (
                    <p className="text-xs text-gray-600 mt-1">{window.location.origin}/?join={shareForm.slug}</p>
                  )}
                </div>

                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Descripción (opcional)</label>
                  <textarea
                    value={shareForm.description}
                    onChange={e => setShareForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Descripción breve..."
                    rows={2}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm placeholder-gray-600 focus:outline-none resize-none"
                  />
                </div>

                {shareError && <p className="text-red-400 text-xs">{shareError}</p>}

                <div className="flex gap-3">
                  <button
                    onClick={() => { setShareModal(null); setShareError(''); }}
                    className="flex-1 py-3 rounded-xl bg-white/5 text-gray-400 text-sm font-medium"
                  >Cancelar</button>
                  <button
                    onClick={handlePublish}
                    disabled={shareSubmitting}
                    className="flex-1 py-3 rounded-xl bg-blue-600 text-white text-sm font-semibold disabled:opacity-60"
                  >{shareSubmitting ? 'Publicando...' : 'Publicar y copiar'}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default ExamsScreen;
