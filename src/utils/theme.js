/**
 * SISTEMA DE DISEÑO - PASAELTEST
 * 
 * Paleta: Modo claro/oscuro
 * Acento: Azul eléctrico (#2563EB) → Violeta (#7C3AED)
 * Tipografía: Sora (display) + DM Sans (body)
 * Estilo: Clean, moderno, mobile-first
 */

export const DESIGN_TOKENS = {
  // ─── COLORES MODO CLARO ───────────────────────────────────────────
  light: {
    bg: {
      primary: '#F0F4FF',      // Fondo principal azul muy claro
      secondary: '#FFFFFF',    // Cards
      tertiary: '#E8EEFF',     // Secciones destacadas
      input: '#F8FAFF',        // Inputs
    },
    text: {
      primary: '#0F172A',      // Texto principal
      secondary: '#475569',    // Texto secundario
      muted: '#94A3B8',        // Texto desactivado
      inverse: '#FFFFFF',      // Texto sobre fondos oscuros
    },
    border: {
      default: '#E2E8F0',
      focus: '#2563EB',
    },
    shadow: {
      sm: '0 1px 3px rgba(15,23,42,0.08)',
      md: '0 4px 16px rgba(15,23,42,0.10)',
      lg: '0 8px 32px rgba(15,23,42,0.12)',
    }
  },

  // ─── COLORES MODO OSCURO ──────────────────────────────────────────
  dark: {
    bg: {
      primary: '#080C14',      // Fondo principal casi negro-azul
      secondary: '#0F172A',    // Cards
      tertiary: '#1E293B',     // Secciones
      input: '#1E293B',        // Inputs
    },
    text: {
      primary: '#F1F5F9',
      secondary: '#94A3B8',
      muted: '#475569',
      inverse: '#0F172A',
    },
    border: {
      default: '#1E293B',
      focus: '#3B82F6',
    },
    shadow: {
      sm: '0 1px 3px rgba(0,0,0,0.3)',
      md: '0 4px 16px rgba(0,0,0,0.4)',
      lg: '0 8px 32px rgba(0,0,0,0.5)',
    }
  },

  // ─── ACENTO (igual en ambos modos) ───────────────────────────────
  accent: {
    blue: '#2563EB',
    violet: '#7C3AED',
    gradient: 'linear-gradient(135deg, #2563EB, #7C3AED)',
    gradientHover: 'linear-gradient(135deg, #1D4ED8, #6D28D9)',
    glow: '0 0 20px rgba(37,99,235,0.4)',
  },

  // ─── ESTADOS ─────────────────────────────────────────────────────
  status: {
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#3B82F6',
  },

  // ─── ESPACIADO ───────────────────────────────────────────────────
  spacing: {
    navHeight: '72px',
    maxWidth: '480px',       // Mobile max width
    maxWidthDesktop: '1200px',
  },

  // ─── BORDES ──────────────────────────────────────────────────────
  radius: {
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '24px',
    full: '9999px',
  }
};

/**
 * Clases de Tailwind para los temas
 * Uso: dark ? THEME.dark.card : THEME.light.card
 */
export const THEME = {
  light: {
    // Fondos
    page: 'bg-[#F0F4FF]',
    card: 'bg-white shadow-md border border-slate-200/60',
    cardHover: 'hover:shadow-lg hover:border-blue-200 transition-all duration-200',
    input: 'bg-[#F8FAFF] border border-slate-200 text-slate-900',
    select: 'bg-white border border-slate-200 text-slate-900',
    
    // Texto
    textPrimary: 'text-slate-900',
    textSecondary: 'text-slate-500',
    textMuted: 'text-slate-400',
    
    // Navegación
    nav: 'bg-white/90 backdrop-blur-xl border-t border-slate-200',
    navActive: 'text-blue-600 bg-blue-50',
    navInactive: 'text-slate-400',
    
    // Separadores
    divider: 'border-slate-200',
    
    // Header
    header: 'bg-white/80 backdrop-blur-xl border-b border-slate-200/60',
  },
  dark: {
    // Fondos
    page: 'bg-[#080C14]',
    card: 'bg-[#0F172A] border border-[#1E293B]',
    cardHover: 'hover:border-blue-500/30 transition-all duration-200',
    input: 'bg-[#1E293B] border border-[#334155] text-slate-100',
    select: 'bg-[#1E293B] border border-[#334155] text-slate-100',
    
    // Texto
    textPrimary: 'text-slate-100',
    textSecondary: 'text-slate-400',
    textMuted: 'text-slate-600',
    
    // Navegación
    nav: 'bg-[#0F172A]/95 backdrop-blur-xl border-t border-[#1E293B]',
    navActive: 'text-blue-400 bg-blue-500/10',
    navInactive: 'text-slate-600',
    
    // Separadores
    divider: 'border-[#1E293B]',
    
    // Header
    header: 'bg-[#0F172A]/90 backdrop-blur-xl border-b border-[#1E293B]',
  }
};

export default DESIGN_TOKENS;
