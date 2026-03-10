/**
 * manage-plans — CRUD planes oficiales
 * GET    → lista planes del admin (org_admin ve solo los suyos, super_admin ve todos)
 * POST   → publicar test como plan oficial { testId, slug, description, cover_emoji }
 * DELETE ?id=... → despublicar plan
 */

import { createClient } from '@supabase/supabase-js';
import { verifyRole } from './_roleHelper.js';

export default async function handler(req, res) {
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SERVICE_ROLE_KEY_SUPABASE
  );

  const { user, role, error: roleError } = await verifyRole(req, supabase, 'user');
  if (roleError === 'No token') return res.status(401).json({ error: 'No token' });
  if (roleError === 'Invalid token') return res.status(401).json({ error: 'Token inválido' });
  if (roleError) return res.status(403).json({ error: 'Forbidden' });

  // ─── GET: lista planes oficiales ───────────────────────────
  if (req.method === 'GET') {
    let query = supabase
      .from('tests')
      .select('id, name, description, cover_emoji, invite_slug, created_at, user_id')
      .eq('is_official', true)
      .order('created_at', { ascending: false });

    // super_admin ve todos; cualquier otro rol solo ve sus propios planes
    if (role !== 'super_admin') {
      query = query.eq('user_id', user.id);
    }

    const { data: plans, error } = await query;
    if (error) return res.status(500).json({ error: error.message });

    const enriched = await Promise.all((plans || []).map(async (plan) => {
      const [clonesRes, themesRes] = await Promise.all([
        supabase.from('tests').select('*', { count: 'exact', head: true }).eq('cloned_from', plan.id),
        supabase.from('themes').select('id').eq('test_id', plan.id),
      ]);
      const themeIds = (themesRes.data || []).map(t => t.id);
      let totalQuestions = 0;
      if (themeIds.length > 0) {
        const { count } = await supabase
          .from('questions')
          .select('*', { count: 'exact', head: true })
          .in('theme_id', themeIds);
        totalQuestions = count || 0;
      }
      return { ...plan, clones: clonesRes.count || 0, totalThemes: themeIds.length, totalQuestions };
    }));

    return res.status(200).json({ plans: enriched });
  }

  // ─── POST: publicar test como plan oficial ─────────────────
  if (req.method === 'POST') {
    const { testId, slug, description, cover_emoji } = req.body;
    if (!testId || !slug) return res.status(400).json({ error: 'testId y slug son requeridos' });
    if (!/^[a-z0-9-]+$/.test(slug)) return res.status(400).json({ error: 'Slug inválido' });

    const { data: test, error: testError } = await supabase
      .from('tests')
      .select('id, user_id')
      .eq('id', testId)
      .single();

    if (testError || !test) return res.status(404).json({ error: 'Test no encontrado' });
    if (test.user_id !== user.id) return res.status(403).json({ error: 'No eres el propietario de este test' });

    const { error: updateError } = await supabase
      .from('tests')
      .update({ is_official: true, invite_slug: slug, description: description || null, cover_emoji: cover_emoji || '📋' })
      .eq('id', testId);

    if (updateError) return res.status(500).json({ error: updateError.message });
    return res.status(200).json({ success: true, slug });
  }

  // ─── DELETE: despublicar plan ───────────────────────────────
  if (req.method === 'DELETE') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'id requerido' });

    // Verificar propiedad si es org_admin
    if (role === 'org_admin') {
      const { data: test } = await supabase.from('tests').select('user_id').eq('id', id).single();
      if (!test || test.user_id !== user.id) return res.status(403).json({ error: 'No autorizado' });
    }

    const { error } = await supabase
      .from('tests')
      .update({ is_official: false, invite_slug: null })
      .eq('id', id);

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  return res.status(405).end();
}
