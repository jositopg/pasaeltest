import { useState, useEffect, useMemo } from 'react';
import { parseExcelQuestions, parsePDFQuestions } from '../utils/questionImporter';
import { analyzeDocument } from '../utils/documentAnalyzer';
import useDocumentManager from './useDocumentManager';
import useQuestionGeneration from './useQuestionGeneration';

export default function useThemeModal({ theme, onUpdate, showToast }) {
  // ─── Generación IA (delegado a useQuestionGeneration) ────
  const qGen = useQuestionGeneration({ theme, onUpdate, showToast });

  // ─── Documentos (delegado a useDocumentManager) ──────────
  const docManager = useDocumentManager({ theme, onUpdate, showToast, onQuestionsReady: qGen.onQuestionsReady });

  // ─── Estado preguntas ────────────────────────────────────
  const [showAddQuestion, setShowAddQuestion] = useState(false);
  const [selectedQuestions, setSelectedQuestions] = useState(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [newQuestion, setNewQuestion] = useState({ text: '', options: ['', '', ''], correct: 0, difficulty: 'media' });

  // ─── Estado importación de archivo (separado de IA) ──────
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState('');
  const [importPercent, setImportPercent] = useState(0);

  // ─── Estado nombre ────────────────────────────────────────
  const [editingName, setEditingName] = useState(theme.name);

  // ─── Estado confirmaciones ────────────────────────────────
  const [deleteQuestionsConfirm, setDeleteQuestionsConfirm] = useState({ show: false, type: null, count: 0 });

  // ─── Efectos ─────────────────────────────────────────────
  useEffect(() => { setEditingName(theme.name); }, [theme.name]);

  // ─── Cobertura (sin API) ──────────────────────────────────
  const estimatedTotal = useMemo(() => {
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
  }, [theme.documents]);
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
      setIsImporting(true);
      setImportProgress('📥 Leyendo archivo...');
      setImportPercent(10);
      let questions;
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        setImportProgress('📊 Procesando Excel...');
        setImportPercent(30);
        questions = await parseExcelQuestions(file);
      } else if (file.name.endsWith('.txt')) {
        setImportProgress('📄 Procesando texto...');
        setImportPercent(30);
        const text = await file.text();
        questions = await parsePDFQuestions(text);
      } else {
        throw new Error('Formato no soportado. Usa .xlsx o .txt');
      }
      if (!questions || questions.length === 0) throw new Error('No se encontraron preguntas válidas en el archivo');
      setImportProgress('✓ Validando preguntas...');
      setImportPercent(70);
      const validQuestions = questions.filter(q => q.text && q.text.length > 10 && Array.isArray(q.options) && q.options.length === 3 && q.correct >= 0 && q.correct <= 2);
      if (validQuestions.length === 0) throw new Error('Ninguna pregunta pasó la validación. Revisa el formato.');
      if (validQuestions.length < questions.length && showToast) {
        showToast(`⚠️ ${questions.length - validQuestions.length} preguntas con formato incorrecto`, 'warning');
      }
      setImportProgress('💾 Guardando preguntas...');
      setImportPercent(90);
      onUpdate({ ...theme, questions: [...(theme.questions || []), ...validQuestions] });
      setImportProgress(`✅ ${validQuestions.length} preguntas importadas`);
      setImportPercent(100);
      if (showToast) showToast(`✅ ${validQuestions.length} pregunta${validQuestions.length > 1 ? 's' : ''} importada${validQuestions.length > 1 ? 's' : ''} exitosamente`, 'success');
      setTimeout(() => { setIsImporting(false); setImportProgress(''); setImportPercent(0); }, 2000);
    } catch (error) {
      console.error('Error importando preguntas:', error);
      setImportProgress(`❌ Error: ${error.message}`);
      if (showToast) showToast(`❌ Error: ${error.message}`, 'error');
      setTimeout(() => { setIsImporting(false); setImportProgress(''); setImportPercent(0); }, 3000);
    }
    e.target.value = '';
  };

  // Combinar estados de progreso: IA tiene prioridad sobre importación
  const isGeneratingQuestions = qGen.isGeneratingQuestions || isImporting;
  const qGenerationProgress = qGen.isGeneratingQuestions ? qGen.qGenerationProgress : importProgress;
  const qGenerationPercent = qGen.isGeneratingQuestions ? qGen.qGenerationPercent : importPercent;

  return {
    // ── Documentos (desde useDocumentManager) ───────────────
    ...docManager,
    // Alias para DocumentSection: doc processing tiene prioridad, si no hay usa el de generación de preguntas
    generationProgress: docManager.docProgress || qGen.qGenerationProgress,
    generationPercent: docManager.docPercent || qGen.qGenerationPercent,

    // ── Preguntas ────────────────────────────────────────────
    isGeneratingQuestions,
    showAddQuestion, setShowAddQuestion,
    selectedQuestions, setSelectedQuestions,
    selectMode, setSelectMode,
    newQuestion, setNewQuestion,
    // Progress de generación de preguntas (separado del de docs)
    qGenerationProgress,
    qGenerationPercent,
    // Preview (desde useQuestionGeneration)
    pendingQuestions: qGen.pendingQuestions,
    pendingDuplicates: qGen.pendingDuplicates,
    confirmPendingQuestions: qGen.confirmPendingQuestions,
    discardPendingQuestions: qGen.discardPendingQuestions,
    // Confirmaciones
    deleteQuestionsConfirm,
    // Handlers
    generateQuestionsFromDocuments: qGen.generateQuestionsFromDocuments,
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
