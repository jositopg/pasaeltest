/**
 * Función Serverless para Google Gemini con CACHÉ
 *
 * Sistema de caché inteligente:
 * - Guarda respuestas en Supabase
 * - Reduce llamadas a Gemini en 70-80%
 * - Respuestas instantáneas para contenido repetido
 * - Ahorra cuota y dinero
 */

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// Timeouts para evitar que la función de Vercel muera con 503
const GEMINI_TIMEOUT_MS  = 50_000; // 50s — Vercel mata la función a los 60s
const SUPABASE_TIMEOUT_MS = 5_000; // 5s  — si Supabase está lento, skip

/**
 * Promesa con timeout. Si la promesa tarda más de ms milisegundos, rechaza.
 */
function withTimeout(promise, ms, label = 'operación') {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`Timeout en ${label} (${ms}ms)`)), ms)
  );
  return Promise.race([promise, timeout]);
}

export default async function handler(req, res) {
  // Solo permitir POST
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed',
      message: 'Solo se permiten peticiones POST'
    });
  }

  // Leer token si existe (guests no tienen sesión Supabase)
  const token = req.headers.authorization?.split(' ')[1];

  try {
    // 1. Leer datos del frontend
    const {
      prompt,
      maxTokens = 4096,
      useCache: useCacheParam = true,
      callType = 'generate', // 'questions' | 'repo' | 'search' | 'generate'
    } = req.body;

    // Repos nunca se cachean — el contenido debe ser siempre fresco y extenso
    const useCache = callType === 'repo' ? false : useCacheParam;

    // 2. Validar prompt
    if (!prompt || prompt.trim().length === 0) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'El prompt no puede estar vacío'
      });
    }

    // 6. Validar API key de Gemini (antes de Supabase para fallar rápido)
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error('❌ GEMINI_API_KEY no configurada en Vercel');
      return res.status(500).json({
        error: 'Server configuration error',
        message: 'API key de Gemini no configurada'
      });
    }

    // 3. Crear hash del prompt para buscar en caché
    const promptHash = crypto
      .createHash('sha256')
      .update(prompt.trim().toLowerCase())
      .digest('hex');

    console.log(`🔍 Prompt hash: ${promptHash.substring(0, 16)}...`);

    // 4. Inicializar Supabase (para auth + caché)
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.SERVICE_ROLE_KEY_SUPABASE
    );

    // Validar token solo si fue enviado — con timeout para no bloquear si Supabase está lento
    if (token) {
      try {
        const { data: { user }, error: authError } = await withTimeout(
          supabase.auth.getUser(token),
          SUPABASE_TIMEOUT_MS,
          'auth'
        );
        if (authError || !user) return res.status(401).json({ error: 'Token inválido' });
      } catch (authErr) {
        // Si Supabase está caído/lento, dejamos pasar (mejor UX que un 503)
        console.warn('⚠️ Auth check skipped:', authErr.message);
      }
    }

    // 5. BUSCAR EN CACHÉ si está habilitado — con timeout
    if (useCache) {
      console.log('💾 Buscando en caché...');
      try {
        const { data: cached, error: cacheError } = await withTimeout(
          supabase.from('ai_cache').select('*').eq('prompt_hash', promptHash).single(),
          SUPABASE_TIMEOUT_MS,
          'cache-read'
        );

        if (cached && !cacheError) {
          console.log('✅ ¡Respuesta encontrada en caché!');
          supabase.from('ai_cache').update({ used_count: cached.used_count + 1, last_used_at: new Date().toISOString() }).eq('id', cached.id).then(() => {}).catch(() => {});
          supabase.from('api_usage').insert({ call_type: callType, cached: true, model: 'gemini-2.5-flash' }).then(() => {}).catch(() => {});
          return res.status(200).json({ ...cached.response, _fromCache: true, _cacheHits: cached.used_count + 1 });
        }
      } catch (cacheErr) {
        console.warn('⚠️ Cache lookup skipped:', cacheErr.message);
      }

      console.log('❌ No encontrado en caché, llamando a Gemini...');
    }

    console.log('🤖 Llamando a Gemini...');
    console.log(`📝 Prompt (primeros 100 chars): ${prompt.substring(0, 100)}...`);
    console.log(`📊 Max Tokens: ${maxTokens}`);

    const requestBody = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, topK: 40, topP: 0.95, maxOutputTokens: maxTokens },
    };

    // 7. Intentar con modelos en orden: 2.5 Flash → 1.5 Flash
    const MODELS = ['gemini-2.5-flash', 'gemini-1.5-flash'];
    const MAX_RETRIES_PER_MODEL = 2;
    const RETRY_DELAYS = [2000, 5000]; // ms entre reintentos del mismo modelo

    let geminiResponse;
    let modelUsed;

    for (const model of MODELS) {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      let modelFailed = false;

      for (let attempt = 0; attempt <= MAX_RETRIES_PER_MODEL; attempt++) {
        const controller = new AbortController();
        const geminiTimeout = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

        try {
          geminiResponse = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
            signal: controller.signal,
          });
        } finally {
          clearTimeout(geminiTimeout);
        }

        if ((geminiResponse.status === 503 || geminiResponse.status === 429) && attempt < MAX_RETRIES_PER_MODEL) {
          const delay = RETRY_DELAYS[attempt];
          console.warn(`⚠️ ${model} ${geminiResponse.status} — reintento ${attempt + 1}/${MAX_RETRIES_PER_MODEL} en ${delay}ms`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }

        if (geminiResponse.status === 503 || geminiResponse.status === 429) {
          console.warn(`⚠️ ${model} agotado tras ${MAX_RETRIES_PER_MODEL + 1} intentos — probando modelo alternativo`);
          modelFailed = true;
        }
        break;
      }

      if (!modelFailed) {
        modelUsed = model;
        break;
      }
    }

    // 8. Verificar respuesta final
    if (!geminiResponse.ok) {
      const errorData = await geminiResponse.json();
      console.error('❌ Error de Gemini API:', errorData);

      return res.status(geminiResponse.status).json({
        error: 'Gemini API error',
        message: errorData.error?.message || 'Error en la llamada a Gemini',
        details: errorData
      });
    }

    console.log(`✅ Respuesta de ${modelUsed}`);

    // 10. Parsear respuesta
    const data = await geminiResponse.json();
    console.log('✅ Respuesta recibida de Gemini');

    // 11. Extraer el texto de la respuesta
    if (!data.candidates || data.candidates.length === 0) {
      return res.status(500).json({
        error: 'Empty response',
        message: 'Gemini no devolvió contenido'
      });
    }

    const responseText = data.candidates[0].content.parts[0].text;

    // 12. Convertir a formato compatible
    const claudeFormatResponse = {
      content: [{ type: 'text', text: responseText }]
    };

    // 13. GUARDAR EN CACHÉ si está habilitado — fire and forget con timeout implícito
    if (useCache) {
      supabase.from('ai_cache').insert({
        prompt_hash: promptHash,
        prompt: prompt.substring(0, 1000),
        response: claudeFormatResponse,
        model: modelUsed,
        used_count: 1,
        last_used_at: new Date().toISOString()
      }).then(() => console.log('✅ Guardado en caché')).catch(e => console.warn('⚠️ Cache write failed:', e.message));
    }

    // 14. Log usage asíncrono
    const tokensIn  = data.usageMetadata?.promptTokenCount     || 0;
    const tokensOut = data.usageMetadata?.candidatesTokenCount || 0;
    supabase.from('api_usage').insert({
      call_type: callType, tokens_in: tokensIn, tokens_out: tokensOut, cached: false, model: modelUsed,
    }).then(() => {}).catch(() => {});

    console.log(`✅ Respuesta lista | tokens in: ${tokensIn} out: ${tokensOut}`);

    // 15. Devolver respuesta
    return res.status(200).json({ ...claudeFormatResponse, _fromCache: false });

  } catch (error) {
    console.error('❌ Error en la función serverless:', error);

    if (error.name === 'AbortError') {
      return res.status(504).json({
        error: 'Timeout',
        message: 'La IA tardó demasiado en responder. Intenta con un prompt más corto.'
      });
    }

    return res.status(500).json({
      error: 'Server error',
      message: error.message || 'Error interno del servidor',
    });
  }
}
