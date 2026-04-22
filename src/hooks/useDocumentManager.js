import { useState, useRef } from 'react';
import { extractPDFText } from '../utils/questionImporter';
import { authHelpers } from '../supabaseClient';
import { MAX_CHARS } from '../utils/constants';

export default function useDocumentManager({ theme, onUpdate, showToast }) {
  const [showAddDoc, setShowAddDoc] = useState(false);
  const [docType, setDocType] = useState('pdf');
  const [docContent, setDocContent] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [progress, setProgress] = useState('');
  const [percent, setPercent] = useState(0);
  const [deleteConfirm, setDeleteConfirm] = useState({ show: false, docIndex: null, docName: '' });
  const fileInputRef = useRef(null);

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
      const trimmed = textContent.substring(0, MAX_CHARS);
      if (trimmed.trim().length < 100) throw new Error('El archivo tiene muy poco contenido de texto');
      setProgress('💾 Guardando documento...');
      const newDoc = { type: 'pdf', fileName: file.name, content: trimmed, processedContent: trimmed, addedAt: new Date().toISOString() };
      onUpdate({ ...theme, documents: [...(theme.documents || []), newDoc] });
      setProgress('✅ ¡Archivo guardado!');
      setTimeout(() => { setIsSearching(false); setProgress(''); setShowAddDoc(false); }, 1500);
    } catch (error) {
      setIsSearching(false); setProgress('');
      showToast?.(`Error: ${error.message}`, 'error');
    }
  };

  const handleAddDocument = async () => {
    if (docType === 'pdf') return;
    if (!docContent.trim()) { showToast?.('Introduce una URL o contenido', 'warning'); return; }
    if (docType === 'url') {
      try { new URL(docContent); } catch { showToast?.('URL inválida. Debe empezar con http:// o https://', 'error'); return; }
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
        showToast?.(`No se pudo procesar la URL: ${error.message}`, 'error');
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
    handleFileUpload,
    handleAddDocument,
  };
}
