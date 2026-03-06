/**
 * Admin Stats API — Panel de control de PasaElTest
 *
 * Seguridad:
 * - Verifica el JWT de Supabase del usuario
 * - Comprueba que el email esté en ADMIN_EMAILS (var de entorno, sólo servidor)
 * - No expone datos sensibles a usuarios normales
 */

import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  // 1. Verificar token de autenticación
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SERVICE_ROLE_KEY_SUPABASE
  );

  // 2. Verificar identidad del usuario
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'Invalid token' });

  // 3. Verificar que es admin (lista de emails en var de entorno, no en VITE_)
  const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
  if (!adminEmails.length || !adminEmails.includes(user.email?.toLowerCase())) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // 4. Ejecutar todas las queries en paralelo
    const [
      usersResult,
      themesResult,
      totalQuestionsResult,
      questionsIAResult,
      questionsManualResult,
      questionsFacilResult,
      questionsMediaResult,
      questionsDificilResult,
      cacheTopResult,
      cacheTotalResult,
    ] = await Promise.all([
      supabase.from('users').select('id, email, name, created_at').order('created_at', { ascending: false }),
      supabase.from('themes').select('id, user_id'),
      supabase.from('questions').select('*', { count: 'exact', head: true }),
      supabase.from('questions').select('*', { count: 'exact', head: true }).eq('source', 'IA'),
      supabase.from('questions').select('*', { count: 'exact', head: true }).eq('source', 'Manual'),
      supabase.from('questions').select('*', { count: 'exact', head: true }).eq('difficulty', 'facil'),
      supabase.from('questions').select('*', { count: 'exact', head: true }).eq('difficulty', 'media'),
      supabase.from('questions').select('*', { count: 'exact', head: true }).eq('difficulty', 'dificil'),
      supabase.from('ai_cache').select('id, used_count, created_at').order('used_count', { ascending: false }).limit(5),
      supabase.from('ai_cache').select('*', { count: 'exact', head: true }),
    ]);

    // 5. api_usage (tabla puede no existir aún)
    let apiToday = [], apiWeek = [];
    try {
      const [td, wk] = await Promise.all([
        supabase.from('api_usage').select('call_type, tokens_in, tokens_out, cached, created_at')
          .gte('created_at', todayStart.toISOString()),
        supabase.from('api_usage').select('call_type, tokens_in, tokens_out, cached, created_at')
          .gte('created_at', weekAgo.toISOString()),
      ]);
      if (!td.error) apiToday = td.data || [];
      if (!wk.error) apiWeek = wk.data || [];
    } catch {}

    // 6. Calcular estadísticas por usuario (theme count)
    const userThemeCounts = {};
    (themesResult.data || []).forEach(t => {
      userThemeCounts[t.user_id] = (userThemeCounts[t.user_id] || 0) + 1;
    });

    const usersWithStats = (usersResult.data || []).map(u => ({
      id: u.id,
      email: u.email,
      name: u.name,
      createdAt: u.created_at,
      themeCount: userThemeCounts[u.id] || 0,
    }));

    // 7. Estadísticas de uso de API hoy
    const realCallsToday = apiToday.filter(c => !c.cached).length;
    const cacheHitsToday = apiToday.filter(c => c.cached).length;
    const tokensInToday = apiToday.reduce((s, c) => s + (c.tokens_in || 0), 0);
    const tokensOutToday = apiToday.reduce((s, c) => s + (c.tokens_out || 0), 0);

    // Calls by type today
    const callsByType = {};
    apiToday.filter(c => !c.cached).forEach(c => {
      callsByType[c.call_type] = (callsByType[c.call_type] || 0) + 1;
    });

    // 8. Trend de los últimos 7 días (agrupado por día)
    const dayMap = {};
    // Pre-fill last 7 days with 0
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      dayMap[d.toISOString().substring(0, 10)] = { real: 0, cached: 0 };
    }
    apiWeek.forEach(c => {
      const day = c.created_at.substring(0, 10);
      if (!dayMap[day]) dayMap[day] = { real: 0, cached: 0 };
      if (c.cached) dayMap[day].cached++;
      else dayMap[day].real++;
    });

    // 9. Coste estimado (paid tier: $0.15/1M in, $0.60/1M out)
    const costToday = (tokensInToday / 1_000_000) * 0.15 + (tokensOutToday / 1_000_000) * 0.60;

    // 10. Respuesta
    return res.status(200).json({
      users: usersWithStats,
      totals: {
        users: usersResult.data?.length || 0,
        themes: themesResult.data?.length || 0,
        questions: totalQuestionsResult.count || 0,
        questionsIA: questionsIAResult.count || 0,
        questionsManual: questionsManualResult.count || 0,
        byDifficulty: {
          facil: questionsFacilResult.count || 0,
          media: questionsMediaResult.count || 0,
          dificil: questionsDificilResult.count || 0,
        },
      },
      aiUsage: {
        today: {
          total: apiToday.length,
          realCalls: realCallsToday,
          cacheHits: cacheHitsToday,
          tokensIn: tokensInToday,
          tokensOut: tokensOutToday,
          costEst: Math.round(costToday * 100) / 100,
          callsByType,
          freeLimit: 250,
          usagePercent: Math.min(100, Math.round((realCallsToday / 250) * 100)),
        },
        weekByDay: dayMap,
        cache: {
          total: cacheTotalResult.count || 0,
          topHits: cacheTopResult.data || [],
        },
      },
      generatedAt: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Admin stats error:', error);
    return res.status(500).json({ error: error.message });
  }
}
