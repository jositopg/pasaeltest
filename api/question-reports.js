/**
 * question-reports — Panel de admin para ver y gestionar reportes de preguntas
 * GET    → lista reportes pendientes con info de la pregunta y usuario
 * POST   → { reportId, action: 'apply' | 'dismiss' }
 *           apply: aplica el fix sugerido por la IA a la pregunta
 *           dismiss: descarta el reporte
 */

import { createClient } from '@supabase/supabase-js';

async function verifyAdmin(req, supabase) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return null;
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  const adminEmails = (process.env.ADMIN_EMAILS || 'josedlp7@gmail.com').split(',').map(e => e.trim().toLowerCase());
  if (!adminEmails.includes(user.email?.toLowerCase())) return null;
  return user;
}

export default async function handler(req, res) {
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SERVICE_ROLE_KEY_SUPABASE
  );

  const admin = await verifyAdmin(req, supabase);
  if (!admin) return res.status(403).json({ error: 'Forbidden' });

  // ─── GET: listar reportes ───────────────────────────────────
  if (req.method === 'GET') {
    const { status = 'pending' } = req.query;

    const { data: reports, error } = await supabase
      .from('question_reports')
      .select('id, question_id, user_id, user_comment, ai_review, ai_suggested_fix, status, created_at, question_snapshot')
      .eq('status', status)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) return res.status(500).json({ error: error.message });

    // Enriquecer con datos actuales de pregunta y usuario
    const enriched = await Promise.all((reports || []).map(async (r) => {
      const [qRes, uRes] = await Promise.all([
        supabase.from('questions').select('text, options, correct_answer, explanation, difficulty').eq('id', r.question_id).single(),
        supabase.from('users').select('email, name').eq('id', r.user_id).single(),
      ]);
      return {
        ...r,
        question: qRes.data || null,
        user: uRes.data || null,
      };
    }));

    return res.status(200).json({ reports: enriched });
  }

  // ─── POST: apply o dismiss ──────────────────────────────────
  if (req.method === 'POST') {
    const { reportId, action } = req.body;
    if (!reportId || !['apply', 'dismiss'].includes(action)) {
      return res.status(400).json({ error: 'reportId y action (apply|dismiss) requeridos' });
    }

    // Obtener el reporte
    const { data: report, error: rErr } = await supabase
      .from('question_reports')
      .select('*')
      .eq('id', reportId)
      .single();

    if (rErr || !report) return res.status(404).json({ error: 'Reporte no encontrado' });

    if (action === 'dismiss') {
      await supabase.from('question_reports').update({ status: 'dismissed' }).eq('id', reportId);
      return res.status(200).json({ success: true });
    }

    // action === 'apply'
    const fix = report.ai_suggested_fix;
    if (!fix) return res.status(400).json({ error: 'No hay fix sugerido para aplicar' });

    const updates = {};
    if (fix.text) updates.text = fix.text;
    if (fix.correct_answer !== null && fix.correct_answer !== undefined) updates.correct_answer = fix.correct_answer;
    if (fix.explanation) updates.explanation = fix.explanation;

    if (Object.keys(updates).length > 0) {
      const { error: qErr } = await supabase
        .from('questions')
        .update(updates)
        .eq('id', report.question_id);

      if (qErr) return res.status(500).json({ error: qErr.message });
    }

    await supabase.from('question_reports').update({ status: 'applied' }).eq('id', reportId);
    return res.status(200).json({ success: true });
  }

  return res.status(405).end();
}
