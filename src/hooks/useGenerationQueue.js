import { useState, useRef, useCallback } from 'react';
import { OPTIMIZED_AUTO_GENERATE_PROMPT, OPTIMIZED_QUESTION_PROMPT } from '../utils/optimizedPrompts';
import { MAX_CHARS, QUESTIONS_PER_BATCH, normalizeDifficulty } from '../utils/constants';

/**
 * Extracts usable text content from a document object.
 * Returns empty string if the document has no real content.
 */
function extractDocContent(doc) {
  // processedContent is always real text (scraped, extracted from PDF, or AI-generated)
  if (doc.processedContent && doc.processedContent.trim().length > 80) {
    return doc.processedContent;
  }
  // ai-search repos created with searchResults wrapper
  if (doc.searchResults?.processedContent && doc.searchResults.processedContent.trim().length > 80) {
    return doc.searchResults.processedContent;
  }
  if (doc.searchResults?.content && doc.searchResults.content.trim().length > 80) {
    return doc.searchResults.content;
  }
  // doc.content is safe only for text/pdf types — for url type it's the URL string
  if (doc.type !== 'url' && doc.content && doc.content.trim().length > 80) {
    return doc.content;
  }
  return '';
}

/**
 * Builds concatenated document content for a theme, skipping docs without real content.
 * Returns { text, docsUsed, docsSkipped }
 */
function buildContent(documents) {
  if (!Array.isArray(documents) || documents.length === 0) return { text: '', docsUsed: 0, docsSkipped: 0 };
  let text = '';
  let charCount = 0;
  let docsUsed = 0;
  let docsSkipped = 0;

  for (const doc of documents) {
    if (charCount >= MAX_CHARS) break;
    const extracted = extractDocContent(doc);
    if (!extracted) { docsSkipped++; continue; }
    const chunk = `\n${extracted}\n`;
    const remaining = MAX_CHARS - charCount;
    text += chunk.substring(0, remaining);
    charCount += Math.min(chunk.length, remaining);
    docsUsed++;
  }
  return { text, docsUsed, docsSkipped };
}

/**
 * Persistent generation queue — lives in App.jsx so navigation doesn't kill ongoing jobs.
 * @param {Object} opts
 * @param {React.MutableRefObject} opts.themesRef  - ref always pointing to latest themes array
 * @param {Function} opts.onUpdateTheme            - stable callback to update a theme
 * @param {Function} opts.showToast                - toast helper
 */
export default function useGenerationQueue({ themesRef, onUpdateTheme, showToast }) {
  const [generatingRepos, setGeneratingRepos] = useState({});
  const [generatingQuestions, setGeneratingQuestions] = useState({});
  const [generatingAll, setGeneratingAll] = useState(false);
  const [generatingAllQuestions, setGeneratingAllQuestions] = useState(false);
  // { done, total, type, currentName, errors: [{name, reason}] }
  const [queueProgress, setQueueProgress] = useState(null);

  // Ref-based lock — immune to stale closures, prevents any double-run
  const isRunningRef = useRef(false);
  // Ref-based in-progress guard per theme for rapid-click protection
  const inProgressRef = useRef(new Set()); // 'repo-{num}' | 'q-{num}'

  // ─── Single-theme repo generation ────────────────────────────────────────
  // Returns null on success, error reason string on failure
  const createRepoInline = useCallback(async (theme) => {
    const key = `repo-${theme.number}`;
    if (inProgressRef.current.has(key)) return 'already running';
    inProgressRef.current.add(key);
    setGeneratingRepos(prev => ({ ...prev, [theme.number]: 'loading' }));

    try {
      const response = await fetch('/api/generate-gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: OPTIMIZED_AUTO_GENERATE_PROMPT(theme.name), maxTokens: 4000, callType: 'repo' })
      });
      if (!response.ok) throw new Error(`API ${response.status}`);
      const data = await response.json();
      if (!Array.isArray(data.content)) throw new Error('Respuesta de la IA inválida. Reintenta.');
      let content = '';
      for (const block of data.content) { if (block.type === 'text') content += block.text; }
      if (content.trim().length < 80) throw new Error('Respuesta vacía de la IA');

      const newDoc = {
        type: 'ai-search', content: theme.name,
        fileName: `Repositorio: ${theme.name}`,
        addedAt: new Date().toISOString(),
        searchResults: { query: theme.name, content, processedContent: content },
        processedContent: content
      };

      const latestTheme = themesRef.current.find(t => t.number === theme.number);
      if (latestTheme) {
        onUpdateTheme({ ...latestTheme, documents: [...(latestTheme.documents || []), newDoc] });
      }

      inProgressRef.current.delete(key);
      setGeneratingRepos(prev => ({ ...prev, [theme.number]: 'done' }));
      showToast?.(`✅ Repositorio creado para "${theme.name}"`, 'success');
      return null; // success
    } catch (e) {
      const reason = e.message || 'Error desconocido';
      console.error(`Error repo "${theme.name}":`, e);
      inProgressRef.current.delete(key);
      setGeneratingRepos(prev => ({ ...prev, [theme.number]: 'error' }));
      showToast?.(`Error repositorio "${theme.name}": ${reason}`, 'error');
      return reason;
    }
  }, [themesRef, onUpdateTheme, showToast]);

  // ─── Single-theme questions generation ───────────────────────────────────
  // Returns null on success, error reason string on failure
  const generateQuestionsInline = useCallback(async (theme) => {
    const key = `q-${theme.number}`;
    if (inProgressRef.current.has(key)) return 'already running';
    inProgressRef.current.add(key);
    setGeneratingQuestions(prev => ({ ...prev, [theme.number]: 'loading' }));

    try {
      const latestTheme = themesRef.current.find(t => t.number === theme.number) || theme;

      if (!latestTheme.documents?.length) {
        throw new Error('El tema no tiene documentos');
      }

      const { text: documentContents, docsUsed, docsSkipped } = buildContent(latestTheme.documents);

      if (documentContents.trim().length < 100) {
        const reason = docsSkipped > 0 && docsUsed === 0
          ? `${docsSkipped} doc${docsSkipped > 1 ? 's' : ''} sin contenido extraído (URLs sin scrape o documentos vacíos)`
          : 'Contenido demasiado corto para generar preguntas';
        throw new Error(reason);
      }

      const existingTexts = (latestTheme.questions || []).map(q => q.text.toLowerCase().trim());
      const prompt = OPTIMIZED_QUESTION_PROMPT(
        theme.name, QUESTIONS_PER_BATCH,
        documentContents.substring(0, 35000),
        existingTexts.join('\n')
      );

      const response = await fetch('/api/generate-gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, useWebSearch: false, maxTokens: 8000, callType: 'questions' })
      });
      if (!response.ok) throw new Error(`API ${response.status}`);
      const data = await response.json();
      if (!Array.isArray(data.content)) throw new Error('Respuesta de la IA inválida. Reintenta.');
      let textContent = '';
      for (const block of data.content) { if (block.type === 'text') textContent += block.text; }

      let cleaned = textContent.trim()
        .replace(/```json\s*/g, '').replace(/```\s*/g, '')
        .replace(/^[^[]*/, '').replace(/[^\]]*$/, '');
      const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error('La IA no devolvió JSON válido');

      const parsed = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('La IA no generó preguntas');

      const rawQuestions = parsed.map((q, i) => ({
        id: `${theme.number}-ai-${Date.now()}-${i}`,
        text: q.pregunta || q.text || 'Pregunta sin texto',
        options: q.opciones || q.options || ['A', 'B', 'C'],
        correct: q.correcta ?? q.correct ?? 0,
        source: 'IA',
        difficulty: normalizeDifficulty(q.dificultad || q.difficulty),
        explanation: q.explicacion || q.explanation || '',
        needsReview: true,
        createdAt: new Date().toISOString()
      }));

      const newQuestions = rawQuestions.filter(newQ => {
        const newText = newQ.text.toLowerCase().trim();
        if (existingTexts.some(et => et === newText)) return false;
        const words1 = newText.split(/\s+/);
        return !existingTexts.some(et => {
          const words2 = et.split(/\s+/);
          const common = words1.filter(w => words2.includes(w));
          return common.length / Math.max(words1.length, words2.length) > 0.8;
        });
      });

      if (newQuestions.length === 0) throw new Error('Todas las preguntas generadas son duplicadas');

      const finalTheme = themesRef.current.find(t => t.number === theme.number) || latestTheme;
      onUpdateTheme({ ...finalTheme, questions: [...(finalTheme.questions || []), ...newQuestions] });

      inProgressRef.current.delete(key);
      setGeneratingQuestions(prev => ({ ...prev, [theme.number]: 'done' }));
      showToast?.(`✅ ${newQuestions.length} preguntas para "${theme.name}"`, 'success');
      return null; // success
    } catch (e) {
      const reason = e.message || 'Error desconocido';
      console.error(`Error preguntas "${theme.name}":`, reason);
      inProgressRef.current.delete(key);
      setGeneratingQuestions(prev => ({ ...prev, [theme.number]: 'error' }));
      // No toast for bulk — shown in progress panel
      if (!isRunningRef.current) {
        showToast?.(`Error preguntas "${theme.name}": ${reason}`, 'error');
      }
      return reason;
    }
  }, [themesRef, onUpdateTheme, showToast]);

  // ─── Bulk repo generation ─────────────────────────────────────────────────
  const handleGenerateAll = useCallback(async () => {
    if (isRunningRef.current) return;

    const pending = themesRef.current.filter(t =>
      t.name !== `Tema ${t.number}` && !(t.documents?.length > 0)
    );
    if (pending.length === 0) {
      showToast?.('No hay temas pendientes con nombre personalizado', 'info');
      return;
    }

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

  // ─── Bulk questions generation ────────────────────────────────────────────
  const handleGenerateAllQuestions = useCallback(async () => {
    if (isRunningRef.current) return;

    const pending = themesRef.current.filter(t => t.documents?.length > 0);
    if (pending.length === 0) {
      showToast?.('No hay temas con repositorio pendientes', 'info');
      return;
    }

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
    generatingRepos,
    generatingQuestions,
    generatingAll,
    generatingAllQuestions,
    isRunning: isRunningRef.current,
    queueProgress,
    createRepoInline,
    generateQuestionsInline,
    handleGenerateAll,
    handleGenerateAllQuestions,
  };
}
