import React, { useState, useEffect } from 'react';
import Icons from '../common/Icons';
import ThemeDetailModal from './ThemeDetailModal';
import TestSwitcherModal from './TestSwitcherModal';
import BulkImportModal from './BulkImportModal';
import { OPTIMIZED_AUTO_GENERATE_PROMPT } from '../../utils/optimizedPrompts';
import { useTheme } from '../../context/ThemeContext';

function ThemesScreen({ themes, tests = [], activeTestId, onUpdateTheme, onCreateTest, onSwitchTest, onRenameTest, onDeleteTest, onNavigate, showToast }) {
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
        body: JSON.stringify({ prompt: OPTIMIZED_AUTO_GENERATE_PROMPT(themeEntry.name), maxTokens: 4000 })
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
    <div className={`min-h-full ${dm ? 'bg-[#080C14]' : 'bg-[#F0F4FF]'} p-4 transition-colors`} style={{ paddingBottom: '100px' }}>
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
              {selectedNumbers.size > 0 && (
                <button
                  onClick={handleBulkReset}
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
            const progressPercent = Math.min((questionCount / 50) * 100, 100);
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
                        questionCount >= 50
                          ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400'
                          : questionCount >= 25
                            ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400'
                            : questionCount > 0
                              ? 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400'
                              : dm
                                ? 'bg-gray-500/20 text-gray-400'
                                : 'bg-slate-100 text-slate-600'
                      }`}>
                        {questionCount} pregunta{questionCount !== 1 ? 's' : ''}
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
                      progressPercent >= 50 ? 'bg-gradient-to-r from-green-500 to-green-400' :
                      progressPercent >= 25 ? 'bg-gradient-to-r from-yellow-500 to-yellow-400' :
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
      </div>
    </div>
  );
}

export default ThemesScreen;
