import React, { useState, useEffect } from 'react';
import { GRADIENT_BG } from '../../utils/constants';
import { calculateNextReview } from '../../utils/srs';

function ExamScreen({ config, themes, onFinish, onNavigate, onUpdateThemes, darkMode }) {
  const dm = darkMode;
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState({});
  const [showResults, setShowResults] = useState(false);
  const [answeredQuestions, setAnsweredQuestions] = useState(new Set());
  
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
    
    const theme = themes.find(t => t.number === q.themeNumber);
    if (theme) {
      const updatedQuestions = theme.questions.map(qu => {
        if (qu.id === q.id) {
          return calculateNextReview(qu, wasCorrect);
        }
        return qu;
      });
      
      onUpdateThemes({
        ...theme,
        questions: updatedQuestions
      });
    }
    
    setTimeout(() => {
      if (current < questions.length - 1) {
        setCurrent(current + 1);
      } else {
        setShowResults(true);
      }
    }, 2500);
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

  // Empty state
  if (questions.length === 0) {
    return (
      <div className={`min-h-screen ${dm ? 'bg-[#080C14]' : 'bg-[#F0F4FF]'} p-6 flex items-center justify-center`}>
        <div className={`rounded-2xl p-8 text-center max-w-md ${dm ? 'bg-white/5 border border-white/10' : 'bg-white border border-slate-200 shadow-lg'}`}>
          <h2 className={`text-xl font-bold mb-4 ${dm ? 'text-white' : 'text-slate-800'}`}>Sin preguntas</h2>
          <p className={`mb-6 ${dm ? 'text-gray-400' : 'text-slate-500'}`}>Genera preguntas primero</p>
          <button onClick={() => onNavigate('themes')} className="bg-blue-500 text-white px-6 py-3 rounded-xl font-semibold">
            Ir a Temas
          </button>
        </div>
      </div>
    );
  }

  // Results
  if (showResults) {
    const score = calculateScore();
    return (
      <div className={`min-h-screen ${dm ? 'bg-[#080C14]' : 'bg-[#F0F4FF]'} p-6`}>
        <div className="max-w-2xl mx-auto space-y-6">
          <div className={`rounded-3xl p-8 text-center ${dm ? 'bg-white/5 border border-white/10' : 'bg-white border border-slate-200 shadow-lg'}`}>
            <h2 className={`text-2xl font-bold mb-4 ${dm ? 'text-white' : 'text-slate-800'}`}>¡Completado!</h2>
            <div className="text-6xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              {score.percentage}%
            </div>
          </div>
          <div className={`rounded-2xl p-6 space-y-3 ${dm ? 'bg-white/5 border border-white/10' : 'bg-white border border-slate-200 shadow-sm'}`}>
            <div className="flex justify-between">
              <span className={dm ? 'text-gray-300' : 'text-slate-600'}>Correctas</span>
              <span className="text-green-500 font-bold">{score.correct}</span>
            </div>
            <div className="flex justify-between">
              <span className={dm ? 'text-gray-300' : 'text-slate-600'}>Incorrectas</span>
              <span className="text-red-500 font-bold">{score.incorrect}</span>
            </div>
            <div className="flex justify-between">
              <span className={dm ? 'text-gray-300' : 'text-slate-600'}>Penalización</span>
              <span className="text-orange-500 font-bold">-{score.penalty}</span>
            </div>
          </div>
          <button onClick={() => onFinish(score)} className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-4 rounded-2xl transition-colors shadow-md">
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
        {/* Progress header */}
        <div className={`rounded-xl sm:rounded-2xl p-3 sm:p-4 ${dm ? 'bg-white/5 border border-white/10' : 'bg-white border border-slate-200 shadow-sm'}`}>
          <div className="flex justify-between mb-2 gap-2">
            <span className={`text-xs sm:text-sm ${dm ? 'text-gray-300' : 'text-slate-500'}`}>Pregunta {current + 1}/{questions.length}</span>
            <span className="text-blue-500 text-xs sm:text-sm font-semibold">Tema {q.themeNumber}</span>
          </div>
          <div className={`w-full h-2 rounded-full ${dm ? 'bg-white/10' : 'bg-slate-100'}`}>
            <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${progress}%` }}></div>
          </div>
        </div>
        
        {/* Question */}
        <div className={`rounded-xl sm:rounded-2xl p-4 sm:p-5 md:p-6 ${dm ? 'bg-white/5 border border-white/10' : 'bg-white border border-slate-200 shadow-sm'}`}>
          <p className={`text-sm sm:text-base md:text-lg leading-relaxed ${dm ? 'text-white' : 'text-slate-800'}`}>{q.text}</p>
        </div>
        
        {/* Options */}
        <div className="space-y-2 sm:space-y-3">
          {q.options.map((opt, i) => {
            const isCorrect = i === q.correct;
            const isSelected = userAnswer === i;
            const wasWrong = isAnswered && isSelected && !isCorrect;
            
            let buttonClass = dm 
              ? 'bg-white/5 text-gray-300 hover:bg-white/10' 
              : 'bg-white text-slate-700 border border-slate-200 hover:border-blue-300 hover:bg-blue-50 shadow-sm';
            
            if (isAnswered) {
              if (isCorrect) {
                buttonClass = 'bg-green-500 text-white border-2 border-green-400';
              } else if (isSelected) {
                buttonClass = 'bg-red-500 text-white border-2 border-red-400';
              } else {
                buttonClass = dm ? 'bg-white/5 text-gray-500' : 'bg-slate-50 text-slate-400 border border-slate-100';
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
                  {isAnswered && isCorrect && <span className="text-2xl">✓</span>}
                  {isAnswered && wasWrong && <span className="text-2xl">✗</span>}
                </div>
              </button>
            );
          })}
        </div>

        {/* Feedback */}
        {isAnswered && (
          <div className={`border rounded-2xl p-4 ${userAnswer === q.correct ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
            {userAnswer === q.correct ? (
              <div>
                <p className="text-green-600 dark:text-green-400 font-semibold mb-2">✓ ¡Correcto!</p>
                <p className={`text-sm ${dm ? 'text-gray-300' : 'text-slate-600'}`}>
                  La respuesta correcta es: <span className={`font-semibold ${dm ? 'text-white' : 'text-slate-800'}`}>{q.options[q.correct]}</span>
                </p>
              </div>
            ) : (
              <div>
                <p className="text-red-600 dark:text-red-400 font-semibold mb-2">✗ Incorrecto</p>
                <p className={`text-sm ${dm ? 'text-gray-300' : 'text-slate-600'}`}>
                  Tu respuesta: <span className="font-semibold text-red-500">{q.options[userAnswer]}</span>
                </p>
                <p className={`text-sm mt-1 ${dm ? 'text-gray-300' : 'text-slate-600'}`}>
                  La correcta es: <span className="font-semibold text-green-500">{q.options[q.correct]}</span>
                </p>
              </div>
            )}
          </div>
        )}
        
        {/* Navigation */}
        <div className="flex gap-3">
          <button 
            onClick={() => setCurrent(c => Math.max(0, c - 1))} 
            disabled={current === 0} 
            className={`flex-1 py-4 rounded-xl disabled:opacity-30 font-medium ${
              dm ? 'bg-white/5 text-white' : 'bg-white text-slate-700 border border-slate-200 shadow-sm'
            }`}
          >
            Anterior
          </button>
          {isAnswered && (
            <button 
              onClick={handleNext} 
              className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-4 rounded-xl font-medium transition-colors shadow-md"
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
