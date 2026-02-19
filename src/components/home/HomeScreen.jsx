import React from 'react';
import Icons from '../common/Icons';
import { GRADIENT_BG, GRADIENT_STYLE } from '../../utils/constants';

function HomeScreen({ onNavigate, stats, profile, user, onShowProfile, darkMode }) {
  const dm = darkMode;
  return (
    <div className={`min-h-full ${dm ? 'bg-[#080C14]' : 'bg-[#F0F4FF]'} transition-colors duration-300`}
      style={{ paddingBottom: '100px' }}>
      
      {/* HEADER */}
      <div className={`sticky top-0 z-10 px-4 pt-12 pb-4 ${dm ? 'bg-[#080C14]' : 'bg-[#F0F4FF]'}`}>
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <div>
            <p className={`text-xs font-semibold uppercase tracking-widest ${dm ? 'text-blue-400' : 'text-blue-600'}`}>
              {profile?.examName || 'Mi Oposición'}
            </p>
            <h1 className="font-display text-2xl font-bold mt-0.5" style={{ fontFamily: 'Sora, system-ui' }}>
              <span style={{ background: 'linear-gradient(135deg, #2563EB, #7C3AED)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                PasaElTest
              </span>
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onNavigate('settings')}
              className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all
                ${dm ? 'bg-[#1E293B] text-slate-400 hover:text-slate-200' : 'bg-white text-slate-400 hover:text-slate-700 shadow-sm'}`}
            >
              <Icons.Settings />
            </button>
            {user && (
              <button
                onClick={onShowProfile}
                className="w-10 h-10 rounded-2xl flex items-center justify-center text-white font-bold text-sm transition-all shadow-md"
                style={{ background: 'linear-gradient(135deg, #2563EB, #7C3AED)' }}
              >
                {user.isGuest ? '👤' : user.name?.charAt(0).toUpperCase()}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 max-w-lg mx-auto space-y-4">

        {/* BANNER INVITADO */}
        {user?.isGuest && (
          <div className="rounded-2xl p-4 border border-amber-400/30 animate-fade-in"
            style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.1), rgba(234,88,12,0.1))' }}>
            <div className="flex items-start gap-3">
              <span className="text-xl mt-0.5">⚠️</span>
              <div className="flex-1">
                <p className="font-semibold text-amber-400 text-sm">Modo Prueba — Datos temporales</p>
                <p className={`text-xs mt-1 ${dm ? 'text-slate-400' : 'text-slate-500'}`}>
                  Tu progreso no se guarda al cerrar sesión.
                </p>
                <button
                  onClick={() => window.confirm('¿Registrarte ahora? Perderás los datos actuales.') && onNavigate('settings')}
                  className="mt-2 text-xs font-semibold text-amber-400 underline underline-offset-2"
                >
                  Crear cuenta gratis →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* SALUDO */}
        <div className={`rounded-2xl p-5 animate-fade-in-up stagger-1
          ${dm ? 'bg-[#0F172A] border border-[#1E293B]' : 'bg-white border border-slate-100 shadow-md'}`}>
          <p className={`text-sm ${dm ? 'text-slate-400' : 'text-slate-500'}`}>
            {user?.isGuest ? 'Bienvenido al modo prueba' : `Hola, ${user?.name?.split(' ')[0] || 'usuario'} 👋`}
          </p>
          <p className={`font-display font-bold text-xl mt-1 ${dm ? 'text-slate-100' : 'text-slate-800'}`}
            style={{ fontFamily: 'Sora, system-ui' }}>
            ¿Qué estudias hoy?
          </p>
          {/* Barra de progreso */}
          <div className="mt-4">
            <div className="flex justify-between items-center mb-2">
              <span className={`text-xs font-medium ${dm ? 'text-slate-400' : 'text-slate-500'}`}>
                Progreso general
              </span>
              <span className="text-xs font-bold" style={{ color: '#2563EB' }}>
                {stats.themesCompleted || 0}/90 temas
              </span>
            </div>
            <div className={`h-2 rounded-full overflow-hidden ${dm ? 'bg-[#1E293B]' : 'bg-slate-100'}`}>
              <div className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${Math.round((stats.themesCompleted || 0) / 90 * 100)}%`,
                  background: 'linear-gradient(90deg, #2563EB, #7C3AED)'
                }}
              />
            </div>
          </div>
        </div>

        {/* STATS GRID */}
        <div className="grid grid-cols-3 gap-3 animate-fade-in-up stagger-2">
          {[
            { label: 'Exámenes', value: stats.totalExams || 0, icon: '📝' },
            { label: 'Media', value: `${stats.avgScore || 0}%`, icon: '🎯' },
            { label: 'Preguntas', value: stats.totalQuestions || 0, icon: '❓' },
          ].map((stat, i) => (
            <div key={i}
              className={`rounded-2xl p-3 text-center
                ${dm ? 'bg-[#0F172A] border border-[#1E293B]' : 'bg-white border border-slate-100 shadow-sm'}`}>
              <div className="text-xl mb-1">{stat.icon}</div>
              <div className="font-display font-bold text-lg" style={{ fontFamily: 'Sora, system-ui', color: '#2563EB' }}>
                {stat.value}
              </div>
              <div className={`text-[10px] font-medium mt-0.5 ${dm ? 'text-slate-500' : 'text-slate-400'}`}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        {/* ACCIONES PRINCIPALES */}
        <div className="space-y-3 animate-fade-in-up stagger-3">
          {/* Botón principal */}
          <button
            onClick={() => onNavigate('exam')}
            className="w-full flex items-center justify-between px-5 py-4 rounded-2xl text-white font-semibold transition-all active:scale-[0.98]"
            style={{ background: 'linear-gradient(135deg, #2563EB, #7C3AED)', boxShadow: '0 4px 20px rgba(37,99,235,0.3)' }}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">📝</span>
              <div className="text-left">
                <div className="text-sm font-bold" style={{ fontFamily: 'Sora, system-ui' }}>Crear Examen</div>
                <div className="text-xs opacity-75">Practica con preguntas tipo test</div>
              </div>
            </div>
            <span className="text-xl opacity-60">→</span>
          </button>

          {/* Botones secundarios */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => onNavigate('heatmap')}
              className={`flex flex-col items-start gap-2 px-4 py-4 rounded-2xl transition-all active:scale-[0.97]
                ${dm ? 'bg-[#0F172A] border border-[#1E293B] hover:border-orange-500/30' : 'bg-white border border-slate-100 shadow-sm hover:shadow-md'}`}
            >
              <span className="text-2xl">🔥</span>
              <div>
                <div className={`text-sm font-bold ${dm ? 'text-slate-200' : 'text-slate-700'}`} style={{ fontFamily: 'Sora, system-ui' }}>
                  Mapa de Calor
                </div>
                <div className={`text-xs ${dm ? 'text-slate-500' : 'text-slate-400'}`}>Ver progreso</div>
              </div>
            </button>

            <button
              onClick={() => onNavigate('themes')}
              className={`flex flex-col items-start gap-2 px-4 py-4 rounded-2xl transition-all active:scale-[0.97]
                ${dm ? 'bg-[#0F172A] border border-[#1E293B] hover:border-blue-500/30' : 'bg-white border border-slate-100 shadow-sm hover:shadow-md'}`}
            >
              <span className="text-2xl">📚</span>
              <div>
                <div className={`text-sm font-bold ${dm ? 'text-slate-200' : 'text-slate-700'}`} style={{ fontFamily: 'Sora, system-ui' }}>
                  Temas
                </div>
                <div className={`text-xs ${dm ? 'text-slate-500' : 'text-slate-400'}`}>Gestionar contenido</div>
              </div>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}


export default HomeScreen;
