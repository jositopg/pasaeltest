import React, { useState } from 'react';
import Icons from '../common/Icons';
import { useTheme } from '../../context/ThemeContext';
import ConfirmDialog from '../common/ConfirmDialog';
import DocumentSection from './DocumentSection';
import QuestionGeneratorPanel from './QuestionGeneratorPanel';
import ManualQuestionForm from './ManualQuestionForm';
import QuestionList from './QuestionList';
import ImportQuestionsPanel from './ImportQuestionsPanel';
import useThemeModal from '../../hooks/useThemeModal';

const DIFF_COLORS = {
  facil: 'bg-green-500/20 text-green-400',
  fácil: 'bg-green-500/20 text-green-400',
  media: 'bg-yellow-500/20 text-yellow-400',
  dificil: 'bg-red-500/20 text-red-400',
  difícil: 'bg-red-500/20 text-red-400',
};

function QuestionPreviewOverlay({ questions, duplicates, onConfirm, onDiscard }) {
  const [selected, setSelected] = useState(() => new Set(questions.map((_, i) => i)));

  const toggle = (i) => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(i)) next.delete(i); else next.add(i);
    return next;
  });

  const allOn = selected.size === questions.length;
  const toggleAll = () => setSelected(allOn ? new Set() : new Set(questions.map((_, i) => i)));

  return (
    <div className="absolute inset-0 z-10 bg-slate-900/95 backdrop-blur-sm rounded-3xl flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 p-4 sm:p-5 border-b border-white/10">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-white font-bold text-base sm:text-lg">
              Revisa las preguntas generadas
            </h3>
            <p className="text-gray-400 text-xs mt-0.5">
              {questions.length} preguntas · seleccionadas {selected.size}
              {duplicates > 0 && ` · ${duplicates} duplicadas eliminadas`}
            </p>
          </div>
          <button
            onClick={toggleAll}
            className="text-xs px-3 py-1.5 rounded-lg bg-white/10 text-gray-300 hover:bg-white/15 transition-colors"
          >
            {allOn ? 'Desmarcar todo' : 'Marcar todo'}
          </button>
        </div>
      </div>

      {/* Lista scrolleable */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2">
        {questions.map((q, i) => {
          const isSelected = selected.has(i);
          const diffKey = (q.difficulty || '').toLowerCase();
          const diffClass = DIFF_COLORS[diffKey] || 'bg-slate-700/50 text-slate-400';
          return (
            <button
              key={i}
              onClick={() => toggle(i)}
              className={`w-full text-left p-3 rounded-xl border transition-all ${
                isSelected
                  ? 'bg-blue-500/15 border-blue-500/40'
                  : 'bg-white/3 border-white/10 opacity-50'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 border transition-colors ${
                  isSelected ? 'bg-blue-500 border-blue-500' : 'border-white/20'
                }`}>
                  {isSelected && <span className="text-white text-xs font-bold">✓</span>}
                </div>
                <div className="flex-1 min-w-0 space-y-2">
                  <p className="text-gray-100 text-sm leading-snug">{q.text}</p>
                  <div className="space-y-1">
                    {(q.options || []).map((opt, oi) => (
                      <p key={oi} className={`text-xs pl-2 border-l-2 ${oi === q.correct ? 'border-green-500 text-green-400' : 'border-white/10 text-gray-500'}`}>
                        {opt}
                      </p>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${diffClass}`}>
                      {q.difficulty || 'media'}
                    </span>
                    {q.explanation && (
                      <span className="text-[10px] text-blue-400/70">💡 Con explicación</span>
                    )}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Acciones */}
      <div className="flex-shrink-0 p-4 border-t border-white/10 flex gap-3">
        <button
          onClick={onDiscard}
          className="flex-1 py-3 rounded-xl text-sm font-semibold bg-white/5 text-gray-400 hover:bg-white/10 transition-colors"
        >
          Descartar
        </button>
        <button
          onClick={() => onConfirm(selected.size < questions.length ? selected : null)}
          disabled={selected.size === 0}
          className="flex-2 flex-grow-[2] py-3 rounded-xl text-sm font-bold bg-blue-600 hover:bg-blue-500 text-white transition-colors disabled:opacity-40"
        >
          Guardar {selected.size} pregunta{selected.size !== 1 ? 's' : ''} →
        </button>
      </div>
    </div>
  );
}

function ThemeDetailModal({ theme, onClose, onUpdate, showToast, readOnly = false }) {
  const { darkMode } = useTheme();
  const [activeTab, setActiveTab] = useState(readOnly ? 'questions' : 'docs');

  const {
    showAddDoc, setShowAddDoc, docType, setDocType, docContent, setDocContent,
    isSearching, generationProgress, generationPercent, fileInputRef,
    isGeneratingQuestions, showAddQuestion, setShowAddQuestion,
    selectedQuestions, setSelectedQuestions, selectMode, setSelectMode,
    newQuestion, setNewQuestion,
    showAutoGenerate, setShowAutoGenerate, isAutoGenerating,
    editingName, setEditingName,
    pendingQuestions, pendingDuplicates, confirmPendingQuestions, discardPendingQuestions,
    deleteConfirm, setDeleteConfirm, deleteQuestionsConfirm,
    estimatedTotal, questionCount, coveragePercent,
    handleSaveName, handleNameKeyPress,
    handleAutoGenerateRepository,
    generateQuestionsFromDocuments,
    handleAISearch, handleFileUpload, handleAddDocument,
    handleDeleteSelected, handleDeleteAll, confirmDeleteQuestions,
    handleEditQuestion,
    handleManualQuestionAdd, handleImportFile,
    qGenerationProgress, qGenerationPercent,
  } = useThemeModal({ theme, onUpdate, showToast });

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-hidden">
      <div className="relative bg-slate-800 border border-white/10 rounded-3xl w-full max-w-3xl h-[90vh] flex flex-col" style={{ maxHeight: '90vh' }}>

        {/* HEADER FIJO */}
        <div className="flex-shrink-0 bg-slate-800 p-4 sm:p-6 border-b border-white/10">
          {readOnly && (
            <div className="mb-3 flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-xl px-3 py-2">
              <span className="text-blue-400 text-sm">🔒 Plan oficial — solo lectura</span>
            </div>
          )}
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h2 className="text-white font-bold text-lg sm:text-xl">Tema {theme.number}</h2>
                {theme.name === `Tema ${theme.number}` && (
                  <span className="bg-yellow-500/20 text-yellow-400 text-xs px-2 py-0.5 rounded-full">Sin personalizar</span>
                )}
              </div>
              {!readOnly && (
                <>
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
                </>
              )}
              {readOnly && (
                <p className="text-gray-300 text-sm font-medium">{theme.name}</p>
              )}
            </div>
            <button onClick={onClose} className="bg-white/5 hover:bg-white/10 p-2 rounded-xl transition-colors flex-shrink-0">
              <Icons.X />
            </button>
          </div>
        </div>

        {/* TAB BAR — sticky, no scrollea */}
        {!readOnly && (
          <div className="flex-shrink-0 flex bg-slate-800 border-b border-white/10 px-4 sm:px-6">
            {[
              { id: 'docs',      label: 'Documentos', count: theme.documents?.length || 0 },
              { id: 'questions', label: 'Preguntas',  count: questionCount },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  relative flex items-center gap-2 px-4 py-3 text-sm font-semibold transition-colors
                  border-b-2 -mb-px
                  ${activeTab === tab.id
                    ? 'text-white border-blue-500'
                    : 'text-gray-400 border-transparent hover:text-gray-200 hover:border-white/20'
                  }
                `}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold tabular-nums ${
                    activeTab === tab.id
                      ? 'bg-blue-500/30 text-blue-300'
                      : 'bg-white/10 text-gray-500'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* CONTENIDO SCROLLEABLE */}
        <div className="flex-1 overflow-y-auto" style={{ overflowY: 'auto', WebkitOverflowScrolling: 'touch', maxHeight: 'calc(90vh - 140px)' }}>
          <div className="p-4 sm:p-6 space-y-6">

            {!readOnly && activeTab === 'docs' && (
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
            )}

            {/* BANCO DE PREGUNTAS */}
            {(readOnly || activeTab === 'questions') && <div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-white font-semibold">
                    Preguntas ({questionCount}{estimatedTotal ? `/${estimatedTotal}` : ''})
                  </h3>
                  {estimatedTotal && (
                    <p className="text-xs mt-0.5 flex items-center gap-1.5">
                      <span className={
                        coveragePercent >= 80 ? 'text-green-400' :
                        coveragePercent >= 50 ? 'text-yellow-400' :
                        coveragePercent >= 20 ? 'text-orange-400' : 'text-gray-500'
                      }>
                        {coveragePercent}% del tema cubierto
                      </span>
                      <span className={`inline-block w-1.5 h-1.5 rounded-full ${
                        coveragePercent >= 80 ? 'bg-green-400' :
                        coveragePercent >= 50 ? 'bg-yellow-400' :
                        coveragePercent >= 20 ? 'bg-orange-400' : 'bg-gray-600'
                      }`} />
                    </p>
                  )}
                </div>
              </div>

              {!readOnly && (
                <>
                  <QuestionGeneratorPanel
                    isGenerating={isGeneratingQuestions}
                    progress={qGenerationProgress}
                    percent={qGenerationPercent}
                    hasDocuments={!!theme.documents?.length}
                    estimatedTotal={estimatedTotal}
                    currentCount={questionCount}
                    coveragePercent={coveragePercent}
                    onGenerate={generateQuestionsFromDocuments}
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
                  <ImportQuestionsPanel
                    theme={theme}
                    onImportFile={handleImportFile}
                    showToast={showToast}
                  />
                </>
              )}

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
                  onEditQuestion={handleEditQuestion}
                />
              )}
            </div>}
          </div>
        </div>
      </div>

      {/* PREVIEW DE PREGUNTAS GENERADAS */}
      {pendingQuestions && (
        <QuestionPreviewOverlay
          questions={pendingQuestions}
          duplicates={pendingDuplicates}
          onConfirm={(selected) => { confirmPendingQuestions(selected); setActiveTab('questions'); }}
          onDiscard={discardPendingQuestions}
        />
      )}

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

      <ConfirmDialog
        show={deleteQuestionsConfirm.show}
        title="⚠️ Confirmar Eliminación"
        message={deleteQuestionsConfirm.type === 'all'
          ? '¿Estás seguro de que quieres eliminar TODAS las preguntas?'
          : `¿Estás seguro de que quieres eliminar ${deleteQuestionsConfirm.count} preguntas?`}
        confirmLabel="🗑️ SÍ, ELIMINAR"
        onConfirm={confirmDeleteQuestions}
        onCancel={() => {}}
      />
    </div>
  );
}

export default ThemeDetailModal;
