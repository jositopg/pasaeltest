import React from 'react';
import Icons from '../common/Icons';
import { GRADIENT_BG } from '../../utils/constants';

function HeatmapScreen({ themes, onNavigate, darkMode }) {
  const dm = darkMode;
  const themeStats = themes.map(theme => {
    const questions = theme.questions || [];
    const total = questions.length;
    const attempted = questions.filter(q => q.attempts && q.attempts > 0).length;
    const errors = questions.reduce((sum, q) => sum + (q.errors || 0), 0);
    const attempts = questions.reduce((sum, q) => sum + (q.attempts || 0), 0);
    const errorRate = attempts > 0 ? (errors / attempts) * 100 : 0;
    return { number: theme.number, name: theme.name, total, attempted, errors, attempts, errorRate: Math.round(errorRate) };
  }).filter(t => t.attempts > 0);

  const sortedByError = [...themeStats].sort((a, b) => b.errorRate - a.errorRate);
  const top10Critical = sortedByError.slice(0, 10);

  const getHeatColor = (errorRate) => {
    if (errorRate >= 70) return { bg: '#EF4444', text: 'white' };
    if (errorRate >= 50) return { bg: '#F97316', text: 'white' };
    if (errorRate >= 30) return { bg: '#F59E0B', text: 'white' };
    if (errorRate >= 10) return { bg: '#10B981', text: 'white' };
    return { bg: '#2563EB', text: 'white' };
  };

  const cardClass = `rounded-2xl p-5 ${dm ? 'bg-[#0F172A] border border-[#1E293B]' : 'bg-white border border-slate-100 shadow-sm'}`;

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
            Mapa de Calor
          </h1>
        </div>
      </div>

      <div className="px-4 max-w-lg mx-auto space-y-4">

        {/* GRID DE TEMAS */}
        <div className={cardClass}>
          <p className={`text-sm font-bold mb-4 ${dm ? 'text-slate-200' : 'text-slate-700'}`} style={{ fontFamily: 'Sora, system-ui' }}>
            Vista general · {themes.length} temas
          </p>
          <div className="grid grid-cols-9 gap-1.5">
            {themes.map(theme => {
              const stat = themeStats.find(s => s.number === theme.number);
              const hasData = stat && stat.attempts > 0;
              const colors = hasData ? getHeatColor(stat.errorRate) : null;
              return (
                <div key={theme.number}
                  className={`aspect-square rounded-lg flex items-center justify-center text-[9px] font-bold transition-all hover:scale-110 active:scale-95 cursor-default`}
                  style={hasData ? { background: colors.bg, color: colors.text } : { background: dm ? '#1E293B' : '#E2E8F0', color: dm ? '#475569' : '#94A3B8' }}
                  title={`Tema ${theme.number}: ${theme.name}${hasData ? ` - ${stat.errorRate}% error` : ''}`}>
                  {theme.number}
                </div>
              );
            })}
          </div>
          {/* Leyenda */}
          <div className="flex flex-wrap gap-3 mt-4">
            {[['#2563EB','Excelente'],['#10B981','Bien'],['#F59E0B','Medio'],['#F97316','Difícil'],['#EF4444','Crítico']].map(([c, l]) => (
              <div key={l} className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm" style={{ background: c }} />
                <span className={`text-[10px] ${dm ? 'text-slate-500' : 'text-slate-400'}`}>{l}</span>
              </div>
            ))}
          </div>
        </div>

        {/* TOP 10 CRÍTICOS */}
        <div className={cardClass}>
          <p className={`text-sm font-bold mb-3 ${dm ? 'text-slate-200' : 'text-slate-700'}`} style={{ fontFamily: 'Sora, system-ui' }}>
            🔥 Top críticos
          </p>
          {top10Critical.length > 0 ? (
            <div className="space-y-2">
              {top10Critical.map((stat, idx) => {
                const colors = getHeatColor(stat.errorRate);
                return (
                  <div key={stat.number} className={`flex items-center gap-3 p-3 rounded-xl ${dm ? 'bg-[#1E293B]' : 'bg-slate-50'}`}>
                    <span className={`text-lg font-black w-7 text-center ${dm ? 'text-slate-600' : 'text-slate-300'}`}>#{idx+1}</span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-semibold truncate ${dm ? 'text-slate-300' : 'text-slate-600'}`}>
                        T{stat.number} · {stat.name}
                      </p>
                      <p className={`text-[10px] mt-0.5 ${dm ? 'text-slate-600' : 'text-slate-400'}`}>
                        {stat.errors}/{stat.attempts} errores
                      </p>
                    </div>
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full text-white"
                      style={{ background: colors.bg }}>
                      {stat.errorRate}%
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-10">
              <p className="text-4xl mb-2">📊</p>
              <p className={`text-sm font-semibold ${dm ? 'text-slate-400' : 'text-slate-500'}`}>Sin datos aún</p>
              <p className={`text-xs mt-1 ${dm ? 'text-slate-600' : 'text-slate-400'}`}>Completa exámenes para ver el mapa</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

// ============================================================================
// SETTINGS SCREEN
// ============================================================================


export default HeatmapScreen;
