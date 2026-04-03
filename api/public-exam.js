/**
 * public-exam — Preguntas de un plan oficial para examen público sin autenticación
 * GET /api/public-exam?slug=gc2025
 *
 * Solo devuelve planes marcados como is_official=true.
 * Devuelve todas las preguntas para que el cliente elija cuántas usar.
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

  // Plan oficial por slug
  const { data: plan, error } = await supabase
    .from('tests')
    .select('id, name, description, cover_emoji')
    .eq('invite_slug', slug)
    .eq('is_official', true)
    .single();

  if (error || !plan) return res.status(404).json({ error: 'Plan no encontrado' });

  // Temas del plan
  const { data: themes, error: themesError } = await supabase
    .from('themes')
    .select('id, number, name')
    .eq('test_id', plan.id)
    .order('number', { ascending: true });

  if (themesError || !themes?.length) {
    return res.status(200).json({
      name: plan.name,
      cover_emoji: plan.cover_emoji || '📋',
      description: plan.description || '',
      themes: [],
      totalQuestions: 0,
    });
  }

  // Todas las preguntas de todos los temas
  const themeIds = themes.map(t => t.id);
  const { data: questions, error: qError } = await supabase
    .from('questions')
    .select('id, theme_id, text, options, correct_answer, difficulty, explanation')
    .in('theme_id', themeIds);

  if (qError) return res.status(500).json({ error: 'Error cargando preguntas' });

  // Agrupar por tema
  const qByTheme = {};
  (questions || []).forEach(q => {
    if (!qByTheme[q.theme_id]) qByTheme[q.theme_id] = [];
    qByTheme[q.theme_id].push({
      id: q.id,
      text: q.text,
      options: q.options,
      correct: q.correct_answer,
      difficulty: q.difficulty,
      explanation: q.explanation || '',
    });
  });

  const themesWithQ = themes
    .map(t => ({
      id: t.id,
      name: t.name,
      number: t.number,
      questions: qByTheme[t.id] || [],
    }))
    .filter(t => t.questions.length > 0);

  return res.status(200).json({
    name: plan.name,
    cover_emoji: plan.cover_emoji || '📋',
    description: plan.description || '',
    themes: themesWithQ,
    totalQuestions: (questions || []).length,
  });
}
