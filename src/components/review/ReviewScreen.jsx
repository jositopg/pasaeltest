import React, { useState, useEffect } from 'react';
import Icons from '../common/Icons';
import { calculateNextReview, getDifficultyColor, formatNextReview } from '../../utils/srs';

function ReviewScreen({ dueQuestions, themes, onUpdateTheme, onNavigate, showToast, darkMode }) {
  const dm = darkMode;
  const [current, setCurrent] = useState(0);
  const [isAnswered, setIsAnswered] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [sessionStats, setSessionStats] = useState({ correct: 0, incorrect: 0, total: dueQuestions.length });
  const [sessionComplete, setSessionComplete] = useState(false);

  const questions = dueQuestions;

  if (!questions || questions.length === 0) {
    return (
      <div className={`min-h-full ${dm ? 'bg-[#080C14]' : 'bg-[#F0F4FF]'} p-6 flex items-center justify-center`} style={{ paddingBottom: '100px' }}>
        <div className={`rounded-2xl p-8 text-center max-w-md ${dm ? 'bg-white/5 border border-white/10' : 'bg-white border border-slate-200 shadow-lg'}`}>
          <div className="text-6xl mb-4">🎉</div>
          <h2 className={`text-xl font-bold mb-2 ${dm ? 'text-white' : 'text-slate-800'}`}>¡Todo al día!</h2>
          <p className={`mb-6 ${dm ? 'text-gray-400' : 'text-slate-500'}`}>
            No tienes preguntas pendientes de repaso. Vuelve mañana o genera más preguntas.
          </p>
          <button 
            onClick={() => onNavigate('home')} 
            className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold transition-colors"
          >
            Volver al inicio
          </button>
        </div>
      </div>
    );
  }

  if (sessionComplete) {
    const pct = sessionStats.total > 0 
      ? Math.round((sessionStats.correct / sessionStats.total) * 100) 
      : 0;
    
    return (
      <div className={`min-h-full ${dm ? 'bg-[#080C14]' : 'bg-[#F0F4FF]'} p-6`} style={{ paddingBottom: '100px' }}>
        <div className="max-w-2xl mx-auto space-y-6">
          <div className={`rounded-3xl p-8 text-center ${dm ? 'bg-white/5 border border-white/10' : 'bg-white border border-slate-200 shadow-lg'}`}>
            <div className="text-5xl mb-4">{pct >= 80 ? '🏆' : pct >= 50 ? '💪' : '📚'}</div>
            <h2 className={`text-2xl font-bold mb-2 ${dm ? 'text-white' : 'text-slate-800'}`}>Repaso completado</h2>
            <div className="text-5xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent my-4">
              {pct}%
            </div>
          </div>
          
          <div className={`rounded-2xl p-6 space-y-3 ${dm ? 'bg-white/5 border border-white/10' : 'bg-white border border-slate-200 shadow-sm'}`}>
            <div className="flex justify-between">
              <span className={dm ? 'text-gray-300' : 'text-slate-600'}>Correctas</span>
              <span className="text-green-500 font-bold">{sessionStats.correct}</span>
            </div>
            <div className="flex justify-between">
              <span className={dm ? 'text-gray-300' : 'text-slate-600'}>Incorrectas</span>
              <span className="text-red-500 font-bold">{sessionStats.incorrect}</span>
            </div>
            <div className="flex justify-between">
              <span className={dm ? 'text-gray-300' : 'text-slate-600'}>Total repasadas</span>
              <span className={`font-bold ${dm ? 'text-white' : 'text-slate-800'}`}>{sessionStats.total}</span>
            </div>
          </div>

          <div className={`rounded-2xl p-4 text-center ${dm ? 'bg-blue-500/10 border border-blue-500/30' : 'bg-blue-50 border border-blue-200'}`}>
            <p className={`text-sm ${dm ? 'text-blue-300' : 'text-blue-700'}`}>
              El algoritmo ha ajustado las fechas de repaso. Las preguntas que fallaste volverán pronto.
            </p>
          </div>
          
          <button 
            onClick={() => onNavigate('home')} 
            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-4 rounded-2xl transition-colors shadow-md"
          >
            Volver al inicio
          </button>
        </div>
      </div>
    );
  }

  const q = questions[current];
  const progress = ((current + 1) / questions.length) * 100;
  const diffColor = getDifficultyColor(q.difficulty);
  const wasCorrect = selectedAnswer === q.correct;

  const handleAnswer = (index) => {
    if (isAnswered) return;
    
    setSelectedAnswer(index);
    setIsAnswered(true);
    
    const correct = index === q.correct;
    
    // Update session stats
    setSessionStats(prev => ({
      ...prev,
      correct: prev.correct + (correct ? 1 : 0),
      incorrect: prev.incorrect + (correct ? 0 : 1),
    }));

    // Calculate new SRS values and update the theme
    const updatedQuestion = calculateNextReview(q, correct);
    
    const theme = themes.find(t => t.number === q.themeNumber);
    if (theme) {
      const updatedQuestions = theme.questions.map(tq => {
        if (tq.id === q.id) {
          return {
            ...tq,
            stability: updatedQuestion.stability,
            difficulty: updatedQuestion.difficulty,
            nextReview: updatedQuestion.nextReview,
            lastReview: updatedQuestion.lastReview,
            attempts: updatedQuestion.attempts,
            errors: updatedQuestion.errors,
          };
        }
        return tq;
      });
      
      onUpdateTheme({ ...theme, questions: updatedQuestions });
    }
  };

  const handleNext = () => {
    if (current < questions.length - 1) {
      setCurrent(current + 1);
      setIsAnswered(false);
      setSelectedAnswer(null);
    } else {
      setSessionComplete(true);
    }
  };

  return (
    <div className={`min-h-full ${dm ? 'bg-[#080C14]' : 'bg-[#F0F4FF]'} p-3 sm:p-4 transition-colors`} style={{ paddingBottom: '100px' }}>
      <div className="max-w-2xl mx-auto space-y-3 sm:space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button 
            onClick={() => onNavigate('home')} 
            className={`p-2 rounded-xl ${dm ? 'bg-white/5 text-white' : 'bg-white text-slate-700 shadow-sm'}`}
          >
            <Icons.ChevronLeft />
          </button>
          <div className="flex-1">
            <h1 className={`font-bold text-lg ${dm ? 'text-white' : 'text-slate-800'}`}>Repaso Inteligente</h1>
            <p className={`text-xs ${dm ? 'text-gray-400' : 'text-slate-500'}`}>
              {current + 1} / {questions.length} · Tema {q.themeNumber}
            </p>
          </div>
          <div className={`px-3 py-1.5 rounded-lg text-xs font-bold ${diffColor.bg} ${diffColor.text}`}>
            {diffColor.label}
          </div>
        </div>

        {/* Progress */}
        <div className={`w-full h-2 rounded-full ${dm ? 'bg-white/10' : 'bg-slate-100'}`}>
          <div 
            className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-500" 
            style={{ width: `${progress}%` }}
          />
        </div>
        
        {/* Question */}
        <div className={`rounded-xl sm:rounded-2xl p-4 sm:p-6 ${dm ? 'bg-white/5 border border-white/10' : 'bg-white border border-slate-200 shadow-sm'}`}>
          <p className={`text-sm sm:text-base md:text-lg leading-relaxed ${dm ? 'text-white' : 'text-slate-800'}`}>
            {q.text || q.pregunta}
          </p>
          <p className={`text-xs mt-3 ${dm ? 'text-gray-500' : 'text-slate-400'}`}>
            {q.themeName || `Tema ${q.themeNumber}`}
          </p>
        </div>
        
        {/* Options */}
        <div className="space-y-2 sm:space-y-3">
          {(q.options || q.opciones || []).map((opt, i) => {
            const isCorrect = i === q.correct;
            const isSelected = selectedAnswer === i;
            const wasWrong = isAnswered && isSelected && !isCorrect;
            
            let buttonClass = dm 
              ? 'bg-white/5 text-gray-300 hover:bg-white/10 border border-white/5' 
              : 'bg-white text-slate-700 border border-slate-200 hover:border-blue-300 hover:bg-blue-50 shadow-sm';
            
            if (isAnswered) {
              if (isCorrect) {
                buttonClass = 'bg-green-500 text-white border-2 border-green-400 shadow-lg shadow-green-500/20';
              } else if (isSelected) {
                buttonClass = 'bg-red-500 text-white border-2 border-red-400 shadow-lg shadow-red-500/20';
              } else {
                buttonClass = dm ? 'bg-white/3 text-gray-600 border border-white/5' : 'bg-slate-50 text-slate-400 border border-slate-100';
              }
            }
            
            return (
              <button 
                key={i} 
                onClick={() => handleAnswer(i)}
                disabled={isAnswered}
                className={`w-full text-left p-3 sm:p-4 rounded-lg sm:rounded-xl transition-all text-sm sm:text-base ${buttonClass} ${isAnswered ? 'cursor-default' : 'cursor-pointer active:scale-[0.98]'}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex-1">{opt}</span>
                  {isAnswered && isCorrect && <span className="text-2xl">✓</span>}
                  {isAnswered && wasWrong && <span className="text-2xl">✗</span>}
                </div>
              </button>
            );
          })}
        </div>

        {/* Post-answer feedback with SRS info */}
        {isAnswered && (
          <div className={`border rounded-2xl p-4 space-y-3 ${
            wasCorrect ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'
          }`}>
            {wasCorrect ? (
              <div>
                <p className={`font-semibold mb-1 ${dm ? 'text-green-400' : 'text-green-600'}`}>✓ ¡Correcto!</p>
                <p className={`text-sm ${dm ? 'text-gray-300' : 'text-slate-600'}`}>
                  Respuesta: <span className={`font-semibold ${dm ? 'text-white' : 'text-slate-800'}`}>{(q.options || q.opciones)[q.correct]}</span>
                </p>
              </div>
            ) : (
              <div>
                <p className={`font-semibold mb-1 ${dm ? 'text-red-400' : 'text-red-600'}`}>✗ Incorrecto</p>
                <p className={`text-sm ${dm ? 'text-gray-300' : 'text-slate-600'}`}>
                  Tu respuesta: <span className="font-semibold text-red-500">{(q.options || q.opciones)[selectedAnswer]}</span>
                </p>
                <p className={`text-sm mt-1 ${dm ? 'text-gray-300' : 'text-slate-600'}`}>
                  La correcta: <span className="font-semibold text-green-500">{(q.options || q.opciones)[q.correct]}</span>
                </p>
              </div>
            )}
            
            {/* SRS feedback */}
            <div className={`pt-3 border-t ${dm ? 'border-white/10' : 'border-slate-200'}`}>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs px-2 py-1 rounded-lg ${dm ? 'bg-white/5 text-gray-400' : 'bg-slate-100 text-slate-500'}`}>
                  📊 Dificultad: {(calculateNextReview(q, wasCorrect).difficulty || 5).toFixed(1)}/10
                </span>
                <span className={`text-xs px-2 py-1 rounded-lg ${dm ? 'bg-white/5 text-gray-400' : 'bg-slate-100 text-slate-500'}`}>
                  🔄 Próximo repaso: {formatNextReview(calculateNextReview(q, wasCorrect).nextReview)}
                </span>
                {!wasCorrect && (
                  <span className={`text-xs px-2 py-1 rounded-lg bg-red-500/10 text-red-400`}>
                    ⚡ Volverá pronto
                  </span>
                )}
                {wasCorrect && (calculateNextReview(q, wasCorrect).stability || 1) > 30 && (
                  <span className={`text-xs px-2 py-1 rounded-lg bg-green-500/10 text-green-400`}>
                    🏆 Dominada
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
        
        {/* Next button */}
        {isAnswered && (
          <button 
            onClick={handleNext} 
            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-4 rounded-xl transition-colors shadow-md"
          >
            {current === questions.length - 1 ? 'Ver Resultados' : 'Siguiente →'}
          </button>
        )}
      </div>
    </div>
  );
}

export default ReviewScreen;
