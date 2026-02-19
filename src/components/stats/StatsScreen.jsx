import React from 'react';
import Icons from '../common/Icons';
import { GRADIENT_BG } from '../../utils/constants';

function StatsScreen({ examHistory, onNavigate, themes, darkMode }) {
  const dm = darkMode;
  const totalExams = examHistory.length;
  const avg = totalExams > 0 
    ? (examHistory.reduce((s, e) => s + parseFloat(e.percentage), 0) / totalExams).toFixed(1) 
    : 0;
  const totalQuestions = examHistory.reduce((s, e) => s + (e.numQuestions || 0), 0);
  const bestScore = totalExams > 0 ? Math.max(...examHistory.map(e => parseFloat(e.percentage))) : 0;
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
      avgScore: examsDay.length > 0 ? Math.round(examsDay.reduce((s, e) => s + parseFloat(e.percentage), 0) / examsDay.length) : 0
    };
  }).reverse();

  const cardClass = `rounded-2xl p-5 ${dm ? 'bg-[#0F172A] border border-[#1E293B]' : 'bg-white border border-slate-100 shadow-sm'}`;
  const maxBar = Math.max(...last7Days.map(d => d.count), 1);

  return (
    <div className={`min-h-full ${dm ? 'bg-[#080C14]' : 'bg-[#F0F4FF]'} transition-colors duration-300`}
      style={{ paddingBottom: '100px' }}>

      {/* HEADER */}
      <div className={`sticky top-0 z-10 px-4 pt-12 pb-4 ${dm ? 'bg-[#080C14]' : 'bg-[#F0F4FF]'}`}>
        <div className="flex items-center gap-3 max-w-lg mx-auto">
          <button onClick={() => onNavigate('home')}
            className={`w-10 h-10 rounded-2xl flex items-center justify-center ${dm ? 'bg-[#1E293B] text-slate-300' : 'bg-white text-slate-600 shadow-sm'}`}>
            <Icons.ChevronLeft />
          </button>
          <h1 className={`font-bold text-xl ${dm ? 'text-slate-100' : 'text-slate-800'}`} style={{ fontFamily: 'Sora, system-ui' }}>
            Estadísticas
          </h1>
        </div>
      </div>

      <div className="px-4 max-w-lg mx-auto space-y-4">

        {/* NIVEL + XP */}
        <div className="rounded-2xl p-5 text-white" style={{ background: 'linear-gradient(135deg, #2563EB, #7C3AED)' }}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-blue-200 text-xs font-semibold uppercase tracking-wide">Nivel de opositor</p>
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
            { label: 'Exámenes', value: totalExams, color: '#7C3AED', icon: '📝' },
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
              <p className={`text-xs mt-1 ${dm ? 'text-slate-400' : 'text-slate-500'}`}>
                {hasStudiedToday ? '¡Ya estudiaste hoy!' : 'Haz un examen para mantener la racha'}
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
                <p className={`text-xs font-bold text-center ${a.unlocked ? 'text-amber-500' : dm ? 'text-slate-500' : 'text-slate-400'}`}>{a.name}</p>
                <p className={`text-[10px] text-center mt-0.5 ${dm ? 'text-slate-600' : 'text-slate-400'}`}>{a.desc}</p>
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
                    ${dm ? 'bg-[#1E293B]' : 'bg-slate-50'}`}>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                      <span className={`text-sm ${dm ? 'text-slate-400' : 'text-slate-500'}`}>
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
              <p className={`text-sm font-semibold ${dm ? 'text-slate-400' : 'text-slate-500'}`}>Sin exámenes aún</p>
              <p className={`text-xs mt-1 ${dm ? 'text-slate-600' : 'text-slate-400'}`}>¡Haz tu primer examen!</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}


export default StatsScreen;
