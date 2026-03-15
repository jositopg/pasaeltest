import { useState, useRef } from 'react';
import { OPTIMIZED_SEARCH_PROMPT, OPTIMIZED_AUTO_GENERATE_PROMPT } from '../utils/optimizedPrompts';
import { extractPDFText } from '../utils/questionImporter';
import { authHelpers } from '../supabaseClient';

export default function useDocumentManager({ theme, onUpdate, showToast }) {
  const isDefaultName = theme.name === `Tema ${theme.number}`;

  const [showAddDoc, setShowAddDoc] = useState(!theme.documents?.length && !isDefaultName);
  const [docType, setDocType] = useState('ai-search');
  const [docContent, setDocContent] = useState(isDefaultName ? '' : theme.name);
  const [isSearching, setIsSearching] = useState(false);
  const [progress, setProgress] = useState('');
  const [percent, setPercent] = useState(0);
  const [deleteConfirm, setDeleteConfirm] = useState({ show: false, docIndex: null, docName: '' });
  const [showAutoGenerate, setShowAutoGenerate] = useState(false);
  const [isAutoGenerating, setIsAutoGenerating] = useState(false);
  const fileInputRef = useRef(null);

  const handleAutoGenerateRepository = async () => {
    setIsAutoGenerating(true);
    setShowAutoGenerate(false);
    if (showToast) showToast(`Generando repositorio para "${theme.name}"...`, 'info');
    try {
      setIsSearching(true);
      const token = await authHelpers.getAccessToken();
      const response = await fetch('/api/generate-gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token && { 'Authorization': `Bearer ${token}` }) },
        body: JSON.stringify({ prompt: OPTIMIZED_AUTO_GENERATE_PROMPT(theme.name), maxTokens: 8000, callType: 'repo', useCache: false }),
      });
      if (!response.ok) throw new Error('Error en la búsqueda');
      const data = await response.json();
      if (!Array.isArray(data.content)) throw new Error('Respuesta de la IA inválida. Reintenta.');
      let searchContent = '';
      for (const block of data.content) { if (block.type === 'text') searchContent += block.text; }
      if (searchContent.trim().length < 100) throw new Error('La IA no devolvió contenido suficiente');
      const newDoc = {
        type: 'ai-search', content: theme.name,
        fileName: `Repositorio: ${theme.name}`,
        addedAt: new Date().toISOString(),
        searchResults: { query: theme.name, content: searchContent, processedContent: searchContent },
        processedContent: searchContent,
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

  const handleAISearch = async () => {
    if (!docContent.trim()) { if (showToast) showToast('Describe qué información buscar', 'warning'); return; }
    setIsSearching(true);
    setProgress('🔍 Buscando y procesando con IA...');
    setPercent(10);
    try {
      const token = await authHelpers.getAccessToken();
      const response = await fetch('/api/generate-gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token && { 'Authorization': `Bearer ${token}` }) },
        body: JSON.stringify({ prompt: OPTIMIZED_SEARCH_PROMPT(docContent, theme.name), maxTokens: 8000, callType: 'search' }),
      });
      setProgress('📝 Procesando respuesta...');
      setPercent(70);
      if (!response.ok) throw new Error(`Error API: ${response.status}`);
      const data = await response.json();
      if (!Array.isArray(data.content)) throw new Error('Respuesta de la IA inválida. Reintenta.');
      let processedContent = '';
      for (const block of data.content) { if (block.type === 'text') processedContent += block.text; }
      if (!processedContent.trim() || processedContent.length < 500) throw new Error('No se encontró suficiente información');
      setProgress('💾 Guardando...');
      setPercent(90);
      const newDoc = { type: 'ai-search', content: docContent, processedContent, quality: 'optimized', wordCount: processedContent.split(' ').length, addedAt: new Date().toISOString() };
      onUpdate({ ...theme, documents: [...(theme.documents || []), newDoc] });
      setProgress('✅ ¡Completado!');
      setPercent(100);
      setTimeout(() => { setDocContent(''); setShowAddDoc(false); setIsSearching(false); setProgress(''); setPercent(0); }, 1500);
    } catch (error) {
      console.error('Error en búsqueda IA:', error);
      setIsSearching(false); setProgress(''); setPercent(0);
      let errorMsg = error.message;
      if (errorMsg.includes('fetch')) errorMsg = 'Error de conexión. Verifica tu internet.';
      alert(`❌ Error: ${errorMsg}`);
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    setIsSearching(true);
    setProgress('📄 Leyendo archivo...');
    event.target.value = '';
    try {
      let textContent = '';
      if (file.name.toLowerCase().endsWith('.pdf')) {
        setProgress('📄 Extrayendo texto del PDF...');
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
      setProgress('💾 Guardando documento...');
      const newDoc = { type: 'pdf', fileName: file.name, content: trimmed.substring(0, 35000), processedContent: trimmed.substring(0, 35000), addedAt: new Date().toISOString() };
      onUpdate({ ...theme, documents: [...(theme.documents || []), newDoc] });
      setProgress('✅ ¡Archivo guardado!');
      setTimeout(() => { setIsSearching(false); setProgress(''); setShowAddDoc(false); }, 1500);
    } catch (error) {
      setIsSearching(false); setProgress('');
      alert(`Error: ${error.message}\n\nSugerencia: Usa "Buscar con IA" para mejores resultados.`);
    }
  };

  const handleAddDocument = async () => {
    if (docType === 'pdf') return;
    if (docType === 'ai-search') { handleAISearch(); return; }
    if (!docContent.trim()) { alert('Introduce una URL o contenido'); return; }
    if (docType === 'url') {
      try { new URL(docContent); } catch { alert('❌ URL inválida. Debe empezar con http:// o https://'); return; }
      setIsSearching(true);
      setProgress('🌐 Obteniendo contenido de la web...');
      setPercent(20);
      try {
        const token = await authHelpers.getAccessToken();
        const response = await fetch('/api/scrape-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(token && { 'Authorization': `Bearer ${token}` }) },
          body: JSON.stringify({ url: docContent }),
        });
        setPercent(60);
        if (!response.ok) { const errData = await response.json().catch(() => ({})); throw new Error(errData.error || `Error HTTP ${response.status}`); }
        const data = await response.json();
        if (!data.content || data.content.length < 100) throw new Error('La página no tiene suficiente contenido de texto. Prueba a pegar el contenido manualmente.');
        setProgress('💾 Guardando documento...');
        setPercent(90);
        const newDoc = { type: 'url', content: docContent, fileName: docContent, processedContent: data.content, addedAt: new Date().toISOString() };
        onUpdate({ ...theme, documents: [...(theme.documents || []), newDoc] });
        setProgress('✅ ¡URL guardada!');
        setPercent(100);
        setTimeout(() => { setDocContent(''); setShowAddDoc(false); setIsSearching(false); setProgress(''); setPercent(0); }, 1500);
      } catch (error) {
        setIsSearching(false); setProgress(''); setPercent(0);
        alert(`❌ No se pudo procesar la URL\n\n${error.message}\n\n💡 Alternativas:\n• Usa "Buscar con IA"\n• Copia y pega el texto en "Pegar Texto Directamente"`);
      }
    } else {
      const newDoc = { type: 'text', content: docContent, processedContent: docContent, addedAt: new Date().toISOString() };
      onUpdate({ ...theme, documents: [...(theme.documents || []), newDoc] });
      setDocContent(''); setShowAddDoc(false);
    }
  };

  return {
    showAddDoc, setShowAddDoc,
    docType, setDocType,
    docContent, setDocContent,
    isSearching,
    docProgress: progress,
    docPercent: percent,
    fileInputRef,
    deleteConfirm, setDeleteConfirm,
    showAutoGenerate, setShowAutoGenerate,
    isAutoGenerating,
    handleAutoGenerateRepository,
    handleAISearch,
    handleFileUpload,
    handleAddDocument,
  };
}
