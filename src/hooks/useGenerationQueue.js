import { useState, useRef, useCallback } from 'react';
import { OPTIMIZED_AUTO_GENERATE_PROMPT, OPTIMIZED_QUESTION_PROMPT } from '../utils/optimizedPrompts';
import { MAX_CHARS, QUESTIONS_PER_BATCH, normalizeDifficulty } from '../utils/constants';

/**
 * Persistent generation queue — lives in App.jsx so navigation doesn't kill ongoing jobs.
 * @param {Object} opts
 * @param {React.MutableRefObject} opts.themesRef  - ref always pointing to latest themes array
 * @param {Function} opts.onUpdateTheme            - stable callback to update a theme
 * @param {Function} opts.showToast                - toast helper
 */
export default function useGenerationQueue({ themesRef, onUpdateTheme, showToast }) {
  const [generatingRepos, setGeneratingRepos] = useState({});     // { [themeNumber]: 'loading'|'done'|'error' }
  const [generatingQuestions, setGeneratingQuestions] = useState({}); // same
  const [generatingAll, setGeneratingAll] = useState(false);
  const [generatingAllQuestions, setGeneratingAllQuestions] = useState(false);
  const [queueProgress, setQueueProgress] = useState(null); // { done, total, type: 'repos'|'questions' }

  // Ref-based in-progress guard to avoid stale closure in rapid clicks
  const inProgressRef = useRef(new Set()); // 'repo-{num}' | 'q-{num}'

  // ─── Single-theme repo generation ────────────────────────────────────────
  const createRepoInline = useCallback(async (theme) => {
    const key = `repo-${theme.number}`;
    if (inProgressRef.current.has(key)) return;
    inProgressRef.current.add(key);
    setGeneratingRepos(prev => ({ ...prev, [theme.number]: 'loading' }));

    try {
      const response = await fetch('/api/generate-gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: OPTIMIZED_AUTO_GENERATE_PROMPT(theme.name), maxTokens: 4000, callType: 'repo' })
      });
      if (!response.ok) throw new Error(`API error: ${response.status}`);
      const data = await response.json();

      let content = '';
      for (const block of data.content) { if (block.type === 'text') content += block.text; }
      if (content.trim().length < 50) throw new Error('Contenido insuficiente');

      const newDoc = {
        type: 'ai-search', content: theme.name,
        fileName: `Repositorio: ${theme.name}`,
        addedAt: new Date().toISOString(),
        searchResults: { query: theme.name, content, processedContent: content },
        processedContent: content
      };

      // Always read latest theme from ref to avoid overwriting concurrent changes
      const latestTheme = themesRef.current.find(t => t.number === theme.number);
      if (latestTheme) {
        onUpdateTheme({ ...latestTheme, documents: [...(latestTheme.documents || []), newDoc] });
      }

      inProgressRef.current.delete(key);
      setGeneratingRepos(prev => ({ ...prev, [theme.number]: 'done' }));
      showToast?.(`✅ Repositorio creado para "${theme.name}"`, 'success');
    } catch (e) {
      console.error(`Error repo "${theme.name}":`, e);
      inProgressRef.current.delete(key);
      setGeneratingRepos(prev => ({ ...prev, [theme.number]: 'error' }));
      showToast?.(`Error creando repositorio para "${theme.name}"`, 'error');
    }
  }, [themesRef, onUpdateTheme, showToast]);

  // ─── Single-theme questions generation ───────────────────────────────────
  const generateQuestionsInline = useCallback(async (theme) => {
    const key = `q-${theme.number}`;
    if (inProgressRef.current.has(key)) return;
    inProgressRef.current.add(key);
    setGeneratingQuestions(prev => ({ ...prev, [theme.number]: 'loading' }));

    try {
      // Read latest theme (may have fresher documents)
      const latestTheme = themesRef.current.find(t => t.number === theme.number) || theme;
      if (!latestTheme.documents?.length) throw new Error('Sin documentos');

      let documentContents = '';
      let charCount = 0;
      for (const doc of latestTheme.documents) {
        if (charCount >= MAX_CHARS) break;
        let docText = '';
        if (doc.processedContent) docText = `\n${doc.processedContent}\n`;
        else if (doc.searchResults?.processedContent) docText = `\n${doc.searchResults.processedContent}\n`;
        else if (doc.searchResults?.content) docText = `\n${doc.searchResults.content}\n`;
        else if (doc.content) docText = `\n${doc.content}\n`;
        const remaining = MAX_CHARS - charCount;
        documentContents += docText.substring(0, remaining);
        charCount += docText.length;
      }
      if (documentContents.trim().length < 100) throw new Error('Contenido insuficiente');

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
      if (!response.ok) throw new Error(`API error: ${response.status}`);
      const data = await response.json();

      let textContent = '';
      for (const block of data.content) { if (block.type === 'text') textContent += block.text; }

      let cleaned = textContent.trim()
        .replace(/```json\s*/g, '').replace(/```\s*/g, '')
        .replace(/^[^[]*/, '').replace(/[^\]]*$/, '');
      const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error('No JSON found');

      const parsed = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('Sin preguntas');

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

      if (newQuestions.length === 0) throw new Error('Todas duplicadas');

      // Re-read latest theme one more time to avoid race
      const finalTheme = themesRef.current.find(t => t.number === theme.number) || latestTheme;
      onUpdateTheme({ ...finalTheme, questions: [...(finalTheme.questions || []), ...newQuestions] });

      inProgressRef.current.delete(key);
      setGeneratingQuestions(prev => ({ ...prev, [theme.number]: 'done' }));
      showToast?.(`✅ ${newQuestions.length} preguntas para "${theme.name}"`, 'success');
    } catch (e) {
      console.error(`Error preguntas "${theme.name}":`, e);
      inProgressRef.current.delete(key);
      setGeneratingQuestions(prev => ({ ...prev, [theme.number]: 'error' }));
      showToast?.(`Error generando preguntas para "${theme.name}"`, 'error');
    }
  }, [themesRef, onUpdateTheme, showToast]);

  // ─── Bulk repo generation ─────────────────────────────────────────────────
  const handleGenerateAll = useCallback(async () => {
    if (generatingAll || generatingAllQuestions) return;
    const pending = themesRef.current.filter(t =>
      t.name !== `Tema ${t.number}` && !(t.documents?.length > 0)
    );
    if (pending.length === 0) {
      showToast?.('No hay temas pendientes con nombre personalizado', 'info');
      return;
    }
    showToast?.(`⚡ Generando ${pending.length} repositorios. Mantén la app abierta.`, 'info');
    setGeneratingAll(true);
    setQueueProgress({ done: 0, total: pending.length, type: 'repos' });

    for (let i = 0; i < pending.length; i++) {
      await createRepoInline(pending[i]);
      setQueueProgress({ done: i + 1, total: pending.length, type: 'repos' });
      if (i < pending.length - 1) await new Promise(r => setTimeout(r, 800));
    }

    setGeneratingAll(false);
    setTimeout(() => setQueueProgress(null), 3000);
  }, [generatingAll, generatingAllQuestions, themesRef, createRepoInline, showToast]);

  // ─── Bulk questions generation ────────────────────────────────────────────
  const handleGenerateAllQuestions = useCallback(async () => {
    if (generatingAll || generatingAllQuestions) return;
    const pending = themesRef.current.filter(t => t.documents?.length > 0);
    if (pending.length === 0) {
      showToast?.('No hay temas con repositorio pendientes', 'info');
      return;
    }
    showToast?.(`📝 Generando preguntas para ${pending.length} temas. Mantén la app abierta.`, 'info');
    setGeneratingAllQuestions(true);
    setQueueProgress({ done: 0, total: pending.length, type: 'questions' });

    for (let i = 0; i < pending.length; i++) {
      await generateQuestionsInline(pending[i]);
      setQueueProgress({ done: i + 1, total: pending.length, type: 'questions' });
      if (i < pending.length - 1) await new Promise(r => setTimeout(r, 1200));
    }

    setGeneratingAllQuestions(false);
    setTimeout(() => setQueueProgress(null), 3000);
  }, [generatingAll, generatingAllQuestions, themesRef, generateQuestionsInline, showToast]);

  return {
    generatingRepos,
    generatingQuestions,
    generatingAll,
    generatingAllQuestions,
    queueProgress,
    createRepoInline,
    generateQuestionsInline,
    handleGenerateAll,
    handleGenerateAllQuestions,
  };
}
