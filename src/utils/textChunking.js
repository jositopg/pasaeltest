/**
 * UTILIDAD DE CHUNKING INTELIGENTE
 * 
 * Divide documentos largos en chunks optimizados para generación de preguntas
 * - Respeta estructura del documento
 * - Evita cortar en medio de secciones
 * - Añade overlap para contexto
 */

export const chunkDocument = (text, options = {}) => {
  const {
    maxChunkSize = 25000,        // Caracteres por chunk
    minChunkSize = 10000,         // Mínimo para considerar chunk
    overlap = 500,                // Overlap entre chunks para contexto
    breakMarkers = [              // Marcadores donde es seguro romper
      '\n\n## ',                  // Headers markdown nivel 2
      '\n\n# ',                   // Headers markdown nivel 1
      '\n\nCapítulo ',            // Capítulos
      '\n\nArtículo ',            // Artículos de ley
      '\n\nTítulo ',              // Títulos
      '\n\nSección ',             // Secciones
      '\n\n'                      // Párrafos (último recurso)
    ]
  } = options;

  // Si el texto es pequeño, devolver como un solo chunk
  if (text.length <= maxChunkSize) {
    return [{
      content: text,
      index: 0,
      start: 0,
      end: text.length,
      size: text.length
    }];
  }

  const chunks = [];
  let currentPosition = 0;
  let chunkIndex = 0;

  while (currentPosition < text.length) {
    const remainingText = text.length - currentPosition;
    
    // Si queda menos de minChunkSize, añadir al último chunk
    if (remainingText < minChunkSize && chunks.length > 0) {
      chunks[chunks.length - 1].content += text.substring(currentPosition);
      chunks[chunks.length - 1].end = text.length;
      chunks[chunks.length - 1].size = chunks[chunks.length - 1].content.length;
      break;
    }

    // Calcular punto de corte ideal
    let endPosition = Math.min(currentPosition + maxChunkSize, text.length);
    
    // Si no es el final del documento, buscar punto de corte inteligente
    if (endPosition < text.length) {
      let bestBreakPoint = -1;
      
      // Intentar encontrar marcador de ruptura en los últimos 2000 chars
      const searchStart = Math.max(endPosition - 2000, currentPosition);
      const searchText = text.substring(searchStart, endPosition);
      
      // Buscar marcadores en orden de prioridad
      for (const marker of breakMarkers) {
        const lastIndex = searchText.lastIndexOf(marker);
        if (lastIndex !== -1) {
          bestBreakPoint = searchStart + lastIndex + marker.length;
          break;
        }
      }
      
      // Si encontramos punto de corte, usarlo
      if (bestBreakPoint !== -1) {
        endPosition = bestBreakPoint;
      }
    }

    // Crear chunk
    const chunkContent = text.substring(currentPosition, endPosition);
    
    chunks.push({
      content: chunkContent,
      index: chunkIndex,
      start: currentPosition,
      end: endPosition,
      size: chunkContent.length
    });

    // Mover posición con overlap
    currentPosition = endPosition - overlap;
    chunkIndex++;
  }

  return chunks;
};

/**
 * Estimar número de preguntas por documento
 */
export const estimateQuestions = (documentLength) => {
  const avgChunkSize = 25000;
  const questionsPerChunk = 25;
  
  const numChunks = Math.ceil(documentLength / avgChunkSize);
  const totalQuestions = numChunks * questionsPerChunk;
  
  return {
    numChunks,
    questionsPerChunk,
    totalQuestions,
    estimatedTime: numChunks * 8 // 8 segundos por chunk aproximadamente
  };
};

/**
 * Formatear tiempo estimado
 */
export const formatEstimatedTime = (seconds) => {
  if (seconds < 60) return `${seconds} segundos`;
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} minuto${minutes > 1 ? 's' : ''}`;
};
