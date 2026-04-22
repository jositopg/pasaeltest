/**
 * CONSTANTES CENTRALIZADAS
 * 
 * Toda la configuración de la app en un solo lugar.
 * Cambiar aquí se refleja en toda la app.
 */

export const DEBUG = false;

export const APP_NAME = 'PasaElTest';

export const DEFAULT_PROFILE = {
  name: 'Usuario',
  examName: 'Mi Plan',
  penaltySystem: 'classic',
  darkMode: false,
  notifications: false
};

export const PENALTY_SYSTEMS = [
  { value: 'none',    label: 'Sin penalización',               desc: 'Los fallos no restan.',                           factor: 0   },
  { value: 'each4',   label: '4 incorrectas quitan 1 acierto', desc: 'Por cada 4 fallos se resta 1 pregunta correcta.', factor: 1/4 },
  { value: 'classic', label: '3 incorrectas quitan 1 acierto', desc: 'Por cada 3 fallos se resta 1 pregunta correcta.', factor: 1/3 },
  { value: 'each2',   label: '2 incorrectas quitan 1 acierto', desc: 'Por cada 2 fallos se resta 1 pregunta correcta.', factor: 1/2 },
  { value: 'each1',   label: '1 incorrecta quita 1 acierto',   desc: 'Cada fallo resta 1 pregunta correcta.',           factor: 1   },
];

export function getPenaltyValue(incorrect, system) {
  switch (system) {
    case 'none':  return 0;
    case 'each4': return Math.floor(incorrect / 4);
    case 'each2': return Math.floor(incorrect / 2);
    case 'each1': return incorrect;
    default:      return Math.floor(incorrect / 3); // classic
  }
}

export function toSlug(str) {
  return String(str).toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// Para mostrar en la UI (con tildes). Para guardar en DB usar normalizeDifficulty() (sin tildes).
export const DIFFICULTY_LEVELS = ['fácil', 'media', 'difícil'];

export const DOC_TYPES = [
  { value: 'url', label: '🔗 URL / Enlace web' },
  { value: 'paste-text', label: '📋 Pegar texto' },
  { value: 'upload-file', label: '📎 Subir archivo (PDF/Word)' },
  { value: 'ai-search', label: '🤖 Búsqueda con IA' },
];

export const GRADIENT_STYLE = {
  background: 'linear-gradient(135deg, #2563EB, #7C3AED)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
};

export const GRADIENT_BG = 'linear-gradient(135deg, #2563EB, #7C3AED)';

export const MAX_CHARS = 200000;
export const QUESTIONS_PER_BATCH = 25;

export const TIMEOUTS = {
  TOAST: 3000,
  TOAST_ANIMATION: 300,
  SAVE_FEEDBACK: 2000,
  THEME_UPDATE: 150,
};

// Única fuente de verdad — eliminar las copias locales en ThemeDetailModal y questionImporter
export const normalizeDifficulty = (d) => {
  if (!d) return 'media';
  const lower = String(d).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (['facil', 'easy', 'baja', 'low', 'simple'].includes(lower)) return 'facil';
  if (['dificil', 'hard', 'difficult', 'alta', 'high'].includes(lower)) return 'dificil';
  return 'media';
};
