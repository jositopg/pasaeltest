import React, { useState, useEffect } from 'react';
import Icons from '../common/Icons';
import { useTheme } from '../../context/ThemeContext';
import { supabase } from '../../supabaseClient';

function StatPill({ label, value, color = 'text-blue-500' }) {
  const { cx } = useTheme();
  return (
    <div className="text-center">
      <p className={`text-2xl font-black ${color}`} style={{ fontFamily: 'Sora, system-ui' }}>{value}</p>
      <p className={`text-[10px] font-medium mt-0.5 ${cx.muted}`}>{label}</p>
    </div>
  );
}

export default function AcademyStudentsScreen({ onNavigate, onSwitchTest }) {
  const { dm, cx } = useTheme();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { setError('Sin sesión'); setLoading(false); return; }
        const res = await fetch('/api/manage-plans', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
        setPlans(data.plans || []);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const totalStudents = plans.reduce((s, p) => s + (p.clones || 0), 0);
  const totalQuestions = plans.reduce((s, p) => s + (p.totalQuestions || 0), 0);
  const publishedPlans = plans.filter(p => p.invite_slug).length;

  return (
    <div className={`min-h-full ${cx.screen} transition-colors`} style={{ paddingBottom: 'var(--pb-screen)' }}>

      {/* HEADER */}
      <div className={`sticky top-0 z-10 px-4 pb-4 ${cx.screen}`} style={{ paddingTop: 'var(--pt-header)' }}>
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <h1 className={`font-bold text-2xl ${cx.heading}`} style={{ fontFamily: 'Sora, system-ui' }}>
            Alumnos
          </h1>
          <button
            onClick={() => onNavigate('exams')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold bg-blue-500 hover:bg-blue-600 text-white transition-colors"
          >
            <Icons.Plus />
            Nuevo plan
          </button>
        </div>
      </div>

      <div className="px-4 max-w-lg mx-auto space-y-4">

        {loading && (
          <div className="flex justify-center py-16">
            <div className="w-7 h-7 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {error && (
          <div className={`rounded-2xl p-5 text-center ${cx.card}`}>
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {!loading && !error && (
          <>
            {/* RESUMEN GLOBAL */}
            <div className={`rounded-2xl p-5 ${cx.cardAlt}`}>
              <p className={`text-xs font-bold uppercase tracking-wide mb-4 ${cx.muted}`}>Vista general</p>
              <div className="grid grid-cols-3 gap-2">
                <StatPill label="Alumnos" value={totalStudents} color="text-blue-500" />
                <div className={`w-px ${dm ? 'bg-white/10' : 'bg-slate-200'}`} />
                <StatPill label="Planes publicados" value={`${publishedPlans}/${plans.length}`} color="text-purple-500" />
              </div>
              <div className={`h-px my-4 ${dm ? 'bg-white/10' : 'bg-slate-100'}`} />
              <div className="grid grid-cols-1">
                <StatPill label="Preguntas totales en todos los planes" value={totalQuestions} color="text-green-500" />
              </div>
            </div>

            {/* PLANES */}
            {plans.length === 0 ? (
              <div className={`rounded-2xl p-8 text-center ${cx.card}`}>
                <div className="text-4xl mb-3">📋</div>
                <p className={`font-semibold ${cx.muted}`}>Sin planes publicados todavía</p>
                <p className={`text-xs mt-1 ${dm ? 'text-slate-600' : 'text-slate-400'}`}>
                  Crea y publica un plan para que tus alumnos puedan unirse
                </p>
                <button
                  onClick={() => onNavigate('exams')}
                  className="mt-4 px-5 py-2.5 rounded-xl bg-blue-500 text-white text-sm font-semibold"
                >
                  Ir a mis planes →
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className={`text-xs font-bold uppercase tracking-wide px-1 ${cx.muted}`}>
                  Tus planes · {plans.length}
                </p>
                {plans.map(plan => (
                  <div key={plan.id} className={`rounded-2xl p-4 ${cx.card}`}>
                    <div className="flex items-start gap-3">
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0 ${dm ? 'bg-white/10' : 'bg-slate-100'}`}>
                        {plan.cover_emoji || '📋'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className={`font-semibold text-sm truncate ${cx.heading}`}>{plan.name}</p>
                          {plan.invite_slug ? (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/15 text-green-500 font-semibold">Publicado</span>
                          ) : (
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${dm ? 'bg-white/10 text-slate-400' : 'bg-slate-100 text-slate-400'}`}>Sin publicar</span>
                          )}
                        </div>

                        {/* Stats row */}
                        <div className="flex items-center gap-3 mt-2 flex-wrap">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm">👥</span>
                            <span className={`text-xs font-bold ${plan.clones > 0 ? 'text-blue-500' : cx.muted}`}>
                              {plan.clones || 0} alumnos
                            </span>
                          </div>
                          <div className={`w-px h-3 ${dm ? 'bg-white/10' : 'bg-slate-200'}`} />
                          <span className={`text-xs ${cx.muted}`}>{plan.totalThemes || 0} temas</span>
                          <div className={`w-px h-3 ${dm ? 'bg-white/10' : 'bg-slate-200'}`} />
                          <span className={`text-xs ${cx.muted}`}>{plan.totalQuestions || 0} preguntas</span>
                        </div>

                        {/* Invite link */}
                        {plan.invite_slug && (
                          <button
                            onClick={() => {
                              const url = `${window.location.origin}/?join=${plan.invite_slug}`;
                              navigator.clipboard.writeText(url).catch(() => {});
                            }}
                            className={`mt-2 text-[10px] font-mono truncate max-w-full text-left ${dm ? 'text-blue-400/60 hover:text-blue-400' : 'text-blue-400 hover:text-blue-600'} transition-colors`}
                            title="Copiar enlace"
                          >
                            🔗 /?join={plan.invite_slug}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => { onSwitchTest && onSwitchTest(plan.id); onNavigate('themes'); }}
                        className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-colors ${dm ? 'bg-white/5 text-slate-300 hover:bg-white/10' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                      >
                        Ver temas →
                      </button>
                      {plan.invite_slug && (
                        <button
                          onClick={() => {
                            const url = `${window.location.origin}/?join=${plan.invite_slug}`;
                            navigator.clipboard.writeText(url).catch(() => {});
                          }}
                          className="flex-1 py-2 rounded-xl text-xs font-semibold bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors"
                        >
                          🔗 Copiar enlace
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* INFO FUTURA */}
            <div className={`rounded-2xl p-4 text-center ${dm ? 'bg-blue-500/5 border border-blue-500/20' : 'bg-blue-50 border border-blue-100'}`}>
              <p className={`text-xs ${dm ? 'text-blue-400/70' : 'text-blue-500'}`}>
                📊 Las estadísticas detalladas por alumno (progresos, notas medias) estarán disponibles próximamente.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
