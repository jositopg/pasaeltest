/**
 * PublicExamScreen — Examen público sin autenticación.
 * Se muestra cuando la URL contiene ?exam=SLUG.
 *
 * Fases: loading → landing → config → exam → results
 */

import React, { useState, useEffect } from 'react';

// ─── Utils ─────────────────────────────────────────────────────────────────────

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function calcResult(questions, answers, penalty) {
  let correct = 0, wrong = 0, skipped = 0;
  questions.forEach((q, i) => {
    const a = answers[i];
    if (a == null) { skipped++; return; }
    if (a === q.correct) correct++;
    else wrong++;
  });
  const raw = correct - (penalty ? wrong / 3 : 0);
  const score = Math.max(0, raw);
  const pct = Math.round((score / questions.length) * 100);
  return { correct, wrong, skipped, score, pct, total: questions.length };
}

// ─── Loading ───────────────────────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center"
      style={{ background: 'radial-gradient(ellipse at top, #0F1F3D 0%, #080C14 70%)' }}>
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-400 text-sm">Cargando examen...</p>
      </div>
    </div>
  );
}

// ─── Logo mini ─────────────────────────────────────────────────────────────────

function MiniLogo() {
  return (
    <div className="flex items-center justify-center gap-2 mb-2">
      <div className="w-6 h-6 rounded-lg flex items-center justify-center"
        style={{ background: 'linear-gradient(135deg, #1d4ed8, #6d28d9)' }}>
        <svg viewBox="0 0 512 512" className="w-3.5 h-3.5" fill="white">
          <path d="M295 72L172 265l73 0L172 440l176-192-76 0Z" />
        </svg>
      </div>
      <span className="text-slate-500 text-xs font-medium">PasaElTest</span>
    </div>
  );
}

// ─── Landing ───────────────────────────────────────────────────────────────────

function LandingScreen({ plan, onContinue }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-5"
      style={{ background: 'radial-gradient(ellipse at top, #0F1F3D 0%, #080C14 70%)' }}>
      <div className="w-full max-w-sm space-y-4">
        <MiniLogo />

        <div className="bg-[#0F172A] border border-white/10 rounded-3xl p-7 text-center space-y-5">
          <div className="text-6xl">{plan.cover_emoji}</div>
          <div>
            <h1 className="text-white font-bold text-2xl leading-tight" style={{ fontFamily: 'Sora, system-ui' }}>
              {plan.name}
            </h1>
            {plan.description && (
              <p className="text-slate-400 text-sm mt-2 leading-relaxed">{plan.description}</p>
            )}
          </div>
          <div className="flex items-center justify-center gap-6">
            <div className="text-center">
              <p className="text-white font-black text-2xl" style={{ fontFamily: 'Sora, system-ui' }}>
                {plan.totalQuestions}
              </p>
              <p className="text-slate-500 text-xs mt-0.5">preguntas</p>
            </div>
            <div className="w-px h-10 bg-white/10" />
            <div className="text-center">
              <p className="text-white font-black text-2xl" style={{ fontFamily: 'Sora, system-ui' }}>
                {plan.themes.length}
              </p>
              <p className="text-slate-500 text-xs mt-0.5">temas</p>
            </div>
          </div>
        </div>

        <button
          onClick={onContinue}
          className="w-full py-4 rounded-2xl text-white font-bold text-base transition-all active:scale-[0.98]"
          style={{
            background: 'linear-gradient(135deg, #2563EB, #7C3AED)',
            boxShadow: '0 8px 24px rgba(37,99,235,0.4)',
            fontFamily: 'Sora, system-ui',
          }}
        >
          Hacer examen →
        </button>
      </div>
    </div>
  );
}

// ─── Config ────────────────────────────────────────────────────────────────────

function ConfigScreen({ plan, onStart, onBack }) {
  const max = plan.totalQuestions;
  const presets = [10, 20, 30, 50].filter(n => n < max);
  // Siempre incluir "Todas"
  const options = [...presets, max];

  const [numQ, setNumQ] = useState(Math.min(20, max));
  const [penalty, setPenalty] = useState(false);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-5"
      style={{ background: 'radial-gradient(ellipse at top, #0F1F3D 0%, #080C14 70%)' }}>
      <div className="w-full max-w-sm space-y-4">
        <button onClick={onBack} className="text-slate-500 text-sm hover:text-slate-300 transition-colors flex items-center gap-1">
          ← Volver
        </button>

        <div className="bg-[#0F172A] border border-white/10 rounded-3xl p-6 space-y-6">
          <h2 className="text-white font-bold text-xl" style={{ fontFamily: 'Sora, system-ui' }}>
            Configura el examen
          </h2>

          {/* Número de preguntas */}
          <div>
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide mb-3">
              Número de preguntas
            </p>
            <div className="grid grid-cols-3 gap-2">
              {options.map(n => (
                <button
                  key={n}
                  onClick={() => setNumQ(n)}
                  className={`py-2.5 rounded-xl text-sm font-bold transition-all ${
                    numQ === n ? 'text-white' : 'bg-white/5 text-slate-400 hover:bg-white/10'
                  }`}
                  style={numQ === n ? { background: 'linear-gradient(135deg, #2563EB, #7C3AED)' } : {}}
                >
                  {n === max ? (presets.length > 0 ? `Todas (${n})` : n) : n}
                </button>
              ))}
            </div>
          </div>

          {/* Penalización */}
          <div>
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide mb-3">
              Penalización por fallo
            </p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: false, label: 'Sin penalización', desc: 'Los fallos no restan' },
                { value: true, label: 'Con penalización', desc: '-⅓ punto por fallo' },
              ].map(opt => (
                <button
                  key={String(opt.value)}
                  onClick={() => setPenalty(opt.value)}
                  className={`p-3.5 rounded-xl text-left transition-all border ${
                    penalty === opt.value
                      ? 'border-blue-500/50 bg-blue-500/10'
                      : 'bg-white/5 border-transparent hover:bg-white/8'
                  }`}
                >
                  <p className={`text-sm font-semibold leading-tight ${
                    penalty === opt.value ? 'text-blue-300' : 'text-slate-300'
                  }`}>
                    {opt.label}
                  </p>
                  <p className="text-slate-500 text-xs mt-1">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        <button
          onClick={() => onStart({ numQ, penalty })}
          className="w-full py-4 rounded-2xl text-white font-bold text-base transition-all active:scale-[0.98]"
          style={{
            background: 'linear-gradient(135deg, #2563EB, #7C3AED)',
            boxShadow: '0 8px 24px rgba(37,99,235,0.4)',
            fontFamily: 'Sora, system-ui',
          }}
        >
          Empezar →
        </button>
      </div>
    </div>
  );
}

// ─── Exam ──────────────────────────────────────────────────────────────────────

function ExamActiveScreen({ questions, penalty, onFinish }) {
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState({});
  const [revealed, setRevealed] = useState({});

  const q = questions[idx];
  const total = questions.length;
  const isRevealed = !!revealed[idx];
  const isLast = idx === total - 1;

  const handleAnswer = (opt) => {
    if (isRevealed) return;
    setAnswers(prev => ({ ...prev, [idx]: opt }));
    setRevealed(prev => ({ ...prev, [idx]: true }));
  };

  const handleSkip = () => {
    if (isRevealed) return;
    setAnswers(prev => ({ ...prev, [idx]: null }));
    setRevealed(prev => ({ ...prev, [idx]: true }));
    advance();
  };

  const advance = () => {
    if (isLast) onFinish(answers);
    else setIdx(i => i + 1);
  };

  const handleNext = () => {
    if (isLast) onFinish(answers);
    else setIdx(i => i + 1);
  };

  const progress = ((idx + (isRevealed ? 1 : 0)) / total) * 100;

  return (
    <div className="min-h-screen flex flex-col"
      style={{ background: 'radial-gradient(ellipse at top, #0F1F3D 0%, #080C14 70%)' }}>

      {/* Header */}
      <div className="px-4 pt-10 pb-4 max-w-lg mx-auto w-full">
        <div className="flex items-center justify-between mb-3">
          <span className="text-slate-400 text-sm font-medium">{idx + 1} <span className="text-slate-600">/ {total}</span></span>
          <span className="text-slate-600 text-xs truncate max-w-[180px]">{q.themeName}</span>
        </div>
        <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${progress}%`, background: 'linear-gradient(90deg, #2563EB, #7C3AED)' }}
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 max-w-lg mx-auto w-full space-y-3 pb-8">

        {/* Question */}
        <div className="bg-[#0F172A] border border-white/10 rounded-2xl p-5">
          <p className="text-white text-base leading-relaxed">{q.text}</p>
        </div>

        {/* Options */}
        <div className="space-y-2">
          {(q.options || []).map((opt, oi) => {
            const label = String.fromCharCode(65 + oi);
            const isSelected = answers[idx] === opt;
            const isCorrect = opt === q.correct;

            let cls = 'bg-white/5 border border-white/10 text-slate-300';
            if (!isRevealed) cls += ' hover:bg-white/10 active:scale-[0.98]';
            if (isRevealed) {
              if (isCorrect) cls = 'bg-green-500/15 border border-green-500/40 text-green-200';
              else if (isSelected) cls = 'bg-red-500/15 border border-red-500/40 text-red-300';
              else cls = 'bg-white/3 border border-white/5 text-slate-600';
            }

            return (
              <button
                key={oi}
                onClick={() => handleAnswer(opt)}
                disabled={isRevealed}
                className={`w-full text-left px-4 py-3.5 rounded-xl transition-all text-sm ${cls}`}
              >
                <span className="font-bold mr-2 text-xs opacity-50">{label})</span>
                {opt}
                {isRevealed && isCorrect && <span className="float-right text-green-400">✓</span>}
                {isRevealed && isSelected && !isCorrect && <span className="float-right text-red-400">✗</span>}
              </button>
            );
          })}
        </div>

        {/* Explanation */}
        {isRevealed && q.explanation && (
          <div className="bg-blue-500/8 border border-blue-500/20 rounded-xl px-4 py-3">
            <p className="text-blue-300 text-xs leading-relaxed">{q.explanation}</p>
          </div>
        )}

        {/* Actions */}
        {isRevealed ? (
          <button
            onClick={handleNext}
            className="w-full py-4 rounded-2xl text-white font-bold transition-all active:scale-[0.98]"
            style={{ background: 'linear-gradient(135deg, #2563EB, #7C3AED)', fontFamily: 'Sora, system-ui' }}
          >
            {isLast ? 'Ver resultados →' : 'Siguiente →'}
          </button>
        ) : (
          <button
            onClick={handleSkip}
            className="w-full py-2.5 text-slate-600 text-sm hover:text-slate-400 transition-colors"
          >
            Saltar pregunta
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Results ───────────────────────────────────────────────────────────────────

function ResultsScreen({ questions, answers, penalty, onRetry }) {
  const r = calcResult(questions, answers, penalty);
  const passed = r.pct >= 50;

  const wrongOnes = questions
    .map((q, i) => ({ q, i, given: answers[i] }))
    .filter(({ q, given }) => given != null && given !== q.correct);

  return (
    <div className="min-h-screen flex flex-col items-center justify-start p-5 pt-12"
      style={{ background: 'radial-gradient(ellipse at top, #0F1F3D 0%, #080C14 70%)' }}>
      <div className="w-full max-w-sm space-y-4">
        <MiniLogo />

        {/* Score */}
        <div className="bg-[#0F172A] border border-white/10 rounded-3xl p-6 text-center space-y-4">
          <div className="text-5xl">{passed ? '🎉' : '📚'}</div>
          <div>
            <p className="text-slate-500 text-xs mb-1 uppercase tracking-wide">Resultado</p>
            <p
              className="font-black text-6xl"
              style={{
                fontFamily: 'Sora, system-ui',
                background: passed
                  ? 'linear-gradient(135deg, #10B981, #059669)'
                  : 'linear-gradient(135deg, #F59E0B, #D97706)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              {r.pct}%
            </p>
          </div>

          <div className="flex items-center justify-center gap-6">
            <div className="text-center">
              <p className="text-green-400 font-black text-xl">{r.correct}</p>
              <p className="text-slate-600 text-xs">correctas</p>
            </div>
            <div className="text-center">
              <p className="text-red-400 font-black text-xl">{r.wrong}</p>
              <p className="text-slate-600 text-xs">incorrectas</p>
            </div>
            {r.skipped > 0 && (
              <div className="text-center">
                <p className="text-slate-500 font-black text-xl">{r.skipped}</p>
                <p className="text-slate-600 text-xs">saltadas</p>
              </div>
            )}
          </div>

          {penalty && r.wrong > 0 && (
            <p className="text-slate-600 text-xs">
              Puntuación: {r.score.toFixed(2)} / {r.total}
            </p>
          )}
        </div>

        {/* Wrong answers */}
        {wrongOnes.length > 0 && (
          <div className="bg-[#0F172A] border border-white/10 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-white/5">
              <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide">
                Respuestas incorrectas ({wrongOnes.length})
              </p>
            </div>
            <div className="divide-y divide-white/5 max-h-72 overflow-y-auto">
              {wrongOnes.map(({ q, i, given }) => (
                <div key={i} className="px-4 py-3 space-y-1.5">
                  <p className="text-slate-300 text-xs leading-snug">{q.text}</p>
                  <p className="text-red-400 text-xs">✗ {given}</p>
                  <p className="text-green-400 text-xs">✓ {q.correct}</p>
                  {q.explanation && (
                    <p className="text-slate-600 text-xs leading-snug">{q.explanation}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <button
          onClick={onRetry}
          className="w-full py-4 rounded-2xl text-white font-bold transition-all active:scale-[0.98]"
          style={{
            background: 'linear-gradient(135deg, #2563EB, #7C3AED)',
            boxShadow: '0 8px 24px rgba(37,99,235,0.4)',
            fontFamily: 'Sora, system-ui',
          }}
        >
          Repetir examen
        </button>

        <p className="text-center text-slate-700 text-xs pt-1">
          Estudia más con{' '}
          <a href="/" className="text-slate-500 hover:text-slate-300 transition-colors underline underline-offset-2">
            PasaElTest
          </a>
        </p>
      </div>
    </div>
  );
}

// ─── Main ──────────────────────────────────────────────────────────────────────

export default function PublicExamScreen({ slug }) {
  const [phase, setPhase] = useState('loading');
  const [plan, setPlan] = useState(null);
  const [error, setError] = useState('');
  const [examQuestions, setExamQuestions] = useState([]);
  const [examAnswers, setExamAnswers] = useState({});
  const [penalty, setPenalty] = useState(false);

  useEffect(() => {
    fetch(`/api/public-exam?slug=${encodeURIComponent(slug)}`)
      .then(r => r.json())
      .then(data => {
        if (data.error || !data.name) { setError(data.error || 'Plan no encontrado'); setPhase('error'); return; }
        if (!data.totalQuestions) { setError('Este plan aún no tiene preguntas.'); setPhase('error'); return; }
        setPlan(data);
        setPhase('landing');
      })
      .catch(() => { setError('Error de red. Comprueba tu conexión.'); setPhase('error'); });
  }, [slug]);

  const handleConfigStart = ({ numQ, penalty: p }) => {
    const all = plan.themes.flatMap(t =>
      t.questions.map(q => ({ ...q, themeName: t.name }))
    );
    const selected = shuffle(all).slice(0, numQ);
    setExamQuestions(selected);
    setPenalty(p);
    setExamAnswers({});
    setPhase('exam');
  };

  if (phase === 'loading') return <LoadingScreen />;

  if (phase === 'error') return (
    <div className="min-h-screen flex items-center justify-center p-5"
      style={{ background: 'radial-gradient(ellipse at top, #0F1F3D 0%, #080C14 70%)' }}>
      <div className="text-center space-y-4">
        <div className="text-5xl">😕</div>
        <p className="text-white font-bold text-xl">Plan no encontrado</p>
        <p className="text-slate-400 text-sm">{error}</p>
        <a href="/" className="text-blue-400 text-sm hover:text-blue-300 underline">
          Ir a PasaElTest
        </a>
      </div>
    </div>
  );

  if (phase === 'landing') return (
    <LandingScreen plan={plan} onContinue={() => setPhase('config')} />
  );

  if (phase === 'config') return (
    <ConfigScreen
      plan={plan}
      onStart={handleConfigStart}
      onBack={() => setPhase('landing')}
    />
  );

  if (phase === 'exam') return (
    <ExamActiveScreen
      questions={examQuestions}
      penalty={penalty}
      onFinish={(answers) => { setExamAnswers(answers); setPhase('results'); }}
    />
  );

  if (phase === 'results') return (
    <ResultsScreen
      questions={examQuestions}
      answers={examAnswers}
      penalty={penalty}
      onRetry={() => setPhase('landing')}
    />
  );

  return null;
}
