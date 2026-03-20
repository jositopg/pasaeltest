import React, { useState, useEffect, useMemo } from 'react';
import Icons from '../common/Icons';
import ThemeDetailModal from './ThemeDetailModal';
import TestSwitcherModal from './TestSwitcherModal';
import BulkImportModal from './BulkImportModal';
import { ThemesScreenSkeleton } from '../common/Skeleton';
import ConfirmDialog from '../common/ConfirmDialog';
import { analyzeDocument } from '../../utils/documentAnalyzer';
import { useTheme } from '../../context/ThemeContext';
import { supabase } from '../../supabaseClient';

// ─── ThemeListItem ────────────────────────────────────────────────────────────
function ThemeListItem({
  theme, selectionMode, repoCleanMode, isClonedTest,
  isEditing, editingName, setEditingName,
  isSelected, isRepoCleanSelected, estimated, generatingQuestions,
  onCardClick, onToggleSelection, onToggleRepoClean, onGenerate,
  onEditStart, onSaveName, onCancelEdit, onResetName,
}) {
  const { dm, cx } = useTheme();
  const questionCount = theme.questions?.length || 0;
  const coveragePct = estimated ? Math.min(100, Math.round((questionCount / estimated) * 100)) : null;
  const progressPercent = estimated
    ? Math.min((questionCount / estimated) * 100, 100)
    : Math.min((questionCount / 50) * 100, 100);
  const hasDocuments = theme.documents?.length > 0;
  const isDefaultName = theme.name === `Tema ${theme.number}`;

  return (
    <div
      onClick={onCardClick}
      className={`rounded-xl p-4 cursor-pointer transition-all active:scale-[0.98] ${
        dm
          ? `bg-white/5 border ${isRepoCleanSelected ? 'border-red-500/50 bg-red-500/10' : isSelected ? 'border-blue-500/50 bg-blue-500/10' : 'border-white/10 hover:bg-white/10'}`
          : `bg-white border ${isRepoCleanSelected ? 'border-red-400 bg-red-50' : isSelected ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:border-blue-300 hover:shadow-md'} shadow-sm`
      }`}
    >
      <div className="flex items-start mb-3 gap-2">
        {selectionMode && (
          <div className="pt-0.5 shrink-0">
            <input type="checkbox" checked={isSelected}
              onChange={onToggleSelection}
              onClick={(e) => e.stopPropagation()}
              className="w-4 h-4 accent-blue-500 cursor-pointer" />
          </div>
        )}
        {repoCleanMode && (
          <div className="pt-0.5 shrink-0">
            <input type="checkbox" checked={isRepoCleanSelected}
              disabled={!hasDocuments}
              onChange={() => hasDocuments && onToggleRepoClean()}
              onClick={(e) => e.stopPropagation()}
              className={`w-4 h-4 cursor-pointer ${hasDocuments ? 'accent-red-500' : 'opacity-30'}`} />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <h3 className={`font-semibold text-sm sm:text-base ${cx.heading}`}>
            Tema {theme.number}
          </h3>
          {isEditing ? (
            <input
              autoFocus
              value={editingName}
              onChange={(e) => setEditingName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onSaveName(editingName);
                if (e.key === 'Escape') onCancelEdit();
                e.stopPropagation();
              }}
              onBlur={() => onSaveName(editingName)}
              onClick={(e) => e.stopPropagation()}
              className={`w-full mt-1 text-xs sm:text-sm rounded-lg px-2 py-1 border border-blue-500/50 outline-none ${
                dm ? 'bg-white/10 text-white' : 'bg-blue-50 text-slate-800'
              }`}
            />
          ) : (
            <p className={`text-xs sm:text-sm mt-1 line-clamp-1 ${cx.body}`}>
              {theme.name}
            </p>
          )}
        </div>

        <div className="flex items-start gap-1 shrink-0">
          {!isClonedTest && !selectionMode && !isEditing && !isDefaultName && (
            <button
              onClick={(e) => { e.stopPropagation(); onGenerate(); }}
              disabled={generatingQuestions[theme.number] === 'loading'}
              title="Generar preguntas con IA"
              className={`p-1.5 rounded-lg text-base leading-none transition-colors ${
                generatingQuestions[theme.number] === 'loading'
                  ? 'text-green-400 cursor-wait'
                  : generatingQuestions[theme.number] === 'done'
                    ? 'text-green-400'
                    : dm ? 'text-slate-400 hover:bg-green-500/15 hover:text-green-300' : 'text-slate-500 hover:bg-green-50 hover:text-green-600'
              }`}
            >
              {generatingQuestions[theme.number] === 'loading'
                ? <span className="inline-block w-3.5 h-3.5 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
                : generatingQuestions[theme.number] === 'done' ? '✓' : '⚡'}
            </button>
          )}
          {!selectionMode && !isEditing && (
            <button
              onClick={(e) => { e.stopPropagation(); onEditStart(); }}
              title="Renombrar tema"
              className={`p-1.5 rounded-lg text-base leading-none transition-colors ${
                dm ? 'text-slate-400 hover:bg-blue-500/15 hover:text-blue-300' : 'text-slate-500 hover:bg-blue-50 hover:text-blue-600'
              }`}
            >
              ✏
            </button>
          )}
          {!selectionMode && !isEditing && !isDefaultName && (
            <button
              onClick={(e) => { e.stopPropagation(); onResetName(); }}
              title="Resetear a nombre por defecto"
              className={`p-1.5 rounded-lg text-sm leading-none transition-colors ${
                dm ? 'text-slate-400 hover:bg-red-500/15 hover:text-red-300' : 'text-slate-500 hover:bg-red-50 hover:text-red-500'
              }`}
            >
              ↺
            </button>
          )}
          <div className="flex flex-col gap-1.5 items-end ml-1">
            <span className={`px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap ${
              (coveragePct ?? (questionCount >= 50 ? 100 : questionCount >= 25 ? 50 : questionCount > 0 ? 20 : 0)) >= 80
                ? dm ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700'
                : (coveragePct ?? 0) >= 50
                  ? dm ? 'bg-yellow-500/20 text-yellow-400' : 'bg-yellow-100 text-yellow-700'
                  : questionCount > 0
                    ? dm ? 'bg-orange-500/20 text-orange-400' : 'bg-orange-100 text-orange-700'
                    : dm ? 'bg-gray-500/20 text-gray-400' : 'bg-slate-100 text-slate-600'
            }`}>
              {estimated ? `${questionCount}/${estimated}` : `${questionCount} preg.`}
              {coveragePct !== null && ` (${coveragePct}%)`}
            </span>
            {hasDocuments && (
              <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${
                dm ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-50 text-blue-600'
              }`}>
                {theme.documents.length} doc{theme.documents.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className={`w-full h-1.5 rounded-full overflow-hidden ${dm ? 'bg-white/10' : 'bg-slate-100'}`}>
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            progressPercent >= 80 ? 'bg-gradient-to-r from-green-500 to-green-400' :
            progressPercent >= 50 ? 'bg-gradient-to-r from-yellow-500 to-yellow-400' :
            progressPercent > 0 ? 'bg-gradient-to-r from-orange-500 to-orange-400' :
            dm ? 'bg-gray-600' : 'bg-slate-200'
          }`}
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {questionCount === 0 && !hasDocuments && (
        <p className={`text-xs mt-2 ${dm ? 'text-gray-500' : 'text-slate-500'}`}>Sin contenido añadido</p>
      )}
    </div>
  );
}

// ─── ShareModal ───────────────────────────────────────────────────────────────
function ShareModal({ shareModal, shareForm, setShareForm, shareError, shareSubmitting, onClose, onPublish, onCopyLink }) {
  const { dm } = useTheme();
  if (!shareModal) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className={`w-full max-w-sm rounded-3xl p-6 space-y-4 overflow-y-auto max-h-[90vh] border ${dm ? 'bg-[#0F172A] border-white/10' : 'bg-white border-slate-200 shadow-2xl'}`}>

        {shareModal.loading && (
          <div className="flex justify-center py-6">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {shareModal.error && (
          <>
            <h3 className={`font-bold text-lg ${dm ? 'text-white' : 'text-slate-800'}`}>Error al acceder</h3>
            <p className="text-red-400 text-sm bg-red-500/10 rounded-xl px-3 py-2">{shareModal.error}</p>
            <p className={`text-xs ${dm ? 'text-gray-500' : 'text-slate-400'}`}>Si el error menciona columnas de base de datos, ejecuta las migraciones en el dashboard de Supabase.</p>
            <button onClick={onClose} className={`w-full py-2 text-sm ${dm ? 'text-gray-500' : 'text-slate-400'}`}>
              Cerrar
            </button>
          </>
        )}

        {shareModal.published && (
          <>
            <h3 className={`font-bold text-lg ${dm ? 'text-white' : 'text-slate-800'}`}>Plan ya publicado ✅</h3>
            <p className={`text-sm ${dm ? 'text-gray-400' : 'text-slate-500'}`}>
              Slug: <code className={`text-green-500 text-xs px-1.5 rounded ${dm ? 'bg-white/5' : 'bg-slate-100'}`}>{shareModal.slug}</code>
            </p>
            <div className={`rounded-xl px-3 py-2 text-xs break-all ${dm ? 'bg-white/5 text-gray-400' : 'bg-slate-50 text-slate-500 border border-slate-200'}`}>
              {window.location.origin}/?join={shareModal.slug}
            </div>
            <button
              onClick={() => onCopyLink(shareModal.slug)}
              className="w-full py-3 rounded-2xl bg-blue-600 text-white font-semibold"
            >
              🔗 Copiar enlace
            </button>
            <button onClick={onClose} className={`w-full py-2 text-sm ${dm ? 'text-gray-500' : 'text-slate-400'}`}>
              Cerrar
            </button>
          </>
        )}

        {shareModal.form && (
          <>
            <h3 className={`font-bold text-lg ${dm ? 'text-white' : 'text-slate-800'}`}>Compartir como plan oficial</h3>

            <div>
              <label className={`text-xs mb-1 block ${dm ? 'text-gray-400' : 'text-slate-500'}`}>Código del enlace (slug)</label>
              <input
                type="text"
                value={shareForm.slug}
                onChange={e => setShareForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
                placeholder="guardia-civil-2025"
                className={`w-full rounded-xl px-3 py-2 text-sm focus:outline-none border ${dm ? 'bg-white/5 border-white/10 text-white placeholder-gray-600' : 'bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400'}`}
              />
              {shareForm.slug && (
                <p className={`text-xs mt-1 ${dm ? 'text-gray-600' : 'text-slate-400'}`}>{window.location.origin}/?join={shareForm.slug}</p>
              )}
            </div>

            <div>
              <label className={`text-xs mb-1 block ${dm ? 'text-gray-400' : 'text-slate-500'}`}>Descripción (opcional)</label>
              <textarea
                value={shareForm.description}
                onChange={e => setShareForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Descripción breve..."
                rows={2}
                className={`w-full rounded-xl px-3 py-2 text-sm focus:outline-none resize-none border ${dm ? 'bg-white/5 border-white/10 text-white placeholder-gray-600' : 'bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400'}`}
              />
            </div>

            {shareError && <p className="text-red-400 text-xs">{shareError}</p>}

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className={`flex-1 py-3 rounded-xl text-sm font-medium ${dm ? 'bg-white/5 text-gray-400' : 'bg-slate-100 text-slate-600'}`}
              >
                Cancelar
              </button>
              <button
                onClick={onPublish}
                disabled={shareSubmitting}
                className="flex-1 py-3 rounded-xl bg-blue-600 text-white text-sm font-semibold disabled:opacity-60"
              >
                {shareSubmitting ? 'Publicando...' : 'Publicar y copiar'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ThemesScreen({
  themes, tests = [], activeTestId,
  onUpdateTheme, onAddTheme, onAddThemesBatch, onCreateTest, onSwitchTest, onRenameTest, onDeleteTest,
  onNavigate, showToast,
  genQueue = {},
  currentUser,
  isClonedTest = false,
  loading = false,
}) {
  const { dm, cx } = useTheme();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTheme, setSelectedTheme] = useState(null);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [importedThemesPanel, setImportedThemesPanel] = useState(null);
  const [editingThemeNumber, setEditingThemeNumber] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedNumbers, setSelectedNumbers] = useState(new Set());
  const [showTestSwitcher, setShowTestSwitcher] = useState(false);
  // Confirmación antes de resetear nombres en masa
  const [bulkResetConfirm, setBulkResetConfirm] = useState({ show: false });
  // Modo limpiar repos: selección + confirmación
  const [repoCleanMode, setRepoCleanMode] = useState(false);
  const [repoCleanSelected, setRepoCleanSelected] = useState(new Set());
  const [repoCleanConfirm, setRepoCleanConfirm] = useState(false);
  // Confirmación bulk generation
  const [generateConfirm, setGenerateConfirm] = useState(false);

  const isAdmin = currentUser?.role === 'org_admin' || currentUser?.role === 'super_admin' || currentUser?.role === 'academy';

  // ─── Share modal (admin only) ──────────────────────────────
  const [shareModal, setShareModal] = useState(null); // null | { loading } | { published, slug } | { form } | { error }
  const [shareForm, setShareForm] = useState({ slug: '', description: '' });
  const [shareSubmitting, setShareSubmitting] = useState(false);
  const [shareError, setShareError] = useState('');

  function toSlug(str) {
    return str.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  async function openShareModal() {
    if (!activeTestId) return;
    setShareModal({ loading: true });
    setShareError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No hay sesión activa. Vuelve a iniciar sesión.');
      const res = await fetch('/api/manage-plans', {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      const data = await res.json();
      if (!res.ok) {
        setShareModal({ error: data.error || `Error ${res.status}` });
        return;
      }
      const existing = (data.plans || []).find(p => p.id === activeTestId);
      if (existing) {
        setShareModal({ published: true, slug: existing.invite_slug, plan: existing });
      } else {
        const activeTest = tests.find(t => t.id === activeTestId);
        setShareForm({ slug: toSlug(activeTest?.name || ''), description: '' });
        setShareModal({ form: true });
      }
    } catch (e) {
      setShareModal({ error: e.message || 'Error desconocido' });
    }
  }

  async function handlePublishFromThemes() {
    setShareError('');
    if (!shareForm.slug) { setShareError('Escribe un slug para el enlace.'); return; }
    setShareSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/manage-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ testId: activeTestId, cover_emoji: '📋', ...shareForm }),
      });
      const data = await res.json();
      if (!res.ok) { setShareError(data.error || `Error ${res.status}`); return; }
      setShareModal({ published: true, slug: shareForm.slug });
      // Copiar automáticamente
      const url = `${window.location.origin}/?join=${shareForm.slug}`;
      navigator.clipboard.writeText(url).catch(() => {});
      showToast('✅ Plan publicado y enlace copiado', 'success');
    } catch (e) {
      setShareError(e.message);
    } finally {
      setShareSubmitting(false);
    }
  }

  function copyShareLink(slug) {
    const url = `${window.location.origin}/?join=${slug}`;
    navigator.clipboard.writeText(url).then(() => showToast('🔗 Enlace copiado', 'success'));
  }

  const {
    generatingQuestions = {},
    generatingAll = false,
    queueProgress = null,
    generateThemeInline,
    handleGenerateAll,
  } = genQueue;

  const anyBulkRunning = generatingAll;

  // Estimación de preguntas necesarias por tema (algorítmico, sin API)
  const themeEstimates = useMemo(() => {
    const map = {};
    for (const t of themes) {
      if (!t.documents?.length) continue;
      let content = '';
      for (const doc of t.documents) {
        const text = doc.processedContent || doc.searchResults?.processedContent || doc.searchResults?.content || doc.content || '';
        content += text;
        if (content.length > 60000) break;
      }
      if (content.length < 100) continue;
      try {
        const { report } = analyzeDocument(content.substring(0, 60000));
        map[t.number] = report.totalQuestions;
      } catch {
        const words = content.split(/\s+/).length;
        map[t.number] = Math.min(150, Math.max(20, Math.round(words / 50)));
      }
    }
    return map;
  }, [themes]);

  const handleUpdateTheme = (updatedTheme) => {
    onUpdateTheme(updatedTheme);
    setSelectedTheme(updatedTheme);
  };

  // Sincronizar selectedTheme con themes global
  useEffect(() => {
    if (selectedTheme) {
      const updated = themes.find(t => t.number === selectedTheme.number);
      if (updated) setSelectedTheme(updated);
    }
  }, [themes]);

  const filteredThemes = useMemo(() =>
    themes.filter(t =>
      t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.number.toString().includes(searchTerm)
    ),
  [themes, searchTerm]);

  const handleBulkImport = async (bulkText) => {
    const lines = bulkText.trim().split('\n').filter(l => l.trim());
    const toUpdate = [];
    const toCreate = [];
    let nextFreeNumber = themes.length > 0 ? Math.max(...themes.map(t => t.number)) + 1 : 1;

    lines.forEach(line => {
      const matchNum = line.match(/(?:Tema\s*)?(\d+)[\s.:,|]+(.+)/i);
      if (matchNum) {
        const number = parseInt(matchNum[1]);
        const name = matchNum[2].trim();
        const existing = themes.find(t => t.number === number);
        if (existing) toUpdate.push({ ...existing, name });
        else toCreate.push({ number, name });
      } else {
        // Sin número — asignar correlativo
        const name = line.replace(/^[-*•]+\s*/, '').trim();
        if (name) { toCreate.push({ number: nextFreeNumber++, name }); }
      }
    });

    toUpdate.forEach(theme => onUpdateTheme(theme));

    let created = [];
    if (toCreate.length > 0 && onAddThemesBatch) {
      const result = await onAddThemesBatch(toCreate);
      if (result?.error) {
        showToast(`Error al importar: ${result.error}`, 'error');
      } else {
        created = result?.themes || [];
      }
    }

    setShowBulkImport(false);

    const allImported = [...toUpdate, ...created];
    if (allImported.length > 0) {
      setImportedThemesPanel(
        allImported.map(t => ({ number: t.number, name: t.name, status: 'idle' }))
      );
    } else if (lines.length > 0 && toCreate.length === 0 && toUpdate.length === 0) {
      showToast('No se detectaron temas válidos en el texto', 'warning');
    }
  };

  const createRepoForTheme = async (themeNumber) => {
    const themeObj = themes.find(t => t.number === themeNumber);
    if (!themeObj) return;
    setImportedThemesPanel(prev =>
      prev.map(t => t.number === themeNumber ? { ...t, status: 'loading' } : t)
    );
    const err = await genQueue.generateCombinedInline?.(themeObj);
    setImportedThemesPanel(prev =>
      prev.map(t => t.number === themeNumber ? { ...t, status: err ? 'error' : 'done' } : t)
    );
  };

  const handleSaveName = (theme, newName) => {
    onUpdateTheme({ ...theme, name: newName.trim() || theme.name });
    setEditingThemeNumber(null);
  };

  const handleResetName = (theme) => {
    onUpdateTheme({ ...theme, name: `Tema ${theme.number}` });
  };

  // ─── Repo clean mode ──────────────────────────────────────────
  const toggleRepoClean = (number) => {
    setRepoCleanSelected(prev => {
      const next = new Set(prev);
      if (next.has(number)) next.delete(number); else next.add(number);
      return next;
    });
  };

  const confirmRepoClean = () => {
    repoCleanSelected.forEach(num => {
      const t = themes.find(t => t.number === num);
      if (t) onUpdateTheme({ ...t, documents: [] });
    });
    const n = repoCleanSelected.size;
    setRepoCleanMode(false);
    setRepoCleanSelected(new Set());
    setRepoCleanConfirm(false);
    showToast(`🗑 Material de ${n} tema${n !== 1 ? 's' : ''} eliminado`, 'success');
  };

  const handleBulkReset = () => {
    selectedNumbers.forEach(num => {
      const theme = themes.find(t => t.number === num);
      if (theme) onUpdateTheme({ ...theme, name: `Tema ${theme.number}` });
    });
    setSelectedNumbers(new Set());
    setSelectionMode(false);
  };

  const toggleSelection = (e, number) => {
    e.stopPropagation();
    setSelectedNumbers(prev => {
      const next = new Set(prev);
      if (next.has(number)) next.delete(number);
      else next.add(number);
      return next;
    });
  };

  return (
    <div className={`min-h-full ${cx.screen} transition-colors`}>
      {/* STICKY HEADER — cubre Dynamic Island, botones quedan bajo la zona segura */}
      <div className={`sticky top-0 z-10 px-4 pb-3 ${cx.screen}`} style={{ paddingTop: 'var(--pt-header)' }}>
        <div className="max-w-2xl mx-auto space-y-3">
        {/* Header fila 1: back + título + acciones */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate('exams')}
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all ${dm ? 'bg-white/5 text-slate-300 hover:bg-white/10' : 'bg-white text-slate-600 border border-slate-200 shadow-sm hover:bg-slate-50'}`}
          >
            <Icons.ChevronLeft />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className={`font-bold text-xl leading-tight ${cx.heading}`}>Temas</h1>
            {tests.length > 0 && (
              <p className={`text-xs truncate ${dm ? 'text-blue-400/80' : 'text-blue-600'}`}>
                {tests.find(t => t.id === activeTestId)?.name || 'Mi Plan'}
              </p>
            )}
          </div>
          {!isClonedTest && !selectionMode && !repoCleanMode && (
            <button
              onClick={() => setSelectionMode(true)}
              className={`px-3 py-2 rounded-xl text-sm font-semibold transition-colors flex items-center gap-1.5 ${dm ? 'bg-white/5 text-gray-300 hover:bg-white/10' : 'bg-white text-slate-600 border border-slate-200 shadow-sm hover:bg-slate-50'}`}
              title="Seleccionar temas en masa"
            >☑ <span className="hidden sm:inline text-xs">Selección</span></button>
          )}
          {!isClonedTest && <>
            <button
              onClick={async () => { if (!onAddTheme) return; const result = await onAddTheme(); if (result?.error) showToast(result.error, 'error'); }}
              className={`px-3 py-2 rounded-xl text-sm font-semibold flex items-center gap-1.5 transition-colors shadow-sm ${dm ? 'bg-white/5 text-slate-300 hover:bg-white/10' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
              title="Añadir un tema"
            >
              <Icons.Plus />
            </button>
            <button
              onClick={() => setShowBulkImport(true)}
              className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded-xl text-sm font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <Icons.Plus /><span className="hidden sm:inline">Importar</span>
            </button>
          </>}
        </div>

        {/* Header fila 2: acciones bulk (cambia según el modo activo) */}
        {selectionMode ? (
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => {
                const allNumbers = filteredThemes.map(t => t.number);
                const allSelected = allNumbers.every(n => selectedNumbers.has(n));
                setSelectedNumbers(allSelected ? new Set() : new Set(allNumbers));
              }}
              className={`px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${cx.btnGhost}`}
            >
              {filteredThemes.every(t => selectedNumbers.has(t.number)) ? 'Deseleccionar todo' : 'Seleccionar todo'}
            </button>
            {selectedNumbers.size > 0 && (
              <button
                onClick={() => setBulkResetConfirm({ show: true })}
                className="bg-orange-500 hover:bg-orange-600 text-white px-3 py-2 rounded-xl text-xs font-semibold transition-colors"
              >
                Restablecer ({selectedNumbers.size})
              </button>
            )}
            <button
              onClick={() => { setSelectionMode(false); setSelectedNumbers(new Set()); }}
              className={`px-3 py-2 rounded-xl text-xs font-semibold ${dm ? 'bg-white/5 text-white' : 'bg-slate-100 text-slate-700'}`}
            >Cancelar</button>
          </div>
        ) : repoCleanMode ? (
          <div className="flex gap-2 flex-wrap">
            <span className={`px-3 py-2 rounded-xl text-xs font-semibold ${dm ? 'text-red-300' : 'text-red-600'}`}>
              🗑 Selecciona repositorios a eliminar
            </span>
            <button
              onClick={() => {
                const withDocs = filteredThemes.filter(t => t.documents?.length > 0).map(t => t.number);
                const allSelected = withDocs.every(n => repoCleanSelected.has(n));
                setRepoCleanSelected(allSelected ? new Set() : new Set(withDocs));
              }}
              className={`px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${cx.btnGhost}`}
            >
              {filteredThemes.filter(t => t.documents?.length > 0).every(t => repoCleanSelected.has(t.number)) ? 'Deseleccionar todo' : 'Seleccionar todo'}
            </button>
            {repoCleanSelected.size > 0 && (
              <button
                onClick={() => setRepoCleanConfirm(true)}
                className="bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded-xl text-xs font-semibold transition-colors"
              >
                Borrar repos ({repoCleanSelected.size})
              </button>
            )}
            <button
              onClick={() => { setRepoCleanMode(false); setRepoCleanSelected(new Set()); }}
              className={`px-3 py-2 rounded-xl text-xs font-semibold ${dm ? 'bg-white/5 text-white' : 'bg-slate-100 text-slate-700'}`}
            >Cancelar</button>
          </div>
        ) : isClonedTest ? null : (
          <div className="flex gap-2">
            <button
              onClick={() => setGenerateConfirm(true)}
              disabled={anyBulkRunning}
              className={`flex-1 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-1.5 ${
                anyBulkRunning
                  ? 'opacity-50 cursor-not-allowed ' + (dm ? 'bg-green-500/20 text-green-300' : 'bg-green-50 text-green-400')
                  : dm ? 'bg-green-500/20 text-green-300 hover:bg-green-500/30 border border-green-500/30' : 'bg-green-50 text-green-600 border border-green-200 hover:bg-green-100'
              }`}
            >
              {generatingAll ? <div className="w-4 h-4 border-2 border-green-300 border-t-transparent rounded-full animate-spin" /> : '⚡'}
              <span>Generar preguntas</span>
            </button>
            <button
              onClick={() => setRepoCleanMode(true)}
              className={`px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-1.5 ${
                dm ? 'bg-red-500/20 text-red-300 hover:bg-red-500/30 border border-red-500/30' : 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'
              }`}
            >
              🗑
            </button>
          </div>
        )}

        {/* Compartir — solo admin */}
        {isAdmin && (
          <div className="flex items-center gap-2">
            <button
              onClick={openShareModal}
              title="Compartir este test como plan oficial"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold transition-colors ${
                dm
                  ? 'bg-green-500/10 border border-green-500/30 text-green-400 hover:bg-green-500/20'
                  : 'bg-green-50 border border-green-200 text-green-600 hover:bg-green-100'
              }`}
            >
              🔗 Compartir
            </button>
          </div>
        )}

        </div>
      </div>
      {/* SCROLLABLE CONTENT */}
      <div className="px-4 pt-3" style={{ paddingBottom: 'var(--pb-screen)' }}>
        <div className="max-w-2xl mx-auto space-y-4">

        {/* Banner modo invitado */}
        {currentUser?.isGuest && (
          <div className="rounded-2xl p-4 border border-amber-400/30" style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.10), rgba(234,88,12,0.10))' }}>
            <div className="flex items-start gap-3">
              <span className="text-xl mt-0.5">⚠️</span>
              <div className="flex-1">
                <p className="font-semibold text-amber-400 text-sm">Modo Prueba — Datos temporales</p>
                <p className={`text-xs mt-1 ${dm ? 'text-slate-400' : 'text-slate-500'}`}>
                  Todo lo que añadas aquí (temas, documentos, preguntas) se perderá al cerrar sesión o recargar la página.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Progress panel — visible when bulk generation is running or just finished */}
        {queueProgress && (
          <div className={`rounded-2xl p-4 space-y-2 ${cx.cardAlt}`}>
            {/* Header row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {queueProgress.currentName ? (
                  <div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin shrink-0 border-green-400" />
                ) : (
                  <span className="text-green-400 text-sm">✓</span>
                )}
                <span className={`font-semibold text-sm ${cx.heading}`}>
                  ⚡ Generando preguntas:&nbsp;
                  <span className={dm ? 'text-slate-300' : 'text-slate-600'}>{queueProgress.done}/{queueProgress.total}</span>
                </span>
              </div>
              {queueProgress.errors?.length > 0 && (
                <span className={`text-xs font-semibold ${dm ? 'text-red-400' : 'text-red-500'}`}>
                  {queueProgress.errors.length} error{queueProgress.errors.length !== 1 ? 'es' : ''}
                </span>
              )}
            </div>

            {/* Progress bar */}
            <div className={`w-full h-1.5 rounded-full overflow-hidden ${dm ? 'bg-white/10' : 'bg-slate-100'}`}>
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  queueProgress.done >= queueProgress.total ? 'bg-green-500' : 'bg-green-500'
                }`}
                style={{ width: `${Math.round((queueProgress.done / queueProgress.total) * 100)}%` }}
              />
            </div>

            {/* Current theme */}
            {queueProgress.currentName && (
              <p className={`text-xs ${dm ? 'text-slate-400' : 'text-slate-500'}`}>
                Procesando:{' '}
                <span className={`font-medium ${dm ? 'text-slate-200' : 'text-slate-700'}`}>
                  {queueProgress.currentName}
                </span>
              </p>
            )}

            {/* Errors list */}
            {queueProgress.errors?.length > 0 && (
              <div className={`rounded-xl p-3 space-y-1 ${dm ? 'bg-red-500/10' : 'bg-red-50'}`}>
                {queueProgress.errors.map((err, i) => (
                  <p key={i} className={`text-xs ${dm ? 'text-red-300' : 'text-red-600'}`}>
                    <span className="font-semibold">✗ {err.name}:</span> {err.reason}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Search */}
        <div className={`rounded-2xl p-4 ${dm ? 'bg-white/5 border border-white/10' : 'bg-white shadow-sm border border-slate-200'}`}>
          <div className="relative">
            <input
              type="text"
              placeholder="Buscar tema..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full rounded-xl px-4 py-3 pl-12 ${
                dm
                  ? 'bg-white/5 text-white border border-white/10 placeholder-gray-500'
                  : 'bg-slate-50 text-slate-800 border border-slate-200 placeholder-slate-400'
              }`}
            />
            <div className={`absolute left-4 top-1/2 -translate-y-1/2 ${dm ? 'text-gray-400' : 'text-slate-400'}`}>
              <Icons.Search />
            </div>
          </div>
        </div>

        {/* Empty state — sin temas */}
        {themes.length === 0 && !loading && (
          <div className={`rounded-2xl p-8 text-center ${dm ? 'bg-white/5 border border-white/10' : 'bg-white border border-slate-200 shadow-sm'}`}>
            <div className="text-5xl mb-4">📚</div>
            <h3 className={`text-lg font-bold mb-1 ${cx.heading}`}>Empieza añadiendo tus temas</h3>
            <p className={`text-sm mb-6 ${cx.muted}`}>
              Importa o crea los temas de tu temario para comenzar
            </p>

            {/* Pasos rápidos */}
            <div className="space-y-2 text-left mb-6">
              {[
                { n: '1', label: 'Importa la lista de temas de tu temario', icon: '📋' },
                { n: '2', label: 'Pulsa ⚡ para generar preguntas con IA directamente', icon: '🤖' },
                { n: '3', label: 'Repasa las preguntas y empieza a estudiar', icon: '✅' },
              ].map(step => (
                <div key={step.n} className={`flex items-center gap-3 rounded-xl px-4 py-3 ${dm ? 'bg-white/5' : 'bg-slate-50'}`}>
                  <span className="text-xl">{step.icon}</span>
                  <span className={`text-sm ${cx.body}`}>{step.label}</span>
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <button
                onClick={() => setShowBulkImport(true)}
                className="flex-1 sm:flex-none px-5 py-3 rounded-xl text-sm font-semibold bg-blue-500 hover:bg-blue-600 text-white transition-colors shadow-sm"
              >
                📋 Importar lista de temas
              </button>
              <button
                onClick={async () => { if (!onAddTheme) return; const result = await onAddTheme(); if (result?.error) showToast(result.error, 'error'); }}
                className={`flex-1 sm:flex-none px-5 py-3 rounded-xl text-sm font-semibold transition-colors ${dm ? 'bg-white/10 text-slate-200 hover:bg-white/15' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
              >
                + Añadir tema solo
              </button>
            </div>
          </div>
        )}

        {/* Empty state — búsqueda sin resultados */}
        {themes.length > 0 && filteredThemes.length === 0 && !loading && (
          <div className={`text-center py-10 rounded-2xl ${dm ? 'bg-white/5 border border-white/10' : 'bg-white border border-slate-200 shadow-sm'}`}>
            <div className="text-4xl mb-3">🔍</div>
            <p className={`font-semibold text-sm ${cx.heading}`}>Sin resultados para "{searchTerm}"</p>
            <p className={`text-xs mt-1 mb-4 ${cx.muted}`}>Prueba con otro nombre de tema</p>
            <button
              onClick={() => setSearchTerm('')}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${dm ? 'bg-white/10 text-gray-300 hover:bg-white/15' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              Limpiar búsqueda
            </button>
          </div>
        )}

        {/* Theme list */}
        {loading ? (
          <ThemesScreenSkeleton />
        ) : (
        <div className="space-y-2">
          {filteredThemes.map(theme => {
            const isEditing = editingThemeNumber === theme.number;
            const hasDocuments = theme.documents?.length > 0;
            return (
              <ThemeListItem
                key={theme.number}
                theme={theme}
                selectionMode={selectionMode}
                repoCleanMode={repoCleanMode}
                isClonedTest={isClonedTest}
                isEditing={isEditing}
                editingName={editingName}
                setEditingName={setEditingName}
                isSelected={selectedNumbers.has(theme.number)}
                isRepoCleanSelected={repoCleanSelected.has(theme.number)}
                estimated={themeEstimates[theme.number] || null}
                generatingQuestions={generatingQuestions}
                onCardClick={() => {
                  if (selectionMode) {
                    setSelectedNumbers(prev => { const next = new Set(prev); if (next.has(theme.number)) next.delete(theme.number); else next.add(theme.number); return next; });
                  } else if (repoCleanMode) {
                    if (hasDocuments) toggleRepoClean(theme.number);
                  } else if (!isEditing) {
                    setSelectedTheme(theme);
                  }
                }}
                onToggleSelection={() => setSelectedNumbers(prev => { const next = new Set(prev); if (next.has(theme.number)) next.delete(theme.number); else next.add(theme.number); return next; })}
                onToggleRepoClean={() => toggleRepoClean(theme.number)}
                onGenerate={() => generateThemeInline(theme)}
                onEditStart={() => { setEditingThemeNumber(theme.number); setEditingName(theme.name); }}
                onSaveName={(name) => handleSaveName(theme, name)}
                onCancelEdit={() => setEditingThemeNumber(null)}
                onResetName={() => handleResetName(theme)}
              />
            );
          })}
        </div>
        )} {/* end loading ? skeleton : list */}

        {selectedTheme && (
          <ThemeDetailModal
            key={`theme-${selectedTheme.number}-${selectedTheme.documents?.length || 0}-${selectedTheme.questions?.length || 0}`}
            theme={selectedTheme}
            onClose={() => setSelectedTheme(null)}
            onUpdate={handleUpdateTheme}
            showToast={showToast}
            readOnly={isClonedTest}
          />
        )}

        <TestSwitcherModal
          show={showTestSwitcher}
          tests={tests}
          activeTestId={activeTestId}
          onClose={() => setShowTestSwitcher(false)}
          onSwitch={onSwitchTest}
          onCreate={onCreateTest}
          onRename={onRenameTest}
          onDelete={onDeleteTest}
        />

        <BulkImportModal
          show={showBulkImport}
          onClose={() => setShowBulkImport(false)}
          onImport={handleBulkImport}
          importedThemesPanel={importedThemesPanel}
          onCreateRepo={createRepoForTheme}
          onDismissPanel={() => setImportedThemesPanel(null)}
        />

        <ConfirmDialog
          show={bulkResetConfirm.show}
          title="¿Resetear nombres de temas?"
          message={`¿Seguro que quieres resetear el nombre de ${selectedNumbers.size} tema${selectedNumbers.size !== 1 ? 's' : ''} a su nombre por defecto ("Tema N")?`}
          confirmLabel="Sí, resetear"
          danger
          onConfirm={() => { handleBulkReset(); setBulkResetConfirm({ show: false }); }}
          onCancel={() => setBulkResetConfirm({ show: false })}
        />
        <ConfirmDialog
          show={repoCleanConfirm}
          title="¿Borrar material seleccionado?"
          message={`Se eliminará el material de ${repoCleanSelected.size} tema${repoCleanSelected.size !== 1 ? 's' : ''}. Después podrás regenerarlo con ⚡.`}
          confirmLabel="Sí, borrar"
          danger
          onConfirm={confirmRepoClean}
          onCancel={() => setRepoCleanConfirm(false)}
        />
        <ConfirmDialog
          show={generateConfirm}
          title="¿Generar preguntas para todos los temas?"
          message="Se generarán preguntas con IA para cada tema con nombre personalizado. Si el tema no tiene material, se creará automáticamente. Este proceso puede tardar varios minutos."
          confirmLabel="Sí, generar"
          onConfirm={() => { setGenerateConfirm(false); handleGenerateAll(); }}
          onCancel={() => setGenerateConfirm(false)}
        />

        {/* ─── Share Modal (admin) ─────────────────────────────── */}
        <ShareModal
          shareModal={shareModal}
          shareForm={shareForm}
          setShareForm={setShareForm}
          shareError={shareError}
          shareSubmitting={shareSubmitting}
          onClose={() => { setShareModal(null); setShareError(''); }}
          onPublish={handlePublishFromThemes}
          onCopyLink={copyShareLink}
        />

        </div>
      </div>
    </div>
  );
}

export default ThemesScreen;
