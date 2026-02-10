// ═══════════════════════════════════════════════════════════════════════
// COMPONENTE UI: IMPORTAR PREGUNTAS DESDE EXCEL/PDF
// ═══════════════════════════════════════════════════════════════════════
//
// AÑADIR este código en la sección de ThemeDetail, después del botón
// "Generar Preguntas con IA"
//
// Busca en tu App.jsx algo como:
//   <button onClick={handleGenerateQuestions} ...>
//     🤖 Generar Preguntas con IA
//   </button>
//
// Y AÑADE este código justo DESPUÉS de ese botón:
// ═══════════════════════════════════════════════════════════════════════

{/* NUEVO: Importar Preguntas */}
<div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl p-6 border-2 border-purple-200 mt-4">
  <h3 className="text-lg font-bold mb-2 text-purple-700 flex items-center gap-2">
    📥 Importar Preguntas
  </h3>
  <p className="text-sm text-gray-600 mb-4">
    Importa preguntas masivamente desde Excel o archivos de texto
  </p>

  {/* Plantillas */}
  <div className="bg-white rounded-lg p-4 mb-4 border border-purple-100">
    <p className="text-sm font-semibold text-gray-700 mb-2">
      📋 Plantillas (descargar y rellenar):
    </p>
    <div className="flex gap-2 flex-wrap">
      <button
        onClick={() => downloadExcelTemplate()}
        className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition flex items-center gap-2 text-sm font-medium shadow-sm"
      >
        📊 Excel (.xlsx)
      </button>
      <button
        onClick={() => {
          const template = generatePDFTemplate();
          const blob = new Blob([template], { type: 'text/plain' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'plantilla_preguntas.txt';
          a.click();
          URL.revokeObjectURL(url);
          if (showToast) showToast('📄 Plantilla de texto descargada', 'success');
        }}
        className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition flex items-center gap-2 text-sm font-medium shadow-sm"
      >
        📄 Texto (.txt)
      </button>
    </div>
    <p className="text-xs text-gray-500 mt-2">
      Descarga la plantilla, rellénala con tus preguntas y súbela abajo
    </p>
  </div>

  {/* Input de archivo */}
  <div className="bg-white rounded-lg p-4 border border-purple-100">
    <p className="text-sm font-semibold text-gray-700 mb-2">
      📂 Subir archivo con preguntas:
    </p>
    <input
      type="file"
      accept=".xlsx,.xls,.txt"
      onChange={async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
          setIsGenerating(true);
          setGenerationProgress('📥 Leyendo archivo...');
          setGenerationPercent(10);

          let questions;
          
          if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
            // Importar Excel
            setGenerationProgress('📊 Procesando Excel...');
            setGenerationPercent(30);
            questions = await parseExcelQuestions(file);
          } else if (file.name.endsWith('.txt')) {
            // Importar texto (formato PDF)
            setGenerationProgress('📄 Procesando texto...');
            setGenerationPercent(30);
            const text = await file.text();
            questions = await parsePDFQuestions(text);
          } else {
            throw new Error('Formato no soportado. Usa .xlsx o .txt');
          }

          if (!questions || questions.length === 0) {
            throw new Error('No se encontraron preguntas válidas en el archivo');
          }

          setGenerationProgress('✓ Validando preguntas...');
          setGenerationPercent(70);

          // Validar preguntas
          const validQuestions = questions.filter(q => {
            return q.text && 
                   q.text.length > 10 && 
                   Array.isArray(q.options) && 
                   q.options.length === 3 &&
                   q.correct >= 0 && 
                   q.correct <= 2;
          });

          if (validQuestions.length === 0) {
            throw new Error('Ninguna pregunta pasó la validación. Revisa el formato.');
          }

          if (validQuestions.length < questions.length) {
            const invalid = questions.length - validQuestions.length;
            if (showToast) {
              showToast(
                `⚠️ ${invalid} pregunta${invalid > 1 ? 's' : ''} no válida${invalid > 1 ? 's' : ''} (formato incorrecto)`,
                'warning'
              );
            }
          }

          setGenerationProgress('💾 Guardando preguntas...');
          setGenerationPercent(90);

          // Guardar preguntas
          const updatedTheme = {
            ...theme,
            questions: [...(theme.questions || []), ...validQuestions]
          };
          onUpdate(updatedTheme);
          
          setGenerationProgress(`✅ ${validQuestions.length} preguntas importadas`);
          setGenerationPercent(100);

          if (showToast) {
            showToast(
              `✅ ${validQuestions.length} pregunta${validQuestions.length > 1 ? 's' : ''} importada${validQuestions.length > 1 ? 's' : ''} exitosamente`,
              'success'
            );
          }

          setTimeout(() => {
            setIsGenerating(false);
            setGenerationProgress('');
            setGenerationPercent(0);
          }, 2000);

        } catch (error) {
          console.error('Error importando preguntas:', error);
          
          setGenerationProgress(`❌ Error: ${error.message}`);
          
          if (showToast) {
            showToast(`❌ Error: ${error.message}`, 'error');
          }

          setTimeout(() => {
            setIsGenerating(false);
            setGenerationProgress('');
            setGenerationPercent(0);
          }, 3000);
        }
        
        // Reset input
        e.target.value = '';
      }}
      className="block w-full text-sm text-gray-700 
                 file:mr-4 file:py-2.5 file:px-4 
                 file:rounded-lg file:border-0 
                 file:text-sm file:font-semibold 
                 file:bg-purple-100 file:text-purple-700 
                 hover:file:bg-purple-200 
                 file:cursor-pointer file:transition
                 cursor-pointer border-2 border-dashed border-purple-300 rounded-lg p-3
                 hover:border-purple-400 transition"
    />
    
    <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
      <p className="text-xs font-semibold text-blue-800 mb-1">
        📝 Formatos soportados:
      </p>
      <ul className="text-xs text-blue-700 space-y-1">
        <li>• <strong>Excel (.xlsx, .xls):</strong> Columnas: Pregunta | Opción A | Opción B | Opción C | Correcta | Dificultad</li>
        <li>• <strong>Texto (.txt):</strong> Formato: PREGUNTA: ... / A) ... / B) ... / C) ... / CORRECTA: A / ---</li>
      </ul>
    </div>
  </div>

  {/* Estadísticas */}
  {theme.questions && theme.questions.length > 0 && (
    <div className="mt-4 bg-white rounded-lg p-3 border border-purple-100">
      <p className="text-sm text-gray-600">
        📊 Total de preguntas: <strong className="text-purple-700">{theme.questions.length}</strong>
      </p>
    </div>
  )}
</div>
