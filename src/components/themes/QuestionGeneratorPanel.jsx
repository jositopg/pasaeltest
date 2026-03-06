import React from 'react';
import Icons from '../common/Icons';

/**
 * Panel de generación de preguntas con IA: botón, barra de progreso, botón manual.
 */
export default function QuestionGeneratorPanel({
  isGenerating,
  progress,
  percent,
  hasDocuments,
  onGenerate,
  onToggleManual,
  showManual,
}) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-lg p-4 mb-4">
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={onGenerate}
          disabled={isGenerating || !hasDocuments}
          className="bg-green-500 text-white px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50 flex items-center gap-2"
        >
          {isGenerating ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              {percent}%
            </>
          ) : '⚡ Generar 25 Preguntas con IA'}
        </button>

        <button
          onClick={onToggleManual}
          className="bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-semibold"
        >
          <Icons.Plus /> Manual
        </button>
      </div>

      {isGenerating && (
        <div className="mt-3 space-y-2">
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
            <p className="text-blue-400 text-sm">{progress}</p>
          </div>
          <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-green-500 to-blue-500 transition-all duration-500"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
