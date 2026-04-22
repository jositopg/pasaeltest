import { useState } from 'react';
import { OPTIMIZED_QUESTION_PROMPT, OPTIMIZED_PHASE2_PROMPT, OPTIMIZED_AUTO_GENERATE_PROMPT, COMBINED_AUTO_AND_QUESTIONS_PROMPT } from '../utils/optimizedPrompts';
import { analyzeDocument, determineQuestionTypes } from '../utils/documentAnalyzer';
import { QUESTIONS_PER_BATCH } from '../utils/constants';
import { parseCombinedResponse, parseQuestionsResponse, mapRawQuestions, deduplicateQuestions, buildDocumentContents } from '../utils/geminiHelpers';
import { authHelpers } from '../supabaseClient';

/**
 * Gestiona todo el flujo de generación de preguntas con IA:
 * - Generación desde documentos existentes
 * - Generación combinada (material + preguntas) cuando no hay docs
 * - Preguntas pendientes de confirmación (overlay de revisión)
 */
export default function useQuestionGeneration({ theme, onUpdate, showToast }) {
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);
  const [generationProgress, setGenerationProgress] = useState('');
  const [generationPercent, setGenerationPercent] = useState(0);
  const [pendingQuestions, setPendingQuestions] = useState(null);
  const [pendingDuplicates, setPendingDuplicates] = useState(0);

  // ─── Normalizar y deduplicar preguntas crudas ──────────────
  // Callback compartido con useDocumentManager (onQuestionsReady)
  const onQuestionsReady = (rawPreguntas, baseTheme = null) => {
    const t = baseTheme || theme;
    if (!Array.isArray(rawPreguntas) || rawPreguntas.length === 0) return 0;
    const existingTexts = (Array.isArray(t.questions) ? t.questions : []).map(q => q.text.toLowerCase().trim());
    const rawQuestions = mapRawQuestions(rawPreguntas, t.number);
    const newQuestions = deduplicateQuestions(rawQuestions, existingTexts);
    if (newQuestions.length > 0) {
      onUpdate({ ...t, questions: [...(Array.isArray(t.questions) ? t.questions : []), ...newQuestions] });
      if (showToast) showToast(`✅ ${newQuestions.length} pregunta${newQuestions.length !== 1 ? 's' : ''} guardada${newQuestions.length !== 1 ? 's' : ''}`, 'success');
    }
    return newQuestions.length;
  };

  // ─── Llamada a la API de generación ──────────────────────
  const callGenerationAPI = async (documentContents, existingTexts, coverageInstruction = null) => {
    const existingQuestionsStr = existingTexts.join('\n');
    const analysis = analyzeDocument(documentContents);
    const significantSections = analysis.sections.filter(s => s.level === 'critical' || s.level === 'high');
    const usePhase2 = significantSections.length >= 2 && !coverageInstruction;
    let prompt;
    if (usePhase2) {
      const topSection = significantSections[0];
      const sectionMeta = { index: 0, total: significantSections.length, title: topSection.title, type: topSection.type, level: topSection.level };
      const questionTypes = determineQuestionTypes(topSection);
      prompt = OPTIMIZED_PHASE2_PROMPT(theme.name, sectionMeta, QUESTIONS_PER_BATCH, documentContents, existingQuestionsStr, questionTypes);
    } else {
      prompt = OPTIMIZED_QUESTION_PROMPT(theme.name, QUESTIONS_PER_BATCH, documentContents, existingQuestionsStr, coverageInstruction);
    }
    const token = await authHelpers.getAccessToken();
    const response = await fetch('/api/generate-gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token && { 'Authorization': `Bearer ${token}` }) },
      body: JSON.stringify({ prompt, useWebSearch: false, maxTokens: 12000, callType: 'questions' }),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error API (${response.status}): ${errorText.substring(0, 200)}`);
    }
    const data = await response.json();
    if (!Array.isArray(data.content)) throw new Error('Respuesta de la IA inválida o vacía. Reintenta.');
    let textContent = '';
    for (const block of data.content) { if (block.type === 'text') textContent += block.text; }
    if (!textContent) throw new Error('La IA no devolvió contenido');
    const parsed = parseQuestionsResponse(textContent);
    if (!parsed.length) throw new Error('No se pudo extraer JSON o la IA no generó preguntas válidas');
    const rawQuestions = mapRawQuestions(parsed, theme.number);
    const newQuestions = deduplicateQuestions(rawQuestions, existingTexts);
    return { newQuestions, duplicatesFound: rawQuestions.length - newQuestions.length };
  };

  // ─── Generación principal ─────────────────────────────────
  const generateQuestionsFromDocuments = async (docsToUse = null) => {
    const docs = Array.isArray(docsToUse) ? docsToUse : (Array.isArray(theme.documents) ? theme.documents : []);

    if (docs.length === 0) {
      // Sin material: llamada combinada (material + preguntas en 1 llamada)
      if (!theme.name || theme.name === `Tema ${theme.number}`) {
        if (showToast) showToast('Ponle nombre al tema primero para generar preguntas con IA', 'warning');
        return;
      }
      setIsGeneratingQuestions(true);
      setGenerationProgress('🤖 Generando material y preguntas con IA...');
      setGenerationPercent(15);
      try {
        const token = await authHelpers.getAccessToken();
        const response = await fetch('/api/generate-gemini', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(token && { 'Authorization': `Bearer ${token}` }) },
          body: JSON.stringify({ prompt: COMBINED_AUTO_AND_QUESTIONS_PROMPT(theme.name), maxTokens: 12000, callType: 'repo', useCache: false }),
        });
        if (!response.ok) throw new Error(`Error API (${response.status})`);
        const data = await response.json();
        if (!Array.isArray(data.content)) throw new Error('Respuesta de la IA inválida');
        let responseText = '';
        for (const block of data.content) { if (block.type === 'text') responseText += block.text; }

        setGenerationPercent(60);
        setGenerationProgress('📝 Procesando respuesta...');

        const { material, preguntas } = parseCombinedResponse(responseText);
        const processedContent = material || responseText;

        const newDoc = processedContent.trim().length >= 100 ? {
          type: 'ai-search', content: theme.name,
          fileName: `Repositorio: ${theme.name}`,
          addedAt: new Date().toISOString(),
          searchResults: { query: theme.name, content: processedContent, processedContent },
          processedContent,
        } : null;
        const themeWithDoc = newDoc
          ? { ...theme, documents: [...(theme.documents || []), newDoc] }
          : theme;

        setGenerationPercent(80);

        if (preguntas?.length) {
          const saved = onQuestionsReady(preguntas, themeWithDoc);
          if (!saved) onUpdate(themeWithDoc);
          setGenerationProgress(`✅ ${preguntas.length} preguntas guardadas`);
          setGenerationPercent(100);
          setIsGeneratingQuestions(false); setGenerationProgress(''); setGenerationPercent(0);
        } else {
          setGenerationProgress('🤖 Generando preguntas a partir del material...');
          setGenerationPercent(85);
          const existingTexts = (Array.isArray(themeWithDoc.questions) ? themeWithDoc.questions : []).map(q => q.text.toLowerCase().trim());
          const { newQuestions, duplicatesFound } = await callGenerationAPI(processedContent, existingTexts);
          if (newQuestions.length === 0) {
            onUpdate(themeWithDoc);
            throw new Error('No se generaron preguntas válidas. Intenta de nuevo.');
          }
          onUpdate({ ...themeWithDoc, questions: [...(themeWithDoc.questions || []), ...newQuestions] });
          setGenerationProgress(`✅ ${newQuestions.length} preguntas guardadas`);
          setGenerationPercent(100);
          if (duplicatesFound > 0 && showToast) showToast(`${duplicatesFound} duplicadas descartadas`, 'info');
          setIsGeneratingQuestions(false); setGenerationProgress(''); setGenerationPercent(0);
        }
      } catch (error) {
        console.error('Error generando material+preguntas:', error);
        setIsGeneratingQuestions(false); setGenerationProgress(''); setGenerationPercent(0);
        if (showToast) showToast(`❌ ${error.message}`, 'error');
      }
      return;
    }

    setIsGeneratingQuestions(true);
    setGenerationProgress('📚 Recopilando contenido...');
    setGenerationPercent(10);
    try {
      let documentContents = buildDocumentContents(docs);
      if (documentContents.trim().length < 100 && docs.length > 0) {
        setGenerationProgress('🔄 Repositorio insuficiente, regenerando...');
        setGenerationPercent(15);
        try {
          const token = await authHelpers.getAccessToken();
          const repoResp = await fetch('/api/generate-gemini', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...(token && { 'Authorization': `Bearer ${token}` }) },
            body: JSON.stringify({ prompt: OPTIMIZED_AUTO_GENERATE_PROMPT(theme.name), maxTokens: 8000, callType: 'repo' }),
          });
          if (repoResp.ok) {
            const repoData = await repoResp.json();
            if (Array.isArray(repoData.content)) {
              let repoText = '';
              for (const block of repoData.content) { if (block.type === 'text') repoText += block.text; }
              if (repoText.trim().length > 100) {
                const fixedDoc = {
                  type: 'ai-search', content: theme.name,
                  fileName: `Repositorio: ${theme.name}`,
                  processedContent: repoText,
                  searchResults: { query: theme.name, content: repoText, processedContent: repoText },
                  addedAt: new Date().toISOString(),
                };
                onUpdate({ ...theme, documents: [fixedDoc, ...(Array.isArray(docs) ? docs : []).filter(d => d.processedContent?.trim().length > 100)] });
                documentContents = repoText;
              }
            }
          }
        } catch { /* fall through */ }
      }
      if (documentContents.trim().length < 100) {
        const docInfo = docs.map(d => `[${d.type}:pc=${d.processedContent?.length ?? 0}]`).join(', ');
        throw new Error(`Sin contenido (${docs.length} doc${docs.length !== 1 ? 's' : ''}: ${docInfo}). Regenera el repositorio.`);
      }
      setGenerationProgress(`🤖 Generando ${QUESTIONS_PER_BATCH} preguntas...`);
      setGenerationPercent(30);
      const existingTexts = (Array.isArray(theme.questions) ? theme.questions : []).map(q => q.text.toLowerCase().trim());
      const { newQuestions, duplicatesFound } = await callGenerationAPI(documentContents, existingTexts);
      if (newQuestions.length === 0) throw new Error('Todas las preguntas generadas eran duplicadas. Intenta de nuevo.');
      onUpdate({ ...theme, questions: [...(Array.isArray(theme.questions) ? theme.questions : []), ...newQuestions] });
      setGenerationProgress(`✅ ${newQuestions.length} preguntas guardadas`);
      setGenerationPercent(100);
      if (showToast) showToast(`✅ ${newQuestions.length} pregunta${newQuestions.length !== 1 ? 's' : ''} generada${newQuestions.length !== 1 ? 's' : ''}`, 'success');
      if (duplicatesFound > 0 && showToast) showToast(`${duplicatesFound} duplicadas descartadas`, 'info');
      setIsGeneratingQuestions(false); setGenerationProgress(''); setGenerationPercent(0);
    } catch (error) {
      console.error('Error generando preguntas:', error);
      setIsGeneratingQuestions(false); setGenerationProgress(''); setGenerationPercent(0);
      let errorMsg = error.message;
      if (errorMsg.includes('fetch')) errorMsg = 'Error de conexión. Verifica tu internet.';
      else if (errorMsg.includes('JSON')) errorMsg = 'Error procesando respuesta. Intenta de nuevo.';
      if (showToast) showToast(`❌ ${errorMsg}`, 'error');
    }
  };

  // ─── Confirmar / descartar preguntas pendientes ──────────
  const confirmPendingQuestions = (selectedIndices) => {
    const toSave = selectedIndices !== null
      ? pendingQuestions.filter((_, i) => selectedIndices.has(i))
      : pendingQuestions;
    onUpdate({
      ...theme,
      questions: [...(Array.isArray(theme.questions) ? theme.questions : []), ...toSave],
      lastGenerated: new Date().toISOString(),
    });
    if (showToast) showToast(`✅ ${toSave.length} pregunta${toSave.length !== 1 ? 's' : ''} guardada${toSave.length !== 1 ? 's' : ''}`, 'success');
    setPendingQuestions(null);
    setPendingDuplicates(0);
  };

  const discardPendingQuestions = () => {
    setPendingQuestions(null);
    setPendingDuplicates(0);
    if (showToast) showToast('Preguntas descartadas', 'info');
  };

  return {
    isGeneratingQuestions,
    qGenerationProgress: generationProgress,
    qGenerationPercent: generationPercent,
    pendingQuestions, pendingDuplicates,
    onQuestionsReady,
    generateQuestionsFromDocuments,
    confirmPendingQuestions, discardPendingQuestions,
  };
}
