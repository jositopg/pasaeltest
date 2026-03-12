/**
 * clone-plan — Clona un plan oficial en la cuenta del usuario
 * POST /api/clone-plan  { slug }
 * Requiere: Authorization: Bearer <token>
 *
 * El clone completo (temas + preguntas + documentos) ocurre en una sola
 * transacción SQL via RPC clone_official_plan — sin round-trips, sin timeouts.
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
    .select('id, name')
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

  // 4. Clonar en una sola transacción SQL (temas + preguntas + documentos)
  const { data: newTestId, error: rpcError } = await supabase
    .rpc('clone_official_plan', {
      p_plan_id: plan.id,
      p_user_id: user.id,
    });

  if (rpcError) {
    return res.status(500).json({ error: 'Error clonando plan: ' + rpcError.message });
  }

  return res.status(200).json({ testId: newTestId });
}
