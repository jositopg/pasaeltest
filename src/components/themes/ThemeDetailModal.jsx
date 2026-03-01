import React, { useState, useEffect, useRef } from 'react';
import Icons from '../common/Icons';
import { OPTIMIZED_QUESTION_PROMPT, OPTIMIZED_PHASE2_PROMPT, OPTIMIZED_SEARCH_PROMPT, OPTIMIZED_AUTO_GENERATE_PROMPT } from '../../utils/optimizedPrompts';
import { parseExcelQuestions, parsePDFQuestions, downloadExcelTemplate, generatePDFTemplate } from '../../utils/questionImporter';
import { analyzeDocument, determineQuestionTypes } from '../../utils/documentAnalyzer';
import { DEBUG, MAX_CHARS, QUESTIONS_PER_BATCH } from '../../utils/constants';

function ThemeDetailModal({ theme, onClose, onUpdate, showToast }) {
  const [showAddDoc, setShowAddDoc] = useState(false);
  const [docType, setDocType] = useState('url');
  const [docContent, setDocContent] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);
  const [generationProgress, setGenerationProgress] = useState('');
  const [generationPercent, setGenerationPercent] = useState(0);
  const [showAddQuestion, setShowAddQuestion] = useState(false);
  const [selectedQuestions, setSelectedQuestions] = useState(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [newQuestion, setNewQuestion] = useState({
    text: '',
    options: ['', '', ''],
    correct: 0,
    difficulty: 'media'
  });
  const fileInputRef = useRef(null);
  
  // Estado para auto-generación de repositorio
  const [showAutoGenerate, setShowAutoGenerate] = useState(false);
  const [isAutoGenerating, setIsAutoGenerating] = useState(false);
  
  // Estado para edición de nombre
  const [editingName, setEditingName] = useState(theme.name);
  const [nameJustSaved, setNameJustSaved] = useState(false);
  
  // Sincronizar editingName cuando theme.name cambia externamente
  useEffect(() => {
    setEditingName(theme.name);
  }, [theme.name]);
  
  // Estado para diálogo de confirmación personalizado
  const [deleteConfirm, setDeleteConfirm] = useState({
    show: false,
    docIndex: null,
    docName: ''
  });
  
  // Estado para diálogo de confirmación de preguntas
  const [deleteQuestionsConfirm, setDeleteQuestionsConfirm] = useState({
    show: false,
    type: null, // 'selected' o 'all'
    count: 0
  });

  // Detectar si se debe mostrar auto-generación cuando se guarda el nombre
  useEffect(() => {
    if (DEBUG) console.log('🔍 Checking auto-generate:', {
      nameJustSaved,
      docsLength: theme.documents?.length,
      themeName: theme.name,
      defaultName: `Tema ${theme.number}`,
      shouldShow: nameJustSaved && 
        (!theme.documents || theme.documents.length === 0) && 
        theme.name && 
        theme.name.trim() !== '' &&
        theme.name !== `Tema ${theme.number}`
    });
    
    if (nameJustSaved && 
        (!theme.documents || theme.documents.length === 0) && 
        theme.name && 
        theme.name.trim() !== '' &&
        theme.name !== `Tema ${theme.number}`) {
      if (DEBUG) console.log('✅ Showing auto-generate banner!');
      setShowAutoGenerate(true);
      setNameJustSaved(false); // Reset flag
    }
  }, [nameJustSaved, theme.documents, theme.name, theme.number]);

  // Manejar guardado de nombre
  const handleSaveName = () => {
    const trimmedName = editingName.trim();
    if (DEBUG) console.log('💾 Saving name:', { trimmedName, oldName: theme.name });
    
    if (trimmedName && trimmedName !== theme.name) {
      onUpdate({...theme, name: trimmedName});
      // Delay para asegurar que el tema se actualiza antes del check
      setTimeout(() => {
        if (DEBUG) console.log('🚀 Setting nameJustSaved = true');
        setNameJustSaved(true);
      }, 150);
    }
  };

  // Guardar nombre al presionar Enter
  const handleNameKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveName();
    }
  };

  // Función para auto-generar repositorio basado en el nombre del tema
  const handleAutoGenerateRepository = async () => {
    setIsAutoGenerating(true);
    setShowAutoGenerate(false);
    
    const searchQuery = `${theme.name} temario examen completo`;
    
    if (showToast) showToast(`Generando repositorio para "${theme.name}"...`, 'info');
    
    try {
      setIsSearching(true);
      
      // Llamada a nuestra función serverless en lugar de directamente a Anthropic
      const response = await fetch("/api/generate-gemini", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: OPTIMIZED_AUTO_GENERATE_PROMPT(theme.name),
          maxTokens: 4000
        })
      });

      if (!response.ok) {
        throw new Error('Error en la búsqueda');
      }

      const data = await response.json();
      
      // Procesar respuesta y extraer contenido
      let searchContent = '';

      for (const block of data.content) {
        if (block.type === 'text') {
          searchContent += block.text + '\n';
        }
      }

      if (searchContent.trim().length < 50) {
        throw new Error('La IA no devolvió contenido suficiente para crear el repositorio');
      }

      // Crear documento con los resultados
      const newDoc = {
        type: 'ai-search',
        content: theme.name,
        fileName: `Repositorio: ${theme.name}`,
        addedAt: new Date().toISOString(),
        searchResults: {
          query: searchQuery,
          content: searchContent,
          processedContent: searchContent
        },
        processedContent: searchContent
      };

      // Añadir al tema
      const updatedTheme = {
        ...theme,
        documents: [...(theme.documents || []), newDoc]
      };
      
      onUpdate(updatedTheme);
      
      if (showToast) showToast(`✅ Repositorio generado para "${theme.name}"`, 'success');
      
    } catch (error) {
      console.error('Error generando repositorio:', error);
      if (showToast) showToast('Error al generar repositorio automático', 'error');
    } finally {
      setIsSearching(false);
      setIsAutoGenerating(false);
    }
  };

  const generateQuestionsFromDocuments = async () => {
    if (!theme.documents || theme.documents.length === 0) {
      if (showToast) showToast('Primero añade documentos a este tema para generar preguntas', 'warning');
      return;
    }

    setIsGeneratingQuestions(true);
    setGenerationProgress('📚 Recopilando contenido de documentos...');
    setGenerationPercent(5);

    try {
      // Recopilar contenido - usar contenido procesado/optimizado cuando esté disponible
      let documentContents = '';
      let charCount = 0;
      const maxChars = MAX_CHARS;
      
      setGenerationProgress('📖 Procesando repositorio completo...');
      setGenerationPercent(10);
      
      for (const doc of theme.documents) {
        if (charCount >= maxChars) break;
        
        let docText = '';
        
        // Priorizar contenido procesado (optimizado para preguntas)
        if (doc.processedContent) {
          docText = `\n═══ FUENTE OPTIMIZADA ═══\n${doc.fileName || doc.content.substring(0, 100)}\n\n${doc.processedContent}\n`;
        } else if (doc.searchResults?.processedContent) {
          docText = `\n═══ BÚSQUEDA IA OPTIMIZADA ═══\n${doc.content}\n\n${doc.searchResults.processedContent}\n`;
        } else if (doc.searchResults?.content) {
          docText = `\n═══ BÚSQUEDA WEB ═══\n${doc.content}\n\n${doc.searchResults.content}\n`;
        } else if (doc.content) {
          docText = `\n═══ DOCUMENTO ═══\n${doc.fileName || 'Texto pegado'}\n\n${doc.content}\n`;
        }
        
        const remaining = maxChars - charCount;
        documentContents += docText.substring(0, remaining);
        charCount += docText.length;
      }

      if (documentContents.trim().length < 100) {
        throw new Error('No hay suficiente contenido. Añade documentos o usa búsqueda IA.');
      }

      if (DEBUG) console.log(`📊 Contenido recopilado: ${charCount.toLocaleString()} caracteres de ${theme.documents.length} documentos`);

      setGenerationProgress('🤖 Enviando a IA para generar preguntas...');
      setGenerationPercent(20);

      // Obtener preguntas existentes
      const existingQuestions = (theme.questions || []).map(q => q.text.substring(0, 80)).join('\n');

      const numToGenerate = QUESTIONS_PER_BATCH;

      // Analizar estructura del documento para mejorar calidad
      const analysis = analyzeDocument(documentContents);
      const significantSections = analysis.sections.filter(
        s => s.level === 'critical' || s.level === 'high'
      );
      const usePhase2 = significantSections.length >= 2;

      setGenerationProgress(`🤖 Generando ${numToGenerate} preguntas...`);
      setGenerationPercent(30);

      let promptToUse;
      if (usePhase2) {
        // Elegir la sección más importante para el prompt enriquecido
        const topSection = significantSections[0];
        const sectionMeta = {
          index: 0,
          total: significantSections.length,
          title: topSection.title,
          type: topSection.type,
          level: topSection.level
        };
        const questionTypes = determineQuestionTypes(topSection);
        promptToUse = OPTIMIZED_PHASE2_PROMPT(
          theme.name,
          sectionMeta,
          numToGenerate,
          documentContents.substring(0, 35000),
          existingQuestions,
          questionTypes
        );
      } else {
        promptToUse = OPTIMIZED_QUESTION_PROMPT(
          theme.name,
          numToGenerate,
          documentContents.substring(0, 35000),
          existingQuestions
        );
      }

      // Llamada a nuestra función serverless
      const response = await fetch("/api/generate-gemini", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: promptToUse,
          useWebSearch: false,
          maxTokens: 8000
        })
      });

      setGenerationProgress('📝 Procesando respuesta...');
      setGenerationPercent(60);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error API (${response.status}): ${errorText.substring(0, 200)}`);
      }

      const data = await response.json();
      
      setGenerationProgress('📝 Procesando respuesta...');
      setGenerationPercent(70);

      let textContent = '';
      for (const block of data.content) {
        if (block.type === 'text') {
          textContent += block.text;
        }
      }

      if (!textContent) {
        throw new Error('La IA no devolvió contenido');
      }

      // Extraer JSON
      setGenerationProgress('🔍 Extrayendo preguntas...');
      setGenerationPercent(80);
      
      let cleanedResponse = textContent.trim()
        .replace(/```json\s*/g, '')
        .replace(/```\s*/g, '')
        .replace(/^[^[]*/, '') // Quitar texto antes del [
        .replace(/[^\]]*$/, ''); // Quitar texto después del ]
      
      const jsonMatch = cleanedResponse.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        console.error('Respuesta:', textContent.substring(0, 500));
        throw new Error('No se pudo extraer JSON. La IA respondió con texto no estructurado.');
      }

      setGenerationProgress('✓ Validando formato...');
      setGenerationPercent(90);

      let generatedQuestions;
      try {
        generatedQuestions = JSON.parse(jsonMatch[0]);
      } catch (e) {
        throw new Error('JSON inválido: ' + e.message);
      }

      if (!Array.isArray(generatedQuestions) || generatedQuestions.length === 0) {
        throw new Error('La IA no generó preguntas válidas');
      }

      setGenerationProgress('💾 Validando y guardando...');
      setGenerationPercent(95);

      // Convertir preguntas generadas
      const newQuestionsRaw = generatedQuestions.map((q, i) => ({
        id: `${theme.number}-ai-${Date.now()}-${i}`,
        text: q.pregunta || q.text || 'Pregunta sin texto',
        options: q.opciones || q.options || ['A', 'B', 'C'],
        correct: q.correcta ?? q.correct ?? 0,
        source: 'IA',
        difficulty: q.dificultad || q.difficulty || 'media',
        explanation: q.explicacion || q.explanation || '',
        needsReview: true,
        createdAt: new Date().toISOString()
      }));

      // FILTRAR DUPLICADOS: comparar con preguntas existentes
      const existingTexts = (theme.questions || []).map(q => 
        q.text.toLowerCase().trim()
      );
      
      const newQuestions = newQuestionsRaw.filter(newQ => {
        const newText = newQ.text.toLowerCase().trim();
        
        // Verificar si es duplicado exacto
        if (existingTexts.includes(newText)) {
          if (DEBUG) console.log('❌ Duplicado exacto detectado:', newQ.text.substring(0, 50));
          return false;
        }
        
        // Verificar si es muy similar (>80% igual)
        const isTooSimilar = existingTexts.some(existingText => {
          const similarity = calculateSimilarity(newText, existingText);
          if (similarity > 0.8) {
            if (DEBUG) console.log('❌ Duplicado similar detectado:', newQ.text.substring(0, 50), `(${(similarity * 100).toFixed(0)}% similar)`);
            return true;
          }
          return false;
        });
        
        return !isTooSimilar;
      });
      
      // Función auxiliar para calcular similitud
      function calculateSimilarity(str1, str2) {
        const words1 = str1.split(/\s+/);
        const words2 = str2.split(/\s+/);
        const commonWords = words1.filter(w => words2.includes(w));
        return commonWords.length / Math.max(words1.length, words2.length);
      }

      if (newQuestions.length === 0) {
        throw new Error('Todas las preguntas generadas eran duplicadas. Intenta de nuevo.');
      }

      const updatedTheme = {
        ...theme,
        questions: [...(theme.questions || []), ...newQuestions],
        lastGenerated: new Date().toISOString()
      };

      onUpdate(updatedTheme);

      const duplicatesFound = newQuestionsRaw.length - newQuestions.length;
      const message = duplicatesFound > 0 
        ? `✅ ${newQuestions.length} preguntas nuevas (${duplicatesFound} duplicadas filtradas)`
        : `✅ ¡${newQuestions.length} preguntas generadas!`;
      
      setGenerationProgress(message);
      setGenerationPercent(100);

      setTimeout(() => {
        setIsGeneratingQuestions(false);
        setGenerationProgress('');
        setGenerationPercent(0);
      }, 2000);

    } catch (error) {
      console.error('Error completo:', error);
      setIsGeneratingQuestions(false);
      setGenerationProgress('');
      setGenerationPercent(0);
      
      let errorMsg = error.message;
      if (errorMsg.includes('fetch')) {
        errorMsg = 'Error de conexión. Verifica tu internet.';
      } else if (errorMsg.includes('JSON')) {
        errorMsg = 'Error procesando respuesta. Intenta con menos contenido.';
      }
      
      alert(`❌ Error: ${errorMsg}\n\nSugerencias:\n- Usa "Buscar con IA" en lugar de subir PDF\n- Asegúrate de que los documentos tengan contenido de texto\n- Intenta con documentos más pequeños`);
    }
  };

  const handleAISearch = async () => {
    if (!docContent.trim()) {
      if (showToast) showToast('Describe qué información buscar', 'warning');
      return;
    }
    
    setIsSearching(true);
    setGenerationProgress('🔍 Buscando y procesando con IA...');
    setGenerationPercent(10);
    
    try {
      // UNA SOLA LLAMADA - Buscar Y procesar en un solo paso
      const response = await fetch("/api/generate-gemini", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: OPTIMIZED_SEARCH_PROMPT(docContent, theme.name),
          maxTokens: 8000
        })
      });

      setGenerationProgress('📝 Procesando respuesta...');
      setGenerationPercent(70);

      if (!response.ok) {
        throw new Error(`Error API: ${response.status}`);
      }

      const data = await response.json();
      
      let processedContent = '';
      for (const block of data.content) {
        if (block.type === 'text') {
          processedContent += block.text;
        }
      }

      if (!processedContent.trim() || processedContent.length < 500) {
        throw new Error('No se encontró suficiente información');
      }

      setGenerationProgress('💾 Guardando...');
      setGenerationPercent(90);

      const newDoc = {
        type: 'ai-search',
        content: docContent,
        processedContent: processedContent,
        quality: 'optimized',
        wordCount: processedContent.split(' ').length,
        addedAt: new Date().toISOString()
      };
      
      const updatedTheme = { 
        ...theme, 
        documents: [...(theme.documents || []), newDoc] 
      };
      
      onUpdate(updatedTheme);
      
      setGenerationProgress('✅ ¡Completado!');
      setGenerationPercent(100);
      
      setTimeout(() => {
        setDocContent('');
        setShowAddDoc(false);
        setIsSearching(false);
        setGenerationProgress('');
        setGenerationPercent(0);
      }, 1500);

    } catch (error) {
      console.error('Error en búsqueda IA:', error);
      setIsSearching(false);
      setGenerationProgress('');
      setGenerationPercent(0);
      
      let errorMsg = error.message;
      if (errorMsg.includes('fetch')) {
        errorMsg = 'Error de conexión. Verifica tu internet.';
      } else if (errorMsg.includes('JSON')) {
        errorMsg = 'Error procesando respuesta. Intenta de nuevo.';
      }
      
      alert(`❌ Error: ${errorMsg}`);
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    setIsSearching(true);
    setGenerationProgress('📄 Leyendo archivo...');
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = e.target.result;
        const textContent = content.substring(0, 50000);
        
        if (textContent.trim().length < 100) {
          throw new Error('El archivo tiene muy poco contenido de texto');
        }
        
        // OPTIMIZADO: Guardar directamente sin procesamiento extra
        // El contenido ya está extraído, la IA lo procesará cuando genere preguntas
        setGenerationProgress('💾 Guardando documento...');
        
        const newDoc = {
          type: 'pdf',
          fileName: file.name,
          content: textContent.substring(0, 35000), // Limitar a ~35k caracteres
          processedContent: textContent.substring(0, 35000),
          addedAt: new Date().toISOString()
        };
        
        const updatedTheme = {
          ...theme,
          documents: [...(theme.documents || []), newDoc]
        };
        
        onUpdate(updatedTheme);
        
        setGenerationProgress('✅ ¡Archivo guardado!');
        
        setTimeout(() => {
          setIsSearching(false);
          setGenerationProgress('');
          setShowAddDoc(false);
        }, 1500);
        
      } catch (error) {
        setIsSearching(false);
        setGenerationProgress('');
        alert(`Error: ${error.message}\n\nSugerencia: Usa "Buscar con IA" para mejores resultados.`);
      }
    };
    
    reader.onerror = () => {
      setIsSearching(false);
      setGenerationProgress('');
      alert('Error al leer el archivo.');
    };
    
    reader.readAsText(file);
    event.target.value = '';
  };

  const handleAddDocument = async () => {
    if (docType === 'ai-search') {
      handleAISearch();
      return;
    }
    
    if (!docContent.trim()) {
      alert('Introduce una URL o contenido');
      return;
    }
    
    // Si es URL, usar web_fetch para obtener contenido
    if (docType === 'url') {
      // Validar que sea una URL válida
      try {
        new URL(docContent);
      } catch (e) {
        alert('❌ URL inválida. Debe empezar con http:// o https://');
        return;
      }
      
      // Gemini no puede acceder directamente a URLs
      // Mostrar mensaje informativo
      if (showToast) {
        showToast('⚠️ La función de URLs requiere procesamiento especial. Por favor, copia el contenido de la página y pégalo en "Texto personalizado", o sube un archivo PDF/Word.', 'warning');
      }
      return;
      
      setIsSearching(true);
      setGenerationProgress('🌐 Obteniendo contenido de la web...');
      setGenerationPercent(20);
      
      try {
        const response = await fetch("/api/generate-gemini", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            prompt: `Obtén el contenido de esta URL y estructúralo para el tema "${theme.name}":

URL: ${docContent}

Extrae y estructura la información relevante:

# ${theme.name}

## CONTENIDO PRINCIPAL
[Conceptos, definiciones, puntos clave]

## DETALLES IMPORTANTES
[Datos, cifras, procedimientos]

## INFORMACIÓN COMPLEMENTARIA
[Casos prácticos, ejemplos]

Proporciona un documento completo con TODA la información del enlace.`,
            useWebSearch: true,
            maxTokens: 8000
          })
        });

        setGenerationProgress('📝 Procesando contenido...');
        setGenerationPercent(60);

        if (!response.ok) {
          throw new Error(`Error API: ${response.status}`);
        }

        const data = await response.json();
        
        let processedContent = '';
        for (const block of data.content) {
          if (block.type === 'text') {
            processedContent += block.text;
          }
        }

        if (!processedContent.trim() || processedContent.length < 200) {
          throw new Error('No se pudo obtener suficiente contenido de la URL. La página podría estar protegida o vacía.');
        }

        setGenerationProgress('💾 Guardando documento...');
        setGenerationPercent(90);

        const newDoc = {
          type: 'url',
          content: docContent,
          processedContent: processedContent,
          wordCount: processedContent.split(' ').length,
          addedAt: new Date().toISOString()
        };
        
        const updatedTheme = {
          ...theme,
          documents: [...(theme.documents || []), newDoc]
        };
        
        onUpdate(updatedTheme);
        
        setGenerationProgress('✅ ¡URL guardada!');
        setGenerationPercent(100);
        
        setTimeout(() => {
          setDocContent('');
          setShowAddDoc(false);
          setIsSearching(false);
          setGenerationProgress('');
          setGenerationPercent(0);
        }, 1500);

      } catch (error) {
        console.error('Error obteniendo URL:', error);
        setIsSearching(false);
        setGenerationProgress('');
        setGenerationPercent(0);
        
        let errorMsg = error.message;
        if (errorMsg.includes('fetch') || errorMsg.includes('network')) {
          errorMsg = 'Error de conexión. Verifica tu internet.';
        }
        
        alert(`❌ No se pudo procesar la URL\n\n${errorMsg}\n\n💡 Alternativas:\n• Usa "Buscar con IA" y describe el contenido\n• Copia y pega el texto en un archivo TXT\n• Verifica que la URL sea accesible públicamente`);
      }
    } else {
      // Guardar como texto simple
      const newDoc = {
        type: 'text',
        content: docContent,
        processedContent: docContent,
        addedAt: new Date().toISOString()
      };
      
      onUpdate({ 
        ...theme, 
        documents: [...(theme.documents || []), newDoc] 
      });
      
      setDocContent('');
      setShowAddDoc(false);
    }
  };

  const handleDeleteSelected = () => {
    if (selectedQuestions.size === 0) {
      alert('Selecciona al menos una pregunta');
      return;
    }
    
    setDeleteQuestionsConfirm({
      show: true,
      type: 'selected',
      count: selectedQuestions.size
    });
  };

  const handleDeleteAll = () => {
    setDeleteQuestionsConfirm({
      show: true,
      type: 'all',
      count: theme.questions?.length || 0
    });
  };
  
  const confirmDeleteQuestions = () => {
    if (deleteQuestionsConfirm.type === 'selected') {
      const newQuestions = theme.questions.filter(q => !selectedQuestions.has(q.id));
      onUpdate({
        ...theme,
        questions: newQuestions
      });
      setSelectedQuestions(new Set());
      setSelectMode(false);
    } else if (deleteQuestionsConfirm.type === 'all') {
      onUpdate({ ...theme, questions: [] });
      setSelectedQuestions(new Set());
      setSelectMode(false);
    }
    setDeleteQuestionsConfirm({ show: false, type: null, count: 0 });
  };

  const toggleSelectQuestion = (id) => {
    const newSelected = new Set(selectedQuestions);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedQuestions(newSelected);
  };

  const handleManualQuestionAdd = () => {
    if (!newQuestion.text.trim() || newQuestion.options.some(opt => !opt.trim())) {
      alert('Completa todos los campos');
      return;
    }

    const question = {
      id: `${theme.number}-manual-${Date.now()}`,
      ...newQuestion,
      source: 'Manual',
      needsReview: false,
      createdAt: new Date().toISOString()
    };

    onUpdate({
      ...theme,
      questions: [...(theme.questions || []), question]
    });

    setNewQuestion({
      text: '',
      options: ['', '', ''],
      correct: 0,
      difficulty: 'media'
    });
    setShowAddQuestion(false);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-hidden">
      <div 
        className="bg-slate-800 border border-white/10 rounded-3xl w-full max-w-3xl h-[90vh] flex flex-col"
        style={{ maxHeight: '90vh' }}
      >
        {/* HEADER FIJO */}
        <div className="flex-shrink-0 bg-slate-800 p-4 sm:p-6 border-b border-white/10">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h2 className="text-white font-bold text-lg sm:text-xl">Tema {theme.number}</h2>
                {theme.name === `Tema ${theme.number}` && (
                  <span className="bg-yellow-500/20 text-yellow-400 text-xs px-2 py-0.5 rounded-full">
                    Sin personalizar
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onKeyPress={handleNameKeyPress}
                  onBlur={handleSaveName}
                  className="flex-1 bg-white/5 text-gray-300 text-sm rounded-lg px-3 py-2 border border-white/10 focus:border-blue-500 focus:outline-none transition-colors"
                  placeholder="Ej: Constitución Española, Derecho Administrativo..."
                />
                {editingName !== theme.name && (
                  <button
                    onClick={handleSaveName}
                    className="bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-600 transition-colors flex items-center gap-1"
                  >
                    <Icons.Check />
                    Guardar
                  </button>
                )}
              </div>
              <p className="text-gray-500 text-xs mt-1">
                💡 Escribe un nombre y presiona Enter o click fuera para guardar
              </p>
            </div>
            <button onClick={onClose} className="bg-white/5 hover:bg-white/10 p-2 rounded-xl transition-colors flex-shrink-0">
              <Icons.X />
            </button>
          </div>
        </div>
        
        {/* CONTENIDO SCROLLEABLE */}
        <div 
          className="flex-1 overflow-y-auto overflow-x-hidden"
          style={{ 
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            maxHeight: 'calc(90vh - 140px)'
          }}
        >
          <div className="p-4 sm:p-6 space-y-6">
          {/* Contenido del modal */}
          {/* DOCUMENTOS */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-white font-semibold">Repositorio de Conocimiento</h3>
                <p className="text-gray-500 text-xs mt-1">
                  {theme.documents?.length > 0 
                    ? `${theme.documents.length} documento${theme.documents.length > 1 ? 's' : ''} optimizado${theme.documents.length > 1 ? 's' : ''}`
                    : 'Añade contenido estructurado para generar preguntas'}
                </p>
              </div>
              <button onClick={() => setShowAddDoc(!showAddDoc)} className="bg-blue-500 text-white px-4 py-2 rounded-xl text-sm flex items-center gap-2 hover:bg-blue-600 transition-colors">
                <Icons.Plus />Añadir
              </button>
            </div>

            {/* Sugerencia de auto-generación */}
            {showAutoGenerate && !isAutoGenerating && theme.documents?.length === 0 && (
              <div className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 border-2 border-green-500/40 rounded-xl p-4 mb-4 animate-pulse">
                <div className="flex items-start gap-3">
                  <span className="text-3xl">🤖</span>
                  <div className="flex-1">
                    <p className="text-green-300 font-bold text-sm mb-1">
                      ✨ Generación Automática Disponible
                    </p>
                    <p className="text-green-200 text-xs mb-3">
                      Detectamos que este tema se llama <strong>"{theme.name}"</strong>. 
                      ¿Quieres que busquemos y generemos un repositorio automático con contenido oficial?
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={handleAutoGenerateRepository}
                        disabled={isAutoGenerating}
                        className="bg-green-500 text-white font-bold text-xs px-4 py-2 rounded-lg hover:bg-green-400 transition-colors flex items-center gap-2"
                      >
                        <span>🚀</span> Generar Repositorio Automático
                      </button>
                      <button
                        onClick={() => setShowAutoGenerate(false)}
                        className="bg-white/10 text-gray-300 text-xs px-3 py-2 rounded-lg hover:bg-white/20 transition-colors"
                      >
                        Ahora no
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Loading auto-generación */}
            {isAutoGenerating && (
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                  <div className="flex-1">
                    <p className="text-blue-300 font-semibold text-sm">
                      Generando repositorio automático...
                    </p>
                    <p className="text-blue-200 text-xs mt-1">
                      Buscando información oficial sobre "{theme.name}"
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            {showAddDoc && (
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-4 space-y-3">
                <select value={docType} onChange={(e) => setDocType(e.target.value)} className="w-full bg-slate-800 text-white rounded-lg px-3 py-2 border border-white/10">
                  <option value="ai-search" className="bg-slate-800 text-white">🤖 Buscar con IA (Recomendado)</option>
                  <option value="text" className="bg-slate-800 text-white">📝 Pegar Texto Directamente</option>
                  <option value="url" className="bg-slate-800 text-white">🔗 Enlace Web</option>
                  <option value="pdf" className="bg-slate-800 text-white">📄 Subir Archivo (PDF/TXT)</option>
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
                      ></div>
                    </div>
                    {generationPercent < 100 && (
                      <p className="text-gray-400 text-xs text-center">
                        Esto puede tardar 15-30 segundos...
                      </p>
                    )}
                  </div>
                )}

                {docType === 'pdf' ? (
                  <div className="border-2 border-dashed border-white/20 rounded-lg p-6 text-center">
                    <input 
                      type="file" 
                      accept=".pdf,.txt,.doc,.docx"
                      onChange={handleFileUpload}
                      className="hidden" 
                      id="fileUpload"
                    />
                    <label htmlFor="fileUpload" className="cursor-pointer">
                      <div className="text-4xl mb-2">📁</div>
                      <p className="text-gray-300 text-sm">Click para subir archivo</p>
                    </label>
                  </div>
                ) : docType === 'ai-search' ? (
                  <div className="space-y-3">
                    <textarea 
                      placeholder="Ej: Busca la Ley 39/2015 del Procedimiento Administrativo Común completa"
                      value={docContent}
                      onChange={(e) => setDocContent(e.target.value)}
                      className="w-full bg-white/5 text-white rounded-lg px-3 py-3 border border-white/10 min-h-24 resize-none"
                      rows={3}
                    />
                    <button 
                      onClick={handleAISearch}
                      disabled={isSearching || !docContent.trim()}
                      className="w-full bg-gradient-to-r from-purple-500 to-blue-500 text-white font-semibold py-3 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50 hover:from-purple-600 hover:to-blue-600 transition-all"
                    >
                      {isSearching ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          Buscando...
                        </>
                      ) : '🔍 Buscar REAL con IA'}
                    </button>
                  </div>
                ) : docType === 'text' ? (
                  <div className="space-y-3">
                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 mb-2">
                      <p className="text-blue-400 text-xs">💡 Pega aquí el contenido completo de tu documento</p>
                      <p className="text-blue-300 text-xs mt-1">✓ Sin límite de caracteres • Acepta textos muy largos • Leyes completas, temarios extensos, etc.</p>
                    </div>
                    <textarea
                      placeholder="Pega aquí el texto completo del temario, ley, artículos, apuntes, documentos largos..."
                      value={docContent}
                      onChange={(e) => setDocContent(e.target.value)}
                      className="w-full bg-white/5 text-white rounded-lg px-3 py-3 border border-white/10 min-h-[400px] resize-vertical"
                      rows={20}
                    />
                    <div className="flex justify-between items-center">
                      <p className="text-gray-400 text-xs">
                        {docContent.trim().split(' ').length.toLocaleString()} palabras • {docContent.length.toLocaleString()} caracteres
                      </p>
                      <button 
                        onClick={handleAddDocument}
                        disabled={!docContent.trim()}
                        className="bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold py-3 px-6 rounded-lg disabled:opacity-50 hover:from-green-600 hover:to-emerald-700 transition-all"
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
                      onChange={(e) => setDocContent(e.target.value)}
                      className="w-full bg-white/5 text-white rounded-lg px-3 py-2 border border-white/10"
                      disabled={isSearching}
                    />
                    <button 
                      onClick={handleAddDocument}
                      disabled={isSearching || !docContent.trim()}
                      className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold py-3 rounded-lg disabled:opacity-50 hover:from-green-600 hover:to-emerald-700 transition-all flex items-center justify-center gap-2"
                    >
                      {isSearching ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          Procesando...
                        </>
                      ) : '🔗 Obtener Contenido de URL'}
                    </button>
                  </div>
                ) : null}
              </div>
            )}            
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
                            <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs font-semibold">
                              ✓ Optimizado
                            </span>
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
                        {doc.searchResults?.summary && (
                          <p className="text-gray-500 text-xs mt-1">{doc.searchResults.summary}</p>
                        )}
                        {doc.size && (
                          <p className="text-gray-600 text-xs mt-1">Tamaño: {doc.size}</p>
                        )}
                      </div>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          
                          if (DEBUG) console.log('Click en borrar - mostrando diálogo personalizado');
                          const docName = doc.fileName || (doc.type === 'ai-search' ? 'Búsqueda IA' : doc.type === 'url' ? 'Documento web' : 'Documento');
                          
                          setDeleteConfirm({
                            show: true,
                            docIndex: idx,
                            docName: docName
                          });
                        }}
                        className="ml-2 p-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 rounded-lg transition-all flex-shrink-0 active:scale-95"
                        title="Eliminar documento"
                      >
                        <Icons.Trash />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 bg-white/5 rounded-xl border border-dashed border-white/10">
                  <div className="text-4xl mb-3">📚</div>
                  <p className="text-gray-400 font-medium">No hay documentos en el repositorio</p>
                  <p className="text-gray-600 text-sm mt-1">Añade documentos o usa búsqueda IA para comenzar</p>
                </div>
              )}
            </div>
          </div>

          {/* BANCO DE PREGUNTAS */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white font-semibold">Preguntas ({theme.questions?.length || 0})</h3>
              <div className="flex gap-2">
                {theme.questions?.length > 0 && (
                  <>
                    <button 
                      onClick={() => setSelectMode(!selectMode)}
                      className="bg-orange-500 text-white px-3 py-2 rounded-xl text-xs font-semibold"
                    >
                      {selectMode ? 'Cancelar' : 'Seleccionar'}
                    </button>
                    {selectMode && (
                      <>
                        <button 
                          onClick={handleDeleteSelected}
                          disabled={selectedQuestions.size === 0}
                          className="bg-red-500 text-white px-3 py-2 rounded-xl text-xs font-semibold disabled:opacity-50"
                        >
                          Borrar ({selectedQuestions.size})
                        </button>
                        <button 
                          onClick={handleDeleteAll}
                          className="bg-red-700 text-white px-3 py-2 rounded-xl text-xs font-semibold"
                        >
                          Borrar Todo
                        </button>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-lg p-4 mb-4">
              <div className="flex gap-2 flex-wrap">
                <button 
                  onClick={generateQuestionsFromDocuments}
                  disabled={isGeneratingQuestions || !theme.documents?.length}
                  className="bg-green-500 text-white px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50 flex items-center gap-2"
                >
                  {isGeneratingQuestions ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      {generationPercent}%
                    </>
                  ) : '⚡ Generar 25 Preguntas con IA'}
                </button>
                
                <button 
                  onClick={() => setShowAddQuestion(!showAddQuestion)}
                  className="bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-semibold"
                >
                  <Icons.Plus /> Manual
                </button>
              </div>

              {isGeneratingQuestions && (
                <div className="mt-3 space-y-2">
                  <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                    <p className="text-blue-400 text-sm">{generationProgress}</p>
                  </div>
                  <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-green-500 to-blue-500 transition-all duration-500"
                      style={{ width: `${generationPercent}%` }}
                    ></div>
                  </div>
                </div>
              )}
            </div>
            {/* COMPONENTE DE IMPORTACIÓN DE PREGUNTAS */}
            <div className="bg-gradient-to-br from-purple-500/10 to-blue-500/10 border-2 border-purple-300/30 rounded-xl p-6 mb-4">
              <h3 className="text-lg font-semibold mb-4 text-purple-300 flex items-center gap-2">
                📥 Importar Preguntas
              </h3>
              
              {/* Plantillas */}
              <div className="mb-4 bg-white/5 rounded-lg p-4 border border-white/10">
                <p className="text-sm font-semibold text-gray-300 mb-2">
                  📋 Descargar plantillas:
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
                <p className="text-xs text-gray-400 mt-2">
                  Descarga la plantilla, rellénala con tus preguntas y súbela abajo
                </p>
              </div>

              {/* Input de archivo */}
              <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                <p className="text-sm font-semibold text-gray-300 mb-2">
                  📂 Subir archivo con preguntas:
                </p>
                <input
                  type="file"
                  accept=".xlsx,.xls,.txt"
                  onChange={async (e) => {
                    const file = e.target.files[0];
                    if (!file) return;

                    try {
                      setIsGeneratingQuestions(true);
                      setGenerationProgress('📥 Leyendo archivo...');
                      setGenerationPercent(10);

                      let questions;
                      
                      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
                        setGenerationProgress('📊 Procesando Excel...');
                        setGenerationPercent(30);
                        questions = await parseExcelQuestions(file);
                      } else if (file.name.endsWith('.txt')) {
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
                        setIsGeneratingQuestions(false);
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
                        setIsGeneratingQuestions(false);
                        setGenerationProgress('');
                        setGenerationPercent(0);
                      }, 3000);
                    }
                    
                    e.target.value = '';
                  }}
                  className="block w-full text-sm text-gray-300
                             file:mr-4 file:py-2.5 file:px-4 
                             file:rounded-lg file:border-0 
                             file:text-sm file:font-semibold 
                             file:bg-purple-500/20 file:text-purple-300 
                             hover:file:bg-purple-500/30 
                             file:cursor-pointer file:transition
                             cursor-pointer border-2 border-dashed border-purple-400/30 rounded-lg p-3
                             hover:border-purple-400/50 transition"
                />
                
                <div className="mt-3 bg-blue-500/10 border border-blue-400/30 rounded-lg p-3">
                  <p className="text-xs font-semibold text-blue-300 mb-1">
                    📝 Formatos soportados:
                  </p>
                  <ul className="text-xs text-blue-200 space-y-1">
                    <li>• <strong>Excel (.xlsx, .xls):</strong> Columnas: Pregunta | Opción A | Opción B | Opción C | Correcta | Dificultad</li>
                    <li>• <strong>Texto (.txt):</strong> Formato: PREGUNTA: ... / A) ... / B) ... / C) ... / CORRECTA: A / ---</li>
                  </ul>
                </div>
              </div>

              {theme.questions && theme.questions.length > 0 && (
                <div className="mt-4 bg-white/5 rounded-lg p-3 border border-white/10">
                  <p className="text-sm text-gray-300">
                    📊 Total de preguntas: <strong className="text-purple-300">{theme.questions.length}</strong>
                  </p>
                </div>
              )}
            </div>

            {showAddQuestion && (
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-4 space-y-3">
                <h4 className="text-white font-semibold text-sm">Nueva Pregunta</h4>
                <textarea 
                  placeholder="Pregunta..."
                  value={newQuestion.text}
                  onChange={(e) => setNewQuestion({...newQuestion, text: e.target.value})}
                  className="w-full bg-white/5 text-white rounded-lg px-3 py-2 border border-white/10 min-h-20 resize-none"
                />
                {newQuestion.options.map((opt, i) => (
                  <div key={i} className="flex gap-2">
                    <input 
                      type="radio"
                      checked={newQuestion.correct === i}
                      onChange={() => setNewQuestion({...newQuestion, correct: i})}
                      className="w-4 h-4 mt-1"
                    />
                    <input 
                      placeholder={`Opción ${String.fromCharCode(65 + i)}`}
                      value={opt}
                      onChange={(e) => {
                        const opts = [...newQuestion.options];
                        opts[i] = e.target.value;
                        setNewQuestion({...newQuestion, options: opts});
                      }}
                      className="flex-1 bg-white/5 text-white rounded-lg px-3 py-2 border border-white/10"
                    />
                  </div>
                ))}
                <select 
                  value={newQuestion.difficulty}
                  onChange={(e) => setNewQuestion({...newQuestion, difficulty: e.target.value})}
                  className="w-full bg-white/5 text-white rounded-lg px-3 py-2 border border-white/10"
                >
                  <option value="fácil">Fácil</option>
                  <option value="media">Media</option>
                  <option value="difícil">Difícil</option>
                </select>
                <div className="flex gap-2">
                  <button onClick={handleManualQuestionAdd} className="flex-1 bg-green-500 text-white font-semibold py-2 rounded-lg">
                    Guardar
                  </button>
                  <button onClick={() => setShowAddQuestion(false)} className="flex-1 bg-white/5 text-white py-2 rounded-lg">
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {/* Lista de preguntas - sin scroll interno, usa el del modal */}
              {theme.questions?.map((q, idx) => (
                <div key={q.id} className="bg-white/5 border border-white/10 rounded-lg p-3">
                  <div className="flex items-start gap-3">
                    {selectMode && (
                      <button
                        onClick={() => toggleSelectQuestion(q.id)}
                        className={`mt-1 w-5 h-5 rounded border-2 flex items-center justify-center ${
                          selectedQuestions.has(q.id) ? 'bg-blue-500 border-blue-500' : 'border-gray-500'
                        }`}
                      >
                        {selectedQuestions.has(q.id) && <Icons.Check />}
                      </button>
                    )}
                    <div className="flex-1">
                      <div className="flex gap-2 mb-1">
                        <span className="text-xs text-gray-500">Q{idx + 1}</span>
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          q.difficulty === 'fácil' ? 'bg-green-500/20 text-green-400' :
                          q.difficulty === 'media' ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-red-500/20 text-red-400'
                        }`}>
                          {q.difficulty}
                        </span>
                      </div>
                      <p className="text-gray-300 text-sm mb-2">{q.text}</p>
                      <div className="space-y-1">
                        {q.options.map((opt, i) => (
                          <div key={i} className={`text-xs px-2 py-1 rounded ${
                            i === q.correct ? 'bg-green-500/10 text-green-400' : 'text-gray-500'
                          }`}>
                            {i === q.correct ? '✓ ' : '○ '}{opt}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          </div>
          {/* Fin contenido scrolleable */}
        </div>
        {/* Fin contenedor scroll */}
      </div>
      {/* Fin modal */}
      
      {/* Diálogo de confirmación para documentos */}
      {deleteConfirm.show && (
        <div className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4" onClick={() => setDeleteConfirm({show: false, docIndex: null, docName: ''})}>
          <div className="bg-slate-800 border-2 border-red-500/50 rounded-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-white font-bold text-xl mb-3">⚠️ Confirmar Eliminación</h3>
            <p className="text-gray-300 mb-2">¿Estás seguro de que quieres eliminar este documento?</p>
            <p className="text-blue-400 font-semibold mb-4">📄 {deleteConfirm.docName}</p>
            <p className="text-red-400 text-sm mb-6">Esta acción NO se puede deshacer.</p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  if (DEBUG) console.log('Confirmando eliminación...');
                  const newDocs = theme.documents.filter((_, i) => i !== deleteConfirm.docIndex);
                  const updatedTheme = {...theme, documents: newDocs};
                  if (DEBUG) console.log('Docs antes:', theme.documents.length, 'después:', newDocs.length);
                  onUpdate(updatedTheme);
                  setDeleteConfirm({show: false, docIndex: null, docName: ''});
                  if (showToast) showToast('Documento eliminado correctamente', 'success');
                }}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-3 rounded-xl transition-colors"
              >
                🗑️ SÍ, ELIMINAR
              </button>
              <button
                onClick={() => setDeleteConfirm({show: false, docIndex: null, docName: ''})}
                className="flex-1 bg-white/10 hover:bg-white/20 text-white font-semibold py-3 rounded-xl transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Diálogo de confirmación para preguntas */}
      {deleteQuestionsConfirm.show && (
        <div className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4" onClick={() => setDeleteQuestionsConfirm({show: false, type: null, count: 0})}>
          <div className="bg-slate-800 border-2 border-red-500/50 rounded-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-white font-bold text-xl mb-3">⚠️ Confirmar Eliminación</h3>
            <p className="text-gray-300 mb-2">
              {deleteQuestionsConfirm.type === 'all' 
                ? '¿Estás seguro de que quieres eliminar TODAS las preguntas?' 
                : `¿Estás seguro de que quieres eliminar ${deleteQuestionsConfirm.count} preguntas?`}
            </p>
            <p className="text-red-400 text-sm mb-6">Esta acción NO se puede deshacer.</p>
            <div className="flex gap-3">
              <button
                onClick={confirmDeleteQuestions}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-3 rounded-xl transition-colors"
              >
                🗑️ SÍ, ELIMINAR
              </button>
              <button
                onClick={() => setDeleteQuestionsConfirm({show: false, type: null, count: 0})}
                className="flex-1 bg-white/10 hover:bg-white/20 text-white font-semibold py-3 rounded-xl transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


export default ThemeDetailModal;
