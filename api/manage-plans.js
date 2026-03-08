/**
 * manage-plans — CRUD planes oficiales (solo admin)
 * GET    → lista todos los planes con stats
 * POST   → publicar test como plan oficial { testId, slug, description, cover_emoji }
 * DELETE ?id=... → despublicar plan
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

  // ─── GET: lista planes oficiales ───────────────────────────
  if (req.method === 'GET') {
    const { data: plans, error } = await supabase
      .from('tests')
      .select('id, name, description, cover_emoji, invite_slug, created_at')
      .eq('is_official', true)
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });

    // Stats por plan: nº clones, temas, preguntas
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

      return {
        ...plan,
        clones: clonesRes.count || 0,
        totalThemes: themeIds.length,
        totalQuestions,
      };
    }));

    return res.status(200).json({ plans: enriched });
  }

  // ─── POST: publicar test como plan oficial ─────────────────
  if (req.method === 'POST') {
    const { testId, slug, description, cover_emoji } = req.body;
    if (!testId || !slug) return res.status(400).json({ error: 'testId y slug son requeridos' });

    // Validar slug (solo letras minúsculas, números y guiones)
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return res.status(400).json({ error: 'Slug inválido: solo letras minúsculas, números y guiones' });
    }

    // Verificar que el test pertenece al admin
    const { data: test, error: testError } = await supabase
      .from('tests')
      .select('id, user_id')
      .eq('id', testId)
      .single();

    if (testError || !test) return res.status(404).json({ error: 'Test no encontrado' });
    if (test.user_id !== admin.id) return res.status(403).json({ error: 'No eres el propietario de este test' });

    // Publicar
    const { error: updateError } = await supabase
      .from('tests')
      .update({
        is_official: true,
        invite_slug: slug,
        description: description || null,
        cover_emoji: cover_emoji || '📋',
      })
      .eq('id', testId);

    if (updateError) return res.status(500).json({ error: updateError.message });

    return res.status(200).json({ success: true, slug });
  }

  // ─── DELETE: despublicar plan ───────────────────────────────
  if (req.method === 'DELETE') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'id requerido' });

    const { error } = await supabase
      .from('tests')
      .update({ is_official: false, invite_slug: null })
      .eq('id', id);

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  return res.status(405).end();
}
