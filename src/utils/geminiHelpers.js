/**
 * Utilidades compartidas para llamadas a la API de Gemini y procesamiento de respuestas.
 * Usadas por useGenerationQueue y ThemeDetailModal (vía useThemeModal).
 */
import { jsonrepair } from 'jsonrepair';
import { MAX_CHARS, normalizeDifficulty } from './constants';

/**
 * Extrae el texto utilizable de un documento.
 * Devuelve cadena vacía si no hay contenido real.
 */
export function extractDocContent(doc) {
  if (doc.processedContent && doc.processedContent.trim().length > 80) return doc.processedContent;
  if (doc.searchResults?.processedContent && doc.searchResults.processedContent.trim().length > 80) return doc.searchResults.processedContent;
  if (doc.searchResults?.content && doc.searchResults.content.trim().length > 80) return doc.searchResults.content;
  if (doc.type !== 'url' && doc.content && doc.content.trim().length > 80) return doc.content;
  return '';
}

/**
 * Concatena el contenido de los documentos de un tema respetando MAX_CHARS.
 * Devuelve { text, docsUsed, docsSkipped }
 */
export function buildContent(documents) {
  if (!Array.isArray(documents) || documents.length === 0) return { text: '', docsUsed: 0, docsSkipped: 0 };
  let text = '';
  let charCount = 0;
  let docsUsed = 0;
  let docsSkipped = 0;
  for (const doc of documents) {
    if (charCount >= MAX_CHARS) break;
    const extracted = extractDocContent(doc);
    if (!extracted) { docsSkipped++; continue; }
    const chunk = `\n${extracted}\n`;
    const remaining = MAX_CHARS - charCount;
    text += chunk.substring(0, remaining);
    charCount += Math.min(chunk.length, remaining);
    docsUsed++;
  }
  return { text, docsUsed, docsSkipped };
}

/**
 * Parsea la respuesta de texto de la IA y extrae un array de preguntas.
 * Devuelve [] si no se puede parsear.
 */
export function parseQuestionsResponse(textContent) {
  let cleaned = textContent.trim()
    .replace(/```json\s*/g, '').replace(/```\s*/g, '')
    .replace(/^[^[]*/, '').replace(/[^\]]*$/, '');
  const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];
  try { return JSON.parse(jsonMatch[0]); }
  catch {
    try { return JSON.parse(jsonrepair(jsonMatch[0])); }
    catch { return []; }
  }
}

/**
 * Normaliza y mapea el array crudo de preguntas de la IA al formato interno.
 */
export function mapRawQuestions(parsed, themeNumber) {
  return parsed.map((q, i) => ({
    id: `${themeNumber}-ai-${Date.now()}-${i}`,
    text: q.pregunta || q.text || 'Pregunta sin texto',
    options: q.opciones || q.options || ['A', 'B', 'C'],
    correct: q.correcta ?? q.correct ?? 0,
    source: 'IA',
    difficulty: normalizeDifficulty(q.dificultad || q.difficulty),
    explanation: q.explicacion || q.explanation || '',
    needsReview: false,
    createdAt: new Date().toISOString(),
  }));
}

/**
 * Extrae material y array de preguntas de una respuesta con marcadores.
 * Formato esperado:
 *   MATERIAL_START ... MATERIAL_END
 *   QUESTIONS_START [...] QUESTIONS_END
 * Devuelve { material: string|null, preguntas: array|null }
 */
export function parseCombinedResponse(text) {
  const materialMatch = text.match(/MATERIAL_START\s*([\s\S]*?)\s*MATERIAL_END/);
  const questionsMatch = text.match(/QUESTIONS_START\s*([\s\S]*?)\s*QUESTIONS_END/);
  const material = materialMatch?.[1]?.trim() || null;
  let preguntas = null;
  if (questionsMatch?.[1]) {
    const raw = questionsMatch[1].trim().replace(/```json\s*/g, '').replace(/```\s*/g, '');
    const arrMatch = raw.match(/\[[\s\S]*\]/);
    if (arrMatch) {
      try { preguntas = JSON.parse(arrMatch[0]); }
      catch {
        try { preguntas = JSON.parse(jsonrepair(arrMatch[0])); } catch { /* no questions extracted */ }
      }
    }
  }
  return { material, preguntas };
}

/**
 * Concatena el contenido de los documentos con cabeceras de sección para prompts de IA.
 * Versión enriquecida (con headers de sección) para uso en ThemeDetailModal.
 * Complementa a buildContent (versión simple usada en useGenerationQueue).
 * Devuelve string con el contenido concatenado.
 */
export function buildDocumentContents(docs) {
  if (!Array.isArray(docs) || docs.length === 0) return '';
  let documentContents = '';
  let charCount = 0;
  for (const doc of docs) {
    if (charCount >= MAX_CHARS) break;
    let docText = '';
    if (doc.processedContent) {
      docText = `\n═══ FUENTE OPTIMIZADA ═══\n${doc.fileName || (doc.content || '').substring(0, 100)}\n\n${doc.processedContent}\n`;
    } else if (doc.searchResults?.processedContent) {
      docText = `\n═══ BÚSQUEDA IA OPTIMIZADA ═══\n${doc.content}\n\n${doc.searchResults.processedContent}\n`;
    } else if (doc.searchResults?.content) {
      docText = `\n═══ BÚSQUEDA WEB ═══\n${doc.content}\n\n${doc.searchResults.content}\n`;
    } else if (doc.type !== 'url' && doc.content) {
      docText = `\n═══ DOCUMENTO ═══\n${doc.fileName || 'Texto pegado'}\n\n${doc.content}\n`;
    }
    const remaining = MAX_CHARS - charCount;
    documentContents += docText.substring(0, remaining);
    charCount += Math.min(docText.length, remaining);
  }
  return documentContents;
}

/**
 * Filtra preguntas duplicadas respecto a un array de textos existentes.
 * Usa comparación exacta + similitud de palabras (>80%).
 */
export function deduplicateQuestions(questions, existingTexts) {
  return questions.filter(q => {
    const newText = q.text.toLowerCase().trim();
    if (existingTexts.some(et => et === newText)) return false;
    const words1 = newText.split(/\s+/);
    return !existingTexts.some(et => {
      const words2 = et.split(/\s+/);
      const common = words1.filter(w => words2.includes(w));
      return common.length / Math.max(words1.length, words2.length) > 0.8;
    });
  });
}
