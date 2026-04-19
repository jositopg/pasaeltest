import React, { useState, useEffect, useCallback } from 'react';
import Icons from '../common/Icons';
import { useTheme } from '../../context/ThemeContext';
import { authFetch } from '../../supabaseClient';

// ─── Utilidades ────────────────────────────────────────────────────────────────
function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
}
function fmtRelative(iso) {
  if (!iso) return 'Nunca';
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Hoy';
  if (days === 1) return 'Ayer';
  if (days < 7)  return `Hace ${days} días`;
  if (days < 30) return `Hace ${Math.floor(days / 7)} sem.`;
  return fmtDate(iso);
}
function initials(name, email) {
  const src = name || email || '?';
  return src.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase()).join('');
}
function scoreColor(score) {
  if (score === null) return 'text-slate-400';
  if (score >= 70) return 'text-green-500';
  if (score >= 50) return 'text-yellow-500';
  return 'text-red-500';
}

// ─── Sub-componentes ───────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, icon, color = 'blue', dm, cx }) {
  const colors = {
    blue:   dm ? 'bg-blue-500/10 border-blue-500/20 text-blue-400'   : 'bg-blue-50 border-blue-100 text-blue-600',
    green:  dm ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-green-50 border-green-100 text-green-600',
    amber:  dm ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'bg-amber-50 border-amber-100 text-amber-600',
    red:    dm ? 'bg-red-500/10 border-red-500/20 text-red-400'       : 'bg-red-50 border-red-100 text-red-500',
    purple: dm ? 'bg-purple-500/10 border-purple-500/20 text-purple-400' : 'bg-purple-50 border-purple-100 text-purple-600',
  };
  return (
    <div className={`rounded-2xl p-4 border ${colors[color]}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-lg">{icon}</span>
        <p className="text-xs font-semibold opacity-70">{label}</p>
      </div>
      <p className="text-2xl font-black" style={{ fontFamily: 'Sora, system-ui' }}>{value ?? '—'}</p>
      {sub && <p className="text-[10px] mt-0.5 opacity-60">{sub}</p>}
    </div>
  );
}

function StudentRow({ s, dm, cx }) {
  const [expanded, setExpanded] = useState(false);
  const ini = initials(s.name, s.email);
  const avatarBg = dm ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-700';

  return (
    <div className={`rounded-2xl overflow-hidden transition-all ${cx.card} border ${dm ? 'border-white/5' : 'border-slate-100'}`}>
      <button
        className="w-full flex items-center gap-3 p-3.5 text-left"
        onClick={() => setExpanded(e => !e)}
      >
        {/* Avatar */}
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 ${avatarBg}`}>
          {ini}
        </div>

        {/* Info principal */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className={`text-sm font-semibold truncate ${cx.heading}`}>{s.name}</p>
            {s.isActive
              ? <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/15 text-green-500 font-semibold">Activo</span>
              : s.examCount > 0
                ? <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${dm ? 'bg-white/10 text-slate-400' : 'bg-slate-100 text-slate-400'}`}>Inactivo</span>
                : <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-500 font-semibold">Sin usar</span>
            }
          </div>
          <p className={`text-[11px] truncate mt-0.5 ${cx.muted}`}>{s.email}</p>
        </div>

        {/* Stats rápidas */}
        <div className="flex items-center gap-3 shrink-0 mr-1">
          <div className="text-right">
            <p className={`text-base font-black ${scoreColor(s.avgScore)}`}>{s.avgScore !== null ? `${s.avgScore}%` : '—'}</p>
            <p className={`text-[10px] ${cx.muted}`}>media</p>
          </div>
          <div className="text-right">
            <p className={`text-base font-black ${cx.heading}`}>{s.examCount}</p>
            <p className={`text-[10px] ${cx.muted}`}>tests</p>
          </div>
        </div>

        <span className={`text-xs transition-transform ${expanded ? 'rotate-180' : ''} ${cx.muted}`}>▾</span>
      </button>

      {expanded && (
        <div className={`px-4 pb-4 pt-1 border-t ${dm ? 'border-white/5' : 'border-slate-100'}`}>
          <div className="grid grid-cols-2 gap-2 mt-2 sm:grid-cols-4">
            {[
              { label: 'Unido el',        value: fmtDate(s.joinedAt) },
              { label: 'Última actividad', value: fmtRelative(s.lastActive) },
              { label: 'Mejor nota',       value: s.bestScore !== null ? `${s.bestScore}%` : '—' },
              { label: 'Preguntas resueltas', value: s.questionsAnswered || 0 },
              { label: 'Dominadas (SRS)',  value: s.mastered || 0 },
              { label: 'Precisión',        value: s.accuracy !== null ? `${s.accuracy}%` : '—' },
            ].map(({ label, value }) => (
              <div key={label} className={`rounded-xl px-3 py-2 ${dm ? 'bg-white/5' : 'bg-slate-50'}`}>
                <p className={`text-[10px] ${cx.muted}`}>{label}</p>
                <p className={`text-sm font-bold mt-0.5 ${cx.heading}`}>{value}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PlanDetail({ plan, onBack, dm, cx }) {
  const [data, setData]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortBy, setSortBy] = useState('activity'); // activity | score | exams | joined
  const [filter, setFilter] = useState('all'); // all | active | inactive | never

  useEffect(() => {
    (async () => {
      try {
        const res = await authFetch(`/api/academy-stats?planId=${plan.id}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || `Error ${res.status}`);
        setData(json);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [plan.id]);

  const sorted = (data?.students || [])
    .filter(s => {
      if (filter === 'active')   return s.isActive;
      if (filter === 'inactive') return !s.isActive && s.examCount > 0;
      if (filter === 'never')    return s.examCount === 0;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'score')   return (b.avgScore ?? -1) - (a.avgScore ?? -1);
      if (sortBy === 'exams')   return b.examCount - a.examCount;
      if (sortBy === 'joined')  return new Date(a.joinedAt) - new Date(b.joinedAt);
      // activity (default)
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
      return new Date(b.lastActive || 0) - new Date(a.lastActive || 0);
    });

  const t = data?.totals;

  return (
    <div className="space-y-4">
      {/* Header plan */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${dm ? 'bg-white/5 text-slate-300 hover:bg-white/10' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
        >
          <Icons.ChevronLeft />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xl">{plan.cover_emoji || '📋'}</span>
            <h2 className={`font-bold text-lg truncate ${cx.heading}`}>{plan.name}</h2>
          </div>
          {plan.invite_slug && (
            <p className={`text-[11px] ${cx.muted}`}>/{plan.invite_slug}</p>
          )}
        </div>
        {plan.invite_slug && (
          <button
            onClick={() => navigator.clipboard.writeText(`${window.location.origin}/?join=${plan.invite_slug}`).catch(() => {})}
            className="px-3 py-2 rounded-xl text-xs font-semibold bg-blue-500/10 text-blue-500 hover:bg-blue-500/20"
          >
            🔗 Copiar
          </button>
        )}
      </div>

      {loading && (
        <div className="flex justify-center py-12">
          <div className="w-7 h-7 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {error && <p className="text-red-400 text-sm text-center py-8">{error}</p>}

      {!loading && !error && data && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <KpiCard label="Alumnos" value={t.total} icon="👥" color="blue" dm={dm} cx={cx}
              sub={`${t.active} activos`} />
            <KpiCard label="Activos 30d" value={t.active} icon="🟢" color="green" dm={dm} cx={cx}
              sub={t.total > 0 ? `${Math.round((t.active/t.total)*100)}% del total` : undefined} />
            <KpiCard label="Sin usar" value={t.neverUsed} icon="😴" color="amber" dm={dm} cx={cx}
              sub="nunca hicieron un test" />
            <KpiCard label="Tests realizados" value={t.totalExams} icon="📝" color="purple" dm={dm} cx={cx}
              sub={t.total > 0 ? `≈ ${Math.round(t.totalExams / Math.max(t.total,1))} por alumno` : undefined} />
            <KpiCard label="Nota media" value={t.globalAvg !== null ? `${t.globalAvg}%` : '—'} icon="🎯"
              color={t.globalAvg >= 70 ? 'green' : t.globalAvg >= 50 ? 'amber' : 'red'} dm={dm} cx={cx} />
            <KpiCard label="Inactivos" value={t.inactive} icon="💤" color="red" dm={dm} cx={cx}
              sub="se unieron pero no repiten" />
          </div>

          {/* Controles */}
          {data.students.length > 0 && (
            <div className="space-y-2">
              {/* Filtros */}
              <div className="flex gap-1.5 flex-wrap">
                {[
                  { v: 'all',      label: `Todos (${t.total})` },
                  { v: 'active',   label: `Activos (${t.active})` },
                  { v: 'inactive', label: `Inactivos (${t.inactive})` },
                  { v: 'never',    label: `Sin usar (${t.neverUsed})` },
                ].map(({ v, label }) => (
                  <button key={v} onClick={() => setFilter(v)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                      filter === v
                        ? 'bg-blue-500 text-white'
                        : dm ? 'bg-white/5 text-slate-400 hover:bg-white/10' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                  >{label}</button>
                ))}
              </div>

              {/* Ordenar */}
              <div className="flex items-center gap-2">
                <span className={`text-[11px] ${cx.muted}`}>Ordenar:</span>
                {[
                  { v: 'activity', label: 'Actividad' },
                  { v: 'score',    label: 'Nota' },
                  { v: 'exams',    label: 'Tests' },
                  { v: 'joined',   label: 'Alta' },
                ].map(({ v, label }) => (
                  <button key={v} onClick={() => setSortBy(v)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                      sortBy === v
                        ? dm ? 'bg-white/20 text-white' : 'bg-slate-700 text-white'
                        : dm ? 'bg-white/5 text-slate-400' : 'bg-slate-100 text-slate-500'
                    }`}
                  >{label}</button>
                ))}
              </div>
            </div>
          )}

          {/* Lista de alumnos */}
          {sorted.length === 0 ? (
            <div className={`rounded-2xl p-8 text-center ${dm ? 'bg-white/5' : 'bg-slate-50'}`}>
              <p className={`text-sm ${cx.muted}`}>
                {t.total === 0
                  ? 'Ningún alumno se ha unido todavía.'
                  : 'No hay alumnos con este filtro.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {sorted.map(s => (
                <StudentRow key={s.userId} s={s} dm={dm} cx={cx} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Pantalla principal ────────────────────────────────────────────────────────
export default function AcademyStudentsScreen({ onNavigate, onSwitchTest }) {
  const { dm, cx } = useTheme();
  const [plans, setPlans]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [selectedPlan, setSelectedPlan] = useState(null);

  const fetchPlans = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res  = await authFetch('/api/manage-plans');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
      setPlans(data.plans || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPlans(); }, [fetchPlans]);

  const totalStudents = plans.reduce((s, p) => s + (p.clones || 0), 0);
  const publishedPlans = plans.filter(p => p.invite_slug).length;
  const totalExamsApprox = '—'; // no disponible sin llamada por plan

  // Navegar a plan detail
  if (selectedPlan) {
    return (
      <div className={`min-h-full ${cx.screen} transition-colors`} style={{ paddingBottom: 'var(--pb-screen)' }}>
        <div className={`sticky top-0 z-10 px-4 pb-4 ${cx.screen}`} style={{ paddingTop: 'var(--pt-header)' }}>
          <div className="max-w-lg mx-auto">
            <h1 className={`font-bold text-xl ${cx.heading}`} style={{ fontFamily: 'Sora, system-ui' }}>Alumnos</h1>
          </div>
        </div>
        <div className="px-4 max-w-lg mx-auto">
          <PlanDetail plan={selectedPlan} onBack={() => setSelectedPlan(null)} dm={dm} cx={cx} />
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-full ${cx.screen} transition-colors`} style={{ paddingBottom: 'var(--pb-screen)' }}>

      {/* HEADER */}
      <div className={`sticky top-0 z-10 px-4 pb-4 ${cx.screen}`} style={{ paddingTop: 'var(--pt-header)' }}>
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <h1 className={`font-bold text-2xl ${cx.heading}`} style={{ fontFamily: 'Sora, system-ui' }}>Alumnos</h1>
          <button
            onClick={() => onNavigate('exams')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold bg-blue-500 hover:bg-blue-600 text-white transition-colors"
          >
            <Icons.Plus />
            Nuevo plan
          </button>
        </div>
      </div>

      <div className="px-4 max-w-lg mx-auto space-y-5">

        {loading && (
          <div className="flex justify-center py-16">
            <div className="w-7 h-7 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {error && (
          <div className={`rounded-2xl p-5 text-center ${cx.card}`}>
            <p className="text-red-400 text-sm">{error}</p>
            <button onClick={fetchPlans} className="mt-3 text-xs text-blue-400 underline">Reintentar</button>
          </div>
        )}

        {!loading && !error && (
          <>
            {/* RESUMEN GLOBAL */}
            <div>
              <p className={`text-xs font-bold uppercase tracking-wide mb-2 px-1 ${cx.muted}`}>Vista general</p>
              <div className="grid grid-cols-3 gap-2">
                <KpiCard label="Alumnos totales" value={totalStudents} icon="👥" color="blue" dm={dm} cx={cx} />
                <KpiCard label="Planes activos" value={`${publishedPlans}/${plans.length}`} icon="📋" color="purple" dm={dm} cx={cx} />
                <KpiCard label="Sin publicar" value={plans.length - publishedPlans} icon="🔒" color="amber" dm={dm} cx={cx} />
              </div>
            </div>

            {/* PLANES */}
            {plans.length === 0 ? (
              <div className={`rounded-2xl p-8 text-center ${cx.card}`}>
                <div className="text-4xl mb-3">📋</div>
                <p className={`font-semibold ${cx.muted}`}>Sin planes publicados todavía</p>
                <p className={`text-xs mt-1 ${cx.muted}`}>Crea y publica un plan para que tus alumnos puedan unirse</p>
                <button
                  onClick={() => onNavigate('exams')}
                  className="mt-4 px-5 py-2.5 rounded-xl bg-blue-500 text-white text-sm font-semibold"
                >
                  Ir a mis planes →
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className={`text-xs font-bold uppercase tracking-wide px-1 ${cx.muted}`}>Planes · {plans.length}</p>

                {plans.map(plan => (
                  <button
                    key={plan.id}
                    onClick={() => setSelectedPlan(plan)}
                    className={`w-full rounded-2xl p-4 text-left transition-all active:scale-[0.98] ${cx.card} border ${dm ? 'border-white/5 hover:border-white/15' : 'border-slate-100 hover:border-blue-200 hover:shadow-md'}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0 ${dm ? 'bg-white/10' : 'bg-slate-100'}`}>
                        {plan.cover_emoji || '📋'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className={`font-semibold text-sm truncate ${cx.heading}`}>{plan.name}</p>
                          {plan.invite_slug
                            ? <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/15 text-green-500 font-semibold">Publicado</span>
                            : <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${dm ? 'bg-white/10 text-slate-400' : 'bg-slate-100 text-slate-400'}`}>Sin publicar</span>
                          }
                        </div>
                        <div className="flex items-center gap-3 mt-1.5">
                          <span className={`text-xs font-bold ${plan.clones > 0 ? 'text-blue-500' : cx.muted}`}>
                            👥 {plan.clones || 0} alumnos
                          </span>
                          <span className={`text-xs ${cx.muted}`}>{plan.totalThemes || 0} temas</span>
                          <span className={`text-xs ${cx.muted}`}>{plan.totalQuestions || 0} preg.</span>
                        </div>
                      </div>
                      <span className={`text-sm ${cx.muted}`}>→</span>
                    </div>

                    {plan.invite_slug && (
                      <p className={`mt-2 text-[10px] font-mono truncate ${dm ? 'text-blue-400/50' : 'text-blue-400/70'}`}>
                        /?join={plan.invite_slug}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
