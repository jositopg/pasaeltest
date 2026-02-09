/**
 * Función Serverless para Google Gemini Flash
 * 
 * GRATIS: 1,500 peticiones/día, 1M tokens/mes
 * Modelo: gemini-1.5-flash
 * 
 * Ventajas vs Claude:
 * - ✅ Gratis (dentro de límites generosos)
 * - ✅ Muy rápido (1-2 segundos)
 * - ✅ Buena calidad para preguntas
 * - ✅ 40x más barato si excedes límite gratis
 */

export default async function handler(req, res) {
  // Solo permitir POST
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: 'Solo se permiten peticiones POST' 
    });
  }

  try {
    // 1. Leer datos del frontend
    const { 
      prompt,           // El prompt completo
      maxTokens = 4096  // Tokens máximos
    } = req.body;

    // 2. Validar prompt
    if (!prompt || prompt.trim().length === 0) {
      return res.status(400).json({ 
        error: 'Bad request',
        message: 'El prompt no puede estar vacío' 
      });
    }

    // 3. Validar API key
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error('❌ GEMINI_API_KEY no configurada en Vercel');
      return res.status(500).json({ 
        error: 'Server configuration error',
        message: 'API key de Gemini no configurada' 
      });
    }

    console.log('🤖 Llamando a Gemini Flash...');
    console.log(`📝 Prompt (primeros 100 chars): ${prompt.substring(0, 100)}...`);
    console.log(`📊 Max Tokens: ${maxTokens}`);

    // 4. Preparar petición a Gemini
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const requestBody = {
      contents: [{
        parts: [{
          text: prompt
        }]
      }],
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: maxTokens,
      }
    };

    // 5. Llamar a Gemini API
    const geminiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    // 6. Verificar respuesta
    if (!geminiResponse.ok) {
      const errorData = await geminiResponse.json();
      console.error('❌ Error de Gemini API:', errorData);
      
      return res.status(geminiResponse.status).json({ 
        error: 'Gemini API error',
        message: errorData.error?.message || 'Error en la llamada a Gemini',
        details: errorData
      });
    }

    // 7. Parsear respuesta
    const data = await geminiResponse.json();
    console.log('✅ Respuesta recibida de Gemini');

    // 8. Extraer el texto de la respuesta
    // Gemini devuelve: { candidates: [{ content: { parts: [{ text: "..." }] } }] }
    if (!data.candidates || data.candidates.length === 0) {
      return res.status(500).json({
        error: 'Empty response',
        message: 'Gemini no devolvió contenido'
      });
    }

    const responseText = data.candidates[0].content.parts[0].text;
    
    // 9. Convertir respuesta de Gemini a formato compatible con Claude
    // Para que el frontend no necesite cambios
    const claudeFormatResponse = {
      content: [{
        type: 'text',
        text: responseText
      }]
    };

    console.log('✅ Respuesta formateada y lista');

    // 10. Devolver en formato compatible con Claude
    return res.status(200).json(claudeFormatResponse);

  } catch (error) {
    // Error general
    console.error('❌ Error en la función serverless:', error);
    
    return res.status(500).json({ 
      error: 'Server error',
      message: error.message || 'Error interno del servidor',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
