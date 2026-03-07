import React, { useState, useEffect, useMemo } from 'react';
import Icons from '../common/Icons';
import ThemeDetailModal from './ThemeDetailModal';
import TestSwitcherModal from './TestSwitcherModal';
import BulkImportModal from './BulkImportModal';
import ConfirmDialog from '../common/ConfirmDialog';
import { OPTIMIZED_AUTO_GENERATE_PROMPT } from '../../utils/optimizedPrompts';
import { analyzeDocument } from '../../utils/documentAnalyzer';
import { useTheme } from '../../context/ThemeContext';

function ThemesScreen({
  themes, tests = [], activeTestId,
  onUpdateTheme, onCreateTest, onSwitchTest, onRenameTest, onDeleteTest,
  onNavigate, showToast,
  // Generation queue (lifted to App.jsx so it persists across navigation)
  genQueue = {},
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
        body: JSON.stringify({ prompt: OPTIMIZED_AUTO_GENERATE_PROMPT(themeEntry.name), maxTokens: 4000, callType: 'repo' })
      });

      if (!response.ok) throw new Error(`API error: ${response.status}`);

      const data = await response.json();
      let content = '';
      for (const block of data.content) {
        if (block.type === 'text') content += block.text;
      }
      if (content.trim().length < 50) throw new Error('Contenido insuficiente');

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
    <div className={`min-h-full ${dm ? 'bg-[#080C14]' : 'bg-[#F0F4FF]'} p-4 transition-colors`} style={{ paddingBottom: 'var(--pb-screen)' }}>
      <div className="max-w-2xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate('home')}
            className={`p-2 rounded-xl ${dm ? 'bg-white/5 text-white' : 'bg-white text-slate-700 shadow-sm'}`}
          >
            <Icons.ChevronLeft />
          </button>
          <h1 className={`font-bold text-2xl flex-1 ${dm ? 'text-white' : 'text-slate-800'}`}>Temas</h1>
          {selectionMode ? (
            <div className="flex gap-2">
              <button
                onClick={() => {
                  const allNumbers = filteredThemes.map(t => t.number);
                  const allSelected = allNumbers.every(n => selectedNumbers.has(n));
                  if (allSelected) {
                    setSelectedNumbers(new Set());
                  } else {
                    setSelectedNumbers(new Set(allNumbers));
                  }
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
                  Reset ({selectedNumbers.size})
                </button>
              )}
              <button
                onClick={() => { setSelectionMode(false); setSelectedNumbers(new Set()); }}
                className={`px-3 py-2 rounded-xl text-xs font-semibold ${dm ? 'bg-white/5 text-white' : 'bg-slate-100 text-slate-700'}`}
              >
                Cancelar
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => setSelectionMode(true)}
                className={`p-2 rounded-xl text-sm font-semibold transition-colors ${dm ? 'bg-white/5 text-gray-300 hover:bg-white/10' : 'bg-white text-slate-600 border border-slate-200 shadow-sm hover:bg-slate-50'}`}
                title="Seleccionar temas para editar en masa"
              >
                ☑
              </button>
              <button
                onClick={handleGenerateAll}
                disabled={anyBulkRunning}
                className={`px-3 py-2 rounded-xl text-sm font-semibold transition-colors flex items-center gap-1.5 ${
                  anyBulkRunning
                    ? 'opacity-50 cursor-not-allowed ' + (dm ? 'bg-purple-500/20 text-purple-300' : 'bg-purple-50 text-purple-400')
                    : dm ? 'bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 border border-purple-500/30' : 'bg-purple-50 text-purple-600 border border-purple-200 hover:bg-purple-100'
                }`}
                title="Generar repositorios IA para todos los temas con nombre personalizado sin documentos"
              >
                {generatingAll ? (
                  <div className="w-4 h-4 border-2 border-purple-300 border-t-transparent rounded-full animate-spin" />
                ) : '⚡'}
                <span className="hidden sm:inline">Repos</span>
              </button>
              <button
                onClick={handleGenerateAllQuestions}
                disabled={anyBulkRunning}
                className={`px-3 py-2 rounded-xl text-sm font-semibold transition-colors flex items-center gap-1.5 ${
                  anyBulkRunning
                    ? 'opacity-50 cursor-not-allowed ' + (dm ? 'bg-green-500/20 text-green-300' : 'bg-green-50 text-green-400')
                    : dm ? 'bg-green-500/20 text-green-300 hover:bg-green-500/30 border border-green-500/30' : 'bg-green-50 text-green-600 border border-green-200 hover:bg-green-100'
                }`}
                title="Generar preguntas para todos los temas con repositorio"
              >
                {generatingAllQuestions ? (
                  <div className="w-4 h-4 border-2 border-green-300 border-t-transparent rounded-full animate-spin" />
                ) : '📝'}
                <span className="hidden sm:inline">Preguntas</span>
              </button>
              <button
                onClick={() => setShowBulkImport(true)}
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 transition-colors shadow-sm"
              >
                <Icons.Plus />
                Importar
              </button>
            </div>
          )}
        </div>

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
            {tests.length > 1 && (
              <span className={`text-xs ${dm ? 'text-gray-500' : 'text-slate-400'}`}>
                {tests.length} tests
              </span>
            )}
          </div>
        )}

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
                  } else if (!isEditing) {
                    setSelectedTheme(theme);
                  }
                }}
                className={`rounded-xl p-4 cursor-pointer transition-all active:scale-[0.98] ${
                  dm
                    ? `bg-white/5 border ${isSelected ? 'border-blue-500/50 bg-blue-500/10' : 'border-white/10 hover:bg-white/10'}`
                    : `bg-white border ${isSelected ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:border-blue-300 hover:shadow-md'} shadow-sm`
                }`}
              >
                <div className="flex items-start mb-3 gap-2">
                  {selectionMode && (
                    <div className="pt-0.5 shrink-0">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => toggleSelection(e, theme.number)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-4 h-4 accent-blue-500 cursor-pointer"
                      />
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
      </div>
    </div>
  );
}

export default ThemesScreen;
