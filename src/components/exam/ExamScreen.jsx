import React, { useState, useEffect, useRef } from 'react';
import { calculateNextReview } from '../../utils/srs';
import { useTheme } from '../../context/ThemeContext';

// ─── Donut chart SVG (sin librerías externas) ─────────────────────────────
// Truco: r=15.915 → circumference≈100 → dasharray values = percentages directamente
function DonutChart({ correct, incorrect, unanswered, total, dm }) {
  if (total === 0) return null;
  const R = 15.915;
  const SW = 4.5;
  const correctPct   = (correct   / total) * 100;
  const incorrectPct = (incorrect / total) * 100;
  const unansweredPct = (unanswered / total) * 100;
  const pct = Math.round(correctPct);

  const segments = [
    { pct: correctPct,    acc: 0,                              color: '#22c55e' },
    { pct: incorrectPct,  acc: correctPct,                     color: '#ef4444' },
    { pct: unansweredPct, acc: correctPct + incorrectPct,      color: dm ? '#374151' : '#cbd5e1' },
  ].filter(s => s.pct > 0.5);

  return (
    <div className="relative flex items-center justify-center" style={{ width: 130, height: 130 }}>
      <svg viewBox="0 0 42 42" width={130} height={130} style={{ transform: 'rotate(-90deg)' }}>
        {/* Track */}
        <circle cx="21" cy="21" r={R} fill="none"
          stroke={dm ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'}
          strokeWidth={SW} />
        {/* Segments */}
        {segments.map((s, i) => (
          <circle key={i} cx="21" cy="21" r={R} fill="none"
            stroke={s.color} strokeWidth={SW}
            strokeDasharray={`${s.pct} ${100 - s.pct}`}
            strokeDashoffset={25 - s.acc}
            strokeLinecap="butt"
          />
        ))}
      </svg>
      {/* Center label */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-2xl font-bold tabular-nums ${
          pct >= 70 ? 'text-green-400' : pct >= 50 ? 'text-yellow-400' : 'text-red-400'
        }`}>{pct}%</span>
        <span className={`text-xs ${dm ? 'text-gray-500' : 'text-slate-400'}`}>{correct}/{total}</span>
      </div>
    </div>
  );
}

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

function ExamScreen({ config, themes, onFinish, onNavigate, onUpdateThemes, examHistory = [] }) {
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
  const [timeWarnShown, setTimeWarnShown] = useState(false);
  const [showTimeWarnBanner, setShowTimeWarnBanner] = useState(false);
  const timerRef = useRef(null);
  const warnTimerRef = useRef(null);

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

  // ─── Aviso tiempo bajo (1 vez al cruzar 60s) ────────────────
  useEffect(() => {
    if (timeLeft === null || timeWarnShown || showResults) return;
    if (timeLeft <= 60 && timeLeft > 0) {
      setTimeWarnShown(true);
      setShowTimeWarnBanner(true);
      warnTimerRef.current = setTimeout(() => setShowTimeWarnBanner(false), 4000);
    }
    return () => clearTimeout(warnTimerRef.current);
  }, [timeLeft, timeWarnShown, showResults]);

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

  const handleFinish = (score, reviewQs = null) => {
    sessionStorage.removeItem(EXAM_STATE_KEY);
    const activeFlags = Object.entries(flags)
      .filter(([, f]) => f.comment?.trim())
      .map(([idx, f]) => ({
        question: questions[parseInt(idx)],
        comment: f.comment.trim(),
      }));
    onFinish(score, activeFlags, reviewQs);
  };

  const calculateScore = () => {
    let correct = 0, incorrect = 0;
    const failedQs = [];
    const byTheme = {};
    const byDifficulty = { facil: { c: 0, i: 0 }, media: { c: 0, i: 0 }, dificil: { c: 0, i: 0 }, unknown: { c: 0, i: 0 } };

    Object.entries(answers).forEach(([idx, ans]) => {
      const q = questions[idx];
      const isCorrect = q.correct === ans;
      if (isCorrect) correct++;
      else { incorrect++; failedQs.push(q); }

      // breakdown por tema
      const tn = q.themeNumber;
      if (!byTheme[tn]) byTheme[tn] = { correct: 0, incorrect: 0 };
      if (isCorrect) byTheme[tn].correct++;
      else byTheme[tn].incorrect++;

      // breakdown por dificultad
      const d = (q.difficulty || '').toLowerCase();
      const key = d === 'facil' || d === 'fácil' ? 'facil' : d === 'media' ? 'media' : d === 'dificil' || d === 'difícil' ? 'dificil' : 'unknown';
      if (isCorrect) byDifficulty[key].c++;
      else byDifficulty[key].i++;
    });

    const penalty = getPenaltyValue(incorrect, config.penaltySystem);
    const final = Math.max(0, correct - penalty);
    const total = questions.length;
    return {
      correct,
      incorrect,
      unanswered: total - correct - incorrect,
      penalty,
      finalScore: final,
      // % de acierto bruto (sin penalización) — para el donut y comparativa
      percentage: total > 0 ? ((correct / total) * 100).toFixed(1) : '0.0',
      // Nota 0-10 con penalización
      grade: total > 0 ? Math.max(0, parseFloat(((final / total) * 10).toFixed(2))) : 0,
      timeExpired,
      failedQs,
      byTheme,
      byDifficulty,
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
    const pct = parseFloat(score.percentage);

    // Mensaje motivacional
    const motivation =
      pct >= 90 ? '¡Excelente dominio del temario!' :
      pct >= 80 ? '¡Muy bien! Sigue así.' :
      pct >= 70 ? 'Buen resultado, con un poco más lo tienes.' :
      pct >= 60 ? 'Vas por buen camino, repasa los fallos.' :
      '¡Ánimo! Cada repaso cuenta.';

    // Comparativa con examen anterior (mismo conjunto de temas)
    const prevExam = examHistory
      .filter(e => {
        const pt = [...(e.config?.selectedThemes || [])].sort().join(',');
        const ct = [...(config.selectedThemes || [])].sort().join(',');
        return pt === ct && e.score?.percentage !== undefined;
      })
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
    const prevPct = prevExam ? parseFloat(prevExam.score.percentage) : null;
    const diff = prevPct !== null ? Math.round(pct - prevPct) : null;

    // Temas ordenados de peor a mejor
    const themeEntries = Object.entries(score.byTheme).sort((a, b) => {
      const ra = a[1].correct / Math.max(a[1].correct + a[1].incorrect, 1);
      const rb = b[1].correct / Math.max(b[1].correct + b[1].incorrect, 1);
      return ra - rb;
    });

    const diffLabels = {
      facil:  { label: 'Fácil',   barColor: 'bg-green-500', textColor: 'text-green-500' },
      media:  { label: 'Media',   barColor: 'bg-yellow-500', textColor: 'text-yellow-500' },
      dificil:{ label: 'Difícil', barColor: 'bg-red-500',   textColor: 'text-red-500' },
    };

    return (
      <div className={`min-h-screen ${cx.screen} p-4 sm:p-6`} style={{ paddingBottom: 'var(--pb-screen)' }}>
        <div className="max-w-2xl mx-auto space-y-4">

          {/* ── HERO CARD ──────────────────────────────────────────── */}
          <div className={`rounded-3xl p-5 sm:p-6 ${dm ? 'bg-white/5 border border-white/10' : 'bg-white border border-slate-200 shadow-lg'}`}>

            {/* Badges de estado */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
              {score.timeExpired && (
                <span className="inline-flex items-center gap-1 bg-red-500/15 text-red-500 text-xs font-semibold px-2.5 py-1 rounded-full">
                  ⏱ Tiempo agotado
                </span>
              )}
              {diff !== null && (
                <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full ${
                  diff > 0 ? 'bg-green-500/15 text-green-500' :
                  diff < 0 ? 'bg-red-500/15 text-red-500' :
                  dm ? 'bg-white/10 text-gray-400' : 'bg-slate-100 text-slate-500'
                }`}>
                  {diff > 0 ? `↑ +${diff}%` : diff < 0 ? `↓ ${diff}%` : '→ igual'} vs anterior
                </span>
              )}
            </div>

            {/* Donut + texto (dos columnas) */}
            <div className="flex items-center gap-5 sm:gap-6">
              <DonutChart
                correct={score.correct}
                incorrect={score.incorrect}
                unanswered={score.unanswered}
                total={questions.length}
                dm={dm}
              />
              <div className="flex-1 min-w-0">
                <h2 className={`text-xl sm:text-2xl font-bold mb-1 ${cx.heading}`}>¡Test completado!</h2>
                <p className={`text-sm mb-3 ${cx.muted}`}>{motivation}</p>
                {/* Acierto bruto */}
                <div className="flex items-baseline gap-1.5 mb-0.5">
                  <span className={`text-3xl sm:text-4xl font-bold tabular-nums ${
                    pct >= 70 ? 'text-green-400' : pct >= 50 ? 'text-yellow-400' : 'text-red-400'
                  }`}>{score.correct}</span>
                  <span className={`text-base font-semibold ${cx.muted}`}>/ {questions.length} correctas</span>
                </div>
                <p className={`text-xs ${cx.muted}`}>{score.percentage}% de acierto</p>
              </div>
            </div>

            {/* Nota del examen (0-10) */}
            <div className={`mt-4 pt-4 border-t flex items-center justify-between gap-4 ${dm ? 'border-white/10' : 'border-slate-100'}`}>
              <div>
                <p className={`text-xs font-semibold uppercase tracking-widest mb-0.5 ${cx.muted}`}>Nota del examen</p>
                <p className={`text-xs ${cx.muted}`}>
                  {config.penaltySystem === 'none'
                    ? 'Sin penalización'
                    : config.penaltySystem === 'each4' ? 'Penaliz.: 4 malas = −1'
                    : config.penaltySystem === 'each2' ? 'Penaliz.: 2 malas = −1'
                    : config.penaltySystem === 'each1' ? 'Penaliz.: 1 mala = −1'
                    : 'Penaliz.: 3 malas = −1'}
                </p>
              </div>
              <div className="text-right">
                <span className={`text-4xl sm:text-5xl font-black tabular-nums ${
                  score.grade >= 7 ? 'text-green-400' : score.grade >= 5 ? 'text-yellow-400' : 'text-red-400'
                }`} style={{ fontFamily: 'Sora, system-ui' }}>
                  {score.grade % 1 === 0 ? score.grade.toFixed(0) : score.grade.toFixed(1)}
                </span>
                <span className={`text-lg font-semibold ml-1 ${cx.muted}`}>/ 10</span>
              </div>
            </div>
          </div>

          {/* ── STATS GRID ─────────────────────────────────────────── */}
          <div className={`rounded-2xl p-4 grid gap-3 ${
            config.penaltySystem !== 'none' ? 'grid-cols-4' : 'grid-cols-3'
          } ${cx.card}`}>
            {[
              { label: 'Correctas',   value: score.correct,   color: 'text-green-500',  bg: dm ? 'bg-green-500/10'  : 'bg-green-50'  },
              { label: 'Incorrectas', value: score.incorrect,  color: 'text-red-500',    bg: dm ? 'bg-red-500/10'    : 'bg-red-50'    },
              { label: 'Sin resp.',   value: score.unanswered, color: cx.muted,           bg: dm ? 'bg-white/5'       : 'bg-slate-50'  },
              ...(config.penaltySystem !== 'none'
                ? [{ label: 'Penaliz.', value: `-${score.penalty}`, color: 'text-orange-500', bg: dm ? 'bg-orange-500/10' : 'bg-orange-50' }]
                : []),
            ].map(({ label, value, color, bg }) => (
              <div key={label} className={`text-center rounded-xl py-3 ${bg}`}>
                <div className={`text-xl sm:text-2xl font-bold ${color}`}>{value}</div>
                <div className={`text-xs mt-0.5 ${cx.muted}`}>{label}</div>
              </div>
            ))}
          </div>

          {/* ── BREAKDOWN POR TEMA ─────────────────────────────────── */}
          {themeEntries.length > 1 && (
            <div className={`rounded-2xl p-4 space-y-3 ${cx.card}`}>
              <p className={`text-xs font-bold uppercase tracking-widest ${cx.muted}`}>Por tema</p>
              {themeEntries.map(([tn, stats]) => {
                const tot = stats.correct + stats.incorrect;
                const tp  = tot > 0 ? Math.round((stats.correct / tot) * 100) : 0;
                const thm = themes.find(t => t.number === parseInt(tn));
                const barColor = tp >= 70 ? 'bg-green-500' : tp >= 50 ? 'bg-yellow-500' : 'bg-red-500';
                const textColor = tp >= 70 ? 'text-green-500' : tp >= 50 ? 'text-yellow-500' : 'text-red-500';
                return (
                  <div key={tn}>
                    <div className="flex justify-between items-center mb-1">
                      <span className={`text-sm truncate max-w-[65%] ${cx.body}`}>
                        <span className={`font-semibold ${dm ? 'text-gray-400' : 'text-slate-400'} mr-1`}>T{tn}</span>
                        {thm?.name || `Tema ${tn}`}
                      </span>
                      <span className={`text-sm font-bold tabular-nums ${textColor}`}>
                        {tp}% <span className={`text-xs font-normal ${cx.muted}`}>({stats.correct}/{tot})</span>
                      </span>
                    </div>
                    <div className={`w-full h-2.5 rounded-full ${dm ? 'bg-white/8' : 'bg-slate-100'}`}>
                      <div className={`h-full rounded-full transition-all duration-700 ${barColor}`}
                        style={{ width: `${tp}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── POR DIFICULTAD ─────────────────────────────────────── */}
          {(() => {
            const rows = Object.entries(diffLabels)
              .map(([k, m]) => ({ ...m, k, c: score.byDifficulty[k].c, i: score.byDifficulty[k].i }))
              .filter(r => r.c + r.i > 0);
            if (!rows.length) return null;
            return (
              <div className={`rounded-2xl p-4 space-y-3 ${cx.card}`}>
                <p className={`text-xs font-bold uppercase tracking-widest ${cx.muted}`}>Por dificultad</p>
                {rows.map(({ k, label, barColor, textColor, c, i }) => {
                  const tp = Math.round((c / (c + i)) * 100);
                  return (
                    <div key={k}>
                      <div className="flex justify-between items-center mb-1">
                        <span className={`text-sm font-semibold ${textColor}`}>{label}</span>
                        <span className={`text-sm tabular-nums ${cx.muted}`}>{c} / {c + i}</span>
                      </div>
                      <div className={`w-full h-2.5 rounded-full ${dm ? 'bg-white/8' : 'bg-slate-100'}`}>
                        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${tp}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* ── ACCIONES ───────────────────────────────────────────── */}
          {score.failedQs.length > 0 && (
            <button
              onClick={() => handleFinish(score, score.failedQs)}
              className={`w-full py-4 rounded-2xl font-bold transition-all shadow-md flex items-center justify-center gap-2 ${
                dm ? 'bg-red-500/20 border border-red-500/40 text-red-300 hover:bg-red-500/30'
                   : 'bg-red-50 border border-red-200 text-red-600 hover:bg-red-100'
              }`}
            >
              🔁 Repasar {score.failedQs.length} fallo{score.failedQs.length !== 1 ? 's' : ''}
            </button>
          )}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => { handleFinish(score, null); setTimeout(() => onNavigate('exam'), 50); }}
              className={`py-4 rounded-2xl font-bold transition-all ${
                dm ? 'bg-white/10 text-white hover:bg-white/15' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Nuevo test
            </button>
            <button
              onClick={() => handleFinish(score, null)}
              className="py-4 rounded-2xl font-bold bg-blue-500 hover:bg-blue-600 text-white transition-all shadow-md"
            >
              Inicio
            </button>
          </div>

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
            <span className="font-medium flex-1">Test recuperado — continuando donde lo dejaste</span>
            <button onClick={() => setShowRestoreBanner(false)} className={`w-6 h-6 rounded-lg flex items-center justify-center text-sm font-bold transition-colors ${dm ? 'text-blue-300/60 hover:bg-blue-500/20 hover:text-blue-200' : 'text-blue-500/60 hover:bg-blue-100 hover:text-blue-700'}`}>×</button>
          </div>
        )}

        {/* Banner aviso tiempo bajo */}
        {showTimeWarnBanner && (
          <div className="rounded-xl px-4 py-3 flex items-center gap-3 bg-red-500 text-white animate-fade-in shadow-lg">
            <span className="text-xl">⏱</span>
            <span className="font-bold text-sm flex-1">¡Queda menos de 1 minuto!</span>
            <button onClick={() => setShowTimeWarnBanner(false)} className="text-white/70 hover:text-white text-lg font-bold">×</button>
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
                <span className={`font-bold tabular-nums transition-all ${
                  timeLeft <= 30
                    ? 'text-red-500 animate-pulse text-base sm:text-lg'
                    : timerWarning
                    ? 'text-orange-500 text-sm sm:text-base'
                    : `text-xs sm:text-sm ${dm ? 'text-gray-300' : 'text-slate-500'}`
                }`}>
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
          <button
            onClick={handleNext}
            className={`flex-1 py-4 rounded-xl font-medium transition-colors ${
              isAnswered
                ? 'bg-blue-500 hover:bg-blue-600 text-white shadow-md'
                : dm ? 'bg-white/8 text-slate-400 border border-white/10' : 'bg-slate-100 text-slate-500 border border-slate-200'
            }`}
          >
            {isAnswered
              ? (current === questions.length - 1 ? 'Ver Resultados' : 'Siguiente')
              : (current === questions.length - 1 ? 'Finalizar' : 'Saltar')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ExamScreen;
