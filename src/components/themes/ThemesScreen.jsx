import React, { useState, useEffect, useRef } from 'react';
import Icons from '../common/Icons';
import ThemeDetailModal from './ThemeDetailModal';
import { GRADIENT_BG } from '../../utils/constants';
import { OPTIMIZED_AUTO_GENERATE_PROMPT } from '../../utils/optimizedPrompts';

function ThemesScreen({ themes, tests = [], activeTestId, onUpdateTheme, onCreateTest, onSwitchTest, onRenameTest, onDeleteTest, onNavigate, showToast, darkMode }) {
  const dm = darkMode;
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTheme, setSelectedTheme] = useState(null);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [importedThemesPanel, setImportedThemesPanel] = useState(null);
  // null | Array<{ number, name, status: 'idle'|'loading'|'done'|'error' }>
  const [editingThemeNumber, setEditingThemeNumber] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedNumbers, setSelectedNumbers] = useState(new Set());
  const [showTestSwitcher, setShowTestSwitcher] = useState(false);
  const [renamingTestId, setRenamingTestId] = useState(null);
  const [renamingTestName, setRenamingTestName] = useState('');
  const [showNewTestInput, setShowNewTestInput] = useState(false);
  const [newTestName, setNewTestName] = useState('');
  const [deletingTestId, setDeletingTestId] = useState(null);

  const handleUpdateTheme = (updatedTheme) => {
    onUpdateTheme(updatedTheme);
    setSelectedTheme(updatedTheme);
  };

  // Sincronizar selectedTheme con themes global (para que los IDs reales de Supabase
  // sustituyan los IDs temporales tras las operaciones async de DB)
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

  const handleBulkImport = () => {
    const lines = bulkText.trim().split('\n');
    const updates = [];

    lines.forEach(line => {
      const match = line.match(/(?:Tema\s*)?(\d+)[\s.:,|]+(.+)/i);
      if (match) {
        const number = parseInt(match[1]);
        const name = match[2].trim();
        const theme = themes.find(t => t.number === number);
        if (theme) {
          updates.push({ ...theme, name });
        }
      }
    });

    updates.forEach(theme => onUpdateTheme(theme));
    setShowBulkImport(false);
    setBulkText('');

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
        body: JSON.stringify({
          prompt: OPTIMIZED_AUTO_GENERATE_PROMPT(themeEntry.name),
          maxTokens: 4000
        })
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
                  {/* Checkbox en modo selección */}
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

                  {/* Info del tema */}
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

                  {/* Botones edición + badges */}
                  <div className="flex items-start gap-1 shrink-0">
                    {/* Botón editar nombre */}
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
                    {/* Botón reset nombre — solo visible cuando tiene nombre personalizado */}
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
                    {/* Badges */}
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

                {/* Progress bar */}
                <div className={`w-full h-1.5 rounded-full overflow-hidden ${dm ? 'bg-white/10' : 'bg-slate-100'}`}>
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      progressPercent >= 50 ? 'bg-gradient-to-r from-green-500 to-green-400' :
                      progressPercent >= 25 ? 'bg-gradient-to-r from-yellow-500 to-yellow-400' :
                      progressPercent > 0 ? 'bg-gradient-to-r from-orange-500 to-orange-400' :
                      dm ? 'bg-gray-600' : 'bg-slate-200'
                    }`}
                    style={{ width: `${progressPercent}%` }}
                  ></div>
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

        {/* Bulk import modal */}
        {showBulkImport && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className={`border rounded-3xl w-full max-w-3xl max-h-[85vh] overflow-y-auto ${
              dm ? 'bg-slate-800 border-white/10' : 'bg-white border-slate-200'
            }`}>
              <div className={`sticky top-0 p-6 border-b flex items-center justify-between ${
                dm ? 'bg-slate-800 border-white/10' : 'bg-white border-slate-200'
              }`}>
                <div>
                  <h2 className={`font-bold text-xl ${dm ? 'text-white' : 'text-slate-800'}`}>Importar Nombres de Temas</h2>
                  <p className={`text-sm mt-1 ${dm ? 'text-gray-400' : 'text-slate-500'}`}>Pega la lista completa de tus temas</p>
                </div>
                <button
                  onClick={() => setShowBulkImport(false)}
                  className={`p-2 rounded-xl ${dm ? 'bg-white/5 hover:bg-white/10 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'}`}
                >
                  <Icons.X />
                </button>
              </div>

              <div className="p-6 space-y-4">
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
                    className={`w-full rounded-xl px-4 py-3 font-mono text-sm min-h-[300px] resize-vertical ${
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
                    onClick={() => {
                      setShowBulkImport(false);
                      setBulkText('');
                    }}
                    className={`flex-1 font-semibold py-3 rounded-xl ${
                      dm ? 'bg-white/5 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleBulkImport}
                    disabled={!bulkText.trim()}
                    className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 rounded-xl disabled:opacity-50 transition-colors"
                  >
                    Importar Nombres
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Test Switcher */}
        {showTestSwitcher && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-800 border border-white/10 rounded-2xl w-full max-w-sm max-h-[80vh] flex flex-col">
              {/* Header */}
              <div className="p-4 border-b border-white/10 flex items-center justify-between shrink-0">
                <h3 className="text-white font-bold">Mis Tests</h3>
                <button
                  onClick={() => { setShowTestSwitcher(false); setShowNewTestInput(false); setRenamingTestId(null); setDeletingTestId(null); }}
                  className="bg-white/5 hover:bg-white/10 p-2 rounded-xl transition-colors text-white"
                >
                  <Icons.X />
                </button>
              </div>

              {/* Lista de tests */}
              <div className="overflow-y-auto flex-1 p-4 space-y-2">
                {tests.map(t => (
                  <div key={t.id} className={`rounded-xl px-3 py-2.5 ${t.id === activeTestId ? 'bg-blue-500/20 border border-blue-500/40' : 'bg-white/5 border border-white/10'}`}>
                    {renamingTestId === t.id ? (
                      <input
                        autoFocus
                        value={renamingTestName}
                        onChange={(e) => setRenamingTestName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && renamingTestName.trim()) {
                            onRenameTest(t.id, renamingTestName.trim());
                            setRenamingTestId(null);
                          }
                          if (e.key === 'Escape') setRenamingTestId(null);
                        }}
                        onBlur={() => {
                          if (renamingTestName.trim()) onRenameTest(t.id, renamingTestName.trim());
                          setRenamingTestId(null);
                        }}
                        className="w-full bg-white/10 text-white text-sm rounded-lg px-2 py-1 border border-blue-500/50 outline-none"
                      />
                    ) : deletingTestId === t.id ? (
                      <div className="space-y-2">
                        <p className="text-white text-xs">¿Eliminar este test? Se borrarán todos sus temas y preguntas.</p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => { onDeleteTest(t.id); setDeletingTestId(null); setShowTestSwitcher(false); }}
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
                          onClick={() => { onSwitchTest(t.id); setShowTestSwitcher(false); }}
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
                          onCreateTest(newTestName.trim());
                          setNewTestName('');
                          setShowNewTestInput(false);
                          setShowTestSwitcher(false);
                        }
                        if (e.key === 'Escape') { setShowNewTestInput(false); setNewTestName(''); }
                      }}
                      placeholder="Nombre del test..."
                      className="flex-1 bg-white/5 text-white text-sm rounded-xl px-3 py-2 border border-white/10 outline-none focus:border-blue-500/50"
                    />
                    <button
                      onClick={() => {
                        if (newTestName.trim()) {
                          onCreateTest(newTestName.trim());
                          setNewTestName('');
                          setShowNewTestInput(false);
                          setShowTestSwitcher(false);
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
        )}

        {/* Panel post-import: crear repositorios IA por tema */}
        {importedThemesPanel && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-800 border border-white/10 rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col">
              {/* Header */}
              <div className="p-4 border-b border-white/10 flex items-center justify-between shrink-0">
                <div>
                  <h3 className="text-white font-bold">Temas importados</h3>
                  <p className="text-gray-400 text-xs mt-0.5">
                    Crea el repositorio IA para cada tema que quieras
                  </p>
                </div>
                <button
                  onClick={() => setImportedThemesPanel(null)}
                  className="bg-white/5 hover:bg-white/10 p-2 rounded-xl transition-colors text-white"
                >
                  <Icons.X />
                </button>
              </div>

              {/* Lista */}
              <div className="overflow-y-auto flex-1 p-4 space-y-2">
                {importedThemesPanel.map(t => (
                  <div key={t.number} className="flex items-center gap-3 bg-white/5 rounded-xl px-3 py-2.5">
                    <span className="text-gray-400 text-xs w-8 shrink-0">#{t.number}</span>
                    <span className="text-white text-sm flex-1 truncate">{t.name}</span>
                    {t.status === 'idle' && (
                      <button
                        onClick={() => createRepoForTheme(t.number)}
                        className="shrink-0 bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                      >
                        🤖 Crear
                      </button>
                    )}
                    {t.status === 'loading' && (
                      <div className="shrink-0 w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                    )}
                    {t.status === 'done' && (
                      <span className="shrink-0 text-green-400 text-xs font-semibold">✓ Listo</span>
                    )}
                    {t.status === 'error' && (
                      <button
                        onClick={() => createRepoForTheme(t.number)}
                        className="shrink-0 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 text-xs px-3 py-1.5 rounded-lg transition-colors"
                      >
                        ↻ Reintentar
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-white/10 shrink-0">
                <p className="text-gray-500 text-xs text-center">
                  {importedThemesPanel.filter(t => t.status === 'done').length}/{importedThemesPanel.length} repositorios creados
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


export default ThemesScreen;
