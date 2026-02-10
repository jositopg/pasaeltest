// ═══════════════════════════════════════════════════════════════════════
// FUNCIÓN MEJORADA: GENERACIÓN DE PREGUNTAS CON CHUNKING INTELIGENTE
// ═══════════════════════════════════════════════════════════════════════
//
// REEMPLAZA LA FUNCIÓN ACTUAL (líneas ~987-1230) CON ESTA:
//
// Busca en tu App.jsx la línea que dice:
//   const handleGenerateQuestions = async () => {
//
// Y reemplaza TODA esa función con este código:
// ═══════════════════════════════════════════════════════════════════════

const handleGenerateQuestions = async () => {
  if (!theme || !theme.documents || theme.documents.length === 0) {
    if (showToast) showToast('❌ No hay documentos. Añade contenido primero.', 'error');
    return;
  }

  try {
    setIsGenerating(true);
    setGenerationProgress('📊 Analizando documentos...');
    setGenerationPercent(5);

    // Recopilar TODO el contenido (sin límite de 35K)
    let fullContent = '';
    
    for (const doc of theme.documents) {
      let docText = '';
      
      if (doc.processedContent) {
        docText = `\n═══ ${doc.fileName || 'DOCUMENTO'} ═══\n\n${doc.processedContent}\n`;
      } else if (doc.searchResults?.processedContent) {
        docText = `\n═══ BÚSQUEDA IA ═══\n\n${doc.searchResults.processedContent}\n`;
      } else if (doc.content) {
        docText = `\n═══ ${doc.fileName || 'TEXTO'} ═══\n\n${doc.content}\n`;
      }
      
      fullContent += docText;
    }

    if (fullContent.trim().length < 100) {
      throw new Error('No hay suficiente contenido para generar preguntas.');
    }

    console.log(`📊 Contenido total: ${fullContent.length.toLocaleString()} caracteres`);

    // CHUNKING INTELIGENTE
    const estimate = estimateQuestions(fullContent.length);
    
    setGenerationProgress('📋 Planificando generación...');
    setGenerationPercent(8);

    // Confirmar con usuario
    const confirmed = window.confirm(
`📚 GENERACIÓN MASIVA DE PREGUNTAS

📊 Análisis del contenido:
• Longitud: ${Math.round(fullContent.length / 1000)}K caracteres
• Se dividirá en ${estimate.numChunks} sección${estimate.numChunks > 1 ? 'es' : ''}
• Se generarán aproximadamente ${estimate.totalQuestions} preguntas
• Tiempo estimado: ${formatEstimatedTime(estimate.estimatedTime)}

¿Deseas continuar?`
    );

    if (!confirmed) {
      setIsGenerating(false);
      setGenerationProgress('');
      setGenerationPercent(0);
      return;
    }

    // Dividir en chunks inteligentes
    const chunks = chunkDocument(fullContent, {
      maxChunkSize: 25000,
      overlap: 500
    });

    console.log(`📚 Documento dividido en ${chunks.length} chunks`);

    setGenerationProgress(`🚀 Iniciando generación de ${estimate.totalQuestions} preguntas...`);
    setGenerationPercent(10);

    // Obtener preguntas existentes para evitar duplicados
    let existingQuestions = (theme.questions || [])
      .map(q => q.text.substring(0, 80))
      .join('\n');

    let allGeneratedQuestions = [];
    const questionsPerChunk = 25;

    // Generar preguntas por cada chunk
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const currentQuestion = i * questionsPerChunk;
      const progress = Math.round(((i + 1) / chunks.length) * 85) + 10;
      
      setGenerationProgress(
        `🤖 Generando preguntas ${currentQuestion + 1}-${currentQuestion + questionsPerChunk} de ~${estimate.totalQuestions}...`
      );
      setGenerationPercent(progress);

      console.log(`📝 Procesando chunk ${i + 1}/${chunks.length} (${chunk.size} chars)`);

      try {
        const response = await fetch("/api/generate-gemini", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            prompt: `Eres un experto creador de preguntas tipo test para oposiciones sobre "${theme.name}".

SECCIÓN ${i + 1} de ${chunks.length}

Tu objetivo: Crear EXACTAMENTE ${questionsPerChunk} preguntas de máxima calidad sobre ESTA SECCIÓN específica.

═══════════════════════════════════════════════════════════════════════
📚 CONTENIDO DE ESTA SECCIÓN:
${chunk.content}
═══════════════════════════════════════════════════════════════════════

${existingQuestions.length > 0 ? `
🚫 PREGUNTAS YA GENERADAS - NO REPETIR NI REFORMULAR:
${existingQuestions}

⚠️ OBLIGATORIO: Cubre aspectos COMPLETAMENTE DIFERENTES del contenido.
` : ''}

═══════════════════════════════════════════════════════════════════════
🎯 CRITERIOS DE CALIDAD:
═══════════════════════════════════════════════════════════════════════

1. PRECISIÓN ABSOLUTA: Solo datos EXACTOS del contenido
2. INFORMACIÓN VERIFICABLE: Cada pregunta debe tener respuesta clara
3. OPCIONES PLAUSIBLES: Incorrectas deben ser realistas, no absurdas
4. VARIEDAD: Cubre diferentes aspectos de esta sección

═══════════════════════════════════════════════════════════════════════
📝 FORMATO DE RESPUESTA (JSON PURO - SIN TEXTO ADICIONAL):
═══════════════════════════════════════════════════════════════════════

[
  {
    "pregunta": "Según el artículo X, ¿cuál es...?",
    "opciones": ["Opción A", "Opción B", "Opción C"],
    "correcta": 0,
    "dificultad": "media"
  }
]

DIFICULTADES: fácil (30%), media (50%), difícil (20%)

Responde SOLO con el JSON de ${questionsPerChunk} preguntas.`,
            maxTokens: 8000
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`❌ Error en chunk ${i + 1}:`, errorText.substring(0, 200));
          throw new Error(`Error API (${response.status}): ${errorText.substring(0, 200)}`);
        }

        const data = await response.json();
        
        // Procesar respuesta
        let textContent = '';
        for (const block of data.content) {
          if (block.type === 'text') {
            textContent += block.text;
          }
        }

        if (!textContent) {
          throw new Error(`Chunk ${i + 1}: La IA no devolvió contenido`);
        }

        // Extraer JSON
        let cleanedResponse = textContent.trim()
          .replace(/```json\s*/g, '')
          .replace(/```\s*/g, '')
          .replace(/^[^[]*/, '')
          .replace(/[^\]]*$/, '');
        
        const jsonMatch = cleanedResponse.match(/\[[\s\S]*\]/);
        if (!jsonMatch) {
          console.error(`Chunk ${i + 1} respuesta:`, textContent.substring(0, 300));
          throw new Error(`Chunk ${i + 1}: No se pudo extraer JSON`);
        }

        let chunkQuestions;
        try {
          chunkQuestions = JSON.parse(jsonMatch[0]);
        } catch (e) {
          throw new Error(`Chunk ${i + 1}: JSON inválido - ${e.message}`);
        }

        if (!Array.isArray(chunkQuestions) || chunkQuestions.length === 0) {
          throw new Error(`Chunk ${i + 1}: No se generaron preguntas válidas`);
        }

        // Convertir a formato de la app
        const formattedQuestions = chunkQuestions.map((q, idx) => ({
          id: `${theme.number}-gen-${Date.now()}-${i}-${idx}`,
          text: q.pregunta || q.text || 'Pregunta sin texto',
          options: q.opciones || q.options || ['A', 'B', 'C'],
          correct: typeof q.correcta !== 'undefined' ? q.correcta : (q.correct || 0),
          difficulty: q.dificultad || q.difficulty || 'media',
          stats: {
            timesAnswered: 0,
            timesCorrect: 0,
            averageTime: 0
          }
        }));

        // Validar preguntas
        const validQuestions = formattedQuestions.filter(q => {
          return q.text && 
                 q.text.length > 10 && 
                 Array.isArray(q.options) && 
                 q.options.length === 3 &&
                 q.correct >= 0 && 
                 q.correct <= 2;
        });

        if (validQuestions.length === 0) {
          throw new Error(`Chunk ${i + 1}: Ninguna pregunta pasó la validación`);
        }

        console.log(`✅ Chunk ${i + 1}: ${validQuestions.length} preguntas generadas`);

        allGeneratedQuestions = [...allGeneratedQuestions, ...validQuestions];
        
        // Actualizar lista de existentes para evitar duplicados en siguiente chunk
        const newExisting = validQuestions
          .map(q => q.text.substring(0, 80))
          .join('\n');
        existingQuestions = existingQuestions ? `${existingQuestions}\n${newExisting}` : newExisting;

      } catch (chunkError) {
        console.error(`Error en chunk ${i + 1}:`, chunkError);
        // Continuar con siguiente chunk si falla uno
        if (showToast) {
          showToast(`⚠️ Error en sección ${i + 1}, continuando...`, 'warning');
        }
      }
    }

    // Verificar que se generaron preguntas
    if (allGeneratedQuestions.length === 0) {
      throw new Error('No se pudo generar ninguna pregunta válida');
    }

    // Guardar todas las preguntas
    setGenerationProgress('💾 Guardando preguntas...');
    setGenerationPercent(95);

    const updatedTheme = {
      ...theme,
      questions: [...(theme.questions || []), ...allGeneratedQuestions]
    };

    onUpdate(updatedTheme);

    setGenerationProgress(`✅ ¡${allGeneratedQuestions.length} preguntas generadas!`);
    setGenerationPercent(100);

    if (showToast) {
      showToast(
        `🎉 ${allGeneratedQuestions.length} preguntas generadas exitosamente (${chunks.length} secciones procesadas)`,
        'success'
      );
    }

    console.log(`🎉 Generación completa: ${allGeneratedQuestions.length} preguntas de ${chunks.length} chunks`);

    setTimeout(() => {
      setIsGenerating(false);
      setGenerationProgress('');
      setGenerationPercent(0);
    }, 2000);

  } catch (error) {
    console.error('❌ Error en generación:', error);
    setGenerationProgress(`❌ Error: ${error.message}`);
    
    if (showToast) {
      showToast(`Error: ${error.message}`, 'error');
    }

    setTimeout(() => {
      setIsGenerating(false);
      setGenerationProgress('');
      setGenerationPercent(0);
    }, 3000);
  }
};
