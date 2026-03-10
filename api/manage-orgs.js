/**
 * manage-orgs — Gestión de organizaciones y roles de usuarios (solo super_admin)
 * GET /api/manage-orgs?type=orgs    → lista orgs
 * GET /api/manage-orgs?type=users   → lista usuarios con role y org
 * POST /api/manage-orgs { action: 'create_org', name, slug, cover_emoji, ownerId }
 * POST /api/manage-orgs { action: 'set_role', userId, role, organizationId? }
 */

import { createClient } from '@supabase/supabase-js';
import { verifyRole } from './_roleHelper.js';

export default async function handler(req, res) {
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SERVICE_ROLE_KEY_SUPABASE
  );

  const { user, role, error: roleError } = await verifyRole(req, supabase, 'super_admin');
  if (roleError === 'No token') return res.status(401).json({ error: 'No token' });
  if (roleError === 'Invalid token') return res.status(401).json({ error: 'Token inválido' });
  if (roleError) return res.status(403).json({ error: 'Solo super_admin puede gestionar orgs y roles' });

  if (req.method === 'GET') {
    const type = req.query.type || 'orgs';

    if (type === 'orgs') {
      const { data, error } = await supabase
        .from('organizations')
        .select('*, owner:users!owner_id(email, name)')
        .order('created_at', { ascending: false });
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ orgs: data || [] });
    }

    if (type === 'users') {
      const { data, error } = await supabase
        .from('users')
        .select('id, email, name, role, organization_id, created_at, organizations(name)')
        .order('created_at', { ascending: false });
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ users: data || [] });
    }

    return res.status(400).json({ error: 'type debe ser orgs o users' });
  }

  if (req.method === 'POST') {
    const { action } = req.body;

    if (action === 'create_org') {
      const { name, slug, cover_emoji, ownerId } = req.body;
      if (!name || !slug) return res.status(400).json({ error: 'name y slug requeridos' });
      if (!/^[a-z0-9-]+$/.test(slug)) return res.status(400).json({ error: 'Slug inválido' });

      const { data: org, error } = await supabase
        .from('organizations')
        .insert({ name, slug, cover_emoji: cover_emoji || '🏫', owner_id: ownerId || null })
        .select()
        .single();

      if (error) return res.status(500).json({ error: error.message });

      // Si hay ownerId, promoverlo a org_admin
      if (ownerId) {
        await supabase.from('users').update({ role: 'org_admin', organization_id: org.id }).eq('id', ownerId);
      }

      return res.status(200).json({ org });
    }

    if (action === 'set_role') {
      const { userId, role: newRole, organizationId } = req.body;
      if (!userId || !newRole) return res.status(400).json({ error: 'userId y role requeridos' });
      if (!['user', 'org_admin', 'super_admin'].includes(newRole)) return res.status(400).json({ error: 'Role inválido' });

      const updates = { role: newRole };
      if (organizationId !== undefined) updates.organization_id = organizationId || null;

      const { error } = await supabase.from('users').update(updates).eq('id', userId);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: 'action desconocida' });
  }

  return res.status(405).end();
}
