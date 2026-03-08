import React, { useState, useEffect, useMemo } from 'react';
import Icons from '../common/Icons';
import ThemeDetailModal from './ThemeDetailModal';
import TestSwitcherModal from './TestSwitcherModal';
import BulkImportModal from './BulkImportModal';
import ConfirmDialog from '../common/ConfirmDialog';
import { OPTIMIZED_AUTO_GENERATE_PROMPT } from '../../utils/optimizedPrompts';
import { analyzeDocument } from '../../utils/documentAnalyzer';
import { useTheme } from '../../context/ThemeContext';
import { supabase } from '../../supabaseClient';

const ADMIN_EMAIL = 'josedlp7@gmail.com';
const COVER_EMOJIS = ['📋', '🎖️', '📘', '⚖️', '🏛️', '🚒'];

function ThemesScreen({
  themes, tests = [], activeTestId,
  onUpdateTheme, onCreateTest, onSwitchTest, onRenameTest, onDeleteTest,
  onNavigate, showToast,
  genQueue = {},
  currentUser,
}) {
  const { darkMode } = useTheme();
  const dm = darkMode;
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
  // Confirmaciones bulk generation
  const [generateReposConfirm, setGenerateReposConfirm] = useState(false);
  const [generateQuestionsConfirm, setGenerateQuestionsConfirm] = useState(false);

  const isAdmin = currentUser?.email?.toLowerCase() === ADMIN_EMAIL;

  // ─── Share modal (admin only) ──────────────────────────────
  const [shareModal, setShareModal] = useState(null); // null | { loading } | { published, slug } | { form }
  const [shareForm, setShareForm] = useState({ slug: '', description: '', cover_emoji: '📋' });
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
      const res = await fetch('/api/manage-plans', {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      const data = await res.json();
      const existing = (data.plans || []).find(p => {
        // buscar por testId — el plan original tiene el mismo id que el test del admin
        // los planes son los tests del admin con is_official=true
        return p.id === activeTestId;
      });
      if (existing) {
        setShareModal({ published: true, slug: existing.invite_slug, plan: existing });
      } else {
        const activeTest = tests.find(t => t.id === activeTestId);
        setShareForm({ slug: toSlug(activeTest?.name || ''), description: '', cover_emoji: '📋' });
        setShareModal({ form: true });
      }
    } catch (e) {
      setShareModal(null);
      showToast('Error al comprobar el plan', 'error');
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
        body: JSON.stringify({ testId: activeTestId, ...shareForm }),
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
    generatingRepos = {},
    generatingQuestions = {},
    generatingAll = false,
    generatingAllQuestions = false,
    queueProgress = null,
    createRepoInline,
    generateQuestionsInline,
    handleGenerateAll,
    handleGenerateAllQuestions,
  } = genQueue;

  const anyBulkRunning = generatingAll || generatingAllQuestions;

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

  const filteredThemes = themes.filter(t =>
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.number.toString().includes(searchTerm)
  );

  const handleBulkImport = (bulkText) => {
    const lines = bulkText.trim().split('\n');
    const updates = [];

    lines.forEach(line => {
      const match = line.match(/(?:Tema\s*)?(\d+)[\s.:,|]+(.+)/i);
      if (match) {
        const number = parseInt(match[1]);
        const name = match[2].trim();
        const theme = themes.find(t => t.number === number);
        if (theme) updates.push({ ...theme, name });
      }
    });

    updates.forEach(theme => onUpdateTheme(theme));
    setShowBulkImport(false);

    if (updates.length > 0) {
      setImportedThemesPanel(
        updates.map(t => ({ number: t.number, name: t.name, status: 'idle' }))
      );
    }
  };

  const createRepoForTheme = async (themeNumber) => {
    const themeEntry = importedThemesPanel?.find(t => t.number === themeNumber);
    if (!themeEntry) return;

    setImportedThemesPanel(prev =>
      prev.map(t => t.number === themeNumber ? { ...t, status: 'loading' } : t)
    );

    try {
      const response = await fetch("/api/generate-gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: OPTIMIZED_AUTO_GENERATE_PROMPT(themeEntry.name), maxTokens: 8000, callType: 'repo', useCache: false })
      });

      if (!response.ok) throw new Error(`API error: ${response.status}`);

      const data = await response.json();
      if (!Array.isArray(data.content)) throw new Error('Respuesta de la IA inválida');
      let content = '';
      for (const block of data.content) {
        if (block.type === 'text') content += block.text;
      }
      if (content.trim().length < 100) throw new Error('Contenido insuficiente');

      const newDoc = {
        type: 'ai-search',
        content: themeEntry.name,
        fileName: `Repositorio: ${themeEntry.name}`,
        addedAt: new Date().toISOString(),
        searchResults: { query: themeEntry.name, content, processedContent: content },
        processedContent: content
      };

      const latestTheme = themes.find(t => t.number === themeNumber);
      if (latestTheme) {
        onUpdateTheme({ ...latestTheme, documents: [...(latestTheme.documents || []), newDoc] });
      }

      setImportedThemesPanel(prev =>
        prev.map(t => t.number === themeNumber ? { ...t, status: 'done' } : t)
      );
    } catch (e) {
      console.error(`Error repo para "${themeEntry.name}":`, e);
      setImportedThemesPanel(prev =>
        prev.map(t => t.number === themeNumber ? { ...t, status: 'error' } : t)
      );
    }
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
    showToast(`🗑 ${n} repositorio${n !== 1 ? 's' : ''} eliminado${n !== 1 ? 's' : ''}`, 'success');
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
    <div className={`min-h-full ${dm ? 'bg-[#080C14]' : 'bg-[#F0F4FF]'} transition-colors`}>
      {/* STICKY HEADER — cubre Dynamic Island, botones quedan bajo la zona segura */}
      <div className={`sticky top-0 z-10 px-4 pb-3 ${dm ? 'bg-[#080C14]' : 'bg-[#F0F4FF]'}`} style={{ paddingTop: 'var(--pt-header)' }}>
        <div className="max-w-2xl mx-auto space-y-3">
        {/* Header fila 1: título + acciones */}
        <div className="flex items-center gap-3">
          <h1 className={`font-bold text-2xl flex-1 ${dm ? 'text-white' : 'text-slate-800'}`}>Temas</h1>
          {!selectionMode && !repoCleanMode && (
            <button
              onClick={() => setSelectionMode(true)}
              className={`p-2 rounded-xl text-sm font-semibold transition-colors ${dm ? 'bg-white/5 text-gray-300 hover:bg-white/10' : 'bg-white text-slate-600 border border-slate-200 shadow-sm hover:bg-slate-50'}`}
              title="Seleccionar temas para renombrar en masa"
            >☑</button>
          )}
          <button
            onClick={() => setShowBulkImport(true)}
            className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded-xl text-sm font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <Icons.Plus /><span className="hidden sm:inline">Importar</span>
          </button>
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
              className={`px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${dm ? 'bg-white/5 text-gray-300 hover:bg-white/10' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              {filteredThemes.every(t => selectedNumbers.has(t.number)) ? 'Deseleccionar todo' : 'Seleccionar todo'}
            </button>
            {selectedNumbers.size > 0 && (
              <button
                onClick={() => setBulkResetConfirm({ show: true })}
                className="bg-orange-500 hover:bg-orange-600 text-white px-3 py-2 rounded-xl text-xs font-semibold transition-colors"
              >
                Reset nombres ({selectedNumbers.size})
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
              🗑 Selecciona los repos a borrar
            </span>
            <button
              onClick={() => {
                const withDocs = filteredThemes.filter(t => t.documents?.length > 0).map(t => t.number);
                const allSelected = withDocs.every(n => repoCleanSelected.has(n));
                setRepoCleanSelected(allSelected ? new Set() : new Set(withDocs));
              }}
              className={`px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${dm ? 'bg-white/5 text-gray-300 hover:bg-white/10' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
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
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => setGenerateReposConfirm(true)}
              disabled={anyBulkRunning}
              className={`flex-1 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-1.5 ${
                anyBulkRunning
                  ? 'opacity-50 cursor-not-allowed ' + (dm ? 'bg-purple-500/20 text-purple-300' : 'bg-purple-50 text-purple-400')
                  : dm ? 'bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 border border-purple-500/30' : 'bg-purple-50 text-purple-600 border border-purple-200 hover:bg-purple-100'
              }`}
            >
              {generatingAll ? <div className="w-4 h-4 border-2 border-purple-300 border-t-transparent rounded-full animate-spin" /> : '⚡'}
              Repos
            </button>
            <button
              onClick={() => setGenerateQuestionsConfirm(true)}
              disabled={anyBulkRunning}
              className={`flex-1 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-1.5 ${
                anyBulkRunning
                  ? 'opacity-50 cursor-not-allowed ' + (dm ? 'bg-green-500/20 text-green-300' : 'bg-green-50 text-green-400')
                  : dm ? 'bg-green-500/20 text-green-300 hover:bg-green-500/30 border border-green-500/30' : 'bg-green-50 text-green-600 border border-green-200 hover:bg-green-100'
              }`}
            >
              {generatingAllQuestions ? <div className="w-4 h-4 border-2 border-green-300 border-t-transparent rounded-full animate-spin" /> : '📝'}
              Preguntas
            </button>
            <button
              onClick={() => setRepoCleanMode(true)}
              className={`flex-1 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-1.5 ${
                dm ? 'bg-red-500/20 text-red-300 hover:bg-red-500/30 border border-red-500/30' : 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'
              }`}
            >
              🗑 Limpiar
            </button>
          </div>
        )}

        {/* Test activo */}
        {tests.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowTestSwitcher(true)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-semibold transition-colors ${
                dm
                  ? 'bg-blue-500/10 border border-blue-500/30 text-blue-400 hover:bg-blue-500/20'
                  : 'bg-blue-50 border border-blue-200 text-blue-600 hover:bg-blue-100'
              }`}
            >
              <span>{tests.find(t => t.id === activeTestId)?.name || 'Mi Test'}</span>
              <span className="opacity-50 text-xs">▾</span>
            </button>
            {isAdmin && (
              <button
                onClick={openShareModal}
                title="Compartir este test como plan oficial"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold transition-colors ${
                  dm
                    ? 'bg-green-500/10 border border-green-500/30 text-green-400 hover:bg-green-500/20'
                    : 'bg-green-50 border border-green-200 text-green-600 hover:bg-green-100'
                }`}
              >
                🔗
              </button>
            )}
            {tests.length > 1 && (
              <span className={`text-xs ${dm ? 'text-gray-500' : 'text-slate-400'}`}>
                {tests.length} tests
              </span>
            )}
          </div>
        )}

        </div>
      </div>
      {/* SCROLLABLE CONTENT */}
      <div className="px-4 pt-3" style={{ paddingBottom: 'var(--pb-screen)' }}>
        <div className="max-w-2xl mx-auto space-y-4">
        {/* Progress panel — visible when bulk generation is running or just finished */}
        {queueProgress && (
          <div className={`rounded-2xl p-4 space-y-2 ${dm ? 'bg-[#0F172A] border border-[#1E293B]' : 'bg-white border border-slate-200 shadow-sm'}`}>
            {/* Header row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {queueProgress.currentName ? (
                  <div className={`w-4 h-4 rounded-full border-2 border-t-transparent animate-spin shrink-0 ${
                    queueProgress.type === 'repos' ? 'border-purple-400' : 'border-green-400'
                  }`} />
                ) : (
                  <span className="text-green-400 text-sm">✓</span>
                )}
                <span className={`font-semibold text-sm ${dm ? 'text-white' : 'text-slate-800'}`}>
                  {queueProgress.type === 'repos' ? '⚡ Repositorios' : '📝 Preguntas'}:&nbsp;
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
                  queueProgress.done >= queueProgress.total ? 'bg-green-500' :
                  queueProgress.type === 'repos' ? 'bg-purple-500' : 'bg-green-500'
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
              placeholder="Buscar..."
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

        {/* Theme list */}
        <div className="space-y-2">
          {filteredThemes.map(theme => {
            const questionCount = theme.questions?.length || 0;
            const estimated = themeEstimates[theme.number] || null;
            const coveragePct = estimated ? Math.min(100, Math.round((questionCount / estimated) * 100)) : null;
            const progressPercent = estimated
              ? Math.min((questionCount / estimated) * 100, 100)
              : Math.min((questionCount / 50) * 100, 100);
            const hasDocuments = theme.documents?.length > 0;
            const isEditing = editingThemeNumber === theme.number;
            const isSelected = selectedNumbers.has(theme.number);
            const isRepoCleanSelected = repoCleanSelected.has(theme.number);
            const isDefaultName = theme.name === `Tema ${theme.number}`;

            return (
              <div
                key={theme.number}
                onClick={() => {
                  if (selectionMode) {
                    setSelectedNumbers(prev => {
                      const next = new Set(prev);
                      if (next.has(theme.number)) next.delete(theme.number);
                      else next.add(theme.number);
                      return next;
                    });
                  } else if (repoCleanMode) {
                    if (hasDocuments) toggleRepoClean(theme.number);
                  } else if (!isEditing) {
                    setSelectedTheme(theme);
                  }
                }}
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
                        onChange={(e) => toggleSelection(e, theme.number)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-4 h-4 accent-blue-500 cursor-pointer" />
                    </div>
                  )}
                  {repoCleanMode && (
                    <div className="pt-0.5 shrink-0">
                      <input type="checkbox" checked={isRepoCleanSelected}
                        disabled={!hasDocuments}
                        onChange={() => hasDocuments && toggleRepoClean(theme.number)}
                        onClick={(e) => e.stopPropagation()}
                        className={`w-4 h-4 cursor-pointer ${hasDocuments ? 'accent-red-500' : 'opacity-30'}`} />
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <h3 className={`font-semibold text-sm sm:text-base ${dm ? 'text-white' : 'text-slate-800'}`}>
                      Tema {theme.number}
                    </h3>
                    {isEditing ? (
                      <input
                        autoFocus
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveName(theme, editingName);
                          if (e.key === 'Escape') setEditingThemeNumber(null);
                          e.stopPropagation();
                        }}
                        onBlur={() => handleSaveName(theme, editingName)}
                        onClick={(e) => e.stopPropagation()}
                        className={`w-full mt-1 text-xs sm:text-sm rounded-lg px-2 py-1 border border-blue-500/50 outline-none ${
                          dm ? 'bg-white/10 text-white' : 'bg-blue-50 text-slate-800'
                        }`}
                      />
                    ) : (
                      <p className={`text-xs sm:text-sm mt-1 line-clamp-1 ${dm ? 'text-gray-300' : 'text-slate-600'}`}>
                        {theme.name}
                      </p>
                    )}
                  </div>

                  <div className="flex items-start gap-1 shrink-0">
                    {/* Botón ⚡ generar repositorio rápido — visible si tiene nombre y sin docs */}
                    {!selectionMode && !isEditing && !isDefaultName && !hasDocuments && (
                      <button
                        onClick={(e) => { e.stopPropagation(); createRepoInline(theme); }}
                        disabled={generatingRepos[theme.number] === 'loading'}
                        title="Generar repositorio IA con el nombre del tema"
                        className={`p-1 rounded text-base leading-none transition-colors ${
                          generatingRepos[theme.number] === 'loading'
                            ? 'text-purple-400 cursor-wait'
                            : generatingRepos[theme.number] === 'done'
                              ? 'text-green-400'
                              : dm ? 'text-gray-600 hover:text-purple-400' : 'text-slate-300 hover:text-purple-500'
                        }`}
                      >
                        {generatingRepos[theme.number] === 'loading'
                          ? <span className="inline-block w-3.5 h-3.5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                          : generatingRepos[theme.number] === 'done' ? '✓' : '⚡'}
                      </button>
                    )}
                    {/* Botón 📝 generar preguntas rápido — visible si tiene docs */}
                    {!selectionMode && !isEditing && hasDocuments && (
                      <button
                        onClick={(e) => { e.stopPropagation(); generateQuestionsInline(theme); }}
                        disabled={generatingQuestions[theme.number] === 'loading'}
                        title="Generar preguntas con IA para este tema"
                        className={`p-1 rounded text-base leading-none transition-colors ${
                          generatingQuestions[theme.number] === 'loading'
                            ? 'text-green-400 cursor-wait'
                            : generatingQuestions[theme.number] === 'done'
                              ? 'text-green-400'
                              : dm ? 'text-gray-600 hover:text-green-400' : 'text-slate-300 hover:text-green-600'
                        }`}
                      >
                        {generatingQuestions[theme.number] === 'loading'
                          ? <span className="inline-block w-3.5 h-3.5 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
                          : generatingQuestions[theme.number] === 'done' ? '✓' : '📝'}
                      </button>
                    )}
                    {!selectionMode && !isEditing && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingThemeNumber(theme.number);
                          setEditingName(theme.name);
                        }}
                        title="Renombrar tema"
                        className={`p-1 rounded text-base leading-none transition-colors ${
                          dm ? 'text-gray-600 hover:text-blue-400' : 'text-slate-300 hover:text-blue-500'
                        }`}
                      >
                        ✏
                      </button>
                    )}
                    {!selectionMode && !isEditing && !isDefaultName && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleResetName(theme);
                        }}
                        title="Resetear a nombre por defecto"
                        className={`p-1 rounded text-sm leading-none transition-colors ${
                          dm ? 'text-gray-600 hover:text-red-400' : 'text-slate-300 hover:text-red-500'
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
          })}
        </div>

        {selectedTheme && (
          <ThemeDetailModal
            key={`theme-${selectedTheme.number}-${selectedTheme.documents?.length || 0}-${selectedTheme.questions?.length || 0}`}
            theme={selectedTheme}
            onClose={() => setSelectedTheme(null)}
            onUpdate={handleUpdateTheme}
            showToast={showToast}
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
          title="¿Borrar repositorios seleccionados?"
          message={`Se eliminarán los documentos de ${repoCleanSelected.size} tema${repoCleanSelected.size !== 1 ? 's' : ''}. Después podrás regenerarlos con ⚡ Repos.`}
          confirmLabel="Sí, borrar"
          danger
          onConfirm={confirmRepoClean}
          onCancel={() => setRepoCleanConfirm(false)}
        />
        <ConfirmDialog
          show={generateReposConfirm}
          title="¿Generar repositorios para todos los temas?"
          message={`Se generará un repositorio IA para cada tema con nombre personalizado que aún no tenga documentos. Este proceso puede tardar varios minutos.`}
          confirmLabel="Sí, generar"
          onConfirm={() => { setGenerateReposConfirm(false); handleGenerateAll(); }}
          onCancel={() => setGenerateReposConfirm(false)}
        />
        <ConfirmDialog
          show={generateQuestionsConfirm}
          title="¿Generar preguntas para todos los temas?"
          message={`Se generarán preguntas tipo test para cada tema que tenga repositorio. Este proceso puede tardar varios minutos.`}
          confirmLabel="Sí, generar"
          onConfirm={() => { setGenerateQuestionsConfirm(false); handleGenerateAllQuestions(); }}
          onCancel={() => setGenerateQuestionsConfirm(false)}
        />

        {/* ─── Share Modal (admin) ─────────────────────────────── */}
        {shareModal && (
          <div className="fixed inset-0 z-50 flex items-end justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-sm bg-[#0F172A] border border-white/10 rounded-3xl p-6 space-y-4">

              {shareModal.loading && (
                <div className="flex justify-center py-6">
                  <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </div>
              )}

              {shareModal.published && (
                <>
                  <h3 className="font-bold text-lg text-white">Plan ya publicado ✅</h3>
                  <p className="text-gray-400 text-sm">
                    Este test está publicado con el slug <code className="text-green-400 bg-white/5 px-1.5 rounded">{shareModal.slug}</code>.
                  </p>
                  <div className="bg-white/5 rounded-xl px-3 py-2 text-xs text-gray-400 break-all">
                    {window.location.origin}/?join={shareModal.slug}
                  </div>
                  <button
                    onClick={() => copyShareLink(shareModal.slug)}
                    className="w-full py-3 rounded-2xl bg-blue-600 text-white font-semibold"
                  >
                    🔗 Copiar enlace
                  </button>
                  <button onClick={() => setShareModal(null)} className="w-full py-2 text-gray-500 text-sm">
                    Cerrar
                  </button>
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

                  <div>
                    <label className="text-xs text-gray-400 mb-2 block">Icono</label>
                    <div className="flex gap-2">
                      {COVER_EMOJIS.map(emoji => (
                        <button
                          key={emoji}
                          onClick={() => setShareForm(f => ({ ...f, cover_emoji: emoji }))}
                          className={`w-10 h-10 rounded-xl text-xl flex items-center justify-center transition-colors ${
                            shareForm.cover_emoji === emoji ? 'bg-blue-600/40 ring-2 ring-blue-500' : 'bg-white/5 hover:bg-white/10'
                          }`}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>

                  {shareError && <p className="text-red-400 text-xs">{shareError}</p>}

                  <div className="flex gap-3">
                    <button
                      onClick={() => { setShareModal(null); setShareError(''); }}
                      className="flex-1 py-3 rounded-xl bg-white/5 text-gray-400 text-sm font-medium"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handlePublishFromThemes}
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
        )}

        </div>
      </div>
    </div>
  );
}

export default ThemesScreen;
