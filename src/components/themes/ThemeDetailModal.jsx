import React, { useState, useEffect, useRef } from 'react';
import Icons from '../common/Icons';
import { OPTIMIZED_QUESTION_PROMPT, OPTIMIZED_PHASE2_PROMPT, OPTIMIZED_SEARCH_PROMPT, OPTIMIZED_AUTO_GENERATE_PROMPT } from '../../utils/optimizedPrompts';
import { parseExcelQuestions, parsePDFQuestions, downloadExcelTemplate, generatePDFTemplate, extractPDFText } from '../../utils/questionImporter';
import { analyzeDocument, determineQuestionTypes } from '../../utils/documentAnalyzer';
import { DEBUG, MAX_CHARS, QUESTIONS_PER_BATCH, normalizeDifficulty } from '../../utils/constants';
import { useTheme } from '../../context/ThemeContext';
import ConfirmDialog from '../common/ConfirmDialog';
import DocumentSection from './DocumentSection';
import QuestionGeneratorPanel from './QuestionGeneratorPanel';
import ManualQuestionForm from './ManualQuestionForm';
import QuestionList from './QuestionList';

function ThemeDetailModal({ theme, onClose, onUpdate, showToast }) {
  const { darkMode } = useTheme();

  // ─── Estado ─────────────────────────────────────────────────
  const isDefaultName = theme.name === `Tema ${theme.number}`;
  const [showAddDoc, setShowAddDoc] = useState(!theme.documents?.length && !isDefaultName);
  const [docType, setDocType] = useState('ai-search');
  const [docContent, setDocContent] = useState(isDefaultName ? '' : theme.name);
  const [isSearching, setIsSearching] = useState(false);
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);
  const [generationProgress, setGenerationProgress] = useState('');
  const [generationPercent, setGenerationPercent] = useState(0);
  const [showAddQuestion, setShowAddQuestion] = useState(false);
  const [selectedQuestions, setSelectedQuestions] = useState(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [newQuestion, setNewQuestion] = useState({ text: '', options: ['', '', ''], correct: 0, difficulty: 'media' });
  const fileInputRef = useRef(null);

  const [showAutoGenerate, setShowAutoGenerate] = useState(false);
  const [isAutoGenerating, setIsAutoGenerating] = useState(false);

  const [editingName, setEditingName] = useState(theme.name);
  const [nameJustSaved, setNameJustSaved] = useState(false);

  const [deleteConfirm, setDeleteConfirm] = useState({ show: false, docIndex: null, docName: '' });
  const [deleteQuestionsConfirm, setDeleteQuestionsConfirm] = useState({ show: false, type: null, count: 0 });

  // ─── Efectos ─────────────────────────────────────────────────
  useEffect(() => { setEditingName(theme.name); }, [theme.name]);

  useEffect(() => {
    if (nameJustSaved &&
        (!theme.documents || theme.documents.length === 0) &&
        theme.name && theme.name.trim() !== '' &&
        theme.name !== `Tema ${theme.number}`) {
      setShowAutoGenerate(true);
      setNameJustSaved(false);
    }
  }, [nameJustSaved, theme.documents, theme.name, theme.number]);

  // ─── Nombre ──────────────────────────────────────────────────
  const handleSaveName = () => {
    const trimmedName = editingName.trim();
    if (trimmedName && trimmedName !== theme.name) {
      onUpdate({ ...theme, name: trimmedName });
      setTimeout(() => setNameJustSaved(true), 150);
    }
  };

  const handleNameKeyPress = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); handleSaveName(); }
  };

  // ─── Auto-generación de repositorio ──────────────────────────
  const handleAutoGenerateRepository = async () => {
    setIsAutoGenerating(true);
    setShowAutoGenerate(false);
    if (showToast) showToast(`Generando repositorio para "${theme.name}"...`, 'info');

    try {
      setIsSearching(true);
      const response = await fetch("/api/generate-gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: OPTIMIZED_AUTO_GENERATE_PROMPT(theme.name), maxTokens: 4000 })
      });

      if (!response.ok) throw new Error('Error en la búsqueda');
      const data = await response.json();
      let searchContent = '';
      for (const block of data.content) {
        if (block.type === 'text') searchContent += block.text + '\n';
      }
      if (searchContent.trim().length < 50) throw new Error('La IA no devolvió contenido suficiente');

      const newDoc = {
        type: 'ai-search',
        content: theme.name,
        fileName: `Repositorio: ${theme.name}`,
        addedAt: new Date().toISOString(),
        searchResults: { query: theme.name, content: searchContent, processedContent: searchContent },
        processedContent: searchContent
      };
      onUpdate({ ...theme, documents: [...(theme.documents || []), newDoc] });
      if (showToast) showToast(`✅ Repositorio generado para "${theme.name}"`, 'success');
    } catch (error) {
      console.error('Error generando repositorio:', error);
      if (showToast) showToast('Error al generar repositorio automático', 'error');
    } finally {
      setIsSearching(false);
      setIsAutoGenerating(false);
    }
  };

  // ─── Generación de preguntas ─────────────────────────────────

  // Construye el texto completo del repositorio a partir de los documentos del tema
  const buildDocumentContents = (docs) => {
    let documentContents = '';
    let charCount = 0;
    for (const doc of docs) {
      if (charCount >= MAX_CHARS) break;
      let docText = '';
      if (doc.processedContent) {
        docText = `\n═══ FUENTE OPTIMIZADA ═══\n${doc.fileName || doc.content.substring(0, 100)}\n\n${doc.processedContent}\n`;
      } else if (doc.searchResults?.processedContent) {
        docText = `\n═══ BÚSQUEDA IA OPTIMIZADA ═══\n${doc.content}\n\n${doc.searchResults.processedContent}\n`;
      } else if (doc.searchResults?.content) {
        docText = `\n═══ BÚSQUEDA WEB ═══\n${doc.content}\n\n${doc.searchResults.content}\n`;
      } else if (doc.content) {
        docText = `\n═══ DOCUMENTO ═══\n${doc.fileName || 'Texto pegado'}\n\n${doc.content}\n`;
      }
      const remaining = MAX_CHARS - charCount;
      documentContents += docText.substring(0, remaining);
      charCount += docText.length;
    }
    return documentContents;
  };

  // Llama a la IA y devuelve {newQuestions, duplicatesFound}. No gestiona estado.
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
      prompt = OPTIMIZED_PHASE2_PROMPT(theme.name, sectionMeta, QUESTIONS_PER_BATCH, documentContents.substring(0, 35000), existingQuestionsStr, questionTypes);
    } else {
      prompt = OPTIMIZED_QUESTION_PROMPT(theme.name, QUESTIONS_PER_BATCH, documentContents.substring(0, 35000), existingQuestionsStr, coverageInstruction);
    }

    const response = await fetch('/api/generate-gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, useWebSearch: false, maxTokens: 8000 })
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error API (${response.status}): ${errorText.substring(0, 200)}`);
    }
    const data = await response.json();
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
    catch (e) { throw new Error('JSON inválido: ' + e.message); }
    if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('La IA no generó preguntas válidas');

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

    return { newQuestions, duplicatesFound: rawQuestions.length - newQuestions.length };
  };

  // Pasada única de generación (botón estándar)
  const generateQuestionsFromDocuments = async (docsToUse = null) => {
    const docs = docsToUse ?? theme.documents;
    if (!docs || docs.length === 0) {
      if (showToast) showToast('Primero añade documentos a este tema para generar preguntas', 'warning');
      return;
    }

    setIsGeneratingQuestions(true);
    setGenerationProgress('📚 Recopilando contenido...');
    setGenerationPercent(10);

    try {
      const documentContents = buildDocumentContents(docs);
      if (documentContents.trim().length < 100) throw new Error('No hay suficiente contenido. Añade documentos o usa búsqueda IA.');

      setGenerationProgress(`🤖 Generando ${QUESTIONS_PER_BATCH} preguntas...`);
      setGenerationPercent(30);

      const existingTexts = (theme.questions || []).map(q => q.text.toLowerCase().trim());
      const { newQuestions, duplicatesFound } = await callGenerationAPI(documentContents, existingTexts);

      if (newQuestions.length === 0) throw new Error('Todas las preguntas generadas eran duplicadas. Intenta de nuevo.');

      setGenerationProgress('💾 Guardando...');
      setGenerationPercent(95);

      onUpdate({ ...theme, questions: [...(theme.questions || []), ...newQuestions], lastGenerated: new Date().toISOString() });

      const message = duplicatesFound > 0
        ? `✅ ${newQuestions.length} preguntas nuevas (${duplicatesFound} duplicadas filtradas)`
        : `✅ ¡${newQuestions.length} preguntas generadas!`;
      setGenerationProgress(message);
      setGenerationPercent(100);
      setTimeout(() => { setIsGeneratingQuestions(false); setGenerationProgress(''); setGenerationPercent(0); }, 2000);

    } catch (error) {
      console.error('Error generando preguntas:', error);
      setIsGeneratingQuestions(false);
      setGenerationProgress('');
      setGenerationPercent(0);
      let errorMsg = error.message;
      if (errorMsg.includes('fetch')) errorMsg = 'Error de conexión. Verifica tu internet.';
      else if (errorMsg.includes('JSON')) errorMsg = 'Error procesando respuesta. Intenta con menos contenido.';
      alert(`❌ Error: ${errorMsg}\n\nSugerencias:\n- Usa "Buscar con IA" en lugar de subir PDF\n- Asegúrate de que los documentos tengan contenido de texto`);
    }
  };

  // 3 pasadas de generación para cobertura total del tema
  const COVERAGE_INSTRUCTIONS = [
    null,
    'Enfócate exclusivamente en aspectos NO cubiertos aún: artículos específicos, plazos exactos, requisitos concretos, excepciones y procedimientos detallados.',
    'Enfócate exclusivamente en aspectos MUY ESPECÍFICOS no preguntados: datos numéricos exactos (porcentajes, importes, días), sanciones, casos especiales, definiciones técnicas y aplicaciones prácticas.'
  ];

  const generateQuestionsComplete = async () => {
    const docs = theme.documents;
    if (!docs || docs.length === 0) {
      if (showToast) showToast('Primero añade documentos a este tema para generar preguntas', 'warning');
      return;
    }

    setIsGeneratingQuestions(true);
    setGenerationPercent(0);

    try {
      const documentContents = buildDocumentContents(docs);
      if (documentContents.trim().length < 100) throw new Error('No hay suficiente contenido.');

      // Acumulamos textos existentes localmente para que cada pasada evite duplicados de las anteriores
      const accumulatedTexts = (theme.questions || []).map(q => q.text.toLowerCase().trim());
      const allNewQuestions = [];

      for (let pass = 0; pass < 3; pass++) {
        setGenerationProgress(`🔄 Pasada ${pass + 1}/3 — ${pass === 0 ? 'conceptos principales' : pass === 1 ? 'detalles y procedimientos' : 'datos específicos'}...`);
        setGenerationPercent(Math.round((pass / 3) * 90) + 5);

        const { newQuestions, duplicatesFound } = await callGenerationAPI(documentContents, accumulatedTexts, COVERAGE_INSTRUCTIONS[pass]);

        if (newQuestions.length > 0) {
          allNewQuestions.push(...newQuestions);
          newQuestions.forEach(q => accumulatedTexts.push(q.text.toLowerCase().trim()));
          setGenerationProgress(`✓ Pasada ${pass + 1}/3: +${newQuestions.length} preguntas (${duplicatesFound} duplic.)`);
        } else {
          setGenerationProgress(`✓ Pasada ${pass + 1}/3: sin preguntas nuevas`);
        }

        if (pass < 2) await new Promise(r => setTimeout(r, 1200));
      }

      setGenerationPercent(98);

      if (allNewQuestions.length === 0) throw new Error('No se generaron preguntas nuevas en ninguna pasada.');

      onUpdate({ ...theme, questions: [...(theme.questions || []), ...allNewQuestions], lastGenerated: new Date().toISOString() });

      setGenerationProgress(`✅ ¡${allNewQuestions.length} preguntas nuevas en 3 pasadas!`);
      setGenerationPercent(100);
      setTimeout(() => { setIsGeneratingQuestions(false); setGenerationProgress(''); setGenerationPercent(0); }, 2500);

    } catch (error) {
      console.error('Error en cobertura completa:', error);
      setIsGeneratingQuestions(false);
      setGenerationProgress('');
      setGenerationPercent(0);
      let errorMsg = error.message;
      if (errorMsg.includes('fetch')) errorMsg = 'Error de conexión. Verifica tu internet.';
      alert(`❌ Error: ${errorMsg}`);
    }
  };

  // ─── Búsqueda IA ─────────────────────────────────────────────
  const handleAISearch = async () => {
    if (!docContent.trim()) { if (showToast) showToast('Describe qué información buscar', 'warning'); return; }
    setIsSearching(true);
    setGenerationProgress('🔍 Buscando y procesando con IA...');
    setGenerationPercent(10);
    try {
      const response = await fetch("/api/generate-gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: OPTIMIZED_SEARCH_PROMPT(docContent, theme.name), maxTokens: 8000 })
      });
      setGenerationProgress('📝 Procesando respuesta...');
      setGenerationPercent(70);
      if (!response.ok) throw new Error(`Error API: ${response.status}`);
      const data = await response.json();
      let processedContent = '';
      for (const block of data.content) { if (block.type === 'text') processedContent += block.text; }
      if (!processedContent.trim() || processedContent.length < 500) throw new Error('No se encontró suficiente información');
      setGenerationProgress('💾 Guardando...');
      setGenerationPercent(90);
      const newDoc = { type: 'ai-search', content: docContent, processedContent, quality: 'optimized', wordCount: processedContent.split(' ').length, addedAt: new Date().toISOString() };
      onUpdate({ ...theme, documents: [...(theme.documents || []), newDoc] });
      setGenerationProgress('✅ ¡Completado!');
      setGenerationPercent(100);
      setTimeout(() => { setDocContent(''); setShowAddDoc(false); setIsSearching(false); setGenerationProgress(''); setGenerationPercent(0); }, 1500);
    } catch (error) {
      console.error('Error en búsqueda IA:', error);
      setIsSearching(false); setGenerationProgress(''); setGenerationPercent(0);
      let errorMsg = error.message;
      if (errorMsg.includes('fetch')) errorMsg = 'Error de conexión. Verifica tu internet.';
      alert(`❌ Error: ${errorMsg}`);
    }
  };

  // ─── Archivo ─────────────────────────────────────────────────
  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    setIsSearching(true);
    setGenerationProgress('📄 Leyendo archivo...');
    event.target.value = '';
    try {
      let textContent = '';
      if (file.name.toLowerCase().endsWith('.pdf')) {
        setGenerationProgress('📄 Extrayendo texto del PDF...');
        textContent = await extractPDFText(file);
      } else {
        textContent = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target.result || '');
          reader.onerror = () => reject(new Error('Error al leer el archivo'));
          reader.readAsText(file);
        });
      }
      const trimmed = textContent.substring(0, 50000);
      if (trimmed.trim().length < 100) throw new Error('El archivo tiene muy poco contenido de texto');
      setGenerationProgress('💾 Guardando documento...');
      const newDoc = { type: 'pdf', fileName: file.name, content: trimmed.substring(0, 35000), processedContent: trimmed.substring(0, 35000), addedAt: new Date().toISOString() };
      onUpdate({ ...theme, documents: [...(theme.documents || []), newDoc] });
      setGenerationProgress('✅ ¡Archivo guardado!');
      setTimeout(() => { setIsSearching(false); setGenerationProgress(''); setShowAddDoc(false); }, 1500);
    } catch (error) {
      setIsSearching(false); setGenerationProgress('');
      alert(`Error: ${error.message}\n\nSugerencia: Usa "Buscar con IA" para mejores resultados.`);
    }
  };

  // ─── Añadir documento (URL/texto) ────────────────────────────
  const handleAddDocument = async () => {
    if (docType === 'pdf') return; // handled by handleFileUpload
    if (docType === 'ai-search') { handleAISearch(); return; }
    if (!docContent.trim()) { alert('Introduce una URL o contenido'); return; }

    if (docType === 'url') {
      try { new URL(docContent); } catch (e) { alert('❌ URL inválida. Debe empezar con http:// o https://'); return; }
      setIsSearching(true);
      setGenerationProgress('🌐 Obteniendo contenido de la web...');
      setGenerationPercent(20);
      try {
        const response = await fetch('/api/scrape-url', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: docContent }) });
        setGenerationPercent(60);
        if (!response.ok) { const errData = await response.json().catch(() => ({})); throw new Error(errData.error || `Error HTTP ${response.status}`); }
        const data = await response.json();
        const processedContent = data.content;
        if (!processedContent || processedContent.length < 100) throw new Error('La página no tiene suficiente contenido de texto. Prueba a pegar el contenido manualmente.');
        setGenerationProgress('💾 Guardando documento...');
        setGenerationPercent(90);
        const newDoc = { type: 'url', content: docContent, fileName: docContent, processedContent, addedAt: new Date().toISOString() };
        onUpdate({ ...theme, documents: [...(theme.documents || []), newDoc] });
        setGenerationProgress('✅ ¡URL guardada!');
        setGenerationPercent(100);
        setTimeout(() => { setDocContent(''); setShowAddDoc(false); setIsSearching(false); setGenerationProgress(''); setGenerationPercent(0); }, 1500);
      } catch (error) {
        setIsSearching(false); setGenerationProgress(''); setGenerationPercent(0);
        alert(`❌ No se pudo procesar la URL\n\n${error.message}\n\n💡 Alternativas:\n• Usa "Buscar con IA"\n• Copia y pega el texto en "Pegar Texto Directamente"`);
      }
    } else {
      const newDoc = { type: 'text', content: docContent, processedContent: docContent, addedAt: new Date().toISOString() };
      onUpdate({ ...theme, documents: [...(theme.documents || []), newDoc] });
      setDocContent(''); setShowAddDoc(false);
    }
  };

  // ─── Preguntas ───────────────────────────────────────────────
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

  const handleManualQuestionAdd = () => {
    if (!newQuestion.text.trim() || newQuestion.options.some(opt => !opt.trim())) { alert('Completa todos los campos'); return; }
    const question = { id: `${theme.number}-manual-${Date.now()}`, ...newQuestion, source: 'Manual', needsReview: false, createdAt: new Date().toISOString() };
    onUpdate({ ...theme, questions: [...(theme.questions || []), question] });
    setNewQuestion({ text: '', options: ['', '', ''], correct: 0, difficulty: 'media' });
    setShowAddQuestion(false);
  };

  // ─── Importación de preguntas (Excel/TXT) ────────────────────
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

  // ─── Render ──────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-hidden">
      <div className="bg-slate-800 border border-white/10 rounded-3xl w-full max-w-3xl h-[90vh] flex flex-col" style={{ maxHeight: '90vh' }}>
        {/* HEADER FIJO */}
        <div className="flex-shrink-0 bg-slate-800 p-4 sm:p-6 border-b border-white/10">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h2 className="text-white font-bold text-lg sm:text-xl">Tema {theme.number}</h2>
                {theme.name === `Tema ${theme.number}` && (
                  <span className="bg-yellow-500/20 text-yellow-400 text-xs px-2 py-0.5 rounded-full">Sin personalizar</span>
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
              <p className="text-gray-500 text-xs mt-1">💡 Escribe un nombre y presiona Enter o click fuera para guardar</p>
            </div>
            <button onClick={onClose} className="bg-white/5 hover:bg-white/10 p-2 rounded-xl transition-colors flex-shrink-0">
              <Icons.X />
            </button>
          </div>
        </div>

        {/* CONTENIDO SCROLLEABLE */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden" style={{ overflowY: 'auto', WebkitOverflowScrolling: 'touch', maxHeight: 'calc(90vh - 140px)' }}>
          <div className="p-4 sm:p-6 space-y-6">

            {/* DOCUMENTOS */}
            <DocumentSection
              theme={theme}
              showAddDoc={showAddDoc}
              docType={docType}
              docContent={docContent}
              isSearching={isSearching}
              isGeneratingQuestions={isGeneratingQuestions}
              generationProgress={generationProgress}
              generationPercent={generationPercent}
              showAutoGenerate={showAutoGenerate}
              isAutoGenerating={isAutoGenerating}
              onToggleAddDoc={() => setShowAddDoc(!showAddDoc)}
              onDocTypeChange={setDocType}
              onDocContentChange={setDocContent}
              onAddDoc={handleAddDocument}
              onFileUpload={handleFileUpload}
              onAISearch={handleAISearch}
              onAutoGenerate={handleAutoGenerateRepository}
              onDismissAutoGenerate={() => setShowAutoGenerate(false)}
              onDeleteDoc={(idx, doc) => {
                const docName = doc.fileName || (doc.type === 'ai-search' ? 'Búsqueda IA' : doc.type === 'url' ? 'Documento web' : 'Documento');
                setDeleteConfirm({ show: true, docIndex: idx, docName });
              }}
              onGenerateFromDoc={generateQuestionsFromDocuments}
              fileInputRef={fileInputRef}
            />

            {/* BANCO DE PREGUNTAS */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-white font-semibold">Preguntas ({theme.questions?.length || 0})</h3>
              </div>

              <QuestionGeneratorPanel
                isGenerating={isGeneratingQuestions}
                progress={generationProgress}
                percent={generationPercent}
                hasDocuments={!!theme.documents?.length}
                onGenerate={generateQuestionsFromDocuments}
                onComplete={generateQuestionsComplete}
                onToggleManual={() => setShowAddQuestion(!showAddQuestion)}
                showManual={showAddQuestion}
              />

              <ManualQuestionForm
                show={showAddQuestion}
                question={newQuestion}
                onChange={setNewQuestion}
                onAdd={handleManualQuestionAdd}
                onClose={() => setShowAddQuestion(false)}
              />

              {/* Importación Excel/TXT */}
              <div className="bg-gradient-to-br from-purple-500/10 to-blue-500/10 border-2 border-purple-300/30 rounded-xl p-6 mb-4">
                <h3 className="text-lg font-semibold mb-4 text-purple-300 flex items-center gap-2">📥 Importar Preguntas</h3>
                <div className="mb-4 bg-white/5 rounded-lg p-4 border border-white/10">
                  <p className="text-sm font-semibold text-gray-300 mb-2">📋 Descargar plantillas:</p>
                  <div className="flex gap-2 flex-wrap">
                    <button onClick={() => downloadExcelTemplate()} className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition flex items-center gap-2 text-sm font-medium shadow-sm">
                      📊 Excel (.xlsx)
                    </button>
                    <button
                      onClick={() => {
                        const template = generatePDFTemplate();
                        const blob = new Blob([template], { type: 'text/plain' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url; a.download = 'plantilla_preguntas.txt'; a.click();
                        URL.revokeObjectURL(url);
                        if (showToast) showToast('📄 Plantilla de texto descargada', 'success');
                      }}
                      className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition flex items-center gap-2 text-sm font-medium shadow-sm"
                    >
                      📄 Texto (.txt)
                    </button>
                  </div>
                </div>
                <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                  <p className="text-sm font-semibold text-gray-300 mb-2">📂 Subir archivo con preguntas:</p>
                  <input
                    type="file"
                    accept=".xlsx,.xls,.txt"
                    onChange={handleImportFile}
                    className="block w-full text-sm text-gray-300 file:mr-4 file:py-2.5 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-purple-500/20 file:text-purple-300 hover:file:bg-purple-500/30 file:cursor-pointer file:transition cursor-pointer border-2 border-dashed border-purple-400/30 rounded-lg p-3 hover:border-purple-400/50 transition"
                  />
                  <div className="mt-3 bg-blue-500/10 border border-blue-400/30 rounded-lg p-3">
                    <p className="text-xs font-semibold text-blue-300 mb-1">📝 Formatos soportados:</p>
                    <ul className="text-xs text-blue-200 space-y-1">
                      <li>• <strong>Excel (.xlsx, .xls):</strong> Columnas: Pregunta | Opción A | Opción B | Opción C | Correcta | Dificultad</li>
                      <li>• <strong>Texto (.txt):</strong> Formato: PREGUNTA: ... / A) ... / B) ... / C) ... / CORRECTA: A / ---</li>
                    </ul>
                  </div>
                </div>
                {theme.questions && theme.questions.length > 0 && (
                  <div className="mt-4 bg-white/5 rounded-lg p-3 border border-white/10">
                    <p className="text-sm text-gray-300">📊 Total de preguntas: <strong className="text-purple-300">{theme.questions.length}</strong></p>
                  </div>
                )}
              </div>

              {/* Lista de preguntas */}
              {theme.questions?.length > 0 && (
                <QuestionList
                  questions={theme.questions}
                  selectMode={selectMode}
                  selectedQuestions={selectedQuestions}
                  onToggleSelectMode={() => { setSelectMode(!selectMode); setSelectedQuestions(new Set()); }}
                  onToggleQuestion={(id) => {
                    const next = new Set(selectedQuestions);
                    if (next.has(id)) next.delete(id); else next.add(id);
                    setSelectedQuestions(next);
                  }}
                  onDeleteSelected={handleDeleteSelected}
                  onDeleteAll={handleDeleteAll}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Diálogo confirmación — documentos */}
      <ConfirmDialog
        show={deleteConfirm.show}
        title="⚠️ Confirmar Eliminación"
        message="¿Estás seguro de que quieres eliminar este documento?"
        detail={`📄 ${deleteConfirm.docName}`}
        confirmLabel="🗑️ SÍ, ELIMINAR"
        onConfirm={() => {
          const newDocs = theme.documents.filter((_, i) => i !== deleteConfirm.docIndex);
          onUpdate({ ...theme, documents: newDocs });
          setDeleteConfirm({ show: false, docIndex: null, docName: '' });
          if (showToast) showToast('Documento eliminado correctamente', 'success');
        }}
        onCancel={() => setDeleteConfirm({ show: false, docIndex: null, docName: '' })}
      />

      {/* Diálogo confirmación — preguntas */}
      <ConfirmDialog
        show={deleteQuestionsConfirm.show}
        title="⚠️ Confirmar Eliminación"
        message={deleteQuestionsConfirm.type === 'all'
          ? '¿Estás seguro de que quieres eliminar TODAS las preguntas?'
          : `¿Estás seguro de que quieres eliminar ${deleteQuestionsConfirm.count} preguntas?`}
        confirmLabel="🗑️ SÍ, ELIMINAR"
        onConfirm={confirmDeleteQuestions}
        onCancel={() => setDeleteQuestionsConfirm({ show: false, type: null, count: 0 })}
      />
    </div>
  );
}

export default ThemeDetailModal;
