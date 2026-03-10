/**
 * Shared role verification for API endpoints
 * Roles: 'user' < 'org_admin' < 'super_admin'
 */
const ROLE_LEVEL = { user: 0, org_admin: 1, super_admin: 2 };

export async function verifyRole(req, supabase, minRole = 'org_admin') {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return { user: null, role: null, error: 'No token' };

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return { user: null, role: null, error: 'Invalid token' };

  const { data: profile } = await supabase
    .from('users')
    .select('role, organization_id')
    .eq('id', user.id)
    .single();

  const role = profile?.role || 'user';
  const orgId = profile?.organization_id || null;

  if ((ROLE_LEVEL[role] || 0) < (ROLE_LEVEL[minRole] || 1)) {
    return { user, role, orgId, error: 'Forbidden' };
  }

  return { user, role, orgId, error: null };
}
