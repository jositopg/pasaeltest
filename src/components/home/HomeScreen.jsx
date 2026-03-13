import React from 'react';
import Icons from '../common/Icons';
import { useTheme } from '../../context/ThemeContext';

function HomeScreen({
  onNavigate,
  profile,
  user,
  onShowProfile,
  srsStats,
  tests = [],
  activeTestId,
  themes = [],
  onSwitchTest,
}) {
  const { dm, cx } = useTheme();

  const activeTest = tests.find(t => t.id === activeTestId);
  const activeThemeCount = themes.filter(t => t.questions?.length > 0).length;
  const activeQuestionCount = themes.reduce((acc, t) => acc + (t.questions?.length || 0), 0);

  const dueCount = srsStats?.dueQuestions?.length || 0;

  return (
    <div className={`min-h-full ${cx.screen} transition-colors duration-300`}
      style={{ paddingBottom: 'var(--pb-screen)' }}>

      {/* HEADER */}
      <div className={`sticky top-0 z-10 px-4 pb-4 ${cx.screen}`} style={{ paddingTop: 'var(--pt-header)' }}>
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <h1 className="font-display text-2xl font-bold" style={{ fontFamily: 'Sora, system-ui' }}>
            <span style={{ background: 'linear-gradient(135deg, #2563EB, #7C3AED)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              PasaElTest
            </span>
          </h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onNavigate('settings')}
              className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all
                ${dm ? 'bg-[#1E293B] text-slate-300 hover:text-white' : 'bg-white text-slate-500 hover:text-slate-800 shadow-sm'}`}
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
                <p className="font-semibold text-amber-400 text-sm">Modo prueba — los datos no se guardan</p>
                <p className={`text-xs mt-1 ${cx.muted}`}>Crea una cuenta gratis para guardar tu progreso.</p>
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
        <div className="animate-fade-in-up stagger-1">
          <p className={`text-sm ${cx.muted}`}>
            {user?.isGuest ? 'Bienvenido al modo prueba' : `Hola, ${user?.name?.split(' ')[0] || 'usuario'} 👋`}
          </p>
          <p className={`font-bold text-xl mt-0.5 ${dm ? 'text-slate-100' : 'text-slate-800'}`}
            style={{ fontFamily: 'Sora, system-ui' }}>
            ¿Qué practicamos hoy?
          </p>
        </div>

        {/* PLAN ACTIVO */}
        {activeTest ? (
          <div className="animate-fade-in-up stagger-2">
            <div
              className={`rounded-2xl p-5 space-y-4 ${
                dm
                  ? 'bg-[#0F172A] border border-blue-500/30'
                  : 'bg-white border border-blue-200 shadow-sm'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0"
                  style={{ background: 'linear-gradient(135deg, #2563EB22, #7C3AED22)' }}>
                  {activeTest.cover_emoji || '📋'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`font-bold text-base truncate ${dm ? 'text-slate-100' : 'text-slate-800'}`}
                    style={{ fontFamily: 'Sora, system-ui' }}>
                    {activeTest.name}
                  </p>
                  <p className={`text-xs mt-0.5 ${cx.muted}`}>
                    {activeThemeCount} tema{activeThemeCount !== 1 ? 's' : ''} · {activeQuestionCount} pregunta{activeQuestionCount !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>

              <button
                onClick={() => onNavigate('exam')}
                className="w-full py-3.5 rounded-xl text-white font-bold text-sm transition-all active:scale-[0.98]"
                style={{ background: 'linear-gradient(135deg, #2563EB, #7C3AED)', boxShadow: '0 4px 16px rgba(37,99,235,0.3)', fontFamily: 'Sora, system-ui' }}
              >
                Hacer test →
              </button>

              {tests.length > 1 && (
                <button
                  onClick={() => onNavigate('exams')}
                  className={`w-full py-2 rounded-xl text-xs font-semibold transition-all ${
                    dm ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  Ver todos mis planes →
                </button>
              )}
            </div>
          </div>
        ) : (
          /* Sin planes todavía */
          <div className={`rounded-2xl p-6 text-center animate-fade-in-up stagger-2 ${cx.cardAlt}`}>
            <div className="text-4xl mb-3">📚</div>
            <p className={`font-semibold text-sm ${dm ? 'text-slate-300' : 'text-slate-700'}`}>
              Aún no tienes ningún plan
            </p>
            <p className={`text-xs mt-1 mb-4 ${cx.muted}`}>
              Únete al plan de tu academia o crea el tuyo propio.
            </p>
            <button
              onClick={() => onNavigate('exams')}
              className="px-5 py-2.5 rounded-xl text-white text-sm font-semibold"
              style={{ background: 'linear-gradient(135deg, #2563EB, #7C3AED)' }}
            >
              Explorar planes →
            </button>
          </div>
        )}

        {/* REPASO SRS */}
        {dueCount > 0 && (
          <button
            onClick={() => onNavigate('review')}
            className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition-all active:scale-[0.98] animate-fade-in-up stagger-3 ${
              dm ? 'bg-[#0F172A] border border-purple-500/30 hover:border-purple-500/50' : 'bg-white border border-purple-200 shadow-sm'
            }`}
          >
            <span className="text-2xl">🧠</span>
            <div className="flex-1 text-left">
              <p className={`text-sm font-bold ${dm ? 'text-purple-300' : 'text-purple-700'}`}
                style={{ fontFamily: 'Sora, system-ui' }}>
                Repasar ahora
              </p>
              <p className={`text-xs ${dm ? 'text-purple-400/70' : 'text-purple-500'}`}>
                {dueCount} pregunta{dueCount !== 1 ? 's' : ''} pendiente{dueCount !== 1 ? 's' : ''} hoy
              </p>
            </div>
            <span className={`text-lg opacity-40 ${dm ? 'text-purple-300' : 'text-purple-600'}`}>→</span>
          </button>
        )}

      </div>
    </div>
  );
}

export default HomeScreen;
