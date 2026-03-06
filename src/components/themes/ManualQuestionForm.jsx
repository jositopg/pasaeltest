import React from 'react';

/**
 * Formulario para añadir una pregunta manualmente.
 * Props: show, question, onChange, onAdd, onClose
 */
export default function ManualQuestionForm({ show, question, onChange, onAdd, onClose }) {
  if (!show) return null;

  return (
    <div className="mt-3 space-y-3 border-t border-white/10 pt-3">
      <h4 className="text-white font-semibold text-sm">Nueva Pregunta</h4>
      <textarea
        placeholder="Pregunta..."
        value={question.text}
        onChange={(e) => onChange({ ...question, text: e.target.value })}
        className="w-full bg-white/5 text-white rounded-lg px-3 py-2 border border-white/10 min-h-20 resize-none"
      />
      {question.options.map((opt, i) => (
        <div key={i} className="flex gap-2">
          <input
            type="radio"
            checked={question.correct === i}
            onChange={() => onChange({ ...question, correct: i })}
            className="w-4 h-4 mt-1"
          />
          <input
            placeholder={`Opción ${String.fromCharCode(65 + i)}`}
            value={opt}
            onChange={(e) => {
              const opts = [...question.options];
              opts[i] = e.target.value;
              onChange({ ...question, options: opts });
            }}
            className="flex-1 bg-white/5 text-white rounded-lg px-3 py-2 border border-white/10"
          />
        </div>
      ))}
      <select
        value={question.difficulty}
        onChange={(e) => onChange({ ...question, difficulty: e.target.value })}
        className="w-full bg-white/5 text-white rounded-lg px-3 py-2 border border-white/10"
      >
        <option value="facil">Fácil</option>
        <option value="media">Media</option>
        <option value="dificil">Difícil</option>
      </select>
      <div className="flex gap-2">
        <button onClick={onAdd} className="flex-1 bg-green-500 text-white font-semibold py-2 rounded-lg">
          Guardar
        </button>
        <button onClick={onClose} className="flex-1 bg-white/5 text-white py-2 rounded-lg">
          Cancelar
        </button>
      </div>
    </div>
  );
}
