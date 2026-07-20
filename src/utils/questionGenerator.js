/**
 * Núcleo compartido de generación de preguntas con IA.
 * Usado por useGenerationQueue (background, ThemesScreen) y useQuestionGeneration
 * (primer plano, ThemeDetailModal) — antes cada uno duplicaba esta lógica.
 *
 * El reintento ante 503/429 y el fallback de modelo ya los gestiona el servidor
 * (api/generate-gemini.js), así que aquí no se reintenta en cliente.
 */
import {
  OPTIMIZED_QUESTION_PROMPT,
  OPTIMIZED_PHASE2_PROMPT,
  OPTIMIZED_AUTO_GENERATE_PROMPT,
  COMBINED_AUTO_AND_QUESTIONS_PROMPT,
} from './optimizedPrompts';
import { analyzeDocument, determineQuestionTypes } from './documentAnalyzer';
import { QUESTIONS_PER_BATCH, MAX_PROMPT_CHARS } from './constants';
import {
  buildDocumentContents,
  parseCombinedResponse,
  parseQuestionsResponse,
  mapRawQuestions,
  deduplicateQuestions,
  splitIntoChunks,
} from './geminiHelpers';
import { authHelpers } from '../supabaseClient';

const QUESTIONS_PER_CHUNK = 15;

async function callGeminiAPI(prompt, { maxTokens, callType, useCache } = {}) {
  const token = await authHelpers.getAccessToken();
  const response = await fetch('/api/generate-gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
    body: JSON.stringify({ prompt, maxTokens, callType, ...(useCache === false && { useCache: false }) }),
  });
  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Error API (${response.status})${errorText ? `: ${errorText.substring(0, 200)}` : ''}`);
  }
  const data = await response.json();
  if (!Array.isArray(data.content)) throw new Error('Respuesta de la IA inválida o vacía. Reintenta.');
  let text = '';
  for (const block of data.content) if (block.type === 'text') text += block.text;
  if (!text) throw new Error('La IA no devolvió contenido.');
  return text;
}

// Elige el prompt de fase 2 (por sección) si el contenido tiene secciones relevantes.
function buildQuestionPrompt(themeName, chunkContent, numQuestions, existingTexts) {
  const analysis = analyzeDocument(chunkContent);
  const significantSections = analysis.sections.filter(s => s.level === 'critical' || s.level === 'high');
  if (significantSections.length >= 2) {
    const topSection = significantSections[0];
    const sectionMeta = { index: 0, total: significantSections.length, title: topSection.title, type: topSection.type, level: topSection.level };
    const questionTypes = determineQuestionTypes(topSection);
    return OPTIMIZED_PHASE2_PROMPT(themeName, sectionMeta, numQuestions, chunkContent, existingTexts.join('\n'), questionTypes);
  }
  return OPTIMIZED_QUESTION_PROMPT(themeName, numQuestions, chunkContent, existingTexts.join('\n'));
}

async function generateQuestionsForChunk(themeName, themeNumber, chunkContent, numQuestions, existingTexts) {
  const prompt = buildQuestionPrompt(themeName, chunkContent, numQuestions, existingTexts);
  const text = await callGeminiAPI(prompt, { maxTokens: 12000, callType: 'questions' });
  const parsed = parseQuestionsResponse(text);
  if (!parsed.length) throw new Error('No se pudo extraer preguntas de la respuesta de la IA.');
  return mapRawQuestions(parsed, themeNumber);
}

/**
 * Genera preguntas a partir de los documentos propios del tema (PDF/URL/texto).
 * Trocea el contenido si es muy largo y acumula preguntas por chunk.
 * Devuelve { newQuestions, chunkCount, regeneratedDoc }.
 * regeneratedDoc es un documento nuevo si el material era insuficiente y se
 * regeneró un repositorio con IA — el llamador decide si guardarlo.
 */
export async function generateFromDocuments(theme, docs, { onProgress } = {}) {
  let { text: documentContents, docsUsed, docsSkipped } = buildDocumentContents(docs, { includeHeaders: true });
  let regeneratedDoc = null;

  if (documentContents.trim().length < 100 && docs.length > 0) {
    onProgress?.({ step: 'regenerating-repo' });
    try {
      const repoText = await callGeminiAPI(OPTIMIZED_AUTO_GENERATE_PROMPT(theme.name), { maxTokens: 8000, callType: 'repo' });
      if (repoText.trim().length > 100) {
        documentContents = repoText;
        regeneratedDoc = {
          type: 'ai-search', content: theme.name,
          fileName: `Repositorio: ${theme.name}`,
          processedContent: repoText,
          searchResults: { query: theme.name, content: repoText, processedContent: repoText },
          addedAt: new Date().toISOString(),
        };
      }
    } catch { /* sigue con lo que había, se valida abajo */ }
  }

  if (documentContents.trim().length < 100) {
    const reason = docsSkipped > 0 && docsUsed === 0
      ? `${docsSkipped} doc${docsSkipped > 1 ? 's' : ''} sin contenido extraído`
      : 'Contenido insuficiente para generar preguntas';
    throw new Error(reason);
  }

  const chunks = splitIntoChunks(documentContents, MAX_PROMPT_CHARS);
  const numQuestionsPerChunk = chunks.length === 1 ? QUESTIONS_PER_BATCH : QUESTIONS_PER_CHUNK;

  let accumulatedTexts = (Array.isArray(theme.questions) ? theme.questions : []).map(q => q.text.toLowerCase().trim());
  let allNewQuestions = [];

  for (let i = 0; i < chunks.length; i++) {
    onProgress?.({ step: 'chunk', index: i, total: chunks.length });
    try {
      const raw = await generateQuestionsForChunk(theme.name, theme.number, chunks[i], numQuestionsPerChunk, accumulatedTexts);
      const fresh = deduplicateQuestions(raw, accumulatedTexts);
      allNewQuestions = [...allNewQuestions, ...fresh];
      accumulatedTexts = [...accumulatedTexts, ...fresh.map(q => q.text.toLowerCase().trim())];
    } catch (err) {
      console.warn(`Chunk ${i + 1}/${chunks.length} falló:`, err.message);
      if (chunks.length === 1) throw err;
    }
  }

  if (allNewQuestions.length === 0) throw new Error('No se generaron preguntas válidas. Intenta de nuevo.');
  return { newQuestions: allNewQuestions, chunkCount: chunks.length, regeneratedDoc };
}

/**
 * Genera material + preguntas en una sola llamada (tema sin documentos propios).
 * Si la IA no devuelve preguntas parseables, hace una segunda llamada usando
 * el material recién generado como contenido.
 * Devuelve { newDoc, newQuestions }.
 */
export async function generateCombined(theme, { onProgress } = {}) {
  onProgress?.({ step: 'material' });
  const text = await callGeminiAPI(
    COMBINED_AUTO_AND_QUESTIONS_PROMPT(theme.name, QUESTIONS_PER_BATCH),
    { maxTokens: 12000, callType: 'repo', useCache: false }
  );

  const { material, preguntas: rawPreguntas } = parseCombinedResponse(text);
  const processedContent = material || text;
  if (processedContent.trim().length < 100) throw new Error('Contenido insuficiente de la IA.');

  const newDoc = {
    type: 'ai-search', content: theme.name,
    fileName: `Material: ${theme.name}`,
    addedAt: new Date().toISOString(),
    searchResults: { query: theme.name, content: processedContent, processedContent },
    processedContent,
  };

  const existingTexts = (Array.isArray(theme.questions) ? theme.questions : []).map(q => q.text.toLowerCase().trim());
  let newQuestions = [];
  if (rawPreguntas?.length) {
    newQuestions = deduplicateQuestions(mapRawQuestions(rawPreguntas, theme.number), existingTexts);
  }

  if (newQuestions.length === 0) {
    onProgress?.({ step: 'fallback-questions' });
    try {
      const raw = await generateQuestionsForChunk(theme.name, theme.number, processedContent.substring(0, MAX_PROMPT_CHARS), QUESTIONS_PER_BATCH, existingTexts);
      newQuestions = deduplicateQuestions(raw, existingTexts);
    } catch (err) {
      console.warn('Fallback de preguntas tras generación combinada falló:', err.message);
    }
  }

  return { newDoc, newQuestions };
}
