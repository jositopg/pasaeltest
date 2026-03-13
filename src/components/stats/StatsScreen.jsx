import React, { useState } from 'react';
import Icons from '../common/Icons';
import { GRADIENT_BG } from '../../utils/constants';
import { useTheme } from '../../context/ThemeContext';

function StatsScreen({ examHistory, onNavigate, themes }) {
  const { dm, cx } = useTheme();
  const totalExams = examHistory.length;
  const avg = totalExams > 0
    ? (examHistory.reduce((s, e) => s + (parseFloat(e.percentage) || 0), 0) / totalExams).toFixed(1)
    : 0;
  const totalQuestions = examHistory.reduce((s, e) => s + (e.numQuestions || 0), 0);
  const bestScore = totalExams > 0 ? Math.max(...examHistory.map(e => parseFloat(e.percentage) || 0)) : 0;
  const today = new Date().toDateString();
  const hasStudiedToday = examHistory.some(e => new Date(e.date).toDateString() === today);
  const level = Math.floor(totalQuestions / 100) + 1;
  const xpInLevel = totalQuestions % 100;

  const achievements = [
    { id: 'first_exam', name: 'Primer Paso', desc: 'Completa tu primer examen', icon: '🎯', unlocked: totalExams >= 1, progress: Math.min(totalExams * 100, 100) },
    { id: 'perfect_score', name: 'Perfección', desc: 'Saca un 100%', icon: '💯', unlocked: bestScore >= 100, progress: Math.min(bestScore, 100) },
    { id: 'questions_100', name: 'Centenario', desc: 'Responde 100 preguntas', icon: '📚', unlocked: totalQuestions >= 100, progress: Math.min((totalQuestions / 100) * 100, 100) },
    { id: 'questions_500', name: 'Experto', desc: 'Responde 500 preguntas', icon: '🎓', unlocked: totalQuestions >= 500, progress: Math.min((totalQuestions / 500) * 100, 100) },
  ];

  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(Date.now() - i * 86400000);
    const dateStr = date.toDateString();
    const examsDay = examHistory.filter(e => new Date(e.date).toDateString() === dateStr);
    return {
      date: date.toLocaleDateString('es-ES', { weekday: 'short' }),
      count: examsDay.length,
      avgScore: examsDay.length > 0 ? Math.round(examsDay.reduce((s, e) => s + (parseFloat(e.percentage) || 0), 0) / examsDay.length) : 0
    };
  }).reverse();

  // ── Stats por tema ─────────────────────────────────────────
  const [showAllThemes, setShowAllThemes] = useState(false);
  const now = new Date();
  const themeStats = (themes || [])
    .filter(t => (t.questions?.length || 0) > 0)
    .map(t => {
      const qs = t.questions || [];
      const total = qs.length;
      const mastered = qs.filter(q => (q.stability || 0) > 30).length;
      const due = qs.filter(q => q.next_review && new Date(q.next_review) <= now).length;
      const attempted = qs.filter(q => (q.attempts || 0) > 0);
      const avgAccuracy = attempted.length > 0
        ? Math.round(attempted.reduce((s, q) => s + (1 - (q.errors_count || 0) / Math.max(q.attempts || 1, 1)), 0) / attempted.length * 100)
        : null;
      return { name: t.name, number: t.number, total, mastered, due, avgAccuracy, attempted: attempted.length };
    })
    .sort((a, b) => (a.avgAccuracy ?? 101) - (b.avgAccuracy ?? 101)); // worst accuracy first

  const THEMES_PREVIEW = 5;
  const visibleThemes = showAllThemes ? themeStats : themeStats.slice(0, THEMES_PREVIEW);

  const cardClass = `rounded-2xl p-5 ${cx.cardAlt}`;
  const maxBar = Math.max(...last7Days.map(d => d.count), 1);

  return (
    <div className={`min-h-full ${cx.screen} transition-colors duration-300`}
      style={{ paddingBottom: 'var(--pb-screen)' }}>

      {/* HEADER */}
      <div className={`sticky top-0 z-10 px-4 pb-4 ${cx.screen}`} style={{ paddingTop: 'var(--pt-header)' }}>
        <div className="flex items-center gap-3 max-w-lg mx-auto">
          <button onClick={() => onNavigate('home')}
            className={`w-10 h-10 rounded-2xl flex items-center justify-center ${dm ? 'bg-[#1E293B] text-slate-300' : 'bg-white text-slate-600 shadow-sm'}`}>
            <Icons.ChevronLeft />
          </button>
          <h1 className={`font-bold text-xl ${dm ? 'text-slate-100' : 'text-slate-800'}`} style={{ fontFamily: 'Sora, system-ui' }}>
            Resultados
          </h1>
        </div>
      </div>

      <div className="px-4 max-w-lg mx-auto space-y-4">

        {/* NIVEL + XP */}
        <div className="rounded-2xl p-5 text-white" style={{ background: 'linear-gradient(135deg, #2563EB, #7C3AED)' }}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-blue-200 text-xs font-semibold uppercase tracking-wide">Tu nivel</p>
              <p className="text-3xl font-black mt-0.5" style={{ fontFamily: 'Sora, system-ui' }}>Nivel {level}</p>
            </div>
            <span className="text-4xl">🎖️</span>
          </div>
          <div className="h-2 rounded-full bg-white/20 overflow-hidden">
            <div className="h-full rounded-full bg-white transition-all duration-700"
              style={{ width: `${(xpInLevel / 100) * 100}%` }} />
          </div>
          <p className="text-blue-200 text-xs mt-2">{xpInLevel}/100 XP → Nivel {level + 1}</p>
        </div>

        {/* STATS GRID */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Media', value: `${avg}%`, color: '#2563EB', icon: '🎯' },
            { label: 'Mejor', value: `${bestScore.toFixed(0)}%`, color: '#10B981', icon: '🏆' },
            { label: 'Tests', value: totalExams, color: '#7C3AED', icon: '📝' },
            { label: 'Preguntas', value: totalQuestions, color: '#F59E0B', icon: '❓' },
          ].map((s, i) => (
            <div key={i} className={`${cardClass} text-center`}>
              <div className="text-xl mb-1">{s.icon}</div>
              <div className="text-2xl font-black" style={{ fontFamily: 'Sora, system-ui', color: s.color }}>{s.value}</div>
              <div className={`text-xs mt-0.5 ${dm ? 'text-slate-500' : 'text-slate-400'}`}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* RACHA */}
        <div className={cardClass}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-xs font-semibold uppercase tracking-wide ${dm ? 'text-slate-500' : 'text-slate-400'}`}>Racha de estudio</p>
              <p className="text-2xl font-black mt-1" style={{ fontFamily: 'Sora, system-ui', color: '#F59E0B' }}>
                {hasStudiedToday ? '🔥 Activo' : '💤 Inactivo'}
              </p>
              <p className={`text-xs mt-1 ${cx.muted}`}>
                {hasStudiedToday ? '¡Ya estudiaste hoy!' : 'Haz un test para mantener la racha'}
              </p>
            </div>
            <span className="text-4xl">{hasStudiedToday ? '🔥' : '⏰'}</span>
          </div>
        </div>

        {/* ACTIVIDAD 7 DÍAS */}
        <div className={cardClass}>
          <p className={`text-sm font-bold mb-4 ${dm ? 'text-slate-200' : 'text-slate-700'}`} style={{ fontFamily: 'Sora, system-ui' }}>
            Últimos 7 días
          </p>
          <div className="flex items-end gap-2 h-20">
            {last7Days.map((day, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className={`w-full rounded-lg transition-all ${dm ? 'bg-[#1E293B]' : 'bg-slate-100'}`} style={{ height: '64px', position: 'relative' }}>
                  {day.count > 0 && (
                    <div className="absolute bottom-0 left-0 right-0 rounded-lg"
                      style={{ height: `${(day.count / maxBar) * 100}%`, background: 'linear-gradient(to top, #2563EB, #7C3AED)' }} />
                  )}
                </div>
                <p className={`text-[10px] ${dm ? 'text-slate-600' : 'text-slate-400'}`}>{day.date}</p>
              </div>
            ))}
          </div>
        </div>

        {/* STATS POR TEMA */}
        {themeStats.length > 0 && (
          <div className={cardClass}>
            <p className={`text-sm font-bold mb-3 ${dm ? 'text-slate-200' : 'text-slate-700'}`} style={{ fontFamily: 'Sora, system-ui' }}>
              Por tema · {themeStats.length} con preguntas
            </p>
            <div className="space-y-3">
              {visibleThemes.map(t => {
                const masteredPct = t.total > 0 ? Math.round((t.mastered / t.total) * 100) : 0;
                const accColor = t.avgAccuracy === null ? cx.muted
                  : t.avgAccuracy >= 80 ? 'text-green-500'
                  : t.avgAccuracy >= 60 ? 'text-yellow-500'
                  : 'text-red-500';
                return (
                  <div key={t.number}>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className={`text-xs flex-1 truncate ${cx.body}`} title={t.name}>{t.name}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        {t.due > 0 && (
                          <span className="text-[10px] bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded-full font-semibold">
                            {t.due} pendientes
                          </span>
                        )}
                        {t.avgAccuracy !== null && (
                          <span className={`text-xs font-bold tabular-nums ${accColor}`}>{t.avgAccuracy}%</span>
                        )}
                        <span className={`text-[10px] ${cx.muted}`}>{t.total} preg.</span>
                      </div>
                    </div>
                    <div className={`w-full h-1.5 rounded-full ${dm ? 'bg-white/10' : 'bg-slate-100'}`}>
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${masteredPct}%`,
                          background: masteredPct >= 80 ? '#10B981' : masteredPct >= 50 ? '#F59E0B' : '#3B82F6',
                        }}
                      />
                    </div>
                    <p className={`text-[10px] mt-0.5 ${cx.muted}`}>{t.mastered}/{t.total} dominadas · {masteredPct}%</p>
                  </div>
                );
              })}
            </div>
            {themeStats.length > THEMES_PREVIEW && (
              <button
                onClick={() => setShowAllThemes(v => !v)}
                className={`mt-3 w-full text-xs font-semibold py-2 rounded-xl transition-colors ${dm ? 'text-blue-400 hover:bg-blue-500/10' : 'text-blue-600 hover:bg-blue-50'}`}
              >
                {showAllThemes ? '▲ Mostrar menos' : `▼ Ver los ${themeStats.length - THEMES_PREVIEW} restantes`}
              </button>
            )}
          </div>
        )}

        {/* LOGROS */}
        <div className={cardClass}>
          <p className={`text-sm font-bold mb-3 ${dm ? 'text-slate-200' : 'text-slate-700'}`} style={{ fontFamily: 'Sora, system-ui' }}>
            Logros · {achievements.filter(a => a.unlocked).length}/{achievements.length}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {achievements.map(a => (
              <div key={a.id} className={`p-3 rounded-xl border transition-all
                ${a.unlocked
                  ? dm ? 'bg-amber-500/10 border-amber-500/30' : 'bg-amber-50 border-amber-200'
                  : dm ? 'bg-[#1E293B] border-[#334155] opacity-50' : 'bg-slate-50 border-slate-200 opacity-50'
                }`}>
                <div className="text-2xl text-center mb-1">{a.icon}</div>
                <p className={`text-xs font-bold text-center ${a.unlocked ? 'text-amber-500' : dm ? 'text-slate-500' : 'text-slate-600'}`}>{a.name}</p>
                <p className={`text-[10px] text-center mt-0.5 ${dm ? 'text-slate-500' : 'text-slate-500'}`}>{a.desc}</p>
                {!a.unlocked && (
                  <div className={`h-1 rounded-full mt-2 overflow-hidden ${dm ? 'bg-[#334155]' : 'bg-slate-200'}`}>
                    <div className="h-full rounded-full" style={{ width: `${a.progress}%`, background: 'linear-gradient(90deg, #2563EB, #7C3AED)' }} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* HISTORIAL */}
        <div className={cardClass}>
          <p className={`text-sm font-bold mb-3 ${dm ? 'text-slate-200' : 'text-slate-700'}`} style={{ fontFamily: 'Sora, system-ui' }}>
            Historial reciente
          </p>
          {totalExams > 0 ? (
            <div className="space-y-2">
              {examHistory.slice(0, 8).map((e, i) => {
                const pct = parseFloat(e.percentage);
                const color = pct >= 80 ? '#10B981' : pct >= 50 ? '#F59E0B' : '#EF4444';
                return (
                  <div key={i} className={`flex items-center justify-between p-3 rounded-xl
                    ${cx.inner}`}>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                      <span className={`text-sm ${cx.muted}`}>
                        {new Date(e.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs ${dm ? 'text-slate-500' : 'text-slate-400'}`}>{e.numQuestions || 0} preg.</span>
                      <span className="font-bold text-sm" style={{ color }}>{e.percentage}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-10">
              <p className="text-4xl mb-2">📝</p>
              <p className={`text-sm font-semibold ${cx.muted}`}>Sin tests aún</p>
              <p className={`text-xs mt-1 ${dm ? 'text-slate-600' : 'text-slate-400'}`}>¡Haz tu primer test!</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}


export default StatsScreen;
