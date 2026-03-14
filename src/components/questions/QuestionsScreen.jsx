import React, { useState, useMemo } from 'react';
import Icons from '../common/Icons';
import { useTheme } from '../../context/ThemeContext';
import { QuestionsScreenSkeleton, FilterBarSkeleton } from '../common/Skeleton';

function QuestionsScreen({ themes, onUpdateTheme, onNavigate, showToast, activeTestName, loading = false }) {
  const { dm, cx } = useTheme();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterTheme, setFilterTheme] = useState('all');
  const [filterDifficulty, setFilterDifficulty] = useState('all');
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set()); // "themeNumber:questionId"

  // Todas las preguntas aplanadas con referencia a su tema
  const allQuestions = useMemo(() => {
    const result = [];
    for (const theme of themes) {
      for (const q of (theme.questions || [])) {
        result.push({ ...q, themeNumber: theme.number, themeName: theme.name });
      }
    }
    return result;
  }, [themes]);

  const filtered = useMemo(() => {
    return allQuestions.filter(q => {
      if (filterTheme !== 'all' && q.themeNumber !== parseInt(filterTheme)) return false;
      if (filterDifficulty !== 'all' && q.difficulty !== filterDifficulty) return false;
      if (searchTerm.trim()) {
        const s = searchTerm.toLowerCase();
        if (!q.text.toLowerCase().includes(s) && !q.themeName.toLowerCase().includes(s)) return false;
      }
      return true;
    });
  }, [allQuestions, filterTheme, filterDifficulty, searchTerm]);

  const makeKey = (q) => `${q.themeNumber}:${q.id}`;
  const allSelected = filtered.length > 0 && filtered.every(q => selectedIds.has(makeKey(q)));

  const toggleQuestion = (q) => {
    const key = makeKey(q);
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        filtered.forEach(q => next.delete(makeKey(q)));
        return next;
      });
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev);
        filtered.forEach(q => next.add(makeKey(q)));
        return next;
      });
    }
  };

  const handleDeleteSelected = () => {
    if (selectedIds.size === 0) return;

    // Agrupar por tema
    const byTheme = {};
    for (const key of selectedIds) {
      const [themeNum] = key.split(':');
      if (!byTheme[themeNum]) byTheme[themeNum] = new Set();
      // La key es "themeNumber:questionId" — extraemos el id
      const qid = key.slice(themeNum.length + 1);
      byTheme[themeNum].add(qid);
    }

    for (const theme of themes) {
      const toDelete = byTheme[String(theme.number)];
      if (!toDelete) continue;
      const newQuestions = (theme.questions || []).filter(q => !toDelete.has(q.id));
      onUpdateTheme({ ...theme, questions: newQuestions });
    }

    if (showToast) showToast(`${selectedIds.size} pregunta${selectedIds.size !== 1 ? 's' : ''} eliminada${selectedIds.size !== 1 ? 's' : ''}`, 'success');
    setSelectedIds(new Set());
    setSelectMode(false);
  };

  const difficultyLabel = { facil: 'Fácil', media: 'Media', dificil: 'Difícil' };
  const difficultyColor = {
    facil: 'bg-green-500/20 text-green-400',
    media: 'bg-yellow-500/20 text-yellow-400',
    dificil: 'bg-red-500/20 text-red-400',
    fácil: 'bg-green-500/20 text-green-400',
    difícil: 'bg-red-500/20 text-red-400',
  };

  const inputCls = `rounded-xl px-3 py-2 text-sm outline-none ${dm ? 'bg-white/5 text-white border border-white/10' : 'bg-white text-slate-800 border border-slate-200'}`;

  return (
    <div className={`min-h-full ${cx.screen} transition-colors`}>
      {/* STICKY HEADER */}
      <div className={`sticky top-0 z-10 px-4 pb-3 ${cx.screen}`} style={{ paddingTop: 'var(--pt-header)' }}>
        <div className="max-w-2xl mx-auto space-y-2">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <h1 className={`font-bold text-2xl ${cx.heading}`}>Preguntas</h1>
              <p className={`text-xs ${dm ? 'text-gray-500' : 'text-slate-400'}`}>
                {activeTestName && <span className={`font-semibold ${dm ? 'text-blue-400' : 'text-blue-600'}`}>{activeTestName} · </span>}
                {allQuestions.length} en total · {filtered.length} mostradas
              </p>
            </div>
            <button
              onClick={() => { setSelectMode(!selectMode); setSelectedIds(new Set()); }}
              className={`px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
                selectMode
                  ? 'bg-orange-500 text-white'
                  : cx.btnNav
              }`}
            >
              {selectMode ? 'Cancelar' : '☑ Seleccionar'}
            </button>
          </div>
          {selectMode && (
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={toggleAll}
                className={`px-3 py-2 rounded-xl text-xs font-semibold ${dm ? 'bg-white/5 text-gray-300 hover:bg-white/10' : 'bg-white text-slate-600 border border-slate-200'}`}
              >
                {allSelected ? 'Deseleccionar todo' : 'Seleccionar todo'}
              </button>
              <button
                onClick={handleDeleteSelected}
                disabled={selectedIds.size === 0}
                className="bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded-xl text-xs font-semibold disabled:opacity-40 transition-colors"
              >
                Borrar ({selectedIds.size})
              </button>
            </div>
          )}
        </div>
      </div>

      {/* SCROLLABLE CONTENT */}
      <div className="px-4 pt-3" style={{ paddingBottom: 'var(--pb-screen)' }}>
        <div className="max-w-2xl mx-auto space-y-4">

        {loading ? (
          <>
            <FilterBarSkeleton />
            <QuestionsScreenSkeleton />
          </>
        ) : (<>

        {/* Buscador */}
        <div className={`rounded-2xl p-4 space-y-3 ${dm ? 'bg-white/5 border border-white/10' : 'bg-white shadow-sm border border-slate-200'}`}>
          <div className="relative">
            <input
              type="text"
              placeholder="Buscar pregunta..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className={`w-full rounded-xl px-4 py-3 pl-10 text-sm outline-none ${
                dm ? 'bg-white/5 text-white border border-white/10 placeholder-gray-500' : 'bg-slate-50 text-slate-800 border border-slate-200 placeholder-slate-400'
              }`}
            />
            <div className={`absolute left-3 top-1/2 -translate-y-1/2 ${dm ? 'text-gray-400' : 'text-slate-400'}`}>
              <Icons.Search />
            </div>
          </div>

          <div className="flex gap-2">
            <select
              value={filterTheme}
              onChange={e => setFilterTheme(e.target.value)}
              className={`flex-1 ${inputCls}`}
            >
              <option value="all">Todos los temas</option>
              {themes.filter(t => t.questions?.length > 0).map(t => (
                <option key={t.number} value={t.number}>
                  Tema {t.number} — {t.name}
                </option>
              ))}
            </select>
            <select
              value={filterDifficulty}
              onChange={e => setFilterDifficulty(e.target.value)}
              className={inputCls}
            >
              <option value="all">Dificultad</option>
              <option value="facil">Fácil</option>
              <option value="media">Media</option>
              <option value="dificil">Difícil</option>
            </select>
          </div>
        </div>

        {/* Lista de preguntas */}
        {filtered.length === 0 ? (
          <div className={`text-center py-16 rounded-2xl ${cx.card}`}>
            <div className="text-4xl mb-3">📭</div>
            <p className={`font-semibold ${dm ? 'text-gray-400' : 'text-slate-500'}`}>
              {allQuestions.length === 0 ? 'Aún no hay preguntas generadas' : 'No hay resultados'}
            </p>
            {allQuestions.length === 0 && (
              <p className={`text-xs mt-1 ${dm ? 'text-gray-600' : 'text-slate-400'}`}>
                Ve a Temas, añade documentos y genera preguntas con IA
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((q) => {
              const key = makeKey(q);
              const isSelected = selectedIds.has(key);
              return (
                <div
                  key={key}
                  onClick={() => selectMode && toggleQuestion(q)}
                  className={`rounded-xl p-4 transition-all ${selectMode ? 'cursor-pointer' : ''} ${
                    dm
                      ? `bg-white/5 border ${isSelected ? 'border-blue-500/50 bg-blue-500/10' : 'border-white/10'}`
                      : `bg-white border shadow-sm ${isSelected ? 'border-blue-400 bg-blue-50' : 'border-slate-200'}`
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {selectMode && (
                      <div className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${
                        isSelected ? 'bg-blue-500 border-blue-500' : dm ? 'border-gray-500' : 'border-slate-300'
                      }`}>
                        {isSelected && <Icons.Check />}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      {/* Badges */}
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className={`text-xs px-2 py-0.5 rounded-lg font-semibold ${dm ? 'bg-white/10 text-gray-300' : 'bg-slate-100 text-slate-600'}`}>
                          Tema {q.themeNumber}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-lg truncate max-w-[160px] ${dm ? 'text-gray-500' : 'text-slate-400'}`}>
                          {q.themeName}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-lg ${difficultyColor[q.difficulty] || 'bg-gray-500/20 text-gray-400'}`}>
                          {difficultyLabel[q.difficulty] || q.difficulty}
                        </span>
                        {q.source && (
                          <span className={`text-xs px-2 py-0.5 rounded-lg ${dm ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-50 text-purple-600'}`}>
                            {q.source}
                          </span>
                        )}
                      </div>

                      {/* Texto pregunta */}
                      <p className={`text-sm font-medium mb-2 ${dm ? 'text-gray-200' : 'text-slate-800'}`}>{q.text}</p>

                      {/* Opciones */}
                      <div className="space-y-1">
                        {q.options?.map((opt, i) => (
                          <div key={i} className={`text-xs px-2 py-1 rounded ${
                            i === q.correct
                              ? 'bg-green-500/10 text-green-400'
                              : dm ? 'text-gray-500' : 'text-slate-400'
                          }`}>
                            {i === q.correct ? '✓ ' : '○ '}{opt}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        </>) /* end loading ternary */}
        </div>
      </div>
    </div>
  );
}

export default QuestionsScreen;
