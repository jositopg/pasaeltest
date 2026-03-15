import React, { useState, useEffect, useRef } from 'react';

/**
 * GenerationBanner — floating pill above BottomNav during bulk generation.
 *
 * States:
 *  - in-progress: spinner + phase label + current theme + gradient progress bar
 *  - done-ok:     green pill, auto-dismisses after 5s
 *  - done-errors: amber pill, persists until dismissed, expandable error list
 */
export default function GenerationBanner({ progress }) {
  const [errorsExpanded, setErrorsExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const prevJobKey = useRef(null);

  // Reset dismissed whenever a new job starts (new type+total combination)
  useEffect(() => {
    if (!progress) { prevJobKey.current = null; return; }
    const jobKey = `${progress.type}-${progress.total}`;
    if (jobKey !== prevJobKey.current) {
      prevJobKey.current = jobKey;
      setDismissed(false);
      setErrorsExpanded(false);
    }
  }, [progress?.type, progress?.total]);

  if (!progress || dismissed) return null;

  const isDone = progress.done >= progress.total && !progress.currentName;
  const pct = progress.total > 0 ? (progress.done / progress.total) * 100 : 0;
  const errorCount = progress.errors?.length || 0;
  const successCount = progress.done - errorCount;

  const isRepos = progress.type === 'repos';
  const typeLabel = isRepos ? 'Repositorios IA' : 'Preguntas test';
  const typeIcon  = isRepos ? '⚡' : '📝';
  const doneNoun  = isRepos ? (successCount === 1 ? 'repositorio' : 'repositorios')
                            : (successCount === 1 ? 'pregunta' : 'preguntas');

  // ── DONE — success ────────────────────────────────────────────
  if (isDone && errorCount === 0) {
    return (
      <div
        className="fixed left-1/2 z-50 w-full max-w-sm px-4 pointer-events-none"
        style={{
          bottom: 'calc(72px + env(safe-area-inset-bottom, 0px) + 10px)',
          animation: 'slideUp 0.3s ease forwards',
        }}
      >
        <div className="rounded-2xl px-5 py-3.5 shadow-2xl bg-emerald-600 border border-emerald-500/40 flex items-center gap-3">
          <span className="text-2xl">✅</span>
          <div>
            <p className="text-white font-bold text-sm leading-tight">
              ¡{successCount} {doneNoun} generados!
            </p>
            <p className="text-emerald-200 text-xs mt-0.5">Generación completada</p>
          </div>
        </div>
      </div>
    );
  }

  // ── DONE — with errors ────────────────────────────────────────
  if (isDone && errorCount > 0) {
    return (
      <div
        className="fixed left-1/2 z-50 w-full max-w-sm px-4 pointer-events-auto"
        style={{
          bottom: 'calc(72px + env(safe-area-inset-bottom, 0px) + 10px)',
          animation: 'slideUp 0.3s ease forwards',
        }}
      >
        <div className="rounded-2xl shadow-2xl bg-amber-700 border border-amber-600/40 overflow-hidden">
          <div className="px-5 py-3.5 flex items-start gap-3">
            <span className="text-xl mt-0.5">⚠️</span>
            <div className="flex-1 min-w-0">
              <p className="text-white font-bold text-sm">
                {successCount}/{progress.total} {doneNoun} completados
              </p>
              <p className="text-amber-200 text-xs mt-0.5">{errorCount} tema{errorCount !== 1 ? 's' : ''} con error</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setErrorsExpanded(v => !v)}
                className="text-amber-200 hover:text-white text-xs underline"
              >
                {errorsExpanded ? 'Ocultar' : 'Ver'}
              </button>
              <button
                onClick={() => setDismissed(true)}
                className="text-amber-300 hover:text-white text-lg leading-none"
              >
                ✕
              </button>
            </div>
          </div>

          {errorsExpanded && progress.errors?.length > 0 && (
            <div className="px-4 pb-4 space-y-1 border-t border-amber-600/40 pt-3">
              {progress.errors.slice(0, 5).map((err, i) => (
                <p key={i} className="text-xs text-amber-200 truncate">
                  <span className="text-amber-400 font-semibold">✗</span> {err.name}: {err.reason}
                </p>
              ))}
              {progress.errors.length > 5 && (
                <p className="text-xs text-amber-300">+{progress.errors.length - 5} más…</p>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── IN PROGRESS ───────────────────────────────────────────────
  return (
    <div
      className="fixed left-1/2 z-50 w-full max-w-sm px-4 pointer-events-none"
      style={{
        bottom: 'calc(72px + env(safe-area-inset-bottom, 0px) + 10px)',
        animation: 'slideUp 0.3s ease forwards',
      }}
    >
      <div className="rounded-2xl px-5 py-4 shadow-2xl bg-[#0F172A] border border-white/10">

        {/* Top row: phase label + counter */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full border-2 border-blue-400/40 border-t-blue-400 animate-spin shrink-0" />
            <span className="text-white text-sm font-bold">{typeIcon} {typeLabel}</span>
          </div>
          <span className="text-blue-300 text-sm font-bold tabular-nums">
            {progress.done}<span className="text-white/30">/</span>{progress.total}
          </span>
        </div>

        {/* Current theme pill */}
        {progress.currentName && (
          <div className="mb-3 flex items-center gap-1.5">
            <span className="text-white/40 text-xs">▶</span>
            <span className="text-white/70 text-xs truncate">{progress.currentName}</span>
          </div>
        )}

        {/* Progress bar — gradient + shimmer */}
        <div className="h-2.5 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full relative overflow-hidden transition-all duration-700"
            style={{
              width: `${Math.max(pct, 3)}%`,
              background: 'linear-gradient(90deg, #3B82F6, #8B5CF6)',
            }}
          >
            {/* shimmer sweep */}
            <div
              className="absolute inset-y-0 w-1/3"
              style={{
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)',
                animation: 'shimmer 1.6s ease-in-out infinite',
              }}
            />
          </div>
        </div>

        {/* Error count inline */}
        {errorCount > 0 && (
          <p className="text-amber-300 text-xs mt-2">
            ⚠️ {errorCount} tema{errorCount !== 1 ? 's' : ''} con error
          </p>
        )}
      </div>
    </div>
  );
}
