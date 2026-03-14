import React from 'react';
import { useTheme } from '../../context/ThemeContext';

/**
 * Skeleton — bloque animado genérico (shimmer pulse).
 * Props: className (Tailwind), rounded (default 'rounded-lg')
 */
export function Skeleton({ className = '', rounded = 'rounded-lg', style }) {
  const { dm } = useTheme();
  return (
    <div
      style={style}
      className={`animate-pulse ${rounded} ${
        dm ? 'bg-white/[0.08]' : 'bg-slate-200'
      } ${className}`}
    />
  );
}

/**
 * ThemesScreenSkeleton — filas de temas mientras carga userData
 */
export function ThemesScreenSkeleton() {
  const { dm, cx } = useTheme();
  const rows = Array.from({ length: 7 });

  return (
    <div className="space-y-2">
      {rows.map((_, i) => (
        <div
          key={i}
          className={`rounded-2xl p-4 ${
            dm
              ? 'bg-white/5 border border-white/8'
              : 'bg-white border border-slate-200 shadow-sm'
          }`}
        >
          <div className="flex items-center gap-3">
            {/* Badge número */}
            <Skeleton className="w-10 h-10 shrink-0" rounded="rounded-xl" />

            {/* Nombre + barra progreso */}
            <div className="flex-1 min-w-0 space-y-2">
              <Skeleton
                className="h-3.5"
                rounded="rounded-md"
                style={{ width: `${55 + (i % 3) * 15}%` }}
              />
              <Skeleton className="h-1.5 w-full" rounded="rounded-full" />
            </div>

            {/* Count + chevron */}
            <div className="flex items-center gap-2 shrink-0">
              <Skeleton className="w-8 h-5" rounded="rounded-lg" />
              <Skeleton className="w-4 h-4" rounded="rounded" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * QuestionsScreenSkeleton — tarjetas de preguntas mientras carga userData
 */
export function QuestionsScreenSkeleton() {
  const { dm } = useTheme();
  const cards = Array.from({ length: 5 });

  return (
    <div className="space-y-2">
      {cards.map((_, i) => (
        <div
          key={i}
          className={`rounded-xl p-4 ${
            dm
              ? 'bg-white/5 border border-white/8'
              : 'bg-white border border-slate-200 shadow-sm'
          }`}
        >
          {/* Badges row */}
          <div className="flex gap-2 mb-3">
            <Skeleton className="h-5 w-14" rounded="rounded-lg" />
            <Skeleton className="h-5 w-24" rounded="rounded-lg" />
            <Skeleton className="h-5 w-12" rounded="rounded-lg" />
          </div>

          {/* Pregunta — 2 líneas */}
          <Skeleton className="h-3.5 w-full mb-1.5" rounded="rounded-md" />
          <Skeleton
            className="h-3.5 mb-4"
            rounded="rounded-md"
            style={{ width: `${60 + (i % 3) * 12}%` }}
          />

          {/* Opciones — 4 líneas */}
          <div className="space-y-1.5">
            {[75, 60, 85, 50].map((w, j) => (
              <Skeleton
                key={j}
                className="h-3"
                rounded="rounded"
                style={{ width: `${w}%` }}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * FilterBarSkeleton — barra de filtros de QuestionsScreen
 */
export function FilterBarSkeleton() {
  const { dm } = useTheme();
  return (
    <div className={`rounded-2xl p-4 space-y-3 ${
      dm ? 'bg-white/5 border border-white/8' : 'bg-white shadow-sm border border-slate-200'
    }`}>
      <Skeleton className="h-10 w-full" rounded="rounded-xl" />
      <div className="flex gap-2">
        <Skeleton className="h-9 flex-1" rounded="rounded-xl" />
        <Skeleton className="h-9 w-28" rounded="rounded-xl" />
      </div>
    </div>
  );
}
