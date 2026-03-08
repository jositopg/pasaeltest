/**
 * report-question — Usuario reporta un error en una pregunta durante el examen
 * POST /api/report-question
 * Body: { questionId, userComment, questionSnapshot }
 * Requiere: Authorization: Bearer <token>
 *
 * Guarda el reporte y llama a Gemini para revisarlo (fire-and-forget asíncrono)
 */

import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SERVICE_ROLE_KEY_SUPABASE
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'Token inválido' });

  const { questionId, userComment, questionSnapshot } = req.body;
  if (!questionId || !userComment?.trim()) {
    return res.status(400).json({ error: 'questionId y userComment son requeridos' });
  }

  // Guardar reporte (sin AI review de momento)
  const { data: report, error: insertError } = await supabase
    .from('question_reports')
    .insert({
      question_id: questionId,
      user_id: user.id,
      user_comment: userComment.trim(),
      question_snapshot: questionSnapshot || null,
      status: 'pending',
    })
    .select('id')
    .single();

  if (insertError) {
    return res.status(500).json({ error: insertError.message });
  }

  // Respuesta inmediata al usuario
  res.status(200).json({ success: true, reportId: report.id });

  // Revisión con IA en background (no bloquea la respuesta)
  try {
    const q = questionSnapshot;
    if (!q) return;

    const prompt = `Eres un experto en evaluación de preguntas tipo test educativas en español.

Un usuario ha reportado un posible error en la siguiente pregunta:

PREGUNTA: ${q.text}

OPCIONES:
${(q.options || []).map((opt, i) => `${i}. ${opt}`).join('\n')}

RESPUESTA MARCADA COMO CORRECTA: Opción ${q.correct_answer ?? q.correct} — "${(q.options || [])[q.correct_answer ?? q.correct]}"

EXPLICACIÓN ACTUAL: ${q.explanation || '(sin explicación)'}

COMENTARIO DEL USUARIO: "${userComment}"

Analiza si el usuario tiene razón. Responde en JSON con este formato exacto:
{
  "has_error": true/false,
  "analysis": "explicación breve de si hay error o no y por qué",
  "suggested_fix": {
    "text": "nueva redacción de la pregunta si es necesario, o null",
    "correct_answer": número de opción correcta si cambia, o null,
    "explanation": "nueva explicación si es necesario, o null"
  }
}

Solo responde con el JSON, sin markdown.`;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return;

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 1024 },
        }),
      }
    );

    if (!geminiRes.ok) return;

    const geminiData = await geminiRes.json();
    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';

    let aiResult;
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      aiResult = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    } catch { return; }

    if (!aiResult) return;

    // Actualizar reporte con la revisión de la IA
    await supabase
      .from('question_reports')
      .update({
        ai_review: aiResult.analysis,
        ai_suggested_fix: aiResult.has_error ? aiResult.suggested_fix : null,
      })
      .eq('id', report.id);

    // Log uso de API
    const tokensIn = geminiData.usageMetadata?.promptTokenCount || 0;
    const tokensOut = geminiData.usageMetadata?.candidatesTokenCount || 0;
    supabase.from('api_usage').insert({
      call_type: 'report_review',
      tokens_in: tokensIn,
      tokens_out: tokensOut,
      cached: false,
      model: 'gemini-2.5-flash',
    }).then(() => {}).catch(() => {});

  } catch (e) {
    console.error('Error en AI review:', e);
  }
}
