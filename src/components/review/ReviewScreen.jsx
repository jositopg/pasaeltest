import React, { useState, useMemo } from 'react';
import Icons from '../common/Icons';
import { calculateNextReview, getDifficultyColor, formatNextReview } from '../../utils/srs';
import { useTheme } from '../../context/ThemeContext';

const SESSION_LIMIT = 20;

function ReviewScreen({ dueQuestions, themes, onUpdateTheme, onNavigate, showToast, mode = 'srs' }) {
  const { dm, cx } = useTheme();
  const isExamFails = mode === 'exam-fails';

  const totalDue = dueQuestions.length;
  // En modo exam-fails repasar TODAS las preguntas falladas, sin cap
  const effectiveLimit = isExamFails ? totalDue : SESSION_LIMIT;
  const cappedQuestions = dueQuestions.slice(0, effectiveLimit);

  // sessionQuestions puede cambiar si el usuario hace "Repetir falladas"
  const [sessionQuestions, setSessionQuestions] = useState(() =>
    cappedQuestions.map(q => ({ ...q, text: q.text || q.pregunta || 'Pregunta sin texto' }))
  );
  const [current, setCurrent] = useState(0);
  const [isAnswered, setIsAnswered] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [sessionStats, setSessionStats] = useState({ correct: 0, incorrect: 0, total: cappedQuestions.length });
  const [sessionComplete, setSessionComplete] = useState(false);
  const [failedInSession, setFailedInSession] = useState([]);

  // Stats para el empty state "todo al día"
  const allDoneStats = useMemo(() => {
    if (sessionQuestions.length > 0) return null;
    let total = 0, mastered = 0, learning = 0, newQ = 0;
    let nextDate = null;
    const now = new Date();
    themes.forEach(t => (t.questions || []).forEach(q => {
      total++;
      if (!q.attempts || q.attempts === 0) { newQ++; return; }
      if ((q.stability || 1) > 30) mastered++;
      else learning++;
      if (q.next_review) {
        const d = new Date(q.next_review);
        if (d > now && (!nextDate || d < nextDate)) nextDate = d;
      }
    }));
    const nextLabel = nextDate ? formatNextReview(nextDate.toISOString()) : null;
    return { total, mastered, learning, newQ, nextLabel };
  }, [sessionQuestions.length, themes]);

  if (!sessionQuestions || sessionQuestions.length === 0) {
    const s = allDoneStats || {};
    const hasQuestions = (s.total || 0) > 0;
    return (
      <div className={`min-h-full ${cx.screen} flex items-center justify-center p-6`} style={{ paddingBottom: 'var(--pb-screen)' }}>
        <div className="w-full max-w-md space-y-4">

          {/* Card principal */}
          <div className={`rounded-2xl p-8 text-center ${dm ? 'bg-white/5 border border-white/10' : 'bg-white border border-slate-200 shadow-sm'}`}>
            <div className="text-6xl mb-4">🎉</div>
            <h2 className={`text-xl font-bold mb-2 ${cx.heading}`}>¡Todo al día!</h2>
            <p className={`text-sm ${cx.muted}`}>
              {hasQuestions
                ? 'No tienes preguntas pendientes ahora mismo.'
                : 'Responde preguntas en los temas para activar el repaso inteligente.'}
            </p>
          </div>

          {/* Stats row */}
          {hasQuestions && (
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Total', value: s.total, color: dm ? 'text-blue-400' : 'text-blue-600' },
                { label: 'Dominadas', value: s.mastered, color: dm ? 'text-green-400' : 'text-green-600' },
                { label: 'Aprendiendo', value: s.learning, color: dm ? 'text-yellow-400' : 'text-yellow-600' },
              ].map(stat => (
                <div key={stat.label} className={`rounded-xl p-3 text-center ${dm ? 'bg-white/5 border border-white/8' : 'bg-white border border-slate-200 shadow-sm'}`}>
                  <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
                  <p className={`text-xs mt-0.5 ${cx.muted}`}>{stat.label}</p>
                </div>
              ))}
            </div>
          )}

          {/* Próximo repaso */}
          {s.nextLabel && (
            <div className={`rounded-xl px-4 py-3 flex items-center gap-3 ${dm ? 'bg-blue-500/10 border border-blue-500/20' : 'bg-blue-50 border border-blue-200'}`}>
              <span className="text-xl">🕐</span>
              <div>
                <p className={`text-xs font-semibold ${dm ? 'text-blue-300' : 'text-blue-700'}`}>Próximo repaso</p>
                <p className={`text-sm font-bold ${dm ? 'text-blue-200' : 'text-blue-800'}`}>{s.nextLabel}</p>
              </div>
            </div>
          )}

          {/* CTA */}
          <div className="flex flex-col gap-2">
            {s.newQ > 0 && (
              <button
                onClick={() => onNavigate('themes')}
                className={`w-full py-3 rounded-xl text-sm font-semibold transition-colors ${dm ? 'bg-white/10 text-gray-200 hover:bg-white/15' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
              >
                📖 Responder preguntas nuevas ({s.newQ})
              </button>
            )}
            <button
              onClick={() => onNavigate('home')}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-xl font-semibold transition-colors"
            >
              Volver al inicio
            </button>
          </div>

        </div>
      </div>
    );
  }

  if (sessionComplete) {
    const pct = sessionStats.total > 0
      ? Math.round((sessionStats.correct / sessionStats.total) * 100)
      : 0;

    const handleRetryFailed = () => {
      setSessionQuestions(failedInSession);
      setFailedInSession([]);
      setCurrent(0);
      setIsAnswered(false);
      setSelectedAnswer(null);
      setSessionStats({ correct: 0, incorrect: 0, total: failedInSession.length });
      setSessionComplete(false);
    };

    return (
      <div className={`min-h-full ${cx.screen} p-6`} style={{ paddingBottom: 'var(--pb-screen)' }}>
        <div className="max-w-2xl mx-auto space-y-4">

          {/* Hero */}
          <div className={`rounded-3xl p-8 text-center ${dm ? 'bg-white/5 border border-white/10' : 'bg-white border border-slate-200 shadow-lg'}`}>
            <div className="text-5xl mb-3">{pct >= 80 ? '🏆' : pct >= 50 ? '💪' : '📚'}</div>
            <h2 className={`text-2xl font-bold mb-1 ${cx.heading}`}>
              {isExamFails ? 'Fallos repasados' : 'Repaso completado'}
            </h2>
            {isExamFails && (
              <p className={`text-sm mb-3 ${cx.muted}`}>
                {sessionStats.correct > 0
                  ? `Ya dominas ${sessionStats.correct} de las ${sessionStats.total} que fallaste`
                  : 'Sigue repasando para afianzarlas'}
              </p>
            )}
            <div className="text-5xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent my-3">
              {pct}%
            </div>
          </div>

          {/* Stats */}
          <div className={`rounded-2xl p-5 space-y-3 ${cx.card}`}>
            {[
              { label: 'Correctas',      value: sessionStats.correct,   color: 'text-green-500' },
              { label: 'Incorrectas',    value: sessionStats.incorrect,  color: 'text-red-500'   },
              { label: 'Total repasadas',value: sessionStats.total,      color: cx.heading       },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex justify-between">
                <span className={cx.body}>{label}</span>
                <span className={`font-bold ${color}`}>{value}</span>
              </div>
            ))}
          </div>

          {/* Info contextual */}
          {isExamFails ? (
            sessionStats.correct > 0 && (
              <div className={`rounded-2xl p-4 text-center ${dm ? 'bg-green-500/10 border border-green-500/20' : 'bg-green-50 border border-green-200'}`}>
                <p className={`text-sm ${dm ? 'text-green-300' : 'text-green-700'}`}>
                  ✅ El SRS ha registrado tu progreso — estas preguntas volverán en el momento adecuado
                </p>
              </div>
            )
          ) : (
            <>
              <div className={`rounded-2xl p-4 text-center ${dm ? 'bg-blue-500/10 border border-blue-500/30' : 'bg-blue-50 border border-blue-200'}`}>
                <p className={`text-sm ${dm ? 'text-blue-300' : 'text-blue-700'}`}>
                  El algoritmo ha ajustado las fechas de repaso. Las preguntas que fallaste volverán pronto.
                </p>
              </div>
              {totalDue > SESSION_LIMIT && failedInSession.length === 0 && (
                <div className={`rounded-2xl p-4 text-center ${dm ? 'bg-yellow-500/10 border border-yellow-500/30' : 'bg-yellow-50 border border-yellow-200'}`}>
                  <p className={`text-sm font-semibold ${dm ? 'text-yellow-300' : 'text-yellow-700'}`}>
                    {totalDue - SESSION_LIMIT} preguntas más pendientes
                  </p>
                  <p className={`text-xs mt-1 ${dm ? 'text-yellow-400/70' : 'text-yellow-600'}`}>
                    Vuelve más tarde para continuar o inicia otra sesión
                  </p>
                </div>
              )}
            </>
          )}

          {/* Retry failed */}
          {failedInSession.length > 0 && (
            <button
              onClick={handleRetryFailed}
              className={`w-full py-4 rounded-2xl font-bold transition-colors shadow-md ${
                dm ? 'bg-red-500/20 border border-red-500/40 text-red-300 hover:bg-red-500/30'
                   : 'bg-red-50 border border-red-200 text-red-600 hover:bg-red-100'
              }`}
            >
              🔁 Repetir {failedInSession.length} fallo{failedInSession.length !== 1 ? 's' : ''}
            </button>
          )}

          {/* CTAs principales */}
          {isExamFails ? (
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => onNavigate('exam')}
                className={`py-4 rounded-2xl font-bold transition-all ${
                  dm ? 'bg-white/10 text-white hover:bg-white/15' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Nuevo test
              </button>
              <button
                onClick={() => onNavigate('home')}
                className="py-4 rounded-2xl font-bold bg-blue-500 hover:bg-blue-600 text-white transition-all shadow-md"
              >
                Inicio
              </button>
            </div>
          ) : (
            <button
              onClick={() => onNavigate('home')}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-4 rounded-2xl transition-colors shadow-md"
            >
              Volver al inicio
            </button>
          )}
        </div>
      </div>
    );
  }

  const q = sessionQuestions[current];
  const progress = ((current + 1) / sessionQuestions.length) * 100;
  const diffColor = getDifficultyColor(q.srs_difficulty);
  const wasCorrect = selectedAnswer === q.correct;

  const handleAnswer = (index) => {
    if (isAnswered) return;

    setSelectedAnswer(index);
    setIsAnswered(true);

    const correct = index === q.correct;

    setSessionStats(prev => ({
      ...prev,
      correct: prev.correct + (correct ? 1 : 0),
      incorrect: prev.incorrect + (correct ? 0 : 1),
    }));

    if (!correct) {
      setFailedInSession(prev => [...prev, q]);
    }

    const updatedQuestion = calculateNextReview(q, correct);

    const theme = themes.find(t => t.number === q.themeNumber);
    if (theme) {
      const updatedQuestions = theme.questions.map(tq => {
        if (tq.id === q.id) {
          return {
            ...tq,
            stability: updatedQuestion.stability,
            srs_difficulty: updatedQuestion.srs_difficulty,
            next_review: updatedQuestion.next_review,
            last_review: updatedQuestion.last_review,
            attempts: updatedQuestion.attempts,
            errors_count: updatedQuestion.errors_count,
          };
        }
        return tq;
      });

      onUpdateTheme({ ...theme, questions: updatedQuestions });
    }
  };

  const handleNext = () => {
    if (current < sessionQuestions.length - 1) {
      setCurrent(current + 1);
      setIsAnswered(false);
      setSelectedAnswer(null);
    } else {
      setSessionComplete(true);
    }
  };

  return (
    <div className={`min-h-full ${cx.screen} p-3 sm:p-4 transition-colors`} style={{ paddingTop: 'var(--pt-header)', paddingBottom: 'var(--pb-screen)' }}>
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
            <h1 className={`font-bold text-lg ${cx.heading}`}>
              {isExamFails ? '🔁 Repasando Fallos' : 'Repaso Inteligente'}
            </h1>
            <p className={`text-xs ${cx.muted}`}>
              {current + 1} / {sessionQuestions.length}
              {isExamFails
                ? ' · Del último examen'
                : ` · Tema ${q.themeNumber}${totalDue > SESSION_LIMIT ? ` · ${totalDue} pendientes total` : ''}`
              }
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
        <div className={`rounded-xl sm:rounded-2xl p-4 sm:p-6 ${cx.card}`}>
          <p className={`text-sm sm:text-base md:text-lg leading-relaxed ${cx.heading}`}>
            {q.text}
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
                buttonClass = dm ? 'bg-white/3 text-gray-500 border border-white/5' : 'bg-slate-50 text-slate-500 border border-slate-200';
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
                <p className={`text-sm ${cx.body}`}>
                  Respuesta: <span className={`font-semibold ${cx.heading}`}>{(q.options || q.opciones)[q.correct]}</span>
                </p>
              </div>
            ) : (
              <div>
                <p className={`font-semibold mb-1 ${dm ? 'text-red-400' : 'text-red-600'}`}>✗ Incorrecto</p>
                <p className={`text-sm ${cx.body}`}>
                  Tu respuesta: <span className="font-semibold text-red-500">{(q.options || q.opciones)[selectedAnswer]}</span>
                </p>
                <p className={`text-sm mt-1 ${cx.body}`}>
                  La correcta: <span className="font-semibold text-green-500">{(q.options || q.opciones)[q.correct]}</span>
                </p>
              </div>
            )}

            {/* Explicación pedagógica */}
            {q.explanation && (
              <div className={`pt-3 border-t ${cx.divider}`}>
                <p className={`text-xs font-semibold uppercase tracking-wide mb-1.5 ${dm ? 'text-blue-400' : 'text-blue-600'}`}>💡 Explicación</p>
                <p className={`text-sm leading-relaxed ${cx.body}`}>{q.explanation}</p>
              </div>
            )}

            {/* SRS feedback — solo en modo SRS normal */}
            {!isExamFails && (
              <div className={`pt-3 border-t ${cx.divider}`}>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs px-2 py-1 rounded-lg ${dm ? 'bg-white/5 text-gray-400' : 'bg-slate-100 text-slate-500'}`}>
                    📊 Dificultad: {(calculateNextReview(q, wasCorrect).srs_difficulty || 5).toFixed(1)}/10
                  </span>
                  <span className={`text-xs px-2 py-1 rounded-lg ${dm ? 'bg-white/5 text-gray-400' : 'bg-slate-100 text-slate-600'}`}>
                    🔄 Próximo repaso: {formatNextReview(calculateNextReview(q, wasCorrect).next_review)}
                  </span>
                  {!wasCorrect && (
                    <span className="text-xs px-2 py-1 rounded-lg bg-red-500/10 text-red-400">
                      ⚡ Volverá pronto
                    </span>
                  )}
                  {wasCorrect && (calculateNextReview(q, wasCorrect).stability || 1) > 30 && (
                    <span className="text-xs px-2 py-1 rounded-lg bg-green-500/10 text-green-400">
                      🏆 Dominada
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Next button */}
        {isAnswered && (
          <button
            onClick={handleNext}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-4 rounded-xl transition-colors shadow-md"
          >
            {current === sessionQuestions.length - 1 ? 'Ver Resultados' : 'Siguiente →'}
          </button>
        )}
      </div>
    </div>
  );
}

export default ReviewScreen;
