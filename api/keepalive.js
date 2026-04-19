/**
 * GET /api/keepalive
 * Cron job diario para evitar que Supabase pause el proyecto por inactividad.
 * Configurado en vercel.json como cron: "0 8 * * *" (08:00 UTC cada día).
 */
export default async function handler(req, res) {
  // Solo permite GET (seguridad básica)
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: 'Missing env vars' });
  }

  try {
    // Query mínima: SELECT 1 resultado de la tabla más pequeña
    const response = await fetch(
      `${supabaseUrl}/rest/v1/users?select=id&limit=1`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Supabase responded ${response.status}`);
    }

    const now = new Date().toISOString();
    console.log(`[keepalive] OK — ${now}`);
    return res.status(200).json({ ok: true, ts: now });
  } catch (err) {
    console.error('[keepalive] Error:', err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
