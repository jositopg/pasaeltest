import React from 'react';
import Icons from '../common/Icons';

/**
 * Panel de generación de preguntas con IA: botón, progreso, cobertura estimada.
 */
export default function QuestionGeneratorPanel({
  isGenerating,
  progress,
  percent,
  hasDocuments,
  estimatedTotal,
  currentCount,
  coveragePercent,
  onGenerate,
  onToggleManual,
  showManual,
}) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-lg p-4 mb-4">
      <div className="flex gap-2 flex-wrap items-center">
        <button
          onClick={onGenerate}
          disabled={isGenerating || !hasDocuments}
          className="bg-green-500 text-white px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50 flex items-center gap-2"
          title={estimatedTotal ? `Genera 40 preguntas (objetivo: ${estimatedTotal} para cobertura completa)` : 'Genera 40 preguntas con IA'}
        >
          {isGenerating ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              {percent}%
            </>
          ) : '⚡ Generar 40 preguntas'}
        </button>

        <button
          onClick={onToggleManual}
          className="bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-semibold"
        >
          <Icons.Plus /> Manual
        </button>

        {estimatedTotal && !isGenerating && (
          <span className={`text-xs font-medium px-2 py-1 rounded-lg ${
            coveragePercent >= 80 ? 'bg-green-500/20 text-green-400' :
            coveragePercent >= 50 ? 'bg-yellow-500/20 text-yellow-400' :
            'bg-white/5 text-gray-400'
          }`}>
            {currentCount}/{estimatedTotal} ({coveragePercent}%)
          </span>
        )}
      </div>

      {!hasDocuments && (
        <p className="text-xs text-gray-500 mt-2">Añade documentos al tema para activar la generación con IA.</p>
      )}

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
