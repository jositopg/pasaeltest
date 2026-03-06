import React from 'react';

/**
 * Floating banner shown above BottomNav during bulk generation.
 * Always shown regardless of current screen.
 */
export default function GenerationBanner({ progress }) {
  if (!progress) return null;

  const isDone = progress.done >= progress.total;
  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
  const icon = progress.type === 'repos' ? '⚡' : '📝';
  const label = progress.type === 'repos' ? 'repositorios' : 'preguntas';

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4 pointer-events-none">
      <div className={`rounded-2xl px-4 py-3 shadow-2xl border transition-all duration-300 ${
        isDone
          ? 'bg-emerald-600 border-emerald-500/50'
          : 'bg-[#1E293B] border-white/10'
      }`}>
        <div className="flex items-center gap-3">
          {!isDone && (
            <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin shrink-0" />
          )}
          <p className="text-white text-sm font-semibold flex-1">
            {icon} {isDone
              ? `¡${progress.total} ${label} completados!`
              : `Generando ${label}: ${progress.done}/${progress.total}`
            }
          </p>
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
