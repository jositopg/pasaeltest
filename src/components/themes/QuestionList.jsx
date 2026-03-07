import React from 'react';
import Icons from '../common/Icons';

/**
 * Lista de preguntas con modo selección y acciones de borrado.
 */
export default function QuestionList({
  questions,
  selectMode,
  selectedQuestions,
  onToggleSelectMode,
  onToggleQuestion,
  onDeleteSelected,
  onDeleteAll,
}) {
  if (!questions || questions.length === 0) return null;

  const allSelected = questions.every(q => selectedQuestions.has(q.id));

  return (
    <>
      {/* Controles de selección */}
      <div className="mb-3 space-y-2">
        {/* Fila 1: toggle selección */}
        <button
          onClick={() => onToggleSelectMode()}
          className="w-full min-h-[44px] bg-orange-500 text-white px-3 py-2 rounded-xl text-xs font-semibold"
        >
          {selectMode ? 'Cancelar' : '☑ Seleccionar'}
        </button>

        {/* Fila 2: acciones (solo en selectMode) */}
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
              Todo
            </button>
          </div>
        )}
      </div>

      {/* Lista */}
      <div className="space-y-2">
        {questions.map((q, idx) => (
          <div key={q.id} className="bg-white/5 border border-white/10 rounded-lg p-3">
            <div className="flex items-start gap-3">
              {selectMode && (
                <button
                  onClick={() => onToggleQuestion(q.id)}
                  className={`mt-1 w-5 h-5 rounded border-2 flex items-center justify-center ${
                    selectedQuestions.has(q.id) ? 'bg-blue-500 border-blue-500' : 'border-gray-500'
                  }`}
                >
                  {selectedQuestions.has(q.id) && <Icons.Check />}
                </button>
              )}
              <div className="flex-1">
                <div className="flex gap-2 mb-1">
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
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
