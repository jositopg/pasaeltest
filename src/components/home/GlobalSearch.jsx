import React, { useState, useMemo, useRef, useEffect } from 'react';
import Icons from '../common/Icons';
import { useTheme } from '../../context/ThemeContext';

function highlight(text, query) {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-yellow-400/30 text-inherit rounded px-0.5">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

export default function GlobalSearch({ themes = [], onClose, onNavigate }) {
  const { dm, cx } = useTheme();
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Close on Escape
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || q.length < 2) return null;

    const themeResults = [];
    const questionResults = [];

    for (const theme of themes) {
      // Theme name match
      if (theme.name?.toLowerCase().includes(q)) {
        themeResults.push({ type: 'theme', theme, label: theme.name });
      }

      // Document name matches
      for (const doc of theme.documents || []) {
        const docName = doc.fileName || doc.title || (doc.type === 'ai-search' ? 'Búsqueda IA' : doc.type === 'url' ? 'Enlace web' : 'Documento');
        if (docName.toLowerCase().includes(q)) {
          themeResults.push({ type: 'doc', theme, label: docName });
        }
      }

      // Question text matches
      for (const question of theme.questions || []) {
        if (question.text?.toLowerCase().includes(q)) {
          questionResults.push({ type: 'question', theme, question });
        }
        if (questionResults.length >= 30) break;
      }
      if (questionResults.length >= 30) break;
    }

    return { themes: themeResults.slice(0, 10), questions: questionResults.slice(0, 20) };
  }, [query, themes]);

  const total = results ? results.themes.length + results.questions.length : 0;

  const handleThemeResult = () => {
    onClose();
    onNavigate('themes');
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col"
      style={{ background: dm ? 'rgba(2,8,23,0.97)' : 'rgba(248,250,252,0.97)', backdropFilter: 'blur(8px)' }}
    >
      {/* Search bar */}
      <div className={`flex-shrink-0 px-4 py-3 border-b ${dm ? 'border-white/10' : 'border-slate-200'}`}
        style={{ paddingTop: 'calc(var(--pt-header, 16px) + 4px)' }}>
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <div className={`flex-1 flex items-center gap-3 rounded-2xl px-4 py-3 ${dm ? 'bg-white/8 border border-white/10' : 'bg-white border border-slate-200 shadow-sm'}`}>
            <span className={`flex-shrink-0 ${dm ? 'text-slate-400' : 'text-slate-400'}`}>
              <Icons.Search />
            </span>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Buscar preguntas, temas, documentos..."
              className={`flex-1 bg-transparent outline-none text-sm ${dm ? 'text-slate-100 placeholder-slate-500' : 'text-slate-800 placeholder-slate-400'}`}
            />
            {query && (
              <button onClick={() => setQuery('')} className={`flex-shrink-0 ${dm ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`}>
                <Icons.X />
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            className={`text-sm font-semibold flex-shrink-0 ${dm ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Cancelar
          </button>
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="max-w-lg mx-auto space-y-6">

          {!query || query.trim().length < 2 ? (
            <div className="text-center py-16">
              <span className="text-4xl">🔍</span>
              <p className={`mt-3 text-sm ${cx.muted}`}>Escribe al menos 2 caracteres para buscar</p>
              <p className={`mt-1 text-xs ${cx.muted} opacity-60`}>Busca entre temas, documentos y preguntas</p>
            </div>
          ) : total === 0 ? (
            <div className="text-center py-16">
              <span className="text-4xl">😕</span>
              <p className={`mt-3 text-sm font-semibold ${dm ? 'text-slate-300' : 'text-slate-600'}`}>Sin resultados</p>
              <p className={`mt-1 text-xs ${cx.muted}`}>No se encontró nada para "{query}"</p>
            </div>
          ) : (
            <>
              {/* Temas y documentos */}
              {results.themes.length > 0 && (
                <section>
                  <p className={`text-xs font-bold uppercase tracking-wider mb-2 ${cx.muted}`}>
                    Temas y documentos · {results.themes.length}
                  </p>
                  <div className="space-y-1.5">
                    {results.themes.map((r, i) => (
                      <button
                        key={i}
                        onClick={handleThemeResult}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all active:scale-[0.99] ${
                          dm ? 'bg-white/5 hover:bg-white/10 border border-white/8' : 'bg-white border border-slate-200 hover:border-blue-200 shadow-sm'
                        }`}
                      >
                        <span className="text-lg flex-shrink-0">{r.type === 'doc' ? '📄' : '📚'}</span>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-semibold truncate ${dm ? 'text-slate-100' : 'text-slate-800'}`}>
                            {highlight(r.label, query.trim())}
                          </p>
                          <p className={`text-xs mt-0.5 truncate ${cx.muted}`}>
                            {r.type === 'doc' ? `Documento en ` : ''}Tema {r.theme.number}
                            {r.type === 'doc' && r.theme.name !== `Tema ${r.theme.number}` ? ` · ${r.theme.name}` : ''}
                          </p>
                        </div>
                        <span className={`text-xs flex-shrink-0 ${cx.muted}`}>→</span>
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {/* Preguntas */}
              {results.questions.length > 0 && (
                <section>
                  <p className={`text-xs font-bold uppercase tracking-wider mb-2 ${cx.muted}`}>
                    Preguntas · {results.questions.length}{results.questions.length === 20 ? '+' : ''}
                  </p>
                  <div className="space-y-1.5">
                    {results.questions.map((r, i) => (
                      <button
                        key={i}
                        onClick={handleThemeResult}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all active:scale-[0.99] ${
                          dm ? 'bg-white/5 hover:bg-white/10 border border-white/8' : 'bg-white border border-slate-200 hover:border-blue-200 shadow-sm'
                        }`}
                      >
                        <span className="text-lg flex-shrink-0">❓</span>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm leading-snug line-clamp-2 ${dm ? 'text-slate-200' : 'text-slate-700'}`}>
                            {highlight(r.question.text, query.trim())}
                          </p>
                          <p className={`text-xs mt-1 truncate ${cx.muted}`}>
                            Tema {r.theme.number}{r.theme.name !== `Tema ${r.theme.number}` ? ` · ${r.theme.name}` : ''}
                          </p>
                        </div>
                        <span className={`text-xs flex-shrink-0 ${cx.muted}`}>→</span>
                      </button>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
