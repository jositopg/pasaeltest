import React from 'react';
import Icons from '../common/Icons';
import { useTheme } from '../../context/ThemeContext';

/**
 * Sección de documentos del tema: lista, botón añadir, panel de añadir.
 */
export default function DocumentSection({
  theme,
  showAddDoc,
  docType,
  docContent,
  isSearching,
  isGeneratingQuestions,
  generationProgress,
  generationPercent,
  onToggleAddDoc,
  onDocTypeChange,
  onDocContentChange,
  onAddDoc,
  onFileUpload,
  onDeleteDoc,
  onGenerateFromDoc,
  fileInputRef,
}) {
  const { darkMode: dm } = useTheme();

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-white font-semibold">Material de Estudio</h3>
          <p className="text-gray-500 text-xs mt-1">
            {theme.documents?.length > 0
              ? `${theme.documents.length} documento${theme.documents.length > 1 ? 's' : ''} optimizado${theme.documents.length > 1 ? 's' : ''}`
              : 'Añade contenido estructurado para generar preguntas'}
          </p>
        </div>
        <button onClick={onToggleAddDoc} className="bg-blue-500 text-white px-4 py-2 rounded-xl text-sm flex items-center gap-2 hover:bg-blue-600 transition-colors">
          <Icons.Plus />Añadir
        </button>
      </div>

      {/* Panel añadir documento */}
      {showAddDoc && (
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-4 space-y-3">
          <select value={docType} onChange={(e) => onDocTypeChange(e.target.value)} className="w-full bg-slate-800 text-white rounded-lg px-3 py-2 border border-white/10">
            <option value="pdf" className="bg-slate-800 text-white">📄 Subir Archivo (PDF/TXT)</option>
            <option value="text" className="bg-slate-800 text-white">📝 Pegar Texto Directamente</option>
            <option value="url" className="bg-slate-800 text-white">🔗 Enlace Web</option>
          </select>

          {(isSearching || isGeneratingQuestions) && generationProgress && (
            <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/30 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-blue-400 text-sm font-medium">{generationProgress}</p>
                <span className="text-blue-300 text-sm font-bold">{generationPercent}%</span>
              </div>
              <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${generationPercent}%` }}
                />
              </div>
              {generationPercent < 100 && (
                <p className="text-gray-400 text-xs text-center">Esto puede tardar 15-30 segundos...</p>
              )}
            </div>
          )}

          {docType === 'pdf' || !docType ? (
            <div className="border-2 border-dashed border-white/20 rounded-lg p-4 text-center">
              <input
                type="file"
                accept=".pdf,.txt,.doc,.docx"
                ref={fileInputRef}
                onChange={onFileUpload}
                className="hidden"
                id="fileUpload"
              />
              <label htmlFor="fileUpload" className="cursor-pointer">
                <div className="text-4xl mb-2">📁</div>
                <p className="text-gray-300 text-sm">Toca para subir archivo</p>
              </label>
            </div>
          ) : docType === 'text' ? (
            <div className="space-y-3">
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 mb-2">
                <p className="text-blue-400 text-xs">💡 Pega aquí el contenido completo de tu documento</p>
                <p className="text-blue-300 text-xs mt-1">✓ Sin límite de caracteres • Acepta textos muy largos</p>
              </div>
              <textarea
                placeholder="Pega aquí el texto completo del temario, ley, artículos..."
                value={docContent}
                onChange={(e) => onDocContentChange(e.target.value)}
                className="w-full bg-white/5 text-white rounded-lg px-3 py-3 border border-white/10 min-h-[200px] sm:min-h-[350px] resize-vertical"
                rows={8}
              />
              <div className="flex justify-between items-center">
                <p className="text-gray-400 text-xs">
                  {docContent.trim().split(' ').length.toLocaleString()} palabras • {docContent.length.toLocaleString()} caracteres
                </p>
                <button
                  onClick={() => onAddDoc()}
                  disabled={!docContent.trim()}
                  className="bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold py-2.5 px-4 w-full rounded-lg disabled:opacity-50 hover:from-green-600 hover:to-emerald-700 transition-all"
                >
                  💾 Guardar Texto
                </button>
              </div>
            </div>
          ) : docType === 'url' ? (
            <div className="space-y-3">
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mb-2">
                <p className="text-yellow-400 text-xs">⚠️ Si la URL no funciona, usa "Pegar Texto" o "Buscar con IA"</p>
              </div>
              <input
                type="url"
                placeholder="https://ejemplo.com/documento.pdf o https://boe.es/..."
                value={docContent}
                onChange={(e) => onDocContentChange(e.target.value)}
                className="w-full bg-white/5 text-white rounded-lg px-3 py-2 border border-white/10"
                disabled={isSearching}
              />
              <button
                onClick={() => onAddDoc()}
                disabled={isSearching || !docContent.trim()}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold py-3 rounded-lg disabled:opacity-50 hover:from-green-600 hover:to-emerald-700 transition-all flex items-center justify-center gap-2"
              >
                {isSearching ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Procesando...
                  </>
                ) : '🔗 Obtener Contenido de URL'}
              </button>
            </div>
          ) : null}
        </div>
      )}

      {/* Progreso de generación de preguntas — visible aunque el panel de añadir doc esté cerrado */}
      {isGeneratingQuestions && generationProgress && (
        <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/30 rounded-xl p-4 space-y-2 mb-3">
          <div className="flex items-center justify-between">
            <p className="text-blue-400 text-sm font-medium">{generationProgress}</p>
            <span className="text-blue-300 text-sm font-bold tabular-nums">
              {generationPercent > 0 ? `${generationPercent}%` : '…'}
            </span>
          </div>
          <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${Math.max(generationPercent, 3)}%` }}
            />
          </div>
        </div>
      )}

      {/* Lista de documentos */}
      <div className="space-y-2">
        {theme.documents?.length > 0 ? (
          theme.documents.map((doc, idx) => (
            <div key={idx} className="bg-white/5 border border-white/10 rounded-lg p-3">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                      doc.type === 'ai-search' ? 'bg-purple-500/20 text-purple-400' :
                      doc.type === 'pdf' ? 'bg-red-500/20 text-red-400' :
                      doc.type === 'txt' ? 'bg-blue-500/20 text-blue-400' :
                      'bg-green-500/20 text-green-400'
                    }`}>
                      {doc.type === 'ai-search' ? '🤖 IA' :
                       doc.type === 'pdf' ? '📄 PDF' :
                       doc.type === 'txt' ? '📝 TXT' : '🔗 Web'}
                    </span>
                    {doc.quality === 'optimized' && (
                      <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs font-semibold">✓ Optimizado</span>
                    )}
                    {doc.wordCount && (
                      <span className="px-2 py-1 bg-blue-500/10 text-blue-300 rounded text-xs">
                        {doc.wordCount.toLocaleString()} palabras
                      </span>
                    )}
                  </div>
                  <p className="text-gray-300 text-sm break-words font-medium">
                    {doc.fileName || doc.content.substring(0, 80)}
                    {!doc.fileName && doc.content.length > 80 && '...'}
                  </p>
                  {doc.size && <p className="text-gray-600 text-xs mt-1">Tamaño: {doc.size}</p>}
                </div>
                <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                  <button
                    onClick={() => onGenerateFromDoc([doc])}
                    disabled={isGeneratingQuestions}
                    title="Generar preguntas solo desde este material"
                    className="p-2 bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 text-green-400 rounded-lg transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center w-8 h-8"
                  >
                    {isGeneratingQuestions
                      ? <div className="w-4 h-4 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
                      : '⚡'}
                  </button>
                  <button
                    onClick={() => onDeleteDoc(idx, doc)}
                    className="p-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 rounded-lg transition-all active:scale-95"
                    title="Eliminar documento"
                  >
                    <Icons.Trash />
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-12 bg-white/5 rounded-xl border border-dashed border-white/10">
            <div className="text-4xl mb-3">📚</div>
            <p className="text-gray-400 font-medium">Sin documentos todavía</p>
            <p className="text-gray-600 text-sm mt-1">Sube un PDF, pega texto o añade un enlace web</p>
          </div>
        )}
      </div>
    </div>
  );
}
