/**
 * clone-plan — Clona un plan oficial en la cuenta del usuario
 * POST /api/clone-plan  { slug }
 * Requiere: Authorization: Bearer <token>
 */

import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  // 1. Verificar token
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SERVICE_ROLE_KEY_SUPABASE
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'Token inválido' });

  const { slug } = req.body;
  if (!slug) return res.status(400).json({ error: 'slug requerido' });

  // 2. Obtener el plan oficial
  const { data: plan, error: planError } = await supabase
    .from('tests')
    .select('id, name, description, cover_emoji')
    .eq('invite_slug', slug)
    .eq('is_official', true)
    .single();

  if (planError || !plan) return res.status(404).json({ error: 'Plan no encontrado' });

  // 3. Prevenir doble-clone
  const { data: existing } = await supabase
    .from('tests')
    .select('id')
    .eq('user_id', user.id)
    .eq('cloned_from', plan.id)
    .maybeSingle();

  if (existing) {
    return res.status(409).json({ error: 'Ya tienes este plan', testId: existing.id });
  }

  // 4. Obtener temas del plan oficial (con preguntas)
  const { data: themes } = await supabase
    .from('themes')
    .select('id, number, name')
    .eq('test_id', plan.id)
    .order('number', { ascending: true });

  // 5. Crear nuevo test para el usuario
  const { data: newTest, error: testError } = await supabase
    .from('tests')
    .insert({
      user_id: user.id,
      name: plan.name,
      cloned_from: plan.id,
    })
    .select('id')
    .single();

  if (testError || !newTest) {
    return res.status(500).json({ error: 'Error creando test: ' + testError?.message });
  }

  if (!themes || themes.length === 0) {
    return res.status(200).json({ testId: newTest.id, themesCreated: 0, questionsCloned: 0 });
  }

  // 6. Bulk-insert temas
  const themesToInsert = themes.map(t => ({
    user_id: user.id,
    test_id: newTest.id,
    number: t.number,
    name: t.name,
  }));

  const { data: newThemes, error: themesError } = await supabase
    .from('themes')
    .insert(themesToInsert)
    .select('id, number');

  if (themesError) {
    return res.status(500).json({ error: 'Error creando temas: ' + themesError.message });
  }

  // Mapa: número de tema original → nuevo theme id
  const themeNumberToNewId = {};
  (newThemes || []).forEach(nt => { themeNumberToNewId[nt.number] = nt.id; });
  const originalThemeIdToNumber = {};
  themes.forEach(t => { originalThemeIdToNumber[t.id] = t.number; });

  // 7. Para cada tema original, obtener y clonar sus preguntas
  let totalQuestionsCloned = 0;
  const originalThemeIds = themes.map(t => t.id);

  const { data: allQuestions } = await supabase
    .from('questions')
    .select('theme_id, text, options, correct_answer, difficulty, explanation')
    .in('theme_id', originalThemeIds);

  if (allQuestions && allQuestions.length > 0) {
    const questionsToInsert = allQuestions.map(q => {
      const themeNumber = originalThemeIdToNumber[q.theme_id];
      const newThemeId = themeNumberToNewId[themeNumber];
      return {
        theme_id: newThemeId,
        text: q.text,
        options: q.options,
        correct_answer: q.correct_answer,
        difficulty: q.difficulty,
        explanation: q.explanation,
        // SRS fields left at defaults
      };
    }).filter(q => q.theme_id); // por si hay algún tema sin mapear

    if (questionsToInsert.length > 0) {
      const { error: qError } = await supabase
        .from('questions')
        .insert(questionsToInsert);
      if (!qError) totalQuestionsCloned = questionsToInsert.length;
    }
  }

  return res.status(200).json({
    testId: newTest.id,
    themesCreated: newThemes?.length || 0,
    questionsCloned: totalQuestionsCloned,
  });
}
