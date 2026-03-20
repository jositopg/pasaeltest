import { useState, useRef, useCallback } from 'react';
import { OPTIMIZED_QUESTION_PROMPT, COMBINED_AUTO_AND_QUESTIONS_PROMPT } from '../utils/optimizedPrompts';
import { QUESTIONS_PER_BATCH } from '../utils/constants';
import { buildContent, parseQuestionsResponse, mapRawQuestions, deduplicateQuestions, parseCombinedResponse } from '../utils/geminiHelpers';
import { authHelpers } from '../supabaseClient';

/**
 * Persistent generation queue — lives in App.jsx so navigation doesn't kill ongoing jobs.
 */
export default function useGenerationQueue({ themesRef, onUpdateTheme, showToast }) {
  const [generatingQuestions, setGeneratingQuestions] = useState({});
  const [generatingAll, setGeneratingAll] = useState(false);
  const [queueProgress, setQueueProgress] = useState(null);

  const isRunningRef = useRef(false);
  const inProgressRef = useRef(new Set());

  // ─── Generación combinada (material + preguntas en 1 llamada) ──
  // Usada cuando el tema no tiene documentos todavía.
  const generateCombinedInline = useCallback(async (theme) => {
    const key = `combined-${theme.number}`;
    if (inProgressRef.current.has(key)) return 'already running';
    inProgressRef.current.add(key);
    setGeneratingQuestions(prev => ({ ...prev, [theme.number]: 'loading' }));

    try {
      const token = await authHelpers.getAccessToken();
      const response = await fetch('/api/generate-gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token && { 'Authorization': `Bearer ${token}` }) },
        body: JSON.stringify({ prompt: COMBINED_AUTO_AND_QUESTIONS_PROMPT(theme.name, QUESTIONS_PER_BATCH), maxTokens: 12000, callType: 'repo', useCache: false }),
      });
      if (!response.ok) throw new Error(`API ${response.status}`);
      const data = await response.json();
      if (!Array.isArray(data.content)) throw new Error('Respuesta de la IA inválida. Reintenta.');
      let responseText = '';
      for (const block of data.content) { if (block.type === 'text') responseText += block.text; }

      const { material, preguntas: rawPreguntas } = parseCombinedResponse(responseText);
      const processedContent = material || responseText;
      if (processedContent.trim().length < 100) throw new Error('Contenido insuficiente de la IA');

      const newDoc = {
        type: 'ai-search', content: theme.name,
        fileName: `Material: ${theme.name}`,
        addedAt: new Date().toISOString(),
        searchResults: { query: theme.name, content: processedContent, processedContent },
        processedContent,
      };

      const latestTheme = themesRef.current.find(t => t.number === theme.number) || theme;
      const existingTexts = (latestTheme.questions || []).map(q => q.text.toLowerCase().trim());
      let newQuestions = [];
      if (rawPreguntas?.length) {
        const raw = mapRawQuestions(rawPreguntas, theme.number);
        newQuestions = deduplicateQuestions(raw, existingTexts);
      }

      // Fallback: si no se parsearon preguntas, hacer segunda llamada con el material como contexto
      if (newQuestions.length === 0) {
        const fallbackPrompt = OPTIMIZED_QUESTION_PROMPT(theme.name, QUESTIONS_PER_BATCH, processedContent.substring(0, 15000), '');
        const fallbackToken = await authHelpers.getAccessToken();
        const fallbackRes = await fetch('/api/generate-gemini', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(fallbackToken && { 'Authorization': `Bearer ${fallbackToken}` }) },
          body: JSON.stringify({ prompt: fallbackPrompt, maxTokens: 8000, callType: 'questions' }),
        });
        if (fallbackRes.ok) {
          const fallbackData = await fallbackRes.json();
          if (Array.isArray(fallbackData.content)) {
            let fallbackText = '';
            for (const block of fallbackData.content) { if (block.type === 'text') fallbackText += block.text; }
            const fallbackParsed = parseQuestionsResponse(fallbackText);
            if (fallbackParsed.length) {
              const raw = mapRawQuestions(fallbackParsed, theme.number);
              newQuestions = deduplicateQuestions(raw, existingTexts);
            }
          }
        }
      }

      onUpdateTheme({
        ...latestTheme,
        documents: [...(latestTheme.documents || []), newDoc],
        questions: [...(latestTheme.questions || []), ...newQuestions],
      });

      inProgressRef.current.delete(key);
      setGeneratingQuestions(prev => ({ ...prev, [theme.number]: 'done' }));
      if (newQuestions.length > 0) {
        showToast?.(`✅ ${newQuestions.length} preguntas generadas para "${theme.name}"`, 'success');
      } else {
        showToast?.(`✅ Material generado para "${theme.name}" (sin preguntas)`, 'warning');
      }
      return null;
    } catch (e) {
      const reason = e.message || 'Error desconocido';
      console.error(`Error generando "${theme.name}":`, e);
      inProgressRef.current.delete(key);
      setGeneratingQuestions(prev => ({ ...prev, [theme.number]: 'error' }));
      showToast?.(`Error generando "${theme.name}": ${reason}`, 'error');
      return reason;
    }
  }, [themesRef, onUpdateTheme, showToast]);

  // ─── Generación de preguntas desde docs existentes ────────
  // Usada cuando el tema ya tiene documentos (PDF, URL, texto).
  const generateQuestionsInline = useCallback(async (theme) => {
    const key = `q-${theme.number}`;
    if (inProgressRef.current.has(key)) return 'already running';
    inProgressRef.current.add(key);
    setGeneratingQuestions(prev => ({ ...prev, [theme.number]: 'loading' }));

    try {
      const latestTheme = themesRef.current.find(t => t.number === theme.number) || theme;
      if (!latestTheme.documents?.length) throw new Error('El tema no tiene documentos');

      const { text: documentContents, docsUsed, docsSkipped } = buildContent(latestTheme.documents);

      const token = await authHelpers.getAccessToken();
      const authHeader = token ? { 'Authorization': `Bearer ${token}` } : {};

      if (documentContents.trim().length < 100) {
        const reason = docsSkipped > 0 && docsUsed === 0
          ? `${docsSkipped} doc${docsSkipped > 1 ? 's' : ''} sin contenido extraído`
          : 'Contenido insuficiente para generar preguntas';
        throw new Error(reason);
      }

      const existingTexts = (latestTheme.questions || []).map(q => q.text.toLowerCase().trim());
      const prompt = OPTIMIZED_QUESTION_PROMPT(theme.name, QUESTIONS_PER_BATCH, documentContents.substring(0, 15000), existingTexts.join('\n'));

      const response = await fetch('/api/generate-gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({ prompt, useWebSearch: false, maxTokens: 8000, callType: 'questions' }),
      });
      if (!response.ok) throw new Error(`API ${response.status}`);
      const data = await response.json();
      if (!Array.isArray(data.content)) throw new Error('Respuesta de la IA inválida. Reintenta.');
      let textContent = '';
      for (const block of data.content) { if (block.type === 'text') textContent += block.text; }

      const parsed = parseQuestionsResponse(textContent);
      if (!parsed.length) throw new Error('La IA no devolvió JSON válido');

      const rawQuestions = mapRawQuestions(parsed, theme.number);
      const newQuestions = deduplicateQuestions(rawQuestions, existingTexts);
      if (newQuestions.length === 0) throw new Error('Todas las preguntas generadas son duplicadas');

      const finalTheme = themesRef.current.find(t => t.number === theme.number) || latestTheme;
      onUpdateTheme({ ...finalTheme, questions: [...(finalTheme.questions || []), ...newQuestions] });

      inProgressRef.current.delete(key);
      setGeneratingQuestions(prev => ({ ...prev, [theme.number]: 'done' }));
      showToast?.(`✅ ${newQuestions.length} preguntas para "${theme.name}"`, 'success');
      return null;
    } catch (e) {
      const reason = e.message || 'Error desconocido';
      console.error(`Error preguntas "${theme.name}":`, reason);
      inProgressRef.current.delete(key);
      setGeneratingQuestions(prev => ({ ...prev, [theme.number]: 'error' }));
      if (!isRunningRef.current) showToast?.(`Error preguntas "${theme.name}": ${reason}`, 'error');
      return reason;
    }
  }, [themesRef, onUpdateTheme, showToast]);

  // ─── Smart: elige combinado o solo preguntas según estado ─
  const generateThemeInline = useCallback(async (theme) => {
    const latestTheme = themesRef.current.find(t => t.number === theme.number) || theme;
    if (latestTheme.documents?.length > 0) {
      return generateQuestionsInline(theme);
    }
    return generateCombinedInline(theme);
  }, [themesRef, generateQuestionsInline, generateCombinedInline]);

  // ─── Bulk: generar preguntas para todos los temas con nombre ─
  const handleGenerateAll = useCallback(async () => {
    if (isRunningRef.current) return;
    const pending = themesRef.current.filter(t => t.name !== `Tema ${t.number}`);
    if (pending.length === 0) { showToast?.('No hay temas con nombre personalizado', 'info'); return; }

    isRunningRef.current = true;
    setGeneratingAll(true);
    setQueueProgress({ done: 0, total: pending.length, type: 'questions', currentName: pending[0]?.name, errors: [] });

    try {
      for (let i = 0; i < pending.length; i++) {
        setQueueProgress(prev => prev ? { ...prev, currentName: pending[i].name } : prev);
        const errorReason = await generateThemeInline(pending[i]);
        setQueueProgress(prev => {
          if (!prev) return prev;
          const errors = errorReason && errorReason !== 'already running'
            ? [...prev.errors, { name: pending[i].name, reason: errorReason }]
            : prev.errors;
          return { ...prev, done: i + 1, errors };
        });
      }
    } finally {
      isRunningRef.current = false;
      setGeneratingAll(false);
      setQueueProgress(prev => prev ? { ...prev, currentName: null } : prev);
      setTimeout(() => setQueueProgress(null), 6000);
    }
  }, [themesRef, generateThemeInline, showToast]);

  return {
    generatingQuestions,
    generatingAll,
    queueProgress,
    generateThemeInline,
    generateQuestionsInline,
    generateCombinedInline,
    handleGenerateAll,
  };
}
