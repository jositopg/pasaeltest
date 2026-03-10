import React from 'react';
import { downloadExcelTemplate, generatePDFTemplate } from '../../utils/questionImporter';

function ImportQuestionsPanel({ theme, onImportFile, showToast }) {
  return (
    <div className="bg-gradient-to-br from-purple-500/10 to-blue-500/10 border-2 border-purple-300/30 rounded-xl p-4 mb-4">
      <h3 className="text-base font-semibold mb-3 text-purple-300 flex items-center gap-2">📥 Importar Preguntas</h3>
      <div className="mb-3 bg-white/5 rounded-lg p-3 border border-white/10">
        <p className="text-sm font-semibold text-gray-300 mb-2">📋 Descargar plantillas:</p>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => downloadExcelTemplate()} className="w-full sm:w-auto px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition flex items-center gap-2 text-sm font-medium shadow-sm">
            📊 Excel (.xlsx)
          </button>
          <button
            onClick={() => {
              const template = generatePDFTemplate();
              const blob = new Blob([template], { type: 'text/plain' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url; a.download = 'plantilla_preguntas.txt'; a.click();
              URL.revokeObjectURL(url);
              if (showToast) showToast('📄 Plantilla de texto descargada', 'success');
            }}
            className="w-full sm:w-auto px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition flex items-center gap-2 text-sm font-medium shadow-sm"
          >
            📄 Texto (.txt)
          </button>
        </div>
      </div>
      <div className="bg-white/5 rounded-lg p-3 border border-white/10">
        <p className="text-sm font-semibold text-gray-300 mb-2">📂 Subir archivo con preguntas:</p>
        <input
          type="file"
          accept=".xlsx,.xls,.txt"
          onChange={onImportFile}
          className="block w-full text-sm text-gray-300 file:mr-2 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-purple-500/20 file:text-purple-300 hover:file:bg-purple-500/30 file:cursor-pointer file:transition cursor-pointer border-2 border-dashed border-purple-400/30 rounded-lg p-3 hover:border-purple-400/50 transition"
        />
        <div className="mt-3 bg-blue-500/10 border border-blue-400/30 rounded-lg p-3">
          <p className="text-xs font-semibold text-blue-300 mb-1">📝 Formatos soportados:</p>
          <ul className="text-xs text-blue-200 space-y-1 break-all">
            <li>• <strong>Excel (.xlsx, .xls):</strong> Columnas: Pregunta | Opción A | Opción B | Opción C | Correcta | Dificultad</li>
            <li>• <strong>Texto (.txt):</strong> Formato: PREGUNTA: ... / A) ... / B) ... / C) ... / CORRECTA: A / ---</li>
          </ul>
        </div>
      </div>
      {theme.questions && theme.questions.length > 0 && (
        <div className="mt-4 bg-white/5 rounded-lg p-3 border border-white/10">
          <p className="text-sm text-gray-300">📊 Total de preguntas: <strong className="text-purple-300">{theme.questions.length}</strong></p>
        </div>
      )}
    </div>
  );
}

export default ImportQuestionsPanel;
