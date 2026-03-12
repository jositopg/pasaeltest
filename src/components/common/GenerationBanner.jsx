import React from 'react';

/**
 * Floating banner shown above BottomNav during bulk generation (any screen).
 */
export default function GenerationBanner({ progress }) {
  if (!progress) return null;

  const isDone = progress.done >= progress.total && !progress.currentName;
  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
  const icon = progress.type === 'repos' ? '⚡' : '📝';
  const label = progress.type === 'repos' ? 'materiales' : 'preguntas';
  const errorCount = progress.errors?.length || 0;

  return (
    <div className="fixed left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4 pointer-events-none"
      style={{ bottom: 'calc(72px + env(safe-area-inset-bottom, 0px) + 8px)' }}>
      <div className={`rounded-2xl px-4 py-3 shadow-2xl border transition-all duration-300 ${
        isDone
          ? errorCount > 0 ? 'bg-amber-700 border-amber-600/50' : 'bg-emerald-600 border-emerald-500/50'
          : 'bg-[#1E293B] border-white/10'
      }`}>
        <div className="flex items-center gap-2">
          {!isDone && (
            <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-semibold">
              {icon} {isDone
                ? errorCount > 0
                  ? `${progress.done - errorCount}/${progress.total} ${label} — ${errorCount} fallaron`
                  : `¡${progress.total} ${label} completados!`
                : `Generando ${label}: ${progress.done}/${progress.total}`
              }
            </p>
            {!isDone && progress.currentName && (
              <p className="text-white/60 text-xs truncate mt-0.5">{progress.currentName}</p>
            )}
          </div>
        </div>
        {!isDone && (
          <div className="mt-2 h-1 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-blue-400 transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
