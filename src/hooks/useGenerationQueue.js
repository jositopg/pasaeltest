import { useState, useRef, useCallback } from 'react';
import { generateCombined, generateFromDocuments } from '../utils/questionGenerator';

/**
 * Persistent generation queue — lives in App.jsx so navigation doesn't kill ongoing jobs.
 * Delega la generación real a utils/questionGenerator.js (compartido con useQuestionGeneration).
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
      const latestTheme = themesRef.current.find(t => t.number === theme.number) || theme;
      const { newDoc, newQuestions } = await generateCombined(latestTheme);

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

      const { newQuestions, regeneratedDoc } = await generateFromDocuments(latestTheme, latestTheme.documents);

      const finalTheme = themesRef.current.find(t => t.number === theme.number) || latestTheme;
      const documents = regeneratedDoc
        ? [regeneratedDoc, ...(finalTheme.documents || []).filter(d => d.processedContent?.trim().length > 100)]
        : finalTheme.documents;
      onUpdateTheme({ ...finalTheme, documents, questions: [...(finalTheme.questions || []), ...newQuestions] });

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
