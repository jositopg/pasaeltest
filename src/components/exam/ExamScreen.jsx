import React, { useState, useEffect } from 'react';
import { GRADIENT_BG } from '../../utils/constants';

function ExamScreen({ config, themes, onFinish, onNavigate, onUpdateThemes, darkMode }) {
  const dm = darkMode;
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState({});
  const [showResults, setShowResults] = useState(false);
  const [answeredQuestions, setAnsweredQuestions] = useState(new Set());
  
  // Generar preguntas UNA SOLA VEZ al inicio
  const [questions] = useState(() => {
    const allQuestions = themes
      .filter(t => config.selectedThemes.includes(t.number))
      .flatMap(t => (t.questions || []).map(q => ({ ...q, themeNumber: t.number })));
    
    return allQuestions
      .sort(() => Math.random() - 0.5)
      .slice(0, Math.min(config.numQuestions, allQuestions.length));
  });

  const handleAnswer = (selectedIndex) => {
    const q = questions[current];
    const wasCorrect = selectedIndex === q.correct;
    
    setAnswers({ ...answers, [current]: selectedIndex });
    setAnsweredQuestions(prev => new Set([...prev, current]));
    
    // Actualizar estadísticas de la pregunta
    const theme = themes.find(t => t.number === q.themeNumber);
    if (theme) {
      const updatedQuestions = theme.questions.map(qu => {
        if (qu.id === q.id) {
          return {
            ...qu,
            attempts: (qu.attempts || 0) + 1,
            errors: (qu.errors || 0) + (wasCorrect ? 0 : 1)
          };
        }
        return qu;
      });
      
      onUpdateThemes({
        ...theme,
        questions: updatedQuestions
      });
    }
    
    // Auto-avanzar después de mostrar feedback
    setTimeout(() => {
      if (current < questions.length - 1) {
        setCurrent(current + 1);
      } else {
        setShowResults(true);
      }
    }, 2500); // 2.5 segundos para ver el feedback
  };

  const handleNext = () => {
    if (current < questions.length - 1) {
      setCurrent(current + 1);
    } else {
      setShowResults(true);
    }
  };

  const calculateScore = () => {
    let correct = 0, incorrect = 0;
    
    Object.entries(answers).forEach(([idx, ans]) => {
      const q = questions[idx];
      if (q.correct === ans) correct++;
      else incorrect++;
    });
    
    const penalty = Math.floor(incorrect / 3);
    const final = Math.max(0, correct - penalty);
    return { 
      correct, 
      incorrect, 
      penalty, 
      finalScore: final, 
      percentage: ((final / questions.length) * 100).toFixed(1)
    };
  };

  if (questions.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-6 flex items-center justify-center">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center max-w-md">
          <h2 className="text-white text-xl font-bold mb-4">Sin preguntas</h2>
          <p className="text-gray-400 mb-6">Genera preguntas primero</p>
          <button onClick={() => onNavigate('themes')} className="bg-blue-500 text-white px-6 py-3 rounded-xl font-semibold">
            Ir a Temas
          </button>
        </div>
      </div>
    );
  }

  if (showResults) {
    const score = calculateScore();
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-6">
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="bg-white/5 border border-white/10 rounded-3xl p-8 text-center">
            <h2 className="text-white text-2xl font-bold mb-4">¡Completado!</h2>
            <div className="text-6xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              {score.percentage}%
            </div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-300">Correctas</span>
              <span className="text-green-400 font-bold">{score.correct}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Incorrectas</span>
              <span className="text-red-400 font-bold">{score.incorrect}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Penalización</span>
              <span className="text-orange-400 font-bold">-{score.penalty}</span>
            </div>
          </div>
          <button onClick={() => onFinish(score)} className="w-full bg-blue-500 text-white font-bold py-4 rounded-2xl">
            Volver
          </button>
        </div>
      </div>
    );
  }

  const q = questions[current];
  const progress = ((current + 1) / questions.length) * 100;
  const userAnswer = answers[current];
  const isAnswered = answeredQuestions.has(current);

  return (
    <div className={`min-h-full ${dm ? 'bg-[#080C14]' : 'bg-[#F0F4FF]'} p-3 sm:p-4 transition-colors`} style={{ paddingBottom: '100px' }}>
      <div className="max-w-2xl mx-auto space-y-3 sm:space-y-4 md:space-y-6">
        <div className="bg-white/5 border border-white/10 rounded-xl sm:rounded-2xl p-3 sm:p-4">
          <div className="flex justify-between mb-2 gap-2">
            <span className="text-gray-300 text-xs sm:text-sm">Pregunta {current + 1}/{questions.length}</span>
            <span className="text-blue-400 text-xs sm:text-sm font-semibold">Tema {q.themeNumber}</span>
          </div>
          <div className="w-full h-2 bg-white/10 rounded-full">
            <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${progress}%` }}></div>
          </div>
        </div>
        
        <div className="bg-white/5 border border-white/10 rounded-xl sm:rounded-2xl p-4 sm:p-5 md:p-6">
          <p className="text-white text-sm sm:text-base md:text-lg leading-relaxed">{q.text}</p>
        </div>
        
        <div className="space-y-2 sm:space-y-3">
          {q.options.map((opt, i) => {
            const isCorrect = i === q.correct;
            const isSelected = userAnswer === i;
            const wasWrong = isAnswered && isSelected && !isCorrect;
            
            let buttonClass = 'bg-white/5 text-gray-300 hover:bg-white/10';
            
            if (isAnswered) {
              // Ya se respondió esta pregunta
              if (isCorrect) {
                // La correcta siempre en verde
                buttonClass = 'bg-green-500 text-white border-2 border-green-400';
              } else if (isSelected) {
                // La que seleccionó (incorrecta) en rojo
                buttonClass = 'bg-red-500 text-white border-2 border-red-400';
              } else {
                // Las demás opciones grises
                buttonClass = 'bg-white/5 text-gray-400';
              }
            }
            
            return (
              <button 
                key={i} 
                onClick={() => !isAnswered && handleAnswer(i)}
                disabled={isAnswered}
                className={`w-full text-left p-3 sm:p-4 rounded-lg sm:rounded-xl transition-all text-sm sm:text-base ${buttonClass} ${isAnswered ? 'cursor-default' : 'cursor-pointer active:scale-[0.98]'}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex-1">{opt}</span>
                  {isAnswered && isCorrect && (
                    <span className="text-2xl">✓</span>
                  )}
                  {isAnswered && wasWrong && (
                    <span className="text-2xl">✗</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Mostrar explicación si está respondido */}
        {isAnswered && (
          <div className={`border rounded-2xl p-4 ${userAnswer === q.correct ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
            {userAnswer === q.correct ? (
              <div>
                <p className="text-green-400 font-semibold mb-2">✓ ¡Correcto!</p>
                <p className="text-gray-300 text-sm">
                  La respuesta correcta es: <span className="font-semibold text-white">{q.options[q.correct]}</span>
                </p>
              </div>
            ) : (
              <div>
                <p className="text-red-400 font-semibold mb-2">✗ Incorrecto</p>
                <p className="text-gray-300 text-sm">
                  Tu respuesta: <span className="font-semibold text-red-300">{q.options[userAnswer]}</span>
                </p>
                <p className="text-gray-300 text-sm mt-1">
                  La correcta es: <span className="font-semibold text-green-300">{q.options[q.correct]}</span>
                </p>
              </div>
            )}
          </div>
        )}
        
        <div className="flex gap-3">
          <button 
            onClick={() => setCurrent(c => Math.max(0, c - 1))} 
            disabled={current === 0} 
            className="flex-1 bg-white/5 text-white py-4 rounded-xl disabled:opacity-30"
          >
            Anterior
          </button>
          {isAnswered && (
            <button 
              onClick={handleNext} 
              className="flex-1 bg-blue-500 text-white py-4 rounded-xl"
            >
              {current === questions.length - 1 ? 'Ver Resultados' : 'Siguiente'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}


export default ExamScreen;
