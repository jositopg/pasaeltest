import { useState, useEffect } from 'react';
import { OPTIMIZED_QUESTION_PROMPT, OPTIMIZED_PHASE2_PROMPT, OPTIMIZED_AUTO_GENERATE_PROMPT, COMBINED_AUTO_AND_QUESTIONS_PROMPT } from '../utils/optimizedPrompts';
import { parseExcelQuestions, parsePDFQuestions } from '../utils/questionImporter';
import { analyzeDocument, determineQuestionTypes } from '../utils/documentAnalyzer';
import { MAX_CHARS, QUESTIONS_PER_BATCH, normalizeDifficulty } from '../utils/constants';
import { parseCombinedResponse } from '../utils/geminiHelpers';
import { jsonrepair } from 'jsonrepair';
import { authHelpers } from '../supabaseClient';
import useDocumentManager from './useDocumentManager';

export default function useThemeModal({ theme, onUpdate, showToast }) {
  // ─── Estado preguntas ────────────────────────────────────
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);
  const [showAddQuestion, setShowAddQuestion] = useState(false);
  const [selectedQuestions, setSelectedQuestions] = useState(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [newQuestion, setNewQuestion] = useState({ text: '', options: ['', '', ''], correct: 0, difficulty: 'media' });
  const [generationProgress, setGenerationProgress] = useState('');
  const [generationPercent, setGenerationPercent] = useState(0);

  // ─── Preview de preguntas generadas ──────────────────────
  // Declarado antes de useDocumentManager para que handleRawQuestionsReady
  // pueda cerrar sobre sus setters sin problema de orden.
  const [pendingQuestions, setPendingQuestions] = useState(null);
  const [pendingDuplicates, setPendingDuplicates] = useState(0);

  // ─── Callback: preguntas generadas junto con el material ─
  // baseTheme: tema base a usar (por defecto theme, pero puede ser uno actualizado localmente)
  const handleRawQuestionsReady = (rawPreguntas, baseTheme = null) => {
    const t = baseTheme || theme;
    if (!Array.isArray(rawPreguntas) || rawPreguntas.length === 0) return 0;
    const existingTexts = (Array.isArray(t.questions) ? t.questions : []).map(q => q.text.toLowerCase().trim());
    const rawQuestions = rawPreguntas.map((q, i) => ({
      id: `${t.number}-ai-${Date.now()}-${i}`,
      text: q.pregunta || q.text || 'Pregunta sin texto',
      options: q.opciones || q.options || ['A', 'B', 'C'],
      correct: q.correcta ?? q.correct ?? 0,
      source: 'IA',
      difficulty: normalizeDifficulty(q.dificultad || q.difficulty),
      explanation: q.explicacion || q.explanation || '',
      needsReview: false,
      createdAt: new Date().toISOString(),
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
    if (newQuestions.length > 0) {
      onUpdate({ ...t, questions: [...(Array.isArray(t.questions) ? t.questions : []), ...newQuestions] });
      if (showToast) showToast(`✅ ${newQuestions.length} pregunta${newQuestions.length !== 1 ? 's' : ''} guardada${newQuestions.length !== 1 ? 's' : ''}`, 'success');
    }
    return newQuestions.length;
  };

  // ─── Documentos (delegado a useDocumentManager) ──────────
  const docManager = useDocumentManager({ theme, onUpdate, showToast, onQuestionsReady: handleRawQuestionsReady });

  // ─── Estado nombre ────────────────────────────────────────
  const [editingName, setEditingName] = useState(theme.name);

  // ─── Estado confirmaciones ────────────────────────────────
  const [deleteQuestionsConfirm, setDeleteQuestionsConfirm] = useState({ show: false, type: null, count: 0 });

  // ─── Efectos ─────────────────────────────────────────────
  useEffect(() => { setEditingName(theme.name); }, [theme.name]);

  // ─── Cobertura (sin API) ──────────────────────────────────
  const estimatedTotal = (() => {
    if (!theme.documents?.length) return null;
    let content = '';
    for (const doc of theme.documents) {
      const text = doc.processedContent || doc.searchResults?.processedContent || doc.searchResults?.content || doc.content || '';
      content += text;
      if (content.length > 60000) break;
    }
    if (content.length < 100) return null;
    try {
      const { report } = analyzeDocument(content.substring(0, 60000));
      return report.totalQuestions;
    } catch { return null; }
  })();
  const questionCount = theme.questions?.length || 0;
  const coveragePercent = estimatedTotal ? Math.min(100, Math.round((questionCount / estimatedTotal) * 100)) : null;

  // ─── Nombre ──────────────────────────────────────────────
  const handleSaveName = () => {
    const trimmedName = editingName.trim();
    if (trimmedName && trimmedName !== theme.name) {
      onUpdate({ ...theme, name: trimmedName });
    }
  };

  const handleNameKeyPress = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); handleSaveName(); }
  };

  // ─── Construcción de contenido ───────────────────────────
  const buildDocumentContents = (docs) => {
    if (!Array.isArray(docs) || docs.length === 0) return '';
    let documentContents = '';
    let charCount = 0;
    for (const doc of docs) {
      if (charCount >= MAX_CHARS) break;
      let docText = '';
      if (doc.processedContent) {
        docText = `\n═══ FUENTE OPTIMIZADA ═══\n${doc.fileName || (doc.content || '').substring(0, 100)}\n\n${doc.processedContent}\n`;
      } else if (doc.searchResults?.processedContent) {
        docText = `\n═══ BÚSQUEDA IA OPTIMIZADA ═══\n${doc.content}\n\n${doc.searchResults.processedContent}\n`;
      } else if (doc.searchResults?.content) {
        docText = `\n═══ BÚSQUEDA WEB ═══\n${doc.content}\n\n${doc.searchResults.content}\n`;
      } else if (doc.type !== 'url' && doc.content) {
        docText = `\n═══ DOCUMENTO ═══\n${doc.fileName || 'Texto pegado'}\n\n${doc.content}\n`;
      }
      const remaining = MAX_CHARS - charCount;
      documentContents += docText.substring(0, remaining);
      charCount += docText.length;
    }
    return documentContents;
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
      prompt = OPTIMIZED_PHASE2_PROMPT(theme.name, sectionMeta, QUESTIONS_PER_BATCH, documentContents.substring(0, 15000), existingQuestionsStr, questionTypes);
    } else {
      prompt = OPTIMIZED_QUESTION_PROMPT(theme.name, QUESTIONS_PER_BATCH, documentContents.substring(0, 15000), existingQuestionsStr, coverageInstruction);
    }
    const token = await authHelpers.getAccessToken();
    const response = await fetch('/api/generate-gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token && { 'Authorization': `Bearer ${token}` }) },
      body: JSON.stringify({ prompt, useWebSearch: false, maxTokens: 8000, callType: 'questions' }),
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
    let cleaned = textContent.trim()
      .replace(/```json\s*/g, '').replace(/```\s*/g, '')
      .replace(/^[^[]*/, '').replace(/[^\]]*$/, '');
    const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('No se pudo extraer JSON. La IA respondió con texto no estructurado.');
    let parsed;
    try { parsed = JSON.parse(jsonMatch[0]); }
    catch (e1) {
      try { parsed = JSON.parse(jsonrepair(jsonMatch[0])); }
      catch (e) { throw new Error('JSON inválido: ' + e1.message); }
    }
    if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('La IA no generó preguntas válidas');
    const rawQuestions = parsed.map((q, i) => ({
      id: `${theme.number}-ai-${Date.now()}-${i}`,
      text: q.pregunta || q.text || 'Pregunta sin texto',
      options: q.opciones || q.options || ['A', 'B', 'C'],
      correct: q.correcta ?? q.correct ?? 0,
      source: 'IA',
      difficulty: normalizeDifficulty(q.dificultad || q.difficulty),
      explanation: q.explicacion || q.explanation || '',
      needsReview: false,
      createdAt: new Date().toISOString(),
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
    return { newQuestions, duplicatesFound: rawQuestions.length - newQuestions.length };
  };

  // ─── Generación de preguntas ──────────────────────────────
  const generateQuestionsFromDocuments = async (docsToUse = null) => {
    const docs = Array.isArray(docsToUse) ? docsToUse : (Array.isArray(theme.documents) ? theme.documents : []);
    if (docs.length === 0) {
      // Sin material: llamada combinada directa (material + preguntas en 1 llamada)
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

        // Construir tema con el nuevo documento
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
          // Preguntas extraídas del combined response — guardar doc + preguntas juntos
          const saved = handleRawQuestionsReady(preguntas, themeWithDoc);
          if (!saved) onUpdate(themeWithDoc);  // guardar doc aunque no haya preguntas
          setGenerationProgress(`✅ ${preguntas.length} preguntas guardadas`);
          setGenerationPercent(100);
          setTimeout(() => { setIsGeneratingQuestions(false); setGenerationProgress(''); setGenerationPercent(0); }, 600);
        } else {
          // Fallback: segunda llamada solo para preguntas con el material generado
          setGenerationProgress('🤖 Generando preguntas a partir del material...');
          setGenerationPercent(85);
          const existingTexts = (Array.isArray(themeWithDoc.questions) ? themeWithDoc.questions : []).map(q => q.text.toLowerCase().trim());
          const { newQuestions, duplicatesFound } = await callGenerationAPI(processedContent, existingTexts);
          if (newQuestions.length === 0) {
            onUpdate(themeWithDoc);  // al menos guardar el documento
            throw new Error('No se generaron preguntas válidas. Intenta de nuevo.');
          }
          onUpdate({ ...themeWithDoc, questions: [...(themeWithDoc.questions || []), ...newQuestions] });
          setGenerationProgress(`✅ ${newQuestions.length} preguntas guardadas`);
          setGenerationPercent(100);
          if (duplicatesFound > 0 && showToast) showToast(`${duplicatesFound} duplicadas descartadas`, 'info');
          setTimeout(() => { setIsGeneratingQuestions(false); setGenerationProgress(''); setGenerationPercent(0); }, 600);
        }
      } catch (error) {
        console.error('Error generando material+preguntas:', error);
        setIsGeneratingQuestions(false);
        setGenerationProgress('');
        setGenerationPercent(0);
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
      setTimeout(() => { setIsGeneratingQuestions(false); setGenerationProgress(''); setGenerationPercent(0); }, 600);
    } catch (error) {
      console.error('Error generando preguntas:', error);
      setIsGeneratingQuestions(false);
      setGenerationProgress('');
      setGenerationPercent(0);
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

  // ─── Preguntas — borrado ──────────────────────────────────
  const handleDeleteSelected = () => {
    if (selectedQuestions.size === 0) { alert('Selecciona al menos una pregunta'); return; }
    setDeleteQuestionsConfirm({ show: true, type: 'selected', count: selectedQuestions.size });
  };
  const handleDeleteAll = () => {
    setDeleteQuestionsConfirm({ show: true, type: 'all', count: theme.questions?.length || 0 });
  };
  const confirmDeleteQuestions = () => {
    if (deleteQuestionsConfirm.type === 'selected') {
      onUpdate({ ...theme, questions: theme.questions.filter(q => !selectedQuestions.has(q.id)) });
      setSelectedQuestions(new Set());
      setSelectMode(false);
    } else if (deleteQuestionsConfirm.type === 'all') {
      onUpdate({ ...theme, questions: [] });
      setSelectedQuestions(new Set());
      setSelectMode(false);
    }
    setDeleteQuestionsConfirm({ show: false, type: null, count: 0 });
  };

  // ─── Preguntas — edición ──────────────────────────────────
  const handleEditQuestion = (updatedQuestion) => {
    onUpdate({
      ...theme,
      questions: theme.questions.map(q =>
        q.id === updatedQuestion.id ? { ...q, ...updatedQuestion } : q
      ),
    });
    if (showToast) showToast('Pregunta actualizada', 'success');
  };

  // ─── Preguntas — manual ───────────────────────────────────
  const handleManualQuestionAdd = () => {
    if (!newQuestion.text.trim() || newQuestion.options.some(opt => !opt.trim())) { alert('Completa todos los campos'); return; }
    const question = { id: `${theme.number}-manual-${Date.now()}`, ...newQuestion, source: 'Manual', needsReview: false, createdAt: new Date().toISOString() };
    onUpdate({ ...theme, questions: [...(theme.questions || []), question] });
    setNewQuestion({ text: '', options: ['', '', ''], correct: 0, difficulty: 'media' });
    setShowAddQuestion(false);
  };

  // ─── Importación Excel/TXT ────────────────────────────────
  const handleImportFile = async (e) => {
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
      if (!questions || questions.length === 0) throw new Error('No se encontraron preguntas válidas en el archivo');
      setGenerationProgress('✓ Validando preguntas...');
      setGenerationPercent(70);
      const validQuestions = questions.filter(q => q.text && q.text.length > 10 && Array.isArray(q.options) && q.options.length === 3 && q.correct >= 0 && q.correct <= 2);
      if (validQuestions.length === 0) throw new Error('Ninguna pregunta pasó la validación. Revisa el formato.');
      if (validQuestions.length < questions.length && showToast) {
        showToast(`⚠️ ${questions.length - validQuestions.length} preguntas con formato incorrecto`, 'warning');
      }
      setGenerationProgress('💾 Guardando preguntas...');
      setGenerationPercent(90);
      onUpdate({ ...theme, questions: [...(theme.questions || []), ...validQuestions] });
      setGenerationProgress(`✅ ${validQuestions.length} preguntas importadas`);
      setGenerationPercent(100);
      if (showToast) showToast(`✅ ${validQuestions.length} pregunta${validQuestions.length > 1 ? 's' : ''} importada${validQuestions.length > 1 ? 's' : ''} exitosamente`, 'success');
      setTimeout(() => { setIsGeneratingQuestions(false); setGenerationProgress(''); setGenerationPercent(0); }, 2000);
    } catch (error) {
      console.error('Error importando preguntas:', error);
      setGenerationProgress(`❌ Error: ${error.message}`);
      if (showToast) showToast(`❌ Error: ${error.message}`, 'error');
      setTimeout(() => { setIsGeneratingQuestions(false); setGenerationProgress(''); setGenerationPercent(0); }, 3000);
    }
    e.target.value = '';
  };

  return {
    // ── Documentos (desde useDocumentManager) ───────────────
    ...docManager,
    // Alias para compatibilidad con DocumentSection (espera generationProgress/Percent)
    generationProgress: docManager.docProgress,
    generationPercent: docManager.docPercent,

    // ── Preguntas ────────────────────────────────────────────
    isGeneratingQuestions,
    showAddQuestion, setShowAddQuestion,
    selectedQuestions, setSelectedQuestions,
    selectMode, setSelectMode,
    newQuestion, setNewQuestion,
    // Progress de generación de preguntas (separado del de docs)
    qGenerationProgress: generationProgress,
    qGenerationPercent: generationPercent,
    // Preview
    pendingQuestions, pendingDuplicates,
    confirmPendingQuestions, discardPendingQuestions,
    // Confirmaciones
    deleteQuestionsConfirm,
    // Handlers
    generateQuestionsFromDocuments,
    handleDeleteSelected, handleDeleteAll, confirmDeleteQuestions,
    handleEditQuestion,
    handleManualQuestionAdd, handleImportFile,

    // ── Nombre ───────────────────────────────────────────────
    editingName, setEditingName,
    handleSaveName, handleNameKeyPress,

    // ── Calculados ───────────────────────────────────────────
    estimatedTotal, questionCount, coveragePercent,
  };
}
