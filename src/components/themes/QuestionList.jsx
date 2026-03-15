import React, { useState } from 'react';
import Icons from '../common/Icons';

function EditQuestionForm({ question, onSave, onCancel }) {
  const [draft, setDraft] = useState({
    text: question.text,
    options: [...question.options],
    correct: question.correct,
    difficulty: question.difficulty || 'media',
    explanation: question.explanation || '',
  });

  const canSave = draft.text.trim() && draft.options.every(o => o.trim());

  return (
    <div className="mt-3 pt-3 border-t border-white/10 space-y-3">
      <textarea
        value={draft.text}
        onChange={e => setDraft(d => ({ ...d, text: e.target.value }))}
        placeholder="Pregunta..."
        rows={3}
        className="w-full bg-white/5 text-white text-sm rounded-lg px-3 py-2 border border-white/10 focus:border-blue-500 focus:outline-none resize-none transition-colors"
      />
      {draft.options.map((opt, i) => (
        <div key={i} className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setDraft(d => ({ ...d, correct: i }))}
            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
              draft.correct === i ? 'bg-green-500 border-green-500' : 'border-gray-500 hover:border-gray-400'
            }`}
          >
            {draft.correct === i && <span className="w-2 h-2 rounded-full bg-white block" />}
          </button>
          <input
            value={opt}
            onChange={e => {
              const opts = [...draft.options];
              opts[i] = e.target.value;
              setDraft(d => ({ ...d, options: opts }));
            }}
            placeholder={`Opción ${String.fromCharCode(65 + i)}`}
            className="flex-1 bg-white/5 text-white text-sm rounded-lg px-3 py-1.5 border border-white/10 focus:border-blue-500 focus:outline-none transition-colors"
          />
        </div>
      ))}
      <div className="flex gap-2">
        <select
          value={draft.difficulty}
          onChange={e => setDraft(d => ({ ...d, difficulty: e.target.value }))}
          className="flex-1 bg-white/5 text-white text-sm rounded-lg px-3 py-1.5 border border-white/10 focus:outline-none"
        >
          <option value="facil">Fácil</option>
          <option value="media">Media</option>
          <option value="dificil">Difícil</option>
        </select>
      </div>
      <textarea
        value={draft.explanation}
        onChange={e => setDraft(d => ({ ...d, explanation: e.target.value }))}
        placeholder="Explicación (opcional)..."
        rows={2}
        className="w-full bg-white/5 text-white text-sm rounded-lg px-3 py-2 border border-white/10 focus:border-blue-500 focus:outline-none resize-none transition-colors"
      />
      <div className="flex gap-2">
        <button
          onClick={() => onSave(draft)}
          disabled={!canSave}
          className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-semibold py-2 rounded-lg transition-colors"
        >
          Guardar cambios
        </button>
        <button
          onClick={onCancel}
          className="flex-1 bg-white/5 hover:bg-white/10 text-gray-400 text-sm py-2 rounded-lg transition-colors"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

/**
 * Lista de preguntas con modo selección, borrado y edición inline.
 */
export default function QuestionList({
  questions,
  selectMode,
  selectedQuestions,
  onToggleSelectMode,
  onToggleQuestion,
  onDeleteSelected,
  onDeleteAll,
  onEditQuestion,
}) {
  const [editingId, setEditingId] = useState(null);

  if (!questions || questions.length === 0) return null;

  const allSelected = questions.every(q => selectedQuestions.has(q.id));

  const handleSaveEdit = (q, draft) => {
    onEditQuestion({ ...q, ...draft, difficulty: draft.difficulty });
    setEditingId(null);
  };

  return (
    <>
      {/* Controles de selección */}
      <div className="mb-3 space-y-2">
        <button
          onClick={() => { onToggleSelectMode(); setEditingId(null); }}
          className={`w-full min-h-[44px] px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
            selectMode
              ? 'bg-slate-600 text-white hover:bg-slate-500'
              : 'bg-slate-500/20 text-slate-300 hover:bg-slate-500/30 border border-slate-500/30'
          }`}
        >
          {selectMode ? 'Cancelar selección' : '☑ Seleccionar'}
        </button>

        {selectMode && (
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => {
                if (allSelected) {
                  questions.forEach(q => selectedQuestions.has(q.id) && onToggleQuestion(q.id));
                } else {
                  questions.forEach(q => !selectedQuestions.has(q.id) && onToggleQuestion(q.id));
                }
              }}
              className="flex-1 min-h-[44px] bg-blue-500 text-white px-3 py-2 rounded-xl text-xs font-semibold"
            >
              {allSelected ? 'Deselect. todo' : 'Select. todo'}
            </button>
            <button
              onClick={onDeleteSelected}
              disabled={selectedQuestions.size === 0}
              className="min-h-[44px] bg-red-500 text-white px-3 py-2 rounded-xl text-xs font-semibold disabled:opacity-50"
            >
              Borrar ({selectedQuestions.size})
            </button>
            <button
              onClick={onDeleteAll}
              className="min-h-[44px] bg-red-700 text-white px-3 py-2 rounded-xl text-xs font-semibold"
            >
              Borrar todo
            </button>
          </div>
        )}
      </div>

      {/* Lista */}
      <div className="space-y-2">
        {questions.map((q, idx) => {
          const isEditing = editingId === q.id;
          return (
            <div key={q.id} className={`border rounded-lg p-3 transition-colors ${
              isEditing ? 'bg-blue-500/8 border-blue-500/30' : 'bg-white/5 border-white/10'
            }`}>
              <div className="flex items-start gap-3">
                {selectMode && (
                  <button
                    onClick={() => onToggleQuestion(q.id)}
                    className={`mt-1 w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                      selectedQuestions.has(q.id) ? 'bg-blue-500 border-blue-500' : 'border-gray-500'
                    }`}
                  >
                    {selectedQuestions.has(q.id) && <Icons.Check />}
                  </button>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">Q{idx + 1}</span>
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        q.difficulty === 'fácil' || q.difficulty === 'facil'
                          ? 'bg-green-500/20 text-green-400'
                          : q.difficulty === 'media'
                            ? 'bg-yellow-500/20 text-yellow-400'
                            : 'bg-red-500/20 text-red-400'
                      }`}>
                        {q.difficulty}
                      </span>
                    </div>
                    {!selectMode && onEditQuestion && (
                      <button
                        onClick={() => setEditingId(isEditing ? null : q.id)}
                        className={`p-1.5 rounded-lg text-xs transition-colors flex-shrink-0 ${
                          isEditing
                            ? 'bg-blue-500/20 text-blue-400'
                            : 'text-gray-500 hover:text-gray-300 hover:bg-white/8'
                        }`}
                        title="Editar pregunta"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                    )}
                  </div>
                  <p className="text-gray-300 text-sm mb-2">{q.text}</p>
                  <div className="space-y-1">
                    {q.options.map((opt, i) => (
                      <div key={i} className={`text-xs px-2 py-1 rounded ${
                        i === q.correct ? 'bg-green-500/10 text-green-400' : 'text-gray-500'
                      }`}>
                        {i === q.correct ? '✓ ' : '○ '}{opt}
                      </div>
                    ))}
                  </div>
                  {q.explanation && !isEditing && (
                    <p className="mt-2 text-xs text-blue-400/70 leading-snug">💡 {q.explanation}</p>
                  )}
                </div>
              </div>

              {isEditing && (
                <EditQuestionForm
                  question={q}
                  onSave={(draft) => handleSaveEdit(q, draft)}
                  onCancel={() => setEditingId(null)}
                />
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
