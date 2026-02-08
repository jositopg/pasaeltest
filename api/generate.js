/**
 * Función Serverless para llamar a Anthropic API
 * 
 * Esta función se ejecuta en el SERVIDOR (Vercel), no en el navegador.
 * Soporta:
 * - Generación de preguntas
 * - Búsqueda web con IA
 * - Procesamiento de documentos
 * 
 * Ventajas:
 * - API key segura (nunca expuesta al público)
 * - Sin problemas de CORS
 * - Validación y control en servidor
 */

export default async function handler(req, res) {
  // Solo permitir POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: 'Solo se permiten peticiones POST' 
    });
  }

  try {
    // 1. Leer los datos que envió el frontend
    const { 
      prompt,           // El prompt completo para Claude
      useWebSearch,     // Si debe usar web_search tool
      maxTokens = 4096  // Tokens máximos de respuesta
    } = req.body;

    // 2. Validar que se envió prompt
    if (!prompt || prompt.trim().length === 0) {
      return res.status(400).json({ 
        error: 'Bad request',
        message: 'El prompt no puede estar vacío' 
      });
    }

    // 3. Validar que existe la API key en las variables de entorno
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.error('❌ ANTHROPIC_API_KEY no configurada en Vercel');
      return res.status(500).json({ 
        error: 'Server configuration error',
        message: 'API key no configurada en el servidor' 
      });
    }

    console.log('🤖 Llamando a Anthropic API...');
    console.log(`📝 Prompt (primeros 100 chars): ${prompt.substring(0, 100)}...`);
    console.log(`🔍 Web Search: ${useWebSearch ? 'SÍ' : 'NO'}`);
    console.log(`📊 Max Tokens: ${maxTokens}`);

    // 4. Preparar el body de la petición a Anthropic
    const requestBody = {
      model: 'claude-sonnet-4-20250514',
      max_tokens: maxTokens,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    };

    // 5. Añadir web_search tool si es necesario
    if (useWebSearch) {
      requestBody.tools = [{
        type: 'web_search_20250305',
        name: 'web_search'
      }];
    }

    // 6. Llamar a la API de Anthropic (servidor → servidor, sin CORS)
    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,  // ← API key SEGURA (solo en servidor)
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(requestBody)
    });

    // 7. Verificar si la llamada fue exitosa
    if (!anthropicResponse.ok) {
      const errorData = await anthropicResponse.json();
      console.error('❌ Error de Anthropic API:', errorData);
      
      return res.status(anthropicResponse.status).json({ 
        error: 'Anthropic API error',
        message: errorData.error?.message || 'Error en la llamada a la IA',
        details: errorData
      });
    }

    // 8. Parsear y devolver la respuesta completa
    const data = await anthropicResponse.json();
    console.log('✅ Respuesta recibida de Claude');

    // 9. Devolver la respuesta tal cual al frontend
    // El frontend ya sabe cómo procesarla
    return res.status(200).json(data);

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
