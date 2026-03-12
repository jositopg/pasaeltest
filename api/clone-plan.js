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

  const originalThemeIds = themes.map(t => t.id);

  // Helper: paginar cualquier tabla sin límite de filas
  const fetchAllRows = async (table, selectFields, filterField, filterValues, pageSize = 1000) => {
    let all = [];
    let page = 0;
    // Procesar en grupos de filterValues para evitar URLs demasiado largas con IN()
    const GROUP = 100;
    for (let g = 0; g < filterValues.length; g += GROUP) {
      const group = filterValues.slice(g, g + GROUP);
      page = 0;
      while (true) {
        const from = page * pageSize;
        const to = from + pageSize - 1;
        const { data: batch, error } = await supabase
          .from(table)
          .select(selectFields)
          .in(filterField, group)
          .range(from, to);
        if (error || !batch || batch.length === 0) break;
        all = all.concat(batch);
        if (batch.length < pageSize) break;
        page++;
      }
    }
    return all;
  };

  // 7. Clonar preguntas (ligeras ~300 bytes c/u → page grande)
  let totalQuestionsCloned = 0;
  const allQuestions = await fetchAllRows(
    'questions',
    'theme_id, text, options, correct_answer, difficulty, explanation',
    'theme_id',
    originalThemeIds,
    1000
  );

  if (allQuestions.length > 0) {
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
      };
    }).filter(q => q.theme_id);

    const Q_BATCH = 500;
    for (let i = 0; i < questionsToInsert.length; i += Q_BATCH) {
      const chunk = questionsToInsert.slice(i, i + Q_BATCH);
      const { error: qError } = await supabase.from('questions').insert(chunk);
      if (!qError) totalQuestionsCloned += chunk.length;
    }
  }

  // 8. Clonar documentos (repositorios)
  // PAGE_SIZE=50: processed_content puede ser ~100KB por documento → ~5MB/página, seguro
  let totalDocsCloned = 0;
  const allDocs = await fetchAllRows(
    'documents',
    'theme_id, type, content, file_name, processed_content, search_results',
    'theme_id',
    originalThemeIds,
    50
  );

  if (allDocs.length > 0) {
    const docsToInsert = allDocs.map(d => {
      const themeNumber = originalThemeIdToNumber[d.theme_id];
      const newThemeId = themeNumberToNewId[themeNumber];
      return {
        theme_id: newThemeId,
        type: d.type,
        content: d.content,
        file_name: d.file_name,
        processed_content: d.processed_content,
        search_results: d.search_results,
      };
    }).filter(d => d.theme_id);

    const D_BATCH = 20;
    for (let i = 0; i < docsToInsert.length; i += D_BATCH) {
      const chunk = docsToInsert.slice(i, i + D_BATCH);
      const { error: dError } = await supabase.from('documents').insert(chunk);
      if (!dError) totalDocsCloned += chunk.length;
    }
  }

  return res.status(200).json({
    testId: newTest.id,
    themesCreated: newThemes?.length || 0,
    questionsCloned: totalQuestionsCloned,
    documentsCloned: totalDocsCloned,
  });
}
