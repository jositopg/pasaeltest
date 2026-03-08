/**
 * get-plan — Info pública de un plan oficial por slug
 * GET /api/get-plan?slug=gc2025
 * Sin autenticación requerida
 */

import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const { slug } = req.query;
  if (!slug) return res.status(400).json({ error: 'slug requerido' });

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SERVICE_ROLE_KEY_SUPABASE
  );

  // Obtener el plan oficial
  const { data: plan, error } = await supabase
    .from('tests')
    .select('id, name, description, cover_emoji, user_id')
    .eq('invite_slug', slug)
    .eq('is_official', true)
    .single();

  if (error || !plan) return res.status(404).json({ error: 'Plan no encontrado' });

  // Contar temas y preguntas
  const { data: themes } = await supabase
    .from('themes')
    .select('id, number, name')
    .eq('test_id', plan.id);

  const themeIds = (themes || []).map(t => t.id);

  let totalQuestions = 0;
  if (themeIds.length > 0) {
    const { count } = await supabase
      .from('questions')
      .select('*', { count: 'exact', head: true })
      .in('theme_id', themeIds);
    totalQuestions = count || 0;
  }

  const namedThemes = (themes || []).filter(t => t.name !== `Tema ${t.number}`).length;

  return res.status(200).json({
    id: plan.id,
    name: plan.name,
    description: plan.description || '',
    cover_emoji: plan.cover_emoji || '📋',
    totalThemes: themes?.length || 0,
    namedThemes,
    totalQuestions,
  });
}
