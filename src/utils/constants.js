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
  examName: 'Mi Oposición',
  numThemes: 90,
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
