/**
 * Serverless function para scraping de URLs
 * Extrae texto de páginas HTML estáticas (Wikipedia, BOE, docs oficiales, etc.)
 * NO funciona con páginas que requieren JavaScript (SPAs)
 */

import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verificar autenticación
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SERVICE_ROLE_KEY_SUPABASE
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'Token inválido' });

  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL requerida' });
  }

  // Validar URL
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return res.status(400).json({ error: 'URL inválida' });
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return res.status(400).json({ error: 'Solo se permiten URLs http/https' });
  }

  // Bloquear IPs privadas/internas (SSRF protection)
  const hostname = parsed.hostname.toLowerCase();
  const isPrivate =
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.startsWith('192.168.') ||
    hostname.startsWith('10.') ||
    hostname.startsWith('172.16.') ||
    hostname.startsWith('172.17.') ||
    hostname.startsWith('172.18.') ||
    hostname.startsWith('172.19.') ||
    hostname.startsWith('172.2') ||
    hostname.startsWith('172.30.') ||
    hostname.startsWith('172.31.') ||
    hostname.startsWith('169.254.') || // link-local / cloud metadata
    hostname === '0.0.0.0' ||
    hostname.endsWith('.local');
  if (isPrivate) {
    return res.status(400).json({ error: 'URL no permitida' });
  }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; PasaElTest/1.0; +https://pasaeltest.com)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      return res.status(response.status).json({
        error: `Error al acceder a la URL: HTTP ${response.status}`
      });
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('text/plain')) {
      return res.status(422).json({ error: 'La URL no devuelve contenido de texto/HTML' });
    }

    const html = await response.text();

    // Extraer texto: eliminar scripts, estilos y tags HTML
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, ' ')
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, ' ')
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#\d+;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 80000);

    if (text.length < 100) {
      return res.status(422).json({ error: 'Contenido insuficiente en la página' });
    }

    return res.status(200).json({ content: text, url });

  } catch (error) {
    console.error('Error scraping URL:', error);

    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      return res.status(408).json({ error: 'Tiempo de espera agotado al acceder a la URL' });
    }

    return res.status(500).json({ error: error.message || 'Error al obtener la URL' });
  }
}
