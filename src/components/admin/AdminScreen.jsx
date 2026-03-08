import React, { useState, useEffect, useCallback } from 'react';
import Icons from '../common/Icons';
import { supabase } from '../../supabaseClient';

// ─── Sub-components ───────────────────────────────────────────

function KpiCard({ label, value, sub, color = 'blue' }) {
  const colors = {
    blue: 'from-blue-500/20 to-blue-600/10 border-blue-500/30 text-blue-400',
    purple: 'from-purple-500/20 to-purple-600/10 border-purple-500/30 text-purple-400',
    green: 'from-green-500/20 to-green-600/10 border-green-500/30 text-green-400',
    orange: 'from-orange-500/20 to-orange-600/10 border-orange-500/30 text-orange-400',
  };
  return (
    <div className={`rounded-2xl p-4 bg-gradient-to-br border ${colors[color]}`}>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
    </div>
  );
}

function UsageGauge({ real, total = 250 }) {
  const pct = Math.min(100, Math.round((real / total) * 100));
  const color = pct >= 90 ? '#EF4444' : pct >= 70 ? '#F59E0B' : '#22C55E';
  const status = pct >= 90 ? '🔴 CRÍTICO' : pct >= 70 ? '🟡 ATENCIÓN' : '🟢 OK';

  return (
    <div>
      <div className="flex justify-between items-end mb-2">
        <span className="text-3xl font-bold text-white">{real}</span>
        <span className="text-gray-500 text-sm">/ {total} llamadas</span>
      </div>
      <div className="w-full h-4 bg-white/10 rounded-full overflow-hidden mb-2">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <div className="flex justify-between text-xs">
        <span style={{ color }}>{status} — {pct}% usado hoy</span>
        <span className="text-gray-500">{total - real} restantes</span>
      </div>
    </div>
  );
}

function WeekChart({ data }) {
  const entries = Object.entries(data).sort();
  const maxVal = Math.max(1, ...entries.map(([, d]) => d.real + d.cached));

  const dayLabel = (dateStr) => {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('es-ES', { weekday: 'short' }).replace('.', '');
  };

  return (
    <div className="flex items-end gap-1.5 h-28">
      {entries.map(([date, d]) => {
        const total = d.real + d.cached;
        const realH = maxVal > 0 ? (d.real / maxVal) * 100 : 0;
        const cachedH = maxVal > 0 ? (d.cached / maxVal) * 100 : 0;
        return (
          <div key={date} className="flex-1 flex flex-col items-center gap-1">
            <span className="text-[10px] text-gray-500">{total > 0 ? total : ''}</span>
            <div className="w-full flex flex-col justify-end" style={{ height: '80px' }}>
              {/* Cached (lighter) on top, real below */}
              <div className="w-full flex flex-col rounded-t overflow-hidden">
                <div style={{ height: `${cachedH}%`, background: '#4F46E5', opacity: 0.5 }} />
                <div style={{ height: `${realH}%`, background: 'linear-gradient(to top, #3B82F6, #8B5CF6)' }} />
              </div>
            </div>
            <span className="text-[10px] text-gray-500 capitalize">{dayLabel(date)}</span>
          </div>
        );
      })}
    </div>
  );
}

function formatNum(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return String(n);
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Hoy';
  if (days === 1) return 'Ayer';
  if (days < 30) return `Hace ${days} días`;
  const months = Math.floor(days / 30);
  return `Hace ${months} mes${months > 1 ? 'es' : ''}`;
}

// ─── Reportes de preguntas ────────────────────────────────────

function ReportsSection({ token }) {
  const [reports, setReports] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [actioning, setActioning] = useState(null);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/question-reports?status=${statusFilter}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setReports(data.reports || []);
    } catch {
      setReports([]);
    } finally {
      setLoading(false);
    }
  }, [token, statusFilter]);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  async function handleAction(reportId, action) {
    setActioning(reportId);
    try {
      await fetch('/api/question-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ reportId, action }),
      });
      fetchReports();
    } finally {
      setActioning(null);
    }
  }

  return (
    <div className="rounded-2xl bg-[#0F172A] border border-white/10 p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-bold text-base">🚩 Reportes de preguntas</h2>
        <div className="flex gap-1">
          {['pending', 'applied', 'dismissed'].map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors ${
                statusFilter === s ? 'bg-orange-500/30 text-orange-300' : 'bg-white/5 text-gray-500 hover:bg-white/10'
              }`}
            >
              {s === 'pending' ? 'Pendientes' : s === 'applied' ? 'Aplicados' : 'Descartados'}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="flex justify-center py-6">
          <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!loading && reports?.length === 0 && (
        <p className="text-gray-600 text-sm text-center py-4">Sin reportes {statusFilter === 'pending' ? 'pendientes' : statusFilter === 'applied' ? 'aplicados' : 'descartados'}</p>
      )}

      {!loading && reports?.length > 0 && (
        <div className="space-y-4">
          {reports.map(r => (
            <div key={r.id} className="bg-white/5 rounded-xl p-4 space-y-3">
              {/* Usuario y fecha */}
              <div className="flex justify-between items-start">
                <p className="text-xs text-gray-500">{r.user?.email || 'Usuario desconocido'} · {timeAgo(r.created_at)}</p>
                {r.status === 'pending' && !r.ai_review && (
                  <span className="text-xs text-yellow-500 animate-pulse">⏳ IA revisando...</span>
                )}
              </div>

              {/* Pregunta original */}
              <div>
                <p className="text-xs text-gray-500 mb-1">Pregunta:</p>
                <p className="text-sm text-white leading-snug">{r.question?.text || r.question_snapshot?.text || '(eliminada)'}</p>
              </div>

              {/* Comentario del usuario */}
              <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-3">
                <p className="text-xs text-orange-400 font-semibold mb-1">💬 Comentario del usuario:</p>
                <p className="text-sm text-orange-200">{r.user_comment}</p>
              </div>

              {/* Análisis de la IA */}
              {r.ai_review && (
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 space-y-2">
                  <p className="text-xs text-blue-400 font-semibold">🤖 Análisis de la IA:</p>
                  <p className="text-sm text-blue-200">{r.ai_review}</p>
                  {r.ai_suggested_fix && (
                    <div className="pt-2 border-t border-blue-500/20 space-y-1">
                      <p className="text-xs text-blue-400 font-semibold">✏️ Fix sugerido:</p>
                      {r.ai_suggested_fix.text && (
                        <p className="text-xs text-blue-300"><span className="text-blue-500">Pregunta:</span> {r.ai_suggested_fix.text}</p>
                      )}
                      {r.ai_suggested_fix.correct_answer !== null && r.ai_suggested_fix.correct_answer !== undefined && (
                        <p className="text-xs text-blue-300">
                          <span className="text-blue-500">Respuesta correcta:</span> {r.question_snapshot?.options?.[r.ai_suggested_fix.correct_answer] || `Opción ${r.ai_suggested_fix.correct_answer}`}
                        </p>
                      )}
                      {r.ai_suggested_fix.explanation && (
                        <p className="text-xs text-blue-300"><span className="text-blue-500">Explicación:</span> {r.ai_suggested_fix.explanation}</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Acciones (solo para pendientes) */}
              {r.status === 'pending' && r.ai_review && (
                <div className="flex gap-2">
                  {r.ai_suggested_fix && (
                    <button
                      onClick={() => handleAction(r.id, 'apply')}
                      disabled={actioning === r.id}
                      className="flex-1 py-2 rounded-lg bg-green-600/20 text-green-400 text-xs font-semibold hover:bg-green-600/30 transition-colors disabled:opacity-50"
                    >
                      {actioning === r.id ? '...' : '✅ Aplicar fix'}
                    </button>
                  )}
                  <button
                    onClick={() => handleAction(r.id, 'dismiss')}
                    disabled={actioning === r.id}
                    className="flex-1 py-2 rounded-lg bg-white/5 text-gray-400 text-xs font-semibold hover:bg-white/10 transition-colors disabled:opacity-50"
                  >
                    {actioning === r.id ? '...' : '🗑 Descartar'}
                  </button>
                </div>
              )}

              {r.status === 'applied' && <p className="text-xs text-green-500">✅ Fix aplicado</p>}
              {r.status === 'dismissed' && <p className="text-xs text-gray-600">🗑 Descartado</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Planes Oficiales ─────────────────────────────────────────


function PlansSection({ token, adminTests }) {
  const [plans, setPlans] = useState(null);
  const [plansLoading, setPlansLoading] = useState(true);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [publishForm, setPublishForm] = useState({ testId: '', slug: '', description: '' });
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState('');
  const [copied, setCopied] = useState(null);

  const fetchPlans = useCallback(async () => {
    setPlansLoading(true);
    try {
      const res = await fetch('/api/manage-plans', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setPlans(data.plans || []);
    } catch {
      setPlans([]);
    } finally {
      setPlansLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchPlans(); }, [fetchPlans]);

  function toSlug(str) {
    return str.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  function handleTestSelect(testId) {
    const test = adminTests.find(t => t.id === testId);
    const slug = test ? toSlug(test.name) : '';
    setPublishForm(f => ({ ...f, testId, slug }));
  }

  async function handlePublish() {
    setPublishError('');
    if (!publishForm.testId || !publishForm.slug) {
      setPublishError('Selecciona un test y escribe un slug.');
      return;
    }
    setPublishing(true);
    try {
      const res = await fetch('/api/manage-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ cover_emoji: '📋', ...publishForm }),
      });
      const data = await res.json();
      if (!res.ok) { setPublishError(data.error || `Error ${res.status}`); return; }
      setShowPublishModal(false);
      setPublishForm({ testId: '', slug: '', description: '' });
      fetchPlans();
    } catch (e) {
      setPublishError(e.message);
    } finally {
      setPublishing(false);
    }
  }

  async function handleUnpublish(id) {
    if (!confirm('¿Despublicar este plan? Los usuarios que ya lo tienen no se verán afectados.')) return;
    await fetch(`/api/manage-plans?id=${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    fetchPlans();
  }

  function copyLink(slug) {
    const url = `${window.location.origin}/?join=${slug}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(slug);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  return (
    <div className="rounded-2xl bg-[#0F172A] border border-white/10 p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-bold text-base">📋 Planes Oficiales</h2>
        <button
          onClick={() => setShowPublishModal(true)}
          className="text-xs px-3 py-1.5 rounded-lg bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 transition-colors font-medium"
        >
          + Publicar
        </button>
      </div>

      {plansLoading && (
        <div className="flex justify-center py-6">
          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!plansLoading && plans?.length === 0 && (
        <p className="text-gray-600 text-sm text-center py-4">No hay planes publicados</p>
      )}

      {!plansLoading && plans?.length > 0 && (
        <div className="space-y-3">
          {plans.map(plan => (
            <div key={plan.id} className="bg-white/5 rounded-xl p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-2xl shrink-0">{plan.cover_emoji}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{plan.name}</p>
                    <p className="text-xs text-gray-500">{plan.invite_slug} · {plan.totalThemes} temas · {plan.totalQuestions} preguntas · {plan.clones} clones</p>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => copyLink(plan.invite_slug)}
                  className="flex-1 py-1.5 rounded-lg bg-blue-600/20 text-blue-400 text-xs font-medium hover:bg-blue-600/30 transition-colors"
                >
                  {copied === plan.invite_slug ? '✅ Copiado' : '🔗 Copiar enlace'}
                </button>
                <button
                  onClick={() => handleUnpublish(plan.id)}
                  className="flex-1 py-1.5 rounded-lg bg-red-600/10 text-red-400 text-xs font-medium hover:bg-red-600/20 transition-colors"
                >
                  🗑 Despublicar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Publicar */}
      {showPublishModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-[#0F172A] border border-white/10 rounded-3xl p-6 space-y-4 overflow-y-auto max-h-[90vh]">
            <h3 className="font-bold text-lg text-white">Publicar Plan Oficial</h3>

            {/* Test selector */}
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Test a publicar</label>
              <select
                value={publishForm.testId}
                onChange={e => handleTestSelect(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none"
              >
                <option value="">Seleccionar test...</option>
                {adminTests.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            {/* Slug */}
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Slug (código del enlace)</label>
              <input
                type="text"
                value={publishForm.slug}
                onChange={e => setPublishForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
                placeholder="guardia-civil-2025"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm placeholder-gray-600 focus:outline-none"
              />
              {publishForm.slug && (
                <p className="text-xs text-gray-600 mt-1">
                  Enlace: {window.location.origin}/?join={publishForm.slug}
                </p>
              )}
            </div>

            {/* Descripción */}
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Descripción (opcional)</label>
              <textarea
                value={publishForm.description}
                onChange={e => setPublishForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Descripción breve del plan..."
                rows={2}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm placeholder-gray-600 focus:outline-none resize-none"
              />
            </div>

            {publishError && (
              <p className="text-red-400 text-xs">{publishError}</p>
            )}

            <div className="flex gap-3 pt-1">
              <button
                onClick={() => { setShowPublishModal(false); setPublishError(''); }}
                className="flex-1 py-3 rounded-xl bg-white/5 text-gray-400 text-sm font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={handlePublish}
                disabled={publishing}
                className="flex-1 py-3 rounded-xl bg-blue-600 text-white text-sm font-semibold disabled:opacity-60"
              >
                {publishing ? 'Publicando...' : 'Publicar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main AdminScreen ─────────────────────────────────────────

export default function AdminScreen({ onNavigate }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [adminToken, setAdminToken] = useState(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Sin sesión activa');

      setAdminToken(session.access_token);

      const res = await fetch('/api/admin-stats', {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });

      if (res.status === 403) throw new Error('No tienes permisos de administrador.');
      if (!res.ok) throw new Error(`Error ${res.status}: ${await res.text()}`);

      setStats(await res.json());
      setLastUpdated(new Date());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  // ─── Render ────────────────────────────────────────────────
  return (
    <div className="min-h-full bg-[#050810] text-white" style={{ paddingBottom: 'var(--pb-screen)' }}>

      {/* HEADER */}
      <div className="sticky top-0 z-10 bg-[#050810]/95 backdrop-blur-sm px-4 pb-4 border-b border-white/5" style={{ paddingTop: 'var(--pt-header)' }}>
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <div className="flex items-center gap-3">
            <button
              onClick={() => onNavigate('home')}
              className="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center"
            >
              <Icons.ChevronLeft />
            </button>
            <div>
              <h1 className="font-bold text-xl">Panel de Control</h1>
              {lastUpdated && (
                <p className="text-xs text-gray-500">
                  Actualizado: {lastUpdated.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={fetchStats}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-sm transition-colors disabled:opacity-50"
          >
            <span className={loading ? 'animate-spin inline-block' : ''}>🔄</span>
            {loading ? 'Cargando...' : 'Actualizar'}
          </button>
        </div>
      </div>

      {error && (
        <div className="max-w-2xl mx-auto px-4 pt-6">
          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 text-red-400 text-sm">
            ❌ {error}
          </div>
        </div>
      )}

      {loading && !stats && (
        <div className="flex items-center justify-center h-64 text-gray-500">
          <div className="text-center space-y-3">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm">Cargando estadísticas...</p>
          </div>
        </div>
      )}

      {stats && (
        <div className="max-w-2xl mx-auto px-4 pt-6 space-y-6">

          {/* KPI CARDS */}
          <div className="grid grid-cols-2 gap-3">
            <KpiCard label="Usuarios" value={stats.totals.users} color="blue" />
            <KpiCard label="Temas" value={formatNum(stats.totals.themes)} color="purple" />
            <KpiCard
              label="Preguntas"
              value={formatNum(stats.totals.questions)}
              sub={`IA: ${formatNum(stats.totals.questionsIA)} · Manual: ${formatNum(stats.totals.questionsManual)}`}
              color="green"
            />
            <KpiCard
              label="Cache hits"
              value={formatNum(stats.aiUsage.cache.total)}
              sub="respuestas reutilizadas"
              color="orange"
            />
          </div>

          {/* GEMINI USAGE HOY */}
          <div className="rounded-2xl bg-[#0F172A] border border-white/10 p-5 space-y-5">
            <h2 className="font-bold text-base flex items-center gap-2">
              🤖 Gemini — Uso Hoy
              <span className="text-xs text-gray-500 font-normal">(límite gratuito: 250 llamadas/día)</span>
            </h2>

            <UsageGauge real={stats.aiUsage.today.realCalls} total={250} />

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-white/5 rounded-xl p-3">
                <p className="text-gray-400 text-xs mb-1">Llamadas reales</p>
                <p className="font-bold text-white text-lg">{stats.aiUsage.today.realCalls}</p>
              </div>
              <div className="bg-white/5 rounded-xl p-3">
                <p className="text-gray-400 text-xs mb-1">Ahorradas (caché)</p>
                <p className="font-bold text-green-400 text-lg">+{stats.aiUsage.today.cacheHits}</p>
              </div>
              <div className="bg-white/5 rounded-xl p-3">
                <p className="text-gray-400 text-xs mb-1">Tokens entrada</p>
                <p className="font-bold text-white">{formatNum(stats.aiUsage.today.tokensIn)}</p>
              </div>
              <div className="bg-white/5 rounded-xl p-3">
                <p className="text-gray-400 text-xs mb-1">Tokens salida</p>
                <p className="font-bold text-white">{formatNum(stats.aiUsage.today.tokensOut)}</p>
              </div>
            </div>

            {/* Coste estimado (paid tier) */}
            <div className="bg-white/5 rounded-xl p-3 flex justify-between items-center">
              <div>
                <p className="text-xs text-gray-400">Coste estimado hoy (si pagado)</p>
                <p className="text-xs text-gray-600 mt-0.5">$0.15/1M in · $0.60/1M out</p>
              </div>
              <p className="font-bold text-white text-lg">${stats.aiUsage.today.costEst.toFixed(2)}</p>
            </div>

            {/* Calls by type */}
            {Object.keys(stats.aiUsage.today.callsByType).length > 0 && (
              <div>
                <p className="text-xs text-gray-500 mb-2">Por tipo de operación</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(stats.aiUsage.today.callsByType).map(([type, count]) => (
                    <span key={type} className="px-2.5 py-1 rounded-lg bg-white/5 text-xs font-medium text-gray-300">
                      {type}: {count}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ÚLTIMOS 7 DÍAS */}
          <div className="rounded-2xl bg-[#0F172A] border border-white/10 p-5">
            <h2 className="font-bold text-base mb-4">📊 Llamadas — Últimos 7 días</h2>
            <WeekChart data={stats.aiUsage.weekByDay} />
            <div className="flex gap-4 mt-3 text-xs text-gray-500">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-2 rounded-sm" style={{ background: 'linear-gradient(to top, #3B82F6, #8B5CF6)' }} />
                Llamadas reales
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-2 rounded-sm bg-indigo-500/50" />
                Caché (ahorradas)
              </span>
            </div>
          </div>

          {/* REPORTES DE PREGUNTAS */}
          {adminToken && <ReportsSection token={adminToken} />}

          {/* PLANES OFICIALES */}
          {adminToken && (
            <PlansSection
              token={adminToken}
              adminTests={stats.adminTests || []}
            />
          )}

          {/* USUARIOS */}
          <div className="rounded-2xl bg-[#0F172A] border border-white/10 p-5">
            <h2 className="font-bold text-base mb-4">👥 Usuarios ({stats.users.length})</h2>
            <div className="space-y-2">
              {stats.users.map(u => (
                <div key={u.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">{u.email}</p>
                    {u.name && <p className="text-xs text-gray-500 truncate">{u.name}</p>}
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-3">
                    <span className="text-xs text-gray-400">{u.themeCount} temas</span>
                    <span className="text-xs text-gray-600">{timeAgo(u.createdAt)}</span>
                  </div>
                </div>
              ))}
              {stats.users.length === 0 && (
                <p className="text-gray-600 text-sm text-center py-4">Sin usuarios registrados</p>
              )}
            </div>
          </div>

          {/* PREGUNTAS */}
          <div className="rounded-2xl bg-[#0F172A] border border-white/10 p-5">
            <h2 className="font-bold text-base mb-4">❓ Preguntas ({formatNum(stats.totals.questions)})</h2>

            {/* Source breakdown */}
            <div className="mb-4">
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>IA: {formatNum(stats.totals.questionsIA)}</span>
                <span>Manual: {formatNum(stats.totals.questionsManual)}</span>
              </div>
              <div className="w-full h-3 bg-white/10 rounded-full overflow-hidden flex">
                {stats.totals.questions > 0 && (
                  <>
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-purple-500"
                      style={{ width: `${(stats.totals.questionsIA / stats.totals.questions) * 100}%` }}
                    />
                    <div
                      className="h-full bg-green-500"
                      style={{ width: `${(stats.totals.questionsManual / stats.totals.questions) * 100}%` }}
                    />
                  </>
                )}
              </div>
            </div>

            {/* Difficulty breakdown */}
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                { label: 'Fácil', count: stats.totals.byDifficulty.facil, color: 'text-green-400' },
                { label: 'Media', count: stats.totals.byDifficulty.media, color: 'text-yellow-400' },
                { label: 'Difícil', count: stats.totals.byDifficulty.dificil, color: 'text-red-400' },
              ].map(({ label, count, color }) => (
                <div key={label} className="bg-white/5 rounded-xl p-3">
                  <p className={`font-bold text-lg ${color}`}>{formatNum(count)}</p>
                  <p className="text-xs text-gray-500">{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* CACHÉ TOP */}
          {stats.aiUsage.cache.topHits.length > 0 && (
            <div className="rounded-2xl bg-[#0F172A] border border-white/10 p-5">
              <h2 className="font-bold text-base mb-3">💾 Caché — Top reutilizaciones</h2>
              <div className="space-y-2">
                {stats.aiUsage.cache.topHits.map((entry, i) => (
                  <div key={entry.id} className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
                    <span className="text-gray-500 text-xs w-5">#{i + 1}</span>
                    <span className="text-xs text-gray-400 flex-1 mx-2">{timeAgo(entry.created_at)}</span>
                    <span className="text-xs font-bold text-green-400">{entry.used_count}x</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-600 mt-3 text-right">
                Total entradas en caché: {formatNum(stats.aiUsage.cache.total)}
              </p>
            </div>
          )}

          {/* NOTA API_USAGE */}
          {stats.aiUsage.today.total === 0 && (
            <div className="rounded-2xl bg-yellow-500/10 border border-yellow-500/30 p-4">
              <p className="text-yellow-400 text-sm font-semibold mb-1">⚠️ Sin datos de uso de API</p>
              <p className="text-yellow-400/70 text-xs">
                La tabla <code className="bg-white/10 px-1 rounded">api_usage</code> no existe o no tiene registros todavía.
                Ejecuta el SQL de migración en Supabase para activar el tracking.
              </p>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
