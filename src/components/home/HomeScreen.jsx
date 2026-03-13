import React, { useState } from 'react';
import Icons from '../common/Icons';
import { useTheme } from '../../context/ThemeContext';

// ─── Vista Academia ────────────────────────────────────────────────────────────
function AcademyHome({ user, tests, themes, activeTestId, onNavigate, onSwitchTest, srsStats, cx, dm }) {
  const [copiedId, setCopiedId] = useState(null);
  const totalQuestions = themes.reduce((a, t) => a + (t.questions?.length || 0), 0);
  const totalThemes = themes.filter(t => t.questions?.length > 0).length;

  const copyShareLink = (test) => {
    navigator.clipboard.writeText(`${window.location.origin}/?join=${test.invite_slug}`)
      .then(() => {
        setCopiedId(test.id);
        setTimeout(() => setCopiedId(null), 2000);
      })
      .catch(() => {});
  };

  const handleShare = (test) => {
    if (test.invite_slug) {
      copyShareLink(test);
    } else {
      // Plan no publicado aún → ir a ExamsScreen donde está el modal de publicar
      if (test.id !== activeTestId) onSwitchTest(test.id);
      onNavigate('exams');
    }
  };

  return (
    <>
      {/* SALUDO */}
      <div className="animate-fade-in-up stagger-1">
        <p className={`text-sm ${cx.muted}`}>Hola, {user?.name?.split(' ')[0] || 'academia'} 👋</p>
        <p className={`font-bold text-xl mt-0.5 ${dm ? 'text-slate-100' : 'text-slate-800'}`}
          style={{ fontFamily: 'Sora, system-ui' }}>
          Gestiona tus planes
        </p>
      </div>

      {/* RESUMEN GLOBAL */}
      {tests.length > 0 && (
        <div className={`rounded-2xl p-4 flex items-center gap-4 animate-fade-in-up stagger-2 ${cx.cardAlt}`}>
          <div className="flex-1 text-center">
            <p className="text-2xl font-black" style={{ color: '#2563EB', fontFamily: 'Sora, system-ui' }}>{tests.length}</p>
            <p className={`text-[10px] font-medium mt-0.5 ${cx.muted}`}>Planes</p>
          </div>
          <div className={`w-px h-8 ${dm ? 'bg-white/10' : 'bg-slate-200'}`} />
          <div className="flex-1 text-center">
            <p className="text-2xl font-black" style={{ color: '#7C3AED', fontFamily: 'Sora, system-ui' }}>{totalThemes}</p>
            <p className={`text-[10px] font-medium mt-0.5 ${cx.muted}`}>Temas activos</p>
          </div>
          <div className={`w-px h-8 ${dm ? 'bg-white/10' : 'bg-slate-200'}`} />
          <div className="flex-1 text-center">
            <p className="text-2xl font-black" style={{ color: '#10B981', fontFamily: 'Sora, system-ui' }}>{totalQuestions}</p>
            <p className={`text-[10px] font-medium mt-0.5 ${cx.muted}`}>Preguntas</p>
          </div>
        </div>
      )}

      {/* LISTA DE PLANES */}
      <div className="space-y-3 animate-fade-in-up stagger-3">
        {tests.map(test => {
          const isActive = test.id === activeTestId;
          const isCopied = copiedId === test.id;
          const isPublished = !!test.invite_slug;
          return (
            <div key={test.id}
              className={`rounded-2xl p-4 ${
                isActive
                  ? dm ? 'bg-[#0F172A] border border-blue-500/30' : 'bg-white border border-blue-200 shadow-sm'
                  : dm ? 'bg-[#0F172A] border border-white/10' : 'bg-white border border-slate-200 shadow-sm'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
                  style={{ background: 'linear-gradient(135deg, #2563EB22, #7C3AED22)' }}>
                  {test.cover_emoji || '📋'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`font-bold text-sm truncate ${dm ? 'text-slate-100' : 'text-slate-800'}`}>
                    {test.name}
                  </p>
                  {isActive && (
                    <p className={`text-xs mt-0.5 ${cx.muted}`}>
                      {totalThemes} tema{totalThemes !== 1 ? 's' : ''} · {totalQuestions} preg.
                      {isPublished && <span className="ml-1.5 text-green-500">· Publicado</span>}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {/* Compartir: siempre visible para academia */}
                  <button
                    onClick={() => handleShare(test)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      isCopied
                        ? 'bg-green-500/20 text-green-400'
                        : isPublished
                        ? dm ? 'text-slate-400 hover:bg-green-500/15 hover:text-green-300' : 'text-slate-400 hover:bg-green-50 hover:text-green-600'
                        : dm ? 'bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/30' : 'bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200'
                    }`}
                    title={isPublished ? 'Copiar enlace de invitación' : 'Publicar y compartir'}
                  >
                    {isCopied ? '✓ Copiado' : isPublished ? '🔗' : 'Compartir'}
                  </button>
                  <button
                    onClick={() => { if (!isActive) onSwitchTest(test.id); onNavigate('themes'); }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      isActive
                        ? 'bg-blue-500 text-white'
                        : dm ? 'bg-white/10 text-slate-300 hover:bg-white/15' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {isActive ? 'Ver →' : 'Abrir'}
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {/* CTA nuevo plan */}
        <button
          onClick={() => onNavigate('exams')}
          className={`w-full py-3.5 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98] border-2 border-dashed ${
            dm ? 'border-white/15 text-slate-400 hover:border-blue-500/40 hover:text-blue-400' : 'border-slate-200 text-slate-400 hover:border-blue-300 hover:text-blue-500'
          }`}
        >
          <Icons.Plus />
          Nuevo plan
        </button>
      </div>

      {/* REPASO SRS (academias también pueden practicar) */}
      {(srsStats?.dueQuestions?.length || 0) > 0 && (
        <SRSBanner count={srsStats.dueQuestions.length} onNavigate={onNavigate} cx={cx} dm={dm} />
      )}
    </>
  );
}

// ─── Vista Estudiante ──────────────────────────────────────────────────────────
function StudentHome({ user, tests, themes, activeTestId, onNavigate, onShowProfile, onSwitchTest, srsStats, cx, dm, onJoinWithCode }) {
  const [code, setCode] = useState('');
  const [joining, setJoining] = useState(false);

  const activeTest = tests.find(t => t.id === activeTestId);
  const activeThemeCount = themes.filter(t => t.questions?.length > 0).length;
  const activeQuestionCount = themes.reduce((acc, t) => acc + (t.questions?.length || 0), 0);
  const dueCount = srsStats?.dueQuestions?.length || 0;

  const handleCodeSubmit = (e) => {
    e.preventDefault();
    const slug = code.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (!slug) return;
    onJoinWithCode(slug);
  };

  if (tests.length === 0) {
    return (
      <>
        {/* SALUDO */}
        <div className="animate-fade-in-up stagger-1">
          <p className={`text-sm ${cx.muted}`}>
            {user?.isGuest ? 'Bienvenido al modo prueba' : `Hola, ${user?.name?.split(' ')[0] || 'usuario'} 👋`}
          </p>
          <p className={`font-bold text-xl mt-0.5 ${dm ? 'text-slate-100' : 'text-slate-800'}`}
            style={{ fontFamily: 'Sora, system-ui' }}>
            ¿Tienes un enlace de tu academia?
          </p>
        </div>

        {/* UNIRSE CON CÓDIGO */}
        <div className={`rounded-2xl p-5 space-y-4 animate-fade-in-up stagger-2 ${cx.cardAlt}`}>
          <div className="text-center">
            <div className="text-4xl mb-2">🔗</div>
            <p className={`text-sm font-semibold ${dm ? 'text-slate-200' : 'text-slate-700'}`}>
              Únete al plan de tu academia
            </p>
            <p className={`text-xs mt-1 ${cx.muted}`}>
              Pide el enlace o código a tu academia o profesor
            </p>
          </div>
          <form onSubmit={handleCodeSubmit} className="space-y-3">
            <input
              type="text"
              value={code}
              onChange={e => setCode(e.target.value)}
              placeholder="Ej: guardia-civil-2025"
              className={`w-full rounded-xl px-4 py-3 text-sm outline-none transition-all text-center font-mono tracking-wide ${cx.input}`}
            />
            <button
              type="submit"
              disabled={!code.trim()}
              className="w-full py-3.5 rounded-xl text-white font-bold text-sm disabled:opacity-40 transition-all active:scale-[0.98]"
              style={{ background: 'linear-gradient(135deg, #2563EB, #7C3AED)' }}
            >
              Unirme →
            </button>
          </form>
        </div>

        <div className="flex items-center gap-3">
          <div className={`flex-1 h-px ${dm ? 'bg-white/10' : 'bg-slate-200'}`} />
          <span className={`text-xs ${cx.muted}`}>o</span>
          <div className={`flex-1 h-px ${dm ? 'bg-white/10' : 'bg-slate-200'}`} />
        </div>

        {/* CTA crear plan propio */}
        <button
          onClick={() => onNavigate('exams')}
          className={`w-full py-3.5 rounded-2xl text-sm font-semibold transition-all active:scale-[0.98] border ${
            dm ? 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm'
          }`}
        >
          Crear mi propio plan de estudio →
        </button>
      </>
    );
  }

  return (
    <>
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
      {activeTest && (
        <div className={`rounded-2xl p-5 space-y-4 animate-fade-in-up stagger-2 ${
          dm ? 'bg-[#0F172A] border border-blue-500/30' : 'bg-white border border-blue-200 shadow-sm'
        }`}>
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
      )}

      {/* REPASO SRS */}
      {dueCount > 0 && <SRSBanner count={dueCount} onNavigate={onNavigate} cx={cx} dm={dm} />}
    </>
  );
}

// ─── Banner SRS compartido ─────────────────────────────────────────────────────
function SRSBanner({ count, onNavigate, cx, dm }) {
  return (
    <button
      onClick={() => onNavigate('review')}
      className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition-all active:scale-[0.98] animate-fade-in-up ${
        dm ? 'bg-[#0F172A] border border-purple-500/30 hover:border-purple-500/50' : 'bg-white border border-purple-200 shadow-sm'
      }`}
    >
      <span className="text-2xl">🧠</span>
      <div className="flex-1 text-left">
        <p className={`text-sm font-bold ${dm ? 'text-purple-300' : 'text-purple-700'}`} style={{ fontFamily: 'Sora, system-ui' }}>
          Repasar ahora
        </p>
        <p className={`text-xs ${dm ? 'text-purple-400/70' : 'text-purple-500'}`}>
          {count} pregunta{count !== 1 ? 's' : ''} pendiente{count !== 1 ? 's' : ''} hoy
        </p>
      </div>
      <span className={`text-lg opacity-40 ${dm ? 'text-purple-300' : 'text-purple-600'}`}>→</span>
    </button>
  );
}

// ─── HomeScreen principal ──────────────────────────────────────────────────────
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
  onJoinWithCode,
}) {
  const { dm, cx } = useTheme();
  const isAcademy = user?.role === 'academy';

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

        {/* CONTENIDO POR ROL */}
        {isAcademy ? (
          <AcademyHome
            user={user} tests={tests} themes={themes} activeTestId={activeTestId}
            onNavigate={onNavigate} onShowProfile={onShowProfile} onSwitchTest={onSwitchTest}
            srsStats={srsStats} cx={cx} dm={dm}
          />
        ) : (
          <StudentHome
            user={user} tests={tests} themes={themes} activeTestId={activeTestId}
            onNavigate={onNavigate} onShowProfile={onShowProfile} onSwitchTest={onSwitchTest}
            srsStats={srsStats} cx={cx} dm={dm} onJoinWithCode={onJoinWithCode}
          />
        )}

      </div>
    </div>
  );
}

export default HomeScreen;
