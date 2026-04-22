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
  const hasQuestions = currentCount > 0;
  const coverageColor =
    coveragePercent >= 80 ? 'bg-green-500' :
    coveragePercent >= 50 ? 'bg-yellow-400' :
    'bg-blue-500';
  const coverageLabel =
    coveragePercent >= 80 ? 'text-green-400' :
    coveragePercent >= 50 ? 'text-yellow-400' :
    'text-blue-400';

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-4 space-y-3">
      {/* Botones */}
      <div className="flex gap-2 flex-wrap items-center">
        <button
          onClick={onGenerate}
          disabled={isGenerating}
          className="bg-green-500 hover:bg-green-400 transition-colors text-white px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50 flex items-center gap-2"
        >
          {isGenerating ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              {percent > 0 ? `${percent}%` : '…'}
            </>
          ) : (
            <>⚡ {hasQuestions ? 'Generar más preguntas' : 'Generar preguntas'}</>
          )}
        </button>

        <button
          onClick={onToggleManual}
          className="bg-blue-500 hover:bg-blue-400 transition-colors text-white px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-1"
        >
          <Icons.Plus /> Manual
        </button>
      </div>

      {/* Barra de cobertura — solo con material propio y estimación disponible */}
      {hasDocuments && estimatedTotal && !isGenerating && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">
              {hasQuestions
                ? `${currentCount} pregunta${currentCount !== 1 ? 's' : ''} generada${currentCount !== 1 ? 's' : ''}`
                : 'Sin preguntas aún'}
            </span>
            <span className={`text-xs font-semibold ${coverageLabel}`}>
              {coveragePercent}% del tema cubierto
            </span>
          </div>
          <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
            <div
              className={`h-full ${coverageColor} rounded-full transition-all duration-700`}
              style={{ width: `${coveragePercent}%` }}
            />
          </div>
          {coveragePercent < 100 && (
            <p className="text-xs text-gray-500">
              {coveragePercent === 0
                ? 'Pulsa ⚡ para generar preguntas de todo el material'
                : coveragePercent < 50
                ? 'Pulsa ⚡ de nuevo para cubrir más partes del tema'
                : coveragePercent < 80
                ? 'Casi completo — pulsa ⚡ para cubrir el resto'
                : 'Cobertura alta — puedes seguir generando para mayor variedad'}
            </p>
          )}
          {coveragePercent >= 100 && (
            <p className="text-xs text-green-400">✓ Tema completamente cubierto</p>
          )}
        </div>
      )}

      {/* Sin material: aviso de generación combinada */}
      {!hasDocuments && !isGenerating && (
        <p className="text-xs text-gray-500">
          La IA generará el material y las preguntas en un solo paso.
        </p>
      )}

      {/* Progreso durante generación */}
      {isGenerating && (
        <div className="space-y-2">
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
            <p className="text-blue-400 text-sm">{progress}</p>
          </div>
          <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-green-500 to-blue-500 transition-all duration-500 rounded-full"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
