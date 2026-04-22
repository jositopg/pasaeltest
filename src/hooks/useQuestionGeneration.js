import { useState } from 'react';
import { OPTIMIZED_QUESTION_PROMPT, OPTIMIZED_PHASE2_PROMPT, OPTIMIZED_AUTO_GENERATE_PROMPT, COMBINED_AUTO_AND_QUESTIONS_PROMPT } from '../utils/optimizedPrompts';
import { analyzeDocument, determineQuestionTypes } from '../utils/documentAnalyzer';
import { QUESTIONS_PER_BATCH, MAX_PROMPT_CHARS } from '../utils/constants';
import { parseCombinedResponse, parseQuestionsResponse, mapRawQuestions, deduplicateQuestions, buildDocumentContents, splitIntoChunks } from '../utils/geminiHelpers';
import { authHelpers } from '../supabaseClient';

// Preguntas por chunk cuando hay múltiples partes (para no generar demasiadas)
const QUESTIONS_PER_CHUNK = 15;

const CLIENT_RETRY_DELAYS = [20, 40]; // segundos entre reintentos del cliente

export default function useQuestionGeneration({ theme, onUpdate, showToast }) {
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);
  const [generationProgress, setGenerationProgress] = useState('');
  const [generationPercent, setGenerationPercent] = useState(0);
  const [pendingQuestions, setPendingQuestions] = useState(null);
  const [pendingDuplicates, setPendingDuplicates] = useState(0);

  // ─── Normalizar y deduplicar preguntas crudas ──────────────
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

  // ─── Countdown mientras espera reintento ──────────────────
  const waitWithCountdown = async (seconds, attempt) => {
    for (let s = seconds; s > 0; s--) {
      setGenerationProgress(`⏳ Gemini ocupado (intento ${attempt + 1}/${CLIENT_RETRY_DELAYS.length}) — reintentando en ${s}s...`);
      await new Promise(r => setTimeout(r, 1000));
    }
  };

  // ─── Llamada individual a la API para un chunk de contenido ──
  const callChunkAPI = async (chunkContent, numQuestions, existingTexts, coverageInstruction = null) => {
    const existingQuestionsStr = existingTexts.join('\n');
    const analysis = analyzeDocument(chunkContent);
    const significantSections = analysis.sections.filter(s => s.level === 'critical' || s.level === 'high');
    const usePhase2 = significantSections.length >= 2 && !coverageInstruction;
    let prompt;
    if (usePhase2) {
      const topSection = significantSections[0];
      const sectionMeta = { index: 0, total: significantSections.length, title: topSection.title, type: topSection.type, level: topSection.level };
      const questionTypes = determineQuestionTypes(topSection);
      prompt = OPTIMIZED_PHASE2_PROMPT(theme.name, sectionMeta, numQuestions, chunkContent, existingQuestionsStr, questionTypes);
    } else {
      prompt = OPTIMIZED_QUESTION_PROMPT(theme.name, numQuestions, chunkContent, existingQuestionsStr, coverageInstruction);
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
    if (!parsed.length) throw new Error('No se pudo extraer JSON de la respuesta');
    return mapRawQuestions(parsed, theme.number);
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
          const rawQuestions = await callChunkAPI(processedContent.substring(0, MAX_PROMPT_CHARS), QUESTIONS_PER_BATCH, existingTexts);
          const newQuestions = deduplicateQuestions(rawQuestions, existingTexts);
          if (newQuestions.length === 0) {
            onUpdate(themeWithDoc);
            throw new Error('No se generaron preguntas válidas. Intenta de nuevo.');
          }
          onUpdate({ ...themeWithDoc, questions: [...(themeWithDoc.questions || []), ...newQuestions] });
          setGenerationProgress(`✅ ${newQuestions.length} preguntas guardadas`);
          setGenerationPercent(100);
          setIsGeneratingQuestions(false); setGenerationProgress(''); setGenerationPercent(0);
        }
      } catch (error) {
        console.error('Error generando material+preguntas:', error);
        setIsGeneratingQuestions(false); setGenerationProgress(''); setGenerationPercent(0);
        if (showToast) showToast(`❌ ${error.message}`, 'error');
      }
      return;
    }

    // ─── Con material propio: chunking por partes ─────────────
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

      // Dividir en chunks y procesar cada parte
      const chunks = splitIntoChunks(documentContents, MAX_PROMPT_CHARS);
      const numQuestions = chunks.length === 1 ? QUESTIONS_PER_BATCH : QUESTIONS_PER_CHUNK;

      let accumulatedTexts = (Array.isArray(theme.questions) ? theme.questions : []).map(q => q.text.toLowerCase().trim());
      let allNewQuestions = [];
      let totalDuplicates = 0;

      for (let i = 0; i < chunks.length; i++) {
        setGenerationProgress(`🤖 Analizando parte ${i + 1} de ${chunks.length}...`);
        setGenerationPercent(20 + Math.round(((i) / chunks.length) * 70));

        let chunkDone = false;
        for (let clientRetry = 0; clientRetry <= CLIENT_RETRY_DELAYS.length; clientRetry++) {
          try {
            const rawQuestions = await callChunkAPI(chunks[i], numQuestions, accumulatedTexts);
            const newForChunk = deduplicateQuestions(rawQuestions, accumulatedTexts);
            allNewQuestions = [...allNewQuestions, ...newForChunk];
            accumulatedTexts = [...accumulatedTexts, ...newForChunk.map(q => q.text.toLowerCase().trim())];
            totalDuplicates += rawQuestions.length - newForChunk.length;
            chunkDone = true;
            break;
          } catch (chunkErr) {
            const is503 = chunkErr.message.includes('503');
            if (is503 && clientRetry < CLIENT_RETRY_DELAYS.length) {
              await waitWithCountdown(CLIENT_RETRY_DELAYS[clientRetry], clientRetry);
              setGenerationProgress(`🤖 Analizando parte ${i + 1} de ${chunks.length}...`);
              continue;
            }
            console.warn(`Chunk ${i + 1} falló:`, chunkErr.message);
            if (chunks.length === 1) throw chunkErr;
            break;
          }
        }
        if (!chunkDone && chunks.length === 1) throw new Error('Gemini no disponible tras varios intentos. Prueba en unos minutos.');
      }

      if (allNewQuestions.length === 0) throw new Error('No se generaron preguntas válidas. Intenta de nuevo.');

      onUpdate({ ...theme, questions: [...(Array.isArray(theme.questions) ? theme.questions : []), ...allNewQuestions] });
      setGenerationProgress(`✅ ${allNewQuestions.length} preguntas guardadas`);
      setGenerationPercent(100);
      if (showToast) showToast(`✅ ${allNewQuestions.length} pregunta${allNewQuestions.length !== 1 ? 's' : ''} generada${allNewQuestions.length !== 1 ? 's' : ''} (${chunks.length} parte${chunks.length !== 1 ? 's' : ''})`, 'success');
      if (totalDuplicates > 0 && showToast) showToast(`${totalDuplicates} duplicadas descartadas`, 'info');
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
