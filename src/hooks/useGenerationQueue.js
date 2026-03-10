import { useState, useRef, useCallback } from 'react';
import { OPTIMIZED_AUTO_GENERATE_PROMPT, OPTIMIZED_QUESTION_PROMPT } from '../utils/optimizedPrompts';
import { QUESTIONS_PER_BATCH } from '../utils/constants';
import { buildContent, parseQuestionsResponse, mapRawQuestions, deduplicateQuestions } from '../utils/geminiHelpers';

/**
 * Persistent generation queue — lives in App.jsx so navigation doesn't kill ongoing jobs.
 */
export default function useGenerationQueue({ themesRef, onUpdateTheme, showToast }) {
  const [generatingRepos, setGeneratingRepos] = useState({});
  const [generatingQuestions, setGeneratingQuestions] = useState({});
  const [generatingAll, setGeneratingAll] = useState(false);
  const [generatingAllQuestions, setGeneratingAllQuestions] = useState(false);
  const [queueProgress, setQueueProgress] = useState(null);

  const isRunningRef = useRef(false);
  const inProgressRef = useRef(new Set());

  // ─── Generación de repositorio (tema individual) ──────────
  const createRepoInline = useCallback(async (theme) => {
    const key = `repo-${theme.number}`;
    if (inProgressRef.current.has(key)) return 'already running';
    inProgressRef.current.add(key);
    setGeneratingRepos(prev => ({ ...prev, [theme.number]: 'loading' }));

    try {
      const response = await fetch('/api/generate-gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: OPTIMIZED_AUTO_GENERATE_PROMPT(theme.name), maxTokens: 8000, callType: 'repo', useCache: false })
      });
      if (!response.ok) throw new Error(`API ${response.status}`);
      const data = await response.json();
      if (!Array.isArray(data.content)) throw new Error('Respuesta de la IA inválida. Reintenta.');
      let content = '';
      for (const block of data.content) { if (block.type === 'text') content += block.text; }
      if (content.trim().length < 100) throw new Error('Respuesta vacía de la IA');

      const newDoc = {
        type: 'ai-search', content: theme.name,
        fileName: `Repositorio: ${theme.name}`,
        addedAt: new Date().toISOString(),
        searchResults: { query: theme.name, content, processedContent: content },
        processedContent: content,
      };
      const latestTheme = themesRef.current.find(t => t.number === theme.number);
      if (latestTheme) onUpdateTheme({ ...latestTheme, documents: [...(latestTheme.documents || []), newDoc] });

      inProgressRef.current.delete(key);
      setGeneratingRepos(prev => ({ ...prev, [theme.number]: 'done' }));
      showToast?.(`✅ Repositorio creado para "${theme.name}"`, 'success');
      return null;
    } catch (e) {
      const reason = e.message || 'Error desconocido';
      console.error(`Error repo "${theme.name}":`, e);
      inProgressRef.current.delete(key);
      setGeneratingRepos(prev => ({ ...prev, [theme.number]: 'error' }));
      showToast?.(`Error repositorio "${theme.name}": ${reason}`, 'error');
      return reason;
    }
  }, [themesRef, onUpdateTheme, showToast]);

  // ─── Generación de preguntas (tema individual) ────────────
  const generateQuestionsInline = useCallback(async (theme) => {
    const key = `q-${theme.number}`;
    if (inProgressRef.current.has(key)) return 'already running';
    inProgressRef.current.add(key);
    setGeneratingQuestions(prev => ({ ...prev, [theme.number]: 'loading' }));

    try {
      const latestTheme = themesRef.current.find(t => t.number === theme.number) || theme;
      if (!latestTheme.documents?.length) throw new Error('El tema no tiene documentos');

      let { text: documentContents, docsUsed, docsSkipped } = buildContent(latestTheme.documents);

      // Auto-repair: si el contenido es insuficiente, regenerar el repositorio
      if (documentContents.trim().length < 100 && latestTheme.documents.length > 0) {
        const repoResp = await fetch('/api/generate-gemini', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: OPTIMIZED_AUTO_GENERATE_PROMPT(theme.name), maxTokens: 8000, callType: 'repo' })
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
              const latestAgain = themesRef.current.find(t => t.number === theme.number) || latestTheme;
              onUpdateTheme({ ...latestAgain, documents: [fixedDoc, ...(latestAgain.documents || []).filter(d => d.processedContent?.trim().length > 100)] });
              documentContents = repoText;
            }
          }
        }
      }

      if (documentContents.trim().length < 100) {
        const reason = docsSkipped > 0 && docsUsed === 0
          ? `${docsSkipped} doc${docsSkipped > 1 ? 's' : ''} sin contenido extraído`
          : 'Contenido insuficiente para generar preguntas';
        throw new Error(reason);
      }

      const existingTexts = (latestTheme.questions || []).map(q => q.text.toLowerCase().trim());
      const prompt = OPTIMIZED_QUESTION_PROMPT(theme.name, QUESTIONS_PER_BATCH, documentContents.substring(0, 35000), existingTexts.join('\n'));

      const response = await fetch('/api/generate-gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, useWebSearch: false, maxTokens: 16000, callType: 'questions' })
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

  // ─── Bulk: generar repositorios ───────────────────────────
  const handleGenerateAll = useCallback(async () => {
    if (isRunningRef.current) return;
    const pending = themesRef.current.filter(t => t.name !== `Tema ${t.number}` && !(t.documents?.length > 0));
    if (pending.length === 0) { showToast?.('No hay temas pendientes con nombre personalizado', 'info'); return; }

    isRunningRef.current = true;
    setGeneratingAll(true);
    setQueueProgress({ done: 0, total: pending.length, type: 'repos', currentName: pending[0]?.name, errors: [] });

    try {
      for (let i = 0; i < pending.length; i++) {
        setQueueProgress(prev => prev ? { ...prev, currentName: pending[i].name } : prev);
        const errorReason = await createRepoInline(pending[i]);
        setQueueProgress(prev => {
          if (!prev) return prev;
          const errors = errorReason && errorReason !== 'already running'
            ? [...prev.errors, { name: pending[i].name, reason: errorReason }]
            : prev.errors;
          return { ...prev, done: i + 1, errors };
        });
        if (i < pending.length - 1) await new Promise(r => setTimeout(r, 800));
      }
    } finally {
      isRunningRef.current = false;
      setGeneratingAll(false);
      setQueueProgress(prev => prev ? { ...prev, currentName: null } : prev);
      setTimeout(() => setQueueProgress(null), 6000);
    }
  }, [themesRef, createRepoInline, showToast]);

  // ─── Bulk: generar preguntas ──────────────────────────────
  const handleGenerateAllQuestions = useCallback(async () => {
    if (isRunningRef.current) return;
    const pending = themesRef.current.filter(t => t.documents?.length > 0);
    if (pending.length === 0) { showToast?.('No hay temas con repositorio pendientes', 'info'); return; }

    isRunningRef.current = true;
    setGeneratingAllQuestions(true);
    setQueueProgress({ done: 0, total: pending.length, type: 'questions', currentName: pending[0]?.name, errors: [] });

    try {
      for (let i = 0; i < pending.length; i++) {
        setQueueProgress(prev => prev ? { ...prev, currentName: pending[i].name } : prev);
        const errorReason = await generateQuestionsInline(pending[i]);
        setQueueProgress(prev => {
          if (!prev) return prev;
          const errors = errorReason && errorReason !== 'already running'
            ? [...prev.errors, { name: pending[i].name, reason: errorReason }]
            : prev.errors;
          return { ...prev, done: i + 1, errors };
        });
        if (i < pending.length - 1) await new Promise(r => setTimeout(r, 1200));
      }
    } finally {
      isRunningRef.current = false;
      setGeneratingAllQuestions(false);
      setQueueProgress(prev => prev ? { ...prev, currentName: null } : prev);
      setTimeout(() => setQueueProgress(null), 6000);
    }
  }, [themesRef, generateQuestionsInline, showToast]);

  return {
    generatingRepos, generatingQuestions,
    generatingAll, generatingAllQuestions,
    isRunning: isRunningRef.current,
    queueProgress,
    createRepoInline, generateQuestionsInline,
    handleGenerateAll, handleGenerateAllQuestions,
  };
}
