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
  examName: 'Mi Examen',
  penaltySystem: 'classic',
  darkMode: false,
  notifications: false
};

export const PENALTY_SYSTEMS = {
  classic: { label: 'Clásico (3 mal = -1 bien)', factor: 1/3 },
  half: { label: 'Medio (2 mal = -1 bien)', factor: 1/2 },
  none: { label: 'Sin penalización', factor: 0 },
};

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

export const MAX_CHARS = 100000;
export const QUESTIONS_PER_BATCH = 40;

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
