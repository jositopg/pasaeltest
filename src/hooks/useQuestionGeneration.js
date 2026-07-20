import { useState } from 'react';
import { generateCombined, generateFromDocuments } from '../utils/questionGenerator';

export default function useQuestionGeneration({ theme, onUpdate, showToast }) {
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);
  const [generationProgress, setGenerationProgress] = useState('');
  const [generationPercent, setGenerationPercent] = useState(0);

  // ─── Sin material propio: material + preguntas en 1 llamada ──
  const generateCombinedFlow = async () => {
    if (!theme.name || theme.name === `Tema ${theme.number}`) {
      if (showToast) showToast('Ponle nombre al tema primero para generar preguntas con IA', 'warning');
      return;
    }
    setIsGeneratingQuestions(true);
    setGenerationProgress('🤖 Generando material y preguntas con IA...');
    setGenerationPercent(15);
    try {
      const { newDoc, newQuestions } = await generateCombined(theme, {
        onProgress: (evt) => {
          if (evt.step === 'fallback-questions') {
            setGenerationProgress('🤖 Generando preguntas a partir del material...');
            setGenerationPercent(85);
          }
        },
      });
      const themeWithDoc = { ...theme, documents: [...(theme.documents || []), newDoc] };
      if (newQuestions.length > 0) {
        onUpdate({ ...themeWithDoc, questions: [...(themeWithDoc.questions || []), ...newQuestions] });
        if (showToast) showToast(`✅ ${newQuestions.length} pregunta${newQuestions.length !== 1 ? 's' : ''} guardada${newQuestions.length !== 1 ? 's' : ''}`, 'success');
      } else {
        onUpdate(themeWithDoc);
      }
      setGenerationProgress(`✅ ${newQuestions.length} preguntas guardadas`);
      setGenerationPercent(100);
    } catch (error) {
      console.error('Error generando material+preguntas:', error);
      if (showToast) showToast(`❌ ${error.message}`, 'error');
    } finally {
      setIsGeneratingQuestions(false); setGenerationProgress(''); setGenerationPercent(0);
    }
  };

  // ─── Con material propio: chunking por partes ─────────────
  const generateFromDocumentsFlow = async (docs) => {
    setIsGeneratingQuestions(true);
    setGenerationProgress('📚 Recopilando contenido...');
    setGenerationPercent(10);
    try {
      const { newQuestions, chunkCount, regeneratedDoc } = await generateFromDocuments(theme, docs, {
        onProgress: (evt) => {
          if (evt.step === 'regenerating-repo') {
            setGenerationProgress('🔄 Repositorio insuficiente, regenerando...');
            setGenerationPercent(15);
          } else if (evt.step === 'chunk') {
            setGenerationProgress(`🤖 Analizando parte ${evt.index + 1} de ${evt.total}...`);
            setGenerationPercent(20 + Math.round((evt.index / evt.total) * 70));
          }
        },
      });

      const documents = regeneratedDoc
        ? [regeneratedDoc, ...(docs || []).filter(d => d.processedContent?.trim().length > 100)]
        : theme.documents;
      onUpdate({ ...theme, documents, questions: [...(Array.isArray(theme.questions) ? theme.questions : []), ...newQuestions] });

      setGenerationProgress(`✅ ${newQuestions.length} preguntas guardadas`);
      setGenerationPercent(100);
      if (showToast) showToast(`✅ ${newQuestions.length} pregunta${newQuestions.length !== 1 ? 's' : ''} generada${newQuestions.length !== 1 ? 's' : ''} (${chunkCount} parte${chunkCount !== 1 ? 's' : ''})`, 'success');
    } catch (error) {
      console.error('Error generando preguntas:', error);
      let errorMsg = error.message;
      if (errorMsg.includes('503')) errorMsg = 'Gemini saturado en este momento. Espera unos minutos e inténtalo de nuevo.';
      else if (errorMsg.includes('fetch')) errorMsg = 'Error de conexión. Verifica tu internet.';
      else if (errorMsg.includes('JSON')) errorMsg = 'Error procesando respuesta. Intenta de nuevo.';
      if (showToast) showToast(`❌ ${errorMsg}`, 'error');
    } finally {
      setIsGeneratingQuestions(false); setGenerationProgress(''); setGenerationPercent(0);
    }
  };

  // ─── Punto de entrada: elige combinado o desde documentos ──
  const generateQuestionsFromDocuments = async (docsToUse = null) => {
    const docs = Array.isArray(docsToUse) ? docsToUse : (Array.isArray(theme.documents) ? theme.documents : []);
    if (docs.length === 0) return generateCombinedFlow();
    return generateFromDocumentsFlow(docs);
  };

  return {
    isGeneratingQuestions,
    qGenerationProgress: generationProgress,
    qGenerationPercent: generationPercent,
    generateQuestionsFromDocuments,
  };
}
