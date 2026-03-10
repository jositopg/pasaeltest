import React, { useState, useEffect, useRef } from 'react';
import { calculateNextReview } from '../../utils/srs';
import { useTheme } from '../../context/ThemeContext';

const EXAM_STATE_KEY = 'exam_paused_state';

function getPenaltyValue(incorrect, system) {
  switch (system) {
    case 'none':    return 0;
    case 'each4':   return Math.floor(incorrect / 4);
    case 'each2':   return Math.floor(incorrect / 2);
    case 'each1':   return incorrect;
    default:        return Math.floor(incorrect / 3); // classic
  }
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function hashConfig(config) {
  return JSON.stringify({
    t: [...(config.selectedThemes || [])].sort(),
    n: config.numQuestions,
    p: config.penaltySystem,
    tl: config.timeLimitMinutes,
    fr: config.failedRatio || 0,
  });
}

function buildQuestions(config, themes) {
  const allQ = themes
    .filter(t => config.selectedThemes.includes(t.number))
    .flatMap(t => (t.questions || []).map(q => ({ ...q, themeNumber: t.number })));

  const failedRatio = config.failedRatio || 0;
  const numQ = config.numQuestions;

  if (failedRatio === 0) {
    return allQ.sort(() => Math.random() - 0.5).slice(0, Math.min(numQ, allQ.length));
  }

  const failedPool = allQ
    .filter(q => q.errors_count > 0)
    .sort(() => Math.random() - 0.5);

  const targetFailed = Math.min(Math.round((failedRatio / 100) * numQ), failedPool.length);
  const pickedFailed = failedPool.slice(0, targetFailed);
  const usedIds = new Set(pickedFailed.map(q => q.id));

  const regularPool = allQ
    .filter(q => !usedIds.has(q.id))
    .sort(() => Math.random() - 0.5)
    .slice(0, numQ - pickedFailed.length);

  return [...pickedFailed, ...regularPool]
    .sort(() => Math.random() - 0.5)
    .slice(0, Math.min(numQ, allQ.length));
}

function loadSavedState(configKey) {
  try {
    const raw = sessionStorage.getItem(EXAM_STATE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    if (saved?.configKey !== configKey) return null;
    return saved;
  } catch {
    return null;
  }
}

function ExamScreen({ config, themes, onFinish, onNavigate, onUpdateThemes }) {
  const { dm, cx } = useTheme();

  const configKey = hashConfig(config);

  // ─── Inicialización con posible restauración ────────────────
  const [questions] = useState(() => {
    const saved = loadSavedState(configKey);
    if (saved?.questions?.length > 0) return saved.questions;
    return buildQuestions(config, themes);
  });

  const [current, setCurrent] = useState(() => {
    const saved = loadSavedState(configKey);
    return saved?.current ?? 0;
  });

  const [answers, setAnswers] = useState(() => {
    const saved = loadSavedState(configKey);
    return saved?.answers ?? {};
  });

  const [answeredQuestions, setAnsweredQuestions] = useState(() => {
    const saved = loadSavedState(configKey);
    return new Set(saved?.answeredQuestions ?? []);
  });

  const [timeLeft, setTimeLeft] = useState(() => {
    const saved = loadSavedState(configKey);
    if (saved?.timeLeft !== undefined) return saved.timeLeft;
    return config.timeLimitMinutes ? config.timeLimitMinutes * 60 : null;
  });

  const [wasRestored] = useState(() => {
    const saved = loadSavedState(configKey);
    return (saved?.answeredQuestions?.length ?? 0) > 0;
  });
  const [showRestoreBanner, setShowRestoreBanner] = useState(() => {
    const saved = loadSavedState(configKey);
    return (saved?.answeredQuestions?.length ?? 0) > 0;
  });

  const [showResults, setShowResults] = useState(false);
  const [timeExpired, setTimeExpired] = useState(false);
  const timerRef = useRef(null);

  // ─── Reportes de preguntas ──────────────────────────────────
  const [flags, setFlags] = useState({});

  function toggleFlag(idx) {
    setFlags(prev => ({
      ...prev,
      [idx]: prev[idx] ? { ...prev[idx], open: !prev[idx].open } : { comment: '', open: true },
    }));
  }
  function setFlagComment(idx, comment) {
    setFlags(prev => ({ ...prev, [idx]: { ...prev[idx], comment } }));
  }
  function submitFlag(idx) {
    setFlags(prev => ({ ...prev, [idx]: { ...prev[idx], open: false } }));
  }

  // ─── Persistir estado en sessionStorage ────────────────────
  useEffect(() => {
    if (showResults) {
      sessionStorage.removeItem(EXAM_STATE_KEY);
      return;
    }
    try {
      sessionStorage.setItem(EXAM_STATE_KEY, JSON.stringify({
        configKey,
        questions,
        answers,
        current,
        timeLeft,
        answeredQuestions: [...answeredQuestions],
        savedAt: Date.now(),
      }));
    } catch {}
  }, [answers, current, timeLeft, showResults]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Countdown timer ────────────────────────────────────────
  useEffect(() => {
    if (timeLeft === null || showResults) return;

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          setTimeExpired(true);
          setShowResults(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [showResults]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAnswer = (selectedIndex) => {
    const q = questions[current];
    const wasCorrect = selectedIndex === q.correct;

    setAnswers({ ...answers, [current]: selectedIndex });
    setAnsweredQuestions(prev => new Set([...prev, current]));

    const theme = themes.find(t => t.number === q.themeNumber);
    if (theme) {
      const updatedQuestions = theme.questions.map(qu =>
        qu.id === q.id ? calculateNextReview(qu, wasCorrect) : qu
      );
      onUpdateThemes({ ...theme, questions: updatedQuestions });
    }
  };

  const handleNext = () => {
    if (current < questions.length - 1) {
      setCurrent(current + 1);
    } else {
      clearInterval(timerRef.current);
      setShowResults(true);
    }
  };

  const handleFinish = (score) => {
    sessionStorage.removeItem(EXAM_STATE_KEY);
    const activeFlags = Object.entries(flags)
      .filter(([, f]) => f.comment?.trim())
      .map(([idx, f]) => ({
        question: questions[parseInt(idx)],
        comment: f.comment.trim(),
      }));
    onFinish(score, activeFlags);
  };

  const calculateScore = () => {
    let correct = 0, incorrect = 0;
    Object.entries(answers).forEach(([idx, ans]) => {
      if (questions[idx].correct === ans) correct++;
      else incorrect++;
    });
    const penalty = getPenaltyValue(incorrect, config.penaltySystem);
    const final = Math.max(0, correct - penalty);
    return {
      correct,
      incorrect,
      unanswered: questions.length - correct - incorrect,
      penalty,
      finalScore: final,
      percentage: ((final / questions.length) * 100).toFixed(1),
      timeExpired,
    };
  };

  // Empty state
  if (questions.length === 0) {
    return (
      <div className={`min-h-screen ${cx.screen} p-6 flex items-center justify-center`} style={{ paddingBottom: 'var(--pb-screen)' }}>
        <div className={`rounded-2xl p-8 text-center max-w-md ${dm ? 'bg-white/5 border border-white/10' : 'bg-white border border-slate-200 shadow-lg'}`}>
          <h2 className={`text-xl font-bold mb-4 ${cx.heading}`}>Sin preguntas</h2>
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
      <div className={`min-h-screen ${cx.screen} p-6`} style={{ paddingBottom: 'var(--pb-screen)' }}>
        <div className="max-w-2xl mx-auto space-y-6">
          <div className={`rounded-3xl p-8 text-center ${dm ? 'bg-white/5 border border-white/10' : 'bg-white border border-slate-200 shadow-lg'}`}>
            {score.timeExpired && (
              <div className="inline-flex items-center gap-1.5 bg-red-500/15 text-red-500 text-xs font-semibold px-3 py-1 rounded-full mb-4">
                ⏱ Tiempo agotado
              </div>
            )}
            <h2 className={`text-2xl font-bold mb-4 ${cx.heading}`}>¡Completado!</h2>
            <div className="text-6xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              {score.percentage}%
            </div>
          </div>
          <div className={`rounded-2xl p-6 space-y-3 ${cx.card}`}>
            <div className="flex justify-between">
              <span className={cx.body}>Correctas</span>
              <span className="text-green-500 font-bold">{score.correct}</span>
            </div>
            <div className="flex justify-between">
              <span className={cx.body}>Incorrectas</span>
              <span className="text-red-500 font-bold">{score.incorrect}</span>
            </div>
            {score.unanswered > 0 && (
              <div className="flex justify-between">
                <span className={cx.body}>Sin responder</span>
                <span className="text-gray-400 font-bold">{score.unanswered}</span>
              </div>
            )}
            {config.penaltySystem !== 'none' && (
              <div className="flex justify-between">
                <span className={cx.body}>Penalización</span>
                <span className="text-orange-500 font-bold">-{score.penalty}</span>
              </div>
            )}
          </div>
          <button onClick={() => handleFinish(score)} className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-4 rounded-2xl transition-colors shadow-md">
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
  const timerWarning = timeLeft !== null && timeLeft <= 60;

  return (
    <div className={`min-h-full ${cx.screen} p-3 sm:p-4 transition-colors`} style={{ paddingTop: 'var(--pt-header)', paddingBottom: 'var(--pb-screen)' }}>
      <div className="max-w-2xl mx-auto space-y-3 sm:space-y-4 md:space-y-6">

        {/* Banner de examen recuperado */}
        {showRestoreBanner && (
          <div className={`rounded-xl px-4 py-2.5 flex items-center gap-2 text-sm ${dm ? 'bg-blue-500/10 border border-blue-500/30 text-blue-300' : 'bg-blue-50 border border-blue-200 text-blue-700'}`}>
            <span>💾</span>
            <span className="font-medium flex-1">Examen recuperado — continuando donde lo dejaste</span>
            <button onClick={() => setShowRestoreBanner(false)} className={`w-6 h-6 rounded-lg flex items-center justify-center text-sm font-bold transition-colors ${dm ? 'text-blue-300/60 hover:bg-blue-500/20 hover:text-blue-200' : 'text-blue-500/60 hover:bg-blue-100 hover:text-blue-700'}`}>×</button>
          </div>
        )}

        {/* Progress header */}
        <div className={`rounded-xl sm:rounded-2xl p-3 sm:p-4 ${cx.card}`}>
          <div className="flex justify-between mb-2 gap-2">
            <span className={`text-xs sm:text-sm ${dm ? 'text-gray-300' : 'text-slate-500'}`}>
              Pregunta {current + 1}/{questions.length}
            </span>
            <div className="flex items-center gap-3">
              {timeLeft !== null && (
                <span className={`text-xs sm:text-sm font-bold tabular-nums ${timerWarning ? 'text-red-500 animate-pulse' : dm ? 'text-gray-300' : 'text-slate-500'}`}>
                  ⏱ {formatTime(timeLeft)}
                </span>
              )}
              <span className="text-blue-500 text-xs sm:text-sm font-semibold">Tema {q.themeNumber}</span>
            </div>
          </div>
          <div className={`w-full h-2 rounded-full ${dm ? 'bg-white/10' : 'bg-slate-100'}`}>
            <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>

        {/* Question */}
        <div className={`rounded-xl sm:rounded-2xl p-4 sm:p-5 md:p-6 ${cx.card}`}>
          <p className={`text-sm sm:text-base md:text-lg leading-relaxed ${cx.heading}`}>{q.text}</p>
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
              if (isCorrect) buttonClass = 'bg-green-500 text-white border-2 border-green-400';
              else if (isSelected) buttonClass = 'bg-red-500 text-white border-2 border-red-400';
              else buttonClass = dm ? 'bg-white/5 text-gray-500' : 'bg-slate-50 text-slate-500 border border-slate-200';
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
          <div className={`border rounded-2xl p-4 space-y-3 ${userAnswer === q.correct ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
            {userAnswer === q.correct ? (
              <div>
                <p className="text-green-600 dark:text-green-400 font-semibold mb-2">✓ ¡Correcto!</p>
                <p className={`text-sm ${cx.body}`}>
                  La respuesta correcta es: <span className={`font-semibold ${cx.heading}`}>{q.options[q.correct]}</span>
                </p>
              </div>
            ) : (
              <div>
                <p className="text-red-600 dark:text-red-400 font-semibold mb-2">✗ Incorrecto</p>
                <p className={`text-sm ${cx.body}`}>
                  Tu respuesta: <span className="font-semibold text-red-500">{q.options[userAnswer]}</span>
                </p>
                <p className={`text-sm mt-1 ${cx.body}`}>
                  La correcta es: <span className="font-semibold text-green-500">{q.options[q.correct]}</span>
                </p>
              </div>
            )}
            {q.explanation && (
              <div className={`pt-3 border-t ${cx.divider}`}>
                <p className={`text-xs font-semibold uppercase tracking-wide mb-1.5 ${dm ? 'text-blue-400' : 'text-blue-600'}`}>💡 Explicación</p>
                <p className={`text-sm leading-relaxed ${cx.body}`}>{q.explanation}</p>
              </div>
            )}

            {/* Botón reportar error */}
            <div className={`pt-2 border-t ${cx.divider}`}>
              {flags[current]?.comment && !flags[current]?.open ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-orange-400">🚩 Reporte guardado</span>
                  <button onClick={() => toggleFlag(current)} className="text-xs text-gray-500 underline">editar</button>
                </div>
              ) : flags[current]?.open ? (
                <div className="space-y-2">
                  <p className={`text-xs font-semibold ${dm ? 'text-orange-300' : 'text-orange-600'}`}>🚩 ¿Qué está mal en esta pregunta?</p>
                  <textarea
                    autoFocus
                    value={flags[current]?.comment || ''}
                    onChange={e => setFlagComment(current, e.target.value)}
                    placeholder="Ej: La respuesta correcta debería ser la B, porque..."
                    rows={2}
                    className={`w-full text-sm rounded-xl px-3 py-2 resize-none focus:outline-none border ${
                      dm ? 'bg-white/5 border-white/10 text-white placeholder-gray-600' : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400'
                    }`}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => submitFlag(current)}
                      disabled={!flags[current]?.comment?.trim()}
                      className="px-3 py-1.5 rounded-lg bg-orange-500 text-white text-xs font-semibold disabled:opacity-40"
                    >
                      Guardar reporte
                    </button>
                    <button
                      onClick={() => setFlags(prev => { const n = { ...prev }; delete n[current]; return n; })}
                      className={`px-3 py-1.5 rounded-lg text-xs ${dm ? 'bg-white/5 text-gray-400' : 'bg-slate-100 text-slate-500'}`}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => toggleFlag(current)}
                  className={`text-xs px-2.5 py-1.5 rounded-lg transition-colors ${dm ? 'text-slate-400 hover:bg-orange-500/15 hover:text-orange-300' : 'text-slate-500 hover:bg-orange-50 hover:text-orange-600'}`}
                >
                  🚩 Reportar error en esta pregunta
                </button>
              )}
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex gap-3">
          <button
            onClick={() => setCurrent(c => Math.max(0, c - 1))}
            disabled={current === 0}
            className={`flex-1 py-4 rounded-xl disabled:opacity-30 font-medium ${dm ? 'bg-white/5 text-white' : 'bg-white text-slate-700 border border-slate-200 shadow-sm'}`}
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
