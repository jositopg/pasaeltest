/**
 * GET /api/academy-stats?planId={uuid}
 *
 * Devuelve estadísticas detalladas de un plan oficial para el dashboard de academia:
 * - Lista de alumnos que se unieron (clonaron el plan)
 * - Por alumno: exámenes realizados, nota media, mejor nota, última actividad
 * - Totales globales del plan
 *
 * Solo accesible por el propietario del plan (academy / org_admin) o super_admin.
 */

import { createClient } from '@supabase/supabase-js';
import { verifyRole } from './_roleHelper.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SERVICE_ROLE_KEY_SUPABASE
  );

  // Requiere solo estar autenticado; la autorización real es por propiedad del plan
  const { user, role, error: roleError } = await verifyRole(req, supabase, 'user');
  if (roleError === 'No token')      return res.status(401).json({ error: 'No token' });
  if (roleError === 'Invalid token') return res.status(401).json({ error: 'Token inválido' });
  if (roleError)                     return res.status(403).json({ error: 'Forbidden' });

  const { planId } = req.query;
  if (!planId) return res.status(400).json({ error: 'planId requerido' });

  // Verificar que el plan existe y pertenece al usuario (excepto super_admin)
  const { data: plan, error: planError } = await supabase
    .from('tests')
    .select('id, name, cover_emoji, invite_slug, user_id, created_at')
    .eq('id', planId)
    .eq('is_official', true)
    .single();

  if (planError || !plan) return res.status(404).json({ error: 'Plan no encontrado' });
  if (role !== 'super_admin' && plan.user_id !== user.id) {
    return res.status(403).json({ error: 'No autorizado' });
  }

  // ── 1. Alumnos que clonaron este plan ─────────────────────────────────────
  const { data: clones, error: clonesError } = await supabase
    .from('tests')
    .select('id, user_id, created_at')
    .eq('cloned_from', planId)
    .order('created_at', { ascending: true });

  if (clonesError) return res.status(500).json({ error: clonesError.message });
  if (!clones || clones.length === 0) {
    return res.status(200).json({ plan, students: [], totals: buildTotals([]) });
  }

  const studentIds = [...new Set(clones.map(c => c.user_id))];

  // ── 2. Info de usuarios (batch) ────────────────────────────────────────────
  const { data: usersData } = await supabase
    .from('users')
    .select('id, name, email')
    .in('id', studentIds);

  const userMap = Object.fromEntries((usersData || []).map(u => [u.id, u]));

  // ── 3. Historial de exámenes de todos los alumnos (batch) ─────────────────
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: exams } = await supabase
    .from('exam_history')
    .select('user_id, score, created_at')
    .in('user_id', studentIds)
    .order('created_at', { ascending: false });

  // Agrupar exámenes por user_id
  const examsByUser = {};
  for (const exam of exams || []) {
    if (!examsByUser[exam.user_id]) examsByUser[exam.user_id] = [];
    examsByUser[exam.user_id].push(exam);
  }

  // ── 4. Stats SRS: preguntas respondidas en el plan clonado ────────────────
  // Obtener los test_ids de los clones para consultar temas/preguntas
  const cloneIds = clones.map(c => c.id);
  const { data: cloneThemes } = await supabase
    .from('themes')
    .select('id, test_id')
    .in('test_id', cloneIds);

  const themeIdsByClone = {};
  for (const t of cloneThemes || []) {
    if (!themeIdsByClone[t.test_id]) themeIdsByClone[t.test_id] = [];
    themeIdsByClone[t.test_id].push(t.id);
  }

  const allThemeIds = (cloneThemes || []).map(t => t.id);
  let questionStatsByUser = {};

  if (allThemeIds.length > 0) {
    const { data: qStats } = await supabase
      .from('questions')
      .select('theme_id, attempts, errors_count, stability')
      .in('theme_id', allThemeIds)
      .gt('attempts', 0);

    // Mapear theme_id → test_id → user_id para agrupar por alumno
    const themeToClone = {};
    for (const t of cloneThemes || []) themeToClone[t.id] = t.test_id;
    const cloneToUser = Object.fromEntries(clones.map(c => [c.id, c.user_id]));

    for (const q of qStats || []) {
      const cloneId = themeToClone[q.theme_id];
      const uid = cloneId ? cloneToUser[cloneId] : null;
      if (!uid) continue;
      if (!questionStatsByUser[uid]) questionStatsByUser[uid] = { answered: 0, errors: 0, mastered: 0 };
      questionStatsByUser[uid].answered += q.attempts || 0;
      questionStatsByUser[uid].errors   += q.errors_count || 0;
      questionStatsByUser[uid].mastered += (q.stability || 0) > 30 ? 1 : 0;
    }
  }

  // ── 5. Construir lista de alumnos ─────────────────────────────────────────
  const students = clones.map(clone => {
    const uid         = clone.user_id;
    const userInfo    = userMap[uid] || {};
    const userExams   = examsByUser[uid] || [];
    const qStats      = questionStatsByUser[uid] || { answered: 0, errors: 0, mastered: 0 };

    const examCount   = userExams.length;
    const scores      = userExams.map(e => parseFloat(e.score?.percentage) || 0);
    const avgScore    = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
    const bestScore   = scores.length > 0 ? Math.round(Math.max(...scores)) : null;
    const lastActive  = userExams[0]?.created_at || null;
    const isActive    = lastActive ? new Date(lastActive) >= new Date(thirtyDaysAgo) : false;
    const accuracy    = qStats.answered > 0
      ? Math.round(((qStats.answered - qStats.errors) / qStats.answered) * 100)
      : null;

    return {
      userId:     uid,
      name:       userInfo.name || 'Alumno',
      email:      userInfo.email || '',
      joinedAt:   clone.created_at,
      examCount,
      avgScore,
      bestScore,
      lastActive,
      isActive,
      questionsAnswered: qStats.answered,
      mastered:   qStats.mastered,
      accuracy,
    };
  });

  // Ordenar: activos primero, luego por última actividad
  students.sort((a, b) => {
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
    if (a.lastActive && b.lastActive) return new Date(b.lastActive) - new Date(a.lastActive);
    if (a.lastActive) return -1;
    if (b.lastActive) return 1;
    return new Date(b.joinedAt) - new Date(a.joinedAt);
  });

  return res.status(200).json({ plan, students, totals: buildTotals(students) });
}

function buildTotals(students) {
  const total      = students.length;
  const active     = students.filter(s => s.isActive).length;
  const inactive   = students.filter(s => !s.isActive && s.examCount > 0).length;
  const neverUsed  = students.filter(s => s.examCount === 0).length;
  const totalExams = students.reduce((s, st) => s + st.examCount, 0);
  const scores     = students.filter(s => s.avgScore !== null).map(s => s.avgScore);
  const globalAvg  = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;

  return { total, active, inactive, neverUsed, totalExams, globalAvg };
}
